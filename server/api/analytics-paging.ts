/** Shared pagination helpers for the console list endpoints. */
import { asc, desc } from 'drizzle-orm';
import { t } from 'elysia';

export const PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const ListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  /** 'asc' | 'desc' — default desc (newest first) */
  sort: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

/** Positive integer from a query string; anything else (NaN, ≤0, fractional junk) → fallback. */
const positiveInt = (raw: string | undefined, fallback: number) => {
  const n = Math.trunc(Number(raw));
  return n >= 1 ? n : fallback;
};

/** Clamped offset pagination from raw `page`/`limit` query strings. */
export function parsePaging(
  query: { page?: string; limit?: string },
  defaultLimit = PAGE_SIZE,
  maxLimit = MAX_PAGE_SIZE,
) {
  const page = positiveInt(query.page, 1);
  const limit = Math.min(positiveInt(query.limit, defaultLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

/** parsePaging plus the `sort` direction used by the analytics lists. */
export function pageParams(query: { page?: string; limit?: string; sort?: string }) {
  return { ...parsePaging(query), order: query.sort === 'asc' ? asc : desc };
}
