import clsx from 'clsx';
import { Camera, Check, ChevronRight, Microscope, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as il from '@/api/inspectionLabels';
import type { InspectionShot, LabelComponent } from '@/api/inspectionLabels';
import { OpinionChip } from './OpinionBits';
import { Button } from '@/components/ui/Button';
import { placeholderFrame, useStepCamera } from '@/hooks/useStepCamera';
import { fmtDate, fmtTime } from '@/lib/format';

// Guided per-component shot list — fixed sequence, overlay frame, retake, same dual-camera engine as the 11-step auth capture. Original + display stored; controlled = fixed rig (training set).
export const GuidedShotCapture = ({ jobId, component, controlled, onShot, onClose }: { jobId: string; component: LabelComponent; controlled?: boolean; onShot?: (s: InspectionShot) => void; onClose: () => void }) => {
  const list = il.shotLists[component]; const firstMissing = Math.max(0, list.findIndex((d) => !il.shotFor(jobId, component, d.key)));
  const [idx, setIdx] = useState(firstMissing); const def = list[idx]; const total = list.length;
  const { videoRef, status, capture, cams, active, manual, setManual } = useStepCamera(def.cam, def.key);
  const existing = il.shotFor(jobId, component, def.key); const [shot, setShot] = useState<string | null>(existing?.displayUrl ?? null);
  useEffect(() => { setShot(il.shotFor(jobId, component, def.key)?.displayUrl ?? null); }, [idx, jobId, component, def.key]);
  const snap = () => { const c = capture(); setShot(c.dataUrl || placeholderFrame(`${il.componentLabel(component)} · ${def.label}`, def.cam)); };
  const next = () => { if (!shot) return; if (shot !== existing?.displayUrl) { const s = il.recordShot({ jobId, component, shotKey: def.key, dataUrl: shot, cameraId: active.label, controlled }); onShot?.(s); } if (idx < total - 1) setIdx(idx + 1); else onClose(); };
  const have = list.filter((d) => il.shotFor(jobId, component, d.key)).length;
  return <div data-testid="guided-shots" data-component={component} data-step={idx + 1} data-shot-key={def.key} data-cam={def.cam} className="fixed inset-0 z-[85] flex flex-col bg-black/90 text-white">
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold" data-testid="guided-counter">{il.componentLabel(component)} · shot {idx + 1} of {total}</span>
      <span className="text-base font-semibold" data-testid="guided-label">{def.label}</span>
      <span data-testid="guided-cam" className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase ${def.cam === 'ipevo' ? 'bg-white/20' : 'bg-cyan-500/30 text-cyan-100'}`}>{def.cam === 'ipevo' ? <Camera size={11} /> : <Microscope size={11} />} {def.cam === 'ipevo' ? 'IPEVO' : 'Microscope'}</span>
      <span data-testid="guided-controlled" className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase ${(controlled ?? il.isControlledStation('')) ? 'bg-emerald-500/30 text-emerald-100' : 'bg-amber-500/30 text-amber-100'}`}>{controlled ? 'controlled rig · training set' : controlled === false ? 'ad-hoc · not training' : 'controlled by station'}</span>
      <label className="ml-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs"><span className="text-white/60">Camera</span><select data-testid="guided-camera-select" value={active.deviceId} onChange={(e) => setManual(e.target.value)} className="max-w-[220px] bg-transparent font-medium text-white focus:outline-none">{cams.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label}</option>)}</select><span className="rounded-sm bg-white/20 px-1.5 text-[10px] uppercase">{manual ? 'manual' : 'auto'}</span></label>
      <span className="text-xs text-white/60">{status === 'ready' ? 'camera live' : 'no camera — placeholder frames'}</span>
      <button data-testid="guided-close" onClick={onClose} className="rounded-full bg-white/10 p-1.5" aria-label="Close"><X size={16} /></button>
    </div>
    <div className="flex flex-wrap gap-1 px-5" data-testid="guided-strip">{list.map((d, i) => { const s = il.shotFor(jobId, component, d.key); return <button key={d.key} type="button" data-testid={`guided-step-${d.key}`} data-state={s ? 'done' : i === idx ? 'current' : 'todo'} onClick={() => setIdx(i)} className={clsx('h-7 rounded-full border px-2.5 text-[11px]', i === idx ? 'border-white bg-white text-black' : s ? 'border-emerald-400/60 text-emerald-200' : 'border-white/20 text-white/60')}>{i + 1} · {d.label}</button>; })}</div>
    <div className="relative mx-auto grid w-full max-w-5xl flex-1 grid-cols-[1fr_300px] gap-4 px-5 py-4">
      <div className="relative">
        <video ref={videoRef} autoPlay playsInline muted className={`h-full max-h-[54vh] w-full rounded-xl bg-black object-cover ${def.cam === 'microscope' ? 'ring-4 ring-cyan-400/60' : ''}`} />
        <svg data-testid="guided-overlay" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 60" preserveAspectRatio="none"><rect x="12" y="8" width="76" height="44" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4" strokeDasharray="2 1.5" /><line x1="50" y1="8" x2="50" y2="52" stroke="rgba(255,255,255,.25)" strokeWidth=".25" /><line x1="12" y1="30" x2="88" y2="30" stroke="rgba(255,255,255,.25)" strokeWidth=".25" /></svg>
        <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs">{active.label} · frame: {def.label}</span>
        {shot && <img src={shot} alt="" data-testid="guided-preview" className="absolute bottom-3 right-3 h-28 w-40 rounded-md object-cover ring-2 ring-white" />}
      </div>
      <div className="space-y-3 rounded-xl bg-white/5 p-3 text-sm">
        <div className="text-xs text-white/60">Same crop / orientation every time — line the component up inside the dashed frame.</div>
        <div className="text-xs text-white/60">{have} of {total} captured{existing && <span className="ml-1 text-emerald-200">· this shot exists (retake replaces the display, original kept)</span>}</div>
        <div className="flex items-center gap-2">
          <button type="button" data-testid="guided-shutter" onClick={snap} className="h-14 w-14 rounded-full border-4 border-white bg-white/20" aria-label="Shutter" />
          {existing && <button type="button" data-testid="guided-retake" onClick={snap} className="inline-flex h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-xs"><RefreshCw size={12} /> Retake</button>}
          <Button variant="primary" data-testid="guided-next" disabled={!shot} onClick={next} className="flex-1">{idx < total - 1 ? <>Next <ChevronRight size={14} /></> : <><Check size={14} /> Finish</>}</Button>
        </div>
        <p className="text-[10px] text-white/40">Stored: unprocessed original + display version · no destructive crop · no auto-enhance on the original.</p>
      </div>
    </div>
  </div>;
};

