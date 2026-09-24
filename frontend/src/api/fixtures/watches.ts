import type { Watch } from '../types';
import { daysAgo } from './time';

export const watches: Watch[] = [
  { id: 'w-01', clientId: 'c-01', brand: 'Rolex', model: 'Submariner Date', reference: '126610LN', serial: '7F2K9R41', dial: 'Black', bracelet: 'Oyster', status: 'in_service', receivedAt: daysAgo(12) },
  { id: 'w-02', clientId: 'c-02', brand: 'Rolex', model: 'Cosmograph Daytona', reference: '116500LN', serial: 'M3Q8T2L7', dial: 'White', bracelet: 'Oyster', status: 'awaiting_approval', receivedAt: daysAgo(5) },
  { id: 'w-03', clientId: 'c-03', brand: 'Rolex', model: 'Datejust 41', reference: '126334', serial: 'K9D4W6P1', dial: 'Blue', bracelet: 'Jubilee', status: 'awaiting_pickup', receivedAt: daysAgo(20) },
  { id: 'w-04', clientId: 'c-04', brand: 'Rolex', model: 'Day-Date 40', reference: '228238', serial: 'X1R7N3B8', dial: 'Champagne', bracelet: 'President', status: 'in_service', receivedAt: daysAgo(9) },
  { id: 'w-05', clientId: 'c-05', brand: 'Rolex', model: 'Explorer', reference: '124270', serial: 'B6L2H9V4', dial: 'Black', bracelet: 'Oyster', status: 'intake', receivedAt: daysAgo(1) },
  { id: 'w-06', clientId: 'c-06', brand: 'Rolex', model: 'GMT-Master II', reference: '126711CHNR', serial: 'P4M8Q1Z6', dial: 'Black', bracelet: 'Oyster', status: 'awaiting_parts', receivedAt: daysAgo(31) },
  { id: 'w-07', clientId: 'c-07', brand: 'Rolex', model: 'Submariner Date', reference: '116610LV', serial: 'G2T5K7R9', dial: 'Green', bracelet: 'Oyster', status: 'qc', receivedAt: daysAgo(16) },
  { id: 'w-08', clientId: 'c-08', brand: 'Rolex', model: 'Submariner', reference: '114060', serial: 'V8N1C4J3', dial: 'Black', bracelet: 'Oyster', status: 'awaiting_approval', receivedAt: daysAgo(4) },
  { id: 'w-09', clientId: 'c-09', brand: 'Rolex', model: 'Submariner Date', reference: '16610', serial: 'Y528634', dial: 'Black', bracelet: 'Oyster', status: 'in_service', receivedAt: daysAgo(22) },
  { id: 'w-10', clientId: 'c-10', brand: 'Rolex', model: 'Oyster Perpetual 41', reference: '124300', serial: 'D7W3F9K2', dial: 'Turquoise', bracelet: 'Oyster', status: 'released', receivedAt: daysAgo(40) },
  { id: 'w-11', clientId: 'c-11', brand: 'Tudor', model: 'Black Bay GMT', reference: 'M79830RB-0001', serial: 'J5R2T81C', dial: 'Black', bracelet: 'Steel', status: 'in_service', receivedAt: daysAgo(7) },
  { id: 'w-12', clientId: 'c-12', brand: 'Tudor', model: 'Black Bay Fifty-Eight', reference: 'M79030N-0001', serial: 'H8K4M27Q', dial: 'Black', bracelet: 'Rivet', status: 'awaiting_pickup', receivedAt: daysAgo(18) },
  { id: 'w-13', clientId: 'c-13', brand: 'Tudor', model: 'Pelagos', reference: 'M25600TN-0001', serial: 'L3N9P62X', dial: 'Black', bracelet: 'Titanium', status: 'intake', receivedAt: daysAgo(2) },
  { id: 'w-14', clientId: 'c-14', brand: 'Tudor', model: 'Black Bay Chrono', reference: 'M79360N-0002', serial: 'T6Q1W48V', dial: 'Black', bracelet: 'Steel', status: 'awaiting_approval', receivedAt: daysAgo(6) },
  { id: 'w-15', clientId: 'c-15', brand: 'Rolex', model: 'Sea-Dweller', reference: '126600', serial: 'R9B4S7E2', dial: 'Black', bracelet: 'Oyster', status: 'released', receivedAt: daysAgo(35) },
  // Expected — estimate exists, watch not yet received through Intake
  { id: 'w-16', clientId: 'c-18', brand: 'Rolex', model: 'Lady-Datejust', reference: '279174', serial: 'N4K8P2W7', dial: 'Silver', bracelet: 'Jubilee', status: 'expected', receivedAt: daysAgo(0) },
  { id: 'w-17', clientId: 'c-16', brand: 'Tudor', model: 'Black Bay 41', reference: 'M79540-0001', serial: 'Q7M3R95T', dial: 'Black', bracelet: 'Steel', status: 'expected', receivedAt: daysAgo(0) },
  { id: 'w-19', clientId: 'c-20', brand: 'Rolex', model: 'Datejust 36', reference: '126234', serial: 'F7C2N81K', dial: 'Mint green', bracelet: 'Jubilee', status: 'expected', receivedAt: daysAgo(0) },
  { id: 'w-18', clientId: 'c-19', brand: 'Rolex', model: 'Yacht-Master 40', reference: '126622', serial: 'S2H6V8D4', dial: 'Rhodium', bracelet: 'Oyster', status: 'expected', receivedAt: daysAgo(0) },
];
