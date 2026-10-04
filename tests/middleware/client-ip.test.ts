import { describe, expect, it } from 'bun:test';
import { auth } from '../../server/auth';
import { TrustedProxiesSchema } from '../../server/env';
import {
  CLIENT_IP_HEADER,
  clientIpFrom,
  normalizeIp,
  resolveClientIp,
  stampClientIp,
} from '../../server/middleware/client-ip';
import {
  catchAllProxyEntries,
  createProxyMatcher,
  invalidProxyEntries,
} from '../../server/middleware/trusted-proxy';

const NONE = createProxyMatcher([]);
const LOCAL = createProxyMatcher(['127.0.0.1', '::1']);
const CHAIN = createProxyMatcher(['10.0.0.0/8', '2001:db8::/32']);
const xff = (value: string, extra: Record<string, string> = {}) =>
  new Headers({ 'x-forwarded-for': value, ...extra });

describe('clientIpFrom — no trusted proxies (default)', () => {
  it('ignores spoofed X-Forwarded-For / X-Real-IP and uses the socket IP', () => {
    const h = xff('1.2.3.4', { 'x-real-ip': '5.6.7.8' });
    expect(clientIpFrom(h, '198.51.100.9', NONE)).toBe('198.51.100.9');
    expect(clientIpFrom(h, '::ffff:198.51.100.9', NONE)).toBe('198.51.100.9');
    expect(clientIpFrom(h, null, NONE)).toBeNull();
  });

  it('does not honour proxy headers from an untrusted peer even when proxies are configured', () => {
    expect(clientIpFrom(xff('1.2.3.4'), '203.0.113.50', LOCAL)).toBe('203.0.113.50');
  });
});

describe('clientIpFrom — trusted proxy', () => {
  it('takes the rightmost untrusted hop and ignores a spoofed left-most entry', () => {
    expect(clientIpFrom(xff('6.6.6.6, 203.0.113.5'), '127.0.0.1', LOCAL)).toBe('203.0.113.5');
  });

  it('walks a multi-proxy chain right-to-left skipping trusted hops (CIDR)', () => {
    const h = xff('6.6.6.6, 203.0.113.5, 10.1.2.3, 10.200.0.1');
    expect(clientIpFrom(h, '10.0.0.2', CHAIN)).toBe('203.0.113.5');
  });

  it('stops at the first hop that is not an IP and falls back to the peer', () => {
    expect(clientIpFrom(xff('6.6.6.6, unknown'), '127.0.0.1', LOCAL)).toBe('127.0.0.1');
    const h = xff('203.0.113.5, not-an-ip, , 1.2.3.4:80, 999.1.1.1');
    expect(clientIpFrom(h, '127.0.0.1', LOCAL)).toBe('127.0.0.1');
    expect(clientIpFrom(xff('6.6.6.6, 10.1.1.1, '), '10.0.0.2', CHAIN)).toBe('10.0.0.2');
  });

  it('strips ports and IPv6 brackets before judging a hop', () => {
    expect(clientIpFrom(xff('6.6.6.6, 1.2.3.4:5678'), '127.0.0.1', LOCAL)).toBe('1.2.3.4');
    expect(clientIpFrom(xff('6.6.6.6, [2001:dead::1]:80'), '127.0.0.1', LOCAL)).toBe(
      '2001:dead::1',
    );
    expect(clientIpFrom(xff('6.6.6.6, [2001:dead::1]'), '127.0.0.1', LOCAL)).toBe('2001:dead::1');
    expect(clientIpFrom(xff('6.6.6.6, 203.0.113.5, 10.1.2.3:443'), '10.0.0.2', CHAIN)).toBe(
      '203.0.113.5',
    );
  });

  it('handles IPv6 clients, IPv6 proxies and IPv4-mapped forms', () => {
    expect(clientIpFrom(xff('2001:dead::7, 2001:db8::1'), '2001:db8::2', CHAIN)).toBe(
      '2001:dead::7',
    );
    expect(clientIpFrom(xff('::ffff:198.51.100.7'), '::ffff:10.0.0.9', CHAIN)).toBe('198.51.100.7');
    expect(clientIpFrom(xff('203.0.113.5'), '::1', LOCAL)).toBe('203.0.113.5');
  });

  it('returns the left-most hop when every hop is trusted', () => {
    expect(clientIpFrom(xff('10.9.9.9, 10.1.1.1'), '10.0.0.2', CHAIN)).toBe('10.9.9.9');
  });

  it('ignores X-Real-IP whenever X-Forwarded-For is present', () => {
    const h = xff('10.9.9.9', { 'x-real-ip': '6.6.6.6' });
    expect(clientIpFrom(h, '10.0.0.2', CHAIN)).toBe('10.9.9.9');
  });

  it('uses X-Real-IP only when X-Forwarded-For is absent and the peer is trusted', () => {
    const real = new Headers({ 'x-real-ip': '203.0.113.8' });
    expect(clientIpFrom(real, '10.0.0.2', CHAIN)).toBe('203.0.113.8');
    expect(clientIpFrom(real, '203.0.113.50', CHAIN)).toBe('203.0.113.50');
    expect(clientIpFrom(new Headers({ 'x-real-ip': 'garbage' }), '10.0.0.2', CHAIN)).toBe(
      '10.0.0.2',
    );
    expect(clientIpFrom(new Headers(), '10.0.0.2', CHAIN)).toBe('10.0.0.2');
  });

  it('ignores every proxy header from an untrusted peer', () => {
    const h = xff('1.2.3.4', { 'x-real-ip': '5.6.7.8', [CLIENT_IP_HEADER]: '9.9.9.9' });
    expect(clientIpFrom(h, '198.51.100.9', CHAIN)).toBe('198.51.100.9');
  });
});

