import { LayoutList, MousePointerClick, Plus, Truck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoInput, SwoStage, VendorInput } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ActionMap } from '@/components/concierge/ActionMap';
import { SlidePanel, type PanelState } from '@/components/concierge/SlidePanel';
import type { Run } from '@/components/concierge/SwoCard';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtMoney } from '@/lib/format';
import { SwoForm } from './SwoPage';

const TONE: Record<string, string> = { empty: 'text-ink-300', ok: 'text-ink', amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-300', red: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300' };
type View = 'track' | 'action';

// CONCIERGE — TRACK (lane board, progress) | ACTION (click-map treatment). Tapping a count opens the slide-out panel; the board stays visible. Last view remembered per user.
export default function ConciergePage() {
  const { user } = useAuth(); const viewKey = `rollisuite.concierge.view.${user?.id ?? 'anon'}`;
  const [view, setViewState] = useState<View>(() => (localStorage.getItem(viewKey) as View) || 'track'); const setView = (v: View) => { setViewState(v); localStorage.setItem(viewKey, v); };
  const [lanes, setLanes] = useState<ConciergeLane[]>([]); const [sp, setSp] = useSearchParams();
  const [panel, setPanel] = useState<PanelState>(() => { const l = sp.get('lane'); const st = sp.get('stage') as SwoStage | null; const swo = sp.get('swo'); return swo ? { kind: 'lookup', swoIds: [swo], title: 'Shop work order' } : l && st ? { kind: 'stage', vendorId: l, stage: st } : null; });
  const [picked, setPicked] = useState<string | null>(null); const [form, setForm] = useState<Partial<SwoInput> | null>(null); const [vendorForm, setVendorForm] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { cz.syncConciergeAlerts(); setLanes(await api.getConciergeBoard()); }, []);
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (fn, m) => { try { setError(null); await fn(); await load(); setMsg(m); setTimeout(() => setMsg(null), 3500); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const openStage = (vendorId: string, stage: SwoStage) => { const same = panel?.kind === 'stage' && panel.vendorId === vendorId && panel.stage === stage; const next: PanelState = same ? null : { kind: 'stage', vendorId, stage }; setPanel(next); setSp(next ? { lane: vendorId, stage } : {}); };
  const closePanel = useCallback(() => { setPanel(null); setSp({}); }, [setSp]);
  const total = lanes.reduce((t, l) => t + l.rows.length, 0);
  return <div data-testid="concierge-page" className="space-y-4">
    <Head title="Concierge" sub={`${lanes.length} vendor lanes · ${total} shop work orders · tap a count for the cards (panel slides in from the right) · tap a vendor name for paid-not-back`} action={<>
      <div data-testid="concierge-view-toggle" className="mr-2 inline-flex rounded-sm border border-line text-xs">{(['track', 'action'] as View[]).map((v) => <button key={v} type="button" data-testid={`concierge-view-${v}`} data-selected={view === v} onClick={() => setView(v)} className={`inline-flex items-center gap-1 px-3 py-1 font-semibold uppercase tracking-wide ${view === v ? 'bg-ink text-white' : 'text-ink-500 hover:bg-canvas'}`}>{v === 'track' ? <LayoutList size={12} /> : <MousePointerClick size={12} />}{v}</button>)}</div>
      <Button size="sm" data-testid="concierge-add-vendor" onClick={() => setVendorForm(true)}><Plus size={12} /> Vendor</Button><Button size="sm" variant="primary" data-testid="concierge-send" onClick={() => setForm({})}><Truck size={12} /> Send to vendor</Button></>} />
    <Flash msg={msg} error={error} />
    <div className={panel ? 'lg:pr-[33.333%]' : ''}>
      {view === 'track' ? <div data-testid="concierge-board" className="space-y-2">
        {lanes.map((l) => { const noShip = l.vendor.ships === false; const prepay = l.vendor.paymentTerms === 'prepay';
          return <section key={l.vendor.id} data-testid={`lane-${l.vendor.id}`} data-ships={!noShip} className="rounded-md border border-line bg-surface">
            <div className="grid items-stretch" style={{ gridTemplateColumns: `240px repeat(${l.stages.length}, minmax(0, 1fr))` }}>
              <div className="flex flex-col justify-center border-r border-line px-3 py-2">
                <button type="button" data-testid={`lane-name-${l.vendor.id}`} onClick={() => setPanel(panel?.kind === 'outstanding' && panel.vendorId === l.vendor.id ? null : { kind: 'outstanding', vendorId: l.vendor.id })} title="Outstanding: paid but not back" className="flex items-center gap-2 text-left text-[13px] font-semibold text-ink hover:underline">{l.vendor.name}<span data-testid={`lane-total-${l.vendor.id}`} className="rounded-full bg-canvas px-1.5 font-mono text-[10px] text-ink-600">{l.total}</span>{prepay && <span className="rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">prepay</span>}</button>
                <div className="truncate text-[10px] text-ink-400">{l.vendor.work} · {l.vendor.location}{noShip ? ' · in-house, no shipping' : api.isInternationalVendor(l.vendor) ? ' · international' : ' · domestic'}</div>
                {!noShip && <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">{l.unpaidCount > 0 && <span data-testid={`lane-unpaid-${l.vendor.id}`} className="text-ink-600">{l.unpaidCount} unpaid · {fmtMoney(l.unpaidTotal)}</span>}{prepay && <span data-testid={`lane-prepaid-${l.vendor.id}`} className="font-semibold text-amber-800">{fmtMoney(l.prepaidTotal)} paid · {l.prepaidNotBack} not back</span>}</div>}
              </div>
              {l.stages.map((c) => { const hi = panel?.kind === 'stage' && panel.vendorId === l.vendor.id && panel.stage === c.key; return <button key={c.key} type="button" data-testid={`cell-${l.vendor.id}-${c.key}`} data-count={c.count} data-late={c.late} data-redo={c.redo} data-tone={c.tone} data-selected={hi} onClick={() => c.count && openStage(l.vendor.id, c.key)} className={`flex flex-col items-center justify-center border-r border-line/60 px-1 py-2 last:border-r-0 ${hi ? 'bg-brand-50 ring-2 ring-inset ring-brand' : ''} ${c.count ? 'hover:bg-canvas' : 'cursor-default'}`}>
                <span className="text-[10px] uppercase tracking-wide text-ink-400">{c.label}</span>
                <span className={`mt-0.5 flex items-baseline gap-1 rounded-sm px-2 font-mono text-xl font-semibold leading-tight ${TONE[c.tone]}`}>{c.count}{c.late > 0 && <span className="text-xs text-rose-700">· {c.late} late</span>}{c.redo > 0 && <span className="text-xs text-amber-800">· {c.redo} redo</span>}</span>
                <span className="h-3 text-[10px] text-ink-400">{c.count && c.key !== 'fulfilled' ? `oldest: ${c.oldestDays}d` : ''}</span>
              </button>; })}
            </div>
          </section>; })}
      </div> : <ActionMap lanes={lanes} run={run} onLookup={(ids, title) => setPanel({ kind: 'lookup', swoIds: ids, title })} onOpenStage={openStage} pickedId={picked} onPickedConsumed={() => setPicked(null)} />}
    </div>
    <SlidePanel state={panel} lanes={lanes} run={run} onClose={closePanel} onPick={view === 'action' ? (w) => { setPicked(w.id); closePanel(); } : undefined} />
    {form && <SwoForm init={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); void run(async () => undefined, m); }} />}
    {vendorForm && <VendorQuickForm onClose={() => setVendorForm(false)} onSaved={(m) => { setVendorForm(false); void run(async () => undefined, m); }} />}
  </div>;
}

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
