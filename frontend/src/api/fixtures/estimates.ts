import type { Address, Client, DeptCode, Estimate, EstimateLine, EstimateRevision, EstimateStatus, LineType } from '../types';
import { clients } from './clients';
import { daysAgo, daysFromNow } from './time';

let seq = 0;
const line = (description: string, unitPrice: number, dept: DeptCode, opts: { qty?: number; type?: LineType; taxable?: boolean; catalogId?: string } = {}): EstimateLine => ({
  id: `ln-${String(++seq).padStart(3, '0')}`,
  description,
  qty: opts.qty ?? 1,
  unitPrice,
  dept,
  taxable: opts.taxable ?? true,
  type: opts.type ?? 'service',
  catalogId: opts.catalogId,
});

export const addressFor = (c: Client): Address => ({ name: c.company ? `${c.company} · ${c.firstName} ${c.lastName}` : `${c.firstName} ${c.lastName}`, street: c.street, city: c.city, state: c.state });

const DEPT_OF: Record<DeptCode, Estimate['department']> = { W: 'watchmaking', B: 'band', P: 'polish', PM: 'watchmaking' };
export const primaryDepartment = (lines: EstimateLine[]): Estimate['department'] => {
  const tally: Partial<Record<DeptCode, number>> = {};
  lines.forEach((l) => (tally[l.dept] = (tally[l.dept] ?? 0) + l.qty * l.unitPrice));
  const top = (Object.keys(tally) as DeptCode[]).sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0))[0];
  return top ? DEPT_OF[top] : 'watchmaking';
};

export const totalsFor = (lines: EstimateLine[]) => {
  const ext = (l: EstimateLine) => Math.round(l.qty * l.unitPrice * 100) / 100;
  const subtotal = lines.reduce((t, l) => t + ext(l), 0);
  const shippingAmount = lines.filter((l) => l.type === 'shipping').reduce((t, l) => t + ext(l), 0);
  return { subtotal, shippingAmount, taxAmount: 0, total: subtotal };
};

// Prior-revision snapshot for seeds (revisions are never overwritten — E3 rule)
const snapshot = (revision: number, lines: EstimateLine[], savedDaysAgo: number, clientNotes: string, internalNotes = ''): EstimateRevision => ({
  revision, status: 'sent', lines, ...totalsFor(lines), validUntil: daysFromNow(30 - savedDaysAgo), clientNotes, messageNotes: 'Thank you for your business.', internalNotes, savedAt: daysAgo(savedDaysAgo, 11), savedBy: 'Walter',
});

interface Seed {
  id: string;
  number: string;
  clientId: string;
  watchId?: string;
  status: EstimateStatus;
  lines: EstimateLine[];
  clientNotes: string;
  createdDaysAgo: number;
  sentDaysAgo?: number;
  convertedDaysAgo?: number;
  approvedDaysAgo?: number;
  declinedDaysAgo?: number;
  declineReason?: string;
  historical?: boolean;
  validUntil?: string;
  internalNotes?: string;
  revision?: number;
  revisions?: EstimateRevision[];
  createdBy?: string;
}

const build = (s: Seed): Estimate => {
  const client = clients.find((c) => c.id === s.clientId)!;
  const addr = addressFor(client);
  const t = totalsFor(s.lines);
  return {
    id: s.id,
    number: s.number,
    revision: s.revision ?? 1,
    revisions: s.revisions ?? [],
    clientId: s.clientId,
    watchId: s.watchId,
    department: primaryDepartment(s.lines),
    status: s.status,
    lines: s.lines,
    ...t,
    validUntil: s.validUntil ?? daysFromNow(30 - s.createdDaysAgo),
    clientNotes: s.clientNotes,
    messageNotes: 'Thank you for your business.',
    internalNotes: s.internalNotes ?? '',
    billingAddress: addr,
    shippingAddress: addr,
    shippingMirrorsBilling: true,
    historical: s.historical ?? false,
    createdAt: daysAgo(s.createdDaysAgo),
    createdBy: s.createdBy ?? 'Walter',
    updatedAt: daysAgo(s.sentDaysAgo ?? s.createdDaysAgo),
    sentAt: s.sentDaysAgo !== undefined ? daysAgo(s.sentDaysAgo) : undefined,
    convertedAt: s.convertedDaysAgo !== undefined ? daysAgo(s.convertedDaysAgo) : undefined,
    approvedAt: s.approvedDaysAgo !== undefined ? daysAgo(s.approvedDaysAgo) : undefined,
    declinedAt: s.declinedDaysAgo !== undefined ? daysAgo(s.declinedDaysAgo) : undefined,
    declineReason: s.declineReason,
  };
};

