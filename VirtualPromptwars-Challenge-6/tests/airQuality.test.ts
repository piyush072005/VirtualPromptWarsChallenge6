import { describe, expect, it } from 'vitest';
import {
  assessInversionRisk,
  buildDiurnalWinterCurve,
  calculatePm25Aqi,
  classifyAqi,
  computeImpactSummary,
  estimateBaselineIndoorPm25,
  findKeyTimeWindows,
} from '@shared/airQuality.ts';
import { buildTailoredActions } from '@shared/interventions.ts';
import {
  buildPresetTelemetry,
  CITY_PRESETS,
  DEFAULT_HOUSEHOLD_PROFILE,
} from '@shared/presets.ts';

describe('Air Quality & Impact Domain Engine', () => {
  it('computes US EPA 2024 PM2.5 AQI breakpoints accurately', () => {
    expect(calculatePm25Aqi(0)).toBe(0);
    expect(calculatePm25Aqi(9.0)).toBe(50);
    expect(calculatePm25Aqi(35.4)).toBe(100);
    expect(calculatePm25Aqi(55.4)).toBe(150);
    expect(calculatePm25Aqi(125.4)).toBe(200);
    expect(calculatePm25Aqi(150.4)).toBe(226);
    expect(calculatePm25Aqi(225.4)).toBe(300);
    expect(calculatePm25Aqi(550)).toBe(500);
  });

  it('classifies AQI categories and tailors guidance for vulnerable groups', () => {
    const modSensitive = classifyAqi(80, true);
    expect(modSensitive.label).toBe('Moderate');
    expect(modSensitive.healthGuidance).toContain('children');

    const veryUnhealthy = classifyAqi(240, true);
    expect(veryUnhealthy.colorToken).toBe('very-unhealthy');
  });

  it('assesses thermal inversion risk from PM2.5, wind speed, and cold temperature', () => {
    expect(assessInversionRisk(180, 4, 8)).toBe('severe');
    expect(assessInversionRisk(15, 18, 16)).toBe('low');
  });

  it('builds a 24-hour diurnal curve with afternoon ventilation trough and morning/evening peaks', () => {
    const curve = buildDiurnalWinterCurve(120);
    expect(curve).toHaveLength(24);
    const windows = findKeyTimeWindows(curve);
    expect(windows.bestVentilationWindow).toMatch(/12:00|13:00/);
    expect(windows.peakSmogWindow).toMatch(/07:00|19:00|18:00/);
  });

  it('estimates higher indoor PM2.5 for drafty biomass homes than sealed filtered induction homes', () => {
    const draftyBiomass = estimateBaselineIndoorPm25(150, {
      ...DEFAULT_HOUSEHOLD_PROFILE,
      homeType: 'house_drafty',
      cookingFuel: 'solid_biomass',
      purifierSetup: 'none',
    });

    const sealedFiltered = estimateBaselineIndoorPm25(150, {
      ...DEFAULT_HOUSEHOLD_PROFILE,
      homeType: 'apartment_sealed',
      cookingFuel: 'induction',
      purifierSetup: 'multi_room_hepa',
    });

    expect(draftyBiomass).toBeGreaterThan(sealedFiltered * 3);
  });

  it('computes positive exposure and emission reductions when tailored actions are active', () => {
    const telemetry = buildPresetTelemetry(CITY_PRESETS[0]!, true);
    const actions = buildTailoredActions(telemetry, DEFAULT_HOUSEHOLD_PROFILE);

    expect(actions.some((a) => a.category === 'routine')).toBe(true);
    expect(actions.some((a) => a.category === 'indoor_hack')).toBe(true);
    expect(actions.some((a) => a.category === 'sustainable_alt')).toBe(true);

    const noActionImpact = computeImpactSummary(
      telemetry,
      DEFAULT_HOUSEHOLD_PROFILE,
      []
    );
    expect(noActionImpact.exposureReductionPct).toBe(0);
    expect(noActionImpact.dailyPm25AvoidedUg).toBe(0);

    const fullPlanImpact = computeImpactSummary(
      telemetry,
      DEFAULT_HOUSEHOLD_PROFILE,
      actions
    );
    expect(fullPlanImpact.exposureReductionPct).toBeGreaterThan(30);
    expect(fullPlanImpact.projectedIndoorPm25).toBeLessThan(
      fullPlanImpact.baselineIndoorPm25
    );
    expect(fullPlanImpact.annualCo2eSavedKg).toBeGreaterThan(0);
    expect(fullPlanImpact.communityRippleCo2eKg).toBe(
      fullPlanImpact.annualCo2eSavedKg * 10
    );
  });

  it('prioritizes wood/coal replacement when household uses solid fuel heating', () => {
    const warsaw = buildPresetTelemetry(CITY_PRESETS[2]!, false);
    const actions = buildTailoredActions(warsaw, {
      ...DEFAULT_HOUSEHOLD_PROFILE,
      city: 'Warsaw',
      heatingFuel: 'wood_coal',
      budgetTier: 'upgrade_ready',
    });
    expect(actions.some((a) => a.id === 'alt-clean-heating-transition')).toBe(
      true
    );
  });
});
