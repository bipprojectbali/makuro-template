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
 *  - /apple-touch-icon*.png: iOS home-screen icon lookups.
 */
const PROBE_PREFIXES = ['/.well-known/', '/apple-touch-icon'];
const FAVICON_ICO = '/favicon.ico';
/** Must match the <link rel="icon"> in app/root.tsx. */
const FAVICON_SVG = '/favicon.svg';
const FAVICON_CACHE_SECONDS = 86_400;

export function isHttpProbe(pathname: string): boolean {
  return pathname === FAVICON_ICO || PROBE_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Legacy favicon → the real icon; everything else an empty, uncached 404. */
export function probeResponse(pathname = ''): Response {
  if (pathname === FAVICON_ICO)
    return new Response(null, {
      status: 302,
      headers: {
        location: FAVICON_SVG,
        'cache-control': `public, max-age=${FAVICON_CACHE_SECONDS}`,
      },
    });
  return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
}
