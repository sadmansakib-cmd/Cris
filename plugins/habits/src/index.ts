import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Habit {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  createdAt: string;
  log: string[]; // ISO dates (yyyy-mm-dd)
}

function streak(log: string[]): number {
  const set = new Set(log);
  let n = 0;
  const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

async function load(ctx: PluginContext): Promise<Habit[]> {
  return (await ctx.kv.get('habits')) || [];
}

export default definePlugin({
  id: 'hault.habits',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.habits' }));

    ctx.http.get('/habits', async () => {
      const list = await load(ctx);
      return list.map((h) => ({ ...h, streak: streak(h.log) }));
    });

    ctx.http.post('/habits', async (req) => {
      const list = await load(ctx);
      const h: Habit = {
        id: randomUUID(),
        cadence: 'daily',
        createdAt: new Date().toISOString(),
        log: [],
        ...(req.body as any),
      };
      list.push(h);
      await ctx.kv.set('habits', list);
      return h;
    });

    ctx.http.post('/habits/:id/check', async (req) => {
      const list = await load(ctx);
      const h = list.find((x) => x.id === (req.params as any).id);
      if (!h) throw new Error('not found');
      const today = new Date().toISOString().slice(0, 10);
      if (!h.log.includes(today)) h.log.push(today);
      await ctx.kv.set('habits', list);
      return { ...h, streak: streak(h.log) };
    });

    ctx.log.info('Habits plugin activated');
  },
  async deactivate() {},
});
