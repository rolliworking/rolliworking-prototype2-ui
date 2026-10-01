// VONAGE SCREEN-POP + CALL LOG (MH 2026-09-30, D-315 mock). Vonage is MOCKED: src/api/telephony.ts feeds carrier events in here.
// This module owns the live-call state (ring → live → ended / missed / answered elsewhere) and the call ledger (one row per call).
// Recordings stay in Vonage (link only). No transcription in v1. Rating a/b/c + W·B·P dots are read from client.ts — never written here.
import { callsBridge as b, type WbpRow } from './client';
import type { CallDisposition, CallEvent, Client, ClientRating, Job, MissedCallRow, CallCounts } from './types';
import { flagToHitlist, inboxRowsFor, markMessageDone } from './hitlist';

const resolve = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 30));
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const digits = (p: string) => p.replace(/\D/g, '').slice(-10);
const clientByNumber = (n: string) => b.clients().find((c) => digits(c.phone) === digits(n));
const clientOf = (id?: string) => (id ? b.clients().find((c) => c.id === id) : undefined);
const nameOf = (id?: string) => { const c = clientOf(id); return c ? b.fullNameOf(c) : undefined; };
const callOf = (id: string) => { const c = b.calls().find((x) => x.id === id); if (!c) throw new Error('No such call'); return c; };
const isMissed = (c: CallEvent) => c.outcome === 'missed' || c.outcome === 'voicemail';
export const recordingUrl = (callId: string) => `https://app.vonage.com/recordings/${callId}`; // Vonage-hosted — never copied

// ---- Dispositions (one tap after hang-up) ----
export const DISPOSITIONS: { key: CallDisposition; label: string }[] = [
  { key: 'estimate_discussed', label: 'Estimate discussed' }, { key: 'approval_given', label: 'Approval given' }, { key: 'status_inquiry', label: 'Status inquiry' },
  { key: 'pickup_scheduled', label: 'Pickup scheduled' }, { key: 'voicemail', label: 'Voicemail' }, { key: 'missed', label: 'Missed' },
];
export const dispositionLabel = (d?: CallDisposition) => (d ? DISPOSITIONS.find((x) => x.key === d)?.label ?? d : undefined);

// ---- Live sessions (what the pop renders) ----
export type CallPhase = 'ringing' | 'live' | 'ended' | 'missed' | 'answered_elsewhere';
export interface LiveCall { callId: string; phase: CallPhase; direction: 'in' | 'out'; number: string; clientId?: string; startedAt: string; answeredAt?: string; answeredBy?: string; answeredStation?: string; here?: boolean; endedAt?: string; durationSec?: number; voicemail?: boolean; jobId?: string; note?: string; dismissed?: boolean }
const live = new Map<string, LiveCall>();
export const CALLS_EVENT = 'rollisuite:call';
type Listener = (call: LiveCall | null) => void;
const listeners = new Set<Listener>();
export const subscribeCalls = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
const emit = (call: LiveCall | null) => { listeners.forEach((l) => l(call)); try { window.dispatchEvent(new CustomEvent(CALLS_EVENT, { detail: call })); } catch { /* non-browser */ } };
export const liveCallsSync = (): LiveCall[] => [...live.values()].sort((x, y) => y.startedAt.localeCompare(x.startedAt));
export const liveCallSync = (callId: string) => live.get(callId);
export const activeCallSync = (): LiveCall | undefined => liveCallsSync().find((c) => c.phase === 'ringing' || c.phase === 'live');

