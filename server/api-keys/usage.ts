/**
 * Per-request usage log for API keys. Rows are buffered in memory and flushed
 * in one insert every few seconds so tracking never adds a DB round-trip to
 * the request path. Query helpers feed the console.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { apiKeyUsage, apikey } from '../db/schema';
import { logger } from '../logger';

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
  return row ?? { total: 0, last24h: 0, last7d: 0, errors24h: 0, avgMs: 0 };
}

/** Top endpoints, IPs, countries and daily counts for one key (last N days). */
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
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${apiKeyUsage.createdAt}), 'YYYY-MM-DD')`,
        count,
        errors: sql<number>`count(*) filter (where ${apiKeyUsage.status} >= 400)::int`,
      })
      .from(apiKeyUsage)
      .where(where)
      .groupBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`)
      .orderBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`),
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
