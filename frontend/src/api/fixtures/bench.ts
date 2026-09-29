import type { ComponentKey, JobMessage } from '../types';
import { daysAgo } from './time';

// Monthly component goal per tech (own numbers only — never a leaderboard)
export const techGoals: Record<string, number> = { Leo: 18, MM: 20, MH: 16, Walter: 24, JV: 22 };

// Prior-month completions, relative to today (monthsAgo 1 = last month). Leo: hit 4, missed 2 — one near-miss (17/18), one real miss (11/18).
// `byType` sums to `actual`; weeks are distributed by the board from `weekShape` (fractions of the month).
export interface GoalSeed { monthsAgo: number; actual: number; byType: Record<ComponentKey, number>; weekShape: number[] }
export const goalHistorySeeds: Record<string, GoalSeed[]> = {
  Leo: [
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
export const currentMonthBase: Record<string, { actual: number; byType: Record<ComponentKey, number> }> = { Leo: { actual: 7, byType: { head: 5, case: 1, band: 1 } }, MM: { actual: 9, byType: { head: 7, case: 1, band: 1 } }, JV: { actual: 11, byType: { head: 0, case: 3, band: 8 } } };

// Seed thread on Leo's in-progress split job (E02031): Leo → @MM (manager → hit list) → MM reply @Vienna (manager → hit list; Leo re-notified → her Messages)
export const jobMessages: JobMessage[] = [
  { id: 'jm-01', jobId: 'j-30', text: 'Crown is worse than the estimate shows @MM come look', mentions: ['MM'], notify: ['MM'], at: daysAgo(0, 8), by: 'Leo', station: 'Bench 3', readBy: ['Leo'], photo: { id: 'jm-01-photo', source: 'camera', dataUrl: 'https://picsum.photos/seed/rw-crown-worn/640/480', slot: 'workbench', clientVisible: false } },
  { id: 'jm-02', jobId: 'j-30', parentId: 'jm-01', text: 'Adding crown to the parts request, @Vienna please prep a revised estimate', mentions: ['Vienna'], notify: ['Vienna', 'Leo'], at: daysAgo(0, 9), by: 'MM', station: 'Supervisor Pad', readBy: ['MM'] },
  // Unrouted ambient note on another job — sits on the job, notifies nobody
  { id: 'jm-03', jobId: 'j-24', text: 'Caseback gasket left on the tray — reuse if it grades B, otherwise it is on the parts list already.', mentions: [], notify: [], at: daysAgo(1, 15), by: 'Leo', station: 'Bench 3', readBy: ['Leo'] },
];

// ---- Work grading (gate at /rw/testing). Categories = Setup lookup (same pattern as photo labels); grades append-only.
import type { GradeCategory, WorkGrade } from '../types';
export const gradeCategories: GradeCategory[] = [
  { id: 'gc-clean', key: 'cleanliness', label: 'Cleanliness', hint: 'Movement, dial, case interior — no debris, fingerprints or residue', scopes: ['whole'], active: true, createdBy: 'MH', createdAt: daysAgo(120) },
  { id: 'gc-case', key: 'case_condition', label: 'Case condition', hint: 'Defects post-polish — scratches, rounded edges, hairlines, uneven brushing', scopes: ['case', 'bracelet'], active: true, createdBy: 'MH', createdAt: daysAgo(120) },
];
const G = (id: string, jobId: string, jobNumber: string, cat: 'gc-clean' | 'gc-case', score: 1 | 2 | 3 | 4 | 5, tech: string, grader: string, d: number, note?: string): WorkGrade => ({ id, jobId, jobNumber, categoryId: cat, categoryLabel: cat === 'gc-clean' ? 'Cleanliness' : 'Case condition', score, note, tech, techAuto: tech, grader, selfGraded: tech === grader, at: daysAgo(d, 15), station: 'Testing' });
// History across the seeded jobs — Leo and MM show believable averages; one self-grade (MM grading his own movement); one low grade (≤2) already pinned
export const gradeSeeds: WorkGrade[] = [
  G('wg-01', 'j-r1', 'E01871', 'gc-clean', 5, 'MM', 'Walter', 352), G('wg-02', 'j-r1', 'E01871', 'gc-case', 4, 'Walter', 'MM', 352),
  G('wg-03', 'j-10', 'E02020', 'gc-clean', 4, 'MM', 'Walter', 40), G('wg-04', 'j-10', 'E02020', 'gc-case', 5, 'Walter', 'MM', 40),
  G('wg-05', 'j-03', 'E02013', 'gc-clean', 4, 'MM', 'Leo', 27), G('wg-06', 'j-03', 'E02013', 'gc-case', 3, 'Walter', 'Leo', 27, 'Hairline at 4 o’clock lug, re-brushed'),
  G('wg-07', 'j-06', 'E02016', 'gc-clean', 5, 'MM', 'MM', 20), // self-graded — allowed, visible in reports
  G('wg-08', 'j-06', 'E02016', 'gc-case', 4, 'Walter', 'MM', 20),
  G('wg-09', 'j-24', 'E02007', 'gc-clean', 4, 'Leo', 'MM', 14), G('wg-10', 'j-24', 'E02007', 'gc-case', 4, 'Leo', 'MM', 14),
  G('wg-11', 'j-05', 'E02015', 'gc-clean', 5, 'Leo', 'MM', 5), G('wg-12', 'j-05', 'E02015', 'gc-case', 2, 'Walter', 'Leo', 5, 'Rounded bevel on the 6 o’clock lug after polish — flagged'),
  G('wg-13', 'j-01', 'E02011', 'gc-clean', 3, 'Leo', 'MM', 9, 'Dust under crystal at 2 o’clock — recased'),
  G('wg-14', 'j-01', 'E02011', 'gc-case', 5, 'Walter', 'MM', 9),
];
