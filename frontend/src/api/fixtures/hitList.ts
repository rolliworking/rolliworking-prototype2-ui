import type { HitListItem } from '../types';
import { daysFromNow } from './time';

export const hitList: HitListItem[] = [
  { id: 'h-01', title: 'Call Eleanor Vance re: Daytona estimate approval', ownerShortName: 'Vienna', priority: 'high', done: false, dueAt: daysFromNow(0, 12), relatedRef: 'E01042' },
  { id: 'h-02', title: 'Pressure test Submariner 126610LN after case-back reseal', ownerShortName: 'MM', priority: 'normal', done: false, dueAt: daysFromNow(0, 15), relatedRef: 'JOB-26-0211' },
  { id: 'h-03', title: 'Inspect incoming Explorer 124270 — Jonathan Okafor drop-off', ownerShortName: 'MH', priority: 'high', done: false, dueAt: daysFromNow(0, 11), relatedRef: 'w-05' },
  { id: 'h-04', title: 'Chase supplier on GMT-Master II mainspring (PO-2231)', ownerShortName: 'Walter', priority: 'normal', done: false, dueAt: daysFromNow(0, 16), relatedRef: 'JOB-26-0214' },
  { id: 'h-05', title: 'QC sign-off — Submariner 116610LV bracelet refinish', ownerShortName: 'MH', priority: 'normal', done: false, dueAt: daysFromNow(1, 10), relatedRef: 'JOB-26-0215' },
  { id: 'h-06', title: 'Prepare pickup paperwork — Datejust 126334 (Marcus Delacroix)', ownerShortName: 'Vienna', priority: 'normal', done: false, dueAt: daysFromNow(0, 17), relatedRef: 'JOB-26-0212' },
  { id: 'h-07', title: 'Follow up on Pelagos estimate sent to Richard Stavros', ownerShortName: 'Walter', priority: 'normal', done: false, dueAt: daysFromNow(1, 14), relatedRef: 'E01051' },
  { id: 'h-08', title: 'Photograph Black Bay Chrono dial before band work', ownerShortName: 'MM', priority: 'normal', done: false, dueAt: daysFromNow(0, 13), relatedRef: 'E01052' },
  { id: 'h-09', title: 'Ship Sea-Dweller 126600 to Oliver Pemberton — insured FedEx', ownerShortName: 'Vienna', priority: 'high', done: true, dueAt: daysFromNow(0, 10), relatedRef: 'JOB-26-0219' },
  { id: 'h-10', title: 'Weekly bench calibration log — timing machine #2', ownerShortName: 'MM', priority: 'low', done: false, dueAt: daysFromNow(2, 9) },
];
