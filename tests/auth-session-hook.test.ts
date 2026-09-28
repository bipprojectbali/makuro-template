import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { auth } from '../server/auth';
import { db } from '../server/db';
import { auditLog, loginLog, user } from '../server/db/schema';
import { logger } from '../server/logger';

const TAG = `ash-${crypto.randomUUID().slice(0, 8)}`;
const target = `${TAG}-target`;
const admin = `${TAG}-admin`;
type After = (session: Record<string, unknown>, ctx: unknown) => Promise<void>;
const after = auth.options.databaseHooks?.session?.create?.after as unknown as After;

function sessionFor(extra: Record<string, unknown> = {}) {
  return { userId: target, ipAddress: '::ffff:203.0.113.9', userAgent: 'hook-test', ...extra };
}

beforeAll(async () => {
  for (const id of [target, admin])
    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@test.local`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.actorId, admin));
  await db.delete(loginLog).where(eq(loginLog.userId, target));
  await db.delete(user).where(inArray(user.id, [target, admin]));
});

describe('session.create.after hook', () => {
  test('records a login_log row with the method taken from the auth path', async () => {
    await after(sessionFor(), { path: '/sign-in/email', headers: new Headers() });
    const rows = await db.select().from(loginLog).where(eq(loginLog.userId, target));
    expect(rows.map((r) => r.method)).toEqual(['email']);
    expect(rows[0].ip).toBe('203.0.113.9');
    expect(await db.select().from(auditLog).where(eq(auditLog.actorId, admin))).toEqual([]);
  });

  test('impersonation is logged and audited against the admin who started it', async () => {
    await after(sessionFor({ impersonatedBy: admin }), {
      path: '/admin/impersonate-user',
      request: new Request('http://localhost/api/auth/admin/impersonate-user'),
    });
    await Bun.sleep(100);
    const logins = await db.select().from(loginLog).where(eq(loginLog.userId, target));
    expect(logins.map((r) => r.method).sort()).toEqual(['email', 'impersonation']);
    const audits = await db.select().from(auditLog).where(eq(auditLog.actorId, admin));
    expect(audits.map((a) => [a.action, a.targetId])).toEqual([['user.impersonate', target]]);
  });

  test('a failing insert is logged, never thrown into the sign-in flow', async () => {
    const warn = spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const ghost = `${TAG}-ghost`;
      await expect(
        after(sessionFor({ userId: ghost }), { path: '/sign-in/email' }),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatchObject({ userId: ghost });
    } finally {
      warn.mockRestore();
    }
  });
});
