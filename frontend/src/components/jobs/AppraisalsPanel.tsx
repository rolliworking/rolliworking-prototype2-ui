import { FileText, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as ap from '@/api/appraisals';
import type { Appraisal } from '@/api/appraisals';
import type { Job } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { fmtDate } from '@/lib/format';

// "Create Appraisal" — available once the job is complete (ready to ship / closed); lists drafts and finals for this job
export const AppraisalsPanel = ({ job }: { job: Job }) => {
  const [items, setItems] = useState<Appraisal[]>([]); const nav = useNavigate();
  useEffect(() => { void ap.listAppraisals(job.id).then(setItems); }, [job.id]);
  const completed = job.status === 'ready_to_ship' || job.status === 'closed';
  return <div data-testid="appraisals-panel" className="space-y-2 text-xs">
    <div className="flex items-center gap-2"><Button size="sm" variant="primary" data-testid="create-appraisal" disabled={!completed} title={completed ? undefined : 'Available once the job is complete'} onClick={() => void ap.createAppraisal(job.id).then((a) => nav(`/jobs/${job.id}/appraisal/${a.id}`))}><Plus size={12} /> Create Appraisal</Button><span className="text-ink-400">{completed ? 'Draft pre-populated from this job — nothing retyped' : 'Available once the job is complete'}</span></div>
    <ul className="divide-y divide-line/70">{items.map((a) => <li key={a.id} data-testid={`appraisal-row-${a.id}`} data-status={a.status} className="flex items-center gap-2 py-1.5"><FileText size={12} className="text-ink-400" /><Link to={`/jobs/${job.id}/appraisal/${a.id}`} data-testid={`appraisal-open-${a.id}`} className="font-mono font-semibold text-ink hover:underline">{a.number}</Link><span className="text-ink-500">{a.purpose} · {fmtDate(a.createdAt)} · {a.by}</span><span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${a.status === 'final' ? 'bg-moss-50 text-moss-700' : 'bg-amber-50 text-amber-800'}`}>{a.status === 'final' ? `final · signed ${a.signedBy}` : `draft · value ${a.valueSource}`}</span><span className="ml-auto font-mono text-ink">{a.value !== null ? ap.fmtValue(a.value) : '—'}</span></li>)}</ul>
  </div>;
};
