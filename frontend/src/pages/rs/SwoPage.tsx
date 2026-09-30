import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ComponentKey, SwoHubView, SwoInput, Vendor } from '@/api/client';
import { Code128, COMPONENTS, SentPartsPicker, StageChip, useSwoBase, type SentPartInput } from '@/components/concierge/SwoBits';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate } from '@/lib/format';

// NEW SWO — one name everywhere (Concierge header, job page, pads). Vendor · point person · expected date → the box exists at In queue.
// With a ticket in hand (job page / pad) the first line goes in at the same time: component · work · tick what physically goes in the box — or drop it into a box already open for that vendor.
export function SwoForm({ init, onClose, onSaved }: { init: Partial<SwoInput>; onClose: () => void; onSaved: (m: string, hubId: string) => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]); const [vendorId, setVendorId] = useState(init.vendorId ?? ''); const [pointPerson, setPointPerson] = useState(init.pointPerson ?? 'Chyna'); const [expected, setExpected] = useState(init.predictedCompletion ?? ''); const [notes, setNotes] = useState(init.notes ?? '');
  const [box, setBox] = useState('new'); const [components, setComponents] = useState<ComponentKey[]>(init.components ?? []); const [work, setWork] = useState(init.work ?? ''); const [parts, setParts] = useState<SentPartInput[]>([]); const [err, setErr] = useState<string | null>(null); const [job, setJob] = useState<{ number: string; client: string; watch: string } | null>(null);
  useEffect(() => { void api.getOutsourceVendors().then((v) => { setVendors(v); if (!vendorId && v[0]) setVendorId(v[0].id); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (init.jobId) void api.getSwoJobCandidates('').then((c) => setJob(c.find((x) => x.id === init.jobId) ?? null)); }, [init.jobId]);
  const v = vendors.find((x) => x.id === vendorId);
  useEffect(() => { if (v) { setExpected(api.defaultExpectedAt(v)); setBox('new'); setParts([]); } }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = v ? api.openHubsForVendor(v.id) : []; const staff = cz.conciergeStaff();
  const save = async () => {
    try {
      if (!v) throw new Error('Pick a vendor');
      let hub: SwoHubView = box === 'new' ? await api.createSwoHub({ vendorId: v.id, pointPerson, predictedCompletion: expected, notes: notes || undefined }) : (await api.getSwoHub(box))!;
      if (init.jobId) hub = await api.addSwoLine(hub.id, { jobId: init.jobId, components, work, sentParts: parts });
      onSaved(`${hub.number} · ${v.name}${init.jobId ? ` · ${job?.number.replace(/^E/, '') ?? 'ticket'} added (${hub.total} line${hub.total === 1 ? '' : 's'})` : ' opened — add tickets, print the label'}`, hub.id);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  const lineOk = !init.jobId || (components.length > 0 && work.trim().length > 0 && (parts.length > 0 || v?.id === 'v-cm'));
  return <Modal testId="swo-modal" title="New SWO" width="w-[640px]" onClose={onClose}>
    <div className="space-y-3 p-4 text-xs text-ink-500">
      {job && <div data-testid="swo-form-job" className="rounded-sm border border-line bg-canvas/60 px-2 py-1.5 text-ink"><span className="font-mono font-semibold">{job.number}</span> · {job.client} · {job.watch}</div>}
      <div className="grid grid-cols-2 gap-2">
        <label>Vendor (outsource work)<select data-testid="swo-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={`${field} mt-1 block w-full`}>{vendors.map((x) => <option key={x.id} value={x.id}>{x.name}{api.isInternationalVendor(x) ? ` (${x.country} · international)` : ''}</option>)}</select>{v && <span className="mt-0.5 block text-[11px]">{v.terms} · lead {v.leadTimeDays ?? '?'} d{v.ships === false ? ' · hand-off, no shipping' : api.isInternationalVendor(v) ? ' · customs on labels' : ''}</span>}</label>
        {init.jobId ? <label>Box<select data-testid="swo-box" value={box} onChange={(e) => setBox(e.target.value)} className={`${field} mt-1 block w-full`}><option value="new">New SWO (next number)</option>{open.map((h) => <option key={h.id} value={h.id}>{h.number} · {h.total} line{h.total === 1 ? '' : 's'} · In queue</option>)}</select><span className="mt-0.5 block text-[11px]">{open.length ? `${open.length} box${open.length === 1 ? '' : 'es'} still open for ${v?.name ?? 'this vendor'}` : 'no open box for this vendor'}</span></label> : <div className="rounded-sm border border-brand-100 bg-brand-50/40 p-2 text-[11px]">The box opens at <b>In queue</b> with its SWO1xxx barcode. Add tickets on the hub page (scan or look up), print the label + packing list, then pack it on the Assign map.</div>}
      </div>
      {box === 'new' && <div className="grid grid-cols-2 gap-2 rounded-sm border border-brand-100 bg-brand-50/40 p-2">
        <label>Expected completion <span className="text-rose-600">*</span><input type="date" data-testid="swo-form-predicted" value={expected} onChange={(e) => setExpected(e.target.value)} className={`${field} mt-1 block w-full`} />{v && <span className="mt-0.5 block text-[10px]">prefilled: {v.leadTimeDays ?? 10} d turnaround{v.ships === false ? '' : ` + ${api.shipDaysFor(v)} d shipping each way`}</span>}</label>
        <label>Point person <span className="text-rose-600">*</span><select data-testid="swo-form-point" value={pointPerson} onChange={(e) => setPointPerson(e.target.value)} className={`${field} mt-1 block w-full`}><option value="">— who chases this vendor job —</option>{staff.map((u) => <option key={u.id} value={u.shortName}>{u.shortName} · {u.dutyLabel}</option>)}</select></label>
        <label className="col-span-2">Notes<input data-testid="swo-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
      </div>}
      {init.jobId && <>
        <div>Component going out<div className="mt-1 flex gap-1">{COMPONENTS.map((c) => <button key={c.key} type="button" data-testid={`swo-comp-${c.key}`} aria-pressed={components.includes(c.key)} onClick={() => setComponents(components.includes(c.key) ? components.filter((k) => k !== c.key) : [...components, c.key])} className={`rounded-sm border px-2 py-1 ${components.includes(c.key) ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas'}`}>{c.label}</button>)}</div></div>
        <label className="block">Work to be done<textarea data-testid="swo-work" rows={2} value={work} onChange={(e) => setWork(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
        {v && v.id !== 'v-cm' && <SentPartsPicker presets={api.vendorPresets(v)} value={parts} onChange={setParts} testId="swo-parts" />}
      </>}
      {err && <div data-testid="swo-form-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="swo-save" disabled={!vendorId || (box === 'new' && (!expected || !pointPerson)) || !lineOk} onClick={() => void save()}>{box === 'new' ? 'Open SWO' : 'Add to box'}</Button></div>
    </div>
  </Modal>;
}

// /swo — every box, newest first: barcode · number · vendor · stage · lines · point person · expected · what's inside
export default function SwoListPage() {
  const nav = useNavigate(); const base = useSwoBase(); const [hubs, setHubs] = useState<SwoHubView[]>([]); const [q, setQ] = useState(''); const [openOnly, setOpenOnly] = useState(true); const [form, setForm] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void api.getSwoHubs().then(setHubs); }, []);
  const s = q.trim().toLowerCase().replace(/[\s-]/g, '');
  const rows = hubs.filter((h) => (!openOnly || h.stage !== 'fulfilled') && (!s || h.number.toLowerCase().includes(s) || h.vendor.name.toLowerCase().replace(/\s/g, '').includes(s) || h.lines.some((l) => l.jobNumber.toLowerCase().includes(s) || l.clientName.toLowerCase().replace(/\s/g, '').includes(s))));
  return <div data-testid="swo-list-page" className="space-y-4">
    <Head title="Shop Work Orders" sub={<>{hubs.filter((h) => h.stage !== 'fulfilled').length} open boxes · {hubs.length} total · one SWO = one box to one vendor, the lines inside are tickets · scan <span className="font-mono">SWO1xxx</span> anywhere to open it</>} action={<Button size="sm" variant="primary" data-testid="swo-new" onClick={() => setForm(true)}><Plus size={12} /> New SWO</Button>} />
    <Flash msg={msg} error={null} />
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="relative"><Search size={13} className="pointer-events-none absolute left-2 top-2 text-ink-400" /><input data-testid="swo-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SWO1004 · vendor · ticket · client" className={`${field} w-72 pl-7`} /></div>
      <button type="button" data-testid="swo-filter-open" aria-pressed={openOnly} onClick={() => setOpenOnly((o) => !o)} className={`rounded-full border px-2.5 py-1 font-medium ${openOnly ? 'border-ink bg-ink text-white' : 'border-line text-ink-500'}`}>{openOnly ? 'Open boxes' : 'All boxes'}</button>
      <span className="text-ink-400">{rows.length} shown</span>
    </div>
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table data-testid="swo-table" className="w-full text-xs"><thead><tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-3 py-2">Box</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Lines</th><th className="px-3 py-2">Point</th><th className="px-3 py-2">Expected</th><th className="px-3 py-2">In the box</th><th className="px-3 py-2">Opened</th></tr></thead>
        <tbody>{rows.map((h) => <tr key={h.id} data-testid={`swo-row-${h.id}`} onClick={() => nav(`${base}/${h.id}`)} className="cursor-pointer border-b border-line/60 hover:bg-canvas">
          <td className="px-3 py-1.5"><div className="flex items-center gap-2"><Code128 value={h.barcode} height={18} scale={1} caption={false} testId={`swo-row-barcode-${h.id}`} /><Link to={`${base}/${h.id}`} data-testid={`swo-row-link-${h.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-semibold text-brand hover:underline">{h.number}</Link></div></td>
          <td className="px-3 py-1.5 text-ink">{h.vendor.name}{h.international ? <span className="ml-1 rounded-sm bg-sky-50 px-1 text-[10px] font-semibold text-sky-800">INTL</span> : null}</td>
          <td className="px-3 py-1.5"><StageChip stage={h.stage} testId={`swo-row-stage-${h.id}`} />{h.paid && <span className="ml-1 rounded-sm bg-moss-50 px-1 text-[10px] font-semibold text-moss-800">PAID</span>}</td>
          <td className="px-3 py-1.5 font-mono text-ink">{h.open} open · {h.back} back / {h.total}</td>
          <td className="px-3 py-1.5">{h.pointPerson}</td>
          <td className="px-3 py-1.5">{h.predictedCompletion ? fmtDate(h.predictedCompletion) : '—'}</td>
          <td className="max-w-[260px] truncate px-3 py-1.5 text-ink-500" title={h.sentSummary}>{h.sentSummary || h.lines.map((l) => l.work).join(' · ')}</td>
          <td className="px-3 py-1.5 text-ink-400">{fmtDate(h.createdAt)} · {h.createdBy}</td>
        </tr>)}{!rows.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-ink-400">No boxes match.</td></tr>}</tbody></table>
    </div>
    {form && <SwoForm init={{}} onClose={() => setForm(false)} onSaved={(m, id) => { setForm(false); setMsg(m); nav(`${base}/${id}`); }} />}
  </div>;
}
