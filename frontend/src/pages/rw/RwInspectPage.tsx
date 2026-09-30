import clsx from 'clsx';
import { Camera, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import * as il from '@/api/inspectionLabels';
import type { LabelComponent } from '@/api/inspectionLabels';
import { useAuth } from '@/auth/AuthContext';
import { GuidedShotCapture, ShotGrid } from '@/components/inspection/GuidedShots';
import { OpinionDotsRow } from '@/components/inspection/OpinionBits';
import { SpecimenBanner } from '@/components/inspection/OpinionCard';
import { OpinionRow } from '@/components/inspection/OpinionRow';
import { fullName } from '@/lib/format';

// PAD (item 8) — photo station / inspection dual-camera rig: the component's shot list and its opinion row on ONE screen. Shoot → tick the opinion → next component. 44 pt everything · dictation into notes.
// Camera opens from the ref-label scan so the job context is never typed. ?rig=kiosk forces controlled=true (fixed camera / distance / lighting); a bench pad stays ad-hoc.
export default function RwInspectPage() {
  il.ensureSeed(); const { jobId } = useParams(); const [sp] = useSearchParams(); const { station } = useAuth();
  const [job, setJob] = useState<JobWithRefs | null>(null); const [q, setQ] = useState(''); const [err, setErr] = useState<string | null>(null); const [comp, setComp] = useState<LabelComponent>('dial'); const [shoot, setShoot] = useState(false); const [tick, setTick] = useState(0);
  const controlled = sp.get('rig') === 'kiosk' ? true : sp.get('rig') === 'bench' ? false : il.isControlledStation(station?.name ?? '');
  useEffect(() => { if (jobId) void api.getJob(jobId).then(setJob); }, [jobId]);
  const scan = async () => { const s = q.trim(); if (!s) return; const hits = await api.searchJobs(s); if (hits[0]) { setJob(hits[0]); setErr(null); setQ(''); } else setErr(`No job matches “${s}”`); };
  const bump = () => setTick((t) => t + 1);
  const comps = il.COMPONENTS; const i = comps.findIndex((c) => c.key === comp); const nextComp = comps[(i + 1) % comps.length];
  return <div data-testid="rw-inspect-page" data-controlled={controlled} data-tick={tick} className="mx-auto max-w-5xl space-y-4 px-4 py-4 text-slate-100">
    <div className="flex flex-wrap items-center gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight text-white">Inspection · shots + opinions</h1><p className="text-xs text-slate-400">Shoot the component · tick the opinion · next component. <span className={controlled ? 'text-emerald-300' : 'text-amber-300'}>{controlled ? 'Controlled rig — training set' : 'Bench pad — ad-hoc, not training'}</span></p></div>
      <label className="ml-auto flex min-h-[48px] items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3"><ScanLine size={16} className="text-accent" /><input data-testid="inspect-scan" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void scan(); }} placeholder="Scan ref label · job # / est # / serial" className="w-72 bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none" /></label>
    </div>
    {err && <p data-testid="inspect-error" className="text-sm text-rose-300">{err}</p>}
    {!job && <p data-testid="inspect-empty" className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">Scan the ref label on the ticket to open the job — nothing is typed.</p>}
    {job && <>
      <div data-testid="inspect-job" className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="font-mono text-lg font-bold text-white">{job.number}</span><span className="text-sm">{fullName(job.client)} · {job.watch.brand} {job.watch.model} · <span className="font-mono">{job.watch.reference}</span></span>
        <OpinionDotsRow jobId={job.id} testId="inspect-dots" key={tick} />
        <Link to={`/rw/jobs/${job.id}`} className="ml-auto text-xs text-accent underline">Job</Link>
      </div>
      <SpecimenBanner jobId={job.id} onChange={bump} compact />
      <div data-testid="inspect-tabs" className="flex flex-wrap gap-1.5">{comps.map((c) => { const l = il.latestFor(job.id, c.key); const p = il.listProgress(job.id, c.key); return <button key={c.key} type="button" data-testid={`inspect-tab-${c.key}`} aria-selected={comp === c.key} onClick={() => setComp(c.key)} className={clsx('min-h-[44px] rounded-xl border px-3 text-sm font-medium', comp === c.key ? 'border-accent bg-accent text-[#161b22]' : 'border-white/15 bg-white/5 text-slate-200')}>{c.label}<span className="ml-1.5 text-[10px] opacity-70">{l ? il.OPINIONS.find((o) => o.key === l.opinion)?.short : '—'}{p.total ? ` · ${p.have}/${p.total}` : ''}</span></button>; })}</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div data-testid="inspect-shots" className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">Shot list · {il.componentLabel(comp)}</span><span className="text-xs text-slate-400">{il.listProgress(job.id, comp).have}/{il.listProgress(job.id, comp).total}</span>
            {il.shotLists[comp].length > 0 && <button type="button" data-testid="inspect-shoot" onClick={() => setShoot(true)} className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-[#161b22]"><Camera size={16} /> {il.listProgress(job.id, comp).complete ? 'Retake' : 'Shoot'}</button>}</div>
          {il.shotLists[comp].length ? <ShotGrid jobId={job.id} component={comp} dark onRetake={() => setShoot(true)} testId={`inspect-grid-${comp}`} /> : <p className="text-xs text-slate-400">No shot list — {il.componentLabel(comp)} rides on the case shots; opinion row only.</p>}
        </div>
        <div className="space-y-2">
          <OpinionRow key={`${job.id}-${comp}-${tick}`} jobId={job.id} component={comp} pad dark onSaved={bump} testId={`inspect-opinion-${comp}`} />
          <button type="button" data-testid="inspect-next" onClick={() => setComp(nextComp.key)} className="min-h-[44px] w-full rounded-xl border border-white/15 text-sm text-slate-200">Next component → {nextComp.label}</button>
        </div>
      </div>
      {shoot && <GuidedShotCapture jobId={job.id} component={comp} controlled={controlled} onShot={bump} onClose={() => { setShoot(false); bump(); }} />}
    </>}
  </div>;
}
