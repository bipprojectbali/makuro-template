/** Demo visitors (anonymous users) get 403 DEMO_RESTRICTED on sensitive actions, everyone else passes. */
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../server/api';
import { auth } from '../server/auth';
import { assertNotDemo, DEMO_BLOCKED, isDemoBlocked } from '../server/demo/restrict';
import * as rolesMod from '../server/roles';

type U = { id: string; name: string; email: string; isAnonymous: boolean };
const ctx: { actor: U | null } = { actor: null };
const getSession = spyOn(auth.api, 'getSession').mockImplementation((async () =>
  ctx.actor ? { user: ctx.actor } : null) as unknown as typeof auth.api.getSession);
const spies = [
  getSession,
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => 'user'),
];
afterAll(() => {
  for (const s of spies) s.mockRestore();
});

const demo: U = { id: 'demo-r1', name: 'Demo', email: 'demo-r1@test.local', isAnonymous: true };
const real: U = { id: 'real-r1', name: 'Real', email: 'real-r1@test.local', isAnonymous: false };

async function call(method: string, path: string, body?: unknown) {
  const res = await api.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  return {
    status: res.status,
    body: (await res.json().catch(() => null)) as Record<string, unknown>,
  };
}

const BLOCKED: Array<[string, string, unknown]> = [
  ['POST', '/api/app/avatar', undefined],
  ['POST', '/api/me/api-keys', { name: 'k1' }],
  ['POST', '/api/auth/change-password', { currentPassword: 'a', newPassword: 'b' }],
];

describe('demoRestrictPlugin', () => {
  for (const [method, path, body] of BLOCKED) {
    test(`demo user → 403 DEMO_RESTRICTED on ${method} ${path}`, async () => {
      ctx.actor = demo;
      const r = await call(method, path, body);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('DEMO_RESTRICTED');
      expect(r.body.status).toBe(403);
      expect(typeof r.body.error).toBe('string');
      expect(typeof r.body.requestId).toBe('string');
    });

    test(`non-demo user is not blocked on ${method} ${path}`, async () => {
      ctx.actor = real;
      const r = await call(method, path, body);
      expect(r.body?.code).not.toBe('DEMO_RESTRICTED');
    });
  }

  test('non-blocked path works for demo user without extra session lookup by the plugin', async () => {
    ctx.actor = demo;
    getSession.mockClear();
    const r = await call('GET', '/api/app/whoami');
    expect(r.status).toBe(200);
    expect(r.body.userId).toBe(demo.id);
    expect(getSession).toHaveBeenCalledTimes(1); // only resolveActor, not the plugin
  });

  test('extending DEMO_BLOCKED takes effect', async () => {
    ctx.actor = demo;
    expect((await call('GET', '/api/app/whoami')).status).toBe(200);
    DEMO_BLOCKED.push({ method: 'GET', prefix: '/api/app/whoami', reason: 'Contoh' });
    try {
      const r = await call('GET', '/api/app/whoami');
      expect(r.status).toBe(403);
      expect(r.body.error).toStartWith('Contoh');
    } finally {
      DEMO_BLOCKED.pop();
    }
  });
});

describe('isDemoBlocked', () => {
  test('prefix covers exact path and sub-paths, not look-alikes', () => {
    expect(isDemoBlocked('GET', '/api/me/api-keys')).toBe(true);
    expect(isDemoBlocked('DELETE', '/api/me/api-keys/abc')).toBe(true);
    expect(isDemoBlocked('GET', '/api/me/api-keys-other')).toBe(false);
    expect(isDemoBlocked('POST', '/api/auth/api-key/create')).toBe(true);
    expect(isDemoBlocked('POST', '/api/auth/sign-out')).toBe(false);
  });

  test('method filter', () => {
    expect(isDemoBlocked('POST', '/api/app/avatar')).toBe(true);
    expect(isDemoBlocked('delete', '/api/app/avatar')).toBe(true);
    expect(isDemoBlocked('GET', '/api/app/avatar')).toBe(false);
  });
});

describe('assertNotDemo', () => {
  test('payload for demo actor, null otherwise', () => {
    expect(assertNotDemo({ isDemo: true })?.code).toBe('DEMO_RESTRICTED');
    expect(assertNotDemo({ isDemo: false })).toBeNull();
    expect(assertNotDemo(null)).toBeNull();
  });
});
