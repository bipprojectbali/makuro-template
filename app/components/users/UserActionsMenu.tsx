import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import {
  canActOnTarget,
  canImpersonate,
  canSetRole,
  normalizeRole,
  ROLES,
} from '@server/permissions';
import {
  FiEye,
  FiLogIn,
  FiMoreVertical,
  FiShield,
  FiSlash,
  FiTrash2,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi';
import { type AdminUser, isBanActive } from '~/lib/admin-users-api';
import type { useUserActions } from './useUserActions';

export type UserPermissions = { actorRole: string; currentUserId: string };

/** Which actions the current actor may take on a target (mirrors the server role matrix). */
export function allowedActions(user: AdminUser, p: UserPermissions) {
  const target = normalizeRole(user.role);
  const isSelf = user.id === p.currentUserId;
  const protectedTarget = isSelf || target === ROLES.SUPER_ADMIN;
  return {
    role: canSetRole(p.actorRole) && !protectedTarget,
    ban: !protectedTarget && canActOnTarget(p.actorRole, target),
    impersonate: canImpersonate(p.actorRole) && !protectedTarget,
    remove: canSetRole(p.actorRole) && !protectedTarget,
    isSelf,
  };
}

type Props = {
  user: AdminUser;
  perms: UserPermissions;
  actions: ReturnType<typeof useUserActions>;
  onOpen: (u: AdminUser) => void;
};

/** Kebab menu with every permitted action for one user. */
export function UserActionsMenu({ user, perms, actions, onOpen }: Props) {
  const can = allowedActions(user, perms);
  const banned = isBanActive(user);
  const busy = actions.busyId === user.id;
  const target = normalizeRole(user.role);
  return (
    <Menu position="bottom-end" withArrow shadow="md" width={230}>
      <Menu.Target>
        <Tooltip label="Aksi" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            loading={busy}
            aria-label={`Aksi untuk ${user.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <FiMoreVertical size={14} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item leftSection={<FiEye size={14} />} onClick={() => onOpen(user)}>
          Lihat detail
        </Menu.Item>
        {can.role && (
          <>
            <Menu.Divider />
            <Menu.Label>Role</Menu.Label>
            {target !== ROLES.ADMIN && (
              <Menu.Item
                leftSection={<FiShield size={14} />}
                onClick={() => actions.changeRole(user, ROLES.ADMIN)}
              >
                Jadikan admin
              </Menu.Item>
            )}
            {target !== ROLES.USER && (
              <Menu.Item
                leftSection={<FiUser size={14} />}
                onClick={() => actions.changeRole(user, ROLES.USER)}
              >
                Jadikan user biasa
              </Menu.Item>
            )}
          </>
        )}
        {(can.ban || can.impersonate || can.remove) && <Menu.Divider />}
        {can.impersonate && (
          <Menu.Item leftSection={<FiLogIn size={14} />} onClick={() => actions.impersonate(user)}>
            Masuk sebagai user ini
          </Menu.Item>
        )}
        {can.ban &&
          (banned ? (
            <Menu.Item
              leftSection={<FiUserCheck size={14} />}
              onClick={() => actions.unbanConfirm(user)}
            >
              Buka ban
            </Menu.Item>
          ) : (
            <Menu.Item
              color="orange"
              leftSection={<FiSlash size={14} />}
              onClick={() => actions.banWithForm(user)}
            >
              Ban user…
            </Menu.Item>
          ))}
        {can.remove && (
          <Menu.Item
            color="red"
            leftSection={<FiTrash2 size={14} />}
            onClick={() => actions.removeConfirm(user)}
          >
            Hapus permanen…
          </Menu.Item>
        )}
        {can.isSelf && (
          <Menu.Label>Ini akun Anda sendiri; role dan status diatur dari env.</Menu.Label>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
