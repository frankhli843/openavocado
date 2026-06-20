/**
 * AvocadoCore interactive widget schema.
 *
 * A lesson "interactive" activity carries a structured, versioned WidgetSpec
 * instead of free-form code. The app instantiates it through a safe component
 * registry. There are two families:
 *
 *  1. `declarative` widgets — fully data-driven. The generator describes
 *     controls (sliders/toggles/segmented), derived outputs (safe formulas),
 *     explanatory panels (template text), and an optional chart. No code is
 *     executed; outputs are computed by the sandboxed expression evaluator.
 *
 *  2. registered widgets — a named `widget_type` resolved from a curated
 *     registry of hand-written, reviewed React components (e.g. "supply-demand").
 *     The generator supplies typed `params`, never code.
 *
 * SAFETY: the reusable repo never executes AI-authored React/JS. Custom
 * "Sophie-AI-style" components are supported only through (a) the declarative
 * schema or (b) adding a reviewed component to the registry. A future private
 * adapter may compile generated specs into registered components or sandboxed
 * web-component bundles, but that path lives outside this repo.
 */

import { parseExpression, collectIdentifiers, ExpressionError } from "./expression";

export const WIDGET_SCHEMA_VERSION = "1.0";

export type OutputFormat = "number" | "integer" | "percent" | "currency";

export interface SliderControl {
  type: "slider";
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
  format?: OutputFormat;
}

export interface ToggleControl {
  type: "toggle";
  id: string;
  label: string;
  default: boolean;
  onLabel?: string;
  offLabel?: string;
}

export interface SegmentedControl {
  type: "segmented";
  id: string;
  label: string;
  options: Array<{ label: string; value: number }>;
  default: number;
}

export type WidgetControl = SliderControl | ToggleControl | SegmentedControl;

export interface WidgetOutput {
  id: string;
  label: string;
  formula: string;
  format?: OutputFormat;
  precision?: number;
  unit?: string;
  description?: string;
}

export interface WidgetPanel {
  title?: string;
  /** Markdown-ish text with {{id}} placeholders interpolated from live values. */
  template: string;
}

export interface BarChartSpec {
  type: "bar";
  title?: string;
  bars: Array<{ label: string; ref: string; color?: string }>;
  /** Optional fixed max for the value axis; otherwise auto-scaled. */
  max?: number;
}

export interface CurveChartSpec {
  type: "curve";
  title?: string;
  x: { id: string; label: string; min: number; max: number; steps?: number };
  curves: Array<{ label: string; formula: string; color?: string }>;
  marker?: { xFormula: string; yFormula: string; label?: string };
  yLabel?: string;
}

export type WidgetChart = BarChartSpec | CurveChartSpec;

export interface DeclarativeWidgetSpec {
  schema_version: string;
  widget_type: "declarative";
  title?: string;
  instructions: string;
  controls: WidgetControl[];
  outputs: WidgetOutput[];
  panels?: WidgetPanel[];
  chart?: WidgetChart;
}

export interface RegisteredWidgetSpec {
  schema_version: string;
  widget_type: string;
  title?: string;
  instructions: string;
  params?: Record<string, unknown>;
}

export type WidgetSpec = DeclarativeWidgetSpec | RegisteredWidgetSpec;

