import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteRateLimit, deleteRateLimits, type RateLimitRow } from '~/lib/rate-limit-logs-api';
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

/** Destructive rate-limit-log actions with confirm dialogs, loading state, and feedback. */
export function useRateLimitActions({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['rate-limit-logs'] }),
      qc.invalidateQueries({ queryKey: ['rate-limit-logs-stats'] }),
    ]);

  const single = useMutation({
    mutationFn: (id: string) => deleteRateLimit(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: async () => {
      await invalidate();
      notifications.show({ color: 'teal', message: 'Catatan rate limit dihapus.' });
      onDone();
    },
    onError: (e) => notifyError('Gagal menghapus catatan', e),
  });

  const bulk = useMutation({
    mutationFn: (ids: string[]) => deleteRateLimits(ids),
    onSuccess: async (r) => {
      await invalidate();
      notifications.show({ color: 'teal', message: `${nf.format(r.deleted)} catatan dihapus.` });
      onDone();
    },
    onError: (e) => notifyError('Gagal menghapus catatan terpilih', e),
  });

  const purge = useMutation({
    mutationFn: (days: number) => purgeLogs(days),
    onSuccess: async (r, days) => {
      await invalidate();
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['login-logs'] });
      notifications.show({
        color: 'teal',
        title: days === 0 ? 'Semua log dihapus' : `Log lebih dari ${days} hari dihapus`,
        message: `Rate-limit, visit (${nf.format(r.purgedVisits)}), dan login log dibersihkan.`,
      });
      onDone();
    },
    onError: (e) => notifyError('Gagal membersihkan log', e),
  });

  const deleteOne = (row: RateLimitRow) =>
    modals.openConfirmModal({
      title: 'Hapus catatan rate limit',
      children: (
        <Text size="sm">
          Catatan blokir <code>{row.path}</code> dari {row.ip ?? 'IP tidak diketahui'} pada{' '}
          {formatDateTime(row.createdAt)} akan dihapus permanen.
        </Text>
      ),
      labels: { confirm: 'Hapus catatan', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => single.mutate(row.id),
    });

  const deleteMany = (ids: string[]) =>
    modals.openConfirmModal({
      title: `Hapus ${nf.format(ids.length)} catatan`,
      children: (
        <Text size="sm">
          Semua catatan yang dipilih akan dihapus permanen dan tidak bisa dikembalikan.
        </Text>
      ),
      labels: { confirm: `Hapus ${nf.format(ids.length)} catatan`, cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulk.mutate(ids),
    });

  const purgeOld = () =>
    modals.openConfirmModal({
      title: `Purge log lebih dari ${PURGE_DAYS} hari`,
      children: (
        <Text size="sm">
          Semua rate-limit log, visit log, dan login log yang lebih tua dari {PURGE_DAYS} hari akan
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
          <strong>Semua</strong> rate-limit log, visit log, dan login log — termasuk yang baru saja
          tercatat — akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus semua log', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => purge.mutate(0),
    });

  return { deleteOne, deleteMany, purgeOld, clearAll, deletingId, bulkDeleting: bulk.isPending };
}
