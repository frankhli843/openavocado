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
  type WidgetSpec,
  type RegisteredWidgetSpec,
} from "@/lib/widgets/schema";
import { REGISTERED_WIDGETS } from "@/lib/widgets/registry";
import { DeclarativeWidget, type WidgetStateChange } from "./DeclarativeWidget";
import { SupplyDemandWidget } from "./SupplyDemandWidget";

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
        The lesson generator produced an interactive spec this version of Open Avocado cannot render safely.
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
