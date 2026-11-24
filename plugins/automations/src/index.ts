import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Automations — IFTTT-style trigger → action pipelines.
 *
 * Rule shape:
 *   {
 *     id, name, enabled,
 *     trigger: { kind: 'event'|'cron'|'webhook', event?, cron?, hook? },
 *     actions: [{ plugin, method, path, body?, mapFromTrigger? }]
 *   }
 *
 * On activation, all enabled rules are registered with the host event bus /
 * scheduler. Webhook triggers are exposed at POST /hook/:hook.
 */

type Trigger =
  | { kind: 'event'; event: string }
  | { kind: 'cron'; cron: string }
  | { kind: 'webhook'; hook: string };

interface Action {
  plugin: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: any;
}

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  actions: Action[];
  createdAt: string;
  lastRunAt?: string;
  lastError?: string;
}

const RULES_KEY = 'rules';
const RUNS_KEY = 'runs';

export default definePlugin({
  id: 'hault.automations',
  async activate(ctx: PluginContext) {
    const cancellers = new Map<string, { cancel(): void }>();

    const loadRules = async (): Promise<Rule[]> => (await ctx.kv.get<Rule[]>(RULES_KEY)) ?? [];
    const saveRules = (rules: Rule[]) => ctx.kv.set(RULES_KEY, rules);

    const recordRun = async (rule: Rule, ok: boolean, detail: unknown) => {
      const runs = (await ctx.kv.get<any[]>(RUNS_KEY)) ?? [];
      runs.unshift({ id: crypto.randomUUID(), ruleId: rule.id, ok, detail, at: new Date().toISOString() });
      await ctx.kv.set(RUNS_KEY, runs.slice(0, 200));
    };

    const runActions = async (rule: Rule, payload: unknown) => {
      const results: any[] = [];
      for (const a of rule.actions) {
        try {
          const body = a.body ?? payload;
          const res = await ctx.host.invoke(a.plugin, a.method, a.path, body);
          results.push({ ok: true, res });
        } catch (err: any) {
          results.push({ ok: false, error: String(err?.message ?? err) });
          rule.lastError = String(err?.message ?? err);
        }
      }
      rule.lastRunAt = new Date().toISOString();
      await ctx.audit.log('automation.run', { ruleId: rule.id, results });
      await recordRun(rule, results.every((r) => r.ok), results);
    };

    const bindRule = (rule: Rule) => {
      if (!rule.enabled) return;
      if (rule.trigger.kind === 'event') {
        const sub = ctx.events.on(rule.trigger.event, (p) => runActions(rule, p));
        cancellers.set(rule.id, { cancel: () => sub.off() });
      } else if (rule.trigger.kind === 'cron') {
        const c = ctx.scheduler.cron(rule.trigger.cron, () => runActions(rule, { firedAt: new Date().toISOString() }));
        cancellers.set(rule.id, c);
      }
    };

    const unbind = (id: string) => {
      cancellers.get(id)?.cancel();
      cancellers.delete(id);
    };

    const rebindAll = async () => {
      for (const [, c] of cancellers) c.cancel();
      cancellers.clear();
      for (const r of await loadRules()) bindRule(r);
    };

    await rebindAll();

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.automations' }));

    ctx.http.get('/rules', async () => loadRules());

    ctx.http.post('/rules', async (req) => {
      await ctx.permissions.require('plugin.invoke', '*', 'Create automation');
      const rules = await loadRules();
      const rule: Rule = {
        id: crypto.randomUUID(),
        name: req.body?.name ?? 'Untitled',
        enabled: req.body?.enabled ?? true,
        trigger: req.body?.trigger,
        actions: req.body?.actions ?? [],
        createdAt: new Date().toISOString(),
      };
      rules.push(rule);
      await saveRules(rules);
      bindRule(rule);
      return rule;
    });

    ctx.http.patch('/rules/:id', async (req) => {
      const rules = await loadRules();
      const idx = rules.findIndex((r) => r.id === req.params.id);
      if (idx < 0) throw new Error('not found');
      rules[idx] = { ...rules[idx], ...req.body };
      await saveRules(rules);
      unbind(rules[idx].id);
      bindRule(rules[idx]);
      return rules[idx];
    });

    ctx.http.delete('/rules/:id', async (req) => {
      const rules = (await loadRules()).filter((r) => r.id !== req.params.id);
      await saveRules(rules);
      unbind(req.params.id);
      return { ok: true };
    });

    ctx.http.post('/rules/:id/run', async (req) => {
      const rule = (await loadRules()).find((r) => r.id === req.params.id);
      if (!rule) throw new Error('not found');
      await runActions(rule, req.body ?? { manual: true });
      return { ok: true };
    });

    ctx.http.post('/hook/:hook', async (req) => {
      const rules = await loadRules();
      const matched = rules.filter(
        (r) => r.enabled && r.trigger.kind === 'webhook' && r.trigger.hook === req.params.hook,
      );
      for (const r of matched) await runActions(r, req.body);
      return { ok: true, fired: matched.length };
    });

    ctx.http.get('/runs', async () => (await ctx.kv.get<any[]>(RUNS_KEY)) ?? []);

    ctx.log.info('Automations plugin activated');
  },
  async deactivate() {},
});
