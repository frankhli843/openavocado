/**
 * Open Avocado interactive widget schema.
 *
 * A lesson "interactive" activity carries a structured, versioned WidgetSpec
 * instead of free-form code. The learner-facing app instantiates only one
 * family:
 *
 *  1. `bespoke-artifact` widgets — DB-backed, purpose-built React components
 *     authored by the lesson-generation agent for a specific concept. The
 *     `bespoke-artifact` spec carries only a stable slug (no code). The
 *     visual-artifacts pipeline (src/lib/visual-artifacts/) compiles the
 *     generated TSX with esbuild against an import allowlist, runs Chrome MCP
 *     QA, and stores the approved bundle in SQLite. The app renders the bundle
 *     only inside a sandboxed iframe via BespokeArtifactRenderer, and only
 *     after the artifact reaches qa_approved status.
 *
 * Legacy parser families are retained below so old lessons can be identified
 * and backfilled, but WidgetHost no longer renders them:
 *
 *  - `declarative` widgets — fully data-driven. The generator describes
 *     controls (sliders/toggles/segmented), derived outputs (safe formulas),
 *     explanatory panels (template text), and an optional chart.
 *
 *  - registered widgets — a named `widget_type` resolved from a curated
 *     registry of hand-written, reviewed React components (e.g. "supply-demand").
 *     The generator supplies typed `params`, never code.
 *
 * SAFETY: the main app never executes AI-authored React/JS directly from the
 * lesson record or SQLite source column. AI-authored components reach a learner
 * only through the bespoke-artifact pipeline, which compiles in isolation,
 * gates on an explicit approval status, and renders the compiled bundle in a
 * narrow-bridge sandboxed iframe. A failed or unapproved artifact surfaces a
 * visible failure state instead of falling back to a fake visualization.
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

/** A cell whose value is computed from a sandboxed formula over the live scope. */
export interface TableCell {
  formula: string;
  format?: OutputFormat;
  precision?: number;
}

/** A frequency-table view: a labelled grid of live-computed cells. */
export interface TableChartSpec {
  type: "table";
  title?: string;
  /** Column headers (the first column is the row label column). */
  headers: string[];
  rows: Array<{ label: string; cells: TableCell[] }>;
  /** Optional caption under the table. */
  caption?: string;
}

export interface TreeNodeSpec {
  label: string;
  /** Optional live value shown in the node, computed from the scope. */
  valueFormula?: string;
  format?: OutputFormat;
  precision?: number;
  color?: string;
  children?: TreeNodeSpec[];
}

/** A tree/flow view: a population split or decision flow with live counts. */
export interface TreeChartSpec {
  type: "tree";
  title?: string;
  root: TreeNodeSpec;
  caption?: string;
}

export type WidgetChart = BarChartSpec | CurveChartSpec | TableChartSpec | TreeChartSpec;

export interface DeclarativeWidgetSpec {
  schema_version: string;
  widget_type: "declarative";
  title?: string;
  instructions: string;
  controls: WidgetControl[];
  outputs: WidgetOutput[];
  panels?: WidgetPanel[];
  /** A single chart (legacy/simple form). */
  chart?: WidgetChart;
  /**
   * Multiple charts for the same controls — lets one widget show several
   * visual perspectives on the same concept (e.g. bar + frequency table + tree).
   */
  charts?: WidgetChart[];
}

export interface RegisteredWidgetSpec {
  schema_version: string;
  widget_type: string;
  title?: string;
  instructions: string;
  params?: Record<string, unknown>;
}

/**
 * DB-backed bespoke artifact spec.
 *
 * The lesson generator emits this when it has designed a purpose-built React
 * component for a specific concept block. The artifact pipeline compiles the
 * component, runs Chrome MCP QA, and stores the approved bundle in SQLite.
 * Rendering only happens after qa_approved status is reached.
 *
 * Lesson content stores only the stable slug — no code, no build artifacts.
 */
export interface BespokeArtifactWidgetSpec {
  schema_version: string;
  widget_type: "bespoke-artifact";
  title?: string;
  instructions: string;
  params: {
    /** Stable slug matching visual_artifacts.slug */
    artifact_slug: string;
    /** Minimum iframe height in px (default: 300) */
    min_height?: number;
  };
}

export type WidgetSpec =
  | DeclarativeWidgetSpec
  | BespokeArtifactWidgetSpec
  | RegisteredWidgetSpec;

