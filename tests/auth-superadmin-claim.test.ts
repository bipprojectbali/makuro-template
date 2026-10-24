/**
 * Email sign-up must refuse addresses listed in SUPER_ADMIN_EMAILS: the role is
 * granted by email alone, so a self-chosen password must never create it.
 *
 * `superAdminEmails` is built when server/env.ts loads, so the test adds its own
 * address to the live set (the hook reads it per request) and removes it after.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { api } from '../server/api';
import { db } from '../server/db';
import { user } from '../server/db/schema';
import { superAdminEmails } from '../server/env';

const RESERVED = `owner-${crypto.randomUUID()}@test.local`;
const NORMAL = `normal-${crypto.randomUUID()}@test.local`;
const PASS = 'TestPass123!';

function signUp(email: string) {
  return api.handle(
    new Request('http://localhost/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASS, name: 'Claim Tester' }),
    }),
  );
}

beforeAll(() => {
  (superAdminEmails as Set<string>).add(RESERVED);
});

afterAll(async () => {
  (superAdminEmails as Set<string>).delete(RESERVED);
  await db
    .delete(user)
    .where(eq(user.email, NORMAL))
    .catch(() => {});
});

describe('POST /api/auth/sign-up/email — super-admin addresses', () => {
  test('rejects a SUPER_ADMIN_EMAILS address with 403 and creates no user row', async () => {
    const res = await signUp(RESERVED);
    expect(res.status).toBe(403);
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, RESERVED));
    expect(rows).toHaveLength(0);
  });

  test('comparison is case-insensitive', async () => {
    const mixed = RESERVED.replace('owner-', 'OwNeR-');
    expect(mixed).not.toBe(RESERVED);
    const res = await signUp(mixed);
    expect(res.status).toBe(403);
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, mixed));
    expect(rows).toHaveLength(0);
  });

  test('an ordinary address still signs up', async () => {
    const res = await signUp(NORMAL);
    expect(res.status).toBe(200);
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, NORMAL));
    expect(rows).toHaveLength(1);
  });
});
