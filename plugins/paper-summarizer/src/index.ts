import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Paper Summarizer — Extract structured summaries from PDFs.
 * Phase 5 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.paper-summarizer',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.paper-summarizer' }));
    // Permission gate: ai.chat.completion * — Summarize
    // Permission gate: storage.read namespace:papers/* — Read PDFs
    ctx.log.info('Paper Summarizer plugin activated');
  },
  async deactivate() {},
});
