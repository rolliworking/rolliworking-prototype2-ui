import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Tiny app-wide toaster — warnings persist (8s) and must be seen, but never block the workflow
interface ToastItem { id: number; text: string; tone: 'warn' | 'info' }
type Listener = (t: ToastItem) => void;
let seq = 0; const listeners = new Set<Listener>();
export const toast = { warn: (text: string) => listeners.forEach((l) => l({ id: ++seq, text, tone: 'warn' })), info: (text: string) => listeners.forEach((l) => l({ id: ++seq, text, tone: 'info' })) };

export const ToastHost = () => {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => { const l: Listener = (t) => { setItems((v) => [...v.filter((x) => x.text !== t.text), t]); window.setTimeout(() => setItems((v) => v.filter((x) => x.id !== t.id)), t.tone === 'warn' ? 8000 : 4000); }; listeners.add(l); return () => { listeners.delete(l); }; }, []);
  if (!items.length) return null;
  return <div data-testid="toast-host" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2">
    {items.map((t) => <div key={t.id} role="alert" data-testid={`toast-${t.tone}`} className={`pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-[13px] shadow-xl animate-rise ${t.tone === 'warn' ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-line bg-surface text-ink'}`}>
      {t.tone === 'warn' && <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />}<span data-testid="toast-text" className="font-medium">{t.text}</span>
      <button type="button" data-testid="toast-dismiss" onClick={() => setItems((v) => v.filter((x) => x.id !== t.id))} className="ml-1 shrink-0 text-current/60 hover:text-current"><X size={14} /></button>
    </div>)}
  </div>;
};
