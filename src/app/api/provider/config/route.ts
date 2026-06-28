/**
 * GET  /api/provider/config?user_id=1      — fetch the user's provider config (no raw key)
 * PUT  /api/provider/config                — upsert provider config; encrypt and store the API key
 * DELETE /api/provider/config?user_id=1&provider_name=openai — remove a provider config
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { encryptApiKey, isKeySecretConfigured } from "@/lib/provider-crypto";
import type { UserProviderConfig } from "@/types";

type ProviderRow = {
  id: number;
  user_id: number;
  provider_name: string;
  base_url: string | null;
  model: string | null;
  encrypted_api_key: string | null;
  health_status: string;
  health_error: string | null;
  health_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

function toPublic(row: ProviderRow): UserProviderConfig {
  return {
    id: row.id,
    user_id: row.user_id,
    provider_name: row.provider_name,
    base_url: row.base_url,
    model: row.model,
    health_status: row.health_status as UserProviderConfig["health_status"],
    health_error: row.health_error,
    has_credentials: Boolean(row.encrypted_api_key),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("user_id") || 1);

    const rows = db
      .prepare("SELECT * FROM user_provider_configs WHERE user_id = ? ORDER BY provider_name ASC")
      .all(userId) as ProviderRow[];

    return NextResponse.json({ configs: rows.map(toPublic) });
  } catch (err) {
    console.error("[api/provider/config GET]", err);
    return NextResponse.json({ error: "Failed to load provider configs" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as {
      user_id?: number;
      provider_name: string;
      base_url?: string | null;
      model?: string | null;
      api_key?: string | null;
    };

    const userId = Number(body.user_id || 1);
    const providerName = (body.provider_name || "").trim();
    if (!providerName) {
      return NextResponse.json({ error: "provider_name is required" }, { status: 400 });
    }

    // Encrypt the API key if provided
    let encryptedKey: string | null = null;
    if (body.api_key) {
      if (!isKeySecretConfigured()) {
        return NextResponse.json(
          {
            error:
              "AVOCADOCORE_PROVIDER_KEY_SECRET is not configured. " +
              "Set it in your environment before storing API keys.",
          },
          { status: 500 }
        );
      }
      encryptedKey = encryptApiKey(body.api_key);
    } else if (body.api_key === null) {
      // Explicitly clearing the key
      encryptedKey = null;
    } else {
      // Not provided — preserve existing encrypted key
      const existing = db
        .prepare(
          "SELECT encrypted_api_key FROM user_provider_configs WHERE user_id = ? AND provider_name = ?"
        )
        .get(userId, providerName) as { encrypted_api_key: string | null } | undefined;
      encryptedKey = existing?.encrypted_api_key ?? null;
    }

    db.prepare(`
      INSERT INTO user_provider_configs (user_id, provider_name, base_url, model, encrypted_api_key, health_status, updated_at)
      VALUES (?, ?, ?, ?, ?, 'unchecked', datetime('now'))
      ON CONFLICT (user_id, provider_name) DO UPDATE SET
        base_url = excluded.base_url,
        model = excluded.model,
        encrypted_api_key = excluded.encrypted_api_key,
        health_status = 'unchecked',
        health_error = NULL,
        health_checked_at = NULL,
        updated_at = datetime('now')
    `).run(
      userId,
      providerName,
      body.base_url ?? null,
      body.model ?? null,
      encryptedKey
    );

    const row = db
      .prepare(
        "SELECT * FROM user_provider_configs WHERE user_id = ? AND provider_name = ?"
      )
      .get(userId, providerName) as ProviderRow;

    return NextResponse.json({ config: toPublic(row) });
  } catch (err) {
    console.error("[api/provider/config PUT]", err);
    return NextResponse.json({ error: "Failed to save provider config" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("user_id") || 1);
    const providerName = (searchParams.get("provider_name") || "").trim();
    if (!providerName) {
      return NextResponse.json({ error: "provider_name is required" }, { status: 400 });
    }

    const result = db
      .prepare(
        "DELETE FROM user_provider_configs WHERE user_id = ? AND provider_name = ?"
      )
      .run(userId, providerName);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Provider config not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/provider/config DELETE]", err);
    return NextResponse.json({ error: "Failed to delete provider config" }, { status: 500 });
  }
}
