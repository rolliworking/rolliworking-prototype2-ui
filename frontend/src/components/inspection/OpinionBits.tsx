import clsx from 'clsx';
import { Check, HelpCircle, Mic, MicOff, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as il from '@/api/inspectionLabels';
import type { LabelComponent, Opinion, OpinionLabel, VariantSet } from '@/api/inspectionLabels';
import { useDictation } from '@/components/layout/MessageComposer';
import { fmtDate } from '@/lib/format';

// Opinion tones — G-orig emerald · G-service sky · AM amber · CF rose · U slate · N/A empty ring
export const OPINION_TONE: Record<Opinion, { dot: string; chip: string }> = {
  genuine_original: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }, genuine_service: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 ring-sky-200' },
  aftermarket: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-900 ring-amber-300' }, counterfeit: { dot: 'bg-rose-600', chip: 'bg-rose-50 text-rose-800 ring-rose-300' },
  undetermined: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 ring-slate-300' }, na: { dot: 'border border-ink-300 bg-transparent', chip: 'bg-canvas text-ink-400 ring-line' },
};
export const OpinionChip = ({ label, dark, testId }: { label: OpinionLabel; dark?: boolean; testId?: string }) => <span data-testid={testId} data-opinion={label.opinion} className={clsx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1', dark ? 'bg-white/10 text-white ring-white/20' : OPINION_TONE[label.opinion].chip)}><span className={clsx('inline-block h-2 w-2 rounded-full', OPINION_TONE[label.opinion].dot)} />{il.OPINIONS.find((o) => o.key === label.opinion)?.short} · {label.confidence}{label.variant ? ` · ${label.variant}` : ''}</span>;

// Collapsed-header dots — one per component, latest opinion; empty ring = no row yet / N/A
export const OpinionDotsRow = ({ jobId, testId = 'opinion-dots' }: { jobId: string; testId?: string }) => {
  il.ensureSeed(); const latest = il.latestLabels(jobId);
  return <span data-testid={testId} data-count={latest.length} className="inline-flex items-center gap-1.5">{il.COMPONENTS.map((c) => { const l = latest.find((x) => x.component === c.key); const so = il.secondOpinionFor(jobId, c.key); return <span key={c.key} data-testid={`${testId}-${c.key}`} data-opinion={l?.opinion ?? 'none'} title={`${c.label} · ${l ? `${il.opinionLabel(l.opinion)} (${l.confidence}) · ${l.by}` : 'no opinion yet'}${so?.submittedAt ? ` · 2nd opinion ${so.agree ? 'agrees' : 'DISAGREES'}` : ''}`} className="inline-flex items-center gap-0.5"><span className="font-mono text-[9px] font-semibold text-ink-500">{c.short}</span><span className={clsx('inline-block h-2.5 w-2.5 rounded-full', l ? OPINION_TONE[l.opinion].dot : 'border border-ink-300 bg-transparent', so?.submittedAt && !so.agree && 'ring-2 ring-rose-300')} /></span>; })}</span>;
};

// Findings tags — chip row of the top ~8 (tap add/remove, sorted by use) + '#' typeahead inside the notes field; unknown → "Add #x to <Component> tags?"
export const TagChipsNotes = ({ component, tags, notes, onTags, onNotes, pad, dark, testId = 'tags' }: { component: LabelComponent; tags: string[]; notes: string; onTags: (t: string[]) => void; onNotes: (n: string) => void; pad?: boolean; dark?: boolean; testId?: string }) => {
  const [q, setQ] = useState<string | null>(null); const [ask, setAsk] = useState<string | null>(null); const ta = useRef<HTMLTextAreaElement>(null);
  const dict = useDictation((t) => onNotes(`${notes}${notes && !notes.endsWith(' ') ? ' ' : ''}${t}`));
  const toggle = (t: string) => onTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const top = il.topTags(component); const shown = Array.from(new Set([...top.map((t) => t.tag), ...tags]));
  const onChange = (v: string) => { onNotes(v); const m = /(?:^|\s)#([a-z0-9-]*)$/i.exec(v.slice(0, ta.current?.selectionStart ?? v.length)); setQ(m ? m[1] : null); };
  const complete = (t: string) => { const tag = il.normTag(t); if (!tag) return; const v = notes.replace(/#([a-z0-9-]*)$/i, `#${tag} `); onNotes(v); setQ(null); if (!tags.includes(tag)) { if (il.knownTag(component, tag)) onTags([...tags, tag]); else setAsk(tag); } };
  const matches = q !== null ? il.matchTags(component, q) : [];
  const chip = (on: boolean) => clsx('rounded-full border px-2 font-mono text-[11px]', pad ? 'min-h-[40px]' : 'h-6', on ? (dark ? 'border-accent bg-accent text-[#161b22]' : 'border-ink bg-ink text-white') : dark ? 'border-white/15 text-slate-200' : 'border-line text-ink-600 hover:border-ink-300');
  return <div data-testid={testId} className="space-y-1.5">
    <div data-testid={`${testId}-chips`} className="flex flex-wrap gap-1">{shown.map((t) => <button key={t} type="button" data-testid={`${testId}-chip-${t}`} aria-pressed={tags.includes(t)} onClick={() => toggle(t)} className={chip(tags.includes(t))}>#{t}{il.tagsFor(component).find((x) => x.tag === t)?.status === 'new' && <Sparkles size={9} className="ml-0.5 inline text-amber-500" />}</button>)}</div>
    <div className="relative flex items-start gap-2">
      <textarea ref={ta} data-testid={`${testId}-notes`} value={notes} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (q !== null && e.key === 'Enter' && matches[0]) { e.preventDefault(); complete(matches[0].tag); } else if (q !== null && e.key === 'Enter' && q) { e.preventDefault(); complete(q); } }} rows={pad ? 3 : 2} placeholder={dict.on ? 'Listening… speak your notes' : 'Notes — type # for tags (Enter completes)'} className={clsx('w-full resize-none rounded-md border px-2 py-1.5', pad ? 'text-base' : 'text-xs', dark ? 'border-white/15 bg-white/5 text-white placeholder:text-slate-500' : 'border-line bg-canvas text-ink focus:border-ink focus:outline-none')} />
      {pad && <button type="button" data-testid={`${testId}-dictate`} disabled={!dict.supported} onClick={dict.toggle} title={dict.supported ? 'Dictate into notes' : 'Dictation not supported here'} className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-30', dict.on ? 'animate-pulse bg-rose-600 text-white' : dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}>{dict.on ? <MicOff size={20} /> : <Mic size={20} />}</button>}
      {q !== null && <div data-testid={`${testId}-typeahead`} className={clsx('absolute left-2 top-full z-20 mt-1 flex flex-wrap gap-1 rounded-md border p-1.5 shadow-lg', dark ? 'border-white/15 bg-[#1f2630]' : 'border-line bg-surface')}>{matches.map((m) => <button key={m.tag} type="button" data-testid={`${testId}-ta-${m.tag}`} onClick={() => complete(m.tag)} className={chip(false)}>#{m.tag}</button>)}{q && !matches.some((m) => m.tag === il.normTag(q)) && <button type="button" data-testid={`${testId}-ta-new`} onClick={() => complete(q)} className={clsx(chip(false), 'border-dashed')}><Plus size={10} className="inline" /> #{il.normTag(q)}</button>}</div>}
    </div>
    {notes.match(/#[a-z0-9-]+/gi) && <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-ink-400'}`}>Inline: {Array.from(new Set(notes.match(/#[a-z0-9-]+/gi))).map((t) => <span key={t} className={clsx('mr-1 rounded-sm px-1 font-mono', tags.includes(il.normTag(t)) ? (dark ? 'bg-white/10' : 'bg-canvas') : 'opacity-60')}>{t}</span>)}</div>}
    {ask && <div data-testid={`${testId}-ask-new`} className={clsx('flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs', dark ? 'border-amber-400/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900')}>Add <b>#{ask}</b> to {il.componentLabel(component)} tags?<button type="button" data-testid={`${testId}-ask-yes`} onClick={() => { il.addTag(component, ask); onTags([...tags, ask]); setAsk(null); }} className="rounded-md bg-ink px-2 py-0.5 font-semibold text-white"><Check size={10} className="inline" /> Add (flagged new)</button><button type="button" data-testid={`${testId}-ask-no`} onClick={() => setAsk(null)} className="underline">No</button></div>}
  </div>;
};

// Variant picker — the just-taken shot on the left, exemplar tiles on the right (same crop / orientation), always "Unsure" and "None of these — new variant?"
export const VariantPicker = ({ set, shotUrl, value, onPick, onNone, onClose, dark }: { set: VariantSet; shotUrl?: string; value?: string; onPick: (k: string) => void; onNone: () => void; onClose: () => void; dark?: boolean }) => {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  return <div data-testid="variant-picker" data-ref={set.ref} data-component={set.component} className="fixed inset-0 z-[90] flex flex-col bg-black/92 text-white" onClick={onClose}>
    <div className="flex items-center gap-3 px-5 py-3" onClick={(e) => e.stopPropagation()}><span className="text-sm font-semibold">Variant · {set.ref} · {il.componentLabel(set.component)}</span><span className="text-xs text-white/60">tap a tile = variant · exemplars are our own photos</span><button type="button" data-testid="variant-close" onClick={onClose} className="ml-auto rounded-full bg-white/10 p-2" aria-label="Close"><X size={16} /></button></div>
    <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(280px,1fr)_2fr] gap-5 overflow-hidden px-5 pb-5" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col"><div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">Just taken</div>{shotUrl ? <img src={shotUrl} alt="" data-testid="variant-shot" className="w-full rounded-xl object-cover ring-2 ring-white/30" /> : <div data-testid="variant-shot-missing" className="grid flex-1 place-items-center rounded-xl bg-white/5 text-xs text-white/50">No shot yet — shoot the component first</div>}</div>
      <div className="overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {set.variants.map((v) => <button key={v.key} type="button" data-testid={`variant-tile-${v.key}`} aria-pressed={value === v.key} onClick={() => onPick(v.key)} className={clsx('rounded-xl border p-2 text-left transition-colors', value === v.key ? 'border-accent bg-accent/15' : 'border-white/15 bg-white/5 hover:bg-white/10')}>
            <div className="grid grid-cols-3 gap-1">{v.exemplars.map((e) => <img key={e.id} src={e.url} alt="" title={`${e.jobId} · ${e.chosenBy} · ${fmtDate(e.at)} · v${e.version}`} className="aspect-[4/3] w-full rounded-md object-cover" />)}{Array.from({ length: Math.max(0, 3 - v.exemplars.length) }).map((_, i) => <span key={i} className="aspect-[4/3] rounded-md bg-white/5" />)}</div>
            <div className="mt-2 flex items-center gap-2"><span className="rounded-sm bg-white px-1.5 font-mono text-xs font-bold text-black">{v.key}</span><span className="text-[11px] text-white/70">{v.tells}</span></div>
          </button>)}
          <button type="button" data-testid="variant-tile-unsure" aria-pressed={value === 'Unsure'} onClick={() => onPick('Unsure')} className={clsx('flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border text-sm', value === 'Unsure' ? 'border-amber-400 bg-amber-400/15' : 'border-white/15 bg-white/5 hover:bg-white/10')}><HelpCircle size={22} className="text-amber-300" /> Unsure</button>
          <button type="button" data-testid="variant-tile-none" onClick={onNone} className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/30 bg-white/5 text-sm hover:bg-white/10"><Plus size={22} className="text-white/70" /> None of these — new variant?<span className="text-[10px] text-white/50">opens a candidate a manager can promote</span></button>
        </div>
      </div>
    </div>
    {dark && null}
  </div>;
};
