import clsx from 'clsx';
import { Eye, EyeOff, History, Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as il from '@/api/inspectionLabels';
import type { Confidence, LabelComponent, Opinion } from '@/api/inspectionLabels';
import { useAuth } from '@/auth/AuthContext';
import { OPINION_TONE, OpinionChip, TagChipsNotes, VariantPicker } from './OpinionBits';
import { fmtDate, fmtTime } from '@/lib/format';

const CONF: Confidence[] = ['sure', 'likely', 'unsure'];

// Scantron row — one component: OPINION (required) · CONFIDENCE · VARIANT / MARK (visual picker when a set exists, typeahead text otherwise) · FINDINGS TAGS + NOTES · inherited ref / era / model · signature. Saving appends a revision.
export const OpinionRow = ({ jobId, component, pad, dark, onSaved, testId }: { jobId: string; component: LabelComponent; pad?: boolean; dark?: boolean; onSaved?: () => void; testId?: string }) => {
  const { user } = useAuth(); const me = user?.shortName ?? ''; const manager = user?.accessTier === 'manager';
  const id = testId ?? `opinion-${component}`; const latest = il.latestFor(jobId, component); const inh = il.inheritedFor(jobId); const set = il.variantSetFor(inh.ref, component);
  const blind = il.blindFor(jobId, component, me); const so = il.secondOpinionFor(jobId, component); const second = il.secondLabelFor(jobId, component);
  const [opinion, setOpinion] = useState<Opinion | null>(blind ? null : latest?.opinion ?? null); const [conf, setConf] = useState<Confidence>(blind ? 'likely' : latest?.confidence ?? 'likely');
  const [variant, setVariant] = useState(blind ? '' : latest?.variant ?? ''); const [tags, setTags] = useState<string[]>(blind ? [] : latest?.tags ?? []); const [notes, setNotes] = useState(blind ? '' : latest?.notes ?? '');
  const [picker, setPicker] = useState(false); const [hist, setHist] = useState(false); const [cand, setCand] = useState<string | undefined>(); const [err, setErr] = useState<string | null>(null); const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!blind && latest) { setOpinion(latest.opinion); setConf(latest.confidence); setVariant(latest.variant ?? ''); setTags(latest.tags); setNotes(latest.notes ?? ''); } }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shot = il.shotsFor(jobId, component)[0];
  const save = () => {
    if (!opinion) { setErr('Opinion is required to complete the sheet'); return; } setErr(null);
    try { if (blind) il.submitSecondOpinion(jobId, component, { opinion, confidence: conf, variant: variant || undefined, tags, notes }); else il.saveOpinion(jobId, component, { opinion, confidence: conf, variant: variant || undefined, tags, notes, variantCandidateId: cand }); setDirty(false); onSaved?.(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  const mark = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };
  const muted = dark ? 'text-slate-400' : 'text-ink-400'; const h = pad ? 'min-h-[44px] text-sm' : 'h-7 text-[11px]';
  const btn = (on: boolean, tone?: string) => clsx('rounded-md border px-2.5 font-medium transition-colors', h, on ? (tone ?? (dark ? 'border-accent bg-accent text-[#161b22]' : 'border-ink bg-ink text-white')) : dark ? 'border-white/15 text-slate-200 hover:bg-white/10' : 'border-line text-ink-700 hover:border-ink-300');
  const field = clsx('rounded-md border px-2', h, dark ? 'border-white/15 bg-white/5 text-white placeholder:text-slate-500' : 'border-line bg-canvas text-ink focus:border-ink focus:outline-none');
  return <div data-testid={id} data-opinion={latest?.opinion ?? 'none'} data-blind={blind} data-revision={latest?.revision ?? 0} className={clsx('rounded-md border p-3', dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-surface')}>
    <div className="flex flex-wrap items-center gap-2">
      <span className={clsx('font-semibold', pad ? 'text-base' : 'text-sm', dark ? 'text-white' : 'text-ink')}>{il.componentLabel(component)}{il.COMPONENTS.find((c) => c.key === component)?.opened && <span className={`ml-1 text-[10px] font-normal ${muted}`}>(when opened)</span>}</span>
      <span data-testid={`${id}-inherited`} className={`font-mono text-[10px] ${muted}`}>{inh.ref} · {inh.serialEra} · {inh.model}</span>
      {latest && !blind && <OpinionChip label={latest} dark={dark} testId={`${id}-chip`} />}
      {latest && !blind && <span data-testid={`${id}-signature`} className={`text-[10px] ${muted}`}>by {latest.by} · {fmtDate(latest.at)} {fmtTime(latest.at)} · {latest.station} · r{latest.revision}</span>}
      {so?.submittedAt && second && <span data-testid={`${id}-second`} data-agree={so.agree} className={clsx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1', so.agree ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-800 ring-rose-300')}><UserRound size={10} /> 2nd opinion {second.by}: {il.OPINIONS.find((o) => o.key === second.opinion)?.short} · {so.agree ? 'agrees' : 'DISAGREES'}</span>}
      {so && !so.submittedAt && <span data-testid={`${id}-second-pending`} className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-300">blind 2nd opinion requested by {so.requestedBy}</span>}
      <span className="ml-auto flex items-center gap-1">
        {latest && !blind && (latest.revision > 1 || so?.submittedAt) && <button type="button" data-testid={`${id}-history`} onClick={() => setHist((v) => !v)} className={`inline-flex items-center gap-1 text-[10px] ${muted} hover:opacity-80`}><History size={11} /> history</button>}
        {manager && latest && !so && <button type="button" data-testid={`${id}-request-second`} onClick={() => { il.requestSecondOpinion(jobId, component); onSaved?.(); }} className={`rounded-md border px-2 text-[10px] ${dark ? 'border-white/15 text-slate-200' : 'border-line text-ink-600 hover:border-ink-300'} ${pad ? 'min-h-[36px]' : 'h-6'}`}>Request blind 2nd opinion</button>}
        {latest && !blind && <button type="button" data-testid={`${id}-shareable`} aria-pressed={latest.shareable} title="Show this opinion on the client-facing inspection report (default OFF)" onClick={() => { il.setShareable(latest.id, !latest.shareable); onSaved?.(); }} className={clsx('inline-flex items-center gap-1 rounded-md border px-2 text-[10px]', pad ? 'min-h-[36px]' : 'h-6', latest.shareable ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : dark ? 'border-white/15 text-slate-400' : 'border-line text-ink-400')}>{latest.shareable ? <Eye size={10} /> : <EyeOff size={10} />} {latest.shareable ? 'shared with client' : 'not shared'}</button>}
      </span>
    </div>
    {blind && <div data-testid={`${id}-blind-banner`} className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900"><EyeOff size={11} className="mr-1 inline" /> Blind second opinion — the first opinion stays hidden until you submit yours. Photos and the shot list are open below.</div>}
    {hist && <ul data-testid={`${id}-revisions`} className={`mt-2 space-y-0.5 rounded-md px-2 py-1.5 text-[11px] ${dark ? 'bg-white/5' : 'bg-canvas'}`}>{il.revisionsFor(jobId, component).map((r) => <li key={r.id} data-testid={`${id}-rev-${r.revision}`}>r{r.revision} · {il.opinionLabel(r.opinion)} ({r.confidence}){r.variant ? ` · ${r.variant}` : ''}{r.tags.length ? ` · ${r.tags.map((t) => `#${t}`).join(' ')}` : ''} — {r.by} · {fmtDate(r.at)} {fmtTime(r.at)}</li>)}{second && <li data-testid={`${id}-rev-second`} className={so?.agree ? 'text-emerald-700' : 'text-rose-700'}>2nd · {il.opinionLabel(second.opinion)} ({second.confidence}){second.tags.length ? ` · ${second.tags.map((t) => `#${t}`).join(' ')}` : ''} — {second.by} · {fmtDate(second.at)}{second.notes ? ` · “${second.notes}”` : ''}</li>}</ul>}
    <div className="mt-2 grid gap-2">
      <div className="flex flex-wrap items-center gap-1" data-testid={`${id}-opinions`}><span className={`w-16 text-[10px] uppercase tracking-wide ${muted}`}>Opinion</span>{il.OPINIONS.map((o) => <button key={o.key} type="button" data-testid={`${id}-opt-${o.key}`} aria-pressed={opinion === o.key} onClick={() => mark(setOpinion)(o.key)} className={btn(opinion === o.key, `border-transparent ${OPINION_TONE[o.key].chip} ring-1`)}>{o.label}</button>)}</div>
      <div className="flex flex-wrap items-center gap-1" data-testid={`${id}-confidence`}><span className={`w-16 text-[10px] uppercase tracking-wide ${muted}`}>Confidence</span>{CONF.map((c) => <button key={c} type="button" data-testid={`${id}-conf-${c}`} aria-pressed={conf === c} onClick={() => mark(setConf)(c)} className={btn(conf === c)}>{c}</button>)}</div>
      <div className="flex flex-wrap items-center gap-1" data-testid={`${id}-variant`}><span className={`w-16 text-[10px] uppercase tracking-wide ${muted}`}>Variant</span>
        {set ? <><button type="button" data-testid={`${id}-variant-open`} onClick={() => setPicker(true)} className={btn(!!variant)}>{variant || 'Pick variant…'}</button><span className={`text-[10px] ${muted}`}>{set.variants.map((v) => v.key).join(' · ')} · Unsure · new?</span></>
          : <><input data-testid={`${id}-variant-input`} list={`${id}-marks`} value={variant} onChange={(e) => mark(setVariant)(e.target.value)} placeholder="Mark / variant (typeahead)" className={`${field} w-48`} /><datalist id={`${id}-marks`}>{il.marksUsedFor(inh.ref, component).map((m) => <option key={m} value={m} />)}</datalist><span className={`text-[10px] ${muted}`}>no variant set for {inh.ref || 'this ref'} · {il.componentLabel(component)}</span></>}
        {cand && <span data-testid={`${id}-variant-candidate`} className="rounded-sm bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-300">new-variant candidate opened</span>}
      </div>
      <TagChipsNotes component={component} tags={tags} notes={notes} onTags={mark(setTags)} onNotes={mark(setNotes)} pad={pad} dark={dark} testId={`${id}-tags`} />
      <div className="flex flex-wrap items-center gap-2">
        {err && <span data-testid={`${id}-error`} className="text-[11px] text-rose-600">{err}</span>}
        <span className={`ml-auto text-[10px] ${muted}`}>{blind ? 'submits as a second opinion' : latest ? (dirty ? `will save as revision ${latest.revision + 1}` : `saved · r${latest.revision}`) : 'completes this row'}</span>
        <button type="button" data-testid={`${id}-save`} onClick={save} className={clsx('inline-flex items-center gap-1 rounded-md px-3 font-semibold', pad ? 'min-h-[44px] text-sm' : 'h-7 text-xs', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}><Save size={12} /> {blind ? 'Submit 2nd opinion' : latest ? 'Save revision' : 'Save opinion'}</button>
      </div>
    </div>
    {picker && set && <VariantPicker set={set} shotUrl={shot?.displayUrl} value={variant} onPick={(k) => { mark(setVariant)(k); setPicker(false); }} onNone={() => { const c = il.proposeVariant(inh.ref, component, jobId); setCand(c.id); mark(setVariant)('New variant (candidate)'); setPicker(false); }} onClose={() => setPicker(false)} dark={dark} />}
  </div>;
};
