/** Dagre auto-layout for the ERD (pure; tested in tests/erd-layout.test.ts). */
import dagre from '@dagrejs/dagre';
import type { FkEdge, TableMeta } from '@server/db/schema-introspect';
import type { Edge, Node } from '@xyflow/react';

export const NODE_WIDTH = 264;
export const HDR_H = 38;
export const ROW_H = 28;
export const PAD_B = 6;
/** Explicit hues (not theme tokens) so they read on both color schemes. */
export const ACCENT = '#4c6ef5';
export const PK_COL = '#e8960a';

export type Direction = 'LR' | 'TB';

export type TableNodeData = TableMeta & {
  compact: boolean;
  selected: boolean;
  dimmed: boolean;
  /** Column keys that participate in a highlighted relation. */
  hotColumns: string[];
};

export type ErdEdgeData = { label: string; dimmed: boolean; hot: boolean; onDelete: string };

/** Columns shown for a table in the current mode (compact = keys only). */
export function visibleColumns(t: TableMeta, compact: boolean) {
  return compact ? t.columns.filter((c) => c.pk || c.fkTable) : t.columns;
}

export function nodeHeight(t: TableMeta, compact: boolean): number {
  return HDR_H + visibleColumns(t, compact).length * ROW_H + PAD_B;
}

export type LayoutResult = { nodes: Node<TableNodeData>[]; edges: Edge<ErdEdgeData>[] };

/**
 * Position every table with dagre and wire FK edges to per-column handles.
 * `selectedId` highlights that table, its neighbours and their shared columns;
 * everything else is dimmed.
 */
export function applyLayout(
  tables: TableMeta[],
  fkEdges: FkEdge[],
  opts: { direction: Direction; compact: boolean; selectedId: string | null },
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.direction === 'LR' ? 180 : 120,
    nodesep: 80,
  });
  const ids = new Set(tables.map((t) => t.id));
  for (const t of tables)
    g.setNode(t.id, { width: NODE_WIDTH, height: nodeHeight(t, opts.compact) });
  for (const e of fkEdges)
    if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const sel = opts.selectedId;
  const related = new Set<string>();
  const hot = new Map<string, Set<string>>();
  if (sel) {
    related.add(sel);
    for (const e of fkEdges) {
      if (e.source === sel || e.target === sel) {
        related.add(e.source);
        related.add(e.target);
        (hot.get(e.source) ?? hot.set(e.source, new Set()).get(e.source))?.add(e.sourceColumn);
        (hot.get(e.target) ?? hot.set(e.target, new Set()).get(e.target))?.add(e.targetColumn);
      }
    }
  }

  const nodes: Node<TableNodeData>[] = tables.map((t) => {
    const pos = g.node(t.id);
    return {
      id: t.id,
      type: 'tableNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - nodeHeight(t, opts.compact) / 2 },
      data: {
        ...t,
        compact: opts.compact,
        selected: sel === t.id,
        dimmed: sel !== null && !related.has(t.id),
        hotColumns: [...(hot.get(t.id) ?? [])],
      },
    };
  });

  const edges: Edge<ErdEdgeData>[] = fkEdges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => {
      const isHot = sel !== null && (e.source === sel || e.target === sel);
      return {
        id: e.id,
        source: e.source,
        sourceHandle: `${e.sourceColumn}-r`,
        target: e.target,
        targetHandle: `${e.targetColumn}-l`,
        type: 'erdEdge',
        style: {
          stroke: ACCENT,
          strokeWidth: isHot ? 2.5 : 1.5,
          opacity: sel !== null && !isHot ? 0.18 : 1,
        },
        data: {
          label: `${e.sourceColumn} → ${e.targetColumn}`,
          dimmed: sel !== null && !isHot,
          hot: isHot,
          onDelete: e.onDelete,
        },
      };
    });

  return { nodes, edges };
}
