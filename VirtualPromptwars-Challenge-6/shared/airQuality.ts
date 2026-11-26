import type {
  ActionItem,
  AqiCategoryInfo,
  HouseholdProfile,
  HourlyAirPoint,
  ImpactSummary,
  InversionRisk,
  LocationTelemetry,
} from './types.ts';

/** WHO 2021 24-hour PM2.5 Air Quality Guideline (µg/m³). */
export const WHO_PM25_24H_GUIDELINE = 15;

/** Average adult daily inhalation volume in m³/day (US EPA Exposure Factors Handbook). */
const ADULT_INHALATION_M3_PER_DAY = 14.2;

/**
 * US EPA 2024 updated PM2.5 AQI breakpoints (µg/m³ -> AQI).
 * Reference: US EPA Revised PM2.5 AQI (effective May 2024).
 */
const PM25_BREAKPOINTS: ReadonlyArray<{
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}> = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 400 },
  { cLow: 325.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
];

export function calculatePm25Aqi(pm25Raw: number): number {
  const pm25 = Math.max(0, Math.floor(pm25Raw * 10) / 10);
  if (pm25 > 500.4) {
    return 500;
  }
  for (const bp of PM25_BREAKPOINTS) {
    if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
      const ratio = (bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow);
      return Math.round(ratio * (pm25 - bp.cLow) + bp.iLow);
    }
  }
  // Handle tiny gaps from 1-decimal truncation (e.g., 9.05 -> 9.0)
  return 500;
}

export function classifyAqi(aqi: number, hasVulnerableMembers = false): AqiCategoryInfo {
  if (aqi <= 50) {
    return {
      label: 'Good',
      shortLabel: 'Good',
      colorToken: 'good',
      healthGuidance:
        'Air quality is satisfactory. Normal outdoor routines and natural cross-ventilation are safe.',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate',
      shortLabel: 'Moderate',
      colorToken: 'moderate',
      healthGuidance: hasVulnerableMembers
        ? 'Acceptable for most, but children or people with asthma should limit prolonged exertion near busy roads.'
        : 'Acceptable overall; sensitive individuals should avoid heavy traffic corridors during rush hour.',
    };
  }
  if (aqi <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive Alert',
      colorToken: 'usg',
      healthGuidance:
        'Children, seniors, pregnant individuals, and people with asthma or heart disease should reduce vigorous outdoor time and run indoor filtration.',
    };
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      colorToken: 'unhealthy',
      healthGuidance:
        'Everyone experiences elevated PM2.5 exposure. Move exercise indoors, wear fitted N95/KN95 masks outside, and keep windows sealed during smog peaks.',
    };
  }
  if (aqi <= 300) {
    return {
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      colorToken: 'very-unhealthy',
      healthGuidance:
        'Health alert: severe winter smog episode. Avoid outdoor exertion, run HEPA/Corsi-Rosenthal filtration continuously, and consolidate essential trips.',
    };
  }
  return {
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    colorToken: 'hazardous',
    healthGuidance:
      'Emergency smog conditions. Stay indoors with active air cleaning, seal window gaps, and check on elderly neighbors and school advisories.',
  };
}

export function assessInversionRisk(
  pm25: number,
  windSpeedKmh: number,
  temperatureC: number
): InversionRisk {
  let score = 0;
  if (pm25 >= 150) score += 3;
  else if (pm25 >= 75) score += 2;
  else if (pm25 >= 35) score += 1;

  if (windSpeedKmh <= 6) score += 2;
  else if (windSpeedKmh <= 12) score += 1;

  if (temperatureC <= 12) score += 1;

  if (score >= 5) return 'severe';
  if (score >= 3) return 'high';
  if (score >= 2) return 'moderate';
  return 'low';
}

/**
 * Models a typical urban winter boundary-layer diurnal curve:
 * - Morning rush + shallow thermal inversion peak around 07:00-09:00
 * - Midday solar mixing trough around 13:00-15:00 (best ventilation window)
 * - Evening heating + traffic + nocturnal inversion peak around 19:00-22:00
 */
export function buildDiurnalWinterCurve(basePm25: number): HourlyAirPoint[] {
  const diurnalMultipliers = [
    1.12, 1.08, 1.04, 1.02, 1.05, 1.14, // 00-05
    1.24, 1.36, 1.42, 1.28, 1.06, 0.86, // 06-11
    0.74, 0.68, 0.70, 0.78, 0.92, 1.12, // 12-17
    1.28, 1.38, 1.40, 1.34, 1.26, 1.18, // 18-23
  ];

  return diurnalMultipliers.map((factor, hour) => {
    const pm25 = Math.max(4, Math.round(basePm25 * factor * 10) / 10);
    const aqi = calculatePm25Aqi(pm25);
    const label = `${String(hour).padStart(2, '0')}:00`;
    // Safe to open windows briefly when PM2.5 is <= 45 or during the lowest midday dip if <= 75
    const ventilationSafe = pm25 <= 45 || (hour >= 12 && hour <= 15 && pm25 <= 75);
    return {
      hour,
      label,
      pm25,
      aqi,
      inversionFactor: factor,
      ventilationSafe,
    };
  });
}

