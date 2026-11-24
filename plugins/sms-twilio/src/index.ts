import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * SMS — Twilio-compatible SMS gateway.
 * Phase 4 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.sms-twilio',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.sms-twilio' }));
    // Permission gate: secret.read key:twilio.* — Use API creds
    // Permission gate: net.fetch host:api.twilio.com — Send SMS
    ctx.log.info('SMS plugin activated');
  },
  async deactivate() {},
});
