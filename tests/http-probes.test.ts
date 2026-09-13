import { describe, expect, it } from 'bun:test';
import { isHttpProbe, probeResponse } from '../server/http-probes';

describe('http probes', () => {
  it('recognizes Chrome DevTools well-known probe', () => {
    expect(isHttpProbe('/.well-known/appspecific/com.chrome.devtools.json')).toBe(true);
    expect(isHttpProbe('/.well-known/security.txt')).toBe(true);
  });

  it('leaves app routes alone', () => {
    expect(isHttpProbe('/')).toBe(false);
    expect(isHttpProbe('/login')).toBe(false);
    expect(isHttpProbe('/api/auth/session')).toBe(false);
  });

  it('answers with an empty, uncached 404', async () => {
    const res = probeResponse();
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
  });
});
