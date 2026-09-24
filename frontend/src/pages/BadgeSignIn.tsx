import { ScanLine } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { PrototypeBanner } from '@/components/layout/AppShell';

export default function BadgeSignIn() {
  const { user, loading, signIn } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { data: users } = useAsync(() => api.getUsers());

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(code);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Badge not recognized');
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PrototypeBanner />
      <div className="grid flex-1 place-items-center bg-canvas">
        <div className="w-[420px] animate-rise">
          <div className="mb-6 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-sm bg-ink font-mono text-xs font-semibold text-white">RS</span>
            <span className="text-base font-semibold tracking-tight text-ink">RolliSuite</span>
            <span className="ml-auto text-xs text-ink-400">Staff sign-in</span>
          </div>

          <form onSubmit={submit} className="rounded-md border-l-[3px] border-ink bg-surface p-6 shadow-card" data-testid="badge-sign-in-form">
            <label htmlFor="badge" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <ScanLine size={14} /> Badge code
            </label>
            <input
              id="badge"
              data-testid="badge-code-input"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan or type badge code"
              className="h-11 w-full rounded-sm border border-line bg-canvas px-3 font-mono text-base tracking-wider text-ink placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-ink-400 focus:border-ink focus:bg-surface focus:outline-none"
            />
            {error && (
              <p data-testid="badge-error" className="mt-2 text-xs font-medium text-rose-700">
                {error}. Try again or pick a badge below.
              </p>
            )}
            <button
              type="submit"
              data-testid="badge-submit-button"
              disabled={busy || !code.trim()}
              className="mt-3 h-9 w-full rounded-sm bg-ink text-[13px] font-semibold text-white transition-colors hover:bg-ink-700 disabled:opacity-40"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-400">Press Enter to sign in · keyboard and scanner friendly</p>
          </form>

          <div className="mt-4 rounded-md bg-surface/60 p-4 text-xs">
            <div className="mb-2 font-semibold text-ink-500">Prototype badges</div>
            <ul className="grid grid-cols-2 gap-1.5">
              {(users ?? []).map((u: User) => (
                <li key={u.id}>
                  <button
                    type="button"
                    data-testid={`badge-hint-${u.badgeCode}`}
                    onClick={() => setCode(u.badgeCode)}
                    className="flex w-full items-center justify-between gap-2 rounded-sm border border-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-ink-300"
                  >
                    <span className="truncate text-ink-700">{u.displayName}</span>
                    <span className="font-mono text-[11px] text-ink-400">{u.badgeCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
