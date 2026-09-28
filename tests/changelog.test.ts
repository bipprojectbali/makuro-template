import { describe, expect, test } from 'bun:test';
import { summarizeChangelog } from '../server/changelog';
import { filterReleases, OTHER_SECTION, parseChangelog } from '../server/changelog-parse';

const MD = `# Changelog

Intro text before any release is ignored.

## [Unreleased]

### Added
- New \`/dev/changelog\` page
  continued on the next line.

## [v1.1.0] - 2026-09-20

### Fixed
- Login no longer loops.

### Removed
* Old flag.

## [1.0.0] - 2026-09-01
stray line without section

### Added
- First release.

[1.0.0]: https://example.com/compare/v1.0.0
`;

describe('parseChangelog', () => {
  const releases = parseChangelog(MD);

  test('reads releases in order with version, date and unreleased flag', () => {
    expect(releases.map((r) => [r.version, r.date, r.unreleased])).toEqual([
      ['Unreleased', null, true],
      ['1.1.0', '2026-09-20', false],
      ['1.0.0', '2026-09-01', false],
    ]);
  });

  test('groups items per section and joins continuation lines', () => {
    expect(releases[0].sections).toEqual([
      { type: 'Added', items: ['New `/dev/changelog` page continued on the next line.'] },
    ]);
    expect(releases[1].sections.map((s) => s.type)).toEqual(['Fixed', 'Removed']);
    expect(releases[1].sections[1].items).toEqual(['Old flag.']);
  });

  test('keeps stray text under Lainnya and skips link references', () => {
    expect(releases[2].sections).toEqual([
      { type: OTHER_SECTION, items: ['stray line without section'] },
      { type: 'Added', items: ['First release.'] },
    ]);
  });

  test('drops an empty Unreleased block but keeps empty numbered releases', () => {
    const r = parseChangelog('## [Unreleased]\n\n## [0.2.0] - 2026-01-01\n');
    expect(r.map((x) => x.version)).toEqual(['0.2.0']);
  });
});

describe('filterReleases', () => {
  const releases = parseChangelog(MD);

  test('filters by section type and drops releases without matches', () => {
    const r = filterReleases(releases, 'Added', '');
    expect(r.map((x) => x.version)).toEqual(['Unreleased', '1.0.0']);
    expect(r[1].sections.map((s) => s.type)).toEqual(['Added']);
  });

  test('searches case-insensitively', () => {
    const r = filterReleases(releases, null, '  LOGIN ');
    expect(r).toHaveLength(1);
    expect(r[0].sections[0].items).toEqual(['Login no longer loops.']);
  });

  test('returns nothing when no item matches', () => {
    expect(filterReleases(releases, 'Fixed', 'first')).toEqual([]);
  });
});

describe('summarizeChangelog', () => {
  test('reports missing file', () => {
    expect(summarizeChangelog(null, '1.0.0')).toEqual({
      available: false,
      releases: [],
      currentVersion: '1.0.0',
      currentHasEntry: false,
      unreleasedCount: 0,
    });
  });

  test('flags whether the running version has an entry and counts unreleased items', () => {
    const hit = summarizeChangelog(MD, '1.1.0');
    expect(hit.currentHasEntry).toBe(true);
    expect(hit.unreleasedCount).toBe(1);
    expect(summarizeChangelog(MD, '2.0.0').currentHasEntry).toBe(false);
  });
});
