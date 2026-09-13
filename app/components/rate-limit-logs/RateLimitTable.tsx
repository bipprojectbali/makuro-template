import {
  ActionIcon,
  Box,
  Checkbox,
  Group,
  LoadingOverlay,
  Skeleton,
  Table,
  Tooltip,
} from '@mantine/core';
import { FiEye, FiTrash2 } from 'react-icons/fi';
import { TbSortAscending, TbSortDescending } from 'react-icons/tb';
import type { RateLimitRow } from '~/lib/rate-limit-logs-api';
import { ClientCell, DeviceCell, TimeCell, UserCell } from '../logs/LogCells';
import { RequestCell } from './RateLimitCells';

export type RateLimitListHandlers = {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (row: RateLimitRow) => void;
  onDelete: (row: RateLimitRow) => void;
  deletingId: string | null;
};

type Props = RateLimitListHandlers & {
  rows: RateLimitRow[];
  loading: boolean;
  fetching: boolean;
  sort: 'asc' | 'desc';
  onToggleSort: () => void;
  empty: React.ReactNode;
};

const COLS = 7;
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

/** Desktop table (≥ sm). Rows open the detail drawer; checkboxes drive bulk delete. */
export function RateLimitTable(props: Props) {
  const { rows, loading, fetching, sort, onToggleSort, selected, empty } = props;
  const SortIcon = sort === 'desc' ? TbSortDescending : TbSortAscending;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));

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
            <Table.Th w={36}>
              <Checkbox
                size="xs"
                aria-label="Pilih semua di halaman ini"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                disabled={rows.length === 0}
                onChange={props.onToggleAll}
              />
            </Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
              onClick={onToggleSort}
            >
              <Group gap={4} wrap="nowrap">
                Waktu <SortIcon size={14} />
              </Group>
            </Table.Th>
            <Table.Th>Klien</Table.Th>
            <Table.Th>Request diblokir</Table.Th>
            <Table.Th visibleFrom="md">Perangkat</Table.Th>
            <Table.Th visibleFrom="lg">User</Table.Th>
            <Table.Th w={84} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            SKELETON_KEYS.map((k) => (
              <Table.Tr key={k}>
                <Table.Td colSpan={COLS}>
                  <Skeleton h={28} radius="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading &&
            rows.map((r) => (
              <Table.Tr
                key={r.id}
                bg={selected.has(r.id) ? 'var(--mantine-primary-color-light)' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => props.onOpen(r)}
              >
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    size="xs"
                    aria-label="Pilih baris"
                    checked={selected.has(r.id)}
                    onChange={() => props.onToggle(r.id)}
                  />
                </Table.Td>
                <Table.Td>
                  <TimeCell iso={r.createdAt} />
                </Table.Td>
                <Table.Td>
                  <ClientCell row={r} />
                </Table.Td>
                <Table.Td>
                  <RequestCell row={r} />
                </Table.Td>
                <Table.Td visibleFrom="md">
                  <DeviceCell row={r} />
                </Table.Td>
                <Table.Td visibleFrom="lg">
                  <UserCell row={r} />
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={4} wrap="nowrap" justify="flex-end">
                    <Tooltip label="Lihat detail" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => props.onOpen(r)}
                        aria-label="Lihat detail"
                      >
                        <FiEye size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Hapus catatan" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        loading={props.deletingId === r.id}
                        onClick={() => props.onDelete(r)}
                        aria-label="Hapus catatan"
                      >
                        <FiTrash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading && rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={COLS}>{empty}</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
