/**
 * Semantic LLM QA reviewer for the lesson-generation pipeline.
 *
 * Complements the deterministic validators in lesson-content/schema.ts with a
 * semantic layer: an ACP reviewer agent reads the generated content and writes
 * evidence-backed verdicts across transcript quality, visual-transcript
 * alignment, practice-question quality, and code-exercise quality.
 */

export * from "./gather";
export * from "./verdict";
export * from "./prompt";
export * from "./reviewer";
export * from "./store";
export * from "./review";
