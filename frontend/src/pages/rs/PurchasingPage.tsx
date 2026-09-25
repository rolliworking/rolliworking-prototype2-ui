import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Part, PurchaseOrderWithRefs, StockLocation, Vendor } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field, Flash, Head, useLoad } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

interface Bundle { vendors: Vendor[]; pos: PurchaseOrderWithRefs[]; parts: Part[]; locations: StockLocation[] }
const load = async (): Promise<Bundle> => ({ vendors: await api.getVendors(), pos: await api.getPurchaseOrders(), parts: await api.getParts(), locations: await api.getLocations() });

export default function PurchasingPage() {
  const { data, error, msg, run } = useLoad(load);
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(!!params.get('part'));
  const [open, setOpen] = useState<string | null>(null);
  const [vendorForm, setVendorForm] = useState<{ name: string; contact: string; email: string; phone: string; terms: string } | null>(null);
  if (!data) return <div className="text-xs text-ink-400">Loading…</div>;
  const po = data.pos.find((p) => p.id === open);
  return (
    <div data-testid="purchasing-page" className="space-y-4">
      <Head title="Purchasing" sub={<>Vendors · purchase orders · receive against PO — receiving increments inventory with an audited movement <Provisional note="PO send = Outbox stub; no vendor API. Cross-division inventory rules not ruled (MH)" /></>} action={<Button variant="primary" data-testid="po-new" onClick={() => setCreate(true)}>New purchase order</Button>} />
      <Flash error={error} msg={msg} />
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <Card title="Purchase orders" subtitle={`${data.pos.length} · division-stamped`} bodyClassName="p-0" testId="po-list">
          <Table><thead><tr><Th>PO</Th><Th>Vendor</Th><Th>Status</Th><Th>Lines</Th><Th className="text-right">Total</Th><Th>Division</Th></tr></thead><tbody>
            {data.pos.map((p) => <tr key={p.id} data-testid={`po-row-${p.id}`} onClick={() => setOpen(p.id)} className="cursor-pointer hover:bg-canvas"><Td className="font-mono text-xs font-semibold">{p.number}</Td><Td className="text-xs">{p.vendor.name}</Td><Td><StatusPill status={p.status} /></Td><Td className="text-xs text-ink-500">{p.lines.map((l) => `${l.partNumber} ×${l.qty}${l.receivedQty ? ` (${l.receivedQty} rcvd)` : ''}`).join(', ')}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(p.total)}</Td><Td className="text-[11px] capitalize text-ink-500">{p.division}</Td></tr>)}
            {!data.pos.length && <EmptyRow colSpan={6} text="No purchase orders" />}
          </tbody></Table>
        </Card>
        <Card title="Vendors" subtitle={`${data.vendors.filter((v) => v.active).length} active`} action={<Button size="sm" data-testid="vendor-new" onClick={() => setVendorForm({ name: '', contact: '', email: '', phone: '', terms: 'Net 30' })}>Add</Button>} bodyClassName="p-0" testId="vendor-list">
          <ul className="divide-y divide-line/70">{data.vendors.map((v) => <li key={v.id} data-testid={`vendor-${v.id}`} className={`flex items-center justify-between px-4 py-2 text-xs ${v.active ? '' : 'opacity-50'}`}><div><div className="font-medium text-ink">{v.name}</div><div className="text-[11px] text-ink-400">{v.contact} · {v.email} · {v.terms} · <span className="capitalize">{v.division}</span></div></div><Button size="sm" variant="ghost" data-testid={`vendor-toggle-${v.id}`} onClick={() => run(() => api.setVendorActive(v.id, !v.active), v.active ? 'Vendor retired' : 'Vendor reactivated')}>{v.active ? 'Retire' : 'Restore'}</Button></li>)}</ul>
        </Card>
      </div>
      {po && <PoModal po={po} onClose={() => setOpen(null)} run={run} />}
      {create && <CreatePoModal data={data} presetPart={params.get('part') ?? undefined} onClose={() => { setCreate(false); setParams({}); }} run={run} />}
      {vendorForm && <Modal testId="vendor-modal" title="New vendor" onClose={() => setVendorForm(null)}>
        <div className="grid grid-cols-2 gap-2">{(['name', 'contact', 'email', 'phone', 'terms'] as const).map((k) => <label key={k} className="text-xs text-ink-500 capitalize">{k}<input data-testid={`vendor-${k}`} value={vendorForm[k]} onChange={(e) => setVendorForm({ ...vendorForm, [k]: e.target.value })} className={`${field} mt-1 block w-full`} /></label>)}</div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setVendorForm(null)}>Cancel</Button><Button variant="primary" data-testid="vendor-save" onClick={() => run(async () => { await api.saveVendor({ ...vendorForm, division: api.getSessionDivision() }); setVendorForm(null); }, 'Vendor created')}>Save</Button></div>
      </Modal>}
    </div>
  );
}

