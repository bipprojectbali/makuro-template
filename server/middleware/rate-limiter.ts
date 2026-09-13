/**
 * Sliding-window in-memory rate limiter + Elysia plugin.
 *
 * Limits are per client IP (see client-ip.ts). State lives in this process:
 * it resets on restart and is not shared between instances — use Redis for a
 * multi-instance deployment.
 *
 * Every API response carries X-RateLimit-Limit / X-RateLimit-Remaining; a
 * blocked request gets 429 + Retry-After and is recorded in `rate_limit_log`
 * with the same client enrichment as visit/login logs.
 *
 * The plugin must be registered BEFORE other plugins on the API instance —
 * Elysia hooks only cover routes registered after them (verified: a hook
 * added after `.use(plugin)` never runs for that plugin's routes).
 */
import { Elysia } from 'elysia';
import { db } from '../db';
import { rateLimitLog } from '../db/schema';
import { env } from '../env';
import { logger } from '../logger';
import { resolveClientIp } from './client-ip';
import { describeClient } from './request-meta';

export type RateLimitConfig = {
  windowMs: number;
  limit: number;
  /** Request paths starting with any of these are never limited. */
  excludePrefixes: string[];
};

export type RateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  /** ms until the oldest hit leaves the window (0 when not limited). */
  retryAfterMs: number;
  /** ms since epoch when the window fully resets for this key. */
  resetAt: number;
};

/** Better Auth and the MCP server have their own protection (rate limit / token). */
export const DEFAULT_EXCLUDE_PREFIXES = ['/api/auth/', '/api/mcp'];

const PRUNE_INTERVAL_MS = 5 * 60_000;
/** Clients without any resolvable IP share one bucket; keyed so it is visible in logs. */
const UNKNOWN_KEY = 'unknown';

export class RateLimiter {
  private hits = new Map<string, number[]>();
  readonly config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs ?? env.RATE_LIMIT_WINDOW_MS,
      limit: config.limit ?? env.RATE_LIMIT_MAX,
      excludePrefixes: config.excludePrefixes ?? DEFAULT_EXCLUDE_PREFIXES,
    };
  }

  isExcluded(pathname: string): boolean {
    return this.config.excludePrefixes.some((p) => pathname.startsWith(p));
  }

  /** Record a hit for `key` and report whether it is over the limit. */
  check(key: string | null, now = Date.now()): RateLimitResult {
    const k = key ?? UNKNOWN_KEY;
    const { windowMs, limit } = this.config;
    const cutoff = now - windowMs;
    const recent = (this.hits.get(k) ?? []).filter((t) => t > cutoff);
    const limited = recent.length >= limit;
    // Blocked attempts do not extend the window — a client that backs off
    // for `retryAfterMs` is guaranteed to get through again.
    if (!limited) recent.push(now);
    this.hits.set(k, recent);
    const oldest = recent[0] ?? now;
    return {
      limited,
      limit,
      remaining: Math.max(0, limit - recent.length),
      retryAfterMs: limited ? Math.max(0, oldest + windowMs - now) : 0,
      resetAt: oldest + windowMs,
    };
  }

  /** Drop expired timestamps and empty keys (called on an interval). */
  prune(now = Date.now()): void {
    const cutoff = now - this.config.windowMs;
    for (const [k, times] of this.hits) {
      const fresh = times.filter((t) => t > cutoff);
      if (fresh.length === 0) this.hits.delete(k);
      else this.hits.set(k, fresh);
    }
  }

  /** Number of tracked keys (for diagnostics/tests). */
  get size(): number {
    return this.hits.size;
  }

  reset(): void {
    this.hits.clear();
  }
}

/** Process-wide limiter used by the API. */
export const rateLimiter = new RateLimiter();
setInterval(() => rateLimiter.prune(), PRUNE_INTERVAL_MS).unref?.();

/** Persist a blocked request. Failures are logged, never thrown — must not cascade. */
export async function logRateLimit(input: {
  ip: string | null;
  path: string;
  method: string;
  userId: string | null;
  headers: Headers;
}): Promise<void> {
  try {
    const meta = describeClient(input.headers);
    await db.insert(rateLimitLog).values({
      ip: input.ip,
      path: input.path,
      method: input.method,
      userId: input.userId,
      userAgent: input.headers.get('user-agent')?.slice(0, 512) ?? null,
      ...meta,
    });
  } catch (err) {
    logger.warn({ err, path: input.path }, 'failed to write rate_limit_log');
  }
}

/**
 * Elysia plugin: applies the limiter to every route of the instance it is
 * used on (and its later plugins). Register it first.
 */
export function rateLimitPlugin(limiter: RateLimiter = rateLimiter) {
  return new Elysia({ name: 'rate-limit' }).onBeforeHandle({ as: 'global' }, ({ request, set }) => {
    const pathname = new URL(request.url).pathname;
    if (limiter.isExcluded(pathname)) return;

    const ip = resolveClientIp(request.headers);
    const r = limiter.check(ip);
    set.headers['x-ratelimit-limit'] = String(r.limit);
    set.headers['x-ratelimit-remaining'] = String(r.remaining);
    if (!r.limited) return;

    const retryAfterSec = Math.max(1, Math.ceil(r.retryAfterMs / 1000));
    set.headers['retry-after'] = String(retryAfterSec);
    set.status = 429;
    void logRateLimit({
      ip,
      path: pathname,
      method: request.method,
      userId: null,
      headers: request.headers,
    });
    return { error: 'Too many requests', retryAfterSeconds: retryAfterSec };
  });
}
