import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { auth } from '../server/auth';
import * as rolesMod from '../server/roles';
import { maintenanceGate, upsertMaintenance } from '../server/settings-maintenance';

const ctx: { role: string | null; fail: boolean } = { role: null, fail: false };
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation((async () => {
    if (ctx.fail) throw new Error('session store down');
    return ctx.role ? { user: { id: 'mg-user' } } : null;
  }) as unknown as typeof auth.api.getSession),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => ctx.role as 'user'),
];
const gate = (path: string, appName?: string) =>
  maintenanceGate(new Request(`http://localhost${path}`), appName);

beforeAll(async () => {
  await upsertMaintenance({
    enabled: true,
    message: 'Upgrade <DB> & "cache"',
    allowRoles: ['admin'],
  });
});

afterAll(async () => {
  for (const s of spies) s.mockRestore();
  await upsertMaintenance({ enabled: false, message: null, allowRoles: null });
});

describe('maintenanceGate', () => {
  test('serves an escaped 503 HTML page for blocked page requests', async () => {
    ctx.role = 'user';
    const res = await gate('/dashboard', 'Acme <b>');
    expect(res?.status).toBe(503);
    expect(res?.headers.get('content-type')).toContain('text/html');
    expect(res?.headers.get('cache-control')).toBe('no-store');
    const body = (await res?.text()) ?? '';
    expect(body).toContain('Upgrade &lt;DB&gt; &amp; &quot;cache&quot;');
    expect(body).toContain('<title>Acme &lt;b&gt; — Pemeliharaan</title>');
    expect(body).not.toContain('<DB>');
  });

  test('lets allowed roles and exempt paths through', async () => {
    ctx.role = 'admin';
    expect(await gate('/dashboard')).toBeNull();
    ctx.role = null;
    expect(await gate('/login')).toBeNull();
  });

  test('treats a failing session lookup as anonymous and blocks', async () => {
    ctx.fail = true;
    const res = await gate('/api/posts');
    ctx.fail = false;
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: 'maintenance', message: 'Upgrade <DB> & "cache"' });
  });

  test('falls back to the default message when none is set', async () => {
    await upsertMaintenance({ enabled: true, message: '   ', allowRoles: null });
    ctx.role = null;
    const res = await gate('/api/posts');
    expect(res?.status).toBe(503);
    const body = (await (res as Response).json()) as { message: string };
    expect(body.message).toContain('pemeliharaan');
  });
});
