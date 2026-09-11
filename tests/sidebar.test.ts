/**
 * Tests for the SSR-safe sidebar collapse cookie helpers (server/sidebar.ts).
 */
import { describe, expect, test } from 'bun:test';
import { getSidebarCollapsed, sidebarCookieString } from '../server/sidebar';

function reqWithCookie(cookie?: string): Request {
  return new Request('http://localhost/', {
    headers: cookie ? { cookie } : {},
  });
}

describe('getSidebarCollapsed', () => {
  test('true when the collapse cookie is set to 1', () => {
    expect(getSidebarCollapsed(reqWithCookie('mk-sidebar-collapsed=1'))).toBe(true);
  });

  test('reads the flag among other cookies', () => {
    expect(getSidebarCollapsed(reqWithCookie('foo=bar; mk-sidebar-collapsed=1; baz=qux'))).toBe(
      true,
    );
  });

  test('false when set to 0', () => {
    expect(getSidebarCollapsed(reqWithCookie('mk-sidebar-collapsed=0'))).toBe(false);
  });

  test('false when the cookie is absent', () => {
    expect(getSidebarCollapsed(reqWithCookie())).toBe(false);
  });
});

describe('sidebarCookieString', () => {
  test('encodes collapsed=1 with path and max-age', () => {
    const s = sidebarCookieString(true);
    expect(s).toContain('mk-sidebar-collapsed=1');
    expect(s).toContain('path=/');
    expect(s).toContain('max-age=');
    expect(s).toContain('SameSite=Lax');
  });

  test('encodes expanded as 0', () => {
    expect(sidebarCookieString(false)).toContain('mk-sidebar-collapsed=0');
  });
});
