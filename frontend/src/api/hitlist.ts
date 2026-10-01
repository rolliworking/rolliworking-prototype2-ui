import { directReports, hitlistBridge as b, logShare } from './client';
import { daysAgo } from './fixtures/time';
import { roleKind, ROLE_HOME } from '@/config/roles';
import type { Assignee, PackagePhoto, PinnedItem, Role, TodayRow, User } from './types';

// ---- Per-person Hitlist — slug URLs, inbox (messages + photos sent to you), "flag to" from photo capture, supervisor team rollup, home-screen preference ----
export const slugOf = (u: User) => u.firstName.toLowerCase();
export const userBySlug = (slug: string): User | undefined => b.users().find((u) => slugOf(u) === slug.toLowerCase() || u.shortName.toLowerCase() === slug.toLowerCase());
export const hitlistPath = (u: User) => `/hitlist/${slugOf(u)}`;

// Supervisors and the roles they roll up. MM = watchmaker-room supervisor with band/polish OVERSIGHT (read-only on band rows); JV = band/polish supervisor.
export const TEAM_MAP: Record<string, { roles: Role[]; label: string; readOnlyRoles?: Role[] }> = {
  MM: { roles: ['watchmaker', 'band_tech', 'polisher'], label: 'Watchmaker room · band / polish oversight', readOnlyRoles: ['band_tech', 'polisher'] },
  JV: { roles: ['band_tech', 'polisher'], label: 'Workshop · band / polish' },
};
// Org tree (User.reportsTo) is the source: a tech's supervisor is the manager they report to, plus anyone with read-only oversight of their roles (MM over band / polish)
export const supervisorOf = (tech: User): User[] => (isTech(tech) ? b.users().filter((s) => s.id !== tech.id && (tech.reportsTo === s.id || TEAM_MAP[s.shortName]?.readOnlyRoles?.some((r) => tech.roles.includes(r)))) : []);
export const teamRowReadOnly = (viewer: User, tech: User) => !!TEAM_MAP[viewer.shortName]?.readOnlyRoles?.some((r) => tech.roles.includes(r)) && !tech.roles.some((r) => !TEAM_MAP[viewer.shortName]!.readOnlyRoles!.includes(r) && TEAM_MAP[viewer.shortName]!.roles.includes(r));
// Who may open /hitlist/<slug>: the person, their supervisor(s), any manager tier, MH (also via View-as)
export const canViewHitlist = (viewer: User, target: User) => viewer.id === target.id || viewer.accessTier === 'manager' || supervisorOf(target).some((s) => s.id === viewer.id);
export const isSupervisor = (u: User | null | undefined) => !!u && (!!TEAM_MAP[u.shortName] || directReports(u.id).some(isTech));
// Techs only — other supervisors / managers never roll up into a team even when they carry a room role (JV is not on MM's team)
const isTech = (u: User) => u.accessTier !== 'manager' && !u.roles.includes('supervisor');
export const getTeam = (sup: User): User[] => { const t = TEAM_MAP[sup.shortName]; return b.users().filter((u) => u.id !== sup.id && isTech(u) && !u.disabled && (u.reportsTo === sup.id || !!t?.readOnlyRoles?.some((r) => u.roles.includes(r)))); };
export const teamLabel = (sup: User) => TEAM_MAP[sup.shortName]?.label ?? `Reports to ${sup.shortName}`;
export const teamPath = (u: User) => `${hitlistPath(u)}/team`;

