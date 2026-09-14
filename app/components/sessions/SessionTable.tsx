import {
  ActionIcon,
  Badge,
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
import { FiLogOut, FiUserX } from 'react-icons/fi';
import { describeSession } from '~/lib/profile-api';
import { isExpired, type SessionRow } from '~/lib/sessions-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { TimeCell, UserCell } from '../logs/LogCells';
import { TruncatedText } from '../logs/TruncatedText';

export type SessionHandlers = {
  currentSessionId: string | null;
  busyId: string | null;
  onRevoke: (s: SessionRow) => void;
  onRevokeUser: (s: SessionRow) => void;
  onFilterUser: (userId: string) => void;
};
type Props = SessionHandlers & {
  rows: SessionRow[];
  loading: boolean;
  fetching?: boolean;
  empty: React.ReactNode;
};
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

function DeviceCell({ s }: { s: SessionRow }) {
  const d = describeSession(s.userAgent);
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <TruncatedText size="sm" lh={1.3} maw={220}>
        {d.summary}
      </TruncatedText>
      <Text size="xs" c="dimmed" lh={1.3}>
        {d.device} · {s.ipAddress ?? 'IP —'}
      </Text>
    </Stack>
  );
}

function Flags({ s, currentSessionId }: { s: SessionRow; currentSessionId: string | null }) {
  const expired = isExpired(s);
  return (
    <Group gap={4} wrap="wrap">
      {s.id === currentSessionId && (
        <Badge size="xs" variant="light" color="teal">
          Sesi Anda
        </Badge>
      )}
      {s.impersonatedBy && (
        <Tooltip label={`Impersonasi oleh ${s.impersonatedBy}`} withArrow>
          <Badge size="xs" variant="filled" color="orange">
            Impersonasi
          </Badge>
        </Tooltip>
      )}
      {expired ? (
        <Badge size="xs" variant="outline" color="gray">
          Kedaluwarsa
        </Badge>
      ) : (
        <Tooltip label={`Berakhir ${formatDateTime(s.expiresAt)}`} withArrow>
          <Badge size="xs" variant="light" color="gray">
            {formatRelative(s.expiresAt).replace('yang lalu', '')}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}

function Actions({ s, h }: { s: SessionRow; h: SessionHandlers }) {
  const self = s.id === h.currentSessionId;
  const busy = h.busyId === s.id || h.busyId === s.userId;
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Tooltip
        label={self ? 'Sesi Anda sendiri — keluar lewat menu akun' : 'Cabut sesi ini'}
        withArrow
      >
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          disabled={self}
          loading={busy}
          onClick={() => h.onRevoke(s)}
          aria-label="Cabut sesi"
        >
          <FiLogOut size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Cabut semua sesi user ini" withArrow>
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          loading={busy}
          onClick={() => h.onRevokeUser(s)}
          aria-label="Cabut semua sesi user"
        >
          <FiUserX size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

export function SessionTable({ rows, loading, fetching = false, empty, ...h }: Props) {
  return (
    <Box pos="relative" style={{ overflowX: 'auto' }}>
      <LoadingOverlay visible={fetching && !loading} zIndex={5} overlayProps={{ blur: 1 }} />
      <Table
        highlightOnHover
        withTableBorder
        verticalSpacing="xs"
        fz="sm"
        style={{ minWidth: 760 }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User</Table.Th>
            <Table.Th>Perangkat</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th visibleFrom="md">Aktif terakhir</Table.Th>
            <Table.Th visibleFrom="lg">Masuk</Table.Th>
            <Table.Th w={84} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            SKELETON_KEYS.map((k) => (
              <Table.Tr key={k}>
                <Table.Td colSpan={6}>
                  <Skeleton h={30} radius="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading &&
            rows.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Box onClick={() => h.onFilterUser(s.userId)} style={{ cursor: 'pointer' }}>
                    <UserCell row={s} subtitle={s.userEmail} />
                  </Box>
                </Table.Td>
                <Table.Td>
                  <DeviceCell s={s} />
                </Table.Td>
                <Table.Td>
                  <Flags s={s} currentSessionId={h.currentSessionId} />
                </Table.Td>
                <Table.Td visibleFrom="md">
                  <TimeCell iso={s.updatedAt} />
                </Table.Td>
                <Table.Td visibleFrom="lg">
                  <Text size="sm">{formatRelative(s.createdAt)}</Text>
                </Table.Td>
                <Table.Td>
                  <Actions s={s} h={h} />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading && rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>{empty}</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

export function SessionCardList({ rows, loading, empty, ...h }: Props) {
  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.slice(0, 4).map((k) => (
          <Skeleton key={k} h={96} radius="md" />
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
      {rows.map((s) => (
        <Paper key={s.id} withBorder p="sm" radius="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
              <UserCell row={s} subtitle={s.userEmail} />
              <DeviceCell s={s} />
              <Flags s={s} currentSessionId={h.currentSessionId} />
              <Text size="xs" c="dimmed">
                aktif {formatRelative(s.updatedAt)} · masuk {formatRelative(s.createdAt)}
              </Text>
            </Stack>
            <Actions s={s} h={h} />
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
