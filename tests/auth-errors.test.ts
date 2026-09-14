/** Login copy for Better Auth codes and URL notices. */
import { describe, expect, test } from 'bun:test';
import { describeAuthError, loginNotice } from '../app/lib/auth-errors';

describe('describeAuthError', () => {
  test('banned code (any case) → banned notice', () => {
    expect(describeAuthError({ code: 'BANNED_USER', message: 'x' }).kind).toBe('banned');
    expect(describeAuthError('banned_user').kind).toBe('banned');
  });
  test('known codes get Indonesian copy, unknown fall back to the server message', () => {
    expect(describeAuthError({ code: 'INVALID_EMAIL_OR_PASSWORD' }).message).toContain('salah');
    expect(describeAuthError('unable_to_create_user').message).toContain('Google');
    const raw = describeAuthError({ code: 'SOMETHING_NEW', message: 'Server says no' });
    expect(raw.kind).toBe('error');
    expect(raw.message).toBe('Server says no');
    expect(describeAuthError(null).message).toContain('gagal');
  });
});

describe('loginNotice', () => {
  test('reads ?error (OAuth callback) and ?notice=session (guard)', () => {
    expect(loginNotice(new URLSearchParams('error=BANNED_USER'))?.kind).toBe('banned');
    expect(loginNotice(new URLSearchParams('error=access_denied'))?.message).toContain(
      'membatalkan',
    );
    expect(loginNotice(new URLSearchParams('notice=session'))?.kind).toBe('session');
    expect(loginNotice(new URLSearchParams(''))).toBeNull();
  });
});
