import type { User } from '@/api/types';

// One sign-in, five homes — the ROLE decides the view, never the device (D-353). band_tech covers band techs AND polishers for now (a polisher kind comes only if the polish room gets its own screen).
export type RoleKind = 'watchmaker' | 'band_tech' | 'supervisor' | 'concierge' | 'manager';
const BAND_ROLES = ['polisher', 'band_tech'];
export const roleKind = (u: Pick<User, 'roles' | 'accessTier'>): RoleKind => {
  const band = u.roles.some((r) => BAND_ROLES.includes(r)); const wm = u.roles.includes('watchmaker');
  if (u.roles.includes('supervisor') || u.accessTier === 'supervisor' || (u.accessTier === 'manager' && (band || wm))) return 'supervisor';
  if (u.accessTier === 'manager') return 'manager';
  if (wm) return 'watchmaker';
  if (band) return 'band_tech';
  return 'concierge';
};
export const ROLE_HOME: Record<RoleKind, string> = { watchmaker: '/rw/bench', band_tech: '/rw/band', supervisor: '/rw/pad', concierge: '/', manager: '/' };
export const ROLE_LABEL: Record<RoleKind, string> = { watchmaker: 'Watchmaker', band_tech: 'Band / polish tech', supervisor: 'Supervisor', concierge: 'Concierge', manager: 'Owner / manager' };
export const homeFor = (u: Pick<User, 'roles' | 'accessTier'>) => ROLE_HOME[roleKind(u)];

// Route guards — evaluated on route load, before any data fetch. Desktop = everything outside /rw and /rc.
export const desktopAllowed = (k: RoleKind) => k !== 'watchmaker' && k !== 'band_tech';
export const rwAllowed = (k: RoleKind) => k !== 'concierge';
export const padAllowed = (k: RoleKind) => k === 'supervisor' || k === 'manager';
// Supervisor actions (assign, reassign, stage moves) — manager tier or the supervisor role (MM is concierge tier but supervises)
export const canSupervise = (u: Pick<User, 'roles' | 'accessTier'>) => u.accessTier === 'manager' || u.accessTier === 'supervisor' || u.roles.includes('supervisor');
// Team colour families (MM's merged view): W = watchmakers, B·P = band / polish. Never colour alone — always paired with the chip text.
export const teamFamily = (u: Pick<User, 'roles'>): 'W' | 'B·P' | null => (u.roles.includes('watchmaker') ? 'W' : u.roles.some((r) => BAND_ROLES.includes(r)) ? 'B·P' : null);
export const FAMILY_TONE: Record<'W' | 'B·P', string> = { W: 'bg-sky-100 text-sky-900 ring-sky-300', 'B·P': 'bg-orange-100 text-orange-900 ring-orange-300' };

// One general Inbox (MH 2026-10-01): only MH · VC · CM message clients; everyone else never sees client threads (they get the quote via "Share with staff")
export const CLIENT_COMMS_SHORTNAMES = ['MH', 'Vienna', 'Chyna'];
export const canClientComms = (u?: User | null) => !!u && (CLIENT_COMMS_SHORTNAMES.includes(u.shortName) || u.id === 'u-michael');