export function isDeclarativeSpec(spec: WidgetSpec): spec is DeclarativeWidgetSpec {
  return spec.widget_type === "declarative";
}

export function isBespokeArtifactSpec(spec: WidgetSpec): spec is BespokeArtifactWidgetSpec {
  return spec.widget_type === "bespoke-artifact";
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

  if (s.widget_type === "bespoke-artifact") {
    validateBespokeArtifact(s, errors);
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

function validateBespokeArtifact(s: Record<string, unknown>, errors: string[]): void {
  const params = s.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    errors.push("bespoke-artifact requires a params object");
    return;
  }
  const p = params as Record<string, unknown>;
  if (typeof p.artifact_slug !== "string" || !p.artifact_slug.trim()) {
    errors.push("bespoke-artifact params.artifact_slug is required (must match visual_artifacts.slug)");
  } else if (!/^[a-z0-9-]+$/.test(p.artifact_slug)) {
    errors.push(`bespoke-artifact params.artifact_slug "${p.artifact_slug}" must be lowercase alphanumeric with hyphens only`);
  }
  if (p.min_height !== undefined && typeof p.min_height !== "number") {
    errors.push("bespoke-artifact params.min_height must be a number if provided");
  }
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

  // chart references — both the single `chart` and the plural `charts`
  const allIds = new Set([...knownIds, ...outputIds]);
  if (s.chart && typeof s.chart === "object") {
    validateChart(s.chart as Record<string, unknown>, allIds, errors);
  }
  if (s.charts !== undefined) {
    if (!Array.isArray(s.charts)) {
      errors.push("charts must be an array");
    } else {
      for (const [i, ch] of s.charts.entries()) {
        if (!ch || typeof ch !== "object") {
          errors.push(`charts[${i}] must be an object`);
          continue;
        }
        validateChart(ch as Record<string, unknown>, allIds, errors);
      }
    }
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
  } else if (chart.type === "table") {
    if (!Array.isArray(chart.headers) || chart.headers.length === 0) {
      errors.push("table chart needs a non-empty headers array");
    }
    if (!Array.isArray(chart.rows) || chart.rows.length === 0) {
      errors.push("table chart needs a non-empty rows array");
      return;
    }
    for (const [ri, r] of chart.rows.entries()) {
      const row = r as Record<string, unknown>;
      if (typeof row?.label !== "string") {
        errors.push(`table row[${ri}] missing label`);
      }
      if (!Array.isArray(row?.cells)) {
        errors.push(`table row[${ri}] missing cells array`);
        continue;
      }
      for (const [ci, cell] of row.cells.entries()) {
        const cl = cell as Record<string, unknown>;
        validateChartFormula(cl?.formula, allIds, `table row[${ri}] cell[${ci}]`, errors);
      }
    }
  } else if (chart.type === "tree") {
    if (!chart.root || typeof chart.root !== "object") {
      errors.push("tree chart needs a root node");
      return;
    }
    validateTreeNode(chart.root as Record<string, unknown>, allIds, "tree root", errors, 0);
  } else {
    errors.push(`Unsupported chart type "${String(chart.type)}"`);
  }
}

/** Validate a single optional formula string references only known ids. */
function validateChartFormula(
  formula: unknown,
  allIds: Set<string>,
  where: string,
  errors: string[]
): void {
  if (typeof formula !== "string" || !formula.trim()) {
    errors.push(`${where} missing formula`);
    return;
  }
  try {
    const refs = collectIdentifiers(parseExpression(formula));
    for (const ref of refs) {
      if (!allIds.has(ref)) errors.push(`${where} references unknown id "${ref}"`);
    }
  } catch (e) {
    const msg = e instanceof ExpressionError ? e.message : String(e);
    errors.push(`${where} has invalid formula: ${msg}`);
  }
}

function validateTreeNode(
  node: Record<string, unknown>,
  allIds: Set<string>,
  where: string,
  errors: string[],
  depth: number
): void {
  if (depth > 6) {
    errors.push(`${where} tree is too deep (max 6 levels)`);
    return;
  }
  if (typeof node.label !== "string" || !node.label.trim()) {
    errors.push(`${where} missing label`);
  }
  if (node.valueFormula !== undefined) {
    validateChartFormula(node.valueFormula, allIds, `${where} valueFormula`, errors);
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      errors.push(`${where} children must be an array`);
    } else {
      node.children.forEach((child, i) =>
        validateTreeNode(child as Record<string, unknown>, allIds, `${where} > child[${i}]`, errors, depth + 1)
      );
    }
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
