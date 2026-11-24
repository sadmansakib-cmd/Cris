import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Whiteboard — Excalidraw-style infinite canvas.
 * Phase 7 of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.whiteboard',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.whiteboard' }));
    // Permission gate: storage.write namespace:whiteboard/* — Store canvases
    ctx.log.info('Whiteboard plugin activated');
  },
  async deactivate() {},
});
