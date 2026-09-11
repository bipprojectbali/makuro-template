import dagre from '@dagrejs/dagre';
import type { FkEdge, TableMeta } from '@server/db/schema-introspect';
import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Fragment } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_WIDTH = 264;
const HDR_H = 38;
const ROW_H = 28;
const PAD_B = 6;

// Both colours work in light and dark — they're explicit hues, not theme tokens
const ACCENT = '#4c6ef5';
const PK_COL = '#e8960a';

function nodeHeight(t: TableMeta) {
  return HDR_H + t.columns.length * ROW_H + PAD_B;
}

// ── Dagre auto-layout ─────────────────────────────────────────────────────────

function applyLayout(
  tables: TableMeta[],
  fkEdges: FkEdge[],
): { nodes: Node<TableMeta>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 180, nodesep: 80 });

  for (const t of tables) {
    g.setNode(t.id, { width: NODE_WIDTH, height: nodeHeight(t) });
  }
  for (const e of fkEdges) {
    if (tables.find((t) => t.id === e.source) && tables.find((t) => t.id === e.target)) {
      g.setEdge(e.source, e.target);
    }
  }
  dagre.layout(g);

  const nodes: Node<TableMeta>[] = tables.map((t) => {
    const pos = g.node(t.id);
    return {
      id: t.id,
      type: 'tableNode',
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - nodeHeight(t) / 2,
      },
      data: t,
    };
  });

  const edges: Edge[] = fkEdges.map((e) => ({
    id: e.id,
    source: e.source,
    // Edge exits from the FK column's right handle
    sourceHandle: `${e.sourceColumn}-r`,
    target: e.target,
    // Edge enters at the PK column's left handle
    targetHandle: `${e.targetColumn}-l`,
    type: 'erdEdge',
    style: { stroke: ACCENT, strokeWidth: 1.5 },
    data: { label: `${e.sourceColumn} → ${e.targetColumn}` },
  }));

  return { nodes, edges };
}

// ── ERD marker helpers ────────────────────────────────────────────────────────

/**
 * Returns the unit vector pointing OUTWARD from a node in the direction of the
 * given handle position. For a Right handle the edge exits rightward → (1, 0).
 * This is critical: ERD markers must align with the handle direction, NOT the
 * diagonal line between the two nodes.
 */
function outwardDir(pos: Position): { nx: number; ny: number } {
  if (pos === Position.Right) return { nx: 1, ny: 0 };
  if (pos === Position.Left) return { nx: -1, ny: 0 };
  if (pos === Position.Top) return { nx: 0, ny: -1 };
  return { nx: 0, ny: 1 }; // Bottom
}

// ── Custom ERD edge: crow's foot (many) at source, one-bar at target ──────────

function ErdEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
    offset: 52,
  });

  const DIST = 11;   // marker distance from the connection point
  const SPREAD = 7;  // half-length of perpendicular marker lines

  // Exit direction from source handle (e.g. Right → (1,0))
  const src = outwardDir(sourcePosition);
  const srcPerp = { nx: -src.ny, ny: src.nx };

  // Outward direction from target handle (e.g. Left → (-1,0))
  const tgt = outwardDir(targetPosition);
  const tgtPerp = { nx: -tgt.ny, ny: tgt.nx };

  // Crow's foot at source (FK = many):
  // Two arms diverge from the connection point in the exit direction + perpendicular spread.
  // For a Right handle this produces ">" opening rightward.
  const cfArm1 = {
    x: sourceX + src.nx * DIST + srcPerp.nx * SPREAD,
    y: sourceY + src.ny * DIST + srcPerp.ny * SPREAD,
  };
  const cfArm2 = {
    x: sourceX + src.nx * DIST - srcPerp.nx * SPREAD,
    y: sourceY + src.ny * DIST - srcPerp.ny * SPREAD,
  };

  // One-bar at target (PK = one):
  // A perpendicular line DIST away from the connection point in the outward direction.
  // For a Left handle this produces "|" to the left of the target node.
  const barAt = {
    x: targetX + tgt.nx * DIST,
    y: targetY + tgt.ny * DIST,
  };
  const bar1 = { x: barAt.x + tgtPerp.nx * SPREAD, y: barAt.y + tgtPerp.ny * SPREAD };
  const bar2 = { x: barAt.x - tgtPerp.nx * SPREAD, y: barAt.y - tgtPerp.ny * SPREAD };

  const strokeColor = (style as React.CSSProperties)?.stroke ?? ACCENT;
  const mk = {
    stroke: strokeColor,
    strokeWidth: 1.5,
    fill: 'none',
    strokeLinecap: 'round' as const,
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />

      {/* Crow's foot: FK end (source = many) */}
      <line x1={sourceX} y1={sourceY} x2={cfArm1.x} y2={cfArm1.y} {...mk} />
      <line x1={sourceX} y1={sourceY} x2={cfArm2.x} y2={cfArm2.y} {...mk} />

      {/* One-bar: PK end (target = one) */}
      <line x1={bar1.x} y1={bar1.y} x2={bar2.x} y2={bar2.y} {...mk} />
    </>
  );
}

