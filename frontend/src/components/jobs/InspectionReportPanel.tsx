import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ComponentGrade, InspectionReportDoc, Job } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { fmtDate } from '@/lib/format';

export function InspectionReportPanel({ job, run }: { job: Job; run: (a: () => Promise<unknown>, m: string) => Promise<void> }) {
  const [reports, setReports] = useState<InspectionReportDoc[]>([]);
  const [grades, setGrades] = useState<Record<string, ComponentGrade>>(Object.fromEntries(api.REPORT_COMPONENTS.map((c) => [c, 'good' as ComponentGrade])));
  const [notes, setNotes] = useState<Record<string, string>>({}); const [summary, setSummary] = useState(''); const [open, setOpen] = useState(false);
  const reload = () => api.getInspectionReportsForJob(job.id).then(setReports);
  useEffect(() => { void reload(); }, [job.id, job.timeline.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const canIssue = job.photos.length > 0 && job.status !== 'closed';
  return (
    <div data-testid="inspection-report-panel" className="space-y-2 text-xs">
      <div className="text-[11px] text-ink-500">Portal-first: the client gets a short notification with one link; grades, photos and notes render at <span className="font-mono">/rc/report/&lt;token&gt;</span>. <Provisional note="Report content vocabulary (component list, grades) not yet ruled" /></div>
      {reports.map((r) => <div key={r.id} data-testid={`report-${r.id}`} className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${r.status === 'issued' ? 'border-amber-200 bg-amber-50/40' : r.status === 'approved' ? 'border-moss-200 bg-moss-50/40' : 'border-line opacity-80'}`}><span className="font-semibold">v{r.version}</span><span data-testid={`report-status-${r.id}`} className="rounded bg-canvas px-1 font-medium uppercase tracking-wide text-[10px]">{r.status}</span><span className="text-ink-500">{fmtDate(r.issuedAt)} · {r.issuedBy}</span><Link data-testid={`report-link-${r.id}`} to={`/rc/report/${r.token}`} target="_blank" className="font-mono text-brand hover:underline">/rc/report/{r.token}</Link>{r.decidedAt && <span className="text-ink-500">· decided {fmtDate(r.decidedAt)} via {r.decidedVia}{r.declineReason && ` — “${r.declineReason}”`}</span>}{r.emailId && <Link to="/intake/outbox" className="text-ink-400 hover:underline">Outbox</Link>}</div>)}
      {!open ? <Button size="sm" variant="primary" data-testid="report-issue-open" disabled={!canIssue} title={canIssue ? '' : 'Add inspection photos first'} onClick={() => setOpen(true)}>{reports.length ? 'Issue revised report' : 'Issue inspection report to client'}</Button>
        : <div data-testid="report-form" className="space-y-1 rounded-md border border-line bg-canvas/50 p-2">
          {api.REPORT_COMPONENTS.map((c) => <div key={c} className="flex items-center gap-2"><span className="w-28 text-ink-700">{c}</span><select data-testid={`report-grade-${c.replace(/[^a-z]/gi, '_')}`} value={grades[c]} onChange={(e) => setGrades({ ...grades, [c]: e.target.value as ComponentGrade })} className={field}>{api.COMPONENT_GRADES.map((g) => <option key={g}>{g}</option>)}</select><input value={notes[c] ?? ''} onChange={(e) => setNotes({ ...notes, [c]: e.target.value })} placeholder="note (optional)" className={`${field} flex-1`} /></div>)}
          <textarea data-testid="report-notes" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Notes to the client" className={`${field} block w-full`} />
          <div className="flex justify-end gap-1"><Button size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" variant="primary" data-testid="report-issue" onClick={() => run(async () => { await api.issueInspectionReport(job.id, api.REPORT_COMPONENTS.map((c) => ({ component: c, grade: grades[c], note: notes[c] })), summary); setOpen(false); await reload(); }, 'Report issued · notification queued to Outbox')}>Issue & notify</Button></div>
        </div>}
    </div>
  );
}
