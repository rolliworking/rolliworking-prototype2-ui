import { Inbox, X } from 'lucide-react';
import { useEffect } from 'react';
import type { InboxRow } from '@/api/hitlist';
import type { User } from '@/api/client';
import { InboxPanel } from './InboxPanel';

// Inbox lives behind a header chip; tapping slides a panel in from the right (board stays visible). Esc / scrim closes.
export const InboxChip = ({ count, unread, onClick }: { count: number; unread: number; onClick: () => void }) => (
  <button type="button" data-testid="hitlist-inbox-chip" data-unread={unread} onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-xs font-medium text-ink-700 hover:border-ink-400 hover:bg-canvas">
    <Inbox size={13} /> Inbox <span className="font-mono text-ink-400">{count}</span>
    {unread > 0 && <span data-testid="inbox-unread-count" className="rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">{unread}</span>}
  </button>
);

export const InboxDrawer = ({ open, me, items, onChange, onClose, jobBase }: { open: boolean; me: User; items: InboxRow[]; onChange: () => void; onClose: () => void; jobBase: string }) => {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return <>
    <div data-testid="hitlist-inbox-scrim" className="fixed inset-0 z-30 bg-ink/20" onClick={onClose} />
    <aside data-testid="hitlist-inbox-drawer" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-canvas shadow-2xl lg:w-[520px]" style={{ animation: 'slideIn 200ms ease-out' }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3"><h2 className="text-sm font-semibold text-ink">Inbox · {me.shortName}</h2><span className="text-xs text-ink-400">{items.length} item{items.length === 1 ? '' : 's'}</span><button type="button" data-testid="hitlist-inbox-close" onClick={onClose} aria-label="Close" className="ml-auto grid h-9 w-9 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><X size={16} /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3"><InboxPanel me={me} items={items} onChange={onChange} jobBase={jobBase} /></div>
    </aside>
  </>;
};
