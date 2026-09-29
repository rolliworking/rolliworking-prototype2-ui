import { ChevronDown, Mail, Plus, RotateCcw, Truck, Undo2, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoInput, SwoStage, SwoWithRefs, VendorInput } from '@/api/client';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtMoney } from '@/lib/format';
import { SwoDetail, SwoForm } from './SwoPage';

const TONE: Record<string, string> = { empty: 'text-ink-300', ok: 'text-ink', amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-300', red: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300' };
const HEALTH: Record<cz.SwoHealthView['tone'], string> = { ok: 'bg-moss-50 text-moss-800', amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-300', red: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300', dark: 'bg-rose-900 text-white', muted: 'bg-canvas text-ink-500' };
const SPLIT: SwoStage[] = ['sent', 'at_vendor', 'inbound'];
type Run = (fn: () => Promise<unknown>, m: string) => Promise<void>;

// CONCIERGE v2 — one board, one lane per vendor; counts "N · M late · R redo" → on-track / overdue rows → cards → job. Health, chips and escalation are derived (api/concierge.ts).
export default function ConciergePage() {
  const [lanes, setLanes] = useState<ConciergeLane[]>([]); const [sp, setSp] = useSearchParams(); const lane = sp.get('lane'); const stage = sp.get('stage') as SwoStage | null;
  const [detail, setDetail] = useState<string | null>(sp.get('swo')); const [form, setForm] = useState<Partial<SwoInput> | null>(null); const [vendorForm, setVendorForm] = useState(false); const [outstanding, setOutstanding] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { cz.syncConciergeAlerts(); setLanes(await api.getConciergeBoard()); }, []);
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (fn, m) => { try { setError(null); await fn(); await load(); setMsg(m); setTimeout(() => setMsg(null), 3500); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const expand = (v: string, st: SwoStage) => { if (lane === v && stage === st) setSp({}); else setSp({ lane: v, stage: st }); };
  const sel = lanes.flatMap((l) => l.rows).find((r) => r.id === detail) ?? null;
  return <div data-testid="concierge-page" className="space-y-4">
    <Head title="Concierge" sub="One lane per vendor · counts at rest, tap a count for the cards · lane shape follows “do we ship to them?” · tap a vendor name for what is paid but not back" action={<><Button size="sm" data-testid="concierge-add-vendor" onClick={() => setVendorForm(true)}><Plus size={12} /> Vendor</Button><Button size="sm" variant="primary" data-testid="concierge-send" onClick={() => setForm({})}><Truck size={12} /> Send to vendor</Button></>} />
    <Flash msg={msg} error={error} />
    <div data-testid="concierge-board" className="space-y-2">
      {lanes.map((l) => { const open = lane === l.vendor.id; const rows = open && stage ? l.rows.filter((r) => api.baseStage(r.stage) === stage) : []; const noShip = l.vendor.ships === false; const prepay = l.vendor.paymentTerms === 'prepay';
        return <section key={l.vendor.id} data-testid={`lane-${l.vendor.id}`} data-ships={!noShip} className="rounded-md border border-line bg-surface">
          <div className="grid items-stretch" style={{ gridTemplateColumns: `240px repeat(${l.stages.length}, minmax(0, 1fr))` }}>
            <div className="flex flex-col justify-center border-r border-line px-3 py-2">
              <button type="button" data-testid={`lane-name-${l.vendor.id}`} onClick={() => setOutstanding(l.vendor.id)} title="Outstanding: paid but not back" className="flex items-center gap-2 text-left text-[13px] font-semibold text-ink hover:underline">{l.vendor.name}<span data-testid={`lane-total-${l.vendor.id}`} className="rounded-full bg-canvas px-1.5 font-mono text-[10px] text-ink-600">{l.total}</span>{prepay && <span className="rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">prepay</span>}</button>
              <div className="truncate text-[10px] text-ink-400">{l.vendor.work} · {l.vendor.location}{noShip ? ' · in-house, no shipping' : api.isInternationalVendor(l.vendor) ? ' · international' : ' · domestic'}</div>
              {!noShip && <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">{l.unpaidCount > 0 && <span data-testid={`lane-unpaid-${l.vendor.id}`} className="text-ink-600">{l.unpaidCount} unpaid · {fmtMoney(l.unpaidTotal)}</span>}{prepay && <span data-testid={`lane-prepaid-${l.vendor.id}`} className="font-semibold text-amber-800">{fmtMoney(l.prepaidTotal)} paid · {l.prepaidNotBack} not back</span>}</div>}
            </div>
            {l.stages.map((c) => <button key={c.key} type="button" data-testid={`cell-${l.vendor.id}-${c.key}`} data-count={c.count} data-late={c.late} data-redo={c.redo} data-tone={c.tone} onClick={() => c.count && expand(l.vendor.id, c.key)} className={`flex flex-col items-center justify-center border-r border-line/60 px-1 py-2 last:border-r-0 ${open && stage === c.key ? 'bg-brand-50' : ''} ${c.count ? 'hover:bg-canvas' : 'cursor-default'}`}>
              <span className="text-[10px] uppercase tracking-wide text-ink-400">{c.label}</span>
              <span className={`mt-0.5 flex items-baseline gap-1 rounded-sm px-2 font-mono text-xl font-semibold leading-tight ${TONE[c.tone]}`}>{c.count}{c.late > 0 && <span className="text-xs text-rose-700">· {c.late} late</span>}{c.redo > 0 && <span className="text-xs text-amber-800">· {c.redo} redo</span>}</span>
              <span className="h-3 text-[10px] text-ink-400">{c.count && c.key !== 'fulfilled' ? `oldest: ${c.oldestDays}d` : ''}</span>
            </button>)}
          </div>
          {open && stage && <div data-testid={`lane-cards-${l.vendor.id}`} className="border-t border-line bg-canvas/50 p-2">
            {SPLIT.includes(stage) && !noShip ? <>
              <Group title="ON TRACK" testId="group-on-track" rows={rows.filter((w) => !api.swoIsLate(w))} from={`/concierge?lane=${l.vendor.id}&stage=${stage}`} run={run} onDetail={setDetail} />
              <Group title="OVERDUE" testId="group-overdue" tone="text-rose-700" rows={rows.filter(api.swoIsLate)} from={`/concierge?lane=${l.vendor.id}&stage=${stage}`} run={run} onDetail={setDetail} />
            </> : <Group title={api.swoStageLabel(stage)} testId="group-stage" rows={rows} from={`/concierge?lane=${l.vendor.id}&stage=${stage}`} run={run} onDetail={setDetail} />}
          </div>}
        </section>; })}
    </div>
    {sel && <SwoDetail w={sel} onClose={() => setDetail(null)} run={run} onEdit={() => setForm({ id: sel.id, vendorId: sel.vendorId, jobId: sel.jobId, components: sel.components, work: sel.work, vendorInvoiceTotal: sel.vendorInvoiceTotal, predictedCompletion: sel.predictedCompletion, pointPerson: sel.pointPerson, notes: sel.notes })} />}
    {form && <SwoForm init={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); void run(async () => undefined, m); }} />}
    {vendorForm && <VendorQuickForm onClose={() => setVendorForm(false)} onSaved={(m) => { setVendorForm(false); void run(async () => undefined, m); }} />}
    {outstanding && <OutstandingSheet vendorId={outstanding} lanes={lanes} onClose={() => setOutstanding(null)} onDetail={(id) => { setOutstanding(null); setDetail(id); }} />}
  </div>;
}

