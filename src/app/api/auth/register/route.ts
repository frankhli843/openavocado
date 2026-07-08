import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getDb } from "@/db/connection";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitHeaders } from "@/lib/auth/rate-limit";

/** POST /api/auth/register — self-registration. */
export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations per IP per 15 minutes
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
    );
  }

  let body: { username?: string; password?: string; display_name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = (body.display_name ?? "").trim() || username;
  const email = (body.email ?? "").trim() || null;

  if (!username || username.length < 3 || username.length > 40 || !/^[a-z0-9_-]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–40 characters: letters, digits, _ or -" },
      { status: 400 }
    );
  }

  const pwError = validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    // Generic message to avoid username enumeration
    return NextResponse.json({ error: "Registration failed. Please choose a different username." }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  const result = db
    .prepare(
      "INSERT INTO users (username, display_name, email, password_hash) VALUES (?, ?, ?, ?)"
    )
    .run(username, displayName, email, passwordHash);

  const userId = result.lastInsertRowid as number;

  // Create default learner profile
  db.prepare(
    "INSERT INTO learner_profiles (user_id, display_name, preferred_lang) VALUES (?, ?, ?)"
  ).run(userId, displayName, "en");

  await createSession(userId);

  return NextResponse.json({ ok: true, username, display_name: displayName }, { status: 201 });
}
