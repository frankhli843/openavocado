import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { seedDatabase } from "@/db/seed";
import { serializeConfig, INVALID_CONFIG } from "@/lib/profile-config";
import { ensureDemoLessonsForLearner } from "@/lib/demo-lessons";
import type { LearnerProfile } from "@/types";

/**
 * GET /api/profiles?user_id=1
 *
 * List all learner profiles for an account plus the active profile id. The app
 * uses this to render the profile switcher and to scope every subject/progress
 * query by the active learner profile.
 */
export async function GET(request: Request) {
  try {
    const db = getDb();
    seedDatabase(); // idempotent

    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("user_id") || 1);

    const user = db
      .prepare("SELECT id, active_learner_id FROM users WHERE id = ?")
      .get(userId) as { id: number; active_learner_id: number | null } | undefined;
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const profiles = db
      .prepare(
        "SELECT * FROM learner_profiles WHERE user_id = ? ORDER BY created_at ASC, id ASC"
      )
      .all(userId) as LearnerProfile[];

    // Resolve the active profile: stored value if still valid, else first profile.
    let activeId = user.active_learner_id;
    if (activeId == null || !profiles.some((p) => p.id === activeId)) {
      activeId = profiles[0]?.id ?? null;
    }

    return NextResponse.json({ user_id: userId, active_learner_id: activeId, profiles });
  } catch (err) {
    console.error("[api/profiles GET]", err);
    return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
  }
}

/**
 * POST /api/profiles — create a new learner profile.
 * Body: { user_id, display_name, bio?, preferred_lang?, config? }
 */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as {
      user_id?: number;
      display_name?: string;
      bio?: string | null;
      preferred_lang?: string;
      config?: unknown;
    };

    const userId = Number(body.user_id || 1);
    const displayName = (body.display_name || "").trim();
    if (!displayName) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }

    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const config = serializeConfig(body.config);
    if (config === INVALID_CONFIG) {
      return NextResponse.json({ error: "config must be a JSON object" }, { status: 400 });
    }

    const bio = typeof body.bio === "string" ? body.bio.trim() || null : null;
    const lang = (body.preferred_lang || "en").trim() || "en";

    const res = db
      .prepare(
        "INSERT INTO learner_profiles (user_id, display_name, bio, preferred_lang, config) VALUES (?, ?, ?, ?, ?)"
      )
      .run(userId, displayName, bio, lang, config);

    const profile = db
      .prepare("SELECT * FROM learner_profiles WHERE id = ?")
      .get(res.lastInsertRowid) as LearnerProfile;
    ensureDemoLessonsForLearner(db, profile.id);

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error("[api/profiles POST]", err);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}
