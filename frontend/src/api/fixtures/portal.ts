import type { Message } from '../types';
import { daysAgo } from './time';

// RolliConnect message threads — one per client; staff replies also queue an Outbox email
export const messages: Message[] = [
  { id: 'msg-01', clientId: 'c-01', watchId: 'w-01', from: 'client', by: 'Harrison Whitfield', text: 'Hi — just checking whether the Submariner is still on track for the end of the month? Travelling on the 2nd.', at: daysAgo(3, 19), readByStaff: true, readByClient: true },
  { id: 'msg-02', clientId: 'c-01', watchId: 'w-01', from: 'staff', by: 'Vienna', text: 'Hello Harrison — yes, MM has the movement uncased and the mainspring is being replaced under the service. We expect final checks early next week, well before the 2nd. We’ll message you here the moment it clears QC.', at: daysAgo(3, 9), readByStaff: true, readByClient: false },
  { id: 'msg-03', clientId: 'c-14', watchId: 'w-14', from: 'client', by: 'Grace Nakamura', text: 'Could someone else collect the watch for me if I can’t make it Saturday? My husband, Ken.', at: daysAgo(0, 8), readByStaff: false, readByClient: true },
];
