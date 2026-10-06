import { Affix, Alert, Button, Group, Paper, Stack, Switch, Text, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiAlertCircle, FiArrowUp, FiRefreshCw } from 'react-icons/fi';
import { TruncatedText } from '~/components/logs/TruncatedText';
import { ServerLogFilterBar } from '~/components/server-logs/ServerLogFilterBar';
import { ServerLogList } from '~/components/server-logs/ServerLogList';
import { ServerLogPager } from '~/components/server-logs/ServerLogPager';
import { ServerLogStatsCards } from '~/components/server-logs/ServerLogStatsCards';
import { LOG_PAGE_SIZE, useLiveServerLogs } from '~/components/server-logs/useLiveServerLogs';
import { VisitEmptyState } from '~/components/visits/VisitEmptyState';
import {
  DEFAULT_LOG_FILTERS,
  fetchServerLogStats,
  type ServerLogFilters,
} from '~/lib/server-logs-api';
import type { Route } from './+types/server-logs';

export function meta() {
  return [{ title: 'Server Logs — Makuro Dev' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ROLES.SUPER_ADMIN);
  return null;
}

export default function ServerLogsPage() {
  const [filters, setFilters] = useState<ServerLogFilters>(DEFAULT_LOG_FILTERS);
  const [live, setLive] = useState(true);
  const [debouncedSearch] = useDebouncedValue(filters.search, 300);
  const effective = { ...filters, search: debouncedSearch };
  const { logs, rows, page, total, pending, connected, goTo, showNewest } = useLiveServerLogs(
    effective,
    live,
  );
  const stats = useQuery({ queryKey: ['server-logs-stats'], queryFn: fetchServerLogStats });
  const filtered = filters.level !== 'all' || filters.search.trim() !== '';

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
            label={live && !connected ? 'Live (menyambung…)' : 'Live'}
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
        <ServerLogFilterBar filters={filters} onChange={setFilters} />
        {logs.data && (
          <TruncatedText size="xs" c="dimmed" mt="xs">
            {`${total} entri cocok dari ${logs.data.buffered} di buffer`}
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

      <ServerLogPager
        page={page}
        pageSize={LOG_PAGE_SIZE}
        shown={rows.length}
        total={total}
        onChange={goTo}
      />

      {pending > 0 && (
        <Affix position={{ bottom: 20, right: 20 }}>
          <Button size="sm" radius="xl" leftSection={<FiArrowUp size={14} />} onClick={showNewest}>
            {`${pending} log baru`}
          </Button>
        </Affix>
      )}
    </Stack>
  );
}