// ---- Carrier events (telephony.ts → here). Every event also lands on the ledger + the client's comms history. ----
export const callRinging = (input: { number: string; at?: string; callId?: string }): LiveCall => {
  ensureSeed(); const at = input.at ?? new Date().toISOString(); const client = clientByNumber(input.number); const callId = input.callId ?? b.newId('call'); const a = b.actor();
  b.calls().unshift({ id: callId, at, direction: 'in', number: input.number, clientId: client?.id, station: a.station, outcome: 'ringing', notes: [], afterHours: b.isAfterHours(at) });
  const s: LiveCall = { callId, phase: 'ringing', direction: 'in', number: input.number, clientId: client?.id, startedAt: at }; live.set(callId, s); emit(s); return s;
};
export const callAnswered = (callId: string, by?: { by: string; station: string }): LiveCall => {
  const c = callOf(callId); const s = live.get(callId); if (!s || s.phase !== 'ringing') throw new Error('Call is not ringing'); const a = b.actor(); const who = by ?? { by: a.by, station: a.station }; const here = !by;
  const at = new Date().toISOString(); c.outcome = 'answered'; c.answeredBy = who.by; c.station = who.station;
  Object.assign(s, { phase: here ? 'live' : 'answered_elsewhere', here, answeredAt: at, answeredBy: who.by, answeredStation: who.station });
  if (c.clientId) b.threadEvent(c.clientId, undefined, who.by, `Inbound call from ${c.number} · answered by ${who.by} at ${who.station}`);
  b.audit(`Inbound call · ${nameOf(c.clientId) ?? `unknown ${c.number}`} · answered by ${who.by} at ${who.station}`); emit(s); return s;
};
export const callEnded = (callId: string): LiveCall => {
  const c = callOf(callId); const s = live.get(callId); if (!s) throw new Error('No live call'); if (s.phase !== 'live' && s.phase !== 'answered_elsewhere') throw new Error('Call is not live');
  const at = new Date().toISOString(); const dur = Math.max(1, Math.round((Date.now() - new Date(s.answeredAt ?? s.startedAt).getTime()) / 1000));
  c.endedAt = at; c.durationSec = dur; c.recordingUrl = recordingUrl(callId); if (s.jobId) c.jobId = s.jobId;
  if (s.note?.trim()) c.notes.push({ at, by: s.answeredBy ?? b.actor().by, text: s.note.trim() });
  Object.assign(s, { phase: 'ended', endedAt: at, durationSec: dur });
  if (c.clientId && s.direction === 'out') clearMissedFor(c.clientId, c.number, 'called_back', s.answeredBy ?? b.actor().by);
  if (c.clientId && s.note?.trim()) b.threadEvent(c.clientId, c.jobId, s.answeredBy ?? b.actor().by, `Call note · ${s.note.trim()}`);
  if (c.jobId && s.note?.trim()) b.jobStamp(c.jobId, `Call note by ${s.answeredBy ?? b.actor().by} · ${s.note.trim()}`);
  emit(s); return s;
};
export const callMissed = (callId: string, opts: { voicemail?: boolean } = {}): LiveCall => {
  const c = callOf(callId); const s = live.get(callId); if (!s) throw new Error('No live call'); if (s.phase !== 'ringing') throw new Error('Call is not ringing');
  c.outcome = opts.voicemail ? 'voicemail' : 'missed'; c.disposition = opts.voicemail ? 'voicemail' : 'missed'; c.endedAt = new Date().toISOString(); if (opts.voicemail) c.recordingUrl = recordingUrl(callId);
  Object.assign(s, { phase: 'missed', voicemail: opts.voicemail, endedAt: c.endedAt });
  if (c.clientId) b.threadEvent(c.clientId, undefined, 'system', `Missed call from ${c.number}${opts.voicemail ? ' · voicemail left' : ''}`);
  b.audit(`Inbound call · ${nameOf(c.clientId) ?? `unknown ${c.number}`} · ${c.outcome}`); missedInboxItem(c); emit(s); return s;
};
// UI bookkeeping on the session (never touches the ledger until hang-up)
export const setLiveNote = (callId: string, note: string) => { const s = live.get(callId); if (s) { s.note = note; } };
export const setLiveJob = (callId: string, jobId?: string) => { const s = live.get(callId); if (s) { s.jobId = jobId; const c = b.calls().find((x) => x.id === callId); if (c) c.jobId = jobId; emit(s); } };
export const dismissLive = (callId: string) => { const s = live.get(callId); if (s) { s.dismissed = true; emit(s); } };
export const undismissLive = (callId: string) => { const s = live.get(callId); if (s) { s.dismissed = false; emit(s); } };
export const clearLive = (callId: string) => { live.delete(callId); emit(null); };

