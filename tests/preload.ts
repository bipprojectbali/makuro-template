/** Test preload (bunfig.toml): force test mode and a dedicated database before any test imports `server/env`. */
import { prepareTestDb } from '../server/local-pg/test-db';

process.env.NODE_ENV = 'test';
await prepareTestDb();
