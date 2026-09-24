import type { Station } from '../types';

export const stations: Station[] = [
  { id: 'st-01', name: 'Front Desk 1' },
  { id: 'st-02', name: 'Front Desk 2' },
  { id: 'st-03', name: 'Inspection Bench' },
  { id: 'st-04', name: 'Watchmaker Room' },
  { id: 'st-05', name: 'Shipping' },
];

// The device this prototype runs on is mocked as already registered to this station.
export const PREREGISTERED_STATION_ID = 'st-01';
