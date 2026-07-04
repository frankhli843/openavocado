/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssessmentSection } from "@/components/lesson/AssessmentSection";
import type { LessonActivity } from "@/types";

function activity(content: unknown): LessonActivity {
  return {
    id: 44,
    lesson_id: 7,
    activity_type: "assessment",
    sequence_order: 6,
    section_number: 6,
    title: "Assessment: Transformer Architecture Bridge",
    content: JSON.stringify(content),
    is_core: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  } as LessonActivity;
}

describe("AssessmentSection", () => {
  it("renders structured assessment question types instead of textareas", () => {
    const onChange = vi.fn();

    render(
      <AssessmentSection
        activity={activity({
          questions: [
            {
              id: "fq1",
              text: "Fill the architecture handoff blanks.",
              type: "fill_blank",
              blanks: [
                { id: "ids", label: "Token IDs become" },
                { id: "blocks", label: "Transformer blocks produce" },
              ],
            },
            {
              id: "fq2",
              text: "Put the forward pass in order.",
              type: "ordering",
              items: [
                "Token IDs enter the model",
                "Embedding rows are selected",
                "Transformer blocks mix hidden states",
              ],
            },
            {
              id: "fq3",
              text: "Classify each object.",
              type: "classification",
              items: [
                { id: "tokenizer", text: "Maps text to token IDs" },
                { id: "attention", text: "Mixes information across token positions" },
              ],
              categories: [
                { id: "input-boundary", label: "Input boundary" },
                { id: "context-mixing", label: "Context mixing" },
              ],
            },
            {
              id: "fq4",
              text: "Explain why KV cache is later.",
              type: "free_text",
            },
          ],
        })}
        answers={{}}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("Token IDs become")).toBeInTheDocument();
    expect(screen.getByText("Token IDs enter the model")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Down" })).toHaveLength(3);
    expect(screen.getByLabelText("Maps text to token IDs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write your answer here...")).toBeInTheDocument();
  });

  it("autosaves structured answers as readable strings", () => {
    const onChange = vi.fn();

    render(
      <AssessmentSection
        activity={activity({
          questions: [
            {
              id: "fq1",
              text: "Fill the blanks.",
              type: "fill_blank",
              blanks: [{ id: "ids", label: "Token IDs become" }],
            },
            {
              id: "fq3",
              text: "Classify each object.",
              type: "classification",
              items: [{ id: "tokenizer", text: "Maps text to token IDs" }],
              categories: [{ id: "input-boundary", label: "Input boundary" }],
            },
          ],
        })}
        answers={{}}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Token IDs become"), {
      target: { value: "embeddings" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ fq1: "Token IDs become: embeddings" });

    fireEvent.change(screen.getByLabelText("Maps text to token IDs"), {
      target: { value: "Input boundary" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      fq3: "Maps text to token IDs: Input boundary",
    });
  });

  it("hydrates structured answers from autosaved strings", () => {
    render(
      <AssessmentSection
        activity={activity({
          questions: [
            {
              id: "fq1",
              text: "Fill the blanks.",
              type: "fill_blank",
              blanks: [{ id: "ids", label: "Token IDs become" }],
            },
            {
              id: "fq2",
              text: "Put the forward pass in order.",
              type: "ordering",
              items: ["first", "second", "third"],
            },
          ],
        })}
        answers={{
          fq1: "Token IDs become: embeddings",
          fq2: "1. third\n2. first\n3. second",
        }}
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText("Token IDs become")).toHaveValue("embeddings");
    expect(["third", "first", "second"].map((text) => screen.getByText(text).textContent)).toEqual([
      "third",
      "first",
      "second",
    ]);
  });

  it("does not render blank generated assessment prompts as numbered empty questions", () => {
    render(
      <AssessmentSection
        activity={activity({
          questions: [
            { id: "blank", text: "", type: "free_text" },
            { id: "valid", text: "Explain what changed.", type: "free_text" },
          ],
        })}
        answers={{}}
        onChange={() => undefined}
      />
    );

    expect(screen.queryByText(/^1\.\s*$/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write your answer here...")).toBeInTheDocument();
    expect(screen.getByText("1. Explain what changed.")).toBeInTheDocument();
  });

  it("shows a repair message when every generated assessment prompt is blank", () => {
    render(
      <AssessmentSection
        activity={activity({
          questions: [
            { id: "blank", text: " ", type: "free_text" },
          ],
        })}
        answers={{}}
        onChange={() => undefined}
      />
    );

    expect(screen.getByText(/generated without usable prompts/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write your answer here...")).not.toBeInTheDocument();
  });
});
