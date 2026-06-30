export type AiStudioHealthStatus =
  | "not-required"
  | "missing"
  | "invalid-format"
  | "configured-unverified"
  | "healthy"
  | "rejected"
  | "unreachable";

export interface AiStudioHealth {
  provider: "google-ai-studio";
  configured: boolean;
  status: AiStudioHealthStatus;
  model: string;
  checked: boolean;
  error?: string;
}

const DEFAULT_MODEL = "gemma-4-26b-a4b-it";

export function getDefaultAiStudioModel(): string {
  return process.env.GOOGLE_AI_STUDIO_MODEL || DEFAULT_MODEL;
}

export function hasGoogleAiStudioKey(): boolean {
  return Boolean(process.env.GOOGLE_AI_STUDIO_API_KEY?.trim());
}

export function validateGoogleAiStudioKeyShape(apiKey: string | undefined | null): boolean {
  const key = apiKey?.trim() ?? "";
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key) || /^AQ\.[0-9A-Za-z_-]{20,}$/.test(key);
}

export function summarizeAiStudioConfig(): AiStudioHealth {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim() ?? "";
  const model = getDefaultAiStudioModel();
  if (!key) {
    return { provider: "google-ai-studio", configured: false, status: "missing", model, checked: false };
  }
  if (!validateGoogleAiStudioKeyShape(key)) {
    return {
      provider: "google-ai-studio",
      configured: true,
      status: "invalid-format",
      model,
      checked: false,
      error: "Configured Google AI Studio key does not match the expected API key format.",
    };
  }
  return { provider: "google-ai-studio", configured: true, status: "configured-unverified", model, checked: false };
}

export async function checkGoogleAiStudioUpstream(options: { timeoutMs?: number } = {}): Promise<AiStudioHealth> {
  const config = summarizeAiStudioConfig();
  if (config.status === "missing" || config.status === "invalid-format") return config;

  const key = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim() ?? "";
  const model = config.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with ok." }] }],
        generationConfig: { maxOutputTokens: 4 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        provider: "google-ai-studio",
        configured: true,
        status: "rejected",
        model,
        checked: true,
        error: `Google AI Studio returned HTTP ${res.status}: ${sanitizeProviderError(text)}`,
      };
    }
    return { provider: "google-ai-studio", configured: true, status: "healthy", model, checked: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      provider: "google-ai-studio",
      configured: true,
      status: "unreachable",
      model,
      checked: true,
      error: sanitizeProviderError(msg),
    };
  }
}

function sanitizeProviderError(value: string): string {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim();
  let text = value.replace(/\s+/g, " ").trim().slice(0, 240);
  if (key) text = text.split(key).join("[redacted]");
  return text || "No error body returned";
}
