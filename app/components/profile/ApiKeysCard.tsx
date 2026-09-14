import { Alert, Badge, Button, Group, Skeleton, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiAlertCircle, FiClock, FiKey, FiPlus } from 'react-icons/fi';
import {
  type ApiKeyRow,
  daysUntil,
  fetchPersonalKeys,
  personalKeyClient,
} from '~/lib/api-keys-api';
import { ApiKeyDetailDrawer } from '../api-keys/ApiKeyDetailDrawer';
import { ApiKeyFormModal } from '../api-keys/ApiKeyFormModal';
import { ApiKeyCardList } from '../api-keys/ApiKeyTable';
import { RevealKeyModal } from '../api-keys/RevealKeyModal';
import { useApiKeyActions } from '../api-keys/useApiKeyActions';
import { SettingsCard } from '../settings/SettingsParts';

const QUERY_KEYS = ['me-api-keys', 'api-key-usage'];
const SOON_DAYS = 7;
const SKELETON_KEYS = ['s0', 's1'];

/** Personal API keys: create (revealed once), rotate, revoke, usage — scoped to the caller's role. */
export function ApiKeysCard({ role }: { role: string }) {
  const [selected, setSelected] = useState<ApiKeyRow | null>(null);
  const keys = useQuery({ queryKey: ['me-api-keys'], queryFn: fetchPersonalKeys });
  const actions = useApiKeyActions(personalKeyClient, QUERY_KEYS);
  const rows = keys.data?.rows ?? [];
  const live = keys.data?.live ?? 0;
  const max = keys.data?.max ?? 0;
  const atLimit = keys.data ? live >= max : false;
  const expiring = rows.filter((k) => {
    const d = daysUntil(k.expiresAt);
    return k.status === 'active' && d !== null && d <= SOON_DAYS;
  });
  const current = selected ? (rows.find((r) => r.id === selected.id) ?? selected) : null;
  const handlers = {
    busyId: actions.busyId,
    onOpen: setSelected,
    onEdit: actions.onEdit,
    onToggle: actions.onToggle,
    onRotate: actions.onRotate,
    onRevoke: actions.onRevoke,
    onDelete: (k: ApiKeyRow) => {
      if (selected?.id === k.id) setSelected(null);
      actions.onDelete(k);
    },
    onFilterOwner: () => undefined,
  };
  const empty = (
    <Stack align="center" gap={4} py="lg">
      <FiKey size={22} opacity={0.4} />
      <Text size="sm" fw={500}>
        Belum ada kunci pribadi
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        Buat kunci untuk mengakses API dari skrip atau integrasi tanpa cookie sesi.
      </Text>
    </Stack>
  );

  return (
    <SettingsCard
      title="API keys pribadi"
      description="Akses API atas nama akun Anda dari skrip atau integrasi. Scope dibatasi role Anda; kunci hanya ditampilkan sekali saat dibuat."
      aside={
        <Badge variant="light" color={live > 0 ? 'teal' : 'gray'}>
          {keys.data ? `${live} / ${max} aktif` : '…'}
        </Badge>
      }
    >
      {expiring.length > 0 && (
        <Alert color="yellow" variant="light" icon={<FiClock size={16} />}>
          {expiring.length} kunci berakhir dalam {SOON_DAYS} hari:{' '}
          {expiring.map((k) => k.name).join(', ')}. Rotasi sekarang agar integrasi tidak putus.
        </Alert>
      )}
      {keys.isError && (
        <Alert color="red" icon={<FiAlertCircle size={16} />} title="Gagal memuat kunci">
          {(keys.error as Error).message}
        </Alert>
      )}
      {keys.isPending ? (
        <Stack gap="xs">
          {SKELETON_KEYS.map((k) => (
            <Skeleton key={k} h={96} radius="md" />
          ))}
        </Stack>
      ) : (
        <ApiKeyCardList
          rows={rows}
          loading={false}
          empty={empty}
          soonDays={SOON_DAYS}
          {...handlers}
        />
      )}
      <Group justify="flex-end">
        <Button
          size="sm"
          leftSection={<FiPlus size={14} />}
          disabled={atLimit || keys.isPending}
          onClick={() => actions.openCreate()}
        >
          {atLimit ? `Batas ${max} kunci tercapai` : 'Buat kunci'}
        </Button>
      </Group>
      <ApiKeyDetailDrawer
        keyRow={current}
        onClose={() => setSelected(null)}
        soonDays={SOON_DAYS}
        fetchUsage={personalKeyClient.usage}
        h={handlers}
      />
      <ApiKeyFormModal
        state={actions.form}
        scopes={keys.data?.scopes ?? []}
        client={personalKeyClient}
        self={{ ownerRole: role }}
        onClose={actions.closeForm}
        onCreated={actions.setReveal}
        onSaved={actions.invalidate}
      />
      <RevealKeyModal reveal={actions.reveal} onClose={actions.closeReveal} />
    </SettingsCard>
  );
}
