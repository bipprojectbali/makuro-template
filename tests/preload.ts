/** Test preload (bunfig.toml): force test mode, a dedicated database and a `-test` bucket before any test imports `server/env`. */
import { afterAll } from 'bun:test';
import { prepareTestDb } from '../server/local-pg/test-db';
import { stopLocalS3 } from '../server/local-s3/server';
import { prepareTestStorage } from '../server/local-s3/test-storage';

process.env.NODE_ENV = 'test';
await prepareTestDb();
await prepareTestStorage();
// bun test fires no 'exit' event, so boot's exit hook cannot stop a RustFS this run started; a reused one is untouched.
afterAll(() => stopLocalS3());
