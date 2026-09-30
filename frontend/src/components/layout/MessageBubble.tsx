import clsx from 'clsx';
import { MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { isPadDevice } from '@/config/device';
import { SentList } from './MessageComposer';
import { MessageDirectory, type ComposeTarget } from './MessageDirectory';
import { MessageInbox } from './MessageInbox';

type Tab = 'send' | 'inbox' | 'sent';
const TABS: { key: Tab; label: string }[] = [{ key: 'send', label: 'SEND' }, { key: 'inbox', label: 'INBOX' }, { key: 'sent', label: 'SENT' }];

// Floating message bubble on every desktop / pad screen (kiosks never mount a shell). Tap → slide-up panel (380 px desktop · full sheet on pads): SEND · INBOX · SENT.
// One-shot, directed messages — no threads; a reply is a new message back. New row for me → 3-second top banner.
export const MessageBubble = ({ variant = 'rs' }: { variant?: 'rs' | 'rw' }) => {
  const { user, station } = useAuth();
  const [open, setOpen] = useState(false); const [tab, setTab] = useState<Tab>('send'); const [tick, setTick] = useState(0); const [reply, setReply] = useState<ComposeTarget | null>(null);
  const [unread, setUnread] = useState(0); const [banner, setBanner] = useState<InboxRow | null>(null); const [ok, setOk] = useState<string | null>(null);
  const dark = variant === 'rw'; const pad = dark || isPadDevice(station);
  useEffect(() => {
    if (!user) return;
    let prev = hl.unreadCount(user.id); setUnread(prev);
    const show = (m: InboxRow | null) => { if (!m || m.from === user.shortName) return; setBanner(m); window.setTimeout(() => setBanner((b) => (b?.id === m.id ? null : b)), 3000); };
    const check = (e?: Event) => { const n = hl.unreadCount(user.id); const id = (e as CustomEvent<{ id: string }> | undefined)?.detail?.id; if (id) show(hl.inboxRowSync(id, user.id)); else if (n > prev) show(hl.latestUnread(user.id)); prev = n; setUnread(n); };
    window.addEventListener(hl.MESSAGE_EVENT, check); const t = window.setInterval(check, 2000);
    return () => { window.removeEventListener(hl.MESSAGE_EVENT, check); window.clearInterval(t); };
  }, [user, tick]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [open]);
  useEffect(() => { if (!ok) return; const t = window.setTimeout(() => setOk(null), 2500); return () => window.clearTimeout(t); }, [ok]);
  if (!user) return null;
  const bump = () => setTick((t) => t + 1);
  const startReply = (r: InboxRow) => { setReply({ to: { type: 'user', shortName: r.from }, label: r.from, sub: 'reply — a new message back, no thread', jobId: r.jobId, replyToId: r.id, replyText: r.text ?? 'Photo' }); setTab('send'); };
  const shell = dark ? 'border-white/10 bg-[#1f2630] text-slate-100' : 'border-line bg-surface text-ink'; const muted = dark ? 'text-slate-400' : 'text-ink-400';
  const bottom = variant === 'rw' ? 'calc(64px + 12px + env(safe-area-inset-bottom))' : '16px';
  return <>
    <button type="button" data-testid="msg-bubble" data-open={open} aria-label="Messages" title="Messages — send · inbox · sent" onClick={() => setOpen((o) => !o)} style={{ bottom }} className={clsx('fixed right-4 z-[75] grid place-items-center rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95', pad ? 'h-14 w-14' : 'h-12 w-12', dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white')}>
      {open ? <X size={pad ? 24 : 20} /> : <MessageCircle size={pad ? 26 : 22} />}
      {unread > 0 && !open && <span data-testid="msg-bubble-unread" className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white ring-2 ring-white">{unread}</span>}
    </button>
    {open && createPortal(<div data-testid="msg-panel" data-pad={pad} className={clsx('fixed z-[85] flex flex-col border shadow-2xl', shell, pad ? 'inset-0 animate-sheet-up' : 'right-4 w-[380px] max-h-[72vh] rounded-xl animate-sheet-up')} style={pad ? { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' } : { bottom: 'calc(16px + 56px)' }}>
      <div className={`flex items-center gap-2 border-b px-3 ${dark ? 'border-white/10' : 'border-line'} ${pad ? 'min-h-[56px]' : 'h-11'}`}>
        <MessageCircle size={16} className={dark ? 'text-accent' : 'text-ink-500'} /><span className="text-sm font-semibold">Messages</span>
        <div data-testid="msg-tabs" className={`ml-2 flex rounded-md border text-[11px] font-semibold tracking-wide ${dark ? 'border-white/15' : 'border-line'}`}>{TABS.map((t) => <button key={t.key} type="button" data-testid={`msg-tab-${t.key}`} aria-selected={tab === t.key} onClick={() => { setTab(t.key); if (t.key !== 'send') setReply(null); }} className={clsx('relative px-3', pad ? 'min-h-[40px]' : 'h-7', tab === t.key ? (dark ? 'bg-accent text-[#161b22]' : 'bg-ink text-white') : muted)}>{t.label}{t.key === 'inbox' && unread > 0 && <span data-testid="msg-tab-inbox-unread" className="ml-1 rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{unread}</span>}</button>)}</div>
        <button type="button" data-testid="msg-panel-close" onClick={() => setOpen(false)} aria-label="Close" className={`ml-auto grid place-items-center rounded-md ${muted} hover:opacity-80 ${pad ? 'h-11 w-11' : 'h-7 w-7'}`}><X size={16} /></button>
      </div>
      <div className={clsx('min-h-0 flex-1 overflow-y-auto px-3 py-3', pad && 'mx-auto w-full max-w-3xl')}>
        {tab === 'send' && <MessageDirectory dark={dark} pad={pad} initial={reply} onSent={(l) => { setReply(null); setOk(l); bump(); }} />}
        {tab === 'inbox' && <MessageInbox me={user} dark={dark} pad={pad} tick={tick} onChange={bump} onReply={startReply} jobBase={dark ? '/rw/jobs' : '/jobs'} />}
        {tab === 'sent' && <SentList dark={dark} tick={tick} testId="msg-sent" />}
      </div>
      {ok && <p data-testid="msg-sent-ok" className={`mx-3 mb-3 rounded-md px-2 py-1.5 text-[11px] font-medium ${dark ? 'bg-emerald-400/15 text-emerald-200' : 'bg-moss-50 text-moss-800'}`}>{ok}</p>}
    </div>, document.body)}
    {banner && createPortal(<button type="button" data-testid="msg-banner" onClick={() => { setBanner(null); setTab('inbox'); setOpen(true); }} className={clsx('fixed left-1/2 top-2 z-[95] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 shadow-2xl animate-rise', pad ? 'min-h-[56px] w-[560px]' : 'h-12 w-[420px]', dark ? 'border-accent/40 bg-[#0f131a] text-white' : 'border-line bg-ink text-white')} style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <MessageCircle size={18} className={dark ? 'text-accent' : 'text-sky-300'} />
      <span className="min-w-0 flex-1 text-left"><span className="block text-[11px] uppercase tracking-wide text-white/60">New message · from {banner.from}{banner.to.type === 'role' ? ` · #${banner.to.role}` : ''}</span><span data-testid="msg-banner-text" className="block truncate text-sm font-medium">{banner.text ?? 'Photo'}</span></span>
      {banner.photo && <img src={banner.photo.dataUrl} alt="" className="h-9 w-12 rounded-sm object-cover" />}
    </button>, document.body)}
  </>;
};
