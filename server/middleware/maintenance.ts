/** Elysia plugin: 503 JSON for /api while maintenance mode blocks the caller. Register after rate limiting. */
import { Elysia } from 'elysia';
import { getBranding } from '../settings-branding';
import { maintenanceGate } from '../settings-maintenance';

export function maintenancePlugin() {
  return new Elysia({ name: 'maintenance' }).onBeforeHandle(
    { as: 'global' },
    async ({ request }) => {
      const blocked = await maintenanceGate(request, (await getBranding()).appName);
      if (blocked) return blocked;
    },
  );
}
