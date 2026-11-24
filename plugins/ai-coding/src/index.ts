import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * AI Coding — code generation, review, refactor, and test scaffolding.
 * Delegates to the core AI engine via `ctx.ai` for provider-agnostic access.
 */

const SYSTEM = `You are HAULT-Coder, a senior polyglot engineer. Produce
concise, correct, production-grade code. Prefer standard libraries. Include
inline comments only where non-obvious. When asked to refactor, preserve
public API unless told otherwise.`;

export default definePlugin({
  id: 'hault.ai-coding',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.ai-coding' }));

    ctx.http.post('/generate', async (req) => {
      const { language, spec } = (req.body || {}) as { language: string; spec: string };
      await ctx.permissions.require('ai.invoke', 'coding.generate', 'Generate code');
      const out = await ctx.ai.complete({
        system: SYSTEM,
        messages: [
          { role: 'user', content: `Language: ${language}\n\nWrite:\n${spec}` },
        ],
      });
      return { code: out.text };
    });

    ctx.http.post('/review', async (req) => {
      const { code, language } = (req.body || {}) as { code: string; language: string };
      await ctx.permissions.require('ai.invoke', 'coding.review', 'Review code');
      const out = await ctx.ai.complete({
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              `Review the following ${language} code. List bugs, smells, and ` +
              `security issues. Suggest concrete diffs.\n\n\`\`\`${language}\n${code}\n\`\`\``,
          },
        ],
      });
      return { review: out.text };
    });

    ctx.http.post('/refactor', async (req) => {
      const { code, language, goal } = (req.body || {}) as any;
      await ctx.permissions.require('ai.invoke', 'coding.refactor', 'Refactor code');
      const out = await ctx.ai.complete({
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              `Refactor this ${language} for: ${goal}. Return ONLY the new code.\n\n` +
              `\`\`\`${language}\n${code}\n\`\`\``,
          },
        ],
      });
      return { code: out.text };
    });

    ctx.http.post('/tests', async (req) => {
      const { code, language, framework } = (req.body || {}) as any;
      await ctx.permissions.require('ai.invoke', 'coding.tests', 'Generate tests');
      const out = await ctx.ai.complete({
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              `Write ${framework} tests for the following ${language} code. Cover ` +
              `happy paths, edge cases, and error handling.\n\n` +
              `\`\`\`${language}\n${code}\n\`\`\``,
          },
        ],
      });
      return { tests: out.text };
    });

    ctx.log.info('AI Coding plugin activated');
  },

  async deactivate() {},
});
