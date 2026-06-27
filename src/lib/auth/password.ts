/**
 * Password hashing utilities using Node.js native crypto (scrypt).
 * No external dependencies required.
 */
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const KEYLEN = 64;
const PARAMS = "N=32768,r=8,p=1"; // reasonable for a toy deployment

/** Hash a password. Returns "scrypt:<params>:<salt>:<hash>" (all hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt:${PARAMS}:${salt}:${hash}`;
}

/** Verify a password against a stored hash. Constant-time. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const salt = parts[2];
  const expectedHash = Buffer.from(parts[3], "hex");
  try {
    const hash = scryptSync(password, salt, KEYLEN);
    if (hash.length !== expectedHash.length) return false;
    return timingSafeEqual(hash, expectedHash);
  } catch {
    return false;
  }
}

/** Validate password strength. Returns an error string or null. */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password too long";
  return null;
}
