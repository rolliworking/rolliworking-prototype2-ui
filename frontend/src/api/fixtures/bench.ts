import type { ComponentKey, JobMessage } from '../types';
import { daysAgo } from './time';

// Monthly component goal per tech (own numbers only — never a leaderboard)
export const techGoals: Record<string, number> = { Rosa: 18, MM: 20, MH: 16, Walter: 24 };

// Prior-month completions, relative to today (monthsAgo 1 = last month). Rosa: hit 4, missed 2 — one near-miss (17/18), one real miss (11/18).
// `byType` sums to `actual`; weeks are distributed by the board from `weekShape` (fractions of the month).
export interface GoalSeed { monthsAgo: number; actual: number; byType: Record<ComponentKey, number>; weekShape: number[] }
export const goalHistorySeeds: Record<string, GoalSeed[]> = {
  Rosa: [
    { monthsAgo: 6, actual: 19, byType: { head: 12, case: 4, band: 3 }, weekShape: [0.25, 0.25, 0.3, 0.2] },
    { monthsAgo: 5, actual: 11, byType: { head: 8, case: 2, band: 1 }, weekShape: [0.35, 0.1, 0.2, 0.35] }, // real miss — two weeks out sick
    { monthsAgo: 4, actual: 20, byType: { head: 13, case: 5, band: 2 }, weekShape: [0.2, 0.3, 0.25, 0.25] },
    { monthsAgo: 3, actual: 18, byType: { head: 11, case: 4, band: 3 }, weekShape: [0.2, 0.25, 0.25, 0.3] },
    { monthsAgo: 2, actual: 17, byType: { head: 12, case: 3, band: 2 }, weekShape: [0.3, 0.25, 0.25, 0.2] }, // near miss — 17/18
    { monthsAgo: 1, actual: 21, byType: { head: 14, case: 4, band: 3 }, weekShape: [0.25, 0.25, 0.25, 0.25] },
  ],
  MM: [
    { monthsAgo: 6, actual: 22, byType: { head: 16, case: 4, band: 2 }, weekShape: [0.25, 0.25, 0.25, 0.25] },
    { monthsAgo: 5, actual: 20, byType: { head: 15, case: 3, band: 2 }, weekShape: [0.25, 0.25, 0.25, 0.25] },
    { monthsAgo: 4, actual: 18, byType: { head: 13, case: 3, band: 2 }, weekShape: [0.3, 0.2, 0.25, 0.25] },
    { monthsAgo: 3, actual: 23, byType: { head: 17, case: 4, band: 2 }, weekShape: [0.25, 0.25, 0.25, 0.25] },
    { monthsAgo: 2, actual: 21, byType: { head: 15, case: 4, band: 2 }, weekShape: [0.25, 0.25, 0.25, 0.25] },
    { monthsAgo: 1, actual: 19, byType: { head: 14, case: 3, band: 2 }, weekShape: [0.25, 0.25, 0.25, 0.25] },
  ],
};
// Completions already booked this month before the prototype snapshot (added to live component completions)
export const currentMonthBase: Record<string, { actual: number; byType: Record<ComponentKey, number> }> = { Rosa: { actual: 7, byType: { head: 5, case: 1, band: 1 } }, MM: { actual: 9, byType: { head: 7, case: 1, band: 1 } } };

// Seed thread on Rosa's in-progress split job (E02031): Rosa → @MM (manager → hit list) → MM reply @Vienna (manager → hit list; Rosa re-notified → her Messages)
export const jobMessages: JobMessage[] = [
  { id: 'jm-01', jobId: 'j-30', text: 'Crown is worse than the estimate shows @MM come look', mentions: ['MM'], notify: ['MM'], at: daysAgo(0, 8), by: 'Rosa', station: 'Bench 3', readBy: ['Rosa'], photo: { id: 'jm-01-photo', source: 'camera', dataUrl: 'https://picsum.photos/seed/rw-crown-worn/640/480', slot: 'workbench', clientVisible: false } },
  { id: 'jm-02', jobId: 'j-30', parentId: 'jm-01', text: 'Adding crown to the parts request, @Vienna please prep a revised estimate', mentions: ['Vienna'], notify: ['Vienna', 'Rosa'], at: daysAgo(0, 9), by: 'MM', station: 'Supervisor Pad', readBy: ['MM'] },
  // Unrouted ambient note on another job — sits on the job, notifies nobody
  { id: 'jm-03', jobId: 'j-24', text: 'Caseback gasket left on the tray — reuse if it grades B, otherwise it is on the parts list already.', mentions: [], notify: [], at: daysAgo(1, 15), by: 'Rosa', station: 'Bench 3', readBy: ['Rosa'] },
];
