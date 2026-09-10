/**
 * Sliding-window in-memory rate limiter.
 *
 * Limits are per IP. State resets on server restart (acceptable for a template;
 * use Redis for multi-instance deployments).
 *
 * When a request is blocked, it is logged to `rate_limit_log` in the DB.
 *
 * Paths under /api/auth/* are excluded — Better Auth has its own protection.
 */
import { db } from '../db';
import { rateLimitLog } from '../db/schema';

export type RateLimitConfig = {
  windowMs: number;
  limit: number;
  excludePrefixes?: string[];
};

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  limit: 100,
  excludePrefixes: ['/api/auth/'],
};

const hits = new Map<string, number[]>();

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): { limited: boolean; remaining: number } {
  const now = Date.now();
  const prev = hits.get(ip) ?? [];
  const recent = prev.filter((t) => now - t < config.windowMs);
  recent.push(now);
  hits.set(ip, recent);

  const count = recent.length;
  return { limited: count > config.limit, remaining: Math.max(0, config.limit - count) };
}

export async function logRateLimit(
  ip: string | null,
  path: string,
  userId: string | null,
): Promise<void> {
  await db
    .insert(rateLimitLog)
    .values({ ip, path, userId })
    .catch(() => {
      // Silently drop — must not cascade.
    });
}

/** Periodically prune the in-memory hit map to avoid unbounded growth. */
function pruneHits(windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  for (const [ip, times] of hits.entries()) {
    const fresh = times.filter((t) => t > cutoff);
    if (fresh.length === 0) hits.delete(ip);
    else hits.set(ip, fresh);
  }
}

// Prune every 5 minutes.
setInterval(() => pruneHits(DEFAULT_CONFIG.windowMs), 5 * 60_000).unref?.();
