import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({ user: { id: 'u-test' }, role: 'super-admin' }),
}));

import { eq, inArray } from 'drizzle-orm';
import { analyticsApi } from '../../server/api/analytics';
import { buildVisitWhere, toCsv } from '../../server/api/analytics-visits.query';
import { db } from '../../server/db';
import { visitLog } from '../../server/db/schema';

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

// Unique marker so assertions only look at rows seeded by this file.
const TAG = `vt-${crypto.randomUUID().slice(0, 8)}`;
type Row = {
  id: string;
  ip: string | null;
  country: string | null;
  deviceType: string | null;
  isBot: boolean;
};

describe('GET /analytics/visits — enriched filters', () => {
  const ids: string[] = [];

  beforeEach(async () => {
    const rows = await db
      .insert(visitLog)
      .values([
        {
          path: `/${TAG}/a`,
          ip: '10.9.9.1',
          isBot: false,
          country: 'ID',
          city: 'Jakarta',
          browser: 'Chrome',
          os: 'macOS',
          deviceType: 'desktop',
          referer: 'https://google.com/',
        },
        {
          path: `/${TAG}/b`,
          ip: '10.9.9.2',
          isBot: false,
          country: 'SG',
          browser: 'Safari',
          os: 'iOS',
          deviceType: 'mobile',
        },
        {
          path: `/${TAG}/c`,
          ip: '10.9.9.3',
          isBot: true,
          botKind: 'search:google',
          deviceType: 'bot',
          createdAt: new Date(Date.now() - 10 * 86_400_000),
        },
      ])
      .returning({ id: visitLog.id });
    ids.push(...rows.map((r) => r.id));
  });

  afterEach(async () => {
    const batch = ids.splice(0);
    if (batch.length) await db.delete(visitLog).where(inArray(visitLog.id, batch));
  });

  test('returns the enriched columns', async () => {
    const { body } = await getJson('/analytics/visits', { search: `${TAG}/a` });
    const row = (body.rows as Array<Record<string, unknown>>)[0];
    expect(row).toBeDefined();
    expect(row.country).toBe('ID');
    expect(row.city).toBe('Jakarta');
    expect(row.browser).toBe('Chrome');
    expect(row.os).toBe('macOS');
    expect(row.deviceType).toBe('desktop');
    expect(row.referer).toBe('https://google.com/');
  });

  test('country filter is case-insensitive and exact', async () => {
    const { body } = await getJson('/analytics/visits', { search: TAG, country: 'sg' });
    const rows = body.rows as Row[];
    expect(rows.length).toBe(1);
    expect(rows[0].country).toBe('SG');
  });

  test('type=human excludes bots, type=bot returns only bots', async () => {
    const humans = (await getJson('/analytics/visits', { search: TAG, type: 'human' })).body
      .rows as Row[];
    const bots = (await getJson('/analytics/visits', { search: TAG, type: 'bot' })).body
      .rows as Row[];
    expect(humans.length).toBe(2);
    expect(humans.every((r) => !r.isBot)).toBe(true);
    expect(bots.length).toBe(1);
    expect(bots[0].isBot).toBe(true);
  });

  test('device filter', async () => {
    const rows = (await getJson('/analytics/visits', { search: TAG, device: 'mobile' })).body
      .rows as Row[];
    expect(rows.map((r) => r.deviceType)).toEqual(['mobile']);
  });

  test('days=7 excludes the 10-day-old row', async () => {
    const { body } = await getJson('/analytics/visits', { search: TAG, days: '7' });
    expect(body.total).toBe(2);
    expect((body.rows as Row[]).every((r) => r.ip !== '10.9.9.3')).toBe(true);
  });

  test('search matches city and browser', async () => {
    expect(
      (await getJson('/analytics/visits', { search: 'Jakarta' })).body.total as number,
    ).toBeGreaterThanOrEqual(1);
    const rows = (await getJson('/analytics/visits', { search: 'Safari', country: 'SG' })).body
      .rows as Row[];
    expect(rows.some((r) => r.ip === '10.9.9.2')).toBe(true);
  });

  test('stats returns totals and breakdown lists', async () => {
    const { status, body } = await getJson('/analytics/visits/stats');
    expect(status).toBe(200);
    expect(typeof body.total).toBe('number');
    expect(typeof body.uniqueIps).toBe('number');
    expect(typeof body.last24h).toBe('number');
    expect((body.total as number) >= 3).toBe(true);
    const countries = body.topCountries as Array<{ key: string; count: number }>;
    expect(countries.some((c) => c.key === 'ID')).toBe(true);
    expect(countries.every((c) => c.key !== null)).toBe(true);
    expect(Array.isArray(body.devices)).toBe(true);
    expect(Array.isArray(body.topPaths)).toBe(true);
  });

  test('export returns CSV with header row and filtered rows', async () => {
    const res = await get('/analytics/visits/export', { search: TAG, type: 'human' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('visit-logs-');
    const text = await res.text();
    const lines = text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].startsWith('createdAt,ip,country')).toBe(true);
    expect(lines.length).toBe(3);
    expect(text).toContain('10.9.9.1');
    expect(text).not.toContain('10.9.9.3');
  });

  test('bulk DELETE removes the given ids only', async () => {
    const [keep, ...remove] = ids;
    const res = await app.handle(
      new Request('http://localhost/analytics/visits', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: remove }),
      }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { deleted: number }).deleted).toBe(2);
    const left = await db
      .select({ id: visitLog.id })
      .from(visitLog)
      .where(inArray(visitLog.id, ids));
    expect(left.map((r) => r.id)).toEqual([keep]);
    ids.splice(0, ids.length, keep);
  });

  test('bulk DELETE rejects an empty id list', async () => {
    const res = await app.handle(
      new Request('http://localhost/analytics/visits', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [] }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('buildVisitWhere / toCsv (pure)', () => {
  test('returns undefined when no filter is set', () => {
    expect(buildVisitWhere({})).toBeUndefined();
  });

  test('botsOnly=true is treated as type=bot', () => {
    expect(buildVisitWhere({ botsOnly: 'true' })).toBeDefined();
  });

  test('toCsv escapes quotes, commas and serializes dates as ISO', () => {
    const csv = toCsv([
      {
        createdAt: new Date('2026-01-02T03:04:05Z'),
        ip: '1.1.1.1',
        path: '/a,b',
        userAgent: 'He said "hi"',
      },
    ]);
    const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(header.split(',').length).toBe(18);
    expect(row).toContain('2026-01-02T03:04:05.000Z');
    expect(row).toContain('"/a,b"');
    expect(row).toContain('"He said ""hi"""');
  });
});
