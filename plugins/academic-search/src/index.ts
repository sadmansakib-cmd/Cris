import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Academic Search — Search arXiv, Semantic Scholar, PubMed.
 * Phase 5 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.academic-search',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.academic-search' }));
    // Permission gate: net.fetch host:api.semanticscholar.org — Search papers
    ctx.log.info('Academic Search plugin activated');
  },
  async deactivate() {},
});
