import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as hl from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { MessageComposer, SentList } from './MessageComposer';

// Desktop top-bar "Message" — one-shot directed messages (New) + what I sent with delivered / seen / done (Sent). Unread badge = my inbox.
export const MessagesButton = ({ dark }: { dark?: boolean }) => {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const [tab, setTab] = useState<'new' | 'sent'>('new'); const [tick, setTick] = useState(0); const [ok, setOk] = useState<string | null>(null);
  const unread = user ? hl.unreadCount(user.id) : 0;
  useEffect(() => { if (!ok) return; const t = window.setTimeout(() => setOk(null), 2500); return () => window.clearTimeout(t); }, [ok]);
  const btn = dark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-line bg-canvas text-ink-500 hover:border-ink-400 hover:text-ink';
  return <>
    <button type="button" data-testid="messages-btn" title="Send a message (person · #role · station)" onClick={() => setOpen(!open)} className={`relative flex h-7 items-center gap-1 rounded-sm border px-1.5 text-[11px] ${btn}`}><MessageSquare size={13} />{unread > 0 && <span data-testid="messages-unread" className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 px-1 text-[9px] font-semibold text-white">{unread}</span>}</button>
    {open && createPortal(<div data-testid="messages-panel" className="fixed right-3 top-12 z-[80] w-[380px] rounded-md border border-line bg-surface p-3 text-ink shadow-xl">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">Message</span>
        <div className="ml-1 flex rounded-sm border border-line text-[11px]">{(['new', 'sent'] as const).map((k) => <button key={k} data-testid={`messages-tab-${k}`} onClick={() => setTab(k)} className={`px-2 py-0.5 capitalize ${tab === k ? 'bg-ink text-white' : 'text-ink-500'}`}>{k}</button>)}</div>
        <button data-testid="messages-close" onClick={() => setOpen(false)} className="ml-auto text-xs text-ink-400 hover:text-ink">close</button>
      </div>
      <div className="mt-2">{tab === 'new' ? <MessageComposer onSent={(l) => { setOk(l); setTick((t) => t + 1); }} /> : <SentList tick={tick} />}</div>
      {ok && <p data-testid="messages-sent-ok" className="mt-2 rounded-sm bg-moss-50 px-2 py-1 text-[11px] font-medium text-moss-800">{ok}</p>}
    </div>, document.body)}
  </>;
};
