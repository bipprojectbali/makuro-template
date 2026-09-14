/**
 * Per-request usage log for API keys. Rows are buffered in memory and flushed
 * in one insert every few seconds so tracking never adds a DB round-trip to
 * the request path. Query helpers feed the console.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { apiKeyUsage, apikey } from '../db/schema';
import { logger } from '../logger';
import { dailySeries, lifetimeTotal } from './rollup';

export type UsageRow = typeof apiKeyUsage.$inferInsert;

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT = 200;
const MAX_UA = 512;
let buffer: UsageRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function recordUsage(row: UsageRow): void {
  buffer.push({ ...row, userAgent: row.userAgent?.slice(0, MAX_UA) ?? null });
  if (buffer.length >= FLUSH_AT) void flushUsage();
  else if (!timer) {
    timer = setTimeout(() => void flushUsage(), FLUSH_INTERVAL_MS);
    timer.unref?.();
  }
}

/** Write buffered rows and refresh each key's last origin. Safe to call anytime (tests, shutdown). */
export async function flushUsage(): Promise<number> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const rows = buffer;
  buffer = [];
  if (rows.length === 0) return 0;
  try {
    await db.insert(apiKeyUsage).values(rows);
    // Last origin per key (latest row wins).
    const last = new Map<string, UsageRow>();
    for (const r of rows) last.set(r.keyId, r);
    await Promise.all(
      [...last.entries()].map(([keyId, r]) =>
        db
          .update(apikey)
          .set({ lastIp: r.ip ?? null, lastCountry: r.country ?? null })
          .where(eq(apikey.id, keyId)),
      ),
    );
  } catch (err) {
    logger.warn({ err, rows: rows.length }, 'failed to flush api_key_usage');
  }
  return rows.length;
}

const count = sql<number>`count(*)::int`;

/** Headline usage numbers for one key. */
export async function usageSummary(keyId: string) {
  const [row] = await db
    .select({
      total: count,
      last24h: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= now() - interval '24 hours')::int`,
      last7d: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= now() - interval '7 days')::int`,
      errors24h: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= now() - interval '24 hours' and ${apiKeyUsage.status} >= 400)::int`,
      avgMs: sql<number>`coalesce(avg(${apiKeyUsage.durationMs}) filter (where ${apiKeyUsage.createdAt} >= now() - interval '24 hours'), 0)::int`,
    })
    .from(apiKeyUsage)
    .where(eq(apiKeyUsage.keyId, keyId));
  const base = row ?? { total: 0, last24h: 0, last7d: 0, errors24h: 0, avgMs: 0 };
  // Lifetime count comes from the daily rollup so raw retention never shrinks it.
  return { ...base, total: await lifetimeTotal(keyId) };
}

const CHART_DAYS = 90;

/** Top endpoints, IPs, countries (last N days of raw rows) and a 90-day daily series. */
export async function usageBreakdown(keyId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const where = and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, since));
  const [endpoints, ips, countries, daily] = await Promise.all([
    db
      .select({ key: sql<string>`${apiKeyUsage.method} || ' ' || ${apiKeyUsage.path}`, count })
      .from(apiKeyUsage)
      .where(where)
      .groupBy(apiKeyUsage.method, apiKeyUsage.path)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({ key: apiKeyUsage.ip, count })
      .from(apiKeyUsage)
      .where(where)
      .groupBy(apiKeyUsage.ip)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db
      .select({ key: apiKeyUsage.country, count })
      .from(apiKeyUsage)
      .where(where)
      .groupBy(apiKeyUsage.country)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    dailySeries(keyId, CHART_DAYS),
  ]);
  return { endpoints, ips, countries, daily };
}

/** Recent raw rows for one key. */
export async function usageRecent(keyId: string, limit = 50) {
  return db
    .select()
    .from(apiKeyUsage)
    .where(eq(apiKeyUsage.keyId, keyId))
    .orderBy(desc(apiKeyUsage.createdAt))
    .limit(Math.min(limit, 200));
}

const SPIKE_MIN_REQUESTS = 20;
const SPIKE_MIN_RATE = 0.2;
const SPIKE_FACTOR = 2;

export type UsageAnomalies = {
  /** Countries seen in the last 24h that never appeared in the 30 days before. */
  newCountries: string[];
  /** 24h error rate vs the 7-day baseline when it looks like a spike. */
  errorSpike: { rate24h: number; rate7d: number } | null;
};

/** Cheap anomaly markers for the detail drawer: new origin country, 4xx/5xx spike. */
export async function usageAnomalies(keyId: string): Promise<UsageAnomalies> {
  const day = new Date(Date.now() - 86_400_000);
  const month = new Date(Date.now() - 31 * 86_400_000);
  // Raw sql fragments get no column type mapping, so dates go in as ISO strings.
  const dayTs = sql`${day.toISOString()}::timestamp`;
  const [recent, baseline, [rates]] = await Promise.all([
    db
      .selectDistinct({ country: apiKeyUsage.country })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, day))),
    db
      .selectDistinct({ country: apiKeyUsage.country })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.createdAt, month),
          sql`${apiKeyUsage.createdAt} < ${dayTs}`,
        ),
      ),
    db
      .select({
        n24: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= ${dayTs})::int`,
        e24: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= ${dayTs} and ${apiKeyUsage.status} >= 400)::int`,
        // Baseline excludes the last 24h so a spike is compared against the days before it.
        n7: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} < ${dayTs})::int`,
        e7: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} < ${dayTs} and ${apiKeyUsage.status} >= 400)::int`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.createdAt, new Date(Date.now() - 7 * 86_400_000)),
        ),
      ),
  ]);
  const known = new Set(baseline.map((r) => r.country).filter(Boolean));
  const newCountries = recent
    .map((r) => r.country)
    .filter((c): c is string => Boolean(c) && !known.has(c));
  // Only flag when there is a baseline to compare against (older than 24h).
  const hasBaseline = known.size > 0 || baseline.length > 0;
  const rate24h = rates && rates.n24 > 0 ? rates.e24 / rates.n24 : 0;
  const rate7d = rates && rates.n7 > 0 ? rates.e7 / rates.n7 : 0;
  const spike =
    rates &&
    rates.n24 >= SPIKE_MIN_REQUESTS &&
    rate24h >= SPIKE_MIN_RATE &&
    rate24h >= rate7d * SPIKE_FACTOR;
  return {
    newCountries: hasBaseline ? newCountries : [],
    errorSpike: spike ? { rate24h, rate7d } : null,
  };
}
