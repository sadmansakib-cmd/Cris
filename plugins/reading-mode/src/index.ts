import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Reading Mode — Reader-view extraction for any URL.
 * Phase 3 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.reading-mode',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.reading-mode' }));
    // Permission gate: net.fetch url:* — Fetch article
    ctx.log.info('Reading Mode plugin activated');
  },
  async deactivate() {},
});
