/**
 * Drizzle schema entry point. Tables are grouped by concern in sibling files;
 * this module re-exports them so `import * as schema from './schema'` keeps
 * working for the Better Auth adapter, introspection and every query module.
 */
export * from './schema.app';
export * from './schema.auth';
export * from './schema.logs';