function PoModal({ po, onClose, run }: { po: PurchaseOrderWithRefs; onClose: () => void; run: (a: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(po.lines.map((l) => [l.id, l.qty - l.receivedQty])));
  const [reason, setReason] = useState('');
  const receivable = po.status === 'sent' || po.status === 'partially_received';
  return (
    <Modal testId="po-modal" title={`${po.number} · ${po.vendor.name}`} width="w-[680px]" onClose={onClose}>
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-500"><StatusPill status={po.status} /> · to {po.location.name} · created {fmtDate(po.createdAt)} by {po.createdBy} · {po.station}{po.memo && <> · {po.memo}</>}</div>
      <Table><thead><tr><Th>Part</Th><Th className="text-right">Ordered</Th><Th className="text-right">Received</Th><Th className="text-right">Unit</Th>{receivable && <Th className="text-right">Receive now</Th>}</tr></thead><tbody>
        {po.lines.map((l) => <tr key={l.id} data-testid={`po-line-${l.id}`}><Td><span className="font-mono text-xs">{l.partNumber}</span> <span className="text-xs text-ink-500">{l.description}</span></Td><Td className="tabular text-right text-xs">{l.qty}</Td><Td className="tabular text-right text-xs">{l.receivedQty}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(l.unitCost)}</Td>{receivable && <Td className="text-right"><input data-testid={`po-receive-${l.id}`} type="number" min={0} max={l.qty - l.receivedQty} value={qty[l.id] ?? 0} onChange={(e) => setQty({ ...qty, [l.id]: Number(e.target.value) })} className={`${field} w-16 text-right`} /></Td>}</tr>)}
      </tbody></Table>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">Total {fmtMoneyCents(po.total)}</div>
        <div className="flex items-center gap-2">
          {po.status === 'draft' && <Button variant="primary" data-testid="po-send" onClick={() => run(() => api.sendPurchaseOrder(po.id), 'PO sent (stub → Outbox)')}>Send (stub)</Button>}
          {receivable && <Button variant="primary" data-testid="po-receive" onClick={() => run(() => api.receivePurchaseOrder(po.id, qty), 'Received — stock updated')}>Receive lines</Button>}
          {po.status !== 'received' && po.status !== 'cancelled' && <><input data-testid="po-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="cancel reason" className={`${field} w-40`} /><Button data-testid="po-cancel" onClick={() => run(async () => { await api.cancelPurchaseOrder(po.id, reason); onClose(); }, 'PO cancelled')}>Cancel PO</Button></>}
        </div>
      </div>
    </Modal>
  );
}

function CreatePoModal({ data, presetPart, onClose, run }: { data: Bundle; presetPart?: string; onClose: () => void; run: (a: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const active = data.vendors.filter((v) => v.active);
  const [vendorId, setVendorId] = useState(active[0]?.id ?? '');
  const [locationId, setLocationId] = useState(data.locations[0]?.id ?? '');
  const [memo, setMemo] = useState(presetPart ? 'Low-stock reorder' : '');
  const [lines, setLines] = useState<{ partId: string; qty: number; unitCost: number }[]>(presetPart ? [{ partId: presetPart, qty: 2, unitCost: data.parts.find((p) => p.id === presetPart)?.price ?? 0 }] : [{ partId: data.parts[0]?.id ?? '', qty: 1, unitCost: data.parts[0]?.price ?? 0 }]);
  const set = (i: number, patch: Partial<typeof lines[number]>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <Modal testId="po-create-modal" title="New purchase order" width="w-[680px]" onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 text-xs text-ink-500">
        <label>Vendor<select data-testid="po-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={`${field} mt-1 block w-full`}>{active.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Receive into<select data-testid="po-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`${field} mt-1 block w-full`}>{data.locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.division}</option>)}</select></label>
        <label>Memo<input data-testid="po-memo" value={memo} onChange={(e) => setMemo(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
      </div>
      <div className="mt-3 space-y-1">{lines.map((l, i) => <div key={i} className="flex items-center gap-2"><select data-testid={`po-line-part-${i}`} value={l.partId} onChange={(e) => set(i, { partId: e.target.value, unitCost: data.parts.find((p) => p.id === e.target.value)?.price ?? 0 })} className={`${field} flex-1`}>{data.parts.map((p) => <option key={p.id} value={p.id}>{p.partNumber} · {p.name}</option>)}</select><input data-testid={`po-line-qty-${i}`} type="number" min={1} value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} className={`${field} w-16 text-right`} /><input data-testid={`po-line-cost-${i}`} type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => set(i, { unitCost: Number(e.target.value) })} className={`${field} w-24 text-right`} /><Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, k) => k !== i))}>×</Button></div>)}
        <Button size="sm" data-testid="po-add-line" onClick={() => setLines([...lines, { partId: data.parts[0].id, qty: 1, unitCost: data.parts[0].price }])}>+ line</Button></div>
      <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="po-create-save" onClick={() => run(async () => { await api.createPurchaseOrder({ vendorId, locationId, lines, memo }); onClose(); }, 'Purchase order created (draft)')}>Create draft</Button></div>
    </Modal>
  );
}
