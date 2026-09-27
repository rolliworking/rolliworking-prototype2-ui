import type { Division, NfcTag, Punch, PunchFlag } from '../types';

// Physical NFC tags / stations at fixed locations. Each tag is written with the URL below; tapping a phone opens /rg/clock?station=<id>.
export const nfcTags: NfcTag[] = [
  { id: 'door-main', label: 'Main door', division: 'rolliworks', url: '/rg/clock?station=door-main' },
  { id: 'tag-fd-rw', label: 'Front Desk — Rolliworks', division: 'rolliworks', url: '/rg/clock?station=tag-fd-rw' },
  { id: 'tag-rs-counter', label: 'RS Counter', division: 'rollishop', url: '/rg/clock?station=tag-rs-counter' },
];

const stamp = (daysBack: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() - daysBack); d.setHours(h, m, 0, 0); return d.toISOString(); };
const tagOf = (id: string) => nfcTags.find((t) => t.id === id)!;

type Shift = [userId: string, tagId: string, inH: number, inM: number, outH: number | null, outM: number];

// Two weeks of realistic punches for 5 staff. Sunday is closed; walter also takes Saturdays off.
export const punches: Punch[] = [];
let seq = 0;
const push = (daysBack: number, s: Shift, extra: { inFlags?: PunchFlag[]; inGeo?: Punch['geo']; inRecordedAt?: string } = {}) => {
  const tag = tagOf(s[1]);
  const base = { userId: s[0], tagId: tag.id, location: tag.label, division: tag.division, simulated: false, source: 'seed' as const };
  punches.push({ id: `pu-${String(++seq).padStart(3, '0')}`, kind: 'in', at: stamp(daysBack, s[2], s[3]), ...base, flags: extra.inFlags, geo: extra.inGeo, recordedAt: extra.inRecordedAt });
  if (s[4] !== null) punches.push({ id: `pu-${String(++seq).padStart(3, '0')}`, kind: 'out', at: stamp(daysBack, s[4], s[5]), ...base });
};

for (let back = 14; back >= 1; back--) {
  const dow = new Date(stamp(back, 12, 0)).getDay();
  if (dow === 0) continue;
  const jitter = (back * 7) % 11;
  push(back, ['u-vienna', 'door-main', 8, 40 + (jitter % 9), 17, 5 + jitter]);
  // MM: one punch that reached the server 40 minutes late (no signal at the door)
  push(back, ['u-mm', 'door-main', 8, 2 + (jitter % 6), 17, 30 + (jitter % 15)], back === 5 ? { inFlags: ['synced_late'], inRecordedAt: stamp(5, 8, 42 + (jitter % 6)) } : {});
  // Rosa: one clock-in from 2.3 km away (flagged offsite, never rejected)
  push(back, ['u-rosa', 'door-main', 8, 12 + (jitter % 7), 17, 0 + (jitter % 9)], back === 3 ? { inFlags: ['offsite'], inGeo: { lat: 40.7794, lng: -73.9632, distanceM: 2_340 } } : {});
  // Walter: forgot to clock out two days ago (missed clock-out → manager resolves)
  if (dow !== 6) push(back, ['u-walter', 'tag-rs-counter', 9, 55 + (jitter % 5), back === 2 ? null : 18, 0 + jitter]);
  // michael splits his week: RS Counter on Tue/Thu, Front Desk otherwise; lunch punch-out on Fridays
  if (dow === 2 || dow === 4) push(back, ['u-michael', 'tag-rs-counter', 9, 30 + (jitter % 7), 18, 10 + (jitter % 9)]);
  else if (dow === 5) { push(back, ['u-michael', 'tag-fd-rw', 8, 25 + (jitter % 8), 12, 30]); push(back, ['u-michael', 'tag-fd-rw', 13, 15, 17, 45 + (jitter % 10)]); }
  else push(back, ['u-michael', 'tag-fd-rw', 8, 25 + (jitter % 8), 17, 40 + (jitter % 12)]);
}
// Correction: Vienna's clock-out 6 days ago was 17:05 on the tag; MH corrected it to 18:30 (late pickup). Original row stays, superseded.
const vOut = punches.find((p) => p.userId === 'u-vienna' && p.kind === 'out' && new Date(p.at).getDate() === new Date(stamp(6, 12, 0)).getDate());
if (vOut) punches.push({ id: 'pu-corr-01', userId: 'u-vienna', kind: 'out', at: stamp(6, 18, 30), tagId: 'door-main', location: 'Main door', division: 'rolliworks', simulated: false, source: 'manager', flags: ['correction'], correctionOf: vOut.id, reason: 'Stayed for a late client pickup — forgot to punch out', by: 'MH', recordedAt: stamp(5, 9, 10) });

// Today (only the punches that already happened by the seeded clock — open shifts stay open)
const nowH = new Date().getHours();
if (nowH >= 8) push(0, ['u-mm', 'door-main', 8, 5, null, 0]);
if (nowH >= 8) push(0, ['u-michael', 'tag-fd-rw', 8, 32, nowH >= 13 ? 12 : null, 30]);
if (nowH >= 13) push(0, ['u-michael', 'tag-fd-rw', 13, 15, null, 0]);
if (nowH >= 9) push(0, ['u-vienna', 'door-main', 8, 45, null, 0]);
if (nowH >= 10) push(0, ['u-walter', 'tag-rs-counter', 9, 58, null, 0]);

export const RG_DIVISION_LABEL: Record<Division, string> = { rolliworks: 'Rolliworks', rollishop: 'RolliShop' };
