import { ExternalLink, FilePlus2, RefreshCw, Sparkles, StickyNote, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Job, JobWithRefs, PartsRequestWithRefs, ServiceRequest, ThreadView } from '@/api/client';
import { draftJobSummary } from '@/api/ai';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { AddOnsPanel } from '@/components/jobs/AddOnsPanel';
import { ClientRequestsPanel } from '@/components/jobs/ClientRequests';
import { CollapsedCard } from '@/components/jobs/CollapsedCard';
import { KindPill } from '@/components/jobs/JobBits';
import { LinesTable, PhotosPanel } from '@/components/jobs/JobPanels';
import { JobTimeline } from '@/components/jobs/JobTimeline';
import { OutsourceInfo } from '@/components/jobs/OutsourceInfo';
import { ProcessFlow } from '@/components/jobs/ProcessFlow';
import { PartsRequestModal } from '@/components/parts/PartsChat';
import { WbpClientRows, WbpDots } from '@/components/shared/WbpDots';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { RightSheet } from '@/components/ui/RightSheet';
import { field } from '@/components/rs/RsBits';
import { fmtDate, fmtMoney, fmtMoneyCents, fullName, relativeTime } from '@/lib/format';

// INBOX JOB-CARD SLIDE-OUT (MH 2026-10-01). Anchored to a JOB → the job page, read-only except quick actions. Anchored to a REQUEST → the submission.
// Anchored to nothing → Client 360 summary. Stays open across threads; swaps content when the anchor changes. "Generate summary" drops the draft into the open thread's reply box.
export const INBOX_DRAFT_EVENT = 'rollisuite:inbox-draft';
export const dropDraft = (threadId: string, text: string) => window.dispatchEvent(new CustomEvent(INBOX_DRAFT_EVENT, { detail: { threadId, text } }));
type Run = (fn: () => Promise<unknown>, msg: string) => Promise<void>;
const SOURCE_LABEL: Record<ServiceRequest['source'], string> = { web: 'Web form', kiosk: 'Kiosk', email: 'Email', call: 'Phone call', walk_in: 'Walk-in' };
const LEG_LABEL: Record<string, string> = { W: 'Watch', B: 'Band', P: 'Polish', PM: 'Watch (PM)' };
const isDone = (j: Job) => j.status === 'closed' || j.simpleStatus === 'finished';

export const InboxJobCard = ({ thread, onClose, pad }: { thread: ThreadView; onClose: () => void; pad?: boolean }) => {
  const c = thread.conversation; const anchor = c.anchor; const [swapJobId, setSwapJobId] = useState<string | null>(null);
  useEffect(() => { setSwapJobId(null); }, [c.id]);
  const jobId = swapJobId ?? (anchor?.kind === 'job' ? anchor.id : anchor?.kind === 'estimate' ? api.jobForEstimateSync(anchor.id)?.id ?? null : null);
  const request = !jobId && anchor?.kind === 'request' ? api.requestByIdSync(anchor.id) : undefined;
  const mode = jobId ? 'job' : request ? 'request' : 'client';
  const title = mode === 'job' ? <span className="flex items-center gap-2"><span>Job card</span><span className="font-mono text-ink-500">{api.jobNumberSync(jobId!) ?? ''}</span>{swapJobId && <button type="button" data-testid="inbox-panel-back" onClick={() => setSwapJobId(null)} className="text-[11px] font-normal text-brand hover:underline">← back to thread anchor</button>}</span>
    : mode === 'request' ? <span>Request · <span className="font-mono text-ink-500">{request!.number}</span></span> : <span>Client · {fullName(c.client)}</span>;
  return <RightSheet title={title} onClose={onClose} testId="inbox-panel" kind={mode} pad={pad}>
    {mode === 'job' && <JobCard key={jobId} jobId={jobId!} threadId={c.id} clientId={c.clientId} onSwap={setSwapJobId} />}
    {mode === 'request' && <RequestCard r={request!} threadId={c.id} onSwap={setSwapJobId} />}
    {mode === 'client' && <ClientCard clientId={c.clientId} threadId={c.id} onSwap={setSwapJobId} />}
  </RightSheet>;
};

