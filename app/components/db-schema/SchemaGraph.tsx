import type { FkEdge, TableMeta } from '@server/db/schema-introspect';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo } from 'react';
import { ErdEdge } from './ErdEdge';
import { ACCENT, applyLayout, type Direction } from './erd.layout';
import { TableNode } from './TableNode';

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { erdEdge: ErdEdge };

export type SchemaGraphProps = {
  schema: { tables: TableMeta[]; edges: FkEdge[] };
  direction: Direction;
  compact: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bumps to re-run fitView (toolbar "Pas ke layar"). */
  fitKey: number;
};

function Inner({ schema, direction, compact, selectedId, onSelect, fitKey }: SchemaGraphProps) {
  const { fitView } = useReactFlow();
  const { nodes, edges } = useMemo(
    () => applyLayout(schema.tables, schema.edges, { direction, compact, selectedId }),
    [schema, direction, compact, selectedId],
  );

  // Re-fit when the layout shape changes or the toolbar asks for it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fitKey/direction/compact are the triggers
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 30);
    return () => clearTimeout(t);
  }, [fitKey, direction, compact, fitView]);

  // Zoom to the selected table (and its neighbours) when chosen from the toolbar/drawer.
  useEffect(() => {
    if (!selectedId) return;
    const related = new Set([selectedId]);
    for (const e of schema.edges)
      if (e.source === selectedId || e.target === selectedId) related.add(e.source).add(e.target);
    const t = setTimeout(
      () =>
        fitView({
          nodes: [...related].map((id) => ({ id })),
          padding: 0.3,
          duration: 400,
          maxZoom: 1.1,
        }),
      30,
    );
    return () => clearTimeout(t);
  }, [selectedId, schema.edges, fitView]);

  return (
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
      onNodeClick={(_e, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      minZoom={0.15}
      maxZoom={2}
      aria-label="Diagram relasi tabel"
    >
      <Background gap={20} size={1} color="var(--mantine-color-default-border)" />
      <Controls showInteractive={false} position="bottom-right" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => (n.id === selectedId ? ACCENT : 'var(--mantine-color-default-border)')}
        maskColor="rgba(0,0,0,0.08)"
        style={{ background: 'var(--mantine-color-body)' }}
      />
    </ReactFlow>
  );
}

/** ERD canvas with its own React Flow provider (so the page can stay a plain component). */
export function SchemaGraph(props: SchemaGraphProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
