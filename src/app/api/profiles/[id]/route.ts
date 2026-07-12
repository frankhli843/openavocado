import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { serializeConfig, INVALID_CONFIG } from "@/lib/profile-config";
import type { LearnerProfile } from "@/types";

/** GET /api/profiles/:id — fetch a single learner profile. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const profile = db
      .prepare("SELECT * FROM learner_profiles WHERE id = ?")
      .get(Number(id)) as LearnerProfile | undefined;
    if (!profile) {
      return NextResponse.json({ error: "profile not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[api/profiles/:id GET]", err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

/**
 * PATCH /api/profiles/:id — rename a profile or edit its config independently.
 * Body: { display_name?, bio?, preferred_lang?, config? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profileId = Number(id);
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM learner_profiles WHERE id = ?")
      .get(profileId) as LearnerProfile | undefined;
    if (!existing) {
      return NextResponse.json({ error: "profile not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      display_name?: string;
      bio?: string | null;
      preferred_lang?: string;
      config?: unknown;
    };

    const sets: string[] = [];
    const values: Array<string | null> = [];

    if (body.display_name !== undefined) {
      const dn = String(body.display_name).trim();
      if (!dn) {
        return NextResponse.json({ error: "display_name cannot be empty" }, { status: 400 });
      }
      sets.push("display_name = ?");
      values.push(dn);
    }
    if (body.bio !== undefined) {
      sets.push("bio = ?");
      values.push(typeof body.bio === "string" ? body.bio.trim() || null : null);
    }
    if (body.preferred_lang !== undefined) {
      sets.push("preferred_lang = ?");
      values.push((String(body.preferred_lang).trim() || "en"));
    }
    if (body.config !== undefined) {
      const config = serializeConfig(body.config);
      if (config === INVALID_CONFIG) {
        return NextResponse.json({ error: "config must be a JSON object" }, { status: 400 });
      }
      sets.push("config = ?");
      values.push(config);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "no editable fields provided" }, { status: 400 });
    }

    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE learner_profiles SET ${sets.join(", ")} WHERE id = ?`).run(
      ...values,
      profileId
    );

    const profile = db
      .prepare("SELECT * FROM learner_profiles WHERE id = ?")
      .get(profileId) as LearnerProfile;
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[api/profiles/:id PATCH]", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
