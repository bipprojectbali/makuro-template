/** Shared pagination helpers for the analytics list endpoints. */
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

/** Parse page/limit/sort query params into clamped offset pagination. */
export function pageParams(query: { page?: string; limit?: string; sort?: string }) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(Number(query.limit ?? PAGE_SIZE), MAX_PAGE_SIZE);
  const order = query.sort === 'asc' ? asc : desc;
  return { page, limit, offset: (page - 1) * limit, order };
}
