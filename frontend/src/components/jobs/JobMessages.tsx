import { AtSign, Camera, CornerDownRight, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import type { JobMessage, JobThread, JobWithRefs, User } from '@/api/client';
import { fmtDate, fmtTime } from '@/lib/format';

// Renders @Short mentions as chips inside message text
export const MentionText = ({ text }: { text: string }) => <>{text.split(/(@\w+)/g).map((p, i) => (/^@\w+$/.test(p) ? <span key={i} data-testid="mention-chip" className="rounded-sm bg-amber-100 px-1 font-semibold text-amber-900 rw-mention">{p}</span> : p))}</>;

// Composer with @ staff picker (typing @ opens it) + optional photo (camera flow on pads, upload on desktop)
export const MessageComposer = ({ onSend, placeholder, testId, autoFocus, onCancel }: { onSend: (text: string, photoUrl?: string) => Promise<void>; placeholder: string; testId: string; autoFocus?: boolean; onCancel?: () => void }) => {
  const [text, setText] = useState(''); const [photo, setPhoto] = useState<string | null>(null); const [pick, setPick] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null); const file = useRef<HTMLInputElement>(null);
  const staff = api.staffForMention().filter((u) => pick === null || u.shortName.toLowerCase().startsWith(pick.toLowerCase()) || u.firstName.toLowerCase().startsWith(pick.toLowerCase()));
  const onChange = (v: string) => { setText(v); const caret = ta.current?.selectionStart ?? v.length; const m = /@(\w*)$/.exec(v.slice(0, caret)); setPick(m ? m[1] : null); };
  const insert = (u: User) => { const caret = ta.current?.selectionStart ?? text.length; const before = text.slice(0, caret).replace(/@\w*$/, `@${u.shortName} `); setText(before + text.slice(caret)); setPick(null); ta.current?.focus(); };
  const send = async () => { if (!text.trim() || busy) return; setBusy(true); try { await onSend(text, photo ?? undefined); setText(''); setPhoto(null); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  return <div data-testid={testId} className="relative space-y-1.5">
    <textarea ref={ta} data-testid={`${testId}-input`} autoFocus={autoFocus} rows={2} value={text} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && pick === null) { e.preventDefault(); void send(); } if (e.key === 'Escape' && pick !== null) setPick(null); }} placeholder={placeholder} className="w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:outline-none" />
    {pick !== null && <ul data-testid={`${testId}-picker`} className="absolute left-0 top-full z-20 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-lg">{staff.map((u) => <li key={u.id}><button type="button" data-testid={`${testId}-pick-${u.id}`} onMouseDown={(e) => { e.preventDefault(); insert(u); }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-canvas"><AtSign size={11} className="text-amber-700" /><span className="font-semibold">{u.shortName}</span><span className="text-ink-500">{u.dutyLabel}</span><span className="ml-auto text-[10px] uppercase text-ink-400">{api.isManagerTier(u) ? 'hit list' : 'bench'}</span></button></li>)}{!staff.length && <li className="px-2 py-1.5 text-xs text-ink-400">No one matches</li>}</ul>}
    {photo && <div className="relative inline-block"><img src={photo} alt="attached" className="h-16 rounded-sm border border-line object-cover" /><button type="button" data-testid={`${testId}-photo-remove`} onClick={() => setPhoto(null)} className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-white"><X size={10} /></button></div>}
    <div className="flex items-center gap-1.5">
      <input ref={file} data-testid={`${testId}-photo-input`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); e.target.value = ''; }} />
      <button type="button" data-testid={`${testId}-photo`} onClick={() => file.current?.click()} title="Attach a photo" className="inline-flex h-8 items-center gap-1 rounded-sm border border-line px-2 text-xs text-ink-600 hover:bg-canvas"><Camera size={12} /> Photo</button>
      <button type="button" data-testid={`${testId}-at`} onClick={() => { setText(`${text}${text && !text.endsWith(' ') ? ' ' : ''}@`); setPick(''); ta.current?.focus(); }} title="Mention someone" className="inline-flex h-8 items-center gap-1 rounded-sm border border-line px-2 text-xs text-ink-600 hover:bg-canvas"><AtSign size={12} /> Mention</button>
      <span className="text-[11px] text-ink-400">Internal only · never client-facing</span>
      {onCancel && <button type="button" onClick={onCancel} className="ml-auto text-xs text-ink-500 hover:text-ink">Cancel</button>}
      <button type="button" data-testid={`${testId}-send`} onClick={() => void send()} disabled={busy || !text.trim()} className={`inline-flex h-8 items-center gap-1 rounded-sm bg-ink px-3 text-xs font-semibold text-white disabled:opacity-40 ${onCancel ? '' : 'ml-auto'}`}><Send size={12} /> Send</button>
    </div>
    {err && <p data-testid={`${testId}-error`} className="text-xs text-rose-600">{err}</p>}
  </div>;
};

const Msg = ({ m, reply, hit }: { m: JobMessage; reply?: boolean; hit?: boolean }) => (
  <div id={`msg-${m.id}`} data-testid={`msg-${m.id}`} className={`rounded-sm px-2 py-1.5 ${hit ? 'bg-amber-100/70 ring-1 ring-amber-400' : ''} ${reply ? 'ml-5 border-l-2 border-line pl-3' : ''}`}>
    <div className="flex items-center gap-1.5 text-[11px] text-ink-400">{reply && <CornerDownRight size={10} />}<span className="font-semibold text-ink-700">{m.by}</span> · {fmtDate(m.at)} {fmtTime(m.at)} · {m.station}{m.notify.length > 0 && <span data-testid={`msg-routed-${m.id}`} className="ml-1 rounded-full bg-canvas px-1.5 text-[10px]">→ {m.notify.map((n) => `@${n}`).join(' ')}</span>}</div>
    <div className="mt-0.5 text-[13px] text-ink"><MentionText text={m.text} /></div>
    {m.photo && <img data-testid={`msg-photo-${m.id}`} src={m.photo.dataUrl} alt="attached" className="mt-1.5 max-h-40 rounded-sm border border-line object-cover" />}
  </div>
);

// The job's message board: threads, replies, @routing. Replaces flat notes (legacy notes render as unrouted roots).
export const MessagesPanel = ({ job: j, onChanged, dark }: { job: JobWithRefs; onChanged?: () => void; dark?: boolean }) => {
  const [threads, setThreads] = useState<JobThread[]>([]); const [replyTo, setReplyTo] = useState<string | null>(null);
  const hit = typeof window !== 'undefined' && window.location.hash.startsWith('#msg-') ? window.location.hash.slice(5) : null;
  const load = () => api.getJobThreads(j.id).then(setThreads);
  useEffect(() => { void load(); }, [j.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (hit && threads.length) window.setTimeout(() => document.getElementById(`msg-${hit}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); }, [hit, threads.length]);
  const post = async (text: string, photoUrl?: string, parentId?: string) => { await api.postJobMessage(j.id, text, { parentId, photoUrl }); setReplyTo(null); await load(); onChanged?.(); };
  return <div data-testid="messages-panel" className={dark ? 'rw-dark' : ''}>
    <MessageComposer testId="msg-new" placeholder="Leave a message on this job — @ to route it to someone" onSend={(t, p) => post(t, p)} />
    <ul className="mt-3 space-y-3">
      {threads.map((t) => <li key={t.root.id} data-testid={`thread-${t.root.id}`} className="rounded-md border border-line/70 p-1.5">
        <Msg m={t.root} hit={hit === t.root.id} />
        {t.replies.map((r) => <Msg key={r.id} m={r} reply hit={hit === r.id} />)}
        <div className="mt-1 pl-2">{replyTo === t.root.id ? <MessageComposer testId={`msg-reply-${t.root.id}`} autoFocus placeholder={`Reply — re-notifies ${t.participants.filter((p) => p !== t.root.by).map((p) => `@${p}`).concat(`@${t.root.by}`).join(' ')}`} onSend={(txt, p) => post(txt, p, t.root.id)} onCancel={() => setReplyTo(null)} /> : <button type="button" data-testid={`msg-reply-btn-${t.root.id}`} onClick={() => setReplyTo(t.root.id)} className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink"><CornerDownRight size={10} /> Reply{t.replies.length > 0 && ` · ${t.replies.length}`}</button>}</div>
      </li>)}
      {threads.length === 0 && <li className="py-1.5 text-xs text-ink-400">No messages yet.</li>}
    </ul>
  </div>;
};
