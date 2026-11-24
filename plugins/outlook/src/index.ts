import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Outlook — Microsoft Graph mail integration.
 * Phase 4 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.outlook',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.outlook' }));
    // Permission gate: oauth.token.read provider:microsoft — Use MS session
    // Permission gate: net.fetch host:graph.microsoft.com — Call Graph
    ctx.log.info('Outlook plugin activated');
  },
  async deactivate() {},
});
