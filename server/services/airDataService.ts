import {
  assessInversionRisk,
  buildDiurnalWinterCurve,
  calculatePm25Aqi,
  classifyAqi,
} from '../../shared/airQuality.ts';
import {
  buildPresetTelemetry,
  CITY_PRESETS,
  findPresetByCityOrId,
} from '../../shared/presets.ts';
import type { HourlyAirPoint, LocationTelemetry } from '../../shared/types.ts';
import { sanitizeCityInput } from '../ai/promptSafety.ts';

const ALLOWED_GEOCODE_HOST = 'geocoding-api.open-meteo.com';
const ALLOWED_AQ_HOST = 'air-quality-api.open-meteo.com';
const ALLOWED_WEATHER_HOST = 'api.open-meteo.com';

interface CacheEntry {
  telemetry: LocationTelemetry;
  expiresAt: number;
}

const telemetryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchJsonWithTimeout(url: URL, timeoutMs = 4500): Promise<unknown> {
  // SSRF guard: strictly enforce https and allowlisted Open-Meteo hostnames
  const allowedHosts = new Set([
    ALLOWED_GEOCODE_HOST,
    ALLOWED_AQ_HOST,
    ALLOWED_WEATHER_HOST,
  ]);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
    throw new Error('Blocked outbound request to non-allowlisted host');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream telemetry HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

interface GeocodePayload {
  results?: Array<{
    name?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

interface AirQualityPayload {
  current?: {
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
  };
  hourly?: {
    time?: string[];
    pm2_5?: Array<number | null>;
  };
}

interface WeatherPayload {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    relative_humidity_2m?: number;
  };
}

function buildHourlyFromLive(
  times: string[] | undefined,
  pmSeries: Array<number | null> | undefined,
  fallbackBase: number
): HourlyAirPoint[] {
  if (!times || !pmSeries || times.length < 24 || pmSeries.length < 24) {
    return buildDiurnalWinterCurve(fallbackBase);
  }
  const points: HourlyAirPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const raw = pmSeries[i];
    const pm25 =
      typeof raw === 'number' && Number.isFinite(raw)
        ? Math.max(2, Math.round(raw * 10) / 10)
        : fallbackBase;
    const hour = i;
    const aqi = calculatePm25Aqi(pm25);
    points.push({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      pm25,
      aqi,
      inversionFactor: Math.round((pm25 / Math.max(1, fallbackBase)) * 100) / 100,
      ventilationSafe: pm25 <= 45 || (hour >= 12 && hour <= 15 && pm25 <= 75),
    });
  }
  return points;
}

/**
 * Resolves air quality & winter meteorology for a city or preset.
 * Tries Open-Meteo live telemetry when enabled, with automatic deterministic
 * regional winter smog fallback when offline or rate-limited.
 */
export async function resolveLocationTelemetry(options: {
  city?: string;
  presetId?: string;
  hasVulnerableMembers?: boolean;
  preferLive?: boolean;
}): Promise<LocationTelemetry> {
  const cleanCity = sanitizeCityInput(options.city ?? '');
  const preset =
    findPresetByCityOrId(options.presetId) ?? findPresetByCityOrId(cleanCity);

  const cacheKey = `${preset?.id ?? cleanCity.toLowerCase()}:${Boolean(
    options.hasVulnerableMembers
  )}`;
  const cached = telemetryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.telemetry;
  }

  const preferLive =
    options.preferLive ?? process.env.DISABLE_LIVE_AIR_FETCH !== 'true';

  if (preferLive && cleanCity.length >= 2) {
    try {
      let lat = preset?.latitude;
      let lon = preset?.longitude;
      let resolvedCity = preset?.city ?? cleanCity;
      let resolvedCountry = preset?.country ?? 'Urban Area';

      if (lat === undefined || lon === undefined) {
        const geoUrl = new URL(`https://${ALLOWED_GEOCODE_HOST}/v1/search`);
        geoUrl.searchParams.set('name', cleanCity);
        geoUrl.searchParams.set('count', '1');
        geoUrl.searchParams.set('language', 'en');
        geoUrl.searchParams.set('format', 'json');

        const geoData = (await fetchJsonWithTimeout(geoUrl)) as GeocodePayload;
        const hit = geoData.results?.[0];
        if (
          hit &&
          typeof hit.latitude === 'number' &&
          typeof hit.longitude === 'number'
        ) {
          lat = hit.latitude;
          lon = hit.longitude;
          resolvedCity = hit.name ?? cleanCity;
          resolvedCountry = hit.country ?? 'Urban Area';
        }
      }

      if (
        typeof lat === 'number' &&
        typeof lon === 'number' &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      ) {
        const aqUrl = new URL(`https://${ALLOWED_AQ_HOST}/v1/air-quality`);
        aqUrl.searchParams.set('latitude', String(lat));
        aqUrl.searchParams.set('longitude', String(lon));
        aqUrl.searchParams.set('current', 'pm2_5,pm10,nitrogen_dioxide');
        aqUrl.searchParams.set('hourly', 'pm2_5');
        aqUrl.searchParams.set('forecast_days', '1');

        const wxUrl = new URL(`https://${ALLOWED_WEATHER_HOST}/v1/forecast`);
        wxUrl.searchParams.set('latitude', String(lat));
        wxUrl.searchParams.set('longitude', String(lon));
        wxUrl.searchParams.set(
          'current',
          'temperature_2m,wind_speed_10m,relative_humidity_2m'
        );

        const [aqRaw, wxRaw] = await Promise.all([
          fetchJsonWithTimeout(aqUrl),
          fetchJsonWithTimeout(wxUrl),
        ]);

        const aq = aqRaw as AirQualityPayload;
        const wx = wxRaw as WeatherPayload;
        const pm25 = aq.current?.pm2_5;

        if (typeof pm25 === 'number' && Number.isFinite(pm25)) {
          const pm10 =
            typeof aq.current?.pm10 === 'number' ? aq.current.pm10 : Math.round(pm25 * 1.45);
          const no2 =
            typeof aq.current?.nitrogen_dioxide === 'number'
              ? aq.current.nitrogen_dioxide
              : 32;
          const temp =
            typeof wx.current?.temperature_2m === 'number'
              ? wx.current.temperature_2m
              : preset?.temperatureC ?? 6;
          const wind =
            typeof wx.current?.wind_speed_10m === 'number'
              ? wx.current.wind_speed_10m
              : preset?.windSpeedKmh ?? 8;
          const humidity =
            typeof wx.current?.relative_humidity_2m === 'number'
              ? wx.current.relative_humidity_2m
              : preset?.humidityPct ?? 72;

          const aqi = calculatePm25Aqi(pm25);
          const liveTelemetry: LocationTelemetry = {
            city: resolvedCity,
            country: resolvedCountry,
            latitude: lat,
            longitude: lon,
            pm25: Math.round(pm25 * 10) / 10,
            pm10: Math.round(pm10 * 10) / 10,
            no2: Math.round(no2 * 10) / 10,
            aqi,
            aqiCategory: classifyAqi(aqi, options.hasVulnerableMembers),
            temperatureC: Math.round(temp * 10) / 10,
            windSpeedKmh: Math.round(wind * 10) / 10,
            humidityPct: Math.round(humidity),
            inversionRisk: assessInversionRisk(pm25, wind, temp),
            dominantPollutant: no2 > 45 ? 'PM2.5 + NO₂' : 'PM2.5',
            winterDrivers: preset?.winterDrivers ?? [
              'Local urban traffic & cold-start combustion',
              'Calm winter boundary layer slowing dispersion',
              'Residential heating & regional secondary aerosols',
            ],
            source: 'live-open-meteo',
            updatedAt: new Date().toISOString(),
            hourlyForecast: buildHourlyFromLive(
              aq.hourly?.time,
              aq.hourly?.pm2_5,
              pm25
            ),
          };

          telemetryCache.set(cacheKey, {
            telemetry: liveTelemetry,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          return liveTelemetry;
        }
      }
    } catch {
      // Fall through cleanly to regional winter smog model
    }
  }

  const fallbackPreset = preset ?? CITY_PRESETS[0]!;
  const modeled = buildPresetTelemetry(
    fallbackPreset,
    Boolean(options.hasVulnerableMembers)
  );
  if (!preset && cleanCity.length >= 2) {
    modeled.city = cleanCity;
    modeled.country = 'Modeled Urban Winter Profile';
  }
  telemetryCache.set(cacheKey, {
    telemetry: modeled,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return modeled;
}

export function clearTelemetryCache(): void {
  telemetryCache.clear();
}
