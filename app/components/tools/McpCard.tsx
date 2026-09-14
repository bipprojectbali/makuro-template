import {
  ActionIcon,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { FiCheck, FiCopy, FiKey } from 'react-icons/fi';
import { Link } from 'react-router';
import { MCP_KEY_ENV, type McpInfo, mcpConfigSnippet } from '~/lib/ops-api';
import { SettingsCard } from '../settings/SettingsParts';

const GROUP_LABEL: Record<string, string> = {
  status: 'Status',
  logs: 'Log',
  db: 'Database',
  code: 'Kode',
};

/** MCP debug server: status, endpoint, tool catalog, client config snippet. */
export function McpCard({ info }: { info: McpInfo | undefined }) {
  if (!info) return null;
  const snippet = mcpConfigSnippet(info.endpoint);
  return (
    <SettingsCard
      title="MCP debug server"
      description="Agent AI (Claude Code, dll.) membaca log, DB, dan kesehatan file lewat endpoint ini. Tiap agent memakai API key sendiri ber-scope mcp: bisa dicabut satu per satu dan pemakaiannya terlacak."
      aside={
        <Badge variant="light" color="teal">
          Aktif
        </Badge>
      }
    >
      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm" c="dimmed">
          Endpoint
        </Text>
        <Code>{info.endpoint}</Code>
        <Text size="sm" c="dimmed">
          · auth: <Code>{info.auth.header}</Code>
        </Text>
        <Button
          component={Link}
          to="/dev/api-keys?new=mcp"
          size="xs"
          variant="light"
          leftSection={<FiKey size={13} />}
        >
          Buat kunci MCP
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        {info.legacyTokenEnabled
          ? `Token bersama ${info.auth.legacyEnvVar} (header Bearer atau ?${info.auth.legacyQuery}=) masih diterima sebagai jalur lama; sebaiknya pindah ke API key lalu hapus env tersebut.`
          : `Token bersama ${info.auth.legacyEnvVar} tidak diset — hanya API key ber-scope mcp yang diterima.`}
      </Text>
      <Table fz="sm" verticalSpacing={4} withRowBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tool</Table.Th>
            <Table.Th>Fungsi</Table.Th>
            <Table.Th w={100}>Grup</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {info.tools.map((t) => (
            <Table.Tr key={t.name}>
              <Table.Td>
                <Code>{t.name}</Code>
              </Table.Td>
              <Table.Td>{t.description}</Table.Td>
              <Table.Td>
                <Badge size="xs" variant="light">
                  {GROUP_LABEL[t.group] ?? t.group}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            Contoh <Code>.mcp.json</Code> (kunci dari env <Code>{MCP_KEY_ENV}</Code>, jangan ditulis
            langsung)
          </Text>
          <CopyButton value={snippet} timeout={1500}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Tersalin' : 'Salin'} withArrow>
                <ActionIcon
                  variant="subtle"
                  color={copied ? 'teal' : 'gray'}
                  onClick={copy}
                  aria-label="Salin konfigurasi"
                >
                  {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
        <Code block style={{ fontSize: 12 }}>
          {snippet}
        </Code>
      </Stack>
    </SettingsCard>
  );
}