export function isDeclarativeSpec(spec: WidgetSpec): spec is DeclarativeWidgetSpec {
  return spec.widget_type === "declarative";
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface WidgetValidation {
  valid: boolean;
  errors: string[];
  /** True when the spec is structurally fine but the widget_type is not registered. */
  unsupported?: boolean;
}

const ID_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Returns the major version (the part before the first dot). */
function majorVersion(v: string): string {
  return String(v).split(".")[0];
}

/**
 * Validate a widget spec.
 *
 * @param spec        parsed spec object (untrusted)
 * @param knownTypes  registered non-declarative widget types; if provided, an
 *                    unknown `widget_type` is reported as unsupported.
 */
export function validateWidgetSpec(
  spec: unknown,
  knownTypes?: string[]
): WidgetValidation {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: ["Widget spec must be an object"] };
  }
  const s = spec as Record<string, unknown>;

  // schema version
  if (typeof s.schema_version !== "string" || !s.schema_version.trim()) {
    errors.push("Missing schema_version");
  } else if (majorVersion(s.schema_version) !== majorVersion(WIDGET_SCHEMA_VERSION)) {
    errors.push(
      `Incompatible schema_version "${s.schema_version}" (supported major: ${majorVersion(WIDGET_SCHEMA_VERSION)})`
    );
  }

  // widget type
  if (typeof s.widget_type !== "string" || !s.widget_type.trim()) {
    errors.push("Missing widget_type");
    return { valid: false, errors };
  }

  // learner instructions
  if (typeof s.instructions !== "string" || !s.instructions.trim()) {
    errors.push("Missing learner instructions");
  }

  if (s.widget_type === "declarative") {
    validateDeclarative(s, errors);
    return { valid: errors.length === 0, errors };
  }

  // registered widget
  if (knownTypes && !knownTypes.includes(s.widget_type)) {
    errors.push(`Unsupported widget_type "${s.widget_type}"`);
    return { valid: false, errors, unsupported: true };
  }
  if (s.params !== undefined && (typeof s.params !== "object" || s.params === null || Array.isArray(s.params))) {
    errors.push("Registered widget params must be an object");
  }
  return { valid: errors.length === 0, errors };
}

function validateDeclarative(s: Record<string, unknown>, errors: string[]): void {
  const controls = s.controls;
  const outputs = s.outputs;

  if (!Array.isArray(controls)) {
    errors.push("declarative widget requires a controls array");
  }
  if (!Array.isArray(outputs)) {
    errors.push("declarative widget requires an outputs array");
  }
  if (!Array.isArray(controls) || !Array.isArray(outputs)) return;

  const knownIds = new Set<string>();

  for (const [i, c] of controls.entries()) {
    if (!c || typeof c !== "object") {
      errors.push(`controls[${i}] must be an object`);
      continue;
    }
    const ctrl = c as Record<string, unknown>;
    if (typeof ctrl.id !== "string" || !ID_RE.test(ctrl.id)) {
      errors.push(`controls[${i}] has invalid id`);
    } else if (knownIds.has(ctrl.id)) {
      errors.push(`Duplicate control id "${ctrl.id}"`);
    } else {
      knownIds.add(ctrl.id);
    }
    if (typeof ctrl.label !== "string" || !ctrl.label.trim()) {
      errors.push(`controls[${i}] (${String(ctrl.id)}) missing label`);
    }
    switch (ctrl.type) {
      case "slider":
        if (typeof ctrl.min !== "number" || typeof ctrl.max !== "number") {
          errors.push(`slider "${String(ctrl.id)}" needs numeric min/max`);
        } else if (ctrl.min >= ctrl.max) {
          errors.push(`slider "${String(ctrl.id)}" min must be < max`);
        }
        if (typeof ctrl.default !== "number") {
          errors.push(`slider "${String(ctrl.id)}" needs a numeric default`);
        }
        break;
      case "toggle":
        if (typeof ctrl.default !== "boolean") {
          errors.push(`toggle "${String(ctrl.id)}" needs a boolean default`);
        }
        break;
      case "segmented":
        if (!Array.isArray(ctrl.options) || ctrl.options.length < 2) {
          errors.push(`segmented "${String(ctrl.id)}" needs >= 2 options`);
        }
        if (typeof ctrl.default !== "number") {
          errors.push(`segmented "${String(ctrl.id)}" needs a numeric default value`);
        }
        break;
      default:
        errors.push(`controls[${i}] has unsupported type "${String(ctrl.type)}"`);
    }
  }

  // outputs: ids unique, formulas parse and reference known ids (controls or earlier outputs)
  const outputIds = new Set<string>();
  for (const [i, o] of outputs.entries()) {
    if (!o || typeof o !== "object") {
      errors.push(`outputs[${i}] must be an object`);
      continue;
    }
    const out = o as Record<string, unknown>;
    if (typeof out.id !== "string" || !ID_RE.test(out.id)) {
      errors.push(`outputs[${i}] has invalid id`);
    } else if (knownIds.has(out.id) || outputIds.has(out.id)) {
      errors.push(`Duplicate output/control id "${out.id}"`);
    } else {
      outputIds.add(out.id);
    }
    if (typeof out.label !== "string" || !out.label.trim()) {
      errors.push(`outputs[${i}] (${String(out.id)}) missing label`);
    }
    if (typeof out.formula !== "string" || !out.formula.trim()) {
      errors.push(`outputs[${i}] (${String(out.id)}) missing formula`);
      continue;
    }
    try {
      const ast = parseExpression(out.formula);
      const refs = collectIdentifiers(ast);
      for (const ref of refs) {
        if (!knownIds.has(ref) && !outputIds.has(ref)) {
          errors.push(
            `outputs[${i}] (${String(out.id)}) references unknown id "${ref}"`
          );
        }
      }
    } catch (e) {
      const msg = e instanceof ExpressionError ? e.message : String(e);
      errors.push(`outputs[${i}] (${String(out.id)}) has invalid formula: ${msg}`);
    }
  }

  // chart references
  const allIds = new Set([...knownIds, ...outputIds]);
  if (s.chart && typeof s.chart === "object") {
    validateChart(s.chart as Record<string, unknown>, allIds, errors);
  }

  // panel templates: referenced {{ids}} should resolve
  if (s.panels !== undefined) {
    if (!Array.isArray(s.panels)) {
      errors.push("panels must be an array");
    } else {
      for (const [i, p] of s.panels.entries()) {
        const panel = p as Record<string, unknown>;
        if (typeof panel?.template !== "string") {
          errors.push(`panels[${i}] missing template`);
          continue;
        }
        for (const ref of extractTemplateRefs(panel.template)) {
          if (!allIds.has(ref)) {
            errors.push(`panels[${i}] references unknown id "${ref}"`);
          }
        }
      }
    }
  }
}

