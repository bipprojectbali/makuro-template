/**
 * Sliding-window in-memory rate limiter + Elysia plugin.
 *
 * Limits are per client IP bucket (IPv4 address / IPv6 /64, see rateLimitKey).
 * State lives in this process: it resets on restart and is not shared between
 * instances — use Redis for a multi-instance deployment.
 *
 * Every API response carries X-RateLimit-Limit / X-RateLimit-Remaining; a
 * blocked request gets 429 + Retry-After in the standard API error shape. Only
 * the first rejection of a blocking episode (one per IP per window) is recorded
 * in `rate_limit_log`, with the same client enrichment as visit/login logs.
 *
 * Runs as a global `request` hook: before routing, route `derive`s and the
 * API-key plugin's onRequest (request hooks run in registration order), so a
 * flood carrying bogus API keys is rejected before any key verification.
 * Register it before apiKeyPlugin.
 */
import { Elysia } from 'elysia';
import { type ApiErrorBody, newRequestId } from '../api-error';
import { db } from '../db';
import { rateLimitLog } from '../db/schema';
import { logger } from '../logger';
import {
  DEFAULT_EXCLUDE_PREFIXES,
  type RateLimitConfig,
  RateLimiter,
  type RateLimitResult,
  rateLimiter,
  rateLimitKey,
} from '../rate-limit';
import { resolveClientIp } from './client-ip';
import { describeClient } from './request-meta';

// Re-exported so existing imports (settings, tests) keep working.
export {
  DEFAULT_EXCLUDE_PREFIXES,
  type RateLimitConfig,
  RateLimiter,
  type RateLimitResult,
  rateLimiter,
};

/** Persist a blocking episode. Failures are logged, never thrown — must not cascade. */
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

/** Elysia plugin: applies the limiter to every request of the instance it is used on. */
export function rateLimitPlugin(
  limiter: RateLimiter = rateLimiter,
  log: typeof logRateLimit = logRateLimit,
) {
  // onRequest has no scope option in Elysia 1.4: it is always instance-wide (= `as: 'global'`).
  return new Elysia({ name: 'rate-limit' }).onRequest(({ request, set }) => {
    if (!limiter.config.enabled) return;
    const pathname = new URL(request.url).pathname;
    if (limiter.isExcluded(pathname)) return;

    const ip = resolveClientIp(request.headers);
    const r = limiter.check(rateLimitKey(ip));
    set.headers['x-ratelimit-limit'] = String(r.limit);
    set.headers['x-ratelimit-remaining'] = String(r.remaining);
    if (!r.limited) return;

    const retryAfterSeconds = Math.max(1, Math.ceil(r.retryAfterMs / 1000));
    const requestId = newRequestId();
    set.headers['retry-after'] = String(retryAfterSeconds);
    set.headers['x-request-id'] = requestId;
    set.headers['cache-control'] = 'no-store';
    set.status = 429;
    if (r.episodeStart) {
      void log({
        ip,
        path: pathname,
        method: request.method,
        userId: null,
        headers: request.headers,
      });
    }
    return {
      error: `Terlalu banyak request. Coba lagi dalam ${retryAfterSeconds} detik.`,
      code: 'RATE_LIMITED',
      status: 429,
      requestId,
      retryAfterSeconds,
    } satisfies ApiErrorBody & { retryAfterSeconds: number };
  });
}
