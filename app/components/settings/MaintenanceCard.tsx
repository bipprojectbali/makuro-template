import {
  Alert,
  Badge,
  Button,
  Group,
  MultiSelect,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiTool } from 'react-icons/fi';
import { type MaintenanceSettings, saveMaintenance } from '~/lib/settings-api';
import { SettingRow, SettingsCard } from './SettingsParts';

const ROLES = [
  { value: 'super-admin', label: 'super-admin (selalu)' },
  { value: 'admin', label: 'admin' },
  { value: 'user', label: 'user' },
];

type Props = {
  state: MaintenanceSettings;
  defaults: { message: string; allowRoles: string[]; retryAfterSeconds: number };
};

/** Maintenance switch, visitor message, and which roles may keep using the app. */
export function MaintenanceCard({ state, defaults }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<MaintenanceSettings>(state);
  useEffect(() => setForm(state), [state]);
  const roles = form.allowRoles ?? defaults.allowRoles;
  const dirty =
    form.enabled !== state.enabled ||
    (form.message ?? '') !== (state.message ?? '') ||
    JSON.stringify(form.allowRoles) !== JSON.stringify(state.allowRoles);
  const save = useMutation({
    mutationFn: saveMaintenance,
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['settings-overview'] });
      notifications.show({
        color: s.enabled ? 'orange' : 'teal',
        message: s.enabled
          ? 'Mode maintenance AKTIF. Pengunjung biasa melihat halaman pemeliharaan.'
          : 'Mode maintenance dimatikan.',
      });
    },
    onError: (e: Error) =>
      notifications.show({
        color: 'red',
        title: 'Gagal menyimpan maintenance',
        message: e.message,
      }),
  });
  const submit = () => {
    if (form.enabled && !state.enabled) {
      modals.openConfirmModal({
        title: 'Aktifkan mode maintenance?',
        children: (
          <Text size="sm">
            Semua pengunjung selain role {roles.join(', ')} akan melihat halaman pemeliharaan (HTTP
            503) sampai dimatikan. Halaman login dan API auth tetap terbuka agar admin bisa masuk.
          </Text>
        ),
        labels: { confirm: 'Aktifkan maintenance', cancel: 'Batal' },
        confirmProps: { color: 'orange' },
        onConfirm: () => save.mutate(form),
      });
      return;
    }
    save.mutate(form);
  };

  return (
    <SettingsCard
      title="Mode maintenance"
      description="Tutup aplikasi sementara tanpa mematikan server. Berlaku seketika untuk halaman dan API."
      aside={
        <Badge
          variant={form.enabled ? 'filled' : 'light'}
          color={form.enabled ? 'orange' : 'gray'}
          leftSection={<FiTool size={11} />}
        >
          {form.enabled ? 'Aktif' : 'Nonaktif'}
        </Badge>
      }
    >
      {state.enabled && (
        <Alert color="orange" variant="light" title="Sedang dalam maintenance">
          Pengunjung mendapat HTTP 503 dengan header Retry-After {defaults.retryAfterSeconds} detik.
          Anda melihat konsol karena role Anda diizinkan.
        </Alert>
      )}
      <SettingRow
        label="Aktifkan maintenance"
        description="Pengunjung yang tidak diizinkan melihat halaman pemeliharaan."
        control={
          <Switch
            size="md"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })}
            aria-label="Aktifkan maintenance"
          />
        }
      />
      <Stack gap="xs">
        <Textarea
          label="Pesan untuk pengunjung"
          placeholder={defaults.message}
          value={form.message ?? ''}
          onChange={(e) => setForm({ ...form, message: e.currentTarget.value || null })}
          maxLength={500}
          autosize
          minRows={2}
          description="Kosongkan untuk memakai pesan default."
        />
        <MultiSelect
          label="Role yang tetap boleh masuk"
          description="super-admin selalu bisa masuk agar tidak terkunci."
          data={ROLES}
          value={roles}
          onChange={(v) =>
            setForm({ ...form, allowRoles: Array.from(new Set(['super-admin', ...v])) })
          }
        />
      </Stack>
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button variant="subtle" color="gray" size="sm" onClick={() => setForm(state)}>
            Batalkan
          </Button>
        )}
        <Button
          size="sm"
          color={form.enabled ? 'orange' : undefined}
          onClick={submit}
          loading={save.isPending}
          disabled={!dirty}
        >
          {form.enabled ? 'Simpan & aktifkan' : 'Simpan maintenance'}
        </Button>
      </Group>
    </SettingsCard>
  );
}
