/** Aggregate queries behind GET /analytics/rate-limit-logs/stats. */
import { type ColumnBaseConfig, desc, isNotNull, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db';
import { rateLimitLog } from '../db/schema';
import { rateLimiter } from '../middleware/rate-limiter';

const TOP_N = 5;
const count = sql<number>`count(*)::int`;

type TextColumn = PgColumn<ColumnBaseConfig<'string', string>>;

function topBy(column: TextColumn, where = isNotNull(column)) {
  return db
    .select({ key: column, count })
    .from(rateLimitLog)
    .where(where)
    .groupBy(column)
    .orderBy(desc(sql`count(*)`))
    .limit(TOP_N);
}

/** Totals, top offenders, and the active limiter configuration. */
export async function getRateLimitStats() {
  const [[totals], ips, paths, methods, countries, devices] = await Promise.all([
    db
      .select({
        total: count,
        uniqueIps: sql<number>`count(distinct ${rateLimitLog.ip})::int`,
        last1h: sql<number>`count(*) filter (where ${rateLimitLog.createdAt} >= now() - interval '1 hour')::int`,
        last24h: sql<number>`count(*) filter (where ${rateLimitLog.createdAt} >= now() - interval '24 hours')::int`,
        last7d: sql<number>`count(*) filter (where ${rateLimitLog.createdAt} >= now() - interval '7 days')::int`,
        authenticated: sql<number>`count(*) filter (where ${rateLimitLog.userId} is not null)::int`,
      })
      .from(rateLimitLog),
    topBy(rateLimitLog.ip),
    topBy(rateLimitLog.path, sql`true`),
    topBy(rateLimitLog.method),
    topBy(rateLimitLog.country),
    topBy(rateLimitLog.deviceType),
  ]);

  return {
    total: totals?.total ?? 0,
    uniqueIps: totals?.uniqueIps ?? 0,
    last1h: totals?.last1h ?? 0,
    last24h: totals?.last24h ?? 0,
    last7d: totals?.last7d ?? 0,
    authenticated: totals?.authenticated ?? 0,
    topIps: ips,
    topPaths: paths,
    topMethods: methods,
    topCountries: countries,
    devices,
    config: {
      limit: rateLimiter.config.limit,
      windowMs: rateLimiter.config.windowMs,
      excludePrefixes: rateLimiter.config.excludePrefixes,
      trackedClients: rateLimiter.size,
    },
  };
}

/** Blocks in the last hour — powers the sidebar badge on "Rate Limits". */
export async function countRateLimitLastHour(): Promise<number> {
  const [row] = await db
    .select({ count })
    .from(rateLimitLog)
    .where(sql`${rateLimitLog.createdAt} >= now() - interval '1 hour'`);
  return row?.count ?? 0;
}
