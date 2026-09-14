import {
  Alert,
  Button,
  CloseButton,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiAlertCircle, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { TruncatedText } from '~/components/logs/TruncatedText';
import { ServerLogList } from '~/components/server-logs/ServerLogList';
import { ServerLogStatsCards } from '~/components/server-logs/ServerLogStatsCards';
import { VisitEmptyState } from '~/components/visits/VisitEmptyState';
import {
  DEFAULT_LOG_FILTERS,
  fetchServerLogStats,
  fetchServerLogs,
  type LogLevelFilter,
  type ServerLogFilters,
} from '~/lib/server-logs-api';
import type { Route } from './+types/server-logs';

export function meta() {
  return [{ title: 'Server Logs — Makuro Dev' }];
}

const AUTO_REFRESH_MS = 5_000;

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ROLES.SUPER_ADMIN);
  return null;
}

export default function ServerLogsPage() {
  const [filters, setFilters] = useState<ServerLogFilters>(DEFAULT_LOG_FILTERS);
  const [live, setLive] = useState(true);
  const [debouncedSearch] = useDebouncedValue(filters.search, 300);
  const effective = { ...filters, search: debouncedSearch };
  const logs = useQuery({
    queryKey: ['server-logs', effective],
    queryFn: () => fetchServerLogs(effective),
    placeholderData: keepPreviousData,
    refetchInterval: live ? AUTO_REFRESH_MS : false,
  });
  const stats = useQuery({
    queryKey: ['server-logs-stats'],
    queryFn: fetchServerLogStats,
    refetchInterval: live ? AUTO_REFRESH_MS : false,
  });
  const filtered = filters.level !== 'all' || filters.search.trim() !== '';
  const rows = logs.data?.rows ?? [];

  return (
    <Stack gap="md" p={{ base: 'sm', md: 'md' }}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3}>Server Logs</Title>
          <Text size="sm" c="dimmed">
            Log proses server dari buffer memori (info ke atas). Hilang saat restart; log persisten
            ada di file / stdout.
          </Text>
        </div>
        <Group gap="sm" wrap="wrap">
          <Switch
            size="sm"
            label="Auto-refresh 5 dtk"
            checked={live}
            onChange={(e) => setLive(e.currentTarget.checked)}
          />
          <Button
            size="sm"
            variant="light"
            leftSection={<FiRefreshCw size={14} />}
            loading={logs.isFetching}
            onClick={() => {
              logs.refetch();
              stats.refetch();
            }}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <ServerLogStatsCards stats={stats.data} />

      <Paper withBorder radius="md" p="sm">
        <Group gap="xs" wrap="wrap">
          <TextInput
            placeholder="Cari pesan atau field (mis. userId, path)…"
            leftSection={<FiSearch size={14} />}
            rightSection={
              filters.search ? (
                <CloseButton
                  size="sm"
                  aria-label="Bersihkan"
                  onClick={() => setFilters({ ...filters, search: '' })}
                />
              ) : null
            }
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.currentTarget.value })}
            size="sm"
            style={{ flex: '1 1 260px', minWidth: 0 }}
          />
          <SegmentedControl
            size="sm"
            value={filters.level}
            onChange={(v) => setFilters({ ...filters, level: v as LogLevelFilter })}
            data={[
              { value: 'all', label: 'Semua' },
              { value: 'info', label: 'Info+' },
              { value: 'warn', label: 'Warn+' },
              { value: 'error', label: 'Error' },
            ]}
          />
        </Group>
        {logs.data && (
          <TruncatedText size="xs" c="dimmed" mt="xs">
            {`${rows.length} entri ditampilkan dari ${logs.data.buffered} di buffer`}
          </TruncatedText>
        )}
      </Paper>

      {logs.isError && (
        <Alert color="red" icon={<FiAlertCircle size={16} />} title="Gagal memuat log">
          {(logs.error as Error).message}
        </Alert>
      )}

      <ServerLogList
        rows={rows}
        loading={logs.isPending}
        empty={
          <VisitEmptyState filtered={filtered} onReset={() => setFilters(DEFAULT_LOG_FILTERS)} />
        }
      />
    </Stack>
  );
}
