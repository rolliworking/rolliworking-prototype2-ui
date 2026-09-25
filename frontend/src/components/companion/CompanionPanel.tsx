import { Bot, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Tabs } from '@/components/rs/RsBits';
import { AskTab, ClientTab, LabelsTab, PriceTab } from './CompanionTabs';

export interface CompanionContext { clientId?: string; jobId?: string; estimateId?: string }
interface Ctx { open: boolean; toggle: () => void; setOpen: (v: boolean) => void }
const C = createContext<Ctx | null>(null);
export const useCompanion = () => { const c = useContext(C); if (!c) throw new Error('useCompanion outside provider'); return c; };

export const CompanionProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); toggle(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [toggle]);
  return <C.Provider value={{ open, toggle, setOpen }}>{children}</C.Provider>;
};

export function CompanionDock() {
  const { open, setOpen } = useCompanion();
  const { user } = useAuth();
  const loc = useLocation();
  const [ctx, setCtx] = useState<CompanionContext>({});
  const route = useMemo(() => ({ client: matchPath('/clients/:id', loc.pathname)?.params.id, job: matchPath('/jobs/:id', loc.pathname)?.params.id, estimate: matchPath('/estimates/:id', loc.pathname)?.params.id }), [loc.pathname]);
  useEffect(() => {
    let live = true;
    (async () => {
      if (route.job && route.job !== 'new') { const j = await api.getJob(route.job); if (live) setCtx({ jobId: j?.id, clientId: j?.clientId }); }
      else if (route.estimate && route.estimate !== 'new') { const e = await api.getEstimate(route.estimate); if (live) setCtx({ estimateId: e?.id, clientId: e?.clientId }); }
      else if (live) setCtx({ clientId: route.client });
    })();
    return () => { live = false; };
  }, [route.client, route.job, route.estimate]);
  const [tab, setTab] = useState('price');
  useEffect(() => { if (ctx.jobId) setTab('labels'); else if (ctx.clientId) setTab('client'); }, [ctx.jobId, ctx.clientId]);
  if (!open || !user) return null;
  const manager = user.accessTier === 'manager';
  const division = api.getSessionDivision();
  return (
    <aside data-testid="companion-panel" className="flex w-[400px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Bot size={15} /> Companion <span className="text-[10px] font-normal text-ink-400">M3KE front door · Alt+M</span></div>
        <button data-testid="companion-close" onClick={() => setOpen(false)} className="rounded p-1 text-ink-400 hover:bg-canvas hover:text-ink"><X size={14} /></button>
      </div>
      <div data-testid="companion-scripted-banner" className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 text-[11px] text-amber-800"><Provisional note="Scripted assistant — every answer is computed from fixtures; no model is called" /> scripted assistant · {division} · {user.accessTier} tier{!manager && <span data-testid="companion-money-hidden" className="ml-1 rounded bg-amber-100 px-1">money hidden (MH ruling pending)</span>}</div>
      <div className="px-3 pt-2"><Tabs prefix="companion" active={tab} onChange={setTab} tabs={[{ key: 'price', label: 'Price memory' }, { key: 'client', label: 'Client brief' }, { key: 'ask', label: 'Ask the shop' }, { key: 'labels', label: 'Photo labels' }]} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-xs">
        {tab === 'price' && <PriceTab manager={manager} />}
        {tab === 'client' && <ClientTab clientId={ctx.clientId} />}
        {tab === 'ask' && <AskTab manager={manager} />}
        {tab === 'labels' && <LabelsTab jobId={ctx.jobId} />}
      </div>
    </aside>
  );
}
