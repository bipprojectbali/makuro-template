import { describe, expect, it } from 'bun:test';
import {
  describeSession,
  hasPasswordAccount,
  isCurrentSession,
  providerLabel,
} from '../app/lib/profile-api';

describe('profile-api helpers', () => {
  it('describeSession parses a UA into a readable device line', () => {
    const d = describeSession(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    );
    expect(d.summary).toContain('Safari');
    expect(d.device).toBe('Mobile');
    expect(describeSession(null).summary).toBe('Tidak dikenali');
  });
  it('isCurrentSession / hasPasswordAccount / providerLabel', () => {
    expect(isCurrentSession({ token: 'a' }, 'a')).toBe(true);
    expect(isCurrentSession({ token: 'a' }, null)).toBe(false);
    expect(hasPasswordAccount([{ id: '1', providerId: 'credential' }])).toBe(true);
    expect(hasPasswordAccount([{ id: '1', providerId: 'google' }])).toBe(false);
    expect(providerLabel('credential')).toBe('Email & password');
    expect(providerLabel('google')).toBe('Google');
  });
});
