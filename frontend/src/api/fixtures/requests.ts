import type { ServiceRequest } from '../types';
import { daysAgo } from './time';

// Service requests — the "ask" before an estimate exists (call / email / web / walk-in). new → quoted → closed
export const requests: ServiceRequest[] = [
  { id: 'rq-01', number: 'RQ-26-0041', clientId: 'c-10', watchId: 'w-21', source: 'call', status: 'quoted', summary: 'Bracelet has stretched — wants a quote on a new rivet bracelet or a re-pin before summer.', estimateId: 'e-24', createdAt: daysAgo(2, 11), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'rq-02', number: 'RQ-26-0039', clientId: 'c-10', watchId: 'w-10', source: 'email', status: 'closed', summary: 'OP 41 running fast again after last year’s polish — asked whether a full service is due.', estimateId: 'e-13', createdAt: daysAgo(5, 9), createdBy: 'Vienna', station: 'Front Desk 1', closedAt: daysAgo(3, 10), closedNote: 'Estimate E01053 sent and approved.' },
  { id: 'rq-03', number: 'RQ-26-0043', clientId: 'c-10', source: 'web', status: 'new', summary: 'Inherited a vintage Datejust (no ref yet) — asking if we can authenticate and quote a movement service.', createdAt: daysAgo(0, 8), createdBy: 'System', station: 'Web form' },
  { id: 'rq-04', number: 'RQ-26-0042', clientId: 'c-02', watchId: 'w-02', source: 'call', status: 'quoted', summary: 'Daytona pushers sticking — quote requested.', estimateId: 'e-02', createdAt: daysAgo(4, 15), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'rq-05', number: 'RQ-26-0040', clientId: 'c-21', source: 'walk_in', status: 'new', summary: 'Estate piece — will bring in next week for a look.', createdAt: daysAgo(1, 10), createdBy: 'Vienna', station: 'Front Desk 1' },
  // E8 (4) — client-side close: Harrison has two overlapping open asks (one is a duplicate he can close himself)
  { id: 'rq-06', number: 'RQ-26-0044', clientId: 'c-01', watchId: 'w-01', source: 'call', status: 'new', summary: 'While the Submariner is in — could you quote a spare Oyster bracelet, brushed?', createdAt: daysAgo(1, 14), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'rq-07', number: 'RQ-26-0045', clientId: 'c-01', watchId: 'w-01', source: 'web', status: 'new', summary: 'Spare bracelet for my Submariner (126610LN) — price and lead time?', createdAt: daysAgo(0, 7), createdBy: 'System', station: 'Web form' },
  // Grace: one quoted request (message-us only) and one staff-closed duplicate, folded in her portal view
  { id: 'rq-08', number: 'RQ-26-0038', clientId: 'c-14', watchId: 'w-14', source: 'email', status: 'quoted', summary: 'End-links rattle and the clasp is scratched — can you quote once the current service is done?', estimateId: 'e-12', createdAt: daysAgo(6, 10), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'rq-09', number: 'RQ-26-0037', clientId: 'c-14', watchId: 'w-14', source: 'web', status: 'closed', summary: 'Clasp scratched — quote?', createdAt: daysAgo(6, 9), createdBy: 'System', station: 'Web form', closedAt: daysAgo(6, 11), closedBy: 'staff', closeReason: 'duplicate', duplicateOfId: 'rq-08', closedNote: 'Duplicate of RQ-26-0038 (same ask by email).' },
];
