/**
 * Client IP resolution shared by rate limiting, visitor analytics and login logs.
 *
 * Order: proxy headers (X-Forwarded-For first hop, X-Real-IP) → the socket IP
 * that dev.ts / prod.ts stamp onto the request as an internal header → null.
 * The internal header is always overwritten server-side, so a client cannot
 * spoof it.
 */

/** Set by the HTTP servers from the socket address; never trusted from the wire. */
export const CLIENT_IP_HEADER = 'x-makuro-client-ip';

/** Canonical, human-readable form (IPv4-mapped → IPv4, IPv6 loopback → 127.0.0.1). */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip || null;
}

export function resolveClientIp(headers: Headers, socketIp?: string | null): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return normalizeIp(
    forwarded || headers.get('x-real-ip') || headers.get(CLIENT_IP_HEADER) || socketIp || null,
  );
}

/** Stamp the socket IP onto a request so downstream handlers (Elysia) can read it. */
export function stampClientIp(request: Request, socketIp: string | null | undefined): void {
  const ip = normalizeIp(socketIp);
  if (ip) request.headers.set(CLIENT_IP_HEADER, ip);
  else request.headers.delete(CLIENT_IP_HEADER);
}
