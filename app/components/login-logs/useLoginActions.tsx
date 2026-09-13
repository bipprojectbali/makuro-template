import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteLogin, deleteLogins, type LoginRow } from '~/lib/login-logs-api';
import { purgeLogs } from '~/lib/visits-api';
import { formatDateTime } from '~/lib/visits-format';

const PURGE_DAYS = 30;
const nf = new Intl.NumberFormat('id-ID');

function notifyError(title: string, err: unknown) {
  notifications.show({
    color: 'red',
    title,
    message: err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.',
  });
}

/** Destructive login-log actions with confirm dialogs, loading state, and feedback. */
export function useLoginActions({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['login-logs'] }),
      qc.invalidateQueries({ queryKey: ['login-logs-stats'] }),
    ]);

  const single = useMutation({
    mutationFn: (id: string) => deleteLogin(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: async () => {
      await invalidate();
      notifications.show({ color: 'teal', message: 'Login log dihapus.' });
      onDone();
    },
    onError: (e) => notifyError('Gagal menghapus login log', e),
  });

  const bulk = useMutation({
    mutationFn: (ids: string[]) => deleteLogins(ids),
    onSuccess: async (r) => {
      await invalidate();
      notifications.show({ color: 'teal', message: `${nf.format(r.deleted)} login log dihapus.` });
      onDone();
    },
    onError: (e) => notifyError('Gagal menghapus login log terpilih', e),
  });

  const purge = useMutation({
    mutationFn: (days: number) => purgeLogs(days),
    onSuccess: async (r, days) => {
      await invalidate();
      qc.invalidateQueries({ queryKey: ['visits'] });
      notifications.show({
        color: 'teal',
        title: days === 0 ? 'Semua log dihapus' : `Log lebih dari ${days} hari dihapus`,
        message: `Login, visit (${nf.format(r.purgedVisits)}), dan rate-limit log dibersihkan.`,
      });
      onDone();
    },
    onError: (e) => notifyError('Gagal membersihkan log', e),
  });

  const deleteOne = (row: LoginRow) =>
    modals.openConfirmModal({
      title: 'Hapus login log',
      children: (
        <Text size="sm">
          Catatan login <strong>{row.userName ?? row.userId}</strong> pada{' '}
          {formatDateTime(row.createdAt)} akan dihapus permanen.
        </Text>
      ),
      labels: { confirm: 'Hapus login log', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => single.mutate(row.id),
    });

  const deleteMany = (ids: string[]) =>
    modals.openConfirmModal({
      title: `Hapus ${nf.format(ids.length)} login log`,
      children: (
        <Text size="sm">
          Semua login log yang dipilih akan dihapus permanen dan tidak bisa dikembalikan.
        </Text>
      ),
      labels: { confirm: `Hapus ${nf.format(ids.length)} login log`, cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulk.mutate(ids),
    });

  const purgeOld = () =>
    modals.openConfirmModal({
      title: `Purge log lebih dari ${PURGE_DAYS} hari`,
      children: (
        <Text size="sm">
          Semua login log, visit log, dan rate-limit log yang lebih tua dari {PURGE_DAYS} hari akan
          dihapus permanen. Data terbaru tetap dipertahankan.
        </Text>
      ),
      labels: { confirm: `Purge ${PURGE_DAYS} hari+`, cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => purge.mutate(PURGE_DAYS),
    });

  const clearAll = () =>
    modals.openConfirmModal({
      title: 'Hapus semua log',
      children: (
        <Text size="sm">
          <strong>Semua</strong> login log, visit log, dan rate-limit log — termasuk yang baru saja
          tercatat — akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus semua log', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => purge.mutate(0),
    });

  return { deleteOne, deleteMany, purgeOld, clearAll, deletingId, bulkDeleting: bulk.isPending };
}
