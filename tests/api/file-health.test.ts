import { describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({ user: { id: 'u-test' }, role: 'super-admin' }),
}));

import { fileHealthApi } from '../../server/api/file-health';

const app = new Elysia().use(fileHealthApi);

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await app.handle(new Request(url.toString()));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// Scans the real repository (cwd = project root under `bun run test`).
describe('GET /file-health', () => {
  test('returns summary, rules and paginated rows', async () => {
    const { status, body } = await get('/file-health', { limit: '5' });
    expect(status).toBe(200);
    expect(body.available).toBe(true);
    const summary = body.summary as { scanned: number };
    expect(summary.scanned).toBeGreaterThan(20);
    expect((body.rows as unknown[]).length).toBe(5);
    expect(body.total as number).toBe(summary.scanned);
    expect((body.rules as { hardLimitLines: number }).hardLimitLines).toBe(500);
    const hazards = body.hazards as Array<{ path: string; hazard: string }>;
    expect(hazards.some((h) => h.path === 'bun.lock' && h.hazard === 'danger')).toBe(true);
  });

  test('pagination: pages are disjoint and hazards stay whole-repo under a filter', async () => {
    const p1 = await get('/file-health', { limit: '3', page: '1', sort: 'path' });
    const p2 = await get('/file-health', { limit: '3', page: '2', sort: 'path' });
    const a = (p1.body.rows as Array<{ path: string }>).map((r) => r.path);
    const b = (p2.body.rows as Array<{ path: string }>).map((r) => r.path);
    expect(a.length).toBe(3);
    expect(a.some((x) => b.includes(x))).toBe(false);
    expect(p2.body.page).toBe(2);
    const filtered = await get('/file-health', { kind: 'test', limit: '3' });
    expect((filtered.body.hazards as unknown[]).length).toBeGreaterThan(0);
  });

  test('filters by kind and status, clamps limit', async () => {
    const { body } = await get('/file-health', { kind: 'test', limit: '9999' });
    const rows = body.rows as Array<{ kind: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kind === 'test')).toBe(true);
    expect(body.limit).toBe(500);
    const excluded = (await get('/file-health', { status: 'excluded' })).body.rows as Array<{
      path: string;
    }>;
    expect(excluded.some((r) => r.path === 'bun.lock')).toBe(true);
  });

  test('search narrows to matching paths', async () => {
    const { body } = await get('/file-health', { search: 'file-health.rules' });
    const rows = body.rows as Array<{ path: string }>;
    expect(rows.map((r) => r.path)).toContain('server/file-health/file-health.rules.ts');
  });
});

describe('GET /file-health/file', () => {
  test('returns one entry with advice', async () => {
    const { status, body } = await get('/file-health/file', {
      path: './server/api/file-health.ts',
    });
    expect(status).toBe(200);
    expect(body.kind).toBe('route');
    expect(typeof body.advice).toBe('string');
  });

  test('404 for unknown path', async () => {
    const { status } = await get('/file-health/file', { path: 'does/not/exist.ts' });
    expect(status).toBe(404);
  });
});