// ── Custom TableNode with per-column handles ──────────────────────────────────

type TableNodeProps = NodeProps & { data: TableMeta };

function TableNode({ data }: TableNodeProps) {
  return (
    /*
     * Two-div pattern: outer keeps handles accessible (overflow: visible),
     * inner clips the visual content to the rounded border.
     */
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Per-column handles — invisible, positioned exactly at each row's midpoint */}
      {data.columns.map((col, i) => {
        const top = HDR_H + i * ROW_H + ROW_H / 2;
        return (
          <Fragment key={col.key}>
            <Handle
              type="target"
              position={Position.Left}
              id={`${col.key}-l`}
              style={{ top, opacity: 0, pointerEvents: 'none', width: 4, height: 4 }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`${col.key}-r`}
              style={{ top, opacity: 0, pointerEvents: 'none', width: 4, height: 4 }}
            />
          </Fragment>
        );
      })}

      {/* Visual container — clips header bg to rounded corners */}
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: '1.5px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
          color: 'var(--mantine-color-text)',
          width: NODE_WIDTH,
          fontSize: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
        }}
      >
        {/* Table header */}
        <div
          style={{
            background: ACCENT,
            color: '#fff',
            padding: '0 12px',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.2,
            height: HDR_H,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          {/* Small table icon */}
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            style={{ opacity: 0.75, flexShrink: 0 }}
            aria-hidden="true"
          >
            <rect x="0" y="0" width="12" height="2.5" rx="0.5" fill="currentColor" />
            <rect x="0" y="4.75" width="12" height="2.5" rx="0.5" fill="currentColor" />
            <rect x="0" y="9.5" width="12" height="2.5" rx="0.5" fill="currentColor" />
          </svg>
          {data.name}
        </div>

        {/* Column rows */}
        {data.columns.map((col) => {
          const isPk = col.pk;
          const isFk = Boolean(col.fkTable);
          return (
            <div
              key={col.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 10,
                paddingRight: 12,
                borderTop: '1px solid var(--mantine-color-default-border)',
                height: ROW_H,
                // Subtle tint for PK/FK rows
                background: isPk
                  ? 'rgba(232, 150, 10, 0.07)'
                  : isFk
                    ? 'rgba(76, 110, 245, 0.05)'
                    : 'transparent',
                // Left accent border indicates key type
                borderLeft: isPk
                  ? `3px solid ${PK_COL}`
                  : isFk
                    ? `3px solid ${ACCENT}`
                    : '3px solid transparent',
              }}
            >
              {/* Key type badge */}
              <span
                style={{
                  width: 20,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, monospace',
                  letterSpacing: 0.4,
                  flexShrink: 0,
                  textAlign: 'center',
                }}
              >
                {isPk ? (
                  <span style={{ color: PK_COL }}>PK</span>
                ) : isFk ? (
                  <span style={{ color: ACCENT }}>FK</span>
                ) : (
                  <span style={{ color: 'var(--mantine-color-dimmed)', fontSize: 13 }}>·</span>
                )}
              </span>

              {/* Column name */}
              <span
                style={{
                  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: isPk ? 600 : 400,
                }}
              >
                {col.dbName}
              </span>

              {/* Type + nullable indicator */}
              <span
                style={{
                  color: 'var(--mantine-color-dimmed)',
                  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                  fontSize: 10,
                  flexShrink: 0,
                }}
              >
                {col.type}
                {!col.notNull && (
                  <span style={{ color: ACCENT, opacity: 0.65, marginLeft: 1 }}>?</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { erdEdge: ErdEdge };

// ── Main export ───────────────────────────────────────────────────────────────

export function DbSchemaGraph({ schema }: { schema: { tables: TableMeta[]; edges: FkEdge[] } }) {
  const { nodes, edges } = applyLayout(schema.tables, schema.edges);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        edgesReconnectable={false}
      >
        <Background gap={20} size={1} color="var(--mantine-color-default-border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
