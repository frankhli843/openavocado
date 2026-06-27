/**
 * Tests for the interactive widget schema, the sandboxed expression evaluator,
 * runtime computation, and the generator-contract validation of widget specs.
 */
import { describe, it, expect } from "vitest";
import {
  parseExpression,
  evaluate,
  collectIdentifiers,
  ExpressionError,
} from "../lib/widgets/expression";
import {
  validateWidgetSpec,
  formatValue,
  initialControlValues,
  type DeclarativeWidgetSpec,
} from "../lib/widgets/schema";
import { computeOutputs, renderTemplate, sampleCurve } from "../lib/widgets/compute";
import { validateGeneratedContent } from "../lib/lesson-generator/contract";
import type { GeneratedLessonContent } from "../types";

// ─── Safe expression evaluator ──────────────────────────────────────────────

describe("expression evaluator", () => {
  it("evaluates arithmetic with precedence and grouping", () => {
    expect(evaluate("1 + 2 * 3", {})).toBe(7);
    expect(evaluate("(1 + 2) * 3", {})).toBe(9);
    expect(evaluate("2 ^ 3 ^ 2", {})).toBe(512); // right-associative
  });

  it("resolves identifiers from scope; unknown -> 0", () => {
    expect(evaluate("a + b", { a: 5, b: 3 })).toBe(8);
    expect(evaluate("missing + 1", {})).toBe(1);
  });

  it("computes Bayes posterior correctly", () => {
    const scope = { prior: 0.01, sensitivity: 0.95, specificity: 0.9 };
    const expr = "(prior*sensitivity)/((prior*sensitivity)+((1-prior)*(1-specificity)))";
    expect(evaluate(expr, scope)).toBeCloseTo(0.08756, 4);
  });

  it("supports ternary, comparison, and whitelisted functions", () => {
    expect(evaluate("a > b ? 1 : 0", { a: 2, b: 1 })).toBe(1);
    expect(evaluate("max(3, 7, 2)", {})).toBe(7);
    expect(evaluate("clamp(15, 0, 10)", {})).toBe(10);
    expect(evaluate("round(3.14159, 2)", {})).toBe(3.14);
  });

  it("guards divide-by-zero and non-finite results to 0", () => {
    expect(evaluate("1 / 0", {})).toBe(0);
    expect(evaluate("ln(0)", {})).toBe(0); // -Infinity -> 0
  });

  it("rejects unsafe / unknown syntax loudly (no code execution)", () => {
    expect(() => parseExpression("process.exit(1)")).toThrow(ExpressionError);
    expect(() => parseExpression("a = 5")).toThrow(ExpressionError);
    expect(() => parseExpression("evilFn(1)")).toThrow(ExpressionError);
    expect(() => parseExpression("a['b']")).toThrow(ExpressionError);
    expect(() => parseExpression("`template`")).toThrow(ExpressionError);
  });

  it("collects referenced identifiers but not constants", () => {
    const ids = collectIdentifiers(parseExpression("a + pi * b"));
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

// ─── Schema validation ──────────────────────────────────────────────────────

const validDeclarative: DeclarativeWidgetSpec = {
  schema_version: "1.0",
  widget_type: "declarative",
  instructions: "Adjust the inputs.",
  controls: [
    { type: "slider", id: "x", label: "X", min: 0, max: 10, default: 5 },
    { type: "toggle", id: "flag", label: "Flag", default: false },
  ],
  outputs: [{ id: "doubled", label: "Doubled", formula: "x * 2 + flag" }],
  panels: [{ template: "X doubled is {{doubled}}" }],
  chart: { type: "bar", bars: [{ label: "Doubled", ref: "doubled" }] },
};

describe("validateWidgetSpec", () => {
  it("accepts a well-formed declarative spec", () => {
    const r = validateWidgetSpec(validDeclarative);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("flags a missing schema_version", () => {
    const { schema_version: _omit, ...rest } = validDeclarative; // eslint-disable-line @typescript-eslint/no-unused-vars
    const r = validateWidgetSpec(rest);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/schema_version/);
  });

  it("flags an incompatible major schema_version", () => {
    const r = validateWidgetSpec({ ...validDeclarative, schema_version: "2.0" });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/Incompatible schema_version/);
  });

  it("flags a missing widget_type", () => {
    const r = validateWidgetSpec({ ...validDeclarative, widget_type: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/widget_type/);
  });

  it("flags missing learner instructions", () => {
    const r = validateWidgetSpec({ ...validDeclarative, instructions: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/instructions/);
  });

  it("flags a malformed control", () => {
    const r = validateWidgetSpec({
      ...validDeclarative,
      controls: [{ type: "slider", id: "bad", label: "Bad", min: 10, max: 0, default: 5 }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/min must be < max/);
  });

  it("flags an output formula referencing an unknown id", () => {
    const r = validateWidgetSpec({
      ...validDeclarative,
      outputs: [{ id: "o", label: "O", formula: "nonexistent * 2" }],
      panels: [],
      chart: undefined,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/unknown id "nonexistent"/);
  });

  it("flags an unsafe / unparseable formula rather than accepting it", () => {
    const r = validateWidgetSpec({
      ...validDeclarative,
      outputs: [{ id: "o", label: "O", formula: "evil()" }],
      panels: [],
      chart: undefined,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/invalid formula/);
  });

  it("reports an unsupported registered widget_type", () => {
    const r = validateWidgetSpec(
      { schema_version: "1.0", widget_type: "quantum-portal", instructions: "x" },
      ["supply-demand"]
    );
    expect(r.valid).toBe(false);
    expect(r.unsupported).toBe(true);
    expect(r.errors.join(" ")).toMatch(/Unsupported widget_type/);
  });

  it("accepts a known registered widget_type", () => {
    const r = validateWidgetSpec(
      { schema_version: "1.0", widget_type: "supply-demand", instructions: "x", params: { a: 1 } },
      ["supply-demand"]
    );
    expect(r.valid).toBe(true);
  });

  it("accepts a well-formed bespoke-artifact spec", () => {
    const r = validateWidgetSpec({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "Interact with the visualization.",
      params: { artifact_slug: "kv-cache-viz", min_height: 400 },
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.unsupported).toBeFalsy();
  });

  it("accepts bespoke-artifact without optional min_height", () => {
    const r = validateWidgetSpec({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "Explore.",
      params: { artifact_slug: "supply-demand-viz" },
    });
    expect(r.valid).toBe(true);
  });

  it("rejects bespoke-artifact with missing artifact_slug", () => {
    const r = validateWidgetSpec({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "x",
      params: {},
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/artifact_slug/);
  });

  it("rejects bespoke-artifact with invalid slug characters", () => {
    const r = validateWidgetSpec({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "x",
      params: { artifact_slug: "My Widget!" },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/lowercase alphanumeric/);
  });

  it("rejects bespoke-artifact with missing params object", () => {
    const r = validateWidgetSpec({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "x",
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/params/);
  });

  it("rejects bespoke-artifact with non-numeric min_height", () => {
    const r = validateWidgetSpec({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "x",
      params: { artifact_slug: "test-slug", min_height: "400" },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/min_height/);
  });

  // bespoke-artifact is validated by its own branch — unknown type list does NOT affect it
  it("bespoke-artifact passes even when knownTypes list is provided without it", () => {
    const r = validateWidgetSpec(
      {
        schema_version: "1.0",
        widget_type: "bespoke-artifact",
        instructions: "x",
        params: { artifact_slug: "my-viz" },
      },
      ["supply-demand"]
    );
    expect(r.valid).toBe(true);
  });
});

// ─── Runtime compute ────────────────────────────────────────────────────────

describe("computeOutputs", () => {
  it("evaluates outputs in order, allowing chained references", () => {
    const { outputs, scope } = computeOutputs(
      [
        { id: "a", label: "A", formula: "x + 1" },
        { id: "b", label: "B", formula: "a * 2" },
      ],
      { x: 4 }
    );
    expect(scope.a).toBe(5);
    expect(scope.b).toBe(10);
    expect(outputs[1].display).toBe("10.00");
  });

  it("interpolates panel templates with formatted values", () => {
    const out = renderTemplate("Rate is {{p}}", { p: 0.25 }, { p: { format: "percent", precision: 0 } });
    expect(out).toBe("Rate is 25%");
  });

  it("samples a curve across the x-range", () => {
    const rows = sampleCurve("2 * p", "p", 0, 10, 11, {});
    expect(rows).toHaveLength(11);
    expect(rows[0]).toEqual({ x: 0, y: 0 });
    expect(rows[10]).toEqual({ x: 10, y: 20 });
  });
});

describe("formatValue + initial state", () => {
  it("formats by type", () => {
    expect(formatValue(0.1234, "percent", 1)).toBe("12.3%");
    expect(formatValue(42.5, "currency", 2)).toBe("$42.50");
    expect(formatValue(3.7, "integer")).toBe("4");
  });

  it("seeds initial scope from control defaults (toggle -> 1/0)", () => {
    const scope = initialControlValues(validDeclarative.controls);
    expect(scope).toEqual({ x: 5, flag: 0 });
  });
});

// ─── Generator contract ─────────────────────────────────────────────────────

function baseContent(interactiveContent: Record<string, unknown>): GeneratedLessonContent {
  return {
    title: "T",
    description: "d",
    goals: ["g"],
    tags: [],
    activities: [
      { activity_type: "audio", is_core: true, sequence_order: 1, title: "a", content: { script: "A full spoken walkthrough of the concept for this lesson." } },
      {
        activity_type: "reading",
        is_core: true,
        sequence_order: 2,
        title: "r",
        content: {
          blocks: [
            { type: "heading", text: "Idea" },
            { type: "paragraph", text: "A real paragraph of teaching text that explains the concept." },
            { type: "definition", term: "Term", definition: "A clear definition." },
          ],
          summary: "Short review.",
        },
      },
      { activity_type: "interactive", is_core: true, sequence_order: 3, title: "i", content: interactiveContent },
      {
        activity_type: "practice_code",
        is_core: true,
        sequence_order: 4,
        title: "c",
        content: {
          prompt: "Do the thing.",
          tests: [{ id: "t1", description: "works", assert: "x == 1" }],
        },
      },
      { activity_type: "assessment", is_core: true, sequence_order: 5, title: "s", content: {} },
    ],
    mastery_targets: [],
    metadata: { generator: "t", generator_version: "1", generated_at: "now", source_context_summary: "x" },
  };
}

describe("validateGeneratedContent — interactive widget", () => {
  it("passes when the interactive activity carries a valid widget spec", () => {
    const r = validateGeneratedContent(baseContent(validDeclarative as unknown as Record<string, unknown>));
    expect(r.valid).toBe(true);
  });

  it("fails when the interactive activity has a malformed widget spec", () => {
    const r = validateGeneratedContent(baseContent({ widget_type: "declarative" }));
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/interactive activity/);
  });

  it("passes when the interactive uses a valid bespoke-artifact spec", () => {
    const r = validateGeneratedContent(baseContent({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "Explore the visualization.",
      params: { artifact_slug: "my-concept-viz" },
    }));
    expect(r.valid).toBe(true);
  });

  it("fails when bespoke-artifact spec has an invalid slug", () => {
    const r = validateGeneratedContent(baseContent({
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "Explore.",
      params: { artifact_slug: "Bad Slug!" },
    }));
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/artifact_slug/);
  });
});
