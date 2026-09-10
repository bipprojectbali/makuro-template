import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { mock } from 'bun:test';
import Elysia from 'elysia';

// Hoist mock before analytics.ts resolves its guard import.
// bun:test hoists mock.module() calls above static imports automatically.
mock.module('../guard', () => ({
  requireRole: async () => ({ user: { id: 'u-test' }, role: 'super-admin' }),
}));

import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { loginLog, rateLimitLog, user, visitLog } from '../db/schema';
import { analyticsApi, pageParams } from './analytics';

const app = new Elysia().use(analyticsApi);

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await app.handle(new Request(url.toString()));
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> };
}

async function httpDelete(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await app.handle(new Request(url.toString(), { method: 'DELETE' }));
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> };
}

// ─── pageParams unit tests (no DB needed) ────────────────────────────────────

describe('pageParams', () => {
  test('defaults: page=1, limit=25, offset=0, order=desc', () => {
    const p = pageParams({});
    expect(p.page).toBe(1);
    expect(p.limit).toBe(25);
    expect(p.offset).toBe(0);
    expect(p.order).toBe(desc);
  });

  test('page=3, limit=10 → offset=20', () => {
    const p = pageParams({ page: '3', limit: '10' });
    expect(p.page).toBe(3);
    expect(p.limit).toBe(10);
    expect(p.offset).toBe(20);
  });

  test('limit clamps to 100 max', () => {
    expect(pageParams({ limit: '999' }).limit).toBe(100);
  });

  test('sort=asc returns asc function', () => {
    expect(pageParams({ sort: 'asc' }).order).toBe(asc);
  });

  test('page=0 clamps to 1', () => {
    const p = pageParams({ page: '0' });
    expect(p.page).toBe(1);
    expect(p.offset).toBe(0);
  });
});

// ─── Visit endpoints ──────────────────────────────────────────────────────────

describe('GET /analytics/visits', () => {
  const ids: string[] = [];

  beforeEach(async () => {
    const rows = await db
      .insert(visitLog)
      .values([
        { path: '/page-a', ip: '10.1.1.1', isBot: false },
        { path: '/page-b', ip: '10.1.1.2', isBot: true, botKind: 'search:google' },
      ])
      .returning({ id: visitLog.id });
    ids.push(...rows.map((r) => r.id));
  });

  afterEach(async () => {
    for (const id of ids.splice(0)) {
      await db.delete(visitLog).where(eq(visitLog.id, id)).catch(() => {});
    }
  });

  test('returns 200 with rows array and total count', async () => {
    const { status, body } = await get('/analytics/visits');
    expect(status).toBe(200);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.page).toBe(1);
  });

  test('search by IP filters results', async () => {
    const { body } = await get('/analytics/visits', { search: '10.1.1.1' });
    const rows = body.rows as Array<{ ip: string }>;
    expect(rows.every((r) => r.ip?.includes('10.1.1.1'))).toBe(true);
  });

  test('botsOnly=true returns only bot rows', async () => {
    const { body } = await get('/analytics/visits', { botsOnly: 'true' });
    const rows = body.rows as Array<{ isBot: boolean }>;
    expect(rows.every((r) => r.isBot === true)).toBe(true);
  });

  test('limit=1 returns exactly 1 row', async () => {
    const { body } = await get('/analytics/visits', { limit: '1' });
    const rows = body.rows as unknown[];
    expect(rows.length).toBe(1);
    expect(body.limit).toBe(1);
  });

  test('pagination: page 1 and page 2 return different rows', async () => {
    const { body: p1 } = await get('/analytics/visits', { limit: '1', page: '1' });
    const { body: p2 } = await get('/analytics/visits', { limit: '1', page: '2' });
    const r1 = (p1.rows as Array<{ id: string }>)[0];
    const r2 = (p2.rows as Array<{ id: string }>)[0];
    if (r1 && r2) expect(r1.id).not.toBe(r2.id);
  });
});

