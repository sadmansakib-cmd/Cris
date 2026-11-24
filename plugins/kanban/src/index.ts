import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Card {
  id: string;
  title: string;
  description?: string;
  labels?: string[];
  order: number;
}
interface Column {
  id: string;
  name: string;
  cards: Card[];
}
interface Board {
  id: string;
  name: string;
  columns: Column[];
}

async function load(ctx: PluginContext): Promise<Board[]> {
  const boards = (await ctx.kv.get('boards')) as Board[] | undefined;
  if (boards && boards.length) return boards;
  const seed: Board[] = [
    {
      id: randomUUID(),
      name: 'Default',
      columns: [
        { id: randomUUID(), name: 'Todo', cards: [] },
        { id: randomUUID(), name: 'Doing', cards: [] },
        { id: randomUUID(), name: 'Done', cards: [] },
      ],
    },
  ];
  await ctx.kv.set('boards', seed);
  return seed;
}

export default definePlugin({
  id: 'hault.kanban',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.kanban' }));

    ctx.http.get('/boards', async () => load(ctx));

    ctx.http.post('/boards/:boardId/columns/:columnId/cards', async (req) => {
      const boards = await load(ctx);
      const b = boards.find((x) => x.id === (req.params as any).boardId);
      const c = b?.columns.find((x) => x.id === (req.params as any).columnId);
      if (!b || !c) throw new Error('not found');
      const card: Card = { id: randomUUID(), order: c.cards.length, ...(req.body as any) };
      c.cards.push(card);
      await ctx.kv.set('boards', boards);
      return card;
    });

    ctx.http.post('/boards/:boardId/move', async (req) => {
      const { cardId, toColumnId, toIndex } = (req.body || {}) as any;
      const boards = await load(ctx);
      const b = boards.find((x) => x.id === (req.params as any).boardId);
      if (!b) throw new Error('not found');
      let moving: Card | undefined;
      for (const col of b.columns) {
        const i = col.cards.findIndex((c) => c.id === cardId);
        if (i >= 0) {
          [moving] = col.cards.splice(i, 1);
          break;
        }
      }
      if (!moving) throw new Error('card not found');
      const target = b.columns.find((c) => c.id === toColumnId);
      if (!target) throw new Error('column not found');
      target.cards.splice(toIndex ?? target.cards.length, 0, moving);
      await ctx.kv.set('boards', boards);
      return { ok: true };
    });

    ctx.log.info('Kanban plugin activated');
  },
  async deactivate() {},
});
