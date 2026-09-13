import {
  Badge,
  Code,
  Collapse,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useState } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { LEVEL_META, logExtras, type ServerLogRow } from '~/lib/server-logs-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';

const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

function Row({ row }: { row: ServerLogRow }) {
  const [open, setOpen] = useState(false);
  const extras = logExtras(row);
  const hasExtras = Object.keys(extras).length > 0;
  const meta = LEVEL_META[row.levelName] ?? { label: row.levelName, color: 'gray' };
  const iso = new Date(row.time).toISOString();
  return (
    <Paper
      withBorder
      radius="sm"
      p="xs"
      style={{ borderLeft: `3px solid var(--mantine-color-${meta.color}-6)` }}
    >
      <UnstyledButton
        onClick={() => hasExtras && setOpen((o) => !o)}
        style={{ width: '100%', cursor: hasExtras ? 'pointer' : 'default' }}
        aria-expanded={open}
      >
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Badge size="xs" variant="light" color={meta.color} w={52} style={{ flexShrink: 0 }}>
            {meta.label}
          </Badge>
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <TruncatedText size="sm" lh={1.35} ff="monospace">
              {row.msg || '(tanpa pesan)'}
            </TruncatedText>
            <Text size="xs" c="dimmed" lh={1.3} title={formatDateTime(iso)}>
              {formatRelative(iso)} · {formatDateTime(iso)}
              {hasExtras ? ` · ${Object.keys(extras).length} field` : ''}
            </Text>
          </Stack>
          {hasExtras &&
            (open ? (
              <FiChevronDown size={14} style={{ flexShrink: 0, marginTop: 4 }} />
            ) : (
              <FiChevronRight size={14} style={{ flexShrink: 0, marginTop: 4 }} />
            ))}
        </Group>
      </UnstyledButton>
      {hasExtras && (
        <Collapse expanded={open}>
          <Code
            block
            mt="xs"
            style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {JSON.stringify(extras, null, 2)}
          </Code>
        </Collapse>
      )}
    </Paper>
  );
}

/** Newest-first log entries; click a row with structured fields to expand them. */
export function ServerLogList({
  rows,
  loading,
  empty,
}: {
  rows: ServerLogRow[];
  loading: boolean;
  empty: React.ReactNode;
}) {
  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} h={48} radius="sm" />
        ))}
      </Stack>
    );
  }
  if (rows.length === 0)
    return (
      <Paper withBorder radius="md">
        {empty}
      </Paper>
    );
  return (
    <Stack gap={6}>
      {rows.map((r) => (
        <Row key={r.seq ?? `${r.time}-${r.msg}`} row={r} />
      ))}
    </Stack>
  );
}