// ---- Inbox --------------------------------------------------------------------------------------------------------
// One-shot directed messages (D-389): person / role / station. No threads — a reply is a new message back. Sender sees delivered → seen → done.
export type MessageStatus = 'delivered' | 'seen' | 'done';
export interface InboxItem { id: string; to: Assignee; from: string; text?: string; photo?: PackagePhoto; jobId?: string; pinnedId?: string; replyToId?: string; createdAt: string; station: string; readBy: string[]; seenAt?: string; claimedBy?: string; claimedAt?: string; doneBy?: string; doneAt?: string }
export interface InboxRow extends InboxItem { unread: boolean; status: MessageStatus; claimable: boolean; jobNumber?: string; jobLabel?: string }
export interface SentRow extends InboxItem { status: MessageStatus; toLabel: string; jobNumber?: string }
export const messageStatus = (m: InboxItem): MessageStatus => (m.doneAt ? 'done' : m.seenAt || m.readBy.length ? 'seen' : 'delivered');
const img = (seed: string): PackagePhoto => ({ id: `ibph-${seed}`, source: 'camera', dataUrl: `https://picsum.photos/seed/${seed}/640/480`, slot: 'workbench' });
// 12-message seed (MH 2026-09-30) across MM · JV · Leo · Dre · VC (Vienna) · CM (Chyna) — photos, two role-tagged queues, one station message, one reply pair
const inbox: InboxItem[] = [
  { id: 'ib-01', to: { type: 'user', shortName: 'JV' }, from: 'MM', text: 'Clasp weld on the Sub bracelet looks thin on the 6 o’clock side — your call before it goes back on the band bench.', photo: img('rs-clasp-weld'), jobId: 'j-05', createdAt: daysAgo(0, 8.7), station: 'Watchmaker Room', readBy: [] },
  { id: 'ib-02', to: { type: 'user', shortName: 'JV' }, from: 'Vienna', text: 'Client asked for brushed-only on the Explorer case sides. No high polish — ref finish https://www.rolex.com/watches/explorer', jobId: 'j-03', createdAt: daysAgo(0, 9.1), station: 'Front Desk 1', readBy: [] },
  { id: 'ib-03', to: { type: 'role', role: 'polisher' }, from: 'JV', text: 'Reference finish for the Oyster bracelet — match this grain. First to claim owns it.', photo: img('rs-oyster-grain'), jobId: 'j-05', createdAt: daysAgo(0, 10.2), station: 'Band Room', readBy: [] },
  { id: 'ib-04', to: { type: 'user', shortName: 'Dre' }, from: 'JV', text: 'Two stretched links between 4 and 6 — swap from the parts bin, don’t re-pin.', photo: img('rs-stretched-links'), jobId: 'j-05', createdAt: daysAgo(0, 11), station: 'Band Room', readBy: [] },
  { id: 'ib-05', to: { type: 'user', shortName: 'MM' }, from: 'Leo', text: 'Hairspring on the Lady-Datejust after QC fail — see the kink at the stud.', photo: img('rs-hairspring'), jobId: 'j-16', createdAt: daysAgo(0, 13.4), station: 'Bench 1', readBy: [] },
  { id: 'ib-06', to: { type: 'user', shortName: 'Leo' }, from: 'MM', text: 'Take the GMT next — parts landed this morning. /jobs/j-04', jobId: 'j-04', createdAt: daysAgo(0, 8.2), station: 'Watchmaker Room', readBy: ['Leo'], seenAt: daysAgo(0, 8.1) },
  { id: 'ib-07', to: { type: 'user', shortName: 'Chyna' }, from: 'Vienna', text: 'Calloway pickup at 3 — bracelet is in the finished tray, not the safe.', jobId: 'j-16', createdAt: daysAgo(1, 16), station: 'Front Desk 1', readBy: ['Chyna'], seenAt: daysAgo(1, 15.8), doneBy: 'Chyna', doneAt: daysAgo(1, 15.5) },
  { id: 'ib-08', to: { type: 'user', shortName: 'JV' }, from: 'Dre', text: 'Polish room QC tray — all six bracelets passed brush check.', photo: img('rs-qc-tray'), createdAt: daysAgo(0, 15.5), station: 'Polish Room', readBy: [] },
  { id: 'ib-09', to: { type: 'role', role: 'watchmaker' }, from: 'Chyna', text: 'Client on the phone asking for an ETA on 02031 — whoever has the head, one line back please.', jobId: 'j-30', createdAt: daysAgo(0, 9.9), station: 'Front Desk 2', readBy: [] },
  // WM-room kiosk ad-hoc photo: Leo documents pre-existing damage and tags Vienna; her reply pings Leo's bench iPad, not the kiosk
  { id: 'ib-10', to: { type: 'user', shortName: 'Vienna' }, from: 'Leo', text: 'Pre-existing scratch across the case back at 4 o’clock — photographed BEFORE I opened it. Logging so it isn’t pinned on the bench later.', photo: img('rs-caseback-scratch'), jobId: 'j-16', createdAt: daysAgo(0, 7.4), station: 'Watchmaker Room Kiosk', readBy: ['Vienna'], seenAt: daysAgo(0, 7.3) },
  { id: 'ib-11', to: { type: 'user', shortName: 'Leo' }, from: 'Vienna', text: 'Re: Pre-existing scratch — noted and logged on the job, you’re covered. Carry on.', jobId: 'j-16', replyToId: 'ib-10', createdAt: daysAgo(0, 7.1), station: 'Front Desk 1', readBy: [] },
  { id: 'ib-12', to: { type: 'station', stationId: 'st-01' }, from: 'JV', text: 'Calloway is picking up E02040 at 3 — the bracelet is in the finished tray, not the safe.', jobId: 'j-16', createdAt: daysAgo(0, 9.6), station: 'Band Room', readBy: [] },
  // One general Inbox (2026-10-01): "Share with staff" — MH forwards Calloway's client message (quoted + thread link) to JV; the link only resolves for MH / VC / CM
  { id: 'ib-13', to: { type: 'user', shortName: 'JV' }, from: 'MH', text: 'Client message — Robert Calloway · yesterday 1:00 PM:\n“Appreciated. Please keep the original inspection report handy — I would like to compare the before/after crown notes.”\nThread: /inbox?thread=cv-ib4 (opens for MH · VC · CM)\nJV — can you pull the E01871 crown notes before Leo opens it?', jobId: 'j-wr1', createdAt: daysAgo(0, 7.9), station: 'Front Desk 1', readBy: ['JV'], seenAt: daysAgo(0, 7.6) },
  { id: 'ib-14', to: { type: 'user', shortName: 'Nico' }, from: 'JV', text: 'Bin is at my bench — pull the Milgauss (02078) ticket first, it is due tomorrow.', jobId: 'j-b9', createdAt: daysAgo(0, 8.4), station: 'Band Room', readBy: ['Nico'], seenAt: daysAgo(0, 8.3), doneBy: 'Nico', doneAt: daysAgo(0, 8.0) },
  { id: 'ib-15', to: { type: 'user', shortName: 'MH' }, from: 'Chyna', text: 'Pemberton asked which strap we fitted at pickup — I tagged the thread Update work order; can you check the E02019 pickup notes?', jobId: 'j-09', createdAt: daysAgo(0, 6.9), station: 'Front Desk 2', readBy: [] },
];
const jobRef = (jobId?: string) => { const j = jobId ? b.jobs().find((x) => x.id === jobId) : undefined; if (!j) return {}; const w = b.watches().find((x) => x.id === j.watchId); const c = b.clients().find((x) => x.id === j.clientId); return { jobNumber: j.number, jobLabel: `${c ? `${c.firstName} ${c.lastName}` : ''}${w ? ` · ${w.brand} ${w.model}` : ''}` }; };
// Role-tagged items are a CLAIMABLE QUEUE, not fan-out: every holder sees it until one claims it, then it is theirs alone
const visibleTo = (m: InboxItem, me: User) => b.matches(m.to, me) && (m.to.type !== 'role' || !m.claimedBy || m.claimedBy === me.shortName);
const row = (m: InboxItem, me: User): InboxRow => ({ ...m, unread: !m.readBy.includes(me.shortName), status: messageStatus(m), claimable: m.to.type === 'role' && !m.claimedBy && !m.doneAt, ...jobRef(m.jobId) });
export async function getInbox(userId: string): Promise<InboxRow[]> {
  const me = b.users().find((u) => u.id === userId); if (!me) return [];
  return inbox.filter((m) => visibleTo(m, me)).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((m) => row(m, me));
}
export async function markInboxRead(id: string, shortName: string, read = true): Promise<void> { const m = inbox.find((x) => x.id === id); if (!m) return; m.readBy = read ? Array.from(new Set([...m.readBy, shortName])) : m.readBy.filter((s) => s !== shortName); if (read && !m.seenAt) m.seenAt = new Date().toISOString(); }
export const unreadCount = (userId: string) => { const me = b.users().find((u) => u.id === userId); return me ? inbox.filter((m) => visibleTo(m, me) && !m.readBy.includes(me.shortName) && !m.doneAt).length : 0; };
// Claim a role-tagged message — it leaves everyone else's list; the pinned row follows
export async function claimMessage(id: string, shortName: string): Promise<InboxItem> {
  const m = inbox.find((x) => x.id === id); if (!m) throw new Error('Message not found'); if (m.to.type !== 'role') throw new Error('Only role-tagged messages are claimable'); if (m.claimedBy && m.claimedBy !== shortName) throw new Error(`Already claimed by ${m.claimedBy}`);
  m.claimedBy = shortName; m.claimedAt = new Date().toISOString(); m.readBy = Array.from(new Set([...m.readBy, shortName])); m.seenAt ??= m.claimedAt;
  const pin = b.pinned().find((x) => x.id === m.pinnedId); if (pin) pin.assignedTo = { type: 'user', shortName };
  b.audit(`Claimed #${m.to.role} message from ${m.from}${m.jobId ? ` · ${jobRef(m.jobId).jobNumber}` : ''}`); return m;
}
// Done = the recipient handled it; the sender sees "done", the pinned row clears
export async function markMessageDone(id: string, shortName: string, done = true): Promise<InboxItem> {
  const m = inbox.find((x) => x.id === id); if (!m) throw new Error('Message not found');
  if (done) { m.doneBy = shortName; m.doneAt = new Date().toISOString(); m.readBy = Array.from(new Set([...m.readBy, shortName])); m.seenAt ??= m.doneAt; } else { delete m.doneBy; delete m.doneAt; }
  const pin = b.pinned().find((x) => x.id === m.pinnedId); if (pin) { if (done) { pin.dismissedAt = m.doneAt; pin.dismissedBy = shortName; } else { delete pin.dismissedAt; delete pin.dismissedBy; } }
  if (m.jobId && done) b.jobStamp(m.jobId, `${shortName} marked ${m.from}'s message done`); return m;
}
// Sender's view — everything I sent, newest first, with delivered / seen / done
export async function getSent(shortName: string): Promise<SentRow[]> {
  return inbox.filter((m) => m.from === shortName).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((m) => ({ ...m, status: messageStatus(m), toLabel: m.to.type === 'role' ? `#${m.to.role}${m.claimedBy ? ` → ${m.claimedBy}` : ''}` : b.label(m.to).split(' →')[0], jobNumber: jobRef(m.jobId).jobNumber }));
}
// Newest unread row for me — feeds the 3-second banner (event detail first, this is the polling fallback)
export const inboxRowSync = (id: string, userId: string): InboxRow | null => { const me = b.users().find((u) => u.id === userId); const m = inbox.find((x) => x.id === id); return me && m && visibleTo(m, me) ? row(m, me) : null; };
export const latestUnread = (userId: string): InboxRow | null => { const me = b.users().find((u) => u.id === userId); if (!me) return null; const m = inbox.filter((x) => visibleTo(x, me) && !x.readBy.includes(me.shortName) && !x.doneAt).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]; return m ? row(m, me) : null; };
// Quick-send presets — tap, no typing (pads especially)
export const MESSAGE_PRESETS = ['Come to the front desk', 'Client is here for pickup', 'Client on the phone — need a status', 'Call me when you’re free', 'Ready for QC', 'Parts landed — yours is in', 'On my way', 'Give me 5 minutes', 'Yes', 'No'];
// Directory initials — front-desk tiles read VC / CM (D-392); everyone else uses the short name
const INITIALS: Record<string, string> = { Vienna: 'VC', Chyna: 'CM', Walter: 'WB', Leo: 'LEO' };
export const staffInitials = (u: User) => INITIALS[u.shortName] ?? (u.shortName.length <= 3 ? u.shortName.toUpperCase() : u.shortName.slice(0, 2).toUpperCase());
export const stationTargets = () => b.stations().filter((s) => s.id !== b.stationId() && !/kiosk/i.test(s.name));

