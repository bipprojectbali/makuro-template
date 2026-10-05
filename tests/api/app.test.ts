/** /api/app/* is the product API: mounted on the main router and closed to anonymous callers. */
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../../server/api';
import { auth } from '../../server/auth';
import * as rolesMod from '../../server/roles';

const ctx: { actor: { id: string; name: string; email: string } | null } = { actor: null };
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation((async () =>
    ctx.actor ? { user: ctx.actor } : null) as unknown as typeof auth.api.getSession),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => 'user'),
];
afterAll(() => {
  for (const s of spies) s.mockRestore();
});

async function whoami() {
  const res = await api.handle(new Request('http://localhost/api/app/whoami'));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('/api/app', () => {
  test('no session → 401 JSON with an error code', async () => {
    ctx.actor = null;
    const { status, body } = await whoami();
    expect(status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(typeof body.error).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });

  test('signed-in user → 200 with own identity', async () => {
    ctx.actor = { id: 'app-u1', name: 'App User', email: 'app-u1@test.local' };
    const { status, body } = await whoami();
    expect(status).toBe(200);
    expect(body).toEqual({ userId: 'app-u1', name: 'App User', role: 'user' });
  });
});
