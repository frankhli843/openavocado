/**
 * Simple in-memory rate limiter for auth endpoints.
 * Resets on process restart. Suitable for a single-container toy deployment.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Clean up expired buckets periodically. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 60_000);

/**
 * Check and increment a rate limit bucket.
 * Returns { allowed: boolean; remaining: number; resetIn: number (ms) }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count++;
  const allowed = bucket.count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetIn: bucket.resetAt - now,
  };
}

/** Rate-limit headers helper for API responses. */
export function rateLimitHeaders(remaining: number, resetIn: number): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
    "Retry-After": String(Math.ceil(resetIn / 1000)),
  };
}
