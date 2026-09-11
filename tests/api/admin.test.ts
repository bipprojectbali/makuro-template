/**
 * Integration tests for the admin console API (server/api/admin.ts) — the
 * server-side role matrix that wraps Better Auth's admin endpoints.
 *
 * The actor (session + resolved role) is mocked so each test drives a known
 * caller; the real ../permissions helpers do the branching and target users are
 * seeded into the test DB so targetRole() reads real rows. Better Auth's own
 * mutations (setRole/banUser/…) are stubbed — we assert this layer's guards,
 * not Better Auth internals.
 */
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';

type Actor = { id: string; email: string } | null;
const ctx: { actor: Actor; actorRole: string | null } = { actor: null, actorRole: null };

// spyOn (not mock.module) so every override is reverted in afterAll. bun's
// mock.module swaps a module process-wide with no restore path: mocking
// `../auth` would leave auth-flow.test.ts mounting an undefined auth.handler,
// and mocking `../roles` would clobber the real resolveUserRole that
// roles.test.ts exercises. Spies are scoped to this file. Better Auth's own
// mutations are stubbed — we assert this layer's guards, not Better Auth.
import { auth } from '../../server/auth';
import * as rolesMod from '../../server/roles';

const asyncEmpty = (async () => ({})) as unknown as () => Promise<unknown>;
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation(
    (async () => (ctx.actor ? { user: ctx.actor } : null)) as unknown as typeof auth.api.getSession,
  ),
  spyOn(auth.api, 'listUsers').mockImplementation(
    (async () => ({ users: [], total: 0 })) as unknown as typeof auth.api.listUsers,
  ),
  spyOn(auth.api, 'setRole').mockImplementation(asyncEmpty as typeof auth.api.setRole),
  spyOn(auth.api, 'banUser').mockImplementation(asyncEmpty as typeof auth.api.banUser),
  spyOn(auth.api, 'unbanUser').mockImplementation(asyncEmpty as typeof auth.api.unbanUser),
  spyOn(auth.api, 'removeUser').mockImplementation(asyncEmpty as typeof auth.api.removeUser),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => ctx.actorRole),
];

import { eq } from 'drizzle-orm';
import Elysia from 'elysia';
import { db } from '../../server/db';
import { user } from '../../server/db/schema';
import { adminApi } from '../../server/api/admin';

const app = new Elysia().use(adminApi);

function asActor(id: string, role: string | null, email = `${id}@test.local`) {
  ctx.actor = { id, email };
  ctx.actorRole = role;
}
function asAnon() {
  ctx.actor = null;
  ctx.actorRole = null;
}

async function req(method: string, path: string, body?: unknown) {
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> };
}

// ─── Seed target users with fixed roles ───────────────────────────────────────
const runId = crypto.randomUUID().slice(0, 8);
const regularId = `adm-regular-${runId}`;
const adminId = `adm-admin-${runId}`;
const superId = `adm-super-${runId}`;
const seeded: Array<{ id: string; role: string }> = [
  { id: regularId, role: 'user' },
  { id: adminId, role: 'admin' },
  { id: superId, role: 'super-admin' },
];

