import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface Plugin {
  slug: string;
  name: string;
  version: string;
  enabled: boolean;
  source: string;
  installedAt: string;
}

export function PluginsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Plugin[]>({
    queryKey: ['plugins'],
    queryFn: () => apiFetch('/api/plugins'),
  });

  const toggle = useMutation({
    mutationFn: (p: Plugin) =>
      apiFetch(`/api/plugins/${p.slug}/${p.enabled ? 'disable' : 'enable'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plugins'] }),
  });

  const uninstall = useMutation({
    mutationFn: (slug: string) => apiFetch(`/api/plugins/${slug}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plugins'] }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Plugins</h2>
        <p className="text-sm text-neutral-400">
          Every feature beyond core is a plugin. Enable, disable, or uninstall at any time.
        </p>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-neutral-500">No plugins installed yet.</p>
      )}

      <div className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900">
        {data?.map((p) => (
          <div key={p.slug} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">
                {p.name} <span className="text-neutral-500">· v{p.version}</span>
              </div>
              <div className="font-mono text-xs text-neutral-500">
                {p.slug} · {p.source}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggle.mutate(p)}
                className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500"
              >
                {p.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => uninstall.mutate(p.slug)}
                className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-300 hover:border-red-700"
              >
                Uninstall
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
