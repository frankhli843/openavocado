/**
 * Runtime computation for declarative widgets.
 *
 * Output formulas are evaluated in declaration order against the live control
 * scope, so a later output may reference an earlier one. All evaluation goes
 * through the sandboxed expression evaluator — no code execution.
 */
import { evaluate, parseExpression, evalAst } from "./expression";
import { extractTemplateRefs, formatValue, type WidgetOutput } from "./schema";

export interface ComputedOutput extends WidgetOutput {
  value: number;
  display: string;
  /** Set when the formula failed to evaluate. */
  error?: string;
}

/**
 * Compute every output from the current control scope.
 * Returns the resolved outputs plus a combined scope (controls + outputs)
 * suitable for chart/marker/template evaluation.
 */
export function computeOutputs(
  outputs: WidgetOutput[],
  controlScope: Record<string, number>
): { outputs: ComputedOutput[]; scope: Record<string, number> } {
  const scope: Record<string, number> = { ...controlScope };
  const computed: ComputedOutput[] = [];

  for (const out of outputs) {
    let value = 0;
    let error: string | undefined;
    try {
      value = evaluate(out.formula, scope);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    scope[out.id] = value;
    computed.push({
      ...out,
      value,
      display: error ? "—" : formatValue(value, out.format, out.precision),
      error,
    });
  }

  return { outputs: computed, scope };
}

/** Interpolate {{id}} placeholders in panel templates using the live scope. */
export function renderTemplate(
  template: string,
  scope: Record<string, number>,
  formats: Record<string, { format?: import("./schema").OutputFormat; precision?: number }>
): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, id: string) => {
    if (!(id in scope)) return `{{${id}}}`;
    const fmt = formats[id];
    return formatValue(scope[id], fmt?.format, fmt?.precision);
  });
}

export { extractTemplateRefs };

/** Sample a curve formula across an x-range; returns {x, [label]: y} rows. */
export function sampleCurve(
  formula: string,
  xId: string,
  xMin: number,
  xMax: number,
  steps: number,
  baseScope: Record<string, number>
): Array<{ x: number; y: number }> {
  const ast = parseExpression(formula);
  const rows: Array<{ x: number; y: number }> = [];
  const n = Math.max(2, Math.min(steps, 200));
  for (let i = 0; i < n; i++) {
    const x = xMin + ((xMax - xMin) * i) / (n - 1);
    const y = evalAst(ast, { ...baseScope, [xId]: x });
    rows.push({ x, y: Number.isFinite(y) ? y : 0 });
  }
  return rows;
}
