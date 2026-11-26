import type {
  AssistantPlan,
  ChatRequest,
  ChatResponse,
  HouseholdProfile,
  LocationTelemetry,
} from '@shared/types.ts';

export interface PlanApiResponse {
  telemetry: LocationTelemetry;
  plan: AssistantPlan;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return data;
}

export async function fetchPlan(
  profile: HouseholdProfile,
  selectedActionIds?: string[],
  cityQuery?: string
): Promise<PlanApiResponse> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile,
      selectedActionIds,
      cityQuery,
    }),
  });
  return parseJsonOrThrow<PlanApiResponse>(res);
}

export async function sendChatQuestion(
  payload: ChatRequest
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<ChatResponse>(res);
}