// "Flag to" — a message/photo sent to a person or role lands in their Inbox AND as a Pinned row on their Hitlist
export interface FlagInput { id?: string; to: Assignee; text?: string; photo?: PackagePhoto; jobId?: string; from?: string; kind?: 'flag' | 'message'; replyToId?: string }
// Same-tab signal for the message bubble (unread badge + 3-second banner) — fires on every new inbox row
export const MESSAGE_EVENT = 'rollisuite:message';
// Fired after a thread-side change made from outside the Inbox page (e.g. a share logged from the bubble) so an open thread re-reads
export const INBOX_REFRESH_EVENT = 'rollisuite:inbox-refresh';
const announce = (item: InboxItem) => { try { window.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: item })); } catch { /* non-browser */ } };
// raw rows for system syncs (Concierge alerts) — idempotent ids like ib-swo-<swo>-<kind>
export const inboxRowsFor = () => inbox;
export async function flagToHitlist(input: FlagInput): Promise<{ inbox: InboxItem; pinned: PinnedItem }> {
  const a0 = b.actor(); const a = { ...a0, by: input.from ?? a0.by }; // kiosk: attribution = the job's watchmaker, not the station login
  if (!input.text?.trim() && !input.photo) throw new Error('Add a note or a photo');
  const j = input.jobId ? b.jobs().find((x) => x.id === input.jobId) : undefined;
  const item: InboxItem = { id: input.id ?? b.newId('ib'), to: input.to, from: a.by, text: input.text?.trim() || undefined, photo: input.photo, jobId: j?.id, replyToId: input.replyToId, createdAt: new Date().toISOString(), station: a.station, readBy: [] };
  const noun = input.kind === 'message' ? 'Message' : input.photo ? 'Photo' : 'Note'; const who = b.label(input.to).split(' →')[0];
  const pin: PinnedItem = { id: b.newId('pin'), title: `${noun} from ${a.by}${j ? ` · ${j.number}` : ''}${item.text ? ` — ${item.text.slice(0, 80)}` : ''}`, assignedTo: input.to, createdBy: a.by, division: b.division(), jobId: j?.id, inboxId: item.id, photo: input.photo, createdAt: item.createdAt, station: a.station };
  item.pinnedId = pin.id; inbox.unshift(item); b.pinned().unshift(pin); announce(item);
  b.audit(`${input.kind === 'message' ? 'Sent message' : `Flagged ${input.photo ? 'photo' : 'note'}`} to ${who}${input.to.type === 'role' ? ' (claimable)' : ''}${j ? ` · ${j.number}` : ''}`);
  if (j) b.jobStamp(j.id, `${noun} ${input.kind === 'message' ? 'sent' : 'flagged'} to ${who}${input.kind === 'message' ? ' (nudge — the job note is the record)' : "'s hit list"}`);
  return { inbox: item, pinned: pin };
}
// Send = one-shot directed message (person / #role / station). Lands as an inbox row + hitlist pin. No thread.
export const sendMessage = (input: Omit<FlagInput, 'kind'>) => flagToHitlist({ ...input, kind: 'message' });
// "Share with staff" (one general Inbox, 2026-10-01): a client message travels to staff as a one-shot message — QUOTED (name · date · text · photos) + the thread link
// (resolves only for MH / VC / CM; everyone else just sees the quote). Logged on the thread ("Shared with JV by MH").
export const quoteClientMessage = (m: { by: string; at: string; text: string; photos?: PackagePhoto[] }, conversationId: string) => `Client message — ${m.by} · ${new Date(m.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}:\n“${m.text.trim()}”${m.photos?.length ? `\n[${m.photos.length} photo${m.photos.length === 1 ? '' : 's'} attached]` : ''}\nThread: /inbox?thread=${conversationId} (opens for MH · VC · CM)`;
export async function shareClientMessage(input: { conversationId: string; messageId: string; to: Assignee[]; note?: string; quote: string; photo?: PackagePhoto; jobId?: string }): Promise<InboxItem[]> {
  if (!input.to.length) throw new Error('Pick at least one recipient');
  const text = `${input.quote}${input.note?.trim() ? `\n${input.note.trim()}` : ''}`;
  const out: InboxItem[] = []; for (const to of input.to) out.push((await sendMessage({ to, text, photo: input.photo, jobId: input.jobId })).inbox);
  await logShare(input.conversationId, input.messageId, input.to.map((t) => b.label(t).split(' →')[0]));
  try { window.dispatchEvent(new CustomEvent(INBOX_REFRESH_EVENT, { detail: { conversationId: input.conversationId } })); } catch { /* non-browser */ }
  return out;
}
// Super-admin folders (MH only, Internal tree): one folder per staff name — everything they sent, received, claimed or completed
export const staffFolders = (): { name: string; count: number }[] => { const first = ['MH', 'Vienna', 'Chyna']; return Array.from(new Set(b.users().filter((u) => !u.disabled).map((u) => u.shortName))).sort((x, y) => (first.includes(x) ? first.indexOf(x) : 99) - (first.includes(y) ? first.indexOf(y) : 99) || x.localeCompare(y)).map((name) => ({ name, count: allMessagesSync(name).length })); };
// Super-admin list (MH only): every staff one-shot message, newest first, with status + job + photo — read-only
export interface AllMessageRow extends InboxItem { status: MessageStatus; toLabel: string; jobNumber?: string; jobLabel?: string }
export const allMessagesSync = (staff?: string): AllMessageRow[] => inbox.filter((m) => !staff || m.from === staff || (m.to.type === 'user' && m.to.shortName === staff) || m.claimedBy === staff || m.doneBy === staff).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((m) => ({ ...m, status: messageStatus(m), toLabel: m.to.type === 'role' ? `#${m.to.role}${m.claimedBy ? ` → ${m.claimedBy}` : ''}` : b.label(m.to).split(' →')[0], ...jobRef(m.jobId) }));
export const messageStaffNames = (): string[] => Array.from(new Set(inbox.flatMap((m) => [m.from, m.to.type === 'user' ? m.to.shortName : '', m.claimedBy ?? '']).filter((s) => s && s !== 'Vonage' && s !== 'system'))).sort();
// Reply to an inbox message — lands in the ORIGINAL SENDER's inbox + hitlist (their bench iPad), never back at the shared kiosk it was sent from
export async function replyToInbox(inboxId: string, text: string, fromOverride?: string): Promise<InboxItem> {
  const orig = inbox.find((x) => x.id === inboxId); if (!orig) throw new Error('Message not found'); if (!text.trim()) throw new Error('Type a reply');
  const a = b.actor(); const from = fromOverride ?? a.by; const to: Assignee = { type: 'user', shortName: orig.from };
  const item: InboxItem = { id: b.newId('ib'), to, from, text: `Re: ${text.trim()}`, jobId: orig.jobId, replyToId: orig.id, createdAt: new Date().toISOString(), station: a.station, readBy: [] };
  const j = orig.jobId ? b.jobs().find((x) => x.id === orig.jobId) : undefined;
  const pin: PinnedItem = { id: b.newId('pin'), title: `Reply from ${from}${j ? ` · ${j.number}` : ''} — ${text.trim().slice(0, 80)}`, assignedTo: to, createdBy: from, division: b.division(), jobId: j?.id, inboxId: item.id, createdAt: item.createdAt, station: a.station };
  item.pinnedId = pin.id; inbox.unshift(item); b.pinned().unshift(pin); announce(item);
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
export const homeRouteFor = (u: User): string => { const rk = roleKind(u); if (rk === 'watchmaker' || rk === 'supervisor') return ROLE_HOME[rk]; const h = getHomeScreen(u.id); return h === 'team' && isSupervisor(u) ? teamPath(u) : h !== 'default' ? hitlistPath(u) : '/'; };
