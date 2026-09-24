import type { Bin, Carrier, DeptCode, LabelJob, OutboxEmail, Package, PackagePhoto } from '../types';
import { daysAgo, hoursAgo } from './time';

export const CONTENT_PILLS = ['watch head', 'bracelet', 'clasp', 'box', 'papers', 'crown', 'loose parts', 'bezel', 'band only', 'papers only'];

export const CARRIERS: Carrier[] = ['FedEx', 'UPS', 'USPS', 'DHL', 'Hand delivery'];

export const BINS: { key: Bin; label: string; blurb: string }[] = [
  { key: 'inspection', label: 'Inspection bin', blurb: 'Goes to the inspector for Receive Watch' },
  { key: 'concierge', label: 'Concierge bin', blurb: 'Held at the desk — client visit or question pending' },
];

export const DEPT_LABEL: Record<DeptCode, string> = { W: 'Watch', B: 'Band', P: 'Polish', PM: 'Precious Metals' };

// Which physical components a department's work implies were shipped
export const DEPT_COMPONENTS: Record<DeptCode, string[]> = {
  W: ['watch head'],
  B: ['bracelet', 'clasp'],
  P: ['watch head', 'bracelet'],
  PM: ['watch head'],
};

export const seedPhoto = (label: string): PackagePhoto => ({
  id: `ph-${label.replace(/\W+/g, '-').toLowerCase()}`,
  source: 'upload',
  fileName: `${label.replace(/\W+/g, '_').toLowerCase()}.jpg`,
  dataUrl:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#e2e6ea"/><text x="160" y="124" font-family="sans-serif" font-size="16" fill="#5b6b80" text-anchor="middle">${label.replace(/&/g, '&amp;')}</text></svg>`,
    ),
});

