import { definePlugin, type PluginContext } from '@hault/sdk';
import { promises as fs, createWriteStream, createReadStream } from 'node:fs';
import { resolve, relative, join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * Archive — create/extract .zip and .tar/.tar.gz archives.
 * Uses adm-zip and tar (both worker-safe: pure JS / no native builds).
 */

function safe(root: string, p: string): string {
  const full = resolve(root, p || '.');
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

export default definePlugin({
  id: 'hault.zip',

  async activate(ctx: PluginContext) {
    const root = ctx.storage.root;
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.zip' }));

    ctx.http.post('/zip', async (req) => {
      const { output, inputs } = (req.body || {}) as { output: string; inputs: string[] };
      await ctx.permissions.require('fs.write', output, `Create archive ${output}`);
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();
      for (const rel of inputs) {
        const full = safe(root, rel);
        const st = await fs.stat(full);
        if (st.isDirectory()) zip.addLocalFolder(full, rel);
        else zip.addLocalFile(full, dirname(rel) === '.' ? undefined : dirname(rel));
      }
      const out = safe(root, output);
      await fs.mkdir(dirname(out), { recursive: true });
      zip.writeZip(out);
      return { ok: true, path: output, entries: zip.getEntries().length };
    });

    ctx.http.post('/unzip', async (req) => {
      const { path, to } = (req.body || {}) as { path: string; to: string };
      await ctx.permissions.require('fs.write', to, `Extract to ${to}`);
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(safe(root, path));
      const target = safe(root, to);
      await fs.mkdir(target, { recursive: true });
      zip.extractAllTo(target, true);
      return { ok: true, entries: zip.getEntries().length };
    });

    ctx.http.post('/tar', async (req) => {
      const { output, inputs, gzip = true } = (req.body || {}) as any;
      await ctx.permissions.require('fs.write', output, `Create tar ${output}`);
      const tar = await import('tar');
      const out = safe(root, output);
      await fs.mkdir(dirname(out), { recursive: true });
      await tar.c({ file: out, gzip, cwd: root }, inputs);
      return { ok: true, path: output };
    });

    ctx.http.post('/untar', async (req) => {
      const { path, to } = (req.body || {}) as any;
      await ctx.permissions.require('fs.write', to, `Extract tar to ${to}`);
      const tar = await import('tar');
      const target = safe(root, to);
      await fs.mkdir(target, { recursive: true });
      await tar.x({ file: safe(root, path), cwd: target });
      return { ok: true };
    });

    ctx.log.info('Archive plugin activated');
  },
  async deactivate() {},
});
