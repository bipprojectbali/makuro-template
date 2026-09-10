import dagre from '@dagrejs/dagre';
import type { FkEdge, TableMeta } from '@server/db/schema-introspect';
import {
  Background,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_WIDTH = 248;
const HDR_H = 36;
const ROW_H = 26;
const PAD_B = 8;

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
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60 });

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
    target: e.target,
    label: `${e.sourceColumn} → ${e.targetColumn}`,
    type: 'smoothstep',
    style: { stroke: '#4c6ef5', strokeWidth: 1.5 },
    labelStyle: { fontSize: 10 },
    labelBgPadding: [4, 4] as [number, number],
    labelBgStyle: { fill: 'var(--mantine-color-body)', fillOpacity: 0.9 },
    markerEnd: { type: 'arrowclosed' as const, color: '#4c6ef5' },
  }));

  return { nodes, edges };
}

// ── Custom TableNode ──────────────────────────────────────────────────────────

type TableNodeProps = NodeProps & { data: TableMeta };

function TableNode({ data }: TableNodeProps) {
  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1.5px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        width: NODE_WIDTH,
        fontSize: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />

      {/* Table name header */}
      <div
        style={{
          background: '#4c6ef5',
          color: '#fff',
          padding: '8px 12px',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0.2,
          height: HDR_H,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {data.name}
      </div>

      {/* Column rows */}
      {data.columns.map((col) => (
        <div
          key={col.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            borderTop: '1px solid var(--mantine-color-default-border)',
            height: ROW_H,
          }}
        >
          <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>
            {col.pk ? (
              '🔑'
            ) : col.fkTable ? (
              '🔗'
            ) : (
              <span style={{ color: 'var(--mantine-color-dimmed)' }}>·</span>
            )}
          </span>
          <span
            style={{
              fontFamily: 'ui-monospace, "Cascadia Code", monospace',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {col.dbName}
          </span>
          <span
            style={{
              color: 'var(--mantine-color-dimmed)',
              fontFamily: 'ui-monospace, "Cascadia Code", monospace',
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {col.type}
          </span>
          {!col.notNull && (
            <span style={{ color: 'var(--mantine-color-dimmed)', fontSize: 10, flexShrink: 0 }}>
              ?
            </span>
          )}
        </div>
      ))}

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

// ── Main export ───────────────────────────────────────────────────────────────

export function DbSchemaGraph({ schema }: { schema: { tables: TableMeta[]; edges: FkEdge[] } }) {
  const { nodes, edges } = applyLayout(schema.tables, schema.edges);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
