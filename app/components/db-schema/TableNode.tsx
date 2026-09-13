import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Fragment } from 'react';
import {
  ACCENT,
  HDR_H,
  NODE_WIDTH,
  PK_COL,
  ROW_H,
  type TableNodeData,
  visibleColumns,
} from './erd.layout';

const MONO = 'ui-monospace, "Cascadia Code", monospace';

/** ERD table card with a handle per column so edges attach to the exact row. */
export function TableNode({ data }: NodeProps & { data: TableNodeData }) {
  const cols = visibleColumns(data, data.compact);
  const hidden = data.columns.length - cols.length;
  const hot = new Set(data.hotColumns);
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        opacity: data.dimmed ? 0.28 : 1,
        transition: 'opacity 150ms',
      }}
    >
      {cols.map((col, i) => {
        const top = HDR_H + i * ROW_H + ROW_H / 2;
        const h = { top, opacity: 0, pointerEvents: 'none' as const, width: 4, height: 4 };
        return (
          <Fragment key={col.key}>
            <Handle type="target" position={Position.Left} id={`${col.key}-l`} style={h} />
            <Handle type="source" position={Position.Right} id={`${col.key}-r`} style={h} />
          </Fragment>
        );
      })}
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: `1.5px solid ${data.selected ? ACCENT : 'var(--mantine-color-default-border)'}`,
          outline: data.selected ? `3px solid ${ACCENT}55` : 'none',
          background: 'var(--mantine-color-body)',
          color: 'var(--mantine-color-text)',
          width: NODE_WIDTH,
          fontSize: 12,
          boxShadow: data.selected
            ? '0 8px 32px rgba(76,110,245,0.35)'
            : '0 4px 24px rgba(0,0,0,0.14)',
          cursor: 'pointer',
        }}
      >
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
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {data.name}
          </span>
          <span style={{ fontWeight: 500, fontSize: 10, opacity: 0.8 }}>
            {data.columns.length} kolom
          </span>
        </div>
        {cols.map((col) => {
          const isPk = col.pk;
          const isFk = Boolean(col.fkTable);
          const isHot = hot.has(col.key);
          return (
            <div
              key={col.key}
              title={`${col.dbName}: ${col.type}${col.notNull ? '' : ' (nullable)'}${isFk ? ` → ${col.fkTable}.${col.fkColumn}` : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 10,
                paddingRight: 12,
                borderTop: '1px solid var(--mantine-color-default-border)',
                height: ROW_H,
                background: isHot
                  ? 'rgba(76,110,245,0.18)'
                  : isPk
                    ? 'rgba(232,150,10,0.07)'
                    : isFk
                      ? 'rgba(76,110,245,0.05)'
                      : 'transparent',
                borderLeft: isPk
                  ? `3px solid ${PK_COL}`
                  : isFk
                    ? `3px solid ${ACCENT}`
                    : '3px solid transparent',
              }}
            >
              <span
                style={{
                  width: 20,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: MONO,
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
              <span
                style={{
                  fontFamily: MONO,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: isPk || isHot ? 600 : 400,
                }}
              >
                {col.dbName}
              </span>
              {col.unique && !isPk && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--mantine-color-dimmed)',
                    letterSpacing: 0.3,
                  }}
                >
                  UQ
                </span>
              )}
              <span
                style={{
                  color: 'var(--mantine-color-dimmed)',
                  fontFamily: MONO,
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
        {hidden > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--mantine-color-default-border)',
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mantine-color-dimmed)',
              fontSize: 10,
            }}
          >
            +{hidden} kolom lain
          </div>
        )}
      </div>
    </div>
  );
}
