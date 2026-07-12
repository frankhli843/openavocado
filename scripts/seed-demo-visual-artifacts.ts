#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import {
  approveArtifact,
  createArtifact,
  getArtifactBySlug,
  markBuildFailed,
  markBuilding,
  markBuildSuccess,
  updateSource,
} from "../src/lib/visual-artifacts/db";
import { buildArtifact, sha256 } from "../src/lib/visual-artifacts/build";

interface Stage {
  label: string;
  value: string;
  detail: string;
}

interface DemoArtifact {
  slug: string;
  title: string;
  accent: string;
  dark: string;
  metaphor: string;
  stages: Stage[];
}

const DEMO_ARTIFACTS: DemoArtifact[] = [
  {
    slug: "demo-token-embedding-flow",
    title: "Token IDs to Embedding Rows",
    accent: "#16a34a",
    dark: "#064e3b",
    metaphor: "lookup table",
    stages: [
      { label: "Raw text", value: "the cat sat", detail: "Text is still a human-facing string." },
      { label: "Token IDs", value: "[1, 2, 3]", detail: "The vocabulary turns pieces into integer row keys." },
      { label: "Embedding rows", value: "3 x D matrix", detail: "Each ID selects one learned vector row." },
      { label: "Transformer input", value: "positions + rows", detail: "The block receives a numeric sequence, not words." },
    ],
  },
  {
    slug: "demo-sequence-cost-bars",
    title: "Sequence Length Cost",
    accent: "#0ea5e9",
    dark: "#0c4a6e",
    metaphor: "cost meter",
    stages: [
      { label: "4 tokens", value: "short prompt", detail: "A small prompt makes a short input matrix." },
      { label: "16 tokens", value: "4x rows", detail: "More tokens mean more rows for every layer." },
      { label: "Attention pairs", value: "rows interact", detail: "Attention work grows because positions compare with positions." },
      { label: "Cache footprint", value: "memory rises", detail: "Serving must keep more key/value rows around." },
    ],
  },
  {
    slug: "demo-logits-softmax-shift",
    title: "Context Changes the Distribution",
    accent: "#f97316",
    dark: "#7c2d12",
    metaphor: "probability mixer",
    stages: [
      { label: "Hidden state", value: "context vector", detail: "The transformer summarizes what the prompt currently implies." },
      { label: "Logits", value: "raw token scores", detail: "The output head gives each vocabulary token a score." },
      { label: "Softmax", value: "probabilities", detail: "Scores become a distribution whose bars sum to one." },
      { label: "Chosen token", value: "append and repeat", detail: "Generation adds a token, then rescoring starts again." },
    ],
  },
  {
    slug: "demo-generation-loop",
    title: "Append Token and Repeat",
    accent: "#8b5cf6",
    dark: "#4c1d95",
    metaphor: "generation loop",
    stages: [
      { label: "Prompt", value: "the cat", detail: "The current context sets the next-token question." },
      { label: "Distribution", value: "sat: 0.81", detail: "The model compares candidate continuations." },
      { label: "Append", value: "the cat sat", detail: "The chosen token joins the context." },
      { label: "Next step", value: "score again", detail: "The same mechanism predicts the following token." },
    ],
  },
  {
    slug: "demo-kv-cache-growth",
    title: "Prompt Tokens, New Tokens, and Cache Growth",
    accent: "#dc2626",
    dark: "#7f1d1d",
    metaphor: "cache table",
    stages: [
      { label: "Prefill rows", value: "prompt tokens", detail: "The prompt creates key/value rows across layers." },
      { label: "Decode token", value: "+1 row", detail: "Each generated token appends a new cache row." },
      { label: "Reuse", value: "no full replay", detail: "Decode attends to stored rows instead of recomputing the prompt." },
      { label: "Memory", value: "rows x layers", detail: "Longer context keeps more cache rows resident." },
    ],
  },
  {
    slug: "demo-prefill-decode-timeline",
    title: "Prefill vs Decode Timeline",
    accent: "#0891b2",
    dark: "#164e63",
    metaphor: "serving timeline",
    stages: [
      { label: "Prefill", value: "one wide pass", detail: "All prompt positions run through the model once." },
      { label: "Cache ready", value: "K/V stored", detail: "Every layer now has reusable attention state." },
      { label: "Decode", value: "one token at a time", detail: "Each step predicts and appends a single token." },
      { label: "Stop", value: "answer returned", detail: "The loop ends when the stop condition is met." },
    ],
  },
];

