import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'rules' | 'runs' | 'voice';

export function Automations() {
  const [tab, setTab] = useState<Tab>('rules');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['rules', 'runs', 'voice'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 capitalize ${
              tab === t ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'rules' && <Rules />}
      {tab === 'runs' && <Runs />}
      {tab === 'voice' && <Voice />}
    </div>
  );
}

function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [triggerKind, setTriggerKind] = useState<'event' | 'cron' | 'webhook'>('event');
  const [triggerValue, setTriggerValue] = useState('voice.transcript');
  const [plugin, setPlugin] = useState('hault.notes');
  const [method, setMethod] = useState('POST');
  const [path, setPath] = useState('/notes');
  const [body, setBody] = useState('{}');

  const refresh = async () => setRules(await apiFetch('/plugins/hault.automations/rules'));
  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    const trigger =
      triggerKind === 'event'
        ? { kind: 'event', event: triggerValue }
        : triggerKind === 'cron'
        ? { kind: 'cron', cron: triggerValue }
        : { kind: 'webhook', hook: triggerValue };
    let parsed: any = undefined;
    try {
      parsed = body.trim() ? JSON.parse(body) : undefined;
    } catch {
      alert('body must be JSON');
      return;
    }
    await apiFetch('/plugins/hault.automations/rules', {
      method: 'POST',
      body: JSON.stringify({ name, trigger, actions: [{ plugin, method, path, body: parsed }] }),
    });
    setName('');
    refresh();
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 rounded bg-neutral-900 p-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded bg-neutral-800 px-2 py-1" />
        <div className="flex gap-2">
          <select value={triggerKind} onChange={(e) => setTriggerKind(e.target.value as any)} className="rounded bg-neutral-800 px-2 py-1">
            <option value="event">event</option>
            <option value="cron">cron</option>
            <option value="webhook">webhook</option>
          </select>
          <input value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} placeholder="event / cron / hook" className="flex-1 rounded bg-neutral-800 px-2 py-1" />
        </div>
        <input value={plugin} onChange={(e) => setPlugin(e.target.value)} placeholder="plugin id" className="rounded bg-neutral-800 px-2 py-1" />
        <div className="flex gap-2">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded bg-neutral-800 px-2 py-1">
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path" className="flex-1 rounded bg-neutral-800 px-2 py-1" />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"body":"…"}' className="h-20 rounded bg-neutral-800 px-2 py-1 font-mono text-xs md:col-span-2" />
        <button onClick={create} className="rounded bg-blue-600 px-3 py-1 text-white md:col-span-2">Create rule</button>
      </div>

      <ul className="space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {r.trigger?.kind}:{r.trigger?.event || r.trigger?.cron || r.trigger?.hook}
                </span>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={async () => { await apiFetch(`/plugins/hault.automations/rules/${r.id}/run`, { method: 'POST' }); }} className="text-blue-400">run</button>
                <button onClick={async () => { await apiFetch(`/plugins/hault.automations/rules/${r.id}`, { method: 'DELETE' }); refresh(); }} className="text-red-400">delete</button>
              </div>
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {r.actions?.length} action(s) · {r.lastRunAt ? `last ran ${r.lastRunAt}` : 'never run'}
              {r.lastError && <span className="ml-2 text-red-400">err: {r.lastError}</span>}
            </div>
          </li>
        ))}
        {rules.length === 0 && <li className="text-neutral-500">No rules yet.</li>}
      </ul>
    </div>
  );
}

function Runs() {
  const [runs, setRuns] = useState<any[]>([]);
  useEffect(() => {
    const load = () => apiFetch('/plugins/hault.automations/runs').then(setRuns);
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <ul className="space-y-1 text-sm">
      {runs.map((r) => (
        <li key={r.id} className="rounded bg-neutral-900 px-3 py-2">
          <div className="text-xs text-neutral-500">{r.at} · {r.ok ? '✅' : '❌'}</div>
          <pre className="mt-1 overflow-x-auto text-xs text-neutral-300">{JSON.stringify(r.detail, null, 2)}</pre>
        </li>
      ))}
      {runs.length === 0 && <li className="text-neutral-500">No runs.</li>}
    </ul>
  );
}

function Voice() {
  const [bindings, setBindings] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [phrase, setPhrase] = useState('');
  const [plugin, setPlugin] = useState('hault.notes');
  const [path, setPath] = useState('/notes');
  const [transcript, setTranscript] = useState('');

  const refresh = async () => {
    setBindings(await apiFetch('/plugins/hault.voice-trigger/bindings'));
    setLog(await apiFetch('/plugins/hault.voice-trigger/log'));
  };
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 rounded bg-neutral-900 p-3 md:grid-cols-4">
        <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="wake phrase" className="rounded bg-neutral-800 px-2 py-1" />
        <input value={plugin} onChange={(e) => setPlugin(e.target.value)} placeholder="plugin id" className="rounded bg-neutral-800 px-2 py-1" />
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path" className="rounded bg-neutral-800 px-2 py-1" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.voice-trigger/bindings', {
              method: 'POST',
              body: JSON.stringify({ phrase, plugin, method: 'POST', path }),
            });
            setPhrase('');
            refresh();
          }}
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          Bind
        </button>
      </div>

      <ul className="space-y-1">
        {bindings.map((b) => (
          <li key={b.id} className="flex items-center justify-between rounded bg-neutral-900 px-3 py-2">
            <div>
              <span className="font-medium">"{b.phrase}"</span>
              <span className="ml-2 text-xs text-neutral-500">→ {b.plugin} {b.method} {b.path}</span>
            </div>
            <button
              onClick={async () => { await apiFetch(`/plugins/hault.voice-trigger/bindings/${b.id}`, { method: 'DELETE' }); refresh(); }}
              className="text-xs text-red-400"
            >
              delete
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded bg-neutral-900 p-3">
        <div className="mb-2 text-xs text-neutral-500">Simulate a transcript (no mic required):</div>
        <div className="flex gap-2">
          <input value={transcript} onChange={(e) => setTranscript(e.target.value)} className="flex-1 rounded bg-neutral-800 px-2 py-1" placeholder="hey hault, take a note …" />
          <button
            onClick={async () => {
              await apiFetch('/plugins/hault.voice-trigger/simulate', { method: 'POST', body: JSON.stringify({ transcript }) });
              setTranscript('');
              refresh();
            }}
            className="rounded bg-neutral-800 px-3 py-1"
          >
            Fire
          </button>
        </div>
      </div>

      <ul className="space-y-1">
        {log.map((l, i) => (
          <li key={i} className="rounded bg-neutral-900 px-3 py-2 text-xs">
            <div className="text-neutral-500">{l.at}</div>
            <div className="text-neutral-200">"{l.transcript}"</div>
            <div className="text-neutral-500">fired {l.fired?.length ?? 0}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
