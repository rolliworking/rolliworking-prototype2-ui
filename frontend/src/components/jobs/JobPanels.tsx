import { Camera, Clock, PauseCircle, PlayCircle, Send, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobPriority, JobWithRefs, ShopTimeEntry, User } from '@/api/client';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { Provisional } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { DeptBadge, OwnerChip } from '@/components/ui/Pills';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, fmtTime } from '@/lib/format';

type Refresh = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

export const LinesTable = ({ job: j }: { job: JobWithRefs }) => (
  <Table testId="job-lines">
    <thead><tr><Th className="w-10">Dept</Th><Th>Description</Th><Th className="text-right">Qty</Th><Th className="text-right">Rate</Th><Th className="text-right">Ext</Th></tr></thead>
    <tbody>
      {j.lines.map((l) => (
        <tr key={l.id} data-testid={`job-line-${l.id}`}><Td><DeptBadge code={l.dept} /></Td><Td className="text-ink">{l.description}{l.partNumber && <span className="ml-1.5 font-mono text-xs text-ink-400">{l.partNumber}</span>}</Td><Td className="tabular text-right">{l.qty}</Td><Td className="tabular text-right text-ink-500">{fmtMoneyCents(l.unitPrice)}</Td><Td className="tabular text-right font-medium">{fmtMoneyCents(l.qty * l.unitPrice)}</Td></tr>
      ))}
      {j.lines.length === 0 && <tr><Td colSpan={5} className="text-center text-xs text-ink-400">No line items — job created without an estimate.</Td></tr>}
      <tr className="bg-canvas/60"><Td colSpan={4} className="text-right text-xs font-semibold uppercase tracking-wide text-ink-500">Total</Td><Td className="tabular text-right font-semibold" data-testid="job-total">{fmtMoneyCents(j.total)}</Td></tr>
    </tbody>
  </Table>
);

export const AssignmentPanel = ({ job: j, run }: { job: JobWithRefs; run: Refresh }) => {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { api.getUsers().then(setUsers); }, []);
  return (
    <div data-testid="assignment-panel">
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-500"><UserRound size={12} /> Holds it now: {j.assignedTo ? <OwnerChip owner={j.assignedTo} /> : <span data-testid="assignee-none" className="text-ink-400">nobody</span>}</div>
      <div className="flex flex-wrap gap-1.5">
        {users.map((u) => (
          <button key={u.id} type="button" data-testid={`assign-${u.shortName.toLowerCase()}`} onClick={() => run(() => api.assignJob(j.id, u.shortName), `Assigned to ${u.shortName}`)} disabled={j.assignedTo === u.shortName} className={`h-7 rounded-sm border px-2 text-xs transition-colors ${j.assignedTo === u.shortName ? 'border-ink bg-ink text-white' : 'border-line text-ink-700 hover:border-ink-300'}`} title={u.displayName}>{u.shortName}</button>
        ))}
        {j.assignedTo && <button type="button" data-testid="assign-none" onClick={() => run(() => api.assignJob(j.id, null), 'Unassigned')} className="h-7 rounded-sm border border-dashed border-line px-2 text-xs text-ink-500 hover:border-ink-300">Unassign</button>}
      </div>
    </div>
  );
};

