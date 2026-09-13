import { Badge, Stack, Tooltip } from '@mantine/core';
import type { VisitRow } from '~/lib/visits-api';
import { botKindLabel, refererHost } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';

/** Visit-specific cells; generic time/client/device/user cells live in ../logs/LogCells. */
export {
  ClientCell as VisitorCell,
  DeviceCell,
  DeviceIcon,
  TimeCell,
  UserCell,
} from '../logs/LogCells';

export function TypeBadge({ row, size = 'sm' }: { row: VisitRow; size?: 'xs' | 'sm' }) {
  if (!row.isBot) {
    return (
      <Badge color="teal" variant="light" size={size} style={{ flexShrink: 0 }}>
        Human
      </Badge>
    );
  }
  return (
    <Tooltip label={botKindLabel(row.botKind)} withArrow>
      <Badge color="red" variant="light" size={size} style={{ flexShrink: 0 }}>
        Bot
      </Badge>
    </Tooltip>
  );
}

export function PathCell({ row, maw = 260 }: { row: VisitRow; maw?: number }) {
  const ref = refererHost(row.referer);
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <TruncatedText ff="monospace" size="sm" lh={1.3} maw={maw}>
        {row.path}
      </TruncatedText>
      {ref && (
        <TruncatedText size="xs" c="dimmed" lh={1.3} maw={maw}>
          {`dari ${ref}`}
        </TruncatedText>
      )}
    </Stack>
  );
}
