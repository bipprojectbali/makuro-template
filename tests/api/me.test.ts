import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import Elysia from 'elysia';
import { meApi } from '../../server/api/me';
import { auth } from '../../server/auth';
import { db } from '../../server/db';
import { loginLog, user } from '../../server/db/schema';

const uid = `me-${crypto.randomUUID().slice(0, 8)}`;
let actor: { id: string; email: string } | null = null;
const spy = spyOn(auth.api, 'getSession').mockImplementation((async () =>
  actor ? { user: actor } : null) as unknown as typeof auth.api.getSession);
const app = new Elysia().use(meApi);

beforeAll(async () => {
  await db.insert(user).values({
    id: uid,
    name: 'Me',
    email: `${uid}@test.local`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(loginLog).values([
    { userId: uid, ip: '9.9.9.1', method: 'email' },
    { userId: uid, ip: '9.9.9.2', method: 'google' },
  ]);
});
afterAll(async () => {
  spy.mockRestore();
  await db
    .delete(user)
    .where(eq(user.id, uid))
    .catch(() => {});
});

describe('GET /me/logins', () => {
  test('401 without a session', async () => {
    actor = null;
    expect((await app.handle(new Request('http://localhost/me/logins'))).status).toBe(401);
  });

  test("returns only the caller's logins, newest first, with limit", async () => {
    actor = { id: uid, email: `${uid}@test.local` };
    const res = await app.handle(new Request('http://localhost/me/logins?limit=1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: Array<{ userId: string; ip: string }>;
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.rows.length).toBe(1);
    expect(body.rows[0].userId).toBe(uid);
  });
});
