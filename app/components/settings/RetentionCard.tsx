import { Badge, Button, Group, NumberInput, Stack, Switch, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiPlay } from 'react-icons/fi';
import {
  type RetentionSettings,
  type RetentionState,
  runRetentionNow,
  sameRetention,
  saveRetention,
} from '~/lib/settings-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { SettingRow, SettingsCard } from './SettingsParts';

const ROWS: Array<{
  key: keyof RetentionSettings;
  label: string;
  description: string;
  suggested: number;
}> = [
  {
    key: 'visitDays',
    label: 'Visitor log',
    description: 'Kunjungan halaman. Tabel terbesar; 30–90 hari biasanya cukup.',
    suggested: 90,
  },
  {
    key: 'loginDays',
    label: 'Login log',
    description: 'Riwayat masuk. Simpan lebih lama untuk investigasi akun.',
    suggested: 180,
  },
  {
    key: 'rateLimitDays',
    label: 'Rate-limit log',
    description: 'Request yang ditolak. Cepat menumpuk saat ada serangan.',
    suggested: 30,
  },
  {
    key: 'auditDays',
    label: 'Audit log',
    description: 'Jejak aksi admin. Sebaiknya dipertahankan minimal 1 tahun.',
    suggested: 365,
  },
];
const nf = new Intl.NumberFormat('id-ID');

function pick(s: RetentionState): RetentionSettings {
  return {
    visitDays: s.visitDays,
    loginDays: s.loginDays,
    rateLimitDays: s.rateLimitDays,
    auditDays: s.auditDays,
  };
}

/** Per-table max age; NULL = keep forever. Runs daily, or now on demand. */
export function RetentionCard({ state }: { state: RetentionState }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RetentionSettings>(pick(state));
  useEffect(() => setForm(pick(state)), [state]);
  const dirty = !sameRetention(form, pick(state));
  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ['settings-overview'] });
    notifications.show({ color: 'teal', message });
  };
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });
  const save = useMutation({
    mutationFn: saveRetention,
    onSuccess: () => done('Retensi log disimpan.'),
    onError: fail('Gagal menyimpan retensi'),
  });
  const run = useMutation({
    mutationFn: runRetentionNow,
    onSuccess: (r) =>
      done(
        `Retensi dijalankan: ${nf.format(Object.values(r.deleted).reduce((a, b) => a + b, 0))} baris dihapus.`,
      ),
    onError: fail('Gagal menjalankan retensi'),
  });
  const anyConfigured = Object.values(form).some(Boolean);
  const last = state.lastResult;

  return (
    <SettingsCard
      title="Retensi log"
      description="Hapus otomatis log yang lebih tua dari usia maksimum. Dicek tiap jam, dijalankan maksimal sekali sehari."
      aside={
        <Badge variant="light" color={anyConfigured ? 'teal' : 'gray'}>
          {anyConfigured ? 'Aktif' : 'Tidak ada aturan'}
        </Badge>
      }
    >
      {ROWS.map((r) => {
        const value = form[r.key];
        return (
          <SettingRow
            key={r.key}
            label={r.label}
            description={r.description}
            badge={
              <Badge size="xs" variant="light" color={value ? 'teal' : 'gray'}>
                {value ? `${value} hari` : 'Selamanya'}
              </Badge>
            }
            control={
              <Group gap="xs" wrap="nowrap">
                <Switch
                  size="sm"
                  checked={value !== null}
                  onChange={(e) =>
                    setForm({ ...form, [r.key]: e.currentTarget.checked ? r.suggested : null })
                  }
                  aria-label={`Aktifkan retensi ${r.label}`}
                />
                <NumberInput
                  size="sm"
                  w={110}
                  min={1}
                  max={3650}
                  allowDecimal={false}
                  suffix=" hari"
                  value={value ?? ''}
                  disabled={value === null}
                  onChange={(v) => setForm({ ...form, [r.key]: v === '' ? null : Number(v) })}
                  inputMode="numeric"
                  aria-label={`Usia maksimum ${r.label}`}
                />
              </Group>
            }
          />
        );
      })}
      <Stack gap={2}>
        <Text size="sm" c="dimmed">
          {state.lastRunAt
            ? `Terakhir jalan ${formatRelative(state.lastRunAt)} (${formatDateTime(state.lastRunAt)}, ${last?.trigger === 'manual' ? 'manual' : 'terjadwal'})`
            : 'Belum pernah dijalankan.'}
        </Text>
        {last && (
          <Text size="xs" c="dimmed">
            Dihapus: visit {nf.format(last.deleted.visitDays)} · login{' '}
            {nf.format(last.deleted.loginDays)} · rate-limit {nf.format(last.deleted.rateLimitDays)}{' '}
            · audit {nf.format(last.deleted.auditDays)}
          </Text>
        )}
      </Stack>
      <Group justify="flex-end" gap="xs">
        <Button
          size="sm"
          variant="default"
          leftSection={<FiPlay size={13} />}
          loading={run.isPending}
          disabled={!anyConfigured || dirty}
          onClick={() =>
            modals.openConfirmModal({
              title: 'Jalankan retensi sekarang?',
              children: (
                <Text size="sm">
                  Semua log yang lebih tua dari aturan tersimpan akan dihapus permanen sekarang
                  juga.
                </Text>
              ),
              labels: { confirm: 'Jalankan', cancel: 'Batal' },
              confirmProps: { color: 'red' },
              onConfirm: () => run.mutate(),
            })
          }
        >
          Jalankan sekarang
        </Button>
        {dirty && (
          <Button variant="subtle" color="gray" size="sm" onClick={() => setForm(pick(state))}>
            Batalkan
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => save.mutate(form)}
          loading={save.isPending}
          disabled={!dirty}
        >
          Simpan retensi
        </Button>
      </Group>
    </SettingsCard>
  );
}
