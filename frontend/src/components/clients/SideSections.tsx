import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, Globe, Mail, PackageCheck, PauseCircle, Phone, PlayCircle, ShieldAlert, Truck, User, type LucideIcon, Tablet } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import { Link } from 'react-router-dom';
import type { Client360, CustodyKind, RequestCloseReason, RequestSource, ServiceRequest } from '@/api/client';
import { assigneeLabel } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

const when = (iso: string) => { const d = new Date(iso); const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''; return `${fmtDate(iso)}${y} · ${fmtTime(iso)}`; };

const SOURCE_ICON: Record<RequestSource, LucideIcon> = { call: Phone, email: Mail, web: Globe, walk_in: User, kiosk: Tablet };

const StaffClose = ({ r, all, onDone }: { r: ServiceRequest; all: ServiceRequest[]; onDone: () => void }) => {
  const [reason, setReason] = useState<RequestCloseReason>('no_longer_needed');
  const [dup, setDup] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => { setErr(null); try { await api.closeRequest(r.id, reason, note, dup || undefined); onDone(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Failed'); } };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm bg-canvas p-2" data-testid={`request-close-form-${r.id}`}>
      <select data-testid={`request-close-reason-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value as RequestCloseReason)} className="h-7 rounded-sm border border-line bg-surface px-1.5 text-xs">{api.REQUEST_CLOSE_REASONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
      {reason === 'duplicate' && <select data-testid={`request-close-dup-${r.id}`} value={dup} onChange={(e) => setDup(e.target.value)} className="h-7 rounded-sm border border-line bg-surface px-1.5 text-xs"><option value="">Duplicate of…</option>{all.filter((x) => x.id !== r.id).map((x) => <option key={x.id} value={x.id}>{x.number}</option>)}</select>}
      <input data-testid={`request-close-note-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-7 flex-1 min-w-[120px] rounded-sm border border-line bg-surface px-1.5 text-xs" />
      <button type="button" data-testid={`request-close-confirm-${r.id}`} onClick={submit} className="h-7 rounded-sm bg-ink px-2 text-xs font-medium text-white">Close</button>
      <button type="button" data-testid={`request-close-cancel-${r.id}`} onClick={onDone} className="h-7 px-2 text-xs text-ink-500">Cancel</button>
      {err && <span className="text-xs text-rose-700">{err}</span>}
    </div>
  );
};

const isOpenReq = (r: ServiceRequest) => r.status === 'new' || r.status === 'quoted';

export const RequestsSection = ({ requests, watches, reload }: { requests: Client360['requests']; watches: Client360['watches']; reload?: () => void }) => {
  const [closing, setClosing] = useState<string | null>(null);
  return (
  <Card title="Requests" subtitle={`${requests.filter(isOpenReq).length} open · call / email / web / walk-in · closed ones are kept, never deleted`} bodyClassName="p-0" testId="client360-requests">
    <ul className="divide-y divide-line/60">
      {requests.map((r) => {
        const Icon = SOURCE_ICON[r.source];
        const w = r.watchId ? watches.find((g) => g.watch.id === r.watchId)?.watch : undefined;
        const dupOf = r.duplicateOfId ? requests.find((x) => x.id === r.duplicateOfId) : undefined;
        return (
          <li key={r.id} data-hit={`req-${r.id}`} data-testid={`client360-request-${r.id}`} className={`px-3 py-2 text-xs transition-colors hover:bg-canvas ${isOpenReq(r) ? '' : 'opacity-70'}`}>
            <div className="flex items-center gap-2">
              <Icon size={12} className="shrink-0 text-ink-400" />
              <span className="font-mono text-[11px] font-medium text-ink">{r.number}</span>
              <StatusPill status={r.status} />
              {w && <span className="truncate text-ink-500">{w.brand} {w.model}</span>}
              <span className="ml-auto tabular whitespace-nowrap text-ink-400">{when(r.createdAt)}</span>
            </div>
            <p className="mt-1 text-ink-700">{r.summary}</p>
            <div className="mt-0.5 flex gap-3 text-[11px] text-ink-400">
              <span>{r.source.replace('_', '-')} · {r.createdBy}</span>
              {r.estimateId && <Link to={`/estimates/${r.estimateId}`} className="text-brand hover:underline" data-testid={`request-estimate-link-${r.id}`}>→ estimate</Link>}
              {r.closedNote && <span data-testid={`request-closed-note-${r.id}`}>{r.closedBy === 'client' ? 'Client closed via RolliConnect' : 'Closed by staff'}{r.closedAt ? ` ${fmtDate(r.closedAt)}` : ''} · {r.closedNote}{dupOf && !r.closedNote.includes(dupOf.number) ? ` (${dupOf.number})` : ''}</span>}
              {isOpenReq(r) && reload && closing !== r.id && <button type="button" data-testid={`request-close-${r.id}`} onClick={() => setClosing(r.id)} className="ml-auto text-ink-400 hover:text-rose-700">Close…</button>}
            </div>
            {closing === r.id && reload && <StaffClose r={r} all={requests} onDone={() => { setClosing(null); reload(); }} />}
          </li>
        );
      })}
      {requests.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-400">No requests on file.</li>}
    </ul>
  </Card>
  );
};

export const NotesTasksSection = ({ notes, tasks }: { notes: Client360['notes']; tasks: Client360['tasks'] }) => (
  <Card title="Notes & tasks" subtitle={`${tasks.filter((t) => t.status === 'open').length} open tasks · ${notes.length} notes`} bodyClassName="p-0" testId="client360-notes-tasks">
    <ul className="divide-y divide-line/60">
      {tasks.map((t) => (
        <li key={t.id} data-testid={`client360-task-${t.id}`} className={`flex items-start gap-2 px-3 py-1.5 text-xs ${t.status === 'done' ? 'opacity-60' : ''}`}>
          <span className={`mt-0.5 shrink-0 rounded-sm px-1 text-[10px] font-semibold uppercase ${t.status === 'done' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-800'}`}>task</span>
          <div className="min-w-0 flex-1">
            <div className={`text-ink ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</div>
            <div className="text-[11px] text-ink-400">→ {assigneeLabel(t.assignedTo)} · from {t.createdBy}{t.dueAt ? ` · due ${fmtDate(t.dueAt)}` : ''}{t.jobId && <> · <Link to={`/jobs/${t.jobId}`} className="text-brand hover:underline">job</Link></>}</div>
          </div>
          <span className="tabular whitespace-nowrap text-[11px] text-ink-400">{when(t.createdAt)}</span>
        </li>
      ))}
      {notes.map((n) => (
        <li key={n.id} data-testid={`client360-note-${n.id}`} className="flex items-start gap-2 px-3 py-1.5 text-xs">
          <span className="mt-0.5 shrink-0 rounded-sm bg-brand-50 px-1 text-[10px] font-semibold uppercase text-brand">note</span>
          <div className="min-w-0 flex-1">
            <div className="text-ink-700">{n.text}</div>
            <div className="text-[11px] text-ink-400"><Link to={n.path} className="font-mono hover:underline">{n.ref}</Link> · {n.by} · {n.station}</div>
          </div>
          <span className="tabular whitespace-nowrap text-[11px] text-ink-400">{when(n.at)}</span>
        </li>
      ))}
      {tasks.length + notes.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-400">Nothing noted yet.</li>}
    </ul>
  </Card>
);

const CUSTODY: Record<CustodyKind, { icon: LucideIcon; tone: string; label: string }> = {
  package_arrived: { icon: ArrowDownToLine, tone: 'text-amber-800 bg-amber-50', label: 'Arrived' },
  watch_received: { icon: PackageCheck, tone: 'text-moss-700 bg-moss-50', label: 'In custody' },
  discrepancy: { icon: ShieldAlert, tone: 'text-rose-700 bg-rose-50', label: 'Discrepancy' },
  hold_placed: { icon: PauseCircle, tone: 'text-orange-800 bg-orange-50', label: 'Hold' },
  hold_released: { icon: PlayCircle, tone: 'text-brand bg-brand-50', label: 'Released' },
  shipped: { icon: Truck, tone: 'text-slate-600 bg-slate-100', label: 'Shipped' },
  picked_up: { icon: ArrowUpFromLine, tone: 'text-slate-600 bg-slate-100', label: 'Picked up' },
};

export const CustodySection = ({ custody }: { custody: Client360['custody'] }) => (
  <Card title="Custody" subtitle="Every time a watch changed hands — derived from intake, holds, shipments and pickups" bodyClassName="p-0" testId="client360-custody">
    <ol className="divide-y divide-line/60">
      {custody.map((c) => {
        const m = CUSTODY[c.kind];
        const Icon = m.icon;
        return (
          <li key={c.id} data-hit={c.hitKey} data-testid={`client360-custody-${c.id}`} className="flex items-start gap-2 px-3 py-1.5 text-xs">
            <span className={`mt-px inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[10px] font-semibold ${m.tone}`}><Icon size={11} /> {m.label}</span>
            <Link to={c.path} className="min-w-0 flex-1 text-ink-700 hover:underline" data-testid={`custody-link-${c.id}`}>{c.detail}</Link>
            <span className="tabular whitespace-nowrap text-[11px] text-ink-400">{when(c.at)} · {c.by}</span>
          </li>
        );
      })}
      {custody.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-400">No custody events yet.</li>}
    </ol>
  </Card>
);

const EmailRow = ({ e }: { e: Client360['emails'][number] }) => {
  const [open, setOpen] = useState(false);
  return (
    <li data-testid={`client360-email-${e.id}`} className="px-3 py-1.5 text-xs">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left" data-testid={`email-toggle-${e.id}`}>
        {open ? <ChevronDown size={12} className="mt-0.5 shrink-0 text-ink-400" /> : <ChevronRight size={12} className="mt-0.5 shrink-0 text-ink-400" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-ink">{e.subject}</div>
          <div className="text-[11px] text-ink-400">{e.relatedRef} · {e.createdBy} · <span className="rounded-sm bg-amber-50 px-1 text-amber-800">queued</span></div>
        </div>
        <span className="tabular whitespace-nowrap text-[11px] text-ink-400">{when(e.createdAt)}</span>
      </button>
      {open && <pre className="mt-1.5 whitespace-pre-wrap rounded-sm bg-canvas p-2 font-sans text-[11px] leading-4 text-ink-700" data-testid={`email-body-${e.id}`}>{e.body}</pre>}
    </li>
  );
};

export const EmailsSection = ({ emails, clientId }: { emails: Client360['emails']; clientId?: string }) => (
  <Card title="Emails & conversations" subtitle={`${emails.length} queued or sent · newest first`} action={<span className="flex items-center gap-2 text-xs">{clientId && <Link data-testid="client360-threads-link" to={`/inbox?client=${clientId}`} className="font-medium text-brand hover:underline">Open thread-space →</Link>}<Link to="/intake/outbox" className="text-ink-400 hover:underline">Outbox</Link></span>} bodyClassName="p-0" testId="client360-emails">
    <ul className="divide-y divide-line/60">
      {emails.map((e) => <EmailRow key={e.id} e={e} />)}
      {emails.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-400">No emails to this client yet.</li>}
    </ul>
  </Card>
);
