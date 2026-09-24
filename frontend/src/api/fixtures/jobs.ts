import type { Job } from '../types';
import { daysAgo, daysFromNow, dayThisMonth } from './time';

export const jobs: Job[] = [
  { id: 'j-01', number: 'JOB-26-0211', estimateId: 'e-01', clientId: 'c-01', watchId: 'w-01', department: 'watchmaking', status: 'in_progress', technician: 'MM', startedAt: daysAgo(9), dueAt: daysFromNow(12), total: 1450 },
  { id: 'j-02', number: 'JOB-26-0212', estimateId: 'e-03', clientId: 'c-03', watchId: 'w-03', department: 'polish', status: 'awaiting_pickup', technician: 'K. Duval', startedAt: daysAgo(17), dueAt: daysAgo(3), completedAt: dayThisMonth(6), total: 385 },
  { id: 'j-03', number: 'JOB-26-0213', estimateId: 'e-04', clientId: 'c-04', watchId: 'w-04', department: 'watchmaking', status: 'in_progress', technician: 'Walter', startedAt: daysAgo(6), dueAt: daysFromNow(18), total: 1650 },
  { id: 'j-04', number: 'JOB-26-0214', estimateId: 'e-06', clientId: 'c-06', watchId: 'w-06', department: 'watchmaking', status: 'awaiting_parts', technician: 'MM', startedAt: daysAgo(28), dueAt: daysFromNow(9), total: 1980 },
  { id: 'j-05', number: 'JOB-26-0215', estimateId: 'e-07', clientId: 'c-07', watchId: 'w-07', department: 'band', status: 'qc', technician: 'A. Reyes', startedAt: daysAgo(13), dueAt: daysFromNow(1), total: 620 },
  { id: 'j-06', number: 'JOB-26-0216', estimateId: 'e-09', clientId: 'c-09', watchId: 'w-09', department: 'watchmaking', status: 'in_progress', technician: 'MM', startedAt: daysAgo(18), dueAt: daysFromNow(6), total: 1550 },
  { id: 'j-07', number: 'JOB-26-0217', clientId: 'c-12', watchId: 'w-12', department: 'band', status: 'awaiting_pickup', technician: 'A. Reyes', startedAt: daysAgo(16), dueAt: daysAgo(2), completedAt: dayThisMonth(10), total: 540 },
  { id: 'j-08', number: 'JOB-26-0218', clientId: 'c-10', watchId: 'w-10', department: 'polish', status: 'complete', technician: 'K. Duval', startedAt: daysAgo(38), dueAt: daysAgo(30), completedAt: dayThisMonth(2), total: 340 },
  { id: 'j-09', number: 'JOB-26-0219', clientId: 'c-15', watchId: 'w-15', department: 'watchmaking', status: 'complete', technician: 'MM', startedAt: daysAgo(33), dueAt: daysAgo(8), completedAt: dayThisMonth(4), total: 2250 },
  { id: 'j-10', number: 'JOB-26-0220', clientId: 'c-11', watchId: 'w-11', department: 'band', status: 'in_progress', technician: 'A. Reyes', startedAt: daysAgo(5), dueAt: daysFromNow(4), total: 480 },
];
