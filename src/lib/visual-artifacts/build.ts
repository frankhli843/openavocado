/**
 * Build pipeline for bespoke React visual artifacts.
 *
 * Takes a proposed TSX component + manifest, validates imports against the
 * allowlist, compiles with esbuild to a self-contained IIFE bundle, and
 * writes the result to runtime_artifacts/visual-artifacts/<slug>/<hash>/bundle.js.
 *
 * The bundle auto-renders the component into #root and sets up the
 * postMessage state bridge, so the sandbox HTML just loads the script.
 *
 * SAFETY:
 * - Only allowed imports from the manifest are permitted.
 * - Network and storage APIs are blocked at the iframe sandbox level.
 * - The compiled bundle is only served when qa_status = 'qa_approved'.
 */

import * as esbuild from "esbuild";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ArtifactManifest, BuildResult } from "./types";
import { findBlockedImports } from "./manifest";
import { validateArtifactSource } from "./source-validation";
import { resolveRuntimeFile } from "../audio/runtime-storage";

/**
 * Runtime artifacts base directory.
 * Resolved relative to process.cwd() so it works in Next.js dev and production.
 */
function getRuntimeArtifactsDir(): string {
  const root = resolveRuntimeFile("runtime_artifacts");
  if (!root) {
    throw new Error("Unable to resolve runtime_artifacts root");
  }
  return root;
}

/** Directory where compiled artifact bundles are stored. */
export function getArtifactsDir(): string {
  return path.join(getRuntimeArtifactsDir(), "visual-artifacts");
}

/**
 * Relative path (from project root) for a compiled bundle.
 * Must start with `runtime_artifacts/` so the /runtime/[...path] route can serve it.
 */
export function compiledAssetPath(slug: string, sourceHash: string): string {
  return `runtime_artifacts/visual-artifacts/${slug}/${sourceHash}/bundle.js`;
}

/** Absolute path to a compiled bundle. */
export function compiledAssetAbsPath(slug: string, sourceHash: string): string {
  const abs = resolveRuntimeFile(compiledAssetPath(slug, sourceHash));
  if (!abs) {
    throw new Error(`Unable to resolve compiled visual artifact path for ${slug}`);
  }
  return abs;
}

/** SHA-256 hex digest of a string. */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Generate the entry file that wraps the user component in a self-rendering bundle.
 *
 * The bundle:
 * - Imports the user's component (from the source file path)
 * - Sets up the postMessage state bridge
 * - Auto-renders into #root via React 19 createRoot
 *
 * PostMessage protocol:
 *   Parent → sandbox: { type: "SET_STATE", state: Record<string,number> }
 *   Sandbox → parent: { type: "STATE_CHANGE", state: { controls: Record<string,number> } }
 *   Sandbox → parent: { type: "READY" }      (component mounted)
 *   Sandbox → parent: { type: "ERROR", message: string }
 *   Sandbox → parent: { type: "HEIGHT", height: number }
 */
function buildEntrySource(componentFilePath: string): string {
  // Use forward slashes for import paths (required on Windows too by esbuild)
  const importPath = componentFilePath.replace(/\\/g, "/");
  return `
import React from "react";
import ReactDOM from "react-dom/client";
import ArtifactComponent from "${importPath}";

// ─── postMessage bridge ───────────────────────────────────────────────────────
type StateMap = Record<string, number>;
let _externalSetState: ((s: StateMap) => void) | null = null;

function sendToParent(msg: object): void {
  try { window.parent?.postMessage(msg, "*"); } catch (_) {}
}

window.addEventListener("message", (evt: MessageEvent) => {
  if (evt.data?.type === "SET_STATE" && _externalSetState) {
    _externalSetState(evt.data.state ?? {});
  }
});

// ─── Wrapper component ────────────────────────────────────────────────────────
function ArtifactWrapper() {
  const [state, setStateInternal] = React.useState<StateMap>({});
  _externalSetState = setStateInternal;

  React.useEffect(() => {
    sendToParent({ type: "READY" });
    // Initial height
    const root = document.getElementById("root");
    if (root) sendToParent({ type: "HEIGHT", height: root.scrollHeight });
  }, []);

  // Keep parent in sync with height changes
  React.useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const ro = new ResizeObserver(() => {
      sendToParent({ type: "HEIGHT", height: root.scrollHeight });
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  function handleStateChange(change: { controls?: StateMap }) {
    if (change?.controls) {
      const next = { ...state, ...change.controls };
      setStateInternal(next);
      sendToParent({ type: "STATE_CHANGE", state: { controls: next } });
    }
  }

  return (
    <ArtifactComponent
      params={{}}
      initialState={state}
      onStateChange={handleStateChange}
    />
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────
const rootEl = document.getElementById("root");
if (rootEl) {
  try {
    ReactDOM.createRoot(rootEl).render(<ArtifactWrapper />);
  } catch (err) {
    sendToParent({ type: "ERROR", message: String(err) });
    rootEl.innerHTML =
      '<div style="color:#dc2626;padding:12px;font-family:monospace;font-size:12px">' +
      "Render error: " + String(err) + "</div>";
  }
} else {
  sendToParent({ type: "ERROR", message: "No #root element found in sandbox HTML." });
}
`;
}

