import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { Client, DeptCode, EstimateWithRefs, JobPriority, User, Watch } from '@/api/client';
import { ClientPicker, WatchPicker } from '@/components/estimates/EstimateForm';
import { JobsSubNav, Provisional } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DeptBadge } from '@/components/ui/Pills';
import { fmtMoneyCents } from '@/lib/format';

const PRIORITIES: JobPriority[] = ['low', 'normal', 'high', 'urgent'];
const DEPTS: DeptCode[] = ['W', 'B', 'P', 'PM'];
const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export default function JobCreatePage() {
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);
  const [estimates, setEstimates] = useState<EstimateWithRefs[]>([]);
  const [estimateId, setEstimateId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [f, setF] = useState({ priority: 'normal' as JobPriority, dueAt: '', assignedTo: '', conditionNotes: '', intakeNotes: '', onHand: true, workflow: [] as DeptCode[] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getUsers().then(setUsers); }, []);
  useEffect(() => {
    if (!client) return setEstimates([]);
    api.getEstimatesForClient(client.id).then((es) => setEstimates(es.filter((e) => !e.jobId && e.status !== 'declined' && e.status !== 'converted')));
  }, [client]);
  useEffect(() => { setWatch(null); setEstimateId(''); }, [client?.id]);

  const est = estimates.find((e) => e.id === estimateId);
  useEffect(() => { if (est?.watch) setWatch(est.watch); }, [est]);

  const toggleDept = (d: DeptCode) => setF((s) => ({ ...s, workflow: s.workflow.includes(d) ? s.workflow.filter((x) => x !== d) : [...s.workflow, d] }));

  const create = async () => {
    if (!client) return setError('Pick a customer first');
    if (!watch) return setError('Watch is required on create');
    try {
      const j = await api.createJob({ clientId: client.id, watchId: watch.id, estimateId: est?.id, priority: f.priority, dueAt: f.dueAt ? new Date(`${f.dueAt}T17:00:00`).toISOString() : undefined, assignedTo: f.assignedTo || undefined, conditionNotes: f.conditionNotes, intakeNotes: f.intakeNotes, onHand: f.onHand, workflow: f.workflow, lines: est?.lines });
      navigate(`/jobs/${j.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed'); }
  };

  return (
    <div data-testid="job-create-page" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link to="/jobs" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Jobs</Link>
          <h1 className="text-xl font-semibold tracking-tight text-ink">New job</h1>
          <p className="mt-0.5 text-xs text-ink-500">Customer → watch → job fields. Status starts at <span className="font-medium">intake</span>; the job id comes from the next-job-id sequence.</p>
        </div>
        <JobsSubNav />
      </div>

      <Card title="1 · Customer" testId="create-client-card"><ClientPicker value={client} onChange={setClient} /></Card>

      {client && (
        <Card title="2 · Watch" subtitle="Required on create — pick an existing watch or add a new one" testId="create-watch-card">
          <WatchPicker clientId={client.id} value={watch} onChange={setWatch} />
          {estimates.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <label className="text-xs text-ink-500">Link an open estimate (optional) — lines carry onto the job</label>
              <select data-testid="estimate-link" value={estimateId} onChange={(e) => setEstimateId(e.target.value)} className={`${field} mt-1 block w-full`}>
                <option value="">No estimate</option>
                {estimates.map((e) => <option key={e.id} value={e.id}>{e.number} · {e.status} · {fmtMoneyCents(e.total)}{e.watch ? ` · ${e.watch.model}` : ''}</option>)}
              </select>
            </div>
          )}
        </Card>
      )}

      {client && watch && (
        <Card title="3 · Job fields" testId="create-fields-card">
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-ink-500">Priority<select data-testid="create-priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as JobPriority })} className={`${field} mt-1 block w-full`}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="text-xs text-ink-500">Due date<input type="date" data-testid="create-due" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
            <label className="text-xs text-ink-500">Assigned to<select data-testid="create-assignee" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} className={`${field} mt-1 block w-full`}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.shortName}>{u.shortName} — {u.dutyLabel}</option>)}</select></label>
            <div className="text-xs text-ink-500">Workflow <span className="text-ink-400">(defaults from lines)</span><div className="mt-1 flex h-8 items-center gap-1">{DEPTS.map((d) => <button key={d} type="button" data-testid={`create-wf-${d}`} onClick={() => toggleDept(d)} className={`rounded-sm ring-2 ring-offset-1 ${f.workflow.includes(d) ? 'ring-ink' : 'ring-transparent opacity-60 hover:opacity-100'}`}><DeptBadge code={d} /></button>)}</div></div>
            <label className="col-span-2 text-xs text-ink-500">Condition notes<textarea data-testid="create-condition" rows={2} value={f.conditionNotes} onChange={(e) => setF({ ...f, conditionNotes: e.target.value })} className="mt-1 block w-full rounded-sm border border-line bg-canvas px-2 py-1 text-[13px] focus:border-ink focus:outline-none" /></label>
            <label className="col-span-2 text-xs text-ink-500">Intake notes<textarea data-testid="create-intake-notes" rows={2} value={f.intakeNotes} onChange={(e) => setF({ ...f, intakeNotes: e.target.value })} className="mt-1 block w-full rounded-sm border border-line bg-canvas px-2 py-1 text-[13px] focus:border-ink focus:outline-none" /></label>
            <label className="col-span-4 inline-flex items-center gap-2 text-xs text-ink-700"><input type="checkbox" data-testid="create-on-hand" checked={f.onHand} onChange={(e) => setF({ ...f, onHand: e.target.checked })} /> Watch is on hand (sets simple status on_hand + intake date; Shop Time lists on-hand jobs only) <Provisional note="Pack: simple_status estimate | on_hand | finished — when a fresh job is on_hand is UNKNOWN" /></label>
          </div>
          {est && <p className="mt-2 text-xs text-ink-500" data-testid="create-lines-preview">{est.lines.length} line{est.lines.length === 1 ? '' : 's'} from {est.number} will carry onto the job · {fmtMoneyCents(est.total)}</p>}
          {error && <p data-testid="create-error" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end"><Button variant="primary" data-testid="create-job-submit" onClick={create}><Check size={13} /> Create job</Button></div>
        </Card>
      )}
    </div>
  );
}
