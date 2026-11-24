import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Contact {
  id: string;
  name: string;
  emails?: string[];
  phones?: string[];
  org?: string;
  tags?: string[];
  source?: 'local' | 'google' | 'outlook';
  createdAt: string;
}

async function load(ctx: PluginContext): Promise<Contact[]> {
  return (await ctx.kv.get('contacts')) || [];
}

export default definePlugin({
  id: 'hault.contacts',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.contacts' }));

    ctx.http.get('/contacts', async (req) => {
      const q = ((req.query?.q as string) || '').toLowerCase();
      const list = await load(ctx);
      if (!q) return list;
      return list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.emails || []).some((e) => e.toLowerCase().includes(q)) ||
          (c.org || '').toLowerCase().includes(q),
      );
    });

    ctx.http.post('/contacts', async (req) => {
      const list = await load(ctx);
      const c: Contact = {
        id: randomUUID(),
        source: 'local',
        createdAt: new Date().toISOString(),
        ...(req.body as any),
      };
      list.push(c);
      await ctx.kv.set('contacts', list);
      return c;
    });

    ctx.http.post('/sync/google', async () => {
      await ctx.permissions.require('net.fetch', 'host:people.googleapis.com', 'Sync Google contacts');
      const token = await ctx.oauth.token('google');
      if (!token) throw new Error('Google not connected');
      const res = await ctx.net.fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=200',
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Google ${res.status}`);
      const data = (await res.json()) as any;
      const list = await load(ctx);
      const now = new Date().toISOString();
      let added = 0;
      for (const p of data.connections || []) {
        const name = p.names?.[0]?.displayName;
        if (!name) continue;
        const emails = (p.emailAddresses || []).map((e: any) => e.value).filter(Boolean);
        const phones = (p.phoneNumbers || []).map((e: any) => e.value).filter(Boolean);
        const org = p.organizations?.[0]?.name;
        if (list.find((c) => c.source === 'google' && c.name === name)) continue;
        list.push({ id: randomUUID(), name, emails, phones, org, source: 'google', createdAt: now });
        added++;
      }
      await ctx.kv.set('contacts', list);
      return { added, total: list.length };
    });

    ctx.log.info('Contacts plugin activated');
  },
  async deactivate() {},
});
