import {
  assessInversionRisk,
  buildDiurnalWinterCurve,
  calculatePm25Aqi,
  classifyAqi,
} from './airQuality.ts';
import type { HouseholdProfile, LocationTelemetry } from './types.ts';

export interface CityPreset {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  winterPm25: number;
  winterPm10: number;
  winterNo2: number;
  temperatureC: number;
  windSpeedKmh: number;
  humidityPct: number;
  dominantPollutant: string;
  winterDrivers: string[];
  defaultProfileOverrides?: Partial<HouseholdProfile>;
}

export const CITY_PRESETS: ReadonlyArray<CityPreset> = [
  {
    id: 'delhi-ncr',
    city: 'New Delhi (NCR)',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    winterPm25: 198,
    winterPm10: 315,
    winterNo2: 68,
    temperatureC: 11,
    windSpeedKmh: 4.5,
    humidityPct: 78,
    dominantPollutant: 'PM2.5 + NO₂',
    winterDrivers: [
      'Shallow nocturnal thermal inversion trapping ground-level emissions',
      'Heavy vehicular exhaust & road dust resuspension',
      'Regional biomass burning & solid-fuel heating',
    ],
  },
  {
    id: 'lahore',
    city: 'Lahore',
    country: 'Pakistan',
    latitude: 31.5204,
    longitude: 74.3587,
    winterPm25: 215,
    winterPm10: 340,
    winterNo2: 72,
    temperatureC: 12,
    windSpeedKmh: 3.8,
    humidityPct: 82,
    dominantPollutant: 'PM2.5',
    winterDrivers: [
      'Dense winter radiation fog interacting with sulfate/nitrate aerosols',
      'Two-wheeler & diesel freight corridor emissions',
      'Brick-kiln & seasonal crop-residue plume transport',
    ],
  },
  {
    id: 'warsaw',
    city: 'Warsaw',
    country: 'Poland',
    latitude: 52.2297,
    longitude: 21.0122,
    winterPm25: 62,
    winterPm10: 94,
    winterNo2: 44,
    temperatureC: -1,
    windSpeedKmh: 7.2,
    humidityPct: 81,
    dominantPollutant: 'PM2.5 (Residential Heating)',
    winterDrivers: [
      'Cold-snap solid-fuel & coal home heating ("low-stack emissions")',
      'Calm high-pressure winter anticyclone reducing dispersion',
      'Morning & evening commuter traffic peaks',
    ],
  },
  {
    id: 'salt-lake-city',
    city: 'Salt Lake City',
    country: 'United States',
    latitude: 40.7608,
    longitude: -111.891,
    winterPm25: 54,
    winterPm10: 72,
    winterNo2: 49,
    temperatureC: -2,
    windSpeedKmh: 4.2,
    humidityPct: 74,
    dominantPollutant: 'PM2.5 (Ammonium Nitrate Inversion)',
    winterDrivers: [
      'Cold-air pool trapped inside Wasatch mountain basin',
      'Secondary ammonium nitrate formation from cold-start vehicle NOx',
      'Wood-burning fireplace emissions during no-burn advisories',
    ],
  },
  {
    id: 'beijing',
    city: 'Beijing',
    country: 'China',
    latitude: 39.9042,
    longitude: 116.4074,
    winterPm25: 88,
    winterPm10: 132,
    winterNo2: 53,
    temperatureC: 0,
    windSpeedKmh: 6.4,
    humidityPct: 68,
    dominantPollutant: 'PM2.5 + Secondary Aerosols',
    winterDrivers: [
      'Regional industrial & winter space-heating haze episodes',
      'Humid southerly winds pushing pollutants against northern mountains',
      'Peak-hour urban traffic and cold-engine emissions',
    ],
  },
  {
    id: 'london',
    city: 'London',
    country: 'United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    winterPm25: 34,
    winterPm10: 51,
    winterNo2: 46,
    temperatureC: 4,
    windSpeedKmh: 9.0,
    humidityPct: 84,
    dominantPollutant: 'NO₂ + PM2.5',
    winterDrivers: [
      'Still winter days concentrating roadside NO₂ & brake/tire particulates',
      'Domestic gas boilers & recreational wood-burning stoves',
      'Cross-channel secondary particulate drift',
    ],
  },
];

export const DEFAULT_HOUSEHOLD_PROFILE: HouseholdProfile = {
  city: 'New Delhi (NCR)',
  presetId: 'delhi-ncr',
  householdSize: 4,
  vulnerabilities: ['children', 'asthma_respiratory'],
  commuteMode: 'petrol_car',
  dailyCommuteKm: 18,
  heatingFuel: 'electric_resistance',
  cookingFuel: 'lpg_piped_gas',
  homeType: 'apartment_drafty',
  purifierSetup: 'none',
  budgetTier: 'low_cost',
  hasSchoolKids: true,
};

export function findPresetByCityOrId(query?: string): CityPreset | undefined {
  if (!query) return undefined;
  const normalized = query.trim().toLowerCase();
  return CITY_PRESETS.find(
    (p) =>
      p.id.toLowerCase() === normalized ||
      p.city.toLowerCase() === normalized ||
      p.city.toLowerCase().includes(normalized)
  );
}

export function buildPresetTelemetry(
  preset: CityPreset,
  hasVulnerableMembers = true
): LocationTelemetry {
  const aqi = calculatePm25Aqi(preset.winterPm25);
  return {
    city: preset.city,
    country: preset.country,
    latitude: preset.latitude,
    longitude: preset.longitude,
    pm25: preset.winterPm25,
    pm10: preset.winterPm10,
    no2: preset.winterNo2,
    aqi,
    aqiCategory: classifyAqi(aqi, hasVulnerableMembers),
    temperatureC: preset.temperatureC,
    windSpeedKmh: preset.windSpeedKmh,
    humidityPct: preset.humidityPct,
    inversionRisk: assessInversionRisk(
      preset.winterPm25,
      preset.windSpeedKmh,
      preset.temperatureC
    ),
    dominantPollutant: preset.dominantPollutant,
    winterDrivers: preset.winterDrivers,
    source: 'regional-winter-model',
    updatedAt: new Date().toISOString(),
    hourlyForecast: buildDiurnalWinterCurve(preset.winterPm25),
  };
}
