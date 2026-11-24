import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Voice Trigger — Wake-word activation.
 *
 * Real wake-word audio capture happens in the native shell (Tauri/Expo).
 * This plugin owns the phrase → command mapping and dispatches to other
 * plugins when the shell POSTs `/detected`. It also exposes a text-only
 * `/simulate` endpoint for testing without hardware.
 */

interface Binding {
  id: string;
  phrase: string;         // wake phrase (lowercased, matched by contains)
  plugin: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: any;
  enabled: boolean;
}

const KEY = 'bindings';
const LOG = 'log';

export default definePlugin({
  id: 'hault.voice-trigger',
  async activate(ctx: PluginContext) {
    const load = async () => (await ctx.kv.get<Binding[]>(KEY)) ?? [];
    const save = (b: Binding[]) => ctx.kv.set(KEY, b);

    const dispatch = async (transcript: string) => {
      const bindings = await load();
      const norm = transcript.toLowerCase();
      const hits = bindings.filter((b) => b.enabled && norm.includes(b.phrase.toLowerCase()));
      const fired: any[] = [];
      for (const b of hits) {
        try {
          const res = await ctx.host.invoke(b.plugin, b.method, b.path, b.body ?? { transcript });
          fired.push({ id: b.id, ok: true, res });
        } catch (err: any) {
          fired.push({ id: b.id, ok: false, error: String(err?.message ?? err) });
        }
      }
      const logRows = (await ctx.kv.get<any[]>(LOG)) ?? [];
      logRows.unshift({ at: new Date().toISOString(), transcript, fired });
      await ctx.kv.set(LOG, logRows.slice(0, 100));
      await ctx.audit.log('voice.trigger', { transcript, count: fired.length });
      await ctx.events.emit('voice.transcript', { transcript, fired });
      return fired;
    };

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.voice-trigger' }));

    ctx.http.get('/bindings', async () => load());

    ctx.http.post('/bindings', async (req) => {
      await ctx.permissions.require('voice.wakeword', 'device:*', `Bind phrase "${req.body?.phrase}"`);
      const bindings = await load();
      const b: Binding = {
        id: crypto.randomUUID(),
        phrase: req.body?.phrase ?? '',
        plugin: req.body?.plugin,
        method: req.body?.method ?? 'POST',
        path: req.body?.path,
        body: req.body?.body,
        enabled: req.body?.enabled ?? true,
      };
      bindings.push(b);
      await save(bindings);
      return b;
    });

    ctx.http.delete('/bindings/:id', async (req) => {
      await save((await load()).filter((b) => b.id !== req.params.id));
      return { ok: true };
    });

    // Called by native shell after wake-word + STT.
    ctx.http.post('/detected', async (req) => {
      const transcript = String(req.body?.transcript ?? '');
      if (!transcript) return { ok: false, reason: 'empty transcript' };
      return { ok: true, fired: await dispatch(transcript) };
    });

    // Text-only manual trigger for the web UI.
    ctx.http.post('/simulate', async (req) => {
      return { ok: true, fired: await dispatch(String(req.body?.transcript ?? '')) };
    });

    ctx.http.get('/log', async () => (await ctx.kv.get<any[]>(LOG)) ?? []);

    ctx.log.info('Voice Trigger plugin activated');
  },
  async deactivate() {},
});
