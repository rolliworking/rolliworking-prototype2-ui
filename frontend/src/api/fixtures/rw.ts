import type { ComponentKey, JobPhotoView, PartStatus, PickTask, RwStation, RwStationKey } from '../types';
import { daysAgo } from './time';

export const RW_STATIONS: RwStation[] = [
  { key: 'pre_approval', label: 'Pre-approval', lane: 'head', order: 0 },
  { key: 'pre_queue', label: 'Pre-queue', lane: 'head', order: 1 },
  { key: 'wm_bench_1', label: 'WM Bench 1', lane: 'head', order: 2 },
  { key: 'wm_bench_2', label: 'WM Bench 2', lane: 'head', order: 3 },
  { key: 'wm_bench_3', label: 'WM Bench 3', lane: 'head', order: 4 },
  { key: 'into_safe_head', label: 'Into safe', lane: 'head', order: 5 },
  { key: 'safe_await_band', label: 'Safe (await band)', lane: 'head', order: 6 },
  { key: 'band_pre_queue', label: 'Pre-queue', lane: 'band', order: 1 },
  { key: 'refinish', label: 'Refinishing', lane: 'band', order: 2 },
  { key: 'polish', label: 'Polish', lane: 'band', order: 3 },
  { key: 'into_safe_band', label: 'Into safe', lane: 'band', order: 5 },
  { key: 'safe_await_head', label: 'Safe (await head)', lane: 'band', order: 6 },
  { key: 'final_assembly', label: 'Final assembly', lane: 'shared', order: 7 },
  { key: 'finished', label: 'Finished', lane: 'shared', order: 8 },
];

// Saved part positions (precedence 1). Parts not listed derive from job status + department.
export const partSeeds: Record<string, Partial<Record<ComponentKey, { station: RwStationKey; status: PartStatus; tech?: string }>>> = {
  'j-01': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'MM' } },
  'j-04': { head: { station: 'wm_bench_2', status: 'in_progress', tech: 'MM' } },
  'j-24': { head: { station: 'wm_bench_3', status: 'in_progress', tech: 'Rosa' } },
  'j-03': { head: { station: 'wm_bench_1', status: 'in_progress', tech: 'MM' }, case: { station: 'safe_await_head', status: 'waiting', tech: 'Walter' } },
  'j-06': { head: { station: 'into_safe_head', status: 'waiting', tech: 'MM' }, case: { station: 'refinish', status: 'in_progress', tech: 'Walter' } },
  'j-17': { case: { station: 'polish', status: 'in_progress', tech: 'Walter' } },
  'j-30': { head: { station: 'wm_bench_2', status: 'in_progress', tech: 'Rosa' }, case: { station: 'refinish', status: 'in_progress', tech: 'Walter' }, band: { station: 'band_pre_queue', status: 'not_started' } },
  'j-31': { head: { station: 'safe_await_band', status: 'waiting', tech: 'MM' }, band: { station: 'polish', status: 'in_progress', tech: 'Walter' } },
  'j-32': { head: { station: 'safe_await_band', status: 'waiting', tech: 'Rosa' }, case: { station: 'safe_await_band', status: 'waiting', tech: 'Walter' }, band: { station: 'safe_await_head', status: 'waiting', tech: 'Walter' } },
  'j-05': { band: { station: 'final_assembly', status: 'reunited', tech: 'Walter' }, case: { station: 'final_assembly', status: 'reunited', tech: 'Walter' } },
  'j-16': { head: { station: 'final_assembly', status: 'reunited', tech: 'MM' }, case: { station: 'final_assembly', status: 'reunited', tech: 'Walter' } },
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
const ph = (id: string, jobId: string, slot: string, kind: JobPhotoView['kind'], seed: string, d: number, by: string): JobPhotoView & { jobId: string } => ({ id, jobId, slot, kind, url: img(seed), at: daysAgo(d, 10), by });
export const jobPhotos: (JobPhotoView & { jobId: string })[] = [
  ph('ph-01', 'j-01', 'Intake — full watch', 'intake', 'rw-sub-1', 9, 'Vienna'),
  ph('ph-02', 'j-01', 'Dial', 'inspection', 'rw-sub-2', 8, 'MM'),
  ph('ph-03', 'j-01', 'Caseback', 'inspection', 'rw-sub-3', 8, 'MM'),
  ph('ph-04', 'j-03', 'Intake — full watch', 'intake', 'rw-gmt-1', 6, 'Vienna'),
  ph('ph-05', 'j-03', 'Bezel wear', 'inspection', 'rw-gmt-2', 5, 'Walter'),
  ph('ph-06', 'j-06', 'Intake — full watch', 'intake', 'rw-dj-1', 7, 'Vienna'),
  ph('ph-07', 'j-06', 'Bracelet stretch', 'inspection', 'rw-dj-2', 6, 'Walter'),
  ph('ph-08', 'j-30', 'Intake — full watch', 'intake', 'rw-exp-1', 4, 'Vienna'),
  ph('ph-09', 'j-30', 'Crystal scratch', 'inspection', 'rw-exp-2', 3, 'Rosa'),
  ph('ph-10', 'j-31', 'Intake — full watch', 'intake', 'rw-dd-1', 5, 'Vienna'),
];

export const OUTBOX_UNDO_WINDOW_MIN = 30;
