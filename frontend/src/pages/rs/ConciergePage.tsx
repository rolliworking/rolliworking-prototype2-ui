import { ChevronDown, Plus, Truck, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { ConciergeLane, SwoInput, SwoStage, SwoWithRefs, VendorInput } from '@/api/client';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate } from '@/lib/format';
import { SwoDetail, SwoForm } from './SwoPage';

const TONE: Record<string, string> = { empty: 'text-ink-300', ok: 'text-ink', amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-300', red: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300' };

// CONCIERGE — one board, one horizontal lane per vendor; lane shape = "do we ship to them?"; counts at rest → tap a count → cards → job screen. Front on the SWO model (custody, Paid, labels, QBO unchanged).
export default function ConciergePage() {
  const [lanes, setLanes] = useState<ConciergeLane[]>([]); const [sp, setSp] = useSearchParams(); const lane = sp.get('lane'); const stage = sp.get('stage') as SwoStage | null;
  const [detail, setDetail] = useState<string | null>(null); const [form, setForm] = useState<Partial<SwoInput> | null>(null); const [vendorForm, setVendorForm] = useState(false); const [back, setBack] = useState<SwoWithRefs | null>(null); const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.getConciergeBoard().then(setLanes), []);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, m: string) => { try { setError(null); await fn(); await load(); setMsg(m); setTimeout(() => setMsg(null), 3000); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const expand = (v: string, st: SwoStage) => { if (lane === v && stage === st) setSp({}); else setSp({ lane: v, stage: st }); };
  const sel = lanes.flatMap((l) => l.rows).find((r) => r.id === detail) ?? null;
  return <div data-testid="concierge-page" className="space-y-4">
    <Head title="Concierge" sub="Outsourced + in-house concierge work by vendor lane · counts at rest, tap a count for the cards · lane shape follows “do we ship to them?”" action={<><Button size="sm" data-testid="concierge-add-vendor" onClick={() => setVendorForm(true)}><Plus size={12} /> Vendor</Button><Button size="sm" variant="primary" data-testid="concierge-send" onClick={() => setForm({})}><Truck size={12} /> Send to vendor</Button></>} />
    <Flash msg={msg} error={error} />
    <div data-testid="concierge-board" className="space-y-2">
      {lanes.map((l) => { const open = lane === l.vendor.id; const rows = open && stage ? l.rows.filter((r) => r.stage === stage) : []; return <section key={l.vendor.id} data-testid={`lane-${l.vendor.id}`} data-ships={l.vendor.ships !== false} className="rounded-md border border-line bg-surface">
        <div className="grid items-stretch" style={{ gridTemplateColumns: `220px repeat(${l.stages.length}, minmax(0, 1fr))` }}>
          <div className="flex flex-col justify-center border-r border-line px-3 py-2"><div className="flex items-center gap-2 text-[13px] font-semibold text-ink">{l.vendor.name}<span data-testid={`lane-total-${l.vendor.id}`} className="rounded-full bg-canvas px-1.5 font-mono text-[10px] text-ink-600">{l.total}</span></div><div className="truncate text-[10px] text-ink-400">{l.vendor.work} · {l.vendor.location}{l.vendor.ships === false ? ' · in-house, no shipping' : api.isInternationalVendor(l.vendor) ? ' · international' : ' · domestic'}</div></div>
          {l.stages.map((c) => <button key={c.key} type="button" data-testid={`cell-${l.vendor.id}-${c.key}`} data-count={c.count} data-tone={c.tone} onClick={() => c.count && expand(l.vendor.id, c.key)} className={`flex flex-col items-center justify-center border-r border-line/60 px-1 py-2 last:border-r-0 ${open && stage === c.key ? 'bg-brand-50' : ''} ${c.count ? 'hover:bg-canvas' : 'cursor-default'}`}>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">{c.label}</span>
            <span className={`mt-0.5 rounded-sm px-2 font-mono text-xl font-semibold leading-tight ${TONE[c.tone]}`}>{c.count}</span>
            <span className="h-3 text-[10px] text-ink-400">{c.count && c.key !== 'fulfilled' ? `oldest: ${c.oldestDays}d` : ''}</span>
          </button>)}
        </div>
        {open && stage && <div data-testid={`lane-cards-${l.vendor.id}`} className="border-t border-line bg-canvas/50 p-2">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-500"><ChevronDown size={12} /> {api.swoStageLabel(stage)} · {rows.length} job{rows.length === 1 ? '' : 's'}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map((w) => <Card key={w.id} w={w} onDetail={() => setDetail(w.id)} onBack={() => { setBack(w); setReason(''); }} run={run} from={`/concierge?lane=${l.vendor.id}&stage=${stage}`} />)}</div>
        </div>}
      </section>; })}
    </div>
    {sel && <SwoDetail w={sel} onClose={() => setDetail(null)} run={run} onEdit={() => setForm({ id: sel.id, vendorId: sel.vendorId, jobId: sel.jobId, components: sel.components, work: sel.work, vendorInvoiceTotal: sel.vendorInvoiceTotal, vendorInvoiceNumber: sel.vendorInvoiceNumber, predictedCompletion: sel.predictedCompletion, notes: sel.notes })} />}
    {form && <SwoForm init={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); void run(async () => undefined, m); }} />}
    {vendorForm && <VendorQuickForm onClose={() => setVendorForm(false)} onSaved={(m) => { setVendorForm(false); void run(async () => undefined, m); }} />}
    {back && <Modal testId="concierge-back" title={`Move ${back.number} back one stage`} width="w-[420px]" onClose={() => setBack(null)}>
      <label className="block text-xs text-ink-500">Reason (required)<input autoFocus data-testid="concierge-back-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <div className="mt-3 flex justify-end gap-2"><Button size="sm" onClick={() => setBack(null)}>Cancel</Button><Button size="sm" variant="primary" data-testid="concierge-back-go" disabled={!reason.trim()} onClick={() => { const w = back; setBack(null); void run(() => api.sendBackSwo(w.id, reason), `${w.number} moved back — ${reason}`); }}>Move back</Button></div>
    </Modal>}
  </div>;
}

