import { definePlugin, type PluginContext } from '@hault/sdk';

type Entry = { id: string; kind: string; value: number; unit?: string; note?: string; at: string };

export default definePlugin({
  id: 'hault.health',
  async activate(ctx: PluginContext) {
    const load = async (): Promise<Entry[]> => ((await ctx.kv.get('entries')) as Entry[]) || [];
    const save = (e: Entry[]) => ctx.kv.set('entries', e);

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.health' }));

    ctx.http.get('/entries', async (req) => {
      const kind = (req.query?.kind as string) || undefined;
      const list = await load();
      return kind ? list.filter((e) => e.kind === kind) : list;
    });

    ctx.http.post('/entries', async (req) => {
      const { kind, value, unit, note } = (req.body || {}) as Partial<Entry>;
      if (!kind || typeof value !== 'number') throw new Error('kind and numeric value required');
      const list = await load();
      const entry: Entry = {
        id: crypto.randomUUID(),
        kind,
        value,
        unit,
        note,
        at: new Date().toISOString(),
      };
      list.unshift(entry);
      await save(list.slice(0, 5000));
      return entry;
    });

    ctx.http.post('/delete/:id', async (req) => {
      const list = (await load()).filter((e) => e.id !== req.params.id);
      await save(list);
      return { ok: true };
    });

    ctx.http.get('/summary', async () => {
      const list = await load();
      const byKind: Record<string, { count: number; last?: Entry; avg7d: number }> = {};
      const cutoff = Date.now() - 7 * 86400_000;
      for (const e of list) {
        const b = (byKind[e.kind] ||= { count: 0, last: undefined, avg7d: 0 });
        b.count++;
        if (!b.last) b.last = e;
      }
      for (const kind of Object.keys(byKind)) {
        const recent = list.filter((e) => e.kind === kind && new Date(e.at).getTime() >= cutoff);
        byKind[kind].avg7d = recent.length ? recent.reduce((s, e) => s + e.value, 0) / recent.length : 0;
      }
      return byKind;
    });

    ctx.log.info('Health plugin activated');
  },
  async deactivate() {},
});
