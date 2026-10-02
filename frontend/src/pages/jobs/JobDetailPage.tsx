import { Pin, Receipt, Tags, Trash2, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobAction, JobWithRefs, LabelJob, PartsRequestWithRefs, SalesOrderWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BackOrList } from '@/components/inbox/InboxReturnChip';
import { ItemHeader } from '@/components/jobs/ItemHeader';
import { Provisional } from '@/components/jobs/JobBits';
import { JobDetailContent, JobModals, type JobModalState, type JobRun } from '@/components/jobs/JobDetailContent';
import { ConciergeBackBar } from '@/components/jobs/SendToVendor';
import { Button } from '@/components/ui/Button';
import { useShowMoney } from '@/components/MoneyContext';

const ActionsBar = ({ j, so, run, setModal, setError, setLabels, setOpenPr }: { j: JobWithRefs; so: SalesOrderWithRefs | null; run: JobRun; setModal: (m: JobModalState) => void; setError: (e: string) => void; setLabels: (l: LabelJob[]) => void; setOpenPr: (p: PartsRequestWithRefs) => void }) => {
  const navigate = useNavigate(); const { user } = useAuth();
  const actions = api.legalJobActions(j); const gaps = api.reviewGaps(j); const crGaps = api.qcRequestGaps(j);
  const blocked = (a: JobAction) => (a.key === 'qc_pass' && crGaps.length ? `QC blocked — client request not checked off: “${crGaps[0].text}”` : gaps.join(' · '));
  const act = (a: JobAction) => (a.key === 'trade_send_back' ? setModal({ kind: 'trade_back' }) : a.needsReason ? setModal({ kind: 'reason', action: a }) : run(() => api.transitionJob(j.id, a.key), `${a.label} → ${a.to.replace(/_/g, ' ')}${a.notifies ? ' · client email queued' : ''}`));
  const guard = async (fn: () => Promise<void>, fallback: string) => { try { await fn(); } catch (er) { setError(er instanceof Error ? er.message : fallback); } };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid="job-actions">
      {actions.map((a) => (
        <span key={a.key} className="inline-flex items-center gap-1">
          <Button data-testid={`act-${a.key}`} disabled={!!blocked(a)} title={blocked(a) || undefined} variant={a.tone === 'primary' ? 'primary' : 'secondary'} className={a.tone === 'danger' ? '!border-rose-200 !text-rose-700 hover:!bg-rose-50' : undefined} onClick={() => act(a)}>{a.label}</Button>
          {a.provisional && <Provisional note={a.provisional} />}
          {a.notifies && <Provisional note="Pack is silent on which transitions notify the client — emailing here is provisional" />}
        </span>
      ))}
      {(j.status === 'ready_to_ship' || j.status === 'closed') && !so && <Button variant="primary" data-testid="act-invoice" onClick={() => guard(async () => { const o = await api.invoiceJob(j.id); navigate(`/sales/${o.id}`); }, 'Invoice failed')}><Receipt size={13} /> Create invoice (SO)</Button>}
      {so && <Link to={`/sales/${so.id}`} data-testid="act-open-so" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink-300 hover:bg-canvas"><Receipt size={13} /> {so.number} · {so.status.replace(/_/g, ' ')}</Link>}
      <Button data-testid="act-print-label" title={api.isBandOnlyJob(j, j.watch) ? 'Band-only job — PDF417 encodes the job number (no ref/serial)' : 'PDF417 (job · ref · serial) + ref/serial label'} onClick={() => guard(async () => setLabels(await api.queueJobLabels(j.id)), 'Label failed')}><Tags size={13} /> {api.isBandOnlyJob(j, j.watch) ? 'Print label · band only' : 'Print labels'}</Button>
      {j.status !== 'closed' && <Button data-testid="act-parts-request" onClick={() => guard(async () => setOpenPr(await api.openPartsRequest(j.id)), 'Failed')}><Wrench size={13} /> Parts request</Button>}
      <Button data-testid="act-pin" onClick={() => setModal({ kind: 'pin' })} title="Add to someone's hit list"><Pin size={13} /> Add to hit list</Button>
      {user?.accessTier === 'manager' && <Button data-testid="act-delete-job" title="Delete (can-delete-jobs)" onClick={() => { if (window.confirm(`Delete ${j.number}?`)) void run(() => api.deleteJob(j.id), '').then(() => navigate('/jobs')); }}><Trash2 size={13} className="text-rose-700" /></Button>}
    </div>
  );
};

export default function JobDetailPage() {
  const { id = '' } = useParams();
  const money = useShowMoney();
  const [job, setJob] = useState<JobWithRefs | null | undefined>(undefined);
  const [modal, setModal] = useState<JobModalState>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [so, setSo] = useState<SalesOrderWithRefs | null>(null);
  const [prs, setPrs] = useState<PartsRequestWithRefs[]>([]);
  const [openPr, setOpenPr] = useState<PartsRequestWithRefs | null>(null);
  const [labels, setLabels] = useState<LabelJob[] | null>(null);

  const load = useCallback(async () => { setJob(await api.getJob(id)); setSo(await api.getSalesOrderForJob(id)); setPrs(await api.getPartsRequestsForJob(id)); }, [id]);
  useEffect(() => { void load(); }, [load]);

  const say = (msg: string) => { setFlash(msg); setError(null); window.setTimeout(() => setFlash(null), 3000); };
  const run: JobRun = async (fn, msg) => { try { await fn(); await load(); if (msg) say(msg); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); } };

  if (job === undefined) return null;
  if (!job) return <div className="text-ink-500">Job not found. <Link to="/jobs" className="underline">Back to Jobs</Link></div>;
  const j = job;

  return (
    <div data-testid="job-detail-page" className="space-y-4">
      <ConciergeBackBar />
      <div className="flex items-start justify-between gap-4">
        <BackOrList to="/jobs" label="Jobs" testId="job-back" />
        <ActionsBar j={j} so={so} run={run} setModal={setModal} setError={setError} setLabels={setLabels} setOpenPr={setOpenPr} />
      </div>

      <ItemHeader job={j} so={so} reload={load} />

      {flash && <div data-testid="job-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      {error && <div data-testid="job-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}

      <JobDetailContent j={j} run={run} load={() => void load()} prs={prs} setOpenPr={setOpenPr} setModal={setModal} money={money} />
      <JobModals j={j} modal={modal} setModal={setModal} labels={labels} setLabels={setLabels} openPr={openPr} setOpenPr={setOpenPr} load={load} say={say} />
    </div>
  );
}
