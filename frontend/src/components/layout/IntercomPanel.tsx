import { Megaphone, Phone, PhoneOff, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as ic from '@/api/intercom';
import type { IntercomState, PageZone } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';

const useIntercom = () => { const [s, setS] = useState<IntercomState>(ic.getIntercomState()); useEffect(() => ic.subscribeIntercom(() => setS(ic.getIntercomState())), []); return s; };

// Voice-only station intercom: tap a station to call, one live call at a time, plus storewide paging. MOCK — see api/intercom.ts (Daily.co seam).
export const IntercomButton = ({ dark }: { dark?: boolean }) => {
  const { user, station } = useAuth(); const s = useIntercom(); const [open, setOpen] = useState(false); const [page, setPage] = useState(''); const [zone, setZone] = useState<PageZone>('all'); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (station) ic.setIntercomMe(station.id); }, [station?.id]);
  const btn = dark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-line bg-canvas text-ink-500 hover:border-ink-400 hover:text-ink';
  const act = (f: () => unknown) => { try { setErr(null); f(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <>
    <button type="button" data-testid="intercom-btn" title="Station intercom · paging" onClick={() => setOpen(!open)} className={`relative flex h-7 items-center gap-1 rounded-sm border px-1.5 text-[11px] ${btn} ${s.call ? '!border-emerald-500 !text-emerald-600' : ''}`}><Phone size={13} />{s.call && <span data-testid="intercom-live-dot" className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}</button>
    {open && createPortal(<div data-testid="intercom-panel" className="fixed right-3 top-12 z-[80] w-[340px] rounded-md border border-line bg-surface p-3 text-ink shadow-xl">
      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">Intercom <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">MOCK · voice only</span></span><button data-testid="intercom-close" onClick={() => setOpen(false)} className="text-xs text-ink-400 hover:text-ink">close</button></div>
      <p className="mt-0.5 text-[11px] text-ink-500">From <b>{ic.intercomLabel(s.me)}</b> · tap a station to talk. Daily.co audio rooms replace this in Keeper.</p>
      {s.call && <div data-testid="intercom-call" className="mt-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs"><Radio size={13} className={s.call.state === 'ringing' ? 'animate-pulse text-amber-600' : 'text-emerald-600'} /><span className="flex-1"><b>{ic.intercomLabel(s.call.to)}</b> · <span data-testid="intercom-call-state">{s.call.state === 'ringing' ? 'ringing…' : 'live'}</span></span><button data-testid="intercom-hangup" onClick={() => act(ic.hangUp)} className="inline-flex items-center gap-1 rounded-sm bg-rose-600 px-2 py-0.5 font-semibold text-white"><PhoneOff size={11} /> Hang up</button></div>}
      <ul data-testid="intercom-stations" className="mt-2 grid grid-cols-2 gap-1">{s.stations.map((st) => <li key={st.id}><button data-testid={`intercom-call-${st.id}`} disabled={!st.online || !!s.call} onClick={() => act(() => ic.ring(st.id))} className="flex w-full items-center gap-1.5 rounded-sm border border-line px-2 py-1.5 text-left text-[11px] hover:bg-canvas disabled:opacity-40"><span className={`h-1.5 w-1.5 rounded-full ${!st.online ? 'bg-ink-300' : st.busy ? 'bg-amber-500' : 'bg-emerald-500'}`} /><span className="flex-1 truncate">{st.label}</span><span className="text-[9px] uppercase text-ink-400">{st.kind}</span></button></li>)}</ul>
      <form className="mt-3 border-t border-line pt-2" onSubmit={(e) => { e.preventDefault(); act(() => { ic.pageAll(user?.shortName ?? 'Front desk', page, zone); setPage(''); }); }}>
        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold"><Megaphone size={12} /> Page <span className="font-normal text-ink-400">— zone</span></div>
        <div data-testid="intercom-page-zones" className="mb-1.5 flex gap-1">{ic.PAGE_ZONES.map((z) => <button key={z.key} type="button" data-testid={`intercom-zone-${z.key}`} data-selected={zone === z.key} title={z.blurb} onClick={() => setZone(z.key)} className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium ${zone === z.key ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas'}`}>{z.label}</button>)}</div>
        <div className="flex gap-1"><input data-testid="intercom-page-input" value={page} onChange={(e) => setPage(e.target.value)} placeholder={zone === 'all' ? 'Say it once, everywhere…' : `Say it once — ${ic.PAGE_ZONES.find((z) => z.key === zone)!.label} only…`} className="h-7 flex-1 rounded-sm border border-line bg-surface px-2 text-xs" /><button data-testid="intercom-page-send" className="h-7 rounded-sm bg-ink px-2 text-xs font-semibold text-white">Page</button></div>
        <div className="mt-1 flex flex-wrap gap-1">{ic.PAGE_PRESETS.map((p) => <button key={p} type="button" data-testid="intercom-page-preset" onClick={() => setPage(p)} className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-ink-600 hover:bg-canvas">{p}</button>)}</div>
      </form>
      {err && <p data-testid="intercom-error" className="mt-2 text-[11px] text-rose-700">{err}</p>}
      {s.history.length > 0 && <div className="mt-2 text-[10px] text-ink-400">Last: {ic.intercomLabel(s.history[0].to)} · {Math.max(1, Math.round((new Date(s.history[0].endedAt!).getTime() - new Date(s.history[0].startedAt).getTime()) / 1000))}s</div>}
    </div>, document.body)}
    <PageOverlay s={s} />
  </>;
};

// Paging banner — shows on every station the page targets (zone rule in api/intercom.ts). Mounted by IntercomButton and standalone (`PageBanner`) on fullscreen pads / benches.
const PageOverlay = ({ s }: { s: IntercomState }) => { const mine = s.pages.filter(ic.pageTargetsMe); return mine.length ? createPortal(<div data-testid="intercom-page-overlay" className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center p-2">{mine.slice(0, 1).map((p) => <div key={p.id} data-zone={p.zone} className="flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-white shadow-xl"><Megaphone size={16} className="text-amber-400" /><span><b>{p.by}</b> · {ic.intercomLabel(p.from)} → <span data-testid="intercom-page-zone-label" className="rounded bg-amber-400/20 px-1 text-[11px] font-semibold uppercase text-amber-200">{ic.PAGE_ZONES.find((z) => z.key === p.zone)?.label}</span>: “{p.text}”</span></div>)}</div>, document.body) : null; };
export const PageBanner = () => { const { station } = useAuth(); const s = useIntercom(); useEffect(() => { if (station) ic.setIntercomMe(station.id); }, [station?.id]); return <PageOverlay s={s} />; };