// ---- Click-to-call / outbound (originates from the signed-in user's extension — mock connects at once) ----
export const startOutboundCall = (input: { clientId?: string; number?: string; jobId?: string }): LiveCall => {
  ensureSeed(); if (activeCallSync()) throw new Error('Already on a call — hang up first'); const client = clientOf(input.clientId) ?? (input.number ? clientByNumber(input.number) : undefined); const number = input.number ?? client?.phone; if (!number) throw new Error('No number to dial');
  const a = b.actor(); const at = new Date().toISOString(); const callId = b.newId('call');
  b.calls().unshift({ id: callId, at, direction: 'out', number, clientId: client?.id, answeredBy: a.by, station: a.station, outcome: 'answered', jobId: input.jobId, notes: [], afterHours: b.isAfterHours(at) });
  const s: LiveCall = { callId, phase: 'live', direction: 'out', number, clientId: client?.id, startedAt: at, answeredAt: at, answeredBy: a.by, answeredStation: a.station, here: true, jobId: input.jobId }; live.set(callId, s);
  if (client) b.threadEvent(client.id, input.jobId, a.by, `Outbound call to ${number} · ${a.by} from ${a.station}`);
  if (input.jobId) b.jobStamp(input.jobId, `Call to client placed by ${a.by} (click-to-call)`);
  b.audit(`Outbound call · ${client ? b.fullNameOf(client) : number} · ${a.by}`); emit(s); return s;
};

// ---- Disposition after hang-up. "Approval given" writes a PENDING add-on (phone approvals wait for portal / email confirmation — MH ruling b). ----
export async function setDisposition(callId: string, disposition: CallDisposition, extra: { jobId?: string; note?: string; approval?: { description: string; amount: number } } = {}): Promise<CallEvent> {
  const c = callOf(callId); const a = b.actor(); c.disposition = disposition; if (extra.jobId) c.jobId = extra.jobId;
  if (extra.note?.trim()) { c.notes.push({ at: new Date().toISOString(), by: a.by, text: extra.note.trim() }); if (c.clientId) b.threadEvent(c.clientId, c.jobId, a.by, `Call note · ${extra.note.trim()}`); }
  if (disposition === 'approval_given') {
    if (!c.jobId) throw new Error('Pick the job the approval was for'); if (!extra.approval?.description.trim()) throw new Error('What was approved?'); if (!(extra.approval.amount >= 0)) throw new Error('Amount must be 0 or more');
    await b.addAddon(c.jobId, { description: extra.approval.description, approver: nameOf(c.clientId) ?? 'Client', channel: 'phone', amount: extra.approval.amount, note: `Approved by phone · call taken by ${a.by} at ${clock(c.at)}`, pendingConfirmation: true });
  }
  if (c.jobId && disposition !== 'approval_given') b.jobStamp(c.jobId, `Call (${c.direction === 'in' ? 'inbound' : 'outbound'}) · ${dispositionLabel(disposition)} · ${a.by}`);
  if (c.clientId && disposition !== 'approval_given') b.threadEvent(c.clientId, c.jobId, a.by, `Call · ${dispositionLabel(disposition)}${c.durationSec ? ` · ${Math.round(c.durationSec / 60)} min` : ''}`);
  b.audit(`Call disposition · ${nameOf(c.clientId) ?? c.number} · ${dispositionLabel(disposition)}`); return resolve(c);
}
// Unmatched caller → attach to an existing client (the card re-renders as matched)
export const attachCallToClient = (callId: string, clientId: string): CallEvent => {
  const c = callOf(callId); const client = clientOf(clientId); if (!client) throw new Error('No such client'); c.clientId = clientId; const s = live.get(callId); if (s) { s.clientId = clientId; emit(s); }
  b.threadEvent(clientId, undefined, b.actor().by, `${c.direction === 'in' ? 'Inbound' : 'Outbound'} call from ${c.number} attached to this client`); b.audit(`Call attached · ${b.fullNameOf(client)} · ${c.number}`);
  const ib = inboxRowsFor().find((r) => r.id === `ib-call-${callId}`); if (ib) ib.text = missedText(c); return c;
};

