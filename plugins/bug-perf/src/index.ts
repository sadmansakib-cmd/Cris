import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Bug & Perf — AI-assisted stack-trace triage and hot-path analysis.
 */
export default definePlugin({
  id: 'hault.bug-perf',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.bug-perf' }));

    ctx.http.post('/triage', async (req) => {
      const { stack, context } = (req.body || {}) as { stack: string; context?: string };
      await ctx.permissions.require('ai.invoke', 'bug.triage', 'Triage stack trace');
      const out = await ctx.ai.complete({
        system:
          'You are a senior debugger. Identify root cause candidates and ' +
          'next diagnostic steps. Be concise.',
        messages: [
          {
            role: 'user',
            content: `Stack trace:\n\n${stack}\n\nContext:\n${context || 'n/a'}`,
          },
        ],
      });
      return { analysis: out.text };
    });

    ctx.http.post('/hotspots', async (req) => {
      const { profile } = (req.body || {}) as { profile: string };
      await ctx.permissions.require('ai.invoke', 'perf.hotspots', 'Analyze profile');
      const out = await ctx.ai.complete({
        system: 'You analyze CPU/heap profiles and rank hotspots.',
        messages: [{ role: 'user', content: `Profile summary:\n\n${profile}` }],
      });
      return { report: out.text };
    });

    ctx.log.info('Bug/Perf plugin activated');
  },

  async deactivate() {},
});
