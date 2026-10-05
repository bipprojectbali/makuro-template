import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PKG_NAME } from '../server/pkg';

const os = process.platform === 'darwin' ? 'darwin' : 'linux';
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const asset = `${PKG_NAME}-${os}-${arch}`;
const payload = '#!/bin/sh\necho fake-binary\n'; // test-only

function sha256(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

let server: ReturnType<typeof Bun.serve>;
let checksums = '';
let tmp = '';

beforeAll(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'install-sh-'));
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const file = new URL(req.url).pathname.split('/').pop();
      if (file === asset) return new Response(payload);
      if (file === 'checksums.txt') return new Response(checksums);
      return new Response('not found', { status: 404 });
    },
  });
});

afterAll(async () => {
  server.stop(true);
  await rm(tmp, { recursive: true, force: true });
});

async function runInstall(installDir: string) {
  const proc = Bun.spawn(['sh', 'install.sh'], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: tmp,
      MAKURO_DOWNLOAD_BASE: `http://127.0.0.1:${server.port}/dl`,
      MAKURO_INSTALL_DIR: installDir,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code, out, err };
}

describe('install.sh', () => {
  test('is valid POSIX sh', async () => {
    const proc = Bun.spawn(['sh', '-n', 'install.sh'], { stderr: 'pipe' });
    expect(await proc.exited).toBe(0);
  });

  test('installs the binary when checksum matches', async () => {
    checksums = `${sha256('other')}  other-file\n${sha256(payload)}  ${asset}\n`;
    const dir = path.join(tmp, 'ok-bin');
    const { code, out } = await runInstall(dir);
    expect(code).toBe(0);
    const installed = path.join(dir, PKG_NAME);
    expect(await Bun.file(installed).text()).toBe(payload);
    expect((await stat(installed)).mode & 0o777).toBe(0o755);
    expect(out).toContain(`${PKG_NAME} init`);
    expect(out).toContain('belum ada di PATH');
  });

  test('aborts without installing on checksum mismatch', async () => {
    checksums = `${sha256('tampered')}  ${asset}\n`;
    const dir = path.join(tmp, 'bad-bin');
    const { code, err } = await runInstall(dir);
    expect(code).not.toBe(0);
    expect(err).toContain('checksum tidak cocok');
    expect(await Bun.file(path.join(dir, PKG_NAME)).exists()).toBe(false);
  });

  test('aborts when checksums.txt lacks the asset', async () => {
    checksums = `${sha256(payload)}  something-else\n`;
    const dir = path.join(tmp, 'missing-bin');
    const { code, err } = await runInstall(dir);
    expect(code).not.toBe(0);
    expect(err).toContain('tidak memuat');
    expect(await Bun.file(path.join(dir, PKG_NAME)).exists()).toBe(false);
  });
});
