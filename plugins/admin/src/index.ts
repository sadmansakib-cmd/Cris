import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Admin — Logs, analytics, errors, API usage, sessions.
 * Phase 15 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.admin',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.admin' }));
    // Permission gate: admin.* * — Full admin surface
    ctx.log.info('Admin plugin activated');
  },
  async deactivate() {},
});
