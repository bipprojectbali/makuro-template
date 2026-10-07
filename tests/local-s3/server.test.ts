/** Real RustFS boot against the installed runtime (skipped when `init`/dev has not installed it). */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { statSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyStorageEnv, localTarget } from '../../server/local-s3/boot';
import { currentS3Platform } from '../../server/local-s3/paths';
import { s3RuntimeInstalled } from '../../server/local-s3/runtime';
import { boot, type LocalS3, s3Healthy } from '../../server/local-s3/server';
import { ensureBucket } from '../../server/storage/bucket';

const PORT = 54431; // test-only
const installed = currentS3Platform() !== null && (await s3RuntimeInstalled());

describe.skipIf(!installed)('local RustFS', () => {
  let dir: string;
  let s3: LocalS3;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-s3-boot-'));
    s3 = await boot({ dir, port: PORT });
  });
  afterAll(async () => {
    await s3?.stop();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('stores random credentials privately and locks the volume with its pid', async () => {
    const keys = path.join(dir, 'keys.json');
    expect(statSync(keys).mode & 0o777).toBe(0o600);
    expect(s3.accessKeyId).toMatch(/^[0-9a-f]{20}$/);
    expect(s3.secretAccessKey).toMatch(/^[0-9a-f]{40}$/);
    expect(Number(await Bun.file(path.join(dir, 'rustfs.pid')).text())).toBeGreaterThan(0);
  });

  it('serves S3 on loopback: bucket + write/read via Bun.S3Client', async () => {
    const target = localTarget(s3, 'boot-test');
    await ensureBucket(target);
    await ensureBucket(target); // idempotent
    const client = new Bun.S3Client(target);
    await client.write('hello.txt', 'halo');
    expect(await client.file('hello.txt').text()).toBe('halo');
    expect(await client.exists('missing.txt')).toBe(false);
    expect(s3.endpoint).toBe(`http://127.0.0.1:${PORT}`);
  });

  it('refuses a second instance on the same data dir or the same port', async () => {
    await expect(boot({ dir, port: PORT + 1 })).rejects.toThrow(/sudah memakai data dir/);
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'local-s3-other-'));
    try {
      await expect(boot({ dir: other, port: PORT })).rejects.toThrow(/Port 54431/);
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('applyStorageEnv fills every S3_* the storage client needs', () => {
    const saved = { ...process.env };
    try {
      applyStorageEnv(localTarget(s3, 'x-bucket'));
      expect(process.env.S3_ENDPOINT).toBe(s3.endpoint);
      expect(process.env.S3_BUCKET).toBe('x-bucket');
      expect(process.env.S3_REGION).toBe('us-east-1');
      expect(process.env.S3_ACCESS_KEY_ID?.length).toBe(20);
    } finally {
      for (const k of [
        'S3_ENDPOINT',
        'S3_BUCKET',
        'S3_REGION',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ])
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
  });

  it('stop() ends the process and releases port + lock (keys and data survive)', async () => {
    await s3.stop();
    expect(await s3Healthy(s3.endpoint)).toBe(false);
    expect(await Bun.file(path.join(dir, 'rustfs.pid')).exists()).toBe(false);
    expect(await Bun.file(path.join(dir, 'keys.json')).exists()).toBe(true);
    const again = await boot({ dir, port: PORT });
    try {
      expect(again.accessKeyId).toBe(s3.accessKeyId);
      const client = new Bun.S3Client(localTarget(again, 'boot-test'));
      expect(await client.file('hello.txt').text()).toBe('halo');
    } finally {
      await again.stop();
    }
  });
});
