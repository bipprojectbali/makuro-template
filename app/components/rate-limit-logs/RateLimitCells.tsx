import { Badge, Stack, Text, Tooltip } from '@mantine/core';
import type { RateLimitRow } from '~/lib/rate-limit-logs-api';

const METHOD_COLORS: Record<string, string> = {
  GET: 'blue',
  POST: 'teal',
  PUT: 'yellow',
  PATCH: 'yellow',
  DELETE: 'red',
};

export function MethodBadge({
  method,
  size = 'sm',
}: {
  method: string | null;
  size?: 'xs' | 'sm';
}) {
  const m = (method ?? '').toUpperCase();
  return (
    <Badge
      color={METHOD_COLORS[m] ?? 'gray'}
      variant="light"
      size={size}
      ff="monospace"
      style={{ flexShrink: 0 }}
    >
      {m || '—'}
    </Badge>
  );
}

/** Method badge + path (truncated with tooltip) for a blocked request. */
export function RequestCell({ row, maw = 280 }: { row: RateLimitRow; maw?: number }) {
  return (
    <Stack gap={2} style={{ minWidth: 0 }}>
      <MethodBadge method={row.method} size="xs" />
      <Tooltip label={row.path} withArrow openDelay={400} disabled={row.path.length < 36}>
        <Text ff="monospace" size="sm" lh={1.3} truncate maw={maw}>
          {row.path}
        </Text>
      </Tooltip>
    </Stack>
  );
}