describe('createProxyMatcher', () => {
  it('matches CIDR v4/v6 and rejects non-members', () => {
    expect(CHAIN('10.255.255.255')).toBe(true);
    expect(CHAIN('11.0.0.1')).toBe(false);
    expect(CHAIN('2001:db8:ffff::1')).toBe(true);
    expect(CHAIN('2001:db9::1')).toBe(false);
    expect(CHAIN('::ffff:10.1.1.1')).toBe(true);
    expect(CHAIN('garbage')).toBe(false);
    expect(CHAIN('fe80::1%eth0')).toBe(false);
  });

  it('rejects invalid entries', () => {
    expect(
      invalidProxyEntries(['10.0.0.0/8', '::1', 'nope', '10.0.0.0/33', '::/129', '1.2.3.4/8/1']),
    ).toEqual(['nope', '10.0.0.0/33', '::/129', '1.2.3.4/8/1']);
    expect(() => createProxyMatcher(['nope'])).toThrow('nope');
  });

  it('flags catch-all /0 entries (boot warning)', () => {
    expect(catchAllProxyEntries(['0.0.0.0/0', '10.0.0.0/8', '::/0', '::1', 'nope'])).toEqual([
      '0.0.0.0/0',
      '::/0',
    ]);
  });
});

describe('TRUSTED_PROXIES env schema', () => {
  it('parses a comma-separated list and defaults to empty', () => {
    expect(TrustedProxiesSchema.parse(' 127.0.0.1 , ::1,10.0.0.0/8 ')).toEqual([
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
    ]);
    expect(TrustedProxiesSchema.parse(undefined)).toEqual([]);
  });

  it('fails with an issue naming the bad entry', () => {
    const r = TrustedProxiesSchema.safeParse('127.0.0.1,10.0.0.0/99');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain('10.0.0.0/99');
  });
});

describe('stampClientIp', () => {
  it('overwrites an inbound internal header from the wire', () => {
    const req = new Request('http://localhost/api/x', {
      headers: { [CLIENT_IP_HEADER]: '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
    });
    stampClientIp(req, '::ffff:9.9.9.9', NONE);
    expect(req.headers.get(CLIENT_IP_HEADER)).toBe('9.9.9.9');
  });

  it('stamps the forwarded client when the peer is trusted', () => {
    const req = new Request('http://localhost/api/x', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });
    stampClientIp(req, '127.0.0.1', LOCAL);
    expect(req.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.5');
  });

  it('removes the header when nothing resolves', () => {
    const req = new Request('http://localhost/api/x', {
      headers: { [CLIENT_IP_HEADER]: '1.1.1.1' },
    });
    stampClientIp(req, null);
    expect(req.headers.get(CLIENT_IP_HEADER)).toBeNull();
  });
});

describe('resolveClientIp', () => {
  it('reads only the stamped header, never raw proxy headers', () => {
    expect(resolveClientIp(xff('203.0.113.5', { 'x-real-ip': '198.51.100.7' }))).toBeNull();
    expect(resolveClientIp(new Headers({ [CLIENT_IP_HEADER]: '::1' }))).toBe('127.0.0.1');
  });

  it('falls back to the explicit IP, then null', () => {
    expect(resolveClientIp(new Headers(), '::ffff:10.1.2.3')).toBe('10.1.2.3');
    expect(resolveClientIp(new Headers({ [CLIENT_IP_HEADER]: '9.9.9.9' }), '10.1.2.3')).toBe(
      '9.9.9.9',
    );
    expect(resolveClientIp(new Headers())).toBeNull();
  });
});

describe('normalizeIp', () => {
  it('canonicalizes loopback and IPv4-mapped forms', () => {
    expect(normalizeIp('::1')).toBe('127.0.0.1');
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(normalizeIp('::FFFF:7.7.7.7')).toBe('7.7.7.7');
    expect(normalizeIp('  ')).toBeNull();
  });
});

describe('Better Auth IP wiring', () => {
  it('reads the client IP from the stamped header only', () => {
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
  });

  it('keeps its own limiter production-only with memory storage', () => {
    expect(auth.options.rateLimit).toEqual({ enabled: false, storage: 'memory' });
  });
});
