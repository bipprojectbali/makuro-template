import { Badge, Tooltip } from '@mantine/core';
import { methodMeta } from '~/lib/login-logs-api';

/** Login-method badge; generic time/client/device/user cells live in ../logs/LogCells. */
export function MethodBadge({
  method,
  size = 'sm',
}: {
  method: string | null;
  size?: 'xs' | 'sm';
}) {
  const m = methodMeta(method);
  const label =
    method === 'impersonation' ? 'Admin masuk sebagai user ini' : `Metode login: ${m.label}`;
  return (
    <Tooltip label={label} withArrow>
      <Badge
        color={m.color}
        variant={method === 'impersonation' ? 'filled' : 'light'}
        size={size}
        style={{ flexShrink: 0 }}
      >
        {m.label}
      </Badge>
    </Tooltip>
  );
}
