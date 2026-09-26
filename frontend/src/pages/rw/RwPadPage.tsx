import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ClipboardList, MessageSquareWarning, Minus, Package, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClientRequestAlert, PadCard, PartSuggestion, PartsRequestWithRefs, RoomSummary, SendBackReason } from '@/api/client';
import { ClientRequestList, ClientRequestModal, QcRequestChecklist } from '@/components/jobs/ClientRequests';
import { Clock, PartDot, PartLocations, PhotoGrid, PinSwitch, ScanInput } from '@/components/rw/RwBits';

const Big = ({ children, onClick, tone = 'ghost', testId, disabled, title }: { children: React.ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger' | 'warn'; testId: string; disabled?: boolean; title?: string }) => (
  <button data-testid={testId} onClick={onClick} disabled={disabled} title={title} className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold active:scale-[0.98] disabled:opacity-40 ${tone === 'primary' ? 'bg-amber-400 text-[#161b22]' : tone === 'danger' ? 'bg-rose-600 text-white' : tone === 'warn' ? 'bg-orange-500 text-white' : 'border border-white/20 text-slate-100'}`}>{children}</button>
);

const SendBack = ({ card, onClose, onDone }: { card: PadCard; onClose: () => void; onDone: (m: string) => void }) => {
  const [reason, setReason] = useState<SendBackReason | null>(null); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}><div data-testid="pad-sendback-modal" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-[#1f2630] p-6 text-slate-100">
    <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Send {card.job.number} back</h2><button onClick={onClose} className="min-h-[44px] min-w-[44px] p-2"><X size={22} /></button></div>
    <p className="text-sm text-slate-400">From <span className="text-white">{card.stageLabel}</span> to the previous stage. Pick a reason — it is logged with who and when.</p>
    <div className="grid grid-cols-2 gap-2">{(Object.entries(api.SEND_BACK_REASONS) as [SendBackReason, string][]).map(([k, l]) => <button key={k} data-testid={`pad-reason-${k}`} onClick={() => setReason(k)} className={`min-h-[56px] rounded-2xl border text-base font-medium ${reason === k ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-white/15 text-slate-200'}`}>{l}</button>)}</div>
    <textarea data-testid="pad-reason-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={reason === 'other' ? 'Note (required for Other)' : 'Note (optional)'} className="w-full rounded-2xl border border-white/15 bg-[#0f131a] px-4 py-3 text-base" />
    {err && <p data-testid="pad-sendback-error" className="text-sm text-rose-400">{err}</p>}
    <Big testId="pad-sendback-confirm" tone="danger" disabled={!reason} onClick={async () => { try { await api.padSendBack(card.job.id, reason!, note); onDone(`${card.job.number} sent back · ${api.SEND_BACK_REASONS[reason!]}`); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }}><ArrowLeft size={18} /> Send back</Big>
  </div></div>;
};

// Parts composer with live suggestions (names + aliases, scoped to the watch reference, last-chosen floats to top)
const Composer = ({ card, onDone }: { card: PadCard; onDone: (m: string) => void }) => {
  const [q, setQ] = useState(''); const [items, setItems] = useState<{ partId?: string; description: string; qty: number }[]>([]); const [err, setErr] = useState<string | null>(null);
  const sugg: PartSuggestion[] = q.trim() ? api.partSuggestions(card.job.id, q) : [];
  const add = (s?: PartSuggestion) => { const d = s ? s.part.name : q.trim(); if (!d) return; if (s) api.recordPartPick(card.job.id, s.part.id); setItems((l) => { const i = l.findIndex((x) => x.description === d); return i >= 0 ? l.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)) : [...l, { partId: s?.part.id, description: d, qty: 1 }]; }); setQ(''); };
  return <div data-testid={`pad-composer-${card.job.id}`} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="flex items-center gap-2 text-base font-semibold text-white"><Package size={18} /> Parts request · {card.job.watch.reference}</div>
    <div className="relative"><input data-testid="pad-part-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(sugg[0]); } }} placeholder="Type a part name or nickname… e.g. black/blue GMT insert" className="min-h-[52px] w-full rounded-2xl border border-white/15 bg-[#0f131a] px-4 text-lg text-slate-100 outline-none focus:border-amber-400" />
      {sugg.length > 0 && <ul data-testid="pad-suggestions" className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-white/15 bg-[#1f2630] shadow-2xl">{sugg.map((s) => <li key={s.part.id}><button data-testid={`pad-suggest-${s.part.id}`} onClick={() => add(s)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-white/10"><span className="flex-1"><span className="text-base text-white">{s.part.name}</span><span className="ml-2 font-mono text-xs text-slate-500">{s.part.partNumber}</span></span><span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${s.reason === 'recent' ? 'bg-amber-400 text-[#161b22]' : s.reason === 'ref' ? 'bg-emerald-800 text-emerald-100' : 'bg-white/10 text-slate-300'}`}>{s.reason === 'recent' ? 'last chosen' : s.reason === 'ref' ? 'fits ref' : s.reason}</span><span className="font-mono text-xs text-slate-400">{s.part.stock} on hand</span></button></li>)}</ul>}
      {q.trim() && !sugg.length && <button data-testid="pad-freetype-add" onClick={() => add()} className="mt-1 text-sm text-amber-300 underline">No catalog match — add “{q.trim()}” as free text</button>}</div>
    {items.length > 0 && <ul className="space-y-2">{items.map((it, i) => <li key={i} data-testid={`pad-item-${i}`} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-2"><span className="flex-1 text-base text-white">{it.description}{!it.partId && <span className="ml-2 text-xs text-slate-500">free text</span>}</span><button data-testid={`pad-item-minus-${i}`} onClick={() => setItems((l) => l.map((x, k) => (k === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="min-h-[44px] min-w-[44px] rounded-full border border-white/15"><Minus size={16} className="mx-auto" /></button><span data-testid={`pad-item-qty-${i}`} className="w-8 text-center font-mono text-lg">{it.qty}</span><button data-testid={`pad-item-plus-${i}`} onClick={() => setItems((l) => l.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)))} className="min-h-[44px] min-w-[44px] rounded-full border border-white/15"><Plus size={16} className="mx-auto" /></button><button onClick={() => setItems((l) => l.filter((_, k) => k !== i))} className="min-h-[44px] min-w-[44px] text-slate-400"><X size={18} className="mx-auto" /></button></li>)}</ul>}
    {err && <p className="text-sm text-rose-400">{err}</p>}
    <Big testId="pad-composer-submit" tone="primary" disabled={!items.length} onClick={async () => { try { const r = await api.submitPadPartsRequest(card.job.id, items); onDone(`${r.number} pending · ${items.length} item(s)`); setItems([]); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }}>Submit request</Big>
  </div>;
};

// Supervisor records what the client asked for — lands on the card, the scan pop-up and the QC checklist
const RequestNote = ({ card, onDone }: { card: PadCard; onDone: (m: string) => void }) => {
  const [text, setText] = useState(''); const [err, setErr] = useState<string | null>(null);
  return <form data-testid={`pad-crequest-form-${card.job.id}`} onSubmit={async (e) => { e.preventDefault(); try { await api.addClientRequest(card.job.id, text); onDone(`${card.job.number} · client request added`); setText(''); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }} className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3">
    <input data-testid={`pad-crequest-input-${card.job.id}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What did the client ask for?" className="min-h-[52px] w-full rounded-2xl border border-amber-400/40 bg-[#0f131a] px-4 text-lg text-slate-100 outline-none focus:border-amber-400" />
    {err && <p className="text-sm text-rose-400">{err}</p>}
    <Big testId={`pad-crequest-submit-${card.job.id}`} tone="primary" disabled={!text.trim()}><MessageSquareWarning size={18} /> Add client request</Big>
  </form>;
};

const ApprovalCard = ({ r, onDone }: { r: PartsRequestWithRefs & { onHand: number }; onDone: (m: string) => void }) => {
  const out = !!r.partId && r.onHand <= 0; const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);
  const act = async (a: 'approve' | 'decline' | 'on_order' | 'received') => { try { await api.approvalAction(r.id, a); if (a === 'approve') { setOk('Allocated → picking queue'); window.setTimeout(() => onDone(`${r.number} approved · allocated`), 900); } else onDone(`${r.number} ${a.replace('_', ' ')}`); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } };
  return <article data-testid={`pad-approval-${r.id}`} className={`space-y-3 rounded-3xl border p-5 ${out ? 'border-rose-500/60 bg-rose-950/30' : 'border-white/10 bg-[#1f2630]'}`}>
    <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-lg font-semibold text-white">{r.number}</span><span className="text-sm text-slate-400">{r.requestedBy} · {r.job.number} · {r.watch.brand} {r.watch.model}</span>{r.status === 'on_order' && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">ON ORDER</span>}</div>
    <div className="text-xl text-white">{r.part?.name ?? r.items?.map((i) => i.description).join(', ') ?? 'Free-typed part'} <span className="font-mono text-base text-slate-400">×{r.qty}</span></div>
    <div className="flex items-center gap-3 text-base"><span data-testid={`pad-onhand-${r.id}`} className={`rounded-full px-3 py-1 font-mono ${out ? 'bg-rose-600 text-white' : 'bg-white/10 text-slate-100'}`}>{r.partId ? `${r.onHand} on hand` : 'not in catalog'}</span>{r.part?.location && <span className="text-sm text-slate-400">{r.part.location}</span>}{out && <span data-testid={`pad-out-of-stock-${r.id}`} className="inline-flex items-center gap-1 text-base font-bold text-rose-300"><AlertTriangle size={18} /> OUT OF STOCK</span>}</div>
    {r.note && <p className="text-sm text-slate-300">“{r.note}”</p>}
    {ok ? <p data-testid={`pad-allocated-${r.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-900/60 px-4 py-3 text-base text-emerald-200"><Check size={18} /> {ok}</p> : <div className="flex flex-wrap gap-2">
      {r.status === 'pending' && (out || !r.partId ? <Big testId={`pad-order-${r.id}`} tone="warn" onClick={() => act('on_order')}>Order part</Big> : <Big testId={`pad-approve-${r.id}`} tone="primary" onClick={() => act('approve')}><Check size={18} /> Approve</Big>)}
      {r.status === 'pending' && <Big testId={`pad-decline-${r.id}`} onClick={() => act('decline')}>Decline</Big>}
      {r.status === 'pending' && r.partId && !out && <Big testId={`pad-onorder-${r.id}`} onClick={() => act('on_order')}>On order</Big>}
      {r.status === 'on_order' && <Big testId={`pad-received-${r.id}`} tone="primary" onClick={() => act('received')}>Received</Big>}
    </div>}
    {err && <p className="text-sm text-rose-300">{err}</p>}
  </article>;
};

export default function RwPadPage() {
  const [cards, setCards] = useState<PadCard[]>([]); const [appr, setAppr] = useState<(PartsRequestWithRefs & { onHand: number })[]>([]); const [sum, setSum] = useState<RoomSummary | null>(null); const [tab, setTab] = useState<'board' | 'approvals'>('board'); const [flash, setFlash] = useState<string | null>(null); const [sendBack, setSendBack] = useState<PadCard | null>(null); const [photos, setPhotos] = useState<PadCard | null>(null); const [composer, setComposer] = useState<string | null>(null); const [crFor, setCrFor] = useState<string | null>(null); const [alert, setAlert] = useState<ClientRequestAlert | null>(null); const [hit, setHit] = useState<string | null>(null);
  const load = useCallback(() => Promise.all([api.getPadBoard().then(setCards), api.getApprovalsQueue().then(setAppr), api.getRoomSummary().then(setSum)]), []);
  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3500); void load(); };
  return <div data-testid="rw-pad-page" className="flex h-full flex-col text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f131a] px-5 py-3">
      <div className="flex flex-wrap items-center gap-4"><div className="text-2xl font-semibold text-white">Supervisor Pad</div>
        {sum && <div data-testid="pad-summary" className="flex flex-wrap gap-2 text-base">{[['Jobs in room', sum.jobsInRoom, 'pad-sum-jobs'], ['Waiting on parts', sum.waitingOnParts, 'pad-sum-parts'], ['Waiting on approval', sum.waitingOnApproval, 'pad-sum-approval']].map(([l, v, t]) => <span key={String(t)} data-testid={String(t)} className="rounded-2xl bg-white/5 px-4 py-2"><span className="font-mono text-xl font-semibold text-white">{v}</span> <span className="text-slate-400">{l}</span></span>)}</div>}
        <div className="ml-auto flex items-center gap-4"><Clock /><PinSwitch big /></div></div>
      <div className="mt-3 max-w-xl"><ScanInput big testId="pad-scan" placeholder="Scan a watch label — jumps to its card and pops any client requests" onScan={async (code) => { const j = await api.findJobByLabel(code); if (!j) throw new Error(`No job matches label ${code}`); setHit(j.id); setTab('board'); setAlert(api.clientRequestAlert(j.id)); window.setTimeout(() => document.querySelector(`[data-testid="pad-card-${j.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} /></div>
      <nav className="mt-3 flex gap-2">{([['board', 'Job board', cards.length], ['approvals', 'Approvals', appr.length]] as const).map(([k, l, n]) => <button key={k} data-testid={`pad-tab-${k}`} onClick={() => setTab(k)} className={`min-h-[48px] rounded-2xl px-5 text-base font-semibold ${tab === k ? 'bg-amber-400 text-[#161b22]' : 'bg-white/5 text-slate-200'}`}>{l} <span className="font-mono">{n}</span></button>)}<Link to="/rw/picking" data-testid="pad-tab-picking" className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-white/5 px-5 text-base font-semibold text-slate-200"><ClipboardList size={18} /> Picking <span className="font-mono">{sum?.picksRemaining ?? 0}</span></Link><Link to="/rw" className="ml-auto self-center text-sm text-slate-400">exit pad</Link></nav>
    </header>
    {flash && <p data-testid="pad-flash" className="mx-5 mt-3 rounded-2xl bg-emerald-950/60 px-4 py-3 text-base text-emerald-300">{flash}</p>}
    <main className="flex-1 overflow-y-auto p-5">
      {tab === 'board' && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map((c) => <article key={c.job.id} data-testid={`pad-card-${c.job.id}`} className={`space-y-3 rounded-3xl border bg-[#1f2630] p-5 ${hit === c.job.id ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/10'}`}>
        <div className="flex items-start justify-between gap-2"><div><div className="font-mono text-2xl font-semibold text-white">{c.job.number}</div><div className="text-lg text-slate-200">{c.job.watch.brand} {c.job.watch.model}</div><div className="text-sm text-slate-500">{c.job.kind.replace('_', ' ')} · {c.job.assignees.join(', ') || 'unassigned'}{api.activeHold(c.job) && <span className="ml-2 text-rose-300">· on hold</span>}</div></div><span data-testid={`pad-stage-${c.job.id}`} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">{c.stageLabel}</span></div>
        <div className="flex items-center gap-2">{c.parts.map((p) => <PartDot key={p.key} k={p.key} size={16} hollow={p.partStatus === 'not_started' || p.partStatus === 'in_progress'} title={`${p.label} · ${api.RW_STATIONS.find((s) => s.key === p.station)?.label}`} />)}<span className="text-xs text-slate-500">{c.pendingParts ? `${c.pendingParts} parts pending` : ''}</span></div>
        <PartLocations parts={c.parts} />
        {c.stage === 'testing' && (c.job.clientRequests?.length ?? 0) > 0 ? <div data-testid={`pad-qc-checklist-${c.job.id}`} className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-3"><div className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300">Final QC · client requests checklist</div><QcRequestChecklist job={c.job} run={async (f, m) => { try { await f(); say(m); } catch (x) { setFlash(x instanceof Error ? x.message : 'Failed'); } }} dark /></div> : <ClientRequestList job={c.job} testId={`pad-client-requests-${c.job.id}`} />}
        <div className="grid grid-cols-2 gap-2"><Big testId={`pad-advance-${c.job.id}`} tone="primary" disabled={!c.canAdvance} onClick={async () => { try { await api.padAdvance(c.job.id); say(`${c.job.number} advanced`); } catch (x) { setFlash(x instanceof Error ? x.message : 'Blocked'); } }}>Advance <ArrowRight size={18} /></Big><Big testId={`pad-sendback-${c.job.id}`} disabled={!c.canSendBack} onClick={() => setSendBack(c)}><ArrowLeft size={18} /> Send back</Big>
          <Big testId={`pad-photos-${c.job.id}`} onClick={() => setPhotos(c)}><Camera size={18} /> Photos <span className="font-mono text-sm text-slate-400">{c.photos}</span></Big><Big testId={`pad-request-${c.job.id}`} onClick={() => setComposer(composer === c.job.id ? null : c.job.id)}><Package size={18} /> Request part <ChevronDown size={16} /></Big>
          <Big testId={`pad-crequest-${c.job.id}`} onClick={() => setCrFor(crFor === c.job.id ? null : c.job.id)}><MessageSquareWarning size={18} /> Client request <ChevronDown size={16} /></Big></div>
        {composer === c.job.id && <Composer card={c} onDone={say} />}
        {crFor === c.job.id && <RequestNote card={c} onDone={(m) => { say(m); setCrFor(null); }} />}
      </article>)}</div>}
      {tab === 'approvals' && <div className="grid gap-4 md:grid-cols-2">{appr.map((r) => <ApprovalCard key={r.id} r={r} onDone={say} />)}{!appr.length && <p className="py-10 text-center text-lg text-slate-500">Approvals queue is empty.</p>}</div>}
    </main>
    {sendBack && <SendBack card={sendBack} onClose={() => setSendBack(null)} onDone={say} />}
    {alert && <ClientRequestModal alert={alert} via="pad_scan" onClose={() => setAlert(null)} />}
    {photos && <PhotoGrid jobId={photos.job.id} title={`${photos.job.number} · ${photos.job.watch.brand} ${photos.job.watch.model}`} onClose={() => setPhotos(null)} />}
  </div>;
}
