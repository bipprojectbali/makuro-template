import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({
    user: { id: 'u-test', email: 'u-test@test.local' },
    role: 'super-admin',
  }),
}));

import { eq } from 'drizzle-orm';
import { sessionsApi } from '../../server/api/sessions';
import { buildSessionWhere } from '../../server/api/sessions.query';
import { db } from '../../server/db';
import { auditLog, session, user } from '../../server/db/schema';

const app = new Elysia().use(sessionsApi);
const TAG = `ses-${crypto.randomUUID().slice(0, 8)}`;
const uid = `${TAG}-user`;
const ids = { a: `${TAG}-a`, b: `${TAG}-b`, expired: `${TAG}-x` };

async function getJson(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await app.handle(new Request(url.toString()));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: uid,
    name: `Sess ${TAG}`,
    email: `${uid}@test.local`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(session).values([
    {
      id: ids.a,
      token: `${TAG}-tok-a`,
      userId: uid,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 86_400_000 * 7),
      ipAddress: '5.5.5.5',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/124.0.0.0 Safari/537.36',
    },
    {
      id: ids.b,
      token: `${TAG}-tok-b`,
      userId: uid,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 3_600_000),
      impersonatedBy: 'admin-x',
    },
    {
      id: ids.expired,
      token: `${TAG}-tok-x`,
      userId: uid,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() - 1000),
    },
  ]);
});
afterAll(async () => {
  await db
    .delete(auditLog)
    .where(eq(auditLog.targetId, uid))
    .catch(() => {});
  await db
    .delete(user)
    .where(eq(user.id, uid))
    .catch(() => {});
});

describe('GET /sessions', () => {
  test('lists active sessions by default, never exposes tokens', async () => {
    const { body } = await getJson('/sessions', { userId: uid });
    expect(body.total).toBe(2);
    const row = (body.rows as Array<Record<string, unknown>>)[0];
    expect(row.token).toBeUndefined();
    expect(row.userEmail).toBe(`${uid}@test.local`);
  });
  test('status/impersonated/search filters', async () => {
    expect((await getJson('/sessions', { userId: uid, status: 'expired' })).body.total).toBe(1);
    expect((await getJson('/sessions', { userId: uid, status: 'all' })).body.total).toBe(3);
    expect((await getJson('/sessions', { userId: uid, impersonated: 'true' })).body.total).toBe(1);
    expect((await getJson('/sessions', { search: '5.5.5.5' })).body.total).toBeGreaterThanOrEqual(
      1,
    );
    expect(buildSessionWhere({ status: 'all' })).toBeUndefined();
  });
  test('stats', async () => {
    const { body } = await getJson('/sessions/stats');
    expect((body.active as number) >= 2).toBe(true);
    expect((body.impersonated as number) >= 1).toBe(true);
    expect((body.expiringSoon as number) >= 1).toBe(true);
  });
});

describe('DELETE /sessions', () => {
  test('revokes one session and audits it', async () => {
    const res = await app.handle(
      new Request(`http://localhost/sessions/${ids.b}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    expect((await getJson('/sessions', { userId: uid })).body.total).toBe(1);
    expect(
      (await app.handle(new Request(`http://localhost/sessions/${ids.b}`, { method: 'DELETE' })))
        .status,
    ).toBe(404);
  });
  test('revokes all sessions of a user except `keep`', async () => {
    const res = await app.handle(
      new Request(`http://localhost/sessions/user/${uid}?keep=${ids.a}`, { method: 'DELETE' }),
    );
    const body = (await res.json()) as { revoked: number };
    expect(body.revoked).toBe(1); // only the expired one remained besides a
    expect((await getJson('/sessions', { userId: uid, status: 'all' })).body.total).toBe(1);
    await new Promise((r) => setTimeout(r, 100));
    const audits = await db.select().from(auditLog).where(eq(auditLog.targetId, uid));
    expect(audits.length).toBeGreaterThanOrEqual(1);
    // Mocked actor has no user row: the entry survives with the email snapshot only.
    expect(audits[0].actorId).toBeNull();
    expect(audits[0].actorEmail).toBe('u-test@test.local');
  });
});
