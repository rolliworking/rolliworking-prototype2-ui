import type { Station } from '../types';

export const stations: Station[] = [
  { id: 'st-01', name: 'Front Desk 1',    division: 'rolliworks' },
  { id: 'st-02', name: 'Front Desk 2',    division: 'rolliworks' },
  { id: 'st-03', name: 'Inspection Bench',division: 'rolliworks' },
  { id: 'st-04', name: 'Watchmaker Room', division: 'rolliworks' },
  { id: 'st-05', name: 'Shipping',        division: 'rolliworks' },
  { id: 'st-rs', name: 'RS Counter',      division: 'rollishop'  },
];

// The device this prototype runs on is mocked as already registered to this station.
export const PREREGISTERED_STATION_ID = 'st-01';
