import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type ApiKeyRow, adminKeyClient, type KeyClient } from '~/lib/api-keys-api';

export type Reveal = { key: string; row: ApiKeyRow; rotatedFrom?: ApiKeyRow };
export type CreatePreset = { name?: string; scopes?: string[] };
export type FormState =
  | { mode: 'create'; preset?: CreatePreset }
  | { mode: 'edit'; row: ApiKeyRow };

const ADMIN_QUERY_KEYS = ['api-keys', 'api-keys-stats', 'api-key-usage'];

/**
 * Toggle / rotate / revoke / delete with confirmation, feedback, and cache
 * invalidation. `client` selects admin vs personal endpoints; `queryKeys` are
 * the react-query roots to refresh afterwards.
 */
export function useApiKeyActions(client: KeyClient = adminKeyClient, queryKeys = ADMIN_QUERY_KEYS) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const invalidate = () =>
    Promise.all(queryKeys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });
  const ok = (message: string) => notifications.show({ color: 'teal', message });

  const toggle = useMutation({
    mutationFn: (k: ApiKeyRow) => client.update(k.id, { enabled: !k.enabled }),
    onMutate: (k) => setBusyId(k.id),
    onSettled: () => setBusyId(null),
    onSuccess: async (row) => {
      await invalidate();
      ok(row.enabled ? `Kunci "${row.name}" diaktifkan.` : `Kunci "${row.name}" dinonaktifkan.`);
    },
    onError: fail('Gagal mengubah status kunci'),
  });
  const rotate = useMutation({
    mutationFn: (k: ApiKeyRow) => client.rotate(k.id),
    onMutate: (k) => setBusyId(k.id),
    onSettled: () => setBusyId(null),
    onSuccess: async (r) => {
      await invalidate();
      setReveal({ key: r.key, row: r.row, rotatedFrom: r.old });
    },
    onError: fail('Gagal merotasi kunci'),
  });
  const revoke = useMutation({
    mutationFn: (k: ApiKeyRow) => client.revoke(k.id),
    onMutate: (k) => setBusyId(k.id),
    onSettled: () => setBusyId(null),
    onSuccess: async (row) => {
      await invalidate();
      ok(`Kunci "${row.name}" dicabut. Request berikutnya langsung ditolak.`);
    },
    onError: fail('Gagal mencabut kunci'),
  });
  const remove = useMutation({
    mutationFn: (k: ApiKeyRow) => client.remove(k.id),
    onMutate: (k) => setBusyId(k.id),
    onSettled: () => setBusyId(null),
    onSuccess: async (_r, k) => {
      await invalidate();
      ok(`Kunci "${k.name}" dan riwayat pemakaiannya dihapus.`);
    },
    onError: fail('Gagal menghapus kunci'),
  });

  const onToggle = (k: ApiKeyRow) => {
    if (!k.enabled) return toggle.mutate(k);
    modals.openConfirmModal({
      title: `Nonaktifkan kunci "${k.name}"?`,
      children: (
        <Text size="sm">
          Semua request dengan kunci ini akan ditolak (401) sampai diaktifkan lagi. Integrasi yang
          memakainya akan gagal seketika.
        </Text>
      ),
      labels: { confirm: 'Nonaktifkan kunci', cancel: 'Batal' },
      confirmProps: { color: 'orange' },
      onConfirm: () => toggle.mutate(k),
    });
  };
  const onRotate = (k: ApiKeyRow) =>
    modals.openConfirmModal({
      title: `Rotasi kunci "${k.name}"?`,
      children: (
        <Text size="sm">
          Kunci baru dengan pengaturan yang sama akan dibuat dan ditampilkan sekali. Kunci lama
          tetap bekerja selama masa tenggang 24 jam, lalu kedaluwarsa. Perbarui integrasi Anda dalam
          jendela itu.
        </Text>
      ),
      labels: { confirm: 'Rotasi kunci', cancel: 'Batal' },
      onConfirm: () => rotate.mutate(k),
    });
  const onRevoke = (k: ApiKeyRow) =>
    modals.openConfirmModal({
      title: `Cabut kunci "${k.name}"?`,
      children: (
        <Text size="sm">
          Pencabutan bersifat permanen dan berlaku seketika. Kunci tidak bisa diaktifkan lagi;
          riwayat pemakaian tetap tersimpan.
        </Text>
      ),
      labels: { confirm: 'Cabut kunci', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => revoke.mutate(k),
    });
  const onDelete = (k: ApiKeyRow) =>
    modals.openConfirmModal({
      title: `Hapus kunci "${k.name}" permanen?`,
      children: (
        <Text size="sm">
          Baris kunci dan seluruh riwayat pemakaiannya dihapus. Untuk audit, lebih aman{' '}
          <strong>mencabut</strong> saja; hapus hanya kalau memang tidak perlu jejaknya.
        </Text>
      ),
      labels: { confirm: 'Hapus permanen', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(k),
    });

  return {
    busyId,
    form,
    openCreate: (preset?: CreatePreset) => setForm({ mode: 'create', preset }),
    onEdit: (row: ApiKeyRow) => setForm({ mode: 'edit', row }),
    closeForm: () => setForm(null),
    reveal,
    setReveal,
    closeReveal: () => setReveal(null),
    onToggle,
    onRotate,
    onRevoke,
    onDelete,
    invalidate,
  };
}
