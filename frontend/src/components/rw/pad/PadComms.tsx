import { Megaphone, Phone, PhoneOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as ic from '@/api/intercom';
import type { IntercomState, PageZone } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { MessageComposer, SentList } from '@/components/layout/MessageComposer';
import { Big } from './PadBits';

const useIntercom = () => { const [s, setS] = useState<IntercomState>(ic.getIntercomState()); useEffect(() => ic.subscribeIntercom(() => setS(ic.getIntercomState())), []); return s; };

// Pad tab "Page / Message" — zone paging (Everyone · WM Room · Front / Floor) + station tap-to-call from the intercom seam, and the one-shot message composer with my Sent list.
export const PadComms = ({ say }: { say: (t: string, tone?: 'ok' | 'learn' | 'err') => void }) => {
  const { user, station } = useAuth(); const s = useIntercom(); const [zone, setZone] = useState<PageZone>('all'); const [text, setText] = useState(''); const [tick, setTick] = useState(0);
  useEffect(() => { if (station) ic.setIntercomMe(station.id); }, [station?.id]);
  const act = (f: () => unknown, okMsg?: string) => { try { f(); if (okMsg) say(okMsg); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  return <div data-testid="pad-comms" className="grid gap-6 lg:grid-cols-2">
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-white"><Megaphone size={20} className="text-amber-400" /> Page <span className="rounded bg-amber-400/15 px-1.5 text-[10px] font-semibold uppercase text-amber-200">MOCK · Daily.co seam</span></h2>
      <p className="mt-1 text-sm text-slate-400">Say it once. Only stations in the zone see the banner.</p>
      <div data-testid="pad-page-zones" className="mt-3 grid grid-cols-3 gap-2">{ic.PAGE_ZONES.map((z) => <button key={z.key} data-testid={`pad-page-zone-${z.key}`} data-selected={zone === z.key} onClick={() => setZone(z.key)} title={z.blurb} className={`min-h-[56px] rounded-2xl border text-base font-semibold ${zone === z.key ? 'border-accent bg-accent/15 text-white' : 'border-white/15 text-slate-200'}`}>{z.label}</button>)}</div>
      <textarea data-testid="pad-page-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What to say…" className="mt-3 w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-slate-500 focus:outline-none" />
      <div className="mt-2 flex flex-wrap gap-1">{ic.PAGE_PRESETS.map((p) => <button key={p} type="button" data-testid="pad-page-preset" onClick={() => setText(p)} className="rounded-full border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/10">{p}</button>)}</div>
      <div className="mt-3"><Big testId="pad-page-send" tone="primary" full onClick={() => act(() => { ic.pageAll(user?.shortName ?? 'Pad', text, zone); setText(''); }, `Paged ${ic.PAGE_ZONES.find((z) => z.key === zone)!.label}`)}><Megaphone size={18} /> Page {ic.PAGE_ZONES.find((z) => z.key === zone)!.label}</Big></div>
      <h3 className="mt-6 flex items-center gap-2 text-base font-semibold text-white"><Phone size={16} /> Tap to call a station</h3>
      {s.call && <div data-testid="pad-ic-call" className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm"><span className="flex-1"><b>{ic.intercomLabel(s.call.to)}</b> · {s.call.state === 'ringing' ? 'ringing…' : 'live'}</span><button data-testid="pad-ic-hangup" onClick={() => act(ic.hangUp)} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white"><PhoneOff size={14} /> Hang up</button></div>}
      <ul data-testid="pad-ic-stations" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{s.stations.filter((st) => !/kiosk/i.test(st.label)).map((st) => <li key={st.id}><button data-testid={`pad-ic-call-${st.id}`} disabled={!st.online || !!s.call} onClick={() => act(() => ic.ring(st.id))} className="flex min-h-[48px] w-full items-center gap-2 rounded-2xl border border-white/15 px-3 text-left text-sm text-slate-200 disabled:opacity-40"><span className={`h-2 w-2 rounded-full ${!st.online ? 'bg-slate-500' : st.busy ? 'bg-amber-400' : 'bg-emerald-400'}`} /><span className="truncate">{st.label}</span></button></li>)}</ul>
    </section>
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-semibold text-white">Send a message</h2>
      <p className="mt-1 text-sm text-slate-400">One shot, directed. Lands on their hitlist. No thread.</p>
      <div className="mt-3"><MessageComposer dark testId="pad-msg" onSent={(l) => { say(l); setTick((t) => t + 1); }} /></div>
      <h3 className="mt-6 text-base font-semibold text-white">Sent</h3>
      <div className="mt-1"><SentList dark tick={tick} testId="pad-sent" /></div>
    </section>
  </div>;
};
