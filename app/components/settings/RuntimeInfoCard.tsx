import { Badge, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { SettingsOverview } from '~/lib/settings-api';
import { SettingsCard } from './SettingsParts';

function Item({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
        {label}
      </Text>
      <div>{value}</div>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}

/** Read-only facts from the environment so operators know what the toggles above can rely on. */
export function RuntimeInfoCard({ runtime }: { runtime: SettingsOverview['runtime'] }) {
  return (
    <SettingsCard
      title="Runtime"
      description="Nilai dari environment server. Diubah lewat .env dan restart, bukan dari halaman ini."
    >
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Item
          label="Environment"
          value={
            <Badge variant="light" color={runtime.nodeEnv === 'production' ? 'red' : 'blue'}>
              {runtime.nodeEnv}
            </Badge>
          }
        />
        <Item
          label="App URL"
          value={
            <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
              {runtime.appUrl}
            </Text>
          }
        />
        <Item
          label="Google OAuth"
          value={
            <Group gap="xs">
              <Badge variant="light" color={runtime.googleAuthConfigured ? 'teal' : 'gray'}>
                {runtime.googleAuthConfigured ? 'Terkonfigurasi' : 'Tidak aktif'}
              </Badge>
            </Group>
          }
          hint="GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
        />
        <Item
          label="MCP debug server"
          value={
            <Badge variant="light" color={runtime.mcpEnabled ? 'teal' : 'gray'}>
              {runtime.mcpEnabled ? 'Aktif di /api/mcp' : 'Nonaktif'}
            </Badge>
          }
          hint="MCP_ADMIN_TOKEN"
        />
      </SimpleGrid>
    </SettingsCard>
  );
}
