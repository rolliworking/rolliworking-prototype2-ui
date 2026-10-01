import clsx from 'clsx';
import { ChevronDown, ChevronRight, ExternalLink, FilePlus2, Maximize2, Minimize2, RefreshCw, Sparkles, StickyNote, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Job, JobWithRefs, LabelJob, PanelClosed, PanelFulfilled, PartsRequestWithRefs, ServiceRequest, ThreadView } from '@/api/client';
import { draftJobSummary } from '@/api/ai';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { JobDetailContent, JobModals, type JobModalState, type JobRun } from '@/components/jobs/JobDetailContent';
import { KindPill } from '@/components/jobs/JobBits';
import { PartsRequestModal } from '@/components/parts/PartsChat';
import { WbpClientRows, WbpDots } from '@/components/shared/WbpDots';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Pills';
import { RightSheet } from '@/components/ui/RightSheet';
import { useShowMoney } from '@/components/MoneyContext';
import { field } from '@/components/rs/RsBits';
import { fmtDate, fmtMoney, fullName, relativeTime } from '@/lib/format';

// INBOX JOB-CARD SLIDE-OUT (MH 2026-10-01, sections + expand). The client's record in three groups, top to bottom:
// ACTIVE (open requests without an estimate + jobs in our possession, expanded, newest first; the thread's own job / request outlined) ·
// FULFILLED (left us — picked up / shipped / closed; collapsed, count) · CLOSED (expired / declined estimates + closed requests; collapsed, count).
// Every job renders as a SNIPPET (header + dots · process-flow lines · custody · blockers · next step) with "Expand full job card" = the whole /jobs/:id content in place. One expanded at a time.
export const INBOX_DRAFT_EVENT = 'rollisuite:inbox-draft';
export const dropDraft = (threadId: string, text: string) => window.dispatchEvent(new CustomEvent(INBOX_DRAFT_EVENT, { detail: { threadId, text } }));
const SOURCE_LABEL: Record<ServiceRequest['source'], string> = { web: 'Web form', kiosk: 'Kiosk', email: 'Email', call: 'Phone call', walk_in: 'Walk-in' };
const LEG_LABEL: Record<string, string> = { W: 'Watch', B: 'Band', P: 'Polish', PM: 'Watch (PM)' };