export function findKeyTimeWindows(hourly: HourlyAirPoint[]): {
  bestVentilationWindow: string;
  peakSmogWindow: string;
} {
  if (hourly.length === 0) {
    return {
      bestVentilationWindow: '13:00–15:00',
      peakSmogWindow: '07:00–09:00 & 19:00–22:00',
    };
  }

  let bestStart = 12;
  let bestAvg = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= hourly.length - 3; i++) {
    const avg = ((hourly[i]?.pm25 ?? 0) + (hourly[i + 1]?.pm25 ?? 0) + (hourly[i + 2]?.pm25 ?? 0)) / 3;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestStart = i;
    }
  }

  let worstStart = 19;
  let worstAvg = -1;
  for (let i = 0; i <= hourly.length - 3; i++) {
    const avg = ((hourly[i]?.pm25 ?? 0) + (hourly[i + 1]?.pm25 ?? 0) + (hourly[i + 2]?.pm25 ?? 0)) / 3;
    if (avg > worstAvg) {
      worstAvg = avg;
      worstStart = i;
    }
  }

  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return {
    bestVentilationWindow: `${fmt(bestStart)}–${fmt(bestStart + 3)}`,
    peakSmogWindow: `${fmt(worstStart)}–${fmt(worstStart + 3)}`,
  };
}

/**
 * Estimates baseline indoor PM2.5 (µg/m³) from outdoor concentration, building leakage,
 * indoor combustion sources (cooking/heating), and active filtration.
 */
export function estimateBaselineIndoorPm25(
  outdoorPm25: number,
  profile: HouseholdProfile
): number {
  const infiltrationFactorMap: Record<HouseholdProfile['homeType'], number> = {
    apartment_sealed: 0.52,
    apartment_drafty: 0.76,
    house_sealed: 0.56,
    house_drafty: 0.80,
  };

  const cookingPenaltyMap: Record<HouseholdProfile['cookingFuel'], number> = {
    solid_biomass: 48,
    lpg_piped_gas: 11,
    electric_coil: 5,
    induction: 3,
  };

  const heatingPenaltyMap: Record<HouseholdProfile['heatingFuel'], number> = {
    wood_coal: 22,
    gas_boiler: 3,
    electric_resistance: 0,
    heat_pump: 0,
    district_heating: 0,
    none: 0,
  };

  const purifierAttenuationMap: Record<HouseholdProfile['purifierSetup'], number> = {
    none: 1.0,
    single_hepa: 0.62,
    corsi_rosenthal_diy: 0.55,
    multi_room_hepa: 0.40,
  };

  const rawIndoor =
    outdoorPm25 * infiltrationFactorMap[profile.homeType] +
    cookingPenaltyMap[profile.cookingFuel] +
    heatingPenaltyMap[profile.heatingFuel];

  const filtered = rawIndoor * purifierAttenuationMap[profile.purifierSetup];
  return Math.max(3, Math.round(filtered * 10) / 10);
}

/**
 * Estimates annual household CO2e (kg) and direct PM2.5 emissions (g) for commute + heating + cooking.
 */
export function estimateHouseholdEmissions(profile: HouseholdProfile): {
  annualCommuteCo2eKg: number;
  annualCommutePm25G: number;
  annualHomeCo2eKg: number;
  annualHomePm25G: number;
} {
  const commuteDays = 250;
  const annualKm = profile.dailyCommuteKm * commuteDays;

  const commuteFactors: Record<
    HouseholdProfile['commuteMode'],
    { co2PerKm: number; pm25PerKmG: number }
  > = {
    petrol_car: { co2PerKm: 0.192, pm25PerKmG: 0.025 },
    diesel_car: { co2PerKm: 0.171, pm25PerKmG: 0.055 },
    two_wheeler: { co2PerKm: 0.084, pm25PerKmG: 0.032 },
    public_transit: { co2PerKm: 0.048, pm25PerKmG: 0.006 },
    ev_car: { co2PerKm: 0.052, pm25PerKmG: 0.008 }, // brake/tire + grid
    walk_bike: { co2PerKm: 0, pm25PerKmG: 0 },
    remote: { co2PerKm: 0, pm25PerKmG: 0 },
  };

  const heatingFactors: Record<
    HouseholdProfile['heatingFuel'],
    { co2AnnualKg: number; pm25AnnualG: number }
  > = {
    wood_coal: { co2AnnualKg: 2400, pm25AnnualG: 4200 },
    gas_boiler: { co2AnnualKg: 1850, pm25AnnualG: 95 },
    electric_resistance: { co2AnnualKg: 1350, pm25AnnualG: 20 },
    heat_pump: { co2AnnualKg: 520, pm25AnnualG: 8 },
    district_heating: { co2AnnualKg: 980, pm25AnnualG: 18 },
    none: { co2AnnualKg: 0, pm25AnnualG: 0 },
  };

  const cookingFactors: Record<
    HouseholdProfile['cookingFuel'],
    { co2AnnualKg: number; pm25AnnualG: number }
  > = {
    solid_biomass: { co2AnnualKg: 1400, pm25AnnualG: 3100 },
    lpg_piped_gas: { co2AnnualKg: 420, pm25AnnualG: 45 },
    electric_coil: { co2AnnualKg: 360, pm25AnnualG: 10 },
    induction: { co2AnnualKg: 240, pm25AnnualG: 6 },
  };

  const cf = commuteFactors[profile.commuteMode];
  const hf = heatingFactors[profile.heatingFuel];
  const ck = cookingFactors[profile.cookingFuel];

  return {
    annualCommuteCo2eKg: Math.round(annualKm * cf.co2PerKm),
    annualCommutePm25G: Math.round(annualKm * cf.pm25PerKmG),
    annualHomeCo2eKg: hf.co2AnnualKg + ck.co2AnnualKg,
    annualHomePm25G: hf.pm25AnnualG + ck.pm25AnnualG,
  };
}

