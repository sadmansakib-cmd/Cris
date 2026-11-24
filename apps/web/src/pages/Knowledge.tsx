import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'files' | 'bookmarks' | 'clipboard' | 'downloads' | 'screenshots' | 'graph';

export function Knowledge() {
  const [tab, setTab] = useState<Tab>('files');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['files', 'bookmarks', 'clipboard', 'downloads', 'screenshots', 'graph'] as Tab[]).map((t) => (
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
      {tab === 'files' && <Files />}
      {tab === 'bookmarks' && <Bookmarks />}
      {tab === 'clipboard' && <Clipboard />}
      {tab === 'downloads' && <Downloads />}
      {tab === 'screenshots' && <Screenshots />}
      {tab === 'graph' && <Graph />}
    </div>
  );
}

function Files() {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const load = async () => setEntries(await apiFetch(`/plugins/hault.files/list?path=${encodeURIComponent(path)}`));
  useEffect(() => {
    load();
  }, [path]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setPath(path.split('/').slice(0, -1).join('/'))} className="rounded bg-neutral-800 px-2 py-1 text-xs">
          ↑
        </button>
        <div className="font-mono text-xs text-neutral-500">/{path}</div>
      </div>
      <ul className="divide-y divide-neutral-900 rounded bg-neutral-950 text-sm">
        {entries.map((e) => (
          <li key={e.path} className="flex items-center justify-between px-3 py-2">
            <button
              onClick={() => e.dir && setPath(e.path)}
              className={e.dir ? 'text-blue-400' : 'text-neutral-200'}
            >
              {e.dir ? '📁' : '📄'} {e.name}
            </button>
            <span className="text-xs text-neutral-500">
              {e.dir ? '' : `${e.size}B`}
            </span>
          </li>
        ))}
        {entries.length === 0 && <li className="px-3 py-2 text-neutral-500">Empty</li>}
      </ul>
    </div>
  );
}

function Bookmarks() {
  const [list, setList] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const refresh = async () => setList(await apiFetch('/plugins/hault.bookmarks/bookmarks'));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" className="w-48 rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.bookmarks/bookmarks', { method: 'POST', body: JSON.stringify({ url, title }) });
            setUrl('');
            setTitle('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((b) => (
          <li key={b.id} className="rounded bg-neutral-900 px-3 py-2">
            <a href={b.url} target="_blank" rel="noreferrer" className="font-medium text-blue-400">
              {b.title}
            </a>
            <div className="text-xs text-neutral-500">{b.url}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Clipboard() {
  const [list, setList] = useState<any[]>([]);
  const [text, setText] = useState('');
  const refresh = async () => setList(await apiFetch('/plugins/hault.clipboard/entries'));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Snippet…" className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.clipboard/push', { method: 'POST', body: JSON.stringify({ text }) });
            setText('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Push
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((e) => (
          <li key={e.id} className="flex items-center justify-between rounded bg-neutral-900 px-3 py-2">
            <span className="truncate">{e.pinned && '📌 '}{e.text}</span>
            <button
              onClick={async () => {
                await apiFetch(`/plugins/hault.clipboard/pin/${e.id}`, { method: 'POST' });
                refresh();
              }}
              className="text-xs text-neutral-400 hover:text-neutral-200"
            >
              {e.pinned ? 'unpin' : 'pin'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Downloads() {
  const [list, setList] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const refresh = async () => setList(await apiFetch('/plugins/hault.downloads/list'));
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.downloads/fetch', { method: 'POST', body: JSON.stringify({ url }) });
            setUrl('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Download
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((d) => (
          <li key={d.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="text-xs text-neutral-500">
              {d.status} · {d.bytes}B{d.totalBytes ? ` / ${d.totalBytes}B` : ''}
            </div>
            <div className="truncate">{d.url}</div>
            {d.sha256 && <div className="font-mono text-[10px] text-neutral-600">sha256 {d.sha256.slice(0, 16)}…</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Screenshots() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    apiFetch('/plugins/hault.screenshot/list').then(setList);
  }, []);
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-neutral-500">
        Desktop capture is handled by the native shell. This view lists PNGs uploaded to the server.
      </p>
      <ul className="space-y-1">
        {list.map((s) => (
          <li key={s.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="font-mono text-xs">{s.path}</div>
            <div className="text-xs text-neutral-500">{s.createdAt} {s.note && `· ${s.note}`}</div>
          </li>
        ))}
        {list.length === 0 && <li className="text-neutral-500">No screenshots yet.</li>}
      </ul>
    </div>
  );
}

function Graph() {
  const [g, setG] = useState<any>(null);
  useEffect(() => {
    apiFetch('/plugins/hault.knowledge-graph/graph').then(setG).catch(() => setG({ error: true }));
  }, []);
  if (!g) return <div className="text-neutral-500 text-sm">Loading…</div>;
  if (g.error)
    return <div className="text-neutral-500 text-sm">Notes plugin must be running to build the graph.</div>;
  return (
    <div className="space-y-2 text-sm">
      <div className="text-neutral-400">
        {g.stats.nodes} notes · {g.stats.edges} links
      </div>
      <ul className="space-y-1">
        {g.nodes.map((n: any) => (
          <li key={n.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="font-medium">{n.label}</div>
            <div className="text-xs text-neutral-500">out: {g.edges.filter((e: any) => e.from === n.id).length}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
