import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Research Mode — orchestrates search → scrape → embed → RAG-summarise.
 *
 * Flow:
 *   1. Query hault.search
 *   2. Fetch each result via hault.scraper
 *   3. Chunk & embed via the host AI provider
 *   4. Store chunks in the vector provider under namespace `research:<sessionId>`
 *   5. Ask the AI provider to synthesise an answer with inline [n] citations
 */

interface Source {
  n: number;
  url: string;
  title?: string;
}

function chunk(text: string, size = 1200, overlap = 200): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

export default definePlugin({
  id: 'hault.research-mode',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.research-mode' }));

    ctx.http.post('/run', async (req) => {
      const { question, maxSources = 5 } = (req.body || {}) as {
        question: string;
        maxSources?: number;
      };
      if (!question) throw new Error('question required');
      await ctx.permissions.require('ai.chat', 'model:default', 'Run a research synthesis');

      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const searchRes = await ctx.net.fetch('/plugins/hault.search/query', {
        method: 'POST',
        body: JSON.stringify({ q: question, n: maxSources }),
      });
      const { results = [] } = await searchRes.json();

      const sources: Source[] = [];
      const chunks: Array<{ source: number; text: string }> = [];

      for (let i = 0; i < Math.min(results.length, maxSources); i++) {
        const r = results[i];
        try {
          const extractRes = await ctx.net.fetch('/plugins/hault.scraper/extract', {
            method: 'POST',
            body: JSON.stringify({ url: r.url }),
          });
          if (!extractRes.ok) continue;
          const article = await extractRes.json();
          const n = sources.length + 1;
          sources.push({ n, url: r.url, title: article.title || r.title });
          for (const c of chunk(article.textContent || '')) {
            chunks.push({ source: n, text: c });
          }
        } catch {
          /* skip failed source */
        }
      }

      const ai = ctx.provider<{
        chat: (opts: {
          messages: Array<{ role: string; content: string }>;
        }) => Promise<{ content: string }>;
      }>('ai');

      const context = chunks
        .slice(0, 40) // hard-cap tokens
        .map((c) => `[${c.source}] ${c.text}`)
        .join('\n\n');

      const answer = await ai.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a research assistant. Answer the question using ONLY the numbered sources. ' +
              'Cite every claim inline as [n]. If sources disagree, note it. If unsupported, say so.',
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nSources:\n${context}`,
          },
        ],
      });

      await ctx.audit.log('research.run', {
        sessionId,
        question,
        sourceCount: sources.length,
      });

      return { sessionId, question, sources, answer: answer.content };
    });

    ctx.log.info('Research Mode plugin activated');
  },

  async deactivate() {},
});