// ---- Missed calls → front-desk role queue (claimable inbox item), cleared by an outbound call or a note ----
const missedText = (c: CallEvent) => `${c.outcome === 'voicemail' ? 'Voicemail' : 'Missed'} · ${nameOf(c.clientId) ?? `Unknown ${c.number}`} · ${clock(c.at)} · call back`;
const missedInboxItem = (c: CallEvent) => { const id = `ib-call-${c.id}`; if (!inboxRowsFor().some((r) => r.id === id)) void flagToHitlist({ id, to: { type: 'role', role: 'concierge' }, text: missedText(c), from: 'Vonage', kind: 'message' }); };
const closeMissedInbox = (c: CallEvent, by: string) => { const ib = inboxRowsFor().find((r) => r.id === `ib-call-${c.id}` && !r.doneAt); if (ib) void markMessageDone(ib.id, by); };
const clearMissedFor = (clientId: string, number: string, how: 'called_back' | 'handled', by: string) => { b.calls().filter((c) => isMissed(c) && !c.resolvedAt && (c.clientId === clientId || digits(c.number) === digits(number))).forEach((c) => { c.resolvedAt = new Date().toISOString(); c.resolvedBy = by; c.resolution = how; closeMissedInbox(c, by); }); };

// ---- Ledger reads / writes ----
export interface CallFilter { clientId?: string; jobId?: string; direction?: 'in' | 'out'; staff?: string; from?: string; to?: string; openMissedOnly?: boolean; missedOnly?: boolean; disposition?: CallDisposition; q?: string }
export async function getCallEvents(filter: CallFilter | string = {}): Promise<CallEvent[]> {
  ensureSeed(); const f: CallFilter = typeof filter === 'string' ? { clientId: filter } : filter; const q = f.q?.trim().toLowerCase();
  return resolve(b.calls().filter((c) => c.outcome !== 'ringing' && (!f.clientId || c.clientId === f.clientId) && (!f.jobId || c.jobId === f.jobId) && (!f.direction || c.direction === f.direction) && (!f.staff || c.answeredBy === f.staff) && (!f.from || c.at >= f.from) && (!f.to || c.at <= `${f.to}T23:59:59`) && (!f.openMissedOnly || (isMissed(c) && !c.resolvedAt)) && (!f.missedOnly || isMissed(c)) && (!f.disposition || c.disposition === f.disposition) && (!q || (nameOf(c.clientId) ?? '').toLowerCase().includes(q) || digits(c.number).includes(q.replace(/\D/g, '') || '§'))).sort((x, y) => y.at.localeCompare(x.at)));
}
export const callCountsSync = (clientId?: string, jobId?: string): CallCounts => { ensureSeed(); const rows = b.calls().filter((c) => c.outcome !== 'ringing' && (!clientId || c.clientId === clientId) && (!jobId || c.jobId === jobId)); const m = new Date().toISOString().slice(0, 7); const missed = rows.filter(isMissed); return { total: rows.length, thisMonth: rows.filter((c) => c.at.slice(0, 7) === m).length, missed: missed.length, openMissed: missed.filter((c) => !c.resolvedAt).length }; };
export async function getCallCounts(clientId?: string, jobId?: string): Promise<CallCounts> { return resolve(callCountsSync(clientId, jobId)); }
export const openMissedCountSync = () => callCountsSync().openMissed;
// Manual "+ Log call" for off-system calls (cell phone, walk-up) — same fields, marked manual
export async function logCall(input: { clientId: string; direction: 'in' | 'out'; durationSec?: number; jobId?: string; note?: string; at?: string; disposition?: CallDisposition }): Promise<CallEvent> {
  ensureSeed(); const a = b.actor(); const c = clientOf(input.clientId); if (!c) throw new Error('No such client'); const at = input.at ?? new Date().toISOString();
  const row: CallEvent = { id: b.newId('call'), at, direction: input.direction, number: c.phone, clientId: c.id, answeredBy: a.by, station: a.station, outcome: 'manual', durationSec: input.durationSec, jobId: input.jobId, disposition: input.disposition, notes: input.note?.trim() ? [{ at, by: a.by, text: input.note.trim() }] : [], afterHours: b.isAfterHours(at) };
  b.calls().unshift(row); b.threadEvent(c.id, input.jobId, a.by, `${input.direction === 'in' ? 'Inbound' : 'Outbound'} call (logged manually)${input.note ? ` · ${input.note.trim()}` : ''}`);
  if (input.jobId) b.jobStamp(input.jobId, `Call logged (manual, ${input.direction}) by ${a.by}${input.note ? ` · ${input.note.trim()}` : ''}`);
  if (input.direction === 'out') clearMissedFor(c.id, c.phone, 'called_back', a.by);
  return resolve(row);
}
// Notes append (who/when stamped) — never overwrite. A note on a missed call clears its inbox item.
export async function addCallNote(id: string, text: string): Promise<CallEvent> { const c = callOf(id); if (!text.trim()) throw new Error('Write a note first'); const a = b.actor(); c.notes.push({ at: new Date().toISOString(), by: a.by, text: text.trim() }); if (c.clientId) b.threadEvent(c.clientId, c.jobId, a.by, `Call note · ${text.trim()}`); if (c.jobId) b.jobStamp(c.jobId, `Call note by ${a.by} · ${text.trim()}`); if (isMissed(c) && !c.resolvedAt) { c.resolvedAt = new Date().toISOString(); c.resolvedBy = a.by; c.resolution = 'handled'; closeMissedInbox(c, a.by); } return resolve(c); }
export async function linkCallToJob(id: string, jobId?: string): Promise<CallEvent> { const c = callOf(id); c.jobId = jobId; if (jobId) b.jobStamp(jobId, `Call ${c.direction === 'in' ? 'from' : 'to'} client linked to this job by ${b.actor().by}`); return resolve(c); }
export async function getMissedCalls(): Promise<MissedCallRow[]> { ensureSeed(); return resolve(b.calls().filter((c) => isMissed(c) && !c.resolvedAt).sort((x, y) => y.at.localeCompare(x.at)).map((call) => { const client = clientOf(call.clientId); return { call, client, badge: client ? b.rating(client.id).badge : undefined }; })); }
export async function resolveMissedCall(id: string, resolution: 'called_back' | 'handled', note?: string): Promise<CallEvent> {
  const c = callOf(id); const a = b.actor(); if (c.resolvedAt) throw new Error('Already cleared'); c.resolvedAt = new Date().toISOString(); c.resolvedBy = a.by; c.resolution = resolution;
  if (note?.trim()) c.notes.push({ at: c.resolvedAt, by: a.by, text: note.trim() });
  if (resolution === 'called_back') b.calls().unshift({ id: b.newId('call'), at: c.resolvedAt, direction: 'out', number: c.number, clientId: c.clientId, answeredBy: a.by, station: a.station, outcome: 'answered', jobId: c.jobId, disposition: 'status_inquiry', notes: note?.trim() ? [{ at: c.resolvedAt, by: a.by, text: note.trim() }] : [], afterHours: b.isAfterHours(c.resolvedAt) });
  if (c.clientId) b.threadEvent(c.clientId, c.jobId, a.by, `${resolution === 'called_back' ? 'Called back' : 'Handled'} missed call from ${clock(c.at)}${note ? ` · ${note.trim()}` : ''}`);
  closeMissedInbox(c, a.by); return resolve(c);
}

