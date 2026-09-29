import { Ban, CheckCircle2, Lock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { User, UserLimits } from '@/api/client';
import { Button } from '@/components/ui/Button';

const field = 'h-9 w-full rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
const Section = ({ title, hint, children, testId }: { title: string; hint?: string; children: React.ReactNode; testId: string }) => <section data-testid={testId} className="rounded-md border border-line bg-surface p-3"><h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title}</h3>{hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}<div className="mt-2">{children}</div></section>;

// Limits drawer — everything that scopes a user INSIDE their tier: reports-to (org tree), locked stations, parts categories, pricing, containers owned (read-only), enable / disable with reason
export const AccessLimitsDrawer = ({ user, users, onClose, onChanged }: { user: User; users: User[]; onClose: () => void; onChanged: () => Promise<void> }) => {
  const [limits, setLimits] = useState<UserLimits>(api.limitsOf(user)); const [reportsTo, setReportsTo] = useState(user.reportsTo ?? ''); const [reason, setReason] = useState(''); const [err, setErr] = useState<string | null>(null); const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); await onChanged(); setErr(null); setSaved(msg); window.setTimeout(() => setSaved(null), 2500); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const toggle = (k: 'lockedStations' | 'partsCategories', v: string) => setLimits((l) => ({ ...l, [k]: l[k].includes(v) ? l[k].filter((x) => x !== v) : [...l[k], v] }));
  const owner = user.id === api.OWNER_USER_ID; const containers = api.containersOwnedBy(user.shortName); const chain = api.chainOf(user.id);
  return <>
    <div data-testid="limits-scrim" className="fixed inset-0 z-30 bg-ink/20" onClick={onClose} />
    <aside data-testid="limits-drawer" data-user={user.id} className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-canvas shadow-2xl lg:w-[520px]" style={{ animation: 'slideIn 200ms ease-out' }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <div><h2 className="text-sm font-semibold text-ink">{user.shortName} · Limits</h2><p className="text-[11px] text-ink-400">{user.dutyLabel} · tier <b className="text-ink-600">{user.accessTier}</b> (tier is separate from the tree) · {user.division}</p></div>
        {user.disabled && <span data-testid="limits-disabled-badge" className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">disabled</span>}
        <button type="button" data-testid="limits-close" onClick={onClose} aria-label="Close" className="ml-auto grid h-9 w-9 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><X size={16} /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {saved && <div data-testid="limits-saved" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700">{saved}</div>}
        {err && <div data-testid="limits-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{err}</div>}
        <Section title="Reports to" hint="One person — the org tree. Data scope, view-as groups and escalation derive from it." testId="limits-reports-to">
          <div className="flex items-center gap-2">
            <select data-testid="limits-reports-to-select" value={reportsTo} disabled={owner} onChange={(e) => setReportsTo(e.target.value)} className={field}><option value="">— nobody (top of tree)</option>{users.filter((u) => u.id !== user.id && !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.shortName} · {u.dutyLabel}</option>)}</select>
            <Button variant="primary" data-testid="limits-reports-to-save" disabled={owner || reportsTo === (user.reportsTo ?? '')} onClick={() => void run(() => api.setUserLimits(user.id, { reportsTo: reportsTo || null }), 'Reports-to saved')}>Save</Button>
          </div>
          <div className="mt-1.5 text-[11px] text-ink-400">Chain: <span data-testid="limits-chain" className="font-mono">{user.shortName}{chain.map((m) => ` → ${m.shortName}`).join('')}</span>{api.directReports(user.id).length > 0 && <> · direct reports: {api.directReports(user.id).map((r) => r.shortName).join(', ')}</>}</div>
        </Section>
        <Section title="Locked stations" hint="Stations this user cannot scan into or assign to on the pad / Assign map." testId="limits-locked-stations">
          <div className="grid grid-cols-2 gap-1">{api.RW_STATION_OPTIONS.map((s) => <label key={s.key} className="flex min-h-[36px] items-center gap-2 rounded-sm px-1.5 text-xs hover:bg-canvas"><input type="checkbox" data-testid={`limits-station-${s.key}`} checked={limits.lockedStations.includes(s.key)} onChange={() => toggle('lockedStations', s.key)} className="h-4 w-4" />{limits.lockedStations.includes(s.key) && <Lock size={11} className="text-amber-700" />}{s.label}</label>)}</div>
        </Section>
        <Section title="Parts categories" hint="Categories this user may request / order. Empty = all categories." testId="limits-parts-categories">
          <div className="grid grid-cols-2 gap-1">{api.PART_CATEGORIES.map((c) => <label key={c} className="flex min-h-[36px] items-center gap-2 rounded-sm px-1.5 text-xs hover:bg-canvas"><input type="checkbox" data-testid={`limits-cat-${c.replace(/\W+/g, '-').toLowerCase()}`} checked={limits.partsCategories.includes(c)} onChange={() => toggle('partsCategories', c)} className="h-4 w-4" />{c}</label>)}</div>
        </Section>
        <Section title="Pricing" testId="limits-pricing">
          <select data-testid="limits-pricing-select" value={limits.pricing} onChange={(e) => setLimits((l) => ({ ...l, pricing: e.target.value as UserLimits['pricing'] }))} className={field}>{api.PRICING_LIMITS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
          <div className="mt-2 flex justify-end"><Button variant="primary" data-testid="limits-save" onClick={() => void run(() => api.setUserLimits(user.id, { limits }), 'Limits saved')}>Save limits</Button></div>
        </Section>
        <Section title="Containers owned" hint="Bins / safes this user is the holder of. Read-only here — created in Custody." testId="limits-containers">
          {containers.length ? <ul className="space-y-1">{containers.map((c) => <li key={c.key} data-testid={`limits-container-${c.key}`} className="flex items-center gap-2 rounded-sm bg-canvas px-2 py-1.5 text-xs"><span className="rounded-sm bg-surface px-1 font-mono text-[10px] uppercase text-ink-500">{c.kind}</span>{c.label}</li>)}</ul> : <p className="text-xs text-ink-400">None.</p>}
        </Section>
        {!owner && <Section title={user.disabled ? 'Re-enable account' : 'Disable account'} hint={user.disabled ? `Disabled ${new Date(user.disabled.at).toLocaleDateString()} by ${user.disabled.by} · “${user.disabled.reason}”` : 'Blocks every sign-in (password and PIN). Reason required — logged to the audit trail.'} testId="limits-account">
          <div className="flex items-center gap-2">
            <input data-testid="limits-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={field} />
            {user.disabled ? <Button variant="primary" data-testid="limits-enable" disabled={!reason.trim()} onClick={() => void run(() => api.setUserEnabled(user.id, true, reason), `${user.shortName} re-enabled`)}><CheckCircle2 size={13} /> Enable</Button>
              : <Button data-testid="limits-disable" disabled={!reason.trim()} onClick={() => void run(() => api.setUserEnabled(user.id, false, reason), `${user.shortName} disabled`)} className="border-rose-300 text-rose-700"><Ban size={13} /> Disable</Button>}
          </div>
        </Section>}
      </div>
    </aside>
  </>;
};
