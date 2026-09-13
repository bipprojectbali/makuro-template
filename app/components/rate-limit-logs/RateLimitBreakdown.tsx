import { SimpleGrid } from '@mantine/core';
import type { RateLimitStats } from '~/lib/rate-limit-logs-api';
import { countryFlag, countryName, deviceLabel } from '~/lib/visits-format';
import { BreakdownPanel } from '../logs/BreakdownPanel';

type Props = {
  stats: RateLimitStats;
  onIp: (ip: string) => void;
  onPath: (path: string) => void;
  onMethod: (method: string) => void;
  onCountry: (code: string) => void;
  onDevice: (type: string) => void;
};

/** Top-N panels; every row applies the matching filter on click. */
export function RateLimitBreakdown({ stats, onIp, onPath, onMethod, onCountry, onDevice }: Props) {
  const total = Math.max(1, stats.total);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
      <BreakdownPanel
        title="IP paling sering diblokir"
        items={stats.topIps}
        total={total}
        render={(k) => k ?? '—'}
        onSelect={onIp}
        mono
      />
      <BreakdownPanel
        title="Endpoint paling sering kena"
        items={stats.topPaths}
        total={total}
        render={(k) => k ?? '—'}
        onSelect={onPath}
        mono
      />
      <BreakdownPanel
        title="Metode HTTP"
        items={stats.topMethods}
        total={total}
        render={(k) => k ?? '—'}
        onSelect={onMethod}
      />
      <BreakdownPanel
        title="Negara"
        items={stats.topCountries}
        total={total}
        render={(k) => `${countryFlag(k)} ${countryName(k)}`.trim()}
        onSelect={onCountry}
        emptyText="Belum ada data negara. Aktifkan header geo dari proxy (Cloudflare/Vercel/nginx)."
      />
      <BreakdownPanel
        title="Perangkat"
        items={stats.devices}
        total={total}
        render={(k) => deviceLabel(k)}
        onSelect={onDevice}
      />
    </SimpleGrid>
  );
}
