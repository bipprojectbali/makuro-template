/** GET /api/version — public build identity, same source as the sidebar (package.json). */
import { Elysia } from 'elysia';
import { versionInfo } from '../app-info';

export const versionApi = new Elysia().get('/version', () => versionInfo());
