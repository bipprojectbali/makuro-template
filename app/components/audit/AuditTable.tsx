import {
  ActionIcon,
  Box,
  Group,
  LoadingOverlay,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { FiEye } from 'react-icons/fi';
import type { AuditRow } from '~/lib/audit-api';
import { formatRelative } from '~/lib/visits-format';
import { TimeCell } from '../logs/LogCells';
import { TruncatedText } from '../logs/TruncatedText';
import { ActionBadge, ActorCell, TargetCell } from './AuditCells';

type Props = {
  rows: AuditRow[];
  loading: boolean;
  fetching?: boolean;
  onOpen: (r: AuditRow) => void;
  empty: React.ReactNode;
};
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

/** Desktop table (≥ sm). */
export function AuditTable({ rows, loading, fetching = false, onOpen, empty }: Props) {
  return (
    <Box pos="relative" style={{ overflowX: 'auto' }}>
      <LoadingOverlay visible={fetching && !loading} zIndex={5} overlayProps={{ blur: 1 }} />
      <Table
        highlightOnHover
        withTableBorder
        verticalSpacing="xs"
        fz="sm"
        style={{ minWidth: 720 }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Waktu</Table.Th>
            <Table.Th>Aktor</Table.Th>
            <Table.Th>Aksi</Table.Th>
            <Table.Th>Ringkasan</Table.Th>
            <Table.Th visibleFrom="md">Target</Table.Th>
            <Table.Th visibleFrom="lg">IP</Table.Th>
            <Table.Th w={44} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            SKELETON_KEYS.map((k) => (
              <Table.Tr key={k}>
                <Table.Td colSpan={7}>
                  <Skeleton h={28} radius="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading &&
            rows.map((r) => (
              <Table.Tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(r)}>
                <Table.Td>
                  <TimeCell iso={r.createdAt} />
                </Table.Td>
                <Table.Td>
                  <ActorCell row={r} />
                </Table.Td>
                <Table.Td>
                  <ActionBadge action={r.action} />
                </Table.Td>
                <Table.Td>
                  <TruncatedText size="sm" maw={360}>
                    {r.summary}
                  </TruncatedText>
                </Table.Td>
                <Table.Td visibleFrom="md">
                  <TargetCell row={r} />
                </Table.Td>
                <Table.Td visibleFrom="lg">
                  <Text ff="monospace" size="xs">
                    {r.ip ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Tooltip label="Detail" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => onOpen(r)}
                      aria-label="Detail"
                    >
                      <FiEye size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading && rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>{empty}</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

/** Mobile card list (< sm). */
export function AuditCardList({ rows, loading, onOpen, empty }: Props) {
  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.slice(0, 4).map((k) => (
          <Skeleton key={k} h={84} radius="md" />
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
    <Stack gap="xs">
      {rows.map((r) => (
        <Paper
          key={r.id}
          withBorder
          p="sm"
          radius="md"
          onClick={() => onOpen(r)}
          style={{ cursor: 'pointer' }}
        >
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <ActionBadge action={r.action} size="xs" />
              <Text size="xs" c="dimmed">
                {formatRelative(r.createdAt)}
              </Text>
            </Group>
            <Text size="sm">{r.summary}</Text>
            <ActorCell row={r} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
