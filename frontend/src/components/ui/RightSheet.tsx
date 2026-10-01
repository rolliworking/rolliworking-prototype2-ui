import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

// Right-edge slide-out — the same shell as the Concierge / Hitlist panel: one third of the screen on desktop (page stays visible), full-width sheet on a pad. Esc closes.
export const RightSheet = ({ title, onClose, children, testId, pad, kind, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; testId: string; pad?: boolean; kind?: string; footer?: ReactNode }) => {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <aside data-testid={testId} data-kind={kind} className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-canvas shadow-2xl ${pad ? '' : 'lg:w-1/3 lg:min-w-[520px]'}`} style={{ animation: 'sheetIn 200ms ease-out' }}>
    <style>{`@keyframes sheetIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3"><h2 data-testid={`${testId}-title`} className="min-w-0 flex-1 text-sm font-semibold text-ink">{title}</h2><button type="button" data-testid={`${testId}-close`} onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><X size={16} /></button></header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">{children}</div>
    {footer && <footer className="border-t border-line bg-surface p-3">{footer}</footer>}
  </aside>;
};
