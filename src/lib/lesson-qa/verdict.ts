/**
 * Semantic QA verdict — the structured result the ACP reviewer agent returns.
 *
 * The reviewer reads the gathered lesson content and emits a JSON verdict of the
 * shape { approved, evidence[], rejections[] }. This module owns the type and the
 * strict parse/validation used to turn the reviewer's raw stdout into a trusted
 * verdict (and to reject malformed output).
 */

export type QaRejectionCriterion =
  | "transcript_quality"
  | "visual_transcript_alignment"
  | "practice_question_quality"
  | "code_exercise_quality"
  | string;

export interface QaRejection {
  /** Which quality dimension failed. */
  criterion: QaRejectionCriterion;
  /** A direct quote from the offending content, grounding the rejection. */
  quote: string;
  /** Why this content fails the criterion. */
  explanation: string;
  /** A concrete, actionable fix the regeneration step can apply. */
  fix_suggestion: string;
}

export interface QaVerdict {
  approved: boolean;
  /** Evidence-backed observations. For an approval these are the positive quotes. */
  evidence: string[];
  /** Specific rejections. MUST be non-empty when approved === false. */
  rejections: QaRejection[];
}

export interface VerdictStructureResult {
  valid: boolean;
  errors: string[];
}

/**
 * Structurally validate a candidate verdict object. Enforces the invariant that
 * a rejection carries at least one grounded rejection reason, so a "rejected"
 * verdict is always actionable.
 */
export function validateVerdictStructure(value: unknown): VerdictStructureResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    return { valid: false, errors: ["verdict must be an object"] };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.approved !== "boolean") {
    errors.push("verdict.approved must be a boolean");
  }

  if (!Array.isArray(v.evidence)) {
    errors.push("verdict.evidence must be an array of strings");
  } else if (!v.evidence.every((e) => typeof e === "string")) {
    errors.push("verdict.evidence must contain only strings");
  }

  if (!Array.isArray(v.rejections)) {
    errors.push("verdict.rejections must be an array");
  } else {
    v.rejections.forEach((r, i) => {
      if (!r || typeof r !== "object") {
        errors.push(`verdict.rejections[${i}] must be an object`);
        return;
      }
      const rr = r as Record<string, unknown>;
      for (const field of ["criterion", "quote", "explanation", "fix_suggestion"] as const) {
        if (typeof rr[field] !== "string" || !(rr[field] as string).trim()) {
          errors.push(`verdict.rejections[${i}].${field} must be a non-empty string`);
        }
      }
    });
  }

  // A rejection must be actionable: at least one rejection reason.
  if (v.approved === false && Array.isArray(v.rejections) && v.rejections.length === 0) {
    errors.push("verdict.approved is false but rejections is empty; a rejection must list at least one reason");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse the reviewer's raw stdout into a validated QaVerdict. Accepts either a
 * bare JSON object or a stream of lines where the last line starting with `{` is
 * the JSON verdict (matching the agent-harness stdout contract). Throws on
 * malformed or structurally invalid output.
 */
export function parseVerdict(raw: string): QaVerdict {
  const text = raw.trim();
  if (!text) throw new Error("reviewer produced no output");

  let jsonText = text;
  // Strip markdown fences if present.
  const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fence) {
    jsonText = fence[1].trim();
  } else if (!text.startsWith("{")) {
    // Take the last line that starts with `{` (agent-harness contract).
    const candidate = text
      .split(/\r?\n/)
      .reverse()
      .find((line) => line.trim().startsWith("{"));
    if (!candidate) {
      throw new Error("reviewer output did not contain a JSON verdict object");
    }
    jsonText = candidate.trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`reviewer verdict JSON parse failed: ${msg}`);
  }

  const check = validateVerdictStructure(parsed);
  if (!check.valid) {
    throw new Error(`reviewer verdict is structurally invalid: ${check.errors.join("; ")}`);
  }

  const v = parsed as Record<string, unknown>;
  return {
    approved: v.approved as boolean,
    evidence: (v.evidence as string[]).map((e) => e),
    rejections: (v.rejections as Array<Record<string, unknown>>).map((r) => ({
      criterion: r.criterion as string,
      quote: r.quote as string,
      explanation: r.explanation as string,
      fix_suggestion: r.fix_suggestion as string,
    })),
  };
}

/**
 * Build the regeneration feedback string from a rejection verdict. This is the
 * text injected into the next generation attempt so the model can fix the exact
 * issues the reviewer found.
 */
export function buildRegenerationFeedback(verdict: QaVerdict): string {
  if (verdict.approved || verdict.rejections.length === 0) return "";
  const lines = [
    "The previous version of this lesson was REJECTED by the semantic QA reviewer for the following specific reasons. Fix every one of them in this regeneration:",
    "",
  ];
  verdict.rejections.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.criterion}] ${r.explanation}`);
    if (r.quote) lines.push(`   Offending content: "${r.quote}"`);
    lines.push(`   Required fix: ${r.fix_suggestion}`);
  });
  return lines.join("\n");
}
