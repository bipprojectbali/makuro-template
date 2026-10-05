/** `backup`: cold tar.gz of LOCAL_PG_DIR, refuses a live postmaster, retention, external mode. */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { livePostmasterPid, run } from '../../server/cli/backup';
import { PKG_NAME } from '../../server/pkg';

const saved = { ...process.env };
let root: string;
let pgDir: string;
let outDir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'makuro-backup-'));
  pgDir = path.join(root, 'pg');
  outDir = path.join(root, 'backups');
  await Bun.write(path.join(pgDir, 'PG_VERSION'), '18\n');
  await Bun.write(path.join(pgDir, 'base', '1', 'data'), 'x'.repeat(1024));
  process.env.LOCAL_PG_DIR = pgDir;
  process.env.BACKUP_DIR = outDir;
  spyOn(console, 'log').mockImplementation(() => {});
  spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  process.env = { ...saved };
  (console.log as unknown as { mockRestore(): void }).mockRestore();
  (console.error as unknown as { mockRestore(): void }).mockRestore();
  await rm(root, { recursive: true, force: true });
});

describe('backup', () => {
  test('writes a listable archive of the data dir into BACKUP_DIR', async () => {
    expect(await run([])).toBe(0);
    const files = await readdir(outDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`^${PKG_NAME}-\\d{8}-\\d{6}\\.tar\\.gz$`));
    const list = Bun.spawnSync(['tar', '-tzf', path.join(outDir, files[0])]).stdout.toString();
    expect(list).toContain('pg/PG_VERSION');
    expect(list).toContain('pg/base/1/data');
  });

  test('refuses while postmaster.pid points at a live process', async () => {
    await Bun.write(path.join(pgDir, 'postmaster.pid'), `${process.pid}\n${pgDir}\n`);
    expect(await livePostmasterPid(pgDir)).toBe(process.pid);
    expect(await run([])).toBe(1);
    expect(await readdir(root)).not.toContain('backups');
  });

  test('ignores a stale postmaster.pid', async () => {
    await Bun.write(path.join(pgDir, 'postmaster.pid'), '999999\n');
    expect(await livePostmasterPid(pgDir)).toBeNull();
    expect(await run([])).toBe(0);
  });

  test('--keep prunes the oldest archives', async () => {
    await Bun.write(path.join(outDir, `${PKG_NAME}-20000101-000000.tar.gz`), 'old');
    await Bun.write(path.join(outDir, `${PKG_NAME}-20000102-000000.tar.gz`), 'old');
    await Bun.write(path.join(outDir, 'unrelated.txt'), 'keep me');
    expect(await run(['--keep=1'])).toBe(0);
    const files = (await readdir(outDir)).sort();
    expect(files).toHaveLength(2);
    expect(files).toContain('unrelated.txt');
    expect(files.some((f) => f.startsWith(`${PKG_NAME}-2000`))).toBe(false);
  });

  test('--out overrides BACKUP_DIR', async () => {
    const custom = path.join(root, 'custom');
    expect(await run([`--out=${custom}`])).toBe(0);
    expect(await readdir(custom)).toHaveLength(1);
  });

  test('missing data dir is an error', async () => {
    process.env.LOCAL_PG_DIR = path.join(root, 'nope');
    expect(await run([])).toBe(1);
  });

  test('external DATABASE_URL defers to pg_dump without printing the URL', async () => {
    delete process.env.LOCAL_PG_DIR;
    process.env.DATABASE_URL = 'postgres://u:secret-pw@db.example:5432/app';
    expect(await run([])).toBe(2);
    const printed = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .join('\n');
    expect(printed).toContain('pg_dump');
    expect(printed).not.toContain('secret-pw');
  });

  test('rejects an invalid --keep', async () => {
    expect(await run(['--keep=0'])).toBe(2);
  });
});
