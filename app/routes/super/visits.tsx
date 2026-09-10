import { Badge, Box, Button, Group, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

type VisitRow = {
  id: string;
  ip: string | null;
  path: string;
  isBot: boolean;
  botKind: string | null;
  userId: string | null;
  createdAt: string;
};

type Stats = { total: number; bots: number; humans: number };

async function fetchStats(): Promise<Stats> {
  const r = await fetch('/api/analytics/visits/stats');
  return r.json();
}

async function fetchVisits(
  before?: string,
  botsOnly?: boolean,
): Promise<{ rows: VisitRow[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (botsOnly) params.set('botsOnly', 'true');
  const r = await fetch(`/api/analytics/visits?${params}`);
  return r.json();
}

export default function VisitsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [botsOnly, setBotsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (reset = false) => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        fetchStats(),
        fetchVisits(reset ? undefined : (cursor ?? undefined), botsOnly),
      ]);
      setStats(s);
      setRows(reset ? d.rows : (prev) => [...prev, ...d.rows]);
      setCursor(d.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, [botsOnly]);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>Visitor Logs</Title>
        <Group gap="xs">
          <Button
            variant={botsOnly ? 'filled' : 'light'}
            size="xs"
            onClick={() => setBotsOnly((v) => !v)}
          >
            Bots only
          </Button>
          <Button
            variant="light"
            size="xs"
            leftSection={<FiRefreshCw size={12} />}
            loading={loading}
            onClick={() => load(true)}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {stats && (
        <Group gap="sm">
          <Badge color="blue" size="lg">
            Total: {stats.total}
          </Badge>
          <Badge color="green" size="lg">
            Humans: {stats.humans}
          </Badge>
          <Badge color="red" size="lg">
            Bots: {stats.bots}
          </Badge>
        </Group>
      )}

      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>IP</Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>User</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs">
                    {r.ip ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs" truncate maw={260}>
                    {r.path}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.isBot ? (
                    <Tooltip label={r.botKind ?? 'bot'} withArrow>
                      <Badge color="red" size="xs">
                        bot
                      </Badge>
                    </Tooltip>
                  ) : (
                    <Badge color="green" size="xs">
                      human
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs" c="dimmed" truncate maw={160}>
                    {r.userId ?? '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {rows.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" size="sm" py="md">
                    No visits yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

      {cursor && (
        <Button variant="subtle" size="xs" loading={loading} onClick={() => load(false)}>
          Load more
        </Button>
      )}
    </Stack>
  );
}
