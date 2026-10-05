import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../server/cli/doctor';
import { collectChecks } from '../../server/cli/doctor.checks';
import { PKG_NAME } from '../../server/pkg';

const SECRET = 'super-secret-value-that-must-never-be-printed-1234'; // test-only
const KEYS = [
  'XDG_CACHE_HOME',
  'LOCAL_PG_DIR',
  'BACKUP_DIR',
  'BETTER_AUTH_SECRET',
  'DATABASE_URL',
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'doctor-'));
  process.env.XDG_CACHE_HOME = path.join(tmp, 'cache');
  process.env.LOCAL_PG_DIR = path.join(tmp, 'data', 'pg');
  process.env.BACKUP_DIR = path.join(tmp, 'backups');
});
afterEach(async () => {
  await fs.rm(path.join(tmp, 'backups'), { recursive: true, force: true });
});
afterAll(async () => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  await fs.rm(tmp, { recursive: true, force: true });
});

const ctx = (env: Record<string, string | undefined>) => ({
  env: { PORT: '0', ...env },
  cwd: tmp,
  skipNetwork: true,
});
const find = async (env: Record<string, string | undefined>, name: string) =>
  (await collectChecks(ctx(env))).find((c) => c.name === name);

describe('doctor', () => {
  it('fails when BETTER_AUTH_SECRET is missing', async () => {
    expect((await find({}, 'BETTER_AUTH_SECRET'))?.status).toBe('fail');
  });

  it('warns on a short secret without revealing it', async () => {
    const c = await find({ BETTER_AUTH_SECRET: 'short-secret' }, 'BETTER_AUTH_SECRET');
    expect(c?.status).toBe('warn');
    expect(c?.detail).toBe('set (len 12)');
  });

  it('fails the local runtime check with an init hint when the cache is empty', async () => {
    const c = await find(
      { BETTER_AUTH_SECRET: SECRET, LOCAL_PG_DIR: process.env.LOCAL_PG_DIR },
      'Runtime PG',
    );
    expect(c?.status).toBe('fail');
    expect(c?.hint).toContain('init');
  });

  it('reports backup age: warn when none, ok when fresh', async () => {
    const env = { BETTER_AUTH_SECRET: SECRET };
    expect((await find(env, 'Backup'))?.status).toBe('warn');
    await fs.mkdir(path.join(tmp, 'backups'), { recursive: true });
    await Bun.write(path.join(tmp, 'backups', `${PKG_NAME}-20261006-120000.tar.gz`), 'x');
    expect((await find(env, 'Backup'))?.status).toBe('ok');
  });

  it('run --json exits 1 on failure and never prints the secret', async () => {
    process.env.BETTER_AUTH_SECRET = SECRET;
    process.env.DATABASE_URL = 'postgres://u:p@127.0.0.1:1/x'; // test-only, unreachable
    delete process.env.LOCAL_PG_DIR;
    const log = spyOn(console, 'log').mockImplementation(() => {});
    try {
      const code = await run(['--json']);
      const out = log.mock.calls.map((a) => String(a[0])).join('\n');
      expect(out).not.toContain(SECRET);
      const parsed = JSON.parse(out) as { ok: boolean };
      expect(code).toBe(parsed.ok ? 0 : 1);
      expect(parsed.ok).toBe(false); // unreachable external DB → fail
      expect(code).toBe(1);
    } finally {
      log.mockRestore();
      process.env.LOCAL_PG_DIR = path.join(tmp, 'data', 'pg');
    }
  });
});
