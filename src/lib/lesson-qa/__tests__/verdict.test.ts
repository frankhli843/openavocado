import { describe, it, expect } from "vitest";
import { parseVerdict, validateVerdictStructure, buildRegenerationFeedback } from "../verdict";

const approved = { approved: true, evidence: ["Leo teaches residuals with a concrete trace"], rejections: [] };
const rejected = {
  approved: false,
  evidence: [],
  rejections: [
    {
      criterion: "transcript_quality",
      quote: "Point 1 is about attention",
      explanation: "Transcript leaks generator structure ('Point 1').",
      fix_suggestion: "Rewrite as a natural two-host conversation without enumerating points.",
    },
  ],
};

describe("validateVerdictStructure", () => {
  it("accepts a well-formed approval", () => {
    expect(validateVerdictStructure(approved).valid).toBe(true);
  });

  it("accepts a well-formed rejection", () => {
    expect(validateVerdictStructure(rejected).valid).toBe(true);
  });

  it("rejects when approved is not boolean", () => {
    const r = validateVerdictStructure({ approved: "yes", evidence: [], rejections: [] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("approved");
  });

  it("rejects a rejection with an empty rejections array (must be actionable)", () => {
    const r = validateVerdictStructure({ approved: false, evidence: [], rejections: [] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("at least one reason");
  });

  it("rejects a rejection entry missing required fields", () => {
    const r = validateVerdictStructure({
      approved: false,
      evidence: [],
      rejections: [{ criterion: "x", quote: "q", explanation: "" }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/rejections\[0\]/);
  });

  it("rejects a non-object", () => {
    expect(validateVerdictStructure(null).valid).toBe(false);
    expect(validateVerdictStructure("nope").valid).toBe(false);
  });
});

describe("parseVerdict", () => {
  it("parses a bare JSON verdict", () => {
    const v = parseVerdict(JSON.stringify(approved));
    expect(v.approved).toBe(true);
    expect(v.evidence).toHaveLength(1);
  });

  it("parses the last {-line from noisy agent stdout (agent-harness contract)", () => {
    const stdout = `some log line\n[reviewer] thinking...\n${JSON.stringify(rejected)}\n`;
    const v = parseVerdict(stdout);
    expect(v.approved).toBe(false);
    expect(v.rejections[0].criterion).toBe("transcript_quality");
  });

  it("parses a fenced ```json block", () => {
    const stdout = "```json\n" + JSON.stringify(approved) + "\n```";
    expect(parseVerdict(stdout).approved).toBe(true);
  });

  it("throws on empty output", () => {
    expect(() => parseVerdict("   ")).toThrow(/no output/);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseVerdict("{ not json ")).toThrow();
  });

  it("throws on structurally invalid verdict", () => {
    expect(() => parseVerdict(JSON.stringify({ approved: false, evidence: [], rejections: [] }))).toThrow(
      /structurally invalid/
    );
  });
});

describe("buildRegenerationFeedback", () => {
  it("returns empty string for an approval", () => {
    expect(buildRegenerationFeedback(approved)).toBe("");
  });

  it("includes the criterion, offending quote, and fix for each rejection", () => {
    const fb = buildRegenerationFeedback(rejected);
    expect(fb).toContain("REJECTED");
    expect(fb).toContain("transcript_quality");
    expect(fb).toContain("Point 1 is about attention");
    expect(fb).toContain("Rewrite as a natural two-host conversation");
  });
});
