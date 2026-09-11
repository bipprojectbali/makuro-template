import { describe, expect, test } from 'bun:test';
import { introspectDrizzleSchema } from '../../server/db/schema-introspect';

describe('introspectDrizzleSchema', () => {
  const result = introspectDrizzleSchema();

  test('returns all expected tables', () => {
    const names = result.tables.map((t) => t.name);
    expect(names).toContain('user');
    expect(names).toContain('session');
    expect(names).toContain('account');
    expect(names).toContain('post');
    expect(names).toContain('verification');
  });

  test('user table has expected columns', () => {
    const user = result.tables.find((t) => t.name === 'user');
    expect(user).toBeDefined();
    const colNames = user?.columns.map((c) => c.dbName);
    expect(colNames).toContain('id');
    expect(colNames).toContain('email');
    expect(colNames).toContain('role');
  });

  test('user.id is primary key', () => {
    const user = result.tables.find((t) => t.name === 'user');
    const idCol = user?.columns.find((c) => c.dbName === 'id');
    expect(idCol?.pk).toBe(true);
  });

  test('post table has author_id FK to user.id', () => {
    const postEdge = result.edges.find((e) => e.source === 'post' && e.target === 'user');
    expect(postEdge).toBeDefined();
    expect(postEdge?.sourceColumn).toBe('author_id');
    expect(postEdge?.targetColumn).toBe('id');
  });

  test('session table has FK to user', () => {
    const sessionEdge = result.edges.find((e) => e.source === 'session' && e.target === 'user');
    expect(sessionEdge).toBeDefined();
  });

  test('account table has FK to user', () => {
    const accountEdge = result.edges.find((e) => e.source === 'account' && e.target === 'user');
    expect(accountEdge).toBeDefined();
  });

  test('edge ids are unique (no duplicates)', () => {
    const ids = result.edges.map((e) => e.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test('each table has at least one column', () => {
    for (const table of result.tables) {
      expect(table.columns.length).toBeGreaterThan(0);
    }
  });

  test('FK columns reference correct fkTable/fkColumn', () => {
    const post = result.tables.find((t) => t.name === 'post');
    const authorCol = post?.columns.find((c) => c.dbName === 'author_id');
    expect(authorCol?.fkTable).toBe('user');
    expect(authorCol?.fkColumn).toBe('id');
  });
});
