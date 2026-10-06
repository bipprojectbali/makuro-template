import { CloseButton, Group, SegmentedControl, TextInput } from '@mantine/core';
import { FiSearch } from 'react-icons/fi';
import type { LogLevelFilter, ServerLogFilters } from '~/lib/server-logs-api';

/** Search box + level selector for /dev/server-logs. */
export function ServerLogFilterBar({
  filters,
  onChange,
}: {
  filters: ServerLogFilters;
  onChange: (next: ServerLogFilters) => void;
}) {
  return (
    <Group gap="xs" wrap="wrap">
      <TextInput
        placeholder="Cari pesan atau field (mis. userId, path)…"
        leftSection={<FiSearch size={14} />}
        rightSection={
          filters.search ? (
            <CloseButton
              size="sm"
              aria-label="Bersihkan"
              onClick={() => onChange({ ...filters, search: '' })}
            />
          ) : null
        }
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.currentTarget.value })}
        size="sm"
        style={{ flex: '1 1 260px', minWidth: 0 }}
      />
      <SegmentedControl
        size="sm"
        value={filters.level}
        onChange={(v) => onChange({ ...filters, level: v as LogLevelFilter })}
        data={[
          { value: 'all', label: 'Semua' },
          { value: 'info', label: 'Info+' },
          { value: 'warn', label: 'Warn+' },
          { value: 'error', label: 'Error' },
        ]}
      />
    </Group>
  );
}
