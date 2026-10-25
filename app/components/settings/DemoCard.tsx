import { Badge, Button, Group, NumberInput, Switch, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiPlayCircle } from 'react-icons/fi';
import { type DemoDefaults, type DemoSettings, saveDemo } from '~/lib/settings-api';
import { SettingRow, SettingsCard } from './SettingsParts';

/** Public "Coba Demo" sandbox switch + how long demo accounts live before cleanup. */
export function DemoCard({
  state,
  defaults,
  forcedByBuild,
}: {
  state: DemoSettings;
  defaults: DemoDefaults;
  forcedByBuild: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<DemoSettings>(state);
  useEffect(() => setForm(state), [state]);
  const dirty = form.enabled !== state.enabled || form.ttlHours !== state.ttlHours;
  const ttl = form.ttlHours ?? defaults.ttlHours;
  const statusLabel = form.enabled ? (forcedByBuild ? 'Dipaku build' : 'Aktif') : 'Nonaktif';

  const save = useMutation({
    mutationFn: saveDemo,
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['settings-overview'] });
      notifications.show({
        color: 'teal',
        message: s.enabled
          ? 'Mode demo aktif. Tombol "Coba Demo" tampil di landing dan login.'
          : 'Mode demo dimatikan.',
      });
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Gagal menyimpan mode demo', message: e.message }),
  });

  const submit = () => {
    if (form.enabled && !state.enabled) {
      modals.openConfirmModal({
        title: 'Aktifkan mode demo?',
        children: (
          <Text size="sm">
            Pengunjung bisa masuk tanpa akun sebagai user demo sementara di area /app. Akun demo
            beserta datanya dihapus otomatis setelah {ttl} jam.
          </Text>
        ),
        labels: { confirm: 'Aktifkan demo', cancel: 'Batal' },
        onConfirm: () => save.mutate(form),
      });
      return;
    }
    save.mutate(form);
  };

  return (
    <SettingsCard
      title="Mode demo"
      description="Izinkan pengunjung mencoba aplikasi tanpa mendaftar. Hanya area /app; aksi sensitif diblokir."
      aside={
        <Badge
          variant={form.enabled ? 'filled' : 'light'}
          color={form.enabled ? 'teal' : 'gray'}
          leftSection={<FiPlayCircle size={11} />}
        >
          {statusLabel}
        </Badge>
      }
    >
      <SettingRow
        label="Aktifkan Coba Demo"
        description={
          forcedByBuild
            ? 'Build ini dikompilasi dengan mode demo menyala, jadi saklar ini tidak bisa dimatikan. Pakai binary produksi (bun run build:binary) kalau mode demo harus bisa dimatikan.'
            : 'Menampilkan tombol Coba Demo di landing dan halaman login.'
        }
        control={
          <Switch
            size="md"
            disabled={forcedByBuild}
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })}
            aria-label="Aktifkan mode demo"
          />
        }
      />
      <NumberInput
        label="Masa berlaku akun demo (jam)"
        description={`1–${defaults.maxTtlHours} jam. Kosongkan untuk default ${defaults.ttlHours} jam.`}
        placeholder={`${defaults.ttlHours} (default)`}
        min={1}
        max={defaults.maxTtlHours}
        allowDecimal={false}
        allowNegative={false}
        clampBehavior="strict"
        inputMode="numeric"
        value={form.ttlHours ?? ''}
        onChange={(v) => setForm({ ...form, ttlHours: typeof v === 'number' ? v : null })}
        maw={280}
      />
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button variant="subtle" color="gray" size="sm" onClick={() => setForm(state)}>
            Batalkan
          </Button>
        )}
        <Button size="sm" onClick={submit} loading={save.isPending} disabled={!dirty}>
          Simpan mode demo
        </Button>
      </Group>
    </SettingsCard>
  );
}
