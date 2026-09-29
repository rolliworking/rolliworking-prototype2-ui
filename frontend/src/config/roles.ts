import type { User } from '@/api/types';

// One sign-in, four homes — the ROLE decides the view, never the device (D-353 landing / guarding)
export type RoleKind = 'watchmaker' | 'supervisor' | 'concierge' | 'manager';
const ROOM_ROLES = ['watchmaker', 'polisher', 'band_tech'];
export const roleKind = (u: Pick<User, 'roles' | 'accessTier'>): RoleKind => {
  const room = u.roles.some((r) => ROOM_ROLES.includes(r));
  if (u.accessTier === 'manager') return room ? 'supervisor' : 'manager';
  return room ? 'watchmaker' : 'concierge';
};
export const ROLE_HOME: Record<RoleKind, string> = { watchmaker: '/rw/bench', supervisor: '/rw/pad', concierge: '/', manager: '/' };
export const ROLE_LABEL: Record<RoleKind, string> = { watchmaker: 'Watchmaker', supervisor: 'Supervisor', concierge: 'Concierge', manager: 'Owner / manager' };
export const homeFor = (u: Pick<User, 'roles' | 'accessTier'>) => ROLE_HOME[roleKind(u)];

// Route guards — evaluated on route load, before any data fetch. Desktop = everything outside /rw and /rc.
export const desktopAllowed = (k: RoleKind) => k !== 'watchmaker';
export const rwAllowed = (k: RoleKind) => k !== 'concierge';
export const padAllowed = (k: RoleKind) => k === 'supervisor' || k === 'manager';
