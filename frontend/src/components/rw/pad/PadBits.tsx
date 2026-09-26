import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { fmtMoney } from '@/lib/format';

// Tablet-native primitives for the Supervisor Pad — iOS feel: 44px+ targets, sheets, large titles. Nothing from the desktop shell.
export const Big = ({ children, onClick, tone = 'ghost', testId, disabled, title, type = 'button', full }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger' | 'warn' | 'quiet'; testId: string; disabled?: boolean; title?: string; type?: 'button' | 'submit'; full?: boolean }) => (
  <button type={type} data-testid={testId} onClick={onClick} disabled={disabled} title={title} className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition-transform active:scale-[0.97] disabled:opacity-40 ${full ? 'w-full' : ''} ${tone === 'primary' ? 'bg-amber-400 text-[#161b22]' : tone === 'danger' ? 'bg-rose-600 text-white' : tone === 'warn' ? 'bg-orange-500 text-white' : tone === 'quiet' ? 'bg-white/5 text-slate-200' : 'border border-white/20 text-slate-100'}`}>{children}</button>
);

export const Chip = ({ children, tone = 'neutral', testId, onClick }: { children: ReactNode; tone?: 'neutral' | 'amber' | 'green' | 'blue' | 'rose' | 'violet'; testId?: string; onClick?: () => void }) => {
  const cls = { neutral: 'bg-white/10 text-slate-100', amber: 'bg-amber-400 text-[#161b22]', green: 'bg-emerald-700 text-emerald-50', blue: 'bg-sky-700 text-sky-50', rose: 'bg-rose-700 text-rose-50', violet: 'bg-violet-700 text-violet-50' }[tone];
  const El = onClick ? 'button' : 'span';
  return <El data-testid={testId} onClick={onClick} className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${cls} ${onClick ? 'min-h-[44px] active:scale-95' : ''}`}>{children}</El>;
};

// Bottom sheet — slides up, dims the board, closes on scrim tap or X. Comfortable in both orientations.
export const Sheet = ({ title, sub, onClose, children, testId, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; testId: string; wide?: boolean }) => (
  <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={onClose}>
    <div data-testid={testId} onClick={(e) => e.stopPropagation()} className={`flex max-h-[92vh] w-full flex-col rounded-t-[28px] border border-white/10 bg-[#161b22] text-slate-100 shadow-2xl sm:rounded-[28px] ${wide ? 'sm:max-w-5xl' : 'sm:max-w-2xl'} animate-rise`}>
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
      <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-4"><div><h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>{sub && <div className="mt-0.5 text-sm text-slate-400">{sub}</div>}</div><button data-testid={`${testId}-close`} onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 p-2 text-slate-200"><X size={22} className="mx-auto" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">{children}</div>
    </div>
  </div>
);

export const Price = ({ value, testId }: { value?: number; testId?: string }) => <span data-testid={testId} className={`font-mono text-base ${value === undefined ? 'text-slate-500' : 'text-white'}`}>{value === undefined ? 'no price' : fmtMoney(value)}</span>;

export const Toast = ({ text, tone = 'ok' }: { text: string; tone?: 'ok' | 'learn' | 'err' }) => (
  <div data-testid={`pad-toast-${tone}`} className={`pointer-events-none fixed left-1/2 top-24 z-[80] -translate-x-1/2 rounded-2xl px-5 py-3 text-base font-semibold shadow-2xl animate-rise ${tone === 'learn' ? 'bg-violet-600 text-white' : tone === 'err' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{text}</div>
);

export const STATUS_LABEL: Record<string, string> = { pending_review: 'Pending review', awaiting_client: 'Awaiting client', approved: 'Approved', declined: 'Declined', rejected: 'Declined', on_order: 'On order', received: 'Received', pending: 'Pending', draft: 'Draft' };
export const statusTone = (s: string): 'neutral' | 'amber' | 'green' | 'blue' | 'rose' | 'violet' => (s === 'approved' || s === 'received' ? 'green' : s === 'awaiting_client' ? 'blue' : s === 'pending_review' || s === 'pending' ? 'amber' : s === 'declined' || s === 'rejected' ? 'rose' : s === 'on_order' ? 'violet' : 'neutral');
