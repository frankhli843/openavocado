import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { edgeTtsAvailable, espeakAvailable } from "@/lib/audio/tts";
import { summarizeAiStudioConfig } from "@/lib/providers/google-ai-studio";

/**
 * GET /api/health
 * Public health endpoint. Returns JSON status for monitoring.
 * Does not require authentication.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // DB check
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
    checks.db = `ok:users=${row.n}`;
  } catch (err) {
    checks.db = `error:${String(err).slice(0, 80)}`;
  }

  // Auth mode
  checks.auth = process.env.AVOCADOCORE_AUTH_REQUIRED === "true" ? "required" : "open";
  const defaultProvider = process.env.AVOCADOCORE_DEFAULT_PROVIDER || "unset";
  checks.default_ai_provider = defaultProvider;
  if (defaultProvider === "google-ai-studio") {
    const aiStudio = summarizeAiStudioConfig();
    checks.ai_studio_key = aiStudio.configured ? "configured" : "missing";
    checks.ai_studio_provider = aiStudio.status;
  } else {
    checks.ai_studio_key = "not-required";
    checks.ai_studio_provider = "not-required";
  }
  checks.edge_tts = edgeTtsAvailable() ? "ok" : "missing";
  checks.espeak_ng = espeakAvailable() ? "ok" : "missing";

  const allOk = Object.values(checks).every(
    (v) =>
      v.startsWith("ok") ||
      v === "required" ||
      v === "open" ||
      v === "configured" ||
      v === "not-required" ||
      v === "google-ai-studio" ||
      v === "configured-unverified" ||
      v === "healthy" ||
      v === "unset" ||
      v === "ok"
  );

  return NextResponse.json(
    { ok: allOk, checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
