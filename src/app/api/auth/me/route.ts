import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

/** GET /api/auth/me — returns the current authenticated user, or 401. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user });
}
