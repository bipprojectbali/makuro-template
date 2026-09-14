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

describe('introspection enrichment', () => {
  const g = introspectDrizzleSchema();
  const user = g.tables.find((t) => t.id === 'user');
  const visit = g.tables.find((t) => t.id === 'visit_log');
  const post = g.tables.find((t) => t.id === 'post');

  test('exposes unique columns, defaults and their kind', () => {
    const email = user?.columns.find((c) => c.dbName === 'email');
    expect(email?.unique).toBe(true);
    const banned = user?.columns.find((c) => c.dbName === 'banned');
    expect(banned).toMatchObject({ defaultKind: 'literal', defaultText: 'false' });
    const createdAt = user?.columns.find((c) => c.dbName === 'created_at');
    expect(createdAt?.defaultKind).toBe('fn');
    const visitCreated = visit?.columns.find((c) => c.dbName === 'created_at');
    expect(visitCreated?.defaultKind).toBe('sql');
    expect(visitCreated?.defaultText).toContain('now()');
  });

  test('lists indexes with columns and uniqueness', () => {
    expect(visit?.indexes.map((i) => i.name)).toContain('visit_log_country_idx');
    expect(visit?.indexes.find((i) => i.name === 'visit_log_ip_idx')?.columns).toEqual(['ip']);
    expect(visit?.indexes.every((i) => i.unique === false)).toBe(true);
  });

  test('foreign keys carry onDelete on both column and edge', () => {
    const author = post?.columns.find((c) => c.dbName === 'author_id');
    expect(author?.onDelete).toBe('cascade');
    const edge = g.edges.find((e) => e.source === 'post' && e.sourceColumn === 'author_id');
    expect(edge?.onDelete).toBe('cascade');
    const visitUser = g.edges.find((e) => e.source === 'visit_log');
    expect(visitUser?.onDelete).toBe('set null');
  });
});
