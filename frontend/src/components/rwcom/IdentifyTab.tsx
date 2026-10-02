import clsx from 'clsx';
import { ArrowRight, HelpCircle, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as wm8 from '@/api/watchm8';
import type { IdentifyResult, BraceletResult, ShotKey } from '@/api/watchm8';
import { Choice, GuidedShot, HandoffBlock, MOCK_BADGE, RwBtn, RwCard, RwField, RwH, SaveResults, ShareCard, rwInput, useDevice } from './RwcomBits';
import { maskSerial, shotList, type RwState } from './rwState';

type Stage = 'photo' | 'candidates' | 'tree' | 'bracelet' | 'result';

// IDENTIFY — "What Rolex do I have?" photo first → top-3 refs → confirm, or the question tree → bracelet → result card
export const IdentifyTab = ({ state, update, goTab }: { state: RwState; update: (p: Partial<RwState>) => void; goTab: (t: 'check' | 'request') => void }) => {
  const device = useDevice();
  const [stage, setStage] = useState<Stage>(state.ref ? 'result' : 'photo');
  const [idr, setIdr] = useState<IdentifyResult | null>(null); const [busy, setBusy] = useState(false);
  const [node, setNode] = useState('brand'); const [path, setPath] = useState<string[]>([]); const [treeRefs, setTreeRefs] = useState<{ refs: string[]; note?: string } | null>(null);
  const [claspMode, setClaspMode] = useState(false); const [bres, setBres] = useState<BraceletResult | null>(null);
  const [serial, setSerial] = useState(state.serialPrefix ?? '');
  const r = state.ref ? wm8.refByCode(state.ref) : undefined;
  useEffect(() => { if (state.ref && stage === 'photo') setStage('result'); }, [state.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const onShot = async (key: ShotKey, dataUrl: string) => {
    update({ shots: { ...state.shots, [key]: dataUrl } }); if (key !== 'dial') return;
    setBusy(true); const res = await wm8.identifyModel(dataUrl); wm8.instrument({ tab: 'identify', kind: 'engine', device, ms: res.ms, detail: `identify-model → ${res.candidates.map((c) => `${c.ref} ${Math.round(c.confidence * 100)}%`).join(', ')}` }); setIdr(res); setBusy(false); setStage('candidates');
  };
  const pickRef = (ref: string) => { const row = wm8.refByCode(ref); update({ ref, brand: row?.brand, model: row?.model, bracelet: undefined }); setStage(row ? 'bracelet' : 'result'); };
  const answer = (o: wm8.QOption) => { const n = wm8.questionNode(node); setPath([...path, `${n.q} → ${o.label}`]); if (o.next) setNode(o.next); else setTreeRefs({ refs: o.refs ?? [], note: o.note }); };
  const resetTree = () => { setNode('brand'); setPath([]); setTreeRefs(null); };
  const typical = r ? wm8.typicalLine(wm8.typicalFor(r.ref, [])) : null; const era = wm8.eraFromSerial(serial, r);
  const permalink = `${window.location.origin}/rwcom?tab=identify${state.ref ? `&ref=${state.ref}` : ''}${state.bracelet ? `&b=${encodeURIComponent(state.bracelet)}` : ''}`;

  return (
    <div className="space-y-5" data-testid="identify-tab" data-stage={stage}>
      {stage === 'photo' && <>
        <RwH sub="One photo of the dial is usually enough. Crown on the right, no glare.">What Rolex do I have?</RwH>
        <HandoffBlock tab="identify" shots={['dial']} done={state.shots} onShot={(k, d) => void onShot(k, d)} />
        {busy && <p data-testid="identify-busy" className="text-sm text-rc-muted">Looking at the dial… {MOCK_BADGE}</p>}
        <RwBtn tone="link" data-testid="identify-skip-photo" onClick={() => { resetTree(); setStage('tree'); }}><HelpCircle size={15} /> No photo handy? Answer a few questions instead</RwBtn>
      </>}

      {stage === 'candidates' && idr && <>
        <RwH sub={<>Tap the one that matches. {MOCK_BADGE} <span className="text-xs">identify-model · {idr.ms} ms</span></>}>Looks like one of these</RwH>
        <div className={clsx('grid gap-3', device === 'desktop' && 'grid-cols-3')}>{idr.candidates.map((c, i) => <button key={c.ref} type="button" data-testid={`candidate-${c.ref}`} onClick={() => pickRef(c.ref)} className="rounded-xl border border-rc-line bg-rc-paper p-3 text-left hover:border-rc-ink"><img src={c.thumb} alt={c.ref} className="aspect-[4/3] w-full rounded-lg object-cover" /><div className="mt-2 flex items-center justify-between"><div><div className="font-medium">{c.brand} {c.model}</div><div className="font-mono text-sm text-rc-muted">ref {c.ref}</div></div><span data-testid={`candidate-band-${c.ref}`} className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', c.band === 'high' ? 'bg-moss-50 text-moss-800' : c.band === 'medium' ? 'bg-amber-50 text-amber-800' : 'bg-rc-accentSoft text-rc-muted')}>{i === 0 ? 'best match' : c.band} · {Math.round(c.confidence * 100)}%</span></div></button>)}</div>
        <div className="flex flex-wrap gap-3"><RwBtn tone="quiet" data-testid="identify-none" onClick={() => { resetTree(); setStage('tree'); }}>None of these</RwBtn><RwBtn tone="link" data-testid="identify-retake" onClick={() => { update({ shots: { ...state.shots, dial: undefined } }); setStage('photo'); }}>Retake the photo</RwBtn></div>
      </>}

      {stage === 'tree' && (() => { const n = wm8.questionNode(node); return <>
        <RwH sub="A few questions narrow it down — no photo needed.">Let’s narrow it down</RwH>
        {path.length > 0 && <ol data-testid="tree-path" className="space-y-0.5 text-xs text-rc-muted">{path.map((p) => <li key={p}>{p}</li>)}</ol>}
        {!treeRefs ? <RwCard testId={`tree-node-${n.id}`}><div className="text-[15px] font-medium">{n.q}</div>{n.help && <p className="mt-1 text-sm text-rc-muted">{n.help}</p>}<div className="mt-3 grid gap-2">{n.options.map((o) => <Choice key={o.label} on={false} big testId={`tree-opt-${n.id}-${n.options.indexOf(o)}`} onClick={() => answer(o)}>{o.label}</Choice>)}</div></RwCard>
          : <RwCard testId="tree-result">{treeRefs.refs.length ? <><div className="text-[15px] font-medium">{treeRefs.refs.length === 1 ? 'That points to one reference' : 'A short list — tap the one that looks right'}</div><div className={clsx('mt-3 grid gap-3', device === 'desktop' && treeRefs.refs.length > 1 && 'grid-cols-2')}>{treeRefs.refs.map((ref) => { const row = wm8.refByCode(ref); return <button key={ref} type="button" data-testid={`tree-ref-${ref}`} onClick={() => pickRef(ref)} className="rounded-xl border border-rc-line bg-white p-3 text-left hover:border-rc-ink"><img src={row?.thumb ?? wm8.ph(`${ref} · not in the seeded table`)} alt={ref} className="aspect-[4/3] w-full rounded-lg object-cover" /><div className="mt-2 font-medium">{row ? `${row.brand} ${row.model}` : 'Reference'} <span className="font-mono text-sm text-rc-muted">{ref}</span></div>{!row && <div className="text-xs text-rc-muted">Not in the seeded refs table — the result card will be thin.</div>}</button>; })}</div></> : <p className="text-[15px]">{treeRefs.note ?? 'We could not narrow it down.'}</p>}<div className="mt-3 flex gap-3"><RwBtn tone="link" data-testid="tree-restart" onClick={resetTree}>Start over</RwBtn><RwBtn tone="link" data-testid="tree-photo" onClick={() => setStage('photo')}>Try a photo</RwBtn></div></RwCard>}
      </>; })()}

      {stage === 'bracelet' && r && <>
        <RwH sub={`Only the bracelets Rolex fitted to the ${r.ref} are shown.`}>Which bracelet is on it?</RwH>
        {!claspMode ? <>
          <div className={clsx('grid gap-3', device === 'desktop' && 'grid-cols-3')}>{r.bracelets.map((b) => <button key={b.code} type="button" data-testid={`bracelet-${b.code}`} onClick={() => { update({ bracelet: `${b.name} · ${b.code}` }); setStage('result'); }} className="rounded-xl border border-rc-line bg-rc-paper p-3 text-left hover:border-rc-ink"><img src={b.img} alt={b.name} className="aspect-[4/3] w-full rounded-lg object-cover" /><div className="mt-2 font-medium">{b.name}</div><div className="font-mono text-xs text-rc-muted">{b.code}{b.years ? ` · ${b.years}` : ''}</div></button>)}</div>
          <div className="flex flex-wrap gap-3"><RwBtn tone="quiet" data-testid="bracelet-unsure" onClick={() => setClaspMode(true)}>Not sure? Photograph the clasp</RwBtn><RwBtn tone="link" data-testid="bracelet-skip" onClick={() => setStage('result')}>Skip</RwBtn></div>
        </> : <>
          {!bres ? <GuidedShot shot="clasp" tab="identify" onDone={async (d) => { update({ shots: { ...state.shots, clasp: d } }); const t = performance.now(); const res = await wm8.braceletCheck(r.ref, d); wm8.instrument({ tab: 'identify', kind: 'engine', device, ms: Math.round(performance.now() - t), detail: `bracelet-check → ${res.code} ${Math.round(res.confidence * 100)}%` }); setBres(res); }} />
            : <RwCard testId="bracelet-result"><p className="text-[15px]">Looks like <span className="font-medium">{bres.name}</span> · <span className="font-mono">{bres.code}</span> <span className="text-rc-muted">({Math.round(bres.confidence * 100)}% · {bres.band})</span> {MOCK_BADGE}</p><div className="mt-3 flex gap-3"><RwBtn data-testid="bracelet-accept" onClick={() => { update({ bracelet: `${bres.name} · ${bres.code}` }); setStage('result'); }}>That’s it</RwBtn><RwBtn tone="quiet" data-testid="bracelet-pick-manually" onClick={() => { setBres(null); setClaspMode(false); }}>Pick from the list</RwBtn></div></RwCard>}
        </>}
      </>}

      {stage === 'result' && <>
        <RwH sub={r?.blurb}>{r ? `${r.brand} ${r.model}` : 'Your watch'}</RwH>
        <RwCard testId="identify-result">
          <dl className={clsx('grid gap-x-6 gap-y-2 text-[15px]', device === 'desktop' && 'grid-cols-2')}>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-rc-muted">Reference</dt><dd className="font-mono" data-testid="result-ref">{state.ref ?? '—'}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-rc-muted">Bracelet</dt><dd data-testid="result-bracelet">{state.bracelet ?? 'not recorded'}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-rc-muted">Era</dt><dd data-testid="result-era">{era ? `${era.years} · ${era.how}` : r ? `${r.years[0]}–${r.years[1] === 2026 ? 'present' : r.years[1]} (reference) · add a serial prefix for your watch’s years` : '—'}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-rc-muted">Typical service</dt><dd data-testid="result-typical">{typical ?? '—'} <span className="text-xs text-rc-muted">· a range, not a quote</span></dd></div>
          </dl>
          <div className="mt-4 max-w-[320px]"><RwField label="Serial prefix (optional)" hint="Between the lugs at 6 or on the rehaut. Only the first characters matter; we mask the last three."><input data-testid="result-serial" value={serial} onChange={(e) => { setSerial(e.target.value); update({ serialPrefix: e.target.value }); }} placeholder="e.g. L or 6.1" className={clsx(rwInput, 'font-mono')} />{serial && <span className="mt-1 block font-mono text-xs text-rc-muted">shown as {maskSerial(serial)}</span>}</RwField></div>
        </RwCard>
        <div className={clsx('grid gap-2', device === 'desktop' && 'grid-cols-3')}>
          <RwBtn data-testid="cta-check" onClick={() => goTab('check')}><Search size={15} /> Check dial &amp; bezel variants</RwBtn>
          <RwBtn tone="quiet" data-testid="cta-request" onClick={() => goTab('request')}>Request service <ArrowRight size={15} /></RwBtn>
          <SaveResults results={{ ref: state.ref, bracelet: state.bracelet, serialPrefix: serial }} photos={shotList(state.shots)} claim={state.claim} onSaved={(code) => update({ claim: code })} />
        </div>
        <ShareCard testId="identify-share" title={r ? `${r.brand} ${r.model} · ${r.ref}` : 'My watch'} lines={[state.bracelet ? `Bracelet: ${state.bracelet}` : 'Bracelet: not recorded', era ? `Era: ${era.years}` : r ? `Made ${r.years[0]}–${r.years[1] === 2026 ? 'present' : r.years[1]}` : '', typical ?? ''].filter(Boolean)} permalink={permalink} />
        <RwBtn tone="link" data-testid="identify-start-over" onClick={() => { update({ ref: undefined, brand: undefined, model: undefined, bracelet: undefined, shots: {} }); setIdr(null); setBres(null); setClaspMode(false); setStage('photo'); }}>Start over</RwBtn>
      </>}
    </div>
  );
};
