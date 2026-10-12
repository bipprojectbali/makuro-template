import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { eq, inArray, like } from 'drizzle-orm';
import { adminUserStats, listAdminUsers } from '../server/api/admin-users.query';
import { db } from '../server/db';
import { post, user } from '../server/db/schema';
import { purgeExpiredDemoUsers } from '../server/demo/cleanup';
import * as settingsMod from '../server/settings';
import { getDemo, upsertDemo } from '../server/settings-demo';
import { devSidebarBadges } from '../server/sidebar-badges';

const TAG = `dc-${crypto.randomUUID().slice(0, 8)}`;
const HOUR = 3_600_000;
const NOW = new Date();
const ago = (h: number) => new Date(NOW.getTime() - h * HOUR);
const original = await getDemo();

async function seedUser(suffix: string, isAnonymous: boolean, createdAt: Date) {
  const id = `${TAG}-${suffix}`;
  await db.insert(user).values({
    id,
    name: `User ${id}`,
    email: `${id}@test.local`,
    emailVerified: false,
    isAnonymous,
    createdAt,
    updatedAt: createdAt,
  });
  await db.insert(post).values({ title: `Post ${id}`, authorId: id });
  return id;
}

const remaining = async () =>
  (
    await db
      .select({ id: user.id })
      .from(user)
      .where(like(user.id, `${TAG}-%`))
  ).map((r) => r.id);

beforeEach(() => upsertDemo({ enabled: false, ttlHours: null }));
afterEach(async () => {
  await db.delete(user).where(like(user.id, `${TAG}-%`));
});
afterAll(() => upsertDemo(original));

describe('purgeExpiredDemoUsers', () => {
  test('deletes expired anonymous users with their posts, keeps fresh and real users', async () => {
    const expired = await seedUser('expired', true, ago(25));
    const fresh = await seedUser('fresh', true, ago(1));
    const real = await seedUser('real', false, ago(100));

    expect(await purgeExpiredDemoUsers(NOW)).toBe(1);
    expect((await remaining()).sort()).toEqual([fresh, real].sort());
    const posts = await db
      .select({ authorId: post.authorId })
      .from(post)
      .where(inArray(post.authorId, [expired, fresh, real]));
    expect(posts.map((p) => p.authorId).sort()).toEqual([fresh, real].sort());
  });

  test('honors a custom ttlHours even when demo is disabled', async () => {
    await upsertDemo({ enabled: false, ttlHours: 2 });
    await seedUser('three-hours', true, ago(3));
    const kept = await seedUser('one-hour', true, ago(1));

    expect(await purgeExpiredDemoUsers(NOW)).toBe(1);
    expect(await remaining()).toEqual([kept]);
  });
});

describe('demo users are hidden from admin numbers', () => {
  test('admin list and stats exclude anonymous users', async () => {
    const before = await adminUserStats();
    const demo = await seedUser('hidden', true, NOW);

    const list = await listAdminUsers({ search: TAG, limit: '100' });
    expect(list.users.map((u) => u.id)).not.toContain(demo);
    expect(list.total).toBe(0);
    expect((await adminUserStats()).total).toBe(before.total);
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, demo));
    expect(row?.id).toBe(demo);
  });

  test('/dev settings badge shows the active demo count', async () => {
    const spy = spyOn(settingsMod, 'settingsOverview').mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof settingsMod.settingsOverview>>,
    );
    try {
      const base = (await devSidebarBadges({ fresh: true }))['/dev/settings']?.value ?? 0;
      await seedUser('badge-a', true, NOW);
      await seedUser('badge-b', true, NOW);
      const badges = await devSidebarBadges({ fresh: true });
      expect(badges['/dev/settings']).toMatchObject({ value: base + 2, tone: 'info' });
    } finally {
      spy.mockRestore();
    }
  });
});
