import { ArrowRight, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtTime } from '@/lib/format';

export default function SetupPage() {
  const { user, station, refreshStation } = useAuth();
  const navigate = useNavigate();
  const { data: users } = useAsync(() => api.getUsers());
  const { data: audit } = useAsync(() => api.getAuditLog());
  const [name, setName] = useState(station?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user!.accessTier === 'manager';

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.renameStation(name);
      await refreshStation();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const reset = async () => {
    if (!window.confirm('Clear this device’s station registration? You will be signed out and the “Name this station” screen will appear (simulates a new device).')) return;
    await api.resetDeviceRegistration();
    await refreshStation();
    navigate('/station-setup', { replace: true });
  };

  return (
    <div data-testid="setup-page" className="space-y-4">
      <PageHeader title="Setup" subtitle="Users, departments, templates and preferences." />

      <div className="grid grid-cols-2 gap-4">
        <Card title="This station" subtitle="Device-bound · never user-selected" testId="setup-station-card">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-canvas text-ink-500">
              <MonitorSmartphone size={18} />
            </span>
            <div>
              <div data-testid="setup-station-name" className="text-[15px] font-semibold tracking-tight text-ink">{station?.name}</div>
              <div className="text-[11px] text-ink-400">Stamps every sign-in and audit event from this device</div>
            </div>
          </div>

          {isAdmin ? (
            <form onSubmit={rename} className="mt-4 border-t border-line pt-4">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Rename station (admin)</label>
              <div className="flex gap-2">
                <input
                  data-testid="station-rename-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 flex-1 rounded-sm border border-line bg-canvas px-2.5 text-[13px] focus:border-ink focus:bg-surface focus:outline-none"
                />
                <Button type="submit" variant="primary" size="sm" data-testid="station-rename-save" disabled={!name.trim() || name.trim() === station?.name}>
                  {saved ? 'Saved' : 'Save'}
                </Button>
              </div>
              {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
              <div className="mt-4 flex items-center justify-between rounded-sm bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <span>Prototype only: simulate a brand-new device.</span>
                <button type="button" data-testid="station-reset-button" onClick={reset} className="font-semibold underline-offset-2 hover:underline">
                  Reset registration
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-xs text-ink-400">Only managers can rename this station.</p>
          )}
        </Card>

        <Card
          title="Audit trail"
          subtitle="Sign-in evidence: who, when, which station, photo"
          testId="setup-audit-card"
          action={
            <Link to="/setup/audit-log" data-testid="setup-open-audit-log" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Open audit log <ArrowRight size={12} />
            </Link>
          }
          bodyClassName="py-1"
        >
          <ul className="-mx-4 divide-y divide-line/70">
            {(audit ?? []).slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                {e.photoDataUrl ? (
                  <img src={e.photoDataUrl} alt="" className="h-8 w-10 rounded-sm object-cover" />
                ) : (
                  <span className="grid h-8 w-10 place-items-center rounded-sm bg-canvas text-ink-300">
                    <ShieldCheck size={14} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink">
                    {e.userShortName ? `${e.userShortName} · ` : ''}
                    {e.detail}
                  </div>
                  <div className="text-[11px] text-ink-400">
                    {e.stationName} · {fmtDate(e.timestamp)} {fmtTime(e.timestamp)}
                  </div>
                </div>
              </li>
            ))}
            {audit && audit.length === 0 && <li className="px-4 py-6 text-center text-xs text-ink-400">No events yet.</li>}
          </ul>
        </Card>
      </div>

      <Card title="Staff & prototype credentials" subtitle="Duty labels are display only — access is governed by tier" bodyClassName="p-0" testId="setup-staff-card">
        <Table>
          <thead>
            <tr>
              <Th>Staff</Th>
              <Th>Duty label</Th>
              <Th>Access tier</Th>
              <Th>Password (mock)</Th>
              <Th>PIN (mock)</Th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} data-testid={`setup-user-${u.firstName}`}>
                <Td className="font-medium text-ink">{u.displayName}</Td>
                <Td className="text-ink-500">{u.dutyLabel}</Td>
                <Td className="capitalize">{u.accessTier}</Td>
                <Td className="font-mono text-xs">{u.password}</Td>
                <Td className="font-mono text-xs">{u.pin}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
