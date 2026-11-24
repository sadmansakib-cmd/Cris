import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Code Docs — generate docstrings, READMEs, and API references from source.
 */
export default definePlugin({
  id: 'hault.code-docs',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.code-docs' }));

    ctx.http.post('/docstrings', async (req) => {
      const { code, language, style = 'jsdoc' } = (req.body || {}) as any;
      await ctx.permissions.require('ai.invoke', 'docs.docstrings', 'Generate docstrings');
      const out = await ctx.ai.complete({
        system: 'You add high-quality docstrings without changing behavior.',
        messages: [
          {
            role: 'user',
            content:
              `Add ${style} docstrings to this ${language} code. Return ONLY the ` +
              `updated code.\n\n\`\`\`${language}\n${code}\n\`\`\``,
          },
        ],
      });
      return { code: out.text };
    });

    ctx.http.post('/readme', async (req) => {
      const { files } = (req.body || {}) as { files: Array<{ path: string; content: string }> };
      await ctx.permissions.require('ai.invoke', 'docs.readme', 'Generate README');
      const listing = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\``).join('\n\n');
      const out = await ctx.ai.complete({
        system: 'You write clear developer READMEs.',
        messages: [
          { role: 'user', content: `Draft a README.md for this project.\n\n${listing}` },
        ],
      });
      return { markdown: out.text };
    });

    ctx.log.info('Code Docs plugin activated');
  },

  async deactivate() {},
});
