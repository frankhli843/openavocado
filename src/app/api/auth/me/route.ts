import { NextResponse } from "next/server";
import { ensureSessionUser } from "@/lib/auth/session";

/** GET /api/auth/me — returns the current user, creating a guest if needed. */
export async function GET() {
  const user = await ensureSessionUser();
  return NextResponse.json({ ok: true, user });
}