describe('DELETE /analytics/visits/:id', () => {
  let rowId = '';

  beforeEach(async () => {
    const [row] = await db
      .insert(visitLog)
      .values({ path: '/del-me', ip: '11.1.1.1', isBot: false })
      .returning({ id: visitLog.id });
    rowId = row.id;
  });

  afterEach(async () => {
    if (rowId) await db.delete(visitLog).where(eq(visitLog.id, rowId)).catch(() => {});
  });

  test('deletes the row and returns ok:true', async () => {
    const { status, body } = await httpDelete(`/analytics/visits/${rowId}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const remaining = await db.select().from(visitLog).where(eq(visitLog.id, rowId));
    expect(remaining.length).toBe(0);
    rowId = '';
  });

  test('returns 404 for non-existent id', async () => {
    const { status } = await httpDelete(
      '/analytics/visits/00000000-0000-0000-0000-000000000000',
    );
    expect(status).toBe(404);
  });
});

// ─── Rate limit log DELETE ────────────────────────────────────────────────────

describe('DELETE /analytics/rate-limit-logs/:id', () => {
  let rowId = '';

  beforeEach(async () => {
    const [row] = await db
      .insert(rateLimitLog)
      .values({ path: '/api/blocked', ip: '12.1.1.1' })
      .returning({ id: rateLimitLog.id });
    rowId = row.id;
  });

  afterEach(async () => {
    if (rowId) await db.delete(rateLimitLog).where(eq(rateLimitLog.id, rowId)).catch(() => {});
  });

  test('deletes the rate-limit row and returns ok:true', async () => {
    const { status, body } = await httpDelete(`/analytics/rate-limit-logs/${rowId}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    rowId = '';
  });
});

// ─── Login log DELETE (needs a real user for FK) ──────────────────────────────

describe('DELETE /analytics/login-logs/:id', () => {
  const testUserId = `test-user-${crypto.randomUUID()}`;
  let rowId = '';

  beforeAll(async () => {
    await db.insert(user).values({
      id: testUserId,
      name: 'Test User',
      email: `${testUserId}@test.local`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    // cascade delete removes related loginLog rows automatically
    await db.delete(user).where(eq(user.id, testUserId)).catch(() => {});
  });

  beforeEach(async () => {
    const [row] = await db
      .insert(loginLog)
      .values({ userId: testUserId, ip: '13.1.1.1' })
      .returning({ id: loginLog.id });
    rowId = row.id;
  });

  afterEach(async () => {
    if (rowId) await db.delete(loginLog).where(eq(loginLog.id, rowId)).catch(() => {});
  });

  test('deletes the login log row and returns ok:true', async () => {
    const { status, body } = await httpDelete(`/analytics/login-logs/${rowId}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    rowId = '';
  });
});

// ─── Purge endpoint ───────────────────────────────────────────────────────────

describe('DELETE /analytics/purge', () => {
  test('removes visit rows older than 30 days', async () => {
    const oldDate = new Date(Date.now() - 40 * 86_400_000);
    const [{ id }] = await db
      .insert(visitLog)
      .values({ path: '/old-page', isBot: false, createdAt: oldDate })
      .returning({ id: visitLog.id });

    const { status, body } = await httpDelete('/analytics/purge', { days: '30' });
    expect(status).toBe(200);
    expect((body.purgedVisits as number) >= 1).toBe(true);

    const rows = await db.select().from(visitLog).where(eq(visitLog.id, id));
    expect(rows.length).toBe(0);
  });

  test('does not remove recent rows when days=30', async () => {
    const [{ id }] = await db
      .insert(visitLog)
      .values({ path: '/new-page', isBot: false })
      .returning({ id: visitLog.id });

    await httpDelete('/analytics/purge', { days: '30' });

    const rows = await db.select().from(visitLog).where(eq(visitLog.id, id));
    expect(rows.length).toBe(1);

    await db.delete(visitLog).where(eq(visitLog.id, id));
  });

  test('days=0 removes all rows including recent', async () => {
    const [{ id }] = await db
      .insert(visitLog)
      .values({ path: '/recent-clear', isBot: false })
      .returning({ id: visitLog.id });

    const { status, body } = await httpDelete('/analytics/purge', { days: '0' });
    expect(status).toBe(200);
    expect((body.purgedVisits as number) >= 1).toBe(true);

    const rows = await db.select().from(visitLog).where(eq(visitLog.id, id));
    expect(rows.length).toBe(0);
  });
});
