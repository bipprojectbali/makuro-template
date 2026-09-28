/**
 * Requests that browsers/devtools fire automatically and that no route serves.
 * Answering them before SSR keeps React Router from logging a 404 stack trace
 * and keeps them out of visitor analytics.
 *
 * Known probes:
 *  - Chrome DevTools "automatic workspace folders" looks up
 *    /.well-known/appspecific/com.chrome.devtools.json on every dev origin.
 *  - /favicon.ico: clients that ignore <link rel="icon"> (Safari in some flows,
 *    bookmark/preview fetchers, curl-based tools). The app only ships an SVG
 *    icon, so this redirects there instead of falling through to SSR.
 *  - /apple-touch-icon*.png: iOS home-screen icon lookups guess several names
 *    (-precomposed, -120x120, ...); all of them redirect to the one real PNG.
 */
const PROBE_PREFIXES = ['/.well-known/'];
const FAVICON_ICO = '/favicon.ico';
const APPLE_ICON_PREFIX = '/apple-touch-icon';
/** Must match the <link rel="apple-touch-icon"> in app/root.tsx (served from public/). */
const APPLE_ICON = '/apple-touch-icon.png';
/** Must match the <link rel="icon"> in app/root.tsx. */
const FAVICON_SVG = '/favicon.svg';
const FAVICON_CACHE_SECONDS = 86_400;

export function isHttpProbe(pathname: string): boolean {
  if (pathname === FAVICON_ICO) return true;
  if (pathname.startsWith(APPLE_ICON_PREFIX)) return pathname !== APPLE_ICON;
  return PROBE_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Guessed icon names → the real icon; everything else an empty, uncached 404. */
export function probeResponse(pathname = ''): Response {
  const icon =
    pathname === FAVICON_ICO
      ? FAVICON_SVG
      : pathname.startsWith(APPLE_ICON_PREFIX)
        ? APPLE_ICON
        : null;
  if (icon)
    return new Response(null, {
      status: 302,
      headers: {
        location: icon,
        'cache-control': `public, max-age=${FAVICON_CACHE_SECONDS}`,
      },
    });
  return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
}
