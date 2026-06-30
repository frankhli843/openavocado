import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAnswerFeedback,
  getAnswerJudgment,
  loadFeedbackConfig,
  parseAnswerJudgment,
  type AnswerJudgeRequest,
} from "@/lib/feedback-llm";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AVOCADOCORE_FEEDBACK_PROVIDER;
  delete process.env.AVOCADOCORE_FEEDBACK_BASE_URL;
  delete process.env.AVOCADOCORE_FEEDBACK_GOOGLE_BASE_URL;
  delete process.env.AVOCADOCORE_FEEDBACK_MODEL;
  delete process.env.AVOCADOCORE_FEEDBACK_API_KEY;
});

describe("parseAnswerJudgment", () => {
  it("does not let the generic OpenAI-compatible base URL override Google chat", () => {
    process.env.AVOCADOCORE_FEEDBACK_PROVIDER = "google";
    process.env.AVOCADOCORE_FEEDBACK_BASE_URL = "http://127.0.0.1:8080/v1";
    process.env.AVOCADOCORE_FEEDBACK_API_KEY = "test-key";

    const config = loadFeedbackConfig();

    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("google");
    expect(config.baseUrl).toBe("https://generativelanguage.googleapis.com");
  });

  it("uses the Google-specific base URL override when explicitly provided", () => {
    process.env.AVOCADOCORE_FEEDBACK_PROVIDER = "google";
    process.env.AVOCADOCORE_FEEDBACK_BASE_URL = "http://127.0.0.1:8080/v1";
    process.env.AVOCADOCORE_FEEDBACK_GOOGLE_BASE_URL = "https://example.test/google/";
    process.env.AVOCADOCORE_FEEDBACK_API_KEY = "test-key";

    const config = loadFeedbackConfig();

    expect(config.baseUrl).toBe("https://example.test/google");
  });

  it("sends Google API keys in the header instead of the URL", async () => {
    const apiKey = "AQ.Ab8RN6I7ApdeTBmHl0K5S8D9FCpM6zskFA1VRceHm6dIDNcJg";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url, init) => {
      expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent");
      expect(String(url)).not.toContain(apiKey);
      expect((init?.headers as Record<string, string>)["X-goog-api-key"]).toBe(apiKey);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Good start. Add one concrete example." }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const feedback = await getAnswerFeedback(
      {
        enabled: true,
        provider: "google",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey,
        model: "gemma-4-26b-a4b-it",
      },
      {
        lessonTitle: "Tokenization",
        lessonDescription: null,
        questionText: "Why do LLMs tokenize text?",
        questionHint: null,
        learnerAnswer: "So text can become model inputs.",
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(feedback).toMatch(/Good start/);
  });

  it("ignores Gemma 4 thinking parts when reading Google responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "internal reasoning trace", thought: true },
                  { text: "Actionable learner feedback." },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const feedback = await getAnswerFeedback(
      {
        enabled: true,
        provider: "google",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "AQ.Ab8RN6I7ApdeTBmHl0K5S8D9FCpM6zskFA1VRceHm6dIDNcJg",
        model: "gemma-4-26b-a4b-it",
      },
      {
        lessonTitle: "Tokenization",
        lessonDescription: null,
        questionText: "Why do LLMs tokenize text?",
        questionHint: null,
        learnerAnswer: "So text can become model inputs.",
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(feedback).toBe("Actionable learner feedback.");
  });

  it("parses a strict semantic judge JSON response", () => {
    const parsed = parseAnswerJudgment(
      '{"verdict":"correct","confidence":0.91,"feedback":"Same meaning, different wording."}'
    );
    expect(parsed).toEqual({
      verdict: "correct",
      confidence: 0.91,
      feedback: "Same meaning, different wording.",
    });
  });

  it("extracts JSON when the model wraps it in extra text", () => {
    const parsed = parseAnswerJudgment(
      'Here is the result: {"verdict":"partially_correct","confidence":0.5,"feedback":"You got the main idea but missed the order."}'
    );
    expect(parsed.verdict).toBe("partially_correct");
    expect(parsed.confidence).toBe(0.5);
  });

  it("falls back to unclear instead of trusting malformed output", () => {
    const parsed = parseAnswerJudgment("The answer is probably fine, but I forgot JSON.");
    expect(parsed.verdict).toBe("unclear");
    expect(parsed.confidence).toBe(0);
    expect(parsed.feedback).toMatch(/probably fine/);
  });

  it("repairs vague unclear feedback with a second model judgment pass", async () => {
    const req: AnswerJudgeRequest = {
      lessonTitle: "The LLM Lifecycle",
      lessonDescription: null,
      questionType: "free_text",
      questionText: "Why is tokenization not just a cosmetic preprocessing step?",
      questionHint: null,
      learnerAnswer: "Needed because it maps numbers to text output predictions.",
      actualAnswer:
        "Tokenization defines the fixed vocabulary and token-ID contract between text and the model. The model consumes token IDs and predicts probability distributions over token IDs, so tokenization determines what inputs and outputs the model can represent.",
      rubric: null,
      acceptedAnswers: [],
      supportRef: "lesson_part:tokenizer-model-contract",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: '{"verdict":"unclear","confidence":0,"feedback":"I could not judge that answer clearly. Try adding one concrete detail from the lesson."}' } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ).mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: '{"verdict":"partially_correct","confidence":0.62,"feedback":"You have the mapping idea, but you need the token-ID contract: tokenization fixes the vocabulary IDs the model consumes and predicts. Add that the model predicts probabilities over token IDs, not raw text."}' } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const parsed = await getAnswerJudgment({
      enabled: true,
      provider: "local",
      baseUrl: "http://judge.test/v1",
      apiKey: "",
      model: "test-model",
    }, req);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(parsed.verdict).toBe("partially_correct");
    expect(parsed.feedback).toMatch(/token-ID contract|probabilities over token IDs/i);
  });
});
