import { ArrowLeft, ArrowRight, Mail, Pencil, Plus, Printer, Truck, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { MoveResult, SwoHubView, SwoShipmentView, SwoWithRefs } from '@/api/client';
import { AddLineModal, Code128, COMP_LABEL, fmtMD, HubChips, LineParts, ReceiveModal, StageChip, ticketOf, useSwoBase } from '@/components/concierge/SwoBits';
import { HEALTH_TONE, Mini } from '@/components/concierge/SwoCard';
import { VendorInvoicesPanel } from '@/components/concierge/VendorInvoices';
import { field, Flash } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

type Run = (fn: () => Promise<unknown>, m: string) => Promise<void>;
type ModalState = { kind: 'add' } | { kind: 'receive'; line: SwoWithRefs } | { kind: 'back' } | { kind: 'edit' } | { kind: 'reply' } | { kind: 'move'; line: SwoWithRefs } | { kind: 'print' } | { kind: 'customs' } | null;
const OUT = ['sent', 'at_vendor', 'inbound'];
const moveMsg = (r: MoveResult, verb: string) => `${r.moved.length} line${r.moved.length === 1 ? '' : 's'} ${verb}${r.refused.length ? ` · ${r.refused.length} refused — ${r.refused.map((x) => x.reason).join('; ')}` : ''}`;

const SHIP_STATUS: Record<SwoShipmentView['status'], { label: string; cls: string }> = { label_created: { label: 'label created', cls: 'bg-canvas text-ink-600 ring-1 ring-line' }, in_transit: { label: '● in transit', cls: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200' }, delivered: { label: 'delivered', cls: 'bg-moss-50 text-moss-800' } };
const ShipmentRow = ({ hv, s, run }: { hv: SwoHubView; s: SwoShipmentView; run: Run }) => {
  const st = SHIP_STATUS[s.status]; const l = s.label;
  return <li data-testid={`shipment-${s.id}`} data-direction={s.direction} data-status={s.status} className={`rounded-sm border px-2 py-1.5 text-xs ${s.status === 'in_transit' ? 'border-sky-300 bg-sky-50/40' : 'border-line'}`}>
    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink">{s.direction === 'outbound' ? 'Outbound · shop → vendor' : 'Return · vendor → shop (prepaid)'}{s.redoN ? ` · redo ×${s.redoN}` : ''}</span>{l.international && <span className="rounded-sm bg-sky-50 px-1 text-[10px] font-semibold text-sky-800">INTL</span>}<span data-testid={`shipment-status-${s.id}`} className={`rounded-sm px-1 text-[10px] font-semibold ${st.cls}`}>{st.label}</span><span className="text-ink-500">ETA {fmtMD(s.eta)}</span><span className="ml-auto text-ink-400">{fmtMoneyCents(l.cost)}</span></div>
    <div className="font-mono text-ink-700">{l.carrier} {l.service} · <a data-testid={`shipment-tracking-${s.id}`} href={cz.trackingUrl(l.carrier, l.tracking)} target="_blank" rel="noreferrer" className="text-brand underline">{l.tracking}</a></div>
    <div className="text-[11px] text-ink-500">covers {s.lines.length} line{s.lines.length === 1 ? '' : 's'}: {s.lines.map(ticketOf).join(', ')}</div>
    {l.customs && <div className="text-[11px] text-ink-500">Customs: {l.customs.contents} · ${l.customs.value} · HS {l.customs.hsCode} · {l.customs.origin} · {l.customs.incoterm}</div>}
    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-400"><span>created {fmtDate(l.createdAt)} by {l.createdBy}{l.emailedAt ? ` · emailed to vendor` : ''}{s.deliveredAt ? ` · delivered ${fmtDate(s.deliveredAt)}` : ''}</span>
      {!s.deliveredAt && <Button size="sm" variant="ghost" data-testid={`shipment-deliver-${s.id}`} onClick={() => void run(() => api.simulateShipmentDelivered(hv.id, s.id), s.direction === 'outbound' ? `Carrier: delivered to ${hv.vendor.name} — ${s.lines.length} line${s.lines.length === 1 ? '' : 's'} → In progress` : 'Carrier: return delivered — Received lit, arrival scan pending')}>Simulate carrier: delivered</Button>}
      {s.arrivalPending && <span data-testid={`shipment-arrival-pending-${s.id}`} className="rounded-sm bg-amber-50 px-1 font-semibold text-amber-900 ring-1 ring-amber-300">Received lit — arrival scan pending · scan the box or receive each line</span>}
    </div>
  </li>;
};

const LineRow = ({ w, checked, onToggle, inQueue, setModal, run }: { w: SwoWithRefs; checked: boolean; onToggle: () => void; inQueue: boolean; setModal: (m: ModalState) => void; run: Run }) => {
  const h = cz.swoHealth(w); const days = api.swoDaysAtStage(w); const canReceive = api.swoReceivable(w);
  return <tr data-testid={`hub-line-${w.id}`} data-stage={w.stage} data-selected={checked} className={`border-b border-line/60 ${checked ? 'bg-brand-50/60' : 'hover:bg-canvas/60'} ${w.stage === 'fulfilled' ? 'opacity-60' : ''}`}>
    <td className="px-2 py-1.5"><input type="checkbox" data-testid={`hub-line-check-${w.id}`} checked={checked} onChange={onToggle} aria-label={`Select ${ticketOf(w)}`} /></td>
    <td className="px-2 py-1.5 font-mono font-semibold">{w.synth ? <span className="text-ink">{ticketOf(w)}</span> : <Link to={`/jobs/${w.jobId}`} data-testid={`hub-line-job-${w.id}`} className="text-brand hover:underline">{ticketOf(w)}</Link>}</td>
    <td className="px-2 py-1.5 text-ink"><div>{w.clientName}</div><div className="text-[11px] text-ink-500">{w.watchLabel}</div></td>
    <td className="px-2 py-1.5 text-ink-700">{w.components.map((c) => COMP_LABEL[c] ?? c).join(' + ')}<div className="text-[11px] text-ink-500">{w.work}</div></td>
    <td className="px-2 py-1.5"><LineParts w={w} /></td>
    <td className="px-2 py-1.5"><StageChip stage={w.stage} testId={`hub-line-stage-${w.id}`} /><div className={`mt-0.5 font-mono text-[10px] ${days >= 7 ? 'text-rose-700' : days >= 3 ? 'text-amber-700' : 'text-ink-400'}`}>{days}d at stage</div></td>
    <td className="px-2 py-1.5"><span data-testid={`hub-line-health-${w.id}`} className={`rounded-sm px-1 text-[10px] font-semibold ${HEALTH_TONE[h.tone]}`}>{h.label}</span>{w.redoCycles.length > 0 && <span className="ml-1 rounded-sm bg-amber-50 px-1 text-[10px] font-semibold uppercase text-amber-800">redo ×{w.redoCycles.length}</span>}</td>
    <td className="px-2 py-1.5"><div className="flex flex-wrap justify-end gap-1">
      {canReceive && <Button size="sm" variant="primary" data-testid={`hub-line-receive-${w.id}`} onClick={() => setModal({ kind: 'receive', line: w })}>Receive…</Button>}
      {inQueue && w.stage === 'queue' && <><Button size="sm" variant="ghost" data-testid={`hub-line-move-${w.id}`} onClick={() => setModal({ kind: 'move', line: w })}>Move to…</Button><Button size="sm" variant="ghost" data-testid={`hub-line-remove-${w.id}`} onClick={() => void run(() => api.removeSwoLine(w.id), `${ticketOf(w)} removed from the box`)}>Remove</Button></>}
    </div></td>
  </tr>;
};

const MoveToModal = ({ hv, line, onClose, run }: { hv: SwoHubView; line: SwoWithRefs; onClose: () => void; run: Run }) => {
  const others = api.openHubsForVendor(hv.vendorId).filter((h) => h.id !== hv.id); const [code, setCode] = useState(others[0]?.number ?? '');
  return <Mini testId="hub-move-modal" title={`Move ${ticketOf(line)} to another ${hv.vendor.name} box`} ok="Move line" disabled={!code.trim()} onClose={onClose} onOk={() => { onClose(); void run(() => api.moveLineToHub(line.id, code), `${ticketOf(line)} moved to ${code.toUpperCase()}`); }}>
    <div className="space-y-2 text-xs text-ink-500">
      {others.length > 0 && <div className="flex flex-wrap gap-1">{others.map((h) => <button key={h.id} type="button" data-testid={`hub-move-pick-${h.id}`} onClick={() => setCode(h.number)} className={`rounded-sm border px-2 py-1 font-mono ${code === h.number ? 'border-ink bg-ink text-white' : 'border-line bg-surface'}`}>{h.number} · {h.total} line{h.total === 1 ? '' : 's'}</button>)}</div>}
      <label className="block">Or scan / type the box<input data-testid="hub-move-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SWO1005" className={`${field} mt-1 w-full font-mono`} /></label>
      <p className="text-[11px]">Only while both boxes are In queue and going to the same vendor.</p>
    </div>
  </Mini>;
};

const PrintModal = ({ hv, onClose, run }: { hv: SwoHubView; onClose: () => void; run: Run }) => <Modal testId="hub-print-modal" title={`${hv.number} · label + packing list`} width="w-[520px]" onClose={onClose}>
  <div className="space-y-3 p-4 text-xs">
    <div data-testid="hub-print-preview" className="rounded-sm border border-line bg-white p-3 text-black">
      <div className="flex items-start justify-between gap-3"><div><div className="text-lg font-bold tracking-tight">{hv.number}</div><div className="text-sm">{hv.vendor.name}{hv.vendor.location ? ` · ${hv.vendor.location}` : ''}</div><div className="text-[11px]">point person {hv.pointPerson} · expected {hv.predictedCompletion ? fmtMD(hv.predictedCompletion) : '—'} · {hv.total} line{hv.total === 1 ? '' : 's'}</div></div><Code128 value={hv.barcode} height={44} scale={2} /></div>
      <table className="mt-2 w-full text-[11px]"><thead><tr className="border-b border-black/30 text-left"><th className="py-0.5">Ticket</th><th className="py-0.5">Client</th><th className="py-0.5">Sent</th><th className="py-0.5">Work</th></tr></thead><tbody>{hv.lines.map((l) => <tr key={l.id} className="border-b border-black/10"><td className="py-0.5 font-mono font-semibold">{ticketOf(l)}</td><td className="py-0.5">{l.clientName}</td><td className="py-0.5">{api.sentSummary(l.sentParts) || l.components.join(' / ')}</td><td className="py-0.5">{l.work}</td></tr>)}</tbody></table>
    </div>
    <div className="flex items-center justify-end gap-2"><span className="mr-auto text-[11px] text-ink-400">{hv.printedAt ? `last printed ${fmtDate(hv.printedAt)}` : 'not printed yet'}</span><Button size="sm" onClick={onClose}>Close</Button><Button size="sm" variant="primary" data-testid="hub-print-go" onClick={() => { onClose(); void run(() => api.printSwoLabel(hv.id), `${hv.number} label + packing list → Zebra (mock) · ${hv.total} line${hv.total === 1 ? '' : 's'}`); }}><Printer size={12} /> Print</Button></div>
  </div>
</Modal>;

// /swo/:id — the box: header with barcode, LINES with checkboxes, selection actions, shipments, invoices, comms, notes, timeline
export default function SwoHubPage() {
  const { id = '' } = useParams(); const base = useSwoBase();
  const [hv, setHv] = useState<SwoHubView | null | undefined>(undefined); const [sel, setSel] = useState<Set<string>>(new Set()); const [modal, setModal] = useState<ModalState>(null);
  const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [t, setT] = useState(''); const [d, setD] = useState(''); const [pp, setPp] = useState(''); const [note, setNote] = useState('');
  const [customs, setCustoms] = useState({ contents: '', value: '', hsCode: '9111.20', origin: 'CH', incoterm: 'DAP' as 'DAP' | 'DDP' });
  const load = useCallback(async () => { const h = await api.getSwoHub(id); setHv(h); if (h) setPp(h.pointPerson); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const flash = (m: string) => { setMsg(m); setError(null); window.setTimeout(() => setMsg(null), 4500); };
  const run: Run = async (fn, m) => { try { setError(null); await fn(); await load(); flash(m); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const close = () => { setModal(null); setT(''); setD(''); };
  if (hv === undefined) return null;
  if (!hv) return <div data-testid="hub-not-found" className="text-sm text-ink-500">No SWO matches “{id}”. <Link to={base} className="underline">All boxes</Link></div>;
  const lines = hv.lines; const ids = lines.filter((l) => sel.has(l.id)).map((l) => l.id); const selLines = lines.filter((l) => sel.has(l.id));
  const inQueue = hv.stage === 'queue'; const ships = hv.vendor.ships !== false; const first = lines[0]; const openLine = lines.find((l) => l.stage !== 'fulfilled') ?? first;
  const allQueue = selLines.length > 0 && selLines.every((l) => l.stage === 'queue'); const allOut = selLines.length > 0 && selLines.every((l) => OUT.includes(api.baseStage(l.stage)));
  const toggle = (lid: string) => setSel((s) => { const n = new Set(s); if (n.has(lid)) n.delete(lid); else n.add(lid); return n; });
  const toggleAll = () => setSel((s) => (s.size === lines.length ? new Set() : new Set(lines.map((l) => l.id))));
  const move = async (dir: 'forward' | 'back', reason?: string) => { try { setError(null); const r = await api.moveSwoLines(ids, dir, reason); await load(); setSel(new Set(r.refused.map((x) => x.lineId))); flash(moveMsg(r, dir === 'forward' ? 'moved forward' : 'moved back')); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const outbound = (c?: typeof customs) => run(async () => { await api.createHubShipment(hv.id, 'outbound', ids, c ? { contents: c.contents || undefined, value: c.value ? Number(c.value) : undefined, hsCode: c.hsCode, origin: c.origin, incoterm: c.incoterm } : undefined); await api.createHubShipment(hv.id, 'return', ids); setSel(new Set()); }, `Outbound label for ${ids.length} line${ids.length === 1 ? '' : 's'} · return label queued · vendor emailed · custody → ${hv.vendor.name}`);
  return <div data-testid="swo-hub-page" data-hub={hv.id} data-stage={hv.stage} className="space-y-4">
    <div className="flex items-center gap-3 text-xs"><Link to={base} data-testid="hub-back" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Shop Work Orders</Link><Link to="/concierge" className="text-ink-500 hover:text-ink">Concierge board</Link></div>
    <section data-testid="hub-header" className="rounded-md bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-4">
        <Code128 value={hv.barcode} height={40} scale={1.8} testId="hub-barcode" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 data-testid="hub-number" className="font-mono text-xl font-semibold tracking-tight text-ink">{hv.number}</h1><HubChips hv={hv} /></div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span>Vendor <Link to={`/purchasing/vendors/${hv.vendor.id}`} data-testid="hub-vendor" className="font-semibold text-ink hover:underline">{hv.vendor.name}</Link>{hv.vendor.location ? ` · ${hv.vendor.location}` : ''}{ships ? '' : ' · hand-off, no shipping'}</span>
            <span>Point person <b data-testid="hub-point" className="text-ink">{hv.pointPerson}</b></span>
            <span>Expected <b data-testid="hub-expected" className="text-ink">{hv.predictedCompletion ? fmtDate(hv.predictedCompletion) : '—'}</b></span>
            <span>Opened {fmtDate(hv.createdAt)} by {hv.createdBy}</span>
            {hv.printedAt ? <span data-testid="hub-printed">label printed {fmtDate(hv.printedAt)}</span> : <span data-testid="hub-unprinted" className="text-amber-800">label not printed</span>}
          </div>
          {hv.notes && <div className="mt-1 text-xs text-ink-600">{hv.notes}</div>}
          {hv.sentSummary && <div data-testid="hub-sent-summary" className="mt-1 text-xs text-ink-500">In the box: {hv.sentSummary}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {inQueue && <Button size="sm" variant="primary" data-testid="hub-add-line" onClick={() => setModal({ kind: 'add' })}><Plus size={12} /> Add line</Button>}
          <Button size="sm" data-testid="hub-print" onClick={() => setModal({ kind: 'print' })}><Printer size={12} /> Print label + packing list</Button>
          <Button size="sm" variant="ghost" data-testid="hub-edit" onClick={() => setModal({ kind: 'edit' })}><Pencil size={12} /> Expected / point person</Button>
        </div>
      </div>
    </section>
    <Flash msg={msg} error={error} />
    <Card title="Lines" subtitle={`${hv.total} ticket${hv.total === 1 ? '' : 's'} in this box · tick lines, then move them together · labels follow the selection`} testId="hub-lines-card" action={sel.size > 0 ? <span data-testid="hub-sel-count" className="text-xs font-semibold text-ink">{ids.length} selected</span> : undefined}>
      <div className="-mx-4 -mt-2 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-2 py-1.5"><input type="checkbox" data-testid="hub-line-check-all" checked={lines.length > 0 && sel.size === lines.length} onChange={toggleAll} aria-label="Select all lines" /></th><th className="px-2 py-1.5">Ticket</th><th className="px-2 py-1.5">Client · watch</th><th className="px-2 py-1.5">Component · work</th><th className="px-2 py-1.5">Sent</th><th className="px-2 py-1.5">Stage</th><th className="px-2 py-1.5">Health</th><th className="px-2 py-1.5" /></tr></thead>
        <tbody>{lines.map((w) => <LineRow key={w.id} w={w} checked={sel.has(w.id)} onToggle={() => toggle(w.id)} inQueue={inQueue} setModal={setModal} run={run} />)}{!lines.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-ink-400">Empty box — Add line (scan a ticket) to start the packing list.</td></tr>}</tbody></table></div>
      {ids.length > 0 && <div data-testid="hub-sel-bar" className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-brand-100 bg-brand-50/50 p-2 text-xs">
        <span className="font-semibold text-ink">{ids.length} line{ids.length === 1 ? '' : 's'} selected</span>
        <Button size="sm" variant="primary" data-testid="hub-sel-forward" onClick={() => void move('forward')}>Forward <ArrowRight size={12} /></Button>
        <Button size="sm" data-testid="hub-sel-back" onClick={() => setModal({ kind: 'back' })}><Undo2 size={12} /> Back…</Button>
        {ships && allQueue && <Button size="sm" data-testid="hub-sel-outbound" onClick={() => (hv.international ? setModal({ kind: 'customs' }) : void outbound())}><Truck size={12} /> Outbound label for selection{hv.international ? ' (customs)' : ''}</Button>}
        {ships && allOut && <Button size="sm" data-testid="hub-sel-return" onClick={() => void run(() => api.createHubShipment(hv.id, 'return', ids), `Return label queued for ${ids.length} line${ids.length === 1 ? '' : 's'} · emailed to ${hv.vendor.name}`)}><Mail size={12} /> Return label for selection</Button>}
        <button type="button" data-testid="hub-sel-clear" onClick={() => setSel(new Set())} className="ml-auto text-[11px] text-ink-500 hover:underline">clear</button>
      </div>}
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      {ships && <Card title="Shipments" subtitle="one label per batch that travelled together · outbound = custody → vendor · return = prepaid, queued in advance" testId="hub-shipments-card">
        <ul className="space-y-2">{hv.shipmentViews.map((s) => <ShipmentRow key={s.id} hv={hv} s={s} run={run} />)}{!hv.shipmentViews.length && <li className="text-xs text-ink-400">No labels yet — select the lines that go in the box and create the outbound label (or pack it on the Assign map).</li>}</ul>
      </Card>}
      {ships && first && <Card title="Vendor invoices" subtitle="one bill per box · Mark paid needs method + our reference · QBO stub" testId="hub-invoices-card">
        <VendorInvoicesPanel w={first} run={run} />
        <div data-testid="hub-qbo" className={`mt-1 text-[11px] ${cz.qboState(first).tone === 'ok' ? 'text-moss-700' : cz.qboState(first).tone === 'warn' ? 'font-semibold text-rose-700' : 'text-ink-400'}`}>QuickBooks: {cz.qboState(first).text}</div>
      </Card>}
      <Card title="Comms" subtitle="status requests · vendor replies · redo cycles — per box" testId="hub-comms-card" action={openLine ? <div className="flex gap-1"><Button size="sm" data-testid="hub-status-request" onClick={() => void run(() => cz.sendVendorStatusRequest(openLine.id), `Status request emailed to ${hv.vendor.name}`)}><Mail size={12} /> Status request</Button><Button size="sm" data-testid="hub-vendor-reply" onClick={() => setModal({ kind: 'reply' })}>Vendor reply</Button></div> : undefined}>
        <div className="space-y-2 text-xs">
          {hv.redoCycles.length > 0 && <ul data-testid="hub-redo-list" className="space-y-0.5">{hv.redoCycles.map((r) => <li key={r.n} className="rounded-sm bg-amber-50 px-2 py-1 text-amber-900"><b>Redo ×{r.n}</b> · {fmtDate(r.startedAt)} · {r.by} — {r.reason}</li>)}</ul>}
          <ul data-testid="hub-replies" className="space-y-0.5">{hv.vendorReplies.map((r, i) => <li key={i} className="flex gap-2"><span className="w-20 shrink-0 text-ink-400">{fmtDate(r.at)}</span><span className="w-14 shrink-0 font-medium">{r.by}</span><span>“{r.text}”{r.newExpectedAt ? ` · new date ${r.newExpectedAt}` : ''}</span></li>)}{!hv.vendorReplies.length && <li className="text-ink-400">No vendor replies logged.</li>}</ul>
          <ul data-testid="hub-status-requests" className="space-y-0.5">{hv.statusRequests.map((r, i) => <li key={i} className="flex gap-2 text-ink-500"><span className="w-20 shrink-0 text-ink-400">{fmtDate(r.at)}</span><span className="w-14 shrink-0 font-medium">{r.by}</span><span>status request sent{r.level !== '0' ? ` · escalation L${r.level}` : ''}</span></li>)}</ul>
        </div>
      </Card>
      <Card title="Internal notes" subtitle="@Name pins it to their hit list" testId="hub-notes-card">
        <div className="flex gap-1 text-xs"><input data-testid="hub-note-input" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { e.preventDefault(); void run(() => api.addSwoNote(hv.id, note), 'Note added'); setNote(''); } }} placeholder="e.g. @Vienna chase the clasp on Friday" className={`${field} flex-1`} /><Button size="sm" data-testid="hub-note-add" disabled={!note.trim()} onClick={() => { void run(() => api.addSwoNote(hv.id, note), 'Note added'); setNote(''); }}>Add</Button></div>
        <ul data-testid="hub-notes" className="mt-2 space-y-1 text-xs">{hv.internalNotes.map((n, i) => <li key={i} className="flex gap-2"><span className="w-20 shrink-0 text-ink-400">{fmtDate(n.at)}</span><span className="w-14 shrink-0 font-medium">{n.by}</span><span>{n.text}</span></li>)}{!hv.internalNotes.length && <li className="text-ink-400">No notes.</li>}</ul>
      </Card>
    </div>
    <Card title="Timeline" subtitle="every event on this box · [ticket] prefix = one line" testId="hub-timeline-card">
      <ul data-testid="hub-timeline" className="max-h-72 space-y-0.5 overflow-y-auto text-xs">{hv.timeline.map((x, i) => <li key={i} className="flex gap-2"><span className="w-24 shrink-0 text-ink-400">{fmtDate(x.at)}</span><span className="w-16 shrink-0 font-medium">{x.by}</span><span>{x.text}</span></li>)}</ul>
    </Card>
    {modal?.kind === 'add' && <AddLineModal hub={hv} onClose={close} onSaved={(m) => { close(); void run(async () => undefined, m); }} />}
    {modal?.kind === 'receive' && <ReceiveModal line={modal.line} onClose={close} onDone={(m) => { close(); void run(async () => undefined, m); }} />}
    {modal?.kind === 'move' && <MoveToModal hv={hv} line={modal.line} onClose={close} run={run} />}
    {modal?.kind === 'print' && <PrintModal hv={hv} onClose={close} run={run} />}
    {modal?.kind === 'back' && <Mini testId="hub-back-modal" title={`Move ${ids.length} line${ids.length === 1 ? '' : 's'} back one stage`} ok="Move back" disabled={!t.trim()} onClose={close} onOk={() => { const r = t; close(); void move('back', r); }}><label className="block text-xs text-ink-500">Reason (required · one reason for the batch)<input autoFocus data-testid="hub-back-reason" value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label></Mini>}
    {modal?.kind === 'edit' && <Mini testId="hub-edit-modal" title={`${hv.number} · expected date & point person`} ok="Save" onClose={close} onOk={() => { const patch = { predictedCompletion: d || undefined, pointPerson: pp || undefined, reason: t || undefined }; close(); void run(() => api.updateSwoHub(hv.id, patch), `${hv.number} updated — every line follows`); }}><div className="grid grid-cols-2 gap-2 text-xs text-ink-500"><label>Expected completion<input type="date" data-testid="hub-edit-date" defaultValue={hv.predictedCompletion ?? ''} onChange={(e) => setD(e.target.value)} className={`${field} mt-1 w-full`} /></label><label>Point person<select data-testid="hub-edit-point" value={pp} onChange={(e) => setPp(e.target.value)} className={`${field} mt-1 w-full`}>{cz.conciergeStaff().map((u) => <option key={u.id} value={u.shortName}>{u.shortName} · {u.dutyLabel}</option>)}</select></label><label className="col-span-2">Reason (logged)<input data-testid="hub-edit-reason" value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label></div></Mini>}
    {modal?.kind === 'reply' && openLine && <Mini testId="hub-reply-modal" title={`Vendor reply · ${hv.vendor.name}`} ok="Log reply" disabled={!t.trim()} onClose={close} onOk={() => { const text = t; const date = d; close(); void run(() => cz.logVendorReply(openLine.id, text, date || undefined), `Vendor reply logged${date ? ` · new date ${date}` : ''}`); }}><div className="space-y-2 text-xs text-ink-500"><label className="block">What they said *<textarea autoFocus data-testid="hub-reply-text" rows={2} value={t} onChange={(e) => setT(e.target.value)} className={`${field} mt-1 w-full`} /></label><label className="block">New promised date (resets at-risk / delayed)<input type="date" data-testid="hub-reply-date" value={d} onChange={(e) => setD(e.target.value)} className={`${field} mt-1 w-full`} /></label></div></Mini>}
    {modal?.kind === 'customs' && <Mini testId="hub-customs-modal" title={`Customs — ${hv.vendor.name} (${hv.vendor.country})`} ok="Create outbound label" disabled={!customs.hsCode} onClose={close} onOk={() => { const c = customs; close(); void outbound(c); }}><div className="grid grid-cols-2 gap-2 text-xs text-ink-500"><label className="col-span-2">Contents<input data-testid="hub-customs-contents" placeholder="defaults to the components + repair & return" value={customs.contents} onChange={(e) => setCustoms({ ...customs, contents: e.target.value })} className={`${field} mt-1 w-full`} /></label><label>Value $<input data-testid="hub-customs-value" type="number" placeholder="defaults from the watch" value={customs.value} onChange={(e) => setCustoms({ ...customs, value: e.target.value })} className={`${field} mt-1 w-full`} /></label><label>HS code<input value={customs.hsCode} onChange={(e) => setCustoms({ ...customs, hsCode: e.target.value })} className={`${field} mt-1 w-full`} /></label><label>Origin<input value={customs.origin} onChange={(e) => setCustoms({ ...customs, origin: e.target.value })} className={`${field} mt-1 w-full`} /></label><label>Incoterm<select value={customs.incoterm} onChange={(e) => setCustoms({ ...customs, incoterm: e.target.value as 'DAP' | 'DDP' })} className={`${field} mt-1 w-full`}><option>DAP</option><option>DDP</option></select></label></div></Mini>}
  </div>;
}
