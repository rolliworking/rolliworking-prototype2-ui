import { MonitorSmartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PrototypeBanner } from '@/components/layout/AppShell';
import { SignInPanel } from '@/components/auth/SignInPanel';
import { StaffCard } from '@/components/auth/StaffCard';
import { useAsync } from '@/hooks/useAsync';
import { fmtLongDate } from '@/lib/format';

export default function SignInPage() {
  const { user, station, loading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<User | null>(null);
  const { data: users } = useAsync(() => api.getUsers());
  const [todayIds, setTodayIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getUsersSignedInToday().then((rows) => setTodayIds(new Set(rows.map((u) => u.id))));
  }, []);

  if (loading) return null;
  if (!station) return <Navigate to="/station-setup" replace />;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex h-full flex-col">
      <PrototypeBanner />
      <div className="flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto w-[960px] px-6 py-10">
          <div className="mb-8 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-sm bg-ink font-mono text-xs font-semibold text-white">RS</span>
            <span className="text-base font-semibold tracking-tight text-ink">RolliSuite</span>
            <span className="ml-3 text-xs text-ink-400">{fmtLongDate(new Date())}</span>
            <span data-testid="sign-in-station" className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-700">
              <MonitorSmartphone size={13} className="text-ink-400" /> {station.name}
            </span>
          </div>

          <div className="grid grid-cols-[400px_1fr] gap-6">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Who’s signing in?</div>
              <div className="grid gap-2" data-testid="staff-card-grid">
                {(users ?? []).map((u) => (
                  <StaffCard key={u.id} user={u} selected={selected?.id === u.id} signedInToday={todayIds.has(u.id)} onSelect={setSelected} />
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-4 text-ink-400">
                Prototype credentials — password <span className="font-mono">firstname123</span>, PIN <span className="font-mono">1234</span>. First sign-in of the day
                needs password (photo captured if camera available); later switches need only the PIN.
              </p>
            </div>

            <div>
              {selected ? (
                <SignInPanel
                  key={selected.id}
                  user={selected}
                  signedInToday={todayIds.has(selected.id)}
                  onBack={() => setSelected(null)}
                  onDone={() => navigate('/', { replace: true })}
                />
              ) : (
                <div data-testid="sign-in-empty" className="grid h-full min-h-[240px] place-items-center rounded-md border border-dashed border-ink-300/70 text-center text-xs text-ink-400">
                  Select your card to continue.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
