/** End-to-end: create keys through the service, call real routes with X-API-Key, track usage, rotate, revoke. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import Elysia from 'elysia';
import { adminApi } from '../../server/api/admin';
import { apiKeysApi } from '../../server/api/api-keys';
import { meApi } from '../../server/api/me';
import { apiKeyPlugin, ipAllowed } from '../../server/api-keys/plugin';
import { getKey, keyStats, listKeys } from '../../server/api-keys/query';
import { createKey, revokeKey, rotateKey, updateKey } from '../../server/api-keys/service';
import { flushUsage, usageRecent, usageSummary } from '../../server/api-keys/usage';
import { db } from '../../server/db';
import { apiKeyUsage, apikey, auditLog, user } from '../../server/db/schema';

const TAG = `key-${crypto.randomUUID().slice(0, 8)}`;
const superId = `${TAG}-super`;
const plainId = `${TAG}-user`;
const app = new Elysia({ prefix: '/api' })
  .use(apiKeyPlugin())
  .use(adminApi)
  .use(meApi)
  .use(apiKeysApi);
const hdr = (key: string, extra: Record<string, string> = {}) => ({
  headers: { 'x-api-key': key, 'x-forwarded-for': '203.0.113.9', 'cf-ipcountry': 'ID', ...extra },
});
let superKey = '';
let superKeyId = '';
let userKey = '';

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: superId,
      name: 'Key Admin',
      email: `${superId}@test.local`,
      emailVerified: true,
      // admin, not super-admin: super-admin is reconciled from SUPER_ADMIN_EMAILS
      // on every request, so a seeded super-admin would be demoted mid-test.
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: plainId,
      name: 'Key User',
      email: `${plainId}@test.local`,
      emailVerified: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const s = await createKey({
    name: 'ci-super',
    ownerId: superId,
    scopes: ['users:read', 'me:read'],
    expiresDays: 30,
    rateLimitMax: null,
    rateLimitWindowMs: null,
    allowedIps: null,
    note: 'test',
  });
  superKey = s.key;
  superKeyId = s.row.id;
  const u = await createKey({
    name: 'ci-user',
    ownerId: plainId,
    scopes: ['me:read'],
    expiresDays: 7,
    rateLimitMax: null,
    rateLimitWindowMs: null,
    allowedIps: null,
    note: null,
  });
  userKey = u.key;
});

afterAll(async () => {
  await db
    .delete(auditLog)
    .where(eq(auditLog.targetType, 'apikey'))
    .catch(() => {});
  await db
    .delete(user)
    .where(eq(user.id, superId))
    .catch(() => {});
  await db
    .delete(user)
    .where(eq(user.id, plainId))
    .catch(() => {});
});

describe('key creation', () => {
  test('returns the plain key once with the public prefix; stored row only has start/prefix', async () => {
    expect(superKey.startsWith('mk_live_')).toBe(true);
    const row = await getKey(superKeyId);
    expect(row?.scopes).toEqual(['users:read', 'me:read']);
    expect(row?.status).toBe('active');
    expect(row?.ownerEmail).toBe(`${superId}@test.local`);
    const [raw] = await db
      .select({ key: apikey.key })
      .from(apikey)
      .where(eq(apikey.id, superKeyId));
    expect(raw.key).not.toBe(superKey);
  });
});

describe('authenticating with X-API-Key', () => {
  test('grants access with the right scope and records usage', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/admin/users/stats', hdr(superKey)),
    );
    expect(res.status).toBe(200);
    const me = await app.handle(new Request('http://localhost/api/me/logins', hdr(superKey)));
    expect(me.status).toBe(200);
    // onAfterResponse runs after the response is handed back; give it a tick.
    await Bun.sleep(20);
    await flushUsage();
    const summary = await usageSummary(superKeyId);
    expect(summary.total).toBeGreaterThanOrEqual(2);
    const recent = await usageRecent(superKeyId, 5);
    expect(recent[0].status).toBe(200);
    expect(recent[0].ip).toBe('203.0.113.9');
    expect(recent[0].country).toBe('ID');
    const row = await getKey(superKeyId);
    expect(row?.lastIp).toBe('203.0.113.9');
    // requestCount is Better Auth's rate-limit window counter, only maintained when
    // a limit is set; total usage comes from api_key_usage (summary.total above).
    expect(row?.lastRequest).not.toBeNull();
  });
  test('missing scope → 403, owner role too low → 403, no key → forbidden', async () => {
    const miss = await app.handle(
      new Request('http://localhost/api/admin/users/stats', hdr(userKey)),
    );
    expect(miss.status).toBe(403);
    await db.update(user).set({ role: 'user' }).where(eq(user.id, superId));
    const demoted = await app.handle(
      new Request('http://localhost/api/admin/users/stats', hdr(superKey)),
    );
    expect(demoted.status).toBe(403);
    expect((await demoted.json()).code).toBe('ROLE_TOO_LOW');
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, superId));
    const forbidden = await app.handle(new Request('http://localhost/api/api-keys', hdr(superKey)));
    expect(forbidden.status).toBe(403);
    const anon = await app.handle(new Request('http://localhost/api/admin/users/stats'));
    expect(anon.status).toBe(403);
  });
  test('invalid, disabled and IP-restricted keys are rejected', async () => {
    expect(
      (await app.handle(new Request('http://localhost/api/me/logins', hdr('mk_live_notarealkey'))))
        .status,
    ).toBe(401);
    await updateKey(superKeyId, { enabled: false });
    expect(
      (await app.handle(new Request('http://localhost/api/me/logins', hdr(superKey)))).status,
    ).toBe(401);
    await updateKey(superKeyId, { enabled: true, allowedIps: ['10.0.0.'] });
    expect(
      (await app.handle(new Request('http://localhost/api/me/logins', hdr(superKey)))).status,
    ).toBe(403);
    await updateKey(superKeyId, { allowedIps: null });
    expect(ipAllowed(['10.0.0.', '1.2.3.4'], '10.0.0.7')).toBe(true);
    expect(ipAllowed(['1.2.3.4'], '1.2.3.5')).toBe(false);
    expect(ipAllowed(null, null)).toBe(true);
  });
});

describe('rotation and revocation', () => {
  test('rotate issues a new key and gives the old one a grace period', async () => {
    const r = await rotateKey(superKeyId, 60_000);
    expect(r).not.toBeNull();
    expect(r?.row.scopes).toEqual(['users:read', 'me:read']);
    expect(r?.row.rotatedFromId).toBe(superKeyId);
    expect(r?.old.status).toBe('rotating');
    const graceMs = (r?.old.expiresAt?.getTime() ?? 0) - Date.now();
    expect(graceMs).toBeGreaterThan(0);
    expect(graceMs).toBeLessThanOrEqual(60_000);
    const fresh = await app.handle(
      new Request('http://localhost/api/me/logins', hdr(r?.key ?? '')),
    );
    expect(fresh.status).toBe(200);
    expect(
      (await app.handle(new Request('http://localhost/api/me/logins', hdr(superKey)))).status,
    ).toBe(200);
  });
  test('revoke blocks the key immediately and keeps history; list/stats reflect states', async () => {
    const row = await revokeKey(superKeyId);
    expect(row?.status).toBe('revoked');
    expect(
      (await app.handle(new Request('http://localhost/api/me/logins', hdr(superKey)))).status,
    ).toBe(401);
    const list = await listKeys({ ownerId: superId });
    expect(list.total).toBe(2);
    expect((await listKeys({ ownerId: superId, status: 'revoked' })).total).toBe(1);
    const stats = await keyStats();
    expect(stats.revoked).toBeGreaterThanOrEqual(1);
    const usage = await db
      .select({ id: apiKeyUsage.id })
      .from(apiKeyUsage)
      .where(eq(apiKeyUsage.keyId, superKeyId));
    expect(usage.length).toBeGreaterThan(0);
  });
});
