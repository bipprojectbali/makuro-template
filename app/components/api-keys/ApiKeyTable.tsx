import {
  ActionIcon,
  Box,
  Group,
  LoadingOverlay,
  Menu,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  FiEdit2,
  FiEye,
  FiMoreVertical,
  FiPause,
  FiPlay,
  FiRefreshCw,
  FiSlash,
  FiTrash2,
} from 'react-icons/fi';
import type { ApiKeyRow } from '~/lib/api-keys-api';
import { formatRelative } from '~/lib/visits-format';
import { UserCell } from '../logs/LogCells';
import { ExpiryCell, KeyIdentityCell, KeyStatusBadge, ScopeChips, UsageCell } from './ApiKeyCells';

export type ApiKeyHandlers = {
  busyId: string | null;
  onOpen: (k: ApiKeyRow) => void;
  onEdit: (k: ApiKeyRow) => void;
  onToggle: (k: ApiKeyRow) => void;
  onRotate: (k: ApiKeyRow) => void;
  onRevoke: (k: ApiKeyRow) => void;
  onDelete: (k: ApiKeyRow) => void;
  onFilterOwner: (ownerId: string) => void;
};
type Props = ApiKeyHandlers & {
  rows: ApiKeyRow[];
  loading: boolean;
  fetching?: boolean;
  empty: React.ReactNode;
  soonDays: number;
};
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

/** Kebab menu; no Tooltip around Menu.Target (it swallows the click). */
export function ApiKeyActionsMenu({ k, h }: { k: ApiKeyRow; h: ApiKeyHandlers }) {
  const gone = k.status === 'revoked';
  const busy = h.busyId === k.id;
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={210}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" loading={busy} aria-label="Aksi kunci">
          <FiMoreVertical size={15} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<FiEye size={14} />} onClick={() => h.onOpen(k)}>
          Detail & penggunaan
        </Menu.Item>
        <Menu.Item leftSection={<FiEdit2 size={14} />} disabled={gone} onClick={() => h.onEdit(k)}>
          Edit
        </Menu.Item>
        <Menu.Item
          leftSection={k.enabled ? <FiPause size={14} /> : <FiPlay size={14} />}
          disabled={gone}
          onClick={() => h.onToggle(k)}
        >
          {k.enabled ? 'Nonaktifkan' : 'Aktifkan'}
        </Menu.Item>
        <Menu.Item
          leftSection={<FiRefreshCw size={14} />}
          disabled={gone}
          onClick={() => h.onRotate(k)}
        >
          Rotasi kunci
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<FiSlash size={14} />}
          disabled={gone}
          onClick={() => h.onRevoke(k)}
        >
          Cabut
        </Menu.Item>
        <Menu.Item color="red" leftSection={<FiTrash2 size={14} />} onClick={() => h.onDelete(k)}>
          Hapus permanen
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function ApiKeyTable({ rows, loading, fetching = false, empty, soonDays, ...h }: Props) {
  return (
    <Box pos="relative" style={{ overflowX: 'auto' }}>
      <LoadingOverlay visible={fetching && !loading} zIndex={5} overlayProps={{ blur: 1 }} />
      <Table
        highlightOnHover
        withTableBorder
        verticalSpacing="xs"
        fz="sm"
        style={{ minWidth: 860 }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Kunci</Table.Th>
            <Table.Th>Pemilik</Table.Th>
            <Table.Th>Scope</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th visibleFrom="md">Kedaluwarsa</Table.Th>
            <Table.Th visibleFrom="lg">Pemakaian</Table.Th>
            <Table.Th w={48} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            SKELETON_KEYS.map((k) => (
              <Table.Tr key={k}>
                <Table.Td colSpan={7}>
                  <Skeleton h={30} radius="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading &&
            rows.map((k) => (
              <Table.Tr key={k.id} onClick={() => h.onOpen(k)} style={{ cursor: 'pointer' }}>
                <Table.Td>
                  <KeyIdentityCell k={k} />
                </Table.Td>
                <Table.Td>
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      h.onFilterOwner(k.ownerId);
                    }}
                  >
                    <UserCell
                      row={{ userId: k.ownerId, userName: k.ownerName, userImage: k.ownerImage }}
                      subtitle={k.ownerEmail}
                    />
                  </Box>
                </Table.Td>
                <Table.Td>
                  <ScopeChips scopes={k.scopes} />
                </Table.Td>
                <Table.Td>
                  <KeyStatusBadge status={k.status} size="xs" />
                </Table.Td>
                <Table.Td visibleFrom="md">
                  <ExpiryCell k={k} soonDays={soonDays} />
                </Table.Td>
                <Table.Td visibleFrom="lg">
                  <UsageCell k={k} />
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <ApiKeyActionsMenu k={k} h={h} />
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

export function ApiKeyCardList({ rows, loading, empty, soonDays, ...h }: Props) {
  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.slice(0, 4).map((k) => (
          <Skeleton key={k} h={110} radius="md" />
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
      {rows.map((k) => (
        <Paper
          key={k.id}
          withBorder
          p="sm"
          radius="md"
          onClick={() => h.onOpen(k)}
          style={{ cursor: 'pointer' }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
              <Group gap="xs" wrap="nowrap" justify="space-between">
                <KeyIdentityCell k={k} />
                <KeyStatusBadge status={k.status} size="xs" />
              </Group>
              <UserCell
                row={{ userId: k.ownerId, userName: k.ownerName, userImage: k.ownerImage }}
                subtitle={k.ownerEmail}
                compact
              />
              <ScopeChips scopes={k.scopes} max={4} />
              <Text size="xs" c="dimmed">
                {k.expiresAt ? `berakhir ${formatRelative(k.expiresAt)}` : 'tanpa kedaluwarsa'} ·{' '}
                {k.usage24h} req/24j
              </Text>
            </Stack>
            <Box onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
              <ApiKeyActionsMenu k={k} h={h} />
            </Box>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
