import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Quick Notes — Lightweight sticky notes.
 * Phase 7 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.notes-prod',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.notes-prod' }));
    // Permission gate: storage.write namespace:quick-notes/* — Store notes
    ctx.log.info('Quick Notes plugin activated');
  },
  async deactivate() {},
});
