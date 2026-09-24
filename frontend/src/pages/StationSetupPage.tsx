import { MonitorSmartphone, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PrototypeBanner } from '@/components/layout/AppShell';
import { useAsync } from '@/hooks/useAsync';

export default function StationSetupPage() {
  const { station, loading, refreshStation } = useAuth();
  const navigate = useNavigate();
  const { data: users } = useAsync(() => api.getUsers());
  const { data: stations, reload } = useAsync(() => api.getStations());
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [stationId, setStationId] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (station) return <Navigate to="/sign-in" replace />;

  const managers = (users ?? []).filter((u) => u.accessTier === 'manager');

  const addNew = async () => {
    if (!newName.trim()) return;
    const st = await api.addStation(newName);
    setNewName('');
    setAdding(false);
    reload();
    setStationId(st.id);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!adminId || !password || !stationId) {
      setError('Pick a manager, enter the password and choose a station');
      return;
    }
    setBusy(true);
    try {
      await api.registerStation(stationId, adminId, password);
      await refreshStation();
      navigate('/sign-in', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register station');
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PrototypeBanner />
      <div className="grid flex-1 place-items-center bg-canvas">
        <form onSubmit={submit} data-testid="station-setup-form" className="w-[520px] animate-rise rounded-md border-l-[3px] border-amber-500 bg-surface p-6 shadow-card">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            <MonitorSmartphone size={14} /> New device
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Name this station</h1>
          <p className="mt-1 text-xs text-ink-500">
            This device isn’t registered yet. A manager names it once; the station is then bound to this device and stamps every sign-in and audit event.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">Manager</label>
              <select
                data-testid="station-admin-select"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="h-9 w-full rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none"
              >
                <option value="">Select…</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">Manager password</label>
              <input
                data-testid="station-admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-sm border border-line bg-canvas px-3 text-[13px] focus:border-ink focus:bg-surface focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">Station</label>
            <div className="grid grid-cols-2 gap-1.5" data-testid="station-options">
              {(stations ?? []).map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-2 text-[13px] transition-colors ${
                    stationId === s.id ? 'border-ink bg-canvas' : 'border-line hover:border-ink-300'
                  }`}
                >
                  <input type="radio" name="station" data-testid={`station-option-${s.id}`} checked={stationId === s.id} onChange={() => setStationId(s.id)} className="accent-ink" />
                  {s.name}
                </label>
              ))}
            </div>
            {adding ? (
              <div className="mt-2 flex gap-2">
                <input
                  data-testid="station-new-name"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void addNew())}
                  placeholder="e.g. Polishing Bench"
                  className="h-8 flex-1 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none"
                />
                <button type="button" data-testid="station-new-save" onClick={addNew} className="h-8 rounded-sm bg-ink px-3 text-xs font-medium text-white">
                  Add
                </button>
              </div>
            ) : (
              <button type="button" data-testid="station-add-toggle" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <Plus size={12} /> Add a station
              </button>
            )}
          </div>

          {error && (
            <p data-testid="station-setup-error" className="mt-3 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            data-testid="station-setup-submit"
            disabled={busy}
            className="mt-5 h-9 w-full rounded-sm bg-ink text-[13px] font-semibold text-white transition-colors hover:bg-ink-700 disabled:opacity-40"
          >
            {busy ? 'Registering…' : 'Register this device'}
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-400">Prototype: manager password is firstname123</p>
        </form>
      </div>
    </div>
  );
}
