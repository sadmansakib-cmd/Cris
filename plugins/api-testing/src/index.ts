import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * API Testing — send arbitrary HTTP requests and record collections.
 * Each outbound request is permission-gated per host.
 */

interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export default definePlugin({
  id: 'hault.api-testing',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.api-testing' }));

    ctx.http.post('/send', async (req) => {
      const { method = 'GET', url, headers = {}, body } = (req.body || {}) as any;
      const host = new URL(url).host;
      await ctx.permissions.require('net.fetch', `host:${host}`, `${method} ${url}`);
      const started = Date.now();
      const res = await ctx.net.fetch(url, { method, headers, body });
      const text = await res.text();
      const ms = Date.now() - started;
      await ctx.audit.log('api-testing.send', { method, url, status: res.status, ms });
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: text,
        ms,
      };
    });

    ctx.http.get('/collections', async () => {
      return (await ctx.kv.get('collections')) || [];
    });

    ctx.http.post('/collections', async (req) => {
      const saved: SavedRequest = req.body as any;
      const list: SavedRequest[] = (await ctx.kv.get('collections')) || [];
      const idx = list.findIndex((s) => s.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      await ctx.kv.set('collections', list);
      return { ok: true };
    });

    ctx.log.info('API Testing plugin activated');
  },

  async deactivate() {},
});
