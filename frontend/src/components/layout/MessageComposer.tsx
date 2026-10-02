import { Check, CheckCheck, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as hl from '@/api/hitlist';
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

export const STATUS_LABEL: Record<MessageStatus, string> = { delivered: 'Delivered', seen: 'Seen', done: 'Done' };
export const StatusChip = ({ status, dark }: { status: MessageStatus; dark?: boolean }) => {
  const tone = status === 'done' ? (dark ? 'bg-emerald-400/20 text-emerald-200' : 'bg-moss-50 text-moss-800') : status === 'seen' ? (dark ? 'bg-sky-400/20 text-sky-200' : 'bg-sky-50 text-sky-800') : dark ? 'bg-white/10 text-slate-300' : 'bg-canvas text-ink-500';
  return <span data-testid="msg-status" data-status={status} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{status === 'done' ? <CheckCheck size={10} /> : status === 'seen' ? <Check size={10} /> : <Send size={9} />}{STATUS_LABEL[status]}</span>;
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
