import { useState } from 'react';
import { apiFetch } from '../lib/api';

interface Source { n: number; url: string; title?: string }

export function Research() {
  const [q, setQ] = useState('');
  const [maxSources, setMaxSources] = useState(5);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null); setAnswer(''); setSources([]);
    try {
      const r = await apiFetch('/plugins/hault.research-mode/run', {
        method: 'POST',
        body: JSON.stringify({ question: q, maxSources }),
      });
      setAnswer(r.answer);
      setSources(r.sources || []);
    } catch (e: any) {
      setError(e.message || 'Research failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h2 className="mb-2 text-sm font-medium">Ask a research question</h2>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={3}
          placeholder="e.g. What are the tradeoffs of HNSW vs IVF for vector search?"
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
        />
        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
          <label>
            Sources:{' '}
            <input
              type="number"
              min={1}
              max={12}
              value={maxSources}
              onChange={(e) => setMaxSources(Number(e.target.value))}
              className="w-16 rounded border border-neutral-800 bg-neutral-900 px-1 py-0.5"
            />
          </label>
          <button
            onClick={run}
            disabled={busy || !q}
            className="ml-auto rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900 disabled:opacity-50"
          >
            {busy ? 'Researching…' : 'Run research'}
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      </section>

      {answer && (
        <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
          <h2 className="mb-2 text-sm font-medium">Answer</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{answer}</div>
        </section>
      )}

      {sources.length > 0 && (
        <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
          <h2 className="mb-2 text-sm font-medium">Sources</h2>
          <ol className="space-y-1 text-sm">
            {sources.map((s) => (
              <li key={s.n}>
                <span className="text-neutral-500">[{s.n}]</span>{' '}
                <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