export const InboxJobCard = ({ thread, onClose, pad }: { thread: ThreadView; onClose: () => void; pad?: boolean }) => {
  const c = thread.conversation; const anchor = c.anchor;
  const anchorJobId = anchor?.kind === 'job' ? anchor.id : anchor?.kind === 'estimate' ? api.jobForEstimateSync(anchor.id)?.id : undefined; const anchorRequestId = anchor?.kind === 'request' ? anchor.id : undefined;
  const mode = anchorJobId ? 'job' : anchorRequestId ? 'request' : 'client';
  const [expandedId, setExpandedId] = useState<string | null>(null); const [open, setOpen] = useState<{ fulfilled: boolean; closed: boolean }>({ fulfilled: false, closed: false }); const [openRows, setOpenRows] = useState<string[]>([]); const [, setTick] = useState(0);
  useEffect(() => { setExpandedId(null); setOpen({ fulfilled: false, closed: false }); setOpenRows([]); }, [c.id]);
  const panel = api.clientPanelSync(c.clientId); // re-read on every render; a snippet's onChanged bumps tick so sections regroup after writes
  const focusJob = (id: string) => { if (panel.fulfilled.some((f) => f.job.id === id)) { setOpen((o) => ({ ...o, fulfilled: true })); setOpenRows((r) => (r.includes(id) ? r : [...r, id])); } setExpandedId(id); };
  const anchorNumber = anchorJobId ? api.jobNumberSync(anchorJobId) : anchorRequestId ? api.requestByIdSync(anchorRequestId)?.number : undefined;
  const title = <span className="flex items-center gap-2"><span>Job card</span><span className="truncate font-normal text-ink-600">{fullName(c.client)}</span>{anchorNumber && <span data-testid="inbox-panel-anchor" className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-600 ring-1 ring-line">{anchorNumber}</span>}</span>;
  const snippet = (job: Job, outlined: boolean) => <JobSnippet key={job.id} jobId={job.id} threadId={c.id} outlined={outlined} expanded={expandedId === job.id} onExpand={() => setExpandedId(job.id)} onCollapse={() => setExpandedId(null)} onFocusJob={focusJob} onChanged={() => setTick((n) => n + 1)} />;
  return <RightSheet title={title} onClose={onClose} testId="inbox-panel" kind={mode} pad={pad}>
    <ClientStrip clientId={c.clientId} threadId={c.id} currentJobId={anchorJobId} />
    <Section k="active" label="Active" count={panel.active.length} open onToggle={undefined} hint="open requests without an estimate · jobs with us · newest first">
      {panel.active.map((a) => (a.kind === 'job' ? snippet(a.job, a.job.id === anchorJobId) : <RequestEntry key={a.request.id} r={a.request} threadId={c.id} outlined={a.request.id === anchorRequestId} />))}
      {!panel.active.length && <Empty text="Nothing active — nothing in our possession and no open request." />}
    </Section>
    <Section k="fulfilled" label="Fulfilled" count={panel.fulfilled.length} open={open.fulfilled} onToggle={() => setOpen((o) => ({ ...o, fulfilled: !o.fulfilled }))} hint="finished + picked up / shipped · no dots once it left us">
      {panel.fulfilled.map((f) => <FulfilledRow key={f.job.id} f={f} expanded={openRows.includes(f.job.id)} onToggle={() => setOpenRows((r) => (r.includes(f.job.id) ? r.filter((x) => x !== f.job.id) : [...r, f.job.id]))}>{snippet(f.job, f.job.id === anchorJobId)}</FulfilledRow>)}
      {!panel.fulfilled.length && <Empty text="No completed jobs yet." />}
    </Section>
    <Section k="closed" label="Closed" count={panel.closed.length} open={open.closed} onToggle={() => setOpen((o) => ({ ...o, closed: !o.closed }))} hint="expired estimates · closed or declined requests">
      {panel.closed.map((x) => <ClosedRow key={`${x.kind}-${x.id}`} x={x} />)}
      {!panel.closed.length && <Empty text="Nothing closed." />}
    </Section>
  </RightSheet>;
};

const Empty = ({ text }: { text: string }) => <div className="px-3 py-3 text-xs text-ink-400">{text}</div>;
// Group header — ACTIVE is always open; FULFILLED / CLOSED collapse (default) with the count on the header
const Section = ({ k, label, count, open, onToggle, hint, children }: { k: string; label: string; count: number; open: boolean; onToggle?: () => void; hint: string; children: ReactNode }) => <section data-testid={`inbox-panel-section-${k}`} data-count={count} data-open={open} className="rounded-md border border-line bg-canvas/40">
  <button type="button" data-testid={`inbox-panel-section-${k}-toggle`} disabled={!onToggle} onClick={onToggle} aria-expanded={open} className={clsx('flex w-full items-center gap-2 px-3 py-2 text-left', onToggle && 'hover:bg-canvas')}>
    {onToggle ? (open ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronRight size={14} className="text-ink-400" />) : <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />}
    <span className="text-[11px] font-bold uppercase tracking-wide text-ink">{label}</span><span data-testid={`inbox-panel-section-${k}-count`} className="rounded-full bg-ink px-1.5 font-mono text-[10px] font-semibold text-white">{count}</span><span className="truncate text-[10px] text-ink-400">{hint}</span>
  </button>
  {open && <div className="space-y-2 border-t border-line p-2">{children}</div>}
</section>;

// Client strip on top: name · a/b/c · dots (jobs with us, anchored job outlined) · contact · Client 360 · thread note
const ClientStrip = ({ clientId, threadId, currentJobId }: { clientId: string; threadId: string; currentJobId?: string }) => {
  const client = api.clientByIdSync(clientId); const [note, setNote] = useState(''); const [noting, setNoting] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  if (!client) return null;
  const save = async () => { if (!note.trim()) return; await api.addThreadNote(threadId, note); setNote(''); setNoting(false); setMsg('Internal note added to the thread'); window.setTimeout(() => setMsg(null), 2500); };
  return <section data-testid="inbox-panel-client" className="rounded-md border border-line bg-surface p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-ink">{fullName(client)}</span><RatingBadge clientId={client.id} testId="inbox-panel-rating" /><WbpClientRows clientId={client.id} currentJobId={currentJobId} testId="inbox-panel-client-wbp" /><Link to={`/clients/${client.id}`} data-testid="inbox-panel-open-client" className="ml-auto text-brand hover:underline">Client 360 →</Link></div>
    <div className="mt-1 flex flex-wrap items-center gap-2 text-ink-500"><span>{client.email} · {client.phone} · {client.city}, {client.state}</span><button type="button" data-testid="inbox-panel-thread-note" onClick={() => setNoting((v) => !v)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-brand hover:underline"><StickyNote size={11} /> Thread note</button>{msg && <span data-testid="inbox-panel-msg" className="text-[11px] text-moss-700">{msg}</span>}</div>
    {noting && <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void save(); }}><input autoFocus data-testid="inbox-panel-thread-note-text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note on the thread — never sent" className={`${field} flex-1`} /><Button size="sm" type="submit" data-testid="inbox-panel-thread-note-save">Save</Button></form>}
  </section>;
};

