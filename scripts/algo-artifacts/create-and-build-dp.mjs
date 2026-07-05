// Create + build the DP-reactivation bespoke visual artifacts against the live demo service.
// Idempotent: PATCH+rebuild if the slug already exists.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = process.env.AVO_BASE || "http://127.0.0.1:3742";
const here = path.dirname(fileURLToPath(import.meta.url));

const ARTIFACTS = [
  { slug: "algo-dp-overview-map", title: "Dynamic Programming — Reactivation Orientation Map", file: "algo-dp-overview-map.tsx" },
  { slug: "algo-dp-kadane", title: "Dynamic Programming — Kadane / Maximum Subarray (running scalar)", file: "algo-dp-kadane.tsx" },
  { slug: "algo-dp-knapsack", title: "Dynamic Programming — 0/1 Knapsack (rolling array, descending sweep)", file: "algo-dp-knapsack.tsx" },
];

async function j(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

for (const a of ARTIFACTS) {
  const source = fs.readFileSync(path.join(here, a.file), "utf8");
  const create = await j(`${BASE}/api/visual-artifacts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: a.slug, title: a.title, source_react: source }),
  });
  if (create.status === 409) {
    const patch = await j(`${BASE}/api/visual-artifacts/${a.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_react: source }),
    });
    console.log(`[${a.slug}] existed → PATCH ${patch.status}`);
  } else {
    console.log(`[${a.slug}] POST ${create.status}${create.status >= 400 ? " " + JSON.stringify(create.body) : ""}`);
  }
  const build = await j(`${BASE}/api/visual-artifacts/${a.slug}/build`, { method: "POST" });
  const status = build.body?.artifact?.build_status ?? build.body?.build_status ?? build.status;
  const err = build.body?.artifact?.build_error ?? build.body?.error ?? build.body?.build_error;
  console.log(`[${a.slug}] BUILD -> ${status}${err ? " ERR=" + JSON.stringify(err) : ""}`);
}
