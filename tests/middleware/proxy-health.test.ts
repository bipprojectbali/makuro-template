import { describe, expect, it, spyOn } from 'bun:test';
import { logger } from '../../server/logger';
import { CLIENT_IP_HEADER, stampClientIp } from '../../server/middleware/client-ip';
import { CLOUDFLARE_IP_RANGES } from '../../server/middleware/cloudflare-ips';
import { detectProxySetup, proxyHealth } from '../../server/middleware/proxy-health';
import { createProxyMatcher } from '../../server/middleware/trusted-proxy';

function headers(stamped: string, extra: Record<string, string> = {}) {
  return new Headers({ [CLIENT_IP_HEADER]: stamped, ...extra });
}

describe('detectProxySetup', () => {
  it('cf-ray from a public peer → Cloudflare, from a private peer → Tunnel', () => {
    const cf = new Headers({ 'cf-ray': 'abc-SIN' });
    expect(detectProxySetup(cf, '172.68.1.1')).toBe('cloudflare');
    expect(detectProxySetup(cf, '127.0.0.1')).toBe('cloudflare-tunnel');
    expect(detectProxySetup(cf, '172.18.0.3')).toBe('cloudflare-tunnel');
    expect(detectProxySetup(cf, null)).toBe('cloudflare');
  });
  it('no cf-ray → generic reverse proxy', () => {
    expect(detectProxySetup(new Headers(), '10.0.0.5')).toBe('reverse-proxy');
  });
});

describe('proxyHealth', () => {
  it('null for a direct request without proxy headers', () => {
    expect(proxyHealth(headers('203.0.113.9'), [])).toBeNull();
  });
  it('catch-all entry wins over everything else', () => {
    expect(proxyHealth(headers('203.0.113.9'), ['0.0.0.0/0'])).toMatchObject({
      issue: 'catch-all',
      peerIp: null,
    });
  });
  it('ignored X-Forwarded-For → untrusted-proxy with the peer and detected setup', () => {
    const h = headers('127.0.0.1', { 'x-forwarded-for': '198.51.100.7', 'cf-ray': 'x' });
    expect(proxyHealth(h, [])).toMatchObject({
      issue: 'untrusted-proxy',
      peerIp: '127.0.0.1',
      setup: 'cloudflare-tunnel',
    });
  });
  it('client IP inside Cloudflare ranges → cloudflare-edge-ip', () => {
    const h = headers('162.158.10.1', { 'x-forwarded-for': '198.51.100.7, 162.158.10.1' });
    expect(proxyHealth(h, ['127.0.0.1'])).toMatchObject({
      issue: 'cloudflare-edge-ip',
      setup: 'cloudflare',
    });
  });
  it('bootId is stable within a process', () => {
    const a = proxyHealth(headers('1.1.1.1'), ['0.0.0.0/0']);
    const b = proxyHealth(headers('1.1.1.1'), ['0.0.0.0/0']);
    expect(a?.bootId).toBe(b?.bootId as number);
  });
});

describe('CLOUDFLARE_IP_RANGES', () => {
  it('every entry is a valid CIDR the matcher accepts', () => {
    const match = createProxyMatcher(CLOUDFLARE_IP_RANGES);
    expect(match('104.16.0.1')).toBe(true);
    expect(match('2606:4700::1')).toBe(true);
    expect(match('8.8.8.8')).toBe(false);
  });
});

describe('stampClientIp ignored-forwarder warning', () => {
  it('logs at most once per process', () => {
    const warn = spyOn(logger, 'warn');
    const none = createProxyMatcher([]);
    for (let i = 0; i < 3; i++) {
      const req = new Request('http://x/', { headers: { 'x-forwarded-for': '198.51.100.7' } });
      stampClientIp(req, '203.0.113.1', none);
    }
    const hits = warn.mock.calls.filter((c) => String(c[1]).includes('TRUSTED_PROXIES diabaikan'));
    expect(hits.length).toBeLessThanOrEqual(1);
    warn.mockRestore();
  });
});
