import { Badge, Button, CloseButton, Group, Paper, Select, Text, TextInput } from '@mantine/core';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  type RateLimitFilters as Filters,
  hasActiveRateLimitFilters,
  type RateLimitPeriod,
  type RateLimitStats,
} from '~/lib/rate-limit-logs-api';
import type { Breakdown } from '~/lib/visits-api';
import { countryFlag, countryName, deviceLabel } from '~/lib/visits-format';

const PERIODS: Array<{ value: RateLimitPeriod; label: string }> = [
  { value: '1', label: '24 jam terakhir' },
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: 'all', label: 'Semua waktu' },
];
const DEVICES = ['desktop', 'mobile', 'tablet', 'bot'].map((v) => ({
  value: v,
  label: deviceLabel(v),
}));
const nf = new Intl.NumberFormat('id-ID');

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  stats: RateLimitStats | undefined;
  matchCount: number | undefined;
};

function options(items: Breakdown[], current: string | null, label: (k: string) => string) {
  const out = items
    .filter((c): c is Breakdown & { key: string } => Boolean(c.key))
    .map((c) => ({ value: c.key, label: label(c.key) }));
  if (current && !out.some((o) => o.value === current))
    out.push({ value: current, label: label(current) });
  return out;
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge
      size="lg"
      variant="light"
      ff="monospace"
      rightSection={
        <CloseButton size="xs" aria-label={`Hapus filter ${label}`} onClick={onClear} />
      }
    >
      {label}
    </Badge>
  );
}

/** Filter toolbar: search, period, method, country, device, plus chips for exact IP/path filters. */
export function RateLimitFilters({ filters, onChange, onReset, stats, matchCount }: Props) {
  const active = hasActiveRateLimitFilters(filters);
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari IP, path, kota, browser, nama/email user…"
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
          onChange={(v) => onChange({ period: (v as RateLimitPeriod) ?? 'all' })}
          data={PERIODS}
          allowDeselect={false}
          aria-label="Periode"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 140 }}
          placeholder="Semua metode"
          value={filters.method}
          onChange={(v) => onChange({ method: v })}
          data={options(stats?.topMethods ?? [], filters.method, (k) => k)}
          clearable
          aria-label="Metode HTTP"
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
        {filters.ip && <Chip label={`IP ${filters.ip}`} onClear={() => onChange({ ip: null })} />}
        {filters.path && <Chip label={filters.path} onClear={() => onChange({ path: null })} />}
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
          {nf.format(matchCount)} blokir {active ? 'cocok dengan filter' : 'tercatat'}
        </Text>
      )}
    </Paper>
  );
}
