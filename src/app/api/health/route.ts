import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { getProviderHealthSummary } from "@/lib/providers/llm";

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

  // Provider wiring reports presence/model names only, never raw secrets.
  checks.provider = getProviderHealthSummary();

  const allOk = Object.values(checks).every((v) => v.startsWith("ok") || v === "required" || v === "open");

  return NextResponse.json(
    { ok: allOk, checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
