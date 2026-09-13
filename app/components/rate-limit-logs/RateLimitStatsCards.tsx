import { FiClock, FiGlobe, FiShield, FiSliders, FiUser, FiZap } from 'react-icons/fi';
import { formatWindow, type RateLimitStats } from '~/lib/rate-limit-logs-api';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

/** KPI row for the rate-limit console, including the live limiter configuration. */
export function RateLimitStatsCards({ stats }: { stats: RateLimitStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    {
      label: 'Total diblokir',
      value: nf.format(stats.total),
      hint: 'semua waktu',
      icon: FiShield,
      color: 'red',
    },
    {
      label: '1 jam terakhir',
      value: nf.format(stats.last1h),
      hint: stats.last1h > 0 ? 'ada klien yang sedang dibatasi' : 'tenang',
      icon: FiZap,
      color: stats.last1h > 0 ? 'orange' : 'teal',
    },
    {
      label: '24 jam terakhir',
      value: nf.format(stats.last24h),
      hint: `${nf.format(stats.last7d)} dalam 7 hari`,
      icon: FiClock,
      color: 'cyan',
    },
    {
      label: 'IP unik',
      value: nf.format(stats.uniqueIps),
      hint: 'alamat yang pernah diblokir',
      icon: FiGlobe,
      color: 'indigo',
    },
    {
      label: 'User login',
      value: nf.format(stats.authenticated),
      hint: 'blokir saat sudah masuk akun',
      icon: FiUser,
      color: 'grape',
    },
    {
      label: 'Batas aktif',
      value: `${nf.format(stats.config.limit)}/${formatWindow(stats.config.windowMs)}`,
      hint: `${nf.format(stats.config.trackedClients)} klien dilacak sekarang`,
      icon: FiSliders,
      color: 'blue',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
