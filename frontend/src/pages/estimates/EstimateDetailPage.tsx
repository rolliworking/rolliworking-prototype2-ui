import { ArrowLeft, Briefcase, Check, Copy, Lock, Mail, PackageCheck, PenLine, Printer, RotateCcw, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { LegacyBadge, LegacyBanner } from '@/components/LegacyBits';
import type { Address, DeptCode, EstimateLine, EstimateWithRefs, Watch } from '@/api/client';
import { EstimateStatusPill, Provisional } from '@/components/estimates/EstimateBits';
import { EstimateAddresses, EstimateMeta, WatchPicker } from '@/components/estimates/EstimateForm';
import { DeclineModal, RevisionHistory, SendModal } from '@/components/estimates/EstimateModals';
import { ChainForEstimate } from '@/components/estimates/ComponentChain';
import { ItemSection } from '@/components/estimates/ItemSection';
import { AddItemButton } from '@/components/estimates/MultiItemBits';
import { inferItemCodes, newItem, removeItem, type EstimateItem } from '@/api/items';
import { blankLine } from '@/components/estimates/LineEditor';
import { useAuth } from '@/auth/AuthContext';
import { PrintPreview } from '@/components/estimates/PrintPreview';
import { ClientRefPill } from '@/components/intake/ClientRefBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

interface Form { lines: EstimateLine[]; items: EstimateItem[]; watch: Watch | null; validUntil: string; clientNotes: string; messageNotes: string; internalNotes: string; billing: Address; shipping: Address; mirror: boolean }
const SINGLE: EstimateItem = { id: '__single', label: 'Watch' };
const toForm = (e: EstimateWithRefs): Form => ({ lines: e.lines.map((l) => ({ ...l })), items: (e.items ?? []).map((i) => ({ ...i })), watch: e.watch, validUntil: e.validUntil, clientNotes: e.clientNotes, messageNotes: e.messageNotes, internalNotes: e.internalNotes, billing: e.billingAddress, shipping: e.shippingAddress, mirror: e.shippingMirrorsBilling });
const toPatch = (f: Form): api.EstimatePatch => ({ lines: f.lines, items: f.items.length > 1 ? f.items : undefined, watchId: f.watch?.id ?? '', validUntil: f.validUntil, clientNotes: f.clientNotes, messageNotes: f.messageNotes, internalNotes: f.internalNotes, billingAddress: f.billing, shippingAddress: f.shipping, shippingMirrorsBilling: f.mirror });

export default function EstimateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const [deselected, setDeselected] = useState<Set<string>>(new Set()); // default: every open line checked
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
  const pickedIds = () => e.lines.filter((l) => !deselected.has(l.id)).map((l) => l.id);

  const saveRevision = () => run(() => api.reviseEstimate(e.id, toPatch(form)), `Revision ${e.revision + 1} saved — rev ${e.revision} kept`).then(() => setRevising(false));

  // Items: multi-item estimates carry their own array; a single-item estimate renders the same unit with one synthetic item (no numbering, no header)
  const multi = form.items.length > 1; const items = multi ? form.items : [SINGLE];
  const chipsLocked = !!e.legacy || e.status === 'converted';
  const setItemLines = (itemId: string, ls: EstimateLine[]) => change({ lines: [...form.lines.filter((l) => (l.itemId ?? items[0].id) !== itemId), ...ls.map((l) => ({ ...l, itemId: multi ? itemId : l.itemId }))] });
  const addItem = () => { const first = form.items[0] ?? newItem(e.watch ? `${e.watch.brand} ${e.watch.model}` : 'Watch'); const it = newItem(`Item ${(form.items.length || 1) + 1}`); const base = form.items.length ? form.items : [first]; change({ items: [...base, it], lines: [...form.lines.map((l) => ({ ...l, itemId: l.itemId ?? first.id })), { ...blankLine(true), itemId: it.id }] }); };
  const removeIt = (itemId: string) => { const r = removeItem(form.lines, form.items, itemId); change({ items: r.items.length > 1 ? r.items : [], lines: r.items.length > 1 ? r.lines : r.lines.map((l) => ({ ...l, itemId: undefined })) }); };
  // Chip override per item: logged with who / when / what was inferred. Draft → travels with autosave; otherwise persisted immediately.
  const setItemCodes = (itemId: string, codes: DeptCode[] | null) => {
    if (!multi) { const cur = api.estimateComponentCodes(e).codes; if (codes) void run(() => api.setEstimateComponents(e.id, codes), 'Component codes updated'); else void run(() => api.setEstimateComponents(e.id, api.inferComponentCodes(e.lines)), 'Component codes reverted to inferred'); void cur; return; }
    if (editing) { change({ items: form.items.map((i) => (i.id !== itemId ? i : codes === null ? { ...i, components: undefined, componentsOverride: undefined } : { ...i, components: codes, componentsOverride: { by: user?.shortName ?? 'Staff', at: new Date().toISOString(), from: inferItemCodes(form.lines, form.items, itemId) } })) }); return; }
    void run(() => api.setEstimateItemComponents(e.id, itemId, codes), codes ? 'Item component codes overridden · logged' : 'Item component codes reverted to inferred');
  };

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
            <span className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-500" data-testid="estimate-revision">rev {e.revision}</span>{e.validUntil && <span className="text-[11px] text-ink-500" data-testid="estimate-valid-until">Valid until {fmtDate(e.validUntil)}</span>}
            <EstimateStatusPill status={e.status} testId="estimate-status" />
            <ClientRefPill value={e.clientRef} readOnly={!!e.legacy || e.historical} sample={`Your estimate ${e.number} is ready to review`} onSave={(v) => run(() => api.setClientRef(e.id, v), v.trim() ? `Client reference "${v.trim()}" — email subjects will carry it` : 'Client reference cleared')} testId="estimate-client-ref" />
            {e.historical && <span data-testid="historical-badge" className="inline-flex items-center gap-1 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"><Lock size={10} /> Historical · read-only</span>}
            {e.revision > 1 && e.sentAt && e.updatedAt > e.sentAt && e.status === 'sent' && <span className="text-[11px] text-amber-800">revised since last send</span>}
          </div>
          <div className="mt-0.5 text-xs text-ink-500"><Link to={`/clients/${e.clientId}`} className="font-medium text-ink hover:underline">{fullName(e.client)}</Link> · {e.client.email} · {e.client.phone}</div>
          {e.status === 'declined' && e.declineReason && <p data-testid="decline-reason-shown" className="mt-1 text-xs text-rose-700">Declined {e.declinedAt && fmtDate(e.declinedAt)}: {e.declineReason}</p>}
        </div>

        {e.legacy ? <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid="estimate-actions"><LegacyBadge testId="estimate-legacy-badge" /></div> : <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid="estimate-actions">
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
            <Button variant="primary" data-testid="act-create-job" onClick={async () => { try { const j = await api.convertEstimate(e.id, 'job', pickedIds()); navigate(`/jobs/${j.id}`); } catch (er) { setError(er instanceof Error ? er.message : 'Create job failed'); } }}><Briefcase size={13} /> Create job</Button>
            <Button data-testid="act-convert-so" onClick={async () => { try { const o = await api.convertEstimateToSalesOrder(e.id, pickedIds()); navigate(`/sales/${o.id}`); } catch (er) { setError(er instanceof Error ? er.message : 'Convert failed'); } }}>Convert to SO</Button>
          </>}
          {(e.status === 'sent' || e.status === 'approved' || (e.status === 'converted' && e.jobId)) && !e.historical && (
            <Button data-testid="act-convert-intake" title="Pack: job goes on hand + intake date; estimate converted" onClick={async () => { try { const j = await api.convertEstimate(e.id, 'intake', pickedIds()); navigate(`/jobs/${j.id}`); } catch (er) { setError(er instanceof Error ? er.message : 'Convert failed'); } }}><PackageCheck size={13} /> Convert to intake</Button>
          )}
          {e.status === 'converted' && e.jobId && <Link to={`/jobs/${e.jobId}`} data-testid="act-open-job" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink-300 hover:bg-canvas"><Briefcase size={13} /> Open job</Link>}
          <Button data-testid="act-print" onClick={() => setModal('print')}><Printer size={13} /> Print</Button>
          <Button data-testid="act-duplicate" onClick={async () => { const c = await api.duplicateEstimate(e.id); navigate(`/estimates/${c.id}`); }}><Copy size={13} /> Duplicate</Button>
          {e.status !== 'converted' && <Button data-testid="act-delete" onClick={() => { if (window.confirm(`Delete ${e.number}?`)) run(() => api.deleteEstimate(e.id), '').then(() => navigate('/estimates')); }}><Trash2 size={13} className="text-rose-700" /></Button>}
        </div>}
      </div>
      <LegacyBanner kind="estimate" id={e.id} legacy={e.legacy} convertedFrom={e.convertedFromLegacy} />

      <Card title="Billing & shipping" testId="detail-addresses-card">
        <EstimateAddresses billing={form.billing} shipping={form.shipping} mirror={form.mirror} readOnly={!editing} onChange={(p) => change(p)} />
      </Card>

      {flash && <div data-testid="estimate-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      {error && <div data-testid="estimate-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}
      {revising && <div data-testid="revising-banner" className="rounded-sm bg-amber-50 px-3 py-1.5 text-xs text-amber-900">Revising a sent estimate — saving creates rev {e.revision + 1}; rev {e.revision} is kept and viewable below. Send again to deliver the new version.</div>}

      <Card title="Watch" subtitle={editing ? 'Existing or new' : undefined} testId="detail-watch-card">
        {editing ? <WatchPicker clientId={e.clientId} value={form.watch} onChange={(w) => change({ watch: w })} /> : e.watch ? <div className="text-[13px]">{e.watch.brand} {e.watch.model} <span className="font-mono text-xs text-ink-500">Ref {e.watch.reference} · Serial {e.watch.serial}</span>{e.targetDate && <span data-testid="estimate-target" className="ml-2 rounded-sm bg-moss-50 px-1.5 py-0.5 text-xs font-medium text-moss-700">Target {fmtDate(e.targetDate)} · {e.targetWeeks} wk · set at Receive Watch</span>}</div> : <span className="text-xs text-ink-400">No watch on this estimate.</span>}
      </Card>

      <Card title="Lines" subtitle={editing ? 'Drag or use arrows to reorder · edit amount to back-calc rate · ≥2 blank rows kept · each item has its own table + chips' : 'Read-only in this status'} testId="detail-lines-card">
        {editing && <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><AddItemButton onAdd={addItem} testId="detail-add-item" /><span className="text-[10px] text-ink-400">“Add additional line” (inside a table) = more work on the same piece · “Add Additional Item” = another physical piece</span></div>}
        <div data-testid="detail-items" data-count={items.length} className="space-y-3">
          {items.map((it) => { const single = !multi; const ec = single ? api.estimateComponentCodes(e) : null; const shown = single ? { ...it, components: ec!.codes, componentsOverride: undefined } : it;
            return <ItemSection key={it.id} items={single ? [shown] : items} item={shown} lines={form.lines} onLines={editing ? (ls) => setItemLines(it.id, ls) : undefined} onLabel={editing ? (label) => change({ items: form.items.map((i) => (i.id === it.id ? { ...i, label } : i)) }) : undefined} onRemove={editing && multi ? () => removeIt(it.id) : undefined} onToggleCode={chipsLocked ? undefined : (next) => setItemCodes(it.id, next)} onRevertCodes={chipsLocked ? undefined : () => setItemCodes(it.id, null)} chipsReadOnly={chipsLocked} readOnly={!editing} blankTaxableDefault minBlank={editing ? 2 : 0} selection={!editing && !e.legacy ? { selected: new Set(e.lines.filter((l) => !deselected.has(l.id)).map((l) => l.id)), onToggle: (lid) => setDeselected((d) => { const n = new Set(d); if (n.has(lid)) n.delete(lid); else n.add(lid); return n; }), onCloseOut: (lid) => { const reason = window.prompt('Close this line out without converting — reason?'); if (reason) void run(() => api.closeOutEstimateLine(e.id, lid, reason), 'Line closed out'); } } : undefined} />; })}
        </div>
        {!editing && !e.legacy && e.lines.some((l) => l.conversions?.length) && <p data-testid="lines-convert-summary" className="mt-2 text-[11px] text-ink-500">{e.lines.filter((l) => l.conversions?.length).length} line{e.lines.filter((l) => l.conversions?.length).length === 1 ? '' : 's'} converted · {e.lines.filter((l) => !l.conversions?.length && !l.closedOut && (l.description.trim() || l.unitPrice)).length} still open · {e.lines.filter((l) => l.closedOut).length} closed out. Open lines can be converted separately or closed out.</p>}
      </Card>

      <Card title="Components · trickle-down chain" subtitle={multi ? 'One chain per item — Expected (that item’s chips) → Received at Scan 1 → Verified at Scan 2 · nothing crosses between items' : 'Expected (chips above the lines) → Received at Scan 1 → Verified at Scan 2 · toggling a chip is an explicit override, logged'} testId="detail-chain-card">
        <ChainForEstimate estimateId={e.id} tick={e.updatedAt} />
      </Card>

      <Card title="Details" testId="detail-meta-card">
        <EstimateMeta validUntil={form.validUntil} clientNotes={form.clientNotes} messageNotes={form.messageNotes} internalNotes={form.internalNotes} readOnly={!editing} onChange={(p) => change(p)} />
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
