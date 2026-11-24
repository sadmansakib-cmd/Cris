import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Summaries — YouTube + website summarization.
 * Phase 3 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.summaries',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.summaries' }));
    // Permission gate: ai.chat.completion * — Summarize
    // Permission gate: net.fetch url:* — Fetch transcript/page
    ctx.log.info('Summaries plugin activated');
  },
  async deactivate() {},
});
