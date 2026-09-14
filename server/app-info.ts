/** Build/runtime facts shown in the console shell (version from package.json, environment). */
import pkg from '../package.json' with { type: 'json' };
import { env } from './env';
import { type Branding, getBranding } from './settings-branding';
import { getMaintenance } from './settings-maintenance';

export const APP_VERSION: string = pkg.version;

export type FrameInfo = { env: string; version: string; branding: Branding; maintenance: boolean };

/** Shell facts for every layout loader: environment, version, branding, maintenance state. */
export async function frameInfo(): Promise<FrameInfo> {
  const [branding, maintenance] = await Promise.all([getBranding(), getMaintenance()]);
  return { env: env.NODE_ENV, version: APP_VERSION, branding, maintenance: maintenance.enabled };
}
