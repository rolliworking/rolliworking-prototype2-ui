import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { CallCounts, CallEvent, CallFilter, Job } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtTime } from '@/lib/format';

const dur = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');
export const CallIcon = ({ c, size = 13 }: { c: CallEvent; size?: number }) => (c.outcome === 'missed' || c.outcome === 'voicemail' ? <PhoneMissed size={size} className="text-rose-600" /> : c.direction === 'in' ? <PhoneIncoming size={size} className="text-moss-700" /> : <PhoneOutgoing size={size} className="text-ink-500" />);

// One call row: direction/outcome, when, who, duration, job chip, notes (append-only)
export const CallRow = ({ c, jobs, onChange, testId }: { c: CallEvent; jobs?: Job[]; onChange: () => void; testId?: string }) => {
  const [note, setNote] = useState(''); const [adding, setAdding] = useState(false);
  return <li data-testid={testId ?? `call-${c.id}`} data-outcome={c.outcome} className="space-y-1.5 py-2.5 text-xs">
    <div className="flex flex-wrap items-center gap-2"><CallIcon c={c} /><span className="font-medium text-ink">{c.outcome === 'missed' ? 'Missed call' : c.outcome === 'voicemail' ? 'Voicemail' : c.direction === 'in' ? 'Inbound' : 'Outbound'}{c.outcome === 'manual' && <span className="ml-1 rounded-sm bg-canvas px-1 text-[10px] uppercase text-ink-500">manual</span>}</span><span className="text-ink-500">{fmtDate(c.at)} {fmtTime(c.at)}{c.afterHours && ' · after hours'}</span>{c.answeredBy && <span className="text-ink-500">· {c.answeredBy}</span>}<span className="font-mono text-ink-500">· {dur(c.durationSec)}</span><span className="font-mono text-ink-400">· {c.number}</span>
      {c.resolvedAt && <span data-testid={`${testId ?? `call-${c.id}`}-resolved`} className="rounded-sm bg-moss-50 px-1.5 py-0.5 text-[10px] font-semibold text-moss-700">{c.resolution === 'called_back' ? 'Called back' : 'Handled'} · {c.resolvedBy}</span>}
      {c.jobId ? <Link to={`/jobs/${c.jobId}`} data-testid={`${testId ?? `call-${c.id}`}-job`} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] hover:bg-canvas">{jobs?.find((j) => j.id === c.jobId)?.number ?? c.jobId}</Link>
        : jobs && jobs.length > 0 && <span className="inline-flex items-center gap-1 text-ink-400">which job? {jobs.map((j) => <button key={j.id} data-testid={`${testId ?? `call-${c.id}`}-link-${j.id}`} onClick={() => void api.linkCallToJob(c.id, j.id).then(onChange)} className="rounded-sm border border-dashed border-line px-1.5 py-0.5 font-mono text-[10px] hover:bg-canvas">{j.number}</button>)}</span>}
    </div>
    {c.notes.length > 0 && <ul className="ml-5 space-y-0.5">{c.notes.map((n, i) => <li key={i} data-testid={`${testId ?? `call-${c.id}`}-note-${i}`} className="text-ink-600">“{n.text}” <span className="text-ink-400">— {n.by}, {fmtDate(n.at)} {fmtTime(n.at)}</span></li>)}</ul>}
    <div className="ml-5">{adding ? <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await api.addCallNote(c.id, note); setNote(''); setAdding(false); onChange(); }}><input autoFocus data-testid={`${testId ?? `call-${c.id}`}-note-input`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Append a note (stamped, never overwrites)" className="h-7 flex-1 rounded-sm border border-line bg-canvas px-2" /><Button data-testid={`${testId ?? `call-${c.id}`}-note-save`} type="submit">Add</Button></form>
      : <button data-testid={`${testId ?? `call-${c.id}`}-note-add`} onClick={() => setAdding(true)} className="text-[11px] text-ink-400 hover:text-ink">+ note</button>}</div>
  </li>;
};

// Header counter "📞 14 (3 this month) · 2 missed" → full history with filters + manual "+ Log call"
export const CallCounter = ({ clientId }: { clientId: string }) => {
  const [counts, setCounts] = useState<CallCounts>(() => api.callCountsSync(clientId)); const [open, setOpen] = useState(false);
  useEffect(() => { setCounts(api.callCountsSync(clientId)); }, [clientId, open]);
  return <>
    <button data-testid="client360-calls" onClick={() => setOpen(true)} title="Call history" className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface px-2 py-0.5 text-sm text-ink hover:border-ink-300"><Phone size={12} className="text-ink-500" /><span className="font-mono font-semibold">{counts.total}</span><span className="text-xs text-ink-500">({counts.thisMonth} this month)</span>{counts.missed > 0 && <span data-testid="client360-calls-missed" className="text-xs font-semibold text-rose-700">· {counts.missed} missed</span>}</button>
    {open && createPortal(<CallHistoryModal clientId={clientId} onClose={() => { setOpen(false); setCounts(api.callCountsSync(clientId)); }} />, document.body)}
  </>;
};

