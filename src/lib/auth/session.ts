/**
 * Session management for AvocadoCore auth.
 * Uses SQLite-backed sessions with HTTP-only cookie tokens.
 * Activated only when AVOCADOCORE_AUTH_REQUIRED=true.
 */
import { cookies } from "next/headers";
import { getDb } from "@/db/connection";
import { createHmac, randomBytes } from "crypto";

const SESSION_COOKIE = "avocado_session";
const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
}

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
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as SessionUser | undefined;

  return row ?? null;
}

/** Read session from a raw cookie string (for use in middleware/edge). */
export function getSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return verify(match[1]);
}
