import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * AI Q&A — RAG-powered Q&A over your knowledge base.
 * Phase 5 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.ai-qa',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.ai-qa' }));
    // Permission gate: ai.chat.completion * — Answer
    // Permission gate: vector.query * — Retrieve
    ctx.log.info('AI Q&A plugin activated');
  },
  async deactivate() {},
});
