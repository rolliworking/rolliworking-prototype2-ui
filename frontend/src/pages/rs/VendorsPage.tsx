import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Vendor, VendorSummary } from '@/api/client';
import { field, Flash, Head, useLoad } from '@/components/rs/RsBits';
import { VendorForm } from '@/components/rs/VendorForm';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

const Active = ({ v }: { v: Vendor }) => <span data-testid={`vendor-active-pill-${v.id}`} className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${v.active ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-400'}`}>{v.active ? 'Active' : 'Inactive'}</span>;
const Via = ({ v }: { v: Vendor }) => v.createdVia && v.createdVia !== 'seed' ? <span className="text-[10px] text-ink-400" title="Same record whichever way it was created">via {v.createdVia.replace('_', ' ')}</span> : null;

// Vendors — list · add · edit. Every vendor is ONE record shared with CSV import / PO auto-catalog; edits here update parts, POs and price history references.
export default function VendorsPage() {
  const { data, error, msg, run } = useLoad(() => api.getVendorSummaries());
  const [q, setQ] = useState(''); const [form, setForm] = useState<{ vendor?: Vendor } | null>(null); const [showInactive, setShowInactive] = useState(true);
  const navigate = useNavigate();
  if (!data) return <div className="text-xs text-ink-400">Loading…</div>;
  const rows = data.filter((s) => (showInactive || s.vendor.active) && (!q.trim() || [s.vendor.name, s.vendor.contact, s.vendor.email, s.vendor.accountRef ?? ''].join(' ').toLowerCase().includes(q.trim().toLowerCase())));
  return <div data-testid="vendors-page" className="space-y-4">
    <Head title="Vendors" sub={<>{data.filter((s) => s.vendor.active).length} active · {data.length - data.filter((s) => s.vendor.active).length} inactive · <Link to="/purchasing" className="underline" data-testid="vendors-back-purchasing">Purchasing</Link></>} action={<Button variant="primary" data-testid="vendor-new" onClick={() => setForm({})}>Add vendor</Button>} />
    <Flash error={error} msg={msg} />
    <div className="flex items-center gap-3"><input data-testid="vendor-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name · contact · email · account #" className={`${field} w-80`} /><label className="flex items-center gap-1.5 text-xs text-ink-500"><input type="checkbox" data-testid="vendor-show-inactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label></div>
    <Card bodyClassName="p-0" testId="vendor-table">
      <Table><thead><tr><Th>Vendor</Th><Th>Contact</Th><Th>Terms</Th><Th className="text-right">Parts linked</Th><Th className="text-right">Open POs</Th><Th>Last order</Th><Th>Avg turnaround</Th><Th>Status</Th><Th></Th></tr></thead><tbody>
        {rows.map((s) => <tr key={s.vendor.id} data-testid={`vendor-row-${s.vendor.id}`} onClick={() => navigate(`/purchasing/vendors/${s.vendor.id}`)} className={`cursor-pointer hover:bg-canvas ${s.vendor.active ? '' : 'opacity-60'}`}>
          <Td><div className="text-xs font-medium text-ink">{s.vendor.name}</div><div className="text-[10px] capitalize text-ink-400">{s.vendor.division}{s.vendor.accountRef && ` · acct ${s.vendor.accountRef}`} <Via v={s.vendor} /></div></Td>
          <Td className="text-xs text-ink-600">{s.vendor.contact}<div className="text-[10px] text-ink-400">{s.vendor.email}</div></Td>
          <Td className="text-xs">{s.vendor.terms}</Td>
          <Td className="tabular text-right text-xs" data-testid={`vendor-parts-${s.vendor.id}`}>{s.partsLinked}</Td>
          <Td className="tabular text-right text-xs">{s.openPos || <span className="text-ink-300">—</span>}</Td>
          <Td className="text-xs">{s.lastOrderAt ? fmtDate(s.lastOrderAt) : <span className="text-ink-300">never</span>}</Td>
          <Td className="text-xs">{s.avgTurnaroundDays !== undefined ? `${s.avgTurnaroundDays} d` : <span className="text-ink-300">unknown</span>}</Td>
          <Td><Active v={s.vendor} /></Td>
          <Td className="text-right"><Button size="sm" variant="ghost" data-testid={`vendor-edit-${s.vendor.id}`} onClick={(e) => { e.stopPropagation(); setForm({ vendor: s.vendor }); }}>Edit</Button></Td>
        </tr>)}
        {!rows.length && <EmptyRow colSpan={9} text="No vendors match" />}
      </tbody></Table>
    </Card>
    {form && <VendorForm vendor={form.vendor} onClose={() => setForm(null)} onSaved={(v) => { setForm(null); void run(async () => undefined, form.vendor ? `Vendor updated · ${v.name}` : `Vendor created · ${v.name}`); }} />}
  </div>;
}

const Field = ({ label, value, testId }: { label: string; value?: string | number; testId: string }) => <div data-testid={testId}><div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div><div className="text-xs text-ink">{value === undefined || value === '' ? <span className="text-ink-300">—</span> : value}</div></div>;

// Vendor detail: everything vendor-scoped rolls up here — linked parts ranked by last price paid, open / past POs, purchase history
export function VendorDetailPage() {
  const { id = '' } = useParams();
  const { data, error, msg, run } = useLoad(() => api.getVendorDetail(id), [id]);
  const [edit, setEdit] = useState(false);
  if (error && !data) return <div data-testid="vendor-detail-error" className="text-xs text-rose-700">{error}</div>;
  if (!data) return <div className="text-xs text-ink-400">Loading…</div>;
  const v = data.summary.vendor; const s: VendorSummary = data.summary;
  return <div data-testid="vendor-detail-page" className="space-y-4">
    <Head title={v.name} sub={<><Active v={v} /> · <span className="capitalize">{v.division}</span> · <Link to="/purchasing/vendors" className="underline" data-testid="vendor-detail-back">All vendors</Link></>} action={<div className="flex gap-2"><Button data-testid="vendor-toggle-active" onClick={() => run(() => api.setVendorActive(v.id, !v.active), v.active ? 'Vendor set inactive — dropped from Generate PO suggestions' : 'Vendor reactivated')}>{v.active ? 'Set inactive' : 'Reactivate'}</Button><Button variant="primary" data-testid="vendor-detail-edit" onClick={() => setEdit(true)}>Edit</Button></div>} />
    <Flash error={error} msg={msg} />
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3">
      <Card title="Contact" testId="vendor-contact-card"><div className="space-y-2"><Field label="Person" value={v.contact} testId="vd-contact" /><Field label="Email" value={v.email} testId="vd-email" /><Field label="Phone" value={v.phone} testId="vd-phone" /></div></Card>
      <Card title="Terms & account" testId="vendor-terms-card"><div className="space-y-2"><Field label="Payment terms" value={v.terms} testId="vd-terms" /><Field label="Our account / ref #" value={v.accountRef} testId="vd-account-ref" /><Field label="Record origin" value={v.createdVia?.replace('_', ' ') ?? 'seed'} testId="vd-origin" /></div></Card>
      <Card title="Shipping / ordering" testId="vendor-shipping-card"><div className="space-y-2"><Field label="Minimum order" value={v.minOrder} testId="vd-min-order" /><Field label="Preferred method" value={v.preferredMethod} testId="vd-method" /><Field label="Lead time" value={v.leadTimeDays !== undefined ? `${v.leadTimeDays} days` : undefined} testId="vd-lead-time" /><Field label="Notes" value={v.shippingNotes} testId="vd-shipping-notes" /></div></Card>
      <Card title="At a glance" testId="vendor-glance-card"><div className="space-y-2"><Field label="Parts linked" value={s.partsLinked} testId="vd-parts-linked" /><Field label="Open POs" value={s.openPos} testId="vd-open-pos" /><Field label="Last order" value={s.lastOrderAt ? fmtDate(s.lastOrderAt) : 'never'} testId="vd-last-order" /><Field label="Avg turnaround (sent → received)" value={s.avgTurnaroundDays !== undefined ? `${s.avgTurnaroundDays} days` : 'unknown'} testId="vd-turnaround" />{v.notes && <Field label="Internal notes" value={v.notes} testId="vd-notes" />}</div></Card>
    </div>
    <Card title={`Parts linked · ${data.parts.length}`} subtitle="ranked by last price paid to this vendor · avg = all vendors · flag when another vendor was cheaper last time" bodyClassName="p-0" testId="vendor-parts-card">
      <Table><thead><tr><Th>Part</Th><Th className="text-right">Last price paid</Th><Th>Last bought</Th><Th className="text-right">Buys</Th><Th className="text-right">Avg (all vendors)</Th><Th>Cheaper elsewhere</Th></tr></thead><tbody>
        {data.parts.map((p) => <tr key={p.partId} data-testid={`vendor-part-${p.partId}`}><Td><span className="font-mono text-xs font-semibold">{p.partNumber}</span> <span className="text-xs text-ink-500">{p.name}</span></Td><Td className="tabular text-right text-xs">{p.lastPrice !== undefined ? fmtMoneyCents(p.lastPrice) : <span className="text-ink-300">no buys</span>}</Td><Td className="text-xs">{p.lastAt ? fmtDate(p.lastAt) : '—'}</Td><Td className="tabular text-right text-xs">{p.buys}</Td><Td className="tabular text-right text-xs">{p.avgCost !== null ? fmtMoneyCents(p.avgCost) : '—'}</Td><Td className="text-xs">{p.cheapestElsewhere ? <span className="text-amber-800">{p.cheapestElsewhere.vendorName} · {fmtMoneyCents(p.cheapestElsewhere.price)}</span> : <span className="text-ink-300">—</span>}</Td></tr>)}
        {!data.parts.length && <EmptyRow colSpan={6} text="No parts linked yet — link parts in the Parts module or buy from this vendor on a PO" />}
      </tbody></Table>
    </Card>
    <div className="grid grid-cols-2 gap-3">
      <PoCard title={`Open POs · ${data.openPos.length}`} pos={data.openPos} testId="vendor-open-pos" empty="No open purchase orders" />
      <PoCard title={`Past POs · ${data.pastPos.length}`} pos={data.pastPos} testId="vendor-past-pos" empty="No past purchase orders" />
    </div>
    <Card title={`Purchase history · ${data.history.length}`} subtitle="every receipt / imported row for this vendor, newest first" bodyClassName="p-0" testId="vendor-history-card">
      <Table><thead><tr><Th>Date</Th><Th>Part</Th><Th className="text-right">Qty</Th><Th className="text-right">Unit price</Th><Th>PO</Th></tr></thead><tbody>
        {data.history.map((h) => <tr key={h.id} data-testid={`vendor-hist-${h.id}`}><Td className="text-xs">{fmtDate(h.at)}</Td><Td><span className="font-mono text-xs">{h.partNumber}</span> <span className="text-xs text-ink-500">{h.partName}</span></Td><Td className="tabular text-right text-xs">{h.qty}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(h.unitPrice)}</Td><Td className="font-mono text-xs text-ink-500">{h.poNumber ?? '—'}</Td></tr>)}
        {!data.history.length && <EmptyRow colSpan={5} text="No purchase history" />}
      </tbody></Table>
    </Card>
    {edit && <VendorForm vendor={v} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void run(async () => undefined, 'Vendor updated — parts, POs and price history now show the new details'); }} />}
  </div>;
}

const PoCard = ({ title, pos, testId, empty }: { title: string; pos: api.PurchaseOrderWithRefs[]; testId: string; empty: string }) => <Card title={title} bodyClassName="p-0" testId={testId}>
  <Table><thead><tr><Th>PO</Th><Th>Status</Th><Th>Lines</Th><Th className="text-right">Total</Th><Th>Date</Th></tr></thead><tbody>
    {pos.map((p) => <tr key={p.id} data-testid={`${testId}-${p.id}`}><Td><Link to={`/purchasing?po=${p.id}`} className="font-mono text-xs font-semibold hover:underline">{p.number}</Link></Td><Td><StatusPill status={p.status} /></Td><Td className="text-xs text-ink-500">{p.lines.map((l) => `${l.partNumber || l.partId} ×${l.qty}`).join(', ')}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(p.total)}</Td><Td className="text-xs">{fmtDate(p.sentAt ?? p.createdAt)}</Td></tr>)}
    {!pos.length && <EmptyRow colSpan={5} text={empty} />}
  </tbody></Table>
</Card>;
