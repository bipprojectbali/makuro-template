/** Form state for the API key create/edit modal, kept apart from the JSX. */
import type { ApiKeyRow } from '~/lib/api-keys-api';

export const WINDOWS = [
  { value: '60000', label: 'per menit' },
  { value: '600000', label: 'per 10 menit' },
  { value: '3600000', label: 'per jam' },
  { value: '86400000', label: 'per hari' },
];
export const DEFAULT_EXPIRY = '90';
export const DEFAULT_RATE_MAX = 600;
export const DEFAULT_WINDOW = '60000';

export type Draft = {
  name: string;
  ownerId: string | null;
  ownerRole: string | null;
  scopes: string[];
  expiry: string;
  rateLimited: boolean;
  rateMax: number;
  window: string;
  ips: string[];
  note: string;
};
export const EMPTY_DRAFT: Draft = {
  name: '',
  ownerId: null,
  ownerRole: null,
  scopes: [],
  expiry: DEFAULT_EXPIRY,
  rateLimited: false,
  rateMax: DEFAULT_RATE_MAX,
  window: DEFAULT_WINDOW,
  ips: [],
  note: '',
};

export function draftFromRow(row: ApiKeyRow): Draft {
  return {
    name: row.name ?? '',
    ownerId: row.ownerId,
    ownerRole: row.ownerRole,
    scopes: row.scopes,
    expiry: 'keep',
    rateLimited: Boolean(row.rateLimitMax),
    rateMax: row.rateLimitMax ?? DEFAULT_RATE_MAX,
    window: String(row.rateLimitTimeWindow ?? DEFAULT_WINDOW),
    ips: row.allowedIps ? row.allowedIps.split('\n').filter(Boolean) : [],
    note: row.note ?? '',
  };
}
