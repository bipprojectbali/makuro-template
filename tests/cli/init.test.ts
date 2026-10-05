/** `init` in external mode: writes a private .env with a fresh secret, never prints it, never overwrites without --force. */
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ENTRY = path.join(import.meta.dir, '../../server/binary-entry.ts');
const DB_URL = 'postgres://app:pw@db.invalid:5432/app'; // test-only
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cli-init-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function init(...args: string[]) {
  const proc = Bun.spawn(['bun', ENTRY, 'init', ...args], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { out: out + err, code };
}

const readEnv = () => Bun.file(path.join(dir, '.env')).text();
const secretOf = (env: string) => env.match(/^BETTER_AUTH_SECRET=(.*)$/m)?.[1] ?? '';

test('writes .env (0600) with a 64-hex secret and the external DATABASE_URL, without printing the secret', async () => {
  const { out, code } = await init('--yes', '--db=external', `--database-url=${DB_URL}`);
  expect(code).toBe(0);
  const env = await readEnv();
  const secret = secretOf(env);
  expect(secret).toMatch(/^[0-9a-f]{64}$/);
  expect(env).toContain(`DATABASE_URL=${DB_URL}`);
  expect(env).toContain('NODE_ENV=production');
  expect((await stat(path.join(dir, '.env'))).mode & 0o777).toBe(0o600);
  expect(out).not.toContain(secret);
  expect(out).not.toContain('pw@');
});

test('keeps an existing .env unless --force', async () => {
  await init('--yes', '--db=external', `--database-url=${DB_URL}`);
  const first = secretOf(await readEnv());

  const again = await init('--yes', '--db=external', `--database-url=${DB_URL}`);
  expect(again.code).toBe(0);
  expect(again.out).toContain('dipertahankan');
  expect(secretOf(await readEnv())).toBe(first);

  await init('--yes', '--db=external', `--database-url=${DB_URL}`, '--force');
  expect(secretOf(await readEnv())).not.toBe(first);
});

test('rejects bad --db values and external mode without a valid URL', async () => {
  expect((await init('--yes', '--db=sqlite')).code).toBe(2);
  expect((await init('--yes', '--db=external', '--database-url=not-a-url')).code).toBe(2);
  expect(await Bun.file(path.join(dir, '.env')).exists()).toBe(false);
});

test('--systemd refuses to run outside a compiled binary', async () => {
  const { out, code } = await init(
    '--yes',
    '--db=external',
    `--database-url=${DB_URL}`,
    '--systemd',
  );
  expect(code).toBe(2);
  expect(out).toContain('--systemd hanya untuk binary');
});
