import { z } from 'zod';

export const VulnerabilitySchema = z.enum([
  'children',
  'seniors',
  'asthma_respiratory',
  'pregnancy',
  'outdoor_workers',
]);
export type Vulnerability = z.infer<typeof VulnerabilitySchema>;

export const CommuteModeSchema = z.enum([
  'petrol_car',
  'diesel_car',
  'two_wheeler',
  'public_transit',
  'ev_car',
  'walk_bike',
  'remote',
]);
export type CommuteMode = z.infer<typeof CommuteModeSchema>;

export const HeatingFuelSchema = z.enum([
  'wood_coal',
  'gas_boiler',
  'electric_resistance',
  'heat_pump',
  'district_heating',
  'none',
]);
export type HeatingFuel = z.infer<typeof HeatingFuelSchema>;

export const CookingFuelSchema = z.enum([
  'solid_biomass',
  'lpg_piped_gas',
  'electric_coil',
  'induction',
]);
export type CookingFuel = z.infer<typeof CookingFuelSchema>;

export const HomeTypeSchema = z.enum([
  'apartment_sealed',
  'apartment_drafty',
  'house_sealed',
  'house_drafty',
]);
export type HomeType = z.infer<typeof HomeTypeSchema>;

export const PurifierSetupSchema = z.enum([
  'none',
  'single_hepa',
  'multi_room_hepa',
  'corsi_rosenthal_diy',
]);
export type PurifierSetup = z.infer<typeof PurifierSetupSchema>;

export const BudgetTierSchema = z.enum(['zero_cost', 'low_cost', 'upgrade_ready']);
export type BudgetTier = z.infer<typeof BudgetTierSchema>;

export const HouseholdProfileSchema = z.object({
  city: z.string().trim().min(1, 'City name is required').max(80),
  presetId: z.string().trim().max(40).optional(),
  householdSize: z.number().int().min(1).max(12),
  vulnerabilities: z.array(VulnerabilitySchema).max(5),
  commuteMode: CommuteModeSchema,
  dailyCommuteKm: z.number().min(0).max(150),
  heatingFuel: HeatingFuelSchema,
  cookingFuel: CookingFuelSchema,
  homeType: HomeTypeSchema,
  purifierSetup: PurifierSetupSchema,
  budgetTier: BudgetTierSchema,
  hasSchoolKids: z.boolean(),
});
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;

export type InversionRisk = 'low' | 'moderate' | 'high' | 'severe';

export interface HourlyAirPoint {
  hour: number; // 0-23
  label: string;
  pm25: number;
  aqi: number;
  inversionFactor: number;
  ventilationSafe: boolean;
}

export interface AqiCategoryInfo {
  label:
    | 'Good'
    | 'Moderate'
    | 'Unhealthy for Sensitive Groups'
    | 'Unhealthy'
    | 'Very Unhealthy'
    | 'Hazardous';
  shortLabel: string;
  colorToken: 'good' | 'moderate' | 'usg' | 'unhealthy' | 'very-unhealthy' | 'hazardous';
  healthGuidance: string;
}

export interface LocationTelemetry {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  pm25: number;
  pm10: number;
  no2: number;
  aqi: number;
  aqiCategory: AqiCategoryInfo;
  temperatureC: number;
  windSpeedKmh: number;
  humidityPct: number;
  inversionRisk: InversionRisk;
  dominantPollutant: string;
  winterDrivers: string[];
  source: 'live-open-meteo' | 'regional-winter-model';
  updatedAt: string;
  hourlyForecast: HourlyAirPoint[];
}

export type RecommendationCategory = 'routine' | 'indoor_hack' | 'sustainable_alt';

export interface ActionItem {
  id: string;
  category: RecommendationCategory;
  title: string;
  summary: string;
  whyItMatters: string;
  tailoredReason: string;
  pm25ExposureReductionPct: number;
  dailyInhaledPm25SavedUg: number;
  annualCo2eSavedKg: number;
  annualPm25EmittedSavedG: number;
  effort: 'quick_win' | 'habit_shift' | 'investment';
  estimatedCost: string;
  steps: string[];
  scientificBasis: string;
}

export interface ImpactSummary {
  baselineIndoorPm25: number;
  projectedIndoorPm25: number;
  baselineDailyInhaledPm25Ug: number;
  projectedDailyInhaledPm25Ug: number;
  exposureReductionPct: number;
  dailyPm25AvoidedUg: number;
  whoGuidelineRatioBefore: number;
  whoGuidelineRatioAfter: number;
  annualCo2eSavedKg: number;
  annualTailpipeAndHomePm25SavedG: number;
  cigaretteEquivalenceReducedPerWeek: number;
  communityRippleCo2eKg: number;
}

export interface AssistantPlan {
  generatedAt: string;
  provider: 'gemini' | 'openai-compatible' | 'aeroguide-engine';
  headline: string;
  executiveBrief: string;
  riskAlert: {
    level: string;
    advisory: string;
    bestVentilationWindow: string;
    peakSmogWindow: string;
  };
  impact: ImpactSummary;
  actions: ActionItem[];
  communityBulletin: {
    title: string;
    message: string;
    schoolAdvisory: string;
  };
}

export const PlanRequestSchema = z.object({
  profile: HouseholdProfileSchema,
  selectedActionIds: z.array(z.string().max(64)).max(25).optional(),
  cityQuery: z.string().trim().max(80).optional(),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const ChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1500),
});

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(2, 'Please enter a question').max(1000),
  profile: HouseholdProfileSchema,
  selectedActionIds: z.array(z.string().max(64)).max(25).optional(),
  history: z.array(ChatHistoryItemSchema).max(10).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  answer: string;
  keyTakeaways: string[];
  directImpactNote: string;
  suggestedFollowUps: string[];
  provider: 'gemini' | 'openai-compatible' | 'aeroguide-engine';
  safetyNotice?: string;
}
