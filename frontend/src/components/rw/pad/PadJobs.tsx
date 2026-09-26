import { ArrowLeft, ArrowRight, Camera, ChevronRight, ClipboardList, UserRound, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import { MessagesPanel } from '@/components/jobs/JobMessages';
import type { JobPhotoView, PadCard, PadConditionView, SendBackReason } from '@/api/client';
import { ClientRequestBadge, ClientRequestList, QcRequestChecklist } from '@/components/jobs/ClientRequests';
import { PartDot, PartLocations } from '@/components/rw/RwBits';
import { Big, Chip, Sheet } from './PadBits';
import { CameraCapture } from './PadCamera';
import { fmtDate, fmtTime } from '@/lib/format';

type Say = (m: string, tone?: 'ok' | 'learn' | 'err') => void;
const GRADE_TONE: Record<string, string> = { good: 'bg-emerald-700 text-emerald-50', fair: 'bg-amber-500 text-[#161b22]', worn: 'bg-orange-600 text-white', replace: 'bg-rose-600 text-white' };

// Send back requires a reason — logged who / when / why
const SendBackSheet = ({ card, onClose, onDone }: { card: PadCard; onClose: () => void; onDone: Say }) => {
  const [reason, setReason] = useState<SendBackReason | null>(null); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  return <Sheet testId="pad-sendback-modal" title={`Send ${card.job.number} back`} sub={<>From <b className="text-white">{card.stageLabel}</b> to the previous stage — pick a reason.</>} onClose={onClose}>
    <div className="grid grid-cols-2 gap-2">{(Object.entries(api.SEND_BACK_REASONS) as [SendBackReason, string][]).map(([k, l]) => <button key={k} data-testid={`pad-reason-${k}`} onClick={() => setReason(k)} className={`min-h-[60px] rounded-2xl border text-lg font-medium ${reason === k ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-white/15 text-slate-200'}`}>{l}</button>)}</div>
    <textarea data-testid="pad-reason-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={reason === 'other' ? 'Note (required for Other)' : 'Note (optional)'} className="mt-3 w-full rounded-2xl border border-white/15 bg-[#0f131a] px-4 py-3 text-lg" />
    {err && <p data-testid="pad-sendback-error" className="mt-2 text-sm text-rose-400">{err}</p>}
    <div className="mt-4"><Big full testId="pad-sendback-confirm" tone="danger" disabled={!reason} onClick={async () => { try { await api.padSendBack(card.job.id, reason!, note); onDone(`${card.job.number} sent back · ${api.SEND_BACK_REASONS[reason!]}`); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }}><ArrowLeft size={18} /> Send back</Big></div>
  </Sheet>;
};

// Tech picker — supervisor override of the working tech; reflects on /rw/wm immediately
const TechSheet = ({ card, onClose, onDone }: { card: PadCard; onClose: () => void; onDone: Say }) => {
  const techs = api.getRoomTechs(); const [err, setErr] = useState<string | null>(null);
  return <Sheet testId="pad-tech-sheet" title="Assign tech" sub={<>{card.job.number} · {card.job.watch.brand} {card.job.watch.model} · logged as a supervisor override</>} onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">{techs.map((u) => <button key={u.id} data-testid={`pad-tech-pick-${u.shortName.toLowerCase()}`} onClick={async () => { try { await api.padSetTech(card.job.id, u.shortName); onDone(`${card.job.number} → ${u.shortName} · supervisor override`); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }} className={`min-h-[72px] rounded-2xl border p-4 text-left ${card.job.assignees[0] === u.shortName ? 'border-amber-400 bg-amber-400/15' : 'border-white/15 hover:bg-white/5'}`}><div className="text-xl font-semibold text-white">{u.shortName}</div><div className="text-sm text-slate-400">{u.dutyLabel}</div></button>)}</div>
    {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
  </Sheet>;
};

// Detail sheet — photo set (grid + zoom) AND the condition report, read-only. The supervisor never leaves the pad.
const DetailSheet = ({ card, onClose, say }: { card: PadCard; onClose: () => void; say: Say }) => {
  const [photos, setPhotos] = useState<JobPhotoView[]>([]); const [cond, setCond] = useState<PadConditionView | null>(null); const [open, setOpen] = useState<JobPhotoView | null>(null); const [zoom, setZoom] = useState(false);
  const [tick, setTick] = useState(0); useEffect(() => { api.getJobPhotoViews(card.job.id).then(setPhotos); api.getPadCondition(card.job.id).then(setCond); }, [card.job.id, tick]);
  return <Sheet wide testId="pad-detail-sheet" title={<span className="font-mono">{card.job.number}</span>} sub={<>{card.job.watch.brand} {card.job.watch.model} · <span className="font-mono">{card.job.watch.reference}</span> · {card.stageLabel} · {card.job.assignees.join(', ') || 'unassigned'}</>} onClose={onClose}>
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section><div className="mb-2 flex items-center justify-between"><h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white"><Camera size={18} /> Photos <span className="font-mono text-slate-400">{photos.length}</span></h3><CameraCapture jobId={card.job.id} jobNumber={card.job.number} onDone={(m) => { say(m); setTick((t) => t + 1); }} /></div>
        <div data-testid="pad-detail-photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((p) => <button key={p.id} data-testid={`pad-photo-${p.id}`} onClick={() => { setOpen(p); setZoom(false); }} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white/5"><img src={p.url} alt={p.slot} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1.5 text-left text-sm"><span className={`mr-1.5 rounded-sm px-1 text-[10px] uppercase ${p.kind === 'intake' ? 'bg-sky-500/80' : 'bg-amber-500/80 text-black'}`}>{p.kind}</span>{p.slot}</span></button>)}{!photos.length && <p data-testid="pad-detail-nophotos" className="col-span-full py-8 text-center text-slate-500">No photos on this job yet — tap Camera to take the first.</p>}</div></section>
      <section data-testid="pad-detail-condition"><h3 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold text-white"><ClipboardList size={18} /> Condition on arrival</h3>
        {cond?.source === 'none' && <p className="text-slate-500">No inspection recorded yet.{cond.notes && <> Intake note: {cond.notes}</>}</p>}
        {cond && cond.source !== 'none' && <><p className="mb-2 text-sm text-slate-400">{cond.source === 'report' ? 'Condition report' : 'Inspection form'} · {cond.issuedBy} · {cond.issuedAt && fmtDate(cond.issuedAt)}</p>
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">{cond.rows.map((r) => <li key={r.component} data-testid={`pad-cond-${r.component.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="flex items-start gap-3 px-4 py-3"><span className="w-28 shrink-0 text-base text-slate-200">{r.component}</span><span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold capitalize ${GRADE_TONE[r.grade] ?? 'bg-white/10 text-slate-100'}`}>{r.grade}</span>{r.note && <span className="text-sm text-slate-300">{r.note}</span>}</li>)}</ul>
          {cond.notes && <p className="mt-3 rounded-2xl bg-white/5 px-4 py-3 text-base text-slate-200">{cond.notes}</p>}</>}
      </section>
    </div>
    <section data-testid="pad-detail-messages" className="mt-6"><h3 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold text-white"><MessageSquare size={18} /> Messages <span className="text-sm font-normal text-slate-500">threaded · @ to route · internal only</span></h3><MessagesPanel job={card.job} dark /></section>
    {open && <div data-testid="rw-lightbox" className="fixed inset-0 z-[70] flex flex-col bg-black" onClick={() => setOpen(null)}><div className="flex items-center justify-between px-5 py-3 text-sm text-white"><span>{open.slot} · {open.kind} · {open.by} · {fmtDate(open.at)} {fmtTime(open.at)}</span><span className="text-slate-400">tap image to zoom · tap outside to close</span></div><div className="flex flex-1 items-center justify-center overflow-auto p-4"><img src={open.url} alt={open.slot} onClick={(e) => { e.stopPropagation(); setZoom((z) => !z); }} className={`rounded-lg transition-transform duration-200 ${zoom ? 'scale-[1.8] cursor-zoom-out' : 'max-h-full cursor-zoom-in'}`} /></div></div>}
  </Sheet>;
};

const STAGES = ['approved', 'in_service', 'testing', 'ready_to_ship'];
const Stepper = ({ stage }: { stage: string }) => <div data-testid="pad-stepper" className="flex items-center gap-1">{STAGES.map((s, i) => <span key={s} className={`h-2 flex-1 rounded-full ${i <= STAGES.indexOf(stage) ? 'bg-amber-400' : 'bg-white/10'}`} />)}</div>;

export const PadJobs = ({ cards, hit, say, reload }: { cards: PadCard[]; hit: string | null; say: Say; reload: () => void }) => {
  const [sendBack, setSendBack] = useState<PadCard | null>(null); const [tech, setTech] = useState<PadCard | null>(null); const [detail, setDetail] = useState<PadCard | null>(null);
  const run = async (f: () => Promise<unknown>, m: string) => { try { await f(); say(m); } catch (x) { say(x instanceof Error ? x.message : 'Failed', 'err'); } };
  return <div data-testid="pad-jobs-tab" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {cards.map((c) => { const open = api.openClientRequests(c.job).length; return <article key={c.job.id} data-testid={`pad-card-${c.job.id}`} className={`flex flex-col gap-3 rounded-[28px] border bg-[#1f2630] p-5 ${hit === c.job.id ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/10'}`}>
      <button data-testid={`pad-open-${c.job.id}`} onClick={() => setDetail(c)} className="flex items-start justify-between gap-2 text-left active:opacity-70"><div><div className="font-mono text-2xl font-bold text-white">{c.job.number}</div><div className="text-lg text-slate-200">{c.job.watch.brand} {c.job.watch.model}</div><div className="font-mono text-sm text-slate-500">{c.job.watch.reference} · cal. {api.caliberOf(c.job.watch.reference) ?? '—'} · {c.job.kind.replace('_', ' ')}{api.activeHold(c.job) && <span className="ml-2 text-rose-300">· on hold</span>}</div></div><ChevronRight size={22} className="mt-1 shrink-0 text-slate-500" /></button>
      <div className="flex flex-wrap items-center gap-2"><Chip testId={`pad-stage-${c.job.id}`}>{c.stageLabel}</Chip><Chip tone="neutral" testId={`pad-tech-chip-${c.job.id}`} onClick={() => setTech(c)}><UserRound size={16} /> {c.job.assignees[0] ?? 'Assign tech'}{c.job.assignees.length > 1 && <span className="text-slate-400">+{c.job.assignees.length - 1}</span>}</Chip><ClientRequestBadge n={open} testId={`pad-cr-badge-${c.job.id}`} />{c.pendingParts > 0 && <Chip tone="violet">{c.pendingParts} parts pending</Chip>}</div>
      <Stepper stage={c.stage} />
      <div className="flex items-center gap-2">{c.parts.map((p) => <PartDot key={p.key} k={p.key} size={16} hollow={p.partStatus === 'not_started' || p.partStatus === 'in_progress'} title={`${p.label} · ${api.RW_STATIONS.find((s) => s.key === p.station)?.label}`} />)}<span className="text-xs text-slate-500">{c.photos} photos</span></div>
      <PartLocations parts={c.parts} />
      {c.stage === 'testing' && (c.job.clientRequests?.length ?? 0) > 0 ? <div data-testid={`pad-qc-checklist-${c.job.id}`} className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-3"><div className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300">Final QC · client requests checklist</div><QcRequestChecklist job={c.job} run={async (f, m) => { await run(f, m); reload(); }} dark /></div> : <ClientRequestList job={c.job} testId={`pad-client-requests-${c.job.id}`} />}
      <div className="mt-auto grid grid-cols-[1fr_1fr_auto] gap-2"><Big testId={`pad-advance-${c.job.id}`} tone="primary" disabled={!c.canAdvance} onClick={() => run(() => api.padAdvance(c.job.id), `${c.job.number} advanced`)}>Advance <ArrowRight size={18} /></Big><Big testId={`pad-sendback-${c.job.id}`} disabled={!c.canSendBack} onClick={() => setSendBack(c)}><ArrowLeft size={18} /> Send back</Big><CameraCapture compact jobId={c.job.id} jobNumber={c.job.number} onDone={(m) => { say(m); reload(); }} /></div>
    </article>; })}
    {!cards.length && <p className="col-span-full py-16 text-center text-lg text-slate-500">No jobs in the room.</p>}
    {sendBack && <SendBackSheet card={sendBack} onClose={() => setSendBack(null)} onDone={say} />}
    {tech && <TechSheet card={tech} onClose={() => setTech(null)} onDone={say} />}
    {detail && <DetailSheet card={detail} onClose={() => { setDetail(null); reload(); }} say={say} />}
  </div>;
};
