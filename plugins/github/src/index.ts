import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * GitHub — repos, issues, PRs via GitHub REST API.
 * Requires an OAuth connection for provider `github` (scope: repo).
 */

async function gh(ctx: PluginContext, path: string, init: RequestInit = {}) {
  await ctx.permissions.require('net.fetch', 'host:api.github.com', 'Call GitHub API');
  const token = await ctx.oauth.token('github');
  if (!token) throw new Error('GitHub not connected');
  const res = await ctx.net.fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'HAULT/1.0',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

export default definePlugin({
  id: 'hault.github',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.github' }));

    ctx.http.get('/repos', async () =>
      gh(ctx, '/user/repos?per_page=50&sort=updated'),
    );

    ctx.http.get('/repos/:owner/:repo/issues', async (req) => {
      const { owner, repo } = req.params as any;
      return gh(ctx, `/repos/${owner}/${repo}/issues?state=open&per_page=50`);
    });

    ctx.http.post('/repos/:owner/:repo/issues', async (req) => {
      const { owner, repo } = req.params as any;
      const { title, body, labels } = (req.body || {}) as any;
      await ctx.permissions.require('github.write', `${owner}/${repo}`, `Create issue in ${owner}/${repo}`);
      return gh(ctx, `/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, labels }),
      });
    });

    ctx.http.get('/repos/:owner/:repo/pulls', async (req) => {
      const { owner, repo } = req.params as any;
      return gh(ctx, `/repos/${owner}/${repo}/pulls?state=open&per_page=50`);
    });

    ctx.http.post('/repos/:owner/:repo/pulls', async (req) => {
      const { owner, repo } = req.params as any;
      const { title, body, head, base } = (req.body || {}) as any;
      await ctx.permissions.require('github.write', `${owner}/${repo}`, `Open PR in ${owner}/${repo}`);
      return gh(ctx, `/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, head, base }),
      });
    });

    ctx.http.get('/repos/:owner/:repo/actions/runs', async (req) => {
      const { owner, repo } = req.params as any;
      return gh(ctx, `/repos/${owner}/${repo}/actions/runs?per_page=25`);
    });

    ctx.log.info('GitHub plugin activated');
  },

  async deactivate() {},
});
