# Phase 9 — Automations & Voice

Landed plugins:

- `hault.automations` — trigger → action pipelines. Triggers: `event` (host
  event bus via `ctx.events`), `cron` (`ctx.scheduler.cron`), `webhook`
  (POST `/hook/:hook`). Actions call other plugins via `ctx.host.invoke`.
  Runs are recorded (last 200) and audited.
- `hault.voice-trigger` — wake-phrase → plugin dispatch. Real audio capture
  lives in the native shell (`/detected` endpoint); web UI exposes
  `/simulate` for text-only testing.

## SDK surfaces added

- `ctx.host.invoke(pluginId, method, path, body?)` — cross-plugin calls
  already used by `hault.knowledge-graph`, now formalized.
- `ctx.scheduler.cron(expr, fn)` / `ctx.scheduler.after(ms, fn)` — recurring
  and one-shot jobs, backed by the runtime scheduler.
- `ctx.events.on(event, fn)` / `ctx.events.emit(event, payload)` — pub/sub
  event bus (`voice.transcript`, custom user events).

Web: `Automations` tabbed page (Rules, Runs, Voice) wired into the sidebar.
