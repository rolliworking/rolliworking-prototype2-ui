import clsx from 'clsx';
import { Check, ChevronLeft, Send, Share2 } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { Assignee, PackagePhoto } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

// "Share with staff" (one general Inbox): the client's message travels QUOTED to one or more staff as one-shot messages; the thread logs "Shared with … by …".
export interface ShareDetail { conversationId: string; messageId: string; quote: string; photo?: PackagePhoto; jobId?: string; clientName?: string }
export const ShareCompose = ({ share, dark, pad, onBack, onSent }: { share: ShareDetail; dark?: boolean; pad: boolean; onBack: () => void; onSent: (label: string) => void }) => {
  const { station, user } = useAuth(); const div = station?.division ?? 'rolliworks';
  const people = api.getDivisionStaff(div).filter((u) => u.id !== user?.id); const roles = api.getDivisionRoles(div);
  const [picked, setPicked] = useState<string[]>([]); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const target = (k: string): Assignee => (k.startsWith('role:') ? { type: 'role', role: k.slice(5) as never } : { type: 'user', shortName: k });
  const send = async () => {
    if (!picked.length) { setErr('Pick at least one person'); return; }
    setBusy(true); setErr(null);
    try { await hl.shareClientMessage({ conversationId: share.conversationId, messageId: share.messageId, to: picked.map(target), note, quote: share.quote, photo: share.photo, jobId: share.jobId }); onSent(`Shared with ${picked.map((k) => (k.startsWith('role:') ? `#${k.slice(5)}` : k)).join(', ')} — quoted · logged on the thread`); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const muted = dark ? 'text-slate-400' : 'text-ink-400'; const h = pad ? 'min-h-[44px]' : 'h-8';
  const field = dark ? 'rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none' : 'rounded-md border border-line bg-canvas text-ink focus:border-ink focus:outline-none';
  const tile = (on: boolean) => clsx('relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors', on ? (dark ? 'border-accent bg-accent/15' : 'border-ink bg-ink text-white') : dark ? 'border-white/10 bg-white/[0.04] hover:bg-white/10' : 'border-line bg-surface hover:bg-canvas');
  return <div data-testid="msg-share" className="space-y-3">
    <div className="flex items-center gap-2">
      <button type="button" data-testid="msg-share-back" onClick={onBack} className={`inline-flex items-center gap-0.5 rounded-md text-xs ${muted} hover:opacity-80 ${pad ? 'min-h-[44px] px-1' : 'h-7'}`}><ChevronLeft size={14} /> Directory</button>
      <div className={`ml-auto inline-flex items-center gap-1 text-sm font-semibold ${dark ? 'text-white' : 'text-ink'}`}><Share2 size={14} /> Share with staff</div>
    </div>
    <div data-testid="msg-share-quote" className={`whitespace-pre-line rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug ${dark ? 'border-accent bg-white/5 text-slate-300' : 'border-rose-300 bg-rose-50/60 text-ink-700'}`}>{share.quote}</div>
    {share.photo && <img data-testid="msg-share-photo" src={share.photo.dataUrl} alt="" className={`h-14 w-20 rounded-sm object-cover ring-1 ${dark ? 'ring-white/20' : 'ring-line'}`} />}
    <div className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>To · pick one or more</div>
    <div data-testid="msg-share-people" className={clsx('grid gap-2', pad ? 'grid-cols-4' : 'grid-cols-3')}>{people.map((u) => { const on = picked.includes(u.shortName); return <button key={u.id} type="button" data-testid={`msg-share-tile-${u.shortName}`} aria-pressed={on} onClick={() => toggle(u.shortName)} className={tile(on)}>
      <span className={clsx('grid h-8 w-8 place-items-center rounded-full font-mono text-[11px] font-semibold', on ? 'bg-white/20 text-white' : dark ? 'bg-white/10 text-white' : 'bg-ink text-white')}>{hl.staffInitials(u)}</span><span className="text-xs font-semibold">{u.shortName}</span><span className={`w-full truncate text-[10px] ${on ? 'text-white/70' : muted}`}>{u.dutyLabel}</span>
      {on && <Check size={12} className="absolute right-1.5 top-1.5" />}
    </button>; })}</div>
    <div data-testid="msg-share-roles" className="flex flex-wrap gap-1.5">{roles.map((r) => { const k = `role:${r}`; const on = picked.includes(k); return <button key={r} type="button" data-testid={`msg-share-role-${r}`} aria-pressed={on} onClick={() => toggle(k)} className={clsx('rounded-full border px-3 font-mono text-xs font-semibold', pad ? 'min-h-[44px]' : 'h-7', on ? (dark ? 'border-accent bg-accent text-[#161b22]' : 'border-ink bg-ink text-white') : dark ? 'border-white/15 text-slate-100 hover:bg-white/10' : 'border-line text-ink-700 hover:bg-canvas')}>#{r}</button>; })}</div>
    <textarea data-testid="msg-share-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a line for them (optional) — e.g. “can you check the crown notes?”" className={`${field} w-full resize-none px-3 py-2 ${pad ? 'text-base' : 'text-[13px]'}`} />
    <div className="flex items-center gap-2">
      <span className={`text-[10px] ${muted}`}>The thread link opens only for MH · VC · CM — everyone else just sees the quote.</span>
      <button type="button" data-testid="msg-share-send" disabled={busy || !picked.length} onClick={() => void send()} className={clsx('ml-auto inline-flex items-center gap-1.5 rounded-md px-4 font-semibold disabled:opacity-40', h, pad ? 'text-base' : 'text-xs', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}><Send size={pad ? 18 : 13} /> Share{picked.length > 1 ? ` (${picked.length})` : ''}</button>
    </div>
    {err && <p data-testid="msg-share-error" className="text-[11px] text-rose-500">{err}</p>}
  </div>;
};
