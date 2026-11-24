import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Discord — Post messages via webhook or bot token. Phase 4.
 */

export default definePlugin({
  id: 'hault.discord',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.discord' }));

    ctx.http.post('/webhook', async (req) => {
      const { url, content, username } = (req.body || {}) as {
        url: string;
        content: string;
        username?: string;
      };
      if (!url || !content) throw new Error('url and content required');

      const host = new URL(url).host;
      await ctx.permissions.require('net.fetch', `host:${host}`, `Post to Discord webhook (${host})`);
      await ctx.permissions.require('message.send', 'channel:discord', 'Send a Discord message');

      const res = await ctx.net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, username }),
      });
      if (!res.ok) throw new Error(`Discord webhook ${res.status}`);
      await ctx.audit.log('discord.webhook.post', { host });
      return { ok: true };
    });

    ctx.http.post('/channel', async (req) => {
      const { channelId, content } = (req.body || {}) as {
        channelId: string;
        content: string;
      };
      if (!channelId || !content) throw new Error('channelId and content required');

      await ctx.permissions.require('secret.read', 'key:discord.bot.token', 'Use your stored Discord bot token');
      const token = await ctx.settings.getSecret('discord.bot.token');
      if (!token) throw new Error('Discord bot token not configured');

      await ctx.permissions.require('net.fetch', 'host:discord.com', 'Call the Discord API');
      await ctx.permissions.require('message.send', `channel:discord:${channelId}`, `Send a message to channel ${channelId}`);

      const res = await ctx.net.fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`);
      await ctx.audit.log('discord.channel.post', { channelId });
      return { ok: true, message: await res.json() };
    });

    ctx.log.info('Discord plugin activated');
  },

  async deactivate() {},
});
