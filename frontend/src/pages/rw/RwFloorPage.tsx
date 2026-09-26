import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { DeptCode, JobWithRefs, RwFloorMap, RwStage } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';

// Part-colored dots per department, as on the legacy RW floor board
const DOT: Record<DeptCode, string> = { W: 'bg-indigo-400', B: 'bg-amber-400', P: 'bg-teal-400', PM: 'bg-rose-400' };
const DOT_LABEL: Record<DeptCode, string> = { W: 'Watch / movement', B: 'Band', P: 'Polish', PM: 'Precious metals' };

const Chip = ({ j }: { j: JobWithRefs }) => (
  <Link to={`/rw/jobs/${j.id}`} data-testid={`rw-floor-chip-${j.id}`} title={`${j.number} · ${j.client.lastName} · ${j.watch.model} · ${j.assignees.join(', ') || 'unassigned'}`} className={`inline-flex items-center gap-1.5 rounded-full border bg-[#0f131a] px-2 py-0.5 text-[11px] text-slate-100 transition-transform hover:-translate-y-px ${j.priority === 'urgent' ? 'border-rose-400' : j.priority === 'high' ? 'border-orange-400/70' : 'border-white/15'}`}>
    <span className="font-mono font-semibold">{j.number.slice(-4)}</span><span className="flex gap-0.5">{j.workflow.map((d) => <span key={d} className={`h-2 w-2 rounded-full ${DOT[d]}`} />)}</span>{j.assignees[0] && <span className="text-slate-500">{j.assignees[0]}</span>}
  </Link>
);

const Lane = ({ title, tone, stages, testId }: { title: string; tone: string; stages: RwStage[]; testId: string }) => (
  <section data-testid={testId} className={`rounded-md border p-2 ${tone}`}>
    <header className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{title}</header>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>{stages.map((s) => <div key={s.key} data-testid={`${testId}-${s.key}`} className="min-h-[96px] rounded-sm bg-black/20 p-1.5"><div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>{s.label}</span><span className="font-mono">{s.jobs.length}</span></div><div className="flex flex-wrap gap-1">{s.jobs.map((j) => <Chip key={j.id} j={j} />)}</div></div>)}</div>
  </section>
);

export default function RwFloorPage() {
  const [m, setM] = useState<RwFloorMap | null>(null);
  useEffect(() => { api.getRwFloorMap().then(setM); }, []);
  return <div data-testid="rw-floor-page" className="space-y-3">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-lg font-semibold text-white">Floor — two converging lanes</h1><p className="text-xs text-slate-400">Legacy RolliWorking layout: head (movement) work along the top lane, band / polish work along the bottom, both converging on Final assembly. "Into safe" is the off-ramp for anything parked. Compare with RolliSuite's nine-lane map <Provisional note="Two-lane (legacy RW) vs nine-lane (RS) floor model — MH to rule which Keeper keeps. Stage derivation from job status/workflow is a first cut." /></p></div>
      <div className="flex items-center gap-3 text-[10px] text-slate-400">{(Object.keys(DOT) as DeptCode[]).map((d) => <span key={d} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${DOT[d]}`} /> {DOT_LABEL[d]}</span>)}</div>
    </div>
    {m && <div className="grid grid-cols-[1fr_180px_200px] gap-3">
      <div className="space-y-3">
        <Lane title="Head lane — movement" tone="border-indigo-400/30 bg-indigo-950/20" stages={m.head} testId="rw-lane-head" />
        <Lane title="Band lane — band · polish · precious metals" tone="border-amber-400/30 bg-amber-950/20" stages={m.band} testId="rw-lane-band" />
      </div>
      <section data-testid="rw-final-assembly" className="flex flex-col rounded-md border border-emerald-400/30 bg-emerald-950/20 p-2"><header className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-300"><span>Final assembly · testing</span><span className="font-mono">{m.finalAssembly.length}</span></header><div className="flex flex-1 flex-wrap content-start gap-1">{m.finalAssembly.map((j) => <Chip key={j.id} j={j} />)}{!m.finalAssembly.length && <span className="text-[11px] text-slate-500">empty</span>}</div><p className="mt-2 text-[10px] text-slate-500">← both lanes converge here</p></section>
      <section data-testid="rw-into-safe" className="rounded-md border border-white/10 bg-black/30 p-2"><header className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300"><Lock size={11} /> Into safe · off-ramp</header><div className="space-y-2">{m.intoSafe.map((s) => <div key={s.key} data-testid={`rw-safe-${s.key}`}><div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>{s.label}</span><span className="font-mono">{s.jobs.length}</span></div><div className="flex flex-wrap gap-1">{s.jobs.map((j) => <Chip key={j.id} j={j} />)}</div></div>)}</div></section>
    </div>}
  </div>;
}
