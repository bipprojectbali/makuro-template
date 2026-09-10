import { Box, Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

type LoginRow = {
  id: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

async function fetchLogins(
  before?: string,
): Promise<{ rows: LoginRow[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const r = await fetch(`/api/analytics/login-logs?${params}`);
  return r.json();
}

export default function LoginLogsPage() {
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (reset = false) => {
    setLoading(true);
    try {
      const d = await fetchLogins(reset ? undefined : (cursor ?? undefined));
      setRows(reset ? d.rows : (prev) => [...prev, ...d.rows]);
      setCursor(d.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const truncateUa = (ua: string | null) =>
    ua ? (ua.length > 60 ? `${ua.slice(0, 60)}…` : ua) : '—';

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>Login Logs</Title>
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

      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>User ID</Table.Th>
              <Table.Th>IP</Table.Th>
              <Table.Th>User Agent</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs" truncate maw={180}>
                    {r.userId}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs">
                    {r.ip ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {truncateUa(r.userAgent)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {rows.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" size="sm" py="md">
                    No logins recorded yet.
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
