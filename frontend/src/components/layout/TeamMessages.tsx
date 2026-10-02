import clsx from 'clsx';
import { Megaphone, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as ic from '@/api/intercom';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { User } from '@/api/client';
import type { StorePage } from '@/api/types';
import { AllMessagesList } from '@/components/inbox/AllMessagesList';
import { fmtDate, fmtTime } from '@/lib/format';
import { SentList } from './MessageComposer';
import type { ComposeTarget } from './MessageDirectory';
import { MessageInbox } from './MessageInbox';
import { TeamComposer } from './TeamComposer';
import { takePendingCompose, TEAM_COMPOSE_EVENT } from './teamCompose';

export type TeamChip = 'received' | 'sent' | 'done' | 'pages' | 'all';
const CHIPS: { key: TeamChip; label: string }[] = [{ key: 'received', label: 'Received' }, { key: 'sent', label: 'Sent' }, { key: 'done', label: 'Done' }, { key: 'pages', label: 'Pages' }];

// TEAM — the one home for staff one-shot messages (MH 2026-10-02): "New message" (N) expands the composer at the top of the list; chips Received (default) · Sent · Done · Pages (+ All staff, MH only).
// One component, two mounts: Inbox → Team on the desktop, the Messages panel / tab on pads (dark). Pages = intercom log, never mixed into Received.
export const TeamMessages = ({ me, dark, pad = false, jobBase, chip: chipProp, onChip, compose: composeProp, onCompose, staff, onStaff, focusId, initialTarget }: { me: User; dark?: boolean; pad?: boolean; jobBase: string; chip?: TeamChip; onChip?: (c: TeamChip) => void; compose?: boolean; onCompose?: (open: boolean) => void; staff?: string; onStaff?: (s: string | undefined) => void; focusId?: string; initialTarget?: ComposeTarget | null }) => {
  const [chipS, setChipS] = useState<TeamChip>('received'); const chip = chipProp ?? chipS; const setChip = onChip ?? setChipS;
  const [composeS, setComposeS] = useState(!!composeProp); const compose = composeProp ?? composeS; const setCompose = onCompose ?? setComposeS;
  const [target, setTarget] = useState<ComposeTarget | null>(initialTarget ?? null); const [tick, setTick] = useState(0); const [ok, setOk] = useState<string | null>(null); const done = useRef(false);
  const owner = me.id === api.OWNER_USER_ID;
  const bump = () => setTick((n) => n + 1);
  useEffect(() => { const h = () => bump(); window.addEventListener(hl.MESSAGE_EVENT, h); return () => window.removeEventListener(hl.MESSAGE_EVENT, h); }, []);
  // reply / bubble hand-off: pending target on mount, live event while mounted
  useEffect(() => { const t = takePendingCompose(); if (t) { setTarget(t); setCompose(true); } const h = (e: Event) => { const d = (e as CustomEvent<ComposeTarget | null>).detail; if (d) { setTarget(d); setCompose(true); takePendingCompose(); } }; window.addEventListener(TEAM_COMPOSE_EVENT, h); return () => window.removeEventListener(TEAM_COMPOSE_EVENT, h); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialTarget) { setTarget(initialTarget); setCompose(true); } }, [initialTarget]); // eslint-disable-line react-hooks/exhaustive-deps
  // N = new message (when not typing)
  useEffect(() => { const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !t?.isContentEditable) { e.preventDefault(); setTarget(null); setCompose(true); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [setCompose]);
  useEffect(() => { if (!ok) return; const t = window.setTimeout(() => setOk(null), 2500); return () => window.clearTimeout(t); }, [ok]);
  useEffect(() => { done.current = false; }, [focusId]);
  useEffect(() => { if (!focusId || done.current) return; const t = window.setTimeout(() => { const el = document.querySelector(`[data-testid='msg-inbox-${focusId}'], [data-testid='msg-sent-${focusId}'], [data-testid='internal-msg-${focusId}']`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('ring-2', 'ring-accent'); done.current = true; } }, 400); return () => window.clearTimeout(t); }, [focusId, tick, chip]);
  const reply = (r: hl.InboxRow) => { setTarget({ to: { type: 'user', shortName: r.from }, label: r.from, sub: 'reply — a new message back, no thread', jobId: r.jobId, replyToId: r.id, replyText: r.text ?? 'Photo' }); setCompose(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const unread = hl.unreadCount(me.id); const pages = ic.getPageLog();
  const muted = dark ? 'text-slate-400' : 'text-ink-400';
  return <div data-testid="team-messages" data-chip={chip} data-compose={compose || undefined} className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {!compose && <button type="button" data-testid="team-new" onClick={() => { setTarget(null); setCompose(true); }} className={clsx('inline-flex items-center gap-1.5 rounded-md px-3 font-semibold', pad ? 'min-h-[44px] text-sm' : 'h-8 text-xs', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}><Plus size={pad ? 16 : 13} /> New message <kbd className={clsx('ml-1 rounded-sm border px-1 font-mono text-[9px] font-normal', dark ? 'border-[#161b22]/30' : 'border-white/40 text-white/80')}>N</kbd></button>}
      <div data-testid="team-chips" className={clsx('flex flex-wrap items-center gap-1 rounded-md p-1', dark ? 'bg-white/5' : 'bg-canvas')}>
        {CHIPS.map((c) => { const n = c.key === 'received' ? unread : c.key === 'pages' ? pages.length : undefined; return <button key={c.key} type="button" data-testid={`team-chip-${c.key}`} aria-pressed={chip === c.key} onClick={() => setChip(c.key)} className={clsx('inline-flex items-center gap-1.5 rounded-sm px-2.5 font-semibold', pad ? 'min-h-[40px] text-sm' : 'h-6 text-[11px]', chip === c.key ? (dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white') : muted)}>{c.key === 'pages' && <Megaphone size={11} />}{c.label}{n ? <span className={clsx('rounded-full px-1.5 font-mono text-[10px]', chip === c.key ? 'bg-white/20' : c.key === 'received' ? 'bg-rose-600 text-white' : dark ? 'bg-white/10' : 'bg-line')}>{n}</span> : null}</button>; })}
        {owner && <button type="button" data-testid="team-chip-all" aria-pressed={chip === 'all'} onClick={() => setChip('all')} title="MH only — every staff message" className={clsx('inline-flex items-center rounded-sm px-2.5 font-semibold', pad ? 'min-h-[40px] text-sm' : 'h-6 text-[11px]', chip === 'all' ? (dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white') : muted)}>All staff</button>}
      </div>
      {ok && <span data-testid="msg-sent-ok" className={`text-[11px] font-medium ${dark ? 'text-emerald-300' : 'text-moss-700'}`}>{ok}</span>}
    </div>
    {compose && <TeamComposer dark={dark} pad={pad} initial={target} onCancel={() => { setCompose(false); setTarget(null); }} onSent={(l) => { setOk(l); setCompose(false); setTarget(null); bump(); if (chip !== 'sent' && chip !== 'received') setChip('received'); }} />}
    <section data-testid="team-list" data-chip={chip} className={clsx('rounded-md border px-3', dark ? 'border-white/10 bg-white/[0.02]' : 'border-line bg-surface')}>
      <div className={`flex items-center justify-between py-2 text-[11px] font-semibold uppercase tracking-wide ${muted}`}><span data-testid="team-list-title">{chip === 'received' ? `Received · ${unread} unread` : chip === 'sent' ? 'Sent by me · delivered / seen / done' : chip === 'done' ? 'Done · handled by me' : chip === 'pages' ? 'Pages · intercom (never mixed into Received)' : staff ? `${staff} · sent, received, claimed or completed` : 'Everyone · every staff message'}</span>
        {chip === 'all' && owner && <select data-testid="team-all-staff" value={staff ?? ''} onChange={(e) => onStaff?.(e.target.value || undefined)} className={clsx('h-6 rounded-sm border px-1 text-[11px] normal-case', dark ? 'border-white/15 bg-transparent text-white' : 'border-line bg-canvas text-ink')}><option value="">Everyone</option>{hl.staffFolders().map((f) => <option key={f.name} value={f.name}>{f.name} · {f.count}</option>)}</select>}</div>
      {chip === 'received' && <MessageInbox me={me} dark={dark} pad={pad} tick={tick} onChange={bump} onReply={reply} jobBase={jobBase} show="open" />}
      {chip === 'done' && <MessageInbox me={me} dark={dark} pad={pad} tick={tick} onChange={bump} onReply={reply} jobBase={jobBase} show="done" />}
      {chip === 'sent' && <SentList dark={dark} tick={tick} testId="msg-sent" />}
      {chip === 'pages' && <PagesList rows={pages} dark={dark} />}
      {chip === 'all' && owner && <AllMessagesList staff={staff} tick={tick} dark={dark} />}
    </section>
  </div>;
};

// Pages chip — the intercom page log (who · zone · text · when). Logged here, never under Calls (Vonage-only).
const PagesList = ({ rows, dark }: { rows: StorePage[]; dark?: boolean }) => <ul data-testid="team-pages-list" data-count={rows.length} className={`divide-y ${dark ? 'divide-white/10' : 'divide-line/70'}`}>
  {rows.map((p) => <li key={p.id} data-testid={`team-page-${p.id}`} data-zone={p.zone} className="flex items-start gap-2 py-2 text-xs"><Megaphone size={13} className="mt-0.5 shrink-0 text-amber-500" /><div className="min-w-0 flex-1"><div className={`flex flex-wrap items-center gap-x-1.5 text-[10px] ${dark ? 'text-slate-400' : 'text-ink-400'}`}><b className={dark ? 'text-slate-200' : 'text-ink-700'}>{p.by}</b><span>· {ic.intercomLabel(p.from)}</span><span className={clsx('rounded-sm px-1 font-semibold uppercase', dark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-50 text-amber-800')}>{ic.PAGE_ZONES.find((z) => z.key === p.zone)?.label}</span><span>· {fmtDate(p.at)} {fmtTime(p.at)}</span></div><div className={`mt-0.5 text-[13px] ${dark ? 'text-slate-100' : 'text-ink-800'}`}>“{p.text}”</div></div></li>)}
  {!rows.length && <li data-testid="team-pages-empty" className={`py-6 text-center text-xs ${dark ? 'text-slate-400' : 'text-ink-400'}`}>No pages yet — pages come from the Intercom tab.</li>}
</ul>;
