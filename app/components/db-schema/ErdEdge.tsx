import { BaseEdge, type EdgeProps, getSmoothStepPath, Position } from '@xyflow/react';
import { ACCENT } from './erd.layout';

/** Unit vector pointing outward from a handle; ERD markers must follow the handle, not the line. */
function outwardDir(pos: Position): { nx: number; ny: number } {
  if (pos === Position.Right) return { nx: 1, ny: 0 };
  if (pos === Position.Left) return { nx: -1, ny: 0 };
  if (pos === Position.Top) return { nx: 0, ny: -1 };
  return { nx: 0, ny: 1 };
}

const DIST = 11;
const SPREAD = 7;

/** Crow's foot (many) at the FK end, one-bar at the PK end. */
export function ErdEdge({
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
  const src = outwardDir(sourcePosition);
  const srcPerp = { nx: -src.ny, ny: src.nx };
  const tgt = outwardDir(targetPosition);
  const tgtPerp = { nx: -tgt.ny, ny: tgt.nx };
  const arm1 = {
    x: sourceX + src.nx * DIST + srcPerp.nx * SPREAD,
    y: sourceY + src.ny * DIST + srcPerp.ny * SPREAD,
  };
  const arm2 = {
    x: sourceX + src.nx * DIST - srcPerp.nx * SPREAD,
    y: sourceY + src.ny * DIST - srcPerp.ny * SPREAD,
  };
  const barAt = { x: targetX + tgt.nx * DIST, y: targetY + tgt.ny * DIST };
  const bar1 = { x: barAt.x + tgtPerp.nx * SPREAD, y: barAt.y + tgtPerp.ny * SPREAD };
  const bar2 = { x: barAt.x - tgtPerp.nx * SPREAD, y: barAt.y - tgtPerp.ny * SPREAD };
  const css = style as React.CSSProperties | undefined;
  const mk = {
    stroke: css?.stroke ?? ACCENT,
    strokeWidth: css?.strokeWidth ?? 1.5,
    fill: 'none',
    strokeLinecap: 'round' as const,
    opacity: css?.opacity ?? 1,
  };
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <line x1={sourceX} y1={sourceY} x2={arm1.x} y2={arm1.y} {...mk} />
      <line x1={sourceX} y1={sourceY} x2={arm2.x} y2={arm2.y} {...mk} />
      <line x1={bar1.x} y1={bar1.y} x2={bar2.x} y2={bar2.y} {...mk} />
    </>
  );
}
