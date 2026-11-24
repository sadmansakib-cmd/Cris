import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Scraper — fetch a URL, extract readable article text and metadata.
 * Uses @mozilla/readability + jsdom under the hood (loaded lazily).
 */

interface ExtractResult {
  url: string;
  title?: string;
  byline?: string;
  siteName?: string;
  publishedTime?: string;
  excerpt?: string;
  content: string;
  textContent: string;
  length: number;
}

export default definePlugin({
  id: 'hault.scraper',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.scraper' }));

    ctx.http.post('/extract', async (req) => {
      const { url } = (req.body || {}) as { url: string };
      if (!url) throw new Error('url required');
      const host = new URL(url).host;
      await ctx.permissions.require('net.fetch', `host:${host}`, `Fetch article from ${host}`);

      const res = await ctx.net.fetch(url, {
        headers: { 'User-Agent': 'HAULT-Scraper/1.0 (+https://hault.local)' },
      });
      if (!res.ok) throw new Error(`Fetch ${res.status}`);
      const html = await res.text();

      const { JSDOM } = await import('jsdom');
      const { Readability } = await import('@mozilla/readability');
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document as any).parse();
      if (!article) throw new Error('Unable to extract article');

      const result: ExtractResult = {
        url,
        title: article.title,
        byline: article.byline || undefined,
        siteName: article.siteName || undefined,
        publishedTime: article.publishedTime || undefined,
        excerpt: article.excerpt || undefined,
        content: article.content,
        textContent: article.textContent,
        length: article.length,
      };
      await ctx.audit.log('scraper.extract', { url, host, length: result.length });
      return result;
    });

    ctx.log.info('Scraper plugin activated');
  },

  async deactivate() {},
});
