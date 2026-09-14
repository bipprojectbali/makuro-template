import { Badge, Button, CloseButton, Group, Paper, Select, Text, TextInput } from '@mantine/core';
import { FiSearch } from 'react-icons/fi';
import {
  DEFAULT_KEY_FILTERS,
  type ApiKeyFilters as Filters,
  type ScopeDef,
  STATUS_META,
} from '~/lib/api-keys-api';

const nf = new Intl.NumberFormat('id-ID');
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
];

type Props = {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  scopes: ScopeDef[];
  total: number;
  filtered: boolean;
  ownerLabel: string | null;
};

/** Search + status + scope + owner filters for the key list. */
export function ApiKeyFilterBar({
  filters,
  setFilters,
  scopes,
  total,
  filtered,
  ownerLabel,
}: Props) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari nama kunci, prefix, pemilik, catatan…"
          leftSection={<FiSearch size={14} />}
          rightSection={
            filters.search ? (
              <CloseButton
                size="sm"
                aria-label="Bersihkan"
                onClick={() => setFilters({ search: '' })}
              />
            ) : null
          }
          value={filters.search}
          onChange={(e) => setFilters({ search: e.currentTarget.value })}
          size="sm"
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 170 }}
          data={STATUS_OPTIONS}
          value={filters.status}
          onChange={(v) => setFilters({ status: (v as Filters['status']) ?? 'all' })}
          allowDeselect={false}
          aria-label="Status"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 200 }}
          placeholder="Semua scope"
          data={scopes.map((s) => ({ value: s.id, label: s.id }))}
          value={filters.scope}
          onChange={(v) => setFilters({ scope: v })}
          clearable
          searchable
          aria-label="Scope"
        />
        {filters.ownerId && (
          <Badge
            size="lg"
            variant="light"
            rightSection={
              <CloseButton
                size="xs"
                aria-label="Hapus filter pemilik"
                onClick={() => setFilters({ ownerId: null })}
              />
            }
          >
            Pemilik: {ownerLabel}
          </Badge>
        )}
        {filtered && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => setFilters(DEFAULT_KEY_FILTERS)}
          >
            Reset filter
          </Button>
        )}
      </Group>
      <Text size="xs" c="dimmed" mt="xs">
        {nf.format(total)} kunci {filtered ? 'cocok dengan filter' : 'tersimpan'}
      </Text>
    </Paper>
  );
}
