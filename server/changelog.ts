/**
 * CHANGELOG.md (Keep a Changelog) parsed for /dev/changelog. Dev reads the file
 * live from the project root; prod/binary use the copy server/prod.ts embeds and
 * registers on globalThis (Vite cannot import .md, so the SSR bundle can't embed it).
 */
import path from 'node:path';
import { APP_VERSION } from './app-info';
import { type ChangelogOverview, countItems, parseChangelog } from './changelog-parse';

const g = globalThis as { __mkChangelog?: string };

export function registerBundledChangelog(text: string): void {
  g.__mkChangelog = text;
}

async function changelogText(): Promise<string | null> {
  if (g.__mkChangelog !== undefined) return g.__mkChangelog;
  const file = Bun.file(path.join(process.cwd(), 'CHANGELOG.md'));
  return (await file.exists()) ? file.text() : null;
}

export function summarizeChangelog(
  md: string | null,
  currentVersion = APP_VERSION,
): ChangelogOverview {
  const releases = md ? parseChangelog(md) : [];
  const unreleased = releases.find((r) => r.unreleased);
  return {
    available: md !== null,
    releases,
    currentVersion,
    currentHasEntry: releases.some((r) => r.version === currentVersion),
    unreleasedCount: unreleased ? countItems(unreleased) : 0,
  };
}

export async function changelogOverview(): Promise<ChangelogOverview> {
  return summarizeChangelog(await changelogText());
}
