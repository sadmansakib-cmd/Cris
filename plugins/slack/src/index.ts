import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Slack — Post messages via incoming webhook or bot token (chat.postMessage). Phase 4.
 */

export default definePlugin({
  id: 'hault.slack',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.slack' }));

    ctx.http.post('/webhook', async (req) => {
      const { url, text } = (req.body || {}) as { url: string; text: string };
      if (!url || !text) throw new Error('url and text required');
      const host = new URL(url).host;
      await ctx.permissions.require('net.fetch', `host:${host}`, `Post to Slack webhook (${host})`);
      await ctx.permissions.require('message.send', 'channel:slack', 'Send a Slack message');
      const res = await ctx.net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
      await ctx.audit.log('slack.webhook.post', { host });
      return { ok: true };
    });

    ctx.http.post('/message', async (req) => {
      const { channel, text } = (req.body || {}) as { channel: string; text: string };
      if (!channel || !text) throw new Error('channel and text required');
      await ctx.permissions.require('secret.read', 'key:slack.bot.token', 'Use your stored Slack bot token');
      const token = await ctx.settings.getSecret('slack.bot.token');
      if (!token) throw new Error('Slack bot token not configured');
      await ctx.permissions.require('net.fetch', 'host:slack.com', 'Call the Slack API');
      await ctx.permissions.require('message.send', `channel:slack:${channel}`, `Send a Slack message to ${channel}`);
      const res = await ctx.net.fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ channel, text }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(`Slack API: ${body.error}`);
      await ctx.audit.log('slack.chat.post', { channel });
      return { ok: true, ts: body.ts };
    });

    ctx.log.info('Slack plugin activated');
  },

  async deactivate() {},
});
