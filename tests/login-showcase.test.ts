import { describe, expect, it } from 'bun:test';
import {
  linePath,
  SHOWCASE_DATA,
  SHOWCASE_RANGES,
} from '../app/components/login/login-showcase.content';

const points = (d: string) =>
  [...d.matchAll(/[ML] (-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('linePath', () => {
  it('emits one point per value, starting with M', () => {
    const d = linePath([1, 2, 3, 4], 300, 100);
    expect(d.startsWith('M ')).toBe(true);
    expect(points(d)).toHaveLength(4);
    expect(d.match(/L /g)).toHaveLength(3);
  });

  it('scales to bounds: min at bottom, max at top, x spans the width', () => {
    const p = points(linePath([10, 50, 30], 200, 80));
    expect(p[0]).toEqual([0, 80]);
    expect(p[1]).toEqual([100, 0]);
    expect(p[2]).toEqual([200, 40]);
  });

  it('centers a flat series vertically', () => {
    const p = points(linePath([5, 5, 5], 100, 60));
    expect(p.map(([, y]) => y)).toEqual([30, 30, 30]);
  });

  it('handles empty and single-value input', () => {
    expect(linePath([], 100, 50)).toBe('');
    expect(points(linePath([7], 100, 50))).toEqual([[0, 25]]);
  });
});

describe('showcase content', () => {
  it('has a dataset of equal length for every range', () => {
    const lengths = SHOWCASE_RANGES.map((r) => SHOWCASE_DATA[r.value].values.length);
    expect(lengths.every((n) => n === lengths[0] && n > 1)).toBe(true);
  });
});
