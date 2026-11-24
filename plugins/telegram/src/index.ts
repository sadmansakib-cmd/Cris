import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Telegram — Send messages via a bot token. Phase 4.
 */

export default definePlugin({
  id: 'hault.telegram',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.telegram' }));

    ctx.http.post('/send', async (req) => {
      const { chatId, text } = (req.body || {}) as { chatId: string; text: string };
      if (!chatId || !text) throw new Error('chatId and text required');
      await ctx.permissions.require('secret.read', 'key:telegram.bot.token', 'Use your stored Telegram bot token');
      const token = await ctx.settings.getSecret('telegram.bot.token');
      if (!token) throw new Error('Telegram bot token not configured');

      await ctx.permissions.require('net.fetch', 'host:api.telegram.org', 'Call the Telegram Bot API');
      await ctx.permissions.require('message.send', `channel:telegram:${chatId}`, `Send a Telegram message to ${chatId}`);

      const res = await ctx.net.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(`Telegram API: ${body.description}`);
      await ctx.audit.log('telegram.send', { chatId });
      return { ok: true, messageId: body.result.message_id };
    });

    ctx.log.info('Telegram plugin activated');
  },

  async deactivate() {},
});
