import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Gmail — Read, compose, label Gmail via OAuth (Phase 4).
 * Uses host OAuth token store via ctx.oauth. Every network call is permission-gated.
 */

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface MessageSummary {
  id: string;
  threadId: string;
  from?: string;
  subject?: string;
  snippet?: string;
  date?: string;
  unread: boolean;
}

async function gapi(ctx: PluginContext, path: string, init: RequestInit = {}) {
  const token = await ctx.oauth.getAccessToken('google');
  if (!token) throw new Error('Google account not connected');
  const res = await ctx.net.fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

function header(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function buildRawMime(to: string, subject: string, body: string) {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

export default definePlugin({
  id: 'hault.gmail',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.gmail' }));

    ctx.http.get('/inbox', async (req) => {
      await ctx.permissions.require('oauth.token.read', 'provider:google', 'Read Gmail via your Google account');
      await ctx.permissions.require('net.fetch', 'host:gmail.googleapis.com', 'Call the Gmail API');

      const max = Math.min(Number(req.query?.max ?? 20), 100);
      const list = await gapi(ctx, `/messages?maxResults=${max}&labelIds=INBOX`);
      const ids: Array<{ id: string; threadId: string }> = list.messages || [];

      const messages: MessageSummary[] = await Promise.all(
        ids.map(async ({ id, threadId }) => {
          const msg = await gapi(
            ctx,
            `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          );
          const h = msg.payload?.headers || [];
          return {
            id,
            threadId,
            from: header(h, 'From'),
            subject: header(h, 'Subject'),
            snippet: msg.snippet,
            date: header(h, 'Date'),
            unread: (msg.labelIds || []).includes('UNREAD'),
          };
        }),
      );

      return { messages };
    });

    ctx.http.get('/message/:id', async (req) => {
      await ctx.permissions.require('oauth.token.read', 'provider:google', 'Read a Gmail message');
      await ctx.permissions.require('net.fetch', 'host:gmail.googleapis.com', 'Call the Gmail API');
      const id = req.params?.id;
      if (!id) throw new Error('missing id');
      return { message: await gapi(ctx, `/messages/${id}?format=full`) };
    });

    ctx.http.post('/send', async (req) => {
      const { to, subject, body } = (req.body || {}) as {
        to: string;
        subject: string;
        body: string;
      };
      if (!to || !subject) throw new Error('to and subject required');

      await ctx.permissions.require('oauth.token.read', 'provider:google', 'Send mail as your Google account');
      await ctx.permissions.require('net.fetch', 'host:gmail.googleapis.com', 'Call the Gmail API');
      await ctx.permissions.require('email.send', `to:${to}`, `Send email to ${to}`);

      const raw = buildRawMime(to, subject, body ?? '');
      const sent = await gapi(ctx, `/messages/send`, {
        method: 'POST',
        body: JSON.stringify({ raw }),
      });
      await ctx.audit.log('gmail.send', { to, subject, messageId: sent.id });
      return { ok: true, id: sent.id, threadId: sent.threadId };
    });

    ctx.http.post('/modify', async (req) => {
      await ctx.permissions.require('oauth.token.read', 'provider:google', 'Modify Gmail labels');
      await ctx.permissions.require('net.fetch', 'host:gmail.googleapis.com', 'Call the Gmail API');
      const { id, addLabels = [], removeLabels = [] } = req.body || {};
      if (!id) throw new Error('id required');
      const r = await gapi(ctx, `/messages/${id}/modify`, {
        method: 'POST',
        body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
      });
      return { ok: true, labels: r.labelIds };
    });

    ctx.log.info('Gmail plugin activated');
  },

  async deactivate() {},
});
