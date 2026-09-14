import {
  ActionIcon,
  Badge,
  Button,
  Code,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { type FeatureFlag, saveFeatureFlags } from '~/lib/settings-api';
import { SettingsCard } from './SettingsParts';

const KEY_RE = /^[a-z][a-z0-9_-]{1,49}$/;

/** Named boolean switches readable server-side (isFeatureEnabled) and publicly via GET /api/settings. */
export function FeatureFlagsCard({ flags }: { flags: FeatureFlag[] }) {
  const qc = useQueryClient();
  const [list, setList] = useState<FeatureFlag[]>(flags);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  useEffect(() => setList(flags), [flags]);
  const dirty = JSON.stringify(list) !== JSON.stringify(flags);
  const keyError =
    newKey && !KEY_RE.test(newKey)
      ? 'huruf kecil, angka, - atau _ (2–50 karakter)'
      : newKey && list.some((f) => f.key === newKey)
        ? 'kunci sudah ada'
        : null;
  const save = useMutation({
    mutationFn: () => saveFeatureFlags(list),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-overview'] });
      notifications.show({ color: 'teal', message: 'Feature flags disimpan.' });
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Gagal menyimpan flags', message: e.message }),
  });
  const add = () => {
    if (!newKey || keyError) return;
    setList([...list, { key: newKey, enabled: false, description: newDesc.trim() }]);
    setNewKey('');
    setNewDesc('');
  };

  return (
    <SettingsCard
      title="Feature flags"
      description="Hidupkan atau matikan fitur tanpa deploy. Server: isFeatureEnabled(key). Client: GET /api/settings → features."
      aside={
        <Badge variant="light">
          {list.filter((f) => f.enabled).length} aktif dari {list.length}
        </Badge>
      }
    >
      {list.length === 0 && (
        <Text size="sm" c="dimmed">
          Belum ada flag. Tambahkan di bawah, misalnya <Code>beta-dashboard</Code>.
        </Text>
      )}
      <Stack gap="xs">
        {list.map((f, i) => (
          <Group key={f.key} justify="space-between" wrap="nowrap" gap="sm">
            <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
              <Code>{f.key}</Code>
              <TextInput
                size="xs"
                variant="unstyled"
                placeholder="Deskripsi (opsional)"
                value={f.description}
                onChange={(e) =>
                  setList(
                    list.map((x, j) =>
                      j === i ? { ...x, description: e.currentTarget.value } : x,
                    ),
                  )
                }
                maxLength={200}
              />
            </Stack>
            <Switch
              size="sm"
              checked={f.enabled}
              onChange={(e) =>
                setList(
                  list.map((x, j) => (j === i ? { ...x, enabled: e.currentTarget.checked } : x)),
                )
              }
              aria-label={`Aktifkan ${f.key}`}
            />
            <Tooltip label="Hapus flag" withArrow>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => setList(list.filter((_, j) => j !== i))}
                aria-label={`Hapus ${f.key}`}
              >
                <FiTrash2 size={13} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
      </Stack>
      <Group gap="xs" align="flex-start" wrap="wrap">
        <TextInput
          size="sm"
          placeholder="kunci-flag"
          value={newKey}
          onChange={(e) => setNewKey(e.currentTarget.value.toLowerCase())}
          error={keyError}
          style={{ flex: '1 1 160px' }}
          aria-label="Kunci flag baru"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <TextInput
          size="sm"
          placeholder="Deskripsi"
          value={newDesc}
          onChange={(e) => setNewDesc(e.currentTarget.value)}
          maxLength={200}
          style={{ flex: '2 1 220px' }}
          aria-label="Deskripsi flag baru"
        />
        <Button
          size="sm"
          variant="default"
          leftSection={<FiPlus size={13} />}
          onClick={add}
          disabled={!newKey || Boolean(keyError)}
        >
          Tambah
        </Button>
      </Group>
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button variant="subtle" color="gray" size="sm" onClick={() => setList(flags)}>
            Batalkan
          </Button>
        )}
        <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
          Simpan flags
        </Button>
      </Group>
    </SettingsCard>
  );
}
