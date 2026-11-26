import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodSchema } from 'zod';

const MAX_BODY_BYTES = 32 * 1024; // 32 KB strict cap

export class HttpError extends Error {
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor(statusCode: number, publicMessage: string) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

/**
 * Applies hardened security headers to every HTTP response.
 */
export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  applySecurityHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export async function readValidatedJson<T>(
  req: IncomingMessage,
  schema: ZodSchema<T>
): Promise<T> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request payload exceeds 32 KB limit');
    }
    chunks.push(buf);
  }

  const rawText = Buffer.concat(chunks).toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new HttpError(400, 'Malformed JSON request body');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
      : 'Validation failed';
    throw new HttpError(400, msg);
  }

  return result.data;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  allow(clientKey: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const existing = this.hits.get(clientKey) ?? [];
    const recent = existing.filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      this.hits.set(clientKey, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(clientKey, recent);

    // Prevent unbounded map growth under heavy traffic
    if (this.hits.size > 2000) {
      for (const [k, timestamps] of this.hits) {
        if (timestamps.every((ts) => ts <= cutoff)) {
          this.hits.delete(k);
        }
      }
    }

    return true;
  }
}

export function getClientIp(req: IncomingMessage): string {
  const remote = req.socket?.remoteAddress;
  return remote && remote.length > 0 ? remote : 'unknown';
}