beforeAll(async () => {
  for (const s of seeded) {
    await db.insert(user).values({
      id: s.id,
      name: s.id,
      email: `${s.id}@test.local`,
      emailVerified: false,
      role: s.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
});

afterAll(async () => {
  for (const s of spies) s.mockRestore();
  for (const s of seeded) await db.delete(user).where(eq(user.id, s.id)).catch(() => {});
});

// ─── Guard (onBeforeHandle) ───────────────────────────────────────────────────

describe('admin guard', () => {
  test('anonymous request → 403', async () => {
    asAnon();
    const { status } = await req('GET', '/admin/users');
    expect(status).toBe(403);
  });

  test('regular user → 403', async () => {
    asActor('actor-user', 'user');
    const { status } = await req('GET', '/admin/users');
    expect(status).toBe(403);
  });

  test('admin passes the guard → 200 on GET /admin/users', async () => {
    asActor('actor-admin', 'admin');
    const { status } = await req('GET', '/admin/users');
    expect(status).toBe(200);
  });
});

// ─── POST /admin/users/:id/role ───────────────────────────────────────────────

describe('POST /admin/users/:id/role', () => {
  test('admin (non-super) cannot change roles → 403', async () => {
    asActor('actor-admin', 'admin');
    const { status } = await req('POST', `/admin/users/${regularId}/role`, { role: 'admin' });
    expect(status).toBe(403);
  });

  test('super-admin cannot change their own role → 400', async () => {
    asActor(regularId, 'super-admin'); // actor.id === target id
    const { status, body } = await req('POST', `/admin/users/${regularId}/role`, { role: 'admin' });
    expect(status).toBe(400);
    expect(String(body.error)).toContain('own role');
  });

  test('rejects a non-assignable role → 400', async () => {
    asActor('actor-super', 'super-admin');
    const { status } = await req('POST', `/admin/users/${regularId}/role`, { role: 'super-admin' });
    expect(status).toBe(400);
  });

  test('unknown target user → 404', async () => {
    asActor('actor-super', 'super-admin');
    const { status } = await req('POST', `/admin/users/ghost-${runId}/role`, { role: 'admin' });
    expect(status).toBe(404);
  });

  test('cannot change a super-admin target → 400', async () => {
    asActor('actor-super', 'super-admin');
    const { status, body } = await req('POST', `/admin/users/${superId}/role`, { role: 'admin' });
    expect(status).toBe(400);
    expect(String(body.error)).toContain('SUPER_ADMIN_EMAILS');
  });

  test('super-admin promotes a regular user → ok', async () => {
    asActor('actor-super', 'super-admin');
    const { status, body } = await req('POST', `/admin/users/${regularId}/role`, { role: 'admin' });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

// ─── POST /admin/users/:id/ban ────────────────────────────────────────────────

describe('POST /admin/users/:id/ban', () => {
  test('cannot ban yourself → 400', async () => {
    asActor(regularId, 'super-admin');
    const { status, body } = await req('POST', `/admin/users/${regularId}/ban`, {});
    expect(status).toBe(400);
    expect(String(body.error)).toContain('yourself');
  });

  test('cannot ban a super-admin → 400', async () => {
    asActor('actor-super', 'super-admin');
    const { status, body } = await req('POST', `/admin/users/${superId}/ban`, {});
    expect(status).toBe(400);
    expect(String(body.error)).toContain('super-admin');
  });

  test('unknown target → 404', async () => {
    asActor('actor-super', 'super-admin');
    const { status } = await req('POST', `/admin/users/ghost-${runId}/ban`, {});
    expect(status).toBe(404);
  });

  test('admin cannot ban another admin (canActOnTarget) → 403', async () => {
    asActor('actor-admin', 'admin');
    const { status } = await req('POST', `/admin/users/${adminId}/ban`, {});
    expect(status).toBe(403);
  });

  test('admin bans a regular user → ok', async () => {
    asActor('actor-admin', 'admin');
    const { status, body } = await req('POST', `/admin/users/${regularId}/ban`, { reason: 'spam' });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────

describe('DELETE /admin/users/:id', () => {
  test('non-super cannot delete → 403', async () => {
    asActor('actor-admin', 'admin');
    const { status } = await req('DELETE', `/admin/users/${regularId}`);
    expect(status).toBe(403);
  });

  test('cannot delete a super-admin → 400', async () => {
    asActor('actor-super', 'super-admin');
    const { status, body } = await req('DELETE', `/admin/users/${superId}`);
    expect(status).toBe(400);
    expect(String(body.error)).toContain('super-admin');
  });

  test('super-admin deletes a regular user → ok', async () => {
    asActor('actor-super', 'super-admin');
    const { status, body } = await req('DELETE', `/admin/users/${regularId}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
