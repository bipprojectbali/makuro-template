import { describe, expect, test } from 'bun:test';
import { CONSOLE_PAGES } from '../app/components/landing/landing.content';
import routes from '../app/routes';
import { CONSOLE_PAGE_COUNT, landingStats } from '../server/landing-stats';

function countDevPages(list: unknown): number {
  let n = 0;
  const walk = (items: unknown[]) => {
    for (const r of items) {
      const route = r as { path?: string; file?: string; children?: unknown[] };
      if (route.path?.startsWith('dev')) n++;
      if (route.children) walk(route.children);
    }
  };
  walk(list as unknown[]);
  return n;
}

describe('landing stats', () => {
  test('console page count matches the registered /dev routes and the marketing list', () => {
    expect(countDevPages(routes)).toBe(CONSOLE_PAGE_COUNT);
    expect(CONSOLE_PAGES.length).toBe(CONSOLE_PAGE_COUNT);
  });
  test('numbers come from the running code', async () => {
    const s = await landingStats();
    expect(s.tables).toBeGreaterThan(5);
    expect(s.mcpTools).toBeGreaterThan(5);
    expect(s.testFiles).toBeGreaterThan(20);
    expect(s.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
