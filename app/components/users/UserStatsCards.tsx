import { FiShield, FiSlash, FiUserCheck, FiUserPlus, FiUsers, FiZap } from 'react-icons/fi';
import type { UserStats } from '~/lib/admin-users-api';
import { percent } from '~/lib/visits-format';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

export function UserStatsCards({ stats }: { stats: UserStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    { label: 'Total user', value: nf.format(stats.total), hint: 'semua akun', icon: FiUsers },
    {
      label: 'Aktif 24 jam',
      value: nf.format(stats.active24h),
      hint: 'user yang login hari ini',
      icon: FiZap,
      color: 'cyan',
    },
    {
      label: 'Baru 7 hari',
      value: nf.format(stats.new7d),
      hint: 'pendaftaran seminggu terakhir',
      icon: FiUserPlus,
      color: 'teal',
    },
    {
      label: 'Terverifikasi',
      value: nf.format(stats.verified),
      hint: `${percent(stats.verified, stats.total)}% dari total`,
      icon: FiUserCheck,
      color: 'indigo',
    },
    {
      label: 'Admin',
      value: nf.format(stats.admins + stats.superAdmins),
      hint: `${nf.format(stats.superAdmins)} super-admin`,
      icon: FiShield,
      color: 'grape',
    },
    {
      label: 'Banned',
      value: nf.format(stats.banned),
      hint: stats.banned > 0 ? 'perlu ditinjau berkala' : 'tidak ada',
      icon: FiSlash,
      color: stats.banned > 0 ? 'red' : 'gray',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
