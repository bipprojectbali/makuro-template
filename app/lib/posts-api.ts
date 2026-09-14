/** Client for /api/posts used by /dev/posts. */

export type PostRow = {
  id: string;
  title: string;
  content: string | null;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PostStats = {
  total: number;
  last7d: number;
  last30d: number;
  authors: number;
  edited: number;
  topAuthors: Array<{ authorId: string; name: string | null; image: string | null; count: number }>;
};
export type PostFilters = {
  search: string;
  authorId: string | null;
  period: '7' | '30' | 'all';
  sort: 'newest' | 'oldest' | 'updated' | 'title';
};
export const DEFAULT_POST_FILTERS: PostFilters = {
  search: '',
  authorId: null,
  period: 'all',
  sort: 'newest',
};
export type PostListParams = PostFilters & { page: number; limit: number };
export type PostListResponse = { rows: PostRow[]; total: number; page: number; limit: number };
export type PostInput = { title: string; content: string | null };

const BASE = '/api/posts';

export function buildPostQuery(p: Partial<PostListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.authorId) q.set('authorId', p.authorId);
  if (p.period && p.period !== 'all') q.set('days', p.period);
  if (p.sort && p.sort !== 'newest') q.set('sort', p.sort);
  return q;
}
export function hasActivePostFilters(f: PostFilters): boolean {
  return f.search.trim() !== '' || f.authorId !== null || f.period !== 'all' || f.sort !== 'newest';
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${init?.method ?? 'GET'} ${url} gagal (${res.status})`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b?.error) message = b.error;
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }
  return res.json();
}
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchPosts = (p: PostListParams) =>
  request<PostListResponse>(`${BASE}?${buildPostQuery(p)}`);
export const fetchPostStats = () => request<PostStats>(`${BASE}/stats`);
export const createPost = (input: PostInput) => request<PostRow>(BASE, json('POST', input));
export const updatePost = (id: string, input: PostInput) =>
  request<PostRow>(`${BASE}/${encodeURIComponent(id)}`, json('PUT', input));
export const deletePost = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, json('DELETE'));

/** First ~N chars of content as a single line for tables. */
export function excerpt(content: string | null, max = 120): string {
  if (!content) return '';
  const line = content.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
