import { useAuth } from './lib/auth-context';
import { LoginPage } from './pages/Login';
import { AppShell } from './pages/AppShell';

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenSpinner />;
  return user ? <AppShell /> : <LoginPage />;
}

function FullscreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-200" />
    </div>
  );
}
