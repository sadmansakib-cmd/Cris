import { useState } from 'react';
import { apiFetch } from '../lib/api';

/**
 * Phase 3 UI — drives the sandboxed `browser` plugin (Playwright).
 * Every action is permission-gated by scope (host, session, selector).
 */
export function BrowserPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [url, setUrl] = useState('https://example.com');
  const [selector, setSelector] = useState('h1');
  const [output, setOutput] = useState('');

  const invoke = async (method: string, args: unknown) => {
    setOutput('…running');
    try {
      const res = await apiFetch<any>('/plugins/hault.browser/invoke', {
        method: 'POST',
        body: JSON.stringify({ method, args }),
      });
      setOutput(JSON.stringify(res, null, 2));
      if (res?.sessionId) setSessionId(res.sessionId);
    } catch (e: any) {
      setOutput(`error: ${e.message ?? e}`);
    }
  };

  return (
    <div className="max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Browser Automation</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Headless Playwright sessions in a sandboxed plugin. Session:&nbsp;
        <span className="font-mono text-xs">{sessionId ?? 'none'}</span>
      </p>

      <div className="mb-4 flex gap-2">
        <button
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900"
          onClick={() => invoke('POST /launch', { profile: 'default' })}
        >Launch</button>
        <button
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm"
          disabled={!sessionId}
          onClick={() => sessionId && invoke('POST /close', { sessionId })}
        >Close</button>
      </div>

      <section className="mb-4 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-2 text-sm font-medium">Navigate</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="rounded bg-neutral-100 px-3 py-1 text-sm text-neutral-900"
            disabled={!sessionId}
            onClick={() => sessionId && invoke('POST /navigate', { sessionId, url })}
          >Go</button>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-2 text-sm font-medium">Extract / Click</h2>
        <input
          className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-sm"
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          placeholder="CSS selector"
        />
        <div className="flex gap-2">
          <button
            className="rounded border border-neutral-700 px-3 py-1 text-sm"
            disabled={!sessionId}
            onClick={() => sessionId && invoke('POST /extract', { sessionId, selector })}
          >Extract text</button>
          <button
            className="rounded border border-neutral-700 px-3 py-1 text-sm"
            disabled={!sessionId}
            onClick={() => sessionId && invoke('POST /click', { sessionId, selector })}
          >Click</button>
          <button
            className="rounded border border-neutral-700 px-3 py-1 text-sm"
            disabled={!sessionId}
            onClick={() => sessionId && invoke('POST /screenshot', { sessionId })}
          >Screenshot</button>
        </div>
      </section>

      <pre className="min-h-24 whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-xs">
        {output || '(no output yet)'}
      </pre>
    </div>
  );
}
