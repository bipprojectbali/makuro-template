import { describe, expect, it } from 'bun:test';
import { isHttpProbe, probeResponse } from '../server/http-probes';

describe('http probes', () => {
  it('recognizes Chrome DevTools well-known probe and legacy icon lookups', () => {
    expect(isHttpProbe('/.well-known/appspecific/com.chrome.devtools.json')).toBe(true);
    expect(isHttpProbe('/.well-known/security.txt')).toBe(true);
    expect(isHttpProbe('/favicon.ico')).toBe(true);
    expect(isHttpProbe('/apple-touch-icon-precomposed.png')).toBe(true);
    expect(isHttpProbe('/apple-touch-icon-120x120.png')).toBe(true);
  });

  it('leaves app routes alone', () => {
    expect(isHttpProbe('/')).toBe(false);
    expect(isHttpProbe('/login')).toBe(false);
    expect(isHttpProbe('/api/auth/session')).toBe(false);
    expect(isHttpProbe('/favicon.svg')).toBe(false);
    // Real file in public/, must reach the static handler.
    expect(isHttpProbe('/apple-touch-icon.png')).toBe(false);
  });

  it('redirects /favicon.ico to the SVG icon the app actually ships, cacheable', async () => {
    const res = probeResponse('/favicon.ico');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/favicon.svg');
    expect(res.headers.get('cache-control')).toContain('max-age=');
    expect(await res.text()).toBe('');
  });

  it('redirects guessed apple-touch-icon names to the real PNG', () => {
    const res = probeResponse('/apple-touch-icon-precomposed.png');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/apple-touch-icon.png');
  });

  it('answers with an empty, uncached 404', async () => {
    const res = probeResponse('/.well-known/security.txt');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
  });
});
