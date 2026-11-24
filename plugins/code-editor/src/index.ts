import { definePlugin, type PluginContext } from '@hault/sdk';
import { join, resolve, relative } from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * Code Editor — filesystem-backed workspace for opening, editing, and
 * saving files under a sandboxed project root.
 */

function safe(root: string, p: string): string {
  const full = resolve(root, p);
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

export default definePlugin({
  id: 'hault.code-editor',

  async activate(ctx: PluginContext) {
    const root = join(ctx.storage.root, 'workspace');
    await fs.mkdir(root, { recursive: true });

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.code-editor' }));

    ctx.http.get('/tree', async () => {
      const walk = async (dir: string): Promise<any[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return Promise.all(
          entries.map(async (e) => ({
            name: e.name,
            path: relative(root, join(dir, e.name)),
            dir: e.isDirectory(),
            children: e.isDirectory() ? await walk(join(dir, e.name)) : undefined,
          })),
        );
      };
      return walk(root);
    });

    ctx.http.get('/file', async (req) => {
      const p = (req.query?.path as string) || '';
      const full = safe(root, p);
      return { path: p, content: await fs.readFile(full, 'utf8') };
    });

    ctx.http.post('/file', async (req) => {
      const { path, content } = (req.body || {}) as { path: string; content: string };
      await ctx.permissions.require('fs.write', path, `Save ${path}`);
      const full = safe(root, path);
      await fs.mkdir(join(full, '..'), { recursive: true });
      await fs.writeFile(full, content, 'utf8');
      await ctx.audit.log('code-editor.save', { path, bytes: content.length });
      return { ok: true };
    });

    ctx.http.post('/delete', async (req) => {
      const { path } = (req.body || {}) as { path: string };
      await ctx.permissions.require('fs.delete', path, `Delete ${path}`);
      await fs.rm(safe(root, path), { recursive: true, force: true });
      return { ok: true };
    });

    ctx.log.info('Code Editor plugin activated', { root });
  },

  async deactivate() {},
});
