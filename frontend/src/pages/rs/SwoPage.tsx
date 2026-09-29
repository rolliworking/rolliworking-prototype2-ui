import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ComponentKey, SwoInput, Vendor } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const COMPONENTS: { key: ComponentKey; label: string }[] = [{ key: 'head', label: 'Head / dial' }, { key: 'case', label: 'Case / bezel' }, { key: 'band', label: 'Bracelet' }];

// "Send to vendor" form — the only thing left from the old Shop Work Orders screen (the board + detail live in Concierge)
export function SwoForm({ init, onClose, onSaved }: { init: Partial<SwoInput>; onClose: () => void; onSaved: (m: string, id: string) => void }) {
  const [f, setF] = useState<SwoInput>({ vendorId: '', jobId: '', components: [], work: '', vendorInvoiceTotal: 0, pointPerson: init.pointPerson ?? 'Chyna', ...init });
  const [vendors, setVendors] = useState<Vendor[]>([]); const [q, setQ] = useState(''); const [hits, setHits] = useState<Awaited<ReturnType<typeof api.getSwoJobCandidates>>>([]); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void api.getOutsourceVendors().then((v) => { setVendors(v); if (!f.vendorId && v[0]) setF((x) => ({ ...x, vendorId: v[0].id })); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (init.id) return; void api.getSwoJobCandidates(q).then(setHits); }, [q, init.id]);
  const v = vendors.find((x) => x.id === f.vendorId);
  // expected date prefills from vendor turnaround + shipping each way; re-prefills when the vendor changes on a NEW order
  useEffect(() => { if (v && !init.id) setF((x) => ({ ...x, predictedCompletion: api.defaultExpectedAt(v) })); }, [v?.id, init.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const staff = cz.conciergeStaff();
  return <Modal testId="swo-modal" title={init.id ? 'Edit shop work order' : 'New shop work order'} width="w-[620px]" onClose={onClose}>
    <div className="space-y-3 text-xs text-ink-500">
      {!init.id && <div>Job<input data-testid="swo-job-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job number or client" className={`${field} mt-1 block w-full`} /><ul className="mt-1 max-h-32 divide-y divide-line/70 overflow-y-auto rounded-sm border border-line">{hits.map((h) => <li key={h.id}><button data-testid={`swo-job-${h.id}`} onClick={() => setF({ ...f, jobId: h.id, components: f.components.length ? f.components : [h.components.includes('case') ? 'case' : h.components[0]] })} className={`flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-canvas ${f.jobId === h.id ? 'bg-ink text-white hover:bg-ink' : ''}`}><span className="font-mono font-semibold">{h.number}</span><span>{h.client}</span><span className="ml-auto">{h.watch}</span></button></li>)}</ul></div>}
      <div className="grid grid-cols-2 gap-2"><label>Vendor (outsource work)<select data-testid="swo-vendor" value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} className={`${field} mt-1 block w-full`}>{vendors.map((x) => <option key={x.id} value={x.id}>{x.name}{api.isInternationalVendor(x) ? ` (${x.country} · international)` : ''}</option>)}</select>{v && <span className="mt-0.5 block text-[11px]">{v.terms} · lead {v.leadTimeDays ?? '?'} d{api.isInternationalVendor(v) ? ' · customs required' : ''}</span>}</label>
        <div>Components going out<div className="mt-1 flex gap-1">{COMPONENTS.map((c) => <button key={c.key} data-testid={`swo-comp-${c.key}`} onClick={() => setF({ ...f, components: f.components.includes(c.key) ? f.components.filter((k) => k !== c.key) : [...f.components, c.key] })} className={`rounded-sm border px-2 py-1 ${f.components.includes(c.key) ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas'}`}>{c.label}</button>)}</div></div></div>
      <label className="block">Work to be done<textarea data-testid="swo-work" rows={2} value={f.work} onChange={(e) => setF({ ...f, work: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
      <div className="grid grid-cols-2 gap-2 rounded-sm border border-brand-100 bg-brand-50/40 p-2"><label>Expected completion date <span className="text-rose-600">*</span><input type="date" required data-testid="swo-form-predicted" value={f.predictedCompletion ?? ''} onChange={(e) => setF({ ...f, predictedCompletion: e.target.value })} className={`${field} mt-1 block w-full`} />{v && <span className="mt-0.5 block text-[10px]">prefilled: {v.leadTimeDays ?? 10} d turnaround{v.ships === false ? '' : ` + ${api.shipDaysFor(v)} d shipping each way`}</span>}</label>
        <label>Point person <span className="text-rose-600">*</span><select data-testid="swo-form-point" value={f.pointPerson ?? ''} onChange={(e) => setF({ ...f, pointPerson: e.target.value })} className={`${field} mt-1 block w-full`}><option value="">— who chases this vendor job —</option>{staff.map((u) => <option key={u.id} value={u.shortName}>{u.shortName} · {u.dutyLabel}</option>)}</select></label></div>
      <div className="grid grid-cols-2 gap-2"><label>Vendor quote / expected total $<input type="number" min={0} data-testid="swo-invoice-total" value={f.vendorInvoiceTotal} onChange={(e) => setF({ ...f, vendorInvoiceTotal: Number(e.target.value) })} className={`${field} mt-1 block w-full`} /></label><span className="mt-5 text-[11px]">Vendor invoices + Paid are entered on the card after creation (invoice # + our payment reference required, duplicate guard).</span></div>
      <label className="block">Notes<input data-testid="swo-notes" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
      {err && <div data-testid="swo-form-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="swo-save" disabled={!f.jobId || !f.vendorId || !f.predictedCompletion || !f.pointPerson || !f.work.trim() || !f.components.length} onClick={async () => { try { const w = await api.saveShopWorkOrder(f); onSaved(`${w.number} ${init.id ? 'updated' : 'queued'} · ${w.vendor.name}`, w.id); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}>{init.id ? 'Save' : 'Queue work order'}</Button></div>
    </div>
  </Modal>;
}