const Group = ({ title, testId, tone, rows, from, run, onDetail }: { title: string; testId: string; tone?: string; rows: SwoWithRefs[]; from: string; run: Run; onDetail: (id: string) => void }) => <div data-testid={testId} data-count={rows.length} className="mb-2 last:mb-0">
  <div className={`mb-1 flex items-center gap-2 text-[11px] font-semibold ${tone ?? 'text-ink-500'}`}><ChevronDown size={12} /> {title} · {rows.length}</div>
  {rows.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map((w) => <Card key={w.id} w={w} run={run} from={from} onDetail={() => onDetail(w.id)} />)}</div> : <div className="text-[11px] text-ink-300">none</div>}
</div>;

const Card = ({ w, run, from, onDetail }: { w: SwoWithRefs; run: Run; from: string; onDetail: () => void }) => {
  const v = w.vendor; const noShip = v.ships === false; const next = api.nextSwoStage(v, w.stage); const prev = api.prevSwoStage(v, w.stage); const days = api.swoDaysAtStage(w); const h = cz.swoHealth(w); const paid = cz.paidChip(w); const parts = cz.partsWait(w); const esc = cz.escalationLevel(w);
  const [modal, setModal] = useState<'back' | 'redo' | 'edit' | 'reply' | 'resched' | 'parts' | null>(null); const [t, setT] = useState(''); const [d, setD] = useState(''); const [pp, setPp] = useState(w.pointPerson ?? ''); const [qty, setQty] = useState(1); const [reason, setReason] = useState('');
  const advance = () => { if (next === 'sent' || next === 'redo_sent') return onDetail(); if ((next === 'inbound' || next === 'redo_inbound') && !w.returnLabel) return onDetail(); void run(() => api.advanceSwo(w.id, next!), `${w.number} → ${api.swoStageLabel(next!)}`); };
  const close = () => { setModal(null); setT(''); setD(''); setReason(''); };
  return <div data-testid={`concierge-card-${w.id}`} data-health={h.health} className="rounded-sm border border-line bg-surface p-2 text-xs">
    <div className="flex items-center justify-between"><Link to={`/jobs/${w.jobId}`} state={{ from }} data-testid={`concierge-card-job-${w.id}`} className="font-mono font-semibold text-brand hover:underline">{w.jobNumber.replace(/^E/, '')}</Link><span className={`font-mono text-[10px] ${days >= 7 ? 'text-rose-700' : days >= 3 ? 'text-amber-700' : 'text-ink-400'}`}>{days}d at stage</span></div>
    <div className="truncate text-ink">{w.clientName} · {w.watchLabel}</div>
    <div className="truncate text-[11px] text-ink-500">{w.work}</div>
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
      <span data-testid={`concierge-health-${w.id}`} className={`rounded-sm px-1 font-semibold ${HEALTH[h.tone]}`}>{h.label}</span>
      {w.redoCycles.length > 0 && <span data-testid={`concierge-redo-${w.id}`} title={w.redoCycles.map((r) => `#${r.n} ${r.reason}`).join('\n')} className="rounded-sm bg-amber-50 px-1 font-semibold uppercase text-amber-800">Redo ×{w.redoCycles.length}</span>}
      {!noShip && paid.kind !== 'none' && <span data-testid={`concierge-paid-${w.id}`} data-kind={paid.kind} className={`rounded-sm px-1 font-semibold ${paid.kind === 'paid' ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-500'}`}>{paid.text}</span>}
      {parts && <span data-testid={`concierge-parts-${w.id}`} className="rounded-sm bg-sky-50 px-1 font-semibold text-sky-800">PARTS · {parts.label}</span>}
      {w.international && <span className="rounded-sm bg-sky-50 px-1 text-sky-800">intl</span>}
      {esc.level > 0 && <span data-testid={`concierge-esc-${w.id}`} className="rounded-sm bg-rose-100 px-1 font-semibold text-rose-800">L{esc.level} → {esc.to}</span>}
    </div>
    <button type="button" data-testid={`concierge-edit-${w.id}`} onClick={() => setModal('edit')} className="mt-1 block text-left text-[10px] text-ink-400 hover:text-ink">{!noShip || w.predictedCompletion ? <>expected <b>{w.predictedCompletion ? fmtDate(w.predictedCompletion) : '—'}</b> · </> : null}point person <b>{w.pointPerson ?? '—'}</b> ✎</button>
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {next && <Button size="sm" variant="primary" data-testid={`concierge-advance-${w.id}`} onClick={advance}>→ {api.swoStageLabel(next)}</Button>}
      {w.stage === 'inspection' && <Button size="sm" data-testid={`concierge-redo-start-${w.id}`} onClick={() => setModal('redo')} title="Failed check → return to vendor for redo"><RotateCcw size={11} /> Redo +</Button>}
      {prev && <Button size="sm" variant="ghost" data-testid={`concierge-sendback-${w.id}`} onClick={() => setModal('back')} title="Back one stage (reason required)"><Undo2 size={11} /></Button>}
      {(h.health === 'delayed' || h.health === 'breach') && <>{cz.statusRequestDue(w) && <Button size="sm" data-testid={`concierge-status-${w.id}`} onClick={() => void run(() => cz.sendVendorStatusRequest(w.id), `Status request emailed to ${v.name}`)}><Mail size={11} /> Status request</Button>}<Button size="sm" data-testid={`concierge-reply-${w.id}`} onClick={() => setModal('reply')}>Vendor reply</Button>{h.health === 'breach' && <Button size="sm" data-testid={`concierge-resched-${w.id}`} onClick={() => setModal('resched')}>Reschedule client</Button>}</>}
      <Button size="sm" variant="ghost" data-testid={`concierge-parts-req-${w.id}`} onClick={() => setModal('parts')} title="Vendor parts request (same chain as the bench)"><Wrench size={11} /></Button>
      <button type="button" data-testid={`concierge-open-${w.id}`} onClick={onDetail} className="ml-auto text-[11px] text-brand hover:underline">detail</button>
    </div>
    {modal === 'back' && <Mini testId="concierge-back" title={`Move ${w.number} back one stage`} ok="Move back" disabled={!t.trim()} onClose={close} onOk={() => { close(); void run(() => api.sendBackSwo(w.id, t), `${w.number} moved back — ${t}`); }}><label className="block text-xs text-ink-500">Reason (required)<input autoFocus data-testid="concierge-back-reason" value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label></Mini>}
    {modal === 'redo' && <Mini testId="concierge-redo-modal" title={`Return ${w.number} to ${v.name} for redo`} ok={`Start redo ×${w.redoCycles.length + 1}`} disabled={!t.trim()} onClose={close} onOk={() => { close(); void run(() => cz.startRedo(w.id, t), `${w.number} → redo ×${w.redoCycles.length + 1} at ${v.name}`); }}><label className="block text-xs text-ink-500">What failed (goes to the vendor in the outbound email) *<textarea autoFocus data-testid="concierge-redo-reason" rows={2} value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label><p className="mt-1 text-[11px] text-ink-400">Redo legs reuse the label / customs / return-label flow. Expected at no charge{w.paid ? ' — this SWO is already PAID; Mark paid stays blocked on the redo' : ''}.</p></Mini>}
    {modal === 'edit' && <Mini testId="concierge-edit-modal" title={`${w.number} · expected date & point person`} ok="Save" onClose={close} onOk={() => { close(); void run(async () => { if (d && d !== w.predictedCompletion) await cz.setExpectedAt(w.id, d, t || undefined); if (pp && pp !== w.pointPerson) await cz.setPointPerson(w.id, pp); }, `${w.number} updated`); }}><div className="grid grid-cols-2 gap-2 text-xs text-ink-500"><label>Expected completion<input type="date" data-testid="concierge-edit-date" defaultValue={w.predictedCompletion ?? ''} onChange={(e) => setD(e.target.value)} className={`${field} mt-1 w-full`} /></label><label>Point person<select data-testid="concierge-edit-point" value={pp} onChange={(e) => setPp(e.target.value)} className={`${field} mt-1 w-full`}>{cz.conciergeStaff().map((u) => <option key={u.id} value={u.shortName}>{u.shortName} · {u.dutyLabel}</option>)}</select></label><label className="col-span-2">Reason for the change (logged)<input data-testid="concierge-edit-reason" value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label></div></Mini>}
    {modal === 'reply' && <Mini testId="concierge-reply-modal" title={`Vendor reply · ${v.name}`} ok="Log reply" disabled={!t.trim()} onClose={close} onOk={() => { close(); void run(() => cz.logVendorReply(w.id, t, d || undefined), `Vendor reply logged${d ? ` · new date ${d}` : ''}`); }}><label className="block text-xs text-ink-500">What they said *<textarea autoFocus data-testid="concierge-reply-text" rows={2} value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label><label className="mt-2 block text-xs text-ink-500">Vendor's new promised date (resets at-risk / delayed)<input type="date" data-testid="concierge-reply-date" value={d} onChange={(e) => setD(e.target.value)} className={`${field} mt-1 w-full`} /></label></Mini>}
    {modal === 'resched' && <Mini testId="concierge-resched-modal" title="Reschedule client" ok="Log new client date" disabled={!d} onClose={close} onOk={() => { close(); void run(() => cz.rescheduleParentClient(w.id, d, reason === 'email' ? 'email' : 'call'), `Client rescheduled to ${d} · reason vendor delay – ${v.name}`); }}><label className="block text-xs text-ink-500">New date promised to the client *<input type="date" data-testid="concierge-resched-date" value={d} onChange={(e) => setD(e.target.value)} className={`${field} mt-1 w-full`} /></label><div className="mt-2 flex gap-3 text-xs">{['call', 'email'].map((k) => <label key={k} className="inline-flex items-center gap-1"><input type="radio" data-testid={`concierge-resched-${k}`} checked={(reason || 'call') === k} onChange={() => setReason(k)} /> told by {k}</label>)}</div><p className="mt-1 text-[11px] text-ink-400">Logged on the parent job as a promise-date change · reason “vendor delay – {v.name}”.</p></Mini>}
    {modal === 'parts' && <Mini testId="concierge-parts-modal" title={`Parts request for ${v.name} · ${w.number}`} ok="Request parts" disabled={!t.trim()} onClose={close} onOk={() => { close(); void run(() => cz.requestVendorParts(w.id, t, qty, reason), `Parts request for ${v.name} → estimate addendum → client approval`); }}><div className="grid grid-cols-[1fr_70px] gap-2 text-xs text-ink-500"><label>Part *<input autoFocus data-testid="concierge-parts-desc" value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label><label>Qty<input type="number" min={1} inputMode="numeric" data-testid="concierge-parts-qty" value={qty} onChange={(e) => setQty(Number(e.target.value))} className={`${field} mt-1 w-full`} /></label><label className="col-span-2">Reason<input data-testid="concierge-parts-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1 w-full`} /></label></div><p className="mt-1 text-[11px] text-ink-400">Same chain as the bench: request → estimate addendum → client approval → pick / order → pick ticket “for: {v.name} · {w.number}” → {noShip ? 'hand-off (custody scan)' : 'next outbound label'}.</p></Mini>}
  </div>;
};

const Mini = ({ testId, title, ok, disabled, onClose, onOk, children }: { testId: string; title: string; ok: string; disabled?: boolean; onClose: () => void; onOk: () => void; children: React.ReactNode }) => <Modal testId={testId} title={title} width="w-[460px]" onClose={onClose}>{children}<div className="mt-3 flex justify-end gap-2"><Button size="sm" onClick={onClose}>Cancel</Button><Button size="sm" variant="primary" data-testid={`${testId}-go`} disabled={disabled} onClick={onOk}>{ok}</Button></div></Modal>;

// Vendor-level OUTSTANDING: paid but not Received, by days since payment, with the parent's client date + variance — the list you chase
const OutstandingSheet = ({ vendorId, lanes, onClose, onDetail }: { vendorId: string; lanes: ConciergeLane[]; onClose: () => void; onDetail: (id: string) => void }) => {
  const [rows, setRows] = useState<cz.OutstandingRow[]>([]); const v = lanes.find((l) => l.vendor.id === vendorId)?.vendor;
  useEffect(() => { void cz.getVendorOutstanding(vendorId).then(setRows); }, [vendorId]);
  return <Modal testId="concierge-outstanding" title={`${v?.name ?? ''} · Outstanding — paid but not back`} width="w-[720px]" onClose={onClose}>
    <p className="text-[11px] text-ink-500">{v?.paymentTerms === 'prepay' ? 'PREPAY vendor — every paid job that has not come back is exposure.' : 'Pay-on-receipt vendor — a paid-not-back job here is unusual.'} Total {fmtMoney(rows.reduce((t, r) => t + r.amount, 0))} · {rows.length} job{rows.length === 1 ? '' : 's'}.</p>
    <table className="mt-2 w-full text-xs"><thead><tr className="border-b border-line text-left text-[10px] uppercase text-ink-400"><th className="py-1">SWO · job</th><th>paid</th><th>days since paid</th><th>stage</th><th>client date · variance</th><th></th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.swo.id} data-testid={`outstanding-${r.swo.id}`} className="border-b border-line/60"><td className="py-1"><span className="font-mono font-semibold">{r.swo.number}</span> · {r.swo.jobNumber.replace(/^E/, '')} <span className="text-ink-400">{r.swo.clientName}</span></td><td>{fmtMoney(r.amount)} · {fmtDate(r.paidAt)}</td><td className={`font-mono ${r.daysSincePaid >= 60 ? 'text-rose-700' : ''}`}>{r.daysSincePaid}d</td><td>{api.swoStageLabel(r.swo.stage)}{r.swo.redoCycles.length ? ` · redo ×${r.swo.redoCycles.length}` : ''}</td><td>{r.parentTarget ? <>promised {fmtDate(r.parentTarget)} · <span className={r.variance! > 0 ? 'font-semibold text-rose-700' : 'text-moss-700'}>{r.variance! > 0 ? `${r.variance} days late` : `${-r.variance!} days ahead`}</span></> : '—'}</td><td><button type="button" data-testid={`outstanding-open-${r.swo.id}`} onClick={() => onDetail(r.swo.id)} className="text-brand hover:underline">open</button></td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="py-3 text-ink-400">Nothing paid and outstanding.</td></tr>}</tbody></table>
  </Modal>;
};

