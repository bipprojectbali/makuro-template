/**
 * Requests that browsers/devtools fire automatically and that no route serves.
 * Answering them before SSR keeps React Router from logging a 404 stack trace
 * and keeps them out of visitor analytics.
 *
 * Known probes: Chrome DevTools "automatic workspace folders" looks up
 * /.well-known/appspecific/com.chrome.devtools.json on every dev origin.
 */
const PROBE_PREFIXES = ['/.well-known/'];

export function isHttpProbe(pathname: string): boolean {
  return PROBE_PREFIXES.some((p) => pathname.startsWith(p));
}

export function probeResponse(): Response {
  return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
}
