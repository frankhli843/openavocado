/**
 * GET /api/visual-artifacts/[slug]/sandbox
 *
 * APPROVAL GATE: Returns a full HTML page that loads and auto-renders the
 * compiled artifact bundle. Normally serves HTML only when:
 *   1. The artifact exists.
 *   2. build_status = 'qa_approved'.
 *   3. compiled_asset_path is set.
 *
 * QA PREVIEW: local-only reviewer automation may render pending artifacts with
 * ?qa=pending while build_status = 'pending_qa'. This lets Chrome MCP inspect
 * the exact compiled bundle before approval without exposing unapproved code
 * through public/prod hostnames.
 *
 * The main app wraps this in <iframe sandbox="allow-scripts allow-same-origin">
 * so Chrome MCP can inspect the rendered output during QA and live lessons.
 *
 * PostMessage protocol (parent ↔ sandbox):
 *   Parent → sandbox: { type: "SET_STATE", state: Record<string,number> }
 *   Sandbox → parent: { type: "STATE_CHANGE", state: { controls: Record<string,number> } }
 *   Sandbox → parent: { type: "READY" }           (component mounted)
 *   Sandbox → parent: { type: "ERROR", message }   (render error)
 *   Sandbox → parent: { type: "HEIGHT", height }   (auto-resize)
 */
import { NextResponse, type NextRequest } from "next/server";
import { getArtifactBySlug } from "@/lib/visual-artifacts/db";
import {
  canServeArtifactSandbox,
  hostnameFromRequestHost,
} from "@/lib/visual-artifacts/sandbox-access";

type Params = { slug: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const artifact = getArtifactBySlug(slug);

  if (!artifact) {
    return new NextResponse("Artifact not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const qaMode = req.nextUrl.searchParams.get("qa");
  const requestHostname =
    hostnameFromRequestHost(req.headers.get("host")) ?? req.nextUrl.hostname;
  if (!canServeArtifactSandbox({
    buildStatus: artifact.build_status,
    qaMode,
    hostname: requestHostname,
  })) {
    return new NextResponse(
      `Artifact "${slug}" is not approved for rendering (status: ${artifact.build_status}).`,
      { status: 403, headers: { "Content-Type": "text/plain" } }
    );
  }

  if (!artifact.compiled_asset_path) {
    return new NextResponse("Artifact has no compiled bundle.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // The bundle is served via the existing /runtime/ file route.
  // It's a self-contained IIFE that mounts itself into #root and manages
  // its own postMessage bridge (see src/lib/visual-artifacts/build.ts).
  const bundleUrl = `/runtime/${artifact.compiled_asset_path}`;
  const html = buildSandboxHtml(artifact.title, bundleUrl);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Artifact-QA-Preview": qaMode === "pending" ? "local-pending" : "approved",
      // No caching — approval status can change, and we want fresh content in Chrome MCP
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSandboxHtml(title: string, bundleUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow-x: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: transparent;
    }
    #root {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 0;
    }
    #root img, #root svg, #root canvas, #root video {
      max-width: 100%;
    }
    #root pre, #root code {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    #root table {
      max-width: 100%;
    }
    #root * {
      min-width: 0 !important;
      max-width: 100% !important;
      overflow-wrap: break-word;
    }
    @media (max-width: 430px) {
      body {
        font-size: 14px;
      }
      #root [style*="display: grid"],
      #root [style*="display:grid"] {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      #root [style*="display: flex"],
      #root [style*="display:flex"] {
        flex-wrap: wrap !important;
      }
      #root [style*="width:"],
      #root [style*="min-width"],
      #root [style*="minWidth"] {
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
    }
    #artifact-loading {
      padding: 16px;
      color: #6b7280;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div id="artifact-loading">Loading visualization…</div>
  </div>
  <!--
    The bundle is a self-contained IIFE that:
    - Includes React + ReactDOM + the artifact component
    - Mounts itself into #root
    - Sets up the postMessage bridge for parent↔sandbox state sync
    See src/lib/visual-artifacts/build.ts for the generated entry point.
  -->
  <script src="${bundleUrl.replace(/"/g, "&quot;")}"></script>
  <script>
    // Fallback error display if the bundle script fails to load
    window.addEventListener('error', function(evt) {
      var root = document.getElementById('root');
      if (root) {
        root.innerHTML =
          '<div style="color:#dc2626;padding:16px;font-family:monospace;font-size:12px;' +
          'background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;margin:16px">' +
          '<strong>Failed to load artifact bundle</strong><br/>' +
          (evt.message ? evt.message : 'Unknown error') + '</div>';
      }
      try { window.parent.postMessage({ type: 'ERROR', message: evt.message || 'Script load failed' }, '*'); } catch(_) {}
    }, true);
  </script>
</body>
</html>`;
}
