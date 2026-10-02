import { ArrowLeft, CornerUpLeft, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { clearInboxContext, inboxReturnPath, useInboxContext } from '@/api/inboxContext';

// Persistent return chip (top of every page while an inbox context is active): one click jumps straight to the message, whatever the depth.
// Hidden while that very message is on screen. × = drop the context without going back.
export const InboxReturnChip = () => {
  const ctx = useInboxContext(); const { pathname } = useLocation(); const [sp] = useSearchParams();
  if (!ctx || (pathname === '/inbox' && sp.get('thread') === ctx.threadId)) return null;
  return <div data-testid="inbox-return-chip" data-thread={ctx.threadId} className="mb-3 flex items-center gap-2 rounded-md border border-brand/30 bg-brand-50 px-2 py-1 text-xs text-ink animate-rise">
    <Link to={inboxReturnPath(ctx)} data-testid="inbox-return-link" className="inline-flex min-w-0 items-center gap-1.5 font-medium text-brand hover:underline"><ArrowLeft size={12} /> Back to message<span className="text-ink-400">·</span><span className="truncate text-ink">{ctx.clientName}</span><span className="text-ink-400">·</span><span className="truncate font-normal text-ink-600">{ctx.subject}</span></Link>
    <button type="button" data-testid="inbox-return-dismiss" onClick={clearInboxContext} title="Forget the message I came from" className="ml-auto rounded-sm p-0.5 text-ink-400 hover:bg-white hover:text-ink"><X size={12} /></button>
  </div>;
};

// "← Jobs" / "← Estimates" on full pages become one-level Back while an inbox context is active (browser history = the same path back)
export const BackOrList = ({ to, label, testId }: { to: string; label: string; testId?: string }) => {
  const ctx = useInboxContext(); const navigate = useNavigate();
  const cls = 'inline-flex h-8 items-center gap-1 text-xs text-ink-500 hover:text-ink';
  if (ctx) return <button type="button" data-testid={testId ?? 'back-one-level'} data-context={ctx.threadId} onClick={() => navigate(-1)} className={cls}><CornerUpLeft size={12} /> Back</button>;
  return <Link to={to} data-testid={testId} className={cls}><ArrowLeft size={12} /> {label}</Link>;
};
