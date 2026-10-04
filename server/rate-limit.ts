/**
 * Sliding-window-counter in-memory rate limiter (pure state; the Elysia plugin
 * lives in middleware/rate-limiter.ts). O(1) state per key, LRU-capped at
 * MAX_TRACKED_KEYS, per-process — use Redis for multi-instance.
 */
import { isIP } from 'node:net';
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
  /** Requests still accepted right now: floor(limit − estimate), estimate counting this request if accepted. */
  remaining: number;
  /** Exact ms until one more request would be accepted (0 when not limited). */
  retryAfterMs: number;
  /** First rejection of this key's blocking episode (at most one per window) — log only these. */
  episodeStart: boolean;
};

/** Counts of the current and previous fixed window; estimate = prev × (1 − elapsed/window) + curr. */
type KeyState = { windowStart: number; prev: number; curr: number; loggedAt: number };

/** Better Auth and the MCP server have their own protection (rate limit / token). */
export const DEFAULT_EXCLUDE_PREFIXES = ['/api/auth/', '/api/mcp'];

// ponytail: per-process, O(1) per key (sliding-window counter, approximate at window edges); at the cap the least-recently-used 10% are evicted and restart with a fresh quota — move to Redis/shared store for multi-instance or floods wider than this.
export const MAX_TRACKED_KEYS = 10_000;
const EVICT_FRACTION = 0.1;

const PRUNE_INTERVAL_MS = 5 * 60_000;
/** Clients without any resolvable IP share one bucket; keyed so it is visible in logs. */
const UNKNOWN_KEY = 'unknown';
/** Absorbs float error so a client that waits exactly `retryAfterMs` is accepted. */
const EPSILON = 1e-9;
/** First 4 of 8 IPv6 groups = /64, the usual allocation for one subscriber. */
const IPV6_PREFIX_GROUPS = 4;

/** Limiter bucket for a client IP: IPv4 as-is, IPv6 by its /64 prefix (e.g. `2001:db8:1:2::/64`). */
export function rateLimitKey(ip: string | null): string | null {
  if (!ip) return null;
  const addr = ip.split('%')[0];
  if (isIP(addr) !== 6) return ip;
  // URL serialises IPv6 canonically (lowercase, compressed, embedded IPv4 as hex).
  const canonical = (a: string) => new URL(`http://[${a}]`).hostname.slice(1, -1);
  const host = canonical(addr);
  const [head, tail = ''] = host.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = host.includes('::')
    ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t]
    : h;
  const prefix = groups.slice(0, IPV6_PREFIX_GROUPS);
  return `${canonical([...prefix, '0', '0', '0', '0'].join(':'))}/64`;
}

/** Advance `s` to the fixed window containing `now`; the old current count becomes `prev`. */
function roll(s: KeyState, now: number, windowMs: number): void {
  const start = Math.floor(now / windowMs) * windowMs;
  if (start <= s.windowStart) return;
  s.prev = start - s.windowStart === windowMs ? s.curr : 0;
  s.curr = 0;
  s.windowStart = start;
}

function estimate(s: KeyState, now: number, windowMs: number): number {
  const elapsed = Math.max(0, now - s.windowStart);
  return s.prev * (1 - elapsed / windowMs) + s.curr;
}

/** ms until estimate ≤ limit − 1 with no further accepted requests (estimate only decays). */
function msUntilRoom(s: KeyState, now: number, windowMs: number, limit: number): number {
  const elapsed = now - s.windowStart;
  const room = limit - 1 - s.curr;
  const ms =
    room >= 0
      ? windowMs * (1 - room / s.prev) - elapsed // prev decays enough within this window
      : windowMs - elapsed + windowMs * (1 - (limit - 1) / s.curr); // curr becomes next window's prev
  return Math.max(0, Math.ceil(ms));
}

export class RateLimiter {
  /** Insertion order = LRU order: every access deletes and re-sets its key. */
  private keys = new Map<string, KeyState>();
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

  /** Replace the active config at runtime (settings console). A new windowMs resets all counters (counts are window-relative). */
  configure(config: Partial<RateLimitConfig>): void {
    const windowChanged =
      config.windowMs !== undefined && config.windowMs !== this.current.windowMs;
    this.current = { ...this.current, ...config };
    if (windowChanged) this.keys.clear();
  }

  isExcluded(pathname: string): boolean {
    return this.config.excludePrefixes.some((p) => pathname.startsWith(p));
  }

  /** Count a request for `key` unless it is over the limit; rejected requests are not counted. */
  check(key: string | null, now = Date.now()): RateLimitResult {
    const k = key ?? UNKNOWN_KEY;
    const { windowMs, limit } = this.current;
    let state = this.keys.get(k);
    if (state) this.keys.delete(k);
    else {
      this.makeRoom();
      state = { windowStart: 0, prev: 0, curr: 0, loggedAt: Number.NEGATIVE_INFINITY };
    }
    this.keys.set(k, state);
    roll(state, now, windowMs);

    let est = estimate(state, now, windowMs);
    const limited = est + 1 > limit + EPSILON;
    if (!limited) {
      state.curr++;
      est++;
    }
    const episodeStart = limited && state.loggedAt <= now - windowMs;
    if (episodeStart) state.loggedAt = now;
    return {
      limited,
      limit,
      remaining: Math.max(0, Math.floor(limit - est + EPSILON)),
      retryAfterMs: limited ? msUntilRoom(state, now, windowMs, limit) : 0,
      episodeStart,
    };
  }

  /** At the cap, drop the least-recently-used batch — O(batch), no full prune on the hot path. */
  private makeRoom(): void {
    if (this.keys.size < this.maxKeys) return;
    let n = Math.max(1, Math.floor(this.maxKeys * EVICT_FRACTION));
    for (const k of this.keys.keys()) {
      this.keys.delete(k);
      if (--n === 0) break;
    }
  }

  /** Drop keys whose estimate has decayed to 0 and whose logged episode is outside the window. */
  prune(now = Date.now()): void {
    const { windowMs } = this.current;
    for (const [k, s] of this.keys) {
      roll(s, now, windowMs);
      if (s.prev === 0 && s.curr === 0 && s.loggedAt <= now - windowMs) this.keys.delete(k);
    }
  }

  /** Number of tracked keys (for diagnostics/tests). */
  get size(): number {
    return this.keys.size;
  }

  reset(): void {
    this.keys.clear();
  }
}

/** Process-wide limiter used by the API. */
export const rateLimiter = new RateLimiter();
setInterval(() => rateLimiter.prune(), PRUNE_INTERVAL_MS).unref?.();
