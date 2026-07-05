// Out-of-process artifact builder. The long-running `next start` server's
// in-memory esbuild service has died ("service is no longer running"), so we
// compile the bundle here in a fresh process and drop it at the exact
// hash-addressed cache path the server's buildArtifact() reads before invoking
// esbuild. The server then returns the cached bundle without touching its dead
// esbuild instance. Mirrors src/lib/visual-artifacts/build.ts byte-for-byte on
// the paths/hashing so the cache lookup hits.
import * as esbuild from "esbuild";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  console.error("usage: node build-standalone.mjs <slug> [<slug>...]");
  process.exit(1);
}

const db = new Database(path.join(ROOT, "data", "avocadocore.db"), { readonly: true });
const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

function buildEntrySource(componentFilePath) {
  const importPath = componentFilePath.replace(/\\/g, "/");
  return `
import React from "react";
import ReactDOM from "react-dom/client";
import ArtifactComponent from "${importPath}";

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

function ArtifactWrapper() {
  const [state, setStateInternal] = React.useState<StateMap>({});
  _externalSetState = setStateInternal;

  React.useEffect(() => {
    sendToParent({ type: "READY" });
    const root = document.getElementById("root");
    if (root) sendToParent({ type: "HEIGHT", height: root.scrollHeight });
  }, []);

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

for (const slug of slugs) {
  const row = db.prepare("SELECT source_react FROM visual_artifacts WHERE slug = ?").get(slug);
  if (!row) { console.error(`[${slug}] not found in DB`); continue; }
  const source = row.source_react;
  const sourceHash = sha256(source);
  const outFile = path.join(ROOT, "runtime_artifacts", "visual-artifacts", slug, sourceHash, "bundle.js");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avocado-artifact-"));
  const componentFile = path.join(tmpDir, "component.tsx");
  const entryFile = path.join(tmpDir, "entry.tsx");
  fs.writeFileSync(componentFile, source, "utf-8");
  fs.writeFileSync(entryFile, buildEntrySource(componentFile), "utf-8");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  try {
    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      format: "iife",
      external: [],
      platform: "browser",
      jsx: "automatic",
      jsxImportSource: "react",
      outfile: outFile,
      minify: false,
      logLevel: "silent",
      nodePaths: [path.join(ROOT, "node_modules")],
    });
    const size = fs.statSync(outFile).size;
    console.log(`[${slug}] built -> ${path.relative(ROOT, outFile)} (${size} bytes)`);
  } catch (err) {
    const e = err;
    const lines = (e.errors ?? []).map((x) => x.text).join("\n") || e.message || String(err);
    console.error(`[${slug}] BUILD FAILED: ${lines}`);
  }
}
db.close();
