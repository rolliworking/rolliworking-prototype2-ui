import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs, TimingPosition, TimingReading, TimingTest } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

const POS_LABEL: Record<TimingPosition, string> = { DU: 'Dial up', DD: 'Dial down', CD: 'Crown down', CL: 'Crown left', CU: 'Crown up', CR: 'Crown right' };
const cell = 'w-20 rounded border px-1.5 py-1 text-right font-mono text-xs focus:outline-none';

export const TimingHistory = ({ tests, compact }: { tests: TimingTest[]; compact?: boolean }) => (
  <ul data-testid="timing-history" className="space-y-1.5">{tests.map((t) => <li key={t.id} data-testid={`timing-test-${t.id}`} className={`rounded-md border px-2.5 py-2 text-xs ${t.verdict === 'pass' ? 'border-moss-200 bg-moss-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
    <div className="flex flex-wrap items-center gap-2"><span data-testid={`timing-verdict-${t.id}`} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${t.verdict === 'pass' ? 'bg-moss text-white' : 'bg-rose-600 text-white'}`}>{t.verdict}</span><span className="font-mono font-semibold">{t.jobNumber}</span><span className="text-ink-500">cal. {t.caliber}</span><span className="tabular">avg {t.avgRate > 0 ? '+' : ''}{t.avgRate} s/d · Δ {t.delta} · beat {t.avgBeat} ms · amp {t.avgAmp}° · reserve {t.powerReserve} h</span><span className="ml-auto text-ink-400">{fmtDate(t.at)} {fmtTime(t.at)} · {t.by} · {t.station}</span></div>
    {!compact && <div className="mt-1 grid grid-cols-6 gap-1 font-mono text-[10px] text-ink-600">{t.readings.map((r) => <span key={r.position}>{r.position} {r.rate > 0 ? '+' : ''}{r.rate}/{r.beat}/{r.amp}</span>)}</div>}
    {(t.reason || t.evaluation.flags.length > 0) && <div className="mt-1 text-[11px] text-ink-600">{t.reason && <span className="font-medium">Reason: {t.reason}. </span>}{t.evaluation.flags.length > 0 && <span className="text-amber-800">Auto-eval: {t.evaluation.flags.join(' · ')}</span>}{t.evaluation.suggested !== t.verdict && <span className="ml-1 rounded bg-amber-50 px-1 text-amber-800">tech override</span>}</div>}
  </li>)}{!tests.length && <li className="text-xs text-ink-400">No timing tests yet.</li>}</ul>
);

