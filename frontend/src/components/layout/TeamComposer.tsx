import clsx from 'clsx';
import { Camera, ChevronDown, ChevronRight, Mic, MicOff, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { JobWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useDictation } from './MessageComposer';
import { composeOptions, DirectoryCards, targetKey, type ComposeTarget } from './MessageDirectory';

const DIR_KEY = 'rollisuite.team.directoryOpen';

// Team composer — expands at the top of the list (never a modal). To = type-ahead (person · #role · station) or a card from the collapsed Directory ▸ below it; text / dictate · Photo · Job# · Send. One shot, no thread.
export const TeamComposer = ({ dark, pad, initial, onSent, onCancel, testId = 'team' }: { dark?: boolean; pad: boolean; initial?: ComposeTarget | null; onSent: (label: string) => void; onCancel?: () => void; testId?: string }) => {
  const { station, user } = useAuth(); const div = station?.division ?? 'rolliworks';
  const [target, setTarget] = useState<ComposeTarget | null>(initial ?? null); const [q, setQ] = useState(''); const [focus, setFocus] = useState(false);
  const [text, setText] = useState(''); const [photo, setPhoto] = useState<string | null>(null); const [jobQ, setJobQ] = useState(''); const [job, setJob] = useState<JobWithRefs | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [dirOpen, setDirOpen] = useState(() => localStorage.getItem(DIR_KEY) === '1');
  const file = useRef<HTMLInputElement>(null); const toRef = useRef<HTMLInputElement>(null); const dict = useDictation((t) => setText((x) => `${x}${x && !x.endsWith(' ') ? ' ' : ''}${t}`));
  useEffect(() => { setTarget(initial ?? null); if (initial?.jobId) void api.getJob(initial.jobId).then(setJob).catch(() => undefined); }, [initial]);
  useEffect(() => { if (!initial) toRef.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => composeOptions(div, user?.id), [div, user?.id]);
  const hits = useMemo(() => { const s = q.trim().replace(/^[@#]/, '').toLowerCase(); if (!s) return options.slice(0, 8); return options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(s)).slice(0, 8); }, [q, options]);
  const pick = (t: ComposeTarget) => { setTarget(t); setQ(''); setFocus(false); setErr(null); };
  const toggleDir = () => setDirOpen((o) => { localStorage.setItem(DIR_KEY, o ? '0' : '1'); return !o; });
  const findJob = async () => { if (!jobQ.trim()) return; const found = await api.searchJobs(jobQ.trim()); if (found[0]) { setJob(found[0]); setJobQ(''); setErr(null); } else setErr(`No job matches “${jobQ}”`); };
  const send = async () => {
    if (!target) { setErr('Pick who this is for — type a name, #role or station, or open the Directory'); toRef.current?.focus(); return; }
    if (!text.trim() && !photo) { setErr('Type, dictate, tap a preset, or attach a photo'); return; }
    setBusy(true); setErr(null);
    try {
      const body = target.replyToId && !/^re:/i.test(text.trim()) ? `Re: ${text.trim()}` : text.trim();
      await hl.sendMessage({ to: target.to, text: body, jobId: job?.id, replyToId: target.replyToId, photo: photo ? { id: `msg-${Date.now().toString(36)}`, source: 'camera', dataUrl: photo, slot: 'message', photoType: 'bench' } : undefined });
      setTarget(null); setText(''); setPhoto(null); setJob(null); onSent(target.to.type === 'role' ? `Sent to ${target.label} — first to claim owns it` : `Sent to ${target.label}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const muted = dark ? 'text-slate-400' : 'text-ink-400'; const h = pad ? 'min-h-[44px]' : 'h-8';
  const field = dark ? 'rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none' : 'rounded-md border border-line bg-canvas text-ink focus:border-ink focus:outline-none';
  const chip = dark ? 'border-white/15 text-slate-100 hover:bg-white/10' : 'border-line text-ink-700 hover:bg-canvas';
  return <div data-testid={`${testId}-composer`} data-to={target?.label} className={clsx('space-y-2.5 rounded-md border p-3', dark ? 'border-accent/40 bg-white/[0.03]' : 'border-ink bg-surface')}>
    <div className="flex items-center gap-2 text-xs"><span className={`font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{target?.replyToId ? 'Reply' : 'New message'}</span><span className={muted}>one shot · no thread · lands on their hitlist</span>{onCancel && <button type="button" data-testid={`${testId}-cancel`} onClick={onCancel} className={`ml-auto inline-flex items-center gap-1 ${muted} hover:opacity-80`}><X size={12} /> Close</button>}</div>
    {target?.replyText && <div data-testid={`${testId}-reply-quote`} className={`rounded-md border-l-2 px-2 py-1 text-[11px] ${dark ? 'border-accent bg-white/5 text-slate-300' : 'border-ink bg-canvas text-ink-600'}`}>“{target.replyText}”</div>}
    <div className="relative">
      <div className={clsx('flex flex-wrap items-center gap-1.5 px-2', field, pad ? 'min-h-[48px] py-1.5' : 'min-h-[34px] py-1')}>
        <span className={`text-[11px] ${muted}`}>To</span>
        {target && <span data-testid={`${testId}-to-chip`} data-key={targetKey(target)} className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}>{target.label}{!target.replyToId && <button type="button" data-testid={`${testId}-to-clear`} onClick={() => { setTarget(null); toRef.current?.focus(); }} aria-label="Clear recipient"><X size={11} /></button>}</span>}
        {!target && <input ref={toRef} data-testid={`${testId}-to-input`} value={q} onChange={(e) => { setQ(e.target.value); setFocus(true); }} onFocus={() => setFocus(true)} onBlur={() => window.setTimeout(() => setFocus(false), 120)} onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); pick(hits[0]); } if (e.key === 'Escape') setFocus(false); }} placeholder="person · #role · station" className={clsx('min-w-[160px] flex-1 bg-transparent focus:outline-none', pad ? 'text-base' : 'text-[13px]')} />}
        {target && target.sub && <span className={`truncate text-[10px] ${muted}`}>{target.sub}</span>}
      </div>
      {!target && focus && hits.length > 0 && <ul data-testid={`${testId}-to-suggestions`} className={clsx('absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border shadow-xl', dark ? 'border-white/15 bg-[#1f2630]' : 'border-line bg-surface')}>{hits.map((o) => <li key={targetKey(o)}><button type="button" data-testid={`${testId}-to-opt-${targetKey(o)}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className={clsx('flex w-full items-center gap-2 px-3 text-left', pad ? 'min-h-[44px] text-sm' : 'h-8 text-xs', dark ? 'text-slate-100 hover:bg-white/10' : 'text-ink hover:bg-canvas')}><span className={clsx('font-semibold', o.to.type === 'role' && 'font-mono')}>{o.label}</span><span className={`truncate text-[10px] ${muted}`}>{o.sub}</span><span className={`ml-auto text-[9px] uppercase ${muted}`}>{o.to.type}</span></button></li>)}</ul>}
    </div>
    <div>
      <button type="button" data-testid={`${testId}-directory-toggle`} data-open={dirOpen} aria-expanded={dirOpen} onClick={toggleDir} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dark ? 'text-slate-300 hover:text-white' : 'text-ink-600 hover:text-ink'}`}>{dirOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Directory <span className={`font-normal ${muted}`}>· people · roles · stations — tap a card to fill To</span></button>
      {dirOpen && <div data-testid={`${testId}-directory`} className={clsx('mt-2 rounded-md border p-2', dark ? 'border-white/10' : 'border-line bg-canvas/40')}><DirectoryCards dark={dark} pad={pad} onPick={pick} /></div>}
    </div>
    <div data-testid={`${testId}-presets`} className="flex flex-wrap gap-1.5">{hl.MESSAGE_PRESETS.map((p, i) => <button key={p} type="button" data-testid={`${testId}-preset-${i}`} aria-pressed={text === p} onClick={() => setText(p)} className={clsx('rounded-full border px-2.5 text-left', pad ? 'min-h-[40px] text-sm' : 'h-6 text-[11px]', text === p ? (dark ? 'border-accent bg-accent text-[#161b22]' : 'border-ink bg-ink text-white') : chip)}>{p}</button>)}</div>
    <div className="flex items-start gap-2">
      <textarea data-testid={`${testId}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={pad ? 3 : 2} placeholder={dict.on ? 'Listening… speak now' : 'Type or dictate'} className={`${field} w-full resize-none px-3 py-2 ${pad ? 'text-base' : 'text-[13px]'}`} />
      <button type="button" data-testid={`${testId}-dictate`} disabled={!dict.supported} title={dict.supported ? (dict.on ? 'Stop dictation' : 'Dictate') : 'Dictation not supported in this browser'} onClick={dict.toggle} className={clsx('grid shrink-0 place-items-center rounded-full disabled:opacity-30', pad ? 'h-12 w-12' : 'h-9 w-9', dict.on ? 'animate-pulse bg-rose-600 text-white' : dark ? 'bg-accent text-[#161b22]' : 'bg-canvas text-ink-600 ring-1 ring-line')}>{dict.on ? <MicOff size={pad ? 20 : 15} /> : <Mic size={pad ? 20 : 15} />}</button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input ref={file} data-testid={`${testId}-photo-input`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); e.target.value = ''; }} />
      {photo ? <span data-testid={`${testId}-photo-chip`} className="relative inline-flex"><img src={photo} alt="" className={`h-10 w-14 rounded-sm object-cover ring-1 ${dark ? 'ring-white/20' : 'ring-line'}`} /><button type="button" data-testid={`${testId}-photo-remove`} onClick={() => setPhoto(null)} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-white"><X size={9} /></button></span>
        : <button type="button" data-testid={`${testId}-photo-btn`} onClick={() => file.current?.click()} className={`inline-flex ${h} items-center gap-1 rounded-md border px-2 text-xs ${chip}`}><Camera size={14} /> Photo</button>}
      {job ? <span data-testid={`${testId}-job-chip`} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${dark ? 'bg-accent/15 text-accent' : 'bg-brand-50 text-brand'}`}>{job.number}<span className={`font-sans font-normal ${muted}`}>· {job.client.firstName} {job.client.lastName}</span><button type="button" data-testid={`${testId}-job-remove`} onClick={() => setJob(null)} aria-label="Remove job"><X size={10} /></button></span>
        : <input data-testid={`${testId}-job-input`} value={jobQ} onChange={(e) => setJobQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void findJob(); } }} onBlur={() => void findJob()} placeholder="Job# / est# (optional)" className={`${field} ${h} w-40 px-2 font-mono text-xs`} />}
      <button type="button" data-testid={`${testId}-send`} disabled={busy} onClick={() => void send()} className={clsx('ml-auto inline-flex items-center gap-1.5 rounded-md px-4 font-semibold disabled:opacity-40', pad ? 'min-h-[48px] text-base' : 'h-8 text-xs', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}><Send size={pad ? 18 : 13} /> Send</button>
    </div>
    {err && <p data-testid={`${testId}-error`} className="text-[11px] text-rose-500">{err}</p>}
  </div>;
};
