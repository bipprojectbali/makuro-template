import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { and, eq, gte } from 'drizzle-orm';
import { api } from '../../server/api';
import { auth } from '../../server/auth';
import { db } from '../../server/db';
import { auditLog, post, user } from '../../server/db/schema';
import { env } from '../../server/env';
import { CLIENT_IP_HEADER } from '../../server/middleware/client-ip';
import * as rolesMod from '../../server/roles';
import { type DemoSettings, getDemo, upsertDemo } from '../../server/settings-demo';

// Real Better Auth sessions unless a test pins a fake actor (super-admin / real-user cases).
const realGetSession = auth.api.getSession;
const realResolveRole = rolesMod.resolveUserRole;
const ctx: { actor: Record<string, unknown> | null; role: string | null } = {
  actor: null,
  role: null,
};
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation(((args: Parameters<typeof realGetSession>[0]) =>
    ctx.actor
      ? Promise.resolve({ user: ctx.actor, session: { id: 's' } })
      : realGetSession(args)) as unknown as typeof auth.api.getSession),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(((
    u: Parameters<typeof realResolveRole>[0],
  ) => (ctx.role ? Promise.resolve(ctx.role) : realResolveRole(u))) as typeof realResolveRole),
];

const TAG = `demo-${crypto.randomUUID().slice(0, 8)}`;
const ADMIN_EMAIL = `${TAG}-sa@test.local`;
const startedAt = new Date(Date.now() - 1000);
let saved: DemoSettings;
let ipSeq = 0;
const freshIp = () => {
  ipSeq += 1;
  return `198.51.100.${ipSeq}`;
};

async function call(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
) {
  const res = await api.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
  );
  return { res, body: (await res.json().catch(() => null)) as Record<string, unknown> };
}
const start = (headers: Record<string, string> = { [CLIENT_IP_HEADER]: freshIp() }) =>
  call('POST', '/api/demo/start', { headers });
const cookieHeader = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

beforeAll(async () => {
  saved = await getDemo();
});
beforeEach(() => {
  ctx.actor = null;
  ctx.role = null;
});
afterAll(async () => {
  for (const s of spies) s.mockRestore();
  await upsertDemo(saved);
  await Bun.sleep(30); // audit() is fire-and-forget
  await db.delete(auditLog).where(eq(auditLog.actorEmail, ADMIN_EMAIL));
  await db.delete(user).where(and(eq(user.isAnonymous, true), gte(user.createdAt, startedAt)));
});

