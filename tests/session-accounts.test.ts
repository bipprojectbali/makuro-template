import { describe, expect, test } from 'bun:test';
import { type DeviceSessionEntry, toAccountOptions } from '../server/session-accounts';

const entry = (token: string, user: Partial<DeviceSessionEntry['user']>): DeviceSessionEntry => ({
  session: { token },
  user: { id: `${token}-id`, ...user },
});

describe('toAccountOptions', () => {
  const sessions: DeviceSessionEntry[] = [
    entry('t1', { name: 'Alice', email: 'alice@acme.com', image: 'https://img/a.png' }),
    entry('t2', { name: 'Bob', email: 'bob@acme.com' }),
  ];

  test('flags the active session by token', () => {
    const opts = toAccountOptions(sessions, 't2');
    expect(opts.find((o) => o.token === 't2')?.active).toBe(true);
    expect(opts.find((o) => o.token === 't1')?.active).toBe(false);
  });

  test('lists the active account first', () => {
    expect(toAccountOptions(sessions, 't2')[0].token).toBe('t2');
    expect(toAccountOptions(sessions, 't1')[0].token).toBe('t1');
  });

  test('maps fields and defaults missing image to null', () => {
    const [alice, bob] = toAccountOptions(sessions, 't1');
    expect(alice).toMatchObject({ userId: 't1-id', name: 'Alice', email: 'alice@acme.com' });
    expect(alice.image).toBe('https://img/a.png');
    expect(bob.image).toBeNull();
  });

  test('falls back to email then a label when name is blank', () => {
    const [byEmail, byLabel] = toAccountOptions(
      [entry('t3', { name: '  ', email: 'c@acme.com' }), entry('t4', {})],
      't3',
    );
    expect(byEmail.name).toBe('c@acme.com');
    expect(byLabel.name).toBe('Account');
    expect(byLabel.email).toBe('');
  });

  test('handles an empty session list', () => {
    expect(toAccountOptions([], null)).toEqual([]);
  });
});
