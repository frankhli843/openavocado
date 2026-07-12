"use client";

/**
 * Resolves a validated WidgetSpec to a concrete renderer.
 *
 * AvocadoCore interactive components are DB-backed bespoke artifacts only.
 * Registered widgets and declarative specs were removed from the runtime path
 * because they encourage reusable templates instead of lesson-specific code.
 *
 * Bad/malformed specs never silently pretend to work; they surface the
 * validation errors so a broken lesson is obvious.
 */
import { useMemo } from "react";
import {
  validateWidgetSpec,
  isBespokeArtifactSpec,
  type WidgetSpec,
} from "@/lib/widgets/schema";
import { BespokeArtifactRenderer } from "./BespokeArtifactRenderer";

export type WidgetStateChange = { controls: Record<string, number> };

export function WidgetHost({
  spec,
  initialState,
  onStateChange,
}: {
  spec: unknown;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const validation = useMemo(() => validateWidgetSpec(spec, []), [spec]);

  if (!validation.valid) {
    return <UnsupportedWidget errors={validation.errors} unsupported={validation.unsupported} />;
  }

  const widget = spec as WidgetSpec;

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

  return (
    <UnsupportedWidget
      unsupported
      errors={[
        'Avo interactives must use widget_type:"bespoke-artifact" with params.artifact_slug.',
        "Registered widgets and declarative specs are no longer rendered because they are precreated template components.",
      ]}
    />
  );
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
        AvocadoCore only renders approved DB-backed bespoke visual artifacts. Regenerate or backfill this lesson
        with an approved visual_artifacts slug.
      </p>
      <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-700">
        {errors.slice(0, 6).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
