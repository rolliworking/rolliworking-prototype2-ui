import { Camera, ClipboardList, FileCheck2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { IntakeStepJob, InspectionForm } from '@/api/client';
import { useIntakeCounts } from '@/components/intake/IntakeLayout';
import { CameraCapture } from '@/components/rw/pad/PadCamera';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtMoney, fullName } from '@/lib/format';
import InspectionFormPage from '@/pages/inspection/InspectionFormPage';

const Row = ({ r, children }: { r: IntakeStepJob; children?: React.ReactNode }) => (
  <li data-testid={`intake-step-row-${r.job.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
    <Link to={`/jobs/${r.job.id}`} className="font-mono font-semibold text-ink hover:underline">{r.job.number}</Link><span className="text-ink">{fullName(r.job.client)}</span><span className="text-ink-500">{r.job.watch.brand} {r.job.watch.model} <span className="font-mono">{r.job.watch.reference}</span></span><StatusPill status={r.job.status} />
    <span className="text-ink-400">intake photos {r.intakePhotos} · inspection photos {r.inspectionPhotos}</span>{children}
  </li>
);

// Step 5 · Photos — the existing job photo capture (PadCamera.CameraCapture + getJobPhotoViews), placed in the linear flow. NOTE: the sidebar "Inspection Photos" entry was a never-built placeholder; this is the only photo feature that exists.
export function IntakePhotosPage() {
  const [rows, setRows] = useState<IntakeStepJob[]>([]); const [msg, setMsg] = useState<string | null>(null); const { refreshCounts } = useIntakeCounts();
  const load = () => api.getIntakePhotoQueue().then(setRows); useEffect(() => { void load(); }, []);
  return <Card title="5 · Photos" subtitle="On-hand jobs still in intake — capture the inspection photo set (IPEVO / microscope) before the inspection form" testId="intake-photos-page" bodyClassName="p-0">
    {msg && <p className="px-3 pt-2 text-xs text-moss-700" data-testid="intake-photos-msg">{msg}</p>}
    <ul className="divide-y divide-line">{rows.map((r) => <Row key={r.job.id} r={r}><span className="ml-auto flex items-center gap-2"><CameraCapture jobId={r.job.id} jobNumber={r.job.number} compact onDone={(m) => { setMsg(m); void load(); refreshCounts(); }} />{r.inspectionPhotos > 0 && <Link data-testid={`intake-photos-next-${r.job.id}`} to={`/intake/inspect/new?job=${r.job.id}`} className="text-brand hover:underline">Next → 6 · Inspection</Link>}</span></Row>)}{!rows.length && <li className="px-3 py-6 text-center text-xs text-ink-400">No on-hand jobs waiting for photos</li>}</ul>
  </Card>;
}

// Step 6 · Inspection — list of jobs ready for the form + existing forms; the form itself is the unchanged InspectionFormPage mounted at /intake/inspect/:id
export function IntakeInspectionListPage() {
  const [rows, setRows] = useState<IntakeStepJob[]>([]); const [forms, setForms] = useState<InspectionForm[]>([]); const nav = useNavigate();
  useEffect(() => { api.getIntakePhotoQueue().then((r) => setRows(r.filter((x) => x.inspectionPhotos > 0))); api.listInspectionForms().then(setForms); }, []);
  return <div className="space-y-3" data-testid="intake-inspection-page">
    <Card title="6 · Inspection" subtitle="Jobs with inspection photos, waiting for the New Inspection form (Scan Label / Camera / Scan Sheet · Customer → Watch & Inspection)" bodyClassName="p-0" action={<Button size="sm" variant="primary" data-testid="intake-inspection-new" onClick={() => nav('/intake/inspect/new')}><ClipboardList size={12} /> New inspection</Button>}>
      <ul className="divide-y divide-line">{rows.map((r) => <Row key={r.job.id} r={r}><span className="ml-auto">{r.form ? <Link data-testid={`intake-inspect-open-${r.job.id}`} to={`/intake/inspect/${r.form.id}`} className="text-brand hover:underline">{r.form.status === 'saved' ? 'Saved' : 'Draft'} form → open</Link> : <Link data-testid={`intake-inspect-start-${r.job.id}`} to={`/intake/inspect/new?job=${r.job.id}`} className="rounded-sm bg-ink px-2 py-1 font-semibold text-white">Start inspection</Link>}</span></Row>)}{!rows.length && <li className="px-3 py-6 text-center text-xs text-ink-400">Nothing waiting — capture photos in step 5 first</li>}</ul>
    </Card>
    <Card title="Inspection forms" subtitle="Drafts and saved reports" bodyClassName="p-0"><ul className="divide-y divide-line">{forms.map((f) => <li key={f.id} data-testid={`intake-form-${f.id}`} className="flex items-center gap-3 px-3 py-2 text-xs"><Link to={`/intake/inspect/${f.id}`} className="font-mono font-semibold text-ink hover:underline">{f.estimateNumber || f.id}</Link><span>{f.customer.name || '—'}</span><span className="text-ink-500">{f.brand} {f.model}</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${f.status === 'saved' ? 'bg-moss-50 text-moss-700' : 'bg-amber-50 text-amber-800'}`}>{f.status}</span><span className="ml-auto font-mono">{fmtMoney(f.total)}</span><span className="text-ink-400">{fmtDate(f.savedAt ?? f.createdAt)}</span></li>)}</ul></Card>
  </div>;
}

export function IntakeInspectionFormStep() { const { pathname } = useLocation(); return <InspectionFormPage key={pathname} basePath="/intake/inspect" />; }

// Step 7 · Awaiting Approval — jobs parked in awaiting_customer_approval; approve / back-to-review is the existing job action set (job detail), the client report link is the saved inspection form
export function IntakeAwaitingApprovalPage() {
  const [rows, setRows] = useState<IntakeStepJob[]>([]); const { refreshCounts } = useIntakeCounts();
  const load = () => api.getAwaitingApprovalQueue().then(setRows); useEffect(() => { void load(); }, []);
  return <Card title="7 · Awaiting Approval" subtitle="Inspection submitted — waiting on the client's approve / decline (existing job approval flow)" testId="intake-awaiting-page" bodyClassName="p-0">
    <ul className="divide-y divide-line">{rows.map((r) => <Row key={r.job.id} r={r}><span className="ml-auto flex items-center gap-2">{r.form?.status === 'saved' ? <Link data-testid={`intake-approval-report-${r.job.id}`} to={`/rc/inspection/${r.form.token}`} className="inline-flex items-center gap-1 text-brand hover:underline"><FileCheck2 size={12} /> client report</Link> : <span data-testid={`intake-approval-report-${r.job.id}`} data-state="none" className="text-ink-400">no inspection report yet</span>}<Button size="sm" variant="primary" data-testid={`intake-approve-${r.job.id}`} onClick={async () => { await api.transitionJob(r.job.id, 'approve'); await load(); refreshCounts(); }}>Customer approved</Button><Link to={`/jobs/${r.job.id}`} data-testid={`intake-approval-job-${r.job.id}`} className="text-ink-500 hover:underline">job → decline / back to review</Link></span></Row>)}{!rows.length && <li className="px-3 py-6 text-center text-xs text-ink-400">Nothing awaiting approval</li>}</ul>
  </Card>;
}
void Camera;
