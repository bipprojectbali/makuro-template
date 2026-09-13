import {
  ActionIcon,
  Button,
  CloseButton,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { FiSearch, FiX } from 'react-icons/fi';
import type { Breakdown, VisitFilters as Filters, VisitPeriod, VisitType } from '~/lib/visits-api';
import { hasActiveFilters } from '~/lib/visits-api';
import { countryFlag, countryName, deviceLabel } from '~/lib/visits-format';

const PERIODS: Array<{ value: VisitPeriod; label: string }> = [
  { value: '1', label: '24 jam terakhir' },
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: 'all', label: 'Semua waktu' },
];

const DEVICES = ['desktop', 'mobile', 'tablet', 'bot'].map((v) => ({
  value: v,
  label: deviceLabel(v),
}));

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  countries: Breakdown[];
  matchCount: number | undefined;
};

/** Filter toolbar: free-text search, human/bot, period, country and device selectors. */
export function VisitFilters({ filters, onChange, onReset, countries, matchCount }: Props) {
  const countryOptions = countries
    .filter((c): c is Breakdown & { key: string } => Boolean(c.key))
    .map((c) => ({ value: c.key, label: `${countryFlag(c.key)} ${countryName(c.key)}` }));
  if (filters.country && !countryOptions.some((o) => o.value === filters.country)) {
    countryOptions.push({ value: filters.country, label: countryName(filters.country) });
  }
  const active = hasActiveFilters(filters);

  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari IP, path, kota, browser, referer, atau nama user…"
          leftSection={<FiSearch size={14} />}
          rightSection={
            filters.search ? (
              <CloseButton
                size="sm"
                aria-label="Bersihkan pencarian"
                onClick={() => onChange({ search: '' })}
              />
            ) : null
          }
          value={filters.search}
          onChange={(e) => onChange({ search: e.currentTarget.value })}
          size="sm"
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <SegmentedControl
          size="sm"
          value={filters.type}
          onChange={(v) => onChange({ type: v as VisitType })}
          data={[
            { value: 'all', label: 'Semua' },
            { value: 'human', label: 'Human' },
            { value: 'bot', label: 'Bot' },
          ]}
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 170 }}
          value={filters.period}
          onChange={(v) => onChange({ period: (v as VisitPeriod) ?? 'all' })}
          data={PERIODS}
          allowDeselect={false}
          aria-label="Periode"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 190 }}
          placeholder="Semua negara"
          value={filters.country}
          onChange={(v) => onChange({ country: v })}
          data={countryOptions}
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
        {active && (
          <>
            <Tooltip label="Reset semua filter" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={onReset}
                aria-label="Reset filter"
                hiddenFrom="sm"
              >
                <FiX size={16} />
              </ActionIcon>
            </Tooltip>
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<FiX size={14} />}
              onClick={onReset}
              visibleFrom="sm"
            >
              Reset filter
            </Button>
          </>
        )}
      </Group>
      {matchCount !== undefined && (
        <Text size="xs" c="dimmed" mt="xs">
          {active
            ? `${new Intl.NumberFormat('id-ID').format(matchCount)} kunjungan cocok dengan filter`
            : `${new Intl.NumberFormat('id-ID').format(matchCount)} kunjungan tercatat`}
        </Text>
      )}
    </Paper>
  );
}
