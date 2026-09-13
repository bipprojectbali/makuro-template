/** Build/runtime facts shown in the console shell (version from package.json, environment). */
import pkg from '../package.json' with { type: 'json' };
import { env } from './env';

export const APP_VERSION: string = pkg.version;

export function frameInfo(): { env: string; version: string } {
  return { env: env.NODE_ENV, version: APP_VERSION };
}
