import {
  Alert,
  Badge,
  Box,
  Button,
  CloseButton,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiAlertCircle, FiDownload, FiSearch } from 'react-icons/fi';
import { fetchApiKeys } from '~/lib/api-keys-api';
import {
  DEFAULT_USAGE_FILTERS,
  type UsageLogFilters as Filters,
  fetchUsageLog,
  hasActiveUsageFilters,
  statusClass,
  type UsageLogRow,
  usageExportUrl,
} from '~/lib/api-keys-usage-api';
import { countryFlag, formatDateTime, formatRelative } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';
import { VisitEmptyState } from '../visits/VisitEmptyState';

const LIMIT = 25;
const nf = new Intl.NumberFormat('id-ID');
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4'];
const STATUS_COLOR = { ok: 'teal', client: 'orange', server: 'red' } as const;
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: '2xx', label: 'Sukses (2xx)' },
  { value: 'errors', label: 'Semua error (≥ 400)' },
  { value: '4xx', label: 'Ditolak (4xx)' },
  { value: '5xx', label: 'Gagal server (5xx)' },
];
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({
  value: m,
  label: m,
}));
const DAYS = [
  { value: '1', label: '24 jam' },
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
];

function StatusBadge({ status }: { status: number }) {
  return (
    <Badge size="xs" variant="light" color={STATUS_COLOR[statusClass(status)]}>
      {status}
    </Badge>
  );
}

