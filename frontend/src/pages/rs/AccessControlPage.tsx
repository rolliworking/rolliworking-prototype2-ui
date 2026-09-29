import { KeyRound, RotateCcw, SlidersHorizontal, UserPlus } from 'lucide-react';
import { AccessLimitsDrawer } from '@/components/setup/AccessLimitsDrawer';
import { NewUserFromTemplate } from '@/components/setup/NewUserFromTemplate';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { AccessChange, AccessValue, User } from '@/api/client';
import { SCREENS, roleDefaultAccess, type NavItem } from '@/config/navigation';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtTime } from '@/lib/format';

// Owner-only access control panel (D-391): one row per user, one column per screen, each cell a toggle. Role default pre-fills; an override shows as a diff from the role. Hover a column header → description box. Every change logged; takes effect on the user's next route load.
export default function AccessControlPage() {
  const [users, setUsers] = useState<User[]>([]); const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({}); const [log, setLog] = useState<AccessChange[]>([]); const [hover, setHover] = useState<NavItem | null>(null); const [err, setErr] = useState<string | null>(null); const [group, setGroup] = useState<'all' | string>('all'); const [status, setStatus] = useState<'active' | 'disabled' | 'all'>('active'); const [limitsFor, setLimitsFor] = useState<string | null>(null); const [newUser, setNewUser] = useState(false); const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(async () => { try { const us = await api.getAccessUsers(); setUsers(us); setOverrides(Object.fromEntries(us.map((u) => [u.id, api.accessOverridesFor(u.id)]))); setLog(await api.getAccessLog()); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const screens = SCREENS.filter((s) => group === 'all' || (s.group ?? 'other') === group);
  const groups = ['all', ...Array.from(new Set(SCREENS.map((s) => s.group ?? 'other')))];
  const shown = users.filter((u) => status === 'all' || (status === 'disabled') === !!u.disabled); const disabledCount = users.filter((u) => u.disabled).length;
  const limitsUser = limitsFor ? users.find((u) => u.id === limitsFor) : undefined;
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };
  const set = async (u: User, s: NavItem, v: AccessValue) => { try { await api.setAccessOverride(u.id, s.key, s.label, v); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const cell = (u: User, s: NavItem) => { const role = roleDefaultAccess(s, u); const o = overrides[u.id]?.[s.key]; const eff = o ?? role; return { role, o, eff, diff: o !== undefined && o !== role }; };
  const resetRow = async (u: User) => { for (const k of Object.keys(overrides[u.id] ?? {})) { const s = SCREENS.find((x) => x.key === k); if (s) await api.setAccessOverride(u.id, k, s.label, 'role'); } await load(); };
  if (err) return <div data-testid="access-restricted" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{err}</div>;
  return <div data-testid="access-control-page" className="space-y-4">
    <header className="flex flex-wrap items-end gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink"><KeyRound size={22} /> Access control</h1><p className="mt-1 text-sm text-ink-500">Owner only. Toggle any screen for any user. Grey = role default · amber ring = override (a diff from the role). Changes apply on that user’s next screen load and are logged below.</p></div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex gap-1" data-testid="access-status-filter">{(['active', 'disabled', 'all'] as const).map((k) => <button key={k} type="button" data-testid={`access-status-${k}`} onClick={() => setStatus(k)} className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${status === k ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas'}`}>{k}{k === 'disabled' && disabledCount > 0 && <span className="ml-1 opacity-70">{disabledCount}</span>}</button>)}</div>
        <button type="button" data-testid="access-new-user" onClick={() => setNewUser(true)} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-ink px-3 text-xs font-semibold text-white hover:bg-ink-700"><UserPlus size={13} /> New user from template</button>
      </div>
      <div className="flex w-full flex-wrap gap-1" data-testid="access-group-filter">{groups.map((g) => <button key={g} type="button" data-testid={`access-group-${g}`} onClick={() => setGroup(g)} className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${group === g ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas'}`}>{g === 'all' ? 'All screens' : g === 'rw' ? 'RW' : g === 'parts' ? 'Parts & Inventory' : g}</button>)}</div>
    </header>
    {flash && <div data-testid="access-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700">{flash}</div>}
    <div data-testid="access-description" className="min-h-[52px] rounded-md border border-line bg-canvas px-3 py-2 text-sm">
      {hover ? <><b>{hover.label}</b> <span className="font-mono text-[11px] text-ink-400">{hover.path}</span> · <span className="text-ink-600">{hover.blurb}</span> <span className="ml-1 rounded-sm bg-surface px-1 text-[10px] uppercase text-ink-400">role default: {hover.tiers.includes('concierge') ? 'all tiers' : 'manager tier'}</span></> : <span className="text-ink-400">Hover a column header to see what that screen does.</span>}
    </div>
    <Card testId="access-matrix-card" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table data-testid="access-matrix" className="min-w-full border-collapse text-xs">
          <thead><tr className="border-b border-line bg-canvas">
            <th className="sticky left-0 z-10 bg-canvas px-3 py-2 text-left font-semibold text-ink-600">User</th>
            {screens.map((s) => <th key={s.key} data-testid={`access-col-${s.key}`} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} title={s.blurb} className="h-28 w-9 cursor-help px-0 align-bottom"><div className="mx-auto flex h-28 w-9 items-end justify-center pb-1"><span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="max-h-24 truncate text-[11px] font-medium text-ink-700">{s.label}</span></div></th>)}
            <th className="px-2 py-2 text-left font-semibold text-ink-600">Overrides</th>
            <th className="px-2 py-2 text-left font-semibold text-ink-600">Limits</th>
          </tr></thead>
          <tbody>
            {shown.map((u) => { const n = Object.keys(overrides[u.id] ?? {}).length; const owner = u.id === api.OWNER_USER_ID; const lim = api.limitsOf(u); const mgr = api.managerOf(u.id); return <tr key={u.id} data-testid={`access-row-${u.id}`} data-disabled={!!u.disabled} className={`border-b border-line/60 hover:bg-canvas/60 ${u.disabled ? 'opacity-60' : ''}`}>
              <td className="sticky left-0 z-10 min-w-[210px] max-w-[210px] bg-surface px-3 py-1.5"><div className="font-semibold text-ink">{u.shortName}{owner && <span className="ml-1 rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">owner</span>}{u.disabled && <span data-testid={`access-disabled-${u.id}`} title={u.disabled.reason} className="ml-1 rounded-sm bg-rose-50 px-1 text-[9px] font-semibold uppercase text-rose-700">disabled</span>}{u.createdFrom && <span className="ml-1 rounded-sm bg-canvas px-1 text-[9px] uppercase text-ink-400">from template</span>}</div><div className="truncate text-[10px] text-ink-400" title={`${u.dutyLabel} · ${u.accessTier} · ${u.division}`}>{u.dutyLabel} · {u.accessTier} · {u.division}{mgr && <> · <span data-testid={`access-reports-to-${u.id}`}>→ {mgr.shortName}</span></>}</div></td>
              {screens.map((s) => { const c = cell(u, s); return <td key={s.key} className="px-0 py-1 text-center"><button type="button" disabled={owner} aria-disabled={owner} data-testid={`access-cell-${u.id}-${s.key}`} data-effective={c.eff} data-override={c.o === undefined ? 'role' : c.o ? 'allow' : 'deny'} data-diff={c.diff} title={`${u.shortName} · ${s.label}: ${c.eff ? 'allowed' : 'denied'}${c.diff ? ` (override — role default ${c.role ? 'allows' : 'denies'})` : ' (role default)'}${owner ? ' · owner always allowed' : ' · click to toggle, right-click to reset to role'}`} onClick={() => void set(u, s, c.eff ? 'deny' : 'allow')} onContextMenu={(e) => { e.preventDefault(); void set(u, s, 'role'); }} className={`mx-auto grid h-6 w-6 place-items-center rounded-sm transition-[background-color,box-shadow] ${c.eff ? 'bg-moss text-white' : 'bg-line text-ink-300'} ${c.diff ? 'ring-2 ring-amber-400 ring-offset-1' : ''} disabled:cursor-not-allowed disabled:opacity-50`}>{c.eff ? '✓' : '·'}</button></td>; })}
              <td className="whitespace-nowrap px-2 py-1.5 text-[11px]">{n > 0 ? <span className="inline-flex items-center gap-1"><span data-testid={`access-diff-count-${u.id}`} className="rounded-sm bg-amber-50 px-1 font-semibold text-amber-800">{n} from role</span><button type="button" data-testid={`access-reset-${u.id}`} onClick={() => void resetRow(u)} title="Reset all overrides to role defaults" className="inline-flex items-center gap-0.5 text-ink-500 hover:text-ink"><RotateCcw size={10} /> reset</button></span> : <span className="text-ink-300">role</span>}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-[11px]"><button type="button" data-testid={`access-limits-${u.id}`} onClick={() => setLimitsFor(u.id)} className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-ink-700 hover:border-ink-400"><SlidersHorizontal size={11} /> Limits{lim.lockedStations.length + lim.partsCategories.length > 0 || lim.pricing !== 'full' ? <span data-testid={`access-limits-count-${u.id}`} className="rounded-sm bg-amber-50 px-1 font-semibold text-amber-800">{lim.lockedStations.length} locked{lim.pricing !== 'full' ? ` · ${lim.pricing.replace('_', ' ')}` : ''}</span> : null}</button></td>
            </tr>; })}
          </tbody>
        </table>
      </div>
    </Card>
    {limitsUser && <AccessLimitsDrawer user={limitsUser} users={users} onClose={() => setLimitsFor(null)} onChanged={load} />}
    {newUser && <NewUserFromTemplate users={users} onClose={() => setNewUser(false)} onCreated={(u) => { setNewUser(false); say(`${u.shortName} created from template · reports to ${api.managerOf(u.id)?.shortName ?? '—'}`); void load(); }} />}
    <Card title="Change log" subtitle="Who changed what for whom, when — newest first" testId="access-log-card" bodyClassName="p-0">
      <ul data-testid="access-log" className="divide-y divide-line/70">
        {log.map((c) => <li key={c.id} data-testid={`access-log-${c.id}`} className="flex flex-wrap items-center gap-x-2 px-4 py-1.5 text-xs"><span className="text-ink-400">{fmtDate(c.at)} {fmtTime(c.at)}</span><b>{c.by}</b><span className="text-ink-400">set</span><b>{c.userShort}</b><span className="text-ink-400">·</span><span>{c.screenLabel}</span><span className="rounded-sm bg-canvas px-1 font-mono text-[10px]">{c.from} → {c.to}</span><span className="text-ink-300">{c.station}</span></li>)}
        {!log.length && <li className="px-4 py-3 text-xs text-ink-400">No changes yet — every toggle lands here.</li>}
      </ul>
    </Card>
  </div>;
}
