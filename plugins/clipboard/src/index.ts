import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Entry {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
}

const CAP = 200;

async function load(ctx: PluginContext): Promise<Entry[]> {
  return (await ctx.kv.get('clip')) || [];
}

export default definePlugin({
  id: 'hault.clipboard',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.clipboard' }));

    ctx.http.get('/entries', async () => load(ctx));

    ctx.http.post('/push', async (req) => {
      const { text } = (req.body || {}) as { text: string };
      if (!text) return { ok: false };
      const list = await load(ctx);
      const e: Entry = { id: randomUUID(), text, pinned: false, createdAt: new Date().toISOString() };
      list.unshift(e);
      const pinned = list.filter((x) => x.pinned);
      const unpinned = list.filter((x) => !x.pinned).slice(0, CAP - pinned.length);
      await ctx.kv.set('clip', [...pinned, ...unpinned]);
      return e;
    });

    ctx.http.post('/pin/:id', async (req) => {
      const list = await load(ctx);
      const e = list.find((x) => x.id === (req.params as any).id);
      if (!e) throw new Error('not found');
      e.pinned = !e.pinned;
      await ctx.kv.set('clip', list);
      return e;
    });

    ctx.http.post('/clear', async () => {
      const kept = (await load(ctx)).filter((x) => x.pinned);
      await ctx.kv.set('clip', kept);
      return { ok: true, kept: kept.length };
    });

    ctx.log.info('Clipboard plugin activated');
  },
  async deactivate() {},
});
