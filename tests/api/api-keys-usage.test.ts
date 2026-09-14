/** Cross-key usage log: filters, pagination and CSV export (guard mocked). */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({
    user: { id: 'u-test', email: 'u-test@test.local' },
    role: 'super-admin',
  }),
}));

import { eq } from 'drizzle-orm';
import { apiKeysUsageApi } from '../../server/api/api-keys-usage';
import { createKey } from '../../server/api-keys/service';
import { db } from '../../server/db';
import { apiKeyUsage, user } from '../../server/db/schema';

const app = new Elysia().use(apiKeysUsageApi);
const TAG = `ku-${crypto.randomUUID().slice(0, 8)}`;
const ownerId = `${TAG}-owner`;
let keyId = '';

beforeAll(async () => {
  await db.insert(user).values({
    id: ownerId,
    name: 'Usage Owner',
    email: `${ownerId}@test.local`,
    emailVerified: true,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const k = await createKey({
    name: 'usage-key',
    ownerId,
    scopes: ['me:read'],
    expiresDays: 7,
    rateLimitMax: null,
    rateLimitWindowMs: null,
    allowedIps: null,
    note: null,
  });
  keyId = k.row.id;
  await db.insert(apiKeyUsage).values([
    {
      keyId,
      method: 'GET',
      path: '/api/me/logins',
      status: 200,
      ip: '198.51.100.1',
      country: 'ID',
    },
    {
      keyId,
      method: 'GET',
      path: '/api/me/logins',
      status: 403,
      ip: '198.51.100.2',
      country: 'SG',
    },
    { keyId, method: 'POST', path: '/api/posts', status: 500, ip: '198.51.100.1', country: 'ID' },
  ]);
});
afterAll(async () => {
  await db
    .delete(user)
    .where(eq(user.id, ownerId))
    .catch(() => {});
});

async function list(q: string) {
  const res = await app.handle(new Request(`http://localhost/api-keys/usage?${q}`));
  return (await res.json()) as { rows: Array<Record<string, unknown>>; total: number };
}

describe('GET /api-keys/usage', () => {
  test('filters by key, status class, method and search; joins key + owner', async () => {
    const all = await list(`keyId=${keyId}`);
    expect(all.total).toBe(3);
    expect(all.rows[0].keyName).toBe('usage-key');
    expect(all.rows[0].ownerEmail).toBe(`${ownerId}@test.local`);
    expect((await list(`keyId=${keyId}&status=errors`)).total).toBe(2);
    expect((await list(`keyId=${keyId}&status=5xx`)).total).toBe(1);
    expect((await list(`keyId=${keyId}&method=post`)).total).toBe(1);
    expect((await list(`keyId=${keyId}&search=198.51.100.2`)).total).toBe(1);
    expect((await list(`keyId=${keyId}&search=/api/posts`)).total).toBe(1);
    const page = await list(`keyId=${keyId}&limit=2&page=2`);
    expect(page.rows.length).toBe(1);
  });
  test('exports CSV with a header and one line per row', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api-keys/usage/export?keyId=${keyId}&status=errors`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const lines = (await res.text()).trim().split('\r\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('createdAt,keyName,keyStart,ownerEmail,method,path,status');
  });
});