export const estimates: Estimate[] = [
  // Converted (Closed) — these have jobs on the bench
  build({ id: 'e-01', number: 'E01041', clientId: 'c-01', watchId: 'w-01', status: 'converted', createdDaysAgo: 11, sentDaysAgo: 10, approvedDaysAgo: 9, convertedDaysAgo: 9, historical: true,
    clientNotes: 'Losing about a minute a day; crown feels gritty when winding.',
    lines: [line('Complete service — cal. 3235', 1250, 'W', { catalogId: 'svc-02' }), line('Gasket set & crown tube', 85, 'W', { type: 'part', catalogId: 'svc-09' }), line('Pressure test 300m', 115, 'W', { catalogId: 'svc-08' })] }),
  build({ id: 'e-03', number: 'E01043', clientId: 'c-03', watchId: 'w-03', status: 'converted', createdDaysAgo: 19, sentDaysAgo: 19, approvedDaysAgo: 18, convertedDaysAgo: 17,
    clientNotes: 'Desk scratches on the clasp and case sides — wants it looking new for an anniversary.',
    lines: [line('Case & bracelet refinish — Jubilee', 325, 'P', { catalogId: 'svc-17' }), line('Ultrasonic clean', 60, 'P', { catalogId: 'svc-19' })] }),
  build({ id: 'e-04', number: 'E01044', clientId: 'c-04', watchId: 'w-04', status: 'converted', createdDaysAgo: 8, sentDaysAgo: 8, approvedDaysAgo: 7, convertedDaysAgo: 6,
    clientNotes: 'Date wheel skips; day disc slightly misaligned.',
    lines: [line('Complete service — cal. 3255', 1350, 'W', { catalogId: 'svc-03' }), line('Replace date wheel', 185, 'W', { type: 'part' }), line('Pressure test 100m', 115, 'W', { catalogId: 'svc-07' })] }),
  build({ id: 'e-06', number: 'E01046', clientId: 'c-06', watchId: 'w-06', status: 'converted', createdDaysAgo: 30, sentDaysAgo: 29, approvedDaysAgo: 28, convertedDaysAgo: 28,
    clientNotes: 'Power reserve is under a day; GMT hand stiff to set.',
    lines: [line('Complete service — cal. 3285', 1450, 'W'), line('Mainspring & barrel assembly', 415, 'W', { type: 'part', catalogId: 'svc-11' }), line('Pressure test 100m', 115, 'W', { catalogId: 'svc-07' })] }),
  build({ id: 'e-07', number: 'E01047', clientId: 'c-07', watchId: 'w-07', status: 'converted', createdDaysAgo: 15, sentDaysAgo: 15, approvedDaysAgo: 14, convertedDaysAgo: 13,
    clientNotes: 'Bracelet has stretch; clasp opens on its own.',
    lines: [line('Bracelet tighten & re-pin (Oyster)', 380, 'B', { catalogId: 'svc-12' }), line('Clasp spring replacement', 140, 'B', { type: 'part', catalogId: 'svc-14' }), line('Clasp refinish', 100, 'P', { catalogId: 'svc-18' })] }),
  build({ id: 'e-09', number: 'E01049', clientId: 'c-09', watchId: 'w-09', status: 'converted', createdDaysAgo: 20, sentDaysAgo: 20, approvedDaysAgo: 19, convertedDaysAgo: 18,
    clientNotes: 'Moisture under the crystal after a swim.',
    lines: [line('Complete service — cal. 3135', 1250, 'W', { catalogId: 'svc-01' }), line('Replace crystal & gasket', 240, 'W', { type: 'part' }), line('Pressure test 300m', 60, 'W', { catalogId: 'svc-08' })] }),
  // Sent — awaiting the client
  build({ id: 'e-02', number: 'E01042', clientId: 'c-02', watchId: 'w-02', status: 'sent', createdDaysAgo: 4, sentDaysAgo: 3, revision: 2,
    clientNotes: 'Chronograph seconds hand sticks at 20 seconds; crystal has a chip at 4 o’clock.', internalNotes: 'Rev 2 added the clutch wheel after bench look. Client is price-sensitive — call before any add-ons.',
    lines: [line('Complete service — cal. 4130 (chronograph)', 1850, 'W', { catalogId: 'svc-04' }), line('Replace chronograph clutch wheel', 640, 'W', { type: 'part' }), line('Sapphire crystal (OEM)', 360, 'W', { type: 'part', catalogId: 'svc-10' })] }),
  build({ id: 'e-08', number: 'E01048', clientId: 'c-08', watchId: 'w-08', status: 'sent', createdDaysAgo: 3, sentDaysAgo: 2,
    clientNotes: 'Bezel insert cracked; runs fast.',
    lines: [line('Complete service — cal. 3135', 1150, 'W', { catalogId: 'svc-01' }), line('Bezel insert (OEM ceramic)', 200, 'W', { type: 'part' }), line('Bracelet re-pin', 180, 'B')] }),
  build({ id: 'e-12', number: 'E01052', clientId: 'c-14', watchId: 'w-14', status: 'sent', createdDaysAgo: 5, sentDaysAgo: 5,
    clientNotes: 'End-links rattle; clasp scratched.',
    lines: [line('Replace bracelet end-links', 420, 'B', { type: 'part', catalogId: 'svc-15' }), line('Clasp adjustment & refinish', 360, 'P')] }),
  build({ id: 'e-15', number: 'E01055', clientId: 'c-16', watchId: 'w-17', status: 'sent', createdDaysAgo: 4, sentDaysAgo: 4,
    clientNotes: 'Bracelet feels loose; clasp pops open under the cuff.',
    lines: [line('Bracelet stretch repair', 380, 'B', { catalogId: 'svc-13' }), line('Clasp refinish', 100, 'P', { catalogId: 'svc-18' })] }),
  // Approved (provisional staff status) — watches shipping in through Intake
  build({ id: 'e-05', number: 'E01045', clientId: 'c-05', watchId: 'w-05', status: 'approved', createdDaysAgo: 3, sentDaysAgo: 2, approvedDaysAgo: 2,
    clientNotes: 'Stopped running after a fall; no visible damage.',
    lines: [line('Complete service — cal. 3230', 1250, 'W'), line('Pressure test 100m', 115, 'W', { catalogId: 'svc-07' })] }),
  build({ id: 'e-11', number: 'E01051', clientId: 'c-13', watchId: 'w-13', status: 'approved', createdDaysAgo: 2, sentDaysAgo: 1, approvedDaysAgo: 1,
    clientNotes: 'Bezel rotates both ways; bracelet links loose.',
    lines: [line('Complete service — Tudor MT56xx', 950, 'W', { catalogId: 'svc-05' }), line('Titanium bracelet re-pin', 200, 'B')] }),
  build({ id: 'e-13', number: 'E01053', clientId: 'c-10', watchId: 'w-10', status: 'approved', createdDaysAgo: 3, sentDaysAgo: 3, approvedDaysAgo: 2,
    clientNotes: 'Back for another refinish — scratches on clasp and bezel from desk wear.',
    lines: [line('Case & bracelet refinish — Oyster', 340, 'P', { catalogId: 'svc-16' })] }),
  build({ id: 'e-14', number: 'E01054', clientId: 'c-18', watchId: 'w-16', status: 'approved', createdDaysAgo: 6, sentDaysAgo: 5, approvedDaysAgo: 4,
    clientNotes: 'Runs about 3 minutes slow per day; date doesn’t jump at midnight.',
    lines: [line('Complete service — cal. 2236', 1150, 'W'), line('Sapphire crystal (OEM)', 240, 'W', { type: 'part', catalogId: 'svc-10' })] }),
  build({ id: 'e-16', number: 'E01056', clientId: 'c-19', watchId: 'w-18', status: 'approved', createdDaysAgo: 7, sentDaysAgo: 6, approvedDaysAgo: 5,
    clientNotes: 'Water intrusion suspected after a swim; fogging under the crystal in the morning.',
    lines: [line('Complete service — cal. 3235', 1250, 'W', { catalogId: 'svc-02' }), line('Pressure test 100m', 115, 'W', { catalogId: 'svc-07' }), line('Platinum bezel refinish', 650, 'PM', { catalogId: 'svc-20' }), line('Insured return shipping', 35, 'W', { type: 'shipping', taxable: false, catalogId: 'svc-22' })] }),
  // Declined
  build({ id: 'e-10', number: 'E01050', clientId: 'c-10', watchId: 'w-10', status: 'declined', createdDaysAgo: 40, sentDaysAgo: 40, declinedDaysAgo: 38, declineReason: 'Client chose to wait until the next service.',
    clientNotes: 'Light scratches on bracelet.',
    lines: [line('Case & bracelet refinish — Oyster', 340, 'P', { catalogId: 'svc-16' })] }),
  // Expired
  build({ id: 'e-19', number: 'E01020', clientId: 'c-22', status: 'expired', createdDaysAgo: 48, sentDaysAgo: 47, validUntil: daysAgo(18),
    clientNotes: 'Wants the bracelet refinished before a wedding in the spring.',
    lines: [line('Case & bracelet refinish — Jubilee', 325, 'P', { catalogId: 'svc-17' }), line('Ultrasonic clean', 60, 'P', { catalogId: 'svc-19' })] }),
  // Drafts
  build({ id: 'e-17', number: 'E01057', clientId: 'c-20', watchId: 'w-19', status: 'draft', createdDaysAgo: 1,
    clientNotes: 'Date changes at 11pm; wants the Jubilee tightened too.',
    lines: [line('Complete service — cal. 3235', 1250, 'W', { catalogId: 'svc-02' }), line('Bracelet tighten & re-pin (Oyster)', 380, 'B', { catalogId: 'svc-12' })] }),
  build({ id: 'e-18', number: 'E01058', clientId: 'c-21', status: 'draft', createdDaysAgo: 0,
    clientNotes: 'Estate piece — no reference yet; client will bring it in next week.',
    lines: [line('Timing regulation only', 180, 'W', { catalogId: 'svc-06' })] }),
  // ---- Client 360 seed: Naomi Castellanos (c-10) — three watches, estimates across 2023 → today ----
  build({ id: 'e-20', number: 'E00812', clientId: 'c-10', watchId: 'w-10', status: 'converted', createdDaysAgo: 912, sentDaysAgo: 911, approvedDaysAgo: 908, convertedDaysAgo: 907, historical: true,
    clientNotes: 'First service since purchase — stopped overnight twice.',
    internalNotes: 'Historical — imported from the old system.',
    lines: [line('Complete service — cal. 3230', 1150, 'W', { catalogId: 'svc-01' }), line('Gasket set & crown tube', 85, 'W', { type: 'part', catalogId: 'svc-09' })] }),
  build({ id: 'e-21', number: 'E00931', clientId: 'c-10', watchId: 'w-21', status: 'converted', createdDaysAgo: 404, sentDaysAgo: 404, approvedDaysAgo: 402, convertedDaysAgo: 402, historical: true,
    clientNotes: 'Bezel insert chipped at 10 o’clock; clasp no longer clicks.',
    lines: [line('Replace bezel insert (blue)', 290, 'W', { type: 'part' }), line('Clasp spring & re-pin', 160, 'B', { catalogId: 'svc-12' }), line('Ultrasonic clean', 60, 'P', { catalogId: 'svc-19' })] }),
  build({ id: 'e-22', number: 'E01038', clientId: 'c-10', watchId: 'w-10', status: 'converted', createdDaysAgo: 41, sentDaysAgo: 41, approvedDaysAgo: 39, convertedDaysAgo: 38,
    clientNotes: 'Refinish only — bracelet and case sides scratched from a desk.',
    lines: [line('Case & bracelet refinish — brushed/polished', 340, 'P', { catalogId: 'svc-16' })] }),
  build({ id: 'e-23', number: 'E01040', clientId: 'c-10', watchId: 'w-20', status: 'converted', createdDaysAgo: 22, sentDaysAgo: 21, approvedDaysAgo: 19, convertedDaysAgo: 19, revision: 2,
    clientNotes: 'Datejust 31 gaining 2 minutes a day; date jumps late. Aubergine dial — please protect during refinish.',
    internalNotes: 'Rev 2: client asked to add the crystal after we found a hairline chip at inspection.',
    revisions: [snapshot(1, [line('Complete service — cal. 2236', 1150, 'W'), line('Pressure test 100m', 115, 'W', { catalogId: 'svc-07' })], 21, 'Datejust 31 gaining 2 minutes a day; date jumps late.')],
    lines: [line('Complete service — cal. 2236', 1150, 'W'), line('Pressure test 100m', 115, 'W', { catalogId: 'svc-07' }), line('Sapphire crystal (OEM)', 360, 'W', { type: 'part', catalogId: 'svc-10' })] }),
  build({ id: 'e-24', number: 'E01057', clientId: 'c-10', watchId: 'w-21', status: 'draft', createdDaysAgo: 2, createdBy: 'Vienna',
    clientNotes: 'Rivet bracelet stretched — quote new bracelet vs. re-pin.',
    internalNotes: 'From call RQ-26-0041. Waiting on bracelet price from Tudor.',
    lines: [line('Bracelet tighten & re-pin (Oyster)', 380, 'B', { catalogId: 'svc-12' })] }),
];
