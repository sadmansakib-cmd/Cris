import { useAuth } from '../lib/auth-context';

export function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Welcome, {user?.displayName}</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Your personal AI operating system. Enable plugins on the left to start adding capabilities.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Multi-factor auth" body={user?.mfaEnabled ? 'Enabled' : 'Disabled — enable in Settings'} />
        <Card title="Role" body={user?.isAdmin ? 'Administrator' : 'User'} />
        <Card title="Plugins" body="Install more from the Plugins tab" />
      </div>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{title}</div>
      <div className="mt-2 text-sm text-neutral-200">{body}</div>
    </div>
  );
}
