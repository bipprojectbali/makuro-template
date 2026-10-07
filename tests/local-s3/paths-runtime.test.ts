import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_LOCAL_S3_PORT,
  isLocalStorageMode,
  localS3Bucket,
  localS3Endpoint,
  localS3Port,
  s3Dir,
  s3RuntimeDir,
  toBucketName,
} from '../../server/local-s3/paths';
import {
  ensureS3Runtime,
  rustfsBin,
  S3_ARCHIVES,
  s3RuntimeInstalled,
} from '../../server/local-s3/runtime';

const KEYS = ['XDG_CACHE_HOME', 'LOCAL_S3_DIR', 'LOCAL_S3_PORT'];
const saved = { ...process.env };
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('local-s3 paths', () => {
  it('local mode = no S3_ENDPOINT', () => {
    expect(isLocalStorageMode({})).toBe(true);
    expect(isLocalStorageMode({ S3_ENDPOINT: '' })).toBe(true);
    expect(isLocalStorageMode({ S3_ENDPOINT: 'https://s3.example.com' })).toBe(false);
  });

  it('runtime dir keyed by package, RustFS version and platform', () => {
    process.env.XDG_CACHE_HOME = '/tmp/xdg-test';
    expect(s3RuntimeDir('linux-x64')).toBe('/tmp/xdg-test/makuro-template/rustfs/1.0.1/linux-x64');
  });

  it('dir/port defaults relative to cwd, env overrides; endpoint is loopback only', () => {
    delete process.env.LOCAL_S3_DIR;
    delete process.env.LOCAL_S3_PORT;
    expect(s3Dir()).toBe(path.resolve(process.cwd(), 'data/s3'));
    expect(localS3Port()).toBe(DEFAULT_LOCAL_S3_PORT);
    process.env.LOCAL_S3_DIR = '/srv/app/s3';
    process.env.LOCAL_S3_PORT = '55002';
    expect(s3Dir()).toBe('/srv/app/s3');
    expect(localS3Endpoint()).toBe('http://127.0.0.1:55002');
  });

  it('bucket names follow S3 rules', () => {
    expect(localS3Bucket({})).toBe('makuro-template');
    expect(localS3Bucket({ LOCAL_S3_BUCKET: 'My_App.Files' })).toBe('my-app-files');
    expect(toBucketName('--a--')).toBe('a-storage');
    expect(toBucketName('')).toBe('app-storage');
    const long = toBucketName('x'.repeat(100));
    expect(long.length).toBe(58);
    expect(`${long}-test`.length).toBeLessThanOrEqual(63);
    for (const s of ['Ab', 'a b c', '../x', 'ÄÖÜ-bucket']) {
      expect(toBucketName(s)).toMatch(/^[a-z0-9][a-z0-9-]{1,56}[a-z0-9]$/);
    }
  });

  it('pins an https GitHub release zip + sha256 for every supported platform', () => {
    expect(Object.keys(S3_ARCHIVES).sort()).toEqual(['darwin-arm64', 'linux-arm64', 'linux-x64']);
    for (const a of Object.values(S3_ARCHIVES)) {
      expect(a.url).toStartWith('https://github.com/rustfs/rustfs/releases/download/1.0.1/');
      expect(a.url).toEndWith('.zip');
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe.skipIf(!Bun.which('zip'))('ensureS3Runtime (fake zip)', () => {
  let root: string;
  let archive: string;
  let sha256: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-s3-rt-'));
    await fs.mkdir(path.join(root, 'src'));
    await Bun.write(path.join(root, 'src/rustfs'), '#!/bin/sh\necho fake\n');
    archive = path.join(root, 'fake.zip');
    const zip = Bun.spawnSync(['zip', '-q', archive, 'rustfs'], { cwd: path.join(root, 'src') });
    expect(zip.exitCode).toBe(0);
    sha256 = new Bun.CryptoHasher('sha256')
      .update(await Bun.file(archive).arrayBuffer())
      .digest('hex');
  });
  afterAll(() => fs.rm(root, { recursive: true, force: true }));

  it('verifies, extracts, marks executable, writes marker; idempotent', async () => {
    const dir = path.join(root, 'rt-ok');
    expect(await s3RuntimeInstalled(dir)).toBe(false);
    expect(await ensureS3Runtime({ archive, dir, source: { url: '', sha256 } })).toBe(dir);
    expect(statSync(rustfsBin(dir)).mode & 0o111).toBeTruthy();
    expect(await s3RuntimeInstalled(dir)).toBe(true);
    // Second call is a no-op even when the archive is gone.
    expect(
      await ensureS3Runtime({ archive: '/nonexistent.zip', dir, source: { url: '', sha256 } }),
    ).toBe(dir);
  });

  it('rejects a checksum mismatch before extracting and leaves nothing installed', async () => {
    const dir = path.join(root, 'rt-bad');
    await expect(
      ensureS3Runtime({ archive, dir, source: { url: '', sha256: '0'.repeat(64) } }),
    ).rejects.toThrow(/Checksum RustFS tidak cocok/);
    expect(existsSync(dir)).toBe(false);
    expect((await fs.readdir(root)).filter((f) => f.includes('.tmp-'))).toEqual([]);
  });
});