// Quick actions on a job snippet: Add note · Parts request · Generate summary (→ reply box) · Open job
const QuickActions = ({ job, threadId, onReload }: { job: JobWithRefs; threadId: string; onReload: () => void }) => {
  const [note, setNote] = useState(''); const [noting, setNoting] = useState(false); const [pr, setPr] = useState<PartsRequestWithRefs | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2500); };
  const addNote = async () => { if (!note.trim()) return; await api.addJobNote(job.id, note); setNote(''); setNoting(false); say('Note added to the job'); onReload(); };
  const gen = async () => { setBusy(true); try { const r = await draftJobSummary(await api.jobSummaryContext(job.id, job)); dropDraft(threadId, r.text); say(`${r.source === 'claude' ? 'Claude' : 'Rule-based'} draft dropped into the reply box`); } catch (e) { say(e instanceof Error ? e.message : 'Could not draft'); } finally { setBusy(false); } };
  return <div data-testid={`inbox-panel-actions-${job.id}`} className="space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" data-testid={`inbox-panel-note-${job.id}`} onClick={() => setNoting((v) => !v)}><StickyNote size={12} /> Add note</Button>
      {job.status !== 'closed' && <Button size="sm" data-testid={`inbox-panel-parts-${job.id}`} onClick={() => void api.openPartsRequest(job.id).then(setPr)}><Wrench size={12} /> Parts request</Button>}
      <Button size="sm" variant="primary" data-testid={`inbox-panel-summary-${job.id}`} disabled={busy} onClick={() => void gen()}>{busy ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate summary</Button>
      <Link to={`/jobs/${job.id}`} data-testid={`inbox-panel-open-job-${job.id}`} className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-canvas"><ExternalLink size={12} /> Open job</Link>
      {msg && <span data-testid={`inbox-panel-msg-${job.id}`} className="text-[11px] text-moss-700">{msg}</span>}
    </div>
    {noting && <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void addNote(); }}><input autoFocus data-testid={`inbox-panel-note-text-${job.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note on the job — stamped, audited" className={`${field} flex-1`} /><Button size="sm" type="submit" data-testid={`inbox-panel-note-save-${job.id}`}>Save</Button></form>}
    {pr && <PartsRequestModal request={pr} onClose={() => { setPr(null); onReload(); }} onChange={setPr} />}
  </div>;
};

// Process-flow lines, condensed: per component — where it is now · custody · blocker · next step
const FlowSnippet = ({ job }: { job: JobWithRefs }) => {
  const flow = api.jobFlowSync(job);
  return <div data-testid={`inbox-panel-flow-${job.id}`} data-done={flow.done} data-total={flow.total} className="rounded-md border border-line bg-surface text-xs">
    <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500"><span>Process flow</span><span className="rounded-sm bg-canvas px-1.5 font-mono text-ink">{flow.done} / {flow.total}</span></div>
    <ul className="divide-y divide-line/70">{flow.lines.map((l) => { const i = l.stages.findIndex((s) => s.state === 'current'); const cur = i >= 0 ? l.stages[i] : undefined; const blocker = l.stages.find((s) => s.blocker)?.blocker; const next = l.finished ? undefined : l.stages.slice(i + 1).find((s) => s.state === 'todo');
      return <li key={l.key} data-testid={`inbox-panel-line-${job.id}-${l.key}`} data-finished={l.finished} data-blocked={blocker?.tone} className="grid grid-cols-[28px_1fr] gap-2 px-3 py-2">
        <span className={clsx('grid h-6 w-6 place-items-center rounded-sm font-mono text-[11px] font-bold text-white', l.finished ? 'bg-moss' : 'bg-ink')} title={l.label}>{l.code}</span>
        <div className="min-w-0 space-y-0.5">
          <div className="text-ink"><b>{l.finished ? 'Finished' : cur?.label ?? 'In progress'}</b>{cur?.vendor && !l.finished ? <span className="text-violet-700"> · {cur.vendor.replace(/\s*\(.*\)$/, '')}</span> : null}{l.itemLabel && <span className="ml-1 font-mono text-[10px] text-ink-500">{l.itemLabel}</span>}<span className="ml-1 text-ink-400">· {l.label}</span></div>
          <div className="truncate text-ink-500"><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Custody</span> {l.custody.holder} · {l.custody.where}{l.custody.since ? ` · since ${fmtDate(l.custody.since)}` : ''}</div>
          {blocker && <div data-testid={`inbox-panel-blocker-${job.id}-${l.key}`} className={clsx('inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1', blocker.tone === 'red' ? 'bg-rose-50 text-rose-800 ring-rose-300' : 'bg-amber-50 text-amber-900 ring-amber-300')}>Blocker · {blocker.text}</div>}
          {l.mismatch && <div className="text-[10px] text-amber-800">status / custody mismatch · {l.mismatch}</div>}
          <div className="text-ink-500"><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Next</span> {l.finished ? 'reunite with the other components → pickup / ship' : next?.label ?? '—'}</div>
        </div>
      </li>; })}</ul>
  </div>;
};

// One job: SNIPPET (header + dots · flow lines · quick actions · Expand) ⇄ FULL (the whole job page content in place · Collapse · Open job)
const JobSnippet = ({ jobId, threadId, outlined, expanded, onExpand, onCollapse, onFocusJob, onChanged }: { jobId: string; threadId: string; outlined: boolean; expanded: boolean; onExpand: () => void; onCollapse: () => void; onFocusJob: (id: string) => void; onChanged: () => void }) => {
  const money = useShowMoney();
  const [job, setJob] = useState<JobWithRefs | null | undefined>(undefined); const [prs, setPrs] = useState<PartsRequestWithRefs[]>([]); const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<JobModalState>(null); const [openPr, setOpenPr] = useState<PartsRequestWithRefs | null>(null); const [labels, setLabels] = useState<LabelJob[] | null>(null); const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(async () => { setJob(await api.getJob(jobId)); setPrs(await api.getPartsRequestsForJob(jobId)); }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };
  const run: JobRun = async (fn, m) => { try { await fn(); await load(); onChanged(); if (m) { setErr(null); say(m); } } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  if (job === undefined) return <div className="px-3 py-2 text-xs text-ink-400">Loading…</div>;
  if (!job) return <div data-testid="inbox-panel-missing" className="text-xs text-rose-700">Job not found.</div>;
  const j = job; const row = api.wbpForJobSync(j.id); const done = !api.jobInPossessionSync(j); const pickup = api.jobPickupSync(j.id); const ret = api.jobReturnInfoSync(j); const returns = api.jobsReturnedFromSync(j.id); const hold = api.activeHold(j);
  return <article data-testid={`inbox-panel-job-${j.id}`} data-job={j.id} data-anchor={outlined || undefined} data-expanded={expanded} data-finished={done || undefined} className={clsx('rounded-md border bg-surface', outlined ? 'border-ink ring-1 ring-ink' : 'border-line')}>
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2"><span data-testid={`inbox-panel-watch-${j.id}`} className="text-sm font-semibold text-ink">{j.watch.brand} {j.watch.model}</span><span className="font-mono text-xs text-ink-500">Ref {j.watch.reference || '—'}</span><Link to={`/jobs/${j.id}`} data-testid={`inbox-panel-job-number-${j.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">{j.number}</Link>{row && <WbpDots row={row} size="lg" outlined={outlined} testId={`inbox-panel-wbp-${j.id}`} />}{outlined && <span data-testid={`inbox-panel-this-${j.id}`} className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">this thread</span>}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs"><StatusPill status={j.status} testId={`inbox-panel-status-${j.id}`} /><KindPill kind={j.kind} client={j.client} />{hold && <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">on hold{hold.component ? ` · ${api.PART_LABELS[hold.component]} only` : ''}</span>}<span className="text-ink-400">opened {fmtDate(j.createdAt)}{j.dueAt ? ` · due ${fmtDate(j.dueAt)}` : ''}</span></div>
      {done && <div data-testid={`inbox-panel-finished-${j.id}`} className="mt-2 rounded-sm bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700"><b>Finished</b>{j.finishedAt ? ` ${fmtDate(j.finishedAt)}` : ''}{pickup ? ` · ${pickup.how === 'picked_up' ? 'picked up' : 'shipped'} ${fmtDate(pickup.at)} · ${pickup.soNumber}` : ' · closed'}{returns.length > 0 && <> · <span className="text-rose-700">returned → {returns.map((r) => <button key={r.id} type="button" onClick={() => onFocusJob(r.id)} className="font-mono hover:underline">{r.number}</button>)}</span></>}</div>}
      {ret && <div data-testid={`inbox-panel-return-${j.id}`} className="mt-2 rounded-sm border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"><b>Returned from</b> <button type="button" data-testid={`inbox-panel-return-original-${j.id}`} onClick={() => onFocusJob(ret.original.id)} className="font-mono font-semibold hover:underline">{ret.original.number}</button>{ret.pickup ? ` · ${ret.pickup.how === 'picked_up' ? 'picked up' : 'shipped'} ${fmtDate(ret.pickup.at)}` : ''}{ret.reason ? ` — ${ret.reason}` : ''}
        {ret.original.inspection && <details data-testid={`inbox-panel-return-inspection-${j.id}`} className="mt-1"><summary className="cursor-pointer text-[11px] font-semibold">Original inspection report · {ret.original.inspection.by}, {fmtDate(ret.original.inspection.at)}</summary><ul className="mt-1 grid grid-cols-2 gap-x-3 text-[11px]">{Object.entries(ret.original.inspection.answers).map(([k, v]) => <li key={k}><span className="text-amber-800/70">{k}:</span> {String(v)}</li>)}</ul></details>}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {expanded ? <><Button size="sm" data-testid={`inbox-panel-collapse-${j.id}`} onClick={onCollapse}><Minimize2 size={12} /> Collapse</Button><Link to={`/jobs/${j.id}`} data-testid={`inbox-panel-leave-${j.id}`} className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-canvas"><ExternalLink size={12} /> Open job</Link><span className="text-[10px] text-ink-400">full job card · everything on /jobs/{j.id.replace(/^j-/, '')}</span></>
          : <Button size="sm" data-testid={`inbox-panel-expand-${j.id}`} onClick={onExpand}><Maximize2 size={12} /> Expand full job card</Button>}
        {flash && <span data-testid={`inbox-panel-flash-${j.id}`} className="text-[11px] text-moss-700">{flash}</span>}{err && <span data-testid={`inbox-panel-error-${j.id}`} className="text-[11px] text-rose-700">{err}</span>}
      </div>
    </div>
    {!expanded && <div className="space-y-2 border-t border-line p-2"><FlowSnippet job={j} /><QuickActions job={j} threadId={threadId} onReload={() => { void load(); onChanged(); }} /></div>}
    {expanded && <div className="border-t border-line p-2"><QuickActions job={j} threadId={threadId} onReload={() => { void load(); onChanged(); }} /><div className="mt-2"><JobDetailContent j={j} run={run} load={() => void load()} prs={prs} setOpenPr={setOpenPr} setModal={setModal} money={money} embedded /></div><JobModals j={j} modal={modal} setModal={setModal} labels={labels} setLabels={setLabels} openPr={openPr} setOpenPr={setOpenPr} load={load} say={say} /></div>}
  </article>;
};