const Card = ({ w, onDetail, onBack, run, from }: { w: SwoWithRefs; onDetail: () => void; onBack: () => void; run: (fn: () => Promise<unknown>, m: string) => Promise<void>; from: string }) => {
  const lane = api.laneStagesFor(w.vendor); const li = lane.indexOf(w.stage); const next = lane[li + 1]; const noShip = w.vendor.ships === false; const days = api.swoDaysAtStage(w);
  const advance = () => { if (next === 'sent') return onDetail(); if (next === 'inbound' && !w.returnLabel) return onDetail(); void run(() => api.advanceSwo(w.id, next), `${w.number} → ${api.swoStageLabel(next)}`); };
  return <div data-testid={`concierge-card-${w.id}`} className="rounded-sm border border-line bg-surface p-2 text-xs">
    <div className="flex items-center justify-between"><Link to={`/jobs/${w.jobId}`} state={{ from }} data-testid={`concierge-card-job-${w.id}`} className="font-mono font-semibold text-brand hover:underline">{w.jobNumber.replace(/^E/, '')}</Link><span className={`font-mono text-[10px] ${days >= 7 ? 'text-rose-700' : days >= 3 ? 'text-amber-700' : 'text-ink-400'}`}>{days}d at stage</span></div>
    <div className="truncate text-ink">{w.clientName} · {w.watchLabel}</div>
    <div className="truncate text-[11px] text-ink-500">{w.work}</div>
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-ink-400">{!noShip && w.predictedCompletion && <span>back {fmtDate(w.predictedCompletion)}</span>}{!noShip && <span data-testid={`concierge-paid-${w.id}`} className={`rounded-sm px-1 font-semibold uppercase ${w.paid ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-500'}`}>{w.paid ? 'Paid' : 'Unpaid'}</span>}{w.international && <span className="rounded-sm bg-sky-50 px-1 text-sky-800">intl</span>}</div>
    <div className="mt-1.5 flex items-center gap-1">
      {next && <Button size="sm" variant="primary" data-testid={`concierge-advance-${w.id}`} onClick={advance}>→ {api.swoStageLabel(next)}</Button>}
      {li > 0 && <Button size="sm" variant="ghost" data-testid={`concierge-sendback-${w.id}`} onClick={onBack} title="Back one stage (reason required)"><Undo2 size={11} /></Button>}
      <button type="button" data-testid={`concierge-open-${w.id}`} onClick={onDetail} className="ml-auto text-[11px] text-brand hover:underline">detail</button>
    </div>
  </div>;
};

// Vendor add from the Concierge screen — reuses the Purchasing vendor module (kind outsource). ONE lane-shaping question: do we ship items to this vendor?
const VendorQuickForm = ({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) => {
  const [f, setF] = useState<VendorInput>({ name: '', contact: '', email: '', phone: '', terms: 'Net 15', division: 'rolliworks', kind: 'outsource', ships: true, country: 'US', location: '', work: '', leadTimeDays: 10, active: true }); const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof VendorInput, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return <Modal testId="concierge-vendor-form" title="New concierge / outsource vendor" width="w-[560px]" onClose={onClose}>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label className="col-span-2">Name<input data-testid="cv-name" value={f.name} onChange={(e) => set('name', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <label>Location<input data-testid="cv-location" value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <label>Contact email<input data-testid="cv-email" value={f.email} onChange={(e) => set('email', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <label className="col-span-2">What they do<input data-testid="cv-work" value={f.work ?? ''} onChange={(e) => set('work', e.target.value)} className={`${field} mt-1 w-full`} /></label>
      <fieldset data-testid="cv-ships" className="col-span-2 rounded-sm border border-brand-100 bg-brand-50/50 p-2"><legend className="px-1 font-semibold text-brand">Do we ship items to this vendor?</legend><div className="flex gap-3">{[true, false].map((v) => <label key={String(v)} className="inline-flex items-center gap-1"><input type="radio" data-testid={`cv-ships-${v ? 'yes' : 'no'}`} checked={f.ships === v} onChange={() => set('ships', v)} /> {v ? 'Yes — full shipping lane (In route · Returning · Received)' : 'No — hand-off lane (In queue · In progress · Inspection · Fulfilled)'}</label>)}</div></fieldset>
      <label className="inline-flex items-center gap-1"><input type="checkbox" data-testid="cv-intl" checked={f.country !== 'US'} onChange={(e) => set('country', e.target.checked ? 'INTL' : 'US')} disabled={f.ships === false} /> International (customs on labels)</label>
      <label>Predicted turnaround (days)<input type="number" inputMode="numeric" data-testid="cv-lead" value={f.leadTimeDays ?? 0} onChange={(e) => set('leadTimeDays', Number(e.target.value))} className={`${field} mt-1 w-full`} /></label>
    </div>
    {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}
    <div className="mt-3 flex justify-end gap-2"><Button size="sm" onClick={onClose}>Cancel</Button><Button size="sm" variant="primary" data-testid="cv-save" onClick={() => api.saveVendor({ ...f, contact: f.contact || f.name }).then((v) => onSaved(`Vendor ${v.name} added — ${f.ships === false ? 'hand-off lane' : 'shipping lane'}`)).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'))}>Create vendor</Button></div>
  </Modal>;
};