/**
 * Computes quantified direct health + environmental impact when a set of recommended
 * actions is active for the household.
 */
export function computeImpactSummary(
  telemetry: LocationTelemetry,
  profile: HouseholdProfile,
  activeActions: ActionItem[]
): ImpactSummary {
  const baselineIndoorPm25 = estimateBaselineIndoorPm25(telemetry.pm25, profile);

  // Average family spends ~18h indoors, ~6h outdoors/commuting (compressed during high smog)
  const outdoorHours = telemetry.aqi >= 151 ? 3.5 : 5.0;
  const indoorHours = 24 - outdoorHours;

  const vulnerabilityMultiplier =
    profile.vulnerabilities.includes('asthma_respiratory') ||
    profile.vulnerabilities.includes('children')
      ? 1.15
      : 1.0;

  const baselineTimeWeightedPm25 =
    (baselineIndoorPm25 * indoorHours + telemetry.pm25 * outdoorHours) / 24;

  const baselineDailyInhaledPm25Ug =
    Math.round(
      baselineTimeWeightedPm25 * ADULT_INHALATION_M3_PER_DAY * vulnerabilityMultiplier * 10
    ) / 10;

  // Combine indoor/routine reductions multiplicatively (diminishing returns, realistic physics)
  let remainingExposureFactor = 1.0;
  let totalCo2eSavedKg = 0;
  let totalPm25EmittedSavedG = 0;

  for (const action of activeActions) {
    const pct = Math.min(75, Math.max(0, action.pm25ExposureReductionPct)) / 100;
    remainingExposureFactor *= 1 - pct * 0.72;
    totalCo2eSavedKg += action.annualCo2eSavedKg;
    totalPm25EmittedSavedG += action.annualPm25EmittedSavedG;
  }

  // Floor at realistic urban background achievable (~18% of baseline)
  const effectiveFactor = Math.max(0.18, remainingExposureFactor);
  const projectedIndoorPm25 =
    Math.round(Math.max(3, baselineIndoorPm25 * effectiveFactor) * 10) / 10;

  const projectedDailyInhaledPm25Ug =
    Math.round(baselineDailyInhaledPm25Ug * effectiveFactor * 10) / 10;

  const dailyPm25AvoidedUg =
    Math.round(Math.max(0, baselineDailyInhaledPm25Ug - projectedDailyInhaledPm25Ug) * 10) / 10;

  const exposureReductionPct =
    baselineDailyInhaledPm25Ug > 0
      ? Math.round((dailyPm25AvoidedUg / baselineDailyInhaledPm25Ug) * 100)
      : 0;

  const projectedTimeWeightedPm25 = baselineTimeWeightedPm25 * effectiveFactor;

  const whoGuidelineRatioBefore =
    Math.round((baselineTimeWeightedPm25 / WHO_PM25_24H_GUIDELINE) * 10) / 10;
  const whoGuidelineRatioAfter =
    Math.round((projectedTimeWeightedPm25 / WHO_PM25_24H_GUIDELINE) * 10) / 10;

  // Comparative risk metric: ~22 µg/m³ 24h average ≈ 1 cigarette/day (Berkeley Earth)
  const pm25ConcentrationDrop = Math.max(
    0,
    baselineTimeWeightedPm25 - projectedTimeWeightedPm25
  );
  const cigaretteEquivalenceReducedPerWeek =
    Math.round(((pm25ConcentrationDrop / 22) * 7) * 10) / 10;

  // If 10 neighboring families adopt the household's sustainable shifts
  const communityRippleCo2eKg = Math.round(totalCo2eSavedKg * 10);

  return {
    baselineIndoorPm25,
    projectedIndoorPm25,
    baselineDailyInhaledPm25Ug,
    projectedDailyInhaledPm25Ug,
    exposureReductionPct,
    dailyPm25AvoidedUg,
    whoGuidelineRatioBefore,
    whoGuidelineRatioAfter,
    annualCo2eSavedKg: Math.round(totalCo2eSavedKg),
    annualTailpipeAndHomePm25SavedG: Math.round(totalPm25EmittedSavedG),
    cigaretteEquivalenceReducedPerWeek,
    communityRippleCo2eKg,
  };
}
