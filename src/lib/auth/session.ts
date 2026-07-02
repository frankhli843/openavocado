/**
 * Session management for AvocadoCore auth.
 * Uses SQLite-backed sessions with HTTP-only cookie tokens.
 * Activated only when AVOCADOCORE_AUTH_REQUIRED=true.
 */
import { cookies } from "next/headers";
import { getDb } from "@/db/connection";
import { createHmac, randomBytes } from "crypto";
import { hashPassword } from "./password";
import { ensureDemoLessonsForLearner } from "@/lib/demo-lessons";

const SESSION_COOKIE = "avocado_session";
const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  active_learner_id: number | null;
  is_guest: boolean;
}

type SessionUserRow = Omit<SessionUser, "is_guest"> & { is_guest: number };

function getSecret(): string {
  const secret = process.env.AVOCADOCORE_SESSION_SECRET;
  if (!secret) throw new Error("AVOCADOCORE_SESSION_SECRET is required when auth is enabled");
  return secret;
}

/** Sign a token so it cannot be forged. */
function sign(token: string): string {
  const mac = createHmac("sha256", getSecret()).update(token).digest("hex");
  return `${token}.${mac}`;
}

/** Verify and strip the signature. Returns the raw token or null. */
function verify(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;
  const token = signed.slice(0, dot);
  const expected = createHmac("sha256", getSecret()).update(token).digest("hex");
  const got = signed.slice(dot + 1);
  // Constant-time compare
  if (expected.length !== got.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0 ? token : null;
}

/** Create a new session for a user and set the session cookie. */
export async function createSession(userId: number): Promise<void> {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400 * 1000).toISOString();

  db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)").run(
    userId,
    token,
    expiresAt
  );

  const signed = sign(token);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });
}

/** Destroy the current session. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (signed) {
    const token = verify(signed);
    if (token) {
      getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Resolve the current session to a user, or null if not authenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!signed) return null;

  const token = verify(signed);
  if (!token) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.email
              , u.active_learner_id, COALESCE(u.is_guest, 0) AS is_guest
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as SessionUserRow | undefined;

  return row ? { ...row, is_guest: Boolean(row.is_guest) } : null;
}

/** Read session from a raw cookie string (for use in middleware/edge). */
export function getSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return verify(match[1]);
}

export async function ensureSessionUser(): Promise<SessionUser> {
  const existing = await getSessionUser();
  if (existing) {
    const user = ensureActiveLearnerProfile(existing);
    return user;
  }
  if (process.env.AVOCADOCORE_AUTH_REQUIRED !== "true") {
    const db = getDb();
    let row = db
      .prepare(
        `SELECT id, username, display_name, email, active_learner_id,
                COALESCE(is_guest, 0) AS is_guest
         FROM users ORDER BY id ASC LIMIT 1`
      )
      .get() as SessionUserRow | undefined;
    if (!row) {
      const result = db
        .prepare("INSERT INTO users (username, display_name, is_guest) VALUES ('local-default', 'Local learner', 0)")
        .run();
      const userId = result.lastInsertRowid as number;
      const learnerId = db
        .prepare("INSERT INTO learner_profiles (user_id, display_name, preferred_lang) VALUES (?, 'Local learner', 'en')")
        .run(userId).lastInsertRowid as number;
      db.prepare("UPDATE users SET active_learner_id = ? WHERE id = ?").run(learnerId, userId);
      row = {
        id: userId,
        username: "local-default",
        display_name: "Local learner",
        email: null,
        active_learner_id: learnerId,
        is_guest: 0,
      };
    }
    if (row) {
      const user = ensureActiveLearnerProfile({ ...row, is_guest: Boolean(row.is_guest) });
      return user;
    }
  }
  return createGuestSession();
}

export function ensureActiveLearnerProfile(user: SessionUser): SessionUser {
  const db = getDb();
  if (user.active_learner_id != null) {
    const active = db
      .prepare("SELECT id FROM learner_profiles WHERE id = ? AND user_id = ?")
      .get(user.active_learner_id, user.id) as { id: number } | undefined;
    if (active) {
      ensureDemoLessonsForLearner(db, active.id);
      return user;
    }
  }

  const existingProfile = db
    .prepare("SELECT id FROM learner_profiles WHERE user_id = ? ORDER BY created_at ASC, id ASC LIMIT 1")
    .get(user.id) as { id: number } | undefined;
  const learnerId =
    existingProfile?.id ??
    (db
      .prepare("INSERT INTO learner_profiles (user_id, display_name, preferred_lang) VALUES (?, ?, 'en')")
      .run(user.id, user.display_name || user.username).lastInsertRowid as number);

  db.prepare("UPDATE users SET active_learner_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    learnerId,
    user.id
  );
  ensureDemoLessonsForLearner(db, learnerId);
  return { ...user, active_learner_id: learnerId };
}

export async function createGuestSession(): Promise<SessionUser> {
  const db = getDb();
  const suffix = randomBytes(5).toString("hex");
  const username = `guest-${suffix}`;
  const displayName = "Guest learner";
  const randomPassword = randomBytes(24).toString("base64url");
  const passwordHash = hashPassword(randomPassword);

  const tx = db.transaction(() => {
    const userId = db
      .prepare(
        "INSERT INTO users (username, display_name, password_hash, is_guest) VALUES (?, ?, ?, 1)"
      )
      .run(username, displayName, passwordHash).lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name, preferred_lang) VALUES (?, ?, 'en')")
      .run(userId, displayName).lastInsertRowid as number;
    db.prepare("UPDATE users SET active_learner_id = ? WHERE id = ?").run(learnerId, userId);
    ensureDemoLessonsForLearner(db, learnerId);
    return { userId, learnerId };
  });
  const { userId, learnerId } = tx();
  await createSession(userId);
  return {
    id: userId,
    username,
    display_name: displayName,
    email: null,
    active_learner_id: learnerId,
    is_guest: true,
  };
}
