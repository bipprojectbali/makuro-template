import { describe, expect, it } from 'bun:test';
import {
  buildPostQuery,
  DEFAULT_POST_FILTERS,
  excerpt,
  hasActivePostFilters,
} from '../app/lib/posts-api';

describe('posts-api helpers', () => {
  it('buildPostQuery and hasActivePostFilters', () => {
    expect(buildPostQuery({ ...DEFAULT_POST_FILTERS, page: 1, limit: 25 }).toString()).toBe(
      'page=1&limit=25',
    );
    expect(
      buildPostQuery({ ...DEFAULT_POST_FILTERS, sort: 'title', period: '7', authorId: 'a' }).get(
        'sort',
      ),
    ).toBe('title');
    expect(hasActivePostFilters(DEFAULT_POST_FILTERS)).toBe(false);
    expect(hasActivePostFilters({ ...DEFAULT_POST_FILTERS, authorId: 'a' })).toBe(true);
  });
  it('excerpt collapses whitespace and truncates', () => {
    expect(excerpt('a\n\n b   c')).toBe('a b c');
    expect(excerpt('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(excerpt(null)).toBe('');
  });
});
