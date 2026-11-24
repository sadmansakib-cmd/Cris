import { useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'editor' | 'terminal' | 'ai' | 'api' | 'github';

export function Coding() {
  const [tab, setTab] = useState<Tab>('ai');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['ai', 'editor', 'terminal', 'api', 'github'] as Tab[]).map((t) => (
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
      {tab === 'ai' && <AiCoding />}
      {tab === 'editor' && <Editor />}
      {tab === 'terminal' && <Terminal />}
      {tab === 'api' && <ApiTester />}
      {tab === 'github' && <GitHubPanel />}
    </div>
  );
}

function AiCoding() {
  const [lang, setLang] = useState('typescript');
  const [spec, setSpec] = useState('A debounce function with types.');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="w-40 rounded bg-neutral-900 px-2 py-1 text-sm"
        />
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await apiFetch('/plugins/hault.ai-coding/generate', {
                method: 'POST',
                body: JSON.stringify({ language: lang, spec }),
              });
              setOut(r.code);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      <textarea
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        rows={4}
        className="w-full rounded bg-neutral-900 p-2 text-sm"
      />
      <pre className="max-h-[500px] overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-200">
        {out}
      </pre>
    </div>
  );
}

function Editor() {
  const [path, setPath] = useState('README.md');
  const [content, setContent] = useState('# Notes\n');
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm"
        />
        <button
          onClick={async () => {
            const r = await apiFetch(`/plugins/hault.code-editor/file?path=${encodeURIComponent(path)}`);
            setContent(r.content);
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Open
        </button>
        <button
          onClick={() =>
            apiFetch('/plugins/hault.code-editor/file', {
              method: 'POST',
              body: JSON.stringify({ path, content }),
            })
          }
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Save
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={20}
        className="w-full rounded bg-neutral-950 p-3 font-mono text-xs"
      />
    </div>
  );
}

function Terminal() {
  const [cmd, setCmd] = useState('echo hello from HAULT');
  const [out, setOut] = useState<any>(null);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm font-mono"
        />
        <button
          onClick={async () => {
            const r = await apiFetch('/plugins/hault.terminal/exec', {
              method: 'POST',
              body: JSON.stringify({ command: cmd }),
            });
            setOut(r);
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Run
        </button>
      </div>
      {out && (
        <pre className="max-h-[500px] overflow-auto rounded bg-neutral-950 p-3 text-xs">
          <div className="text-neutral-500">exit {out.code} · {out.ms}ms</div>
          {out.stdout}
          {out.stderr && <div className="text-red-400">{out.stderr}</div>}
        </pre>
      )}
    </div>
  );
}

function ApiTester() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://api.github.com');
  const [res, setRes] = useState<any>(null);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded bg-neutral-900 px-2 py-1 text-sm"
        >
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm"
        />
        <button
          onClick={async () => {
            const r = await apiFetch('/plugins/hault.api-testing/send', {
              method: 'POST',
              body: JSON.stringify({ method, url }),
            });
            setRes(r);
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Send
        </button>
      </div>
      {res && (
        <pre className="max-h-[500px] overflow-auto rounded bg-neutral-950 p-3 text-xs">
          {res.status} · {res.ms}ms{'\n\n'}
          {res.body}
        </pre>
      )}
    </div>
  );
}

function GitHubPanel() {
  const [repos, setRepos] = useState<any[]>([]);
  return (
    <div className="space-y-2">
      <button
        onClick={async () => setRepos(await apiFetch('/plugins/hault.github/repos'))}
        className="rounded bg-neutral-800 px-3 py-1 text-sm"
      >
        Load my repos
      </button>
      <ul className="space-y-1 text-sm">
        {repos.map((r) => (
          <li key={r.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="font-medium">{r.full_name}</div>
            <div className="text-xs text-neutral-500">{r.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
