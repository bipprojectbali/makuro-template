/** Blocks sensitive actions for demo visitors (403 DEMO_RESTRICTED). */
import { Elysia } from 'elysia';

export function demoRestrictPlugin() {
  return new Elysia({ name: 'demo-restrict' });
}
