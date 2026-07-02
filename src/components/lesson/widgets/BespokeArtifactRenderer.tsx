"use client";

/**
 * Renders an approved bespoke visual artifact inside a sandboxed iframe.
 *
 * The artifact's compiled bundle is served by the approval-gated sandbox route
 * (/api/visual-artifacts/[slug]/sandbox), which only returns HTML for
 * qa_approved artifacts.
 *
 * State bridge: postMessage between the iframe (sandbox) and this component.
 *   iframe → parent: READY | STATE_CHANGE | HEIGHT | ERROR
 *   parent → iframe: SET_STATE
 *
 * The iframe uses sandbox="allow-scripts allow-same-origin" so:
 *   - Scripts execute (required for the React bundle)
 *   - Same-origin access allows Chrome MCP to inspect the iframe's DOM for QA
 *   - Popups, top-navigation, and form submission are blocked
 */
import { useEffect, useRef, useState } from "react";

type WidgetStateChange = { controls: Record<string, number> };

interface BespokeArtifactRendererProps {
  /** Artifact slug as stored in visual_artifacts.slug */
  artifactSlug: string;
  /** Initial widget state (control values) to sync into the iframe */
  initialState?: Record<string, number>;
  /** Called whenever the artifact's controls change */
  onStateChange?: (state: WidgetStateChange) => void;
  /** Minimum iframe height in pixels (default: 300) */
  minHeight?: number;
}

type SandboxMessage =
  | { type: "READY" }
  | { type: "STATE_CHANGE"; state: { controls: Record<string, number> } }
  | { type: "HEIGHT"; height: number }
  | { type: "ERROR"; message: string };

export function BespokeArtifactRenderer({
  artifactSlug,
  initialState,
  onStateChange,
  minHeight = 300,
}: BespokeArtifactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(minHeight);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sandboxUrl = `/api/visual-artifacts/${encodeURIComponent(artifactSlug)}/sandbox`;

  // Listen to messages from the iframe
  useEffect(() => {
    function handleMessage(evt: MessageEvent) {
      // Only accept messages from the same origin (the sandbox route is same-origin)
      if (evt.source !== iframeRef.current?.contentWindow) return;
      const msg = evt.data as SandboxMessage;
      if (!msg?.type) return;

      switch (msg.type) {
        case "READY":
          setIsReady(true);
          // Push initial state into the iframe after it's ready
          if (initialState && Object.keys(initialState).length > 0) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: "SET_STATE", state: initialState },
              "*"
            );
          }
          break;
        case "STATE_CHANGE":
          onStateChange?.(msg.state);
          break;
        case "HEIGHT":
          if (typeof msg.height === "number" && msg.height > 0) {
            setIframeHeight(Math.max(minHeight, msg.height + 32));
          }
          break;
        case "ERROR":
          setError(msg.message);
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [initialState, onStateChange, minHeight]);

  useEffect(() => {
    if (!isReady || !initialState) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "SET_STATE", state: initialState },
      "*"
    );
  }, [isReady, initialState]);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800"
      >
        <div className="font-semibold mb-1">Visualization rendering error</div>
        <p className="text-red-700 text-xs font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ minHeight }}>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Loading visualization…
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={sandboxUrl}
        title={`Visual artifact: ${artifactSlug}`}
        // allow-same-origin needed for Chrome MCP inspection during QA
        sandbox="allow-scripts allow-same-origin"
        className="w-full border-0"
        style={{
          height: iframeHeight,
          opacity: isReady ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
        onError={() => setError("Failed to load artifact sandbox page.")}
      />
    </div>
  );
}
