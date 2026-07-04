import { describe, expect, it } from "vitest";
import { DEMO_SUBJECT_TITLE, isBuiltInDemoSubjectTitle } from "./demo-subject";

describe("demo subject helper", () => {
  it("recognizes the built-in demo subject title case-insensitively", () => {
    expect(isBuiltInDemoSubjectTitle(DEMO_SUBJECT_TITLE)).toBe(true);
    expect(isBuiltInDemoSubjectTitle(`  ${DEMO_SUBJECT_TITLE.toUpperCase()}  `)).toBe(true);
  });

  it("does not classify user-created subjects as the built-in demo", () => {
    expect(isBuiltInDemoSubjectTitle("Build a tiny chess engine")).toBe(false);
    expect(isBuiltInDemoSubjectTitle(null)).toBe(false);
  });
});
