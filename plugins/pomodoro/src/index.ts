import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Session {
  id: string;
  kind: 'focus' | 'short-break' | 'long-break';
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  taskId?: string;
  notes?: string;
}

async function load(ctx: PluginContext): Promise<Session[]> {
  return (await ctx.kv.get('sessions')) || [];
}

export default definePlugin({
  id: 'hault.pomodoro',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.pomodoro' }));

    ctx.http.post('/start', async (req) => {
      const { kind = 'focus', durationSec = 25 * 60, taskId } = (req.body || {}) as any;
      const s: Session = { id: randomUUID(), kind, startedAt: new Date().toISOString(), durationSec, taskId };
      const list = await load(ctx);
      list.unshift(s);
      await ctx.kv.set('sessions', list);
      return s;
    });

    ctx.http.post('/stop/:id', async (req) => {
      const list = await load(ctx);
      const s = list.find((x) => x.id === (req.params as any).id);
      if (!s) throw new Error('not found');
      s.endedAt = new Date().toISOString();
      await ctx.kv.set('sessions', list);
      return s;
    });

    ctx.http.get('/sessions', async () => load(ctx));

    ctx.http.get('/stats', async () => {
      const list = await load(ctx);
      const today = new Date().toISOString().slice(0, 10);
      const todayList = list.filter((s) => s.startedAt.startsWith(today));
      return {
        todayFocusMin: Math.round(
          todayList.filter((s) => s.kind === 'focus').reduce((a, s) => a + s.durationSec, 0) / 60,
        ),
        totalSessions: list.length,
      };
    });

    ctx.log.info('Pomodoro plugin activated');
  },
  async deactivate() {},
});
