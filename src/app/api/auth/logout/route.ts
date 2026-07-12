import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/** POST /api/auth/logout — clear current session. */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
