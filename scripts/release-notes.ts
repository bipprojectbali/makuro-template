/** Release gate: the tag must equal `v<package.json version>`; prints that version's CHANGELOG section as release notes. */
import { PKG_VERSION } from '../server/pkg';

export function releaseNotes(tag: string, version: string, changelog: string): string {
  if (tag !== `v${version}`) {
    throw new Error(
      `Tag "${tag}" tidak cocok dengan version package.json (${version}). Naikkan version lalu buat tag v${version}.`,
    );
  }
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) throw new Error(`CHANGELOG.md belum punya entry "## [${version}]".`);
  const next = lines.findIndex((l, i) => i > start && l.startsWith('## ['));
  const body = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join('\n')
    .trim();
  if (!body) throw new Error(`Entry "## [${version}]" di CHANGELOG.md kosong.`);
  return body;
}

if (import.meta.main) {
  try {
    const notes = releaseNotes(
      process.argv[2] ?? '',
      PKG_VERSION,
      await Bun.file('CHANGELOG.md').text(),
    );
    process.stdout.write(`${notes}\n`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
