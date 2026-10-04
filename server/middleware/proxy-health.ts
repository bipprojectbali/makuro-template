/** Detects a misconfigured TRUSTED_PROXIES from the current request, for the /dev setup guide. */
import { env } from '../env';
import { forwardedHeaderIgnored, resolveClientIp } from './client-ip';
import { CLOUDFLARE_IP_RANGES } from './cloudflare-ips';
import { catchAllProxyEntries, createProxyMatcher } from './trusted-proxy';

const isPrivate = createProxyMatcher([
  '127.0.0.0/8',
  '::1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  'fc00::/7',
]);
const isCloudflare = createProxyMatcher(CLOUDFLARE_IP_RANGES);

export type ProxySetup = 'cloudflare' | 'cloudflare-tunnel' | 'reverse-proxy';
export type ProxyIssue = 'catch-all' | 'untrusted-proxy' | 'cloudflare-edge-ip';
export type ProxyHealth = {
  issue: ProxyIssue;
  /** The proxy the server saw (only for `untrusted-proxy`). */
  peerIp: string | null;
  setup: ProxySetup;
  /** Changes on every process start, so a dismissed banner returns after a restart. */
  bootId: number;
};

/** Best guess of what sits in front of the app, from Cloudflare's `cf-ray` and the peer address. */
export function detectProxySetup(headers: Headers, peerIp: string | null): ProxySetup {
  if (!headers.has('cf-ray')) return 'reverse-proxy';
  return peerIp && isPrivate(peerIp) ? 'cloudflare-tunnel' : 'cloudflare';
}

/** The TRUSTED_PROXIES problem visible on this request, or null when the setup looks right. */
export function proxyHealth(
  headers: Headers,
  entries: readonly string[] = env.TRUSTED_PROXIES,
): ProxyHealth | null {
  const bootId = Math.round(performance.timeOrigin);
  const ip = resolveClientIp(headers);
  if (catchAllProxyEntries(entries).length > 0)
    return { issue: 'catch-all', peerIp: null, setup: detectProxySetup(headers, null), bootId };
  if (forwardedHeaderIgnored(headers))
    return { issue: 'untrusted-proxy', peerIp: ip, setup: detectProxySetup(headers, ip), bootId };
  // Local proxy trusted but Cloudflare's edge not: the walk stops at the edge hop.
  if (ip && isCloudflare(ip))
    return { issue: 'cloudflare-edge-ip', peerIp: null, setup: 'cloudflare', bootId };
  return null;
}
