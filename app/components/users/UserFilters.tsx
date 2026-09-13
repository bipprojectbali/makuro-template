import {
  Button,
  CloseButton,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { ROLES } from '@server/permissions';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  DEFAULT_USER_FILTERS,
  type UserFilters as Filters,
  hasActiveUserFilters,
  type UserSort,
} from '~/lib/admin-users-api';

const nf = new Intl.NumberFormat('id-ID');
const ROLE_OPTIONS = [
  { value: ROLES.USER, label: 'user' },
  { value: ROLES.ADMIN, label: 'admin' },
  { value: ROLES.SUPER_ADMIN, label: 'super-admin' },
];
const PERIODS = [
  { value: '7', label: 'Bergabung 7 hari' },
  { value: '30', label: 'Bergabung 30 hari' },
  { value: '90', label: 'Bergabung 90 hari' },
  { value: 'all', label: 'Semua waktu' },
];
const SORTS: Array<{ value: UserSort; label: string }> = [
  { value: 'newest', label: 'Terbaru bergabung' },
  { value: 'oldest', label: 'Terlama bergabung' },
  { value: 'lastLogin', label: 'Login terakhir' },
  { value: 'name', label: 'Nama A–Z' },
];

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  matchCount: number | undefined;
};

export function UserFilters({ filters, onChange, matchCount }: Props) {
  const active = hasActiveUserFilters(filters);
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari nama, email, atau user ID…"
          leftSection={<FiSearch size={14} />}
          rightSection={
            filters.search ? (
              <CloseButton
                size="sm"
                aria-label="Bersihkan"
                onClick={() => onChange({ search: '' })}
              />
            ) : null
          }
          value={filters.search}
          onChange={(e) => onChange({ search: e.currentTarget.value })}
          size="sm"
          inputMode="email"
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <SegmentedControl
          size="sm"
          value={filters.status}
          onChange={(v) => onChange({ status: v as Filters['status'] })}
          data={[
            { value: 'all', label: 'Semua' },
            { value: 'active', label: 'Aktif' },
            { value: 'banned', label: 'Banned' },
          ]}
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 150 }}
          placeholder="Semua role"
          value={filters.role}
          onChange={(v) => onChange({ role: v })}
          data={ROLE_OPTIONS}
          clearable
          aria-label="Role"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 180 }}
          value={filters.period}
          onChange={(v) => onChange({ period: (v as Filters['period']) ?? 'all' })}
          data={PERIODS}
          allowDeselect={false}
          aria-label="Periode bergabung"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 180 }}
          value={filters.sort}
          onChange={(v) => onChange({ sort: (v as UserSort) ?? 'newest' })}
          data={SORTS}
          allowDeselect={false}
          aria-label="Urutkan"
        />
        {active && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<FiX size={14} />}
            onClick={() => onChange(DEFAULT_USER_FILTERS)}
          >
            Reset filter
          </Button>
        )}
      </Group>
      {matchCount !== undefined && (
        <Text size="xs" c="dimmed" mt="xs">
          {nf.format(matchCount)} user {active ? 'cocok dengan filter' : 'terdaftar'}
        </Text>
      )}
    </Paper>
  );
}
