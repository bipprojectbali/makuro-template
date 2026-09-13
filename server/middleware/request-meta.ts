/**
 * Client metadata shared by visitor analytics and login logging: geo from
 * proxy headers, parsed device/browser, primary language, and (for logins)
 * the auth method derived from the Better Auth endpoint path.
 */
import { primaryLanguage, resolveGeo } from './visitor-geo';
import { parseUserAgent } from './visitor-ua';

export type ClientMeta = {
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | null;
  language: string | null;
};

function toHeaders(h: HeadersInit | Headers | null | undefined): Headers {
  if (!h) return new Headers();
  return h instanceof Headers ? h : new Headers(h);
}

/** Describe the client behind a request from its headers (+ explicit UA when known). */
export function describeClient(
  rawHeaders: HeadersInit | Headers | null | undefined,
  userAgent?: string | null,
  isBot = false,
): ClientMeta {
  const headers = toHeaders(rawHeaders);
  const ua = userAgent ?? headers.get('user-agent') ?? '';
  const device = parseUserAgent(ua, headers, isBot);
  const geo = resolveGeo(headers);
  return { ...geo, ...device, language: primaryLanguage(headers.get('accept-language')) };
}

/**
 * Better Auth endpoint path → login method label.
 *   /sign-in/email, /sign-up/email      → 'email'
 *   /callback/google, /oauth2/callback/x → provider id
 *   /admin/impersonate-user             → 'impersonation'
 *   /multi-session/set-active           → 'switch'
 */
export function loginMethodFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const p = path.toLowerCase();
  if (p.includes('impersonat')) return 'impersonation';
  if (p.includes('multi-session')) return 'switch';
  if (p.includes('/email')) return 'email';
  const cb = p.match(/callback\/([a-z0-9_-]+)/);
  if (cb) return cb[1];
  if (p.includes('/sign-in/social')) return 'social';
  return p.replace(/^\//, '').split('/')[0] || null;
}
