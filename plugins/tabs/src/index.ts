import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Tabs — Multi-tab session management.
 * Phase 3 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.tabs',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.tabs' }));
    // Permission gate: browser.tabs session:* — Manage tabs
    ctx.log.info('Tabs plugin activated');
  },
  async deactivate() {},
});
