/** Post queries shared by the public API, the content console and SSR loaders. */
import { and, desc, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { post, user } from '../db/schema';

export const PostListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  search: t.Optional(t.String()),
  authorId: t.Optional(t.String()),
  days: t.Optional(t.String()),
  /** 'newest' (default) | 'oldest' | 'updated' | 'title' */
  sort: t.Optional(t.String()),
});
export type PostListQueryType = typeof PostListQuery.static;

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_DAYS = 365;
export const TITLE_MAX = 200;
export const CONTENT_MAX = 20_000;
const count = sql<number>`count(*)::int`;

export const postSelect = {
  id: post.id,
  title: post.title,
  content: post.content,
  authorId: post.authorId,
  authorName: user.name,
  authorEmail: user.email,
  authorImage: user.image,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
};

export function buildPostWhere(q: PostListQueryType): SQL | undefined {
  const search = q.search?.trim();
  const days = q.days ? Math.min(Math.max(0, Number(q.days) || 0), MAX_DAYS) : 0;
  return and(
    q.authorId ? eq(post.authorId, q.authorId) : undefined,
    days > 0 ? gte(post.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined,
    search
      ? or(
          ilike(post.title, `%${search}%`),
          ilike(post.content, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
        )
      : undefined,
  );
}

function orderFor(sort: string | undefined) {
  switch (sort) {
    case 'oldest':
      return post.createdAt;
    case 'updated':
      return desc(post.updatedAt);
    case 'title':
      return post.title;
    default:
      return desc(post.createdAt);
  }
}

export async function listPosts(q: PostListQueryType) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(q.limit ?? PAGE_SIZE) || PAGE_SIZE), MAX_PAGE_SIZE);
  const where = buildPostWhere(q);
  const [rows, [totals]] = await Promise.all([
    db
      .select(postSelect)
      .from(post)
      .leftJoin(user, eq(post.authorId, user.id))
      .where(where)
      .orderBy(orderFor(q.sort))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count }).from(post).leftJoin(user, eq(post.authorId, user.id)).where(where),
  ]);
  return { rows, total: totals?.count ?? 0, page, limit };
}

export async function getPost(id: string) {
  const [row] = await db
    .select(postSelect)
    .from(post)
    .leftJoin(user, eq(post.authorId, user.id))
    .where(eq(post.id, id))
    .limit(1);
  return row ?? null;
}

export async function postStats() {
  const [[totals], authors] = await Promise.all([
    db
      .select({
        total: count,
        last7d: sql<number>`count(*) filter (where ${post.createdAt} >= now() - interval '7 days')::int`,
        last30d: sql<number>`count(*) filter (where ${post.createdAt} >= now() - interval '30 days')::int`,
        authors: sql<number>`count(distinct ${post.authorId})::int`,
        edited: sql<number>`count(*) filter (where ${post.updatedAt} > ${post.createdAt} + interval '1 minute')::int`,
      })
      .from(post),
    db
      .select({ authorId: post.authorId, name: user.name, image: user.image, count })
      .from(post)
      .leftJoin(user, eq(post.authorId, user.id))
      .groupBy(post.authorId, user.name, user.image)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
  ]);
  return {
    total: totals?.total ?? 0,
    last7d: totals?.last7d ?? 0,
    last30d: totals?.last30d ?? 0,
    authors: totals?.authors ?? 0,
    edited: totals?.edited ?? 0,
    topAuthors: authors,
  };
}
