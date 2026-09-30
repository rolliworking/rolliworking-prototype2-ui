import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as api from '@/api/client';
import type { ComponentKey, SwoHubView, SwoStage, SwoWithRefs } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export const COMP_LABEL: Record<string, string> = { head: 'Head / dial', case: 'Case / bezel', band: 'Bracelet' };
export const COMPONENTS: { key: ComponentKey; label: string }[] = [{ key: 'head', label: 'Head / dial' }, { key: 'case', label: 'Case / bezel' }, { key: 'band', label: 'Bracelet' }];
export const ticketOf = (w: SwoWithRefs) => w.jobNumber.replace(/^E/, '');
export const fmtMD = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
// Hub pages live in both shells: /swo/:id (RS) and /rw/swo/:id (pads) — same component, route prefix from where we are
export const useSwoBase = () => (useLocation().pathname.startsWith('/rw') ? '/rw/swo' : '/swo');
export type SentPartInput = { label: string; custom?: boolean };

// Deterministic Code 128 MOCK render of a value (same bar generator as the intake labels — a real encoder replaces this one component)
const bars = (payload: string, count: number) => { let h = 2166136261; const out: number[] = []; for (let i = 0; i < count; i++) { h ^= payload.charCodeAt(i % payload.length); h = Math.imul(h, 16777619) >>> 0; out.push(1 + (h % 3)); } return out; };
export const Code128 = ({ value, height = 36, scale = 1.5, caption = true, testId }: { value: string; height?: number; scale?: number; caption?: boolean; testId?: string }) => (
  <div data-testid={testId ?? `barcode-${value}`} data-value={value} className="inline-flex flex-col items-center rounded-sm bg-white px-2 py-1" aria-label={`Code 128 ${value}`}>
    <div className="flex items-stretch gap-[1px]" style={{ height }}>{bars(value, 44).map((w, i) => <span key={i} className={i % 2 === 0 ? 'bg-black' : 'bg-transparent'} style={{ width: w * scale }} />)}</div>
    {caption && <span className="mt-0.5 font-mono text-[11px] font-semibold tracking-widest text-black">{value}</span>}
  </div>
);

// "Commonly sent" — the per-vendor checklist of what physically goes in the box; editable on the vendor record (add / remove), "other" on a line never edits it
export const PresetsEditor = ({ value, onChange, testId = 'vendor-presets' }: { value: string[]; onChange: (v: string[]) => void; testId?: string }) => {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (!t || value.some((x) => x.toLowerCase() === t.toLowerCase())) { setDraft(''); return; } onChange([...value, t]); setDraft(''); };
  return <div data-testid={testId} className="rounded-sm border border-line bg-canvas/50 p-2">
    <div className="mb-1 text-[11px] font-semibold text-ink">Commonly sent <span className="font-normal text-ink-500">— ticked per line when a ticket is added to an SWO; becomes the packing list + receive checklist</span></div>
    <div className="flex flex-wrap items-center gap-1">
      {value.map((p) => <span key={p} data-testid={`${testId}-item-${api.partKey(p)}`} className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface px-1.5 py-0.5 text-xs text-ink">{p}<button type="button" data-testid={`${testId}-remove-${api.partKey(p)}`} aria-label={`Remove ${p}`} onClick={() => onChange(value.filter((x) => x !== p))} className="text-ink-400 hover:text-rose-700"><X size={11} /></button></span>)}
      {!value.length && <span className="text-xs text-ink-400">free text on each line (no presets)</span>}
      <input data-testid={`${testId}-input`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="add item (Enter)" className={`${field} w-36`} />
      <button type="button" data-testid={`${testId}-add`} onClick={add} className="rounded-sm border border-line px-2 py-1 text-xs hover:bg-canvas">Add</button>
    </div>
  </div>;
};

// SENT PARTS PICKER — the vendor's commonly-sent items as tick boxes + "other" free text (a line's "other" never edits the vendor list)
export const SentPartsPicker = ({ presets, value, onChange, testId = 'sent-parts' }: { presets: string[]; value: SentPartInput[]; onChange: (v: SentPartInput[]) => void; testId?: string }) => {
  const [other, setOther] = useState('');
  const has = (l: string) => value.some((x) => x.label.toLowerCase() === l.toLowerCase());
  const toggle = (l: string) => onChange(has(l) ? value.filter((x) => x.label.toLowerCase() !== l.toLowerCase()) : [...value, { label: l }]);
  const addOther = () => { const t = other.trim(); if (t && !has(t)) onChange([...value, { label: t, custom: true }]); setOther(''); };
  return <div data-testid={testId} className="rounded-sm border border-line bg-canvas/50 p-2 text-xs">
    <div className="mb-1 text-[11px] font-semibold text-ink">What physically goes in the box <span className="font-normal text-ink-500">— becomes the packing list + the receive checklist</span></div>
    <div className="flex flex-wrap items-center gap-1">
      {presets.map((p) => <button key={p} type="button" data-testid={`${testId}-${api.partKey(p)}`} aria-pressed={has(p)} onClick={() => toggle(p)} className={`rounded-sm border px-2 py-1 ${has(p) ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas'}`}>{has(p) ? '✓ ' : ''}{p}</button>)}
      {value.filter((x) => x.custom).map((x) => <span key={x.label} data-testid={`${testId}-custom-${api.partKey(x.label)}`} className="inline-flex items-center gap-1 rounded-sm border border-ink bg-ink px-2 py-1 text-white">{x.label}<button type="button" onClick={() => toggle(x.label)} aria-label={`Remove ${x.label}`}><X size={11} /></button></span>)}
      <input data-testid={`${testId}-other`} value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }} placeholder="other… (Enter)" className={`${field} w-32`} />
    </div>
  </div>;
};

