import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getDb } from "@/db/connection";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitHeaders } from "@/lib/auth/rate-limit";

/** POST /api/auth/login — username + password login. */
export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per IP per 15 minutes
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, username, display_name, email, password_hash FROM users WHERE username = ?")
    .get(username) as
    | { id: number; username: string; display_name: string; email: string | null; password_hash: string | null }
    | undefined;

  // Always run verifyPassword to avoid timing-based username enumeration
  const storedHash = user?.password_hash ?? "scrypt:N=32768,r=8,p=1:fakesalt:fakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehash00";
  const valid = verifyPassword(password, storedHash);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true, username: user.username, display_name: user.display_name });
}
