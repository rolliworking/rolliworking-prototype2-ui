import { AlertTriangle, Camera, Check, FileText, Gauge, Loader2, PenLine, Printer, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as bt from '@/api/benchTests';
import type { BeforeAfterExtract, BenchCapture, BenchKind, TimingRow, ToleranceExtract } from '@/api/benchTests';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

const SAMPLE: Record<BenchKind, string> = { before_after: '/bench/before_after.jpg', tolerance: '/bench/tolerance.jpg' };
const KIND_LABEL: Record<BenchKind, string> = { before_after: 'Before / after slips', tolerance: 'Tolerance comparison sheet' };

const Timing = ({ rows, title, tag, testId }: { rows: TimingRow[]; title: string; tag?: React.ReactNode; testId: string }) => <div data-testid={testId} className="rounded-sm border border-line bg-canvas/60 p-2"><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ink">{title}{tag}</div><table className="w-full text-[11px]"><thead><tr className="text-ink-400"><th className="text-left font-medium">Pos</th><th className="text-right font-medium">Rate s/d</th><th className="text-right font-medium">Amp °</th><th className="text-right font-medium">Beat ms</th></tr></thead><tbody>{rows.map((r) => <tr key={r.pos}><td className="font-mono">{r.pos}</td><td className={`text-right font-mono ${Math.abs(r.rate) > 4 ? 'text-rose-700' : 'text-ink'}`}>{r.rate > 0 ? '+' : ''}{r.rate}</td><td className="text-right font-mono">{r.amplitude}</td><td className="text-right font-mono">{r.beatError}</td></tr>)}</tbody></table></div>;

const BeforeAfterView = ({ x, id }: { x: BeforeAfterExtract; id: string }) => <div className="grid grid-cols-3 gap-2">
  <Timing rows={x.before.rows} title="Before · incoming" tag={<span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-50 px-1 text-[10px] font-medium text-amber-800"><PenLine size={9} /> hand-filled</span>} testId={`bench-before-${id}`} />
  <div data-testid={`bench-pressure-${id}`} className={`rounded-sm border p-2 ${x.pressure.result === 'PASS' ? 'border-moss/40 bg-moss-50/40' : 'border-rose-300 bg-rose-50'}`}><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ink"><Gauge size={11} /> {x.pressure.instrument}<span data-testid={`bench-pressure-result-${id}`} className={`ml-auto rounded-sm px-1.5 text-[10px] font-bold ${x.pressure.result === 'PASS' ? 'bg-moss text-white' : 'bg-rose-600 text-white'}`}>{x.pressure.result}</span></div><div className="text-[10px] text-ink-500">{x.pressure.program}</div><ul className="mt-1 space-y-0.5 text-[11px]">{x.pressure.readings.map((r) => <li key={r.label} className="flex justify-between gap-2"><span className="text-ink-500">{r.label}</span><span className="font-mono text-ink">{r.value}</span></li>)}</ul><div className="mt-1 text-[10px] text-ink-400">tested {fmtDate(x.pressure.testedAt)} {fmtTime(x.pressure.testedAt)}</div></div>
  <div><Timing rows={x.chronoscope.rows} title={x.chronoscope.instrument} tag={<span className="rounded-sm bg-canvas px-1 text-[10px] font-medium text-ink-500">after</span>} testId={`bench-chrono-${id}`} /><div className="mt-1 flex justify-between px-1 text-[11px]" data-testid={`bench-chrono-summary-${id}`}><span className="text-ink-500">avg <b className="font-mono text-ink">{x.chronoscope.average.rate > 0 ? '+' : ''}{x.chronoscope.average.rate}</b> s/d · <b className="font-mono text-ink">{x.chronoscope.average.amplitude}°</b> · <b className="font-mono text-ink">{x.chronoscope.average.beatError}</b> ms</span><span className="text-ink-500">Δ <b className="font-mono text-ink">{x.chronoscope.delta}</b></span></div></div>
</div>;

const ToleranceView = ({ c, x, onOverride }: { c: BenchCapture; x: ToleranceExtract; onOverride: (specId: string) => void }) => {
  const spec = bt.specOf(c.caliber?.specId); const allOk = x.rows.every((r) => r.ok);
  return <div className="space-y-2">
    <div data-testid={`bench-caliber-${c.id}`} data-spec={c.caliber?.specId ?? ''} className={`flex flex-wrap items-center gap-2 rounded-sm border px-2 py-1.5 text-xs ${c.caliber ? (c.caliber.via === 'manual' ? 'border-amber-300 bg-amber-50' : 'border-moss/40 bg-moss-50/40') : 'border-rose-300 bg-rose-50'}`}>
      <span className="font-mono text-[11px] text-ink-500">header “{x.caliberHeader}”</span><span className="text-ink-400">→</span>
      {spec ? <span className="font-semibold text-ink">{spec.label}</span> : <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><AlertTriangle size={11} /> no reference match</span>}
      {c.caliber && <span className="rounded-sm bg-white/70 px-1 text-[10px] text-ink-500">{c.caliber.via === 'manual' ? `corrected by ${c.caliber.overriddenBy}${c.caliber.overriddenFrom ? ` · sheet matched ${bt.specOf(c.caliber.overriddenFrom)?.label}` : ''}` : `matched via ${c.caliber.via} · ${Math.round(c.caliber.confidence * 100)}%`}</span>}
      <label className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-500">Wrong match?<select data-testid={`bench-caliber-override-${c.id}`} value={c.caliber?.specId ?? ''} onChange={(e) => e.target.value && onOverride(e.target.value)} className="h-7 rounded-sm border border-line bg-surface px-1.5 text-[11px]"><option value="">pick caliber…</option>{bt.CALIBER_SPECS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    </div>
    <table data-testid={`bench-tolerance-${c.id}`} className="w-full text-[11px]"><thead><tr className="text-ink-400"><th className="text-left font-medium">Metric</th><th className="text-left font-medium">Spec · {spec?.label ?? '—'}</th><th className="text-left font-medium">Measured</th><th className="font-medium">OK</th></tr></thead><tbody>{x.rows.map((r) => <tr key={r.metric} className="border-t border-line/60"><td className="py-0.5 text-ink">{r.metric}</td><td className="font-mono text-ink-500">{r.spec}</td><td className="font-mono text-ink">{r.measured}</td><td className="text-center">{r.ok ? <Check size={12} className="inline text-moss" /> : <X size={12} className="inline text-rose-600" />}</td></tr>)}</tbody></table>
    <div className="flex flex-wrap items-center gap-1.5" data-testid={`bench-grades-${c.id}`}><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Condition</span>{bt.GRADE_COMPONENTS.map((g) => <span key={g} className="inline-flex items-center gap-1 rounded-sm border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-ink-700">{g} <b className={`font-mono ${x.grades[g] === 'A' ? 'text-moss-700' : x.grades[g] === 'B-' ? 'text-amber-800' : 'text-ink'}`}>{x.grades[g]}</b></span>)}<span data-testid={`bench-tolerance-verdict-${c.id}`} className={`ml-auto rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${allOk ? 'bg-moss text-white' : 'bg-rose-600 text-white'}`}>{allOk ? 'IN SPEC' : 'OUT OF SPEC'}</span></div>
  </div>;
};

// Bench-test capture on the job: photo of the slips in → structured readings out; the photo stays attached as backing evidence
export const BenchTestsPanel = ({ jobId }: { jobId: string }) => {
  const [items, setItems] = useState<BenchCapture[]>([]); const [busy, setBusy] = useState<BenchKind | null>(null); const [lightbox, setLightbox] = useState<string | null>(null); const [pendingKind, setPendingKind] = useState<BenchKind>('before_after'); const file = useRef<HTMLInputElement>(null);
  const load = () => bt.getBenchCaptures(jobId).then(setItems);
  useEffect(() => { void load(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  const capture = async (kind: BenchKind, url: string) => { setBusy(kind); try { await bt.captureBenchTest(jobId, kind, url); await load(); } finally { setBusy(null); } };
  const onFile = (f?: File | null) => { if (!f) return; const r = new FileReader(); r.onload = () => void capture(pendingKind, String(r.result)); r.readAsDataURL(f); };
  return <div data-testid="bench-tests-panel" className="space-y-3">
    <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" data-testid="bench-file-input" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {(['before_after', 'tolerance'] as BenchKind[]).map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-sm border border-line bg-canvas p-1"><span className="px-1 text-ink-600">{KIND_LABEL[k]}</span><Button size="sm" data-testid={`bench-capture-${k}`} disabled={!!busy} onClick={() => { setPendingKind(k); file.current?.click(); }}><Camera size={12} /> Photo</Button><Button size="sm" data-testid={`bench-sample-${k}`} disabled={!!busy} onClick={() => void capture(k, SAMPLE[k])}><FileText size={12} /> Use sample slip</Button></span>)}
      {busy && <span data-testid="bench-extracting" className="inline-flex items-center gap-1 text-ink-500"><Loader2 size={12} className="animate-spin" /> Reading the slips… extracting readings</span>}
    </div>
    <ul className="space-y-3">
      {items.map((c) => <li key={c.id} data-testid={`bench-capture-${c.id}`} data-kind={c.kind} className="rounded-md border border-line p-2">
        <div className="mb-2 flex items-start gap-3">
          <button type="button" data-testid={`bench-photo-${c.id}`} onClick={() => setLightbox(c.photoUrl)} className="relative shrink-0"><img src={c.photoUrl} alt="" className="h-20 w-28 rounded-sm object-cover ring-1 ring-line" /><span className="absolute bottom-0.5 left-0.5 rounded-sm bg-ink/70 px-1 text-[9px] uppercase text-white">source photo</span></button>
          <div className="min-w-0 flex-1 text-xs"><div className="font-semibold text-ink">{KIND_LABEL[c.kind]}</div><div className="text-ink-500">{c.by} · {c.station} · {fmtDate(c.at)} {fmtTime(c.at)} · extraction {Math.round(c.extractConfidence * 100)}% · photo kept as backing evidence</div></div>
          <button type="button" data-testid={`bench-delete-${c.id}`} onClick={() => void bt.deleteBenchCapture(c.id).then(load)} className="text-ink-300 hover:text-rose-600" title="Remove capture"><Trash2 size={13} /></button>
        </div>
        {c.kind === 'before_after' ? <BeforeAfterView x={c.extract as BeforeAfterExtract} id={c.id} /> : <ToleranceView c={c} x={c.extract as ToleranceExtract} onOverride={(s) => void bt.overrideBenchCaliber(c.id, s).then(load)} />}
      </li>)}
      {!items.length && !busy && <li data-testid="bench-empty" className="py-3 text-center text-xs text-ink-400"><Printer size={13} className="mr-1 inline" /> No bench slips captured yet — photograph the before sheet + Proofmaster + Chronoscope printouts together, or the tolerance sheet.</li>}
    </ul>
    {lightbox && <div data-testid="bench-lightbox" className="fixed inset-0 z-[80] grid place-items-center bg-ink/90 p-8" onClick={() => setLightbox(null)}><img src={lightbox} alt="" className="max-h-[85vh] max-w-[90vw] rounded-md object-contain" /></div>}
  </div>;
};
