import { describe, expect, test } from 'bun:test';
import { initialMode, modeCopy } from '../app/lib/login-mode';

const q = (s: string) => new URLSearchParams(s);

describe('initialMode', () => {
  test('defaults to signin', () => {
    expect(initialMode(q(''), true)).toBe('signin');
  });

  test('?mode=signup opens signup when allowed', () => {
    expect(initialMode(q('mode=signup'), true)).toBe('signup');
  });

  test('?mode=signup ignored when signup is disabled', () => {
    expect(initialMode(q('mode=signup'), false)).toBe('signin');
  });

  test('unknown mode values fall back to signin', () => {
    expect(initialMode(q('mode=admin'), true)).toBe('signin');
  });
});

describe('modeCopy', () => {
  test('signin copy points to signup', () => {
    const c = modeCopy('signin', 'Acme');
    expect(c.title).toBe('Masuk ke akunmu');
    expect(c.submit).toBe('Masuk');
    expect(c.switchPrompt).toBe('Belum punya akun?');
    expect(c.switchAction).toBe('Daftar');
    expect(c.subtitle).toContain('Acme');
  });

  test('signup copy points back to signin', () => {
    const c = modeCopy('signup', 'Acme');
    expect(c.title).toBe('Buat akun');
    expect(c.submit).toBe('Buat akun');
    expect(c.switchPrompt).toBe('Sudah punya akun?');
    expect(c.switchAction).toBe('Masuk');
    expect(c.subtitle).toContain('Acme');
  });
});
