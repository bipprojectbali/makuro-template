import {
  Alert,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { FiAlertCircle } from 'react-icons/fi';
import { fetchApiKeyUsage, type UsageBreakdown } from '~/lib/api-keys-api';
import { countryFlag, countryName, formatDateTime, formatRelative } from '~/lib/visits-format';
import { BreakdownPanel } from '../logs/BreakdownPanel';
import { TruncatedText } from '../logs/TruncatedText';

const nf = new Intl.NumberFormat('id-ID');
const SKELETON_KEYS = ['s0', 's1', 's2', 's3'];
const RECENT_LIMIT = 20;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
        {label}
      </Text>
      <Text fz={22} fw={700} lh={1.2}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

/** Simple bar strip of daily request counts (last 30 days); errors tinted red. */
function DailyBars({ daily }: { daily: UsageBreakdown['daily'] }) {
  if (daily.length === 0)
    return (
      <Text size="sm" c="dimmed">
        Belum ada request 30 hari terakhir.
      </Text>
    );
  const max = Math.max(...daily.map((d) => d.count), 1);
  return (
    <Group gap={3} align="flex-end" wrap="nowrap" h={64} style={{ overflowX: 'auto' }}>
      {daily.map((d) => (
        <Tooltip
          key={d.day}
          label={`${d.day}: ${nf.format(d.count)} request, ${nf.format(d.errors)} error`}
          withArrow
        >
          <div
            style={{
              width: 10,
              flexShrink: 0,
              height: `${Math.max(6, (d.count / max) * 100)}%`,
              borderRadius: 2,
              background:
                d.errors > 0 ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-blue-5)',
            }}
          />
        </Tooltip>
      ))}
    </Group>
  );
}

function statusColor(s: number): string {
  if (s >= 500) return 'red';
  if (s >= 400) return 'orange';
  return 'teal';
}

/** Usage tab of the detail drawer: headline numbers, daily bars, top-N lists, recent calls. */
export function ApiKeyUsagePanel({ keyId }: { keyId: string }) {
  const q = useQuery({
    queryKey: ['api-key-usage', keyId],
    queryFn: () => fetchApiKeyUsage(keyId),
    staleTime: 15_000,
  });
  if (q.isPending)
    return (
      <Stack gap="sm">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} h={72} radius="md" />
        ))}
      </Stack>
    );
  if (q.isError)
    return (
      <Alert color="red" icon={<FiAlertCircle size={16} />} title="Gagal memuat pemakaian">
        {(q.error as Error).message}
      </Alert>
    );
  const { summary, breakdown, recent } = q.data;
  const total30d = breakdown.daily.reduce((a, d) => a + d.count, 0);
  return (
    <Stack gap="md">
      <SimpleGrid cols={2} spacing="sm">
        <Tile label="Total" value={nf.format(summary.total)} hint="sepanjang umur kunci" />
        <Tile
          label="24 jam"
          value={nf.format(summary.last24h)}
          hint={`${nf.format(summary.last7d)} dalam 7 hari`}
        />
        <Tile label="Error 24 jam" value={nf.format(summary.errors24h)} hint="status ≥ 400" />
        <Tile label="Rata-rata" value={`${nf.format(summary.avgMs)} ms`} hint="durasi 24 jam" />
      </SimpleGrid>
      <Paper withBorder radius="md" p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} mb="sm">
          Harian (30 hari)
        </Text>
        <DailyBars daily={breakdown.daily} />
      </Paper>
      <BreakdownPanel
        title="Endpoint tersering"
        items={breakdown.endpoints}
        total={total30d}
        render={(k) => k ?? '—'}
        mono
      />
      <BreakdownPanel
        title="IP tersering"
        items={breakdown.ips}
        total={total30d}
        render={(k) => k ?? 'Tidak diketahui'}
        mono
      />
      <BreakdownPanel
        title="Negara"
        items={breakdown.countries}
        total={total30d}
        render={(k) => (k ? `${countryFlag(k)} ${countryName(k)}` : 'Tidak diketahui')}
      />
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} p="sm" pb={4}>
          Request terakhir
        </Text>
        {recent.length === 0 ? (
          <Text size="sm" c="dimmed" p="sm" pt={0}>
            Belum ada request tercatat.
          </Text>
        ) : (
          <Table fz="xs" verticalSpacing={6} highlightOnHover>
            <Table.Tbody>
              {recent.slice(0, RECENT_LIMIT).map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td w={54}>
                    <Badge size="xs" variant="light" color={statusColor(r.status)}>
                      {r.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 0 }}>
                    <TruncatedText ff="monospace" size="xs">
                      {`${r.method} ${r.path}`}
                    </TruncatedText>
                    <Text size="xs" c="dimmed">
                      {r.ip ?? '—'}
                      {r.country ? ` · ${countryFlag(r.country)} ${r.country}` : ''}
                      {r.durationMs != null ? ` · ${r.durationMs} ms` : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td w={92} style={{ textAlign: 'right' }}>
                    <Tooltip label={formatDateTime(r.createdAt)} withArrow>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {formatRelative(r.createdAt)}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
