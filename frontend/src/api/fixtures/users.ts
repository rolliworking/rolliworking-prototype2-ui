import type { User } from '../types';

// Prototype credentials (intentionally visible on screen): password = firstname123, PIN = 1234
export const users: User[] = [
  {
    id: 'u-michael',
    roles: ['manager', 'inspector'],
    firstName: 'michael',
    shortName: 'MH',
    displayName: 'MH — Inspector · Manager',
    dutyLabel: 'Inspector',
    accessTier: 'manager',
    password: 'michael123',
    pin: '1234',
  },
  {
    id: 'u-walter',
    roles: ['manager', 'inspector'],
    firstName: 'walter',
    shortName: 'Walter',
    displayName: 'Walter — Inspector · Manager',
    dutyLabel: 'Inspector',
    accessTier: 'manager',
    password: 'walter123',
    pin: '1234',
  },
  {
    id: 'u-vienna',
    roles: ['concierge'],
    firstName: 'vienna',
    shortName: 'Vienna',
    displayName: 'Vienna — Concierge · Admin assistant',
    dutyLabel: 'Concierge · Admin assistant',
    accessTier: 'concierge',
    password: 'vienna123',
    pin: '1234',
  },
  {
    id: 'u-mm',
    roles: ['manager', 'watchmaker'],
    firstName: 'mm',
    shortName: 'MM',
    displayName: 'MM — Watchmaker Room Supervisor · Manager',
    dutyLabel: 'Watchmaker Room Supervisor',
    accessTier: 'manager',
    password: 'mm123',
    pin: '1234',
  },
];
