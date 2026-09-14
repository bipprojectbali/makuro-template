/** Daily rollup + anomaly markers on top of real api_key_usage rows. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, eq, lt } from 'drizzle-orm';
import { dailySeries, lifetimeTotal, rollupUsage } from '../../server/api-keys/rollup';
import { createKey } from '../../server/api-keys/service';
import { usageAnomalies, usageBreakdown, usageSummary } from '../../server/api-keys/usage';
import { db } from '../../server/db';
import { apiKeyUsage, apiKeyUsageDaily, auditLog, user } from '../../server/db/schema';

const TAG = `roll-${crypto.randomUUID().slice(0, 8)}`;
const ownerId = `${TAG}-user`;
let keyId = '';
const DAY = 86_400_000;
const daysAgo = (n: number, hour = 12) => {
  const d = new Date(Date.now() - n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};
const row = (
  ago: number,
  status: number,
  extra: Partial<typeof apiKeyUsage.$inferInsert> = {},
) => ({
  keyId,
  method: 'GET',
  path: '/api/me/logins',
  status,
  ip: '203.0.113.5',
  country: 'ID',
  durationMs: 10,
  createdAt: daysAgo(ago),
  ...extra,
});

beforeAll(async () => {
  await db.insert(user).values({
    id: ownerId,
    name: 'Rollup User',
    email: `${ownerId}@test.local`,
    emailVerified: true,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const k = await createKey({
    name: 'rollup-key',
    ownerId,
    scopes: ['me:read'],
    expiresDays: 7,
    rateLimitMax: null,
    rateLimitWindowMs: null,
    allowedIps: null,
    note: null,
  });
  keyId = k.row.id;
  // 10 days ago: 3 ok + 1 error; 5 days ago: 2 ok (different path); today: 1 ok.
  await db
    .insert(apiKeyUsage)
    .values([
      row(10, 200),
      row(10, 200),
      row(10, 200),
      row(10, 500),
      row(5, 200, { path: '/api/posts' }),
      row(5, 200, { path: '/api/posts' }),
      row(0, 200),
    ]);
});
afterAll(async () => {
  await db
    .delete(auditLog)
    .where(eq(auditLog.targetType, 'apikey'))
    .catch(() => {});
  await db
    .delete(user)
    .where(eq(user.id, ownerId))
    .catch(() => {});
});

describe('rollupUsage', () => {
  test('aggregates per day/method/path and is idempotent', async () => {
    await rollupUsage(15);
    const first = await db.select().from(apiKeyUsageDaily).where(eq(apiKeyUsageDaily.keyId, keyId));
    expect(first.length).toBe(3);
    const old = first.find((r) => r.path === '/api/me/logins' && r.count === 4);
    expect(old?.errors).toBe(1);
    expect(old?.durationSumMs).toBe(40);
    await rollupUsage(15);
    const second = await db
      .select()
      .from(apiKeyUsageDaily)
      .where(eq(apiKeyUsageDaily.keyId, keyId));
    expect(second.map((r) => r.count).sort()).toEqual(first.map((r) => r.count).sort());
  });
  test('counts never shrink after raw rows are retained away', async () => {
    await db
      .delete(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), lt(apiKeyUsage.createdAt, daysAgo(8))));
    await rollupUsage(15);
    const rows = await db.select().from(apiKeyUsageDaily).where(eq(apiKeyUsageDaily.keyId, keyId));
    expect(rows.find((r) => r.count === 4)?.errors).toBe(1);
    // Lifetime total = rollup for old days (4 + 2) + raw tail (1).
    expect(await lifetimeTotal(keyId)).toBe(7);
    expect((await usageSummary(keyId)).total).toBe(7);
  });
  test('dailySeries merges rollup (old days) with raw rows (last two days)', async () => {
    const series = await dailySeries(keyId, 30);
    expect(series.length).toBe(3);
    expect(series[0].count).toBe(4);
    expect(series[0].errors).toBe(1);
    expect(series[2].day).toBe(new Date().toISOString().slice(0, 10));
    expect(series[2].count).toBe(1);
    const breakdown = await usageBreakdown(keyId);
    expect(breakdown.daily.length).toBe(3);
  });
});

describe('usageAnomalies', () => {
  test('flags a new country and a 4xx/5xx spike against the baseline', async () => {
    const quiet = await usageAnomalies(keyId);
    expect(quiet.newCountries).toEqual([]);
    expect(quiet.errorSpike).toBeNull();
    // Today: 25 requests from a country never seen before, 20 of them errors.
    await db
      .insert(apiKeyUsage)
      .values(
        Array.from({ length: 25 }, (_, i) =>
          row(0, i < 20 ? 403 : 200, { country: 'RU', createdAt: new Date() }),
        ),
      );
    const loud = await usageAnomalies(keyId);
    expect(loud.newCountries).toEqual(['RU']);
    expect(loud.errorSpike).not.toBeNull();
    expect(loud.errorSpike?.rate24h).toBeGreaterThan(0.5);
  });
});
