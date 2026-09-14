import { Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { type ApiKeyRow, daysUntil, maskedKey, STATUS_META } from '~/lib/api-keys-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';

const nf = new Intl.NumberFormat('id-ID');

export function KeyStatusBadge({
  status,
  size = 'sm',
}: {
  status: ApiKeyRow['status'];
  size?: 'xs' | 'sm';
}) {
  const m = STATUS_META[status];
  return (
    <Tooltip label={m.hint} withArrow openDelay={300}>
      <Badge size={size} variant={status === 'revoked' ? 'filled' : 'light'} color={m.color}>
        {m.label}
      </Badge>
    </Tooltip>
  );
}

/** Name on top, masked prefix below — never the plain key. */
export function KeyIdentityCell({ k }: { k: ApiKeyRow }) {
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <TruncatedText size="sm" fw={500} lh={1.3} maw={220}>
        {k.name ?? '(tanpa nama)'}
      </TruncatedText>
      <Text size="xs" c="dimmed" ff="monospace" lh={1.3}>
        {maskedKey(k)}
      </Text>
    </Stack>
  );
}

/** Up to `max` scope chips, the rest folded into a "+n" tooltip. */
export function ScopeChips({ scopes, max = 3 }: { scopes: string[]; max?: number }) {
  if (scopes.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Tanpa scope
      </Text>
    );
  const shown = scopes.slice(0, max);
  const rest = scopes.slice(max);
  return (
    <Group gap={4} wrap="wrap">
      {shown.map((s) => (
        <Badge key={s} size="xs" variant="outline" color="gray" ff="monospace" tt="none">
          {s}
        </Badge>
      ))}
      {rest.length > 0 && (
        <Tooltip label={rest.join(', ')} withArrow multiline maw={320}>
          <Badge size="xs" variant="light" color="gray">
            +{rest.length}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}

/** "Berakhir dalam 12 hari" with a warning tint under 7 days; "Tanpa kedaluwarsa" when null. */
export function ExpiryCell({ k, soonDays = 7 }: { k: ApiKeyRow; soonDays?: number }) {
  if (!k.expiresAt)
    return (
      <Text size="sm" c="dimmed">
        Tanpa kedaluwarsa
      </Text>
    );
  const days = daysUntil(k.expiresAt) ?? 0;
  const past = days <= 0;
  const soon = !past && days <= soonDays;
  return (
    <Tooltip label={formatDateTime(k.expiresAt)} withArrow openDelay={300}>
      <Stack gap={0}>
        <Text
          size="sm"
          lh={1.3}
          c={past ? 'dimmed' : soon ? 'yellow.7' : undefined}
          fw={soon ? 600 : undefined}
        >
          {past
            ? `Berakhir ${formatRelative(k.expiresAt)}`
            : days === 1
              ? 'Berakhir besok'
              : `${nf.format(days)} hari lagi`}
        </Text>
        <Text size="xs" c="dimmed" lh={1.3}>
          {formatDateTime(k.expiresAt)}
        </Text>
      </Stack>
    </Tooltip>
  );
}

export function UsageCell({ k }: { k: ApiKeyRow }) {
  return (
    <Stack gap={0}>
      <Text size="sm" lh={1.3}>
        {nf.format(k.usage24h)} / 24 jam
      </Text>
      <Text size="xs" c="dimmed" lh={1.3}>
        {k.lastRequest ? `terakhir ${formatRelative(k.lastRequest)}` : 'belum pernah dipakai'}
      </Text>
    </Stack>
  );
}
