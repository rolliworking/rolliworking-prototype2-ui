import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { NeedsOrderingRow, POLine, PurchaseOrderWithRefs, StockLocation, Vendor } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

const COLOR = { green: 'text-moss-700', black: 'text-ink', red: 'text-rose-700 font-semibold' };
// PO line price vs the part's average: green >10% below · black within ±10% · red >10% above (needs acknowledge before send)
export const PriceCell = ({ line }: { line: POLine }) => { const pr = api.partPricingSync(line.partId); const avg = line.avgAtOrder ?? pr.avgCost; const c = api.priceColor(line.unitCost, avg); return <span data-testid={`po-price-${line.id}`} data-color={c} className={`tabular ${COLOR[c]}`} title={avg !== null ? `avg ${fmtMoneyCents(avg)}${pr.last ? ` · last ${fmtMoneyCents(pr.last.price)} ${pr.last.vendorName} ${fmtDate(pr.last.at)}` : ''}` : 'no purchase history'}>{fmtMoneyCents(line.unitCost)}{c === 'red' && ' ⚠'}</span>; };

// PO detail: acknowledge red lines · Generate label (Parcel Pro, vendor address, insured = PO total) · upload fallback · putaway on receipt
export const PoDeepBar = ({ po, locations, run, receivable }: { po: PurchaseOrderWithRefs; locations: StockLocation[]; run: (a: () => Promise<unknown>, m: string) => Promise<void>; qty: Record<string, number>; receivable: boolean }) => {
  const red = api.poRedLines(po); const [service, setService] = useState('UPS 2nd Day Air');
  return <div data-testid="po-deep-bar" className="flex flex-wrap items-center gap-2 text-xs">
    {po.status === 'draft' && red.length > 0 && (po.redAcknowledgedBy ? <span data-testid="po-red-acked" className="rounded-sm bg-amber-50 px-2 py-1 text-amber-800">⚠ {red.length} above-average line(s) acknowledged by {po.redAcknowledgedBy}</span> : <Button data-testid="po-ack-red" className="!border-rose-200 !text-rose-700" onClick={() => run(() => api.acknowledgeRedLines(po.id), 'Acknowledged')}>⚠ Acknowledge {red.length} line(s) &gt;10% above average</Button>)}
    {po.status !== 'cancelled' && (po.labelUrl ? <span data-testid="po-label" className="rounded-sm border border-line px-2 py-1">Label · {po.labelService}{po.trackingNumber && <> · <Link to={`/shipping/inbound?track=${po.trackingNumber}`} className="font-mono underline">{po.trackingNumber}</Link></>} · rides the PO email</span>
      : <><select data-testid="po-label-service" value={service} onChange={(e) => setService(e.target.value)} className="h-8 rounded-sm border border-line bg-canvas px-1.5">{['UPS 2nd Day Air', 'UPS Next Day Air', 'UPS Ground', 'FedEx Priority Overnight', 'FedEx 2Day'].map((s) => <option key={s}>{s}</option>)}</select><Button data-testid="po-generate-label" onClick={() => run(() => api.generatePoLabel(po.id, service), `Label generated · insured ${fmtMoneyCents(po.total)}`)}>Generate label</Button><label className="cursor-pointer rounded-sm border border-line px-2 py-1.5 hover:bg-canvas">Upload label<input data-testid="po-upload-label" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(() => api.uploadPoLabel(po.id, URL.createObjectURL(f)), 'Label uploaded'); }} /></label></>)}
    {receivable && <label className="ml-auto inline-flex items-center gap-1">Put away at <select id="po-putaway" data-testid="po-putaway" defaultValue={po.locationId} className="h-8 rounded-sm border border-line bg-canvas px-1.5">{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
  </div>;
};

// Needs-ordering queue (OUT-OF-STOCK actions · pick shorts · below-min) → Generate PO per vendor · CSV import · vendor cards
export const PurchasingDeep = ({ vendors, onChange }: { vendors: Vendor[]; locations: StockLocation[]; onChange: () => void }) => {
  const [needs, setNeeds] = useState<NeedsOrderingRow[]>([]); const [vendorId, setVendorId] = useState(vendors.find((v) => v.active)?.id ?? ''); const [csv, setCsv] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [openVendor, setOpenVendor] = useState<string | null>(null);
  const load = () => api.getNeedsOrdering().then(setNeeds);
  useEffect(() => { void load(); }, []);
  const gen = async () => { try { const po = await api.generatePurchaseOrder(vendorId); setMsg(`${po.number} drafted · ${po.lines.length} lines · ${api.poRedLines(po).length} red / ${po.lines.filter((l) => api.priceColor(l.unitCost, l.avgAtOrder ?? null) === 'green').length} green`); onChange(); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } };
  const REASON = { out_of_stock: 'OUT OF STOCK', pick_short: 'Pick short', below_min: 'Below min' };
  return <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
    <Card title={`Needs ordering · ${needs.length}`} subtitle="Out-of-stock actions · pick shorts · parts below min (min / order-up-to live in the catalog)" testId="needs-ordering" action={<div className="flex items-center gap-2"><select data-testid="gen-po-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="h-8 rounded-sm border border-line bg-canvas px-1.5 text-xs">{vendors.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select><Button size="sm" variant="primary" data-testid="gen-po" onClick={() => void gen()}>Generate PO</Button></div>}>
      {msg && <p data-testid="gen-po-msg" className="mb-2 text-xs text-ink-600">{msg}</p>}
      <ul className="divide-y divide-line text-xs">{needs.map((n) => { const pr = api.partPricingSync(n.partId); const rule = api.getReorderRule(n.partId); return <li key={n.id} data-testid={`needs-${n.id}`} data-reason={n.reason} className="flex flex-wrap items-center gap-2 py-1.5"><span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${n.reason === 'out_of_stock' ? 'bg-rose-50 text-rose-700' : n.reason === 'pick_short' ? 'bg-amber-50 text-amber-800' : 'bg-canvas text-ink-600'}`}>{REASON[n.reason]}</span><span className="font-mono font-semibold">{n.part.partNumber}</span><span className="text-ink-600">{n.part.name}</span>{n.jobNumber && <span className="font-mono text-ink-500">· {n.jobNumber}</span>}<span className="ml-auto text-ink-500">on hand {n.onHand} · on order {n.onOrder}{rule.min ? ` · min ${rule.min} / up to ${rule.orderUpTo}` : ''}</span><span className="text-ink-500">{pr.avgCost !== null ? `avg ${fmtMoneyCents(pr.avgCost)}` : 'no history'}{pr.last && ` · last ${fmtMoneyCents(pr.last.price)} ${pr.last.vendorName}`}</span></li>; })}{!needs.length && <li className="py-3 text-center text-ink-500">Nothing needs ordering.</li>}</ul>
    </Card>
    <div className="space-y-4">
      <Card title="Vendor cards" subtitle="contact · open POs · purchase history" testId="vendor-cards" bodyClassName="p-0">
        <ul className="divide-y divide-line text-xs">{vendors.filter((v) => v.active).map((v) => <li key={v.id} data-testid={`vendor-card-${v.id}`}><div className="flex items-center hover:bg-canvas"><button onClick={() => setOpenVendor(openVendor === v.id ? null : v.id)} className="flex flex-1 items-center gap-2 px-3 py-2 text-left"><span className="font-medium text-ink">{v.name}</span><span className="text-ink-500">{v.contact} · {v.terms}</span><span className="ml-auto font-mono">{api.vendorOpenPos(v.id)} open · {api.vendorHistory(v.id).length} buys</span></button><Link to={`/purchasing/vendors/${v.id}`} data-testid={`vendor-card-link-${v.id}`} className="px-3 text-[10px] text-ink-500 underline">detail</Link></div>{openVendor === v.id && <ul data-testid={`vendor-history-${v.id}`} className="space-y-0.5 bg-canvas/60 px-3 py-2">{api.vendorHistory(v.id).slice(0, 8).map((h) => <li key={h.id} className="flex gap-2"><span className="text-ink-500">{fmtDate(h.at)}</span><span className="font-mono">{api.resolvePartScan(h.partId)?.partNumber}</span><span>×{h.qty}</span><span className="ml-auto font-mono">{fmtMoneyCents(h.unitPrice / 100)}</span></li>)}</ul>}</li>)}</ul>
      </Card>
      <Card title="Import vendors + purchase history (CSV)" subtitle="vendor,Name,Contact,Email,Phone,Terms · or · YYYY-MM-DD,Vendor,Part#,Qty,UnitPrice" testId="csv-import">
        <textarea data-testid="csv-text" rows={3} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'vendor,Swiss Supply,Marc,orders@swiss.example,(212) 555-0199,Net 30\n2026-08-14,Swiss Supply,25-16610,4,84.00'} className="w-full rounded-sm border border-line bg-canvas px-2 py-1 font-mono text-[11px]" />
        <Button size="sm" data-testid="csv-import-run" className="mt-2" onClick={async () => { const r = await api.importPurchaseCsv(csv); setMsg(`Imported ${r.vendors} vendor(s), ${r.rows} history row(s)`); setCsv(''); onChange(); await load(); }}>Import</Button>
      </Card>
    </div>
  </div>;
};
