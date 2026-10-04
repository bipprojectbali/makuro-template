import { BlockList, isIP } from 'node:net';

/** Decides whether a peer address belongs to a trusted reverse proxy. */
export type ProxyMatcher = (ip: string) => boolean;

/** Splits a comma-separated TRUSTED_PROXIES value into trimmed, non-empty entries. */
export function splitProxyList(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function parseEntry(
  entry: string,
): { addr: string; family: 'ipv4' | 'ipv6'; prefix?: number } | null {
  const [addr = '', prefixRaw, extra] = entry.split('/');
  const fam = isIP(addr);
  if (!fam || extra !== undefined) return null;
  const family = fam === 4 ? 'ipv4' : 'ipv6';
  if (prefixRaw === undefined) return { addr, family };
  const prefix = Number(prefixRaw);
  const max = fam === 4 ? 32 : 128;
  if (!/^\d+$/.test(prefixRaw) || prefix > max) return null;
  return { addr, family, prefix };
}

/** Entries that are neither an IP nor a valid CIDR (used to fail boot). */
export function invalidProxyEntries(entries: readonly string[]): string[] {
  return entries.filter((e) => parseEntry(e) === null);
}

/** Builds a matcher for IPs/CIDRs (IPv4, IPv6; IPv4-mapped IPv6 matches IPv4 rules). */
export function createProxyMatcher(entries: readonly string[]): ProxyMatcher {
  if (entries.length === 0) return () => false;
  const list = new BlockList();
  for (const entry of entries) {
    const parsed = parseEntry(entry);
    if (!parsed) throw new Error(`TRUSTED_PROXIES: entri tidak valid "${entry}"`);
    if (parsed.prefix === undefined) list.addAddress(parsed.addr, parsed.family);
    else list.addSubnet(parsed.addr, parsed.prefix, parsed.family);
  }
  return (ip) => {
    const fam = isIP(ip);
    if (!fam) return false;
    try {
      return list.check(ip, fam === 4 ? 'ipv4' : 'ipv6');
    } catch {
      // Zone-scoped IPv6 (fe80::1%eth0) passes isIP but BlockList rejects it: not trusted.
      return false;
    }
  };
}
