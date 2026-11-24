import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Note {
  id: string;
  title: string;
  body: string;
  tags?: string[];
  links?: string[]; // ids of linked notes (backlinks derived)
  createdAt: string;
  updatedAt: string;
}

const LINK_RE = /\[\[([^\]]+)\]\]/g;

function extractLinks(body: string, all: Note[]): string[] {
  const titles = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(body))) titles.add(m[1].trim().toLowerCase());
  return all.filter((n) => titles.has(n.title.toLowerCase())).map((n) => n.id);
}

async function load(ctx: PluginContext): Promise<Note[]> {
  return (await ctx.kv.get('notes')) || [];
}
async function save(ctx: PluginContext, list: Note[]) {
  await ctx.kv.set('notes', list);
}

export default definePlugin({
  id: 'hault.notes',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.notes' }));

    ctx.http.get('/notes', async () => load(ctx));

    ctx.http.get('/notes/:id', async (req) => {
      const list = await load(ctx);
      const n = list.find((x) => x.id === (req.params as any).id);
      if (!n) throw new Error('not found');
      const backlinks = list.filter((x) => (x.links || []).includes(n.id)).map((x) => ({ id: x.id, title: x.title }));
      return { ...n, backlinks };
    });

    ctx.http.post('/notes', async (req) => {
      const list = await load(ctx);
      const now = new Date().toISOString();
      const body = (req.body as any).body || '';
      const n: Note = {
        id: randomUUID(),
        title: (req.body as any).title || 'Untitled',
        body,
        tags: (req.body as any).tags,
        links: extractLinks(body, list),
        createdAt: now,
        updatedAt: now,
      };
      list.unshift(n);
      await save(ctx, list);
      return n;
    });

    ctx.http.post('/notes/:id', async (req) => {
      const list = await load(ctx);
      const idx = list.findIndex((t) => t.id === (req.params as any).id);
      if (idx < 0) throw new Error('not found');
      const merged = { ...list[idx], ...(req.body as any), updatedAt: new Date().toISOString() };
      merged.links = extractLinks(merged.body || '', list);
      list[idx] = merged;
      await save(ctx, list);
      return merged;
    });

    ctx.log.info('Notes plugin activated');
  },
  async deactivate() {},
});
