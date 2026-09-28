import { hitlistBridge as b } from './client';
import { daysAgo } from './fixtures/time';
import type { Assignee, PackagePhoto, PinnedItem, Role, TodayRow, User } from './types';

// ---- Per-person Hitlist — slug URLs, inbox (messages + photos sent to you), "flag to" from photo capture, supervisor team rollup, home-screen preference ----
export const slugOf = (u: User) => u.firstName.toLowerCase();
export const userBySlug = (slug: string): User | undefined => b.users().find((u) => slugOf(u) === slug.toLowerCase() || u.shortName.toLowerCase() === slug.toLowerCase());
export const hitlistPath = (u: User) => `/hitlist/${slugOf(u)}`;

// Supervisors and the roles they roll up
export const TEAM_MAP: Record<string, { roles: Role[]; label: string }> = {
  Joseph: { roles: ['band_tech', 'polisher'], label: 'Band / Polish room' },
  MM: { roles: ['watchmaker'], label: 'Watchmaker room' },
};
export const isSupervisor = (u: User | null | undefined) => !!u && !!TEAM_MAP[u.shortName];
export const getTeam = (sup: User): User[] => { const t = TEAM_MAP[sup.shortName]; return t ? b.users().filter((u) => u.id !== sup.id && (u.division === 'both' || u.division === sup.division || sup.division === 'both') && u.roles.some((r) => t.roles.includes(r))) : []; };
export const teamPath = (u: User) => `${hitlistPath(u)}/team`;

// ---- Inbox --------------------------------------------------------------------------------------------------------
export interface InboxItem { id: string; to: Assignee; from: string; text?: string; photo?: PackagePhoto; jobId?: string; pinnedId?: string; replyToId?: string; createdAt: string; station: string; readBy: string[] }
export interface InboxRow extends InboxItem { unread: boolean; jobNumber?: string; jobLabel?: string }
const img = (seed: string): PackagePhoto => ({ id: `ibph-${seed}`, source: 'camera', dataUrl: `https://picsum.photos/seed/${seed}/640/480`, slot: 'workbench' });
const inbox: InboxItem[] = [
  { id: 'ib-01', to: { type: 'user', shortName: 'Joseph' }, from: 'MM', text: 'Clasp weld on the Sub bracelet looks thin on the 6 o’clock side — your call before Sam re-pins it.', photo: img('rs-clasp-weld'), jobId: 'j-05', createdAt: daysAgo(0, 8.7), station: 'Watchmaker Room', readBy: [] },
  { id: 'ib-02', to: { type: 'user', shortName: 'Joseph' }, from: 'MH', text: 'Client asked for brushed-only on the Explorer case sides. No high polish.', jobId: 'j-03', createdAt: daysAgo(0, 9.1), station: 'Front Desk 1', readBy: [] },
  { id: 'ib-03', to: { type: 'role', role: 'polisher' }, from: 'Walter', text: 'Reference finish for the Oyster bracelet — match this grain.', photo: img('rs-oyster-grain'), jobId: 'j-05', createdAt: daysAgo(0, 10.2), station: 'Inspection Bench', readBy: [] },
  { id: 'ib-04', to: { type: 'user', shortName: 'Sam' }, from: 'Joseph', text: 'Two stretched links between 4 and 6 — swap from the parts bin, don’t re-pin.', photo: img('rs-stretched-links'), jobId: 'j-05', createdAt: daysAgo(0, 11), station: 'Band Room', readBy: [] },
  { id: 'ib-05', to: { type: 'user', shortName: 'MM' }, from: 'Leo', text: 'Hairspring on the Lady-Datejust after QC fail — see the kink at the stud.', photo: img('rs-hairspring'), jobId: 'j-16', createdAt: daysAgo(0, 13.4), station: 'Bench 1', readBy: [] },
  { id: 'ib-06', to: { type: 'user', shortName: 'Leo' }, from: 'MM', text: 'Take the GMT next — parts landed this morning.', jobId: 'j-04', createdAt: daysAgo(0, 8.2), station: 'Watchmaker Room', readBy: ['Leo'] },
  { id: 'ib-07', to: { type: 'user', shortName: 'Vienna' }, from: 'MH', text: 'Receipt printer paper — order two cases, not one.', createdAt: daysAgo(1, 16), station: 'Front Desk 1', readBy: ['Vienna'] },
  { id: 'ib-08', to: { type: 'user', shortName: 'MH' }, from: 'Joseph', text: 'Polish room QC tray — all six bracelets passed brush check.', photo: img('rs-qc-tray'), createdAt: daysAgo(0, 15.5), station: 'Polish Room', readBy: [] },
  { id: 'ib-09', to: { type: 'user', shortName: 'Dre' }, from: 'Joseph', text: 'Clasp + end links on E02013 — satin, then hand to Sam.', photo: img('rs-clasp-satin'), jobId: 'j-03', createdAt: daysAgo(0, 8.1), station: 'Polish Room', readBy: [] },
  // WM-room kiosk ad-hoc photo: Leo documents pre-existing damage on E02026 and tags @MH; MH's reply pings Leo's bench iPad, not the kiosk
  { id: 'ib-10', to: { type: 'user', shortName: 'MH' }, from: 'Leo', text: 'Pre-existing scratch across the case back at 4 o’clock — photographed BEFORE I opened it. Logging so it isn’t pinned on the bench later.', photo: img('rs-caseback-scratch'), jobId: 'j-16', createdAt: daysAgo(0, 7.4), station: 'Watchmaker Room Kiosk', readBy: ['MH'] },
  { id: 'ib-11', to: { type: 'user', shortName: 'Leo' }, from: 'MH', text: 'Re: Pre-existing scratch — noted and logged on the job, you’re covered. Carry on.', jobId: 'j-16', replyToId: 'ib-10', createdAt: daysAgo(0, 7.1), station: 'Front Desk 1', readBy: [] },
];
const jobRef = (jobId?: string) => { const j = jobId ? b.jobs().find((x) => x.id === jobId) : undefined; if (!j) return {}; const w = b.watches().find((x) => x.id === j.watchId); const c = b.clients().find((x) => x.id === j.clientId); return { jobNumber: j.number, jobLabel: `${c ? `${c.firstName} ${c.lastName}` : ''}${w ? ` · ${w.brand} ${w.model}` : ''}` }; };
export async function getInbox(userId: string): Promise<InboxRow[]> {
  const me = b.users().find((u) => u.id === userId); if (!me) return [];
  return inbox.filter((m) => b.matches(m.to, me)).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((m) => ({ ...m, unread: !m.readBy.includes(me.shortName), ...jobRef(m.jobId) }));
}
export async function markInboxRead(id: string, shortName: string, read = true): Promise<void> { const m = inbox.find((x) => x.id === id); if (!m) return; m.readBy = read ? Array.from(new Set([...m.readBy, shortName])) : m.readBy.filter((s) => s !== shortName); }
export const unreadCount = (userId: string) => { const me = b.users().find((u) => u.id === userId); return me ? inbox.filter((m) => b.matches(m.to, me) && !m.readBy.includes(me.shortName)).length : 0; };

