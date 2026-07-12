"use client";

/**
 * Accessible, mobile-first control primitives shared by interactive widgets.
 * Every control has a visible label, a keyboard-operable input, and a focus ring.
 */
import type { SliderControl, ToggleControl, SegmentedControl } from "@/lib/widgets/schema";
import { formatValue } from "@/lib/widgets/schema";

export function Slider({
  control,
  value,
  onChange,
}: {
  control: SliderControl;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = control.step ?? 1;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={`ctl-${control.id}`} className="text-sm font-medium text-gray-700">
          {control.label}
        </label>
        <span className="text-sm font-semibold text-blue-600 tabular-nums">
          {formatValue(value, control.format, control.format === "integer" ? 0 : undefined)}
          {control.unit ? ` ${control.unit}` : ""}
        </span>
      </div>
      <input
        id={`ctl-${control.id}`}
        type="range"
        min={control.min}
        max={control.max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded"
        aria-valuemin={control.min}
        aria-valuemax={control.max}
        aria-valuenow={value}
      />
      <div className="flex justify-between text-[11px] text-gray-400 mt-0.5 tabular-nums">
        <span>{control.min}{control.unit ? ` ${control.unit}` : ""}</span>
        <span>{control.max}{control.unit ? ` ${control.unit}` : ""}</span>
      </div>
    </div>
  );
}

export function Toggle({
  control,
  value,
  onChange,
}: {
  control: ToggleControl;
  value: number;
  onChange: (v: number) => void;
}) {
  const on = value >= 0.5;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700">{control.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={control.label}
        onClick={() => onChange(on ? 0 : 1)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 ${
          on ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-xs text-gray-400 w-16 text-right">
        {on ? control.onLabel ?? "On" : control.offLabel ?? "Off"}
      </span>
    </div>
  );
}

export function Segmented({
  control,
  value,
  onChange,
}: {
  control: SegmentedControl;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-1.5">{control.label}</div>
      <div
        role="radiogroup"
        aria-label={control.label}
        className="inline-flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg"
      >
        {control.options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                selected
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