// FULFILLED row: est# · watch · finished · picked up / shipped · SO# — NO dots (it left us). Expand per row → the snippet / full card.
const FulfilledRow = ({ f, expanded, onToggle, children }: { f: PanelFulfilled; expanded: boolean; onToggle: () => void; children: ReactNode }) => {
  const w = api.watchByIdSync(f.job.watchId);
  return <div data-testid={`inbox-panel-fulfilled-${f.job.id}`} data-expanded={expanded}>
    <button type="button" data-testid={`inbox-panel-fulfilled-toggle-${f.job.id}`} onClick={onToggle} aria-expanded={expanded} className={clsx('flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-left text-xs hover:bg-canvas', expanded ? 'border-ink bg-surface' : 'border-line bg-surface')}>
      {expanded ? <ChevronDown size={12} className="text-ink-400" /> : <ChevronRight size={12} className="text-ink-400" />}<span className="font-mono font-semibold text-ink">{f.job.number}</span><span className="text-ink-700">{w ? `${w.brand} ${w.model}` : ''}</span>
      <span className="ml-auto text-ink-500">{f.job.finishedAt ? `finished ${fmtDate(f.job.finishedAt)}` : 'closed'}{f.pickup ? ` · ${f.pickup.how === 'picked_up' ? 'picked up' : 'shipped'} ${fmtDate(f.pickup.at)}` : ''}</span>{f.pickup && <span className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-600 ring-1 ring-line">{f.pickup.soNumber}</span>}
    </button>
    {expanded && <div className="mt-1 pl-2">{children}</div>}
  </div>;
};

// CLOSED row: est# / RQ# · watch · closed reason · date → opens the estimate / the requests list
const ClosedRow = ({ x }: { x: PanelClosed }) => <Link to={x.kind === 'estimate' ? `/estimates/${x.id}` : '/requests'} data-testid={`inbox-panel-closed-${x.id}`} data-kind={x.kind} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs hover:bg-canvas">
  <span className="font-mono font-semibold text-ink">{x.number}</span><span className="text-ink-700">{x.watchLabel}</span><span className="rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] text-ink-600 ring-1 ring-line">{x.kind === 'estimate' ? 'estimate' : 'request'}</span><span className="truncate text-ink-500">{x.reason}</span><span className="ml-auto text-ink-400">{fmtDate(x.at)}</span>
</Link>;

// ACTIVE request (no job yet): one line + "Show submission" → what the client wrote, photos, watch + legs, instant range, Create estimate. The thread's own request opens expanded.
const RequestEntry = ({ r, threadId, outlined }: { r: ServiceRequest; threadId: string; outlined: boolean }) => {
  const [expanded, setExpanded] = useState(outlined); const [note, setNote] = useState(''); const [noting, setNoting] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setExpanded(outlined); }, [outlined, r.id]);
  const watch = api.watchByIdSync(r.watchId); const legs = api.requestLegsSync(r); const range = api.requestInstantRangeSync(r);
  const save = async () => { if (!note.trim()) return; await api.addThreadNote(threadId, note); setNote(''); setNoting(false); setMsg('Internal note added to the thread'); window.setTimeout(() => setMsg(null), 2500); };
  return <section data-testid={`inbox-panel-request-${r.id}`} data-request={r.id} data-anchor={outlined || undefined} data-expanded={expanded} className={clsx('rounded-md border bg-surface p-3 text-xs', outlined ? 'border-ink ring-1 ring-ink' : 'border-line')}>
    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-ink">{r.number}</span><StatusPill status={r.status} /><span data-testid={`inbox-panel-request-source-${r.id}`} className="rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 ring-1 ring-line">{SOURCE_LABEL[r.source]}</span><span className="text-ink-400">{relativeTime(r.createdAt)} · {r.createdBy}</span>{outlined && <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">this thread</span>}<button type="button" data-testid={`inbox-panel-request-toggle-${r.id}`} onClick={() => setExpanded((v) => !v)} className="ml-auto text-[11px] text-brand hover:underline">{expanded ? 'Hide submission' : 'Show submission'}</button></div>
    {!expanded && <p className="mt-1 truncate text-ink-700">{r.summary}</p>}
    {expanded && <>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-400">What the client wrote</div>
      <p data-testid={`inbox-panel-request-text-${r.id}`} className="mt-0.5 whitespace-pre-line text-[13px] text-ink-800">{r.summary}{r.kiosk?.notes ? `\n\n${r.kiosk.notes}` : ''}</p>
      {r.photos?.length ? <div data-testid={`inbox-panel-request-photos-${r.id}`} className="mt-2 flex flex-wrap gap-1.5">{r.photos.map((p) => <img key={p.id} src={p.dataUrl} alt={p.fileName ?? ''} title={p.fileName} className="h-16 w-20 rounded-sm border border-line object-cover" />)}</div> : null}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Watch</div><div data-testid={`inbox-panel-request-watch-${r.id}`}>{watch ? `${watch.brand} ${watch.model} · ${watch.reference}` : 'Not captured yet'}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Bracelet</div><div>{watch?.bracelet ?? 'Not captured'}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Legs</div><div data-testid={`inbox-panel-request-legs-${r.id}`} className="flex gap-1">{legs.length ? legs.map((l) => <span key={l} className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{l} · {LEG_LABEL[l]}</span>) : <span className="text-ink-400">Not captured</span>}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Instant range</div><div data-testid={`inbox-panel-request-range-${r.id}`}>{range ? <span className="font-semibold text-ink">{fmtMoney(range.low)} – {fmtMoney(range.high)}<span className="ml-1 font-normal text-ink-400">from the quote key · not a promise</span></span> : <span className="text-ink-400">No quote key yet</span>}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">{r.estimateId ? <Link to={`/estimates/${r.estimateId}`} data-testid={`inbox-panel-open-estimate-${r.id}`}><Button size="sm">Open estimate</Button></Link> : <Link to={`/estimates/new?request=${r.id}`} data-testid={`inbox-panel-create-estimate-${r.id}`}><Button size="sm" variant="primary"><FilePlus2 size={12} /> Create estimate</Button></Link>}<Button size="sm" data-testid={`inbox-panel-request-note-${r.id}`} onClick={() => setNoting((v) => !v)}><StickyNote size={12} /> Add note</Button><Link to="/requests" data-testid={`inbox-panel-open-request-${r.id}`} className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-canvas"><ExternalLink size={12} /> Requests</Link>{msg && <span className="text-[11px] text-moss-700">{msg}</span>}</div>
      {noting && <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void save(); }}><input autoFocus data-testid={`inbox-panel-request-note-text-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note on the thread — never sent" className={`${field} flex-1`} /><Button size="sm" type="submit" data-testid={`inbox-panel-request-note-save-${r.id}`}>Save</Button></form>}
    </>}
  </section>;
};
