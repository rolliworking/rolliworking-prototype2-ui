import { Camera, Check, CheckCheck, Mic, MicOff, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { Assignee, Division, JobWithRefs, Role } from '@/api/client';
import type { MessageStatus, SentRow } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { MessageText } from './MessageText';
import { fmtTime } from '@/lib/format';

// Dictation = browser Web Speech API (Chrome / Safari on iPad). Appends the final transcript to the text. No cloud STT in the prototype.
type Rec = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };
const RecCtor = (): (new () => Rec) | undefined => (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
export const useDictation = (onText: (t: string) => void) => {
  const [on, setOn] = useState(false); const rec = useRef<Rec | null>(null); const supported = !!RecCtor();
  const stop = () => { rec.current?.stop(); rec.current = null; setOn(false); };
  const start = () => { const C = RecCtor(); if (!C) return; const r = new C(); r.continuous = true; r.interimResults = false; r.lang = 'en-US'; r.onresult = (e) => { const t = Array.from(e.results).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ').trim(); if (t) onText(t); }; r.onend = () => setOn(false); rec.current = r; r.start(); setOn(true); };
  useEffect(() => () => { rec.current?.stop(); }, []);
  return { on, supported, toggle: () => (on ? stop() : start()) };
};

export const targetAssignee = (v: string): Assignee | null => { if (!v) return null; const [t, ...rest] = v.split(':'); const x = rest.join(':'); return t === 'role' ? { type: 'role', role: x as Role } : t === 'station' ? { type: 'station', stationId: x } : { type: 'user', shortName: x }; };
export const STATUS_LABEL: Record<MessageStatus, string> = { delivered: 'Delivered', seen: 'Seen', done: 'Done' };
export const StatusChip = ({ status, dark }: { status: MessageStatus; dark?: boolean }) => {
  const tone = status === 'done' ? (dark ? 'bg-emerald-400/20 text-emerald-200' : 'bg-moss-50 text-moss-800') : status === 'seen' ? (dark ? 'bg-sky-400/20 text-sky-200' : 'bg-sky-50 text-sky-800') : dark ? 'bg-white/10 text-slate-300' : 'bg-canvas text-ink-500';
  return <span data-testid="msg-status" data-status={status} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{status === 'done' ? <CheckCheck size={10} /> : status === 'seen' ? <Check size={10} /> : <Send size={9} />}{STATUS_LABEL[status]}</span>;
};

// One-shot directed message: person / #role (claimable queue) / station. Type or dictate; optional photo + job. No thread.
export const MessageComposer = ({ dark, onSent, defaultJobId, testId = 'msg' }: { dark?: boolean; onSent?: (label: string) => void; defaultJobId?: string; testId?: string }) => {
  const { station, user } = useAuth(); const div: Division = station?.division ?? 'rolliworks';
  const staff = api.getDivisionStaff(div).filter((u) => u.id !== user?.id); const roles = api.getDivisionRoles(div); const stations = hl.stationTargets();
  const [to, setTo] = useState(''); const [text, setText] = useState(''); const [photo, setPhoto] = useState<string | null>(null); const [jobQ, setJobQ] = useState(''); const [job, setJob] = useState<JobWithRefs | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null); const dict = useDictation((t) => setText((x) => `${x}${x && !x.endsWith(' ') ? ' ' : ''}${t}`));
  useEffect(() => { if (defaultJobId) void api.getJob(defaultJobId).then(setJob).catch(() => undefined); }, [defaultJobId]);
  const findJob = async () => { if (!jobQ.trim()) return; const hits = await api.searchJobs(jobQ.trim()); if (hits[0]) { setJob(hits[0]); setJobQ(''); setErr(null); } else setErr(`No job matches “${jobQ}”`); };
  const send = async () => {
    const target = targetAssignee(to); if (!target) { setErr('Pick who this is for'); return; } if (!text.trim() && !photo) { setErr('Type, dictate, or attach a photo'); return; }
    setBusy(true); setErr(null);
    try { await hl.sendMessage({ to: target, text, jobId: job?.id, photo: photo ? { id: `msg-${Date.now().toString(36)}`, source: 'camera', dataUrl: photo, slot: 'message', photoType: 'bench' } : undefined }); const label = api.assigneeLabel(target).split(' →')[0]; setTo(''); setText(''); setPhoto(null); if (!defaultJobId) setJob(null); onSent?.(target.type === 'role' ? `Sent to #${target.role} — first to claim owns it` : `Sent to ${label}`); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const field = dark ? 'rounded-2xl border border-white/15 bg-white/5 px-3 text-base text-white placeholder:text-slate-500 focus:outline-none' : 'rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
  const h = dark ? 'h-12' : 'h-8'; const muted = dark ? 'text-slate-400' : 'text-ink-400';
  return <div data-testid={`${testId}-composer`} className={`space-y-2 ${dark ? 'text-slate-100' : 'text-ink'}`}>
    <select data-testid={`${testId}-to`} value={to} onChange={(e) => setTo(e.target.value)} className={`${field} ${h} w-full`}>
      <option value="">To — person, #role or station…</option>
      <optgroup label="People">{staff.map((u) => <option key={u.id} value={`user:${u.shortName}`}>@{u.shortName} · {u.dutyLabel}</option>)}</optgroup>
      <optgroup label="Roles (claimable — first to claim owns it)">{roles.map((r) => <option key={r} value={`role:${r}`}>#{r}</option>)}</optgroup>
      <optgroup label="Stations (whoever is signed in there)">{stations.map((s) => <option key={s.id} value={`station:${s.id}`}>{s.name}</option>)}</optgroup>
    </select>
    <div className="relative">
      <textarea data-testid={`${testId}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={dark ? 3 : 2} placeholder={dict.on ? 'Listening… speak now' : 'Type or dictate — one shot, no thread. A reply is a new message back.'} className={`${field} w-full resize-none py-2 pr-11`} />
      <button type="button" data-testid={`${testId}-dictate`} disabled={!dict.supported} title={dict.supported ? (dict.on ? 'Stop dictation' : 'Dictate (browser speech recognition)') : 'Dictation not supported in this browser'} onClick={dict.toggle} className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full ${dict.on ? 'bg-rose-600 text-white animate-pulse' : dark ? 'bg-white/10 text-slate-200' : 'bg-canvas text-ink-500'} disabled:opacity-30`}>{dict.on ? <MicOff size={14} /> : <Mic size={14} />}</button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input ref={file} data-testid={`${testId}-photo-input`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); e.target.value = ''; }} />
      {photo ? <span data-testid={`${testId}-photo-chip`} className="relative inline-flex"><img src={photo} alt="" className={`h-10 w-14 rounded-sm object-cover ring-1 ${dark ? 'ring-white/20' : 'ring-line'}`} /><button type="button" data-testid={`${testId}-photo-remove`} onClick={() => setPhoto(null)} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-white"><X size={9} /></button></span>
        : <button type="button" data-testid={`${testId}-photo-btn`} onClick={() => file.current?.click()} className={`inline-flex ${h} items-center gap-1 rounded-sm border px-2 text-xs ${dark ? 'border-white/15 text-slate-200' : 'border-line text-ink-600 hover:bg-canvas'}`}><Camera size={13} /> Photo</button>}
      {job ? <span data-testid={`${testId}-job-chip`} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold ${dark ? 'bg-amber-400/15 text-amber-200' : 'bg-brand-50 text-brand'}`}>{job.number}<span className={`font-sans font-normal ${muted}`}>· {job.client.firstName} {job.client.lastName}</span>{!defaultJobId && <button type="button" data-testid={`${testId}-job-remove`} onClick={() => setJob(null)} aria-label="Remove job"><X size={10} /></button>}</span>
        : <span className="inline-flex items-center gap-1"><input data-testid={`${testId}-job-input`} value={jobQ} onChange={(e) => setJobQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void findJob(); } }} onBlur={() => void findJob()} placeholder="Job / est# (optional)" className={`${field} ${h} w-40 font-mono`} /></span>}
      <button type="button" data-testid={`${testId}-send`} disabled={busy} onClick={() => void send()} className={`ml-auto inline-flex ${h} items-center gap-1.5 rounded-sm px-3 text-xs font-semibold text-white disabled:opacity-40 ${dark ? 'rounded-2xl bg-amber-400 !text-[#161b22]' : 'bg-ink'}`}><Send size={13} /> Send</button>
    </div>
    {err && <p data-testid={`${testId}-error`} className="text-[11px] text-rose-600">{err}</p>}
    <p className={`text-[10px] ${muted}`}>Lands on their hitlist with an unread badge. They mark it done or claim it. Job notes with @mentions stay on the job — a message is the nudge, the note is the record.</p>
  </div>;
};

// Sender's view — delivered / seen / done per message
export const SentList = ({ dark, tick = 0, testId = 'sent' }: { dark?: boolean; tick?: number; testId?: string }) => {
  const { user } = useAuth(); const [rows, setRows] = useState<SentRow[]>([]);
  useEffect(() => { if (user) void hl.getSent(user.shortName).then(setRows); }, [user, tick]);
  const muted = dark ? 'text-slate-400' : 'text-ink-400';
  return <ul data-testid={`${testId}-list`} className={`divide-y ${dark ? 'divide-white/10' : 'divide-line/70'}`}>
    {rows.map((r) => <li key={r.id} data-testid={`${testId}-${r.id}`} className="flex items-start gap-2 py-1.5 text-xs">
      {r.photo && <img src={r.photo.dataUrl} alt="" className="h-8 w-11 shrink-0 rounded-sm object-cover" />}
      <div className="min-w-0 flex-1"><div className={`truncate ${dark ? 'text-slate-100' : 'text-ink'}`}>{r.text ? <MessageText text={r.text} pad={dark} dark={dark} /> : 'Photo'}</div><div className={`text-[10px] ${muted}`}>to <b>{r.toLabel}</b>{r.jobNumber && <> · <span className="font-mono">{r.jobNumber}</span></>} · {fmtTime(r.createdAt)}{r.doneBy && <> · done by {r.doneBy}</>}</div></div>
      <StatusChip status={r.status} dark={dark} />
    </li>)}
    {!rows.length && <li className={`py-3 text-xs ${muted}`}>Nothing sent yet.</li>}
  </ul>;
};
