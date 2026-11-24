import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Citations — turn a URL or DOI into a formatted citation (APA / MLA / Chicago / BibTeX).
 * Uses metadata from hault.scraper and Crossref for DOIs.
 */

type Style = 'apa' | 'mla' | 'chicago' | 'bibtex';

interface Meta {
  title?: string;
  authors?: string[];
  publisher?: string;
  year?: string;
  url?: string;
  doi?: string;
  containerTitle?: string;
}

function formatAuthors(authors: string[] = [], style: Style): string {
  if (!authors.length) return '';
  if (style === 'apa') return authors.join(', ');
  if (style === 'mla') return authors.length === 1 ? authors[0] : `${authors[0]} et al.`;
  return authors.join(' and ');
}

function format(m: Meta, style: Style): string {
  const year = m.year || 'n.d.';
  const title = m.title || '(untitled)';
  const src = m.containerTitle || m.publisher || (m.url ? new URL(m.url).host : '');
  const authors = formatAuthors(m.authors, style);

  switch (style) {
    case 'apa':
      return `${authors} (${year}). ${title}. ${src}. ${m.url || m.doi || ''}`.trim();
    case 'mla':
      return `${authors}. "${title}." ${src}, ${year}, ${m.url || m.doi || ''}.`.trim();
    case 'chicago':
      return `${authors}. "${title}." ${src} (${year}). ${m.url || m.doi || ''}.`.trim();
    case 'bibtex': {
      const key = (m.authors?.[0]?.split(' ').pop() || 'ref').toLowerCase() + year;
      return [
        `@article{${key},`,
        `  title = {${title}},`,
        `  author = {${(m.authors || []).join(' and ')}},`,
        `  year = {${year}},`,
        m.containerTitle ? `  journal = {${m.containerTitle}},` : '',
        m.doi ? `  doi = {${m.doi}},` : '',
        m.url ? `  url = {${m.url}},` : '',
        `}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
  }
}

export default definePlugin({
  id: 'hault.citations',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.citations' }));

    ctx.http.post('/cite', async (req) => {
      const { url, doi, style = 'apa' } = (req.body || {}) as {
        url?: string;
        doi?: string;
        style?: Style;
      };
      if (!url && !doi) throw new Error('url or doi required');

      let meta: Meta = {};
      if (doi) {
        await ctx.permissions.require('net.fetch', 'host:api.crossref.org', 'Look up citation from Crossref');
        const r = await ctx.net.fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
        if (!r.ok) throw new Error(`Crossref ${r.status}`);
        const w = (await r.json()).message;
        meta = {
          title: Array.isArray(w.title) ? w.title[0] : w.title,
          authors: (w.author || []).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()),
          publisher: w.publisher,
          year: String(w.issued?.['date-parts']?.[0]?.[0] || ''),
          doi,
          containerTitle: Array.isArray(w['container-title']) ? w['container-title'][0] : undefined,
          url: w.URL,
        };
      } else if (url) {
        const host = new URL(url).host;
        await ctx.permissions.require('net.fetch', `host:${host}`, `Fetch citation metadata from ${host}`);
        const res = await ctx.net.fetch(url);
        const html = await res.text();
        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM(html, { url });
        const doc = dom.window.document;
        const meta$ = (name: string) =>
          doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content') || undefined;
        meta = {
          title: meta$('og:title') || meta$('citation_title') || doc.title,
          authors: meta$('citation_author')?.split(';').map((s) => s.trim()) || undefined,
          publisher: meta$('og:site_name') || meta$('citation_publisher'),
          year: (meta$('citation_publication_date') || meta$('article:published_time') || '').slice(0, 4) || undefined,
          url,
          containerTitle: meta$('citation_journal_title'),
        };
      }

      return { style, meta, citation: format(meta, style) };
    });

    ctx.log.info('Citations plugin activated');
  },

  async deactivate() {},
});
