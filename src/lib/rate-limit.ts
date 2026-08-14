/**
 * Simple in-memory rate limiter for sensitive endpoints (e.g. login).
 * Suitable for a single-instance deployment.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const PRUNE_INTERVAL = 10 * 60_000;
let lastPrune = Date.now();

function prune() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit = 10, windowMs = 15 * 60_000): boolean {
  prune();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function rateLimitReset(key: string) {
  buckets.delete(key);
}
