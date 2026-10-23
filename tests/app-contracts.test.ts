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

  test('root.tsx declares lang="id" on <html>', () => {
    const src = readFileSync(path.join(APP, 'root.tsx'), 'utf8');
    expect(
      src,
      'root.tsx: <html> wajib lang="id" — seluruh konten app berbahasa Indonesia',
    ).toMatch(/<html lang="id"/);
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

// `<Table[\s>]` on purpose: `<Table.Thead>`/`<TableDetailDrawer` also start with "<Table".
const TABLE_EL = /<Table[\s>]/;
const TABLE_TH = /<Table\.Th[\s>]/g;
/** Mobile card view required above this many columns (CLAUDE.md: ≥4). */
const CARD_VIEW_MIN_COLS = 4;
/**
 * Narrow 4-column detail table inside a Drawer (Nama/Tipe/Null/Default) — the drawer is
 * already a mobile-width surface and the scroll wrapper keeps it usable. Remove this entry
 * if the table grows richer columns.
 */
const CARD_VIEW_EXEMPT = ['components/db-schema/TableDetailDrawer.tsx'];
/** Largest phone width we support (iPhone SE). */
const MIN_VIEWPORT = 375;

describe('mobile blockers (CLAUDE.md)', () => {
  const files = sourceFiles(APP).map((f) => ({
    rel: path.relative(APP, f),
    src: readFileSync(f, 'utf8'),
  }));
  const tableFiles = files.filter((f) => TABLE_EL.test(f.src));

  test('tables exist to be checked', () => {
    expect(tableFiles.length).toBeGreaterThan(5);
  });

  test('Burger lives inside AppShell.Header, never floating', () => {
    const withBurger = files.filter((f) => /<Burger\b/.test(f.src));
    expect(withBurger.length).toBeGreaterThan(0);
    for (const f of withBurger) {
      expect(f.src, `${f.rel}: Burger tanpa AppShell.Header`).toMatch(/<AppShell\.Header\b/);
      expect(f.src, `${f.rel}: Burger floating pos="fixed"`).not.toMatch(/pos="fixed"/);
    }
  });

  test('every table has a horizontal scroll wrapper', () => {
    const offenders = tableFiles
      .filter((f) => !/overflowX|Table\.ScrollContainer/.test(f.src))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  test(`tables with ≥${CARD_VIEW_MIN_COLS} columns have a mobile card view`, () => {
    const mobileViews = files.filter((f) => /hiddenFrom="sm"/.test(f.src));
    const offenders = tableFiles
      .filter((f) => [...f.src.matchAll(TABLE_TH)].length >= CARD_VIEW_MIN_COLS)
      .filter((f) => !CARD_VIEW_EXEMPT.includes(f.rel))
      .filter((f) => {
        // Card view in the same file is self-evident.
        if (/hiddenFrom="sm"/.test(f.src)) return false;
        // Otherwise the route owns the pairing, matched by name: VisitTable → <VisitCardList.
        const stem = path.basename(f.rel, '.tsx');
        const prefix = stem.replace(/(Table|LogSection|Section|Panel)$/, '');
        return !mobileViews.some(
          (m) =>
            new RegExp(`from '[^']*${stem}'`).test(m.src) &&
            new RegExp(`<${prefix}\\w*CardList`).test(m.src),
        );
      })
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  test(`no fixed width above ${MIN_VIEWPORT}px`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of f.src.matchAll(/\bw=\{(\d{3,})\}|[^a-zA-Z]width:\s*(\d{3,})/g)) {
        const px = Number(m[1] ?? m[2]);
        if (px > MIN_VIEWPORT) offenders.push(`${f.rel}: ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('Menu dropdown never anchors sideways', () => {
    const offenders: string[] = [];
    for (const f of files) {
      // Hanya `position=` di dalam tag pembuka <Menu ...> — Tooltip/Drawer position="right" sah.
      for (const m of f.src.matchAll(/<Menu\b[^>]*>/g)) {
        if (/position="(right|left)/.test(m[0])) offenders.push(`${f.rel}: ${m[0].trim()}`);
      }
    }
    expect(
      offenders,
      'Menu dengan position="right…"/"left…" butuh ≥240px ruang kosong di samping target — ' +
        'di HP (viewport 375px, sidebar 240px) dropdown terdesak ke tepi dan memicu scroll ' +
        'horizontal. Pakai "bottom-end" atau "top-start".',
    ).toEqual([]);
  });

  test('route headers let action buttons wrap', () => {
    const offenders: string[] = [];
    for (const f of files.filter((f) => f.rel.startsWith('routes/'))) {
      for (const m of f.src.matchAll(/wrap="nowrap"/g)) {
        // Proxy for "this is an action header": a Button right after the nowrap group.
        if (/<Button\b/.test(f.src.slice(m.index, m.index + 400)))
          offenders.push(`${f.rel}: wrap="nowrap" dengan Button`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
