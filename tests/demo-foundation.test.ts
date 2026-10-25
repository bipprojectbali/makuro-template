/** Demo foundation: settings parsing, isDemo on the actor, seed data cascading with the user. */
import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { auth } from '../server/auth';
import { db } from '../server/db';
import { post, user } from '../server/db/schema';
import { seedDemo } from '../server/demo/seed';
import { resolveActor } from '../server/guard';
import * as rolesMod from '../server/roles';
import type { SettingsRow } from '../server/settings.core';
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

describe('demo build forces demo mode on', () => {
  // test-only: parseDemo reads just these two columns.
  const row = (demoEnabled: boolean, demoTtlHours: number | null = null) =>
    ({ demoEnabled, demoTtlHours }) as SettingsRow;
  const saved = process.env.MAKURO_DEMO;

  afterEach(() => {
    // Leaking this into other test files in the same run would break unrelated tests.
    if (saved === undefined) delete process.env.MAKURO_DEMO;
    else process.env.MAKURO_DEMO = saved;
  });

  test('without the flag the stored row decides', () => {
    delete process.env.MAKURO_DEMO;
    expect(parseDemo(null).enabled).toBe(false);
    expect(parseDemo(row(true)).enabled).toBe(true);
    expect(parseDemo(row(false)).enabled).toBe(false);
  });

  test('with the flag no row can switch it off, TTL still comes from the row', () => {
    process.env.MAKURO_DEMO = '1';
    expect(parseDemo(null).enabled).toBe(true);
    expect(parseDemo(row(false))).toEqual({ enabled: true, ttlHours: null });
    expect(parseDemo(row(false, 6))).toEqual({ enabled: true, ttlHours: 6 });
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
