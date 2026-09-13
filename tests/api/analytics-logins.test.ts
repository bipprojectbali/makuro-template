import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({ user: { id: 'u-test' }, role: 'super-admin' }),
}));

import { eq, inArray } from 'drizzle-orm';
import { analyticsApi } from '../../server/api/analytics';
import { buildLoginWhere, toLoginCsv } from '../../server/api/analytics-logins.query';
import { db } from '../../server/db';
import { loginLog, user } from '../../server/db/schema';

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

const TAG = `lt-${crypto.randomUUID().slice(0, 8)}`;
const userId = `login-user-${TAG}`;
const ids: string[] = [];
type Row = {
  id: string;
  ip: string | null;
  method: string | null;
  deviceType: string | null;
  userName: string | null;
};

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: `Login Tester ${TAG}`,
    email: `${userId}@test.local`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const rows = await db
    .insert(loginLog)
    .values([
      {
        userId,
        ip: '30.1.1.1',
        method: 'email',
        country: 'ID',
        city: 'Jakarta',
        browser: 'Chrome',
        os: 'macOS',
        deviceType: 'desktop',
      },
      {
        userId,
        ip: '30.1.1.2',
        method: 'google',
        country: 'SG',
        browser: 'Safari',
        os: 'iOS',
        deviceType: 'mobile',
      },
      {
        userId,
        ip: '30.1.1.3',
        method: 'impersonation',
        deviceType: 'desktop',
        createdAt: new Date(Date.now() - 10 * 86_400_000),
      },
    ])
    .returning({ id: loginLog.id });
  ids.push(...rows.map((r) => r.id));
});

afterAll(async () => {
  // user cascade removes remaining login rows
  await db
    .delete(user)
    .where(eq(user.id, userId))
    .catch(() => {});
});

describe('GET /analytics/login-logs', () => {
  test('returns enriched rows joined with the user', async () => {
    const { status, body } = await getJson('/analytics/login-logs', { userId });
    expect(status).toBe(200);
    expect(body.total).toBe(3);
    const row = (body.rows as Array<Record<string, unknown>>).find((r) => r.ip === '30.1.1.1');
    expect(row).toMatchObject({
      method: 'email',
      country: 'ID',
      city: 'Jakarta',
      browser: 'Chrome',
      deviceType: 'desktop',
    });
    expect(row?.userName).toBe(`Login Tester ${TAG}`);
    expect(row?.userEmail).toBe(`${userId}@test.local`);
  });

  test('filters by method, device, country and days', async () => {
    expect(
      (
        (await getJson('/analytics/login-logs', { userId, method: 'google' })).body.rows as Row[]
      ).map((r) => r.ip),
    ).toEqual(['30.1.1.2']);
    expect((await getJson('/analytics/login-logs', { userId, device: 'desktop' })).body.total).toBe(
      2,
    );
    expect(
      ((await getJson('/analytics/login-logs', { userId, country: 'id' })).body.rows as Row[])[0]
        .ip,
    ).toBe('30.1.1.1');
    expect((await getJson('/analytics/login-logs', { userId, days: '7' })).body.total).toBe(2);
  });

  test('search matches user email, method and city', async () => {
    expect(
      (await getJson('/analytics/login-logs', { search: `${userId}@test.local` })).body.total,
    ).toBe(3);
    const byMethod = (await getJson('/analytics/login-logs', { userId, search: 'impersonation' }))
      .body.rows as Row[];
    expect(byMethod.map((r) => r.ip)).toEqual(['30.1.1.3']);
  });

  test('stats include totals and breakdowns', async () => {
    const { body } = await getJson('/analytics/login-logs/stats');
    expect((body.total as number) >= 3).toBe(true);
    expect(typeof body.uniqueUsers).toBe('number');
    expect((body.impersonations as number) >= 1).toBe(true);
    const users = body.topUsers as Array<{ userId: string; name: string; count: number }>;
    expect(Array.isArray(users)).toBe(true);
    const methods = body.topMethods as Array<{ key: string }>;
    expect(methods.some((m) => m.key === 'email')).toBe(true);
  });

  test('export returns CSV limited to the filter', async () => {
    const res = await get('/analytics/login-logs/export', { userId, method: 'email' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const lines = (await res.text()).replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].startsWith('createdAt,userId,userName,userEmail,method')).toBe(true);
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('30.1.1.1');
  });

  test('bulk DELETE removes only the given ids', async () => {
    const [keep, ...remove] = ids;
    const res = await app.handle(
      new Request('http://localhost/analytics/login-logs', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: remove }),
      }),
    );
    expect(((await res.json()) as { deleted: number }).deleted).toBe(2);
    const left = await db
      .select({ id: loginLog.id })
      .from(loginLog)
      .where(inArray(loginLog.id, ids));
    expect(left.map((r) => r.id)).toEqual([keep]);
  });
});

describe('login query helpers (pure)', () => {
  test('buildLoginWhere is undefined without filters', () => {
    expect(buildLoginWhere({})).toBeUndefined();
    expect(buildLoginWhere({ method: 'email' })).toBeDefined();
  });

  test('toLoginCsv escapes and serializes', () => {
    const csv = toLoginCsv([
      { createdAt: new Date('2026-01-01T00:00:00Z'), userName: 'A, B', userAgent: 'x"y' },
    ]);
    const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(header.split(',').length).toBe(16);
    expect(row).toContain('"A, B"');
    expect(row).toContain('"x""y"');
  });
});
