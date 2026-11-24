import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Docker — Manage local Docker containers and images.
 * Phase 6 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.docker',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.docker' }));
    // Permission gate: computer.shell.exec cmd:docker — Docker CLI
    ctx.log.info('Docker plugin activated');
  },
  async deactivate() {},
});
