import { Button, Stack, Text, ThemeIcon } from '@mantine/core';
import { FiFilter, FiInbox } from 'react-icons/fi';

type Props = { filtered: boolean; onReset: () => void };

/** Empty state for the visit list — distinguishes "no data yet" from "no match for filters". */
export function VisitEmptyState({ filtered, onReset }: Props) {
  return (
    <Stack align="center" gap="xs" py="xl">
      <ThemeIcon variant="light" color="gray" size={48} radius="xl">
        {filtered ? <FiFilter size={22} /> : <FiInbox size={22} />}
      </ThemeIcon>
      <Text fw={600}>
        {filtered ? 'Tidak ada kunjungan yang cocok' : 'Belum ada kunjungan tercatat'}
      </Text>
      <Text size="sm" c="dimmed" ta="center" maw={360}>
        {filtered
          ? 'Coba longgarkan pencarian atau periode waktu, atau reset semua filter.'
          : 'Log terisi otomatis setiap kali halaman aplikasi diakses. Request ke /api dan aset statis tidak dihitung.'}
      </Text>
      {filtered && (
        <Button variant="light" size="sm" onClick={onReset} mt="xs">
          Reset filter
        </Button>
      )}
    </Stack>
  );
}
