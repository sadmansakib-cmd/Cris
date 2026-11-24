import { definePlugin, type PluginContext } from '@hault/sdk';
import { promises as fs } from 'node:fs';
import { resolve, relative, join } from 'node:path';

function safe(root: string, p: string): string {
  const full = resolve(root, p || '.');
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

export default definePlugin({
  id: 'hault.folders',
  async activate(ctx: PluginContext) {
    const root = ctx.storage.root;
    await fs.mkdir(root, { recursive: true });

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.folders' }));

    ctx.http.post('/mkdir', async (req) => {
      const { path } = (req.body || {}) as any;
      await ctx.permissions.require('fs.write', path, `Create folder ${path}`);
      await fs.mkdir(safe(root, path), { recursive: true });
      return { ok: true };
    });

    ctx.http.post('/move', async (req) => {
      const { from, to } = (req.body || {}) as any;
      await ctx.permissions.require('fs.write', to, `Move folder ${from} → ${to}`);
      await fs.rename(safe(root, from), safe(root, to));
      return { ok: true };
    });

    ctx.http.post('/delete', async (req) => {
      const { path } = (req.body || {}) as any;
      await ctx.permissions.require('fs.delete', path, `Delete folder ${path}`);
      await fs.rm(safe(root, path), { recursive: true, force: true });
      return { ok: true };
    });

    ctx.http.get('/tree', async () => {
      const walk = async (dir: string): Promise<any[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());
        return Promise.all(
          dirs.map(async (d) => ({
            name: d.name,
            path: relative(root, join(dir, d.name)),
            children: await walk(join(dir, d.name)),
          })),
        );
      };
      return walk(root);
    });

    ctx.log.info('Folders plugin activated');
  },
  async deactivate() {},
});
