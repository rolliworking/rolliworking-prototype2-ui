import { ArrowLeft, Camera, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useCamera } from '@/hooks/useCamera';
import { CameraPreview } from './CameraPreview';
import { PinInput } from './PinInput';

interface Props {
  user: User;
  signedInToday: boolean;
  onBack: () => void;
  onDone: () => void;
}

export const SignInPanel = ({ user, signedInToday, onBack, onDone }: Props) => {
  const { signInWithPassword, switchWithPin } = useAuth();
  const { videoRef, status, capture } = useCamera(!signedInToday);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pwRef.current?.focus();
  }, [user.id]);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = capture();
      await signInWithPassword(user.id, trimmed, photo);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setPassword('');
      setBusy(false);
      pwRef.current?.focus();
    }
  };

  const submitPin = async (pin: string) => {
    await switchWithPin(user.id, pin);
    onDone();
  };

  const noCamera = status === 'unavailable' || status === 'denied';

  return (
    <div data-testid="sign-in-panel" className="animate-rise rounded-md border-l-[3px] border-ink bg-surface p-5 shadow-card">
      <button type="button" onClick={onBack} data-testid="sign-in-back" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink">
        <ArrowLeft size={12} /> All staff
      </button>
      <div className="mb-4">
        <div className="text-[15px] font-semibold tracking-tight text-ink" data-testid="sign-in-panel-user">{user.displayName}</div>
        <div className="text-xs text-ink-400">
          {signedInToday
            ? 'Already signed in today — fast switch with PIN.'
            : noCamera
              ? 'First sign-in today — enter your password. (No camera detected; photo step skipped.)'
              : 'First sign-in today — password plus one verification photo.'}
        </div>
      </div>

      {signedInToday ? (
        <PinInput onSubmit={submitPin} testId="sign-in-pin" />
      ) : (
        <form onSubmit={submitPassword} className={noCamera ? 'flex flex-col gap-3' : 'grid grid-cols-[1fr_200px] gap-4'}>
          <div>
            <label htmlFor="pw" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
              Password
            </label>
            <div className="relative">
              <input
                id="pw"
                ref={pwRef}
                data-testid="password-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="h-10 w-full rounded-sm border border-line bg-canvas px-3 pr-9 text-[14px] text-ink focus:border-ink focus:bg-surface focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-400 hover:text-ink"
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {error && (
              <p data-testid="password-error" className="mt-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              data-testid="password-submit"
              disabled={busy || !password}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-sm bg-ink text-[13px] font-semibold text-white transition-colors hover:bg-ink-700 disabled:opacity-40"
            >
              {!noCamera && <Camera size={14} />}
              {busy ? 'Verifying…' : noCamera ? 'Sign in' : 'Sign in & capture photo'}
            </button>
            <p className="mt-2 text-[11px] text-ink-400">
              Prototype password: <span className="font-mono">{user.firstName}123</span>
              {' · '}
              <button
                type="button"
                data-testid="fill-prototype-password"
                onClick={() => { setPassword(`${user.firstName}123`); setError(null); pwRef.current?.focus(); }}
                className="underline hover:text-ink"
              >
                fill in
              </button>
            </p>
          </div>
          {!noCamera && <CameraPreview videoRef={videoRef} status={status} />}
        </form>
      )}
    </div>
  );
};
