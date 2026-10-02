import clsx from 'clsx';
import { ArrowRight, Camera, Search } from 'lucide-react';
import { useState } from 'react';
import * as wm8 from '@/api/watchm8';
import type { RankedVariant, ShotKey, VariantReport } from '@/api/watchm8';
import { HandoffBlock, MOCK_BADGE, RwBtn, RwCard, RwField, RwH, SaveResults, ShareCard, ShotStrip, rwInput, useDevice } from './RwcomBits';
import { shotList, type RwState } from './rwState';

type Stage = 'setup' | 'shots' | 'report';
const REQUIRED: ShotKey[] = ['dial', 'bezel']; const OPTIONAL: ShotKey[] = ['clasp', 'endlinks']; const ALL: ShotKey[] = [...REQUIRED, ...OPTIONAL];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const yearsOf = (v: [number, number]) => `${v[0]}–${v[1] === 2026 ? 'present' : v[1]}`;
const FRAMING = 'Consistency check against reference data — not an authentication.';

// Ranked exemplars for one part (dial · insert): similarity bar, tie flag, serial-era consistency line
const VariantList = ({ title, ranked, era, testId }: { title: string; ranked: RankedVariant[]; era: VariantReport['era']; testId: string }) => {
  const device = useDevice(); const [best, second] = ranked;
  return (
    <RwCard testId={testId}>
      <div className="flex items-baseline justify-between gap-2"><h3 className="font-serif text-lg">{title}</h3><span className="text-xs text-rc-muted">{ranked.length} known variant{ranked.length === 1 ? '' : 's'} for this reference</span></div>
      {second?.tie && <p data-testid={`${testId}-tie`} className="mt-1 text-sm text-amber-800">Too close to call between <span className="font-medium">{best.variant.label}</span> and <span className="font-medium">{second.variant.label}</span> — a sharper photo of the text at 6 o’clock would separate them.</p>}
      <ol className={clsx('mt-3 grid gap-3', device === 'desktop' && 'grid-cols-2')}>
        {ranked.map((rv, i) => { const line = wm8.consistency(rv.variant, era); const tone = line.startsWith('NOT') ? 'text-amber-800' : line.startsWith('serial era unknown') ? 'text-rc-muted' : 'text-moss-700'; return (
          <li key={rv.variant.key} data-testid={`${testId}-${rv.variant.key}`} data-rank={i + 1} data-tie={rv.tie} className={clsx('rounded-lg border p-3', i === 0 ? 'border-rc-ink bg-white' : 'border-rc-line bg-white/60')}>
            <div className="flex gap-3"><img src={rv.variant.img} alt={rv.variant.label} className="h-16 w-20 shrink-0 rounded-md object-cover ring-1 ring-rc-line" /><div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{rv.variant.label}</span>{i === 0 && <span className="rounded-full bg-moss-50 px-2 py-0.5 text-[11px] font-semibold text-moss-700">closest</span>}{rv.tie && <span data-testid={`${testId}-${rv.variant.key}-tie`} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">tie</span>}</div>
              <div className="text-xs text-rc-muted">{yearsOf(rv.variant.years)}</div>
              <div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-rc-accentSoft"><div className="h-full rounded-full bg-rc-ink" style={{ width: pct(rv.similarity) }} /></div><span data-testid={`${testId}-${rv.variant.key}-sim`} className="font-mono text-xs">{pct(rv.similarity)}</span></div>
            </div></div>
            <p data-testid={`${testId}-${rv.variant.key}-era`} className={clsx('mt-2 text-xs', tone)}>{line}</p>
            <p className="mt-0.5 text-xs text-rc-muted">{rv.variant.notes}</p>
          </li>); })}
      </ol>
    </RwCard>
  );
};

// The authority piece: end-link number vs reference · bracelet type vs case era. Always in the report — "not checked" when the optional shots are missing.
const BraceletLine = ({ rep, onAdd }: { rep: VariantReport; onAdd: () => void }) => {
  const r = rep.ref; const checked = !!(rep.clasp || rep.endLinks);
  const verdict = !checked ? 'unchecked' : rep.clasp?.vsCase.startsWith('add a serial') && (rep.endLinks?.ok ?? true) ? 'partial' : (rep.endLinks?.ok ?? true) && !rep.clasp?.vsCase.includes('different era') ? 'consistent' : 'inconsistent';
  const missing = ALL.filter((k) => OPTIONAL.includes(k) && !(k === 'clasp' ? rep.clasp : rep.endLinks));
  return (
    <RwCard testId="check-bracelet">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-serif text-lg">Bracelet</h3><span data-testid="check-bracelet-verdict" data-verdict={verdict} className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', verdict === 'consistent' ? 'bg-moss-50 text-moss-700' : verdict === 'inconsistent' ? 'bg-amber-50 text-amber-800' : 'bg-rc-accentSoft text-rc-muted')}>{verdict === 'consistent' ? 'consistent with the reference' : verdict === 'inconsistent' ? 'does not line up — see below' : verdict === 'partial' ? 'end links checked · add a serial prefix for the era' : 'not checked'}</span></div>
      <p className="mt-2 text-xs text-rc-muted">Fitted to the {r.ref} from the factory: {r.bracelets.map((b) => `${b.code} ${b.name}${b.years ? ` (${b.years})` : ''}`).join(' · ')}</p>
      {rep.endLinks && <p data-testid="check-endlinks" data-ok={rep.endLinks.ok} className={clsx('mt-2 text-sm', rep.endLinks.ok ? 'text-moss-700' : 'text-amber-800')}>End links — {rep.endLinks.note}.</p>}
      {rep.clasp && <p data-testid="check-clasp" className="mt-1 text-sm">Clasp code <span className="font-mono font-medium">{rep.clasp.code}</span> = {rep.clasp.name}{rep.clasp.years ? ` (${rep.clasp.years})` : ''} — <span className={rep.clasp.vsCase.includes('different era') ? 'text-amber-800' : 'text-rc-muted'}>{rep.clasp.vsCase}</span>.</p>}
      {!checked && <p data-testid="check-bracelet-unchecked" className="mt-2 text-sm text-rc-muted">Not checked — add a clasp photo and an end-link photo and we compare the bracelet against the {r.ref} table.</p>}
      {missing.length > 0 && <RwBtn tone={checked ? 'link' : 'quiet'} className="mt-3" data-testid="check-bracelet-add" onClick={onAdd}><Camera size={14} /> {checked ? `Add the ${missing.map((k) => wm8.SHOTS[k].title.toLowerCase()).join(' and ')} photo for the full bracelet line` : 'Add bracelet photos'}</RwBtn>}
    </RwCard>
  );
};

// CHECK — "Is my dial / bezel correct?" ref (+ serial prefix) → dial + bezel shots (clasp / end links optional) → ranked variants + bracelet line + framing
export const CheckTab = ({ state, update, goTab }: { state: RwState; update: (p: Partial<RwState>) => void; goTab: (t: 'identify' | 'request') => void }) => {
  const device = useDevice();
  const [stage, setStage] = useState<Stage>('setup');
  const [ref, setRef] = useState(state.ref ?? ''); const [serial, setSerial] = useState(state.serialPrefix ?? '');
  const [rep, setRep] = useState<VariantReport | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const row = wm8.refByCode(ref); const ready = REQUIRED.every((k) => !!state.shots[k]);
  const begin = () => { if (!row) return; update({ ref: row.ref, brand: row.brand, model: row.model, serialPrefix: serial }); setStage('shots'); };
  const run = async () => {
    if (!row) return; setBusy(true); setErr(null);
    try { const r = await wm8.rankVariants(row.ref, state.shots, serial); wm8.instrument({ tab: 'check', kind: 'engine', device, ms: r.ms, detail: `rank-variants → dial ${r.dial[0].variant.label} ${pct(r.dial[0].similarity)}${r.dial[1]?.tie ? ' (tie)' : ''} · insert ${r.insert[0].variant.label} ${pct(r.insert[0].similarity)}${r.clasp ? ` · clasp ${r.clasp.code}` : ''}${r.endLinks ? ` · end links ${r.endLinks.ok ? 'match' : 'mismatch'}` : ''}` }); setRep(r); setStage('report'); }
    catch (e) { setErr(e instanceof Error ? e.message : 'The check failed — try again'); } finally { setBusy(false); }
  };
  const retake = (k: ShotKey) => { update({ shots: { ...state.shots, [k]: undefined } }); setRep(null); setStage('shots'); };
  const permalink = `${window.location.origin}/rwcom?tab=check${row ? `&ref=${row.ref}` : ''}`;
  const eraLine = rep?.era ? `Era ${rep.era.years} · ${rep.era.how}` : 'Add a serial prefix to compare each variant against your watch’s era';

  return (
    <div className="space-y-5" data-testid="check-tab" data-stage={stage}>
      {stage === 'setup' && <>
        <RwH sub="Two photos — dial and bezel — ranked against every known variant for your reference. Add the clasp and end links and we check the bracelet too.">Is my dial &amp; bezel correct?</RwH>
        <RwCard testId="check-setup">
          <div className={clsx('grid gap-4', device === 'desktop' && 'grid-cols-2')}>
            <RwField label="Reference" hint={row ? `${row.brand} ${row.model} · ${yearsOf(row.years)}` : 'Between the lugs at 12, or on your papers'}>
              <input data-testid="check-ref" list="wm8-refs" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 16233" className={clsx(rwInput, 'font-mono')} />
              <datalist id="wm8-refs">{wm8.REFS.map((r) => <option key={r.ref} value={r.ref}>{r.brand} {r.model}</option>)}</datalist>
            </RwField>
            <RwField label="Serial prefix (optional)" hint="Lets us compare each variant’s years with your watch’s era. Only the first characters — the last three are masked."><input data-testid="check-serial" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. L or 6.1" className={clsx(rwInput, 'font-mono')} /></RwField>
          </div>
          {ref.trim() && !row && <p data-testid="check-ref-unknown" className="mt-3 text-sm text-amber-800">We don’t have {ref.trim()} in the reference table yet — you can still <RwBtn tone="link" className="min-h-0 text-sm" data-testid="check-unknown-request" onClick={() => goTab('request')}>send a request</RwBtn> and we’ll look at it in person.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3"><RwBtn data-testid="check-begin" disabled={!row} onClick={begin}><Camera size={15} /> Take the photos</RwBtn><RwBtn tone="link" data-testid="check-identify-first" onClick={() => goTab('identify')}>Don’t know the reference? Identify it first</RwBtn></div>
        </RwCard>
      </>}

      {stage === 'shots' && row && <>
        <RwH sub="Dial and bezel are required. Clasp and end links are optional — they power the bracelet line.">{row.brand} {row.model} · <span className="font-mono">{row.ref}</span></RwH>
        <div className="flex flex-wrap gap-2 text-xs" data-testid="check-progress">{ALL.map((k) => <span key={k} data-testid={`check-shot-${k}`} data-done={!!state.shots[k]} className={clsx('rounded-full px-2 py-0.5 ring-1', state.shots[k] ? 'bg-moss-50 text-moss-800 ring-moss-200' : 'text-rc-muted ring-rc-line')}>{wm8.SHOTS[k].title}{state.shots[k] ? ' ✓' : REQUIRED.includes(k) ? '' : ' · optional'}</span>)}</div>
        <HandoffBlock tab="check" shots={ALL} done={state.shots} onShot={(k, d) => update({ shots: { ...state.shots, [k]: d } })} />
        {err && <p data-testid="check-error" className="text-sm text-rose-700">{err}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <RwBtn data-testid="check-run" disabled={!ready || busy} onClick={() => void run()}><Search size={15} /> {busy ? 'Comparing…' : 'Run the check'}</RwBtn>
          {!ready && <span className="text-sm text-rc-muted">Take the dial and bezel photos first</span>}{busy && MOCK_BADGE}
          <RwBtn tone="link" data-testid="check-back" onClick={() => setStage('setup')}>Change reference</RwBtn>
        </div>
      </>}

      {stage === 'report' && rep && <>
        <RwH sub={<><span data-testid="check-era">{eraLine}</span> · {MOCK_BADGE} <span className="text-xs">rank-variants · {rep.ms} ms</span></>}>{rep.ref.brand} {rep.ref.model} · <span className="font-mono">{rep.ref.ref}</span></RwH>
        <ShotStrip shots={state.shots} onRetake={retake} />
        <VariantList title="Dial" ranked={rep.dial} era={rep.era} testId="check-dial" />
        <VariantList title="Bezel / insert" ranked={rep.insert} era={rep.era} testId="check-insert" />
        <BraceletLine rep={rep} onAdd={() => setStage('shots')} />
        <p data-testid="check-framing" className="border-t border-rc-line pt-3 text-sm italic text-rc-muted">{FRAMING}</p>
        <div className={clsx('grid gap-2', device === 'desktop' && 'grid-cols-3')}>
          <RwBtn data-testid="check-cta-request" onClick={() => goTab('request')}>Request service <ArrowRight size={15} /></RwBtn>
          <RwBtn tone="quiet" data-testid="check-rerun" onClick={() => setStage('shots')}>Retake or add photos</RwBtn>
          <SaveResults results={{ check: { ref: rep.ref.ref, dial: rep.dial[0].variant.label, insert: rep.insert[0].variant.label, clasp: rep.clasp?.code, endLinks: rep.endLinks?.ok, era: rep.era?.years }, ref: rep.ref.ref, serialPrefix: serial }} photos={shotList(state.shots)} claim={state.claim} onSaved={(code) => update({ claim: code })} />
        </div>
        <ShareCard testId="check-share" title={`${rep.ref.brand} ${rep.ref.model} · ${rep.ref.ref}`} lines={[`Dial: ${rep.dial[0].variant.label} (${pct(rep.dial[0].similarity)})`, `Bezel: ${rep.insert[0].variant.label} (${pct(rep.insert[0].similarity)})`, rep.clasp ? `Bracelet: ${rep.clasp.code} ${rep.clasp.name}` : rep.endLinks ? `End links: ${rep.endLinks.ok ? 'match' : 'mismatch'}` : 'Bracelet: not checked', FRAMING]} permalink={permalink} />
      </>}
    </div>
  );
};
