/**
 * Geo + locale enrichment for visitor analytics.
 *
 * We deliberately do NOT ship a GeoIP database or call a third-party lookup
 * API per request (privacy, latency, licensing). Instead we read the country /
 * region / city headers injected by the edge or reverse proxy in front of the
 * app. Supported out of the box:
 *   - Cloudflare:  CF-IPCountry, CF-Region-Code, CF-IPCity (Managed Transforms)
 *   - Vercel:      X-Vercel-IP-Country, X-Vercel-IP-Country-Region, X-Vercel-IP-City
 *   - CloudFront:  CloudFront-Viewer-Country, -Country-Region, -City
 *   - nginx/geoip2 convention: X-Country-Code, X-Region, X-City
 * Without such a proxy the fields stay null and the UI shows "Tidak diketahui"
 * (or "Lokal" for private/loopback IPs).
 */

export type VisitorGeo = {
  country: string | null;
  region: string | null;
  city: string | null;
};

const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'cloudfront-viewer-country',
  'x-country-code',
  'x-geo-country',
];
const REGION_HEADERS = [
  'cf-region-code',
  'x-vercel-ip-country-region',
  'cloudfront-viewer-country-region',
  'x-region',
  'x-geo-region',
];
const CITY_HEADERS = [
  'cf-ipcity',
  'x-vercel-ip-city',
  'cloudfront-viewer-city',
  'x-city',
  'x-geo-city',
];

// Cloudflare sentinel values: XX = unknown, T1 = Tor exit node.
const UNKNOWN_COUNTRIES = new Set(['XX', 'T1', 'ZZ']);

function firstHeader(headers: Headers, names: string[]): string | null {
  for (const n of names) {
    const v = headers.get(n)?.trim();
    if (v) return v;
  }
  return null;
}

/** Normalize a raw country header to an upper-case ISO 3166-1 alpha-2 code. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || UNKNOWN_COUNTRIES.has(code)) return null;
  return code;
}

/** Read geo fields from proxy headers. Never throws. */
export function resolveGeo(headers: Headers): VisitorGeo {
  const city = firstHeader(headers, CITY_HEADERS);
  return {
    country: normalizeCountry(firstHeader(headers, COUNTRY_HEADERS)),
    region: firstHeader(headers, REGION_HEADERS),
    // Vercel percent-encodes city names ("S%C3%A3o%20Paulo").
    city: city ? safeDecode(city) : null,
  };
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    // Not percent-encoded (or malformed) — keep the raw header value.
    return v;
  }
}

/** Primary language tag from Accept-Language ("id-ID,id;q=0.9,en;q=0.8" → "id-ID"). */
export function primaryLanguage(acceptLanguage: string | null | undefined): string | null {
  if (!acceptLanguage) return null;
  const first = acceptLanguage.split(',')[0]?.split(';')[0]?.trim();
  if (!first || first === '*') return null;
  return first.slice(0, 35);
}

/** Referer reduced to origin + path — query strings may carry tokens/PII. */
export function sanitizeReferer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    // Only web origins are meaningful; "about:client" etc. parse but have origin "null".
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.origin}${u.pathname}`.slice(0, 512);
  } catch {
    // Not an absolute URL (e.g. a bare path) — drop it.
    return null;
  }
}
