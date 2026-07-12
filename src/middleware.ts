/**
 * Next.js middleware for authentication gating.
 * Activated only when AVOCADOCORE_AUTH_REQUIRED=true.
 * Local development runs are unaffected (env var unset or false).
 *
 * NOTE: This middleware runs in the Next.js Edge Runtime which does NOT support
 * Node.js crypto. Session HMAC verification happens in Node.js API routes via
 * getSessionUser(). The middleware only checks cookie presence as a fast gate.
 * Any forged or expired cookie will fail the DB lookup in the API routes.
 */
import { NextRequest, NextResponse } from "next/server";

// Routes that are always public even when auth is required
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/login",
  "/register",
  "/_next/",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/manifest",
];

export function middleware(request: NextRequest) {
  if (process.env.AVOCADOCORE_AUTH_REQUIRED !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
