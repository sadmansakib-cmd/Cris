import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Literature Review — AI-assisted systematic literature reviews.
 * Phase 5 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.lit-review',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.lit-review' }));
    // Permission gate: ai.chat.completion * — Analyze
    ctx.log.info('Literature Review plugin activated');
  },
  async deactivate() {},
});
