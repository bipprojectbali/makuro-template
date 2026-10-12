/** Demo foundation: settings parsing, isDemo on the actor, seed data cascading with the user. */
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { auth } from '../server/auth';
import { db } from '../server/db';
import { post, user } from '../server/db/schema';
import { seedDemo } from '../server/demo/seed';
import { resolveActor } from '../server/guard';
import * as rolesMod from '../server/roles';
import { DEMO_DEFAULTS, effectiveDemoTtlHours, parseDemo } from '../server/settings-demo';

const ID = `demo-${crypto.randomUUID().slice(0, 8)}`;
const req = () => new Request('http://localhost/api/app/whoami');

afterAll(async () => {
  await db.delete(user).where(eq(user.id, ID));
});

describe('demo settings', () => {
  test('defaults: off, 24h TTL', () => {
    const s = parseDemo(null);
    expect(s).toEqual({ enabled: false, ttlHours: null });
    expect(effectiveDemoTtlHours(s)).toBe(DEMO_DEFAULTS.ttlHours);
    expect(effectiveDemoTtlHours({ enabled: true, ttlHours: 2 })).toBe(2);
  });
});

describe('resolveActor isDemo', () => {
  test('anonymous session user → isDemo true; regular → false', async () => {
    const role = spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => 'user');
    const base = { id: ID, name: 'x', email: 'x@test.local', banned: false };
    const session = spyOn(auth.api, 'getSession');
    try {
      session.mockImplementation((async () => ({
        user: { ...base, isAnonymous: true },
      })) as unknown as typeof auth.api.getSession);
      expect((await resolveActor(req()))?.isDemo).toBe(true);
      session.mockImplementation((async () => ({
        user: { ...base, isAnonymous: false },
      })) as unknown as typeof auth.api.getSession);
      expect((await resolveActor(req()))?.isDemo).toBe(false);
    } finally {
      session.mockRestore();
      role.mockRestore();
    }
  });
});

describe('seedDemo', () => {
  test('creates sample rows that are removed with the demo user', async () => {
    const now = new Date();
    await db.insert(user).values({
      id: ID,
      name: 'Pengunjung Demo',
      email: `${ID}@anonymous.placeholder.invalid`,
      emailVerified: false,
      role: 'user',
      isAnonymous: true,
      createdAt: now,
      updatedAt: now,
    });
    await seedDemo(ID);
    const rows = await db.select().from(post).where(eq(post.authorId, ID));
    expect(rows.length).toBeGreaterThan(0);
    await db.delete(user).where(eq(user.id, ID));
    expect(await db.select().from(post).where(eq(post.authorId, ID))).toHaveLength(0);
  });
});
