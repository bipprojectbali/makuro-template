import {
  ActionIcon,
  Badge,
  Code,
  CopyButton,
  Group,
  Highlight,
  List,
  Stack,
  Text,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { type ChangelogRelease, countItems } from '@server/changelog';
import { FiCheck, FiClock, FiLink, FiTag } from 'react-icons/fi';

export const SECTION_META: Record<string, { label: string; color: string }> = {
  Added: { label: 'Ditambahkan', color: 'green' },
  Changed: { label: 'Diubah', color: 'blue' },
  Fixed: { label: 'Diperbaiki', color: 'orange' },
  Removed: { label: 'Dihapus', color: 'red' },
  Deprecated: { label: 'Usang', color: 'yellow' },
  Security: { label: 'Keamanan', color: 'grape' },
};
export const sectionMeta = (type: string) => SECTION_META[type] ?? { label: type, color: 'gray' };

export const releaseAnchor = (version: string) => `v${version}`;

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
export const formatReleaseDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));

/** Changelog text with `code` spans; the search term is highlighted in plain segments. */
function ItemText({ text, query }: { text: string; query: string }) {
  let offset = 0;
  const parts = text.split('`').map((part, i) => {
    const seg = { part, code: i % 2 === 1, at: offset };
    offset += part.length + 1;
    return seg;
  });
  return (
    <>
      {parts.map(({ part, code, at }) =>
        code ? (
          <Code key={at}>{part}</Code>
        ) : (
          <Highlight key={at} component="span" highlight={query} inherit>
            {part}
          </Highlight>
        ),
      )}
    </>
  );
}

function ReleaseTitle({ release, current }: { release: ChangelogRelease; current: string }) {
  const anchor = releaseAnchor(release.version);
  return (
    <Group gap="xs" wrap="wrap">
      <Title order={4} id={anchor} style={{ scrollMarginTop: 72 }}>
        {release.unreleased ? 'Belum dirilis' : `v${release.version}`}
      </Title>
      {release.version === current && (
        <Badge color="grape" variant="light">
          Versi berjalan
        </Badge>
      )}
      {release.date && (
        <Text size="sm" c="dimmed">
          {formatReleaseDate(release.date)}
        </Text>
      )}
      <CopyButton
        value={`${typeof window === 'undefined' ? '' : window.location.origin}/dev/changelog#${anchor}`}
      >
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Tautan disalin' : 'Salin tautan ke versi ini'} withArrow>
            <ActionIcon
              variant="subtle"
              color={copied ? 'teal' : 'gray'}
              size="sm"
              onClick={copy}
              aria-label={`Salin tautan ke ${anchor}`}
            >
              {copied ? <FiCheck size={14} /> : <FiLink size={14} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

export function ChangelogTimeline({
  releases,
  currentVersion,
  query,
}: {
  releases: ChangelogRelease[];
  currentVersion: string;
  query: string;
}) {
  return (
    <Timeline bulletSize={28} lineWidth={2}>
      {releases.map((r) => (
        <Timeline.Item
          key={r.version}
          bullet={r.unreleased ? <FiClock size={14} /> : <FiTag size={14} />}
          color={r.unreleased ? 'yellow' : 'grape'}
          title={<ReleaseTitle release={r} current={currentVersion} />}
        >
          <Stack gap="sm" mt="xs">
            <Text size="xs" c="dimmed">
              {countItems(r)} perubahan
            </Text>
            {r.sections.map((s) => {
              const meta = sectionMeta(s.type);
              return (
                <Stack key={s.type} gap={6}>
                  <Badge color={meta.color} variant="light" w="fit-content">
                    {meta.label}
                  </Badge>
                  <List size="sm" spacing={4} withPadding>
                    {s.items.map((item) => (
                      <List.Item key={item} style={{ overflowWrap: 'anywhere' }}>
                        <ItemText text={item} query={query} />
                      </List.Item>
                    ))}
                  </List>
                </Stack>
              );
            })}
          </Stack>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
