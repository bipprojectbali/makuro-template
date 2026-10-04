/**
 * Client IP resolution shared by rate limiting, API-key allowlists, visitor
 * analytics, login and audit logs.
 *
 * The HTTP edge (dev.ts / prod.ts) computes the client IP once with
 * `stampClientIp` and writes it to CLIENT_IP_HEADER. Proxy headers are honoured
 * only when the socket peer is in TRUSTED_PROXIES; everything downstream reads
 * the stamped header via `resolveClientIp`, never raw X-Forwarded-For.
 */
import { isIP } from 'node:net';
import { env } from '../env';
import { createProxyMatcher, type ProxyMatcher } from './trusted-proxy';

/** Set by the HTTP servers; always overwritten, never trusted from the wire. */
export const CLIENT_IP_HEADER = 'x-makuro-client-ip';

const envTrustedProxies = createProxyMatcher(env.TRUSTED_PROXIES);

/** Canonical, human-readable form (IPv4-mapped → IPv4, IPv6 loopback → 127.0.0.1). */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip || null;
}

/**
 * Socket IP, unless the peer is a trusted proxy: then the rightmost untrusted,
 * valid X-Forwarded-For hop (fallback X-Real-IP, then the socket IP).
 */
export function clientIpFrom(
  headers: Headers,
  socketIp: string | null | undefined,
  isTrusted: ProxyMatcher = envTrustedProxies,
): string | null {
  const peer = socketIp?.trim() || null;
  if (!peer || !isTrusted(peer)) return normalizeIp(peer);

  const hops = (headers.get('x-forwarded-for') ?? '').split(',').map((h) => h.trim());
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i] ?? '';
    if (isIP(hop) && !isTrusted(hop)) return normalizeIp(hop);
  }
  const realIp = headers.get('x-real-ip')?.trim() ?? '';
  return normalizeIp(isIP(realIp) ? realIp : peer);
}

/** Resolve the client IP at the HTTP edge and stamp it for downstream handlers (Elysia, SSR). */
export function stampClientIp(
  request: Request,
  socketIp: string | null | undefined,
  isTrusted: ProxyMatcher = envTrustedProxies,
): void {
  const ip = clientIpFrom(request.headers, socketIp, isTrusted);
  if (ip) request.headers.set(CLIENT_IP_HEADER, ip);
  else request.headers.delete(CLIENT_IP_HEADER);
}

/** The stamped client IP (falls back to `explicitIp`); never reads proxy headers. */
export function resolveClientIp(headers: Headers, explicitIp?: string | null): string | null {
  return normalizeIp(headers.get(CLIENT_IP_HEADER) || explicitIp || null);
}