// Quick actions shared by every mode: Add note · Parts request (job) · Generate summary (job in focus) · Open job / request
const QuickActions = ({ job, threadId, requestId, onReload }: { job?: JobWithRefs; threadId: string; requestId?: string; onReload: () => void }) => {
  const [note, setNote] = useState(''); const [noting, setNoting] = useState(false); const [pr, setPr] = useState<PartsRequestWithRefs | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2500); };
  const addNote = async () => { if (!note.trim()) return; if (job) await api.addJobNote(job.id, note); else await api.addThreadNote(threadId, note); setNote(''); setNoting(false); say(job ? 'Note added to the job' : 'Internal note added to the thread'); onReload(); };
  const gen = async () => { if (!job) return; setBusy(true); try { const r = await draftJobSummary(await api.jobSummaryContext(job.id, job)); dropDraft(threadId, r.text); say(`${r.source === 'claude' ? 'Claude' : 'Rule-based'} draft dropped into the reply box`); } catch (e) { say(e instanceof Error ? e.message : 'Could not draft'); } finally { setBusy(false); } };
  return <div data-testid="inbox-panel-actions" className="space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" data-testid="inbox-panel-note" onClick={() => setNoting((v) => !v)}><StickyNote size={12} /> Add note</Button>
      {job && job.status !== 'closed' && <Button size="sm" data-testid="inbox-panel-parts" onClick={() => void api.openPartsRequest(job.id).then(setPr)}><Wrench size={12} /> Parts request</Button>}
      {job && <Button size="sm" variant="primary" data-testid="inbox-panel-summary" disabled={busy} onClick={() => void gen()}>{busy ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate summary</Button>}
      {job && <Link to={`/jobs/${job.id}`} data-testid="inbox-panel-open-job" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-canvas"><ExternalLink size={12} /> Open job</Link>}
      {requestId && <Link to="/requests" data-testid="inbox-panel-open-request" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-canvas"><ExternalLink size={12} /> Open request</Link>}
      {msg && <span data-testid="inbox-panel-msg" className="text-[11px] text-moss-700">{msg}</span>}
    </div>
    {noting && <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void addNote(); }}><input autoFocus data-testid="inbox-panel-note-text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={job ? 'Note on the job — stamped, audited' : 'Internal note on the thread — never sent'} className={`${field} flex-1`} /><Button size="sm" type="submit" data-testid="inbox-panel-note-save">Save</Button></form>}
    {pr && <PartsRequestModal request={pr} onClose={() => { setPr(null); onReload(); }} onChange={setPr} />}
  </div>;
};

// Other active jobs of this client, beneath — dots per job, tap to swap the panel to that job
const OtherJobs = ({ clientId, excludeJobId, onSwap, title = 'Other active jobs' }: { clientId: string; excludeJobId?: string; onSwap: (id: string) => void; title?: string }) => {
  const rows = api.wbpForClientSync(clientId).filter((r) => r.jobId !== excludeJobId).sort((a, b) => (api.jobByIdSync(b.jobId)?.createdAt ?? '').localeCompare(api.jobByIdSync(a.jobId)?.createdAt ?? ''));
  if (!rows.length) return null;
  return <section data-testid="inbox-panel-other-jobs" data-count={rows.length} className="rounded-md border border-line bg-surface">
    <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title} · {rows.length}</div>
    <ul className="divide-y divide-line">{rows.map((r) => { const j = api.jobByIdSync(r.jobId); return <li key={r.jobId}><button type="button" data-testid={`inbox-panel-swap-${r.jobId}`} onClick={() => onSwap(r.jobId)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs hover:bg-canvas"><WbpDots row={r} number size="lg" testId={`inbox-panel-other-wbp-${r.jobId}`} /><span className="truncate text-ink-700">{r.watchLabel}</span>{j && <StatusPill status={j.status} />}<span className="ml-auto text-[10px] text-brand">open in panel →</span></button></li>; })}</ul>
  </section>;
};

// JOB — the job page content, read-only except quick actions
const JobCard = ({ jobId, threadId, clientId, onSwap }: { jobId: string; threadId: string; clientId: string; onSwap: (id: string) => void }) => {
  const [job, setJob] = useState<JobWithRefs | null | undefined>(undefined); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { setJob(await api.getJob(jobId)); }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (fn, m) => { try { await fn(); await load(); if (m) setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  if (job === undefined) return <div className="text-xs text-ink-400">Loading…</div>;
  if (!job) return <div data-testid="inbox-panel-missing" className="text-xs text-rose-700">Job not found.</div>;
  const j = job; const row = api.wbpForJobSync(j.id); const done = isDone(j); const pickup = done ? api.jobPickupSync(j.id) : undefined; const ret = api.jobReturnInfoSync(j); const returns = api.jobsReturnedFromSync(j.id);
  return <div className="space-y-3">
    <section data-testid="inbox-panel-job-header" data-job={j.id} data-finished={done || undefined} className="rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2"><span data-testid="inbox-panel-watch" className="text-sm font-semibold text-ink">{j.watch.brand} {j.watch.model}</span><span className="font-mono text-xs text-ink-500">Ref {j.watch.reference || '—'}</span><Link to={`/jobs/${j.id}`} data-testid="inbox-panel-job-number" className="font-mono text-xs font-semibold text-brand hover:underline">{j.number}</Link>{row && <WbpDots row={row} size="lg" testId="inbox-panel-wbp" />}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs"><StatusPill status={j.status} testId="inbox-panel-status" /><KindPill kind={j.kind} client={j.client} />{api.activeHold(j) && <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">on hold{api.activeHold(j)!.component ? ` · ${api.PART_LABELS[api.activeHold(j)!.component!]} only` : ''}</span>}<span className="text-ink-500">{fullName(j.client)}</span><RatingBadge clientId={j.clientId} testId="inbox-panel-rating" /><span className="text-ink-400">opened {fmtDate(j.createdAt)}{j.dueAt ? ` · due ${fmtDate(j.dueAt)}` : ''}</span></div>
      {done && <div data-testid="inbox-panel-finished" className="mt-2 rounded-sm bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700"><b>Finished</b>{j.finishedAt ? ` ${fmtDate(j.finishedAt)}` : ''}{pickup ? ` · ${pickup.how === 'picked_up' ? 'picked up' : 'shipped'} ${fmtDate(pickup.at)} · ${pickup.soNumber}` : ' · not yet collected'}{returns.length > 0 && <> · <span className="text-rose-700">returned → {returns.map((r) => <Link key={r.id} to={`/jobs/${r.id}`} className="font-mono hover:underline">{r.number}</Link>)}</span></>}</div>}
      {ret && <div data-testid="inbox-panel-return" className="mt-2 rounded-sm border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"><b>Returned from</b> <button type="button" data-testid="inbox-panel-return-original" onClick={() => onSwap(ret.original.id)} className="font-mono font-semibold hover:underline">{ret.original.number}</button>{ret.pickup ? ` · ${ret.pickup.how === 'picked_up' ? 'picked up' : 'shipped'} ${fmtDate(ret.pickup.at)}` : ''}{ret.reason ? ` — ${ret.reason}` : ''}
        {ret.original.inspection && <details data-testid="inbox-panel-return-inspection" className="mt-1"><summary className="cursor-pointer text-[11px] font-semibold">Original inspection report · {ret.original.inspection.by}, {fmtDate(ret.original.inspection.at)}</summary><ul className="mt-1 grid grid-cols-2 gap-x-3 text-[11px]">{Object.entries(ret.original.inspection.answers).map(([k, v]) => <li key={k}><span className="text-amber-800/70">{k}:</span> {String(v)}</li>)}</ul></details>}</div>}
    </section>
    <QuickActions job={j} threadId={threadId} onReload={() => void load()} />
    {err && <div data-testid="inbox-panel-error" className="text-xs text-rose-700">{err}</div>}
    <Card title="Process flow" subtitle="custody + blockers per line" testId="inbox-panel-flow"><ProcessFlow job={j} /></Card>
    <Card title="Client requests" testId="inbox-panel-client-requests" className="border-l-[3px] border-amber-400 bg-amber-50/40"><ClientRequestsPanel job={j} run={run} /></Card>
    <Card title="Add-ons since estimate" testId="inbox-panel-addons"><AddOnsPanel job={j} run={run} /></Card>
    <Card title="Outsource / concierge" subtitle="information only" testId="inbox-panel-vendor"><OutsourceInfo jobId={j.id} /></Card>
    <Card title="Status timeline" testId="inbox-panel-timeline"><JobTimeline job={j} /></Card>
    <CollapsedCard title="Original estimate" subtitle={j.estimate ? `${j.estimate.number} · ${j.lines.length} line${j.lines.length === 1 ? '' : 's'} · ${fmtMoneyCents(j.total)}` : `${j.lines.length} line${j.lines.length === 1 ? '' : 's'} · no estimate`} testId="inbox-panel-estimate"><div className="-m-4"><LinesTable job={j} /></div></CollapsedCard>
    <CollapsedCard title="Inspection report" subtitle={j.inspection ? `completed by ${j.inspection.by} · ${fmtDate(j.inspection.at)}` : 'not yet completed'} testId="inbox-panel-inspection">{j.inspection ? <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{Object.entries(j.inspection.answers).map(([k, v]) => <li key={k}><span className="text-ink-500">{k}:</span> {String(v)}</li>)}</ul> : <div className="text-xs text-ink-400">Nothing recorded yet.</div>}</CollapsedCard>
    <CollapsedCard title="More" subtitle={`${j.photos.length} photo${j.photos.length === 1 ? '' : 's'} · ${j.notes.length} note${j.notes.length === 1 ? '' : 's'}`} testId="inbox-panel-more"><div className="space-y-3"><PhotosPanel job={j} run={run} />{j.notes.length > 0 && <ul className="space-y-1 text-xs">{j.notes.map((n) => <li key={n.id} className="rounded-sm bg-yellow-50 px-2 py-1 text-ink-700">{n.text} <span className="text-ink-400">— {n.by}, {fmtDate(n.at)}</span></li>)}</ul>}</div></CollapsedCard>
    <OtherJobs clientId={clientId} excludeJobId={j.id} onSwap={onSwap} />
  </div>;
};

// REQUEST — the submission (no job yet): what the client wrote, photos, watch + legs, instant range, source, Create estimate; other active jobs beneath
const RequestCard = ({ r, threadId, onSwap }: { r: ServiceRequest; threadId: string; onSwap: (id: string) => void }) => {
  const client = api.clientByIdSync(r.clientId); const watch = api.watchByIdSync(r.watchId); const legs = api.requestLegsSync(r); const range = api.requestInstantRangeSync(r); const [, setTick] = useState(0);
  return <div className="space-y-3">
    <section data-testid="inbox-panel-request" data-request={r.id} className="rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-ink">{r.number}</span><StatusPill status={r.status} /><span data-testid="inbox-panel-request-source" className="rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 ring-1 ring-line">{SOURCE_LABEL[r.source]}</span><span className="text-ink-400">{relativeTime(r.createdAt)} · {r.createdBy} · {r.station}</span></div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">{client && <><span className="font-medium text-ink">{fullName(client)}</span><RatingBadge clientId={client.id} testId="inbox-panel-rating" /><WbpClientRows clientId={client.id} compact testId="inbox-panel-request-wbp" /></>}</div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-400">What the client wrote</div>
      <p data-testid="inbox-panel-request-text" className="mt-0.5 whitespace-pre-line text-[13px] text-ink-800">{r.summary}{r.kiosk?.notes ? `\n\n${r.kiosk.notes}` : ''}</p>
      {r.photos?.length ? <div data-testid="inbox-panel-request-photos" className="mt-2 flex flex-wrap gap-1.5">{r.photos.map((p) => <img key={p.id} src={p.dataUrl} alt={p.fileName ?? ''} title={p.fileName} className="h-16 w-20 rounded-sm border border-line object-cover" />)}</div> : null}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Watch</div><div data-testid="inbox-panel-request-watch">{watch ? `${watch.brand} ${watch.model} · ${watch.reference}` : 'Not captured yet'}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Bracelet</div><div data-testid="inbox-panel-request-bracelet">{watch?.bracelet ?? 'Not captured'}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Legs</div><div data-testid="inbox-panel-request-legs" className="flex gap-1">{legs.length ? legs.map((l) => <span key={l} className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{l} · {LEG_LABEL[l]}</span>) : <span className="text-ink-400">Not captured</span>}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Instant range</div><div data-testid="inbox-panel-request-range">{range ? <span className="font-semibold text-ink">{fmtMoney(range.low)} – {fmtMoney(range.high)}<span className="ml-1 font-normal text-ink-400">from the quote key · not a promise</span></span> : <span className="text-ink-400">No quote key yet</span>}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{r.estimateId ? <Link to={`/estimates/${r.estimateId}`} data-testid="inbox-panel-open-estimate"><Button size="sm">Open estimate</Button></Link> : <Link to={`/estimates/new?request=${r.id}`} data-testid="inbox-panel-create-estimate"><Button size="sm" variant="primary"><FilePlus2 size={12} /> Create estimate</Button></Link>}</div>
    </section>
    <QuickActions threadId={threadId} requestId={r.id} onReload={() => setTick((n) => n + 1)} />
    <OtherJobs clientId={r.clientId} onSwap={onSwap} title="Client’s active jobs" />
  </div>;
};

// NO ANCHOR — Client 360 summary: rating, dots, last three jobs
const ClientCard = ({ clientId, threadId, onSwap }: { clientId: string; threadId: string; onSwap: (id: string) => void }) => {
  const client = api.clientByIdSync(clientId); const [jobs, setJobs] = useState<JobWithRefs[]>([]); const [, setTick] = useState(0);
  useEffect(() => { void api.getJobsForClient(clientId).then((j) => setJobs([...j].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3))); }, [clientId]);
  if (!client) return null;
  return <div className="space-y-3">
    <section data-testid="inbox-panel-client" className="rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-ink">{fullName(client)}</span><RatingBadge clientId={client.id} testId="inbox-panel-rating" /><WbpClientRows clientId={client.id} testId="inbox-panel-client-wbp" /><Link to={`/clients/${client.id}`} data-testid="inbox-panel-open-client" className="ml-auto text-brand hover:underline">Client 360 →</Link></div>
      <div className="mt-1 text-ink-500">{client.email} · {client.phone} · {client.city}, {client.state}</div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Last three jobs</div>
      <ul data-testid="inbox-panel-client-jobs" className="mt-1 divide-y divide-line">{jobs.map((j) => { const row = api.wbpForJobSync(j.id); return <li key={j.id} className="flex flex-wrap items-center gap-2 py-1.5"><button type="button" data-testid={`inbox-panel-client-job-${j.id}`} onClick={() => onSwap(j.id)} className="font-mono font-semibold text-brand hover:underline">{j.number}</button><span className="text-ink-700">{j.watch.brand} {j.watch.model}</span><StatusPill status={j.status} />{row && <WbpDots row={row} />}<span className="ml-auto text-ink-400">{isDone(j) ? `finished ${fmtDate(j.finishedAt ?? j.createdAt)}` : `opened ${fmtDate(j.createdAt)}`}</span></li>; })}{!jobs.length && <li className="py-2 text-ink-400">No jobs yet.</li>}</ul>
    </section>
    <QuickActions threadId={threadId} onReload={() => setTick((n) => n + 1)} />
  </div>;
};
