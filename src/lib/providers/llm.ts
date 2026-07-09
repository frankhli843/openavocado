export type ProviderStatus = {
  defaultProvider: string;
  googleAiStudio: {
    keyPresent: boolean;
    model: string;
  };
  openAiCompatible: {
    endpointPresent: boolean;
    model: string;
  };
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8000;

function envValue(name: string, fallback?: string): string {
  const raw = process.env[name];
  let value = raw === undefined || raw.trim() === "" ? fallback ?? "" : raw.trim();
  for (const wrapper of ["'", "\"", "047"]) {
    if (value.startsWith(wrapper) && value.endsWith(wrapper) && value.length > wrapper.length * 2) {
      value = value.slice(wrapper.length, -wrapper.length);
      break;
    }
  }
  return value;
}

function requestTimeoutMs(): number {
  const configured = Number(envValue("AVOCADOCORE_LLM_TIMEOUT_MS"));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

export function getProviderStatus(): ProviderStatus {
  return {
    defaultProvider: envValue("AVOCADOCORE_DEFAULT_PROVIDER", "openai-compatible"),
    googleAiStudio: {
      keyPresent: Boolean(envValue("GOOGLE_AI_STUDIO_API_KEY")),
      model: envValue("GOOGLE_AI_STUDIO_MODEL", DEFAULT_GEMINI_MODEL),
    },
    openAiCompatible: {
      endpointPresent: Boolean(envValue("AVOCADOCORE_ACP_ENDPOINT")),
      model: envValue("AVOCADOCORE_ACP_MODEL", DEFAULT_OPENAI_COMPATIBLE_MODEL),
    },
  };
}

export function getProviderHealthSummary(): string {
  const status = getProviderStatus();
  const googleKey = status.googleAiStudio.keyPresent ? "present" : "missing";
  const compatibleEndpoint = status.openAiCompatible.endpointPresent ? "present" : "missing";
  return [
    `ok:default=${status.defaultProvider}`,
    `google-ai-studio.key=${googleKey}`,
    `google-ai-studio.model=${status.googleAiStudio.model}`,
    `openai-compatible.endpoint=${compatibleEndpoint}`,
    `openai-compatible.model=${status.openAiCompatible.model}`,
  ].join(",");
}

export async function callConfiguredLlmForJson(prompt: string): Promise<unknown | null> {
  const status = getProviderStatus();

  const compatibleEndpoint = envValue("AVOCADOCORE_ACP_ENDPOINT");
  if (compatibleEndpoint) {
    return callOpenAiCompatibleJson({
      endpoint: compatibleEndpoint,
      token: envValue("AVOCADOCORE_ACP_TOKEN") || undefined,
      model: status.openAiCompatible.model,
      prompt,
    });
  }

  const googleApiKey = envValue("GOOGLE_AI_STUDIO_API_KEY");
  if (status.defaultProvider === "google-ai-studio" && googleApiKey) {
    return callGoogleAiStudioJson({
      apiKey: googleApiKey,
      model: status.googleAiStudio.model,
      prompt,
    });
  }

  return null;
}

async function callOpenAiCompatibleJson({
  endpoint,
  token,
  model,
  prompt,
}: {
  endpoint: string;
  token: string | undefined;
  model: string;
  prompt: string;
}): Promise<unknown | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 600,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseJsonText(data.choices?.[0]?.message?.content);
}

async function callGoogleAiStudioJson({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<unknown | null> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    }),
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n");
  return parseJsonText(raw);
}

function parseJsonText(raw: string | undefined): unknown | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
