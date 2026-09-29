import { ArrowRight, Pin, PinOff, Shuffle, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { FAMILY_TONE, teamFamily } from '@/config/roles';
import type { TeamHitlist, TeamPinned, TeamRow } from '@/api/hitlist';
import type { Assignee, Role } from '@/api/client';
import { TodayRowItem } from '@/components/today/TodayBits';
import { PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OwnerChip } from '@/components/ui/Pills';
import { useHitlistBase } from '@/pages/TodayPage';
import { fmtTime } from '@/lib/format';

// Two colour families everywhere MM sees mixed work (W = watchmakers, B·P = band / polish); the chip text is always present so colour is never the only signal
const TechTag = ({ name, unread, base }: { name: string; unread?: number; base: string }) => { const u = hl.userBySlug(name); const fam = u ? teamFamily(u) : null; return <Link to={`${base}/${name.toLowerCase()}`} data-testid={`team-tech-${name}`} data-family={fam ?? undefined} className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ring-1 hover:opacity-80 ${fam ? FAMILY_TONE[fam] : 'bg-canvas text-ink-700 ring-line'}`}>{fam && <span className="rounded-sm bg-white/70 px-1 text-[9px]">{fam}</span>}{name}{!!unread && <span className="rounded-full bg-sky-600 px-1 text-[9px] text-white">{unread}</span>}</Link>; };
const FamilyLegend = () => <div data-testid="team-legend" className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">Legend:{(['W', 'B·P'] as const).map((f) => <span key={f} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-semibold ring-1 ${FAMILY_TONE[f]}`}>{f} · {f === 'W' ? 'watchmakers' : 'band / polish'}</span>)}<span>· rows in the other supervisor’s family are read-only for you</span></div>;

