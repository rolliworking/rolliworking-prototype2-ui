import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as ai from '@/api/ai';
import type { PressureExtraction, SheetExtraction, SheetKind, TimingExtraction } from '@/api/ai';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';

const field = 'h-7 w-20 rounded-sm border border-line bg-surface px-1.5 font-mono text-xs text-right';
const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

// Suggest → verify: Claude reads the photo, every field is tap-to-correct, one green check confirms. Nothing is written until confirm.
export const SheetExtractVerify = ({ photoDataUrl, kind, onConfirm, onSkip }: { photoDataUrl: string; kind: SheetKind; onConfirm: (x: SheetExtraction) => void; onSkip: () => void }) => {
  const { user } = useAuth(); const [x, setX] = useState<SheetExtraction | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let live = true; setX(null); setErr(null); ai.extractEvidenceSheet(photoDataUrl, kind).then((r) => { if (live) setX(r); }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : 'Extraction failed'); }); return () => { live = false; }; }, [photoDataUrl, kind]);
  const confirm = () => { if (!x) return; onConfirm({ ...x, verifiedBy: user?.shortName ?? 'staff', verifiedAt: new Date().toISOString() } as SheetExtraction); };
  return <div data-testid="sheet-extract" data-state={x ? 'ready' : err ? 'error' : 'loading'} className="grid grid-cols-[180px_1fr] gap-3 rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs">
    <img src={photoDataUrl} alt="" className="max-h-56 w-full rounded border border-line object-contain" />
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-semibold text-ink"><Sparkles size={13} className="text-amber-600" /> Claude read this {kind === 'timing_sheet' ? 'timing sheet' : 'pressure test'} — verify every field{x?.fields.confidence != null && <span data-testid="sheet-extract-confidence" className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-500">confidence {Math.round((x.fields.confidence ?? 0) * 100)}%</span>}</div>
      {!x && !err && <div data-testid="sheet-extract-loading" className="inline-flex items-center gap-2 text-ink-500"><Loader2 size={13} className="animate-spin" /> Reading the photo…</div>}
      {err && <div data-testid="sheet-extract-error" className="text-rose-700">{err} — you can still file the photo and type the values by hand.</div>}
      {x?.kind === 'timing_sheet' && <TimingFields f={x.fields} onChange={(f) => setX({ ...x, fields: f })} />}
      {x?.kind === 'pressure_test' && <PressureFields f={x.fields} onChange={(f) => setX({ ...x, fields: f })} />}
      {x?.fields.notes && <div className="text-[11px] text-ink-500">Model note: {x.fields.notes}</div>}
      <div className="flex justify-end gap-2"><Button size="sm" data-testid="sheet-extract-skip" onClick={onSkip}><X size={12} /> Skip extraction</Button><Button size="sm" variant="primary" data-testid="sheet-extract-confirm" disabled={!x} className="!bg-emerald-700 hover:!bg-emerald-800" onClick={confirm}><Check size={12} /> Verified — use these values</Button></div>
    </div>
  </div>;
};

const TimingFields = ({ f, onChange }: { f: TimingExtraction; onChange: (f: TimingExtraction) => void }) => {
  const set = (p: string, k: 'rate' | 'beat' | 'amp', v: string) => onChange({ ...f, positions: { ...f.positions, [p]: { ...(f.positions[p as keyof typeof f.positions] ?? { rate: null, beat: null, amp: null }), [k]: v === '' ? null : Number(v) } } });
  return <table data-testid="sheet-extract-timing" className="w-full"><thead><tr className="text-[10px] uppercase text-ink-400"><th className="text-left">pos</th><th>rate s/d</th><th>beat ms</th><th>amp °</th></tr></thead><tbody>
    {api.TIMING_POSITIONS.map((p) => { const r = f.positions[p]; return <tr key={p}><td className="font-mono font-semibold">{p}</td><td className="text-center"><input data-testid={`extract-${p}-rate`} className={field} value={num(r?.rate)} onChange={(e) => set(p, 'rate', e.target.value)} /></td><td className="text-center"><input data-testid={`extract-${p}-beat`} className={field} value={num(r?.beat)} onChange={(e) => set(p, 'beat', e.target.value)} /></td><td className="text-center"><input data-testid={`extract-${p}-amp`} className={field} value={num(r?.amp)} onChange={(e) => set(p, 'amp', e.target.value)} /></td></tr>; })}
    <tr><td className="pt-1 text-ink-500">delta / reserve</td><td className="pt-1 text-center"><input data-testid="extract-delta" className={field} value={num(f.delta)} onChange={(e) => onChange({ ...f, delta: e.target.value === '' ? null : Number(e.target.value) })} /></td><td className="pt-1 text-center"><input data-testid="extract-reserve" className={field} value={num(f.reserve)} onChange={(e) => onChange({ ...f, reserve: e.target.value === '' ? null : Number(e.target.value) })} /></td><td className="pt-1 text-center font-mono text-ink-500">{f.caliber ?? ''}</td></tr>
  </tbody></table>;
};

const PressureFields = ({ f, onChange }: { f: PressureExtraction; onChange: (f: PressureExtraction) => void }) => (
  <div data-testid="sheet-extract-pressure" className="grid grid-cols-2 gap-2">
    {(['depth', 'deflection', 'duration', 'tester'] as const).map((k) => <label key={k} className="text-ink-500">{k}<input data-testid={`extract-${k}`} className="mt-0.5 block h-7 w-full rounded-sm border border-line bg-surface px-1.5 font-mono text-xs" value={f[k] ?? ''} onChange={(e) => onChange({ ...f, [k]: e.target.value || null })} /></label>)}
    <label className="text-ink-500">result<select data-testid="extract-result" className="mt-0.5 block h-7 w-full rounded-sm border border-line bg-surface px-1.5 text-xs" value={f.result ?? ''} onChange={(e) => onChange({ ...f, result: (e.target.value || null) as PressureExtraction['result'] })}><option value="">—</option><option value="pass">PASS</option><option value="fail">FAIL</option></select></label>
  </div>
);
