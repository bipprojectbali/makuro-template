import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APP = path.join(import.meta.dir, '../app');
const routeFiles = [
  ...new Set(
    [...readFileSync(path.join(APP, 'routes.ts'), 'utf8').matchAll(/'(routes\/[^']+\.tsx)'/g)].map(
      (m) => m[1],
    ),
  ),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name));
}

describe('app contracts (CLAUDE.md blockers)', () => {
  test('routes.ts registers route modules', () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  test.each(routeFiles)('%s exports meta() when it renders a page', (file) => {
    const src = readFileSync(path.join(APP, file), 'utf8');
    // Redirect-only routes (no component, or one that renders null) are exempt.
    if (
      !/export default/.test(src) ||
      /export default function \w*\(\) \{\s*return null;\s*\}/.test(src)
    )
      return;
    expect(src).toMatch(/export (async )?function meta\b|export const meta\b/);
  });

  test('root.tsx provides the global meta() fallback', () => {
    expect(readFileSync(path.join(APP, 'root.tsx'), 'utf8')).toMatch(/export function meta\b/);
  });

  test('no native window.confirm/alert/prompt in app/', () => {
    const offenders = sourceFiles(APP).filter((f) =>
      /\bwindow\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(confirm|alert|prompt)\s*\(\s*['"`]/m.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders.map((f) => path.relative(APP, f))).toEqual([]);
  });
});