function Rows({ rows, onKey }: { rows: UsageLogRow[]; onKey: (id: string) => void }) {
  return (
    <>
      {rows.map((r) => (
        <Table.Tr key={r.id}>
          <Table.Td>
            <Tooltip label={formatDateTime(r.createdAt)} withArrow openDelay={300}>
              <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                {formatRelative(r.createdAt)}
              </Text>
            </Tooltip>
          </Table.Td>
          <Table.Td>
            <Box onClick={() => onKey(r.keyId)} style={{ cursor: 'pointer', minWidth: 0 }}>
              <TruncatedText size="sm" fw={500} maw={160}>
                {r.keyName ?? '(tanpa nama)'}
              </TruncatedText>
              <TruncatedText size="xs" c="dimmed" maw={160}>
                {r.ownerEmail ?? r.keyStart ?? '—'}
              </TruncatedText>
            </Box>
          </Table.Td>
          <Table.Td style={{ maxWidth: 0, minWidth: 220 }}>
            <TruncatedText ff="monospace" size="sm">
              {`${r.method} ${r.path}`}
            </TruncatedText>
          </Table.Td>
          <Table.Td>
            <StatusBadge status={r.status} />
          </Table.Td>
          <Table.Td visibleFrom="md">
            <Text size="sm" ff="monospace">
              {r.ip ?? '—'}
              {r.country ? ` ${countryFlag(r.country)}` : ''}
            </Text>
          </Table.Td>
          <Table.Td visibleFrom="lg">
            <Text size="sm">{r.durationMs != null ? `${r.durationMs} ms` : '—'}</Text>
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

/** Request-level log across every key with filters, pagination and CSV export. */
export function UsageLogSection() {
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_USAGE_FILTERS);
  const [page, setPage] = useState(1);
  const [debounced] = useDebouncedValue(filters.search, 300);
  const params = { ...filters, search: debounced, page, limit: LIMIT };
  const filtered = hasActiveUsageFilters(filters);
  const setFilters = (patch: Partial<Filters>) => {
    setFiltersState((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const log = useQuery({
    queryKey: ['api-key-usage-log', params],
    queryFn: () => fetchUsageLog(params),
    placeholderData: keepPreviousData,
  });
  const keys = useQuery({
    queryKey: ['api-keys', 'picker'],
    queryFn: () =>
      fetchApiKeys({
        ...{ search: '', status: 'all', ownerId: null, scope: null },
        page: 1,
        limit: 100,
      }),
    staleTime: 60_000,
  });
  const rows = log.data?.rows ?? [];
  const total = log.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const empty = (
    <VisitEmptyState filtered={filtered} onReset={() => setFilters(DEFAULT_USAGE_FILTERS)} />
  );

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="sm">
        <Group gap="xs" wrap="wrap" align="center">
          <TextInput
            placeholder="Cari path atau IP…"
            leftSection={<FiSearch size={14} />}
            rightSection={
              filters.search ? (
                <CloseButton
                  size="sm"
                  aria-label="Bersihkan"
                  onClick={() => setFilters({ search: '' })}
                />
              ) : null
            }
            value={filters.search}
            onChange={(e) => setFilters({ search: e.currentTarget.value })}
            size="sm"
            style={{ flex: '1 1 220px', minWidth: 0 }}
          />
          <Select
            size="sm"
            w={{ base: '100%', sm: 200 }}
            placeholder="Semua kunci"
            searchable
            clearable
            data={(keys.data?.rows ?? []).map((k) => ({
              value: k.id,
              label: `${k.name ?? '(tanpa nama)'} · ${k.ownerEmail ?? k.ownerId}`,
            }))}
            value={filters.keyId}
            onChange={(v) => setFilters({ keyId: v })}
            aria-label="Kunci"
          />
          <Select
            size="sm"
            w={{ base: '100%', sm: 180 }}
            data={STATUS_OPTIONS}
            value={filters.status}
            onChange={(v) => setFilters({ status: (v as Filters['status']) ?? 'all' })}
            allowDeselect={false}
            aria-label="Status"
          />
          <Select
            size="sm"
            w={{ base: '100%', sm: 120 }}
            placeholder="Method"
            clearable
            data={METHOD_OPTIONS}
            value={filters.method}
            onChange={(v) => setFilters({ method: v })}
            aria-label="Method"
          />
          <SegmentedControl
            size="sm"
            data={DAYS}
            value={filters.days}
            onChange={(v) => setFilters({ days: v as Filters['days'] })}
          />
          {filtered && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setFilters(DEFAULT_USAGE_FILTERS)}
            >
              Reset filter
            </Button>
          )}
        </Group>
        <Group justify="space-between" mt="xs" wrap="wrap" gap="xs">
          <Text size="xs" c="dimmed">
            {nf.format(total)} request{' '}
            {filtered ? 'cocok dengan filter' : `dalam ${filters.days} hari`}
          </Text>
          <Tooltip
            label={
              total === 0 ? 'Tidak ada baris untuk diekspor' : 'Maks. 10.000 baris, filter sama'
            }
            withArrow
          >
            <Button
              component="a"
              href={usageExportUrl({ ...filters, search: debounced })}
              size="xs"
              variant="light"
              leftSection={<FiDownload size={13} />}
              disabled={total === 0}
            >
              Export CSV
            </Button>
          </Tooltip>
        </Group>
      </Paper>
      {log.isError && (
        <Alert color="red" icon={<FiAlertCircle size={16} />} title="Gagal memuat log pemakaian">
          {(log.error as Error).message}
        </Alert>
      )}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
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
                <Table.Th>Kunci</Table.Th>
                <Table.Th>Request</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th visibleFrom="md">IP</Table.Th>
                <Table.Th visibleFrom="lg">Durasi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {log.isPending &&
                SKELETON_KEYS.map((k) => (
                  <Table.Tr key={k}>
                    <Table.Td colSpan={6}>
                      <Skeleton h={28} radius="sm" />
                    </Table.Td>
                  </Table.Tr>
                ))}
              {!log.isPending && <Rows rows={rows} onKey={(keyId) => setFilters({ keyId })} />}
              {!log.isPending && rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>{empty}</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text size="xs" c="dimmed">
          {total > 0
            ? `Menampilkan ${nf.format((page - 1) * LIMIT + 1)}–${nf.format(Math.min(page * LIMIT, total))} dari ${nf.format(total)}`
            : 'Tidak ada hasil'}
        </Text>
        {totalPages > 1 && (
          <Pagination value={page} total={totalPages} onChange={setPage} size="sm" siblings={1} />
        )}
      </Group>
    </Stack>
  );
}
