/**
 * Prompt injection sanitization & boundary-hardening helpers for GenAI requests.
 */

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|api\s+key)/i,
  /you\s+are\s+now\s+(dan|developer\s+mode|unrestricted)/i,
  /override\s+(safety|security|system)\s+(policy|instructions)/i,
  /<\s*\/?\s*(system|assistant|developer)\s*>/i,
];

export interface SanitizedUserInput {
  cleanText: string;
  flaggedInjectionAttempt: boolean;
}

export function sanitizeUserMessage(raw: string): SanitizedUserInput {
  const cleanText = raw
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);

  const flaggedInjectionAttempt = INJECTION_PATTERNS.some((pattern) =>
    pattern.test(cleanText)
  );

  return {
    cleanText,
    flaggedInjectionAttempt,
  };
}

export function sanitizeCityInput(raw: string): string {
  return raw
    .replace(CONTROL_CHARS_RE, '')
    .replace(/[^a-zA-Z0-9\s,.\-()']/g, '')
    .trim()
    .slice(0, 80);
}
