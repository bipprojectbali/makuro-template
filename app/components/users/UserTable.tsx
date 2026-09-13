import { Box, LoadingOverlay, Skeleton, Table, Text, Tooltip } from '@mantine/core';
import type { AdminUser } from '~/lib/admin-users-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { UserActionsMenu, type UserPermissions } from './UserActionsMenu';
import { ActivityCell, IdentityCell, RoleBadge, StatusBadge } from './UserCells';
import type { useUserActions } from './useUserActions';

export type UserListProps = {
  rows: AdminUser[];
  loading: boolean;
  fetching?: boolean;
  perms: UserPermissions;
  actions: ReturnType<typeof useUserActions>;
  onOpen: (u: AdminUser) => void;
  empty: React.ReactNode;
};

const COLS = 6;
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

/** Desktop table (≥ sm). Rows open the detail drawer; the kebab holds actions. */
export function UserTable({
  rows,
  loading,
  fetching = false,
  perms,
  actions,
  onOpen,
  empty,
}: UserListProps) {
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
            <Table.Th>User</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th visibleFrom="md">Aktivitas</Table.Th>
            <Table.Th visibleFrom="lg">Bergabung</Table.Th>
            <Table.Th w={48} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            SKELETON_KEYS.map((k) => (
              <Table.Tr key={k}>
                <Table.Td colSpan={COLS}>
                  <Skeleton h={32} radius="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading &&
            rows.map((u) => (
              <Table.Tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(u)}>
                <Table.Td>
                  <IdentityCell user={u} isSelf={u.id === perms.currentUserId} />
                </Table.Td>
                <Table.Td>
                  <RoleBadge role={u.role} />
                </Table.Td>
                <Table.Td>
                  <StatusBadge user={u} />
                </Table.Td>
                <Table.Td visibleFrom="md">
                  <ActivityCell user={u} />
                </Table.Td>
                <Table.Td visibleFrom="lg">
                  <Tooltip label={formatDateTime(u.createdAt)} withArrow openDelay={300}>
                    <Text size="sm">{formatRelative(u.createdAt)}</Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <UserActionsMenu user={u} perms={perms} actions={actions} onOpen={onOpen} />
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
