import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Backup — Encrypted incremental backups to any storage provider.
 * Phase 2 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.backup',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.backup' }));
    // Permission gate: storage.write namespace:backups/* — Store backups
    // Permission gate: computer.fs.read path:* — Read files to back up
    ctx.log.info('Backup plugin activated');
  },
  async deactivate() {},
});
