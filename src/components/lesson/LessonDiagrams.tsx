"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { LessonDiagram } from "@/lib/lesson-content/schema";
import { MermaidDiagram } from "./MermaidDiagram";

/**
 * Render the diagrams attached to a lesson part / reading section close to the
 * prose they support. Each diagram (authored Mermaid or attached/static image)
 * gets a fullscreen control. Fullscreen uses an app-level fixed overlay rather
 * than the browser Fullscreen API, which is unreliable in the routed Chrome
 * environment, so behavior is identical on mobile and desktop.
 */
export function LessonDiagramsView({ diagrams }: { diagrams: LessonDiagram[] }) {
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  if (!Array.isArray(diagrams) || diagrams.length === 0) return null;

  return (
    <div className="space-y-4">
      {diagrams.map((diagram, i) => (
        <DiagramCard key={i} diagram={diagram} onFullscreen={() => setFullscreenIndex(i)} />
      ))}
      {fullscreenIndex !== null && diagrams[fullscreenIndex] && (
        <DiagramFullscreenOverlay
          diagram={diagrams[fullscreenIndex]}
          onClose={() => setFullscreenIndex(null)}
        />
      )}
    </div>
  );
}

/** The inline (non-fullscreen) diagram card shown beside the lesson prose. */
function DiagramCard({
  diagram,
  onFullscreen,
}: {
  diagram: LessonDiagram;
  onFullscreen: () => void;
}) {
  return (
    <figure className="m-0 border-y border-gray-200 bg-white sm:rounded-xl sm:border">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-2 py-2.5 sm:gap-3 sm:px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Diagram</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
          {diagram.title}
        </span>
        <button
          type="button"
          onClick={onFullscreen}
          title="View fullscreen"
          aria-label={`View diagram fullscreen: ${diagram.title}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          Fullscreen
        </button>
      </div>
      <div className="overflow-x-auto px-1 py-3 sm:px-4 sm:py-4">
        <DiagramBody diagram={diagram} />
      </div>
      <DiagramMeta diagram={diagram} />
    </figure>
  );
}

/** Render the diagram itself (Mermaid SVG or a local static image). */
function DiagramBody({
  diagram,
  fullscreen = false,
}: {
  diagram: LessonDiagram;
  fullscreen?: boolean;
}) {
  if (diagram.kind === "mermaid") {
    return (
      <MermaidDiagram
        source={diagram.mermaid}
        title={diagram.title}
        className={
          fullscreen
            ? "[&>svg]:h-auto [&>svg]:w-[min(1100px,92vw)] [&>svg]:max-w-none"
            : "flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
        }
      />
    );
  }
  // static
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/runtime/${diagram.asset_path}`}
      alt={diagram.alt}
      loading="lazy"
      className={
        fullscreen
          ? "h-auto w-[min(1100px,92vw)] max-w-none select-none"
          : "mx-auto block h-auto max-w-full select-none"
      }
    />
  );
}

/** Caption / takeaway / source attribution shown beneath a diagram. */
function DiagramMeta({ diagram }: { diagram: LessonDiagram }) {
  const takeaway = diagram.kind === "mermaid" ? diagram.takeaway : diagram.takeaway;
  const showSource = diagram.kind === "static" && (diagram.source_url || diagram.license);
  if (!diagram.caption && !takeaway && !showSource) return null;
  return (
    <figcaption className="space-y-1 border-t border-gray-100 px-2 py-2.5 text-xs leading-relaxed text-gray-500 sm:px-4">
      {takeaway && (
        <p className="text-gray-600">
          <span className="font-semibold text-gray-700">Takeaway: </span>
          {takeaway}
        </p>
      )}
      {diagram.caption && <p>{diagram.caption}</p>}
      {showSource && diagram.kind === "static" && (
        <p className="text-gray-400">
          Source:{" "}
          {diagram.source_url ? (
            <a
              href={diagram.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {diagram.source_url}
            </a>
          ) : (
            "local asset"
          )}
          {diagram.license ? ` — ${diagram.license}` : ""}
        </p>
      )}
    </figcaption>
  );
}

/**
 * App-level fixed-overlay fullscreen for a single diagram. Supports zoom
 * (buttons) and pan/scroll (the content area scrolls and works with touch and
 * trackpad), closes on Escape or the close button, locks body scroll while open,
 * moves focus to the close control on open, restores focus on close, and uses
 * dynamic viewport height so the controls stay reachable on mobile.
 */
function DiagramFullscreenOverlay({
  diagram,
  onClose,
}: {
  diagram: LessonDiagram;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2))), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the control that opened the overlay.
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      style={{ height: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Fullscreen diagram: ${diagram.title}`}
    >
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
          {diagram.title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom out"
            aria-label="Zoom out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            title="Reset zoom"
            aria-label="Reset zoom"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom in"
            aria-label="Zoom in"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            title="Close fullscreen"
            aria-label="Close fullscreen diagram"
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Close
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4"
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div
          className="inline-block origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          <DiagramBody diagram={diagram} fullscreen />
        </div>
      </div>

      <DiagramMeta diagram={diagram} />
    </div>
  );
}
