/**
 * Sliding-window in-memory rate limiter (pure state; the Elysia plugin lives in
 * middleware/rate-limiter.ts). Per-process and capped at MAX_TRACKED_KEYS — use
 * Redis for multi-instance.
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
  /** First rejection of this key's blocking episode (at most one per window) — log only these. */
  episodeStart: boolean;
};

type KeyState = { hits: number[]; loggedAt: number };

/** Better Auth and the MCP server have their own protection (rate limit / token). */
export const DEFAULT_EXCLUDE_PREFIXES = ['/api/auth/', '/api/mcp'];

// ponytail: per-process cap; over it the oldest key is evicted and its counter resets — move to Redis/shared store for multi-instance or larger floods.
export const MAX_TRACKED_KEYS = 10_000;

const PRUNE_INTERVAL_MS = 5 * 60_000;
/** Clients without any resolvable IP share one bucket; keyed so it is visible in logs. */
const UNKNOWN_KEY = 'unknown';

export class RateLimiter {
  private hits = new Map<string, KeyState>();
  private current: RateLimitConfig;

  constructor(
    config: Partial<RateLimitConfig> = {},
    private readonly maxKeys = MAX_TRACKED_KEYS,
  ) {
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
    let state = this.hits.get(k);
    if (!state) {
      this.makeRoom(now);
      state = { hits: [], loggedAt: Number.NEGATIVE_INFINITY };
      this.hits.set(k, state);
    }
    const recent = state.hits.filter((t) => t > cutoff);
    const limited = recent.length >= limit;
    // Blocked attempts do not extend the window — a client that backs off
    // for `retryAfterMs` is guaranteed to get through again.
    if (!limited) recent.push(now);
    state.hits = recent;
    const episodeStart = limited && state.loggedAt <= cutoff;
    if (episodeStart) state.loggedAt = now;
    const oldest = recent[0] ?? now;
    return {
      limited,
      limit,
      remaining: Math.max(0, limit - recent.length),
      retryAfterMs: limited ? Math.max(0, oldest + windowMs - now) : 0,
      resetAt: oldest + windowMs,
      episodeStart,
    };
  }

  /** Keep the map under `maxKeys` before inserting a new key: expired keys first, then oldest. */
  private makeRoom(now: number): void {
    if (this.hits.size < this.maxKeys) return;
    this.prune(now);
    for (const k of this.hits.keys()) {
      if (this.hits.size < this.maxKeys) break;
      this.hits.delete(k);
    }
  }

  /** Drop expired timestamps and idle keys (called on an interval and when the map is full). */
  prune(now = Date.now()): void {
    const cutoff = now - this.config.windowMs;
    for (const [k, state] of this.hits) {
      state.hits = state.hits.filter((t) => t > cutoff);
      // A key whose logged episode is still inside the window stays, so it is not logged twice.
      if (state.hits.length === 0 && state.loggedAt <= cutoff) this.hits.delete(k);
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
