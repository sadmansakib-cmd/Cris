import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password, mfaRequired ? totpCode : undefined);
      } else {
        await register(email, password, displayName);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const payload = err.payload as { mfaRequired?: boolean; message?: string };
        if (payload?.mfaRequired) {
          setMfaRequired(true);
          setError('Enter your 6-digit MFA code.');
        } else {
          setError(payload?.message ?? 'Invalid credentials');
        }
      } else if (err instanceof ApiError) {
        const payload = err.payload as { error?: { message?: string, details?: any } };
        
        let msg = payload?.error?.message;
        if (msg === 'Validation failed' && payload?.error?.details?.fieldErrors) {
          const firstField = Object.keys(payload.error.details.fieldErrors)[0];
          if (firstField) {
            msg = payload.error.details.fieldErrors[firstField]?.[0] || msg;
          }
        }

        setError(msg ?? `Error ${err.status}`);
      } else {
        setError('Network error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HAULT</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
          </p>
        </div>

        {mode === 'register' && (
          <Field
            label="Name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Ada Lovelace"
            required
          />
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'register' ? 12 : undefined}
        />
        {mfaRequired && (
          <Field
            label="MFA code"
            value={totpCode}
            onChange={setTotpCode}
            placeholder="123456"
            pattern="\d{6}"
            required
            autoComplete="one-time-code"
          />
        )}

        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
        >
          {submitting ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
            setMfaRequired(false);
          }}
          className="w-full text-center text-xs text-neutral-400 hover:text-neutral-200"
        >
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  pattern?: string;
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
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        pattern={props.pattern}
      />
    </label>
  );
}
