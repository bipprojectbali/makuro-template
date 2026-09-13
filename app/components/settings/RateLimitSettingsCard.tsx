import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  TagsInput,
  Text,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiRotateCcw, FiShield } from 'react-icons/fi';
import { formatWindow } from '~/lib/rate-limit-logs-api';
import {
  type RateLimitSettings,
  resetRateLimitSettings,
  type SettingsOverview,
  sameRateLimit,
  saveRateLimitSettings,
} from '~/lib/settings-api';
import { OverrideBadge, SettingRow, SettingsCard } from './SettingsParts';

type Props = { initial: RateLimitSettings; rateLimit: SettingsOverview['rateLimit'] };

const nf = new Intl.NumberFormat('id-ID');
const MAX_RATE = 100_000;
const MIN_WINDOW_S = 1;
const MAX_WINDOW_S = 24 * 3600;

function ResetField({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Tooltip label="Pakai nilai default" withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        aria-label="Pakai nilai default"
      >
        <FiRotateCcw size={13} />
      </ActionIcon>
    </Tooltip>
  );
}

/** Rate-limit overrides with per-field defaults, live effective summary, and reset-all. */
export function RateLimitSettingsCard({ initial, rateLimit }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RateLimitSettings>(initial);
  useEffect(() => setForm(initial), [initial]);
  const { defaults } = rateLimit;
  const dirty = !sameRateLimit(form, initial);
  const effective = {
    limit: form.rateLimitMax ?? defaults.max,
    windowMs: form.rateLimitWindowMs ?? defaults.windowMs,
    prefixes: form.rateLimitExcludePrefixes ?? defaults.excludePrefixes,
  };
  const anyOverride =
    form.rateLimitMax !== null ||
    form.rateLimitWindowMs !== null ||
    form.rateLimitExcludePrefixes !== null;
  const invalidPrefix = (form.rateLimitExcludePrefixes ?? []).find((p) => !p.startsWith('/'));

  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ['settings-overview'] });
    qc.invalidateQueries({ queryKey: ['rate-limit-logs-stats'] });
    notifications.show({ color: 'teal', message });
  };
  const fail = (e: Error) =>
    notifications.show({ color: 'red', title: 'Gagal menyimpan rate limit', message: e.message });
  const save = useMutation({
    mutationFn: saveRateLimitSettings,
    onSuccess: () => done('Rate limit disimpan dan langsung berlaku.'),
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: resetRateLimitSettings,
    onSuccess: () => done('Rate limit dikembalikan ke default.'),
    onError: fail,
  });

  const submit = () => {
    if (!form.rateLimitEnabled && initial.rateLimitEnabled) {
      modals.openConfirmModal({
        title: 'Matikan rate limiting?',
        children: (
          <Text size="sm">
            Semua endpoint <code>/api/*</code> bisa dipanggil tanpa batas dari IP mana pun. Ini
            membuka celah brute-force dan beban berlebih. Gunakan hanya untuk debugging singkat.
          </Text>
        ),
        labels: { confirm: 'Matikan rate limiting', cancel: 'Batal' },
        confirmProps: { color: 'red' },
        onConfirm: () => save.mutate(form),
      });
      return;
    }
    save.mutate(form);
  };

  const confirmReset = () =>
    modals.openConfirmModal({
      title: 'Kembalikan rate limit ke default?',
      children: (
        <Text size="sm">
          Batas menjadi {nf.format(defaults.max)} request per {formatWindow(defaults.windowMs)},
          pengecualian default, dan rate limiting diaktifkan kembali.
        </Text>
      ),
      labels: { confirm: 'Kembalikan ke default', cancel: 'Batal' },
      onConfirm: () => reset.mutate(),
    });

  return (
    <SettingsCard
      title="Rate limiting API"
      description="Batas request per IP klien dengan jendela geser. Perubahan berlaku seketika tanpa restart."
      aside={
        <Badge
          variant="light"
          color={form.rateLimitEnabled ? 'teal' : 'red'}
          leftSection={<FiShield size={11} />}
        >
          {form.rateLimitEnabled
            ? `${nf.format(effective.limit)} / ${formatWindow(effective.windowMs)} per IP`
            : 'Nonaktif'}
        </Badge>
      }
    >
      {!form.rateLimitEnabled && (
        <Alert color="red" variant="light" title="Rate limiting nonaktif">
          API tidak dibatasi. Aktifkan kembali segera setelah debugging selesai.
        </Alert>
      )}
      <SettingRow
        label="Aktifkan rate limiting"
        description="Tolak request dengan 429 + Retry-After saat sebuah IP melewati batas."
        control={
          <Switch
            size="md"
            checked={form.rateLimitEnabled}
            onChange={(e) => setForm({ ...form, rateLimitEnabled: e.currentTarget.checked })}
            aria-label="Aktifkan rate limiting"
          />
        }
      />
      <SettingRow
        label="Maksimum request"
        description={`Jumlah request yang diizinkan per IP dalam satu jendela. Default ${nf.format(defaults.max)} (env RATE_LIMIT_MAX).`}
        badge={<OverrideBadge overridden={form.rateLimitMax !== null} />}
        control={
          <Group gap={4} wrap="nowrap">
            <NumberInput
              size="sm"
              w={140}
              min={1}
              max={MAX_RATE}
              step={10}
              allowDecimal={false}
              placeholder={String(defaults.max)}
              value={form.rateLimitMax ?? ''}
              onChange={(v) => setForm({ ...form, rateLimitMax: v === '' ? null : Number(v) })}
              disabled={!form.rateLimitEnabled}
              inputMode="numeric"
              aria-label="Maksimum request"
            />
            <ResetField
              onClick={() => setForm({ ...form, rateLimitMax: null })}
              disabled={form.rateLimitMax === null}
            />
          </Group>
        }
      />
      <SettingRow
        label="Jendela waktu (detik)"
        description={`Lama jendela geser. Default ${formatWindow(defaults.windowMs)} (env RATE_LIMIT_WINDOW_MS).`}
        badge={<OverrideBadge overridden={form.rateLimitWindowMs !== null} />}
        control={
          <Group gap={4} wrap="nowrap">
            <NumberInput
              size="sm"
              w={140}
              min={MIN_WINDOW_S}
              max={MAX_WINDOW_S}
              step={10}
              allowDecimal={false}
              placeholder={String(defaults.windowMs / 1000)}
              value={form.rateLimitWindowMs === null ? '' : form.rateLimitWindowMs / 1000}
              onChange={(v) =>
                setForm({
                  ...form,
                  rateLimitWindowMs: v === '' ? null : Math.round(Number(v) * 1000),
                })
              }
              disabled={!form.rateLimitEnabled}
              inputMode="numeric"
              aria-label="Jendela waktu dalam detik"
            />
            <ResetField
              onClick={() => setForm({ ...form, rateLimitWindowMs: null })}
              disabled={form.rateLimitWindowMs === null}
            />
          </Group>
        }
      />
      <Stack gap={6}>
        <Group gap="xs" wrap="wrap" justify="space-between">
          <Group gap="xs">
            <Text fw={500}>Path yang dikecualikan</Text>
            <OverrideBadge overridden={form.rateLimitExcludePrefixes !== null} />
          </Group>
          <ResetField
            onClick={() => setForm({ ...form, rateLimitExcludePrefixes: null })}
            disabled={form.rateLimitExcludePrefixes === null}
          />
        </Group>
        <Text size="sm" c="dimmed">
          Prefix path yang tidak pernah dibatasi. Default: {defaults.excludePrefixes.join(', ')}{' '}
          (Better Auth dan MCP punya proteksi sendiri). Tekan Enter untuk menambah.
        </Text>
        <TagsInput
          size="sm"
          value={form.rateLimitExcludePrefixes ?? defaults.excludePrefixes}
          onChange={(v) => setForm({ ...form, rateLimitExcludePrefixes: v })}
          placeholder="/api/health"
          splitChars={[',', ' ']}
          disabled={!form.rateLimitEnabled}
          error={invalidPrefix ? `"${invalidPrefix}" harus diawali "/"` : undefined}
          aria-label="Path yang dikecualikan"
        />
      </Stack>
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text size="sm" c="dimmed">
          Efektif:{' '}
          {form.rateLimitEnabled
            ? `${nf.format(effective.limit)} request / ${formatWindow(effective.windowMs)} per IP · ${effective.prefixes.length} pengecualian`
            : 'tidak ada batas'}
        </Text>
        <Group gap="xs">
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            onClick={confirmReset}
            loading={reset.isPending}
            disabled={!anyOverride && initial.rateLimitEnabled && !dirty}
          >
            Kembalikan ke default
          </Button>
          {dirty && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setForm(initial)}
              disabled={save.isPending}
            >
              Batalkan
            </Button>
          )}
          <Button
            size="sm"
            onClick={submit}
            loading={save.isPending}
            disabled={!dirty || Boolean(invalidPrefix)}
          >
            Simpan rate limit
          </Button>
        </Group>
      </Group>
    </SettingsCard>
  );
}
