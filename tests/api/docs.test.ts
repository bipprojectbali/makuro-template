import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import Elysia, { type AnyElysia } from 'elysia';
import { openapiApi } from '../../server/api/openapi';
import { auth } from '../../server/auth';
import { homeFor, ROLES } from '../../server/permissions';
import * as rolesMod from '../../server/roles';

// A non-banned, non-anonymous session user: enough for resolveActor's session
// path to resolve (role comes from the resolveUserRole spy, so no DB is touched).
const sessionUser = {
  id: 'docs-test-user',
  email: 'docs@test.local',
  name: 'docs',
  isAnonymous: false,
  banned: false,
  createdAt: new Date(),
};

const ctx: { user: typeof sessionUser | null; role: string } = { user: null, role: ROLES.USER };
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation((async () =>
    ctx.user ? { user: ctx.user, session: {} } : null) as unknown as typeof auth.api.getSession),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => ctx.role as 'user'),
];

const app = new Elysia({ prefix: '/api' }).use(openapiApi((): AnyElysia => app));
const get = (path: string) => app.handle(new Request(`http://localhost${path}`));

afterAll(() => {
  for (const s of spies) s.mockRestore();
});

describe('GET /api/docs — Scalar UI gating', () => {
  test('anonymous → 302 to /login', async () => {
    ctx.user = null;
    const res = await get('/api/docs');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });

  test('non-super-admin session → 302 to role home', async () => {
    ctx.user = sessionUser;
    ctx.role = ROLES.USER;
    const res = await get('/api/docs');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(homeFor(ROLES.USER));
  });

  test('super-admin session → 200 HTML with Scalar mount point', async () => {
    ctx.user = sessionUser;
    ctx.role = ROLES.SUPER_ADMIN;
    const res = await get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('id="api-reference"');
  });
});
