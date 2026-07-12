/**
 * POST /api/provider/health — test the user's configured provider.
 *
 * Decrypts the stored API key, makes a lightweight completions request,
 * and updates health_status + health_error on the config row.
 * Never returns the decrypted API key to the browser.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { decryptApiKey, isKeySecretConfigured } from "@/lib/provider-crypto";
import { checkGoogleAiStudioUpstream, summarizeAiStudioConfig } from "@/lib/providers/google-ai-studio";

type ProviderRow = {
  id: number;
  user_id: number;
  provider_name: string;
  base_url: string | null;
  model: string | null;
  encrypted_api_key: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerName = searchParams.get("provider_name") || process.env.AVOCADOCORE_DEFAULT_PROVIDER || "unset";
    const check = searchParams.get("check") === "1" || searchParams.get("check") === "true";

    if (providerName === "google-ai-studio") {
      const health = check ? await checkGoogleAiStudioUpstream({ timeoutMs: 8_000 }) : summarizeAiStudioConfig();
      return NextResponse.json({
        provider_name: "google-ai-studio",
        health_status: health.status,
        configured: health.configured,
        checked: health.checked,
        model: health.model,
        health_error: health.error ?? null,
      });
    }

    return NextResponse.json({
      provider_name: providerName,
      health_status: providerName === "unset" ? "not-required" : "unsupported",
      configured: providerName !== "unset",
      checked: false,
      model: null,
      health_error: providerName === "unset" ? null : "Only google-ai-studio default provider health is supported by GET.",
    });
  } catch (err) {
    console.error("[api/provider/health GET]", err);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as {
      user_id?: number;
      provider_name: string;
    };

    const userId = Number(body.user_id || 1);
    const providerName = (body.provider_name || "").trim();
    if (!providerName) {
      return NextResponse.json({ error: "provider_name is required" }, { status: 400 });
    }

    const row = db
      .prepare(
        "SELECT * FROM user_provider_configs WHERE user_id = ? AND provider_name = ?"
      )
      .get(userId, providerName) as ProviderRow | undefined;

    if (!row) {
      return NextResponse.json({ error: "Provider config not found" }, { status: 404 });
    }

    if (!row.encrypted_api_key) {
      db.prepare(
        `UPDATE user_provider_configs
         SET health_status='error', health_error='No API key configured', health_checked_at=datetime('now'), updated_at=datetime('now')
         WHERE user_id=? AND provider_name=?`
      ).run(userId, providerName);
      return NextResponse.json({ health_status: "error", health_error: "No API key configured" });
    }

    if (!isKeySecretConfigured()) {
      return NextResponse.json(
        { error: "AVOCADOCORE_PROVIDER_KEY_SECRET is not configured on the server" },
        { status: 500 }
      );
    }

    let apiKey: string;
    try {
      apiKey = decryptApiKey(row.encrypted_api_key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      db.prepare(
        `UPDATE user_provider_configs
         SET health_status='error', health_error=?, health_checked_at=datetime('now'), updated_at=datetime('now')
         WHERE user_id=? AND provider_name=?`
      ).run(`Key decryption failed: ${msg}`, userId, providerName);
      return NextResponse.json({ health_status: "error", health_error: `Key decryption failed: ${msg}` });
    }

    const baseUrl = row.base_url || "https://api.openai.com";
    const model = row.model || "gpt-4o-mini";

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const errMsg = `Provider returned ${res.status}: ${text.slice(0, 200)}`;
        db.prepare(
          `UPDATE user_provider_configs
           SET health_status='error', health_error=?, health_checked_at=datetime('now'), updated_at=datetime('now')
           WHERE user_id=? AND provider_name=?`
        ).run(errMsg, userId, providerName);
        return NextResponse.json({ health_status: "error", health_error: errMsg });
      }

      db.prepare(
        `UPDATE user_provider_configs
         SET health_status='healthy', health_error=NULL, health_checked_at=datetime('now'), updated_at=datetime('now')
         WHERE user_id=? AND provider_name=?`
      ).run(userId, providerName);

      return NextResponse.json({ health_status: "healthy" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      db.prepare(
        `UPDATE user_provider_configs
         SET health_status='error', health_error=?, health_checked_at=datetime('now'), updated_at=datetime('now')
         WHERE user_id=? AND provider_name=?`
      ).run(msg, userId, providerName);
      return NextResponse.json({ health_status: "error", health_error: msg });
    }
  } catch (err) {
    console.error("[api/provider/health POST]", err);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
