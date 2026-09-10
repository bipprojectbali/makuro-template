const COOKIE_KEY = 'mk-sidebar-collapsed';

/** Reads sidebar collapse preference from request cookie. SSR-safe. */
export function getSidebarCollapsed(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.split(';').some((c) => c.trim() === `${COOKIE_KEY}=1`);
}

/** Cookie string to set in the browser (1 year, path=/). */
export function sidebarCookieString(collapsed: boolean): string {
  return `${COOKIE_KEY}=${collapsed ? '1' : '0'};path=/;max-age=${365 * 24 * 3600};SameSite=Lax`;
}
