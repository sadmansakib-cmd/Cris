import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth-context';
import { apiFetch, ApiError } from '../lib/api';

export function SettingsPage() {
  const { user, refreshMe } = useAuth();
  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-xl font-semibold">Account</h2>
        <div className="mt-3 space-y-1 text-sm">
          <div><span className="text-neutral-500">Email: </span>{user?.email}</div>
          <div><span className="text-neutral-500">Name: </span>{user?.displayName}</div>
          <div><span className="text-neutral-500">Role: </span>{user?.isAdmin ? 'Administrator' : 'User'}</div>
        </div>
      </section>

      <ChangePassword />
      <MfaSection enabled={!!user?.mfaEnabled} onChange={refreshMe} />
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await apiFetch('/api/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ current, next }),
      });
      setMsg('Password changed. You will be signed out on other devices.');
      setCurrent(''); setNext('');
    } catch (e) {
      setErr(e instanceof ApiError ? String((e.payload as { message?: string })?.message ?? e.status) : 'Error');
    }
  }

  return (
    <section>
      <h3 className="text-lg font-medium">Change password</h3>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <Input label="Current password" type="password" value={current} onChange={setCurrent} required />
        <Input label="New password (min 12 chars)" type="password" value={next} onChange={setNext} minLength={12} required />
        <button className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white">
          Update password
        </button>
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
      </form>
    </section>
  );
}

function MfaSection({ enabled, onChange }: { enabled: boolean; onChange: () => Promise<void> }) {
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setRecovery(null); setOtpauth(null); setSecret(null); }, [enabled]);

  async function begin() {
    setErr(null);
    try {
      const res = await apiFetch<{ otpauth: string; secret: string }>('/api/auth/mfa/setup', { method: 'POST' });
      setOtpauth(res.otpauth); setSecret(res.secret);
    } catch (e) {
      setErr(e instanceof ApiError ? `Error ${e.status}` : 'Error');
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiFetch<{ recoveryCodes: string[] }>('/api/auth/mfa/confirm', {
        method: 'POST', body: JSON.stringify({ code }),
      });
      setRecovery(res.recoveryCodes);
      await onChange();
    } catch (e) {
      setErr(e instanceof ApiError ? String((e.payload as { message?: string })?.message ?? e.status) : 'Error');
    }
  }

  async function disable() {
    await apiFetch('/api/auth/mfa/disable', { method: 'POST' });
    await onChange();
  }

  if (enabled && !recovery) {
    return (
      <section>
        <h3 className="text-lg font-medium">Multi-factor authentication</h3>
        <p className="mt-1 text-sm text-neutral-400">MFA is enabled.</p>
        <button onClick={disable} className="mt-3 rounded-md border border-red-900 px-3 py-2 text-sm text-red-300 hover:border-red-700">
          Disable MFA
        </button>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-medium">Multi-factor authentication</h3>
      {!otpauth && !recovery && (
        <>
          <p className="mt-1 text-sm text-neutral-400">
            Add a TOTP authenticator (1Password, Authy, Google Authenticator) as a second factor.
          </p>
          <button onClick={begin} className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white">
            Set up MFA
          </button>
        </>
      )}
      {otpauth && !recovery && (
        <form onSubmit={confirm} className="mt-3 space-y-3">
          <p className="text-sm text-neutral-400">
            Scan this URI in your authenticator app, or enter the secret manually:
          </p>
          <code className="block break-all rounded-md bg-neutral-950 p-3 text-xs text-neutral-300">{otpauth}</code>
          <code className="block break-all rounded-md bg-neutral-950 p-3 text-xs text-neutral-300">secret: {secret}</code>
          <Input label="6-digit code" value={code} onChange={setCode} pattern="\d{6}" required />
          <button className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white">
            Confirm & enable
          </button>
        </form>
      )}
      {recovery && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-emerald-400">MFA enabled. Save these recovery codes — each works once:</p>
          <ul className="rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs">
            {recovery.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </section>
  );
}

function Input(props: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; minLength?: number; pattern?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-neutral-500">{props.label}</span>
      <input
        className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-600"
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        minLength={props.minLength}
        pattern={props.pattern}
      />
    </label>
  );
}
