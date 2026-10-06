import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, lstatSync, readlinkSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_LOCAL_PG_PORT,
  dataDir,
  isLocalMode,
  localDatabaseUrl,
  localPgDb,
  localPgPort,
  migrationsFolder,
  runtimeDir,
  socketDir,
} from '../../server/local-pg/paths';
import {
  ensureRuntime,
  installedIntegrity,
  PG_ARCHIVES,
  pgBin,
  runtimeInstalled,
} from '../../server/local-pg/runtime';

const saved = { ...process.env };
afterEach(() => {
  for (const k of [
    'XDG_CACHE_HOME',
    'LOCAL_PG_DIR',
    'LOCAL_PG_PORT',
    'LOCAL_PG_SOCKET_DIR',
    'LOCAL_PG_DB',
  ]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('local-pg paths', () => {
  it('isLocalMode: local when DATABASE_URL empty or LOCAL_PG_DIR forces it', () => {
    expect(isLocalMode({})).toBe(true);
    expect(isLocalMode({ DATABASE_URL: '' })).toBe(true);
    expect(isLocalMode({ DATABASE_URL: 'postgres://x@h/db' })).toBe(false);
    expect(isLocalMode({ DATABASE_URL: 'postgres://x@h/db', LOCAL_PG_DIR: './pg' })).toBe(true);
  });

  it('runtimeDir lives in the global cache keyed by package name, PG version and platform', () => {
    process.env.XDG_CACHE_HOME = '/tmp/xdg-test';
    expect(runtimeDir('linux-x64')).toBe('/tmp/xdg-test/makuro-template/pg/18.4.0/linux-x64');
  });

  it('dataDir/port honour env overrides, defaults relative to cwd', () => {
    delete process.env.LOCAL_PG_DIR;
    delete process.env.LOCAL_PG_PORT;
    expect(dataDir()).toBe(path.resolve(process.cwd(), 'data/pg'));
    expect(localPgPort()).toBe(DEFAULT_LOCAL_PG_PORT);
    process.env.LOCAL_PG_DIR = '/srv/app/pg';
    process.env.LOCAL_PG_PORT = '55001';
    expect(dataDir()).toBe('/srv/app/pg');
    delete process.env.LOCAL_PG_SOCKET_DIR;
    delete process.env.LOCAL_PG_DB;
    const sock = `/tmp/makuro_template-pg-${process.getuid?.()}`;
    expect(socketDir()).toBe(sock);
    expect(localDatabaseUrl()).toBe(
      `postgres://postgres@localhost:55001/makuro_template?host=${encodeURIComponent(sock)}`,
    );
    // LOCAL_PG_DB renames the database only; the socket stays tied to the cluster.
    process.env.LOCAL_PG_DB = 'shop';
    expect(socketDir()).toBe(sock);
    expect(localDatabaseUrl()).toContain('/shop?host=');
    process.env.LOCAL_PG_SOCKET_DIR = '/run/app-pg';
    expect(localDatabaseUrl(1, 'postgres')).toBe(
      'postgres://postgres@localhost:1/postgres?host=%2Frun%2Fapp-pg',
    );
  });

  it('localPgDb: package name by default, LOCAL_PG_DB override, both sanitized', () => {
    expect(localPgDb({})).toBe('makuro_template');
    expect(localPgDb({ LOCAL_PG_DB: '' })).toBe('makuro_template');
    expect(localPgDb({ LOCAL_PG_DB: 'My-App.db' })).toBe('my_app_db');
    expect(localPgDb({ LOCAL_PG_DB: 'x"; drop' })).toMatch(/^[a-z0-9_]+$/);
  });

  it('migrations resolve to the source tree', () => {
    expect(existsSync(path.join(migrationsFolder(), 'meta/_journal.json'))).toBe(true);
  });

  it('pins an https npm tarball + sha512 for every supported platform', () => {
    for (const a of Object.values(PG_ARCHIVES)) {
      expect(a.url).toStartWith('https://registry.npmjs.org/@embedded-postgres/');
      expect(a.integrity).toMatch(/^sha512-[A-Za-z0-9+/]{86}==$/);
    }
  });
});

describe('ensureRuntime (fake tarball)', () => {
  let root: string;
  let archive: string;
  let integrity: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-pg-rt-'));
    const pkg = path.join(root, 'src/package/native');
    await fs.mkdir(path.join(pkg, 'bin'), { recursive: true });
    await fs.mkdir(path.join(pkg, 'lib'), { recursive: true });
    await Bun.write(path.join(pkg, 'bin/postgres'), '#!/bin/sh\necho fake\n');
    await fs.chmod(path.join(pkg, 'bin/postgres'), 0o755);
    await Bun.write(path.join(pkg, 'lib/libx.1.so'), 'lib');
    await Bun.write(
      path.join(pkg, 'pg-symlinks.json'),
      JSON.stringify([{ source: 'native/lib/libx.1.so', target: 'native/lib/libx.so' }]),
    );
    archive = path.join(root, 'fake.tgz');
    const tar = Bun.spawnSync(['tar', '-czf', archive, '-C', path.join(root, 'src'), 'package']);
    expect(tar.exitCode).toBe(0);
    const h = new Bun.CryptoHasher('sha512');
    h.update(await Bun.file(archive).arrayBuffer());
    integrity = `sha512-${h.digest('base64')}`;
  });
  afterAll(() => fs.rm(root, { recursive: true, force: true }));

  it('verifies, extracts (strip package/), hydrates symlinks, writes marker; idempotent', async () => {
    const dir = path.join(root, 'rt-ok');
    expect(await runtimeInstalled(dir)).toBe(false);
    const out = await ensureRuntime({ archive, dir, source: { url: '', integrity } });
    expect(out).toBe(dir);
    expect(existsSync(pgBin('postgres', dir))).toBe(true);
    const link = path.join(dir, 'native/lib/libx.so');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe('libx.1.so');
    expect(await installedIntegrity(dir)).toBe(integrity);
    expect(await runtimeInstalled(dir)).toBe(true);

    // Second call is a no-op even when the archive is gone.
    expect(
      await ensureRuntime({ archive: '/nonexistent.tgz', dir, source: { url: '', integrity } }),
    ).toBe(dir);
    expect(existsSync(archive)).toBe(true);
  });

  it('rejects a checksum mismatch before extracting and leaves nothing installed', async () => {
    const dir = path.join(root, 'rt-bad');
    const bad = `sha512-${'A'.repeat(86)}==`;
    await expect(
      ensureRuntime({ archive, dir, source: { url: '', integrity: bad } }),
    ).rejects.toThrow(/Checksum runtime Postgres tidak cocok/);
    expect(existsSync(dir)).toBe(false);
    expect(await runtimeInstalled(dir)).toBe(false);
    expect((await fs.readdir(root)).filter((f) => f.includes('.tmp-'))).toEqual([]);
  });
});
