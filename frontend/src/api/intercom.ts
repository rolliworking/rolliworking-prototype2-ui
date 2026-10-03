// Station intercom + storewide paging — MOCK state. Voice-only by design (no video). Tap a station → it "rings" → live → hang up.
// TODO(Daily.co): replace `ring`/`hangUp`/`pageAll` internals with a Daily room per station pair (audio-only tracks) + a broadcast room for paging. Keep this API surface.
import { stations } from './fixtures/stations';
import type { Division, IntercomCall, IntercomPreset, IntercomState, IntercomStation, PageZone, StorePage } from './types';

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

let timer: number | undefined; const joinTimers: number[] = [];
const clearTimers = () => { window.clearTimeout(timer); joinTimers.splice(0).forEach((t) => window.clearTimeout(t)); };
// Ring one station (tap) or many (select mode / preset) — one call, one audio room; anyone who answers joins. Offline / busy targets are skipped, never fatal unless nobody can ring.
export const ring = (to: string | string[]): IntercomCall => {
  if (state.call && state.call.state !== 'ended') throw new Error('Already on a call — hang up first');
  const ids = Array.from(new Set((Array.isArray(to) ? to : [to]).filter((id) => id !== state.me))); if (!ids.length) throw new Error('Pick at least one station');
  const all = allStations(); const targets: string[] = []; const skipped: string[] = [];
  for (const id of ids) { const t = all.find((s) => s.id === id); if (!t) throw new Error('Unknown station'); if (!t.online) { if (ids.length === 1) throw new Error(`${t.label} is offline`); skipped.push(id); continue; } if (t.busy) { if (ids.length === 1) throw new Error(`${t.label} is on another call`); skipped.push(id); continue; } targets.push(id); }
  if (!targets.length) throw new Error('Nobody selected can be rung right now (offline or busy)');
  const call: IntercomCall = { id: `ic-${Date.now().toString(36)}`, from: state.me, to: targets[0], targets, joined: [], skipped, startedAt: new Date().toISOString(), state: 'ringing' };
  state.call = call; targets.forEach((t) => state.busy.add(t)); emit();
  // MOCK answer pattern: first pickup after 1.4 s makes the room live; the rest trickle in (group call = "anyone who answers joins")
  timer = window.setTimeout(() => { if (state.call?.id !== call.id) return; state.call = { ...state.call, state: 'live', joined: [targets[0]] }; emit(); targets.slice(1).forEach((t, i) => joinTimers.push(window.setTimeout(() => { if (state.call?.id === call.id && !state.call.joined.includes(t)) { state.call = { ...state.call, joined: [...state.call.joined, t] }; emit(); } }, 900 * (i + 1)))); }, 1400);
  return call;
};
export const hangUp = () => { if (!state.call) return; clearTimers(); const ended: IntercomCall = { ...state.call, state: 'ended', endedAt: new Date().toISOString() }; state.history.unshift(ended); ended.targets.forEach((t) => state.busy.delete(t)); state.call = undefined; emit(); };
export const isGroupCall = (c: IntercomCall) => c.targets.length > 1;
// Banner text the rung stations see: "Group call from Front Desk 1 · 3 stations"
export const callBanner = (c: IntercomCall) => (isGroupCall(c) ? `Group call from ${intercomLabel(c.from)} · ${c.targets.length} stations` : `Call from ${intercomLabel(c.from)}`);
export const callTargetsLabel = (c: IntercomCall) => c.targets.map(intercomLabel).join(', ');

// Saved selections (presets row above the grid) — editable in Setup → Stations → Intercom presets; stored as data, not literals
const PRESET_KEY = 'rollisuite.intercom.presets.v1';
const PRESET_SEED: IntercomPreset[] = [
  { key: 'all_wm', label: 'All WM benches', stationIds: Array.from({ length: 8 }, (_, i) => `st-wm${i + 1}`), system: true },
  { key: 'front', label: 'Front desk', stationIds: ['st-01', 'st-02'], system: true },
  { key: 'supervisors', label: 'Supervisors', stationIds: ['ic-pad-wm', 'ic-pad-band'], system: true },
];
let presets: IntercomPreset[] = (() => { try { const v = localStorage.getItem(PRESET_KEY); return v ? (JSON.parse(v) as IntercomPreset[]) : PRESET_SEED.map((p) => ({ ...p, stationIds: [...p.stationIds] })); } catch { return PRESET_SEED.map((p) => ({ ...p, stationIds: [...p.stationIds] })); } })();
export const getIntercomPresets = (): IntercomPreset[] => presets.map((p) => ({ ...p, stationIds: [...p.stationIds] }));
export const saveIntercomPreset = (input: { key?: string; label: string; stationIds: string[] }): IntercomPreset => {
  const label = input.label.trim(); if (!label) throw new Error('Preset name is required'); if (!input.stationIds.length) throw new Error('Pick at least one station');
  const key = input.key ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); if (!input.key && presets.some((p) => p.key === key)) throw new Error('A preset with that name already exists');
  const existing = presets.find((p) => p.key === key); const p: IntercomPreset = { ...(existing ?? { key }), label, stationIds: Array.from(new Set(input.stationIds)) };
  presets = existing ? presets.map((x) => (x.key === key ? p : x)) : [...presets, p]; localStorage.setItem(PRESET_KEY, JSON.stringify(presets)); emit(); return { ...p };
};
export const deleteIntercomPreset = (key: string) => { const p = presets.find((x) => x.key === key); if (!p) return; if (p.system) throw new Error('Built-in presets can be edited, not removed'); presets = presets.filter((x) => x.key !== key); localStorage.setItem(PRESET_KEY, JSON.stringify(presets)); emit(); };
// Every ringable target for preset editing (own station included — a preset is shop-wide, the caller is dropped at ring time)
export const presetTargets = (): IntercomStation[] => allStations().filter((s) => !/kiosk|camera/i.test(s.label));
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