// ---- Pop view: everything the card shows, derived live ----
export interface PopView { client?: Client; name: string; rating?: ClientRating; rows: WbpRow[]; jobs: Job[]; lastContact?: string }
const newestFirst = (rows: WbpRow[]) => { const at = (id: string) => b.jobs().find((j) => j.id === id)?.createdAt ?? ''; return [...rows].sort((x, y) => at(y.jobId).localeCompare(at(x.jobId))); };
export const popViewSync = (call: LiveCall): PopView => {
  const client = clientOf(call.clientId); if (!client) return { name: 'Unknown', rows: [], jobs: [] };
  const jobs = b.jobs().filter((j) => j.clientId === client.id && b.isActiveJob(j)).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return { client, name: b.fullNameOf(client), rating: b.rating(client.id), rows: newestFirst(b.wbp(client.id)), jobs, lastContact: lastContactLine(client.id) };
};
export const activeJobsNewestFirst = (clientId: string) => b.jobs().filter((j) => j.clientId === clientId && b.isActiveJob(j)).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
// "last contact" one-liner: newest of estimate sent (with opened flag) · outbox email · client message · call
const rel = (iso: string) => { const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? 'today' : d === 1 ? '1d ago' : `${d}d ago`; };
export const lastContactLine = (clientId: string): string | undefined => {
  const c = clientOf(clientId); if (!c) return undefined; const cands: { at: string; text: string }[] = [];
  b.estimates().filter((e) => e.clientId === clientId && e.sentAt).forEach((e) => cands.push({ at: e.sentAt!, text: `estimate ${e.number} sent ${rel(e.sentAt!)} · ${e.engagement?.some((x) => x.kind === 'opened') ? 'opened' : 'not opened yet'}` }));
  b.outbox().filter((e) => e.to === c.email).forEach((e) => cands.push({ at: e.createdAt, text: `email “${e.subject.replace(/^\[REF:[^\]]*\]\s*/, '').slice(0, 48)}” sent ${rel(e.createdAt)}` }));
  b.messages().filter((m) => m.clientId === clientId && m.direction === 'in' && !['note', 'system', 'staff'].includes(m.source)).forEach((m) => cands.push({ at: m.at, text: `client wrote ${rel(m.at)} · “${m.text.slice(0, 40)}${m.text.length > 40 ? '…' : ''}”` }));
  b.calls().filter((x) => x.clientId === clientId && x.outcome !== 'ringing' && !live.has(x.id)).forEach((x) => cands.push({ at: x.at, text: `${isMissed(x) ? 'missed call' : x.direction === 'in' ? 'call from client' : 'call to client'} ${rel(x.at)}${x.disposition && !isMissed(x) ? ` · ${dispositionLabel(x.disposition)?.toLowerCase()}` : ''}` }));
  return cands.sort((x, y) => y.at.localeCompare(x.at))[0]?.text;
};

