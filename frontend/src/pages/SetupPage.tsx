import { SetupRsPanels } from '@/pages/SetupRsPanels';
import { SetupAuditsCard } from '@/components/rw/SetupAuditsCard';
import { SetupGradingCard } from '@/components/rw/SetupGradingCard';
import { KioskSettingCard } from '@/components/setup/KioskSettingCard';
import { ArrowRight, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import * as org from '@/api/org';
import { useAuth } from '@/auth/AuthContext';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
  const [home, setHome] = useState<hl.HomeScreen>(() => hl.getHomeScreen(user!.id));

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

          <div className="mt-4 border-t border-line pt-4" data-testid="setup-home-screen">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Home screen · this device · {user!.shortName}</label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(['default', 'hitlist', ...(hl.isSupervisor(user) ? ['team'] : [])] as hl.HomeScreen[]).map((h) => <button key={h} type="button" data-testid={`home-screen-${h}`} aria-pressed={home === h} onClick={() => { hl.setHomeScreen(user!.id, h); setHome(h); }} className={`h-8 rounded-full border px-3 font-medium transition-colors ${home === h ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300'}`}>{h === 'default' ? 'Dashboard (default)' : h === 'hitlist' ? 'My Hitlist' : 'Team Hitlist'}</button>)}
              <span className="text-ink-400">{home === 'default' ? 'Sign-in lands on the Dashboard.' : `Set Hitlist as home screen — sign-in and PIN switch land on ${home === 'team' ? 'the team rollup' : 'your Hitlist'} on this device (iPad-only stations).`}</span>
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
              <div className="mt-2 flex items-center justify-between rounded-sm bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <span>RolliConnect preview: forget client-side actions (approvals, payments, messages) replayed on load.</span>
                <button type="button" data-testid="rc-events-reset-button" onClick={() => api.resetRcEvents().then(() => window.location.reload())} className="font-semibold underline-offset-2 hover:underline">
                  Reset RolliConnect data
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-xs text-ink-400">Only managers can rename this station.</p>
          )}
        </Card>

        <KioskSettingCard />
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

      <Card title="Organisation & staff" subtitle="Entities · departments (W · B · P · PM · CM · Engraving) · stations + kiosk pairing · org tree · staff with invite codes" testId="setup-org-card" action={<Link to="/setup/org" data-testid="setup-open-org" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Setup → Organisation <ArrowRight size={12} /></Link>}>
        <div className="flex flex-wrap gap-1.5 text-[11px]" data-testid="setup-org-summary">
          {org.getEntitiesSync().map((e) => <Link key={e.id} to="/setup/org?tab=entities" data-testid={`setup-org-entity-${e.id}`} className="rounded-sm border border-line bg-canvas px-2 py-0.5 text-ink-700 hover:border-ink-300">{e.name} <span className="font-mono text-ink-400">{e.shortName}</span></Link>)}
          <Link to="/setup/org?tab=departments" data-testid="setup-org-departments" className="rounded-sm border border-line bg-canvas px-2 py-0.5 text-ink-700 hover:border-ink-300">{org.getDepartmentsSync().filter((d) => d.active).length} departments</Link>
          <Link to="/setup/org?tab=stations" data-testid="setup-org-stations" className="rounded-sm border border-line bg-canvas px-2 py-0.5 text-ink-700 hover:border-ink-300">{org.getStationsSync().length} stations</Link>
          <Link to="/setup/org?tab=staff" data-testid="setup-org-staff" className="rounded-sm border border-line bg-canvas px-2 py-0.5 text-ink-700 hover:border-ink-300">{(users ?? []).length} staff · {(users ?? []).filter((u) => u.invite && !u.invite.usedAt).length} invited · {(users ?? []).filter((u) => u.disabled).length} disabled</Link>
        </div>
        <p className="mt-2 text-xs text-ink-500">Staff credentials are the person's own (set on first sign-in from the invite code). Prototype seed accounts keep <span className="font-mono">firstname123</span> / <span className="font-mono">1234</span>.</p>
      </Card>
      <Card title="Time clock" subtitle="Replaces RGTime · NFC tag tap or wall pad (Touch ID / PIN) · who’s in · week grid · flags + append-only corrections · payroll CSV · geofence · clock points" testId="setup-time-card" action={<Link to="/time?tab=settings" data-testid="setup-open-time" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Time clock → Settings <ArrowRight size={12} /></Link>}><p className="text-xs text-ink-500">Old RGTime history is kept (source <span className="font-mono">rgtime</span>); printed tags written with <span className="font-mono">/rg/clock?station=…</span> redirect to the pad. Wall pad: <Link to="/time/pad" data-testid="setup-open-time-pad" className="underline">/time/pad</Link>. Mark a station as a clock point in Organisation → Stations.</p></Card>
      <Card title="Inspection" subtitle="Variant sets (per ref × component) · guided shot lists · findings tags · WatchM8 export" testId="setup-inspection-card" action={<Link to="/setup/inspection" data-testid="setup-open-inspection" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Setup → Inspection <ArrowRight size={12} /></Link>}><p className="text-xs text-ink-500">Every inspection produces per-component opinion labels attached to guided photos. Opinions are revisable; nothing is a verdict. Exemplars are our own photos only.</p></Card>
      <Card title="Rate card" subtitle="Ref (or BAND) · legs · material · type · construction → price or range · typical days · versioned" testId="setup-rate-card-card" action={<Link to="/setup/rate-card" data-testid="setup-open-rate-card" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Setup → Rate card <ArrowRight size={12} /></Link>}><p className="text-xs text-ink-500">One quote key shared by the portal request line, the estimate line and this table. Trade auto-quote accounts are quoted the moment every line resolves here; a request line without a rate links straight back to add one.</p></Card>
      {api.isOwnerSync() && <Card title="Bonus plans" subtitle="Owner only · one plan per person · basis = the report it reads · flat payout or tiers · Show to staff → progress card on their Hitlist" testId="setup-bonus-card" action={<Link to="/setup/bonus-plans" data-testid="setup-open-bonus-plans" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Setup → Bonus plans <ArrowRight size={12} /></Link>}><p className="text-xs text-ink-500">Working-day pacing (Mon–Fri by default, Setup value), automatic close at period end, early close with a reason, Mark paid + CSV on <Link to="/analytics" data-testid="setup-open-bonus-analytics" className="underline">Analytics</Link> (MH + Operations Manager).</p></Card>}
      {api.isOwnerSync() && <Card title="Containers · safes vs insurance" subtitle="Owner only · safes carry an insurance limit + policy ref · bins / shelves have no limit · every tray, station and shelf bin names the container it lives in" testId="setup-containers-card" action={<Link to="/setup/containers" data-testid="setup-open-containers" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Setup → Containers <ArrowRight size={12} /></Link>}><p className="text-xs text-ink-500">Value on hand per safe is summed by parent in the seam (D-420): appraisal → declared at intake → ref typical value → unvalued. Over the limit → warning at the station, hitlist item for MH + VC, tile on MH's Hitlist; see <Link to="/analytics" data-testid="setup-open-safes-analytics" className="underline">Analytics → Safes vs insurance</Link>.</p></Card>}
      {isAdmin && <SetupAuditsCard />}
      {isAdmin && <SetupGradingCard />}
      <SetupRsPanels />
    </div>
  );
}
