import { ArrowLeftRight, ChevronDown, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PinInput } from '@/components/auth/PinInput';

export const UserSwitcher = () => {
  const { user, switchWithPin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<User[]>([]);
  const [target, setTarget] = useState<User | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTarget(null);
    api.getUsersSignedInToday().then((rows) => setCandidates(rows.filter((u) => u.id !== user!.id)));
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, user]);

  const doSwitch = async (pin: string) => {
    await switchWithPin(target!.id, pin);
    setOpen(false);
    navigate('/', { replace: true });
  };

  const signInOther = async () => {
    setOpen(false);
    await signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        data-testid="switch-user-button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-ink-500 transition-colors hover:bg-canvas hover:text-ink"
      >
        <ArrowLeftRight size={14} />
        Switch user
        <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div data-testid="switch-user-menu" className="absolute right-0 top-full z-30 mt-1 w-[300px] animate-rise rounded-md bg-surface p-1 shadow-pop">
          {target ? (
            <div className="p-3">
              <div className="mb-2 text-xs text-ink-500">
                Switching to <span className="font-semibold text-ink">{target.displayName}</span>
              </div>
              <PinInput onSubmit={doSwitch} testId="switch-pin" compact />
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
                <span>PIN only · no photo</span>
                <button type="button" data-testid="switch-pin-cancel" onClick={() => setTarget(null)} className="hover:text-ink">
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Signed in today · PIN switch</div>
              {candidates.length === 0 ? (
                <div data-testid="switch-user-none" className="px-3 py-2 text-xs text-ink-400">
                  No one else has signed in today on this station.
                </div>
              ) : (
                <ul>
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        data-testid={`switch-to-${u.firstName}`}
                        onClick={() => setTarget(u)}
                        className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left transition-colors hover:bg-canvas"
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 font-mono text-[10px] font-semibold text-brand">
                          {u.shortName.slice(0, 2)}
                        </span>
                        <span className="truncate text-[13px] text-ink">{u.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                data-testid="switch-user-other"
                onClick={signInOther}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-ink-500 transition-colors hover:bg-canvas hover:text-ink"
              >
                <LogOut size={13} /> Sign in as someone else (password + photo)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
