import { definePlugin, type PluginContext } from '@hault/sdk';
import { promises as fs } from 'node:fs';
import { resolve, relative } from 'node:path';

/**
 * OCR — extract text from an image via the vision provider registered on
 * the host (see core/providers/media). Falls back to AI vision completion.
 */

function safe(root: string, p: string): string {
  const full = resolve(root, p || '.');
  const rel = relative(root, full);
  if (rel.startsWith('..') || rel.startsWith('/')) throw new Error('path escape');
  return full;
}

export default definePlugin({
  id: 'hault.ocr',

  async activate(ctx: PluginContext) {
    const root = ctx.storage.root;
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.ocr' }));

    ctx.http.post('/extract', async (req) => {
      const { path, base64 } = (req.body || {}) as { path?: string; base64?: string };
      await ctx.permissions.require('ai.invoke', 'ocr.extract', 'Extract text from image');
      let b64 = base64;
      if (!b64 && path) b64 = (await fs.readFile(safe(root, path))).toString('base64');
      if (!b64) throw new Error('path or base64 required');

      // Prefer a dedicated OCR provider when available.
      const media = (ctx as any).host?.providers?.ocr;
      if (media?.extract) {
        return media.extract({ base64: b64 });
      }

      // Fallback: multimodal completion.
      const out = await ctx.ai.complete({
        system: 'Extract all readable text verbatim. Preserve line breaks.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract text from this image.' },
              { type: 'image', imageBase64: b64 },
            ] as any,
          },
        ],
      });
      return { text: out.text };
    });

    ctx.log.info('OCR plugin activated');
  },
  async deactivate() {},
});
