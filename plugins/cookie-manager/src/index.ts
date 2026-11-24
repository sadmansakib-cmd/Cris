import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Cookie Manager — Inspect, export, and clear browser cookies per site.
 * Phase 3 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.cookie-manager',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.cookie-manager' }));
    // Permission gate: browser.cookies domain:* — Read/write cookies
    ctx.log.info('Cookie Manager plugin activated');
  },
  async deactivate() {},
});
