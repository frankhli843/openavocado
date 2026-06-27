"use client";

/**
 * Resolves a validated WidgetSpec to a concrete renderer.
 *
 * - `declarative` -> DeclarativeWidget (data-driven, sandboxed formulas)
 * - registered types -> their reviewed component (e.g. supply-demand)
 * - anything unsupported -> a clear, non-misleading "unsupported widget" state
 *
 * Bad/malformed specs never silently pretend to work; they surface the
 * validation errors so a broken lesson is obvious.
 */
import { useMemo } from "react";
import {
  validateWidgetSpec,
  isDeclarativeSpec,
  isBespokeArtifactSpec,
  type WidgetSpec,
  type RegisteredWidgetSpec,
} from "@/lib/widgets/schema";
import { REGISTERED_WIDGETS } from "@/lib/widgets/registry";
import { DeclarativeWidget, type WidgetStateChange } from "./DeclarativeWidget";
import { ImagePreprocessingPipelineWidget } from "./ImagePreprocessingPipelineWidget";
import { KvCacheGenerationWidget } from "./KvCacheGenerationWidget";
import { LlmLifecycleWidget } from "./LlmLifecycleWidget";
import { EmbeddingMatrixLookupWidget } from "./EmbeddingMatrixLookupWidget";
import { BayesBaseRateLabWidget } from "./BayesBaseRateLabWidget";
import { TransformerLogitsLabWidget } from "./TransformerLogitsLabWidget";
import { GcpAwsMapLabWidget } from "./GcpAwsMapLabWidget";
import { SupplyDemandWidget } from "./SupplyDemandWidget";
import { BespokeArtifactRenderer } from "./BespokeArtifactRenderer";

const KNOWN_TYPES = REGISTERED_WIDGETS.map((w) => w.type);

export function WidgetHost({
  spec,
  initialState,
  onStateChange,
}: {
  spec: unknown;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const validation = useMemo(() => validateWidgetSpec(spec, KNOWN_TYPES), [spec]);

  if (!validation.valid) {
    return <UnsupportedWidget errors={validation.errors} unsupported={validation.unsupported} />;
  }

  const widget = spec as WidgetSpec;

  if (isDeclarativeSpec(widget)) {
    return <DeclarativeWidget spec={widget} initialState={initialState} onStateChange={onStateChange} />;
  }

  if (isBespokeArtifactSpec(widget)) {
    return (
      <BespokeArtifactRenderer
        artifactSlug={widget.params.artifact_slug}
        initialState={initialState}
        onStateChange={onStateChange}
        minHeight={widget.params.min_height}
      />
    );
  }

  const registered = widget as RegisteredWidgetSpec;
  switch (registered.widget_type) {
    case "supply-demand":
      return (
        <SupplyDemandWidget
          params={registered.params as Record<string, number> | undefined}
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "image-preprocessing-pipeline":
      return (
        <ImagePreprocessingPipelineWidget
          params={registered.params as { focus?: "resize" | "rescale" | "normalize" | "permute" | "batch" } | undefined}
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "kv-cache-generation":
      return (
        <KvCacheGenerationWidget
          params={registered.params as { focus?: "loop" | "cache" | "context" } | undefined}
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "llm-lifecycle":
      return (
        <LlmLifecycleWidget
          params={registered.params as { focus?: "roadmap" | "storage" | "tokenization" } | undefined}
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "embedding-matrix-lookup":
      return (
        <EmbeddingMatrixLookupWidget
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "bayes-base-rate-lab":
      return (
        <BayesBaseRateLabWidget
          params={registered.params as { focus?: "prior" | "test" | "posterior" } | undefined}
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "transformer-logits-lab":
      return (
        <TransformerLogitsLabWidget
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    case "gcp-aws-map-lab":
      return (
        <GcpAwsMapLabWidget
          params={registered.params as { focus?: "hierarchy" | "compute" | "data" | "iam" } | undefined}
          initialState={initialState}
          onStateChange={onStateChange}
        />
      );
    default:
      // Type passed validation's knownTypes list but has no renderer wired.
      return <UnsupportedWidget errors={[`No renderer registered for "${registered.widget_type}"`]} unsupported />;
  }
}

function UnsupportedWidget({ errors, unsupported }: { errors: string[]; unsupported?: boolean }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800"
    >
      <div className="font-semibold mb-1 flex items-center gap-2">
        <span aria-hidden="true">&#9888;</span>
        {unsupported ? "Unsupported interactive widget" : "This interactive widget could not be loaded"}
      </div>
      <p className="text-amber-700 mb-2">
        The lesson generator produced an interactive spec this version of AvocadoCore cannot render safely.
        The rest of the lesson still works.
      </p>
      <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-700">
        {errors.slice(0, 6).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
