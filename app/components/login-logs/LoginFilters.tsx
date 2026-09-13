import { Badge, Button, CloseButton, Group, Paper, Select, Text, TextInput } from '@mantine/core';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  type LoginFilters as Filters,
  hasActiveLoginFilters,
  type LoginPeriod,
  type LoginStats,
  methodMeta,
} from '~/lib/login-logs-api';
import type { Breakdown } from '~/lib/visits-api';
import { countryFlag, countryName, deviceLabel } from '~/lib/visits-format';

const PERIODS: Array<{ value: LoginPeriod; label: string }> = [
  { value: '1', label: '24 jam terakhir' },
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: 'all', label: 'Semua waktu' },
];
const DEVICES = ['desktop', 'mobile', 'tablet'].map((v) => ({ value: v, label: deviceLabel(v) }));
const nf = new Intl.NumberFormat('id-ID');

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  stats: LoginStats | undefined;
  matchCount: number | undefined;
  /** Display name for the active userId filter chip. */
  userLabel: string | null;
};

function options(items: Breakdown[], current: string | null, label: (k: string) => string) {
  const out = items
    .filter((c): c is Breakdown & { key: string } => Boolean(c.key))
    .map((c) => ({ value: c.key, label: label(c.key) }));
  if (current && !out.some((o) => o.value === current))
    out.push({ value: current, label: label(current) });
  return out;
}

/** Filter toolbar: search, period, method, country, device, plus the active user chip. */
export function LoginFilters({ filters, onChange, onReset, stats, matchCount, userLabel }: Props) {
  const active = hasActiveLoginFilters(filters);
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari nama, email, user ID, IP, kota, browser…"
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
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 170 }}
          value={filters.period}
          onChange={(v) => onChange({ period: (v as LoginPeriod) ?? 'all' })}
          data={PERIODS}
          allowDeselect={false}
          aria-label="Periode"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 160 }}
          placeholder="Semua metode"
          value={filters.method}
          onChange={(v) => onChange({ method: v })}
          data={options(stats?.topMethods ?? [], filters.method, (k) => methodMeta(k).label)}
          clearable
          aria-label="Metode login"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 190 }}
          placeholder="Semua negara"
          value={filters.country}
          onChange={(v) => onChange({ country: v })}
          data={options(
            stats?.topCountries ?? [],
            filters.country,
            (k) => `${countryFlag(k)} ${countryName(k)}`,
          )}
          clearable
          searchable
          nothingFoundMessage="Negara tidak ditemukan"
          aria-label="Negara"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 150 }}
          placeholder="Semua perangkat"
          value={filters.device}
          onChange={(v) => onChange({ device: v })}
          data={DEVICES}
          clearable
          aria-label="Perangkat"
        />
        {filters.userId && (
          <Badge
            size="lg"
            variant="light"
            rightSection={
              <CloseButton
                size="xs"
                aria-label="Hapus filter user"
                onClick={() => onChange({ userId: null })}
              />
            }
          >
            User: {userLabel ?? filters.userId}
          </Badge>
        )}
        {active && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<FiX size={14} />}
            onClick={onReset}
          >
            Reset filter
          </Button>
        )}
      </Group>
      {matchCount !== undefined && (
        <Text size="xs" c="dimmed" mt="xs">
          {nf.format(matchCount)} login {active ? 'cocok dengan filter' : 'tercatat'}
        </Text>
      )}
    </Paper>
  );
}