// Shot grid per component — thumbs keyed to the shot list, retake, missing slots; tap → viewer with the opinion chip + tags on the shot
export const ShotGrid = ({ jobId, component, dark, onRetake, testId }: { jobId: string; component: LabelComponent; dark?: boolean; onRetake?: (key: string) => void; testId?: string }) => {
  const id = testId ?? `shots-${component}`; const list = il.shotLists[component]; const extras = il.shotsFor(jobId, component).filter((s) => s.adHoc); const [open, setOpen] = useState<InspectionShot | null>(null); const label = il.latestFor(jobId, component);
  if (!list.length && !extras.length) return null;
  return <>
    <div data-testid={id} className="flex flex-wrap gap-1.5">
      {list.map((d, i) => { const s = il.shotFor(jobId, component, d.key); return <figure key={d.key} data-testid={`${id}-${d.key}`} data-have={!!s} data-controlled={s?.controlled} className="w-[88px]">{s ? <button type="button" onClick={() => setOpen(s)} className="block w-full"><img src={s.displayUrl} alt="" className={clsx('h-14 w-full rounded-sm object-cover ring-2', s.controlled ? 'ring-emerald-300' : 'ring-amber-300')} /></button> : <button type="button" data-testid={`${id}-${d.key}-shoot`} onClick={() => onRetake?.(d.key)} className={clsx('grid h-14 w-full place-items-center rounded-sm text-[10px]', dark ? 'bg-white/5 text-slate-400' : 'bg-canvas text-ink-300')}>{i + 1} · shoot</button>}<figcaption className={`truncate text-[9px] ${dark ? 'text-slate-400' : 'text-ink-500'}`} title={d.label}>{i + 1} · {d.label}{s && onRetake && <button type="button" data-testid={`${id}-${d.key}-retake`} onClick={() => onRetake(d.key)} className="ml-1 underline">retake</button>}</figcaption></figure>; })}
      {extras.map((s) => <figure key={s.id} data-testid={`${id}-adhoc-${s.id}`} data-controlled={false} className="w-[88px]"><button type="button" onClick={() => setOpen(s)} className="block w-full"><img src={s.displayUrl} alt="" className="h-14 w-full rounded-sm object-cover ring-2 ring-amber-300" /></button><figcaption className="truncate text-[9px] text-amber-700" title={s.shotName}>ad-hoc · {s.shotName}</figcaption></figure>)}
    </div>
    {open && <div data-testid="shot-viewer" data-shot={open.id} className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-black/92 p-6 text-white" onClick={() => setOpen(null)}>
      <button type="button" data-testid="shot-viewer-close" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2" aria-label="Close"><X size={16} /></button>
      <img src={open.displayUrl} alt="" className="max-h-[70vh] max-w-[90vw] rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
        <span className="font-semibold">{il.componentLabel(open.component)} · {open.shotName}</span>
        {label && <OpinionChip label={label} dark testId="shot-viewer-opinion" />}
        <span data-testid="shot-viewer-tags" className="font-mono text-[11px] text-white/80">{open.tags.length ? open.tags.map((t) => `#${t}`).join(' ') : 'no tags yet'}</span>
        <span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase', open.controlled ? 'bg-emerald-500/30 text-emerald-100' : 'bg-amber-500/30 text-amber-100')}>{open.controlled ? 'controlled' : 'ad-hoc'}</span>
        <span className="text-white/60">{open.by} · {fmtDate(open.at)} {fmtTime(open.at)} · {open.station} · {open.cameraId} · {open.lightingPreset}{open.retakes ? ` · retakes ${open.retakes}` : ''}</span>
        <a href={open.originalUrl} target="_blank" rel="noreferrer" data-testid="shot-viewer-original" className="underline decoration-dotted">original</a>
      </div>
    </div>}
  </>;
};