// "Flag to" — a message/photo sent to a person or role lands in their Inbox AND as a Pinned row on their Hitlist
export interface FlagInput { to: Assignee; text?: string; photo?: PackagePhoto; jobId?: string; from?: string }
export async function flagToHitlist(input: FlagInput): Promise<{ inbox: InboxItem; pinned: PinnedItem }> {
  const a0 = b.actor(); const a = { ...a0, by: input.from ?? a0.by }; // kiosk: attribution = the job's watchmaker, not the station login
  if (!input.text?.trim() && !input.photo) throw new Error('Add a note or a photo');
  const j = input.jobId ? b.jobs().find((x) => x.id === input.jobId) : undefined;
  const item: InboxItem = { id: b.newId('ib'), to: input.to, from: a.by, text: input.text?.trim() || undefined, photo: input.photo, jobId: j?.id, createdAt: new Date().toISOString(), station: a.station, readBy: [] };
  const pin: PinnedItem = { id: b.newId('pin'), title: `${input.photo ? 'Photo' : 'Note'} from ${a.by}${j ? ` · ${j.number}` : ''}${item.text ? ` — ${item.text.slice(0, 80)}` : ''}`, assignedTo: input.to, createdBy: a.by, division: b.division(), jobId: j?.id, inboxId: item.id, photo: input.photo, createdAt: item.createdAt, station: a.station };
  item.pinnedId = pin.id; inbox.unshift(item); b.pinned().unshift(pin);
  b.audit(`Flagged ${input.photo ? 'photo' : 'note'} to ${b.label(input.to).split(' →')[0]}${j ? ` · ${j.number}` : ''}`);
  if (j) b.jobStamp(j.id, `${input.photo ? 'Photo' : 'Note'} flagged to ${b.label(input.to).split(' →')[0]}'s hit list`);
  return { inbox: item, pinned: pin };
}
// Reply to an inbox message — lands in the ORIGINAL SENDER's inbox + hitlist (their bench iPad), never back at the shared kiosk it was sent from
export async function replyToInbox(inboxId: string, text: string, fromOverride?: string): Promise<InboxItem> {
  const orig = inbox.find((x) => x.id === inboxId); if (!orig) throw new Error('Message not found'); if (!text.trim()) throw new Error('Type a reply');
  const a = b.actor(); const from = fromOverride ?? a.by; const to: Assignee = { type: 'user', shortName: orig.from };
  const item: InboxItem = { id: b.newId('ib'), to, from, text: `Re: ${text.trim()}`, jobId: orig.jobId, replyToId: orig.id, createdAt: new Date().toISOString(), station: a.station, readBy: [] };
  const j = orig.jobId ? b.jobs().find((x) => x.id === orig.jobId) : undefined;
  const pin: PinnedItem = { id: b.newId('pin'), title: `Reply from ${from}${j ? ` · ${j.number}` : ''} — ${text.trim().slice(0, 80)}`, assignedTo: to, createdBy: from, division: b.division(), jobId: j?.id, inboxId: item.id, createdAt: item.createdAt, station: a.station };
  item.pinnedId = pin.id; inbox.unshift(item); b.pinned().unshift(pin);
  if (j) b.jobStamp(j.id, `${from} replied to ${orig.from}'s photo note — pinged ${orig.from}'s bench hitlist`);
  return item;
}