// Vendor add — reuses the Purchasing vendor module (kind outsource). ONE lane-shaping question + payment terms.
const VendorQuickForm = ({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) => {
  const [f, setF] = useState<VendorInput>({ name: '', contact: '', email: '', phone: '', terms: 'Net 15', division: 'rolliworks', kind: 'outsource', ships: true, paymentTerms: 'on_receipt', country: 'US', location: '', work: '', leadTimeDays: 10, active: true }); const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof VendorInput, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return <Modal testId="concierge-vendor-form" title="New concierge / outsource vendor" width="w-[560px]" onClose={onClose}>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label className="col-span-2">Name<input data-testid="cv-name" value={f.name} onChange={(e) => set('name', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <label>Location<input data-testid="cv-location" value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <label>Contact email<input data-testid="cv-email" value={f.email} onChange={(e) => set('email', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <label className="col-span-2">What they do<input data-testid="cv-work" value={f.work ?? ''} onChange={(e) => set('work', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <fieldset data-testid="cv-ships" className="col-span-2 rounded-sm border border-brand-100 bg-brand-50/50 p-2"><legend className="px-1 font-semibold text-brand">Do we ship items to this vendor?</legend><div className="flex flex-col gap-1">{[true, false].map((v) => <label key={String(v)} className="inline-flex items-center gap-1"><input type="radio" data-testid={`cv-ships-${v ? 'yes' : 'no'}`} checked={f.ships === v} onChange={() => set('ships', v)} /> {v ? 'Yes — full shipping lane (In route · Returning · Received)' : 'No — hand-off lane (In queue · In progress · Inspection · Fulfilled)'}</label>)}</div></fieldset>
      <label>Payment terms<select data-testid="cv-terms" value={f.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} className={`${field} mt-1 w-full`}><option value="on_receipt">Pay on receipt (default)</option><option value="prepay">Prepay — exposure tracked</option></select></label>
      <label>Predicted turnaround (days)<input type="number" inputMode="numeric" data-testid="cv-lead" value={f.leadTimeDays ?? 0} onChange={(e) => set('leadTimeDays', Number(e.target.value))} className={`${field} mt-1 w-full`} /></label>
      <label className="inline-flex items-center gap-1"><input type="checkbox" data-testid="cv-intl" checked={f.country !== 'US'} onChange={(e) => set('country', e.target.checked ? 'INTL' : 'US')} disabled={f.ships === false} /> International (customs on labels)</label>
    </div>
    {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}
    <div className="mt-3 flex justify-end gap-2"><Button size="sm" onClick={onClose}>Cancel</Button><Button size="sm" variant="primary" data-testid="cv-save" onClick={() => api.saveVendor({ ...f, contact: f.contact || f.name }).then((v) => onSaved(`Vendor ${v.name} added — ${f.ships === false ? 'hand-off lane' : 'shipping lane'}${f.paymentTerms === 'prepay' ? ' · prepay' : ''}`)).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'))}>Create vendor</Button></div>
  </Modal>;
};
