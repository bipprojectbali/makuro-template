import { FiClock, FiGlobe, FiLogIn, FiTrendingUp, FiUserCheck, FiUsers } from 'react-icons/fi';
import type { LoginStats } from '~/lib/login-logs-api';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

/** KPI row for the login console. */
export function LoginStatsCards({ stats }: { stats: LoginStats | undefined }) {
  const perUser =
    stats && stats.uniqueUsers > 0 ? (stats.total / stats.uniqueUsers).toFixed(1) : '0';
  const tiles: StatTileProps[] | undefined = stats && [
    { label: 'Total login', value: nf.format(stats.total), hint: 'semua waktu', icon: FiLogIn },
    {
      label: 'User unik',
      value: nf.format(stats.uniqueUsers),
      hint: `rata-rata ${perUser} login/user`,
      icon: FiUsers,
      color: 'teal',
    },
    {
      label: 'IP unik',
      value: nf.format(stats.uniqueIps),
      hint: 'alamat berbeda',
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
      label: '7 hari terakhir',
      value: nf.format(stats.last7d),
      hint: 'sesi baru dibuat',
      icon: FiTrendingUp,
      color: 'grape',
    },
    {
      label: 'Impersonasi',
      value: nf.format(stats.impersonations),
      hint: 'admin masuk sebagai user',
      icon: FiUserCheck,
      color: 'orange',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
