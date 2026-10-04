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
import { logger } from '../logger';
import { catchAllProxyEntries, createProxyMatcher, type ProxyMatcher } from './trusted-proxy';

/** Set by the HTTP servers; always overwritten, never trusted from the wire. */
export const CLIENT_IP_HEADER = 'x-makuro-client-ip';

const envTrustedProxies = createProxyMatcher(env.TRUSTED_PROXIES);

const catchAll = catchAllProxyEntries(env.TRUSTED_PROXIES);
if (catchAll.length > 0) {
  logger.warn(
    { entries: catchAll },
    'TRUSTED_PROXIES memercayai semua alamat (/0): setiap klien bisa memalsukan IP-nya lewat X-Forwarded-For. Isi hanya dengan IP/CIDR reverse proxy Anda.',
  );
}

/** Canonical, human-readable form (IPv4-mapped → IPv4, IPv6 loopback → 127.0.0.1). */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip || null;
}

/** One proxy-header hop without `:port` / `[v6]` brackets; null when it is not an IP. */
function parseHop(raw: string): string | null {
  let hop = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(hop);
  if (bracketed) hop = bracketed[1] ?? '';
  else if (/^[\d.]+:\d{1,5}$/.test(hop)) hop = hop.slice(0, hop.lastIndexOf(':'));
  return isIP(hop) ? hop : null;
}

/**
 * Socket IP, unless the peer is a trusted proxy: then X-Forwarded-For walked
 * right-to-left — first untrusted hop wins, all-trusted → left-most hop, and a
 * hop that is not an IP stops the walk at the peer (never trust what lies left
 * of garbage). X-Real-IP only when X-Forwarded-For is absent.
 */
export function clientIpFrom(
  headers: Headers,
  socketIp: string | null | undefined,
  isTrusted: ProxyMatcher = envTrustedProxies,
): string | null {
  const peer = socketIp?.trim() || null;
  if (!peer || !isTrusted(peer)) return normalizeIp(peer);

  const forwarded = headers.get('x-forwarded-for')?.trim();
  if (!forwarded) return normalizeIp(parseHop(headers.get('x-real-ip') ?? '') ?? peer);

  const hops = forwarded.split(',');
  let leftMost = peer;
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = parseHop(hops[i] ?? '');
    if (!hop) return normalizeIp(peer);
    if (!isTrusted(hop)) return normalizeIp(hop);
    leftMost = hop;
  }
  return normalizeIp(leftMost);
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
