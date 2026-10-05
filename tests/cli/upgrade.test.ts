/** `upgrade`: asset naming, checksums parsing, verified download and atomic swap (never touches the real execPath). */
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assetName,
  downloadVerified,
  fetchRelease,
  latestTag,
  parseChecksums,
  pickChecksum,
  replaceBinary,
  run,
} from '../../server/cli/upgrade';
import { PKG_NAME, RELEASE_REPO } from '../../server/pkg';

const BIN = new TextEncoder().encode('#!/bin/sh\necho new\n'); // test-only
const sha = (b: Uint8Array) => new Bun.CryptoHasher('sha256').update(b).digest('hex');
const ASSET = `${PKG_NAME}-linux-x64`;

let server: ReturnType<typeof Bun.serve>;
let base: string;
const saved = { ...process.env };

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const p = new URL(req.url).pathname;
      if (p === `/repos/${RELEASE_REPO}/releases/latest`)
        return Response.json({ tag_name: 'v9.9.9' });
      if (p === '/dl/v9.9.9/checksums.txt')
        return new Response(`${sha(BIN)}  ${ASSET}\n${'0'.repeat(64)}  other\n`);
      if (p === `/dl/v9.9.9/${ASSET}`) return new Response(BIN);
      if (p === '/dl/bad') return new Response('tampered');
      return new Response('nope', { status: 404 });
    },
  });
  base = `http://127.0.0.1:${server.port}`;
  process.env.MAKURO_DOWNLOAD_BASE = `${base}/dl`;
  process.env.MAKURO_API_BASE = base;
});

afterAll(() => {
  server.stop(true);
  process.env = { ...saved };
});

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('upgrade helpers', () => {
  test('assetName follows <name>-<os>-<arch> and rejects unsupported platforms', () => {
    expect(assetName('linux', 'x64')).toBe(ASSET);
    expect(assetName('darwin', 'arm64')).toBe(`${PKG_NAME}-darwin-arm64`);
    expect(assetName('win32', 'x64')).toBeNull();
    expect(assetName('linux', 'ia32')).toBeNull();
  });

  test('parseChecksums reads sha256sum text (binary-mode marker included)', () => {
    const a = 'a'.repeat(64);
    const m = parseChecksums(`${a}  one\n${'B'.repeat(64)} *two\n\ngarbage line\n`);
    expect(m.get('one')).toBe(a);
    expect(m.get('two')).toBe('b'.repeat(64));
    expect(m.size).toBe(2);
    expect(pickChecksum(`${a}  one`, 'one')).toBe(a);
    expect(() => pickChecksum(`${a}  one`, 'missing')).toThrow(/missing/);
  });
});

describe('upgrade download', () => {
  test('latestTag reads tag_name from the releases API', async () => {
    expect(await latestTag()).toBe('v9.9.9');
  });

  test('fetchRelease returns bytes whose checksum matches checksums.txt', async () => {
    expect(await fetchRelease('v9.9.9', ASSET)).toEqual(BIN);
  });

  test('downloadVerified rejects a checksum mismatch and reports HTTP errors', async () => {
    await expect(downloadVerified(`${base}/dl/bad`, sha(BIN))).rejects.toThrow(
      /Checksum tidak cocok/,
    );
    await expect(downloadVerified(`${base}/dl/missing`, sha(BIN))).rejects.toThrow(/HTTP 404/);
  });

  test('replaceBinary swaps atomically, keeps .old and sets 755', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'makuro-upgrade-'));
    const target = path.join(dir, 'app');
    await Bun.write(target, 'old');
    await replaceBinary(target, BIN);
    expect(await Bun.file(target).text()).toBe(new TextDecoder().decode(BIN));
    expect(await Bun.file(`${target}.old`).text()).toBe('old');
    expect((await stat(target)).mode & 0o777).toBe(0o755);
    expect((await readdir(dir)).sort()).toEqual(['app', 'app.old']);
  });

  test('run refuses outside a compiled binary', async () => {
    expect(await run([])).toBe(2);
  });
});
