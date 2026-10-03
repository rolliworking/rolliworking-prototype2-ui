import type { AuditLocation, AuditSession, ClientRequest, ComponentKey, JobPhotoView, PartStatus, PickTask, RwStation, RwStationKey } from '../types';
import { daysAgo } from './time';

export const RW_STATIONS: RwStation[] = [
  // WATCH track — Assign watchmaker → Uncase → [manager safe] → Assign refinisher (shared Polish leg) → [manager safe] → Movement service → Parts approval → Recase + test → [manager safe] → Final assembly
  { key: 'pre_approval', label: 'Pre-approval', lane: 'head', order: 0 },
  { key: 'pre_queue', label: 'Pre-queue', lane: 'head', order: 1 },
  { key: 'wm_bench_1', label: 'WM Bench 1', lane: 'head', order: 2 },
  { key: 'wm_bench_2', label: 'WM Bench 2', lane: 'head', order: 3 },
  { key: 'wm_bench_3', label: 'WM Bench 3', lane: 'head', order: 4 },
  { key: 'uncase', label: 'Uncase', lane: 'head', order: 5 },
  { key: 'mgr_safe_polish_in', label: 'Manager safe · to polisher', lane: 'head', order: 6 },
  { key: 'polish_room', label: 'Assign refinisher', lane: 'shared', order: 7 },
  { key: 'mgr_safe_polish_out', label: 'Manager safe · back to WM', lane: 'head', order: 8 },
  { key: 'movement_service', label: 'Movement service', lane: 'head', order: 9 },
  { key: 'parts_approval', label: 'Parts approval', lane: 'head', order: 10 },
  { key: 'recase_test', label: 'Recase + test', lane: 'head', order: 11 },
  { key: 'into_safe_head', label: 'Into safe', lane: 'head', order: 12 },
  { key: 'safe_await_band', label: 'Safe (await band)', lane: 'head', order: 12 },
  // BRACELET track (split jobs only) — Assign band tech → [manager safe] → Assign refinisher → [manager safe] → QC inspect → [manager safe] → Final assembly
  { key: 'band_pre_queue', label: 'Pre-queue', lane: 'band', order: 1 },
  { key: 'band_assign', label: 'Assign band tech', lane: 'band', order: 2 },
  { key: 'band_mgr_safe_in', label: 'Manager safe · to refinisher', lane: 'band', order: 3 },
  { key: 'refinish', label: 'Assign refinisher', lane: 'band', order: 4 },
  { key: 'band_mgr_safe_out', label: 'Manager safe · back to band tech', lane: 'band', order: 5 },
  { key: 'band_qc', label: 'QC inspect', lane: 'band', order: 6 },
  { key: 'into_safe_band', label: 'Into safe', lane: 'band', order: 7 },
  { key: 'safe_await_head', label: 'Safe (await head)', lane: 'band', order: 7 },
  // JV bin — a container in the custody model: overnight in Vienna's safe, by day at JV's bench (both shared-lane so bracelets and cases ride together)
  { key: 'vc_safe', label: "Vienna's safe (VC)", lane: 'shared', order: 1 },
  { key: 'jv_bench', label: "JV's bench", lane: 'shared', order: 2 },
  // Long-term storage safe (MH 2026-10-02) — unpaid finished jobs past the Setup threshold; custody root VC; scan-only in and out
  { key: 'lts_safe', label: 'Long-term storage', lane: 'shared', order: 3 },
  // Front desk safe (2026-10-02) — physical safe at reception; a tray node under the FD safe container (Setup → Containers)
  { key: 'fd_safe', label: 'Front desk safe', lane: 'shared', order: 4 },
  // Main safe general tray (D-425) — where "Move…" from the Safes card lands finished / overflow pieces; a tray node under the Main safe container
  { key: 'main_safe', label: 'Main safe', lane: 'shared', order: 5 },
  { key: 'final_assembly', label: 'Final assembly', lane: 'shared', order: 13 },
  { key: 'testing', label: 'Testing', lane: 'shared', order: 14 },
  { key: 'finished', label: 'Finished', lane: 'shared', order: 15 },
];

