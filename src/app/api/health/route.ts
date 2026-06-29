import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { doraemonEdgeAvailable, espeakAvailable } from "@/lib/audio/tts";

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
  checks.ai_studio_key =
    defaultProvider === "google-ai-studio"
      ? process.env.GOOGLE_AI_STUDIO_API_KEY
        ? "configured"
        : "missing"
      : "not-required";
  checks.edge_tts = doraemonEdgeAvailable() ? "ok" : "missing";
  checks.espeak_ng = espeakAvailable() ? "ok" : "missing";

  const allOk = Object.values(checks).every(
    (v) =>
      v.startsWith("ok") ||
      v === "required" ||
      v === "open" ||
      v === "configured" ||
      v === "not-required" ||
      v === "google-ai-studio" ||
      v === "unset" ||
      v === "ok"
  );

  return NextResponse.json(
    { ok: allOk, checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
