import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'rag' | 'eval';

export function AiEngine() {
  const [tab, setTab] = useState<Tab>('rag');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['rag', 'eval'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 uppercase ${
              tab === t ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'rag' ? <Rag /> : <Evals />}
    </div>
  );
}

function Rag() {
  const [ns, setNs] = useState('default');
  const [docId, setDocId] = useState('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<any[]>([]);
  const [namespaces, setNamespaces] = useState<any[]>([]);

  const refresh = async () => setNamespaces(await apiFetch('/ai/engine/rag/namespaces'));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Index document</div>
        <div className="grid grid-cols-3 gap-2">
          <input value={ns} onChange={(e) => setNs(e.target.value)} placeholder="namespace" className="rounded bg-neutral-900 px-2 py-1" />
          <input value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="doc id" className="rounded bg-neutral-900 px-2 py-1" />
          <button
            onClick={async () => {
              if (!docId || !text) return;
              await apiFetch('/ai/engine/rag/index', {
                method: 'POST',
                body: JSON.stringify({ namespace: ns, docId, text }),
              });
              setText('');
              refresh();
            }}
            className="rounded bg-neutral-800 px-3 py-1"
          >
            Index
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste document text…"
          className="mt-2 w-full rounded bg-neutral-900 px-2 py-1 font-mono text-xs"
        />
      </div>

      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Query</div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ask…" className="flex-1 rounded bg-neutral-900 px-2 py-1" />
          <button
            onClick={async () => setHits(await apiFetch('/ai/engine/rag/query', { method: 'POST', body: JSON.stringify({ namespace: ns, query: q, k: 5 }) }))}
            className="rounded bg-neutral-800 px-3 py-1"
          >
            Retrieve
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          {hits.map((h) => (
            <li key={h.id} className="rounded bg-neutral-900 px-3 py-2">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{h.id}</span>
                <span>score {h.score.toFixed(3)}</span>
              </div>
              <div className="whitespace-pre-wrap font-mono text-xs">{h.text}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-xs uppercase text-neutral-500">Your namespaces</div>
        <div className="flex flex-wrap gap-2">
          {namespaces.map((n) => (
            <span key={n.ns} className="rounded bg-neutral-900 px-2 py-1 text-xs">
              {n.ns.split(':').slice(1).join(':')} · {n.size}
            </span>
          ))}
          {namespaces.length === 0 && <span className="text-xs text-neutral-500">none</span>}
        </div>
      </div>
    </div>
  );
}

function Evals() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [name, setName] = useState('smoke');
  const [dsJson, setDsJson] = useState(
    JSON.stringify(
      [
        { id: 'greet', prompt: 'Say hello in one word.', contains: ['hello'] },
        { id: 'math', prompt: 'What is 2+2? Reply with only the number.', regex: '^\\s*4\\s*$', scorer: 'regex' },
      ],
      null,
      2,
    ),
  );
  const [model, setModel] = useState('openai:gpt-4o-mini');

  const refresh = async () => {
    setDatasets(await apiFetch('/ai/engine/eval/datasets'));
    setRuns(await apiFetch('/ai/engine/eval/runs'));
  };
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Golden dataset</div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded bg-neutral-900 px-2 py-1" />
          <button
            onClick={async () => {
              await apiFetch('/ai/engine/eval/datasets', {
                method: 'POST',
                body: JSON.stringify({ name, cases: JSON.parse(dsJson) }),
              });
              refresh();
            }}
            className="rounded bg-neutral-800 px-3 py-1"
          >
            Save
          </button>
        </div>
        <textarea
          value={dsJson}
          onChange={(e) => setDsJson(e.target.value)}
          rows={8}
          className="mt-2 w-full rounded bg-neutral-900 px-2 py-1 font-mono text-xs"
        />
        <div className="mt-1 flex flex-wrap gap-2">
          {datasets.map((d) => (
            <span key={d.name} className="rounded bg-neutral-900 px-2 py-1 text-xs">
              {d.name} · {d.size} cases
            </span>
          ))}
        </div>
      </div>

      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Run</div>
        <div className="flex gap-2">
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="provider:model" className="flex-1 rounded bg-neutral-900 px-2 py-1" />
          <button
            onClick={async () => {
              await apiFetch('/ai/engine/eval/run', { method: 'POST', body: JSON.stringify({ dataset: name, model }) });
              refresh();
            }}
            className="rounded bg-neutral-800 px-3 py-1"
          >
            Evaluate
          </button>
        </div>
      </div>

      <ul className="space-y-1">
        {runs.map((r) => (
          <li key={r.id} className="rounded bg-neutral-900 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="font-mono">{r.id.slice(0, 8)}</span>
              <span>{r.model}</span>
            </div>
            <div className="mt-1 text-neutral-400">
              {r.summary.passed}/{r.summary.total} passed · avg {r.summary.avgScore} · {r.summary.avgLatencyMs}ms
            </div>
          </li>
        ))}
        {runs.length === 0 && <li className="text-neutral-500">no runs yet</li>}
      </ul>
    </div>
  );
}
