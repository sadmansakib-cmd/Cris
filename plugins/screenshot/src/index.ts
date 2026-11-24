import { definePlugin, type PluginContext } from '@hault/sdk';
import { promises as fs } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Screenshot — server-side stub that stores an already-captured PNG
 * (uploaded as base64) and offers an annotated re-encode.
 * Real desktop capture lives in the native shell (Tauri) — see docs/hault/16.
 */

interface Shot {
  id: string;
  path: string;
  createdAt: string;
  note?: string;
}

function safe(root: string, p: string): string {
  const full = resolve(root, p || '.');
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

export default definePlugin({
  id: 'hault.screenshot',

  async activate(ctx: PluginContext) {
    const root = ctx.storage.root;
    const dir = join(root, 'screenshots');
    await fs.mkdir(dir, { recursive: true });

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.screenshot' }));

    ctx.http.post('/upload', async (req) => {
      const { pngBase64, note } = (req.body || {}) as { pngBase64: string; note?: string };
      if (!pngBase64) throw new Error('pngBase64 required');
      const id = randomUUID();
      const rel = join('screenshots', `${id}.png`);
      const full = safe(root, rel);
      await fs.writeFile(full, Buffer.from(pngBase64, 'base64'));
      const list: Shot[] = (await ctx.kv.get('shots')) || [];
      const shot: Shot = { id, path: rel, createdAt: new Date().toISOString(), note };
      list.unshift(shot);
      await ctx.kv.set('shots', list.slice(0, 500));
      return shot;
    });

    ctx.http.get('/list', async () => (await ctx.kv.get('shots')) || []);

    ctx.http.post('/annotate/:id', async (req) => {
      const { note } = (req.body || {}) as { note: string };
      const list: Shot[] = (await ctx.kv.get('shots')) || [];
      const s = list.find((x) => x.id === (req.params as any).id);
      if (!s) throw new Error('not found');
      s.note = note;
      await ctx.kv.set('shots', list);
      return s;
    });

    ctx.log.info('Screenshot plugin activated', { dir });
  },
  async deactivate() {},
});
