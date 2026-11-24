import { definePlugin, type PluginContext } from '@hault/sdk';
import { randomUUID } from 'node:crypto';

interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  remindMinutes?: number;
}

function toICS(events: Event[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HAULT//Calendar//EN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@hault`);
    lines.push(`DTSTART:${e.start.replace(/[-:]/g, '').replace(/\.\d+/, '')}`);
    lines.push(`DTEND:${e.end.replace(/[-:]/g, '').replace(/\.\d+/, '')}`);
    lines.push(`SUMMARY:${e.title}`);
    if (e.location) lines.push(`LOCATION:${e.location}`);
    if (e.notes) lines.push(`DESCRIPTION:${e.notes.replace(/\n/g, '\\n')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

async function load(ctx: PluginContext): Promise<Event[]> {
  return (await ctx.kv.get('events')) || [];
}

export default definePlugin({
  id: 'hault.calendar',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.calendar' }));

    ctx.http.get('/events', async (req) => {
      const list = await load(ctx);
      const from = (req.query?.from as string) || '';
      const to = (req.query?.to as string) || '';
      return list
        .filter((e) => (!from || e.end >= from) && (!to || e.start <= to))
        .sort((a, b) => a.start.localeCompare(b.start));
    });

    ctx.http.post('/events', async (req) => {
      const list = await load(ctx);
      const e: Event = { id: randomUUID(), ...(req.body as any) };
      list.push(e);
      await ctx.kv.set('events', list);
      if (e.remindMinutes && e.remindMinutes > 0) {
        const remindAt = new Date(new Date(e.start).getTime() - e.remindMinutes * 60_000).toISOString();
        await ctx.audit.log('calendar.reminder-scheduled', { id: e.id, remindAt });
      }
      return e;
    });

    ctx.http.post('/events/:id/delete', async (req) => {
      const list = (await load(ctx)).filter((e) => e.id !== (req.params as any).id);
      await ctx.kv.set('events', list);
      return { ok: true };
    });

    ctx.http.get('/export.ics', async () => ({ ics: toICS(await load(ctx)) }));

    ctx.log.info('Calendar plugin activated');
  },
  async deactivate() {},
});
