import { AlertTriangle, CheckCircle2, FileUp, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as ai from '@/api/ai';
import type { BillExtraction } from '@/api/ai';
import * as api from '@/api/client';
import type { BillAudit, BillAuditLine, BillBucket, BillLine } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtMoneyCents as fmtMoney } from '@/lib/format';

const BUCKET: Record<BillBucket, { label: string; tone: string; blurb: string }> = {
  voided_billed: { label: 'Billed but VOIDED', tone: 'bg-rose-100 text-rose-800', blurb: 'We cancelled this label and got charged anyway — refund money' },
  unknown: { label: 'Unknown tracking #', tone: 'bg-rose-100 text-rose-800', blurb: 'A charge for a label our records never created' },
  variance: { label: 'Price variance', tone: 'bg-amber-100 text-amber-800', blurb: 'Billed vs our recorded cost' },
  matched: { label: 'Matched', tone: 'bg-moss-50 text-moss-700', blurb: 'Price agrees within tolerance' },
  unbilled: { label: 'Ours, unbilled', tone: 'bg-canvas text-ink-500', blurb: 'Probably on the next bill' },
};
const REASONS = { accept: ['Legit surcharge (address correction)', 'Legit surcharge (fuel / insurance)', 'Service upgraded at drop-off', 'Rate change — update our table', 'Other'], dispute: ['Label voided before pickup', 'Never created by us', 'Overbilled vs quoted rate', 'Duplicate charge', 'Other'] };

