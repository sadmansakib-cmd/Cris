import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Web Search — provider-agnostic search with a permission-gated fetch.
 * Supports Brave, Tavily, and SearXNG; provider is chosen via settings.
 *
 * Settings:
 *   search.provider   → 'brave' | 'tavily' | 'searxng'
 *   search.searxng.url (for SearXNG)
 *   secret:search.brave.key
 *   secret:search.tavily.key
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
}

async function braveSearch(ctx: PluginContext, q: string, n: number): Promise<SearchResult[]> {
  await ctx.permissions.require('secret.read', 'key:search.brave.key', 'Use your Brave Search API key');
  const key = await ctx.settings.getSecret('search.brave.key');
  if (!key) throw new Error('Brave API key missing');
  await ctx.permissions.require('net.fetch', 'host:api.search.brave.com', 'Query Brave Search');
  const res = await ctx.net.fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${n}`,
    { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const body = await res.json();
  return (body.web?.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    publishedAt: r.age,
    source: r.profile?.name,
  }));
}

async function tavilySearch(ctx: PluginContext, q: string, n: number): Promise<SearchResult[]> {
  await ctx.permissions.require('secret.read', 'key:search.tavily.key', 'Use your Tavily API key');
  const key = await ctx.settings.getSecret('search.tavily.key');
  if (!key) throw new Error('Tavily API key missing');
  await ctx.permissions.require('net.fetch', 'host:api.tavily.com', 'Query Tavily');
  const res = await ctx.net.fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query: q, max_results: n }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const body = await res.json();
  return (body.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    publishedAt: r.published_date,
  }));
}

async function searxngSearch(ctx: PluginContext, q: string, n: number): Promise<SearchResult[]> {
  const base = (await ctx.settings.get<string>('search.searxng.url')) || 'http://localhost:8080';
  const host = new URL(base).host;
  await ctx.permissions.require('net.fetch', `host:${host}`, `Query SearXNG (${host})`);
  const res = await ctx.net.fetch(
    `${base}/search?q=${encodeURIComponent(q)}&format=json`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`SearXNG ${res.status}`);
  const body = await res.json();
  return (body.results || []).slice(0, n).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    source: r.engine,
  }));
}

export default definePlugin({
  id: 'hault.search',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.search' }));

    ctx.http.post('/query', async (req) => {
      const { q, n = 10 } = (req.body || {}) as { q: string; n?: number };
      if (!q) throw new Error('q required');
      const provider = (await ctx.settings.get<string>('search.provider')) || 'brave';

      let results: SearchResult[];
      if (provider === 'tavily') results = await tavilySearch(ctx, q, n);
      else if (provider === 'searxng') results = await searxngSearch(ctx, q, n);
      else results = await braveSearch(ctx, q, n);

      await ctx.audit.log('search.query', { provider, q, count: results.length });
      return { provider, query: q, results };
    });

    ctx.log.info('Search plugin activated');
  },

  async deactivate() {},
});
