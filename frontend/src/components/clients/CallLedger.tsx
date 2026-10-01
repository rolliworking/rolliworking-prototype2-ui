import { ExternalLink, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { CallCounts, CallDisposition, CallEvent, Job } from '@/api/client';
import * as calls from '@/api/calls';
import type { CallFilter } from '@/api/calls';
import * as tel from '@/api/telephony';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

const dur = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');
export const CallIcon = ({ c, size = 13 }: { c: CallEvent; size?: number }) => (c.outcome === 'missed' || c.outcome === 'voicemail' ? <PhoneMissed size={size} className="text-rose-600" /> : c.direction === 'in' ? <PhoneIncoming size={size} className="text-moss-700" /> : <PhoneOutgoing size={size} className="text-ink-500" />);
const DISPO_TONE: Record<CallDisposition, string> = { estimate_discussed: 'bg-sky-50 text-sky-900 ring-sky-200', approval_given: 'bg-amber-50 text-amber-900 ring-amber-300', status_inquiry: 'bg-canvas text-ink-700 ring-line', pickup_scheduled: 'bg-moss-50 text-moss-700 ring-moss-200', voicemail: 'bg-rose-50 text-rose-800 ring-rose-200', missed: 'bg-rose-50 text-rose-800 ring-rose-200' };
export const DispositionPill = ({ d, testId }: { d?: CallDisposition; testId?: string }) => (d ? <span data-testid={testId} data-disposition={d} className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${DISPO_TONE[d]}`}>{calls.dispositionLabel(d)}</span> : <span data-testid={testId} className="text-[10px] text-ink-400">no disposition</span>);
// Recording stays in Vonage — link only (MOCK URL)
export const RecordingLink = ({ c, testId }: { c: CallEvent; testId?: string }) => (c.recordingUrl ? <a data-testid={testId} href={c.recordingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Recording · hosted by Vonage (mock link)" className="inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-ink-600 hover:bg-canvas"><ExternalLink size={10} /> Recording</a> : null);

// One call row: direction/outcome, when, who, duration, disposition, job chip, recording, notes (append-only)
export const CallRow = ({ c, jobs, onChange, testId, showClient }: { c: CallEvent; jobs?: Job[]; onChange: () => void; testId?: string; showClient?: boolean }) => {
  const [note, setNote] = useState(''); const [adding, setAdding] = useState(false); const id = testId ?? `call-${c.id}`;
  const client = showClient && c.clientId ? api.clientByIdSync(c.clientId) : undefined;
  return <li data-testid={id} data-outcome={c.outcome} data-disposition={c.disposition} className="space-y-1.5 py-2.5 text-xs">
    <div className="flex flex-wrap items-center gap-2"><CallIcon c={c} /><span className="font-medium text-ink">{c.outcome === 'missed' ? 'Missed call' : c.outcome === 'voicemail' ? 'Voicemail' : c.direction === 'in' ? 'Inbound' : 'Outbound'}{c.outcome === 'manual' && <span className="ml-1 rounded-sm bg-canvas px-1 text-[10px] uppercase text-ink-500">manual</span>}</span>
      {showClient && <span data-testid={`${id}-client`} className="text-ink-700">{client ? <Link to={`/clients/${client.id}`} className="font-medium hover:underline">{fullName(client)}</Link> : <span className="text-ink-400">Unknown</span>}</span>}
      <span className="text-ink-500">{fmtDate(c.at)} {fmtTime(c.at)}{c.afterHours && ' · after hours'}</span>{c.answeredBy && <span className="text-ink-500">· {c.answeredBy}</span>}<span className="font-mono text-ink-500">· {dur(c.durationSec)}</span><span className="font-mono text-ink-400">· {c.number}</span>
      <DispositionPill d={c.disposition} testId={`${id}-disposition`} />
      {c.resolvedAt && <span data-testid={`${id}-resolved`} className="rounded-sm bg-moss-50 px-1.5 py-0.5 text-[10px] font-semibold text-moss-700">{c.resolution === 'called_back' ? 'Called back' : 'Handled'} · {c.resolvedBy}</span>}
      {c.jobId ? <Link to={`/jobs/${c.jobId}`} data-testid={`${id}-job`} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] hover:bg-canvas">{jobs?.find((j) => j.id === c.jobId)?.number ?? api.jobNumberSync(c.jobId) ?? c.jobId}</Link>
        : jobs && jobs.length > 0 && <span className="inline-flex items-center gap-1 text-ink-400">which job? {jobs.map((j) => <button key={j.id} data-testid={`${id}-link-${j.id}`} onClick={() => void calls.linkCallToJob(c.id, j.id).then(onChange)} className="rounded-sm border border-dashed border-line px-1.5 py-0.5 font-mono text-[10px] hover:bg-canvas">{j.number}</button>)}</span>}
      <RecordingLink c={c} testId={`${id}-recording`} />
    </div>
    {c.notes.length > 0 && <ul className="ml-5 space-y-0.5">{c.notes.map((n, i) => <li key={i} data-testid={`${id}-note-${i}`} className="text-ink-600">“{n.text}” <span className="text-ink-400">— {n.by}, {fmtDate(n.at)} {fmtTime(n.at)}</span></li>)}</ul>}
    <div className="ml-5">{adding ? <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await calls.addCallNote(c.id, note); setNote(''); setAdding(false); onChange(); }}><input autoFocus data-testid={`${id}-note-input`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Append a note (stamped, never overwrites)" className="h-7 flex-1 rounded-sm border border-line bg-canvas px-2" /><Button data-testid={`${id}-note-save`} type="submit">Add</Button></form>
      : <button data-testid={`${id}-note-add`} onClick={() => setAdding(true)} className="text-[11px] text-ink-400 hover:text-ink">+ note</button>}</div>
  </li>;
};

// Header counter "📞 14 (3 this month) · 2 missed" → full history with filters + manual "+ Log call"
export const CallCounter = ({ clientId }: { clientId: string }) => {
  const [counts, setCounts] = useState<CallCounts>(() => calls.callCountsSync(clientId)); const [open, setOpen] = useState(false);
  useEffect(() => { setCounts(calls.callCountsSync(clientId)); return calls.subscribeCalls(() => setCounts(calls.callCountsSync(clientId))); }, [clientId, open]);
  return <>
    <button data-testid="client360-calls" onClick={() => setOpen(true)} title="Call history" className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface px-2 py-0.5 text-sm text-ink hover:border-ink-300"><Phone size={12} className="text-ink-500" /><span className="font-mono font-semibold">{counts.total}</span><span className="text-xs text-ink-500">({counts.thisMonth} this month)</span>{counts.missed > 0 && <span data-testid="client360-calls-missed" className="text-xs font-semibold text-rose-700">· {counts.missed} missed</span>}</button>
    {open && createPortal(<CallHistoryModal clientId={clientId} onClose={() => { setOpen(false); setCounts(calls.callCountsSync(clientId)); }} />, document.body)}
  </>;
};

const LogCallForm = ({ clientId, jobs, onDone }: { clientId: string; jobs: Job[]; onDone: () => void }) => {
  const [form, setForm] = useState({ direction: 'out' as 'in' | 'out', minutes: '', jobId: '', note: '', disposition: '' as '' | CallDisposition });
  return <form data-testid="call-log-form" className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-line bg-canvas p-2 text-xs" onSubmit={async (e) => { e.preventDefault(); await calls.logCall({ clientId, direction: form.direction, durationSec: form.minutes ? Math.round(Number(form.minutes) * 60) : undefined, jobId: form.jobId || undefined, note: form.note, disposition: form.disposition || undefined }); onDone(); }}>
    <select data-testid="call-log-direction" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as 'in' | 'out' })} className="h-7 rounded-sm border border-line bg-surface px-1.5"><option value="out">Outbound</option><option value="in">Inbound</option></select>
    <input data-testid="call-log-minutes" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="min" inputMode="decimal" className="h-7 w-14 rounded-sm border border-line bg-surface px-1.5" />
    <select data-testid="call-log-job" value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} className="h-7 rounded-sm border border-line bg-surface px-1.5"><option value="">No job</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}</select>
    <select data-testid="call-log-disposition" value={form.disposition} onChange={(e) => setForm({ ...form, disposition: e.target.value as CallDisposition | '' })} className="h-7 rounded-sm border border-line bg-surface px-1.5"><option value="">Disposition…</option>{calls.DISPOSITIONS.filter((d) => d.key !== 'missed').map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
    <input data-testid="call-log-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (what was said)" className="h-7 min-w-[220px] flex-1 rounded-sm border border-line bg-surface px-2" />
    <Button data-testid="call-log-save" type="submit" variant="primary">Save · manual</Button></form>;
};

export const CallHistoryModal = ({ clientId, onClose }: { clientId: string; onClose: () => void }) => {
  const [rows, setRows] = useState<CallEvent[]>([]); const [jobs, setJobs] = useState<Job[]>([]); const [f, setF] = useState<CallFilter>({ clientId }); const [logging, setLogging] = useState(false);
  const load = useCallback(() => calls.getCallEvents(f).then(setRows), [f]);
  useEffect(() => { void load(); void api.getJobsForClient(clientId).then(setJobs); }, [load, clientId]);
  const staff = Array.from(new Set(rows.map((r) => r.answeredBy).filter(Boolean))) as string[];
  return <Modal onClose={onClose} testId="call-history" width="w-[800px] max-w-[95vw]">
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2"><div className="text-[14px] font-semibold text-ink">Call history</div><span className="text-xs text-ink-500">internal — never client-visible · recordings stay in Vonage</span><Button data-testid="call-log-open" className="ml-auto" onClick={() => setLogging((v) => !v)}><Plus size={12} /> Log call</Button></div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <select data-testid="call-filter-direction" value={f.direction ?? ''} onChange={(e) => setF({ ...f, direction: (e.target.value || undefined) as CallFilter['direction'] })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">All directions</option><option value="in">Inbound</option><option value="out">Outbound</option></select>
          <select data-testid="call-filter-staff" value={f.staff ?? ''} onChange={(e) => setF({ ...f, staff: e.target.value || undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">Anyone</option>{staff.map((s) => <option key={s}>{s}</option>)}</select>
          <select data-testid="call-filter-job" value={f.jobId ?? ''} onChange={(e) => setF({ ...f, jobId: e.target.value || undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">Any job</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}</select>
          <select data-testid="call-filter-disposition" value={f.disposition ?? ''} onChange={(e) => setF({ ...f, disposition: (e.target.value || undefined) as CallDisposition | undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5"><option value="">Any disposition</option>{calls.DISPOSITIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
          <input type="date" data-testid="call-filter-from" value={f.from?.slice(0, 10) ?? ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} className="h-7 rounded-sm border border-line bg-canvas px-1.5" />
      </div>
      {logging && <LogCallForm clientId={clientId} jobs={jobs} onDone={() => { setLogging(false); void load(); }} />}
      <ul data-testid="call-history-list" className="mt-2 max-h-[60vh] divide-y divide-line overflow-y-auto">{rows.map((c) => <CallRow key={c.id} c={c} jobs={jobs} onChange={() => void load()} />)}{!rows.length && <li className="py-6 text-center text-xs text-ink-500">No calls match.</li>}</ul>
    </div>
  </Modal>;
};

// Client 360 · Calls section — the client's call log inline (same rows as the modal), with click-to-call + Log call
export const CallsSection = ({ clientId, phone }: { clientId: string; phone: string }) => {
  const [rows, setRows] = useState<CallEvent[]>([]); const [jobs, setJobs] = useState<Job[]>([]); const [logging, setLogging] = useState(false); const [all, setAll] = useState(false);
  const load = useCallback(() => calls.getCallEvents({ clientId }).then(setRows), [clientId]);
  useEffect(() => { void load(); void api.getJobsForClient(clientId).then(setJobs); return calls.subscribeCalls(() => void load()); }, [load, clientId]);
  const shown = all ? rows : rows.slice(0, 5);
  return <section data-testid="client360-calls-section" className="rounded-md border border-line bg-surface">
    <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5"><Phone size={13} className="text-ink-500" /><h2 className="text-[13px] font-semibold text-ink">Calls</h2><span className="text-xs text-ink-500">· {rows.length}{rows.some((c) => (c.outcome === 'missed' || c.outcome === 'voicemail') && !c.resolvedAt) ? ` · ${rows.filter((c) => (c.outcome === 'missed' || c.outcome === 'voicemail') && !c.resolvedAt).length} missed open` : ''}</span>
      <span className="ml-auto flex items-center gap-1.5"><Button size="sm" data-testid="client360-call-client" onClick={() => { try { tel.dial({ clientId, number: phone }); } catch (e) { window.alert(e instanceof Error ? e.message : 'Busy'); } }}><PhoneOutgoing size={12} /> Call client</Button><Button size="sm" data-testid="client360-log-call" onClick={() => setLogging((v) => !v)}><Plus size={12} /> Log call</Button></span></header>
    <div className="px-4">
      {logging && <LogCallForm clientId={clientId} jobs={jobs} onDone={() => { setLogging(false); void load(); }} />}
      <ul data-testid="client360-calls-list" className="divide-y divide-line">{shown.map((c) => <CallRow key={c.id} c={c} jobs={jobs} onChange={() => void load()} testId={`c360-call-${c.id}`} />)}{!rows.length && <li className="py-4 text-center text-xs text-ink-400">No calls on record.</li>}</ul>
      {rows.length > 5 && <button data-testid="client360-calls-more" onClick={() => setAll((v) => !v)} className="w-full py-2 text-center text-[11px] text-ink-500 hover:text-ink">{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
    </div>
  </section>;
};

// Job page: the Story's Comms lane count + rows for this job, with "Call client" (click-to-call from your extension)
export const JobCallsLine = ({ job }: { job: Job & { client?: { phone: string } } }) => {
  const [rows, setRows] = useState<CallEvent[]>([]); const load = useCallback(() => calls.getCallEvents({ jobId: job.id }).then(setRows), [job.id]);
  useEffect(() => { void load(); return calls.subscribeCalls(() => void load()); }, [load]);
  const phone = job.client?.phone ?? api.clientByIdSync(job.clientId)?.phone;
  return <div data-testid="job-calls" className="rounded-md border border-line bg-surface p-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-ink"><Phone size={12} /> Calls · <span data-testid="job-calls-count">{rows.length}</span>{rows.some((c) => c.outcome === 'missed' || c.outcome === 'voicemail') && <span className="text-rose-700">· {rows.filter((c) => c.outcome === 'missed' || c.outcome === 'voicemail').length} missed</span>}<span className="ml-auto inline-flex items-center gap-2 font-normal text-ink-400">Comms lane · internal{phone && <Button size="sm" data-testid="job-call-client" onClick={() => { try { tel.dial({ clientId: job.clientId, number: phone, jobId: job.id }); } catch (e) { window.alert(e instanceof Error ? e.message : 'Busy'); } }}><PhoneOutgoing size={12} /> Call client</Button>}</span></div>
    {rows.length > 0 && <ul className="mt-1 divide-y divide-line">{rows.map((c) => <CallRow key={c.id} c={c} onChange={() => void load()} testId={`job-call-${c.id}`} />)}</ul>}
  </div>;
};