// ---- Dev-menu scenarios: pick real seeded clients so the card always demonstrates the rule ----
export type Scenario = 'two_active_band_blocked' | 'one_active_green' | 'unknown' | 'missed' | 'answered_elsewhere';
export const scenarioNumber = (s: Scenario): string => {
  ensureSeed();
  if (s === 'unknown') return '(954) 555-0142';
  if (s === 'missed' || s === 'answered_elsewhere') return '(203) 555-0130'; // Robert Calloway
  const cands = b.clients().map((c) => ({ c, rows: b.wbp(c.id).filter((r) => b.jobs().some((j) => j.id === r.jobId && b.isActiveJob(j))) }));
  if (s === 'two_active_band_blocked') { const hit = cands.find((x) => x.rows.length >= 2 && x.rows.some((r) => r.legs.B.state === 'blocked') && !x.rows.every((r) => r.legs.B.state === 'blocked')) ?? cands.find((x) => x.rows.length >= 2 && x.rows.some((r) => r.legs.B.state === 'blocked')); return hit?.c.phone ?? '(203) 555-0130'; }
  const hit = cands.find((x) => x.rows.length === 1 && Object.values(x.rows[0].legs).every((d) => d.state !== 'blocked') && Object.values(x.rows[0].legs).some((d) => d.state === 'ok')); return hit?.c.phone ?? '(646) 555-0105';
};