function artifactSource(spec: DemoArtifact): string {
  return `import React from "react";

type Props = {
  initialState?: Record<string, number>;
  onStateChange?: (change: { controls: Record<string, number> }) => void;
};

const artifact = ${JSON.stringify(spec, null, 2)} as const;

export default function ArtifactComponent({ initialState = {}, onStateChange }: Props) {
  const active = Math.max(0, Math.min(artifact.stages.length - 1, Math.round(initialState.stage ?? 0)));
  const stage = artifact.stages[active];
  const setActive = (value: number) => onStateChange?.({ controls: { stage: value } });

  return (
    <div style={{
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      color: "#172033",
      background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
      border: "1px solid #d9e2ef",
      borderRadius: 14,
      padding: 16,
      maxWidth: 860,
      margin: "0 auto",
      boxSizing: "border-box"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: artifact.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
            Generated bespoke visual
          </div>
          <h2 style={{ margin: "4px 0 4px", fontSize: 22, lineHeight: 1.15, color: artifact.dark }}>{artifact.title}</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>{artifact.metaphor}</p>
        </div>
        <div style={{ minWidth: 118, border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#fff" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Stage</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: artifact.dark }}>{active + 1}/{artifact.stages.length}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 8, marginTop: 14 }}>
        {artifact.stages.map((item, index) => (
          <button
            key={item.label}
            onClick={() => setActive(index)}
            style={{
              appearance: "none",
              border: index === active ? "2px solid " + artifact.accent : "1px solid #d6dee8",
              background: index === active ? "#f0fdfa" : "#ffffff",
              borderRadius: 10,
              padding: "10px 8px",
              minHeight: 76,
              textAlign: "left",
              cursor: "pointer"
            }}
          >
            <div style={{ fontSize: 12, color: index === active ? artifact.dark : "#64748b", fontWeight: 800 }}>{item.label}</div>
            <div style={{ marginTop: 4, fontSize: 15, color: "#0f172a", fontWeight: 750, overflowWrap: "anywhere" }}>{item.value}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(180px, 0.8fr)", gap: 12, marginTop: 14 }}>
        <div style={{ border: "1px solid #dbe4ef", borderRadius: 12, padding: 14, background: "#ffffff", minHeight: 150 }}>
          <div style={{ height: 14, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ height: "100%", width: ((active + 1) / artifact.stages.length) * 100 + "%", background: artifact.accent, transition: "width 220ms ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            {artifact.stages.map((item, index) => (
              <div key={item.label + "-bar"} style={{
                height: 36 + index * 16,
                alignSelf: "end",
                borderRadius: 8,
                background: index <= active ? artifact.accent : "#cbd5e1",
                opacity: index === active ? 1 : 0.55,
                transition: "all 220ms ease"
              }} />
            ))}
          </div>
        </div>
        <div style={{ border: "1px solid #dbe4ef", borderRadius: 12, padding: 14, background: "#ffffff" }}>
          <div style={{ fontSize: 13, color: artifact.accent, fontWeight: 800 }}>{stage.label}</div>
          <div style={{ marginTop: 4, fontSize: 24, lineHeight: 1.05, color: artifact.dark, fontWeight: 850, overflowWrap: "anywhere" }}>{stage.value}</div>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.35, color: "#475569" }}>{stage.detail}</p>
        </div>
      </div>

      <input
        aria-label="Select visual stage"
        type="range"
        min={0}
        max={artifact.stages.length - 1}
        value={active}
        onChange={(event) => setActive(Number(event.currentTarget.value))}
        style={{ width: "100%", marginTop: 14, accentColor: artifact.accent }}
      />
    </div>
  );
}
`;
}

function compiledFileExists(compiledPath: string | null): boolean {
  return Boolean(compiledPath && fs.existsSync(path.join(process.cwd(), compiledPath)));
}

async function seedOne(spec: DemoArtifact): Promise<string> {
  const source = artifactSource(spec);
  const existing = getArtifactBySlug(spec.slug);
  const sourceHash = sha256(source);

  if (existing && existing.source_hash === sourceHash && existing.build_status === "qa_approved" && compiledFileExists(existing.compiled_asset_path)) {
    return `${spec.slug}: already approved`;
  }

  if (!existing) {
    createArtifact({ slug: spec.slug, title: spec.title, source_react: source });
  } else if (existing.source_hash !== sourceHash) {
    updateSource(spec.slug, source);
  }

  markBuilding(spec.slug);
  const result = await buildArtifact(spec.slug, source, { allowed_imports: ["react"] });
  if (!result.ok) {
    markBuildFailed(spec.slug, result);
    throw new Error(`${spec.slug} build failed: ${result.error ?? "unknown error"}`);
  }

  markBuildSuccess(spec.slug, result);
  approveArtifact(spec.slug, {
    qa_notes: "Seeded demo artifact. Source is deterministic and bundled through the production sandbox build pipeline.",
    approved_by: "demo-seed",
  });

  return `${spec.slug}: built and approved`;
}

async function main() {
  const results: string[] = [];
  for (const spec of DEMO_ARTIFACTS) {
    results.push(await seedOne(spec));
  }
  console.log(results.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
