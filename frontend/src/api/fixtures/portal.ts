import type { Message } from '../types';
import { daysAgo } from './time';

// RolliConnect message threads — one per client; staff replies also record a Sent email
export const messages: Message[] = [
  // Robert Calloway — R1 final messages (history), R3 open thread, R4 new web request awaiting first reply
  { id: 'msg-r1a', clientId: 'c-30', watchId: 'w-40', from: 'staff', by: 'Vienna', text: 'Robert — the Submariner has cleared QC and is ready for collection. Your pickup code is in the invoice email.', at: daysAgo(351, 12), readByStaff: true, readByClient: true },
  { id: 'msg-r1b', clientId: 'c-30', watchId: 'w-40', from: 'client', by: 'Robert Calloway', text: 'Collected today — it looks brand new. Thank you all.', at: daysAgo(349, 15), readByStaff: true, readByClient: true },
  { id: 'msg-r3a', clientId: 'c-30', watchId: 'w-42', from: 'client', by: 'Robert Calloway', text: 'Quick one on the Datejust — is the new crystal the same domed profile as the original?', at: daysAgo(6, 18), readByStaff: true, readByClient: true },
  { id: 'msg-r3b', clientId: 'c-30', watchId: 'w-42', from: 'staff', by: 'MH', text: 'Yes — genuine flat sapphire with the cyclops, identical to what came off. It is on order from RSC; the movement service continues meanwhile so no time is lost.', at: daysAgo(5, 10), readByStaff: true, readByClient: true },
  { id: 'msg-r4', clientId: 'c-30', from: 'client', by: 'Robert Calloway', text: 'Sent a request through the website about my Explorer II (226570) — date jumps two days at midnight. Happy to drop it off whenever suits.', at: daysAgo(0, 7), readByStaff: false, readByClient: true },
  { id: 'msg-01', clientId: 'c-01', watchId: 'w-01', from: 'client', by: 'Harrison Whitfield', text: 'Hi — just checking whether the Submariner is still on track for the end of the month? Travelling on the 2nd.', at: daysAgo(3, 19), readByStaff: true, readByClient: true },
  { id: 'msg-02', clientId: 'c-01', watchId: 'w-01', from: 'staff', by: 'Vienna', text: 'Hello Harrison — yes, MM has the movement uncased and the mainspring is being replaced under the service. We expect final checks early next week, well before the 2nd. We’ll message you here the moment it clears QC.', at: daysAgo(3, 9), readByStaff: true, readByClient: false },
  { id: 'msg-03', clientId: 'c-14', watchId: 'w-14', from: 'client', by: 'Grace Nakamura', text: 'Could someone else collect the watch for me if I can’t make it Saturday? My husband, Ken.', at: daysAgo(0, 8), readByStaff: false, readByClient: true },
];
