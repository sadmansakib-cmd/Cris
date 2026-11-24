import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Autofill — Secure per-site autofill from the credential vault.
 * Phase 3 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.autofill',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.autofill' }));
    // Permission gate: vault.read entry:* — Read credentials
    // Permission gate: browser.input tab:* — Fill form
    ctx.log.info('Autofill plugin activated');
  },
  async deactivate() {},
});
