import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Task {
  id: string;
  title: string;
  notes?: string;
  status: 'inbox' | 'next' | 'waiting' | 'done';
  project?: string;
  due?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

async function load(ctx: PluginContext): Promise<Task[]> {
  return (await ctx.kv.get('tasks')) || [];
}
async function save(ctx: PluginContext, list: Task[]) {
  await ctx.kv.set('tasks', list);
}

export default definePlugin({
  id: 'hault.tasks',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.tasks' }));

    ctx.http.get('/tasks', async () => load(ctx));

    ctx.http.post('/tasks', async (req) => {
      const list = await load(ctx);
      const now = new Date().toISOString();
      const t: Task = {
        id: randomUUID(),
        status: 'inbox',
        createdAt: now,
        updatedAt: now,
        ...(req.body as any),
      };
      list.unshift(t);
      await save(ctx, list);
      return t;
    });

    ctx.http.post('/tasks/:id', async (req) => {
      const list = await load(ctx);
      const idx = list.findIndex((t) => t.id === (req.params as any).id);
      if (idx < 0) throw new Error('not found');
      list[idx] = { ...list[idx], ...(req.body as any), updatedAt: new Date().toISOString() };
      await save(ctx, list);
      return list[idx];
    });

    ctx.http.post('/tasks/:id/delete', async (req) => {
      const list = (await load(ctx)).filter((t) => t.id !== (req.params as any).id);
      await save(ctx, list);
      return { ok: true };
    });

    ctx.log.info('Tasks plugin activated');
  },
  async deactivate() {},
});
