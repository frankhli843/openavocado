"use client";

import { useEffect, useId, useRef, useState } from "react";

interface MermaidDiagramProps {
  /** Raw Mermaid source. */
  source: string;
  /** Accessible title for the rendered diagram. */
  title?: string;
  /** Extra classes for the rendered SVG wrapper. */
  className?: string;
}

/**
 * Render a Mermaid diagram safely inside a Next.js client component.
 *
 * Mermaid touches `document`, so it is imported dynamically inside an effect and
 * never runs during SSR. Rendering uses `securityLevel: "strict"` (Mermaid
 * sanitizes its own SVG via DOMPurify) so generator-supplied source can never
 * inject active markup. A syntax error fails loudly: instead of silently
 * disappearing, the component shows a clear author-facing error state with the
 * parser message and the offending source, and logs to the console. This keeps
 * broken diagrams visible in development, test, and the live lesson UI.
 */
export function MermaidDiagram({ source, title, className }: MermaidDiagramProps) {
  const rawId = useId();
  // Mermaid ids must be valid CSS/DOM ids — strip React's ":" separators.
  const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function render() {
      const trimmed = (source ?? "").trim();
      if (!trimmed) {
        if (!cancelled) {
          setSvg(null);
          setError("Diagram source is empty.");
        }
        return;
      }
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          suppressErrorRendering: true,
          fontFamily: "inherit",
        });
        const { svg: rendered } = await mermaid.render(renderId, trimmed);
        if (!cancelled && mountedRef.current) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(`[MermaidDiagram] failed to render "${title ?? renderId}": ${message}`);
        if (!cancelled && mountedRef.current) {
          setSvg(null);
          setError(message);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [source, renderId, title]);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <div className="font-semibold mb-1">Diagram failed to render</div>
        <p className="text-xs text-red-700 mb-2">{error}</p>
        <pre className="overflow-x-auto rounded bg-red-100/60 p-2 text-[11px] leading-relaxed text-red-900 whitespace-pre-wrap">
          {source}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-xs text-gray-400">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title ? `Diagram: ${title}` : "Diagram"}
      className={className}
      // Mermaid sanitizes its SVG output at securityLevel "strict".
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
