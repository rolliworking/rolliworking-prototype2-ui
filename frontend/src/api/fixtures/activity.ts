import type { ActivityEvent } from '../types';
import { hoursAgo } from './time';

export const activity: ActivityEvent[] = [
  { id: 'a-01', type: 'package_received', message: 'Package received — Explorer 124270 from Jonathan Okafor', actor: 'Vienna', timestamp: hoursAgo(1) },
  { id: 'a-02', type: 'estimate_sent', message: 'Estimate EST-26-1048 sent to Isabella Ferrante', actor: 'Walter', timestamp: hoursAgo(2.5) },
  { id: 'a-03', type: 'job_completed', message: 'Job JOB-26-0219 completed — Sea-Dweller 126600 full service', actor: 'MM', timestamp: hoursAgo(4) },
  { id: 'a-04', type: 'estimate_viewed', message: 'Eleanor Vance opened estimate EST-26-1042', actor: 'System', timestamp: hoursAgo(5) },
  { id: 'a-05', type: 'job_started', message: 'Job JOB-26-0220 started — Black Bay GMT bracelet work', actor: 'A. Reyes', timestamp: hoursAgo(7) },
  { id: 'a-06', type: 'photo_uploaded', message: '6 inspection photos added — Day-Date 228238', actor: 'MH', timestamp: hoursAgo(9) },
  { id: 'a-07', type: 'pickup', message: 'Watch released — Oyster Perpetual 124300 picked up by Naomi Castellanos', actor: 'Vienna', timestamp: hoursAgo(26) },
  { id: 'a-08', type: 'parts_ordered', message: 'Parts order PO-2231 placed — GMT-Master II mainspring', actor: 'Walter', timestamp: hoursAgo(30) },
  { id: 'a-09', type: 'estimate_declined', message: 'Estimate EST-26-1050 declined by Naomi Castellanos', actor: 'System', timestamp: hoursAgo(33) },
  { id: 'a-10', type: 'qc_passed', message: 'QC passed — Submariner 116610LV', actor: 'MH', timestamp: hoursAgo(50) },
];
