import { describe, expect, it } from 'bun:test';
import {
  CLIENT_IP_HEADER,
  normalizeIp,
  resolveClientIp,
  stampClientIp,
} from '../../server/middleware/client-ip';

describe('resolveClientIp', () => {
  it('prefers the first X-Forwarded-For hop, then X-Real-IP', () => {
    expect(resolveClientIp(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe(
      '203.0.113.5',
    );
    expect(resolveClientIp(new Headers({ 'x-real-ip': '::ffff:198.51.100.7' }))).toBe(
      '198.51.100.7',
    );
  });

  it('falls back to the server-stamped header, then the socket IP, then null', () => {
    expect(resolveClientIp(new Headers({ [CLIENT_IP_HEADER]: '::1' }))).toBe('127.0.0.1');
    expect(resolveClientIp(new Headers(), '::ffff:10.1.2.3')).toBe('10.1.2.3');
    expect(resolveClientIp(new Headers())).toBeNull();
  });
});

describe('stampClientIp', () => {
  it('overwrites a spoofed internal header with the socket address', () => {
    const req = new Request('http://localhost/api/x', {
      headers: { [CLIENT_IP_HEADER]: '1.1.1.1' },
    });
    stampClientIp(req, '::ffff:9.9.9.9');
    expect(req.headers.get(CLIENT_IP_HEADER)).toBe('9.9.9.9');
  });

  it('removes the header when no socket address is known', () => {
    const req = new Request('http://localhost/api/x', {
      headers: { [CLIENT_IP_HEADER]: '1.1.1.1' },
    });
    stampClientIp(req, null);
    expect(req.headers.get(CLIENT_IP_HEADER)).toBeNull();
  });
});

describe('normalizeIp', () => {
  it('canonicalizes loopback and IPv4-mapped forms', () => {
    expect(normalizeIp('::1')).toBe('127.0.0.1');
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(normalizeIp('  ')).toBeNull();
  });
});
