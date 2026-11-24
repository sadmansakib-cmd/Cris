import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'logs' | 'errors' | 'analytics' | 'usage' | 'sessions' | 'security' | 'backup';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'logs', label: 'Logs' },
  { id: 'errors', label: 'Errors' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'usage', label: 'API Usage' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'security', label: 'Security' },
  { id: 'backup', label: 'Backup' },
];

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('analytics');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load(t: Tab) {
    setErr('');
    setData(null);
    try {
      const path = {
        logs: '/admin/logs?limit=100',
        errors: '/admin/errors?limit=100',
        analytics: '/admin/analytics?days=7',
        usage: '/admin/api-usage?days=7',
        sessions: '/admin/sessions',
        security: '/admin/security',
        backup: '/admin/backup/snapshot',
      }[t];
      const res = await apiFetch(path);
      setData(await res.json());
    } catch (e: any) {
      setErr(e.message || 'failed');
    }
  }

  useEffect(() => { load(tab).catch(() => {}); }, [tab]);

  async function revoke(id: string) {
    await apiFetch(`/admin/sessions/${id}`, { method: 'DELETE' });
    load('sessions');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Admin</h2>
        <p className="text-sm text-neutral-500">Logs, analytics, sessions, security, backup.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm ${tab === t.id ? 'border-b-2 border-blue-500 text-neutral-100' : 'text-neutral-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}

      {tab === 'analytics' && data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {Object.entries(data.totals as Record<string, number>).map(([k, v]) => (
              <div key={k} className="rounded border border-neutral-800 p-3">
                <div className="text-xs uppercase text-neutral-500">{k}</div>
                <div className="text-xl font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <div className="rounded border border-neutral-800 p-3">
            <div className="mb-2 text-sm font-medium">Top actions ({data.windowDays}d)</div>
            <ul className="space-y-1 text-xs">
              {data.topActions.map((a: any) => (
                <li key={a.action} className="flex justify-between">
                  <span className="font-mono">{a.action}</span>
                  <span className="text-neutral-500">{a.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'security' && data && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(data as Record<string, number>).map(([k, v]) => (
            <div key={k} className="rounded border border-neutral-800 p-3">
              <div className="text-xs uppercase text-neutral-500">{k}</div>
              <div className="text-xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'backup' && data && (
        <pre className="overflow-auto rounded border border-neutral-800 bg-neutral-950 p-3 text-xs">
{JSON.stringify(data, null, 2)}
        </pre>
      )}

      {(tab === 'logs' || tab === 'errors') && Array.isArray(data) && (
        <div className="space-y-1">
          {data.map((r: any) => (
            <div key={r.id} className="rounded border border-neutral-800 p-2 text-xs">
              <div className="flex justify-between">
                <span className="font-mono">{r.action}</span>
                <span className={r.outcome === 'error' ? 'text-red-400' : r.outcome === 'deny' ? 'text-amber-400' : 'text-neutral-400'}>
                  {r.outcome}
                </span>
              </div>
              <div className="text-neutral-500">
                {new Date(r.createdAt).toLocaleString()} · {r.actorType} {r.actorId ?? ''} {r.target ? `→ ${r.target}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'usage' && Array.isArray(data) && (
        <table className="w-full text-xs">
          <thead className="text-neutral-500">
            <tr><th className="p-1 text-left">Action</th><th className="p-1 text-left">Outcome</th><th className="p-1 text-right">Count</th></tr>
          </thead>
          <tbody>
            {data.map((r: any, i: number) => (
              <tr key={i} className="border-t border-neutral-800">
                <td className="p-1 font-mono">{r.action}</td>
                <td className="p-1">{r.outcome}</td>
                <td className="p-1 text-right">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'sessions' && Array.isArray(data) && (
        <div className="space-y-1">
          {data.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-neutral-800 p-2 text-xs">
              <div>
                <div className="font-mono">{s.userId}</div>
                <div className="text-neutral-500">
                  {s.ip ?? '—'} · {s.userAgent?.slice(0, 60) ?? ''} · {new Date(s.createdAt).toLocaleString()}
                  {s.revokedAt ? ' · revoked' : ''}
                </div>
              </div>
              {!s.revokedAt && (
                <button onClick={() => revoke(s.id)} className="rounded border border-red-900 px-2 py-1 text-red-300">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
