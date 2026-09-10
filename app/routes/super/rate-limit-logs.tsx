import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Pagination,
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
  return [{ title: 'Rate Limit Logs — Makuro Dev' }];
}

const LIMIT = 25;

type RateLimitRow = {
  id: string;
  ip: string | null;
  path: string;
  userId: string | null;
  createdAt: string;
};

export default function RateLimitLogsPage() {
  const [rows, setRows] = useState<RateLimitRow[]>([]);
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

    fetch(`/api/analytics/rate-limit-logs?${params}`)
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
      title: 'Hapus rate-limit log',
      children: <Text size="sm">Hapus catatan rate-limit ini?</Text>,
      labels: { confirm: 'Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeleting(id);
        await fetch(`/api/analytics/rate-limit-logs/${id}`, { method: 'DELETE' });
        setDeleting(null);
        setRefreshKey((k) => k + 1);
      },
    });
  };

  const purge = () => {
    modals.openConfirmModal({
      title: 'Purge rate-limit logs',
      children: (
        <Text size="sm">
          Hapus semua rate-limit log yang lebih dari 30 hari? Tindakan ini tidak bisa dibatalkan.
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
      title: 'Hapus semua rate-limit logs',
      children: (
        <Text size="sm">
          Hapus <strong>semua</strong> rate-limit log termasuk yang baru? Tindakan ini tidak bisa
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
      <Group justify="space-between" wrap="nowrap">
        <Title order={3}>Rate Limit Logs</Title>
        <Group gap="xs">
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
          placeholder="Cari IP atau path…"
          leftSection={<FiSearch size={14} />}
          value={search}
          onChange={(e) => applyFilter(() => setSearch(e.currentTarget.value))}
          size="xs"
          style={{ flex: 1, maxWidth: 320 }}
        />
      </Group>

      <Box style={{ overflowX: 'auto' }}>
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
              <Table.Th>IP</Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th style={{ width: 36 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</Table.Td>
                <Table.Td>
                  <Badge color="orange" size="xs" ff="monospace">
                    {r.ip ?? '—'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs" truncate maw={240}>
                    {r.path}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs" c="dimmed" truncate maw={130}>
                    {r.userId ?? '—'}
                  </Text>
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
                    Belum ada request yang di-rate-limit.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

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