describe('demo entry API', () => {
  test('disabled → GET reports it and start is 404 DEMO_DISABLED', async () => {
    await upsertDemo({ enabled: false, ttlHours: null });
    const status = await call('GET', '/api/demo');
    expect(status.res.status).toBe(200);
    expect(status.body).toEqual({ enabled: false, ttlHours: 24 });
    const { res, body } = await start();
    expect(res.status).toBe(404);
    expect(body.code).toBe('DEMO_DISABLED');
  });

  test('enabled → session cookie, anonymous user, seeded posts; reuse keeps the same user', async () => {
    await upsertDemo({ enabled: true, ttlHours: null });
    const { res, body } = await start();
    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: '/app' });
    const cookie = cookieHeader(res);
    expect(cookie).toContain('session_token=');

    const session = await realGetSession({ headers: new Headers({ cookie }) });
    const userId = session?.user.id as string;
    const [row] = await db.select().from(user).where(eq(user.id, userId));
    expect(row?.isAnonymous).toBe(true);
    expect((await db.select().from(post).where(eq(post.authorId, userId))).length).toBe(2);

    const again = await start({ cookie, [CLIENT_IP_HEADER]: freshIp() });
    expect(again.res.status).toBe(200);
    expect(again.res.headers.getSetCookie()).toHaveLength(0);
  });

  test('foreign Origin → 403 INVALID_ORIGIN without a session; trusted Origin passes', async () => {
    await upsertDemo({ enabled: true, ttlHours: null });
    const foreign = await start({ origin: 'https://evil.example', [CLIENT_IP_HEADER]: freshIp() });
    expect(foreign.res.status).toBe(403);
    expect(foreign.body.code).toBe('INVALID_ORIGIN');
    expect(foreign.body.requestId).toBeString();
    expect(foreign.res.headers.getSetCookie()).toHaveLength(0);

    const trusted = await start({
      origin: new URL(env.BETTER_AUTH_URL).origin,
      [CLIENT_IP_HEADER]: freshIp(),
    });
    expect(trusted.res.status).toBe(200);
    expect(cookieHeader(trusted.res)).toContain('session_token=');
  });

  test('expired anonymous session → old user deleted, fresh demo started', async () => {
    await upsertDemo({ enabled: true, ttlHours: 1 });
    const cookie = cookieHeader((await start()).res);
    const oldId = (await realGetSession({ headers: new Headers({ cookie }) }))?.user.id as string;
    await db
      .update(user)
      .set({ createdAt: new Date(Date.now() - 2 * 3_600_000) })
      .where(eq(user.id, oldId));

    const again = await start({ cookie, [CLIENT_IP_HEADER]: freshIp() });
    expect(again.res.status).toBe(200);
    const fresh = await realGetSession({
      headers: new Headers({ cookie: cookieHeader(again.res) }),
    });
    expect(fresh?.user.isAnonymous).toBe(true);
    expect(fresh?.user.id).not.toBe(oldId);
    expect(await db.select().from(user).where(eq(user.id, oldId))).toHaveLength(0);
  });

  test('demo session: admin/dev APIs denied, sign-out still works', async () => {
    await upsertDemo({ enabled: true, ttlHours: null });
    const cookie = cookieHeader((await start()).res);
    expect((await call('GET', '/api/admin/users', { headers: { cookie } })).res.status).toBe(403);
    const demoPut = { headers: { cookie }, body: { enabled: false, ttlHours: null } };
    expect((await call('PUT', '/api/settings/demo', demoPut)).res.status).toBe(403);

    const out = await call('POST', '/api/auth/sign-out', {
      headers: { cookie, origin: 'http://localhost' },
      body: {},
    });
    expect(out.res.status).toBe(200);
    expect(await realGetSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  test('a signed-in real account gets 409 ALREADY_SIGNED_IN', async () => {
    await upsertDemo({ enabled: true, ttlHours: null });
    ctx.actor = { id: `${TAG}-u`, email: `${TAG}-u@test.local`, isAnonymous: false };
    const { res, body } = await start();
    expect(res.status).toBe(409);
    expect(body.code).toBe('ALREADY_SIGNED_IN');
  });

  test('per-IP limit → 429 DEMO_RATE_LIMITED', async () => {
    await upsertDemo({ enabled: true, ttlHours: null });
    const ip = freshIp();
    for (let i = 0; i < 5; i++)
      expect((await start({ [CLIENT_IP_HEADER]: ip })).res.status).toBe(200);
    const { res, body } = await start({ [CLIENT_IP_HEADER]: ip });
    expect(res.status).toBe(429);
    expect(body.code).toBe('DEMO_RATE_LIMITED');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  test('direct Better Auth anonymous sign-in is not reachable over HTTP', async () => {
    await upsertDemo({ enabled: true, ttlHours: null });
    for (const path of [
      '/api/auth/sign-in/anonymous',
      '/api/auth/sign-in/Anonymous',
      '/api/auth//sign-in/%61nonymous',
    ]) {
      const { res, body } = await call('POST', path, { body: {} });
      expect(res.status).toBe(404);
      expect(body.code).toBe('NOT_FOUND');
      expect(res.headers.getSetCookie()).toHaveLength(0);
    }
  });
});

describe('PUT /api/settings/demo', () => {
  test('non-super-admin → 403', async () => {
    ctx.actor = { id: `${TAG}-u`, email: `${TAG}-u@test.local` };
    ctx.role = 'admin';
    const { res } = await call('PUT', '/api/settings/demo', {
      body: { enabled: true, ttlHours: 2 },
    });
    expect(res.status).toBe(403);
  });

  test('super-admin saves, validates range, and GET /api/demo reflects it', async () => {
    ctx.actor = { id: `${TAG}-sa`, email: ADMIN_EMAIL };
    ctx.role = 'super-admin';
    for (const ttlHours of [0, 24 * 7 + 1])
      expect(
        (await call('PUT', '/api/settings/demo', { body: { enabled: true, ttlHours } })).res.status,
      ).toBe(422);
    const put = await call('PUT', '/api/settings/demo', { body: { enabled: true, ttlHours: 3 } });
    expect(put.res.status).toBe(200);
    expect(put.body).toEqual({ enabled: true, ttlHours: 3 });
    ctx.actor = null;
    expect((await call('GET', '/api/demo')).body).toEqual({ enabled: true, ttlHours: 3 });
  });
});
