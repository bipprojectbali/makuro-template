import { describe, expect, test } from 'bun:test';
import { introspectDrizzleSchema } from '../../server/db/schema-introspect';
import { schemaStats } from '../../server/db/schema-stats';

describe('schemaStats', () => {
  test('returns row counts and sizes for every introspected table plus migration status', async () => {
    const names = introspectDrizzleSchema().tables.map((t) => t.id);
    const s = await schemaStats(names);
    expect(s.tables.map((t) => t.table).sort()).toEqual([...names].sort());
    for (const t of s.tables) {
      expect(t.rows).toBeGreaterThanOrEqual(0);
      expect(t.bytes).toBeGreaterThan(0);
    }
    expect(s.migrations.journal).toBeGreaterThan(0);
    expect(s.migrations.applied).toBeGreaterThanOrEqual(0);
    expect(s.migrations.pending).toBe(Math.max(0, s.migrations.journal - s.migrations.applied));
    expect(typeof s.migrations.latestTag).toBe('string');
  });
});
