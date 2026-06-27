/**
 * Temporary bridge for interactive visual components.
 *
 * This registry is not the long-term lesson-authoring model. Frank's target
 * architecture is a dynamic visual artifact pipeline where each lesson part can
 * carry a bespoke generated React component through source storage, isolated
 * build, Chrome MCP QA, approval metadata, and sandboxed rendering without
 * editing app source for every new visual.
 *
 * Until that pipeline exists, purpose-built components are wired here so the
 * app never executes raw React/JS from lesson JSON or SQLite. `declarative`
 * remains only as a legacy/simple fallback, not the default quality bar for
 * future lessons.
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
  {
    type: "image-preprocessing-pipeline",
    title: "Image Preprocessing Pipeline",
    summary:
      "Inspect resize, rescale, normalize, layout, and batch-shape changes for vision model inputs.",
  },
  {
    type: "kv-cache-generation",
    title: "KV Cache Generation",
    summary:
      "Trace prefill, attention, decoding, cache memory, and context-window pressure during generation.",
  },
  {
    type: "llm-lifecycle",
    title: "LLM Lifecycle",
    summary:
      "Walk the Plan, Organize, Tokenize, Train, Evaluate, Reduce, Serve contract chain for model building.",
  },
  {
    type: "embedding-matrix-lookup",
    title: "Embedding Matrix Lookup",
    summary:
      "Show token IDs selecting embedding rows, adding position vectors, and forming the L x D hidden-state matrix.",
  },
  {
    type: "bayes-base-rate-lab",
    title: "Bayes Base-Rate Lab",
    summary:
      "Trace a 10,000-person population through prior, test funnel, positive-result pile, and posterior.",
  },
  {
    type: "transformer-logits-lab",
    title: "Transformer Logits Lab",
    summary:
      "Show context mixing, output-head logits, softmax probabilities, and what breaks when context is hidden.",
  },
  {
    type: "gcp-aws-map-lab",
    title: "GCP AWS Map Lab",
    summary:
      "Map familiar AWS service and IAM mental models onto GCP hierarchy, compute, data, and identity concepts.",
  },
];

/** All widget types the app can render, including the generic declarative one. */
export const SUPPORTED_WIDGET_TYPES: string[] = [
  "declarative",
  // DB-backed bespoke artifact pipeline: artifact_slug routes to BespokeArtifactRenderer
  "bespoke-artifact",
  ...REGISTERED_WIDGETS.map((w) => w.type),
];

export function isSupportedWidgetType(type: string): boolean {
  return SUPPORTED_WIDGET_TYPES.includes(type);
}