export const StageChip = ({ stage, testId }: { stage: SwoStage; testId?: string }) => <span data-testid={testId} data-stage={stage} className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">{api.swoStageLabel(stage)}</span>;
// Header chips shared by the hub page, the Track panel group header and the /swo list
export const HubChips = ({ hv }: { hv: SwoHubView }) => <>
  <StageChip stage={hv.stage} testId={`hub-stage-${hv.id}`} />
  {hv.international && <span className="rounded-sm bg-sky-50 px-1 text-[10px] font-semibold text-sky-800">INTL</span>}
  {hv.paid && <span data-testid={`hub-paid-${hv.id}`} className="rounded-sm bg-moss-50 px-1 text-[10px] font-semibold text-moss-800">PAID</span>}
  <span data-testid={`hub-count-${hv.id}`} className="text-[10px] text-ink-500">{hv.open} open · {hv.back} back · {hv.total} line{hv.total === 1 ? '' : 's'}</span>
</>;

// Sent parts on a line: ✓ back · ✗ MISSING (red) · ? verify (back, checklist not done) · plain = away
export const LineParts = ({ w }: { w: SwoWithRefs }) => {
  const back = api.swoLineBack(w); const parts = w.sentParts ?? [];
  if (!parts.length) return <span className="text-ink-400">{w.components.map((c) => COMP_LABEL[c] ?? c).join(' + ')}</span>;
  return <span data-testid={`line-parts-${w.id}`} className="inline-flex flex-wrap gap-1">{parts.map((p) => { const st = p.returned === true ? 'back' : p.returned === false ? 'missing' : back ? 'verify' : 'away'; const cls = st === 'back' ? 'bg-moss-50 text-moss-800' : st === 'missing' ? 'bg-rose-600 text-white' : st === 'verify' ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300' : 'bg-canvas text-ink-600 ring-1 ring-line'; return <span key={p.key} data-testid={`line-part-${w.id}-${p.key}`} data-state={st} className={`rounded-sm px-1 text-[10px] font-semibold ${cls}`}>{st === 'back' ? '✓ ' : st === 'missing' ? '✗ MISSING · ' : st === 'verify' ? '? ' : ''}{p.label}</span>; })}</span>;
};

// RECEIVE CHECKLIST — tick what came out of the box; unticked = still Away = a blocker on the parent job (pinned to the point person)
export const ReceiveModal = ({ line, onClose, onDone }: { line: SwoWithRefs; onClose: () => void; onDone: (m: string) => void }) => {
  const parts = line.sentParts ?? []; const [t, setT] = useState<Record<string, boolean>>(Object.fromEntries(parts.map((p) => [p.key, p.returned !== false]))); const [err, setErr] = useState<string | null>(null);
  const missing = parts.filter((p) => !t[p.key]);
  return <Modal testId="swo-receive-modal" title={`Receive ${line.number} · ${ticketOf(line)} · ${line.vendor.name}`} width="w-[460px]" onClose={onClose}>
    <div className="space-y-2 p-4 text-xs">
      <p className="text-ink-500">Tick each sent part as it comes out of the box. Anything unticked stays <b>Away</b> and becomes a blocker on {ticketOf(line)}.</p>
      {parts.map((p) => <label key={p.key} className="flex items-center gap-2 rounded-sm border border-line px-2 py-1.5"><input type="checkbox" data-testid={`receive-tick-${p.key}`} checked={!!t[p.key]} onChange={(e) => setT({ ...t, [p.key]: e.target.checked })} /><span className="font-medium text-ink">{p.label}</span>{!t[p.key] && <span className="ml-auto rounded-sm bg-rose-600 px-1 text-[10px] font-semibold text-white">MISSING</span>}</label>)}
      {!parts.length && <p className="text-ink-400">No sent-parts list on this line — received as-is.</p>}
      {err && <p data-testid="receive-error" className="text-rose-700">{err}</p>}
      <div className="flex justify-end gap-2"><Button size="sm" onClick={onClose}>Cancel</Button><Button size="sm" variant="primary" data-testid="receive-confirm" onClick={async () => { try { await api.receiveSwoLine(line.id, t); onDone(missing.length ? `${ticketOf(line)} received — MISSING: ${missing.map((p) => p.label).join(', ')} (still away · pinned to ${line.pointPerson ?? 'point person'})` : `${ticketOf(line)} received — all parts back`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}>{missing.length ? `Receive · ${missing.length} missing` : 'Receive · all back'}</Button></div>
    </div>
  </Modal>;
};

// ADD LINE — scan / look up a ticket → component → work → tick sent parts → addSwoLine (only while the box is still In queue)
export const AddLineModal = ({ hub, onClose, onSaved }: { hub: SwoHubView; onClose: () => void; onSaved: (m: string) => void }) => {
  const [q, setQ] = useState(''); const [hits, setHits] = useState<Awaited<ReturnType<typeof api.getSwoJobCandidates>>>([]); const [jobId, setJobId] = useState(''); const [components, setComponents] = useState<ComponentKey[]>([]); const [work, setWork] = useState(''); const [parts, setParts] = useState<SentPartInput[]>([]); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void api.getSwoJobCandidates(q).then(setHits); }, [q]);
  const presets = api.vendorPresets(hub.vendor);
  const pick = (h: { id: string; components: ComponentKey[] }) => { setJobId(h.id); if (!components.length) setComponents([h.components.includes('case') ? 'case' : h.components[0] ?? 'head']); };
  return <Modal testId="swo-add-line" title={`Add line to ${hub.number} · ${hub.vendor.name}`} width="w-[620px]" onClose={onClose}>
    <div className="space-y-3 p-4 text-xs text-ink-500">
      <div>Ticket — scan the label or type est # / client<input autoFocus data-testid="add-line-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = q.trim().replace(/^E/i, '').toLowerCase(); const h = hits.find((x) => x.number.replace(/^E/, '').toLowerCase() === t) ?? hits[0]; if (h) pick(h); } }} placeholder="E02064 · 02064 · Calloway" className={`${field} mt-1 block w-full font-mono`} />
        <ul className="mt-1 max-h-32 divide-y divide-line/70 overflow-y-auto rounded-sm border border-line">{hits.map((h) => <li key={h.id}><button type="button" data-testid={`add-line-job-${h.id}`} data-on-lane={h.onLane} disabled={h.onLane} title={h.onLane ? 'Already on a vendor lane — one lane at a time' : undefined} onClick={() => pick(h)} className={`flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-canvas disabled:opacity-50 ${jobId === h.id ? 'bg-ink text-white hover:bg-ink' : ''}`}><span className="font-mono font-semibold">{h.number}</span><span>{h.client}</span>{h.onLane && <span className="rounded-sm bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">on a vendor lane</span>}<span className="ml-auto">{h.watch}</span></button></li>)}</ul></div>
      <div>Component<div className="mt-1 flex gap-1">{COMPONENTS.map((c) => <button key={c.key} type="button" data-testid={`add-line-comp-${c.key}`} aria-pressed={components.includes(c.key)} onClick={() => setComponents(components.includes(c.key) ? components.filter((k) => k !== c.key) : [...components, c.key])} className={`rounded-sm border px-2 py-1 ${components.includes(c.key) ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas'}`}>{c.label}</button>)}</div></div>
      <label className="block">Work for this line<textarea data-testid="add-line-work" rows={2} value={work} onChange={(e) => setWork(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
      <SentPartsPicker presets={presets} value={parts} onChange={setParts} testId="add-line-parts" />
      {err && <div data-testid="add-line-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="add-line-save" disabled={!jobId || !components.length || !work.trim()} onClick={async () => { try { const hv = await api.addSwoLine(hub.id, { jobId, components, work, sentParts: parts }); onSaved(`Line added to ${hv.number} · ${hv.total} line${hv.total === 1 ? '' : 's'} in the box`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}>Add line</Button></div>
    </div>
  </Modal>;
};