export default function RtTestPage() {
  const { jobId = '' } = useParams(); const nav = useNavigate();
  const [job, setJob] = useState<JobWithRefs | null>(null); const [history, setHistory] = useState<TimingTest[]>([]); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<TimingTest | null>(null);
  const [readings, setReadings] = useState<Record<TimingPosition, { rate: string; beat: string; amp: string }>>(Object.fromEntries(api.TIMING_POSITIONS.map((p) => [p, { rate: '', beat: '', amp: '' }])) as never);
  const [lift, setLift] = useState(''); const [reserve, setReserve] = useState(''); const [reason, setReason] = useState('');
  useEffect(() => { api.getJob(jobId).then((j) => { setJob(j); if (j) { setLift(String(api.toleranceForWatch(j.watch).liftAngle)); api.getTimingTests({ watchId: j.watchId }).then(setHistory); } }); }, [jobId]);
  const tol = job ? api.toleranceForWatch(job.watch) : null;
  const parsed: TimingReading[] = useMemo(() => api.TIMING_POSITIONS.map((p) => ({ position: p, rate: Number(readings[p].rate), beat: Number(readings[p].beat), amp: Number(readings[p].amp) })), [readings]);
  const complete = api.TIMING_POSITIONS.every((p) => readings[p].rate !== '' && readings[p].beat !== '' && readings[p].amp !== '') && reserve !== '';
  const ev = tol && complete ? api.evaluateTiming(tol, { readings: parsed, powerReserve: Number(reserve) }) : null;
  if (!job || !tol) return null;
  const set = (p: TimingPosition, k: 'rate' | 'beat' | 'amp', v: string) => setReadings({ ...readings, [p]: { ...readings[p], [k]: v } });
  const bad = { rate: (v: string) => v !== '' && (Number(v) < tol.crit2Min - tol.crit1MaxDelta / 2 || Number(v) > tol.crit2Max + tol.crit1MaxDelta / 2), beat: (v: string) => v !== '' && Number(v) > tol.beatMax, amp: (v: string) => v !== '' && (Number(v) < tol.ampMin || Number(v) > tol.ampMax) };
  const submit = (verdict: 'pass' | 'reject') => api.recordTimingTest(job.id, { readings: parsed, liftAngle: Number(lift), powerReserve: Number(reserve), verdict, reason }).then((t) => { setDone(t); setErr(null); }).catch((e) => setErr(e.message));
  if (done) return <div data-testid="rt-done" className="mx-auto max-w-2xl space-y-3 rounded-lg border border-line bg-surface p-5 text-sm"><h2 className="text-lg font-semibold">{done.verdict === 'pass' ? `${job.number} passed — moved to the QC queue` : `${job.number} rejected — back to in progress under ${job.assignees.join(', ') || 'the bench'}`}</h2><p className="text-xs text-ink-500">{done.verdict === 'pass' ? '“Testing complete” email queued to Outbox · test saved to job and watch history.' : '“Back to in progress” email queued to Outbox · rejection logged on the job timeline.'}</p><TimingHistory tests={[done]} /><div className="flex gap-2"><Button variant="primary" data-testid="rt-back-queue" onClick={() => nav('/rt')}>Back to queue</Button><Link to={`/jobs/${job.id}`} className="text-xs text-brand hover:underline">Open job in RolliSuite</Link></div></div>;
  return <div data-testid="rt-test-page" className="mx-auto max-w-5xl space-y-4">
    <div data-testid="rt-job-card" className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm"><span className="font-mono text-base font-semibold">{job.number}</span><span>{job.watch.brand} {job.watch.model} <span className="font-mono text-ink-500">{job.watch.reference} / {job.watch.serial}</span></span><span className="text-ink-500">{job.client.firstName} {job.client.lastName}</span><span className="rounded bg-canvas px-2 py-0.5 text-xs">{tol.label}</span><span className="ml-auto text-xs text-ink-400">status {job.status} · {job.assignees.join(', ') || 'unassigned'}</span></div>
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold">Timing test — Witschi layout</span><span className="text-ink-500">targets: Crit1 Δ &lt; {tol.crit1MaxDelta} s/d · Crit2 {tol.crit2Min}/+{tol.crit2Max} s/d · beat ≤ {tol.beatMax} ms · amp {tol.ampMin}–{tol.ampMax}° · reserve ≥ {tol.reserveHours} h</span></div>
        <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="py-1">Position</th><th>Rate s/d <span className="normal-case text-ink-300">({tol.crit2Min}/+{tol.crit2Max})</span></th><th>Beat ms <span className="normal-case text-ink-300">(≤{tol.beatMax})</span></th><th>Amp ° <span className="normal-case text-ink-300">({tol.ampMin}–{tol.ampMax})</span></th></tr></thead><tbody>
          {api.TIMING_POSITIONS.map((p) => <tr key={p} data-testid={`rt-row-${p}`}><td className="py-1"><b>{p}</b> <span className="text-ink-400">{POS_LABEL[p]}</span></td>{(['rate', 'beat', 'amp'] as const).map((k) => <td key={k}><input data-testid={`rt-${p}-${k}`} type="number" step={k === 'beat' ? '0.1' : '1'} value={readings[p][k]} onChange={(e) => set(p, k, e.target.value)} className={`${cell} ${bad[k](readings[p][k]) ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-line bg-surface'}`} /></td>)}</tr>)}
          <tr data-testid="rt-avg-row" className="border-t border-line font-semibold"><td className="py-1.5">AVG</td><td className={`font-mono ${ev && !ev.crit2 ? 'text-rose-700' : ''}`}>{ev ? `${ev.avgRate > 0 ? '+' : ''}${ev.avgRate}` : '—'} <span className="text-[10px] font-normal text-ink-400">Δ {ev ? ev.delta : '—'}</span></td><td className={`font-mono ${ev && !ev.beat ? 'text-rose-700' : ''}`}>{ev ? ev.avgBeat : '—'}</td><td className={`font-mono ${ev && !ev.amp ? 'text-rose-700' : ''}`}>{ev ? ev.avgAmp : '—'}</td></tr>
        </tbody></table>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs"><label>Lift angle ° <input data-testid="rt-lift" type="number" value={lift} onChange={(e) => setLift(e.target.value)} className={`${cell} ml-1 border-line`} /> <span className="text-ink-400">(cal. {tol.liftAngle}°)</span></label><label>Power reserve h <input data-testid="rt-reserve" type="number" value={reserve} onChange={(e) => setReserve(e.target.value)} className={`${cell} ml-1 ${reserve !== '' && Number(reserve) < tol.reserveHours ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-line'}`} /> <span className="text-ink-400">(≥ {tol.reserveHours} h)</span></label></div>
        <div data-testid="rt-eval" className={`mt-3 rounded-md px-3 py-2 text-xs ${!ev ? 'bg-canvas text-ink-500' : ev.suggested === 'pass' ? 'bg-moss-50 text-moss-800' : 'bg-amber-50 text-amber-800'}`}>{!ev ? 'Fill all six positions and the power reserve for an auto-evaluation.' : <><b data-testid="rt-suggested">Suggested: {ev.suggested.toUpperCase()}</b> · {ev.flags.length ? ev.flags.join(' · ') : 'all criteria within tolerance'} <span className="text-ink-500">— the tech decides.</span></>}</div>
        {err && <p data-testid="rt-error" className="mt-2 text-xs text-rose-700">{err}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="primary" data-testid="rt-pass" disabled={!complete} onClick={() => submit('pass')}>PASS → QC queue</Button><input data-testid="rt-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="rejection reason (required to reject)" className="flex-1 rounded border border-line px-2 py-1 text-xs" /><Button data-testid="rt-reject" disabled={!complete} onClick={() => submit('reject')}>REJECT → back to in progress</Button></div>
        <p className="mt-2 text-[11px] text-ink-400"><Provisional note="Crit1/Crit2 definitions, per-position rate bounds and the QC-queue handoff (job stays in testing, flagged passed) are provisional" /></p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4"><div className="mb-2 text-xs font-semibold">Watch history · {history.length} test{history.length === 1 ? '' : 's'} <span className="font-normal text-ink-400">newest first · append-only</span></div><TimingHistory tests={history} compact /></div>
    </div>
  </div>;
}
