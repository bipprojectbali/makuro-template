import { describe, expect, it } from 'bun:test';
import { describeClient, loginMethodFromPath } from '../../server/middleware/request-meta';

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

describe('describeClient', () => {
  it('combines geo, device and language from headers', () => {
    const meta = describeClient(
      { 'cf-ipcountry': 'ID', 'cf-ipcity': 'Bandung', 'accept-language': 'id-ID,id;q=0.9' },
      UA,
    );
    expect(meta).toMatchObject({
      country: 'ID',
      city: 'Bandung',
      browser: 'Safari',
      os: 'iOS',
      deviceType: 'mobile',
      language: 'id-ID',
    });
  });

  it('falls back to the user-agent header and tolerates missing headers', () => {
    const fromHeader = describeClient(new Headers({ 'user-agent': UA }));
    expect(fromHeader.browser).toBe('Safari');
    const empty = describeClient(undefined);
    expect(empty.browser).toBeNull();
    expect(empty.country).toBeNull();
  });
});

describe('loginMethodFromPath', () => {
  it('maps Better Auth endpoint paths to method labels', () => {
    expect(loginMethodFromPath('/sign-in/email')).toBe('email');
    expect(loginMethodFromPath('/sign-up/email')).toBe('email');
    expect(loginMethodFromPath('/callback/google')).toBe('google');
    expect(loginMethodFromPath('/admin/impersonate-user')).toBe('impersonation');
    expect(loginMethodFromPath('/multi-session/set-active')).toBe('switch');
    expect(loginMethodFromPath('/sign-in/social')).toBe('social');
    expect(loginMethodFromPath(null)).toBeNull();
  });
});
