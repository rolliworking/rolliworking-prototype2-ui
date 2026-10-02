import clsx from 'clsx';
import { Copy, Trash2, Watch } from 'lucide-react';
import { useState } from 'react';
import type { BandType, BuilderMode, JobType, RequestLine } from '@/api/client';
import * as rb from '@/api/requestBuilder';
import * as wm8 from '@/api/watchm8';
import { modelReferences } from '@/api/fixtures/companion';
import { field } from '@/components/rs/RsBits';
import { Chip, Field, QuoteKey, RateLine } from './requestBuilderBits';

// One request line: job type → reference → bracelet cascade (Material → Type → Construction) → polish # · notes · (trade / staff) pre-approvals · waivers · duplicate ×n.
// Every change re-derives legs · quote key · rate through rb.normaliseLine — the card never computes its own.
const REF_OPTIONS = [...wm8.REFS.map((r) => ({ ref: r.ref, label: `${r.brand} ${r.model}` })), ...modelReferences.filter((m) => !wm8.REFS.some((r) => r.ref === m.reference)).map((m) => ({ ref: m.reference, label: `${m.brand} ${m.model}` }))];
const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

export const RequestLineCard = ({ line, index, group, mode, autoQuote, onChange, onRemove, onDuplicate, removable }: { line: RequestLine; index: number; group?: string; mode: BuilderMode; autoQuote: boolean; onChange: (l: RequestLine) => void; onRemove: () => void; onDuplicate: (n: number) => void; removable: boolean }) => {
  const roomy = mode !== 'staff'; const pro = mode === 'trade' || mode === 'staff'; const [dup, setDup] = useState(1);
  const set = (patch: Partial<RequestLine>) => onChange(rb.normaliseLine({ ...line, ...patch }));
  const pickRef = (v: string) => { const o = REF_OPTIONS.find((r) => r.ref.toUpperCase() === v.trim().toUpperCase()); set({ ref: v, model: o ? o.label : line.model }); };
  const types = rb.JOB_TYPES.filter((j) => j.kinds.includes(line.kind)); const band = rb.hasBand(line); const constructions = line.bracelet?.type ? rb.CONSTRUCTIONS[line.bracelet.type] : [];
  const showPolish = pro || line.legs.includes('P');
  return <section data-testid={`rb-line-${line.id}`} data-kind={line.kind} data-key={line.quoteKey} data-rate={line.rate ? 'yes' : 'no'} className="rounded-md border border-line bg-surface p-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className={clsx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', line.kind === 'band' ? 'bg-amber-100 text-amber-900' : 'bg-ink text-white')}><Watch size={10} /> {line.kind === 'band' ? 'Band job' : 'Watch job'} {index + 1}</span>
      {group && <span data-testid={`rb-line-group-${line.id}`} className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink ring-1 ring-line">{group}</span>}
      <QuoteKey k={line.quoteKey} testId={`rb-line-key-${line.id}`} />
      <span className="ml-auto flex items-center gap-1">
        {pro && <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">+<input data-testid={`rb-line-dup-n-${line.id}`} type="number" min={1} max={20} value={dup} onChange={(e) => setDup(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className={clsx(field, 'w-12 py-0.5')} /><button type="button" data-testid={`rb-line-dup-${line.id}`} onClick={() => onDuplicate(dup)} title="Add identical pieces to the same shipment — the group is numbered 1/n…; each copy keeps its own polish # and notes" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line px-2 text-xs hover:bg-canvas"><Copy size={11} /> Duplicate</button></span>}
        {removable && <button type="button" data-testid={`rb-line-remove-${line.id}`} onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-sm text-ink-400 hover:bg-canvas hover:text-rose-700" aria-label="Remove line"><Trash2 size={13} /></button>}
      </span>
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Job type" hint="pick everything that applies" testId={`rb-line-jobtypes-${line.id}`}><div className="flex flex-wrap gap-1.5">{types.map((j) => <Chip key={j.key} roomy={roomy} testId={`rb-line-job-${line.id}-${j.key}`} on={line.jobTypes.includes(j.key)} hint={j.hint} onClick={() => set({ jobTypes: toggle(line.jobTypes, j.key as JobType) })}>{j.label}{j.dept && <span className="text-[10px] opacity-60">{j.dept}</span>}</Chip>)}</div></Field>
      <Field label={line.kind === 'band' ? 'Reference it belongs to' : 'Reference'} hint={line.model || (line.kind === 'band' ? 'optional — BAND rates apply without it' : 'type or pick')}><input data-testid={`rb-line-ref-${line.id}`} list={`rb-refs-${line.id}`} value={line.ref ?? ''} onChange={(e) => pickRef(e.target.value)} placeholder="e.g. 16233" className={clsx(field, 'w-full font-mono', roomy && 'h-10 text-sm')} /><datalist id={`rb-refs-${line.id}`}>{REF_OPTIONS.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}</datalist></Field>
    </div>
    {band && <div data-testid={`rb-line-bracelet-${line.id}`} className="mt-3 grid gap-3 md:grid-cols-3">
      <Field label="Bracelet material"><div className="flex flex-wrap gap-1.5">{rb.MATERIALS.map((m) => <Chip key={m.key} roomy={roomy} testId={`rb-line-mat-${line.id}-${m.key}`} on={line.bracelet?.material === m.key} onClick={() => set({ bracelet: { ...line.bracelet, material: m.key } })}>{m.label}<span className="text-[10px] opacity-60">{m.key}</span></Chip>)}</div></Field>
      <Field label="Bracelet type" hint={!line.bracelet?.material ? 'pick a material first' : undefined}><div className="flex flex-wrap gap-1.5">{rb.BAND_TYPES.map((t) => <Chip key={t} roomy={roomy} testId={`rb-line-type-${line.id}-${t}`} on={line.bracelet?.type === t} onClick={() => set({ bracelet: { ...line.bracelet, type: t as BandType, construction: undefined } })}>{t}</Chip>)}</div></Field>
      <Field label="Construction" hint={!line.bracelet?.type ? 'pick a type first' : constructions.length ? undefined : 'none for this type'}><div className="flex flex-wrap gap-1.5">{constructions.map((c) => <Chip key={c} roomy={roomy} testId={`rb-line-con-${line.id}-${c}`} on={line.bracelet?.construction === c} onClick={() => set({ bracelet: { ...line.bracelet, construction: c } })}>{c}</Chip>)}{!constructions.length && <span className="text-xs text-ink-400">—</span>}</div></Field>
    </div>}
    <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
      {showPolish ? <Field label="Polish #" hint="your ticket"><input data-testid={`rb-line-polish-${line.id}`} value={line.polishNumber ?? ''} onChange={(e) => set({ polishNumber: e.target.value || undefined })} placeholder="P-221" className={clsx(field, 'w-full font-mono', roomy && 'h-10 text-sm')} /></Field> : <span />}
      <Field label="Notes" hint={line.jobTypes.includes('other') ? 'required for Other' : 'what you noticed · what you want back'}><input data-testid={`rb-line-notes-${line.id}`} value={line.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="e.g. clasp will not stay shut; keep the original crystal" className={clsx(field, 'w-full', roomy && 'h-10 text-sm')} /></Field>
    </div>
    {pro && <div className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Pre-approvals" hint="the bench may do these without asking"><div className="flex flex-wrap gap-1.5">{rb.PRE_APPROVALS.map((p, i) => <Chip key={p} testId={`rb-line-pre-${line.id}-${i}`} on={!!line.preApprovals?.includes(p)} onClick={() => set({ preApprovals: toggle(line.preApprovals, p) })}>{p}</Chip>)}</div></Field>
      <Field label="Waivers" hint="what we must not touch"><div className="flex flex-wrap gap-1.5">{rb.WAIVERS.map((w, i) => <Chip key={w} testId={`rb-line-waiver-${line.id}-${i}`} on={!!line.waivers?.includes(w)} onClick={() => set({ waivers: toggle(line.waivers, w) })}>{w}</Chip>)}</div></Field>
    </div>}
    <div className="mt-3 border-t border-line pt-2"><RateLine line={line} mode={mode} autoQuote={autoQuote} rate={line.rate} testId={`rb-line-rate-${line.id}`} /></div>
  </section>;
};