// ---- Supervisor rollup ----------------------------------------------------------------------------------------------
export interface TeamPinned extends PinnedItem { tech: User }
export interface TeamRow extends TodayRow { tech: User }
export interface TeamHitlist { supervisor: User; team: User[]; pinned: TeamPinned[]; rows: TeamRow[]; unread: Record<string, number> }
export async function getTeamHitlist(supervisorId: string): Promise<TeamHitlist> {
  const sup = b.users().find((u) => u.id === supervisorId); if (!sup) throw new Error('Unknown supervisor');
  const team = getTeam(sup); const pinned: TeamPinned[] = []; const rows: TeamRow[] = []; const seenPin = new Set<string>(); const seenRow = new Set<string>();
  for (const tech of team) { const v = await b.today(tech.id); v.pinned.forEach((p) => { if (!seenPin.has(p.id)) { seenPin.add(p.id); pinned.push({ ...p, tech }); } }); v.rows.forEach((r) => { if (!seenRow.has(r.id)) { seenRow.add(r.id); rows.push({ ...r, tech }); } }); }
  rows.sort((x, y) => Number(y.overdue) - Number(x.overdue) || Number(y.urgent) - Number(x.urgent) || (x.dueAt ?? '9').localeCompare(y.dueAt ?? '9'));
  return { supervisor: sup, team, pinned, rows, unread: Object.fromEntries(team.map((t) => [t.shortName, unreadCount(t.id)])) };
}
// Reassign a pinned row or a task to another team member (or role) — the row moves lists, audit keeps the trail
export async function reassign(input: { pinnedId?: string; taskId?: string; to: Assignee }): Promise<void> {
  const label = b.label(input.to).split(' →')[0];
  if (input.pinnedId) { const p = b.pinned().find((x) => x.id === input.pinnedId); if (!p) throw new Error('Pin not found'); const from = b.label(p.assignedTo).split(' →')[0]; p.assignedTo = input.to; b.audit(`Reassigned pin "${p.title.slice(0, 40)}" ${from} → ${label}`); if (p.inboxId) { const m = inbox.find((x) => x.id === p.inboxId); if (m) m.to = input.to; } return; }
  if (input.taskId) { const t = b.tasks().find((x) => x.id === input.taskId); if (!t) throw new Error('Task not found'); const from = b.label(t.assignedTo).split(' →')[0]; t.assignedTo = input.to; b.audit(`Reassigned task "${t.title.slice(0, 40)}" ${from} → ${label}`); if (t.jobId) b.jobStamp(t.jobId, `Task reassigned ${from} → ${label}`); return; }
  throw new Error('Nothing to reassign');
}

// ---- Home screen (per device + per user) -----------------------------------------------------------------------------
export type HomeScreen = 'default' | 'hitlist' | 'team';
const homeKey = (userId: string) => `rollisuite.home.${b.stationId()}.${userId}`;
export const getHomeScreen = (userId: string): HomeScreen => (localStorage.getItem(homeKey(userId)) as HomeScreen | null) ?? 'default';
export const setHomeScreen = (userId: string, v: HomeScreen) => { if (v === 'default') localStorage.removeItem(homeKey(userId)); else localStorage.setItem(homeKey(userId), v); };
export const homeRouteFor = (u: User): string => { const h = getHomeScreen(u.id); return h === 'team' && isSupervisor(u) ? teamPath(u) : h !== 'default' ? hitlistPath(u) : '/'; };
