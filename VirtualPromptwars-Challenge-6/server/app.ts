import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_PRESETS } from '../shared/presets.ts';
import { ChatRequestSchema, PlanRequestSchema } from '../shared/types.ts';
import {
  generateAssistantPlan,
  generateChatReply,
} from './ai/synthesisEngine.ts';
import {
  applySecurityHeaders,
  getClientIp,
  HttpError,
  readValidatedJson,
  sendJson,
  SlidingWindowRateLimiter,
} from './security.ts';
import { resolveLocationTelemetry } from './services/airDataService.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = path.resolve(__dirname, '..', 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export interface AppServerOptions {
  distDir?: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  preferLiveAirData?: boolean;
}

async function tryServeStatic(
  reqPath: string,
  distDir: string,
  res: http.ServerResponse
): Promise<boolean> {
  const safeSubPath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const resolvedDist = path.resolve(distDir);
  const candidate = path.resolve(resolvedDist, safeSubPath);

  // Path traversal defense: ensure resolved path remains strictly inside distDir
  if (
    candidate !== resolvedDist &&
    !candidate.startsWith(`${resolvedDist}${path.sep}`)
  ) {
    throw new HttpError(403, 'Forbidden path');
  }

  let targetFile = candidate;
  try {
    const stat = await fs.stat(targetFile);
    if (!stat.isFile()) {
      targetFile = path.join(resolvedDist, 'index.html');
    }
  } catch {
    // SPA fallback for client routes (never for /api/*)
    targetFile = path.join(resolvedDist, 'index.html');
  }

  try {
    const content = await fs.readFile(targetFile);
    const ext = path.extname(targetFile).toLowerCase();
    applySecurityHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader(
      'Cache-Control',
      ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    );
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export function createAppServer(options: AppServerOptions = {}): http.Server {
  const distDir = options.distDir ?? DEFAULT_DIST_DIR;
  const limiter = new SlidingWindowRateLimiter({
    maxRequests: options.rateLimitMax ?? 120,
    windowMs: options.rateLimitWindowMs ?? 60_000,
  });

  return http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const rawUrl = req.url ?? '/';
      if (
        rawUrl.includes('..') ||
        /%2e%2e/i.test(rawUrl) ||
        rawUrl.includes('\\')
      ) {
        throw new HttpError(403, 'Forbidden path');
      }

      const requestUrl = new URL(rawUrl, 'http://127.0.0.1');
      const pathname = requestUrl.pathname;

      if (pathname.startsWith('/api/')) {
        const ip = getClientIp(req);
        if (!limiter.allow(ip)) {
          throw new HttpError(429, 'Rate limit exceeded. Please wait briefly.');
        }

        if (method === 'GET' && pathname === '/api/health') {
          const hasExternalAi = Boolean(
            process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
          );
          sendJson(res, 200, {
            ok: true,
            service: 'aeroshield-family',
            aiMode: hasExternalAi ? 'hybrid-llm' : 'aeroguide-engine',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (method === 'GET' && pathname === '/api/presets') {
          sendJson(res, 200, { presets: CITY_PRESETS });
          return;
        }

        if (method === 'GET' && pathname === '/api/air-quality') {
          const city = requestUrl.searchParams.get('city') ?? undefined;
          const presetId = requestUrl.searchParams.get('presetId') ?? undefined;
          const vulnerable =
            requestUrl.searchParams.get('vulnerable') !== 'false';

          const telemetry = await resolveLocationTelemetry({
            city,
            presetId,
            hasVulnerableMembers: vulnerable,
            preferLive: options.preferLiveAirData,
          });
          sendJson(res, 200, { telemetry });
          return;
        }

        if (method === 'POST' && pathname === '/api/plan') {
          const body = await readValidatedJson(req, PlanRequestSchema);
          const telemetry = await resolveLocationTelemetry({
            city: body.cityQuery ?? body.profile.city,
            presetId: body.profile.presetId,
            hasVulnerableMembers: body.profile.vulnerabilities.length > 0,
            preferLive: options.preferLiveAirData,
          });
          const plan = await generateAssistantPlan(
            telemetry,
            body.profile,
            body.selectedActionIds
          );
          sendJson(res, 200, { telemetry, plan });
          return;
        }

        if (method === 'POST' && pathname === '/api/chat') {
          const body = await readValidatedJson(req, ChatRequestSchema);
          const telemetry = await resolveLocationTelemetry({
            city: body.profile.city,
            presetId: body.profile.presetId,
            hasVulnerableMembers: body.profile.vulnerabilities.length > 0,
            preferLive: options.preferLiveAirData,
          });
          const reply = await generateChatReply(body, telemetry);
          sendJson(res, 200, reply);
          return;
        }

        throw new HttpError(404, 'API endpoint not found');
      }

      if (method !== 'GET' && method !== 'HEAD') {
        throw new HttpError(405, 'Method not allowed');
      }

      const served = await tryServeStatic(pathname, distDir, res);
      if (!served) {
        sendJson(res, 404, {
          error: 'Frontend build not found. Run "npm run build" or use Vite dev server.',
        });
      }
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, { error: error.publicMessage });
        return;
      }
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });
}
