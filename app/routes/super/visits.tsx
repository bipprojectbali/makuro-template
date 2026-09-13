import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Collapse,
  Group,
  Menu,
  Pagination,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue, useLocalStorage } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiMoreVertical,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi';
import { useVisitActions } from '~/components/visits/useVisitActions';
import { VisitBreakdown } from '~/components/visits/VisitBreakdown';
import { VisitCardList } from '~/components/visits/VisitCardList';
import { VisitDetailDrawer } from '~/components/visits/VisitDetailDrawer';
import { VisitEmptyState } from '~/components/visits/VisitEmptyState';
import { VisitFilters } from '~/components/visits/VisitFilters';
import { VisitStatsCards } from '~/components/visits/VisitStatsCards';
import { VisitTable } from '~/components/visits/VisitTable';
import {
  DEFAULT_FILTERS,
  exportVisitsUrl,
  type VisitFilters as Filters,
  fetchVisitStats,
  fetchVisits,
  hasActiveFilters,
  type VisitRow,
} from '~/lib/visits-api';

export function meta() {
  return [{ title: 'Visitor Logs — Makuro Dev' }];
}

const LIMIT = 25;
const nf = new Intl.NumberFormat('id-ID');

export default function VisitsPage() {
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<VisitRow | null>(null);
  const [showSummary, setShowSummary] = useLocalStorage({
    key: 'mk-visits-summary',
    defaultValue: true,
  });
  const [debouncedSearch] = useDebouncedValue(filters.search, 300);

  const params = { ...filters, search: debouncedSearch, page, limit: LIMIT, sort };
  const list = useQuery({
    queryKey: ['visits', params],
    queryFn: () => fetchVisits(params),
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({ queryKey: ['visits-stats'], queryFn: fetchVisitStats });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const filtered = hasActiveFilters(filters);

  const resetSelection = () => setSelected(new Set());
  const setFilters = (patch: Partial<Filters>) => {
    setFiltersState((f) => ({ ...f, ...patch }));
    setPage(1);
    resetSelection();
  };
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const actions = useVisitActions({
    onDone: () => {
      resetSelection();
      setDetail(null);
    },
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) =>
      rows.every((r) => s.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id)),
    );

  const listHandlers = {
    selected,
    onToggle: toggle,
    onToggleAll: toggleAll,
    onOpen: setDetail,
    onDelete: actions.deleteOne,
    deletingId: actions.deletingId,
  };
  const empty = <VisitEmptyState filtered={filtered} onReset={resetFilters} />;
  const refresh = () => {
    list.refetch();
    stats.refetch();
  };

  return (
    <Stack gap="md" p={{ base: 'sm', md: 'md' }}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3}>Visitor Logs</Title>
          <Text size="sm" c="dimmed">
            Setiap kunjungan halaman beserta lokasi, perangkat, sumber, dan user yang login.
          </Text>
        </div>
        <Group gap="xs" wrap="wrap" justify="flex-end">
          <Tooltip
            label={`Unduh CSV sesuai filter aktif (maks. ${nf.format(10_000)} baris)`}
            withArrow
          >
            <Button
              component="a"
              href={exportVisitsUrl(filters)}
              download
              size="sm"
              variant="default"
              leftSection={<FiDownload size={14} />}
              disabled={total === 0}
              onClick={(e) => {
                // Anchors ignore `disabled`; block navigation when there is nothing to export.
                if (total === 0) e.preventDefault();
              }}
            >
              Export CSV
            </Button>
          </Tooltip>
          <Button
            size="sm"
            variant="light"
            leftSection={<FiRefreshCw size={14} />}
            loading={list.isFetching}
            onClick={refresh}
          >
            Refresh
          </Button>
          <Menu position="bottom-end" withArrow shadow="md">
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="Aksi lainnya">
                <FiMoreVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Pembersihan log</Menu.Label>
              <Menu.Item
                leftSection={<FiTrash2 size={14} />}
                onClick={actions.purgeOld}
                disabled={stats.data?.total === 0}
              >
                Purge log lebih dari 30 hari
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<FiTrash2 size={14} />}
                onClick={actions.clearAll}
                disabled={stats.data?.total === 0}
              >
                Hapus semua log
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <VisitStatsCards stats={stats.data} />

      {stats.data && stats.data.total > 0 && (
        <Stack gap="xs">
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            rightSection={showSummary ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
            onClick={() => setShowSummary((v) => !v)}
            style={{ alignSelf: 'flex-start' }}
          >
            {showSummary ? 'Sembunyikan ringkasan' : 'Tampilkan ringkasan'}
          </Button>
          <Collapse expanded={showSummary}>
            <VisitBreakdown
              stats={stats.data}
              onCountry={(c) => setFilters({ country: c })}
              onDevice={(d) => setFilters({ device: d })}
            />
          </Collapse>
        </Stack>
      )}

      <VisitFilters
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        countries={stats.data?.topCountries ?? []}
        matchCount={list.data?.total}
      />

      {list.isError && (
        <Alert color="red" icon={<FiAlertCircle size={16} />} title="Gagal memuat visitor logs">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm">{(list.error as Error).message}</Text>
            <Button size="xs" variant="light" color="red" onClick={() => list.refetch()}>
              Coba lagi
            </Button>
          </Group>
        </Alert>
      )}

      {selected.size > 0 && (
        <Paper withBorder radius="md" p="sm" bg="var(--mantine-primary-color-light)">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm" fw={500}>
              {nf.format(selected.size)} kunjungan dipilih
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="subtle" color="gray" onClick={resetSelection}>
                Batal pilih
              </Button>
              <Button
                size="xs"
                color="red"
                leftSection={<FiTrash2 size={13} />}
                loading={actions.bulkDeleting}
                onClick={() => actions.deleteMany([...selected])}
              >
                Hapus terpilih
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <Paper withBorder radius="md" visibleFrom="sm" style={{ overflow: 'hidden' }}>
        <VisitTable
          rows={rows}
          loading={list.isPending}
          fetching={list.isFetching}
          sort={sort}
          onToggleSort={() => {
            setSort((s) => (s === 'desc' ? 'asc' : 'desc'));
            setPage(1);
          }}
          empty={empty}
          {...listHandlers}
        />
      </Paper>
      <Box hiddenFrom="sm">
        <VisitCardList rows={rows} loading={list.isPending} empty={empty} {...listHandlers} />
      </Box>

      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text size="xs" c="dimmed">
          {total > 0
            ? `Menampilkan ${nf.format((page - 1) * LIMIT + 1)}–${nf.format(Math.min(page * LIMIT, total))} dari ${nf.format(total)}`
            : 'Tidak ada hasil'}
        </Text>
        {totalPages > 1 && (
          <Pagination
            value={page}
            total={totalPages}
            onChange={(p) => {
              setPage(p);
              resetSelection();
            }}
            size="sm"
            siblings={1}
          />
        )}
      </Group>

      <VisitDetailDrawer
        row={detail}
        onClose={() => setDetail(null)}
        onDelete={actions.deleteOne}
        deleting={detail !== null && actions.deletingId === detail.id}
      />
    </Stack>
  );
}
