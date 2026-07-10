"use client";

/**
 * Renders an approved bespoke visual artifact inside a sandboxed iframe.
 *
 * The artifact's compiled bundle is served by the approval-gated sandbox route
 * (/api/visual-artifacts/[slug]/sandbox), which only returns HTML for
 * qa_approved artifacts.
 *
 * GRACEFUL DEGRADATION: many generated lessons author an audio-synced cue
 * timeline that references bespoke artifact slugs before those artifacts have
 * been generated/built/approved. In that case the sandbox route returns
 * 403/404 and the iframe never sends READY. Rather than showing a hard red
 * error after a 7s timeout, this component first probes the artifact metadata
 * (GET /api/visual-artifacts/[slug]); when the artifact is missing or not yet
 * qa_approved it renders the caller-supplied `fallback` (authored scene
 * content) or a neutral "being prepared" note. The iframe (and its READY /
 * timeout / ERROR handling) only mounts once the artifact is confirmed
 * approved, so approved artifacts render exactly as before.
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
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  /**
   * Rendered when the artifact is missing or not yet QA-approved (i.e. the
   * live sandbox route would return 403/404). Lets the caller degrade
   * gracefully to authored scene content instead of showing a hard error.
   * When omitted a neutral "visualization is being prepared" note is shown.
   */
  fallback?: ReactNode;
}

type Availability = "checking" | "available" | "unavailable";

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
  fallback,
}: BespokeArtifactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(minHeight);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "checking" until the metadata probe resolves; "available" only when the
  // artifact exists AND is qa_approved (what the live sandbox route serves).
  const [availability, setAvailability] = useState<Availability>("checking");

  const sandboxUrl = `/api/visual-artifacts/${encodeURIComponent(artifactSlug)}/sandbox`;

  // Probe artifact availability before mounting the iframe. Missing or
  // unapproved slugs degrade to the fallback instead of a 7s red error.
  useEffect(() => {
    let cancelled = false;
    setAvailability("checking");
    (async () => {
      try {
        const res = await fetch(
          `/api/visual-artifacts/${encodeURIComponent(artifactSlug)}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) {
          setAvailability("unavailable");
          return;
        }
        const json = (await res.json()) as { artifact?: { build_status?: string } };
        if (cancelled) return;
        setAvailability(
          json.artifact?.build_status === "qa_approved" ? "available" : "unavailable"
        );
      } catch {
        if (!cancelled) setAvailability("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifactSlug]);

  useEffect(() => {
    setIsReady(false);
    setError(null);
    setIframeHeight(minHeight);
  }, [artifactSlug, minHeight]);

  useEffect(() => {
    // Only arm the load-timeout once we've confirmed the artifact should render.
    if (availability !== "available" || isReady || error) return;
    const timer = window.setTimeout(() => {
      setError(`Artifact "${artifactSlug}" did not finish loading. Check that it is QA approved, compiled, and sending READY from the sandbox.`);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [artifactSlug, availability, isReady, error]);

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
          setError(null);
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

  // Artifact not yet available (missing / not qa_approved): degrade gracefully.
  if (availability === "unavailable") {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
        The interactive visualization for this segment is being prepared. Follow the
        audio and the narration steps above in the meantime.
      </div>
    );
  }

  // Still probing availability: reserve space quietly, no scary error.
  if (availability === "checking") {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg text-sm text-gray-400"
        style={{ minHeight }}
      >
        Loading visualization…
      </div>
    );
  }

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
    <div className="relative w-full min-w-0 max-w-full overflow-hidden" style={{ minHeight }}>
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
        className="block w-full max-w-full border-0"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          height: iframeHeight,
          opacity: isReady ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
        onError={() => setError("Failed to load artifact sandbox page.")}
      />
    </div>
  );
}
