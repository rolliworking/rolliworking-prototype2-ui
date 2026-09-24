import type { ServiceRequest } from '../types';
import { daysAgo } from './time';

// Service requests — the "ask" before an estimate exists (call / email / web / walk-in). new → quoted → closed
export const requests: ServiceRequest[] = [
  { id: 'rq-01', number: 'RQ-26-0041', clientId: 'c-10', watchId: 'w-21', source: 'call', status: 'quoted', summary: 'Bracelet has stretched — wants a quote on a new rivet bracelet or a re-pin before summer.', estimateId: 'e-24', createdAt: daysAgo(2, 11), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'rq-02', number: 'RQ-26-0039', clientId: 'c-10', watchId: 'w-10', source: 'email', status: 'closed', summary: 'OP 41 running fast again after last year’s polish — asked whether a full service is due.', estimateId: 'e-13', createdAt: daysAgo(5, 9), createdBy: 'Vienna', station: 'Front Desk 1', closedAt: daysAgo(3, 10), closedNote: 'Estimate E01053 sent and approved.' },
  { id: 'rq-03', number: 'RQ-26-0043', clientId: 'c-10', source: 'web', status: 'new', summary: 'Inherited a vintage Datejust (no ref yet) — asking if we can authenticate and quote a movement service.', createdAt: daysAgo(0, 8), createdBy: 'System', station: 'Web form' },
  { id: 'rq-04', number: 'RQ-26-0042', clientId: 'c-02', watchId: 'w-02', source: 'call', status: 'quoted', summary: 'Daytona pushers sticking — quote requested.', estimateId: 'e-02', createdAt: daysAgo(4, 15), createdBy: 'Vienna', station: 'Front Desk 1' },
  { id: 'rq-05', number: 'RQ-26-0040', clientId: 'c-21', source: 'walk_in', status: 'new', summary: 'Estate piece — will bring in next week for a look.', createdAt: daysAgo(1, 10), createdBy: 'Vienna', station: 'Front Desk 1' },
];
