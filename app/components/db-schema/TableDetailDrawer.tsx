import { Anchor, Badge, Divider, Drawer, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import type { FkEdge, TableMeta } from '@server/db/schema-introspect';
import type { TableStats } from '@server/db/schema-stats';
import { columnSignature, defaultLabel, fmtBytes, onDeleteLabel } from '~/lib/db-schema-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { ACCENT, PK_COL } from './erd.layout';

type Props = {
  table: TableMeta | null;
  edges: FkEdge[];
  stats: TableStats | undefined;
  onClose: () => void;
  onSelect: (id: string) => void;
};

const nf = new Intl.NumberFormat('id-ID');

/** Columns, indexes, relations and live size for one table. */
export function TableDetailDrawer({ table, edges, stats, onClose, onSelect }: Props) {
  const outgoing = table ? edges.filter((e) => e.source === table.id) : [];
  const incoming = table ? edges.filter((e) => e.target === table.id) : [];
  return (
    <Drawer
      opened={table !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title={table ? `Tabel ${table.name}` : ''}
      padding="md"
    >
      {table && (
        <Stack gap="lg">
          <Group gap="xs">
            <Badge variant="light">{table.columns.length} kolom</Badge>
            <Badge variant="light" color="indigo">
              {outgoing.length} FK keluar
            </Badge>
            <Badge variant="light" color="cyan">
              {incoming.length} dirujuk
            </Badge>
            <Badge variant="light" color="gray">
              {table.indexes.length} index
            </Badge>
          </Group>

          <Section title="Data di database">
            <Field label="Baris">
              <Text size="sm">{stats ? nf.format(stats.rows) : '—'}</Text>
            </Field>
            <Field label="Ukuran">
              <Text size="sm">{stats ? fmtBytes(stats.bytes) : '—'}</Text>
            </Field>
            <Field label="Nama tabel">
              <Copyable value={table.name} />
            </Field>
          </Section>
          <Divider />

          <Section title="Kolom">
            <Table fz="xs" verticalSpacing={4} withRowBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Tipe</Table.Th>
                  <Table.Th>Null</Table.Th>
                  <Table.Th>Default</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {table.columns.map((c) => (
                  <Table.Tr key={c.key}>
                    <Table.Td>
                      <Tooltip label={columnSignature(c)} withArrow openDelay={300}>
                        <Group gap={4} wrap="nowrap">
                          {c.pk && (
                            <Text span fw={700} c={PK_COL} fz={9}>
                              PK
                            </Text>
                          )}
                          {c.fkTable && (
                            <Text span fw={700} c={ACCENT} fz={9}>
                              FK
                            </Text>
                          )}
                          {c.unique && !c.pk && (
                            <Text span fw={700} c="dimmed" fz={9}>
                              UQ
                            </Text>
                          )}
                          <Text ff="monospace" size="xs" fw={c.pk ? 600 : 400}>
                            {c.dbName}
                          </Text>
                        </Group>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="xs" c="dimmed">
                        {c.type}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c={c.notNull ? 'dimmed' : undefined}>
                        {c.notNull ? 'tidak' : 'ya'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="xs" c="dimmed">
                        {defaultLabel(c)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Section>
          <Divider />

          <Section title="Relasi">
            {outgoing.length === 0 && incoming.length === 0 && (
              <Text size="sm" c="dimmed">
                Tabel ini berdiri sendiri.
              </Text>
            )}
            {outgoing.map((e) => (
              <Field key={e.id} label={e.sourceColumn}>
                <Text size="sm">
                  →{' '}
                  <Anchor size="sm" onClick={() => onSelect(e.target)}>
                    {e.target}
                  </Anchor>
                  .{e.targetColumn} · on delete {onDeleteLabel(e.onDelete)}
                </Text>
              </Field>
            ))}
            {incoming.map((e) => (
              <Field key={e.id} label={`← ${e.targetColumn}`}>
                <Text size="sm">
                  <Anchor size="sm" onClick={() => onSelect(e.source)}>
                    {e.source}
                  </Anchor>
                  .{e.sourceColumn} · on delete {onDeleteLabel(e.onDelete)}
                </Text>
              </Field>
            ))}
          </Section>
          <Divider />

          <Section title="Index">
            {table.indexes.length === 0 ? (
              <Text size="sm" c="dimmed">
                Hanya primary key. Pertimbangkan index untuk kolom yang sering difilter atau
                diurutkan.
              </Text>
            ) : (
              table.indexes.map((ix) => (
                <Field key={ix.name} label={ix.unique ? 'unique' : 'btree'}>
                  <Text ff="monospace" size="xs">
                    {ix.name} ({ix.columns.join(', ')})
                  </Text>
                </Field>
              ))
            )}
          </Section>
        </Stack>
      )}
    </Drawer>
  );
}