// Saved part positions (precedence 1). Parts not listed derive from job status + department.
export const partSeeds: Record<string, Partial<Record<ComponentKey, { station: RwStationKey; status: PartStatus; tech?: string; item?: string; bin?: string; binOrigin?: string; done?: boolean }>>> = {
  // Portal dots seed — Eleanor's Submariner: head on the bench · bracelet at the band bench under a scoped parts hold · case refinished, waiting in the safe for the head
  'j-pd1': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'Leo' }, band: { station: 'band_assign', status: 'in_progress', tech: 'Sam' }, case: { station: 'safe_await_head', status: 'waiting', tech: 'Vienna', done: true } },
  // Inbox job-card seed — Rebecca Halloran's GMT: head on the bench (green) · bracelet under a scoped parts hold (red) · case refinished, waiting in the safe (blue)
  'j-ib1': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'Leo' }, band: { station: 'band_assign', status: 'in_progress', tech: 'Sam' }, case: { station: 'safe_await_head', status: 'waiting', tech: 'Vienna', done: true } },
  // JV bin seeds — 9 tickets assigned to the bin: 6 inside (bin at JV's bench this morning), 3 handed out to Dre / Sam / Nico
  'j-b1': { band: { station: 'jv_bench', status: 'in_progress', tech: 'JV', bin: 'jv_bin' } },
  'j-b2': { band: { station: 'jv_bench', status: 'in_progress', tech: 'JV', bin: 'jv_bin' } },
  'j-b3': { case: { station: 'jv_bench', status: 'in_progress', tech: 'JV', bin: 'jv_bin' } },
  'j-b4': { band: { station: 'jv_bench', status: 'in_progress', tech: 'JV', bin: 'jv_bin' } },
  'j-b5': { case: { station: 'jv_bench', status: 'in_progress', tech: 'JV', bin: 'jv_bin' } },
  'j-b6': { band: { station: 'jv_bench', status: 'in_progress', tech: 'JV', bin: 'jv_bin' } },
  'j-b7': { case: { station: 'polish_room', status: 'in_progress', tech: 'Dre', binOrigin: 'jv_bin' } },
  'j-b8': { band: { station: 'band_assign', status: 'in_progress', tech: 'Sam', binOrigin: 'jv_bin' } },
  'j-b9': { band: { station: 'band_assign', status: 'in_progress', tech: 'Nico', binOrigin: 'jv_bin' } },
  // Job detail v2 demo seeds — multi-item job (1/3 · 2/3 · 3/3, head finished) and an outsourced head at James, delayed
  'j-mi1': { head: { station: 'safe_await_band', status: 'waiting', tech: 'Leo', item: '1/3' }, band: { station: 'band_assign', status: 'in_progress', tech: 'MAM', item: '2/3' }, case: { station: 'mgr_safe_polish_in', status: 'waiting', tech: 'Vienna', item: '3/3' } },
  'j-os1': { head: { station: 'wm_bench_3', status: 'in_progress', tech: 'Leo' } },
  'j-01': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'Leo' } },
  'j-04': { head: { station: 'wm_bench_2', status: 'in_progress', tech: 'Leo' } },
  'j-24': { head: { station: 'wm_bench_3', status: 'in_progress', tech: 'Leo' } },
  'j-03': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'Leo' }, case: { station: 'safe_await_head', status: 'waiting', tech: 'Walter' } },
  'j-06': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'Leo' }, case: { station: 'mgr_safe_polish_in', status: 'waiting', tech: 'Vienna' } },
  'j-17': { case: { station: 'polish_room', status: 'in_progress', tech: 'Walter' } },
  'j-30': { head: { station: 'wm_bench_2', status: 'in_progress', tech: 'Leo' }, case: { station: 'mgr_safe_polish_out', status: 'waiting', tech: 'Vienna' }, band: { station: 'band_mgr_safe_in', status: 'waiting', tech: 'JV' } },
  'j-32': { head: { station: 'safe_await_band', status: 'waiting', tech: 'Leo' }, case: { station: 'safe_await_band', status: 'waiting', tech: 'Walter' }, band: { station: 'safe_await_head', status: 'waiting', tech: 'Walter' } },
  'j-05': { band: { station: 'final_assembly', status: 'reunited', tech: 'Walter' }, case: { station: 'final_assembly', status: 'reunited', tech: 'Walter' } },
  'j-r3': { head: { station: 'wm_bench_2', status: 'in_progress', tech: 'Leo' }, band: { station: 'safe_await_head', status: 'waiting', tech: 'Leo' } },
  'j-t1': { band: { station: 'refinish', status: 'in_progress', tech: 'Leo' } },
  'j-t2': { band: { station: 'final_assembly', status: 'reunited', tech: 'Walter' }, case: { station: 'final_assembly', status: 'reunited', tech: 'Walter' } },
  // Custody view seeds — Vienna (manager safes), Chyna (concierge, finished pieces at the desk), MH/Mike (inspector, fresh intake)
  'j-31': { head: { station: 'safe_await_band', status: 'waiting', tech: 'Vienna' }, band: { station: 'refinish', status: 'in_progress', tech: 'Walter' } },
  'j-13': { band: { station: 'band_mgr_safe_in', status: 'waiting', tech: 'Vienna' }, case: { station: 'mgr_safe_polish_in', status: 'waiting', tech: 'Vienna' } },
  'j-21': { head: { station: 'finished', status: 'fulfilled', tech: 'Chyna' }, case: { station: 'finished', status: 'fulfilled', tech: 'Chyna' } },
  'j-22': { head: { station: 'finished', status: 'fulfilled', tech: 'Chyna' } },
  'j-02': { case: { station: 'finished', status: 'fulfilled', tech: 'Chyna' } },
  'j-07': { band: { station: 'finished', status: 'fulfilled', tech: 'Chyna' } },
  'j-12': { head: { station: 'pre_queue', status: 'not_started', tech: 'MH' }, band: { station: 'band_pre_queue', status: 'not_started', tech: 'MH' } },
  'j-14': { case: { station: 'pre_queue', status: 'not_started', tech: 'MH' } },
  'j-10': { band: { station: 'band_pre_queue', status: 'not_started', tech: 'MH' } },
  'j-16': { head: { station: 'final_assembly', status: 'reunited', tech: 'Leo' }, case: { station: 'final_assembly', status: 'reunited', tech: 'Walter' } },
};

