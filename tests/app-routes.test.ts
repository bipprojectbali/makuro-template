/**
 * Contract for the /app product area: its pages sit under the guarded app layout,
 * and each page loader guards itself (React Router runs layout and page loaders
 * in parallel, so the layout guard alone does not protect a page's data).
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import routes from '../app/routes';

type Entry = { file: string; path?: string; children?: Entry[] };
const APP_DIR = path.join(import.meta.dir, '../app');

function flatten(entries: Entry[]): Entry[] {
  return entries.flatMap((e) => [e, ...flatten(e.children ?? [])]);
}

describe('/app area', () => {
  const layout = (routes as Entry[]).find((e) => e.file === 'routes/app/layout.tsx');

  test('/app is a page inside the app layout', () => {
    expect(layout?.children?.map((c) => c.path)).toContain('app');
  });

  test('every routes/app page is a child of the app layout', () => {
    const appPages = flatten(routes as Entry[]).filter(
      (e) => e.file.startsWith('routes/app/') && e !== layout,
    );
    expect(appPages.length).toBeGreaterThan(0);
    expect(appPages.every((e) => layout?.children?.includes(e))).toBe(true);
  });

  test('every app page loader calls a role guard', () => {
    for (const child of layout?.children ?? []) {
      const src = readFileSync(path.join(APP_DIR, child.file), 'utf8');
      expect({
        file: child.file,
        guarded: /require(User|AnyRole|Role)\(request/.test(src),
      }).toEqual({ file: child.file, guarded: true });
    }
  });
});
