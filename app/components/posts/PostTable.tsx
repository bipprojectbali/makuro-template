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
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { excerpt, type PostRow } from '~/lib/posts-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { UserCell } from '../logs/LogCells';
import { TruncatedText } from '../logs/TruncatedText';

export type PostHandlers = {
  onEdit: (p: PostRow) => void;
  onDelete: (p: PostRow) => void;
  onAuthor: (id: string) => void;
  busyId: string | null;
};
type Props = PostHandlers & {
  rows: PostRow[];
  loading: boolean;
  fetching?: boolean;
  empty: React.ReactNode;
};
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

function Actions({ p, h }: { p: PostRow; h: PostHandlers }) {
  const busy = h.busyId === p.id;
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Tooltip label="Edit" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          loading={busy}
          onClick={() => h.onEdit(p)}
          aria-label="Edit post"
        >
          <FiEdit2 size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Hapus" withArrow>
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          loading={busy}
          onClick={() => h.onDelete(p)}
          aria-label="Hapus post"
        >
          <FiTrash2 size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function Edited({ p }: { p: PostRow }) {
  const edited = new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() > 60_000;
  return (
    <Tooltip
      label={`Dibuat ${formatDateTime(p.createdAt)}${edited ? ` · diubah ${formatDateTime(p.updatedAt)}` : ''}`}
      withArrow
    >
      <Stack gap={0}>
        <Text size="sm" lh={1.3}>
          {formatRelative(p.createdAt)}
        </Text>
        {edited && (
          <Text size="xs" c="dimmed" lh={1.3}>
            diubah {formatRelative(p.updatedAt)}
          </Text>
        )}
      </Stack>
    </Tooltip>
  );
}

export function PostTable({ rows, loading, fetching = false, empty, ...h }: Props) {
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
            <Table.Th>Post</Table.Th>
            <Table.Th>Penulis</Table.Th>
            <Table.Th visibleFrom="md">Dibuat</Table.Th>
            <Table.Th w={84} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            SKELETON_KEYS.map((k) => (
              <Table.Tr key={k}>
                <Table.Td colSpan={4}>
                  <Skeleton h={32} radius="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading &&
            rows.map((p) => (
              <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => h.onEdit(p)}>
                <Table.Td>
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <TruncatedText size="sm" fw={500} lh={1.3} maw={420}>
                      {p.title}
                    </TruncatedText>
                    {p.content && (
                      <TruncatedText size="xs" c="dimmed" lh={1.3} maw={420}>
                        {excerpt(p.content)}
                      </TruncatedText>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Box onClick={() => h.onAuthor(p.authorId)} style={{ cursor: 'pointer' }}>
                    <UserCell
                      row={{ userId: p.authorId, userName: p.authorName, userImage: p.authorImage }}
                      subtitle={p.authorEmail}
                    />
                  </Box>
                </Table.Td>
                <Table.Td visibleFrom="md">
                  <Edited p={p} />
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Actions p={p} h={h} />
                </Table.Td>
              </Table.Tr>
            ))}
          {!loading && rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>{empty}</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

export function PostCardList({ rows, loading, empty, ...h }: Props) {
  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.slice(0, 4).map((k) => (
          <Skeleton key={k} h={92} radius="md" />
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
      {rows.map((p) => (
        <Paper key={p.id} withBorder p="sm" radius="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={500} lineClamp={2}>
                {p.title}
              </Text>
              {p.content && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {excerpt(p.content, 200)}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {p.authorName ?? p.authorEmail} · {formatRelative(p.createdAt)}
              </Text>
            </Stack>
            <Actions p={p} h={h} />
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
