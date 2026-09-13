import { describe, expect, it } from 'bun:test';
import { FiHome } from 'react-icons/fi';
import { homePath, isNavActive, normalizeNav, withBadges } from '../app/components/frame/nav';

const a = { to: '/dev', label: 'Users', icon: FiHome };
const b = { to: '/dev/visits', label: 'Visits', icon: FiHome };

describe('normalizeNav', () => {
  it('wraps a flat list in one unlabeled group and drops empty groups', () => {
    expect(normalizeNav([a, b])).toEqual([{ items: [a, b] }]);
    expect(
      normalizeNav([
        { label: 'X', items: [] },
        { label: 'Y', items: [b] },
      ]),
    ).toEqual([{ label: 'Y', items: [b] }]);
    expect(normalizeNav(undefined)).toEqual([]);
  });
});

describe('isNavActive', () => {
  it('matches exactly by default and by prefix when asked', () => {
    expect(isNavActive('/dev', a)).toBe(true);
    expect(isNavActive('/dev/visits', a)).toBe(false);
    expect(isNavActive('/dev/visits/abc', { ...b, matchPrefix: true })).toBe(true);
    expect(isNavActive('/dev/visitsx', { ...b, matchPrefix: true })).toBe(false);
  });
});

describe('withBadges / homePath', () => {
  it('attaches only positive badges and keeps definitions immutable', () => {
    const groups = normalizeNav([a, b]);
    const out = withBadges(groups, { '/dev/visits': { value: 3 }, '/dev': { value: 0 } });
    expect(out[0].items[1].badge).toEqual({ value: 3 });
    expect(out[0].items[0].badge).toBeUndefined();
    expect(groups[0].items[1].badge).toBeUndefined();
    expect(homePath(groups)).toBe('/dev');
    expect(homePath([], '/x')).toBe('/x');
  });
});
