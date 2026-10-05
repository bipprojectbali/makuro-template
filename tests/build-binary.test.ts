import { describe, expect, test } from 'bun:test';
import { checksumLine, isTarget, outfileFor, TARGETS } from '../scripts/build-binary';
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
