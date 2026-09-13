import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({
    user: { id: 'u-test', email: 'u-test@test.local' },
    role: 'super-admin',
  }),
}));

import { eq, inArray } from 'drizzle-orm';
import { auditApi } from '../../server/api/audit';
import { buildAuditWhere, toAuditCsv } from '../../server/api/audit.query';
import { AUDIT_ACTIONS, audit } from '../../server/audit';
import { db } from '../../server/db';
import { auditLog, user } from '../../server/db/schema';

const app = new Elysia().use(auditApi);
const TAG = `aud-${crypto.randomUUID().slice(0, 8)}`;
const actorId = `${TAG}-actor`;

async function getJson(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await app.handle(new Request(url.toString()));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: actorId,
      name: `Auditor ${TAG}`,
      email: `${actorId}@test.local`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await audit({
    actor: { id: actorId, email: `${actorId}@test.local` },
    action: AUDIT_ACTIONS.USER_BAN,
    targetType: 'user',
    targetId: `${TAG}-target`,
    summary: `${TAG} ban`,
    meta: { reason: 'spam' },
    headers: new Headers({ 'x-forwarded-for': '77.7.7.7', 'user-agent': 'UA-test' }),
  });
  await audit({
    actor: { id: actorId, email: `${actorId}@test.local` },
    action: AUDIT_ACTIONS.LOGS_PURGE,
    targetType: 'logs',
    summary: `${TAG} purge`,
  });
  await audit({
    actor: null,
    action: AUDIT_ACTIONS.USER_IMPERSONATE,
    targetType: 'user',
    targetId: `${TAG}-target`,
    summary: `${TAG} impersonate`,
  });
});

afterAll(async () => {
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(eq(auditLog.actorId, actorId));
  await db
    .delete(auditLog)
    .where(
      inArray(
        auditLog.id,
        rows.map((r) => r.id),
      ),
    )
    .catch(() => {});
  await db
    .delete(auditLog)
    .where(eq(auditLog.summary, `${TAG} impersonate`))
    .catch(() => {});
  await db
    .delete(user)
    .where(eq(user.id, actorId))
    .catch(() => {});
});

describe('audit()', () => {
  test('persists actor snapshot, target, meta, ip and user agent', async () => {
    const { body } = await getJson('/audit', { search: `${TAG} ban` });
    const row = (body.rows as Array<Record<string, unknown>>)[0];
    expect(row).toMatchObject({
      actorId,
      actorEmail: `${actorId}@test.local`,
      action: 'user.ban',
      targetType: 'user',
      targetId: `${TAG}-target`,
      ip: '77.7.7.7',
      userAgent: 'UA-test',
    });
    expect(row.meta).toEqual({ reason: 'spam' });
    expect(row.actorName).toBe(`Auditor ${TAG}`);
  });
});

describe('GET /audit', () => {
  test('filters by action, targetType, actorId, targetId and search', async () => {
    expect((await getJson('/audit', { search: TAG })).body.total).toBe(3);
    expect((await getJson('/audit', { search: TAG, action: 'logs.purge' })).body.total).toBe(1);
    expect((await getJson('/audit', { search: TAG, targetType: 'user' })).body.total).toBe(2);
    expect((await getJson('/audit', { actorId })).body.total).toBe(2);
    expect((await getJson('/audit', { targetId: `${TAG}-target` })).body.total).toBe(2);
    expect((await getJson('/audit', { search: TAG, days: '1' })).body.total).toBe(3);
  });

  test('stats and export', async () => {
    const { body } = await getJson('/audit/stats');
    expect((body.total as number) >= 3).toBe(true);
    expect((body.destructive as number) >= 1).toBe(true);
    expect(Array.isArray(body.topActions)).toBe(true);
    const res = await app.handle(new Request(`http://localhost/audit/export?search=${TAG}`));
    expect(res.headers.get('content-type')).toContain('text/csv');
    const lines = (await res.text()).replace(/^﻿/, '').trim().split('\r\n');
    expect(lines.length).toBe(4);
    expect(lines[0].startsWith('createdAt,actorEmail')).toBe(true);
  });

  test('pure helpers', () => {
    expect(buildAuditWhere({})).toBeUndefined();
    const csv = toAuditCsv([
      { createdAt: new Date('2026-01-01T00:00:00Z'), summary: 'a,b', meta: { x: 1 } },
    ]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"{""x"":1}"');
  });
});
