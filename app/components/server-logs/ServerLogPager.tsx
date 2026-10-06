import { Group, Pagination, Text } from '@mantine/core';

/** "Menampilkan X–Y dari Z" plus page buttons (hidden when everything fits on one page). */
export function ServerLogPager({
  page,
  pageSize,
  shown,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  shown: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const totalPages = Math.ceil(total / pageSize);
  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="xs">
      <Text size="xs" c="dimmed">
        {`Menampilkan ${first}–${first + shown - 1} dari ${total}`}
      </Text>
      {totalPages > 1 && (
        <Pagination value={page} total={totalPages} onChange={onChange} size="sm" siblings={1} />
      )}
    </Group>
  );
}
