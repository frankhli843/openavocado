/**
 * Legacy widget catalog kept only for migration/backfill inspection.
 *
 * The learner-facing runtime no longer dispatches these precreated components.
 * New and backfilled Avo interactives must be approved DB-backed bespoke
 * artifacts rendered by slug through BespokeArtifactRenderer.
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

/** Legacy schema catalog, not the learner-facing render contract. */
export const SUPPORTED_WIDGET_TYPES: string[] = [
  "bespoke-artifact",
];

export function isSupportedWidgetType(type: string): boolean {
  return SUPPORTED_WIDGET_TYPES.includes(type);
}
