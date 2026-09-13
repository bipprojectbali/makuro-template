import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { settingsOverview } from '@server/settings';
import { useQuery } from '@tanstack/react-query';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { AuthSettingsCard } from '~/components/settings/AuthSettingsCard';
import { RateLimitSettingsCard } from '~/components/settings/RateLimitSettingsCard';
import { RuntimeInfoCard } from '~/components/settings/RuntimeInfoCard';
import { fetchSettingsOverview, pickAuth, pickRateLimit } from '~/lib/settings-api';
import type { Route } from './+types/settings';

export function meta() {
  return [{ title: 'Settings — Makuro Dev' }];
}

/** Server-render the current values so the page never flashes empty controls. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ROLES.SUPER_ADMIN);
  return settingsOverview();
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const q = useQuery({
    queryKey: ['settings-overview'],
    queryFn: fetchSettingsOverview,
    initialData: loaderData,
  });
  const data = q.data;

  return (
    <Stack gap="md" p={{ base: 'sm', md: 'md' }} maw={960}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3}>App Settings</Title>
          <Text size="sm" c="dimmed">
            Pengaturan runtime yang tersimpan di database dan berlaku untuk semua instance saat
            dimuat ulang.
          </Text>
        </div>
        <Button
          size="sm"
          variant="light"
          leftSection={<FiRefreshCw size={14} />}
          loading={q.isFetching}
          onClick={() => q.refetch()}
        >
          Muat ulang
        </Button>
      </Group>

      {q.isError && (
        <Alert color="red" icon={<FiAlertCircle size={16} />} title="Gagal memuat pengaturan">
          {(q.error as Error).message}
        </Alert>
      )}

      <AuthSettingsCard
        initial={pickAuth(data.settings)}
        googleAuthConfigured={data.runtime.googleAuthConfigured}
      />
      <RateLimitSettingsCard initial={pickRateLimit(data.settings)} rateLimit={data.rateLimit} />
      <RuntimeInfoCard runtime={data.runtime} />
    </Stack>
  );
}
