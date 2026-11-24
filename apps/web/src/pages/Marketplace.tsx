import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Listing = {
  id: string;
  version: string;
  manifestUrl: string;
  signatureUrl: string;
  publisherKeyId: string;
  tarballUrl: string;
  sha256: string;
  stars: number;
  installs: number;
};

export function Marketplace() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Listing[]>([]);
  const [msg, setMsg] = useState('');
  const [keyId, setKeyId] = useState('');
  const [pem, setPem] = useState('');

  async function load() {
    try {
      const res = await apiFetch(`/marketplace/list${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setItems(await res.json());
    } catch (e: any) {
      setMsg(e.message || 'failed to load');
    }
  }

  useEffect(() => { load().catch(() => {}); }, []);

  async function trust() {
    const res = await apiFetch('/marketplace/trust-key', {
      method: 'POST',
      body: JSON.stringify({ keyId, pem }),
    });
    setMsg(res.ok ? `trusted ${keyId}` : 'failed');
  }

  async function install(it: Listing) {
    try {
      const res = await apiFetch('/marketplace/install', {
        method: 'POST',
        body: JSON.stringify({
          manifestUrl: it.manifestUrl,
          signatureUrl: it.signatureUrl,
          keyId: it.publisherKeyId,
        }),
      });
      setMsg(res.ok ? `installed ${it.id}` : `install failed for ${it.id}`);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Plugin Marketplace</h2>
        <p className="text-sm text-neutral-500">Browse, verify, and install signed plugins.</p>
      </div>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h3 className="mb-3 text-sm font-medium">Trust a publisher key</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="rounded bg-neutral-900 px-3 py-2 text-sm"
            placeholder="key id"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
          />
          <button onClick={trust} className="rounded bg-neutral-800 px-3 py-2 text-sm">Trust</button>
          <textarea
            className="col-span-full h-24 rounded bg-neutral-900 px-3 py-2 font-mono text-xs"
            placeholder="-----BEGIN PUBLIC KEY-----"
            value={pem}
            onChange={(e) => setPem(e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <div className="mb-3 flex gap-2">
          <input
            className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm"
            placeholder="search plugins…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={load} className="rounded bg-neutral-800 px-3 py-2 text-sm">Search</button>
        </div>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-neutral-500">No listings.</div>}
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded border border-neutral-800 p-3">
              <div>
                <div className="text-sm font-medium">{it.id} <span className="text-neutral-500">v{it.version}</span></div>
                <div className="text-xs text-neutral-500">★ {it.stars} · {it.installs} installs · key {it.publisherKeyId}</div>
              </div>
              <button onClick={() => install(it)} className="rounded bg-blue-600 px-3 py-1.5 text-xs">Install</button>
            </div>
          ))}
        </div>
      </section>

      {msg && <div className="text-xs text-neutral-400">{msg}</div>}
    </div>
  );
}