export const CallHistoryModal = ({ clientId, onClose }: { clientId: string; onClose: () => void }) => {
  const [rows, setRows] = useState<CallEvent[]>([]); const [jobs, setJobs] = useState<Job[]>([]); const [f, setF] = useState<CallFilter>({ clientId }); const [logging, setLogging] = useState(false); const [form, setForm] = useState({ direction: 'out' as 'in' | 'out', minutes: '', jobId: '', note: '' });
  const load = useCallback(() => api.getCallEvents(f).then(setRows), [f]);
  useEffect(() => { void load(); void api.getJobsForClient(clientId).then(setJobs); }, [load, clientId]);
  const staff = Array.from(new Set(rows.map((r) => r.answeredBy).filter(Boolean))) as string[];
  return <Modal onClose={onClose} testId="call-history" width="w-[760px] max-w-[95vw]">
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2"><div className="text-[14px] font-semibold text-ink">Call history</div><span className="text-xs text-ink-500">internal — never client-visible</span><Button data-testid="call-log-open" className="ml-auto" onClick={() => setLogging((v) => !v)}><Plus size={12} /> Log call</Button></div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <select data-testid="call-filter-direction" value={f.direction ?? ''} onChange={(e) => setF({ ...f, direction: (e.target.value || undefined) as CallFilter['direction'] })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">All directions</option><option value="in">Inbound</option><option value="out">Outbound</option></select>
          <select data-testid="call-filter-staff" value={f.staff ?? ''} onChange={(e) => setF({ ...f, staff: e.target.value || undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">Anyone</option>{staff.map((s) => <option key={s}>{s}</option>)}</select>
          <select data-testid="call-filter-job" value={f.jobId ?? ''} onChange={(e) => setF({ ...f, jobId: e.target.value || undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">Any job</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}</select>
          <input type="date" data-testid="call-filter-from" value={f.from?.slice(0, 10) ?? ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5" />
      </div>
      {logging && <form data-testid="call-log-form" className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-line bg-canvas p-2 text-xs" onSubmit={async (e) => { e.preventDefault(); await api.logCall({ clientId, direction: form.direction, durationSec: form.minutes ? Math.round(Number(form.minutes) * 60) : undefined, jobId: form.jobId || undefined, note: form.note }); setLogging(false); setForm({ direction: 'out', minutes: '', jobId: '', note: '' }); await load(); }}>
        <select data-testid="call-log-direction" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as 'in' | 'out' })} className="h-7 rounded-sm border border-line bg-surface px-1.5"><option value="out">Outbound</option><option value="in">Inbound</option></select>
        <input data-testid="call-log-minutes" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="min" inputMode="decimal" className="h-7 w-14 rounded-sm border border-line bg-surface px-1.5" />
        <select data-testid="call-log-job" value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} className="h-7 rounded-sm border border-line bg-surface px-1.5"><option value="">No job</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}</select>
        <input data-testid="call-log-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (what was said)" className="h-7 min-w-[220px] flex-1 rounded-sm border border-line bg-surface px-2" />
        <Button data-testid="call-log-save" type="submit" variant="primary">Save · manual</Button></form>}
      <ul data-testid="call-history-list" className="mt-2 max-h-[60vh] divide-y divide-line overflow-y-auto">{rows.map((c) => <CallRow key={c.id} c={c} jobs={jobs} onChange={() => void load()} />)}{!rows.length && <li className="py-6 text-center text-xs text-ink-500">No calls match.</li>}</ul>
    </div>
  </Modal>;
};

// Job page: the Story's Comms lane count + rows for this job
export const JobCallsLine = ({ job }: { job: Job }) => {
  const [rows, setRows] = useState<CallEvent[]>([]); const load = useCallback(() => api.getCallEvents({ jobId: job.id }).then(setRows), [job.id]);
  useEffect(() => { void load(); }, [load]);
  return <div data-testid="job-calls" className="rounded-md border border-line bg-surface p-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-ink"><Phone size={12} /> Calls · <span data-testid="job-calls-count">{rows.length}</span>{rows.some((c) => c.outcome === 'missed' || c.outcome === 'voicemail') && <span className="text-rose-700">· {rows.filter((c) => c.outcome === 'missed' || c.outcome === 'voicemail').length} missed</span>}<span className="ml-auto font-normal text-ink-400">Comms lane · internal</span></div>
    {rows.length > 0 && <ul className="mt-1 divide-y divide-line">{rows.map((c) => <CallRow key={c.id} c={c} onChange={() => void load()} testId={`job-call-${c.id}`} />)}</ul>}
  </div>;
};
