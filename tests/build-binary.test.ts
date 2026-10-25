import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import {
  binName,
  checksumLine,
  isReleaseAsset,
  isTarget,
  outfileFor,
  TARGETS,
} from '../scripts/build-binary';
import { PKG_NAME } from '../server/pkg';

describe('build-binary', () => {
  test('outfile per target follows <name>-<os>-<arch> release contract', () => {
    expect(TARGETS.map((t) => outfileFor(t))).toEqual([
      `dist/${PKG_NAME}-linux-x64`,
      `dist/${PKG_NAME}-linux-arm64`,
      `dist/${PKG_NAME}-darwin-arm64`,
      `dist/${PKG_NAME}-darwin-x64`,
    ]);
  });

  test('demo build names derive from the package name and never collide', () => {
    expect(binName()).toBe(PKG_NAME);
    expect(binName(true)).toBe(`${PKG_NAME}-demo`);
    expect(`./${binName(true)}`).not.toBe(`./${binName()}`);
    expect(TARGETS.map((t) => outfileFor(t, binName(true)))).toEqual([
      `dist/${PKG_NAME}-demo-linux-x64`,
      `dist/${PKG_NAME}-demo-linux-arm64`,
      `dist/${PKG_NAME}-demo-darwin-arm64`,
      `dist/${PKG_NAME}-demo-darwin-x64`,
    ]);
  });

  test('release assets match one base name exactly, so a shared dist/ never mixes demo and production', () => {
    const prod = TARGETS.map((t) => path.basename(outfileFor(t)));
    const demo = TARGETS.map((t) => path.basename(outfileFor(t, binName(true))));
    for (const file of prod) {
      expect(isReleaseAsset(file)).toBe(true);
      expect(isReleaseAsset(file, binName(true))).toBe(false);
    }
    for (const file of demo) {
      expect(isReleaseAsset(file)).toBe(false);
      expect(isReleaseAsset(file, binName(true))).toBe(true);
    }
    expect(isReleaseAsset('checksums.txt')).toBe(false);
    expect(isReleaseAsset('checksums.txt', binName(true))).toBe(false);
  });

  test('--demo passes the compile-time define that pins demo mode on', async () => {
    const script = await Bun.file('scripts/build-binary.ts').text();
    expect(script).toContain('process.env.MAKURO_DEMO_BUILD="1"');
  });

  test('install.sh asset name matches package name', async () => {
    const script = await Bun.file('install.sh').text();
    expect(script).toContain(`BIN_NAME="${PKG_NAME}"`);
  });

  test('checksum line is sha256sum-compatible (two spaces)', () => {
    expect(checksumLine('ab12', 'x-linux-x64')).toBe('ab12  x-linux-x64');
  });

  test('rejects unknown targets', () => {
    expect(isTarget('bun-linux-x64')).toBe(true);
    expect(isTarget('bun-windows-x64')).toBe(false);
    expect(isTarget('bun-linux-x64-musl')).toBe(false);
  });
});
