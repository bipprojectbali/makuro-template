import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import Elysia from 'elysia';
import { postsApi } from '../../server/api/posts';
import { listPosts, postStats } from '../../server/api/posts.query';
import { auth } from '../../server/auth';
import { db } from '../../server/db';
import { auditLog, post, user } from '../../server/db/schema';
import * as guardMod from '../../server/guard';
import { ROLES } from '../../server/permissions';
import * as rolesMod from '../../server/roles';

type Actor = { id: string; email: string } | null;
const ctx: { actor: Actor; role: string | null } = { actor: null, role: null };
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation((async () =>
    ctx.actor ? { user: ctx.actor } : null) as unknown as typeof auth.api.getSession),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => (ctx.role ?? 'user') as 'user'),
];
const app = new Elysia().use(postsApi);
const TAG = `pq-${crypto.randomUUID().slice(0, 8)}`;
const author = `${TAG}-author`;
const admin = `${TAG}-admin`;
const DAY = 86_400_000;
const now = Date.now();
// test-only: B is newest, A oldest, C was edited long after creation.
const seeds = [
  { title: `${TAG} B`, createdAt: new Date(now - DAY), updatedAt: new Date(now - DAY) },
  { title: `${TAG} A`, createdAt: new Date(now - 40 * DAY), updatedAt: new Date(now - 40 * DAY) },
  { title: `${TAG} C`, createdAt: new Date(now - 10 * DAY), updatedAt: new Date(now - 60_000) },
];
const ids: Record<string, string> = {};

async function req(method: string, path: string, body?: unknown) {
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  return {
    status: res.status,
    body: (await res.json().catch(() => null)) as Record<string, unknown>,
  };
}

const titles = (rows: { title: string }[]) => rows.map((r) => r.title.slice(TAG.length + 1));

beforeAll(async () => {
  for (const id of [author, admin])
    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@test.local`,
      emailVerified: false,
      role: id === admin ? 'admin' : 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  for (const s of seeds) {
    const [row] = await db
      .insert(post)
      .values({ ...s, content: null, authorId: author })
      .returning({ id: post.id });
    ids[s.title.slice(-1)] = row.id;
  }
});

afterAll(async () => {
  for (const s of spies) s.mockRestore();
  await db.delete(auditLog).where(eq(auditLog.actorId, admin));
  await db.delete(post).where(eq(post.authorId, author));
  await db.delete(user).where(inArray(user.id, [author, admin]));
});

describe('listPosts', () => {
  test('sorts newest (default), oldest, recently updated and by title', async () => {
    const q = { authorId: author };
    expect(titles((await listPosts(q)).rows)).toEqual(['B', 'C', 'A']);
    expect(titles((await listPosts({ ...q, sort: 'oldest' })).rows)).toEqual(['A', 'C', 'B']);
    expect(titles((await listPosts({ ...q, sort: 'updated' })).rows)).toEqual(['C', 'B', 'A']);
    expect(titles((await listPosts({ ...q, sort: 'title' })).rows)).toEqual(['A', 'B', 'C']);
  });

  test('paginates and clamps bad page/limit values', async () => {
    const p2 = await listPosts({ authorId: author, limit: '2', page: '2' });
    expect(p2).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(titles(p2.rows)).toEqual(['A']);
    const junk = await listPosts({ authorId: author, limit: '9999', page: '-3' });
    expect(junk.page).toBe(1);
    expect(junk.limit).toBe(100);
    expect((await listPosts({ authorId: author, limit: 'abc' })).limit).toBe(25);
  });

  test('filters by recency window and search term', async () => {
    expect(titles((await listPosts({ authorId: author, days: '30' })).rows)).toEqual(['B', 'C']);
    const found = await listPosts({ search: `${TAG} A` });
    expect(found.total).toBe(1);
    expect(found.rows[0].authorEmail).toBe(`${author}@test.local`);
  });
});

describe('postStats', () => {
  test('counts include the seeded posts, edits and top authors', async () => {
    const s = await postStats();
    expect(s.total).toBeGreaterThanOrEqual(3);
    expect(s.last7d).toBeGreaterThanOrEqual(1);
    expect(s.last30d).toBeGreaterThanOrEqual(2);
    expect(s.last30d).toBeGreaterThanOrEqual(s.last7d);
    expect(s.edited).toBeGreaterThanOrEqual(1);
    expect(s.topAuthors.length).toBeLessThanOrEqual(5);
    for (const a of s.topAuthors) expect(a.count).toBeGreaterThan(0);
  });
});

describe('GET /posts/stats', () => {
  // Asserts the contract (route demands super-admin), not guard internals: other test
  // files mock.module the guard process-wide; requireRole's rejection is covered in guard.test.ts.
  test('is gated to super-admin', async () => {
    const gate = spyOn(guardMod, 'requireRole');
    try {
      ctx.actor = { id: admin, email: `${admin}@test.local` };
      ctx.role = 'super-admin';
      const res = await req('GET', '/posts/stats');
      expect(gate.mock.calls.map((c) => c[1])).toEqual([ROLES.SUPER_ADMIN]);
      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
    } finally {
      gate.mockRestore();
    }
  });
});

describe('PUT /posts/:id by an admin who is not the owner', () => {
  test('edits the post and writes a post.update audit entry', async () => {
    ctx.actor = { id: admin, email: `${admin}@test.local` };
    ctx.role = 'admin';
    const res = await req('PUT', `/posts/${ids.A}`, { title: `  ${TAG} A2  ` });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(`${TAG} A2`);
    await Bun.sleep(100);
    const rows = await db.select().from(auditLog).where(eq(auditLog.targetId, ids.A));
    expect(rows.map((r) => r.action)).toEqual(['post.update']);
    expect(rows[0].summary).toContain(`${author}@test.local`);
  });
});
