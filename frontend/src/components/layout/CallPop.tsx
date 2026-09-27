import { Phone, PhoneIncoming, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScreenPop } from '@/api/client';
import * as tel from '@/api/telephony';
import { useCompanion } from '@/components/companion/CompanionPanel';
import { fullName } from '@/lib/format';

// Dev menu: 📞 Simulate incoming call (MOCK of the Vonage VIP webhook → src/api/telephony.ts)
export const SimulateCallMenu = () => {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button data-testid="dev-simulate-call" onClick={() => setOpen((v) => !v)} title="Simulate incoming call (mock)" className="grid h-8 w-8 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><Phone size={15} /></button>
    {open && <div data-testid="dev-simulate-call-menu" className="absolute right-0 top-9 z-40 w-64 rounded-md border border-line bg-surface p-1 text-xs shadow-pop">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-400">Dev · telephony mock</div>
      <button data-testid="dev-call-known" onClick={() => { setOpen(false); void tel.simulateKnownCall(); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Incoming — known client (Robert Calloway)</button>
      <button data-testid="dev-call-unknown" onClick={() => { setOpen(false); void tel.simulateUnknownCall(); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Incoming — unknown number</button>
    </div>}
  </div>;
};

// Screen-pop toast on RS screens; click → Client 360 + Companion (Job Lookup) pre-loaded with that client
export const CallPopToast = () => {
  const [pop, setPop] = useState<ScreenPop | null>(null); const nav = useNavigate(); const { setOpen } = useCompanion();
  useEffect(() => tel.onScreenPop((p) => { setPop(p); window.setTimeout(() => setPop((cur) => (cur?.callId === p.callId ? null : cur)), 15000); }), []);
  if (!pop) return null;
  return <div data-testid="call-pop" data-kind={pop.kind} className="fixed bottom-5 right-5 z-50 w-[380px] rounded-md border border-line bg-ink text-white shadow-pop animate-rise">
    <div className="flex items-start gap-3 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-moss text-white"><PhoneIncoming size={16} /></span>
      {pop.kind === 'known' ? <button data-testid="call-pop-open" onClick={() => { setPop(null); nav(`/clients/${pop.client.id}`); setOpen(true); }} className="min-w-0 flex-1 text-left">
        <div className="text-[13px] font-semibold">Incoming: {fullName(pop.client)} <span data-testid="call-pop-rating" title={pop.rating.tooltip} className="ml-1 rounded-sm bg-white/15 px-1.5 font-mono text-[11px]">{pop.rating.badge}</span></div>
        <div className="text-[11px] text-white/70">{pop.inService} in service · {pop.needsReply} needs reply · {pop.client.phone} — tap to open Job Lookup</div>
      </button> : <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">Unknown caller ({pop.number})</div>
        <button data-testid="call-pop-new-client" onClick={() => { setPop(null); nav(`/clients?new=1&phone=${encodeURIComponent(pop.number)}`); }} className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-white px-2 py-1 text-[11px] font-semibold text-ink"><UserPlus size={12} /> New client / new request</button>
      </div>}
      <button data-testid="call-pop-dismiss" onClick={() => setPop(null)} className="p-1 text-white/60 hover:text-white"><X size={14} /></button>
    </div>
  </div>;
};
