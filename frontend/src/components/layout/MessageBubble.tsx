import clsx from 'clsx';
import { MessageCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { isPadDevice } from '@/config/device';
import { RightSheet } from '@/components/ui/RightSheet';
import type { ComposeTarget } from './MessageDirectory';
import { ShareCompose, type ShareDetail } from './ShareCompose';
import { TeamMessages } from './TeamMessages';
import { setPendingCompose, teamInboxPath } from './teamCompose';

// Other screens open the composer: Inbox → "Share with staff" (quoted client message, pick recipients) or "Reply" on a staff message
export const BUBBLE_COMPOSE_EVENT = 'rollisuite:bubble-compose';
export interface BubbleComposeDetail { replyTo?: InboxRow; share?: ShareDetail }
const replyTarget = (r: InboxRow): ComposeTarget => ({ to: { type: 'user', shortName: r.from }, label: r.from, sub: 'reply — a new message back, no thread', jobId: r.jobId, replyToId: r.id, replyText: r.text ?? 'Photo' });

// Floating bubble on every desktop / pad screen (kiosks never mount a shell).
// DESKTOP (MH 2026-10-02): a SHORTCUT only — badge = unread team count; click → Inbox → Team (Received); ⌘/Ctrl-click or long-press → Team with the composer open. No popover.
// PAD (no Inbox page): tap → full-sheet panel mounting the same Team component (list · chips · collapsed Directory · composer). Share-with-staff opens a slide-out on both.
export const MessageBubble = ({ variant = 'rs' }: { variant?: 'rs' | 'rw' }) => {
  const { user, station } = useAuth(); const nav = useNavigate();
  const [open, setOpen] = useState(false); const [target, setTarget] = useState<ComposeTarget | null>(null); const [share, setShare] = useState<ShareDetail | null>(null);
  const [unread, setUnread] = useState(0); const [banner, setBanner] = useState<InboxRow | null>(null); const [ok, setOk] = useState<string | null>(null); const press = useRef<number | null>(null); const longPressed = useRef(false);
  const dark = variant === 'rw'; const pad = dark || isPadDevice(station);
  const goTeam = (compose = false) => { if (pad) { setOpen(true); if (!compose) setTarget(null); } else nav(teamInboxPath({ compose })); };
  useEffect(() => { const h = (e: Event) => { const d = (e as CustomEvent<BubbleComposeDetail>).detail; if (d.share) { setShare(d.share); return; } if (d.replyTo) { const t = replyTarget(d.replyTo); if (pad) { setTarget(t); setOpen(true); } else { setPendingCompose(t); nav(teamInboxPath({ compose: true })); } } }; window.addEventListener(BUBBLE_COMPOSE_EVENT, h); return () => window.removeEventListener(BUBBLE_COMPOSE_EVENT, h); }, [pad, nav]);
  useEffect(() => {
    if (!user) return;
    let prev = hl.unreadCount(user.id); setUnread(prev);
    const show = (m: InboxRow | null) => { if (!m || m.from === user.shortName) return; setBanner(m); window.setTimeout(() => setBanner((b) => (b?.id === m.id ? null : b)), 3000); };
    const check = (e?: Event) => { const n = hl.unreadCount(user.id); const id = (e as CustomEvent<{ id: string }> | undefined)?.detail?.id; if (id) show(hl.inboxRowSync(id, user.id)); else if (n > prev) show(hl.latestUnread(user.id)); prev = n; setUnread(n); };
    window.addEventListener(hl.MESSAGE_EVENT, check); const t = window.setInterval(check, 2000);
    return () => { window.removeEventListener(hl.MESSAGE_EVENT, check); window.clearInterval(t); };
  }, [user]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [open]);
  useEffect(() => { if (!ok) return; const t = window.setTimeout(() => setOk(null), 2500); return () => window.clearTimeout(t); }, [ok]);
  if (!user) return null;
  const shell = dark ? 'border-white/10 bg-[#1f2630] text-slate-100' : 'border-line bg-surface text-ink'; const muted = dark ? 'text-slate-400' : 'text-ink-400';
  const bottom = variant === 'rw' ? 'calc(64px + 12px + env(safe-area-inset-bottom))' : '16px';
  const startPress = () => { longPressed.current = false; press.current = window.setTimeout(() => { longPressed.current = true; goTeam(true); }, 500); };
  const endPress = () => { if (press.current) window.clearTimeout(press.current); press.current = null; };
  return <>
    <button type="button" data-testid="msg-bubble" data-open={open || undefined} data-mode={pad ? 'panel' : 'shortcut'} aria-label="Team messages" title={pad ? 'Team messages' : 'Team messages — click: Inbox → Team · ⌘/Ctrl-click or hold: new message'} onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onClick={(e) => { if (longPressed.current) { longPressed.current = false; return; } if (pad && open) { setOpen(false); return; } goTeam(e.metaKey || e.ctrlKey); }} style={{ bottom }} className={clsx('fixed right-4 z-[75] grid place-items-center rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95', pad ? 'h-14 w-14' : 'h-12 w-12', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}>
      {pad && open ? <X size={24} /> : <MessageCircle size={pad ? 26 : 22} />}
      {unread > 0 && !open && <span data-testid="msg-bubble-unread" className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white ring-2 ring-white">{unread}</span>}
    </button>
    {pad && open && createPortal(<div data-testid="msg-panel" data-pad className={clsx('fixed inset-0 z-[85] flex flex-col border shadow-2xl animate-sheet-up', shell)} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className={`flex min-h-[56px] items-center gap-2 border-b px-3 ${dark ? 'border-white/10' : 'border-line'}`}><MessageCircle size={16} className={dark ? 'text-accent' : 'text-ink-500'} /><span className="text-sm font-semibold">Team</span><span className={`text-[11px] ${muted}`}>· same list as Inbox → Team</span><button type="button" data-testid="msg-panel-close" onClick={() => setOpen(false)} aria-label="Close" className={`ml-auto grid h-11 w-11 place-items-center rounded-md ${muted} hover:opacity-80`}><X size={16} /></button></div>
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-3 py-3"><TeamMessages me={user} dark={dark} pad jobBase={dark ? '/rw/jobs' : '/jobs'} initialTarget={target} /></div>
    </div>, document.body)}
    {share && createPortal(<RightSheet testId="msg-share-sheet" pad={pad} title="Share with staff" onClose={() => setShare(null)}><ShareCompose share={share} dark={false} pad={pad} onBack={() => setShare(null)} onSent={(l) => { setShare(null); setOk(l); }} /></RightSheet>, document.body)}
    {ok && createPortal(<p data-testid="msg-sent-ok" className="fixed left-1/2 top-2 z-[95] -translate-x-1/2 rounded-md bg-ink px-3 py-1.5 text-[11px] font-medium text-white shadow-xl animate-rise" style={{ marginTop: 'env(safe-area-inset-top)' }}>{ok}</p>, document.body)}
    {banner && createPortal(<button type="button" data-testid="msg-banner" onClick={() => { setBanner(null); goTeam(); }} className={clsx('fixed left-1/2 top-2 z-[95] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 shadow-2xl animate-rise', pad ? 'min-h-[56px] w-[560px]' : 'h-12 w-[420px]', dark ? 'border-accent/40 bg-[#0f131a] text-white' : 'border-line bg-ink text-white')} style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <MessageCircle size={18} className={dark ? 'text-accent' : 'text-sky-300'} />
      <span className="min-w-0 flex-1 text-left"><span className="block text-[11px] uppercase tracking-wide text-white/60">New message · from {banner.from}{banner.to.type === 'role' ? ` · #${banner.to.role}` : ''}</span><span data-testid="msg-banner-text" className="block truncate text-sm font-medium">{banner.text ?? 'Photo'}</span></span>
      {banner.photo && <img src={banner.photo.dataUrl} alt="" className="h-9 w-12 rounded-sm object-cover" />}
    </button>, document.body)}
  </>;
};
