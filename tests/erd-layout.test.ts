import { describe, expect, it } from 'bun:test';
import { applyLayout, nodeHeight, visibleColumns } from '../app/components/db-schema/erd.layout';
import { introspectDrizzleSchema } from '../server/db/schema-introspect';

const schema = introspectDrizzleSchema();

describe('erd layout', () => {
  it('positions every table without overlap on the same rank axis', () => {
    const { nodes, edges } = applyLayout(schema.tables, schema.edges, {
      direction: 'LR',
      compact: false,
      selectedId: null,
    });
    expect(nodes.length).toBe(schema.tables.length);
    expect(edges.length).toBe(schema.edges.length);
    const keys = new Set(
      nodes.map((n) => `${Math.round(n.position.x)}:${Math.round(n.position.y)}`),
    );
    expect(keys.size).toBe(nodes.length);
    expect(nodes.every((n) => n.data.dimmed === false && n.data.selected === false)).toBe(true);
  });

  it('highlights the selected table, its neighbours and shared columns; dims the rest', () => {
    const { nodes, edges } = applyLayout(schema.tables, schema.edges, {
      direction: 'TB',
      compact: false,
      selectedId: 'post',
    });
    const post = nodes.find((n) => n.id === 'post');
    const user = nodes.find((n) => n.id === 'user');
    const setting = nodes.find((n) => n.id === 'app_setting');
    expect(post?.data.selected).toBe(true);
    expect(user?.data.dimmed).toBe(false);
    expect(user?.data.hotColumns).toContain('id');
    expect(post?.data.hotColumns).toContain('author_id');
    expect(setting?.data.dimmed).toBe(true);
    const hotEdge = edges.find((e) => e.source === 'post');
    expect(hotEdge?.data?.hot).toBe(true);
    expect(edges.some((e) => e.data?.dimmed)).toBe(true);
  });

  it('compact mode keeps only key columns and shrinks node height', () => {
    const user = schema.tables.find((t) => t.id === 'user');
    if (!user) throw new Error('user table missing');
    expect(visibleColumns(user, true).every((c) => c.pk || c.fkTable)).toBe(true);
    expect(nodeHeight(user, true)).toBeLessThan(nodeHeight(user, false));
  });
});
