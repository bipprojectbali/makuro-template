import {
  Alert,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { DEFAULT_USER_FILTERS, fetchUsers } from '~/lib/admin-users-api';
import {
  type ApiKeyInput,
  type ApiKeyPatch,
  EXPIRY_OPTIONS,
  type KeyClient,
  type ScopeDef,
} from '~/lib/api-keys-api';
import {
  DEFAULT_EXPIRY,
  DEFAULT_WINDOW,
  type Draft,
  draftFromRow,
  EMPTY_DRAFT,
  WINDOWS,
} from './api-key-form.model';
import { ScopePicker } from './ScopePicker';
import type { FormState, Reveal } from './useApiKeyActions';

type Props = {
  state: FormState | null;
  scopes: ScopeDef[];
  client: KeyClient;
  /** Personal mode: the caller is the owner, so there is no owner picker. */
  self?: { ownerRole: string | null };
  onClose: () => void;
  onCreated: (r: Reveal) => void;
  onSaved: () => Promise<unknown>;
};

/** Create (reveal once afterwards) or edit an API key. Owner is fixed after creation. */
export function ApiKeyFormModal({
  state,
  scopes,
  client,
  self,
  onClose,
  onCreated,
  onSaved,
}: Props) {
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [debounced] = useDebouncedValue(ownerSearch, 250);
  const edit = state?.mode === 'edit' ? state.row : null;
  const isSelf = Boolean(self);
  const selfRole = self?.ownerRole ?? null;
  useEffect(() => {
    if (!state) return;
    if (state.mode === 'edit') setD(draftFromRow(state.row));
    else
      setD({
        ...EMPTY_DRAFT,
        ownerId: isSelf ? 'me' : null,
        ownerRole: selfRole,
        name: state.preset?.name ?? '',
        scopes: state.preset?.scopes ?? [],
      });
    setOwnerSearch('');
  }, [state, isSelf, selfRole]);
  const owners = useQuery({
    queryKey: ['api-key-owner-search', debounced],
    queryFn: () => fetchUsers({ ...DEFAULT_USER_FILTERS, search: debounced, page: 1, limit: 10 }),
    enabled: state?.mode === 'create' && !self,
    staleTime: 30_000,
  });
  const ownerOptions = (owners.data?.users ?? []).map((u) => ({
    value: u.id,
    label: `${u.name} · ${u.email} (${u.role ?? 'user'})`,
  }));
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const isSuper = d.ownerRole === 'super-admin';
  const expiryOptions = [
    ...(edit ? [{ value: 'keep', label: 'Tidak diubah' }] : []),
    ...EXPIRY_OPTIONS.map((o) => ({ ...o, disabled: o.value === 'never' && !isSuper })),
  ];
  const expiresDays = d.expiry === 'never' ? null : Number(d.expiry);
  const common = {
    name: d.name.trim(),
    scopes: d.scopes,
    rateLimitMax: d.rateLimited ? d.rateMax : null,
    rateLimitWindowMs: d.rateLimited ? Number(d.window) : null,
    allowedIps: d.ips.length ? d.ips : null,
    note: d.note.trim() || null,
  };
  const fail = (e: Error) =>
    notifications.show({ color: 'red', title: 'Gagal menyimpan kunci', message: e.message });
  const create = useMutation({
    mutationFn: (input: ApiKeyInput) => client.create(input),
    onSuccess: async (r) => {
      await onSaved();
      onClose();
      onCreated({ key: r.key, row: r.row });
    },
    onError: fail,
  });
  const save = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ApiKeyPatch }) => client.update(id, patch),
    onSuccess: async () => {
      await onSaved();
      onClose();
      notifications.show({ color: 'teal', message: 'Kunci diperbarui.' });
    },
    onError: fail,
  });
  const valid = d.name.trim().length >= 2 && d.scopes.length > 0 && (edit || d.ownerId);
  const submit = () => {
    if (!valid) return;
    if (edit) {
      const patch: ApiKeyPatch = { ...common };
      if (d.expiry !== 'keep') patch.expiresDays = expiresDays;
      return save.mutate({ id: edit.id, patch });
    }
    create.mutate({ ...common, ownerId: d.ownerId as string, expiresDays });
  };
  const pending = create.isPending || save.isPending;

  return (
    <Modal
      opened={state !== null}
      onClose={onClose}
      title={edit ? `Edit kunci "${edit.name}"` : 'Buat API key'}
      size="lg"
      padding="md"
    >
      <Stack gap="md">
        <TextInput
          label="Nama"
          placeholder="mis. CI deploy, Zapier, dashboard-eksternal"
          description="Untuk mengenali kunci ini di daftar dan audit log"
          value={d.name}
          onChange={(e) => set({ name: e.currentTarget.value })}
          maxLength={60}
          required
          data-autofocus
        />
        {edit ? (
          <Text size="sm" c="dimmed">
            Pemilik: <strong>{edit.ownerEmail ?? edit.ownerId}</strong> ({edit.ownerRole ?? 'user'})
            — tidak bisa diubah setelah dibuat.
          </Text>
        ) : self ? (
          <Text size="sm" c="dimmed">
            Kunci ini bertindak atas nama akun Anda (role {self.ownerRole ?? 'user'}).
          </Text>
        ) : (
          <Select
            label="Pemilik"
            description="Kunci bertindak atas nama user ini; scope dibatasi oleh role-nya"
            placeholder="Cari nama atau email…"
            searchable
            clearable
            nothingFoundMessage={owners.isFetching ? 'Mencari…' : 'User tidak ditemukan'}
            searchValue={ownerSearch}
            onSearchChange={setOwnerSearch}
            data={ownerOptions}
            value={d.ownerId}
            onChange={(v) => {
              const u = owners.data?.users.find((x) => x.id === v);
              set({
                ownerId: v,
                ownerRole: u?.role ?? null,
                scopes: [],
                expiry: DEFAULT_EXPIRY,
              });
            }}
            required
          />
        )}
        <Divider />
        <ScopePicker
          scopes={scopes}
          value={d.scopes}
          onChange={(scopes) => set({ scopes })}
          ownerRole={d.ownerRole}
        />
        <Divider />
        <Select
          label="Kedaluwarsa"
          description={
            edit
              ? 'Memilih durasi menghitung ulang tanggal berakhir dari sekarang'
              : 'Kunci tanpa kedaluwarsa hanya untuk pemilik super-admin'
          }
          data={expiryOptions}
          value={d.expiry}
          onChange={(v) => set({ expiry: v ?? DEFAULT_EXPIRY })}
          allowDeselect={false}
        />
        <Stack gap="xs">
          <Switch
            label="Batas request khusus untuk kunci ini"
            description="Selain rate limit global per IP. Lewat batas → 429."
            checked={d.rateLimited}
            onChange={(e) => set({ rateLimited: e.currentTarget.checked })}
          />
          {d.rateLimited && (
            <Group gap="xs" wrap="wrap">
              <NumberInput
                w={{ base: '100%', sm: 160 }}
                min={1}
                max={1_000_000}
                allowDecimal={false}
                value={d.rateMax}
                onChange={(v) => set({ rateMax: Number(v) || 1 })}
                inputMode="numeric"
                aria-label="Maksimum request"
                suffix=" req"
              />
              <Select
                w={{ base: '100%', sm: 160 }}
                data={WINDOWS}
                value={d.window}
                onChange={(v) => set({ window: v ?? DEFAULT_WINDOW })}
                allowDeselect={false}
                aria-label="Jendela waktu"
              />
            </Group>
          )}
        </Stack>
        <TagsInput
          label="IP yang diizinkan"
          description="Kosongkan untuk semua IP. Akhiri dengan titik/titik dua untuk prefix, mis. 10.0. atau 2001:db8:"
          placeholder="Ketik IP lalu Enter"
          value={d.ips}
          onChange={(ips) => set({ ips })}
          maxTags={50}
          splitChars={[',', ' ']}
        />
        <Textarea
          label="Catatan"
          placeholder="Untuk apa kunci ini, siapa yang memegang, tiket terkait…"
          value={d.note}
          onChange={(e) => set({ note: e.currentTarget.value })}
          maxLength={500}
          autosize
          minRows={2}
        />
        {!edit && (
          <Alert color="blue" icon={<FiAlertCircle size={16} />} variant="light">
            Kunci hanya ditampilkan sekali setelah dibuat. Siapkan tempat menyimpannya.
          </Alert>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button onClick={submit} loading={pending} disabled={!valid}>
            {edit ? 'Simpan perubahan' : 'Buat kunci'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
