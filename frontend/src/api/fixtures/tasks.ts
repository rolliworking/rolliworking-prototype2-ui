import type { Task } from '../types';
import { daysAgo, daysFromNow } from './time';

export const tasks: Task[] = [
  { id: 't-01', title: 'Call Sophie Lindqvist — parts ETA update on the GMT', assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'MM', jobId: 'j-04', clientId: 'c-06', dueAt: daysFromNow(0, 15), status: 'open', createdAt: daysAgo(1, 16), station: 'Bench 1' },
  { id: 't-02', title: 'Order cal. 3285 mainspring barrel from RSC', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'Walter', jobId: 'j-04', dueAt: daysAgo(1, 17), status: 'open', createdAt: daysAgo(3, 9), station: 'Front Desk 1' },
  { id: 't-03', title: 'Photograph Day-Date dial before refinish', assignedTo: { type: 'role', role: 'watchmaker' }, createdBy: 'MH', jobId: 'j-03', watchId: 'w-04', dueAt: daysFromNow(1), status: 'open', createdAt: daysAgo(0, 8), station: 'Front Desk 1' },
  { id: 't-04', title: 'Confirm Saturday pickup window with Grace Nakamura', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'Walter', jobId: 'j-02', clientId: 'c-03', dueAt: daysFromNow(0, 12), status: 'open', createdAt: daysAgo(1, 11), station: 'Bench 2' },
  { id: 't-05', title: 'Re-check hairspring on Lady-Datejust after QC fail', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'MH', jobId: 'j-16', dueAt: daysFromNow(0, 17), status: 'open', createdAt: daysAgo(2, 15), station: 'Bench 2' },
  { id: 't-06', title: 'Inspect discrepancy package SUB-26-0302 with client on the phone', assignedTo: { type: 'role', role: 'inspector' }, createdBy: 'Vienna', clientId: 'c-08', dueAt: daysFromNow(0, 11), status: 'open', createdAt: daysAgo(2, 12), station: 'Front Desk 1' },
  { id: 't-07', title: 'Send Priya Raghunathan the refinish before/after photos', assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'Walter', jobId: 'j-03', clientId: 'c-04', dueAt: daysFromNow(2), status: 'open', createdAt: daysAgo(0, 9), station: 'Bench 2' },
  { id: 't-08', title: 'Restock bench 1 cleaning solution', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'MM', dueAt: daysFromNow(3), status: 'open', createdAt: daysAgo(1, 8), station: 'Bench 1' },
  { id: 't-09', title: 'Approve overtime for Saturday QC run', assignedTo: { type: 'role', role: 'manager' }, createdBy: 'Vienna', dueAt: daysFromNow(0, 16), status: 'open', createdAt: daysAgo(0, 9), station: 'Front Desk 1' },
  { id: 't-10', title: 'File RSC warranty claim for Eleanor Vance Daytona', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'MH', jobId: 'j-11', clientId: 'c-02', dueAt: daysAgo(2, 12), status: 'done', createdAt: daysAgo(4, 10), station: 'Front Desk 1', completedAt: daysAgo(2, 11), completedBy: 'Vienna' },
];
