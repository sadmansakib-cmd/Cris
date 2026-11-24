import { definePlugin, type PluginContext } from '@hault/sdk';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative, dirname, basename, extname } from 'node:path';

/**
 * Files — sandboxed filesystem operations under the plugin's data root.
 * All destructive operations require explicit permission grants.
 */

function safe(root: string, p: string): string {
  const full = resolve(root, p || '.');
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

async function sha256(path: string): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('hex');
}

export default definePlugin({
  id: 'hault.files',

  async activate(ctx: PluginContext) {
    const root = ctx.storage.root;
    await fs.mkdir(root, { recursive: true });

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.files' }));

    ctx.http.get('/list', async (req) => {
      const p = (req.query?.path as string) || '';
      const full = safe(root, p);
      const entries = await fs.readdir(full, { withFileTypes: true });
      const out = await Promise.all(
        entries.map(async (e) => {
          const st = await fs.stat(join(full, e.name));
          return {
            name: e.name,
            path: relative(root, join(full, e.name)),
            dir: e.isDirectory(),
            size: st.size,
            mtime: st.mtime.toISOString(),
            ext: e.isDirectory() ? '' : extname(e.name),
          };
        }),
      );
      return out.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
    });

    ctx.http.get('/read', async (req) => {
      const p = (req.query?.path as string) || '';
      const encoding = (req.query?.encoding as string) || 'utf8';
      const full = safe(root, p);
      if (encoding === 'base64') return { path: p, base64: (await fs.readFile(full)).toString('base64') };
      return { path: p, content: await fs.readFile(full, 'utf8') };
    });

    ctx.http.post('/write', async (req) => {
      const { path, content, base64 } = (req.body || {}) as any;
      await ctx.permissions.require('fs.write', path, `Write ${path}`);
      const full = safe(root, path);
      await fs.mkdir(dirname(full), { recursive: true });
      if (typeof base64 === 'string') await fs.writeFile(full, Buffer.from(base64, 'base64'));
      else await fs.writeFile(full, content ?? '', 'utf8');
      await ctx.audit.log('files.write', { path });
      return { ok: true };
    });

    ctx.http.post('/move', async (req) => {
      const { from, to } = (req.body || {}) as any;
      await ctx.permissions.require('fs.write', to, `Move ${from} → ${to}`);
      await fs.mkdir(dirname(safe(root, to)), { recursive: true });
      await fs.rename(safe(root, from), safe(root, to));
      return { ok: true };
    });

    ctx.http.post('/delete', async (req) => {
      const { path } = (req.body || {}) as any;
      await ctx.permissions.require('fs.delete', path, `Delete ${path}`);
      await fs.rm(safe(root, path), { recursive: true, force: true });
      return { ok: true };
    });

    ctx.http.get('/hash', async (req) => {
      const p = (req.query?.path as string) || '';
      return { path: p, sha256: await sha256(safe(root, p)) };
    });

    ctx.http.get('/search', async (req) => {
      const q = ((req.query?.q as string) || '').toLowerCase();
      const found: string[] = [];
      const walk = async (dir: string) => {
        for (const e of await fs.readdir(dir, { withFileTypes: true })) {
          const full = join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else if (e.name.toLowerCase().includes(q)) found.push(relative(root, full));
        }
      };
      await walk(root);
      return { matches: found.slice(0, 200) };
    });

    ctx.log.info('Files plugin activated', { root });
  },
  async deactivate() {},
});
