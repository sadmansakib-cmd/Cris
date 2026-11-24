import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { PermissionGrantDto } from '@hault/shared';

export function PermissionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<PermissionGrantDto[]>({
    queryKey: ['permissions'],
    queryFn: () => apiFetch('/api/permissions'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/permissions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }),
  });

  const panic = useMutation({
    mutationFn: () => apiFetch('/api/permissions/panic', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Granted permissions</h2>
          <p className="text-sm text-neutral-400">Every action a plugin can take on your behalf.</p>
        </div>
        <button
          onClick={() => panic.mutate()}
          className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200 hover:bg-red-900/40"
        >
          Revoke all (panic)
        </button>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-neutral-500">No permissions granted yet.</p>
      )}

      <div className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900">
        {data?.map((g) => (
          <div key={g.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-mono text-sm">{g.pluginSlug} · {g.action}</div>
              <div className="text-xs text-neutral-500">
                scope: {JSON.stringify(g.scope)} · granted {new Date(g.grantedAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => revoke.mutate(g.id)}
              className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
