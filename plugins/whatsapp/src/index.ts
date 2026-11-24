import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * WhatsApp — WhatsApp Business Cloud API.
 * Phase 4 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.whatsapp',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.whatsapp' }));
    // Permission gate: secret.read key:whatsapp.* — Use API token
    ctx.log.info('WhatsApp plugin activated');
  },
  async deactivate() {},
});