// Inline reassign — move a pinned row or task to another team member (or role) without leaving the merged queue
const Reassign = ({ team, current, onPick, testId }: { team: TeamHitlist; current: Assignee; onPick: (a: Assignee) => void; testId: string }) => {
  const cur = current.type === 'user' ? `user:${current.shortName}` : current.type === 'role' ? `role:${current.role}` : `station:${current.stationId}`;
  return <select data-testid={testId} value={cur} onChange={(e) => { const [t, x] = e.target.value.split(':'); onPick(t === 'role' ? { type: 'role', role: x as Role } : { type: 'user', shortName: x }); }} className="h-7 rounded-sm border border-line bg-surface px-1.5 text-[11px]" title="Reassign">
    <optgroup label="Team">{team.team.map((u) => <option key={u.id} value={`user:${u.shortName}`}>{u.shortName}</option>)}<option value={`user:${team.supervisor.shortName}`}>{team.supervisor.shortName} (me)</option></optgroup>
    <optgroup label="Roles">{hl.TEAM_MAP[team.supervisor.shortName].roles.map((r) => <option key={r} value={`role:${r}`}>#{r}</option>)}</optgroup>
  </select>;
};

// Supervisor rollup — one merged queue across the team (JV → band techs + polishers · MM → watchmakers + read-only oversight of band/polish). Each row is tagged with the tech; click the tag to drill into their own Hitlist.
export default function TeamHitlistPage() {
  const { slug = '' } = useParams(); const { base } = useHitlistBase(); const { user } = useAuth();
  const sup = hl.userBySlug(slug);
  const [data, setData] = useState<TeamHitlist | null>(null); const [flash, setFlash] = useState<string | null>(null); const [filter, setFilter] = useState<string>('all');
  const load = () => (sup ? hl.getTeamHitlist(sup.id).then(setData) : Promise.resolve());
  useEffect(() => { void load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sup) return <Navigate to={base} replace />;
  if (!hl.isSupervisor(sup)) return <div data-testid="team-not-supervisor" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{sup.shortName} doesn’t supervise a team. <Link to={`${base}/${hl.slugOf(sup)}`} className="underline">Open their Hitlist</Link></div>;
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };
  const move = async (input: { pinnedId?: string; taskId?: string }, to: Assignee) => { await hl.reassign({ ...input, to }); say(`Reassigned → ${api.assigneeLabel(to).split(' →')[0]}`); await load(); };
  const dismiss = async (id: string) => { await api.dismissPinned(id); say('Pinned item done'); await load(); };
  const done = async (taskId: string) => { await api.setTaskDone(taskId, true); say('Task completed'); await load(); };
  const ro = (tech: { shortName: string }) => { const t = hl.userBySlug(tech.shortName); return !!user && !!t && hl.teamRowReadOnly(user, t); };
  const pinned = (data?.pinned ?? []).filter((p) => filter === 'all' || p.tech.shortName === filter);
  const rows = (data?.rows ?? []).filter((r) => filter === 'all' || r.tech.shortName === filter);
  return <div data-testid="team-hitlist-page" data-for={sup.shortName} className="space-y-4">
    <div className="flex items-start justify-between gap-4">
      <PageHeader title={`Team Hitlist · ${sup.shortName} · ${hl.TEAM_MAP[sup.shortName].label}`} subtitle={data ? `${data.team.length} on the team · ${data.pinned.length} pinned · ${data.rows.length} derived · one merged queue, reassign inline, tap a name to drill in` : 'Loading…'} testId="team-header" />
      <Link to={`${base}/${hl.slugOf(sup)}`} data-testid="team-own-link" className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-400 hover:bg-canvas"><UsersRound size={13} /> My own Hitlist</Link>
    </div>
    <div className="flex flex-wrap items-center gap-1.5" data-testid="team-filters">
      <button type="button" data-testid="team-filter-all" onClick={() => setFilter('all')} className={`h-8 rounded-full border px-3 text-xs font-medium ${filter === 'all' ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700'}`}>Everyone</button>
      {(data?.team ?? []).map((u) => <button key={u.id} type="button" data-testid={`team-filter-${u.shortName}`} onClick={() => setFilter(u.shortName)} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${filter === u.shortName ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700'}`}>{u.shortName} <span className="opacity-60">{u.dutyLabel}</span>{!!data?.unread[u.shortName] && <span className="rounded-full bg-sky-600 px-1.5 text-[10px] text-white">{data.unread[u.shortName]}</span>}</button>)}
      <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-400">{(data?.team ?? []).map((u) => <Link key={u.id} to={`${base}/${hl.slugOf(u)}`} data-testid={`team-drill-${u.shortName}`} className="inline-flex items-center gap-0.5 hover:text-ink hover:underline">{u.shortName} <ArrowRight size={10} /></Link>)}</span>
    </div>
    <FamilyLegend />
    {flash && <div data-testid="team-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}

    <Card title="Pinned · whole team" subtitle="Manual layer across every tech — reassign moves the row to another list (audit keeps the trail)" testId="team-pinned-card" bodyClassName="p-0" className="border-l-[3px] border-amber-500">
      <ul data-testid="team-pinned-list" className="divide-y divide-amber-100">
        {pinned.map((p: TeamPinned) => <li key={p.id} data-testid={`team-pinned-${p.id}`} className="flex items-center gap-3 bg-amber-50/40 px-4 py-2">
          <Pin size={13} className="shrink-0 text-amber-700" /><TechTag name={p.tech.shortName} unread={data?.unread[p.tech.shortName]} base={base} />
          {p.photo && <img src={p.photo.dataUrl} alt="" className="h-9 w-12 shrink-0 rounded-sm object-cover ring-1 ring-line" />}
          <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-ink">{p.jobId ? <Link to={`/jobs/${p.jobId}`} className="hover:underline">{p.title}</Link> : p.title}</div><div className="text-[11px] text-ink-400">pinned by {p.createdBy} · {fmtTime(p.createdAt)}{p.assignedTo.type === 'role' && <span className="ml-1 font-mono">#{p.assignedTo.role}</span>}</div></div>
          {p.createdBy !== p.tech.shortName && <OwnerChip owner={p.createdBy} />}
          {ro(p.tech) ? <span data-testid={`team-readonly-${p.id}`} className="rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] text-ink-400 ring-1 ring-line">read-only · JV’s team</span> : <><span className="inline-flex items-center gap-1 text-ink-400"><Shuffle size={11} /><Reassign team={data!} current={p.assignedTo} onPick={(a) => void move({ pinnedId: p.id }, a)} testId={`team-reassign-pin-${p.id}`} /></span>
          <button type="button" data-testid={`team-pin-dismiss-${p.id}`} onClick={() => void dismiss(p.id)} className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ink-500 hover:bg-surface hover:text-ink"><PinOff size={11} /> Done</button></>}
        </li>)}
        {data && pinned.length === 0 && <li data-testid="team-pinned-empty" className="px-4 py-3 text-xs text-ink-400">Nothing pinned across the team.</li>}
      </ul>
    </Card>

    <Card accent="moss" title="Derived · whole team" subtitle="Bench work, holds and tasks for every tech — tasks can be reassigned inline" testId="team-derived-card" bodyClassName="py-1">
      <ul className="divide-y divide-line/70">
        {rows.map((r: TeamRow) => <li key={r.id} className="flex items-center gap-2 pl-4" data-testid={`team-row-${r.id}`}>
          <TechTag name={r.tech.shortName} unread={data?.unread[r.tech.shortName]} base={base} />
          <div className="min-w-0 flex-1"><ul><TodayRowItem row={r} onDone={done} dense /></ul></div>
          {r.taskId && !ro(r.tech) && <span className="mr-4 inline-flex items-center gap-1 text-ink-400"><Shuffle size={11} /><Reassign team={data!} current={{ type: 'user', shortName: r.tech.shortName }} onPick={(a) => void move({ taskId: r.taskId }, a)} testId={`team-reassign-task-${r.taskId}`} /></span>}
        </li>)}
        {data && rows.length === 0 && <li className="px-4 py-8 text-center text-xs text-ink-400">Nothing derived for the team right now.</li>}
      </ul>
    </Card>
    <p className="text-[11px] text-ink-400">Each tech keeps their own list: {(data?.team ?? []).map((u, i) => <span key={u.id}>{i > 0 && ' · '}<Link to={`${base}/${hl.slugOf(u)}`} className="font-mono hover:underline">{base}/{hl.slugOf(u)}</Link></span>)}</p>
  </div>;
}
