import { FiActivity, FiClock, FiCpu, FiGlobe, FiUser, FiUsers } from 'react-icons/fi';
import type { VisitStats } from '~/lib/visits-api';
import { percent } from '~/lib/visits-format';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

/** KPI row for the visitor console: totals, uniqueness, recency, and human/bot split. */
export function VisitStatsCards({ stats }: { stats: VisitStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    {
      label: 'Total kunjungan',
      value: nf.format(stats.total),
      hint: 'semua waktu',
      icon: FiActivity,
    },
    {
      label: 'Pengunjung unik',
      value: nf.format(stats.uniqueIps),
      hint: 'berdasarkan IP',
      icon: FiGlobe,
      color: 'indigo',
    },
    {
      label: '24 jam terakhir',
      value: nf.format(stats.last24h),
      hint: `${nf.format(stats.last7d)} dalam 7 hari`,
      icon: FiClock,
      color: 'cyan',
    },
    {
      label: 'Human',
      value: nf.format(stats.humans),
      hint: `${percent(stats.humans, stats.total)}% dari total`,
      icon: FiUsers,
      color: 'teal',
    },
    {
      label: 'Bot',
      value: nf.format(stats.bots),
      hint: `${percent(stats.bots, stats.total)}% dari total`,
      icon: FiCpu,
      color: 'red',
    },
    {
      label: 'Login',
      value: nf.format(stats.loggedIn),
      hint: 'kunjungan user terautentikasi',
      icon: FiUser,
      color: 'grape',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
