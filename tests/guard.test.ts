/**
 * Tests for the per-role layout guards (server/guard.ts). requireRole /
 * requireAnyRole must: bounce anonymous requests to /login, bounce a logged-in
 * user in the wrong area to their own home (homeFor), and return {user, role}
 * when the role is allowed. Session + resolved role are mocked so each case is
 * deterministic; redirectToHome is already covered by auth-flow.test.ts.
 */
import { afterAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';

type SessionUser = { id: string; email: string } | null;
const ctx: { user: SessionUser; role: string } = { user: null, role: 'user' };

// spyOn (not mock.module) so every override is reverted in afterAll. bun's
// mock.module swaps a module process-wide with no restore path, so mocking
// `./auth` would leave auth-flow.test.ts mounting an undefined auth.handler,
// and mocking `./roles` would clobber the real resolveUserRole that
// roles.test.ts exercises. Spies are scoped to this file.
import { auth } from '../server/auth';
import * as rolesMod from '../server/roles';

const sessionSpy = spyOn(auth.api, 'getSession').mockImplementation(
  (async () => (ctx.user ? { user: ctx.user } : null)) as unknown as typeof auth.api.getSession,
);
const roleSpy = spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => ctx.role);

import { ROLES } from '../server/permissions';
import { requireAnyRole, requireRole } from '../server/guard';

afterAll(() => {
  sessionSpy.mockRestore();
  roleSpy.mockRestore();
});

const request = () => new Request('http://localhost/whatever');

/** Invoke `fn` and return the redirect Response it throws, or null if it returned. */
async function catchRedirect(fn: () => Promise<unknown>): Promise<Response | null> {
  try {
    await fn();
    return null;
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

beforeEach(() => {
  ctx.user = null;
  ctx.role = 'user';
});

describe('requireRole', () => {
  test('anonymous → redirect to /login', async () => {
    ctx.user = null;
    const res = await catchRedirect(() => requireRole(request(), ROLES.ADMIN));
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe('/login');
  });

  test('wrong role → redirect to the caller’s own home', async () => {
    ctx.user = { id: 'u1', email: 'u1@test.local' };
    ctx.role = ROLES.USER; // a user hitting an admin-only area
    const res = await catchRedirect(() => requireRole(request(), ROLES.ADMIN));
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe('/profile');
  });

  test('matching role → returns user and role', async () => {
    ctx.user = { id: 'u2', email: 'u2@test.local' };
    ctx.role = ROLES.ADMIN;
    const out = (await requireRole(request(), ROLES.ADMIN)) as { user: { id: string }; role: string };
    expect(out.user.id).toBe('u2');
    expect(out.role).toBe(ROLES.ADMIN);
  });
});

describe('requireAnyRole', () => {
  test('super-admin is allowed into an area that lists admin + super-admin', async () => {
    ctx.user = { id: 'u3', email: 'u3@test.local' };
    ctx.role = ROLES.SUPER_ADMIN;
    const out = (await requireAnyRole(request(), [ROLES.ADMIN, ROLES.SUPER_ADMIN])) as {
      role: string;
    };
    expect(out.role).toBe(ROLES.SUPER_ADMIN);
  });

  test('role outside the allowed set → redirect home', async () => {
    ctx.user = { id: 'u4', email: 'u4@test.local' };
    ctx.role = ROLES.ADMIN;
    const res = await catchRedirect(() => requireAnyRole(request(), [ROLES.SUPER_ADMIN]));
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe('/dashboard');
  });
});
