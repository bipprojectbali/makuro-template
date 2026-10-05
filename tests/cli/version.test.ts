/** `version` runs through the real entrypoint without touching .env or the DB. */
import { expect, test } from 'bun:test';
import path from 'node:path';
import pkg from '../../package.json' with { type: 'json' };

const ENTRY = path.join(import.meta.dir, '../../server/binary-entry.ts');

test('version --json reports package name/version and exits 0 without DATABASE_URL', async () => {
  const proc = Bun.spawn(['bun', ENTRY, 'version', '--json'], {
    env: { ...process.env, DATABASE_URL: '', BETTER_AUTH_SECRET: '' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  expect(code).toBe(0);
  const info = JSON.parse(out);
  expect(info.name).toBe(pkg.name);
  expect(info.version).toBe(pkg.version);
  expect(info.platform).toBe(`${process.platform}-${process.arch}`);
  expect(typeof info.postgres.installed).toBe('boolean');
});

test('--version prints the plain "<name> <version>" line first', async () => {
  const proc = Bun.spawn(['bun', ENTRY, '--version'], { stdout: 'pipe', stderr: 'pipe' });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  expect(code).toBe(0);
  expect(out.split('\n')[0]).toBe(`${pkg.name} ${pkg.version}`);
});