// ---- Seed: 15 calls across 6 clients (c-30 ×5 · c-05 ×2 · c-10 ×2 · c-36 ×2 · c-38 ×2 · c-02 ×1) + 1 unknown. Open missed calls carry their inbox item. ----
let seeded = false;
const newestJob = (clientId: string) => b.jobs().filter((j) => j.clientId === clientId).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]?.id;
const seedCall = (id: string, clientId: string | undefined, daysBack: number, hour: number, direction: 'in' | 'out', outcome: CallEvent['outcome'], by: string | undefined, disposition?: CallDisposition, note?: string, dur?: number, noJob?: boolean): CallEvent => {
  const at = new Date(Date.now() - daysBack * 86_400_000); at.setHours(hour, (id.length * 7) % 60, 0, 0); const iso = at.toISOString(); const client = clientOf(clientId); const old = (outcome === 'missed' || outcome === 'voicemail') && daysBack > 3;
  return { id, at: iso, direction, number: client?.phone ?? '917-555-0144', clientId, answeredBy: by, station: by === 'MH' ? 'Front Desk 2' : 'Front Desk 1', outcome, durationSec: dur, endedAt: dur ? new Date(at.getTime() + dur * 1000).toISOString() : undefined, jobId: clientId && !noJob ? newestJob(clientId) : undefined, disposition, recordingUrl: outcome === 'answered' || outcome === 'voicemail' ? recordingUrl(id) : undefined, notes: note ? [{ at: iso, by: by ?? 'system', text: note }] : [], afterHours: b.isAfterHours(iso), resolvedAt: old ? iso : undefined, resolvedBy: old ? 'Vienna' : undefined, resolution: old ? 'called_back' : undefined };
};
const ensureSeed = () => {
  if (seeded) return; seeded = true;
  b.calls().push(
    seedCall('call-s01', 'c-30', 40, 11, 'in', 'answered', 'Vienna', 'status_inquiry', 'Asked when the Datejust would be ready; mentioned he is traveling in November.', 240),
    seedCall('call-s02', 'c-30', 12, 15, 'out', 'answered', 'MH', 'estimate_discussed', 'Explained the bracelet stretch finding; he wants the bracelet un-polished.', 380),
    seedCall('call-s03', 'c-30', 6, 19, 'in', 'missed', undefined, 'missed', undefined, undefined, true),
    seedCall('call-s04', 'c-30', 5, 10, 'out', 'answered', 'Vienna', 'pickup_scheduled', 'Returned last night’s call — booked a Thursday visit.', 150, true),
    seedCall('call-s05', 'c-30', 0.6, 20, 'in', 'voicemail', undefined, 'voicemail', 'Voicemail: “It’s Robert — call me about the Day-Date estimate when you can.”', undefined, true),
    seedCall('call-s06', 'c-05', 3, 12, 'in', 'answered', 'MH', 'status_inquiry', undefined, 90),
    seedCall('call-s07', undefined, 0.5, 7, 'in', 'missed', undefined, 'missed', undefined, undefined, true),
    seedCall('call-s08', 'c-05', 9, 14, 'out', 'answered', 'Chyna', 'estimate_discussed', 'Walked him through the two service options; he wants the full service.', 410),
    seedCall('call-s09', 'c-10', 2, 10, 'in', 'answered', 'Vienna', 'approval_given', 'Approved the bracelet link replacement by phone — confirmation email sent.', 300),
    seedCall('call-s10', 'c-10', 15, 16, 'in', 'answered', 'Chyna', 'status_inquiry', undefined, 120),
    seedCall('call-s11', 'c-36', 1, 9, 'in', 'answered', 'Vienna', 'status_inquiry', 'Asked about the second item (2/3) — told her the head is finished, bracelet in progress.', 200),
    seedCall('call-s12', 'c-36', 4, 17, 'out', 'answered', 'MH', 'pickup_scheduled', 'Pickup for the finished head set for Friday 2 PM.', 95),
    seedCall('call-s13', 'c-38', 7, 11, 'in', 'answered', 'Chyna', 'estimate_discussed', undefined, 260),
    seedCall('call-s14', 'c-38', 1.2, 18, 'in', 'missed', undefined, 'missed', undefined, undefined, true),
    seedCall('call-s15', 'c-02', 8, 13, 'out', 'answered', 'Vienna', 'status_inquiry', 'Eleanor asked for photos of the dial before polish — sent via portal.', 180),
  );
  b.calls().filter((c) => isMissed(c) && !c.resolvedAt).forEach(missedInboxItem);
};
export const seedCalls = ensureSeed;
