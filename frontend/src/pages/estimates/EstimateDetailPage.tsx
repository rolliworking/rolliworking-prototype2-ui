import { ArrowLeft, Briefcase, Check, Copy, Lock, Mail, PackageCheck, PenLine, Printer, RotateCcw, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Address, EstimateLine, EstimateWithRefs, Watch } from '@/api/client';
import { EstimateStatusPill, Provisional } from '@/components/estimates/EstimateBits';
import { EstimateMeta, WatchPicker } from '@/components/estimates/EstimateForm';
import { DeclineModal, RevisionHistory, SendModal } from '@/components/estimates/EstimateModals';
import { LineEditor } from '@/components/estimates/LineEditor';
import { PrintPreview } from '@/components/estimates/PrintPreview';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

interface Form { lines: EstimateLine[]; watch: Watch | null; validUntil: string; clientNotes: string; messageNotes: string; internalNotes: string; billing: Address; shipping: Address; mirror: boolean }
const toForm = (e: EstimateWithRefs): Form => ({ lines: e.lines.map((l) => ({ ...l })), watch: e.watch, validUntil: e.validUntil, clientNotes: e.clientNotes, messageNotes: e.messageNotes, internalNotes: e.internalNotes, billing: e.billingAddress, shipping: e.shippingAddress, mirror: e.shippingMirrorsBilling });
const toPatch = (f: Form): api.EstimatePatch => ({ lines: f.lines, watchId: f.watch?.id ?? '', validUntil: f.validUntil, clientNotes: f.clientNotes, messageNotes: f.messageNotes, internalNotes: f.internalNotes, billingAddress: f.billing, shippingAddress: f.shipping, shippingMirrorsBilling: f.mirror });

