import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * AI Chat plugin — reference implementation.
 * Demonstrates: streaming chat completions, thread persistence, per-thread system prompts.
 */
export default definePlugin({
  id: 'hault.ai-chat',
  async activate(ctx: PluginContext) {
    // REST: list threads
    ctx.http.get('/threads', async (req) => {
      await ctx.permissions.require('storage.read', `namespace:ai-chat/${req.userId}`, 'List chat threads');
      return ctx.storage.list(`ai-chat/${req.userId}/threads/`);
    });

    // REST: create thread
    ctx.http.post('/threads', async (req) => {
      await ctx.permissions.require('storage.write', `namespace:ai-chat/${req.userId}`, 'Create chat thread');
      const id = crypto.randomUUID();
      const thread = { id, title: 'New chat', createdAt: Date.now(), messages: [] as any[] };
      await ctx.storage.put(`ai-chat/${req.userId}/threads/${id}`, Buffer.from(JSON.stringify(thread)), 'application/json');
      return thread;
    });

    // WS: stream a completion
    ctx.ws.on('chat.send', async (msg: { threadId: string; content: string; model?: string }, socket) => {
      const userId = socket.data.userId;
      const key = `ai-chat/${userId}/threads/${msg.threadId}`;
      const thread = JSON.parse((await ctx.storage.get(key)).toString());
      thread.messages.push({ role: 'user', content: msg.content, ts: Date.now() });
      await ctx.permissions.require('ai.chat.completion', `provider:${msg.model || '*'}`, 'Send prompt to AI provider');

      const settings = await ctx.settings.getAll();
      const stream = await ctx.ai.chat.stream({
        model: msg.model || settings.defaultModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: settings.systemPrompt || 'You are a helpful assistant.' },
          ...thread.messages,
        ],
      });

      let full = '';
      for await (const delta of stream) {
        full += delta;
        socket.emit('chat.delta', { threadId: msg.threadId, delta });
      }
      thread.messages.push({ role: 'assistant', content: full, ts: Date.now() });
      await ctx.storage.put(key, Buffer.from(JSON.stringify(thread)), 'application/json');
      socket.emit('chat.done', { threadId: msg.threadId });
    });

    ctx.log.info('AI Chat plugin activated');
  },
  async deactivate() {
    /* no-op */
  },
});
