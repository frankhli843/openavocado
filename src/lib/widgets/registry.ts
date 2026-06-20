/**
 * Curated registry of interactive widget types.
 *
 * `declarative` is always available (data-driven, no code). Every other entry
 * is a hand-written, reviewed React component wired in WidgetHost. The lesson
 * generator may only emit these types; anything else is reported as an
 * unsupported widget and rendered as a clear error state, never executed.
 *
 * This module is intentionally React-free so the validator and the
 * lesson-generator contract can import it without pulling in the UI layer.
 */

export interface RegisteredWidgetInfo {
  type: string;
  title: string;
  summary: string;
}

/** Named (non-declarative) widgets implemented in the registry. */
export const REGISTERED_WIDGETS: RegisteredWidgetInfo[] = [
  {
    type: "supply-demand",
    title: "Supply & Demand Simulator",
    summary:
      "Shift supply/demand curves and a per-unit tax to see equilibrium price, quantity, and revenue move live.",
  },
];

/** All widget types the app can render, including the generic declarative one. */
export const SUPPORTED_WIDGET_TYPES: string[] = [
  "declarative",
  ...REGISTERED_WIDGETS.map((w) => w.type),
];

export function isSupportedWidgetType(type: string): boolean {
  return SUPPORTED_WIDGET_TYPES.includes(type);
}
