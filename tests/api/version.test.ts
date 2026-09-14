/** /api/version reports the same version the sidebar shows: package.json. */
import { describe, expect, test } from 'bun:test';
import Elysia from 'elysia';
import pkg from '../../package.json' with { type: 'json' };
import { versionApi } from '../../server/api/version';
import { APP_VERSION, frameInfo } from '../../server/app-info';

describe('GET /version', () => {
  test('matches package.json and the console shell version', async () => {
    const res = await new Elysia().use(versionApi).handle(new Request('http://localhost/version'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; version: string; env: string; bun: string };
    expect(body.version).toBe(pkg.version);
    expect(body.name).toBe(pkg.name);
    expect(body.version).toBe(APP_VERSION);
    expect((await frameInfo()).version).toBe(pkg.version);
    expect(body.bun).toBe(Bun.version);
  });
});