export const pickTasks: PickTask[] = [
  { id: 'pk-01', prId: 'pr-10', partId: 'pt-11', jobId: 'j-01', qty: 1, status: 'open', location: 'Cabinet A · Drawer 3 · Bin 2', createdAt: daysAgo(0, 8) },
  { id: 'pk-02', prId: 'pr-11', partId: 'pt-17', jobId: 'j-04', qty: 1, status: 'open', location: 'Cabinet B · Drawer 12 · Bin 4', createdAt: daysAgo(0, 8) },
  { id: 'pk-03', prId: 'pr-12', partId: 'pt-06', jobId: 'j-24', qty: 1, status: 'open', location: 'Cabinet A · Drawer 7 · Bin 1', createdAt: daysAgo(0, 9) },
  { id: 'pk-04', prId: 'pr-13', partId: 'pt-16', jobId: 'j-30', qty: 2, status: 'open', location: 'Cabinet C · Drawer 1 · Bin 9', createdAt: daysAgo(0, 9) },
];

// Most-recently chosen part per watch reference (pad composer ranking memory)
export const recentPartChoices: { reference: string; partId: string; at: string }[] = [
  { reference: '16610', partId: 'pt-17', at: daysAgo(1, 10) },
  { reference: '126710', partId: 'pt-08', at: daysAgo(2, 14) },
];

const img = (seed: string) => `https://picsum.photos/seed/${seed}/640/480`;
// Seeded staff photos are condition records → operational. Specimen rides the guided-shot seam (inspectionLabels), identity the pickup pipeline.
const ph = (id: string, jobId: string, slot: string, kind: JobPhotoView['kind'], seed: string, d: number, by: string): Omit<JobPhotoView, 'unlocked'> & { jobId: string } => ({ id, jobId, slot, kind, url: img(seed), at: daysAgo(d, 10), by, dataClass: 'operational' });
export const jobPhotos: (Omit<JobPhotoView, 'unlocked'> & { jobId: string })[] = [
  // Robert Calloway — R1 full set (arrival · condition · completed) + one staff-only; R3 arrival + condition only + one staff-only
  ph('ph-r1-1', 'j-r1', 'Full watch', 'intake', 'rw-cal-sub-1', 375, 'Vienna'), ph('ph-r1-2', 'j-r1', 'Caseback', 'intake', 'rw-cal-sub-2', 375, 'Vienna'),
  ph('ph-r1-3', 'j-r1', 'Dial', 'inspection', 'rw-cal-sub-3', 374, 'Walter'), ph('ph-r1-4', 'j-r1', 'Bracelet wear', 'inspection', 'rw-cal-sub-4', 374, 'Walter'), ph('ph-r1-5', 'j-r1', 'Movement', 'inspection', 'rw-cal-sub-5', 372, 'Leo'),
  ph('ph-r1-6', 'j-r1', 'Hidden serial', 'inspection', 'rw-cal-sub-6', 374, 'Walter'),
  ph('ph-r1-7', 'j-r1', 'Dial — completed', 'completed', 'rw-cal-sub-7', 352, 'Leo'), ph('ph-r1-8', 'j-r1', 'Caseback — completed', 'completed', 'rw-cal-sub-8', 352, 'Leo'), ph('ph-r1-9', 'j-r1', 'Bracelet — refinished', 'completed', 'rw-cal-sub-9', 352, 'Walter'),
  ph('ph-r3-1', 'j-r3', 'Full watch', 'intake', 'rw-cal-dj-1', 58, 'Vienna'), ph('ph-r3-2', 'j-r3', 'Bracelet', 'intake', 'rw-cal-dj-2', 58, 'Vienna'),
  ph('ph-r3-3', 'j-r3', 'Crystal scratch', 'inspection', 'rw-cal-dj-3', 57, 'MH'), ph('ph-r3-4', 'j-r3', 'Caseback', 'inspection', 'rw-cal-dj-4', 57, 'MH'),
  ph('ph-r3-5', 'j-r3', 'Parts grading', 'inspection', 'rw-cal-dj-5', 56, 'Leo'),
  ph('ph-01', 'j-01', 'Intake — full watch', 'intake', 'rw-sub-1', 9, 'Vienna'),
  ph('ph-02', 'j-01', 'Dial', 'inspection', 'rw-sub-2', 8, 'Leo'),
  ph('ph-03', 'j-01', 'Caseback', 'inspection', 'rw-sub-3', 8, 'Leo'),
  ph('ph-04', 'j-03', 'Intake — full watch', 'intake', 'rw-gmt-1', 6, 'Vienna'),
  ph('ph-05', 'j-03', 'Bezel wear', 'inspection', 'rw-gmt-2', 5, 'Walter'),
  ph('ph-06', 'j-06', 'Intake — full watch', 'intake', 'rw-dj-1', 7, 'Vienna'),
  ph('ph-07', 'j-06', 'Bracelet stretch', 'inspection', 'rw-dj-2', 6, 'Walter'),
  ph('ph-08', 'j-30', 'Intake — full watch', 'intake', 'rw-exp-1', 4, 'Vienna'),
  ph('ph-09', 'j-30', 'Crystal scratch', 'inspection', 'rw-exp-2', 3, 'Leo'),
  ph('ph-10', 'j-31', 'Intake — full watch', 'intake', 'rw-dd-1', 5, 'Vienna'),
];

