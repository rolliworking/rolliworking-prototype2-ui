import { Camera, Check, Lock, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import type { GradeGate, GradeGateRow, GradeScore } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

const SCORES: GradeScore[] = [1, 2, 3, 4, 5];
const tone = (s: number) => (s >= 4 ? 'bg-emerald-500 text-[#0b0f14]' : s === 3 ? 'bg-amber-400 text-[#161b22]' : 'bg-rose-500 text-white');

// One category row: 1–5 tap buttons, auto-resolved responsible tech (editable), note + photo required at ≤3, self-graded flag
const GradeRow = ({ row, jobId, onSaved }: { row: GradeGateRow; jobId: string; onSaved: () => void }) => {
  const { user } = useAuth(); const [score, setScore] = useState<GradeScore | null>(null); const [tech, setTech] = useState(row.suggestedTech); const [note, setNote] = useState(''); const [photo, setPhoto] = useState<string | undefined>(); const [err, setErr] = useState<string | null>(null); const file = useRef<HTMLInputElement>(null);
  const g = row.grade; const cat = row.category; const tid = `grade-${cat.key}`;
  if (g) return <li data-testid={`${tid}-done`} className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-950/20 px-4 py-3">
    <Check size={18} className="text-emerald-300" /><span className="text-base font-semibold text-white">{cat.label}</span><span data-testid={`${tid}-score`} className={`rounded-lg px-2.5 py-0.5 font-mono text-lg font-bold ${tone(g.score)}`}>{g.score}/5</span>
    <span className="text-sm text-slate-300">tech <b className="text-white">{g.tech}</b>{g.tech !== g.techAuto && <span className="text-slate-500"> (auto {g.techAuto})</span>} · graded by {g.grader}</span>
    {g.selfGraded && <span data-testid={`${tid}-self`} className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200"><ShieldAlert size={12} /> self-graded</span>}
    {g.note && <span className="text-sm text-slate-400">“{g.note}”</span>}{g.photoUrl && <img src={g.photoUrl} alt="grade evidence" className="h-10 w-14 rounded object-cover" />}
  </li>;
  const low = score !== null && score <= 3;
  return <li data-testid={tid} className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3">
    <div className="flex flex-wrap items-center gap-3"><div className="min-w-[160px]"><div className="text-base font-semibold text-white">{cat.label}</div><div className="text-xs text-slate-400">{cat.hint}</div></div>
      <div className="flex gap-2">{SCORES.map((s) => <button key={s} data-testid={`${tid}-score-${s}`} onClick={() => setScore(s)} className={`h-12 w-12 rounded-xl font-mono text-lg font-bold ${score === s ? tone(s) : 'border border-white/15 text-slate-200 hover:bg-white/10'}`}>{s}</button>)}</div>
      <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">tech <select data-testid={`${tid}-tech`} value={tech} onChange={(e) => setTech(e.target.value)} className="rounded-lg border border-white/15 bg-[#0f131a] px-2 py-1.5 text-sm text-slate-100">{row.techOptions.map((t) => <option key={t}>{t}</option>)}</select>{tech !== row.suggestedTech && <span className="text-amber-300">edited · auto {row.suggestedTech}</span>}{tech === user?.shortName && <span data-testid={`${tid}-self-warn`} className="text-amber-300">self-grade</span>}</label>
    </div>
    {score !== null && <div className="flex flex-wrap items-center gap-2">
      <input data-testid={`${tid}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={low ? 'Short note — required at 3 or below (or attach a photo)' : 'Short note (optional)'} className="min-w-[260px] flex-1 rounded-lg border border-white/15 bg-[#0f131a] px-3 py-2 text-sm text-slate-100" />
      <input ref={file} data-testid={`${tid}-photo-input`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); e.target.value = ''; }} />
      <button data-testid={`${tid}-photo`} onClick={() => file.current?.click()} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-sm ${photo ? 'border-emerald-400/40 text-emerald-200' : low ? 'border-amber-400/50 text-amber-200' : 'border-white/15 text-slate-300'}`}><Camera size={15} /> {photo ? 'Photo attached' : low ? 'Photo (evidence)' : 'Photo'}</button>
      <button data-testid={`${tid}-save`} onClick={async () => { try { await api.recordWorkGrade(jobId, cat.id, score, { note, photoUrl: photo, tech }); setErr(null); onSaved(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }} className="min-h-[40px] rounded-lg bg-amber-400 px-4 text-sm font-semibold text-[#161b22]">Save grade</button>
    </div>}
    {err && <p data-testid={`${tid}-error`} className="text-xs text-rose-300">{err}</p>}
  </li>;
};

// The gate: Start test stays locked until every applicable category is scored; the message names what is missing
export const GradeGatePanel = ({ jobId, onChange }: { jobId: string; onChange: (g: GradeGate) => void }) => {
  const [gate, setGate] = useState<GradeGate | null>(null);
  const load = () => api.getGradeGate(jobId).then((g) => { setGate(g); onChange(g); });
  useEffect(() => { void load(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!gate) return null;
  return <section data-testid="grade-gate" data-ready={gate.ready} className={`space-y-3 rounded-2xl border p-4 ${gate.ready ? 'border-emerald-400/30 bg-emerald-950/10' : 'border-amber-400/40 bg-amber-400/5'}`}>
    <div className="flex flex-wrap items-center gap-3"><div><div className="text-[10px] uppercase tracking-wide text-amber-300">Work grading · before the test</div><h2 className="text-xl font-semibold text-white">{gate.ready ? 'Graded — test may start' : `Score ${gate.missing.join(' and ')} to unlock the test`}</h2></div>
      <span data-testid="grade-gate-status" className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${gate.ready ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>{gate.ready ? <Check size={13} /> : <Lock size={13} />} {gate.rows.length - gate.missing.length}/{gate.rows.length} scored</span></div>
    <ul className="space-y-2">{gate.rows.map((r) => <GradeRow key={r.category.id} row={r} jobId={jobId} onSaved={() => void load()} />)}</ul>
  </section>;
};