/**
 * Compile a TSX artifact to a self-contained IIFE bundle.
 *
 * The user's TSX must export a default React component accepting:
 *   { params?: object, initialState?: Record<string,number>, onStateChange?: (c) => void }
 *
 * @param slug       Stable identifier (used in output directory name)
 * @param source     TSX source code
 * @param manifest   Validated manifest (allowed_imports enforced here)
 * @returns BuildResult with ok=true and compiled_asset_path, or ok=false with error
 */
export async function buildArtifact(
  slug: string,
  source: string,
  manifest: ArtifactManifest
): Promise<BuildResult> {
  const sourceValidation = validateArtifactSource(source);
  if (!sourceValidation.valid) {
    return {
      ok: false,
      error: `Artifact source failed validation: ${sourceValidation.errors.join("; ")}`,
    };
  }

  // 1. Pre-flight: check for blocked imports before invoking esbuild
  const blocked = findBlockedImports(source, manifest.allowed_imports);
  if (blocked.length > 0) {
    return {
      ok: false,
      error: `Blocked imports detected: ${blocked.join(", ")}. Add them to the manifest allowlist or remove them from source.`,
    };
  }

  const sourceHash = sha256(source);
  const outFile = compiledAssetAbsPath(slug, sourceHash);

  // 2. Already compiled? Return cached path (hash is deterministic)
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
    const compiledContent = fs.readFileSync(outFile, "utf-8");
    const compiledHash = sha256(compiledContent);
    return {
      ok: true,
      compiled_asset_path: compiledAssetPath(slug, sourceHash),
      compiled_asset_hash: compiledHash,
      build_log: "Using cached compiled bundle (source hash matched).",
    };
  }

  // 3. Write source and entry wrapper to temp files for esbuild
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avocado-artifact-"));
  const componentFile = path.join(tmpDir, "component.tsx");
  const entryFile = path.join(tmpDir, "entry.tsx");

  fs.writeFileSync(componentFile, source, "utf-8");
  fs.writeFileSync(entryFile, buildEntrySource(componentFile), "utf-8");

  // 4. Ensure output directory exists
  const outDir = path.dirname(outFile);
  fs.mkdirSync(outDir, { recursive: true });

  const logs: string[] = [];

  try {
    // 5. Build with esbuild: IIFE format, all deps bundled (self-contained)
    const result = await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      format: "iife",
      // Bundle all deps including React and react-dom (self-contained)
      external: [],
      platform: "browser",
      jsx: "automatic",
      jsxImportSource: "react",
      outfile: outFile,
      minify: false,
      logLevel: "silent",
      // Resolve node_modules from the project root
      nodePaths: [path.join(process.cwd(), "node_modules")],
    });

    for (const warning of result.warnings) {
      logs.push(`WARNING: ${warning.text}`);
    }

    // 6. Verify the output was written
    if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
      return { ok: false, error: "esbuild reported success but output file missing or empty." };
    }

    const compiledContent = fs.readFileSync(outFile, "utf-8");
    const compiledHash = sha256(compiledContent);

    logs.push(`Bundle size: ${compiledContent.length} bytes`);

    return {
      ok: true,
      compiled_asset_path: compiledAssetPath(slug, sourceHash),
      compiled_asset_hash: compiledHash,
      build_log: logs.join("\n") || undefined,
    };
  } catch (err: unknown) {
    // esbuild throws { message, errors[] } on failure
    const esbuildErr = err as { errors?: Array<{ text: string }>; message?: string };
    const errors = esbuildErr.errors ?? [];
    const errorLines = errors.length > 0
      ? errors.map((e) => e.text).join("\n")
      : (esbuildErr.message ?? String(err));
    return {
      ok: false,
      error: errorLines,
      build_log: logs.join("\n") || undefined,
    };
  } finally {
    // Clean up temp directory
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
