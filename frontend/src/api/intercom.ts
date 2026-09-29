// Station intercom + storewide paging — MOCK state. Voice-only by design (no video). Tap a station → it "rings" → live → hang up.
// TODO(Daily.co): replace `ring`/`hangUp`/`pageAll` internals with a Daily room per station pair (audio-only tracks) + a broadcast room for paging. Keep this API surface.
import { stations } from './fixtures/stations';
import type { Division, IntercomCall, IntercomState, IntercomStation, PageZone, StorePage } from './types';

const ROOMS: IntercomStation[] = [
  { id: 'ic-wm', label: 'Watchmaker Room', kind: 'room', division: 'rolliworks', online: true, busy: false },
  { id: 'ic-band', label: 'Band / Polish Room', kind: 'room', division: 'rolliworks', online: true, busy: false },
  { id: 'ic-pad-wm', label: 'WM Supervisor Pad', kind: 'pad', division: 'rolliworks', online: true, busy: false },
  { id: 'ic-pad-band', label: 'Band Room Pad', kind: 'pad', division: 'rolliworks', online: false, busy: false },
];
const state: { me: string; call?: IntercomCall; pages: StorePage[]; pageLog: StorePage[]; history: IntercomCall[]; busy: Set<string> } = { me: 'st-01', pages: [], pageLog: [], history: [], busy: new Set() };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const subscribeIntercom = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const setIntercomMe = (id: string) => { state.me = id; emit(); };

const allStations = (): IntercomStation[] => [...stations.filter((s) => s.id !== 'st-rs').map((s) => ({ id: s.id, label: s.name, kind: 'station' as const, division: s.division as Division, online: true, busy: state.busy.has(s.id) })), ...ROOMS.map((r) => ({ ...r, busy: state.busy.has(r.id) }))];
export const getIntercomState = (): IntercomState => ({ me: state.me, stations: allStations().filter((s) => s.id !== state.me), call: state.call, pages: [...state.pages], history: [...state.history] });
export const intercomLabel = (id: string) => allStations().find((s) => s.id === id)?.label ?? id;

let timer: number | undefined;
export const ring = (to: string): IntercomCall => {
  if (state.call && state.call.state !== 'ended') throw new Error('Already on a call — hang up first');
  const target = allStations().find((s) => s.id === to); if (!target) throw new Error('Unknown station'); if (!target.online) throw new Error(`${target.label} is offline`); if (target.busy) throw new Error(`${target.label} is on another call`);
  const call: IntercomCall = { id: `ic-${Date.now().toString(36)}`, from: state.me, to, startedAt: new Date().toISOString(), state: 'ringing' };
  state.call = call; state.busy.add(to); emit();
  timer = window.setTimeout(() => { if (state.call?.id === call.id) { state.call = { ...call, state: 'live' }; emit(); } }, 1400);
  return call;
};
export const hangUp = () => { if (!state.call) return; window.clearTimeout(timer); const ended: IntercomCall = { ...state.call, state: 'ended', endedAt: new Date().toISOString() }; state.history.unshift(ended); state.busy.delete(ended.to); state.call = undefined; emit(); };
// Paging zones — Everyone, WM Room (benches, WM pads, kiosk), Front / Floor (desks, inspection, shipping, band room). A page shows ONLY on stations in the zone.
export const PAGE_ZONES: { key: PageZone; label: string; blurb: string }[] = [
  { key: 'all', label: 'Everyone', blurb: 'Every station and pad in the shop' },
  { key: 'wm', label: 'WM Room', blurb: 'Watchmaker Room, WM 1–8 bench pads, WM supervisor pad, WM kiosk' },
  { key: 'front', label: 'Front / Floor', blurb: 'Front desks, inspection bench, shipping, band / polish room + pad' },
];
export const zoneOfStation = (id: string): Exclude<PageZone, 'all'> => (/^st-wm\d|st-kiosk-wm|ic-wm|ic-pad-wm/.test(id) || /watchmaker room/i.test(intercomLabel(id)) ? 'wm' : 'front');
export const pageAll = (by: string, text: string, zone: PageZone = 'all', division: Division | 'all' = 'all'): StorePage => { if (!text.trim()) throw new Error('Say something'); const p: StorePage = { id: `pg-${Date.now().toString(36)}`, by, from: state.me, text: text.trim(), at: new Date().toISOString(), division, zone }; state.pages.unshift(p); state.pageLog.unshift(p); emit(); window.setTimeout(() => { state.pages = state.pages.filter((x) => x.id !== p.id); emit(); }, 8000); return p; };
// Banner rule: my station sees a page when it targets everyone or my zone
export const pageTargetsMe = (p: StorePage) => p.zone === 'all' || p.zone === zoneOfStation(state.me);
export const getPageLog = () => [...state.pageLog];
export const PAGE_PRESETS = ['MH to the front desk, please', 'Pickup waiting at Front Desk 1', 'Client on line 2 for the Watchmaker Room', 'Shipping cut-off in 15 minutes', 'Band Room: part arrived at Picking'];
