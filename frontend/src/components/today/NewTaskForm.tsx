import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { Assignee, Division, JobWithRefs, Role } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export const NewTaskForm = ({ onCreated, defaultJobId }: { onCreated: () => void; defaultJobId?: string }) => {
  const { station } = useAuth();
  const div: Division = station?.division ?? 'rolliworks';
  const divStaff = api.getDivisionStaff(div);
  const divRoles = api.getDivisionRoles(div);
  const [jobs, setJobs] = useState<JobWithRefs[]>([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(`user:${divStaff[0]?.shortName ?? 'Vienna'}`);
  const [jobId, setJobId] = useState(defaultJobId ?? '');
  const [dueAt, setDueAt] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.getJobs().then((j) => setJobs(j.filter((x) => x.status !== 'closed'))); }, []);

  // Reset assignee when division changes
  useEffect(() => {
    setAssignee(`user:${divStaff[0]?.shortName ?? ''}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [div]);

  const create = async () => {
    const [type, value] = assignee.split(':');
    const assignedTo: Assignee = type === 'role' ? { type: 'role', role: value as Role } : { type: 'user', shortName: value };
    try {
      await api.createTask({ title, assignedTo, jobId: jobId || undefined, dueAt: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : undefined });
      setTitle(''); setDueAt(''); setErr(null);
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div data-testid="new-task-form" className="grid grid-cols-[1fr_190px_220px_140px_auto] items-end gap-2">
      <label className="text-xs text-ink-500">New task<input data-testid="task-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} placeholder="What needs doing — Enter to send" className={`${field} mt-1 block w-full`} /></label>
      <label className="text-xs text-ink-500">Assign to (same-division)
        <select data-testid="task-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${field} mt-1 block w-full`}>
          <optgroup label="People">
            {divStaff.map((u) => <option key={u.id} value={`user:${u.shortName}`}>{u.shortName}{u.division === 'both' ? ' (both)' : ''}</option>)}
          </optgroup>
          <optgroup label="Roles">
            {divRoles.map((r) => <option key={r} value={`role:${r}`}>{r} → {divStaff.filter((u) => u.roles.includes(r as Role)).map((u) => u.shortName).join(', ')}</option>)}
          </optgroup>
        </select>
      </label>
      <label className="text-xs text-ink-500">Link job (optional)<select data-testid="task-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className={`${field} mt-1 block w-full`}><option value="">None</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.number} · {j.client.lastName} · {j.watch.model}</option>)}</select></label>
      <label className="text-xs text-ink-500">Due<input type="date" data-testid="task-due" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
      <Button variant="primary" data-testid="task-create" onClick={create}><Plus size={13} /> Send</Button>
      {err && <p data-testid="task-error" className="col-span-5 text-xs font-medium text-rose-700">{err}</p>}
    </div>
  );
};
