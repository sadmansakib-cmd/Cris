import { definePlugin, type PluginContext } from '@hault/sdk';
import { promises as fs, createWriteStream } from 'node:fs';
import { resolve, relative, join, dirname, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';

interface Download {
  id: string;
  url: string;
  path: string;
  status: 'queued' | 'downloading' | 'complete' | 'error';
  bytes: number;
  totalBytes?: number;
  sha256?: string;
  error?: string;
  startedAt: string;
  endedAt?: string;
}

function safe(root: string, p: string): string {
  const full = resolve(root, p || '.');
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

export default definePlugin({
  id: 'hault.downloads',

  async activate(ctx: PluginContext) {
    const root = ctx.storage.root;
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.downloads' }));

    ctx.http.get('/list', async () => (await ctx.kv.get('downloads')) || []);

    ctx.http.post('/fetch', async (req) => {
      const { url, path, expectedSha256 } = (req.body || {}) as {
        url: string;
        path?: string;
        expectedSha256?: string;
      };
      const host = new URL(url).host;
      const target = path || join('downloads', basename(new URL(url).pathname) || `dl-${Date.now()}`);
      await ctx.permissions.require('net.fetch', `host:${host}`, `Download ${url}`);
      await ctx.permissions.require('fs.write', target, `Save to ${target}`);

      const list: Download[] = (await ctx.kv.get('downloads')) || [];
      const dl: Download = {
        id: randomUUID(),
        url,
        path: target,
        status: 'downloading',
        bytes: 0,
        startedAt: new Date().toISOString(),
      };
      list.unshift(dl);
      await ctx.kv.set('downloads', list);

      try {
        const res = await ctx.net.fetch(url);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        dl.totalBytes = Number(res.headers.get('content-length')) || undefined;

        const full = safe(root, target);
        await fs.mkdir(dirname(full), { recursive: true });
        const out = createWriteStream(full);
        const hash = createHash('sha256');

        const stream = Readable.fromWeb(res.body as any);
        stream.on('data', (chunk: Buffer) => {
          dl.bytes += chunk.length;
          hash.update(chunk);
        });
        await pipeline(stream, out);
        dl.sha256 = hash.digest('hex');
        if (expectedSha256 && expectedSha256 !== dl.sha256) {
          throw new Error(`sha256 mismatch: got ${dl.sha256}`);
        }
        dl.status = 'complete';
      } catch (e: any) {
        dl.status = 'error';
        dl.error = String(e.message || e);
      } finally {
        dl.endedAt = new Date().toISOString();
        const idx = list.findIndex((x) => x.id === dl.id);
        list[idx] = dl;
        await ctx.kv.set('downloads', list);
        await ctx.audit.log('downloads.fetch', { url, status: dl.status, bytes: dl.bytes });
      }
      return dl;
    });

    ctx.log.info('Downloads plugin activated');
  },
  async deactivate() {},
});
