import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, Globe, Mail, PackageCheck, PauseCircle, Phone, PlayCircle, ShieldAlert, Truck, User, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client360, CustodyKind, RequestSource } from '@/api/client';
import { assigneeLabel } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

const when = (iso: string) => { const d = new Date(iso); const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''; return `${fmtDate(iso)}${y} · ${fmtTime(iso)}`; };

const SOURCE_ICON: Record<RequestSource, LucideIcon> = { call: Phone, email: Mail, web: Globe, walk_in: User };

export const RequestsSection = ({ requests, watches }: { requests: Client360['requests']; watches: Client360['watches'] }) => (
  <Card title="Requests" subtitle={`${requests.filter((r) => r.status !== 'closed').length} open · call / email / web / walk-in`} bodyClassName="p-0" testId="client360-requests">
    <ul className="divide-y divide-line/60">
      {requests.map((r) => {
        const Icon = SOURCE_ICON[r.source];
        const w = r.watchId ? watches.find((g) => g.watch.id === r.watchId)?.watch : undefined;
        return (
          <li key={r.id} data-hit={`req-${r.id}`} data-testid={`client360-request-${r.id}`} className="px-3 py-2 text-xs transition-colors hover:bg-canvas">
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
              {r.closedNote && <span>{r.closedNote}</span>}
            </div>
          </li>
        );
      })}
      {requests.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-400">No requests on file.</li>}
    </ul>
  </Card>
);

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

export const EmailsSection = ({ emails }: { emails: Client360['emails'] }) => (
  <Card title="Emails" subtitle={`${emails.length} queued or sent · newest first`} action={<Link to="/intake/outbox" className="text-xs text-brand hover:underline">Outbox</Link>} bodyClassName="p-0" testId="client360-emails">
    <ul className="divide-y divide-line/60">
      {emails.map((e) => <EmailRow key={e.id} e={e} />)}
      {emails.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-400">No emails to this client yet.</li>}
    </ul>
  </Card>
);
