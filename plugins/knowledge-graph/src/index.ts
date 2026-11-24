import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Knowledge Graph — derives a concept graph from the Notes plugin state.
 * Nodes: notes. Edges: [[wikilinks]] between notes.
 */

interface Note {
  id: string;
  title: string;
  body?: string;
  links?: string[];
  tags?: string[];
}

async function fetchNotes(ctx: PluginContext): Promise<Note[]> {
  // Cross-plugin read via shared kv namespace — the runtime scopes kv per plugin,
  // so we call the notes plugin's HTTP surface instead.
  const res = await ctx.host.invoke('hault.notes', 'GET', '/notes');
  return res as Note[];
}

export default definePlugin({
  id: 'hault.knowledge-graph',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.knowledge-graph' }));

    ctx.http.get('/graph', async () => {
      const notes = await fetchNotes(ctx);
      const nodes = notes.map((n) => ({ id: n.id, label: n.title, tags: n.tags || [] }));
      const edges: Array<{ from: string; to: string }> = [];
      for (const n of notes) {
        for (const to of n.links || []) edges.push({ from: n.id, to });
      }
      return { nodes, edges, stats: { nodes: nodes.length, edges: edges.length } };
    });

    ctx.http.get('/hubs', async () => {
      const notes = await fetchNotes(ctx);
      const inDeg = new Map<string, number>();
      for (const n of notes) for (const to of n.links || []) inDeg.set(to, (inDeg.get(to) || 0) + 1);
      return notes
        .map((n) => ({ id: n.id, title: n.title, backlinks: inDeg.get(n.id) || 0 }))
        .sort((a, b) => b.backlinks - a.backlinks)
        .slice(0, 25);
    });

    ctx.log.info('Knowledge Graph plugin activated');
  },
  async deactivate() {},
});
