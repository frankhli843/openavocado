/**
 * Deterministic guardrails for DB-backed bespoke visual artifact source.
 *
 * These checks do not try to grade pedagogy. They block artifact source that is
 * clearly reusable/template-based or likely to break at a 390px mobile width.
 */

const REGISTERED_OR_TEMPLATE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /components\/lesson\/widgets/i, label: "imports learner-facing widget components" },
  { pattern: /\bWidgetHost\b/, label: "uses WidgetHost instead of standalone artifact code" },
  { pattern: /\bDeclarativeWidget\b/, label: "uses the legacy declarative widget renderer" },
  { pattern: /\bSupplyDemandWidget\b/, label: "uses a registered widget component" },
  { pattern: /\bLlmLifecycleWidget\b/, label: "uses a registered widget component" },
  { pattern: /\bKvCacheGenerationWidget\b/, label: "uses a registered widget component" },
  { pattern: /\bTransformerLogitsLabWidget\b/, label: "uses a registered widget component" },
  { pattern: /\bEmbeddingMatrixLookupWidget\b/, label: "uses a registered widget component" },
  { pattern: /\bImagePreprocessingPipelineWidget\b/, label: "uses a registered widget component" },
  { pattern: /\bwidget_type\b/, label: "embeds widget specs instead of artifact source" },
  { pattern: /\bdeclarative widget\b/i, label: "references declarative widget templates" },
  { pattern: /\bgenerated panel\b/i, label: "uses generated panel terminology" },
  { pattern: /\bpet fish\b/i, label: "contains irrelevant generic demo metaphor text" },
  { pattern: /\bStart with Visual\b/, label: "uses a generic audio visual template stage" },
  { pattern: /\bShow the operation\b/, label: "uses a generic audio visual template stage" },
  { pattern: /\bPass the result forward\b/, label: "uses a generic audio visual template stage" },
  { pattern: /\bready state\b/, label: "uses generic state-machine filler text" },
  { pattern: /\bcurrent mechanism\b/, label: "uses generic state-machine filler text" },
  { pattern: /\bchanged state\b/, label: "uses generic state-machine filler text" },
];

const RESPONSIVE_PATTERNS: RegExp[] = [
  /@media\s*\(/,
  /@container\s*\(/,
  /\bclamp\s*\(/,
  /\bminmax\s*\(/,
  /\bauto-fit\b|\bauto-fill\b/,
  /\bflexWrap\s*[:=]\s*["']wrap["']/,
  /\boverflowX\s*[:=]\s*["']auto["']/,
  /overflow-x\s*:\s*auto/,
  /\bmaxWidth\s*[:=]\s*["']100%["']/,
  /\bwidth\s*[:=]\s*["']100%["']/,
  /\boverflowWrap\b|\bwordBreak\b/,
  /whiteSpace\s*[:=]\s*["']pre-wrap["']/,
];

const FIXED_WIDTH_PATTERNS: RegExp[] = [
  /\bwidth\s*:\s*["']?([4-9]\d{2,}|[1-9]\d{3,})px["']?/,
  /\bminWidth\s*:\s*["']?([4-9]\d{2,}|[1-9]\d{3,})px["']?/,
  /width\s*:\s*["']([4-9]\d{2,}|[1-9]\d{3,})px["']/,
  /min-width\s*:\s*([4-9]\d{2,}|[1-9]\d{3,})px/,
];

export function validateArtifactSource(source: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const trimmed = source.trim();

  if (!/\bexport\s+default\s+function\b|\bexport\s+default\s+[A-Z]\w*\b/.test(trimmed)) {
    errors.push("artifact source must export a default React component");
  }

  if (trimmed.length < 650) {
    errors.push("artifact source is too small to be a manually authored bespoke interactive");
  }

  for (const { pattern, label } of REGISTERED_OR_TEMPLATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push(`artifact source is not bespoke: ${label}`);
    }
  }

  for (const pattern of FIXED_WIDTH_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      errors.push(`artifact source uses fixed desktop width ${match[1]}px; use responsive layout for 390px mobile`);
      break;
    }
  }

  const responsiveSignals = RESPONSIVE_PATTERNS.filter((pattern) => pattern.test(trimmed)).length;
  if (responsiveSignals < 2) {
    errors.push(
      "artifact source needs at least two explicit mobile-responsive layout signals, for example flexWrap, minmax(), clamp(), width/maxWidth 100%, overflow-x:auto, or text wrapping"
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateArtifactApprovalEvidence(opts: {
  qa_notes?: string | null;
  qa_snapshot_ref?: string | null;
  qa_screenshot_ref?: string | null;
}): { valid: boolean; errors: string[] } {
  const evidence = [opts.qa_notes, opts.qa_snapshot_ref, opts.qa_screenshot_ref]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const errors: string[] = [];

  if (!evidence.match(/\bdesktop\b|1280|1440/)) {
    errors.push("approval requires explicit desktop Chrome MCP QA evidence");
  }
  if (!evidence.match(/\bmobile\b|390px|390|phone/)) {
    errors.push("approval requires explicit 390px mobile Chrome MCP QA evidence");
  }
  if (!opts.qa_screenshot_ref || !opts.qa_screenshot_ref.toLowerCase().match(/desktop|mobile|390|1280|1440/)) {
    errors.push("approval requires qa_screenshot_ref containing desktop and mobile screenshot references");
  }
  if (!evidence.match(/\bbespoke\b|\bspecific\b|\bartifact\b/)) {
    errors.push("approval notes must state this is a bespoke lesson-specific artifact, not a reused template");
  }

  return { valid: errors.length === 0, errors };
}
