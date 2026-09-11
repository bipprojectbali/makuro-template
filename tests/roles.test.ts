/**
 * Tests for resolveUserRole (server/roles.ts) — the request-path reconciler that
 * aligns a user's stored role with SUPER_ADMIN_EMAILS and persists only when the
 * role actually changes. Uses real DB rows with random emails that are never in
 * the env allowlist, so the "demote stale super-admin" and "keep role" branches
 * are deterministic regardless of the ambient SUPER_ADMIN_EMAILS value.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { user } from '../server/db/schema';
import { ROLES } from '../server/permissions';
import { resolveUserRole } from '../server/roles';

const created: string[] = [];

async function seedUser(role: string): Promise<{ id: string; email: string }> {
  const id = `roles-${crypto.randomUUID()}`;
  const email = `${id}@test.local`;
  await db.insert(user).values({
    id,
    name: id,
    email,
    emailVerified: false,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  created.push(id);
  return { id, email };
}

async function storedRole(id: string): Promise<string | null> {
  const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, id)).limit(1);
  return row?.role ?? null;
}

afterEach(async () => {
  for (const id of created.splice(0)) await db.delete(user).where(eq(user.id, id)).catch(() => {});
});

describe('resolveUserRole', () => {
  test('demotes a stale super-admin (email not in allowlist) and persists the change', async () => {
    const u = await seedUser(ROLES.SUPER_ADMIN);
    const resolved = await resolveUserRole({ id: u.id, email: u.email, role: ROLES.SUPER_ADMIN });
    expect(resolved).toBe(ROLES.USER);
    expect(await storedRole(u.id)).toBe(ROLES.USER);
  });

  test('keeps an admin role unchanged and does not rewrite it', async () => {
    const u = await seedUser(ROLES.ADMIN);
    const resolved = await resolveUserRole({ id: u.id, email: u.email, role: ROLES.ADMIN });
    expect(resolved).toBe(ROLES.ADMIN);
    expect(await storedRole(u.id)).toBe(ROLES.ADMIN);
  });

  test('normalizes an unknown stored role to user', async () => {
    const u = await seedUser('user');
    const resolved = await resolveUserRole({ id: u.id, email: u.email, role: 'legacy-editor' });
    expect(resolved).toBe(ROLES.USER);
  });
});