export const packages: Package[] = [
  // Stage 1 — arrived, awaiting processing
  { id: 'pk-01', subNumber: 'SUB-26-0311', source: 'carrier', carrier: 'FedEx', trackingNumber: '748922310045', signatureNoted: true, status: 'arrived', arrivedAt: hoursAgo(3.2), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', contents: [], photos: [], receiptPrinted: false },
  { id: 'pk-02', subNumber: 'SUB-26-0312', source: 'carrier', carrier: 'UPS', trackingNumber: '1Z999AA10123456784', signatureNoted: true, clientId: 'c-16', status: 'arrived', arrivedAt: hoursAgo(2.6), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', contents: [], photos: [], receiptPrinted: false },
  { id: 'pk-03', subNumber: 'SUB-26-0313', source: 'walk_in', carrier: 'Hand delivery', signatureNoted: false, clientId: 'c-17', status: 'arrived', arrivedAt: hoursAgo(1.4), arrivedBy: 'MH', arrivedStation: 'Front Desk 1', contents: [], photos: [], receiptPrinted: false },
  // Stage 2 done — processed, awaiting work order
  { id: 'pk-04', subNumber: 'SUB-26-0308', source: 'carrier', carrier: 'FedEx', trackingNumber: '748922309871', signatureNoted: true, clientId: 'c-13', estimateId: 'e-11', status: 'processed', arrivedAt: daysAgo(1, 9), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', processedAt: daysAgo(1, 17), processedBy: 'Vienna', contents: ['watch head', 'bracelet', 'box'], photos: [seedPhoto('Package front'), seedPhoto('Contents')], receiptPrinted: true },
  { id: 'pk-05', subNumber: 'SUB-26-0309', source: 'carrier', carrier: 'USPS', trackingNumber: '9400111899223100457812', signatureNoted: true, clientId: 'c-05', estimateId: 'e-05', status: 'processed', arrivedAt: daysAgo(1, 11), arrivedBy: 'MH', arrivedStation: 'Front Desk 1', processedAt: daysAgo(1, 17), processedBy: 'Vienna', contents: ['watch head', 'papers'], photos: [seedPhoto('Package')], receiptPrinted: false },
  // Stage 3 done — awaiting inspection
  { id: 'pk-06', subNumber: 'SUB-26-0305', source: 'carrier', carrier: 'UPS', trackingNumber: '1Z999AA10123456701', signatureNoted: true, clientId: 'c-10', estimateId: 'e-13', status: 'awaiting_inspection', arrivedAt: daysAgo(2, 10), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', processedAt: daysAgo(2, 17), processedBy: 'Vienna', workOrderAt: daysAgo(1, 8), workOrderBy: 'Walter', bin: 'inspection', contents: ['watch head', 'bracelet', 'box', 'papers'], photos: [seedPhoto('Package'), seedPhoto('Contents'), seedPhoto('Box & papers')], receiptPrinted: true },
  { id: 'pk-07', subNumber: 'SUB-26-0306', source: 'carrier', carrier: 'FedEx', trackingNumber: '748922308114', signatureNoted: true, clientId: 'c-18', estimateId: 'e-14', status: 'awaiting_inspection', arrivedAt: daysAgo(2, 12), arrivedBy: 'MH', arrivedStation: 'Front Desk 1', processedAt: daysAgo(2, 17), processedBy: 'Vienna', workOrderAt: daysAgo(1, 8), workOrderBy: 'Walter', bin: 'inspection', contents: ['watch head', 'bracelet'], photos: [seedPhoto('Package'), seedPhoto('Contents')], receiptPrinted: true },
  { id: 'pk-08', subNumber: 'SUB-26-0307', source: 'walk_in', carrier: 'Hand delivery', signatureNoted: false, clientId: 'c-19', estimateId: 'e-16', status: 'awaiting_inspection', arrivedAt: daysAgo(1, 14), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', processedAt: daysAgo(1, 17), processedBy: 'Vienna', workOrderAt: daysAgo(1, 8), workOrderBy: 'MM', bin: 'concierge', contents: ['watch head', 'bracelet', 'box'], photos: [seedPhoto('Contents')], receiptPrinted: true },
  // Stage 4 done — received, awaiting approval
  { id: 'pk-09', subNumber: 'SUB-26-0301', source: 'carrier', carrier: 'DHL', trackingNumber: '4581209934', signatureNoted: true, clientId: 'c-14', estimateId: 'e-12', status: 'received', arrivedAt: daysAgo(5, 10), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', processedAt: daysAgo(5, 17), processedBy: 'Vienna', workOrderAt: daysAgo(4, 8), workOrderBy: 'Walter', bin: 'inspection', inspectedAt: daysAgo(4, 10), inspectedBy: 'MH', workflow: ['B', 'P'], contents: ['watch head', 'bracelet', 'clasp', 'box'], photos: [seedPhoto('Package'), seedPhoto('Contents')], receiptPrinted: true },
  // Discrepancy hold
  { id: 'pk-10', subNumber: 'SUB-26-0302', source: 'carrier', carrier: 'FedEx', trackingNumber: '748922307450', signatureNoted: true, clientId: 'c-08', estimateId: 'e-08', status: 'discrepancy_hold', arrivedAt: daysAgo(4, 10), arrivedBy: 'MH', arrivedStation: 'Front Desk 1', processedAt: daysAgo(4, 17), processedBy: 'Vienna', workOrderAt: daysAgo(3, 8), workOrderBy: 'Walter', bin: 'inspection', inspectedAt: daysAgo(3, 11), inspectedBy: 'Walter', workflow: ['W', 'B'], contents: ['watch head', 'box'], photos: [seedPhoto('Package'), seedPhoto('Contents')], receiptPrinted: true, discrepancyReason: 'Missing component: bracelet (estimate includes bracelet re-pin). Client to be contacted.' },
  // Client 360 seed — Naomi's Datejust 31 arrived 20 days ago and was received into job E02007
  { id: 'pk-11', subNumber: 'SUB-26-0291', source: 'carrier', carrier: 'FedEx', trackingNumber: '794644790132', signatureNoted: true, clientId: 'c-10', estimateId: 'e-23', status: 'received', arrivedAt: daysAgo(20, 10), arrivedBy: 'Vienna', arrivedStation: 'Front Desk 1', processedAt: daysAgo(20, 15), processedBy: 'Vienna', workOrderAt: daysAgo(19, 8), workOrderBy: 'Walter', bin: 'inspection', inspectedAt: daysAgo(19, 9), inspectedBy: 'Walter', workflow: ['W'], contents: ['watch head', 'bracelet', 'box'], photos: [seedPhoto('Package SUB-26-0291'), seedPhoto('Contents SUB-26-0291')], receiptPrinted: true },
];

export const outbox: OutboxEmail[] = [
  {
    id: 'ob-01', to: 'richard.stavros@example.com', toName: 'Richard Stavros', relatedRef: 'SUB-26-0308 · E01051', status: 'pending',
    subject: 'We’ve received your Tudor Pelagos — E01051',
    body: 'Hello Richard,\n\nYour package arrived safely at RolliSuite today. We logged: watch head, bracelet, box.\n\nIt now moves to inspection, where we verify the watch against your estimate E01051 before any work begins. You’ll hear from us once inspection is complete.\n\nSub#: SUB-26-0308\n\n— The RolliSuite team',
    createdAt: daysAgo(1, 17), createdBy: 'Vienna', station: 'Front Desk 1',
  },
  {
    id: 'ob-02', to: 'j.okafor@example.com', toName: 'Jonathan Okafor', relatedRef: 'SUB-26-0309 · E01045', status: 'pending',
    subject: 'We’ve received your Rolex Explorer — E01045',
    body: 'Hello Jonathan,\n\nYour package arrived safely at RolliSuite today. We logged: watch head, papers.\n\nIt now moves to inspection, where we verify the watch against your estimate E01045 before any work begins.\n\nSub#: SUB-26-0309\n\n— The RolliSuite team',
    createdAt: daysAgo(1, 17), createdBy: 'Vienna', station: 'Front Desk 1',
  },
  // Client 360 seed — everything ever queued to Naomi Castellanos, oldest → newest
  { id: 'ob-03', to: 'naomi.castellanos@example.com', toName: 'Naomi Castellanos', relatedRef: 'E01040', status: 'pending', subject: 'Your estimate E01040 — Rolex Datejust 31', body: 'Hello Naomi,\n\nYour estimate E01040 for the Datejust 31 (278274) is ready to review: complete service and pressure test.\n\n— The RolliSuite team', createdAt: daysAgo(21, 11), createdBy: 'Walter', station: 'Front Desk 1' },
  { id: 'ob-04', to: 'naomi.castellanos@example.com', toName: 'Naomi Castellanos', relatedRef: 'SUB-26-0291 · E01040', status: 'pending', subject: 'We’ve received your Rolex Datejust 31 — E01040', body: 'Hello Naomi,\n\nYour package arrived safely today. We logged: watch head, bracelet, box.\n\nSub#: SUB-26-0291\n\n— The RolliSuite team', createdAt: daysAgo(20, 15), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'ob-05', to: 'naomi.castellanos@example.com', toName: 'Naomi Castellanos', relatedRef: 'E01040 rev 2', status: 'pending', subject: 'Updated estimate E01040 (rev 2) — crystal added', body: 'Hello Naomi,\n\nAt inspection we found a hairline chip in the crystal. We’ve revised E01040 to add an OEM sapphire crystal. Please review and approve.\n\n— The RolliSuite team', createdAt: daysAgo(19, 12), createdBy: 'Walter', station: 'Front Desk 1' },
  { id: 'ob-06', to: 'naomi.castellanos@example.com', toName: 'Naomi Castellanos', relatedRef: 'SO-26-0105', status: 'pending', subject: 'Your Oyster Perpetual is on its way — SO-26-0105', body: 'Hello Naomi,\n\nYour refinished Oyster Perpetual 41 shipped today via UPS Next Day Air.\nTracking: 1Z 999 AA1 01 2345 6784\n\n— The RolliSuite team', createdAt: daysAgo(9, 15), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'ob-07', to: 'naomi.castellanos@example.com', toName: 'Naomi Castellanos', relatedRef: 'E01053', status: 'pending', subject: 'Your estimate E01053 — Rolex Oyster Perpetual 41', body: 'Hello Naomi,\n\nYour estimate E01053 for the Oyster Perpetual 41 (124300) is ready to review: complete service and OEM crystal.\n\n— The RolliSuite team', createdAt: daysAgo(3, 10), createdBy: 'Walter', station: 'Front Desk 1' },
  { id: 'ob-08', to: 'naomi.castellanos@example.com', toName: 'Naomi Castellanos', relatedRef: 'SUB-26-0305 · E01053', status: 'pending', subject: 'We’ve received your Rolex Oyster Perpetual 41 — E01053', body: 'Hello Naomi,\n\nYour package arrived safely today. We logged: watch head, bracelet, box, papers.\n\nSub#: SUB-26-0305\n\n— The RolliSuite team', createdAt: daysAgo(2, 17), createdBy: 'Vienna', station: 'Front Desk 1' },
];

export const labels: LabelJob[] = [
  { id: 'lb-01', type: 'pdf417_data', packageId: 'pk-09', estimateNumber: 'E01052', payload: 'E01052|SUB-26-0301|M79360N-0002|T6Q1W48V|B,P', lines: ['E01052', 'SUB-26-0301', 'Grace Nakamura', 'Workflow B · P'], createdAt: daysAgo(4, 10), createdBy: 'MH', station: 'Front Desk 1', printed: false },
  { id: 'lb-02', type: 'ref_serial', packageId: 'pk-09', estimateNumber: 'E01052', payload: 'M79360N-0002 / T6Q1W48V', lines: ['Tudor Black Bay Chrono', 'Ref M79360N-0002', 'Serial T6Q1W48V'], createdAt: daysAgo(4, 10), createdBy: 'MH', station: 'Front Desk 1', printed: false },
];
