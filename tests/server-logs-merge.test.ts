import { describe, expect, test } from 'bun:test';
import { mergeLogRows, type ServerLogRow } from '../app/lib/server-logs-api';

const row = (seq: number): ServerLogRow => ({
  seq,
  level: 30,
  levelName: 'info',
  time: seq,
  msg: `m${seq}`,
});

describe('mergeLogRows', () => {
  test('puts streamed rows on top and drops ones already in the snapshot', () => {
    const merged = mergeLogRows([row(6), row(5), row(4)], [row(4), row(3)]);
    expect(merged.map((r) => r.seq)).toEqual([6, 5, 4, 3]);
  });

  test('empty stream returns the snapshot unchanged', () => {
    expect(mergeLogRows([], [row(2), row(1)]).map((r) => r.seq)).toEqual([2, 1]);
  });
});