export const HoldPanel = ({ job: j, onPlace, onRelease }: { job: JobWithRefs; onPlace: () => void; onRelease: () => void }) => {
  const active = api.activeHold(j);
  return (
    <div data-testid="hold-panel">
      {active ? (
        <div data-testid="active-hold" className="rounded-sm bg-rose-50 p-2.5 ring-1 ring-inset ring-rose-200">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700"><PauseCircle size={12} /> {active.type === 'parts' ? 'Parts hold' : 'Outsource hold'} · parked from {active.priorStatus.replace(/_/g, ' ')}</span>
            <Button size="sm" variant="primary" data-testid="act-release-hold" onClick={onRelease}><PlayCircle size={12} /> Release hold</Button>
          </div>
          <p className="mt-1 text-xs text-rose-900">{active.reason}</p>
          <p className="mt-0.5 text-[11px] text-rose-700/70">Placed {fmtDate(active.placedAt)} {fmtTime(active.placedAt)} · {active.placedBy} · {active.station}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>No active hold.</span>
          {api.canHold(j) ? <Button size="sm" data-testid="act-place-hold" onClick={onPlace}><PauseCircle size={12} /> Place hold…</Button> : <span className="text-[11px] text-ink-400">Holds apply to on-hand jobs in approved / in service / testing</span>}
        </div>
      )}
      {j.holds.filter((h) => h.releasedAt).length > 0 && (
        <ul data-testid="hold-history" className="mt-2 divide-y divide-line/70 text-xs">
          {j.holds.filter((h) => h.releasedAt).map((h) => (
            <li key={h.id} className="py-1.5 text-ink-500"><span className="font-medium text-ink">{h.type === 'parts' ? 'Parts' : 'Outsource'}</span> · {h.reason} · {fmtDate(h.placedAt)} → released {fmtDate(h.releasedAt!)} by {h.releasedBy}{h.releaseNote && ` · ${h.releaseNote}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const NotesPanel = ({ job: j, run }: { job: JobWithRefs; run: Refresh }) => {
  const [text, setText] = useState('');
  const add = () => { if (!text.trim()) return; void run(() => api.addJobNote(j.id, text), 'Note added').then(() => setText('')); };
  return (
    <div data-testid="notes-panel">
      <div className="flex gap-1.5">
        <input data-testid="note-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a note — Enter to save" className="h-8 flex-1 rounded-sm border border-line bg-canvas px-2.5 text-[13px] focus:border-ink focus:outline-none" />
        <Button size="sm" variant="primary" data-testid="note-add" onClick={add} className="h-8"><Send size={12} /> Add</Button>
      </div>
      <ul className="mt-2 divide-y divide-line/70">
        {j.notes.map((n) => <li key={n.id} data-testid={`note-${n.id}`} className="py-1.5 text-xs"><div className="text-ink">{n.text}</div><div className="text-[11px] text-ink-400">{fmtDate(n.at)} {fmtTime(n.at)} · {n.by} · {n.station}</div></li>)}
        {j.notes.length === 0 && <li className="py-1.5 text-xs text-ink-400">No notes yet.</li>}
      </ul>
    </div>
  );
};

export const PhotosPanel = ({ job: j, run }: { job: JobWithRefs; run: Refresh }) => {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="photos-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-500">{j.photos.length} photo{j.photos.length === 1 ? '' : 's'} on this job</span>
        <Button size="sm" data-testid="photos-toggle" onClick={() => setOpen((o) => !o)}><Camera size={12} /> {open ? 'Done' : 'Attach photo…'}</Button>
      </div>
      {open && <div className="mt-2"><PhotoCapture onAdd={(p) => run(() => api.addJobPhotos(j.id, p), `${p.length} photo${p.length === 1 ? '' : 's'} attached`)} /></div>}
      {j.photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="photo-grid">
          {j.photos.map((p) => <figure key={p.id} className="w-[88px]"><img src={p.dataUrl} alt={p.fileName ?? 'Job photo'} className="h-16 w-full rounded-sm object-cover ring-1 ring-line" /><figcaption className="truncate text-[10px] text-ink-400">{p.source} · {p.by} · {fmtDate(p.at)}</figcaption></figure>)}
        </div>
      )}
    </div>
  );
};

const PRIORITIES: JobPriority[] = ['low', 'normal', 'high', 'urgent'];
const toDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const DetailsPanel = ({ job: j, run }: { job: JobWithRefs; run: Refresh }) => {
  const [cond, setCond] = useState(j.conditionNotes ?? '');
  useEffect(() => setCond(j.conditionNotes ?? ''), [j.conditionNotes]);
  const readOnly = j.status === 'closed';
  return (
    <dl data-testid="details-panel" className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs">
      <dt className="text-ink-500">Priority</dt>
      <dd><select data-testid="priority-select" disabled={readOnly} value={j.priority} onChange={(e) => run(() => api.updateJobFields(j.id, { priority: e.target.value as JobPriority }), `Priority ${e.target.value}`)} className="h-7 rounded-sm border border-line bg-canvas px-1 text-xs">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></dd>
      <dt className="text-ink-500">Due</dt>
      <dd><input type="date" data-testid="due-input" disabled={readOnly} value={toDateInput(j.dueAt)} onChange={(e) => run(() => api.updateJobFields(j.id, { dueAt: e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : null }), 'Due date updated')} className="h-7 rounded-sm border border-line bg-canvas px-1 text-xs" /></dd>
      <dt className="text-ink-500">Simple status</dt>
      <dd className="inline-flex items-center gap-1.5"><span data-testid="simple-status" className="font-medium text-ink">{j.simpleStatus.replace('_', ' ')}</span><Provisional note="estimate | on_hand | finished per pack DB enum — derivation from full status is UNKNOWN" /></dd>
      <dt className="text-ink-500">Intake date</dt><dd className="tabular text-ink">{j.intakeDate ? `${fmtDate(j.intakeDate)} ${fmtTime(j.intakeDate)}` : <span className="text-ink-400">not on hand</span>}</dd>
      {j.intakeNotes && <><dt className="text-ink-500">Intake notes</dt><dd className="text-ink">{j.intakeNotes}</dd></>}
      <dt className="text-ink-500">Finished</dt><dd className="tabular text-ink">{j.finishedAt ? fmtDate(j.finishedAt) : '—'}</dd>
      <dt className="text-ink-500">Created</dt><dd className="tabular text-ink">{fmtDate(j.createdAt)} by {j.createdBy}</dd>
      <dt className="text-ink-500 pt-1">Condition</dt>
      <dd><textarea data-testid="condition-notes" rows={2} disabled={readOnly} value={cond} onChange={(e) => setCond(e.target.value)} onBlur={() => cond !== (j.conditionNotes ?? '') && run(() => api.updateJobFields(j.id, { conditionNotes: cond }), 'Condition notes saved')} placeholder="Condition notes (optional) — saves on blur" className="w-full rounded-sm border border-line bg-canvas px-2 py-1 text-xs focus:border-ink focus:outline-none" /></dd>
    </dl>
  );
};

export const ShopTimePanel = ({ job: j }: { job: JobWithRefs }) => {
  const [rows, setRows] = useState<ShopTimeEntry[]>([]);
  useEffect(() => { api.getShopTime(j.id).then(setRows); }, [j.id, j.timeline.length]);
  const total = rows.reduce((t, r) => t + r.minutes, 0);
  return (
    <div data-testid="shop-time-panel">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-ink-500"><Clock size={12} /> <span data-testid="shop-time-total" className="font-medium text-ink">{Math.floor(total / 60)}h {total % 60}m</span> logged · {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span>
        <Link to={`/jobs/shop-time?job=${j.id}`} data-testid="shop-time-link" className="text-brand hover:underline">{j.simpleStatus === 'on_hand' ? 'Log time →' : 'Shop Time (on-hand only)'}</Link>
      </div>
      {rows.length > 0 && <ul className="mt-1.5 divide-y divide-line/70 text-xs">{rows.slice(0, 4).map((r) => <li key={r.id} className="flex items-center gap-2 py-1"><span className="tabular font-medium text-ink">{r.minutes}m</span><span className="truncate text-ink-700">{r.note}</span><span className="ml-auto whitespace-nowrap text-ink-400">{r.by} · {fmtDate(r.at)}</span></li>)}</ul>}
    </div>
  );
};
