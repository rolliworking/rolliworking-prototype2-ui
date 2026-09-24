import { Clock, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs, ShopTimeEntry } from '@/api/client';
import { JobsSubNav, WorkflowBadges } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OwnerChip, StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export default function ShopTimePage() {
  const [params] = useSearchParams();
  const [jobs, setJobs] = useState<JobWithRefs[]>([]);
  const [rows, setRows] = useState<ShopTimeEntry[]>([]);
  const [jobId, setJobId] = useState(params.get('job') ?? '');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const minRef = useRef<HTMLInputElement>(null);

  const load = () => Promise.all([api.getOnHandJobs(), api.getShopTime()]).then(([j, t]) => { setJobs(j); setRows(t); });
  useEffect(() => { void load(); }, []);

  const add = async () => {
    try {
      await api.addShopTime(jobId, Number(minutes), note);
      setMinutes(''); setNote(''); setError(null);
      setFlash('Time entry saved'); window.setTimeout(() => setFlash(null), 2500);
      await load();
      minRef.current?.focus();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };

  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const totals = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.jobId]: (acc[r.jobId] ?? 0) + r.minutes }), {});

  return (
    <div data-testid="shop-time-page" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Shop Time</h1>
          <p className="mt-0.5 text-xs text-ink-500">Time entries against on-hand jobs · writes time rows, never the job status · the only job route the legacy shell exposed</p>
        </div>
        <JobsSubNav />
      </div>

      <Card title="Add entry" subtitle="Only on-hand jobs appear in the picker" testId="shop-time-form">
        <div className="grid grid-cols-[1fr_120px_1fr_auto] items-end gap-2">
          <label className="text-xs text-ink-500">Job<select data-testid="st-job" autoFocus value={jobId} onChange={(e) => setJobId(e.target.value)} className={`${field} mt-1 block w-full`}><option value="">Pick an on-hand job…</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.number} · {fullName(j.client)} · {j.watch.model} · {j.status.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="text-xs text-ink-500">Minutes<input ref={minRef} data-testid="st-minutes" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className={`${field} mt-1 block w-full tabular`} /></label>
          <label className="text-xs text-ink-500">Note<input data-testid="st-note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="What was done" className={`${field} mt-1 block w-full`} /></label>
          <Button variant="primary" data-testid="st-add" onClick={add} disabled={!jobId}><Plus size={13} /> Add time</Button>
        </div>
        {error && <p data-testid="st-error" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}
        {flash && <p data-testid="st-flash" className="mt-2 text-xs font-medium text-moss-700 animate-rise">{flash}</p>}
      </Card>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        <Card title="Entries" bodyClassName="p-0" testId="shop-time-entries">
          <Table>
            <thead><tr><Th>When</Th><Th>Job</Th><Th>Tech</Th><Th className="text-right">Minutes</Th><Th>Note</Th><Th>Station</Th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const j = byId[r.jobId];
                return (
                  <tr key={r.id} data-testid={`st-row-${r.id}`}>
                    <Td className="tabular text-ink-500">{fmtDate(r.at)} {fmtTime(r.at)}</Td>
                    <Td>{j ? <Link to={`/jobs/${j.id}`} className="font-mono text-xs font-medium text-ink hover:underline">{j.number}</Link> : <span className="font-mono text-xs text-ink-400">{r.jobId}</span>}</Td>
                    <Td><OwnerChip owner={r.by} /></Td>
                    <Td className="tabular text-right font-medium">{r.minutes}</Td>
                    <Td className="text-ink-700">{r.note}</Td>
                    <Td className="text-ink-400">{r.station}</Td>
                  </tr>
                );
              })}
              {rows.length === 0 && <EmptyRow colSpan={6} text="No time logged yet." />}
            </tbody>
          </Table>
        </Card>
        <Card title="On-hand jobs" subtitle={`${jobs.length} eligible`} testId="on-hand-list" bodyClassName="p-0">
          <ul className="divide-y divide-line/70">
            {jobs.map((j) => (
              <li key={j.id} data-testid={`on-hand-${j.id}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <button type="button" onClick={() => { setJobId(j.id); minRef.current?.focus(); }} className="font-mono font-medium text-ink hover:underline">{j.number}</button>
                <span className="truncate text-ink-500">{fullName(j.client)}</span>
                <WorkflowBadges workflow={j.workflow} />
                <StatusPill status={j.status} />
                <span className="ml-auto inline-flex items-center gap-1 tabular text-ink-400"><Clock size={10} /> {totals[j.id] ?? 0}m</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
