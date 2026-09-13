import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({ user: { id: 'u-test' }, role: 'super-admin' }),
}));

import { inArray } from 'drizzle-orm';
import { analyticsApi } from '../../server/api/analytics';
import {
  buildRateLimitWhere,
  listRateLimits,
  toRateLimitCsv,
} from '../../server/api/analytics-ratelimits.query';
import { countRateLimitLastHour } from '../../server/api/analytics-ratelimits.stats.query';
import { db } from '../../server/db';
import { rateLimitLog } from '../../server/db/schema';

const app = new Elysia().use(analyticsApi);
async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return app.handle(new Request(url.toString()));
}
async function getJson(path: string, params: Record<string, string> = {}) {
  const res = await get(path, params);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const TAG = `rl-${crypto.randomUUID().slice(0, 8)}`;
const ids: string[] = [];
type Row = { ip: string | null; path: string; method: string | null };

beforeAll(async () => {
  const rows = await db
    .insert(rateLimitLog)
    .values([
      {
        ip: '40.1.1.1',
        path: `/api/${TAG}/a`,
        method: 'GET',
        country: 'ID',
        city: 'Jakarta',
        browser: 'Chrome',
        deviceType: 'desktop',
      },
      {
        ip: '40.1.1.1',
        path: `/api/${TAG}/a`,
        method: 'POST',
        country: 'ID',
        deviceType: 'desktop',
      },
      {
        ip: '40.1.1.2',
        path: `/api/${TAG}/b`,
        method: 'GET',
        country: 'SG',
        deviceType: 'mobile',
        createdAt: new Date(Date.now() - 10 * 86_400_000),
      },
    ])
    .returning({ id: rateLimitLog.id });
  ids.push(...rows.map((r) => r.id));
});

afterAll(async () => {
  if (ids.length)
    await db
      .delete(rateLimitLog)
      .where(inArray(rateLimitLog.id, ids))
      .catch(() => {});
});

describe('GET /analytics/rate-limit-logs', () => {
  test('returns enriched rows and filters by ip/path/method/device/country/days', async () => {
    const all = await getJson('/analytics/rate-limit-logs', { search: TAG });
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    const row = (all.body.rows as Array<Record<string, unknown>>).find((r) => r.method === 'POST');
    expect(row).toMatchObject({ ip: '40.1.1.1', country: 'ID', deviceType: 'desktop' });
    expect(
      (
        (await getJson('/analytics/rate-limit-logs', { search: TAG, ip: '40.1.1.2' })).body
          .rows as Row[]
      ).length,
    ).toBe(1);
    expect(
      (await getJson('/analytics/rate-limit-logs', { search: TAG, path: `/api/${TAG}/a` })).body
        .total,
    ).toBe(2);
    expect(
      (
        (await getJson('/analytics/rate-limit-logs', { search: TAG, method: 'post' })).body
          .rows as Row[]
      )[0].method,
    ).toBe('POST');
    expect(
      (await getJson('/analytics/rate-limit-logs', { search: TAG, device: 'mobile' })).body.total,
    ).toBe(1);
    expect(
      (await getJson('/analytics/rate-limit-logs', { search: TAG, country: 'sg' })).body.total,
    ).toBe(1);
    expect(
      (await getJson('/analytics/rate-limit-logs', { search: TAG, days: '7' })).body.total,
    ).toBe(2);
  });

  test('stats expose totals, top offenders and limiter config', async () => {
    const { body } = await getJson('/analytics/rate-limit-logs/stats');
    expect((body.total as number) >= 3).toBe(true);
    const ips = body.topIps as Array<{ key: string; count: number }>;
    expect(ips.some((i) => i.key === '40.1.1.1' && i.count >= 2)).toBe(true);
    const config = body.config as { limit: number; windowMs: number; excludePrefixes: string[] };
    expect(config.limit).toBeGreaterThan(0);
    expect(config.windowMs).toBeGreaterThan(0);
    expect(config.excludePrefixes).toContain('/api/auth/');
  });

  test('countRateLimitLastHour counts only fresh rows', async () => {
    // Two seeded rows are fresh, the third is 10 days old.
    expect(await countRateLimitLastHour()).toBeGreaterThanOrEqual(2);
  });

  test('export returns CSV with the filter applied', async () => {
    const res = await get('/analytics/rate-limit-logs/export', { search: TAG, ip: '40.1.1.1' });
    expect(res.headers.get('content-type')).toContain('text/csv');
    const lines = (await res.text()).replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].startsWith('createdAt,ip,method,path')).toBe(true);
    expect(lines.length).toBe(3);
  });

  test('bulk DELETE removes the given ids only', async () => {
    const [keep, ...remove] = ids;
    const res = await app.handle(
      new Request('http://localhost/analytics/rate-limit-logs', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: remove }),
      }),
    );
    expect(((await res.json()) as { deleted: number }).deleted).toBe(2);
    const left = await db
      .select({ id: rateLimitLog.id })
      .from(rateLimitLog)
      .where(inArray(rateLimitLog.id, ids));
    expect(left.map((r) => r.id)).toEqual([keep]);
    ids.splice(0, ids.length, keep);
  });
});

describe('listRateLimits (shared by API + SSR loader)', () => {
  test('mirrors GET /rate-limit-logs', async () => {
    const r = await listRateLimits({ search: TAG, limit: '10' });
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.rows.every((x) => x.path.includes(TAG))).toBe(true);
  });
});

describe('rate-limit query helpers (pure)', () => {
  test('buildRateLimitWhere is undefined without filters', () => {
    expect(buildRateLimitWhere({})).toBeUndefined();
    expect(buildRateLimitWhere({ ip: '1.1.1.1' })).toBeDefined();
  });

  test('toRateLimitCsv escapes and serializes', () => {
    const csv = toRateLimitCsv([
      { createdAt: new Date('2026-01-01T00:00:00Z'), path: '/a,b', userAgent: 'x"y' },
    ]);
    const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(header.split(',').length).toBe(16);
    expect(row).toContain('"/a,b"');
    expect(row).toContain('"x""y"');
  });
});
