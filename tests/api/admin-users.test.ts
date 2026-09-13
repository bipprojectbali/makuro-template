import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { adminUserStats, buildUserWhere, listAdminUsers } from '../../server/api/admin-users.query';
import { db } from '../../server/db';
import { account, loginLog, user } from '../../server/db/schema';
import { devOverview } from '../../server/dev-overview';

const TAG = `au-${crypto.randomUUID().slice(0, 8)}`;
const ids = [`${TAG}-alice`, `${TAG}-bob`, `${TAG}-carol`];

beforeAll(async () => {
  const old = new Date(Date.now() - 40 * 86_400_000);
  await db.insert(user).values([
    {
      id: ids[0],
      name: `Alice ${TAG}`,
      email: `${ids[0]}@test.local`,
      emailVerified: true,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: ids[1],
      name: `Bob ${TAG}`,
      email: `${ids[1]}@test.local`,
      emailVerified: false,
      role: null,
      banned: true,
      banReason: 'spam',
      createdAt: old,
      updatedAt: old,
    },
    {
      id: ids[2],
      name: `Carol ${TAG}`,
      email: `${ids[2]}@test.local`,
      emailVerified: false,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  await db.insert(loginLog).values([
    { userId: ids[0], ip: '1.1.1.1', method: 'email' },
    { userId: ids[0], ip: '1.1.1.1', method: 'google' },
  ]);
  await db.insert(account).values({
    id: `${TAG}-acc`,
    accountId: 'x',
    providerId: 'google',
    userId: ids[0],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterAll(async () => {
  await db
    .delete(user)
    .where(inArray(user.id, ids))
    .catch(() => {});
});

describe('listAdminUsers', () => {
  test('enriches rows with login count, last login and providers', async () => {
    const r = await listAdminUsers({ search: TAG, sort: 'name' });
    expect(r.total).toBe(3);
    const alice = r.users.find((u) => u.id === ids[0]);
    expect(alice?.loginCount).toBe(2);
    expect(alice?.lastLoginAt).not.toBeNull();
    expect(alice?.providers).toEqual(['google']);
    expect(alice?.activeSessions).toBe(0);
    const bob = r.users.find((u) => u.id === ids[1]);
    expect(bob?.providers).toEqual([]);
    expect(bob?.banReason).toBe('spam');
  });

  test('filters by role (null role counts as user), status and join period', async () => {
    expect(
      (await listAdminUsers({ search: TAG, role: 'user' })).users.map((u) => u.id).sort(),
    ).toEqual([ids[1], ids[2]].sort());
    expect((await listAdminUsers({ search: TAG, role: 'admin' })).users.map((u) => u.id)).toEqual([
      ids[0],
    ]);
    expect(
      (await listAdminUsers({ search: TAG, status: 'banned' })).users.map((u) => u.id),
    ).toEqual([ids[1]]);
    expect((await listAdminUsers({ search: TAG, status: 'active' })).total).toBe(2);
    expect((await listAdminUsers({ search: TAG, days: '7' })).total).toBe(2);
  });

  test('sorts by last login with never-logged-in users last, and paginates', async () => {
    const r = await listAdminUsers({ search: TAG, sort: 'lastLogin' });
    expect(r.users[0].id).toBe(ids[0]);
    const p = await listAdminUsers({ search: TAG, limit: '2', page: '2', sort: 'name' });
    expect(p.users.length).toBe(1);
    expect(p.page).toBe(2);
    expect(buildUserWhere({})).toBeUndefined();
  });
});

describe('adminUserStats / devOverview', () => {
  test('stats count roles, bans, verification and recent signups', async () => {
    const s = await adminUserStats();
    expect(s.total).toBeGreaterThanOrEqual(3);
    expect(s.admins).toBeGreaterThanOrEqual(1);
    expect(s.banned).toBeGreaterThanOrEqual(1);
    expect(s.verified).toBeGreaterThanOrEqual(1);
    expect(s.new7d).toBeGreaterThanOrEqual(2);
    expect(typeof s.active24h).toBe('number');
  });

  test('devOverview aggregates every section', async () => {
    const o = await devOverview();
    expect(o.users.total).toBeGreaterThanOrEqual(3);
    expect(typeof o.visits.last24h).toBe('number');
    expect(typeof o.logins.last24h).toBe('number');
    expect(o.rateLimits.config.limit).toBeGreaterThan(0);
    expect(Array.isArray(o.recentLogins)).toBe(true);
    expect(o.recentLogins.length).toBeLessThanOrEqual(5);
    expect(typeof o.runtime.googleAuthConfigured).toBe('boolean');
    const alice = await db.select({ id: user.id }).from(user).where(eq(user.id, ids[0]));
    expect(alice.length).toBe(1);
  });
});
