import { Badge, Checkbox, Group, Stack, Text, Tooltip } from '@mantine/core';
import type { ScopeDef } from '~/lib/api-keys-api';

const ROLE_RANK: Record<string, number> = { user: 0, admin: 1, 'super-admin': 2 };
const ROLE_LABEL: Record<string, string> = {
  user: 'user',
  admin: 'admin',
  'super-admin': 'super-admin',
};

export function roleAllows(ownerRole: string | null | undefined, minRole: string): boolean {
  return (ROLE_RANK[ownerRole ?? 'user'] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
}

type Props = {
  scopes: ScopeDef[];
  value: string[];
  onChange: (next: string[]) => void;
  ownerRole: string | null | undefined;
};

/** Checkbox list of every scope; scopes above the owner's role are disabled with a reason. */
export function ScopePicker({ scopes, value, onChange, ownerRole }: Props) {
  const allowed = scopes.filter((s) => roleAllows(ownerRole, s.minRole)).map((s) => s.id);
  const allOn = allowed.length > 0 && allowed.every((id) => value.includes(id));
  const readOnly = scopes.filter((s) => s.id.endsWith(':read'));
  const writes = scopes.filter((s) => !s.id.endsWith(':read'));
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...new Set([...value, id])] : value.filter((v) => v !== id));
  const renderGroup = (title: string, list: ScopeDef[]) => (
    <Stack gap={6}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
        {title}
      </Text>
      {list.map((s) => {
        const ok = roleAllows(ownerRole, s.minRole);
        const box = (
          <Checkbox
            key={s.id}
            size="sm"
            checked={value.includes(s.id)}
            disabled={!ok}
            onChange={(e) => toggle(s.id, e.currentTarget.checked)}
            label={
              <Group gap={6} wrap="nowrap">
                <Text size="sm" ff="monospace">
                  {s.id}
                </Text>
                <Badge size="xs" variant="outline" color={ok ? 'gray' : 'red'}>
                  min. {ROLE_LABEL[s.minRole] ?? s.minRole}
                </Badge>
              </Group>
            }
            description={`${s.label} — ${s.description}`}
          />
        );
        return ok ? (
          box
        ) : (
          <Tooltip
            key={s.id}
            label={`Role pemilik (${ownerRole ?? 'user'}) tidak bisa memegang scope ini`}
            withArrow
            position="top-start"
          >
            <div>{box}</div>
          </Tooltip>
        );
      })}
    </Stack>
  );
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text size="sm" fw={500}>
          Scope ({value.length} dipilih)
        </Text>
        <Checkbox
          size="xs"
          label="Semua yang diizinkan role pemilik"
          checked={allOn}
          indeterminate={!allOn && value.length > 0}
          disabled={allowed.length === 0}
          onChange={(e) => onChange(e.currentTarget.checked ? allowed : [])}
        />
      </Group>
      {renderGroup('Baca', readOnly)}
      {renderGroup('Tulis / hapus', writes)}
      <Text size="xs" c="dimmed">
        Kunci tidak pernah bisa melebihi hak role pemiliknya. Jika role pemilik diturunkan, scope di
        atas role barunya otomatis ditolak (403).
      </Text>
    </Stack>
  );
}
