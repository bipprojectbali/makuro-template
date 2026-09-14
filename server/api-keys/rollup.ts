/**
 * Daily rollup of api_key_usage into api_key_usage_daily. Counts only ever grow
 * (GREATEST on conflict), so re-running is idempotent and raw-row retention can
 * never shrink a day that was already rolled up. Charts read the rollup for
 * older days and the raw table for the last two days.
 */
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { apiKeyUsage, apiKeyUsageDaily } from '../db/schema';
import { logger } from '../logger';

const DAY_MS = 86_400_000;
/** Raw rows are authoritative for this many trailing days; older days come from the rollup. */
export const RAW_WINDOW_DAYS = 2;
const ROLLUP_INTERVAL_MS = 60 * 60_000;

/** UTC midnight `daysAgo` days before now. */
function utcDayStart(daysAgo: number, now = Date.now()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - daysAgo * DAY_MS);
}
const toDay = (d: Date) => d.toISOString().slice(0, 10);

/** Upsert per-day aggregates for rows newer than `days` days. Returns rows touched. */
export async function rollupUsage(days = RAW_WINDOW_DAYS + 1): Promise<number> {
  const since = utcDayStart(days);
  const result = await db.execute(sql`
    insert into ${apiKeyUsageDaily} (key_id, day, method, path, count, errors, duration_sum_ms)
    select ${apiKeyUsage.keyId}, ${apiKeyUsage.createdAt}::date, ${apiKeyUsage.method}, ${apiKeyUsage.path},
      count(*)::int,
      (count(*) filter (where ${apiKeyUsage.status} >= 400))::int,
      coalesce(sum(${apiKeyUsage.durationMs}), 0)::int
    from ${apiKeyUsage}
    where ${apiKeyUsage.createdAt} >= ${since.toISOString()}::timestamp
    group by 1, 2, 3, 4
    on conflict (key_id, day, method, path) do update set
      count = greatest(${apiKeyUsageDaily}.count, excluded.count),
      errors = greatest(${apiKeyUsageDaily}.errors, excluded.errors),
      duration_sum_ms = greatest(${apiKeyUsageDaily}.duration_sum_ms, excluded.duration_sum_ms)
  `);
  return Number((result as unknown as { count?: number }).count ?? 0);
}

export type DailyPoint = { day: string; count: number; errors: number };

/** Per-day series for one key over the last `days` days: rollup for old days + raw for the tail. */
export async function dailySeries(keyId: string, days = 90): Promise<DailyPoint[]> {
  const since = utcDayStart(days - 1);
  const boundary = utcDayStart(RAW_WINDOW_DAYS - 1);
  const [old, recent] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${apiKeyUsageDaily.day}, 'YYYY-MM-DD')`,
        count: sql<number>`sum(${apiKeyUsageDaily.count})::int`,
        errors: sql<number>`sum(${apiKeyUsageDaily.errors})::int`,
      })
      .from(apiKeyUsageDaily)
      .where(
        and(
          eq(apiKeyUsageDaily.keyId, keyId),
          gte(apiKeyUsageDaily.day, toDay(since)),
          lt(apiKeyUsageDaily.day, toDay(boundary)),
        ),
      )
      .groupBy(apiKeyUsageDaily.day),
    db
      .select({
        day: sql<string>`to_char(${apiKeyUsage.createdAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        errors: sql<number>`(count(*) filter (where ${apiKeyUsage.status} >= 400))::int`,
      })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, boundary)))
      .groupBy(sql`${apiKeyUsage.createdAt}::date`),
  ]);
  return [...old, ...recent].sort((a, b) => a.day.localeCompare(b.day));
}

/** Lifetime request count that survives raw retention: rollup (old days) + raw (tail). */
export async function lifetimeTotal(keyId: string): Promise<number> {
  const boundary = utcDayStart(RAW_WINDOW_DAYS - 1);
  const [[old], [recent]] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${apiKeyUsageDaily.count}), 0)::int` })
      .from(apiKeyUsageDaily)
      .where(and(eq(apiKeyUsageDaily.keyId, keyId), lt(apiKeyUsageDaily.day, toDay(boundary)))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, boundary))),
  ]);
  return (old?.n ?? 0) + (recent?.n ?? 0);
}

/** Hourly rollup; the first pass runs shortly after boot. Safe to call once. */
export function startUsageRollupScheduler(): void {
  const tick = async () => {
    try {
      await rollupUsage();
    } catch (err) {
      logger.warn({ err }, 'api key usage rollup failed');
    }
  };
  setInterval(tick, ROLLUP_INTERVAL_MS).unref?.();
  setTimeout(tick, 30_000).unref?.();
}
