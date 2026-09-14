import {
  ActionIcon,
  Badge,
  Code,
  CopyButton,
  Group,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { type McpInfo, mcpConfigSnippet } from '~/lib/ops-api';
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
      description="Agent AI (Claude Code, dll.) bisa membaca log, DB, dan kesehatan file lewat endpoint ini dengan token."
      aside={
        <Badge variant="light" color={info.enabled ? 'teal' : 'gray'}>
          {info.enabled ? 'Aktif' : `Nonaktif — set ${info.auth.envVar}`}
        </Badge>
      }
    >
      <Group gap="xs" wrap="wrap">
        <Text size="sm" c="dimmed">
          Endpoint
        </Text>
        <Code>{info.endpoint}</Code>
        <Text size="sm" c="dimmed">
          · auth: <Code>{info.auth.header}</Code> atau query <Code>?{info.auth.query}=…</Code>
        </Text>
      </Group>
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
            Contoh <Code>.mcp.json</Code> (token dari env, jangan ditulis langsung)
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