export const OUTBOX_UNDO_WINDOW_MIN = 30;

// Client request notes (seed): two room jobs with open requests; one QC job with one checked + one still open
const cr = (id: string, text: string, d: number, by: string, extra?: Partial<ClientRequest>): ClientRequest => ({ id, text, at: daysAgo(d, 11), by, station: 'Front Desk 1', acks: [], ...extra });
export const clientRequestSeeds: Record<string, ClientRequest[]> = {
  'j-30': [cr('cr-01', 'Photograph movement before casing', 4, 'Vienna')],
  'j-04': [cr('cr-02', 'Relume hands + new crystal gasket', 20, 'MH')],
  'j-16': [
    cr('cr-03', 'Return original hands in a bag — client keeps them', 11, 'Vienna', { acks: [{ at: daysAgo(3, 9), by: 'Leo', via: 'bulk_assign' }], check: { at: daysAgo(1, 15), by: 'Leo', result: 'done' } }),
    cr('cr-04', 'Call before shipping — client wants to collect in person', 11, 'Vienna', { acks: [{ at: daysAgo(3, 9), by: 'Leo', via: 'bulk_assign' }] }),
  ],
};

// ---- Stage / bin audit — locations = every station + the three bins; two seeded sessions (one clean, one with a missing watch)
export const AUDIT_BINS: AuditLocation[] = [
  { key: 'orphan_bin', label: 'Orphan bin', group: 'bin' },
  { key: 'awaiting_payment_bin', label: 'Awaiting-payment bin', group: 'bin' },
  { key: 'pre_intake_bin', label: 'Concierge / inspection bin', group: 'bin' },
  { key: 'stuck_parts_bin', label: 'Stuck bin · waiting on parts', group: 'bin' },
];
export const AUDIT_LOCATIONS: AuditLocation[] = [...RW_STATIONS.filter((s) => s.key !== 'pre_approval').map((s): AuditLocation => ({ key: s.key, label: s.label, group: 'station', lane: s.lane })), ...AUDIT_BINS];
export const AUDIT_STALE_DAYS_DEFAULT = 7;
export const auditSeeds: AuditSession[] = [
  { id: 'aud-01', location: 'wm_bench_2', locationLabel: 'WM Bench 2', by: 'Leo', station: 'Watchmaker Room', startedAt: daysAgo(3, 17), finishedAt: daysAgo(3, 17.2), expectedCount: 2, matched: 2, missing: [], unexpected: [] },
  { id: 'aud-02', location: 'safe_await_band', locationLabel: 'Safe (await band)', by: 'Leo', station: 'Watchmaker Room', startedAt: daysAgo(1, 18), finishedAt: daysAgo(1, 18.3), expectedCount: 3, matched: 2, pinId: 'pin-audit-01',
    missing: [{ id: 'j-32-head', jobId: 'j-32', jobNumber: 'E02033', key: 'head', partLabel: 'Watch head', watchLabel: 'Rolex Lady-Datejust', reference: '279174', serial: 'N4K8P2W7', clientId: 'c-18', clientName: 'Victoria Rosenthal', tier: 'mid', lastCustody: { by: 'Leo', at: daysAgo(8, 9), where: 'Safe (await band)' } }],
    unexpected: [] },
];
