import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { filterEntries } from '../../server/file-health/file-health.filter';
import { measureFile, scanFileHealth } from '../../server/file-health/file-health.scan';
import { fileHealthReport } from '../../server/mcp/tools/file-health';

let root = '';
const lines = (n: number, w = 'x') => Array.from({ length: n }, (_, i) => `${w}${i}`).join('\n');

// Build a throwaway project tree so the scan is deterministic (test-only).
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'file-health-'));
  await mkdir(path.join(root, 'server/api'), { recursive: true });
  await mkdir(path.join(root, 'server/db/migrations'), { recursive: true });
  await mkdir(path.join(root, 'app/routes'), { recursive: true });
  await mkdir(path.join(root, 'node_modules/pkg'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), '{}\n');
  await writeFile(path.join(root, 'server/api/ok.ts'), `${lines(50)}\n`);
  await writeFile(path.join(root, 'server/api/near.ts'), `${lines(130)}\n`);
  await writeFile(path.join(root, 'server/api/over.ts'), `${lines(160)}\n`);
  await writeFile(path.join(root, 'server/db/migrations/0001.sql'), `${lines(900)}\n`);
  await writeFile(path.join(root, 'app/routes/no-trailing-newline.tsx'), 'a\nb\nc');
  // ~70k chars → ~17.5k tokens → danger, and also over the 20k-char hard limit.
  await writeFile(path.join(root, 'app/routes/huge.tsx'), `${'z'.repeat(69_999)}\n`);
  await writeFile(path.join(root, 'node_modules/pkg/index.js'), lines(1000));
  await writeFile(path.join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('measureFile', () => {
  it('counts lines with and without trailing newline', async () => {
    const a = await measureFile(path.join(root, 'server/api/ok.ts'));
    expect(a.lines).toBe(50);
    const b = await measureFile(path.join(root, 'app/routes/no-trailing-newline.tsx'));
    expect(b.lines).toBe(3);
    expect(b.chars).toBe(5);
  });
});

describe('scanFileHealth', () => {
  it('skips ignored dirs and binaries, classifies and scores every text file', async () => {
    const r = await scanFileHealth({ root });
    expect(r.available).toBe(true);
    const paths = r.files.map((f) => f.path);
    expect(paths).not.toContain('node_modules/pkg/index.js');
    expect(paths).not.toContain('logo.png');
    expect(paths).toContain('package.json');

    const by = Object.fromEntries(r.files.map((f) => [f.path, f]));
    expect(by['server/api/ok.ts'].status).toBe('ok');
    expect(by['server/api/near.ts'].status).toBe('warn');
    expect(by['server/api/over.ts'].status).toBe('over');
    expect(by['server/api/over.ts'].limit).toBe(150);
    expect(by['server/db/migrations/0001.sql'].status).toBe('excluded');
    expect(by['server/db/migrations/0001.sql'].hardLimitViolation).toBe(false);
    expect(by['app/routes/huge.tsx'].hazard).toBe('danger');
    expect(by['app/routes/huge.tsx'].hardLimitViolation).toBe(true);
    expect(by['app/routes/huge.tsx'].advice).toContain('Jangan baca utuh');
  });

  it('summarizes counts by status, hazard and kind', async () => {
    const { summary } = await scanFileHealth({ root });
    expect(summary.scanned).toBe(7);
    expect(summary.over).toBe(2);
    expect(summary.warn).toBe(1);
    expect(summary.excluded).toBe(1);
    expect(summary.hardViolations).toBe(1);
    expect(summary.danger).toBe(1);
    expect(summary.byKind.find((k) => k.kind === 'route')?.count).toBe(3);
  });

  it('reports unavailable for a directory that is not a project root', async () => {
    const r = await scanFileHealth({ root: tmpdir() });
    expect(r.available).toBe(false);
    expect(r.reason).toContain('bukan root project');
  });
});

describe('filterEntries', () => {
  it('filters by status/kind/search and sorts worst first by default', async () => {
    const { files } = await scanFileHealth({ root });
    const routes = filterEntries(files, { kind: 'route' });
    expect(routes.map((f) => f.path)).toEqual([
      'server/api/over.ts',
      'server/api/near.ts',
      'server/api/ok.ts',
    ]);
    expect(filterEntries(files, { status: 'over' }).length).toBe(2);
    expect(filterEntries(files, { search: 'HUGE' }).map((f) => f.path)).toEqual([
      'app/routes/huge.tsx',
    ]);
    expect(filterEntries(files, { sort: 'tokens' })[0].path).toBe('app/routes/huge.tsx');
  });
});

describe('fileHealthReport (MCP tool payload)', () => {
  it('returns summary, offenders and context hazards without a path', async () => {
    const r = (await fileHealthReport({}, root)) as Record<string, unknown>;
    expect(r.available).toBe(true);
    const over = r.over as Array<{ path: string }>;
    expect(over.map((o) => o.path)).toContain('server/api/over.ts');
    const hazards = r.contextHazards as Array<{ path: string; hazard: string }>;
    expect(hazards[0]).toMatchObject({ path: 'app/routes/huge.tsx', hazard: 'danger' });
  });

  it('returns a single file with advice, tolerating a leading ./', async () => {
    const r = (await fileHealthReport({ path: './server/api/near.ts' }, root)) as {
      found: boolean;
      file: { status: string };
    };
    expect(r.found).toBe(true);
    expect(r.file.status).toBe('warn');
    const miss = (await fileHealthReport({ path: 'nope.ts' }, root)) as { found: boolean };
    expect(miss.found).toBe(false);
  });
});
