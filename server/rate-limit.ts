/**
 * Sliding-window in-memory rate limiter (pure state; the Elysia plugin lives in
 * middleware/rate-limiter.ts). Per-process — use Redis for multi-instance.
 */
import { env } from './env';

export type RateLimitConfig = {
  windowMs: number;
  limit: number;
  /** Request paths starting with any of these are never limited. */
  excludePrefixes: string[];
  /** Master switch — false makes the plugin a no-op (still sets no headers). */
  enabled: boolean;
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
  private current: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.current = {
      windowMs: config.windowMs ?? env.RATE_LIMIT_WINDOW_MS,
      limit: config.limit ?? env.RATE_LIMIT_MAX,
      excludePrefixes: config.excludePrefixes ?? DEFAULT_EXCLUDE_PREFIXES,
      enabled: config.enabled ?? true,
    };
  }

  get config(): Readonly<RateLimitConfig> {
    return this.current;
  }

  /** Replace the active config at runtime (settings console). Existing hit history is kept. */
  configure(config: Partial<RateLimitConfig>): void {
    this.current = { ...this.current, ...config };
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
