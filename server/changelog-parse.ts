/** Pure CHANGELOG.md (Keep a Changelog) parsing — no I/O or env, so client code may import it. */

export type ChangelogSection = { type: string; items: string[] };
export type ChangelogRelease = {
  version: string;
  date: string | null;
  unreleased: boolean;
  sections: ChangelogSection[];
};
export type ChangelogOverview = {
  available: boolean;
  releases: ChangelogRelease[];
  currentVersion: string;
  currentHasEntry: boolean;
  unreleasedCount: number;
};

const RELEASE_RE = /^##\s+\[?v?([^\]\s]+)\]?(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/;
const SECTION_RE = /^###\s+(.+)$/;
const ITEM_RE = /^[-*]\s+(.+)$/;
const LINK_REF_RE = /^\[[^\]]+\]:\s/;
export const OTHER_SECTION = 'Lainnya';

export function parseChangelog(md: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let section: ChangelogSection | null = null;
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const rel = line.match(RELEASE_RE);
    if (rel) {
      const version = rel[1];
      const unreleased = version.toLowerCase() === 'unreleased';
      releases.push({
        version: unreleased ? 'Unreleased' : version,
        date: rel[2] ?? null,
        unreleased,
        sections: [],
      });
      section = null;
      continue;
    }
    const release = releases.at(-1);
    if (!release || !line.trim() || LINK_REF_RE.test(line)) continue;
    const sec = line.match(SECTION_RE);
    if (sec) {
      section = { type: sec[1].trim(), items: [] };
      release.sections.push(section);
      continue;
    }
    if (/^\s+\S/.test(line) && section?.items.length) {
      section.items[section.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    // Stray text under a release is kept rather than dropped, so a malformed line stays visible.
    if (!section) {
      section = { type: OTHER_SECTION, items: [] };
      release.sections.push(section);
    }
    section.items.push(line.match(ITEM_RE)?.[1] ?? line.trim());
  }
  return releases
    .map((r) => ({ ...r, sections: r.sections.filter((s) => s.items.length) }))
    .filter((r) => !r.unreleased || r.sections.length);
}

export const countItems = (r: ChangelogRelease) =>
  r.sections.reduce((n, s) => n + s.items.length, 0);

/** Keep only items of `type` (or all when null) containing `query`; empty releases drop out. */
export function filterReleases(
  releases: ChangelogRelease[],
  type: string | null,
  query: string,
): ChangelogRelease[] {
  const q = query.trim().toLowerCase();
  return releases
    .map((r) => ({
      ...r,
      sections: r.sections
        .filter((s) => !type || s.type === type)
        .map((s) => ({ ...s, items: s.items.filter((i) => i.toLowerCase().includes(q)) }))
        .filter((s) => s.items.length),
    }))
    .filter((r) => r.sections.length);
}
