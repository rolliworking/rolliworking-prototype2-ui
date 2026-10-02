import clsx from 'clsx';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { Assignee, Presence, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

export interface ComposeTarget { to: Assignee; label: string; sub?: string; jobId?: string; replyToId?: string; replyText?: string }
const PRESENCE: Record<Presence, string> = { away: 'bg-ink-300', with_client: 'bg-amber-500', at_bench: 'bg-emerald-500' };
const PRESENCE_DARK: Record<Presence, string> = { away: 'bg-slate-500', with_client: 'bg-amber-400', at_bench: 'bg-emerald-400' };

export const Avatar = ({ u, size, dark }: { u: User; size: number; dark?: boolean }) => <span aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} className={clsx('grid shrink-0 place-items-center rounded-full font-mono font-semibold', dark ? 'bg-white/10 text-white' : 'bg-ink text-white')}>{hl.staffInitials(u)}</span>;

// Every compose target the signed-in person can address: people (same division), #roles (claimable), stations (whoever is signed in there)
export const composeOptions = (div: 'rolliworks' | 'rollishop', meId?: string): ComposeTarget[] => [
  ...api.getDivisionStaff(div).filter((u) => u.id !== meId).map((u) => { const p = api.staffPresenceSync(u); return { to: { type: 'user' as const, shortName: u.shortName }, label: u.shortName, sub: `${u.dutyLabel} · ${p.label}` }; }),
  ...api.getDivisionRoles(div).map((r) => ({ to: { type: 'role' as const, role: r }, label: `#${r}`, sub: 'claimable — first to claim owns it' })),
  ...hl.stationTargets().map((s) => ({ to: { type: 'station' as const, stationId: s.id }, label: s.name, sub: 'station · whoever is signed in there' })),
];
export const targetKey = (t: ComposeTarget) => (t.to.type === 'user' ? `user:${t.to.shortName}` : t.to.type === 'role' ? `role:${t.to.role}` : `station:${t.to.stationId}`);

// DIRECTORY — the cards: People (initials + derived presence dot) · Roles (claimable) · Stations. Tap a card → `onPick`. Lives collapsed under the Team composer's To field and in the Intercom tab (stations only).
export const DirectoryCards = ({ dark, pad, onPick, kinds = ['people', 'roles', 'stations'] }: { dark?: boolean; pad: boolean; onPick: (t: ComposeTarget) => void; kinds?: ('people' | 'roles' | 'stations')[] }) => {
  const { station, user } = useAuth(); const div = station?.division ?? 'rolliworks';
  if (!user) return null;
  const people = api.getDivisionStaff(div).filter((u) => u.id !== user.id); const roles = api.getDivisionRoles(div); const stations = hl.stationTargets();
  const muted = dark ? 'text-slate-400' : 'text-ink-400'; const dotMap = dark ? PRESENCE_DARK : PRESENCE;
  const tile = dark ? 'border-white/10 bg-white/[0.04] hover:bg-white/10 active:bg-white/15' : 'border-line bg-surface hover:bg-canvas active:bg-line/60';
  const head = `mb-1 text-[10px] font-semibold uppercase tracking-wide ${muted}`;
  return <div data-testid="msg-dir" className="space-y-3">
    {kinds.includes('people') && <div>
      <div className="flex items-center justify-between"><div className={head}>People</div><div data-testid="msg-presence-legend" className={`flex flex-wrap items-center gap-3 text-[10px] ${muted}`}>{(['at_bench', 'with_client', 'away'] as Presence[]).map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full ${dotMap[s]}`} />{s === 'at_bench' ? 'at bench' : s === 'with_client' ? 'with client' : 'away'}</span>)}</div></div>
      <div data-testid="msg-people" className={clsx('grid gap-2', pad ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-4 lg:grid-cols-6')}>
        {people.map((u) => { const p = api.staffPresenceSync(u); return <button key={u.id} type="button" data-testid={`msg-tile-${u.shortName}`} title={`${u.shortName} · ${u.dutyLabel} · ${p.label} (${p.detail})`} aria-label={`Message ${u.shortName}`} onClick={() => onPick({ to: { type: 'user', shortName: u.shortName }, label: u.shortName, sub: `${u.dutyLabel} · ${p.label} · ${p.detail}` })} className={clsx('relative flex flex-col items-center rounded-xl border text-center transition-colors', pad ? 'min-h-[88px] justify-center gap-1.5 p-2' : 'gap-1 p-2', tile)}>
          <span className="relative"><Avatar u={u} size={pad ? 48 : 32} dark={dark} /><span data-testid={`msg-tile-status-${u.shortName}`} data-state={p.state} title={`${p.label} · ${p.detail}`} className={clsx('absolute -bottom-0.5 -right-0.5 rounded-full ring-2', pad ? 'h-3.5 w-3.5' : 'h-3 w-3', dark ? 'ring-[#1f2630]' : 'ring-surface', dotMap[p.state])} /></span>
          <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{u.shortName}</span><span className={`w-full truncate text-[10px] ${muted}`}>{u.dutyLabel}</span>
        </button>; })}
      </div>
    </div>}
    {kinds.includes('roles') && <div>
      <div className={head}>Roles · claimable — first to claim owns it</div>
      <div data-testid="msg-roles" className="flex flex-wrap gap-1.5">{roles.map((r) => <button key={r} type="button" data-testid={`msg-role-${r}`} onClick={() => onPick({ to: { type: 'role', role: r }, label: `#${r}`, sub: 'claimable queue' })} className={clsx('rounded-full border px-3 font-mono text-xs font-semibold', pad ? 'min-h-[44px]' : 'h-7', dark ? 'border-white/15 text-slate-100 hover:bg-white/10' : 'border-line text-ink-700 hover:bg-canvas')}>#{r}</button>)}</div>
    </div>}
    {kinds.includes('stations') && <div>
      <div className={head}>Stations · whoever is signed in there</div>
      <div data-testid="msg-stations" className="flex flex-wrap gap-1.5">{stations.map((s) => <button key={s.id} type="button" data-testid={`msg-station-${s.id}`} onClick={() => onPick({ to: { type: 'station', stationId: s.id }, label: s.name, sub: 'station' })} className={clsx('rounded-full border px-3 text-xs', pad ? 'min-h-[44px]' : 'h-7', dark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-line text-ink-600 hover:bg-canvas')}>{s.name}</button>)}</div>
    </div>}
  </div>;
};
