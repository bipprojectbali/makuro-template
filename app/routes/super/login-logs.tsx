import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Group,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useEffect, useState } from 'react';
import { FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import { TbSortAscending, TbSortDescending } from 'react-icons/tb';

export function meta() {
  return [{ title: 'Login Logs — Makuro Dev' }];
}

const LIMIT = 25;

type LoginRow = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function LoginLogsPage() {
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [debouncedSearch] = useDebouncedValue(search, 300);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), sort });
    if (debouncedSearch) params.set('search', debouncedSearch);

    fetch(`/api/analytics/login-logs?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows);
        setTotal(d.total);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, sort, debouncedSearch, refreshKey]);

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const deleteRow = (id: string) => {
    modals.openConfirmModal({
      title: 'Hapus login log',
      children: <Text size="sm">Hapus catatan login ini?</Text>,
      labels: { confirm: 'Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeleting(id);
        await fetch(`/api/analytics/login-logs/${id}`, { method: 'DELETE' });
        setDeleting(null);
        setRefreshKey((k) => k + 1);
      },
    });
  };

  const purge = () => {
    modals.openConfirmModal({
      title: 'Purge login logs',
      children: (
        <Text size="sm">
          Hapus semua login log yang lebih dari 30 hari? Tindakan ini tidak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Purge', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await fetch('/api/analytics/purge?days=30', { method: 'DELETE' });
        setRefreshKey((k) => k + 1);
      },
    });
  };

  const clearAll = () => {
    modals.openConfirmModal({
      title: 'Hapus semua login logs',
      children: (
        <Text size="sm">
          Hapus <strong>semua</strong> login log termasuk yang baru? Tindakan ini tidak bisa
          dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus Semua', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await fetch('/api/analytics/purge?days=0', { method: 'DELETE' });
        setRefreshKey((k) => k + 1);
      },
    });
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const SortIcon = sort === 'desc' ? TbSortDescending : TbSortAscending;

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Title order={3}>Login Logs</Title>
        <Group gap="xs" wrap="wrap" justify="flex-end">
          <Tooltip
            label="Hapus semua log (visit, login, rate-limit) termasuk yang terbaru. Tidak bisa dibatalkan."
            withArrow
            multiline
            maw={260}
          >
            <Button size="xs" color="red" variant="outline" onClick={clearAll} disabled={total === 0}>
              Clear All
            </Button>
          </Tooltip>
          <Tooltip
            label="Hapus semua log (visit, login, rate-limit) yang lebih dari 30 hari. Aman untuk maintenance rutin."
            withArrow
            multiline
            maw={260}
          >
            <Button size="xs" color="red" variant="light" onClick={purge} disabled={total === 0}>
              Purge 30d+
            </Button>
          </Tooltip>
          <Tooltip label="Muat ulang data terbaru" withArrow>
            <Button
              size="xs"
              variant="light"
              leftSection={<FiRefreshCw size={12} />}
              loading={loading}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Refresh
            </Button>
          </Tooltip>
        </Group>
      </Group>

      <Group gap="xs">
        <TextInput
          placeholder="Cari user ID atau IP…"
          leftSection={<FiSearch size={14} />}
          value={search}
          onChange={(e) => applyFilter(() => setSearch(e.currentTarget.value))}
          size="xs"
          style={{ flex: 1, maxWidth: 320 }}
        />
      </Group>

      {/* Desktop table */}
      <Box style={{ overflowX: 'auto' }} visibleFrom="sm">
        <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => applyFilter(() => setSort((s) => (s === 'desc' ? 'asc' : 'desc')))}
              >
                <Group gap={4}>
                  Waktu <SortIcon size={13} />
                </Group>
              </Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th visibleFrom="sm">IP</Table.Th>
              <Table.Th visibleFrom="sm">User Agent</Table.Th>
              <Table.Th style={{ width: 36 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar src={r.userImage} size={24} radius="xl">
                      {r.userName ? r.userName.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="xs" fw={500} lh={1.3}>
                        {r.userName ?? '—'}
                      </Text>
                      <Text ff="monospace" size="xs" c="dimmed" truncate maw={140} lh={1.3}>
                        {r.userId}
                      </Text>
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td visibleFrom="sm">
                  <Text ff="monospace" size="xs">
                    {r.ip ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td visibleFrom="sm">
                  <Tooltip label={r.userAgent ?? '—'} withArrow multiline maw={320} disabled={!r.userAgent}>
                    <Text size="xs" c="dimmed" truncate maw={220}>
                      {r.userAgent ?? '—'}
                    </Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    size="xs"
                    color="red"
                    variant="subtle"
                    loading={deleting === r.id}
                    onClick={() => deleteRow(r.id)}
                    aria-label="Hapus"
                  >
                    <FiTrash2 size={12} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {rows.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" size="sm" py="md">
                    Belum ada login tercatat.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Mobile card list */}
      <Stack gap="xs" hiddenFrom="sm">
        {rows.map((r) => (
          <Paper key={r.id} withBorder p="sm" radius="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <Group gap="xs" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
                <Avatar src={r.userImage} size={36} radius="xl" style={{ flexShrink: 0 }}>
                  {r.userName ? r.userName.charAt(0).toUpperCase() : '?'}
                </Avatar>
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>{r.userName ?? '—'}</Text>
                  <Text ff="monospace" size="xs" c="dimmed" truncate>{r.userId}</Text>
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed">{fmt(r.createdAt)}</Text>
                    {r.ip && <Text size="xs" c="dimmed">· {r.ip}</Text>}
                  </Group>
                </Stack>
              </Group>
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                loading={deleting === r.id}
                onClick={() => deleteRow(r.id)}
                aria-label="Hapus"
                style={{ flexShrink: 0 }}
              >
                <FiTrash2 size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}
        {rows.length === 0 && !loading && (
          <Text ta="center" c="dimmed" size="sm" py="md">Belum ada login tercatat.</Text>
        )}
      </Stack>

      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed">
          {total > 0
            ? `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total}`
            : '0 hasil'}
        </Text>
        {totalPages > 1 && (
          <Pagination value={page} total={totalPages} onChange={setPage} size="xs" />
        )}
      </Group>
    </Stack>
  );
}
