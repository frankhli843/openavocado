import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";

/**
 * POST /api/profiles/active — set the active learner profile for an account.
 * Body: { user_id, learner_id }
 *
 * The active profile scopes the dashboard, subjects, mastery, and lessons. We
 * verify the profile belongs to the user so one account cannot activate
 * another account's profile.
 */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as { user_id?: number; learner_id?: number };
    const userId = Number(body.user_id || 1);
    const learnerId = Number(body.learner_id);

    if (!learnerId) {
      return NextResponse.json({ error: "learner_id is required" }, { status: 400 });
    }

    const profile = db
      .prepare("SELECT id FROM learner_profiles WHERE id = ? AND user_id = ?")
      .get(learnerId, userId) as { id: number } | undefined;
    if (!profile) {
      return NextResponse.json(
        { error: "profile not found for this user" },
        { status: 404 }
      );
    }

    db.prepare(
      "UPDATE users SET active_learner_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(learnerId, userId);

    return NextResponse.json({ ok: true, user_id: userId, active_learner_id: learnerId });
  } catch (err) {
    console.error("[api/profiles/active POST]", err);
    return NextResponse.json({ error: "Failed to set active profile" }, { status: 500 });
  }
}
