import type { User } from '../types';

export const users: User[] = [
  {
    id: 'u-michael',
    badgeCode: 'michael',
    shortName: 'MH',
    displayName: 'MH — Inspector · Manager',
    dutyLabel: 'Inspector',
    accessTier: 'manager',
  },
  {
    id: 'u-walter',
    badgeCode: 'walter',
    shortName: 'Walter',
    displayName: 'Walter — Inspector · Manager',
    dutyLabel: 'Inspector',
    accessTier: 'manager',
  },
  {
    id: 'u-vienna',
    badgeCode: 'vienna',
    shortName: 'Vienna',
    displayName: 'Vienna — Concierge · Admin assistant',
    dutyLabel: 'Concierge · Admin assistant',
    accessTier: 'concierge',
  },
  {
    id: 'u-mm',
    badgeCode: 'mm',
    shortName: 'MM',
    displayName: 'MM — Watchmaker Room Supervisor · Manager',
    dutyLabel: 'Watchmaker Room Supervisor',
    accessTier: 'manager',
  },
];
