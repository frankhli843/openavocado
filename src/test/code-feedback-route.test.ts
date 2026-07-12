import { beforeEach, describe, expect, it, vi } from "vitest";

const getCodeFeedbackMock = vi.fn();

vi.mock("@/lib/feedback-llm", () => ({
  loadFeedbackConfig: () => ({
    enabled: true,
    provider: "google",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "test-key",
    model: "gemini-2.5-flash",
  }),
  getCodeFeedback: getCodeFeedbackMock,
}));

describe("POST /api/code-feedback", () => {
  beforeEach(() => {
    getCodeFeedbackMock.mockReset();
  });

  it("normalizes public test payload variants before asking for LLM feedback", async () => {
    getCodeFeedbackMock.mockResolvedValue("Check whether the function should return the input unchanged.");
    const { POST } = await import("../app/api/code-feedback/route");

    const response = await POST(new Request("http://avo.test/api/code-feedback", {
      method: "POST",
      body: JSON.stringify({
        lesson_title: "Smoke",
        exercise_prompt: "Write identity(x) so it returns x unchanged.",
        learner_code: "def identity(x):\n    return x + 1",
        interpreter_output: "AssertionError: expected 3 but got 4",
        public_test_results: [
          { name: "identity returns input", passed: false, output: "AssertionError: expected 3 but got 4" },
        ],
        hidden_test_summary: { total: 1, passed: 0 },
        all_passed: false,
      }),
    }));

    await expect(response.json()).resolves.toEqual({
      enabled: true,
      feedback: "Check whether the function should return the input unchanged.",
    });
    expect(getCodeFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
      expect.objectContaining({
        publicTestResults: [
          { id: "public-1", description: "identity returns input", status: "fail" },
        ],
      })
    );
  });
});
