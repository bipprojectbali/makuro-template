/** /dev sidebar counters: one badge per menu, sane tones, short-lived cache. */
import { describe, expect, test } from 'bun:test';
import { devSidebarBadges } from '../server/sidebar-badges';

describe('devSidebarBadges', () => {
  test('returns a numeric badge with tooltip and tone for every console menu it covers', async () => {
    const badges = await devSidebarBadges({ fresh: true });
    const expected = [
      '/dev/users',
      '/dev/sessions',
      '/dev/posts',
      '/dev/api-keys',
      '/dev/db-schema',
      '/dev/visits',
      '/dev/login-logs',
      '/dev/rate-limit-logs',
      '/dev/server-logs',
      '/dev/audit',
      '/dev/settings',
      '/dev/tools',
    ];
    for (const route of expected) {
      const b = badges[route];
      expect(b).toBeDefined();
      expect(Number.isInteger(b.value) && b.value >= 0).toBe(true);
      expect(b.tone === 'alert' || b.tone === 'info').toBe(true);
      if (b.value > 0) expect(b.tooltip).toBeTruthy();
    }
    // Attention badges carry a color; scale badges are gray.
    expect(badges['/dev/rate-limit-logs'].color).toBe('red');
    expect(badges['/dev/db-schema'].color).toBe('red');
    expect(badges['/dev/users'].color === 'gray' || badges['/dev/users'].color === 'orange').toBe(
      true,
    );
    expect(badges['/dev/visits'].tone).toBe('info');
  });
  test('serves the same promise within the cache window', async () => {
    const a = devSidebarBadges();
    const b = devSidebarBadges();
    expect(a).toBe(b);
    expect(await devSidebarBadges({ fresh: true })).not.toBe(await a);
  });
});
