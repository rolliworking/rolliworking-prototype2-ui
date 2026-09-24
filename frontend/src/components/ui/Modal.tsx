import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export const Modal = ({ children, onClose, testId, width = 'w-[560px]', title }: { children: ReactNode; onClose: () => void; testId: string; width?: string; title?: string }) => (
  <div data-testid={testId} className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6" onClick={onClose}>
    <div className={`${width} max-h-[90vh] overflow-y-auto rounded-md bg-surface shadow-pop animate-rise`} onClick={(e) => e.stopPropagation()}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="text-[14px] font-semibold text-ink">{title}</div>
          <button type="button" data-testid={`${testId}-close`} onClick={onClose} className="text-ink-500 hover:text-ink"><X size={14} /></button>
        </div>
      )}
      {children}
    </div>
  </div>
);
