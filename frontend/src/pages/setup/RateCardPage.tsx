import clsx from 'clsx';
import { ArrowLeft, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { BandMaterial, BandType, DeptCode, RateCardRow } from '@/api/client';
import * as rb from '@/api/requestBuilder';
import { useAuth } from '@/auth/AuthContext';
import { field } from '@/components/rs/RsBits';
import { Button, PageHeader } from '@/components/ui/Button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime } from '@/lib/format';

// Setup → Rate card (owner / manager): ref (or BAND) · legs · material · type · construction · price or range · typical days · version · last edited by.
// `?key=16233-WBP · TT · Jubilee · Folded` (from a triaged request line) opens the form prefilled — the triage → "add rate" path is the point; the table is for fixing what it produces.
type Draft = { id?: string; ref: string; legs: DeptCode[]; material?: BandMaterial; type?: BandType; construction?: string; mode: 'price' | 'range'; price: string; low: string; high: string; days: string; active: boolean };
const LEGS: DeptCode[] = ['W', 'B', 'P', 'PM'];
const blank = (): Draft => ({ ref: '', legs: [], mode: 'price', price: '', low: '', high: '', days: '', active: true });
const fromRow = (r: RateCardRow): Draft => ({ id: r.id, ref: r.ref, legs: r.legs, material: r.material, type: r.type, construction: r.construction, mode: r.price !== undefined ? 'price' : 'range', price: r.price?.toString() ?? '', low: r.priceLow?.toString() ?? '', high: r.priceHigh?.toString() ?? '', days: String(r.days), active: r.active });
const fromKey = (key: string): Draft => { const p = rb.parseQuoteKey(key); return { ...blank(), ref: p.ref ?? '', legs: p.legs ?? [], material: p.material, type: p.type, construction: p.construction }; };
const draftKey = (d: Draft) => rb.quoteKeyFor({ kind: d.ref.toUpperCase() === 'BAND' ? 'band' : 'watch', legs: rb.sortLegs(d.legs), ref: d.ref, bracelet: { material: d.material, type: d.type, construction: d.construction } });

const RateForm = ({ d, setD, onSave, onCancel, err }: { d: Draft; setD: (d: Draft) => void; onSave: () => void; onCancel: () => void; err: string | null }) => {
  const cons = d.type ? rb.CONSTRUCTIONS[d.type] : [];
  const sel = 'rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-ink-300 focus:outline-none';
  return <form data-testid="rate-form" data-editing={d.id || undefined} onSubmit={(e) => { e.preventDefault(); onSave(); }} className="rounded-md border border-ink bg-surface p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{d.id ? 'Edit rate' : 'Add rate'}</span><span data-testid="rate-form-key" className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{draftKey(d)}</span><button type="button" data-testid="rate-form-cancel" onClick={onCancel} className="ml-auto text-ink-400 hover:text-ink" aria-label="Cancel"><X size={13} /></button></div>
    <div className="mt-2 grid gap-2 md:grid-cols-[120px_1fr_1fr_1fr_1fr]">
      <label className="block"><span className="text-[10px] text-ink-500">Ref or BAND</span><input data-testid="rate-ref" value={d.ref} onChange={(e) => setD({ ...d, ref: e.target.value })} placeholder="16233 · BAND" className={`${field} mt-0.5 w-full font-mono`} /></label>
      <div><span className="text-[10px] text-ink-500">Legs</span><div className="mt-0.5 flex gap-1">{LEGS.map((l) => <button key={l} type="button" data-testid={`rate-leg-${l}`} aria-pressed={d.legs.includes(l)} onClick={() => setD({ ...d, legs: d.legs.includes(l) ? d.legs.filter((x) => x !== l) : [...d.legs, l] })} className={clsx('h-7 min-w-8 rounded-sm border px-2 font-mono font-semibold', d.legs.includes(l) ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas')}>{l}</button>)}</div></div>
      <label className="block"><span className="text-[10px] text-ink-500">Material</span><select data-testid="rate-material" value={d.material ?? ''} onChange={(e) => setD({ ...d, material: (e.target.value || undefined) as BandMaterial | undefined })} className={`${sel} mt-0.5 w-full`}><option value="">any</option>{rb.MATERIALS.map((m) => <option key={m.key} value={m.key}>{m.key} · {m.label}</option>)}</select></label>
      <label className="block"><span className="text-[10px] text-ink-500">Type</span><select data-testid="rate-type" value={d.type ?? ''} onChange={(e) => setD({ ...d, type: (e.target.value || undefined) as BandType | undefined, construction: undefined })} className={`${sel} mt-0.5 w-full`}><option value="">any</option>{rb.BAND_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className="block"><span className="text-[10px] text-ink-500">Construction</span><select data-testid="rate-construction" value={d.construction ?? ''} onChange={(e) => setD({ ...d, construction: e.target.value || undefined })} disabled={!cons.length} className={`${sel} mt-0.5 w-full disabled:opacity-50`}><option value="">any</option>{cons.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
    </div>
    <div className="mt-2 flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-md bg-canvas p-0.5">{(['price', 'range'] as const).map((m) => <button key={m} type="button" data-testid={`rate-mode-${m}`} aria-pressed={d.mode === m} onClick={() => setD({ ...d, mode: m })} className={clsx('rounded-sm px-2 py-1 text-[11px] font-semibold', d.mode === m ? 'bg-ink text-white' : 'text-ink-600')}>{m === 'price' ? 'Price' : 'Range'}</button>)}</div>
      {d.mode === 'price' ? <label className="block"><span className="text-[10px] text-ink-500">Price $</span><input data-testid="rate-price" type="number" min={0} value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} className={`${field} mt-0.5 w-28 font-mono`} /></label>
        : <><label className="block"><span className="text-[10px] text-ink-500">Low $</span><input data-testid="rate-low" type="number" min={0} value={d.low} onChange={(e) => setD({ ...d, low: e.target.value })} className={`${field} mt-0.5 w-24 font-mono`} /></label><label className="block"><span className="text-[10px] text-ink-500">High $</span><input data-testid="rate-high" type="number" min={0} value={d.high} onChange={(e) => setD({ ...d, high: e.target.value })} className={`${field} mt-0.5 w-24 font-mono`} /></label></>}
      <label className="block"><span className="text-[10px] text-ink-500">Typical days</span><input data-testid="rate-days" type="number" min={1} value={d.days} onChange={(e) => setD({ ...d, days: e.target.value })} className={`${field} mt-0.5 w-20 font-mono`} /></label>
      <label className="inline-flex items-center gap-1.5 pb-1.5 text-[11px]"><input type="checkbox" data-testid="rate-active" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Active</label>
      <Button type="submit" variant="primary" size="sm" data-testid="rate-save">{d.id ? 'Save · new version' : 'Add rate'}</Button>
      {err && <span data-testid="rate-error" className="text-rose-700">{err}</span>}
    </div>
  </form>;
};

export default function RateCardPage() {
  const { user } = useAuth(); const [params, setParams] = useSearchParams(); const key = params.get('key');
  const [rows, setRows] = useState<RateCardRow[]>([]); const [draft, setDraft] = useState<Draft | null>(() => (key ? fromKey(key) : null)); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [q, setQ] = useState('');
  const load = () => api.getRateCard().then(setRows);
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (key) setDraft(fromKey(key)); }, [key]);
  if (user?.accessTier !== 'manager') return <div data-testid="rate-card-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600">Rate card is owner / manager only.</div>;
  const save = async () => { if (!draft) return; try { setErr(null); const r = await api.saveRateCardRow({ id: draft.id, ref: draft.ref, legs: draft.legs, material: draft.material, type: draft.type, construction: draft.construction, price: draft.mode === 'price' ? Number(draft.price) || undefined : undefined, priceLow: draft.mode === 'range' ? Number(draft.low) || undefined : undefined, priceHigh: draft.mode === 'range' ? Number(draft.high) || Number(draft.low) || undefined : undefined, days: Number(draft.days), active: draft.active }); setDraft(null); if (key) { const p = new URLSearchParams(params); p.delete('key'); setParams(p, { replace: true }); } setMsg(`${draft.id ? 'Updated' : 'Added'} ${rb.rowKey(r)} → ${rb.rateLabel(r)} · v${r.version}`); window.setTimeout(() => setMsg(null), 3500); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } };
  const shown = rows.filter((r) => !q.trim() || rb.rowKey(r).toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.ref.localeCompare(b.ref) || a.legs.join('').localeCompare(b.legs.join('')));
  return <div data-testid="rate-card-page" className="space-y-3">
    <Link to="/setup" data-testid="rate-card-back" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Setup</Link>
    <PageHeader title="Rate card" subtitle="One key — ref (or BAND) · legs · material · type · construction — shared by the request line, the estimate line and this table. Blank bracelet fields match anything; the most specific row wins. Every save is a new version." action={<div className="flex items-center gap-2"><input data-testid="rate-card-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by key…" className={`${field} w-48`} /><Button variant="primary" size="sm" data-testid="rate-card-add" onClick={() => { setDraft(blank()); setErr(null); }}><Plus size={12} /> Add rate</Button></div>} />
    {key && <div data-testid="rate-card-prefill" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">Prefilled from a request line without a rate: <b className="font-mono">{key}</b> — set the price and days, save, and the line resolves.</div>}
    {msg && <p data-testid="rate-card-msg" className="text-xs text-moss-700">{msg}</p>}
    {draft && <RateForm d={draft} setD={setDraft} onSave={() => void save()} onCancel={() => { setDraft(null); setErr(null); }} err={err} />}
    <Table testId="rate-card-table">
      <thead><tr><Th>Key</Th><Th>Ref</Th><Th>Legs</Th><Th>Material</Th><Th>Type</Th><Th>Construction</Th><Th>Price / range</Th><Th>Typical days</Th><Th>Version</Th><Th>Last edited</Th><Th /></tr></thead>
      <tbody>{shown.map((r) => <tr key={r.id} data-testid={`rate-row-${r.id}`} data-key={rb.rowKey(r)} data-active={r.active} className={clsx('align-top', !r.active && 'opacity-50')}>
        <Td className="font-mono text-[11px] font-semibold text-ink">{rb.rowKey(r)}</Td><Td className="font-mono text-xs">{r.ref}</Td><Td className="font-mono text-xs">{r.legs.join('')}</Td><Td className="text-xs">{r.material ?? <span className="text-ink-300">any</span>}</Td><Td className="text-xs">{r.type ?? <span className="text-ink-300">any</span>}</Td><Td className="text-xs">{r.construction ?? <span className="text-ink-300">any</span>}</Td>
        <Td data-testid={`rate-row-price-${r.id}`} className="font-mono text-xs font-semibold text-ink">{rb.rateLabel(r)}</Td><Td className="font-mono text-xs">{r.days}</Td><Td data-testid={`rate-row-version-${r.id}`} className="font-mono text-xs">v{r.version}</Td><Td className="whitespace-nowrap text-[11px] text-ink-500">{r.editedBy} · {fmtDate(r.editedAt)} {fmtTime(r.editedAt)}</Td>
        <Td><button type="button" data-testid={`rate-row-edit-${r.id}`} onClick={() => { setDraft(fromRow(r)); setErr(null); window.scrollTo({ top: 0 }); }} className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><Pencil size={11} /> Edit</button></Td>
      </tr>)}{!shown.length && <EmptyRow colSpan={11} text="No rates match" />}</tbody>
    </Table>
  </div>;
}
