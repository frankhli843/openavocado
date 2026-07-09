import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callConfiguredLlmForJson,
  getProviderHealthSummary,
  getProviderStatus,
} from "./llm";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("provider status", () => {
  it("reports key presence and model names without exposing secret values", () => {
    vi.stubEnv("AVOCADOCORE_DEFAULT_PROVIDER", "google-ai-studio");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "secret-key-that-must-not-appear");
    vi.stubEnv("GOOGLE_AI_STUDIO_MODEL", "gemini-test-model");

    const status = getProviderStatus();
    expect(status.defaultProvider).toBe("google-ai-studio");
    expect(status.googleAiStudio.keyPresent).toBe(true);
    expect(status.googleAiStudio.model).toBe("gemini-test-model");

    const summary = getProviderHealthSummary();
    expect(summary).toContain("google-ai-studio.key=present");
    expect(summary).toContain("google-ai-studio.model=gemini-test-model");
    expect(summary).not.toContain("secret-key-that-must-not-appear");
  });

  it("uses Gemini 2.5 Flash as the default Google AI Studio model", () => {
    vi.stubEnv("AVOCADOCORE_DEFAULT_PROVIDER", "google-ai-studio");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "present");

    expect(getProviderStatus().googleAiStudio.model).toBe("gemini-2.5-flash");
  });

  it("normalizes quoted env values from sourced .env files", () => {
    vi.stubEnv("AVOCADOCORE_DEFAULT_PROVIDER", "'google-ai-studio'");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "\"present\"");
    vi.stubEnv("GOOGLE_AI_STUDIO_MODEL", "'gemini-flash-latest'");

    const status = getProviderStatus();
    expect(status.defaultProvider).toBe("google-ai-studio");
    expect(status.googleAiStudio.keyPresent).toBe(true);
    expect(status.googleAiStudio.model).toBe("gemini-flash-latest");
  });

  it("normalizes literal 047 wrappers from shell-sourced env files", () => {
    vi.stubEnv("AVOCADOCORE_DEFAULT_PROVIDER", "047google-ai-studio047");

    expect(getProviderStatus().defaultProvider).toBe("google-ai-studio");
  });
});

describe("callConfiguredLlmForJson", () => {
  it("calls Google AI Studio when selected and no OpenAI-compatible endpoint is configured", async () => {
    vi.stubEnv("AVOCADOCORE_DEFAULT_PROVIDER", "google-ai-studio");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "gemini-secret");
    vi.stubEnv("GOOGLE_AI_STUDIO_MODEL", "gemini-test-model");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ question: "Q", choices: ["A"], correct_index: 0, explanation: "E" }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await callConfiguredLlmForJson("make json");

    expect(result).toEqual({ question: "Q", choices: ["A"], correct_index: 0, explanation: "E" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).toContain("gemini-test-model");
    expect(String(url)).toContain("key=gemini-secret");
    expect(JSON.parse(String(init?.body)).generationConfig.responseMimeType).toBe("application/json");
  });

  it("prefers an explicit OpenAI-compatible endpoint over the default provider", async () => {
    vi.stubEnv("AVOCADOCORE_DEFAULT_PROVIDER", "google-ai-studio");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "gemini-secret");
    vi.stubEnv("AVOCADOCORE_ACP_ENDPOINT", "http://127.0.0.1:8080/v1");
    vi.stubEnv("AVOCADOCORE_ACP_MODEL", "local-model");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      }),
    } as Response);

    const result = await callConfiguredLlmForJson("make json");

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:8080/v1/chat/completions");
    expect(JSON.parse(String(init?.body)).model).toBe("local-model");
  });

  it("returns null when no provider is configured", async () => {
    await expect(callConfiguredLlmForJson("make json")).resolves.toBeNull();
  });
});
