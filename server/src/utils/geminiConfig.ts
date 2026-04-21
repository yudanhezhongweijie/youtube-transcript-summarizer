/**
 * Matches the public Generative Language REST path
 * `.../v1beta/models/gemini-flash-latest:generateContent` (see Google AI Studio).
 */
export const GEMINI_API_REQUEST_OPTIONS = {
  apiVersion: "v1beta" as const,
};

/** Alias that tracks the latest Flash snapshot; use `GEMINI_MODEL` in `.env` to pin a version. */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

/** Trim and strip invisible characters from pasted keys (common cause of “API key not valid”). */
export function normalizeGeminiApiKey(key: string): string {
  return key.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/**
 * When the client sends this exact key (request body, after {@link normalizeGeminiApiKey}) and leaves the
 * video URL empty, `/api/process/stream` runs the built-in mock SSE (no Gemini, no YouTube fetch).
 */
export const MOCK_SESSION_API_KEY = "54321";

/**
 * Resolved model id for `getGenerativeModel({ model })`.
 * Uses `GEMINI_MODEL` when set and non-empty after trim; otherwise {@link DEFAULT_GEMINI_MODEL}.
 * (`??` alone does not treat `""` as missing — callers must use this helper.)
 *
 * `gemini-2.0-flash` is remapped to {@link DEFAULT_GEMINI_MODEL} so local env matches the usual
 * AI Studio / REST example (`gemini-flash-latest`). Override with any other explicit model id if needed.
 */
export function resolveGeminiModel(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  if (!fromEnv) return DEFAULT_GEMINI_MODEL;
  if (fromEnv === "gemini-2.0-flash") return DEFAULT_GEMINI_MODEL;
  return fromEnv;
}

export type GeminiApiKeySource = "env" | "body" | "none";

/**
 * API key for `generativelanguage.googleapis.com` (see [API key docs](https://ai.google.dev/gemini-api/docs/api-key)).
 *
 * **Order:** non-empty `GEMINI_API_KEY` on the server wins, then the request body. That way a valid key in
 * `.env` (what `curl -H "x-goog-api-key: $GEMINI_API_KEY"` uses) is not overridden by a stale/wrong key
 * pasted in the browser. For deployments where each user must pass their own key, leave `GEMINI_API_KEY` unset.
 */
export function resolveGeminiApiKeyWithSource(
  bodyKey: string | undefined | null,
): { key: string; source: GeminiApiKeySource } {
  const fromEnv = process.env.GEMINI_API_KEY
    ? normalizeGeminiApiKey(process.env.GEMINI_API_KEY)
    : "";
  if (fromEnv) return { key: fromEnv, source: "env" };
  const fromBody = bodyKey ? normalizeGeminiApiKey(bodyKey) : "";
  if (fromBody) return { key: fromBody, source: "body" };
  return { key: "", source: "none" };
}

/** True when the SDK error text indicates an invalid or rejected API key. */
export function isGeminiApiKeyInvalidError(message: string): boolean {
  return (
    message.includes("API_KEY_INVALID") ||
    /API key not valid/i.test(message) ||
    /invalid api key/i.test(message)
  );
}

/** Short hint for JSON/SSE error payloads when the key is rejected. */
export function invalidGeminiApiKeyHint(): string {
  return "If GEMINI_API_KEY is set in server .env, it overrides the client field — remove or fix it if you intend to use the browser key. ";
}
