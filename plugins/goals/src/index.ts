import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface KeyResult {
  id: string;
  name: string;
  target: number;
  current: number;
  unit?: string;
}
interface Goal {
  id: string;
  objective: string;
  horizon: 'quarter' | 'year';
  startedAt: string;
  keyResults: KeyResult[];
}

function progress(g: Goal): number {
  if (!g.keyResults.length) return 0;
  const p = g.keyResults.reduce((acc, kr) => acc + Math.min(1, kr.target ? kr.current / kr.target : 0), 0);
  return Math.round((p / g.keyResults.length) * 100);
}

async function load(ctx: PluginContext): Promise<Goal[]> {
  return (await ctx.kv.get('goals')) || [];
}

export default definePlugin({
  id: 'hault.goals',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.goals' }));

    ctx.http.get('/goals', async () => {
      const list = await load(ctx);
      return list.map((g) => ({ ...g, progress: progress(g) }));
    });

    ctx.http.post('/goals', async (req) => {
      const list = await load(ctx);
      const g: Goal = {
        id: randomUUID(),
        horizon: 'quarter',
        startedAt: new Date().toISOString(),
        keyResults: [],
        ...(req.body as any),
      };
      list.push(g);
      await ctx.kv.set('goals', list);
      return g;
    });

    ctx.http.post('/goals/:id/kr', async (req) => {
      const list = await load(ctx);
      const g = list.find((x) => x.id === (req.params as any).id);
      if (!g) throw new Error('not found');
      const kr: KeyResult = { id: randomUUID(), current: 0, target: 1, ...(req.body as any) };
      g.keyResults.push(kr);
      await ctx.kv.set('goals', list);
      return kr;
    });

    ctx.http.post('/goals/:id/kr/:krId', async (req) => {
      const list = await load(ctx);
      const g = list.find((x) => x.id === (req.params as any).id);
      const kr = g?.keyResults.find((x) => x.id === (req.params as any).krId);
      if (!g || !kr) throw new Error('not found');
      Object.assign(kr, req.body);
      await ctx.kv.set('goals', list);
      return { ...g, progress: progress(g) };
    });

    ctx.log.info('Goals plugin activated');
  },
  async deactivate() {},
});
