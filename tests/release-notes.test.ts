import { describe, expect, test } from 'bun:test';
import { releaseNotes } from '../scripts/release-notes';
import { PKG_VERSION } from '../server/pkg';

const MD = `# Changelog

## [Unreleased]

### Added
- belum rilis

## [1.2.0] - 2026-10-01

### Added
- fitur baru

### Fixed
- bug lama

## [1.1.0] - 2026-09-01

### Added
- fitur lama
`;

describe('releaseNotes', () => {
  test('returns only the matching version section', () => {
    expect(releaseNotes('v1.2.0', '1.2.0', MD)).toBe(
      '### Added\n- fitur baru\n\n### Fixed\n- bug lama',
    );
  });

  test('last section runs to end of file', () => {
    expect(releaseNotes('v1.1.0', '1.1.0', MD)).toBe('### Added\n- fitur lama');
  });

  test('rejects a tag that does not match package.json version', () => {
    expect(() => releaseNotes('v1.3.0', '1.2.0', MD)).toThrow('tidak cocok');
    expect(() => releaseNotes('main', '1.2.0', MD)).toThrow('tidak cocok');
  });

  test('rejects a version without a CHANGELOG entry', () => {
    expect(() => releaseNotes('v9.0.0', '9.0.0', MD)).toThrow('belum punya entry');
  });

  test('rejects an empty entry', () => {
    expect(() =>
      releaseNotes('v2.0.0', '2.0.0', '## [2.0.0] - 2026-10-02\n\n## [1.0.0]\n- x'),
    ).toThrow('kosong');
  });

  test('current package.json version has release notes in CHANGELOG.md', async () => {
    const md = await Bun.file('CHANGELOG.md').text();
    expect(releaseNotes(`v${PKG_VERSION}`, PKG_VERSION, md)).toContain('### ');
  });
});