export default function EstimateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [est, setEst] = useState<EstimateWithRefs | null | undefined>(undefined);
  const [form, setForm] = useState<Form | null>(null);
  const [revising, setRevising] = useState(false);
  const [modal, setModal] = useState<'send' | 'decline' | 'print' | null>(params.get('send') ? 'send' : null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const e = await api.getEstimate(id);
    setEst(e);
    if (e) setForm(toForm(e));
    dirty.current = false;
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const say = (msg: string) => {
    setFlash(msg);
    setError(null);
    window.setTimeout(() => setFlash(null), 3000);
  };
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      await load();
      say(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const isDraft = est?.status === 'draft' && !est.historical;
  const editing = isDraft || revising;

  // Draft autosave, debounced ~450ms (per pack)
  const change = (patch: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    dirty.current = true;
    if (!isDraft) return;
    setSaving('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setForm((f) => {
        if (f) api.updateEstimate(id, toPatch(f)).then((e) => { setEst(e); setSaving('saved'); dirty.current = false; }).catch((er) => setError(er instanceof Error ? er.message : 'Save failed'));
        return f;
      });
    }, 450);
  };

  if (est === undefined || !form) return null;
  if (!est) return <div className="text-ink-500">Estimate not found. <Link to="/estimates" className="underline">Back</Link></div>;
  const e = est;

  const saveRevision = () => run(() => api.reviseEstimate(e.id, toPatch(form)), `Revision ${e.revision + 1} saved — rev ${e.revision} kept`).then(() => setRevising(false));

  return (
    <div data-testid="estimate-detail-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/estimates" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Estimates</Link>
        <div className="flex items-center gap-2 text-[11px] text-ink-400">
          {saving === 'saving' && <span data-testid="autosave-state">Saving…</span>}
          {saving === 'saved' && <span data-testid="autosave-state" className="inline-flex items-center gap-1 text-moss-700"><Check size={11} /> Saved</span>}
          <span>Created {fmtDate(e.createdAt)} by {e.createdBy}</span>
          {e.sentAt && <span>· Sent {fmtDate(e.sentAt)} {fmtTime(e.sentAt)}</span>}
          {e.approvedAt && <span>· Approved {fmtDate(e.approvedAt)}</span>}
          {e.convertedAt && <span>· Converted {fmtDate(e.convertedAt)}</span>}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-ink" data-testid="estimate-number">{e.number}</h1>
            <span className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-500" data-testid="estimate-revision">rev {e.revision}</span>
            <EstimateStatusPill status={e.status} testId="estimate-status" />
            {e.historical && <span data-testid="historical-badge" className="inline-flex items-center gap-1 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"><Lock size={10} /> Historical · read-only</span>}
            {e.revision > 1 && e.sentAt && e.updatedAt > e.sentAt && e.status === 'sent' && <span className="text-[11px] text-amber-800">revised since last send</span>}
          </div>
          <div className="mt-0.5 text-xs text-ink-500"><Link to={`/clients/${e.clientId}`} className="font-medium text-ink hover:underline">{fullName(e.client)}</Link> · {e.client.email} · {e.client.phone}</div>
          {e.status === 'declined' && e.declineReason && <p data-testid="decline-reason-shown" className="mt-1 text-xs text-rose-700">Declined {e.declinedAt && fmtDate(e.declinedAt)}: {e.declineReason}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid="estimate-actions">
          {isDraft && <><Button data-testid="act-mark-sent" onClick={() => run(() => api.markEstimateSent(e.id), 'Marked as sent (no email, no sent-at)')}><Mail size={13} /> Mark as sent</Button><Button variant="primary" data-testid="act-send" onClick={() => setModal('send')}><Send size={13} /> Send…</Button></>}
          {e.status === 'sent' && !e.historical && !revising && <>
            <Button data-testid="act-revise" onClick={() => setRevising(true)}><PenLine size={13} /> Revise</Button>
            <Button data-testid="act-send-again" onClick={() => setModal('send')}><Send size={13} /> Send again…</Button>
            <Button data-testid="act-decline" onClick={() => setModal('decline')}><ThumbsDown size={13} /> Decline…</Button>
            <span className="inline-flex items-center gap-1"><Button data-testid="act-approve" onClick={() => run(() => api.approveEstimate(e.id), 'Approval recorded (provisional status)')}><ThumbsUp size={13} /> Client approved</Button><Provisional note="Staff-recorded approval — not a legacy status" /></span>
          </>}
          {revising && <><Button variant="primary" data-testid="act-save-revision" onClick={saveRevision}><Check size={13} /> Save as rev {e.revision + 1}</Button><Button data-testid="act-cancel-revision" onClick={() => { setRevising(false); setForm(toForm(e)); }}>Cancel</Button></>}
          {(e.status === 'declined' || e.status === 'expired') && <Button variant="primary" data-testid="act-reopen" onClick={() => run(() => api.reopenEstimate(e.id), 'Reopened → draft')}><RotateCcw size={13} /> Reopen → draft</Button>}
          {e.status === 'approved' && <>
            <Button variant="primary" data-testid="act-create-job" onClick={async () => { try { const j = await api.convertEstimate(e.id, 'job'); navigate(`/jobs/${j.id}`); } catch (er) { setError(er instanceof Error ? er.message : 'Create job failed'); } }}><Briefcase size={13} /> Create job</Button>
            <span className="inline-flex items-center gap-1"><Button data-testid="act-convert-so" onClick={() => run(() => api.convertEstimate(e.id, 'sales_order'), '')}>Convert to SO</Button><Provisional note="Sales order target arrives in a later session — stub" /></span>
          </>}
          {(e.status === 'sent' || e.status === 'approved' || (e.status === 'converted' && e.jobId)) && !e.historical && (
            <Button data-testid="act-convert-intake" title="Pack: job goes on hand + intake date; estimate converted" onClick={async () => { try { const j = await api.convertEstimate(e.id, 'intake'); navigate(`/jobs/${j.id}`); } catch (er) { setError(er instanceof Error ? er.message : 'Convert failed'); } }}><PackageCheck size={13} /> Convert to intake</Button>
          )}
          {e.status === 'converted' && e.jobId && <Link to={`/jobs/${e.jobId}`} data-testid="act-open-job" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink-300 hover:bg-canvas"><Briefcase size={13} /> Open job</Link>}
          <Button data-testid="act-print" onClick={() => setModal('print')}><Printer size={13} /> Print</Button>
          <Button data-testid="act-duplicate" onClick={async () => { const c = await api.duplicateEstimate(e.id); navigate(`/estimates/${c.id}`); }}><Copy size={13} /> Duplicate</Button>
          {e.status !== 'converted' && <Button data-testid="act-delete" onClick={() => { if (window.confirm(`Delete ${e.number}?`)) run(() => api.deleteEstimate(e.id), '').then(() => navigate('/estimates')); }}><Trash2 size={13} className="text-rose-700" /></Button>}
        </div>
      </div>

      {flash && <div data-testid="estimate-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      {error && <div data-testid="estimate-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}
      {revising && <div data-testid="revising-banner" className="rounded-sm bg-amber-50 px-3 py-1.5 text-xs text-amber-900">Revising a sent estimate — saving creates rev {e.revision + 1}; rev {e.revision} is kept and viewable below. Send again to deliver the new version.</div>}

      <Card title="Watch" subtitle={editing ? 'Existing or new' : undefined} testId="detail-watch-card">
        {editing ? <WatchPicker clientId={e.clientId} value={form.watch} onChange={(w) => change({ watch: w })} /> : e.watch ? <div className="text-[13px]">{e.watch.brand} {e.watch.model} <span className="font-mono text-xs text-ink-500">Ref {e.watch.reference} · Serial {e.watch.serial}</span></div> : <span className="text-xs text-ink-400">No watch on this estimate.</span>}
      </Card>

      <Card title="Lines" subtitle={editing ? 'Drag or use arrows to reorder · edit amount to back-calc rate · ≥2 blank rows kept' : 'Read-only in this status'} testId="detail-lines-card">
        <LineEditor lines={form.lines} onChange={(ls) => change({ lines: ls })} readOnly={!editing} blankTaxableDefault minBlank={editing ? 2 : 0} />
      </Card>

      <Card title="Details" testId="detail-meta-card">
        <EstimateMeta validUntil={form.validUntil} clientNotes={form.clientNotes} messageNotes={form.messageNotes} internalNotes={form.internalNotes} billing={form.billing} shipping={form.shipping} mirror={form.mirror} readOnly={!editing} onChange={(p) => change(p)} />
      </Card>

      <Card title="Revisions" subtitle="Prior versions are never overwritten" testId="detail-revisions-card">
        <RevisionHistory estimate={e} />
      </Card>

      {modal === 'send' && <SendModal estimate={e} onClose={() => { setModal(null); setParams({}); }} onSent={() => { setModal(null); setParams({}); void load().then(() => say('Email queued to Outbox · status sent')); }} />}
      {modal === 'decline' && <DeclineModal estimate={e} onClose={() => setModal(null)} onDone={() => { setModal(null); void load().then(() => say('Declined')); }} />}
      {modal === 'print' && <PrintPreview estimate={e} onClose={() => setModal(null)} />}
    </div>
  );
}
