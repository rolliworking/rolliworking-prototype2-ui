import type { PinnedItem, Task } from '../types';
import { daysAgo, daysFromNow } from './time';

export const tasks: Task[] = [
  // ── Rolliworks tasks ──────────────────────────────────────────────────────
  { id: 't-01', title: 'Call Sophie Lindqvist — parts ETA update on the GMT', assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'MM', jobId: 'j-04', clientId: 'c-06', dueAt: daysFromNow(0, 15), status: 'open', createdAt: daysAgo(1, 16), station: 'Bench 1', division: 'rolliworks' },
  { id: 't-02', title: 'Order cal. 3285 mainspring barrel from RSC', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'Walter', jobId: 'j-04', dueAt: daysAgo(1, 17), status: 'open', createdAt: daysAgo(3, 9), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 't-03', title: 'Photograph Day-Date dial before refinish', assignedTo: { type: 'role', role: 'watchmaker' }, createdBy: 'MH', jobId: 'j-03', watchId: 'w-04', dueAt: daysFromNow(1), status: 'open', createdAt: daysAgo(0, 8), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 't-04', title: 'Confirm Saturday pickup window with Grace Nakamura', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'Walter', jobId: 'j-02', clientId: 'c-03', dueAt: daysFromNow(0, 12), status: 'open', createdAt: daysAgo(1, 11), station: 'Bench 2', division: 'rolliworks' },
  { id: 't-05', title: 'Re-check hairspring on Lady-Datejust after QC fail', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'MH', jobId: 'j-16', dueAt: daysFromNow(0, 17), status: 'open', createdAt: daysAgo(2, 15), station: 'Bench 2', division: 'rolliworks' },
  { id: 't-06', title: 'Inspect discrepancy package SUB-26-0302 with client on the phone', assignedTo: { type: 'role', role: 'inspector' }, createdBy: 'Vienna', clientId: 'c-08', dueAt: daysFromNow(0, 11), status: 'open', createdAt: daysAgo(2, 12), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 't-07', title: 'Send Priya Raghunathan the refinish before/after photos', assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'Walter', jobId: 'j-03', clientId: 'c-04', dueAt: daysFromNow(2), status: 'open', createdAt: daysAgo(0, 9), station: 'Bench 2', division: 'rolliworks' },
  { id: 't-08', title: 'Restock bench 1 cleaning solution', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'MM', dueAt: daysFromNow(3), status: 'open', createdAt: daysAgo(1, 8), station: 'Bench 1', division: 'rolliworks' },
  { id: 't-09', title: 'Approve overtime for Saturday QC run', assignedTo: { type: 'role', role: 'manager' }, createdBy: 'Vienna', dueAt: daysFromNow(0, 16), status: 'open', createdAt: daysAgo(0, 9), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 't-11', title: 'Call Naomi Castellanos — Datejust crystal fitted, confirm Friday pickup', assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'MM', jobId: 'j-24', watchId: 'w-20', clientId: 'c-10', dueAt: daysFromNow(0, 16), status: 'open', createdAt: daysAgo(0, 9), station: 'Bench 1', division: 'rolliworks' },
  { id: 't-12', title: 'Get Tudor rivet bracelet price for Naomi (E01057)', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'Vienna', clientId: 'c-10', watchId: 'w-21', dueAt: daysFromNow(1, 12), status: 'open', createdAt: daysAgo(2, 11), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 't-13', title: 'Email Naomi the OP refinish before/after photos', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'Walter', jobId: 'j-08', clientId: 'c-10', dueAt: daysAgo(9, 12), status: 'done', createdAt: daysAgo(10, 10), station: 'Bench 2', division: 'rolliworks', completedAt: daysAgo(9, 10), completedBy: 'Vienna' },
  { id: 't-10', title: 'File RSC warranty claim for Eleanor Vance Daytona', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'MH', jobId: 'j-11', clientId: 'c-02', dueAt: daysAgo(2, 12), status: 'done', createdAt: daysAgo(4, 10), station: 'Front Desk 1', division: 'rolliworks', completedAt: daysAgo(2, 11), completedBy: 'Vienna' },
  // ── RolliShop tasks (Walter) ──────────────────────────────────────────────
  { id: 't-rs-01', title: 'Chase Audemars Piguet parts quote — Royal Oak bezel screws', assignedTo: { type: 'user', shortName: 'Walter' }, createdBy: 'Walter', dueAt: daysFromNow(0, 14), status: 'open', createdAt: daysAgo(1, 9), station: 'RS Counter', division: 'rollishop' },
  { id: 't-rs-02', title: 'Confirm Patek Philippe movement arrival with customs broker', assignedTo: { type: 'role', role: 'manager' }, createdBy: 'Walter', dueAt: daysFromNow(1, 10), status: 'open', createdAt: daysAgo(0, 11), station: 'RS Counter', division: 'rollishop' },
];

export const pinned: PinnedItem[] = [
  // ── Rolliworks pins ───────────────────────────────────────────────────────
  { id: 'pin-01', title: '#vienna order paper for the receipt printer', assignedTo: { type: 'user', shortName: 'Vienna' }, createdBy: 'MH', createdAt: daysAgo(0, 8), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 'pin-02', title: 'Walk the GMT parts hold with the client today', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'Walter', jobId: 'j-04', createdAt: daysAgo(0, 9), station: 'Bench 2', division: 'rolliworks' },
  { id: 'pin-03', title: 'Sign off Saturday overtime before noon', assignedTo: { type: 'role', role: 'manager' }, createdBy: 'Vienna', taskId: 't-09', createdAt: daysAgo(0, 9), station: 'Front Desk 1', division: 'rolliworks' },
  { id: 'pin-04', title: 'Done yesterday — kept for history', assignedTo: { type: 'user', shortName: 'MM' }, createdBy: 'MM', createdAt: daysAgo(1, 9), station: 'Bench 1', division: 'rolliworks', dismissedAt: daysAgo(1, 17), dismissedBy: 'MM' },
  // ── RolliShop pins (Walter) ───────────────────────────────────────────────
  { id: 'pin-rs-01', title: 'Call AP distributor back before 3 PM — shipment query', assignedTo: { type: 'user', shortName: 'Walter' }, createdBy: 'Walter', createdAt: daysAgo(0, 8), station: 'RS Counter', division: 'rollishop' },
  { id: 'pin-rs-02', title: 'Review boutique consignment paperwork before EOD', assignedTo: { type: 'role', role: 'manager' }, createdBy: 'Walter', createdAt: daysAgo(0, 9), station: 'RS Counter', division: 'rollishop' },
];
