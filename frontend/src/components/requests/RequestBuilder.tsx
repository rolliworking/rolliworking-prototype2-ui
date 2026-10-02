import clsx from 'clsx';
import { ImagePlus, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import * as api from '@/api/client';
import type { BuilderMode, BuilderSubmitResult, Client, PackagePhoto, RequestLine } from '@/api/client';
import * as rb from '@/api/requestBuilder';
import { field } from '@/components/rs/RsBits';
import { RequestLineCard } from './RequestLineCard';
import { AddBtn, Field } from './requestBuilderBits';

// PORTAL REQUEST BUILDER — one component, three audiences (MH 2026-10-02; signed-in only, D-418 — the public form is rw.com's Request tab):
// client  = signed-in regular client: one watch line → RQ + DRAFT estimate (typical range only).
// trade   = client.type 'trade': multi-line shipment (watch + band lines, duplicate +n → 1/n), waivers, pre-approvals; auto-quote accounts are quoted the moment every line resolves, others are queued for pricing.
// staff   = Requests page "on behalf of": same form, client picked first, every line shows quote key + rate; source = staff.
export const RequestBuilder = ({ mode, client, onDone, title }: { mode: BuilderMode; client: Client; onDone: (r: BuilderSubmitResult) => void; title?: string }) => {
  const multi = mode !== 'client'; const autoQuote = !!client.autoQuote; const roomy = mode !== 'staff';
  const [lines, setLines] = useState<RequestLine[]>([rb.newLine('watch')]); const [notes, setNotes] = useState(''); const [photos, setPhotos] = useState<PackagePhoto[]>([]); const [shipment, setShipment] = useState({ tracking: '', poNumber: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null); const groups = rb.groupLabels(lines);
  const update = (l: RequestLine) => setLines((xs) => xs.map((x) => (x.id === l.id ? l : x)));
  // +n identical pieces in the same shipment; copies share a groupId (numbered 1/n… in list order) and start without a polish ticket of their own
  const duplicate = (l: RequestLine, n: number) => { const gid = l.groupId ?? `g-${Date.now().toString(36)}`; const { id: _id, polishNumber: _p, ...rest } = l; const copies = Array.from({ length: n }, () => rb.newLine(l.kind, { ...rest, groupId: gid })); setLines((xs) => { const i = xs.findIndex((x) => x.id === l.id); const cur = { ...xs[i], groupId: gid }; return [...xs.slice(0, i), cur, ...copies, ...xs.slice(i + 1)]; }); };
  const addFiles = (files: FileList | null) => { Array.from(files ?? []).forEach((f, i) => { const rd = new FileReader(); rd.onload = () => setPhotos((p) => [...p, { id: `rb-${Date.now().toString(36)}-${i}`, source: 'camera', dataUrl: String(rd.result), slot: 'client-photo', note: f.name }]); rd.readAsDataURL(f); }); };
  const resolved = lines.filter((l) => l.rate).length; const allResolved = resolved === lines.length;
  const submit = async () => { setBusy(true); setErr(null); try { onDone(await api.submitBuilderRequest({ mode, clientId: client.id, lines, shipment: mode === 'trade' ? { tracking: shipment.tracking.trim() || undefined, poNumber: shipment.poNumber.trim() || undefined } : undefined, notes: notes.trim() || undefined, photos })); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send'); } finally { setBusy(false); } };
  const cta = mode === 'staff' ? 'Create request' : autoQuote ? (allResolved ? 'Send · quote now' : 'Send · estimate to follow') : mode === 'trade' ? 'Send shipment · estimate to follow' : 'Send request';
  const hint = mode === 'staff' ? `${resolved}/${lines.length} line${lines.length === 1 ? '' : 's'} resolve in the rate card · ${autoQuote ? 'auto-quote account' : client.type === 'trade' ? 'trade account · estimate queued for pricing' : 'draft estimate'}`
    : autoQuote ? (allResolved ? 'Every line matched our rate card — the quote is ready the moment you send.' : `${lines.length - resolved} line${lines.length - resolved === 1 ? '' : 's'} need a person — we send the estimate within one business day.`)
    : mode === 'trade' ? 'Your account is quoted by estimate — a person prices every line within one business day.' : 'A person reads every request — expect an estimate or a question within one business day.';
  return <div data-testid="request-builder" data-mode={mode} data-autoquote={autoQuote || undefined} className={clsx('space-y-3', roomy && 'text-[15px]')}>
    {title && <h2 className={clsx('font-semibold text-ink', roomy ? 'font-serif text-2xl font-medium tracking-tight' : 'text-sm')}>{title}</h2>}
    {mode === 'trade' && <section data-testid="rb-shipment" className="grid gap-3 rounded-md border border-line bg-canvas/60 p-3 md:grid-cols-[1fr_1fr_auto]">
      <Field label="Tracking # (optional)"><input data-testid="rb-ship-tracking" value={shipment.tracking} onChange={(e) => setShipment({ ...shipment, tracking: e.target.value })} placeholder="1Z…" className={clsx(field, 'h-10 w-full font-mono text-sm')} /></Field>
      <Field label="Your PO / reference"><input data-testid="rb-ship-po" value={shipment.poNumber} onChange={(e) => setShipment({ ...shipment, poNumber: e.target.value })} placeholder="PO-4471" className={clsx(field, 'h-10 w-full font-mono text-sm')} /></Field>
      <Field label="Pieces"><div data-testid="rb-ship-pieces" className="grid h-10 min-w-16 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-white">{lines.length}</div></Field>
    </section>}
    <div data-testid="rb-lines" data-count={lines.length} className="space-y-2">{lines.map((l, i) => <RequestLineCard key={l.id} line={l} index={i} group={groups[l.id]} mode={mode} autoQuote={autoQuote} onChange={update} onRemove={() => setLines((xs) => xs.filter((x) => x.id !== l.id))} onDuplicate={(n) => duplicate(l, n)} removable={lines.length > 1} />)}</div>
    {multi && <div className="flex flex-wrap gap-2"><AddBtn testId="rb-add-watch" onClick={() => setLines((xs) => [...xs, rb.newLine('watch')])}>Add watch job</AddBtn><AddBtn testId="rb-add-band" onClick={() => setLines((xs) => [...xs, rb.newLine('band')])}>Add band job</AddBtn></div>}
    <section className="grid gap-3 rounded-md border border-line bg-surface p-3 md:grid-cols-[1fr_auto]">
      <Field label="Anything else" hint="history · what changed · what you’d like back"><textarea data-testid="rb-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={clsx(field, 'w-full', roomy && 'text-sm')} /></Field>
      <Field label="Photos" hint={photos.length ? `${photos.length} attached` : 'optional'}><div className="flex items-center gap-2">{photos.map((p) => <img key={p.id} src={p.dataUrl} alt="" className="h-10 w-12 rounded-sm object-cover ring-1 ring-line" />)}<button type="button" data-testid="rb-add-photo" onClick={() => fileRef.current?.click()} className="inline-flex h-10 items-center gap-1 rounded-sm border border-line px-3 text-xs hover:bg-canvas"><ImagePlus size={13} /> Add</button><input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></div></Field>
    </section>
    {err && <p data-testid="rb-error" className="text-sm text-rose-700">{err}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" data-testid="rb-submit" disabled={busy} onClick={() => void submit()} className={clsx('inline-flex items-center gap-2 rounded-full bg-ink font-medium text-white hover:bg-black disabled:opacity-40', roomy ? 'h-11 px-6 text-sm' : 'h-9 px-4 text-xs')}><Send size={14} /> {busy ? 'Sending…' : cta}</button>
      <span data-testid="rb-outcome-hint" data-resolved={resolved} data-total={lines.length} className="text-xs text-ink-500">{hint}</span>
    </div>
  </div>;
};