// Manager tier (dollars). Upload → parsed lines for a human eye (correctable) → match → buckets → Accept / Dispute → dispute report via Outbox template
export default function BillAuditPage() {
  const [audits, setAudits] = useState<BillAudit[]>([]); const [open, setOpen] = useState<BillAudit | null>(null); const [parsed, setParsed] = useState<BillExtraction | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const reload = () => api.getBillAudits().then((a) => { setAudits(a); if (open) setOpen(a.find((x) => x.id === open.id) ?? null); });
  useEffect(() => { void api.getBillAudits().then(setAudits); }, []);
  const run = async (fn: () => Promise<unknown>, m?: string) => { setError(null); try { await fn(); await reload(); if (m) { setMsg(m); setTimeout(() => setMsg(null), 2500); } } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const upload = async (f: File) => { setBusy(true); setError(null); try { setParsed(await ai.extractShippingBill(f)); } catch (e) { setError(e instanceof Error ? e.message : 'Extraction failed'); } finally { setBusy(false); } };
  const loadMock = () => setParsed({ lines: api.parseBillCsv(api.MOCK_BILL_CSV, 'UPS'), source: 'csv', fileName: api.MOCK_BILL_FILENAME });
  const match = () => parsed && run(async () => { const b = await api.createBillAudit(parsed.lines, parsed.fileName); setParsed(null); setOpen(b); }, 'Matched against the label ledger');
  return <div data-testid="bill-audit-page" className="space-y-4">
    <Head title="Shipping bill audit" sub={<>Carrier / Parcel Pro invoice vs every label we generated · matched by tracking # · Accept / Dispute · dispute letter via Outbox <Provisional note="Parcel Pro bill is a MOCK; PDF/image bills go to Claude (suggest → verify), CSV parses locally" /></>} action={<label className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-canvas"><FileUp size={13} /> Upload bill (PDF / CSV)<input data-testid="bill-upload" type="file" accept=".pdf,.csv,.txt,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} /></label>} />
    <Flash error={error} msg={msg} />
    {busy && <div data-testid="bill-extracting" className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><Sparkles size={13} className="animate-pulse" /> Claude is reading the bill…</div>}
    {parsed && <ParsedLines x={parsed} onChange={setParsed} onCancel={() => setParsed(null)} onMatch={match} />}
    <div className="grid grid-cols-[300px_1fr] gap-4">
      <Card title="Audit sessions" subtitle="append-only · who / when" testId="bill-sessions" bodyClassName="p-0" action={<Button size="sm" data-testid="bill-load-mock" onClick={loadMock}>Load mock bill</Button>}>
        <ul className="divide-y divide-line/70 text-xs">{audits.map((b) => <li key={b.id}><button data-testid={`bill-session-${b.id}`} onClick={() => setOpen(b)} className={`w-full px-3 py-2 text-left hover:bg-canvas ${open?.id === b.id ? 'bg-canvas' : ''}`}><div className="flex justify-between"><span className="font-mono font-semibold">{b.number}</span><span className="text-ink-500">{fmtDate(b.uploadedAt)}</span></div><div className="text-ink-500">{b.fileName} · {b.by} · {fmtMoney(b.totals.billed)} billed</div></button></li>)}{!audits.length && <li className="px-3 py-4 text-center text-ink-400">No audits yet — upload a bill or load the mock.</li>}</ul>
      </Card>
      {open ? <AuditView b={open} run={run} /> : <Card title="Pick a session" testId="bill-empty"><p className="text-xs text-ink-500">Upload the carrier bill or load the seeded mock bill to start.</p></Card>}
    </div>
  </div>;
}

function ParsedLines({ x, onChange, onCancel, onMatch }: { x: BillExtraction; onChange: (x: BillExtraction) => void; onCancel: () => void; onMatch: () => void }) {
  const set = (i: number, patch: Partial<BillLine>) => onChange({ ...x, lines: x.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  return <Card title={`Step 1 · verify ${x.lines.length} parsed lines`} subtitle={`${x.fileName} · ${x.source === 'claude' ? `read by Claude${x.confidence != null ? ` · confidence ${Math.round(x.confidence * 100)}%` : ''}` : 'CSV parsed locally'} — fix anything obviously wrong, then match`} testId="bill-parsed" action={<div className="flex gap-2"><Button size="sm" data-testid="bill-parsed-cancel" onClick={onCancel}>Discard</Button><Button size="sm" variant="primary" data-testid="bill-parsed-match" disabled={!x.lines.length} onClick={onMatch}><CheckCircle2 size={12} /> Looks right — match</Button></div>}>
    <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase text-ink-400"><th>Tracking #</th><th>Ship date</th><th>Service</th><th className="text-right">Billed</th><th>Surcharges</th><th className="text-right">Declared</th></tr></thead><tbody>
      {x.lines.map((l, i) => <tr key={l.id} data-testid={`bill-parsed-${l.id}`} className="border-t border-line"><td><input data-testid={`bill-parsed-tracking-${l.id}`} value={l.trackingNumber} onChange={(e) => set(i, { trackingNumber: e.target.value })} className={`${field} w-48 font-mono`} /></td><td><input value={l.shipDate} onChange={(e) => set(i, { shipDate: e.target.value })} className={`${field} w-28`} /></td><td><input value={l.service} onChange={(e) => set(i, { service: e.target.value })} className={`${field} w-44`} /></td><td className="text-right"><input data-testid={`bill-parsed-billed-${l.id}`} type="number" step="0.01" value={l.billed} onChange={(e) => set(i, { billed: Number(e.target.value) })} className={`${field} w-24 text-right`} /></td><td className="text-ink-500">{l.surcharges.map((s) => `${s.kind} ${fmtMoney(s.amount)}`).join(' · ') || '—'}</td><td className="text-right tabular">{l.declaredValue != null ? fmtMoney(l.declaredValue) : '—'}</td></tr>)}
      {!x.lines.length && <tr><td colSpan={6} className="py-3 text-center text-ink-500">No lines found in this file.</td></tr>}
    </tbody></table>
  </Card>;
}

function AuditView({ b, run }: { b: BillAudit; run: (fn: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const [showMatched, setShowMatched] = useState(false); const [dispute, setDispute] = useState<{ subject: string; body: string; to: string; disputed: number; count: number } | null>(null); const [credit, setCredit] = useState('');
  const flagged = b.lines.filter((l) => l.bucket !== 'matched' && l.bucket !== 'unbilled'); const matched = b.lines.filter((l) => l.bucket === 'matched'); const unbilled = b.lines.filter((l) => l.bucket === 'unbilled');
  const t = b.totals;
  return <div className="space-y-3">
    <div data-testid="bill-summary" className="grid grid-cols-5 gap-2">{[['Total billed', fmtMoney(t.billed), 'billed'], ['Matched clean', `${t.matchedClean} lines`, 'matched'], ['Variance', fmtMoney(t.variance), 'variance'], ['Disputed', fmtMoney(t.disputed), 'disputed'], ['Recovered to date', fmtMoney(t.recovered), 'recovered']].map(([k, v, id]) => <div key={k} data-testid={`bill-total-${id}`} className="rounded-md border border-line bg-surface px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-ink-400">{k}</div><div className="text-base font-semibold text-ink">{v}</div></div>)}</div>
    <Card title={`${b.number} · ${b.vendor} · ${b.fileName}`} subtitle={`uploaded ${fmtDate(b.uploadedAt)} by ${b.by} · ${b.station}`} testId="bill-audit" bodyClassName="p-0" action={<div className="flex items-center gap-2">{b.disputeSentAt ? <span data-testid="bill-dispute-sent" className="text-[11px] text-moss-700">Dispute report sent {fmtDate(b.disputeSentAt)} → <Link to="/intake" className="underline">Outbox</Link></span> : <Button size="sm" variant="primary" data-testid="bill-generate-dispute" onClick={() => run(async () => setDispute(await api.draftDisputeReport(b.id)))}>Generate dispute report</Button>}<input data-testid="bill-credit-amount" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="credit $" className={`${field} w-20`} /><Button size="sm" data-testid="bill-credit-save" onClick={() => run(async () => { await api.markBillRecovered(b.id, Number(credit)); setCredit(''); }, 'Credit recorded')}>Recovered</Button></div>}>
      <ul className="divide-y divide-line/70">
        {flagged.map((l) => <FlaggedLine key={l.id} b={b} l={l} run={run} />)}
        {!flagged.length && <li className="px-3 py-3 text-center text-xs text-moss-700">Nothing flagged — the bill agrees with our records.</li>}
        <li className="px-3 py-2 text-xs"><button data-testid="bill-matched-toggle" onClick={() => setShowMatched(!showMatched)} className="inline-flex items-center gap-1 text-moss-700 hover:underline"><CheckCircle2 size={12} /> {matched.length} matched, price agrees {showMatched ? '▾' : '▸'}</button>
          {showMatched && <ul data-testid="bill-matched-list" className="mt-1 space-y-0.5 text-ink-500">{matched.map((l) => <li key={l.id} data-testid={`bill-line-${l.id}`}>{l.bill!.trackingNumber} · {l.label!.ref} · {fmtMoney(l.bill!.billed)}</li>)}</ul>}</li>
        {unbilled.length > 0 && <li className="px-3 py-2 text-xs text-ink-500"><span className="font-semibold text-ink-600">{unbilled.length} ours, not on this bill</span> (probably next bill): {unbilled.map((l) => <span key={l.id} data-testid={`bill-line-${l.id}`} className="ml-1 font-mono">{l.label!.trackingNumber} ({l.label!.ref} · {fmtMoney(l.label!.cost)})</span>)}</li>}
      </ul>
    </Card>
    <Card title="Session log" testId="bill-events" bodyClassName="p-0"><ul className="divide-y divide-line/70 text-xs">{b.events.map((e, i) => <li key={i} className="flex gap-2 px-3 py-1.5"><span className="font-mono text-ink-400">{fmtDate(e.at)}</span><b>{e.by}</b><span className="text-ink-600">{e.text}</span></li>)}</ul></Card>
    {dispute && <Modal testId="bill-dispute-modal" title={`Dispute report · ${dispute.count} line(s) · ${fmtMoney(dispute.disputed)}`} width="w-[720px]" onClose={() => setDispute(null)}>
      <p className="mb-2 text-[11px] text-ink-500">Template <span className="font-mono">shipping_dispute</span> rendered with this bill — edit before it goes to the Outbox (point-of-use, this send only). To: {dispute.to}</p>
      <input data-testid="bill-dispute-subject" value={dispute.subject} onChange={(e) => setDispute({ ...dispute, subject: e.target.value })} className={`${field} mb-2 w-full`} />
      <textarea data-testid="bill-dispute-body" rows={14} value={dispute.body} onChange={(e) => setDispute({ ...dispute, body: e.target.value })} className={`${field} w-full font-mono text-[11px]`} />
      <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setDispute(null)}>Cancel</Button><Button variant="primary" data-testid="bill-dispute-send" onClick={() => run(async () => { await api.sendDisputeReport(b.id, dispute.subject, dispute.body); setDispute(null); }, 'Dispute report queued to Outbox')}>Send to Outbox</Button></div>
    </Modal>}
  </div>;
}

function FlaggedLine({ b, l, run }: { b: BillAudit; l: BillAuditLine; run: (fn: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const [mode, setMode] = useState<'accept' | 'dispute' | null>(null); const [reason, setReason] = useState('');
  const meta = BUCKET[l.bucket]; const amount = l.bucket === 'unknown' ? l.bill!.billed : l.delta;
  return <li data-testid={`bill-line-${l.id}`} data-bucket={l.bucket} className="space-y-1 px-3 py-2 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${meta.tone}`}>{(l.bucket === 'voided_billed' || l.bucket === 'unknown') && <AlertTriangle size={10} className="mr-0.5 inline" />}{meta.label}</span>
      <span className="font-mono font-semibold">{l.bill?.trackingNumber}</span><span className="text-ink-500">{l.bill?.shipDate} · {l.bill?.service}</span>
      {l.label && <Link to={l.label.path} className="font-mono text-brand hover:underline">{l.label.ref}</Link>}
      <span data-testid={`bill-delta-${l.id}`} className={`ml-auto font-mono font-semibold ${amount > 0 ? 'text-rose-700' : 'text-moss-700'}`}>{amount > 0 ? '+' : ''}{fmtMoney(amount)}</span>
    </div>
    <div className="text-[11px] text-ink-500">{meta.blurb}{l.bucket === 'variance' && l.label && <> · billed {fmtMoney(l.bill!.billed)} vs ours {fmtMoney(l.label.cost)}</>}{l.bucket === 'voided_billed' && l.label && <> · voided {l.label.voidedAt ? `${fmtDate(l.label.voidedAt)} by ${l.label.who}` : ''} · billed {fmtMoney(l.bill!.billed)}</>}{l.bill?.surcharges.length ? <> · surcharges: {l.bill.surcharges.map((s) => <span key={s.kind} data-testid={`bill-surcharge-${l.id}`} className={`ml-1 rounded-sm px-1 ${/correction/i.test(s.kind) ? 'bg-amber-100 text-amber-900 font-semibold' : 'bg-canvas'}`}>{s.kind} {fmtMoney(s.amount)}</span>)}</> : null}</div>
    {l.decision ? <div data-testid={`bill-decision-${l.id}`} className={`text-[11px] font-medium ${l.decision.action === 'dispute' ? 'text-rose-700' : 'text-moss-700'}`}>{l.decision.action === 'dispute' ? 'Disputed' : 'Accepted'} · {l.decision.reason} · {l.decision.by} {fmtDate(l.decision.at)}</div>
      : <div className="flex flex-wrap items-center gap-2">{!mode ? <><Button size="sm" data-testid={`bill-accept-${l.id}`} onClick={() => { setMode('accept'); setReason(REASONS.accept[0]); }}>Accept</Button><Button size="sm" data-testid={`bill-dispute-${l.id}`} className="!border-rose-200 !text-rose-700" onClick={() => { setMode('dispute'); setReason(REASONS.dispute[l.bucket === 'voided_billed' ? 0 : l.bucket === 'unknown' ? 1 : 2]); }}>Dispute</Button></>
        : <><select data-testid={`bill-reason-${l.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className={field}>{REASONS[mode].map((r) => <option key={r}>{r}</option>)}</select><Button size="sm" variant="primary" data-testid={`bill-confirm-${l.id}`} onClick={() => run(() => api.decideBillLine(b.id, l.id, mode, reason), mode === 'dispute' ? 'Added to the dispute list' : 'Accepted')}>{mode === 'dispute' ? 'Dispute' : 'Accept'}</Button><Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button></>}</div>}
  </li>;
}
