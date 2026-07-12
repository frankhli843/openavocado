import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkGoogleAiStudioUpstream,
  summarizeAiStudioConfig,
  validateGoogleAiStudioKeyShape,
} from "./google-ai-studio";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Google AI Studio provider health", () => {
  it("uses a generic Google AI Studio model by default", () => {
    const health = summarizeAiStudioConfig();

    expect(health.model).toBe("gemini-2.5-flash");
  });

  it("recognizes expected AI Studio API key shape", () => {
    expect(validateGoogleAiStudioKeyShape("AIzaSyA123456789012345678901234567890123")).toBe(true);
    expect(validateGoogleAiStudioKeyShape("AQ.Ab8RN6I7ApdeTBmHl0K5S8D9FCpM6zskFA1VRceHm6dIDNcJg")).toBe(true);
    expect(validateGoogleAiStudioKeyShape("AQ.short")).toBe(false);
  });

  it("reports invalid-format without making an upstream request", () => {
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "not-a-google-api-key");

    const health = summarizeAiStudioConfig();

    expect(health.configured).toBe(true);
    expect(health.status).toBe("invalid-format");
    expect(health.checked).toBe(false);
  });

  it("redacts the API key from rejected upstream errors", async () => {
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "AIzaSyA123456789012345678901234567890123");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).not.toContain("key=");
        expect((init?.headers as Record<string, string>)["X-goog-api-key"]).toBe(
          "AIzaSyA123456789012345678901234567890123"
        );
        return {
        ok: false,
        status: 400,
        text: async () => "bad key AIzaSyA123456789012345678901234567890123",
        };
      })
    );

    const health = await checkGoogleAiStudioUpstream();

    expect(health.status).toBe("rejected");
    expect(health.error).toContain("[redacted]");
    expect(health.error).not.toContain("AIzaSyA123456789012345678901234567890123");
  });
});
