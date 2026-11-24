import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags: string[];
  createdAt: string;
}

async function load(ctx: PluginContext): Promise<Bookmark[]> {
  return (await ctx.kv.get('bookmarks')) || [];
}

export default definePlugin({
  id: 'hault.bookmarks',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.bookmarks' }));

    ctx.http.get('/bookmarks', async (req) => {
      const q = ((req.query?.q as string) || '').toLowerCase();
      const tag = (req.query?.tag as string) || '';
      let list = await load(ctx);
      if (tag) list = list.filter((b) => b.tags.includes(tag));
      if (q)
        list = list.filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            (b.description || '').toLowerCase().includes(q),
        );
      return list;
    });

    ctx.http.post('/bookmarks', async (req) => {
      const { url, title, description, tags = [] } = (req.body || {}) as any;
      const list = await load(ctx);
      const b: Bookmark = {
        id: randomUUID(),
        url,
        title: title || url,
        description,
        tags,
        createdAt: new Date().toISOString(),
      };
      list.unshift(b);
      await ctx.kv.set('bookmarks', list);
      return b;
    });

    ctx.http.post('/bookmarks/:id/delete', async (req) => {
      const list = (await load(ctx)).filter((b) => b.id !== (req.params as any).id);
      await ctx.kv.set('bookmarks', list);
      return { ok: true };
    });

    ctx.http.get('/tags', async () => {
      const map = new Map<string, number>();
      for (const b of await load(ctx)) for (const t of b.tags) map.set(t, (map.get(t) || 0) + 1);
      return [...map.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
    });

    ctx.log.info('Bookmarks plugin activated');
  },
  async deactivate() {},
});