function validateChart(
  chart: Record<string, unknown>,
  allIds: Set<string>,
  errors: string[]
): void {
  if (chart.type === "bar") {
    if (!Array.isArray(chart.bars) || chart.bars.length === 0) {
      errors.push("bar chart needs a non-empty bars array");
      return;
    }
    for (const b of chart.bars) {
      const bar = b as Record<string, unknown>;
      if (typeof bar.ref !== "string" || !allIds.has(bar.ref)) {
        errors.push(`bar chart references unknown id "${String(bar.ref)}"`);
      }
    }
  } else if (chart.type === "curve") {
    const x = chart.x as Record<string, unknown> | undefined;
    if (!x || typeof x.id !== "string" || typeof x.min !== "number" || typeof x.max !== "number") {
      errors.push("curve chart needs x { id, min, max }");
    }
    if (!Array.isArray(chart.curves) || chart.curves.length === 0) {
      errors.push("curve chart needs a non-empty curves array");
      return;
    }
    const xId = x && typeof x.id === "string" ? x.id : "";
    const curveScope = new Set([...allIds, xId]);
    for (const c of chart.curves) {
      const curve = c as Record<string, unknown>;
      if (typeof curve.formula !== "string") {
        errors.push("curve chart curve missing formula");
        continue;
      }
      try {
        const refs = collectIdentifiers(parseExpression(curve.formula));
        for (const ref of refs) {
          if (!curveScope.has(ref)) {
            errors.push(`curve "${String(curve.label)}" references unknown id "${ref}"`);
          }
        }
      } catch (e) {
        const msg = e instanceof ExpressionError ? e.message : String(e);
        errors.push(`curve "${String(curve.label)}" has invalid formula: ${msg}`);
      }
    }
  } else {
    errors.push(`Unsupported chart type "${String(chart.type)}"`);
  }
}

const TEMPLATE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractTemplateRefs(template: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  TEMPLATE_RE.lastIndex = 0;
  while ((m = TEMPLATE_RE.exec(template)) !== null) {
    refs.push(m[1]);
  }
  return refs;
}

// ─── Value formatting + initial state ──────────────────────────────────────────

export function formatValue(value: number, format?: OutputFormat, precision?: number): string {
  if (!Number.isFinite(value)) return "—";
  const p = precision ?? (format === "integer" ? 0 : 2);
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(p)}%`;
    case "currency":
      return `$${value.toFixed(p)}`;
    case "integer":
      return Math.round(value).toString();
    case "number":
    default:
      return value.toFixed(p);
  }
}

/** Build the initial numeric scope from control defaults. */
export function initialControlValues(controls: WidgetControl[]): Record<string, number> {
  const scope: Record<string, number> = {};
  for (const c of controls) {
    if (c.type === "toggle") scope[c.id] = c.default ? 1 : 0;
    else scope[c.id] = c.default;
  }
  return scope;
}
