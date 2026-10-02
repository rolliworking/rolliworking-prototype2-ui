// The ONLY data-access module in the app. Screens call these functions and nothing else.
// Today they resolve from local fixtures; later this file alone is repointed at the real API.
import * as fx from './fixtures';
import { fillSummaryTemplate, localSummaryFields, readSerials } from './ai';
import { sendSms } from './telephony';
import type {
  ComponentKey,
  CompletionsReport,
  JobComponent,
  TechCompletionRow,
  ActivityEvent,
  AuditEvent,
  Bin,
  Carrier,
  Client,
  DashboardStats,
  DeptCode,
  Division,
  HoldType,
  JobHold,
  JobPriority,
  JobStatus,
  ShopTimeEntry,
  Department,
  Address,
  CatalogService,
  Estimate,
  EstimateLine,
  EstimateRevision,
  EstimateStatus,
  EstimateWithRefs,
  LineType,
  Assignee,
  BenchView,
  FloorLane,
  FloorMap,
  FulfillmentChannel,
  PayPage,
  PersonalTemplate,
  PortalPhoto,
  PortalPhotoSections,
  PortalRequestCard,
  PortalSplit,
  PortalSplitTrack,
  PortalRequestState,
  Part,
  Caliber,
  PartInput,
  PartRow,
  PartSafe,
  PartsKnowledgeEntry,
  PartsRequest,
  PartsRequestWithRefs,
  SupervisorBoard,
  Payment,
  PaymentMethod,
  PinnedItem,
  SalesOrder,
  ClientResolution,
  SalesOrderWithRefs,
  ShipCarrier,
  Shipment,
  TailStage,
  JobKind,
  Role,
  Task,
  TodayRow,
  TodayView,
  InspectionContext,
  Job,
  JobWithRefs,
  LabelJob,
  OutboxEmail,
  Package,
  PackageScan,
  PackagePhoto,
  PhotoType,
  PackageSource,
  PackageStatus,
  PackageWithRefs,
  QuoteContext,
  ReceiveWatchInput,
  Station,
  User,
  VerificationPhoto,
  Watch,
  WatchMatch,
  ServiceRequest,
  RequestStatus,
  SearchHit,
  SearchGroup,
  SearchResults,
  IdentifierKind,
  CustodyEvent,
  WatchHistoryRow,
  WatchGroup,
  ClientNoteRow,
  Client360,
  ClientDirectoryRow,
  RequestCloseReason,
  PortalRequest,
  MagicLink,
  Message,
  NeedsYouItem,
  PickupWindow,
  PickupSession,
  PickupDraft,
  PickupAbort,
  PickupFrame,
  PickupVerifyMethod,
  PickupSerialCheck,
  PickupResend,
  ManagerApproval,
  ReverseQrToken,
  PortalDocument,
  PortalHistoryRow,
  PortalHome,
  PortalSession,
  PortalStatus,
  PortalStatusKey,
  PortalWatch,
  StaffInboxThread,
} from './types';

export * from './types';

const LATENCY_MS = 120;

const KEYS = {
  currentUser: 'rollisuite.prototype.currentUserId',
  deviceInitialized: 'rollisuite.prototype.deviceInitialized',
  stationId: 'rollisuite.prototype.stationId',
  stations: 'rollisuite.prototype.stations',
  audit: 'rollisuite.prototype.auditLog',
  portalSession: 'rollisuite.rc.session',
  rcEvents: 'rollisuite.rc.events',
  rcLinks: 'rollisuite.rc.magicLinks',
  rgSession: 'rollisuite.rg.session',
};
const AUDIT_CAP = 60;

const KIOSK_OFFLINE = 'rollisuite.kiosk.offline';
// Kiosk "simulate offline" makes every call fail the way an unreachable API would — screens keep their last data and show the reconnecting banner
const resolve = <T>(value: T): Promise<T> =>
  new Promise((r, rej) => setTimeout(() => (localStorage.getItem(KIOSK_OFFLINE) === '1' ? rej(new Error('NETWORK_UNREACHABLE')) : r(value)), LATENCY_MS));

const readJson = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

// mutable in-memory copies so "writes" work within a session
const store = {
  tasks: fx.tasks.map((t) => ({ ...t })),
  pinned: fx.pinned.map((p) => ({ ...p })),
  parts: fx.parts.map((p): Part => ({ ...p, compatibleRefs: [...p.compatibleRefs], aliases: [...p.aliases] })),
  partsRequests: fx.partsRequests.map((r): PartsRequest => ({ ...r, chat: [...r.chat], searchTerms: [...r.searchTerms], history: [...(r.history ?? [])], items: r.items?.map((i) => ({ ...i })) })),
  partsKnowledge: fx.partsKnowledge.map((k): PartsKnowledgeEntry => ({ ...k })),
  salesOrders: fx.salesOrders.map((o): SalesOrder => ({ ...o, lines: o.lines.map((l) => ({ ...l })), payments: [...o.payments], invoiceSends: [] })),
  packages: fx.packages.map((p) => ({ ...p, contents: [...p.contents], photos: [...p.photos] })),
  outbox: fx.outbox.map((e) => ({ ...e })),
  labels: fx.labels.map((l) => ({ ...l })),
  watches: fx.watches.map((w) => ({ ...w })),
  estimates: fx.estimates.map((e): Estimate => ({ ...e, lines: e.lines.map((l) => ({ ...l })), revisions: e.revisions.map((r): EstimateRevision => ({ ...r, lines: r.lines.map((l) => ({ ...l })) })), jobId: fx.jobs.find((j) => j.estimateId === e.id)?.id })),
  jobs: fx.jobs.map((j): Job => ({ ...j, lines: j.lines.map((l) => ({ ...l })), timeline: [...j.timeline], holds: j.holds.map((h) => ({ ...h })), notes: [...j.notes], photos: [...j.photos], workflow: [...j.workflow], assignees: [...j.assignees], inspection: j.inspection ? { ...j.inspection, answers: { ...j.inspection.answers } } : undefined, clientRequests: (fx.clientRequestSeeds[j.id] ?? []).map((r) => ({ ...r, acks: [...r.acks], check: r.check ? { ...r.check } : undefined })) })),
  shopTime: fx.shopTime.map((t) => ({ ...t })),
  requests: fx.requests.map((r): ServiceRequest => ({ ...r })),
  messages: fx.messages.map((m): Message => ({ ...m })),
  jobMessages: fx.jobMessages.map((m) => ({ ...m, mentions: [...m.mentions], notify: [...m.notify], readBy: [...m.readBy] })),
  magicLinks: readJson<MagicLink[]>('rollisuite.rc.magicLinks', []),
  counters: { sub: 314, label: 3, estimate: 1058, job: Math.max(2030, ...fx.jobs.map((j) => Number(j.number.replace(/\D/g, '')) || 0)), so: Math.max(107, ...fx.salesOrders.map((o) => (o.number.startsWith('SO-26-') ? Number(o.number.slice(6)) : 0))), pr: 44 },
};
// ---- B2B client reference (their barcode / internal tracking #) — captured at Receive Watch, lives on the estimate, threads into every client email subject for that job ----
// FINAL FORMAT (user decision): bracketed prefix "[REF: <ref>] <subject>"
export const clientRefSubject = (subject: string, ref?: string) => (ref?.trim() ? `[REF: ${ref.trim()}] ${subject}` : subject);
const clientRefFor = (relatedRef: string): string | undefined => {
  const toks = relatedRef.split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const ofJob = (j?: Job) => j ? j.clientRef ?? (j.estimateId ? store.estimates.find((x) => x.id === j.estimateId)?.clientRef : undefined) : undefined;
  for (const t of toks) {
    const e = store.estimates.find((x) => x.number === t); if (e) return e.clientRef ?? ofJob(store.jobs.find((j) => j.estimateId === e.id));
    const j = store.jobs.find((x) => x.number === t); if (j) return ofJob(j);
    const p = store.packages.find((x) => x.subNumber === t); if (p?.estimateId) return store.estimates.find((x) => x.id === p.estimateId)?.clientRef;
    const o = store.salesOrders.find((x) => x.number === t); if (o?.jobId) return ofJob(store.jobs.find((x) => x.id === o.jobId));
  }
  return undefined;
};
// Single choke point for outbound mail — the reference is applied here so no individual sender has to remember it
const queueOutbox = (email: OutboxEmail) => { const ref = clientRefFor(email.relatedRef); if (ref && !email.subject.startsWith('[REF:')) email.subject = clientRefSubject(email.subject, ref); store.outbox.unshift(email); return email; };
// One reference per job/package — written to the estimate AND every job linked to it so both detail screens read the same value
const writeClientRef = (e: Estimate | undefined, j: Job | undefined, ref: string) => {
  const next = ref.trim() || undefined; const before = e?.clientRef ?? j?.clientRef;
  if (e) { e.clientRef = next; e.updatedAt = new Date().toISOString(); store.jobs.filter((x) => x.estimateId === e.id).forEach((x) => { x.clientRef = next; }); }
  if (j) { j.clientRef = next; if (j.estimateId) { const je = store.estimates.find((x) => x.id === j.estimateId); if (je) je.clientRef = next; } }
  const a = actor(); appendAudit({ type: 'estimate', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${e?.number ?? j?.number} · Client reference ${before ? `"${before}" → ` : ''}${next ? `"${next}"` : 'cleared'}` });
};
export async function setClientRef(estimateId: string, ref: string): Promise<EstimateWithRefs> {
  const e = byId(store.estimates, estimateId); if ((e.clientRef ?? '') !== ref.trim()) writeClientRef(e, undefined, ref); return resolve(withRefs(e));
}
export async function setJobClientRef(jobId: string, ref: string): Promise<void> { const j = byId(store.jobs, jobId); if ((j.clientRef ?? '') !== ref.trim()) writeClientRef(undefined, j, ref); return resolve(undefined); }
export const jobClientRef = (j: Job & { estimate?: Estimate | null }) => j.clientRef ?? j.estimate?.clientRef;
// Seed: E02013's estimate carries a B2B reference; every other job leaves it blank for comparison
(() => { const e = store.estimates.find((x) => x.id === 'e-04'); if (e) { e.clientRef = 'B2B-88421'; store.jobs.filter((j) => j.estimateId === e.id).forEach((j) => { j.clientRef = e.clientRef; }); } })();


const byId = <T extends { id: string }>(rows: T[], id: string): T => {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`Fixture row not found: ${id}`);
  return row;
};

const withRefs = <T extends { clientId: string; watchId?: string }>(row: T) => ({
  ...row,
  client: byId(fx.clients, row.clientId),
  watch: row.watchId ? store.watches.find((w) => w.id === row.watchId) ?? null : null,
});

const isThisMonth = (iso?: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

// ---- Station (device-bound) -------------------------------------------------

const readStations = (): Station[] => {
  const saved = readJson<Station[] | null>(KEYS.stations, null);
  // Backfill division for stations saved before the division feature was added
  if (saved) return [...saved, ...fx.stations.filter((f) => !saved.some((x) => x.id === f.id))].map((s) => ({ ...s, division: s.division ?? 'rolliworks', receptionMode: s.receptionMode ?? fx.stations.find((f) => f.id === s.id)?.receptionMode, deviceType: s.deviceType ?? fx.stations.find((f) => f.id === s.id)?.deviceType }));
  // Seed-only stations added after this device saved its registry (WM 1–8 pads, kiosks) are merged in by id

  writeJson(KEYS.stations, fx.stations);
  return fx.stations;
};

const readStation = (): Station | null => {
  if (!localStorage.getItem(KEYS.deviceInitialized)) {
    // Prototype mock: this device ships pre-registered as "Front Desk 1".
    localStorage.setItem(KEYS.deviceInitialized, '1');
    localStorage.setItem(KEYS.stationId, fx.PREREGISTERED_STATION_ID);
    const st = byId(readStations(), fx.PREREGISTERED_STATION_ID);
    appendAudit({ type: 'station_registered', stationName: st.name, detail: `Device pre-registered as ${st.name} (prototype mock)` });
    return st;
  }
  const id = localStorage.getItem(KEYS.stationId);
  return id ? readStations().find((s) => s.id === id) ?? null : null;
};

const stationNameOrUnknown = () => readStation()?.name ?? 'Unregistered device';

// Reception mode — a STATION flag (front-desk PCs), not a role: search shows no IN-HOUSE badge and no estimate numbers. `?reception=1|0` overrides for this browser session so the view can be tested from any station.
const RECEPTION_OVERRIDE = 'rollisuite.prototype.receptionOverride';
(() => { try { const v = new URLSearchParams(window.location.search).get('reception'); if (v !== null) sessionStorage.setItem(RECEPTION_OVERRIDE, v === '0' || v === 'false' ? '0' : '1'); } catch { /* non-browser */ } })();
export const isReceptionMode = (): boolean => { const o = sessionStorage.getItem(RECEPTION_OVERRIDE); if (o !== null) return o === '1'; return !!readStation()?.receptionMode; };
export const receptionSource = (): 'query' | 'station' | null => (sessionStorage.getItem(RECEPTION_OVERRIDE) !== null ? 'query' : readStation()?.receptionMode ? 'station' : null);

// Sync helper — division of the current session (station-bound)
export const getSessionDivision = (): Division => readStation()?.division ?? 'rolliworks';

export async function getStation(): Promise<Station | null> {
  return resolve(readStation());
}

export async function getStations(): Promise<Station[]> {
  return resolve(readStations());
}

export async function addStation(name: string, division: Division = 'rolliworks'): Promise<Station> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Station name is required');
  const list = readStations();
  const existing = list.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return resolve(existing);
  const st: Station = { id: `st-${Date.now().toString(36)}`, name: trimmed, division };
  writeJson(KEYS.stations, [...list, st]);
  return resolve(st);
}

export async function registerStation(stationId: string, adminUserId: string, password: string): Promise<Station> {
  const admin = byId(fx.users, adminUserId);
  if (admin.accessTier !== 'manager') throw new Error('Only a manager can name this station');
  if (admin.password !== password) throw new Error('Incorrect password');
  const st = byId(readStations(), stationId);
  localStorage.setItem(KEYS.stationId, st.id);
  appendAudit({ type: 'station_registered', stationName: st.name, userShortName: admin.shortName, userDisplayName: admin.displayName, detail: `Device registered as ${st.name}` });
  return resolve(st);
}

export async function renameStation(name: string): Promise<Station> {
  const current = readStation();
  if (!current) throw new Error('This device has no station');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Station name is required');
  const list = readStations().map((s) => (s.id === current.id ? { ...s, name: trimmed } : s));
  writeJson(KEYS.stations, list);
  const actor = currentUserSync();
  appendAudit({ type: 'station_renamed', stationName: trimmed, userShortName: actor?.shortName, userDisplayName: actor?.displayName, detail: `Station renamed from ${current.name} to ${trimmed}` });
  return resolve({ ...current, name: trimmed });
}

export async function resetDeviceRegistration(): Promise<void> {
  const actor = currentUserSync();
  appendAudit({ type: 'station_reset', stationName: stationNameOrUnknown(), userShortName: actor?.shortName, userDisplayName: actor?.displayName, detail: 'Device registration cleared (simulating a new device)' });
  localStorage.removeItem(KEYS.stationId);
  localStorage.removeItem(KEYS.currentUser);
  return resolve(undefined);
}

// ---- Division helpers -------------------------------------------------------

/** All users whose division includes `div` (own-division + 'both'). */
export const getDivisionStaff = (div: Division): User[] =>
  fx.users.filter((u) => !u.disabled && (u.division === div || u.division === 'both'));

/** Roles that have at least one holder in `div`. */
export const getDivisionRoles = (div: Division): Role[] =>
  ROLES.filter((r) => getDivisionStaff(div).some((u) => u.roles.includes(r)));

// ---- Audit log --------------------------------------------------------------

const readAudit = (): AuditEvent[] => readJson<AuditEvent[]>(KEYS.audit, []);

// RolliConnect writes are replayed from localStorage on load (see replayRcEvents); the audit log is already persisted, so skip stamping during replay
let replaying = false;
function appendAudit(e: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
  // D-385 / D-361: while the owner is in View-as, every event is written actor = real user, on-behalf-of = viewed user — both names on the record, no credit to the viewed user
  const va = viewAsSync(); const real = realUserSync();
  if (va && real && e.type !== 'view_as_started' && e.type !== 'view_as_ended') e = { ...e, userShortName: real.shortName, userDisplayName: `${real.displayName} (as ${va.shortName})`, onBehalfOf: va.shortName };
  const event: AuditEvent = { ...e, id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() };
  if (!replaying) writeJson(KEYS.audit, [event, ...readAudit()].slice(0, AUDIT_CAP));
  return event;
}

export async function getAuditLog(): Promise<AuditEvent[]> {
  return resolve(readAudit());
}

// ---- Auth / users -----------------------------------------------------------

// Real sign-in (localStorage, the device session) vs. the VIEWED identity (D-385 owner View-as, sessionStorage — this tab only, never touches the viewed user's own session)
export const OWNER_USER_ID = 'u-michael';
const canSuperviseUser = (u: User) => u.accessTier === 'manager' || u.roles.includes('supervisor');
const VIEW_AS_KEY = 'rollisuite.prototype.viewAsUserId';
const realUserSync = (): User | null => {
  const id = localStorage.getItem(KEYS.currentUser);
  return id ? fx.users.find((u) => u.id === id) ?? null : null;
};
const viewAsSync = (): User | null => {
  const real = realUserSync(); if (!real || real.id !== OWNER_USER_ID) return null;
  const id = sessionStorage.getItem(VIEW_AS_KEY);
  return id && id !== real.id ? fx.users.find((u) => u.id === id) ?? null : null;
};
// Everything below (guards, scoping, hidden fields, landings, permission checks) reads the VIEWED user — exactly as if they had signed in
const currentUserSync = (): User | null => viewAsSync() ?? realUserSync();
export const isOwnerSync = (): boolean => realUserSync()?.id === OWNER_USER_ID && !viewAsSync();
export interface ViewAsState { real: User; viewing: User | null }
export async function getViewAs(): Promise<ViewAsState | null> { const real = realUserSync(); return resolve(real ? { real, viewing: viewAsSync() } : null); }
// "Continue as MH" on the mandatory entry screen (D-385 amendment) — logged so every MH session records its choice
export async function continueAsSelf(): Promise<void> { const real = realUserSync(); if (!real) return; if (viewAsSync()) await stopViewAs(); appendAudit({ type: 'session_continued_as_self', stationName: stationNameOrUnknown(), userShortName: real.shortName, userDisplayName: real.displayName, detail: `Entry screen · continued as ${real.shortName} (own view)` }); }
export async function startViewAs(userId: string): Promise<User> {
  const real = realUserSync(); if (!real || real.id !== OWNER_USER_ID) throw new Error('View-as is owner-only (MH)');
  const target = byId(fx.users, userId); if (target.id === real.id) { await stopViewAs(); return real; }
  const prev = viewAsSync(); if (prev) appendAudit({ type: 'view_as_ended', stationName: stationNameOrUnknown(), userShortName: real.shortName, userDisplayName: real.displayName, onBehalfOf: prev.shortName, detail: `View-as ended · ${real.shortName} stopped viewing as ${prev.shortName} (switched to ${target.shortName})` });
  sessionStorage.setItem(VIEW_AS_KEY, target.id);
  appendAudit({ type: 'view_as_started', stationName: stationNameOrUnknown(), userShortName: real.shortName, userDisplayName: real.displayName, onBehalfOf: target.shortName, detail: `View-as started · ${real.shortName} viewing as ${target.shortName} (${target.dutyLabel}) · actions recorded as ${real.shortName} (as ${target.shortName})` });
  return resolve({ ...target });
}
export async function stopViewAs(): Promise<void> {
  const real = realUserSync(); const prev = viewAsSync();
  sessionStorage.removeItem(VIEW_AS_KEY);
  if (real && prev) appendAudit({ type: 'view_as_ended', stationName: stationNameOrUnknown(), userShortName: real.shortName, userDisplayName: real.displayName, onBehalfOf: prev.shortName, detail: `View-as ended · ${real.shortName} back to own view (was viewing as ${prev.shortName})` });
  return resolve(undefined);
}

const signedInTodaySync = (userId: string) =>
  readAudit().some((e) => e.type === 'sign_in' && (e.method === 'password_photo' || e.method === 'touch_id') && e.userShortName === byId(fx.users, userId).shortName && isToday(e.timestamp));

export async function getUsers(): Promise<User[]> {
  return resolve(fx.users);
}

export async function getCurrentUser(): Promise<User | null> {
  return resolve(currentUserSync());
}

export async function hasSignedInToday(userId: string): Promise<boolean> {
  return resolve(signedInTodaySync(userId));
}

export async function getUsersSignedInToday(): Promise<User[]> {
  return resolve(fx.users.filter((u) => signedInTodaySync(u.id)));
}

async function signInWithPasswordMock(userId: string, password: string, photo: VerificationPhoto): Promise<User> {
  const user = byId(fx.users, userId);
  const stationName = stationNameOrUnknown();
  assertEnabled(user, stationName, 'password_photo');
  if (user.password !== password) {
    appendAudit({ type: 'sign_in_failed', stationName, userShortName: user.shortName, userDisplayName: user.displayName, method: 'password_photo', detail: 'Incorrect password' });
    throw new Error('Incorrect password');
  }
  localStorage.setItem(KEYS.currentUser, user.id);
  appendAudit({
    type: 'sign_in',
    stationName,
    userShortName: user.shortName,
    userDisplayName: user.displayName,
    method: 'password_photo',
    cameraStatus: photo.cameraStatus,
    photoDataUrl: photo.dataUrl ?? undefined,
    detail: photo.cameraStatus === 'captured' ? 'Password verified · photo captured' : `Password verified · ${photo.cameraStatus === 'denied' ? 'camera denied' : 'no camera'}`,
  });
  return resolve(user);
}

export async function switchUserWithPin(userId: string, pin: string): Promise<User> {
  const user = byId(fx.users, userId);
  const stationName = stationNameOrUnknown();
  if (!signedInTodaySync(userId)) throw new Error('First sign-in of the day needs password and photo');
  assertEnabled(user, stationNameOrUnknown(), 'pin_switch');
  if (user.pin !== pin) {
    appendAudit({ type: 'sign_in_failed', stationName, userShortName: user.shortName, userDisplayName: user.displayName, method: 'pin_switch', detail: 'Incorrect PIN' });
    throw new Error('Incorrect PIN');
  }
  localStorage.setItem(KEYS.currentUser, user.id);
  appendAudit({ type: 'sign_in', stationName, userShortName: user.shortName, userDisplayName: user.displayName, method: 'pin_switch', detail: 'Fast switch · PIN verified' });
  return resolve(user);
}

// Touch ID (WebAuthn platform authenticator) — the browser asserted the device credential; the prototype trusts that assertion (Keeper verifies server-side). Counts as the day's first sign-in.
export async function signInWithTouchId(userId: string): Promise<User> {
  const user = byId(fx.users, userId); const stationName = stationNameOrUnknown(); assertEnabled(user, stationName, 'touch_id');
  localStorage.setItem(KEYS.currentUser, user.id);
  appendAudit({ type: 'sign_in', stationName, userShortName: user.shortName, userDisplayName: user.displayName, method: 'touch_id', detail: 'Touch ID · platform credential asserted (prototype — no server verification)' });
  return resolve(user);
}

export async function signOut(): Promise<void> {
  sessionStorage.removeItem(VIEW_AS_KEY);
  const user = realUserSync();
  if (user) appendAudit({ type: 'sign_out', stationName: stationNameOrUnknown(), userShortName: user.shortName, userDisplayName: user.displayName, detail: 'Signed out' });
  localStorage.removeItem(KEYS.currentUser);
  return resolve(undefined);
}

// ---- Clients ----------------------------------------------------------------

export async function getClients(): Promise<Client[]> {
  return resolve(fx.clients);
}

export async function getClient(id: string): Promise<Client | null> {
  return resolve(fx.clients.find((c) => c.id === id) ?? null);
}

export async function searchClients(query: string): Promise<Client[]> {
  const q = query.trim().toLowerCase();
  if (!q) return resolve([]);
  const digits = q.replace(/\D/g, '');
  const hits = fx.clients.filter((c) => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    return (
      name.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false) ||
      (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
    );
  });
  return resolve(hits.slice(0, 8));
}

// ---- Watches ----------------------------------------------------------------

export async function getWatches(): Promise<Watch[]> {
  return resolve(store.watches);
}

export async function getWatchesForClient(clientId: string): Promise<Watch[]> {
  return resolve(store.watches.filter((w) => w.clientId === clientId));
}

// ---- Estimates --------------------------------------------------------------

// Division wall (2026-09-29): scope by the signed-in identity's division, not the station. Estimates / SOs / packages inherit the division of their linked job (default rolliworks).
const userDivisionOk = (div: Division) => { const u = currentUserSync(); return !u || u.division === 'both' || u.division === div; };
const estimateDivision = (e: Estimate): Division => store.jobs.find((j) => j.estimateId === e.id)?.division ?? 'rolliworks';
const soDivision = (o: SalesOrder): Division => (o.jobId ? store.jobs.find((j) => j.id === o.jobId)?.division : undefined) ?? 'rolliworks';
const packageDivision = (p: Package): Division => (p.estimateId ? estimateDivision(byId(store.estimates, p.estimateId)) : 'rolliworks');
export const inMyDivision = { estimate: (e: Estimate) => userDivisionOk(estimateDivision(e)), salesOrder: (o: SalesOrder) => userDivisionOk(soDivision(o)), package: (p: Package) => userDivisionOk(packageDivision(p)), job: (j: Job) => userDivisionOk(j.division) };
async function getEstimatesMock(): Promise<EstimateWithRefs[]> {
  return resolve([...store.estimates].filter(inMyDivision.estimate).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(withRefs));
}

async function getEstimateMock(id: string): Promise<EstimateWithRefs | null> {
  const e = store.estimates.find((x) => x.id === id);
  if (e && !inMyDivision.estimate(e)) throw new Error('Not in your division — this estimate belongs to the other entity');
  return resolve(e ? withRefs(e) : null);
}

export async function getEstimatesForClient(clientId: string): Promise<EstimateWithRefs[]> {
  return resolve(store.estimates.filter((e) => e.clientId === clientId).map(withRefs));
}

// ---- Jobs (read) -------------------------------------------------------------

const jobRefs = (j: Job): JobWithRefs => ({
  ...j,
  components: ensureComponents(j),
  client: byId(fx.clients, j.clientId),
  watch: byId(store.watches, j.watchId),
  estimate: j.estimateId ? store.estimates.find((e) => e.id === j.estimateId) ?? null : null,
  pkg: j.packageId ? store.packages.find((p) => p.id === j.packageId) ?? null : store.packages.find((p) => p.estimateId && p.estimateId === j.estimateId) ?? null,
});

async function getJobsMock(): Promise<JobWithRefs[]> {
  return resolve([...store.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(jobRefs));
}

async function getJobMock(id: string): Promise<JobWithRefs | null> {
  const j = store.jobs.find((x) => x.id === id);
  return resolve(j ? jobRefs(j) : null);
}

export async function getJobsForClient(clientId: string): Promise<JobWithRefs[]> {
  return resolve(store.jobs.filter((j) => j.clientId === clientId).map(jobRefs));
}

// ---- Activity ---------------------------------------------------------------

async function getRecentActivityMock(limit = 10): Promise<ActivityEvent[]> {
  const sorted = [...fx.activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return resolve(sorted.slice(0, limit));
}

// ---- Dashboard --------------------------------------------------------------

const DEPARTMENTS: { key: Department; name: string }[] = [
  { key: 'watchmaking', name: 'Watchmaking' },
  { key: 'band', name: 'Band' },
  { key: 'polish', name: 'Polish' },
];

const OPEN_ESTIMATE: Estimate['status'][] = ['draft', 'sent'];
const ACTIVE_JOB: Job['status'][] = ['approved', 'in_service', 'testing'];

// Q5 as AMENDED (MH 2026-09-29): SALES are dated by the FIRST INVOICE SEND (Sent timestamp); re-sends / edits never re-date — an edit that changes the total adjusts the sale in the original month (we read the CURRENT total against the first-send date). Payment date drives A/R, the ship/pickup gate and cash reporting only. Zero-total / zero-balance orders have no invoice → never in Sales (they still count in Completions). COMPLETIONS = work, dated by completedAt. Lines up with QBO invoice date under invoice-first (VB4-03).
export const saleDateOf = (o: SalesOrder): string | undefined => (o.zeroBalance || o.total <= 0 || o.status === 'draft' || o.status === 'cancelled' ? undefined : o.invoiceSends[0]?.at ?? o.invoiceSentAt ?? o.orderDate /* STAND-IN for seeded orders without a recorded send */);
const salesThisMonth = () => store.salesOrders.filter((o) => isThisMonth(saleDateOf(o))).map((o) => ({ amount: o.total, job: store.jobs.find((j) => j.id === o.jobId) }));
async function getDashboardStatsMock(): Promise<DashboardStats> {
  const paid = salesThisMonth();
  return resolve({
    watchesInHouse: store.watches.filter((w) => w.status !== 'released' && w.status !== 'expected').length,
    openEstimates: store.estimates.filter((e) => OPEN_ESTIMATE.includes(e.status)).length,
    awaitingApproval: store.estimates.filter((e) => e.status === 'sent').length,
    inProgress: store.jobs.filter((j) => ACTIVE_JOB.includes(j.status)).length,
    awaitingPickup: store.jobs.filter((j) => j.status === 'ready_to_ship').length,
    revenueThisMonth: paid.reduce((t, p) => t + p.amount, 0),
    departments: DEPARTMENTS.map((d) => ({
      ...d,
      mtdRevenue: paid.filter((p) => p.job?.department === d.key).reduce((t, p) => t + p.amount, 0),
      jobCount: store.jobs.filter((j) => j.department === d.key && j.status !== 'closed').length,
    })),
  });
}

// ---- Intake -----------------------------------------------------------------

export { CONTENT_PILLS, CARRIERS, BINS, DEPT_LABEL, DEPT_COMPONENTS } from './fixtures/intake';

// While a RolliConnect action runs, stamps carry the client's name and station "RolliConnect" instead of a staff user
let portalActor: { by: string; station: string } | null = null;
const actor = () => {
  if (portalActor) return { by: portalActor.by, station: portalActor.station, user: undefined };
  const u = currentUserSync(); const va = viewAsSync(); const real = realUserSync();
  if (va && real) return { by: `${real.shortName} (as ${va.shortName})`, station: stationNameOrUnknown(), user: u, onBehalfOf: va.shortName };
  return { by: u?.shortName ?? 'Unknown', station: stationNameOrUnknown(), user: u };
};

const stamp = (detail: string, ref: string) => {
  const a = actor();
  appendAudit({ type: 'intake', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${ref} · ${detail}` });
};

const pkgWithRefs = (p: Package): PackageWithRefs => {
  const est = p.estimateId ? store.estimates.find((e) => e.id === p.estimateId) : undefined;
  return {
    ...p,
    client: p.clientId ? fx.clients.find((c) => c.id === p.clientId) ?? null : null,
    estimate: est ? withRefs(est) : null,
  };
};

const getPkg = (id: string) => byId(store.packages, id);

export const detectCarrier = (tracking: string): Carrier => {
  const t = tracking.replace(/\s+/g, '').toUpperCase();
  if (/^1Z/.test(t)) return 'UPS';
  if (/^(94|92|93|95)\d{18,20}$/.test(t)) return 'USPS';
  if (/^\d{12}$|^\d{15}$/.test(t)) return 'FedEx';
  if (/^\d{10}$/.test(t)) return 'DHL';
  return 'FedEx';
};

async function getPackagesMock(status?: PackageStatus): Promise<PackageWithRefs[]> {
  const rows = store.packages.filter((p) => (!status || p.status === status) && inMyDivision.package(p));
  return resolve(rows.map(pkgWithRefs).sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt)));
}

export async function getPackage(id: string): Promise<PackageWithRefs | null> {
  const p = store.packages.find((x) => x.id === id);
  return resolve(p ? pkgWithRefs(p) : null);
}

export type IntakeCountKey = PackageStatus | 'photos' | 'inspection' | 'awaiting_approval';
const photoCount = (j: Job, kind: 'intake' | 'inspection') => fx.jobPhotos.filter((p) => p.jobId === j.id && p.kind === kind).length + (kind === 'inspection' ? j.photos.length : 0);
export async function getIntakeCounts(): Promise<Record<IntakeCountKey, number>> {
  const counts: Record<IntakeCountKey, number> = { arrived: 0, processed: 0, awaiting_inspection: 0, received: 0, discrepancy_hold: 0, photos: 0, inspection: 0, awaiting_approval: 0 };
  store.packages.forEach((p) => (counts[p.status] += 1));
  // Steps 5–7: on-hand jobs still in intake/in_review without inspection photos → Photos; with photos but no saved inspection form → Inspection; awaiting client approval → step 7
  const onHand = store.jobs.filter((j) => j.simpleStatus === 'on_hand' && (j.status === 'intake' || j.status === 'in_review'));
  counts.photos = onHand.filter((j) => !photoCount(j, 'inspection')).length;
  counts.inspection = onHand.filter((j) => photoCount(j, 'inspection') > 0).length + intakeDraftForms();
  counts.awaiting_approval = store.jobs.filter((j) => j.status === 'awaiting_customer_approval').length;
  return resolve(counts);
}
export interface IntakeStepJob { job: JobWithRefs; intakePhotos: number; inspectionPhotos: number; form?: { id: string; status: 'draft' | 'saved'; token: string; total: number } }
export async function getIntakePhotoQueue(): Promise<IntakeStepJob[]> { return resolve(store.jobs.filter((j) => j.simpleStatus === 'on_hand' && (j.status === 'intake' || j.status === 'in_review')).map((j) => ({ job: jobRefs(j), intakePhotos: photoCount(j, 'intake'), inspectionPhotos: photoCount(j, 'inspection'), form: formForJob(j.id) }))); }
export async function getAwaitingApprovalQueue(): Promise<IntakeStepJob[]> { return resolve(store.jobs.filter((j) => j.status === 'awaiting_customer_approval').map((j) => ({ job: jobRefs(j), intakePhotos: photoCount(j, 'intake'), inspectionPhotos: photoCount(j, 'inspection'), form: formForJob(j.id) }))); }

export interface ArrivalInput {
  source: PackageSource;
  trackingNumber?: string;
  carrier?: Carrier;
  signatureNoted: boolean;
  clientId?: string;
  shelfBin?: string;
}

export async function logArrival(input: ArrivalInput): Promise<PackageWithRefs> {
  const a = actor();
  const tracking = input.trackingNumber?.trim() || undefined;
  if (input.source === 'carrier' && !tracking) throw new Error('Tracking number is required');
  if (tracking && store.packages.some((p) => p.trackingNumber === tracking)) throw new Error(`Tracking ${tracking} was already logged`);
  store.counters.sub += 1;
  const pkg: Package = {
    id: `pk-${Date.now().toString(36)}`,
    subNumber: `SUB-26-0${store.counters.sub}`,
    source: input.source,
    carrier: input.source === 'walk_in' ? 'Hand delivery' : input.carrier ?? detectCarrier(tracking!),
    trackingNumber: tracking,
    signatureNoted: input.signatureNoted,
    clientId: input.clientId,
    status: 'arrived',
    arrivedAt: new Date().toISOString(),
    arrivedBy: a.by,
    arrivedStation: a.station,
    contents: [],
    photos: [],
    receiptPrinted: false,
  };
  store.packages.unshift(pkg);
  const sh = tracking ? shp.rows.find((x) => x.trackingNumber === tracking && x.direction === 'inbound' && x.stage !== 'arrived') : undefined;
  if (sh) { const e = byId(store.estimates, sh.estimateId); sh.stage = 'arrived'; sh.arrivedAt = new Date().toISOString(); pkg.estimateId = e.id; pkg.clientId = sh.clientId; shipStamp(sh, `arrival scan matched · ${pkg.subNumber} · linked ${e.number}`); }
  if (input.source === 'carrier') pkg.scans = [{ id: newId('scan'), kind: 'arrival', at: pkg.arrivedAt, by: a.by, station: a.station, trackingNumber: tracking, clientId: pkg.clientId, shipmentId: sh?.id, matched: sh ? 'label_request' : pkg.clientId ? 'manual' : 'none', note: sh ? `matched label request ${byId(store.estimates, sh.estimateId).number}` : 'no label request on file for this tracking #' }];
  stamp(input.source === 'walk_in' ? `Walk-in logged (${pkg.carrier})` : `Package arrived via ${pkg.carrier}${input.signatureNoted ? ' · signature noted' : ''}${sh ? ` · Scan 1 matched ${byId(store.estimates, sh.estimateId).number}` : ' · Scan 1 · no label match'}`, pkg.subNumber);
  if (input.shelfBin) return shelvePackage(pkg.id, { shelfBin: input.shelfBin });
  return resolve(pkgWithRefs(pkg));
}

// ---- Two-scan receive: Scan 1 = arrival + shelf bin (chain of custody starts), Scan 2 = open (feeds Stage 2 · Receive Package) ----
export const SHELF_BINS = Array.from({ length: 12 }, (_, i) => `BIN-${String(i + 1).padStart(2, '0')}`);
const normBin = (raw: string) => { const q = raw.trim().toUpperCase().replace(/\s+/g, ''); const n = q.match(/^(?:BIN-?|SHELF-?|B)?0*(\d{1,2})$/); return n ? `BIN-${n[1].padStart(2, '0')}` : q; };
export interface ShelfRow { bin: string; pkg?: PackageWithRefs }
export async function getShelf(): Promise<ShelfRow[]> {
  const onShelf = store.packages.filter((p) => p.status === 'arrived' && p.shelfBin);
  return resolve(SHELF_BINS.map((bin) => { const p = onShelf.find((x) => x.shelfBin === bin); return { bin, pkg: p ? pkgWithRefs(p) : undefined }; }));
}
const pushScan = (pkg: Package, s: Omit<PackageScan, 'id' | 'at' | 'by' | 'station'>) => { const a = actor(); const row: PackageScan = { id: newId('scan'), at: new Date().toISOString(), by: a.by, station: a.station, ...s }; (pkg.scans ??= []).push(row); return row; };
// Courtesy note — distinct from the later "received and processed" email sent at Stage 2
const queuePackageAcceptedEmail = (pkg: Package) => {
  const c = pkg.clientId ? fx.clients.find((x) => x.id === pkg.clientId) : undefined; if (!c) return undefined; const a = actor(); const e = pkg.estimateId ? store.estimates.find((x) => x.id === pkg.estimateId) : undefined;
  const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: `${e?.number ?? pkg.subNumber} · ${pkg.trackingNumber ?? pkg.subNumber}`, status: 'pending', subject: `We have your package — ${e?.number ?? pkg.subNumber}`, body: `Hello ${c.firstName},\n\nYour package${pkg.trackingNumber ? ` (${pkg.carrier} ${pkg.trackingNumber})` : ''} was accepted at Rolliworks today and is secured, unopened, in our receiving area. Packages are opened and checked in as a batch at the end of the day; you will get a second note with photos once your watch has been received and inspected.\n\nNothing to do on your side.\n\n— The Rolliworks team`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station };
  queueOutbox(email); return email;
};
export async function shelvePackage(id: string, input: { shelfBin: string; clientId?: string; estimateId?: string }): Promise<PackageWithRefs> {
  const pkg = getPkg(id); if (pkg.status !== 'arrived') throw new Error(`${pkg.subNumber} is already open — cannot shelve`);
  const bin = normBin(input.shelfBin); if (!SHELF_BINS.includes(bin)) throw new Error(`Unknown bin “${input.shelfBin}” — use BIN-01…BIN-${SHELF_BINS.length}`);
  const taken = store.packages.find((p) => p.id !== pkg.id && p.status === 'arrived' && p.shelfBin === bin); if (taken) throw new Error(`${bin} is occupied by ${taken.subNumber}`);
  if (input.estimateId) { pkg.estimateId = input.estimateId; pkg.clientId = byId(store.estimates, input.estimateId).clientId; } else if (input.clientId) pkg.clientId = input.clientId;
  pkg.shelfBin = bin; const manual = !!(input.clientId || input.estimateId);
  const scan = pushScan(pkg, { kind: 'shelved', trackingNumber: pkg.trackingNumber, clientId: pkg.clientId, shelfBin: bin, matched: manual ? 'manual' : pkg.scans?.[0]?.matched ?? 'none', note: manual ? `client assigned by hand → ${fullNameOf(byId(fx.clients, pkg.clientId!))}` : undefined });
  stamp(`Scan 1 · shelved in ${bin}${pkg.clientId ? ` · ${fullNameOf(byId(fx.clients, pkg.clientId))}` : ' · client unknown'}${manual ? ' (assigned by hand)' : ''}`, pkg.subNumber);
  if (pkg.clientId && !pkg.scans?.some((s) => s.note?.includes('courtesy email'))) { const em = queuePackageAcceptedEmail(pkg); if (em) scan.note = [scan.note, `courtesy email queued → ${em.to}`].filter(Boolean).join(' · '); }
  return resolve(pkgWithRefs(pkg));
}
// Scan 2 — by bin, tracking # or SUB#. Logs the open event and hands the package to Stage 2 (existing receivePackage flow, no duplication).
export async function openScan(query: string): Promise<PackageWithRefs> {
  const q = query.trim().toUpperCase(); if (!q) throw new Error('Scan a bin, tracking number or SUB#'); const bin = normBin(q);
  const pkg = store.packages.find((p) => p.status === 'arrived' && (p.shelfBin === bin || p.trackingNumber?.toUpperCase() === q || p.subNumber.toUpperCase() === q));
  if (!pkg) { const done = store.packages.find((p) => p.trackingNumber?.toUpperCase() === q || p.subNumber.toUpperCase() === q); throw new Error(done ? `${done.subNumber} was already opened (${done.status})` : `Nothing on the shelf matches “${query}”`); }
  pkg.openedAt = new Date().toISOString(); pkg.openedBy = actor().by; pushScan(pkg, { kind: 'open', trackingNumber: pkg.trackingNumber, clientId: pkg.clientId, shelfBin: pkg.shelfBin, matched: pkg.clientId ? pkg.scans?.find((s) => s.kind === 'shelved')?.matched ?? 'manual' : 'none', note: `opened from ${pkg.shelfBin ?? 'shelf'} → Stage 2 · Receive Package` });
  stamp(`Scan 2 · opened from ${pkg.shelfBin ?? 'shelf'} → Stage 2`, pkg.subNumber);
  return resolve(pkgWithRefs(pkg));
}
export const shelfPackagesSync = (clientId: string): Package[] => store.packages.filter((p) => p.clientId === clientId && p.status === 'arrived' && !!p.shelfBin);
export interface PackageCustody { pkg: PackageWithRefs; scans: PackageScan[]; shipment?: ShipmentWithRefs }
export async function getPackageCustody(packageId: string): Promise<PackageCustody | null> {
  const pkg = store.packages.find((p) => p.id === packageId); if (!pkg) return resolve(null); const sh = shp.rows.find((s) => pkg.trackingNumber && s.trackingNumber === pkg.trackingNumber);
  return resolve({ pkg: pkgWithRefs(pkg), scans: [...(pkg.scans ?? [])].sort((a, b) => a.at.localeCompare(b.at)), shipment: sh ? shipRefs(sh) : undefined });
}

const estimateDigits = (s: string) => s.trim().toUpperCase().replace(/^EST-?/, '').replace(/^E/, '').replace(/^0+/, '');

export async function lookupEstimate(numberOrId: string): Promise<EstimateWithRefs | null> {
  const q = estimateDigits(numberOrId);
  const est = store.estimates.find((e) => e.id === numberOrId || (q && estimateDigits(e.number) === q));
  return resolve(est ? withRefs(est) : null);
}

export interface ReceivePackageInput {
  cameraBypass?: boolean;
  trackingNumber?: string;
  estimateId?: string;
  clientId?: string;
  contents: string[];
  photos: PackagePhoto[];
  notes?: string;
}

export async function receivePackage(id: string, input: ReceivePackageInput): Promise<{ pkg: PackageWithRefs; email: OutboxEmail | null }> {
  const pkg = getPkg(id);
  if (pkg.status !== 'arrived') throw new Error('Package is not awaiting processing');
  if (input.contents.length === 0) throw new Error('Describe what was received (pick at least one pill)');
  if (input.photos.length === 0 && !input.cameraBypass) throw new Error('Take at least one photo — or tick “Camera not working” to bypass (logged to the MH Hitlist)');
  if (input.cameraBypass && input.photos.length === 0) logBypass({ kind: 'receiving_camera', jobNumber: pkg.subNumber, reason: 'Camera not working — photo/scan verification skipped at Receive Package', context: { detail: `${pkg.carrier}${pkg.trackingNumber ? ` ${pkg.trackingNumber}` : ''} · ${input.contents.join(', ')}` } });
  const a = actor();
  const est = input.estimateId ? store.estimates.find((e) => e.id === input.estimateId) : undefined;
  pkg.trackingNumber = input.trackingNumber?.trim() || pkg.trackingNumber;
  pkg.estimateId = est?.id;
  pkg.clientId = est?.clientId ?? input.clientId ?? pkg.clientId;
  pkg.contents = [...input.contents];
  pkg.photos = [...input.photos];
  pkg.notes = input.notes;
  pkg.status = 'processed';
  pkg.processedAt = new Date().toISOString();
  pkg.processedBy = a.by;

  let email: OutboxEmail | null = null;
  const client = pkg.clientId ? fx.clients.find((c) => c.id === pkg.clientId) : undefined;
  if (client) {
    const watch = est ? store.watches.find((w) => w.id === est.watchId) : undefined;
    const what = watch ? `${watch.brand} ${watch.model}` : 'package';
    email = {
      id: `ob-${Date.now().toString(36)}`,
      to: client.email,
      toName: `${client.firstName} ${client.lastName}`,
      relatedRef: est ? `${pkg.subNumber} · ${est.number}` : pkg.subNumber,
      status: 'pending',
      subject: est ? `We’ve received your ${what} — ${est.number}` : `We’ve received your package — ${pkg.subNumber}`,
      body: `Hello ${client.firstName},\n\nYour package arrived safely at RolliSuite today. We logged: ${pkg.contents.join(', ')}.\n\nIt now moves to inspection, where we verify the watch${est ? ` against your estimate ${est.number}` : ''} before any work begins. You’ll hear from us once inspection is complete.\n\nSub#: ${pkg.subNumber}\n\n— The RolliSuite team`,
      createdAt: new Date().toISOString(),
      createdBy: a.by,
      station: a.station,
    };
    queueOutbox(email);
  }
  stamp(`Package processed · ${pkg.contents.join(', ')} · ${pkg.photos.length} photo${pkg.photos.length === 1 ? '' : 's'}${est ? ` · linked ${est.number}` : ''}${email ? ' · confirmation email queued' : ' · no client email (unknown client)'}`, pkg.subNumber);
  return resolve({ pkg: pkgWithRefs(pkg), email });
}

export async function printDropOffReceipt(id: string): Promise<PackageWithRefs> {
  const pkg = getPkg(id);
  pkg.receiptPrinted = true;
  stamp('Drop-off receipt printed (mock)', pkg.subNumber);
  return resolve(pkgWithRefs(pkg));
}

export async function recordWorkOrder(id: string, bin: Bin): Promise<PackageWithRefs> {
  const pkg = getPkg(id);
  if (pkg.status !== 'processed') throw new Error('Package must be processed before a work order');
  const a = actor();
  pkg.status = 'awaiting_inspection';
  pkg.bin = bin;
  pkg.workOrderAt = new Date().toISOString();
  pkg.workOrderBy = a.by;
  stamp(`Handwritten work order confirmed · assigned to ${bin} bin`, pkg.subNumber);
  return resolve(pkgWithRefs(pkg));
}

export async function findPackageForInspection(estimateNumber: string): Promise<PackageWithRefs | null> {
  const est = await lookupEstimate(estimateNumber);
  if (!est) return null;
  const pkg = store.packages.find((p) => p.estimateId === est.id && p.status === 'awaiting_inspection');
  return pkg ? pkgWithRefs(pkg) : null;
}

const uniq = <T>(xs: T[]) => Array.from(new Set(xs));

export async function getInspectionContext(packageId: string, itemId?: string): Promise<InspectionContext> {
  const pkg = pkgWithRefs(getPkg(packageId));
  if (!pkg.estimate || !pkg.estimate.watch) throw new Error('Package has no linked estimate with a watch — go back to Receive Package');
  const items = pkg.estimate.items;
  if (items && items.length > 1) {
    // Item-scoped: expected / suggested / received all come from THIS item's chips, lines and scans — never the estimate-wide union
    const item = items.find((i) => i.id === itemId) ?? items[0];
    const ic = itemCodes(pkg.estimate.lines, items, item);
    return resolve({ pkg, estimate: pkg.estimate, expectedComponents: uniq(ic.codes.flatMap((d) => fx.DEPT_COMPONENTS[d])), suggestedWorkflow: [...ic.codes], item: { id: item.id, number: itemNumber(items, item.id), count: items.length, label: item.label, inferred: ic.inferred }, receivedForItem: pkg.itemContents?.[item.id] ?? [] });
  }
  const depts = pkg.estimate.components?.length ? [...pkg.estimate.components] : uniq(pkg.estimate.lines.map((l) => l.dept));
  const expectedComponents = uniq(depts.flatMap((d) => fx.DEPT_COMPONENTS[d]));
  return resolve({ pkg, estimate: pkg.estimate, expectedComponents, suggestedWorkflow: depts });
}
// Per-item Scan 1 (received) / Scan 2 (verified) — written only under this item's key; other items' records are untouched
export async function setItemScan(packageId: string, itemId: string, patch: { received?: string[]; verified?: string[] }): Promise<PackageWithRefs> {
  const pkg = getPkg(packageId); const a = actor(); const est = pkg.estimateId ? store.estimates.find((e) => e.id === pkg.estimateId) : undefined; const items = est?.items ?? [];
  const n = itemNumber(items, itemId); const tag = `Item ${n} of ${items.length}`;
  if (patch.received) { pkg.itemContents = { ...(pkg.itemContents ?? {}), [itemId]: [...patch.received] }; stamp(`${tag} · Scan 1 · received ${patch.received.join(', ') || '— nothing'}`, pkg.subNumber); }
  if (patch.verified) { pkg.itemComponentsVerified = { ...(pkg.itemComponentsVerified ?? {}), [itemId]: { at: new Date().toISOString(), by: a.by, components: [...patch.verified] } }; stamp(`${tag} · Scan 2 · verified in hand ${patch.verified.join(', ') || '— nothing'}`, pkg.subNumber); }
  return resolve(pkgWithRefs(pkg));
}

export async function findWatchBySerial(reference: string, serial: string): Promise<WatchMatch | null> {
  const ref = reference.trim().toUpperCase();
  const ser = serial.trim().toUpperCase();
  if (!ref || !ser || ser === 'NS') return resolve(null);
  const watch = store.watches.find((w) => w.reference.toUpperCase() === ref && w.serial.toUpperCase() === ser);
  if (!watch) return resolve(null);
  const jobs = store.jobs.filter((j) => j.watchId === watch.id);
  const packages = store.packages.filter((p) => {
    const est = p.estimateId ? store.estimates.find((e) => e.id === p.estimateId) : undefined;
    return est?.watchId === watch.id && (p.status === 'received' || p.status === 'discrepancy_hold');
  });
  // Only a watch with real history triggers the same-watch fork
  if (jobs.length === 0 && packages.length === 0 && watch.status === 'expected') return resolve(null);
  return resolve({ watch, client: byId(fx.clients, watch.clientId), jobs, packages });
}

const queueLabel = (l: Omit<LabelJob, 'id' | 'createdAt' | 'createdBy' | 'station' | 'printed'>) => {
  const a = actor();
  store.counters.label += 1;
  const job: LabelJob = { ...l, id: `lb-${String(store.counters.label).padStart(2, '0')}`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station, printed: false };
  store.labels.unshift(job);
  return job;
};

export interface ReceiveWatchResult {
  pkg: PackageWithRefs;
  discrepancies: string[];
  labels: LabelJob[];
}

export function computeDiscrepancies(ctx: InspectionContext, input: ReceiveWatchInput): string[] {
  const out: string[] = [];
  ctx.expectedComponents.filter((c) => !input.componentsReceived.includes(c)).forEach((c) => out.push(`Missing component: ${c}`));
  const expWatch = ctx.estimate.watch!;
  const expectedSerial = expWatch.serial.toUpperCase();
  const ser = input.serial.trim().toUpperCase();
  if (ser && ser !== 'NS' && ser !== expectedSerial) out.push(`Serial ${ser} differs from estimate (expected ${expectedSerial})`);
  if (input.reference.trim().toUpperCase() !== expWatch.reference.toUpperCase()) out.push(`Reference ${input.reference.trim()} differs from estimate (expected ${expWatch.reference})`);
  if (input.extraWatch) out.push('Extra / unexpected watch in package');
  if (input.sameWatchDecision === 'conflict') out.push('Serial matches a different watch on file — flagged for review');
  return out;
}

export async function receiveWatch(packageId: string, input: ReceiveWatchInput): Promise<ReceiveWatchResult> {
  const ctx = await getInspectionContext(packageId, input.itemId);
  const pkg = getPkg(packageId);
  if (pkg.status !== 'awaiting_inspection') throw new Error('Package is not awaiting inspection');
  if (!input.reference.trim() || !input.serial.trim()) throw new Error('Reference and serial are required (use NS if unreadable)');
  if (input.workflow.length === 0) throw new Error('Pick at least one workflow department');
  const a = actor();
  const discrepancies = computeDiscrepancies(ctx, input);
  pkg.inspectedAt = new Date().toISOString();
  pkg.inspectedBy = a.by;
  if (ctx.item) {
    // Multi-item: this commit's verification is recorded under the selected item; package-level fields become the union of per-item records (whole-job read model)
    pkg.itemComponentsVerified = { ...(pkg.itemComponentsVerified ?? {}), [ctx.item.id]: { at: pkg.inspectedAt, by: a.by, components: [...input.componentsReceived] } };
    pkg.itemWorkflow = { ...(pkg.itemWorkflow ?? {}), [ctx.item.id]: [...input.workflow] };
    pkg.componentsVerified = uniq(Object.values(pkg.itemComponentsVerified).flatMap((v) => v.components));
    pkg.workflow = uniq(Object.values(pkg.itemWorkflow).flat());
    stamp(`Item ${ctx.item.number} of ${ctx.item.count} · Scan 2 · verified ${input.componentsReceived.join(', ') || '— nothing'} · codes ${input.workflow.join('+')}`, pkg.subNumber);
  } else {
    pkg.workflow = [...input.workflow];
    pkg.componentsVerified = [...input.componentsReceived];
  }
  pkg.notes = input.notes || pkg.notes; pkg.itemLabel = input.itemLabel?.trim() || pkg.itemLabel;
  if (input.clientRef !== undefined) { const e0 = store.estimates.find((e) => e.id === ctx.estimate.id); if (e0 && (e0.clientRef ?? '') !== input.clientRef.trim()) { e0.clientRef = input.clientRef.trim() || undefined; store.jobs.filter((j) => j.estimateId === e0.id).forEach((j) => { j.clientRef = e0.clientRef; }); stamp(`Client reference ${e0.clientRef ? `"${e0.clientRef}"` : 'cleared'} · threads into email subjects`, pkg.subNumber); } }
  // Target completion is set ONCE, here — the inspection form, estimate and client report read it from the estimate
  if (input.targetDate) { pkg.targetWeeks = input.targetWeeks; pkg.targetDate = input.targetDate; const e0 = store.estimates.find((e) => e.id === ctx.estimate.id); if (e0) { e0.targetWeeks = input.targetWeeks; e0.targetDate = input.targetDate; } }

  const watch = store.watches.find((w) => w.id === ctx.estimate.watchId);
  if (watch) {
    watch.reference = input.reference.trim().toUpperCase();
    if (input.serial.trim().toUpperCase() !== 'NS') watch.serial = input.serial.trim().toUpperCase();
    watch.status = discrepancies.length ? 'intake' : 'awaiting_approval';
    watch.receivedAt = pkg.inspectedAt;
  }

  let labels: LabelJob[] = [];
  if (discrepancies.length) {
    pkg.status = 'discrepancy_hold';
    pkg.discrepancyReason = discrepancies.join('. ');
    stamp(`Discrepancy hold · ${pkg.discrepancyReason}`, pkg.subNumber);
  } else {
    pkg.status = 'received';
    pkg.discrepancyReason = undefined;
    const est = ctx.estimate;
    const ref = input.reference.trim().toUpperCase();
    const ser = input.serial.trim().toUpperCase();
    labels = [
      queueLabel({ type: 'pdf417_data', packageId: pkg.id, estimateNumber: est.number, payload: `${est.number}|${pkg.subNumber}|${ref}|${ser}|${input.workflow.join(',')}`, lines: [est.number, pkg.subNumber, `${est.client.firstName} ${est.client.lastName}`, `Workflow ${input.workflow.join(' · ')}`] }),
      queueLabel({ type: 'ref_serial', packageId: pkg.id, estimateNumber: est.number, payload: `${ref} / ${ser}`, lines: watchLabelLines(est.number, est.client.lastName, est.watch!, ref, ser) }),
    ];
    stamp(`Watch received · ${ref} / ${ser} · workflow ${input.workflow.join('+')}${input.sameWatchDecision === 'returning' ? ' · same watch returning' : ''} · 2 labels queued`, pkg.subNumber);
  }
  return resolve({ pkg: pkgWithRefs(pkg), discrepancies, labels });
}

export async function getOutbox(): Promise<OutboxEmail[]> {
  return resolve([...store.outbox]);
}

export async function getLabelQueue(): Promise<LabelJob[]> {
  return resolve([...store.labels]);
}

export async function setLabelPrinted(id: string, printed: boolean): Promise<LabelJob> {
  const l = byId(store.labels, id);
  l.printed = printed;
  stamp(`${l.type === 'pdf417_data' ? 'PDF417 data label' : 'Ref/serial label'} ${printed ? 'printed (mock)' : 'marked unprinted'}`, l.estimateNumber);
  return resolve({ ...l });
}

// ---- Receive Watch extras — watch-label prefill from the serial decode, shared ref·serial scan parser, inspection photos, intake history + post-hoc edit ----
// Generic prefix families ("116xxx family", "Letter-prefix serial") are not label-worthy — fall back to the estimate's watch
export const labelModel = (watch: { brand: string; model: string }, serial: string, reference: string) => {
  const d = decodeSerial(serial, reference);
  return d.confidence !== 'none' && d.model && !/family|serial/i.test(d.model) ? `${d.brand} ${d.model.replace(/\s*\(.*\)$/, '')}` : `${watch.brand} ${watch.model}`;
};
const watchLabelLines = (estNumber: string, lastName: string, watch: { brand: string; model: string }, ref: string, ser: string) => [labelModel(watch, ser, ref), `Ref ${ref}`, `Serial ${ser}`, `${lastName} · ${estNumber}`];

// Accepts "REF / SER", "REF-SER", "Ref 16610 Serial Y528634" or a pasted PDF417 payload (EST|SUB|REF|SER|WF) — one normalisation for the photo flow and the label reprint scan
export const parseRefSerial = (raw: string): { reference: string; serial: string } | null => {
  let s = raw.trim().toUpperCase(); if (!s) return null;
  if (s.includes('|')) { const p = s.split('|').map((x) => x.trim()); return p.length >= 4 && p[2] && p[3] ? { reference: p[2], serial: p[3] } : null; }
  s = s.replace(/\bREF(?:ERENCE)?\b:?/g, ' ').replace(/\bSER(?:IAL)?\b:?/g, ' ').replace(/\s+/g, ' ').trim();
  const two = s.split(/\s*\/\s*|\s+/).filter(Boolean);
  if (two.length === 2) return { reference: two[0], serial: two[1] };
  if (two.length === 1 && s.includes('-')) {
    const idxs = [...s].map((c, i) => (c === '-' ? i : -1)).filter((i) => i > 0 && i < s.length - 1);
    const cands = idxs.map((i) => ({ reference: s.slice(0, i), serial: s.slice(i + 1) }));
    return cands.find((c) => store.watches.some((w) => w.reference.toUpperCase() === c.reference && w.serial.toUpperCase() === c.serial)) ?? cands[cands.length - 1] ?? null;
  }
  return null;
};

export async function setItemReceived(packageId: string, itemId: string, received: boolean): Promise<PackageWithRefs> {
  const pkg = getPkg(packageId); const cur = pkg.itemsReceived ?? []; pkg.itemsReceived = received ? Array.from(new Set([...cur, itemId])) : cur.filter((x) => x !== itemId);
  const est = pkg.estimateId ? store.estimates.find((e) => e.id === pkg.estimateId) : undefined; const n = est?.items ? est.items.findIndex((i) => i.id === itemId) + 1 : 0;
  stamp(`Item ${n} of ${est?.items?.length ?? 1} ${received ? 'in hand' : 'unmarked'}`, pkg.subNumber); return resolve(pkgWithRefs(pkg));
}
export const isInspectionPhoto = (p: PackagePhoto) => !!p.slot?.startsWith('inspection-');
export async function addPackageInspectionPhoto(packageId: string, p: { source: 'ipevo' | 'microscope'; dataUrl: string }): Promise<{ pkg: PackageWithRefs; photo: PackagePhoto; attachedToJob?: string }> {
  const pkg = getPkg(packageId);
  const n = pkg.photos.filter(isInspectionPhoto).length + 1;
  const photo: PackagePhoto = { id: newId('iph'), source: 'camera', dataUrl: p.dataUrl, slot: `inspection-${p.source}-${n}`, fileName: `${p.source === 'ipevo' ? 'IPEVO overview' : 'Microscope detail'} ${n}` };
  pkg.photos.push(photo);
  const est = pkg.estimateId ? store.estimates.find((e) => e.id === pkg.estimateId) : undefined;
  const j = est?.jobId ? store.jobs.find((x) => x.id === est.jobId) : undefined;
  if (j) addJobPhotoSync(j, { ...photo, photoType: 'inspection', stamp: false });
  stamp(`Inspection photo ${n} · ${p.source === 'ipevo' ? 'IPEVO' : 'microscope'}${j ? ` · attached to ${j.number}` : ''}`, pkg.subNumber);
  return resolve({ pkg: pkgWithRefs(pkg), photo, attachedToJob: j?.number });
}

export interface IntakeHistoryRow { pkg: PackageWithRefs; labels: LabelJob[]; labeled: boolean; photos: number }
export async function getIntakeHistory(q = ''): Promise<IntakeHistoryRow[]> {
  const s = q.trim().toLowerCase();
  const rows = store.packages.filter((p) => p.inspectedAt).map((p): IntakeHistoryRow => { const pkg = pkgWithRefs(p); const labels = store.labels.filter((l) => l.packageId === p.id); return { pkg, labels, labeled: labels.some((l) => l.printed), photos: p.photos.filter(isInspectionPhoto).length }; });
  const hit = (r: IntakeHistoryRow) => { const w = r.pkg.estimate?.watch; const c = r.pkg.client; return !s || [w?.brand, w?.model, w?.reference, w?.serial, r.pkg.estimate?.number, r.pkg.subNumber, c?.firstName, c?.lastName].some((x) => x?.toLowerCase().includes(s)); };
  return resolve(rows.filter(hit).sort((a, b) => (b.pkg.inspectedAt ?? '').localeCompare(a.pkg.inspectedAt ?? '')));
}
export async function getLabelsForPackage(packageId: string): Promise<LabelJob[]> { return resolve(store.labels.filter((l) => l.packageId === packageId)); }

export interface IntakeEditInput { reference: string; serial: string; itemLabel?: string; clientRef?: string; notes?: string; componentsVerified: string[]; workflow: DeptCode[]; targetWeeks?: number; targetDate?: string }
export async function updateIntakeRecord(packageId: string, input: IntakeEditInput): Promise<PackageWithRefs> {
  const pkg = getPkg(packageId); if (!pkg.inspectedAt) throw new Error('Watch has not been received yet');
  const ref = input.reference.trim().toUpperCase(); const ser = input.serial.trim().toUpperCase();
  if (!ref || !ser) throw new Error('Reference and serial are required (use NS if unreadable)'); if (!input.workflow.length) throw new Error('Pick at least one component code');
  const est = pkg.estimateId ? store.estimates.find((e) => e.id === pkg.estimateId) : undefined; const watch = est ? store.watches.find((w) => w.id === est.watchId) : undefined;
  const changes: string[] = [];
  if (watch && watch.reference !== ref) { changes.push(`ref ${watch.reference}→${ref}`); watch.reference = ref; }
  if (watch && ser !== 'NS' && watch.serial !== ser) { changes.push(`serial ${watch.serial}→${ser}`); watch.serial = ser; }
  if ((pkg.workflow ?? []).join() !== input.workflow.join()) { changes.push(`workflow ${(pkg.workflow ?? []).join('+') || '—'}→${input.workflow.join('+')}`); pkg.workflow = [...input.workflow]; }
  if ((pkg.componentsVerified ?? []).join() !== input.componentsVerified.join()) { changes.push(`components ${input.componentsVerified.join(', ') || '—'}`); pkg.componentsVerified = [...input.componentsVerified]; }
  if ((pkg.itemLabel ?? '') !== (input.itemLabel ?? '').trim()) { changes.push(`item label "${(input.itemLabel ?? '').trim()}"`); pkg.itemLabel = input.itemLabel?.trim() || undefined; }
  if ((pkg.notes ?? '') !== (input.notes ?? '').trim()) { changes.push('notes'); pkg.notes = input.notes?.trim() || undefined; }
  if (est && input.clientRef !== undefined && (est.clientRef ?? '') !== input.clientRef.trim()) { changes.push(`client ref "${input.clientRef.trim() || '—'}"`); est.clientRef = input.clientRef.trim() || undefined; store.jobs.filter((j) => j.estimateId === est.id).forEach((j) => { j.clientRef = est.clientRef; }); }
  if (input.targetDate && input.targetDate !== pkg.targetDate) { changes.push(`target ${pkg.targetDate ?? '—'}→${input.targetDate}`); pkg.targetWeeks = input.targetWeeks; pkg.targetDate = input.targetDate; if (est) { est.targetWeeks = input.targetWeeks; est.targetDate = input.targetDate; } insp.forms.filter((f) => f.jobId && est?.jobId === f.jobId).forEach((f) => { f.targetTo = input.targetDate; f.targetWeeks = input.targetWeeks ?? f.targetWeeks; }); }
  if (est && watch) { const c = fx.clients.find((x) => x.id === est.clientId); store.labels.filter((l) => l.packageId === pkg.id).forEach((l) => { if (l.type === 'ref_serial') { l.payload = `${ref} / ${ser}`; l.lines = watchLabelLines(est.number, c?.lastName ?? '', watch, ref, ser); } else { l.payload = `${est.number}|${pkg.subNumber}|${ref}|${ser}|${(pkg.workflow ?? []).join(',')}`; l.lines[3] = `Workflow ${(pkg.workflow ?? []).join(' · ')}`; } }); }
  stamp(`Intake record edited · ${changes.join(' · ') || 'no changes'}`, pkg.subNumber);
  return resolve(pkgWithRefs(pkg));
}

// ---- Estimates (E3) ---------------------------------------------------------

export { totalsFor as computeEstimateTotals } from './fixtures/estimates';

const TAX_RATE_UNAPPLIED = 0.0825; // exists in legacy, never applied — kept for display only
export const ESTIMATE_TAX_RATE_DISPLAY = TAX_RATE_UNAPPLIED;

const estStamp = (e: Estimate, detail: string) => {
  const a = actor();
  appendAudit({ type: 'estimate', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${e.number} · ${detail}` });
};

const getEst = (id: string) => byId(store.estimates, id);
const recalc = (e: Estimate) => {
  Object.assign(e, fx.totalsFor(e.lines));
  e.department = fx.primaryDepartment(e.lines);
  e.updatedAt = new Date().toISOString();
};
const isEditable = (e: Estimate) => !e.historical && (e.status === 'draft' || e.status === 'sent');
const nextEstimateNumber = () => `E${String(++store.counters.estimate).padStart(5, '0')}`;
const newLineId = () => `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

export async function getServiceCatalog(): Promise<CatalogService[]> {
  return resolve(fx.catalog);
}

export async function searchEstimates(query: string, status?: EstimateStatus | 'all'): Promise<EstimateWithRefs[]> {
  const q = query.trim().toLowerCase();
  const digits = estimateDigits(query);
  const rows = (await getEstimates()).filter((e) => {
    if (status && status !== 'all' && e.status !== status) return false;
    if (!q) return true;
    const name = `${e.client.firstName} ${e.client.lastName}`.toLowerCase();
    return (digits && estimateDigits(e.number).startsWith(digits)) || name.includes(q) || e.client.email.toLowerCase().includes(q);
  });
  return rows;
}

export async function getQuoteContext(clientId: string, watchId?: string, excludeId?: string): Promise<QuoteContext> {
  const all = await getEstimates();
  return {
    clientEstimates: all.filter((e) => e.clientId === clientId && e.id !== excludeId),
    watchEstimates: watchId ? all.filter((e) => e.watchId === watchId && e.id !== excludeId) : [],
  };
}

export interface NewClientInput { firstName: string; lastName: string; email: string; phone: string }
export interface NewWatchInput { brand: 'Rolex' | 'Tudor'; model: string; reference: string; serial: string; partNumber?: string }

export async function createClient(input: NewClientInput): Promise<Client> {
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error('Client first and last name are required');
  const c: Client = { id: `c-${Date.now().toString(36)}`, firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(), phone: input.phone.trim(), street: '', city: '', state: '', type: 'retail', since: new Date().toISOString() };
  fx.clients.push(c);
  return resolve(c);
}

export async function createWatch(clientId: string, input: NewWatchInput): Promise<Watch> {
  const w: Watch = { id: `w-${Date.now().toString(36)}`, clientId, brand: input.brand, model: input.model.trim() || 'Unknown model', reference: input.reference.trim().toUpperCase() || 'UNKNOWN', serial: input.serial.trim().toUpperCase() || 'NS', dial: '', bracelet: input.partNumber?.trim() ?? '', status: 'expected', receivedAt: new Date().toISOString() };
  store.watches.push(w);
  return resolve(w);
}

export interface EstimateInput {
  items?: EstimateItem[];
  clientId: string;
  watchId?: string;
  requestId?: string;
  lines: EstimateLine[];
  validUntil: string;
  clientNotes: string;
  messageNotes: string;
  internalNotes: string;
  billingAddress: Address;
  shippingAddress: Address;
  shippingMirrorsBilling: boolean;
  components?: DeptCode[];
}

const realLines = (lines: EstimateLine[]) => lines.filter((l) => l.description.trim() || l.unitPrice !== 0);

export async function createEstimate(input: EstimateInput): Promise<EstimateWithRefs> {
  if (!input.clientId) throw new Error('No customer — nothing saved');
  const a = actor();
  const lines = realLines(input.lines).map((l) => ({ ...l, id: l.id || newLineId() }));
  const e: Estimate = {
    id: `e-${Date.now().toString(36)}`,
    number: nextEstimateNumber(),
    revision: 1,
    revisions: [],
    clientId: input.clientId,
    watchId: input.watchId,
    department: 'watchmaking',
    status: 'draft',
    lines,
    items: input.items && input.items.length > 1 ? input.items.map((i) => ({ ...i })) : undefined,
    subtotal: 0, shippingAmount: 0, taxAmount: 0, total: 0,
    validUntil: input.validUntil,
    clientNotes: input.clientNotes,
    messageNotes: input.messageNotes || 'Thank you for your business.',
    internalNotes: input.internalNotes,
    billingAddress: input.billingAddress,
    shippingAddress: input.shippingMirrorsBilling ? input.billingAddress : input.shippingAddress,
    shippingMirrorsBilling: input.shippingMirrorsBilling,
    components: input.components?.length ? [...input.components] : uniq(lines.map((l) => l.dept)),
    historical: false,
    createdAt: new Date().toISOString(),
    createdBy: a.by,
    updatedAt: new Date().toISOString(),
  };
  recalc(e);
  syncEstimateComponents(e);
  store.estimates.unshift(e);
  estStamp(e, `Draft created · ${lines.length} line${lines.length === 1 ? '' : 's'} · ${e.total.toFixed(2)}`);
  e.items?.forEach((it) => { if (it.componentsOverride) estStamp(e, `Item ${itemNumber(e.items!, it.id)} of ${e.items!.length} · component codes override → ${it.components!.join('+')} (inferred was ${it.componentsOverride.from.join('+') || '—'}) · by ${it.componentsOverride.by}`); });
  if (input.requestId) linkEstimateToRequest(e, input.requestId);
  return resolve(withRefs(e));
}

export type EstimatePatch = Partial<Omit<EstimateInput, 'clientId'>>;

const applyPatch = (e: Estimate, patch: EstimatePatch) => {
  if (patch.items) {
    // Removal is BLOCKED once an item has any custody scan — a custody-touched item must never silently disappear
    const next = new Set(patch.items.map((i) => i.id)); const pkgs = store.packages.filter((p) => p.estimateId === e.id);
    (e.items ?? []).forEach((it) => { if (!next.has(it.id) && pkgs.some((p) => p.itemContents?.[it.id] || p.itemComponentsVerified?.[it.id] || p.itemsReceived?.includes(it.id))) throw new Error(`Item ${itemNumber(e.items!, it.id)} of ${e.items!.length} has custody scans — it can't be removed`); });
    e.items = patch.items.length > 1 ? patch.items.map((i) => ({ ...i })) : undefined;
  }
  if (patch.lines) e.lines = realLines(patch.lines).map((l) => ({ ...l, id: l.id || newLineId() }));
  if (patch.components) e.components = uniq(patch.components);
  if (patch.watchId !== undefined) e.watchId = patch.watchId || undefined;
  if (patch.validUntil) e.validUntil = patch.validUntil;
  if (patch.clientNotes !== undefined) e.clientNotes = patch.clientNotes;
  if (patch.messageNotes !== undefined) e.messageNotes = patch.messageNotes;
  if (patch.internalNotes !== undefined) e.internalNotes = patch.internalNotes;
  if (patch.billingAddress) e.billingAddress = patch.billingAddress;
  if (patch.shippingMirrorsBilling !== undefined) e.shippingMirrorsBilling = patch.shippingMirrorsBilling;
  if (patch.shippingAddress) e.shippingAddress = patch.shippingAddress;
  if (e.shippingMirrorsBilling) e.shippingAddress = e.billingAddress;
  recalc(e);
  syncEstimateComponents(e);
};

// Draft: edit in place (autosaved by the UI)
export async function updateEstimate(id: string, patch: EstimatePatch): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.historical) throw new Error('Historical estimate is read-only');
  if (e.status !== 'draft') throw new Error('Only drafts edit in place — use Revise for a sent estimate');
  applyPatch(e, patch);
  return resolve(withRefs(e));
}

// Sent: snapshot the current version, then apply — prior versions are never overwritten
export async function reviseEstimate(id: string, patch: EstimatePatch): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (!isEditable(e)) throw new Error('Only draft or sent estimates can be revised');
  const a = actor();
  e.revisions = [
    { revision: e.revision, status: e.status, lines: e.lines.map((l) => ({ ...l })), subtotal: e.subtotal, shippingAmount: e.shippingAmount, total: e.total, validUntil: e.validUntil, clientNotes: e.clientNotes, messageNotes: e.messageNotes, internalNotes: e.internalNotes, savedAt: e.updatedAt, savedBy: a.by },
    ...e.revisions,
  ];
  e.revision += 1;
  applyPatch(e, patch);
  estStamp(e, `Revision ${e.revision} saved (rev ${e.revision - 1} kept) · ${e.total.toFixed(2)}`);
  return resolve(withRefs(e));
}

export async function duplicateEstimate(id: string): Promise<EstimateWithRefs> {
  const srcRow = getEst(id); const out = await duplicateEstimateInner(id); srcRow.supersededById = out.id; return out;
}
async function duplicateEstimateInner(id: string): Promise<EstimateWithRefs> {
  const src = getEst(id);
  const a = actor();
  const copy: Estimate = { ...src, id: `e-${Date.now().toString(36)}`, number: nextEstimateNumber(), revision: 1, revisions: [], status: 'draft', lines: src.lines.map((l) => ({ ...l, id: newLineId() })), historical: false, createdAt: new Date().toISOString(), createdBy: a.by, updatedAt: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(), sentAt: undefined, convertedAt: undefined, approvedAt: undefined, declinedAt: undefined, declineReason: undefined };
  recalc(copy);
  store.estimates.unshift(copy);
  estStamp(copy, `Duplicated from ${src.number}`);
  return resolve(withRefs(copy));
}

export async function deleteEstimate(id: string): Promise<void> {
  const e = getEst(id);
  if (e.status === 'converted') throw new Error('Converted estimates cannot be deleted');
  if (store.packages.some((p) => p.estimateId === id)) throw new Error('An intake package is linked to this estimate');
  store.estimates = store.estimates.filter((x) => x.id !== id);
  estStamp(e, 'Deleted');
  return resolve(undefined);
}

export async function markEstimateSent(id: string): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.status !== 'draft') throw new Error('Only a draft can be marked as sent');
  e.status = 'sent'; // no sent-at: mark-as-sent means "went out some other way"
  e.updatedAt = new Date().toISOString();
  estStamp(e, 'Marked as sent (no email)');
  return resolve(withRefs(e));
}

export async function sendEstimate(id: string, override?: { subject: string; body: string; source: 'shop' | 'personal' | 'one_off'; owner?: string }): Promise<{ estimate: EstimateWithRefs; email: OutboxEmail }> {
  const e = getEst(id);
  if (e.status !== 'draft' && e.status !== 'sent') throw new Error('Only draft or sent estimates can be sent');
  if (e.lines.length === 0) throw new Error('Add at least one line before sending');
  const a = actor();
  const c = byId(fx.clients, e.clientId);
  const w = e.watchId ? store.watches.find((x) => x.id === e.watchId) : undefined;
  const again = e.status === 'sent';
  const email: OutboxEmail = {
    id: `ob-${Date.now().toString(36)}`,
    to: c.email, toName: `${c.firstName} ${c.lastName}`,
    relatedRef: `${e.number} rev ${e.revision}`, status: 'pending',
    subject: override?.subject ?? `${again ? 'Your updated estimate' : 'Your estimate'} ${e.number} is ready to review`,
    body: override?.body ?? `Hello ${c.firstName},\n\n${again ? 'Your updated estimate' : 'Your estimate'} ${e.number} (revision ${e.revision})${w ? ` for the ${w.brand} ${w.model}` : ''} is ready. One tap opens it in your RolliConnect portal — review, approve, and request a prepaid shipping label right there. No attachment needed.\n\n▶ ${typeof window !== 'undefined' ? window.location.origin : ''}${clientLinkPath(issueClientLink('estimate', e.id, c.id))}\n\nThis link opens this estimate only (${LINK_EXPIRY.estimate}). Sign in to RolliConnect to see everything in one place.\n\n— The RolliSuite team`,
    createdAt: new Date().toISOString(), createdBy: a.by, station: a.station,
  };
  queueOutbox(email);
  e.status = 'sent';
  e.sentAt = new Date().toISOString();
  e.updatedAt = e.sentAt;
  estStamp(e, `${again ? 'Sent again' : 'Sent'} · rev ${e.revision} · email recorded in Sent${override ? ` · ${override.source === 'personal' ? `${override.owner}'s template` : override.source === 'one_off' ? 'edited for this send' : 'shop template'}` : ''}`);
  return resolve({ estimate: withRefs(e), email });
}

export async function declineEstimate(id: string, reason: string, via: 'staff' | 'portal' = 'staff'): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.status !== 'sent') throw new Error('Only a sent estimate can be declined');
  if (!reason.trim()) throw new Error('A decline reason is required');
  e.status = 'declined';
  e.declinedAt = new Date().toISOString();
  e.declineReason = reason.trim();
  e.updatedAt = e.declinedAt;
  estStamp(e, via === 'portal' ? `Declined by client via RolliConnect · ${e.declineReason}` : `Declined · ${e.declineReason}`);
  return resolve(withRefs(e));
}

// PROVISIONAL: staff records "client said yes". Not a legacy status transition — flagged in the UI.
export async function approveEstimate(id: string, via: 'staff' | 'portal' = 'staff'): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.status !== 'sent') throw new Error('Only a sent estimate can be approved');
  e.status = 'approved';
  e.approvedAt = new Date().toISOString();
  e.approvedVia = via;
  e.updatedAt = e.approvedAt;
  estStamp(e, via === 'portal' ? 'Approved by client via RolliConnect' : 'Approved by client (recorded by staff — provisional status)');
  return resolve(withRefs(e));
}

export async function reopenEstimate(id: string): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.status !== 'declined' && e.status !== 'expired') throw new Error('Only declined or expired estimates can be reopened');
  e.status = 'draft';
  e.declineReason = undefined;
  e.declinedAt = undefined;
  e.updatedAt = new Date().toISOString();
  estStamp(e, 'Reopened → draft');
  return resolve(withRefs(e));
}

export async function convertEstimate(id: string, target: 'job' | 'sales_order' | 'intake', lineIds?: string[]): Promise<JobWithRefs> {
  if (target === 'job') return createJobFromEstimate(id, lineIds);
  if (target === 'intake') return convertEstimateToIntake(id, lineIds);
  throw new Error('Use convertEstimateToSalesOrder for sales orders');
}

export interface ShippingCalcInput { units: number; hiAk: boolean; saturday: boolean; serviceLevel?: import('./types').ShipServiceLevel }
// Display-only legacy calculator (UNKNOWN whether it persists) — never written on save. 2-day is the base; 1-day (overnight) +25 — chosen, or forced when insured value > $25k (units > 25)
export function calcShipping(i: ShippingCalcInput) {
  const forcedOvernight = i.units > 25;
  const overnight = forcedOvernight || i.serviceLevel === '1_day';
  const amount = 35 + (overnight ? 25 : 0) + i.units * 1.5 + (i.hiAk ? 30 : 0) + (i.saturday ? 20 : 0);
  return { amount, overnight, forcedOvernight, serviceLevel: (overnight ? '1_day' : '2_day') as import('./types').ShipServiceLevel, insuredValue: i.units * 1000 };
}

// ---- Jobs (E4) — state machine per PROMPT-PACK-jobs.md ------------------------

export { JOB_FLOW, DEPT_OF_CODE } from './fixtures/jobs';

export interface JobAction {
  key: string;
  label: string;
  to: JobStatus;
  needsReason?: boolean;
  notifies?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
  provisional?: string;
}

// Only these buttons render — never a free status dropdown. Linear order is the pack's full status list;
// notify points are UNKNOWN in the pack (flagged provisional in the UI).

// ---- Per-component completion (MH ruling, first board walk) — decoupled from invoicing ----------------------------------
const COMPONENT_DEF: { key: ComponentKey; label: string; depts: DeptCode[] }[] = [{ key: 'head', label: 'Watch head', depts: ['W'] }, { key: 'band', label: 'Band', depts: ['B'] }, { key: 'case', label: 'Case', depts: ['P', 'PM'] }];
const DONE_STATUSES: JobStatus[] = ['testing', 'ready_to_ship', 'closed'];
const techForDepts = (j: Job, depts: DeptCode[]) => (depts.includes('W') ? j.assignees.find((a) => a === 'MM' || a === 'MH') : j.assignees.find((a) => a === 'Walter')) ?? j.assignees[0] ?? j.createdBy;
// Components are derived from the workflow on first touch (fixtures predate the ruling); a job with no workflow gets one implicit component.
export const ensureComponents = (j: Job): JobComponent[] => {
  if (j.components) return j.components;
  const defs = COMPONENT_DEF.filter((d) => d.depts.some((x) => j.workflow.includes(x)));
  const comps: JobComponent[] = (defs.length ? defs : [{ key: 'head' as ComponentKey, label: 'Watch', depts: [] as DeptCode[] }]).map((d) => ({ ...d, depts: [...d.depts], rework: [] }));
  const seed = fx.componentSeeds[j.id];
  if (seed) seed.forEach((s) => { const c = comps.find((x) => x.key === s.key); if (c) { c.completedAt = s.at; c.completedBy = s.by; c.completedStation = 'Bench 1'; } });
  else if (DONE_STATUSES.includes(j.status)) { const at = j.finishedAt ?? j.timeline.find((t) => t.to === 'testing')?.at ?? j.createdAt; comps.forEach((c) => { c.completedAt = at; c.completedBy = techForDepts(j, c.depts); c.completedStation = 'Bench 1'; }); }
  j.components = comps; return comps;
};
export const componentsDone = (j: Job) => ensureComponents(j).filter((c) => c.completedAt).length;
export const componentsOutstanding = (j: Job): JobComponent[] => ensureComponents(j).filter((c) => !c.completedAt);
export const awaitingComponents = (j: Job) => j.status === 'in_service' && !activeHold(j) && componentsDone(j) > 0 && componentsOutstanding(j).length > 0;
// A hold blocks a leg when it is whole-job (no component) or scoped to that leg; asking without a key = "is anything completable here?"
export const holdBlocks = (j: Job, key?: ComponentKey): JobHold | undefined => { const h = activeHold(j); return h && (!h.component || h.component === key) ? h : undefined; };
export const canCompleteComponent = (j: Job, key?: ComponentKey) => j.status === 'in_service' && !holdBlocks(j, key);

const JOB_ACTIONS: Record<JobStatus, JobAction[]> = {
  intake: [{ key: 'start_review', label: 'Start review', to: 'in_review', tone: 'primary' }],
  in_review: [
    { key: 'request_approval', label: 'Send for customer approval', to: 'awaiting_customer_approval', tone: 'primary', notifies: true },
    { key: 'approve_direct', label: 'Mark approved (estimate pre-approved)', to: 'approved', provisional: 'Skip to approved when the linked estimate was already approved — not in the pack' },
  ],
  awaiting_customer_approval: [
    { key: 'approve', label: 'Customer approved', to: 'approved', tone: 'primary' },
    { key: 'back_to_review', label: 'Back to review…', to: 'in_review', needsReason: true, tone: 'neutral' },
  ],
  approved: [{ key: 'start_service', label: 'Start service', to: 'in_service', tone: 'primary' }],
  in_service: [{ key: 'to_testing', label: 'Send to testing / QC', to: 'testing', tone: 'primary' }],
  testing: [
    { key: 'qc_pass', label: 'QC pass → ready to ship', to: 'ready_to_ship', tone: 'primary', notifies: true },
    { key: 'qc_fail', label: 'QC fail → back to service…', to: 'in_service', needsReason: true, notifies: true, tone: 'danger' },
  ],
  awaiting_manager_review: [
    { key: 'trade_accept', label: 'Inspected / Accepted → invoice', to: 'ready_to_ship', tone: 'primary' },
    { key: 'trade_send_back', label: 'Send back…', to: 'in_service', needsReason: true, tone: 'danger' },
  ],
  ready_to_ship: [{ key: 'close', label: 'Close job', to: 'closed', tone: 'primary' }],
  closed: [],
};
// Trade lane (B2B / internal): post-work inspection hands off to the account's division manager instead of straight to invoice
const TRADE_TESTING_ACTIONS: JobAction[] = [
  { key: 'to_manager_review', label: 'Inspection passed → manager review', to: 'awaiting_manager_review', tone: 'primary' },
  { key: 'qc_fail', label: 'Inspection failed → back to bench…', to: 'in_service', needsReason: true, tone: 'danger' },
];
export const isTradeJob = (j: Job) => j.kind === 'trade';
export const isInternalTrade = (clientId: string) => !!byId(fx.clients, clientId).internal;
export const TRADE_SEND_BACK: { key: string; label: string }[] = [{ key: 'rework', label: 'Rework' }, { key: 'waiting_on_part', label: 'Waiting on part' }, { key: 'failed_inspection', label: 'Failed inspection' }, { key: 'other', label: 'Other' }];

export const activeHold = (j: Job): JobHold | undefined => j.holds.find((h) => !h.releasedAt);

// Skipped stages collapse: the action's target walks forward to the next stage the kind keeps
const skipForward = (kind: JobKind, to: JobStatus): JobStatus => {
  const skip = JOB_KIND_CONFIG[kind].skipStages;
  let i = fx.JOB_FLOW.indexOf(to);
  while (skip.includes(fx.JOB_FLOW[i]) && i < fx.JOB_FLOW.length - 1) i += 1;
  return fx.JOB_FLOW[i];
};

export function legalJobActions(j: Job): JobAction[] {
  if (activeHold(j)) return [];
  if (isTradeJob(j) && j.status === 'testing') return TRADE_TESTING_ACTIONS;
  if (isTradeJob(j) && j.status === 'intake') return [{ key: 'trade_scan_in', label: 'Scan in → work queue', to: 'in_service', tone: 'primary' }];
  const redirected = JOB_ACTIONS[j.status].map((a) => {
    const to = skipForward(j.kind, a.to);
    return to === a.to ? a : { ...a, to, provisional: `${JOB_KIND_CONFIG[j.kind].label} skips ${a.to.replace(/_/g, ' ')} — per-kind stage-skip config (provisional)` };
  });
  const isSkip = (a: JobAction) => a.provisional?.startsWith(JOB_KIND_CONFIG[j.kind].label) ?? false;
  const out: JobAction[] = [];
  [...redirected.filter((a) => !isSkip(a)), ...redirected.filter(isSkip)]
    .forEach((a) => { if (a.to !== j.status && !(isSkip(a) && out.some((o) => o.to === a.to))) out.push(a); });
  return out;
}

const HOLDABLE: JobStatus[] = ['approved', 'in_service', 'testing'];
export const canHold = (j: Job) => !activeHold(j) && j.simpleStatus === 'on_hand' && HOLDABLE.includes(j.status);

const WATCH_STATUS_FOR: Partial<Record<JobStatus, Watch['status']>> = { in_service: 'in_service', testing: 'qc', awaiting_manager_review: 'qc', ready_to_ship: 'awaiting_pickup', closed: 'released', awaiting_customer_approval: 'awaiting_approval' };

const getJobRow = (id: string) => byId(store.jobs, id);
const nextJobNumber = () => `E${String(++store.counters.job).padStart(5, '0')}`; // pack: `E` + digits from a next-job-id sequence
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

const jobStamp = (j: Job, detail: string) => {
  const a = actor();
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${j.number} · ${detail}` });
};

const queueJobEmail = (j: Job, subject: string, body: string): OutboxEmail | undefined => {
  const a = actor();
  const c = byId(fx.clients, j.clientId);
  if (c.type === 'trade' && isTradeJob(j)) { jobStamp(j, `Email suppressed (trade account${c.internal ? ', internal' : ''}) · ${subject}`); return undefined; }
  const w = byId(store.watches, j.watchId);
  const email: OutboxEmail = {
    id: `ob-${Date.now().toString(36)}`,
    to: c.email, toName: `${c.firstName} ${c.lastName}`,
    relatedRef: j.number, status: 'pending',
    subject: `${subject} — ${w.brand} ${w.model} (${j.number})`,
    body: `Hello ${c.firstName},\n\n${body}\n\nJob: ${j.number} · ${w.brand} ${w.model} ${w.reference}\n\n— The RolliSuite team`,
    createdAt: new Date().toISOString(), createdBy: a.by, station: a.station,
  };
  queueOutbox(email);
  return email;
};

const EMAIL_FOR: Record<string, (j: Job, reason?: string) => [string, string]> = {
  request_approval: () => ['Your estimate is ready for approval', 'We have finished reviewing your watch and the estimate is ready for your approval. Please reply to this email or call the shop to confirm.'],
  qc_pass: () => ['Your watch is ready', 'Your watch has passed final testing and quality control and is ready to ship or collect. We will be in touch to arrange delivery.'],
  qc_fail: (_j, reason) => ['A short delay on your watch', `During final testing we found something we want to correct before it leaves the shop: ${reason}. It has gone back to the bench and we will update you when testing is complete.`],
};

const pushTransition = (j: Job, action: string, to: JobStatus, reason?: string, emailQueued?: boolean) => {
  const a = actor();
  j.timeline.push({ id: newId('jt'), from: j.status, to, action, reason, emailQueued, at: new Date().toISOString(), by: a.by, station: a.station });
  j.status = to;
  const ws = WATCH_STATUS_FOR[to];
  const w = store.watches.find((x) => x.id === j.watchId);
  if (ws && w) w.status = ws;
  if (to === 'closed') { j.finishedAt = new Date().toISOString(); j.simpleStatus = 'finished'; }
};

export async function transitionJob(id: string, actionKey: string, reason?: string): Promise<JobWithRefs> {
  const j = getJobRow(id);
  if (activeHold(j)) throw new Error('Job is on hold — release the hold first');
  const action = legalJobActions(j).find((x) => x.key === actionKey);
  if (!action) throw new Error(`"${actionKey}" is not a legal action from ${j.status}`);
  if (action.needsReason && !reason?.trim()) throw new Error('A reason is required for this step');
  const gaps = reviewGaps(j);
  if (gaps.length) throw new Error(gaps.join(' · '));
  if (action.key === 'qc_pass') { const ev = evidenceGaps(j); if (ev.length) throw new Error(`Evidence missing at QC: ${ev.map((k) => EVIDENCE_SLOTS.find((x) => x.key === k)!.label).join(', ')}`); const cr = qcRequestGaps(j); if (cr.length) throw new Error(`QC blocked — client request not checked off: “${cr[0].text}”${cr.length > 1 ? ` (+${cr.length - 1} more)` : ''}`); }
  if (action.key === 'to_testing') {
    const comps = ensureComponents(j); const out = componentsOutstanding(j);
    if (comps.length === 1 && out.length === 1) { const a = actor(); const c = out[0]; c.completedAt = new Date().toISOString(); c.completedBy = a.by; c.completedStation = a.station; jobStamp(j, `Component complete · ${c.label} · by ${a.by} (implicit single component)`); }
    else if (out.length) throw new Error(`Reunification rule: mark every component complete first — still out: ${out.map((c) => c.label).join(', ')}`);
  }
  if (action.key === 'qc_fail') ensureComponents(j).filter((c) => c.completedAt).forEach((c) => c.rework.push({ at: new Date().toISOString(), reason: reason!.trim(), by: actor().by }));
  const mail = action.notifies ? EMAIL_FOR[action.key] : undefined;
  let queued = false;
  if (mail) { const [s, b] = mail(j, reason?.trim()); queueJobEmail(j, s, b); queued = true; }
  pushTransition(j, action.key, action.to, reason?.trim(), queued);
  jobStamp(j, `${action.label.replace('…', '')} · ${humanizeStatus(action.to)}${reason ? ` · ${reason.trim()}` : ''}${queued ? ' · client email queued' : ''}`);
  if (action.key === 'to_manager_review') tradeHandoff(j);
  if (action.key === 'trade_accept') tradeAccept(j);
  if (action.key === 'trade_send_back') { ensureParts(j).forEach((c) => { c.completedAt = undefined; c.completedBy = undefined; c.rework.push({ at: new Date().toISOString(), reason: reason!.trim(), by: actor().by }); recordMove(j, c, laneOfPart(c.key) === 'band' ? 'refinish' : 'wm_bench_1', 'in_progress', 'pad', `sent back by ${actor().by} · ${reason!.trim()}`); }); store.pinned.filter((p) => p.jobId === j.id && p.title.startsWith('Trade review') && !p.dismissedAt).forEach((p) => { p.dismissedAt = new Date().toISOString(); p.dismissedBy = actor().by; }); }
  return resolve(jobRefs(j));
}
// Manager review hand-off: pin lands on the account manager's list (his division), no client email on trade work
const tradeHandoff = (j: Job) => {
  const c = byId(fx.clients, j.clientId); const w = byId(store.watches, j.watchId); const a = actor();
  const mgr = c.managerShort ? fx.users.find((u) => u.shortName === c.managerShort) : undefined;
  const division: Division = mgr && mgr.division !== 'both' ? mgr.division : j.division;
  store.pinned.unshift({ id: newId('pin'), title: `Trade review · ${j.number} ${w.brand} ${w.model} (${c.company ?? fullNameOf(c)}) — inspected, awaiting your acceptance`, assignedTo: mgr ? { type: 'user', shortName: mgr.shortName } : { type: 'role', role: 'manager' }, createdBy: a.by, jobId: j.id, createdAt: new Date().toISOString(), station: a.station, division });
  jobStamp(j, `Trade review queued for ${mgr?.shortName ?? 'a manager'} · pinned`);
};
// Accept = convert to invoice in one step; external trade accounts get the invoice email only, internal gets nothing
const tradeAccept = (j: Job) => {
  const a = actor(); const c = byId(fx.clients, j.clientId);
  const existing = store.salesOrders.find((o) => o.jobId === j.id && o.status !== 'cancelled');
  const o = existing ?? buildSO({ clientId: j.clientId, jobId: j.id, lines: j.lines.map((l) => ({ description: l.description, partNumber: l.partNumber, qty: l.qty, rate: l.unitPrice, dept: l.dept })), status: 'open' });
  if (!existing) soStamp(o, `Created from trade job ${j.number} · accepted by ${a.by}`);
  jobStamp(j, `Trade accepted by ${a.by} → invoice ${o.number} · ${fmtMoney(o.total)}`);
  store.pinned.filter((p) => p.jobId === j.id && p.title.startsWith('Trade review') && !p.dismissedAt).forEach((p) => { p.dismissedAt = new Date().toISOString(); p.dismissedBy = a.by; });
  if (!c.internal) { const w = byId(store.watches, j.watchId); queueOutbox({ id: newId('ob'), to: c.email, toName: c.company ?? fullNameOf(c), relatedRef: o.number, status: 'pending', payLink: payLinkPath(o), subject: `Invoice ${o.number} — ${w.brand} ${w.model} (${j.number})`, body: `Hello ${c.firstName},\n\nWork on ${w.brand} ${w.model} ${w.reference} (${j.number}) is complete and has been accepted by ${a.by}. Your invoice ${o.number} for ${fmtMoney(o.total)} is attached.\n\n— The RolliSuite team`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station }); soStamp(o, 'Invoice email queued (external trade account)'); }
  else soStamp(o, 'No email — internal trade account');
};

const humanizeStatus = (s: string) => s.replace(/_/g, ' ');
export async function completeComponent(jobId: string, key: ComponentKey): Promise<JobWithRefs> {
  const j = getJobRow(jobId); if (!canCompleteComponent(j, key)) throw new Error(holdBlocks(j, key) ? `${holdBlocks(j, key)!.component ? `${PART_LABEL[key]} is` : 'Job is'} on hold — release it first` : 'Components complete only while the job is in service');
  const c = ensureComponents(j).find((x) => x.key === key); if (!c) throw new Error('No such component on this job'); if (c.completedAt) throw new Error(`${c.label} is already complete (${c.completedBy})`);
  const a = actor(); c.completedAt = new Date().toISOString(); c.completedBy = a.by; c.completedStation = a.station;
  const out = componentsOutstanding(j);
  jobStamp(j, `Component complete · ${c.label} · by ${a.by}${out.length ? ` · still out: ${out.map((x) => x.label).join(', ')} → awaiting components` : ' · all components in'}`);
  if (!out.length) { pushTransition(j, 'to_testing', skipForward(j.kind, 'testing'), 'All components complete — reunified'); jobStamp(j, 'All components complete → testing / QC (auto, reunification)'); }
  return resolve(jobRefs(j));
}
export async function amendComponentAttribution(jobId: string, key: ComponentKey, shortName: string): Promise<JobWithRefs> {
  const a = actor(); if (!a.user || !canSuperviseUser(a.user)) throw new Error('Only a supervisor / manager can amend attribution');
  if (!fx.users.some((u) => u.shortName === shortName)) throw new Error('Pick someone from the staff list');
  const j = getJobRow(jobId); const c = ensureComponents(j).find((x) => x.key === key); if (!c?.completedAt) throw new Error('Only completed components can be re-attributed');
  if (c.completedBy === shortName) return resolve(jobRefs(j));
  c.amendedFrom = c.completedBy; c.completedBy = shortName; c.amendedAt = new Date().toISOString(); c.amendedBy = a.by;
  jobStamp(j, `Attribution amended · ${c.label} · ${c.amendedFrom} → ${shortName} · by ${a.by}`);
  return resolve(jobRefs(j));
}
export async function getCompletionsReport(): Promise<CompletionsReport> {
  const rows: Record<string, TechCompletionRow> = {}; const months = new Set<string>();
  store.jobs.forEach((j) => ensureComponents(j).forEach((c) => { if (!c.completedAt || !c.completedBy) return; const m = monthKey(c.completedAt); months.add(m);
    const r = rows[c.completedBy] ??= { tech: c.completedBy, months: {}, total: 0 }; const cell = r.months[m] ??= { total: 0, byDept: { W: 0, B: 0, P: 0, PM: 0 } };
    cell.total += 1; r.total += 1; (c.depts.length ? c.depts.filter((d) => j.workflow.includes(d)) : ['W' as DeptCode]).forEach((d) => { cell.byDept[d] += 1; }); }));
  return resolve({ months: [...months].sort().reverse().slice(0, 6), rows: Object.values(rows).sort((a, b) => b.total - a.total), generatedAt: new Date().toISOString() });
}
export const completionsThisMonth = (tech: string) => { const m = monthKey(new Date().toISOString()); return store.jobs.reduce((t, j) => t + ensureComponents(j).filter((c) => c.completedBy === tech && c.completedAt && monthKey(c.completedAt) === m).length, 0); };


// Assignees = working techs (many). Owner = accountable role (one) — never called "PM" (that code is precious metals).
export async function toggleAssignee(id: string, shortName: string): Promise<JobWithRefs> {
  const j = getJobRow(id);
  if (!fx.users.some((u) => u.shortName === shortName)) throw new Error('Pick someone from the staff list');
  const has = j.assignees.includes(shortName);
  j.assignees = has ? j.assignees.filter((a) => a !== shortName) : [...j.assignees, shortName];
  jobStamp(j, `${has ? 'Removed assignee' : 'Added assignee'} ${shortName} · now ${j.assignees.join(', ') || 'nobody'}`);
  return resolve(jobRefs(j));
}

// Per-kind config (lookup table, not an enum switch).
// MH ruling 2026-06: inspectionReport (multiple-choice form) only for service; inspection PHOTOS are required for every kind.
// skipStages for small_job stays PROVISIONAL (amber tag).
export const JOB_KIND_CONFIG: Record<JobKind, { label: string; defaultOwnerRole: Role | null; skipStages: JobStatus[]; inspectionReport: boolean; inspectionPhotos: true }> = {
  service: { label: 'Service', defaultOwnerRole: null, skipStages: ['awaiting_manager_review'], inspectionReport: true, inspectionPhotos: true },
  small_job: { label: 'Small job', defaultOwnerRole: 'concierge', skipStages: ['awaiting_customer_approval', 'awaiting_manager_review'], inspectionReport: false, inspectionPhotos: true },
  warranty: { label: 'Warranty', defaultOwnerRole: 'concierge', skipStages: ['awaiting_manager_review'], inspectionReport: false, inspectionPhotos: true },
  trade: { label: 'Trade', defaultOwnerRole: 'manager', skipStages: fx.TRADE_SKIP, inspectionReport: false, inspectionPhotos: true },
};

// Multiple-choice inspection form (service kind). Lookup table — add a row to add a question.
export const INSPECTION_QUESTIONS: { key: string; label: string; options: string[] }[] = [
  { key: 'case', label: 'Case', options: ['clean', 'light scratches', 'deep scratches', 'dented'] },
  { key: 'crystal', label: 'Crystal', options: ['clear', 'scratched', 'chipped', 'cracked'] },
  { key: 'bracelet', label: 'Bracelet / strap', options: ['tight', 'stretched', 'damaged', 'missing'] },
  { key: 'movement', label: 'Movement', options: ['running', 'intermittent', 'stopped'] },
  { key: 'water', label: 'Water resistance', options: ['pass', 'fail', 'not tested'] },
];

// Gate on leaving in_review: photos for every kind, report only where the kind requires it
export function reviewGaps(j: Job): string[] {
  if (j.status !== 'in_review') return [];
  const gaps: string[] = [];
  if (j.photos.length === 0) gaps.push('Inspection photos required (every kind)');
  if (JOB_KIND_CONFIG[j.kind].inspectionReport && !j.inspection) gaps.push('Inspection report not completed');
  return gaps;
}

export async function saveInspectionReport(id: string, answers: Record<string, string>): Promise<JobWithRefs> {
  const j = getJobRow(id);
  if (!JOB_KIND_CONFIG[j.kind].inspectionReport) throw new Error(`${JOB_KIND_CONFIG[j.kind].label} jobs take no inspection report (MH ruling) — photos only`);
  const missing = INSPECTION_QUESTIONS.filter((q) => !answers[q.key]);
  if (missing.length) throw new Error(`Answer every question: ${missing.map((q) => q.label).join(', ')}`);
  const a = actor();
  j.inspection = { answers: { ...answers }, at: new Date().toISOString(), by: a.by, station: a.station };
  jobStamp(j, `Inspection report saved · ${INSPECTION_QUESTIONS.map((q) => `${q.label} ${answers[q.key]}`).join(', ')}`);
  return resolve(jobRefs(j));
}
export const ROLES: Role[] = ['concierge', 'manager', 'inspector', 'watchmaker', 'polisher', 'band_tech'];
// 'inspector' is a TASK role, not a person's role (MH ruling 2026-09-29): it resolves to manager tier or above
const holdsRole = (u: User, r: Role) => u.roles.includes(r) || (r === 'inspector' && u.accessTier === 'manager');
export const roleHolders = (role: Role): User[] => fx.users.filter((u) => holdsRole(u, role));

export async function setJobOwner(id: string, role: Role | null): Promise<JobWithRefs> {
  const j = getJobRow(id);
  const prev = j.owner;
  j.owner = role ?? undefined;
  jobStamp(j, role ? `Owner → ${role} (${roleHolders(role).map((u) => u.shortName).join(', ') || 'no holder'})${prev ? ` · was ${prev}` : ''}` : `Owner cleared (was ${prev ?? 'none'})`);
  return resolve(jobRefs(j));
}

export async function placeHold(id: string, type: HoldType, reason: string, component?: ComponentKey): Promise<JobWithRefs> {
  const j = getJobRow(id);
  if (!reason.trim()) throw new Error('A hold reason is required');
  if (activeHold(j)) throw new Error('Job already has an active hold');
  if (!canHold(j)) throw new Error('Holds apply to on-hand jobs that are approved, in service or in testing');
  if (component && !ensureComponents(j).some((c) => c.key === component)) throw new Error(`${PART_LABEL[component]} is not a component of this job`);
  const a = actor();
  j.holds.unshift({ id: newId('jh'), type, reason: reason.trim(), priorStatus: j.status, placedAt: new Date().toISOString(), placedBy: a.by, station: a.station, component });
  const w = store.watches.find((x) => x.id === j.watchId);
  if (w && type === 'parts') w.status = 'awaiting_parts';
  jobStamp(j, `${type === 'parts' ? 'Parts' : 'Outsource'} hold placed${component ? ` · ${PART_LABEL[component]} only` : ''} · ${reason.trim()} · parked from ${humanizeStatus(j.status)}`);
  return resolve(jobRefs(j));
}

export async function releaseHold(id: string, note?: string): Promise<JobWithRefs> {
  const j = getJobRow(id);
  const h = activeHold(j);
  if (!h) throw new Error('No active hold on this job');
  const a = actor();
  h.releasedAt = new Date().toISOString();
  h.releasedBy = a.by;
  h.releaseNote = note?.trim() || undefined;
  j.status = h.priorStatus;
  const w = store.watches.find((x) => x.id === j.watchId);
  const ws = WATCH_STATUS_FOR[j.status];
  if (w && ws) w.status = ws;
  jobStamp(j, `${h.type === 'parts' ? 'Parts' : 'Outsource'} hold released · back to ${humanizeStatus(h.priorStatus)}${h.releaseNote ? ` · ${h.releaseNote}` : ''}`);
  return resolve(jobRefs(j));
}

export async function addJobNote(id: string, text: string): Promise<JobWithRefs> {
  const j = getJobRow(id);
  if (!text.trim()) throw new Error('Note is empty');
  const a = actor();
  j.notes.unshift({ id: newId('jn'), text: text.trim(), at: new Date().toISOString(), by: a.by, station: a.station });
  jobStamp(j, `Note added · ${text.trim().slice(0, 60)}`);
  return resolve(jobRefs(j));
}

// ---- ONE photo pipeline (D-390). Every entry point ends here: locked (private) by default, typed, stamped. Unlock = client sees it in RolliConnect. ----
export const PHOTO_TYPES: { key: PhotoType; label: string; blurb: string }[] = [
  { key: 'intake', label: 'Intake', blurb: 'Arrival / receive-watch condition shots' },
  { key: 'bench', label: 'Bench', blurb: 'Pad camera, WM kiosk, work-in-progress' },
  { key: 'post_work', label: 'Post-work', blurb: 'After-work / completed evidence' },
  { key: 'inspection', label: 'Inspection', blurb: 'Dual-camera inspection + guided authentication capture' },
];
export interface AddJobPhotoInput { dataUrl: string; photoType: PhotoType; slot?: string; fileName?: string; source?: PackagePhoto['source']; note?: string; id?: string; by?: string; station?: string; at?: string; replaceSlot?: boolean; stamp?: string | false }
export const addJobPhotoSync = (j: Job, p: AddJobPhotoInput): PackagePhoto & Stamp => {
  const a = actor();
  if (p.replaceSlot && p.slot) j.photos = j.photos.filter((x) => x.slot !== p.slot);
  const photo: PackagePhoto & Stamp = { id: p.id ?? newId('ph'), source: p.source ?? 'camera', dataUrl: p.dataUrl, slot: p.slot, fileName: p.fileName, photoType: p.photoType, note: p.note, clientVisible: false, at: p.at ?? new Date().toISOString(), by: p.by ?? a.by, station: p.station ?? a.station };
  j.photos.unshift(photo);
  if (p.stamp !== false) jobStamp(j, p.stamp ?? `Photo added · ${PHOTO_TYPES.find((t) => t.key === p.photoType)!.label}${p.slot ? ` · ${p.slot}` : ''} · locked (private)`);
  return photo;
};
export async function addJobPhoto(jobId: string, p: AddJobPhotoInput): Promise<PackagePhoto & Stamp> { return resolve(addJobPhotoSync(getJobRow(jobId), p)); }
export async function addJobPhotos(id: string, photos: PackagePhoto[], photoType: PhotoType = 'bench'): Promise<JobWithRefs> {
  const j = getJobRow(id);
  photos.forEach((p) => addJobPhotoSync(j, { ...p, photoType: p.photoType ?? photoType, stamp: false }));
  jobStamp(j, `${photos.length} photo${photos.length === 1 ? '' : 's'} attached · ${PHOTO_TYPES.find((t) => t.key === photoType)!.label} · locked (private)`);
  return resolve(jobRefs(j));
}

export interface JobFieldsPatch { priority?: JobPriority; dueAt?: string | null; conditionNotes?: string; intakeNotes?: string }

export async function updateJobFields(id: string, patch: JobFieldsPatch): Promise<JobWithRefs> {
  const j = getJobRow(id);
  const changed: string[] = [];
  if (patch.priority && patch.priority !== j.priority) { changed.push(`priority ${j.priority} → ${patch.priority}`); j.priority = patch.priority; }
  if (patch.dueAt !== undefined) { j.dueAt = patch.dueAt || undefined; changed.push(patch.dueAt ? `due ${new Date(patch.dueAt).toLocaleDateString('en-US')}` : 'due date cleared'); }
  if (patch.conditionNotes !== undefined) { j.conditionNotes = patch.conditionNotes; changed.push('condition notes'); }
  if (patch.intakeNotes !== undefined) { j.intakeNotes = patch.intakeNotes; changed.push('intake notes'); }
  if (changed.length) jobStamp(j, `Updated · ${changed.join(', ')}`);
  return resolve(jobRefs(j));
}

export async function searchJobs(query: string): Promise<JobWithRefs[]> {
  const q = query.trim().toLowerCase();
  const digits = estimateDigits(query);
  const all = await getJobs();
  if (!q) return all;
  return all.filter((j) => {
    const name = `${j.client.firstName} ${j.client.lastName}`.toLowerCase();
    return (digits && estimateDigits(j.number).startsWith(digits)) || name.includes(q) || j.watch.reference.toLowerCase().includes(q) || j.watch.serial.toLowerCase().includes(q) || j.watch.model.toLowerCase().includes(q) || j.assignees.some((a) => a.toLowerCase().includes(q)) || (j.owner?.includes(q) ?? false);
  });
}

export interface CreateJobInput {
  clientId: string;
  watchId: string;
  estimateId?: string;
  kind?: JobKind;
  priority?: JobPriority;
  dueAt?: string;
  assignees?: string[];
  conditionNotes?: string;
  intakeNotes?: string;
  onHand: boolean;
  workflow?: DeptCode[];
  lines?: EstimateLine[];
}

const buildJob = (input: CreateJobInput): Job => {
  if (!input.clientId) throw new Error('Customer is required');
  if (!input.watchId) throw new Error('Watch is required on create');
  const w = byId(store.watches, input.watchId);
  if (w.clientId !== input.clientId) throw new Error('That watch belongs to a different customer');
  const a = actor();
  const now = new Date().toISOString();
  const lines = (input.lines ?? []).map((l) => ({ ...l, id: newLineId() }));
  const workflow = input.workflow?.length ? input.workflow : uniq(lines.map((l) => l.dept));
  const kind = input.kind ?? 'service';
  const j: Job = {
    id: newId('j'),
    number: nextJobNumber(),
    clientId: input.clientId,
    watchId: input.watchId,
    estimateId: input.estimateId,
    department: fx.DEPT_OF_CODE[workflow[0] ?? 'W'],
    workflow: workflow.length ? workflow : ['W'],
    kind,
    status: 'intake',
    simpleStatus: input.onHand ? 'on_hand' : 'estimate',
    priority: input.priority ?? 'normal',
    division: getSessionDivision(),
    lines,
    total: lines.reduce((t, l) => t + l.qty * l.unitPrice, 0),
    owner: JOB_KIND_CONFIG[kind].defaultOwnerRole ?? undefined,
    assignees: input.assignees ?? [],
    intakeDate: input.onHand ? now : undefined,
    intakeNotes: input.intakeNotes?.trim() || undefined,
    conditionNotes: input.conditionNotes?.trim() || undefined,
    dueAt: input.dueAt || undefined,
    createdAt: now,
    createdBy: a.by,
    timeline: [{ id: newId('jt'), from: null, to: 'intake', action: 'create', at: now, by: a.by, station: a.station }],
    holds: [], notes: [], photos: [],
  };
  if (store.jobs.some((x) => x.number === j.number)) throw new Error(`Job ${j.number} already exists`); // existence check before create
  store.jobs.unshift(j);
  return j;
};

export async function createJob(input: CreateJobInput): Promise<JobWithRefs> {
  const j = buildJob(input);
  jobStamp(j, `Created · ${JOB_KIND_CONFIG[j.kind].label} · ${j.workflow.join('+')} · ${j.simpleStatus === 'on_hand' ? 'on hand' : 'watch not yet on hand'} · priority ${j.priority}${j.owner ? ` · owner auto-set ${j.owner}` : ''}`);
  return resolve(jobRefs(j));
}

// Received package for an estimate = routing authority for workflow, and proof the watch is on hand
const receivedPkgFor = (estimateId: string) => store.packages.find((p) => p.estimateId === estimateId && (p.status === 'received' || p.status === 'discrepancy_hold'));

const jobFromEstimate = (e: Estimate, onHand: boolean, lines: EstimateLine[] = e.lines): Job => {
  if (!e.watchId) throw new Error('Estimate has no watch — add one before creating a job');
  const pkg = receivedPkgFor(e.id);
  const j = buildJob({ clientId: e.clientId, watchId: e.watchId, estimateId: e.id, onHand: onHand || !!pkg, lines, workflow: pkg?.workflow, intakeNotes: pkg?.notes });
  j.packageId = pkg?.id;
  e.jobId = j.id;
  return j;
};

// Partial convert (RULING 2026-09-27): only the checked lines convert; unchecked lines stay OPEN on the estimate with a per-line record. Estimate flips to `converted` only when no convertible line is left open.
type ConvFamily = 'so' | 'job';
const famOf = (k: 'sales_order' | 'job' | 'intake'): ConvFamily => (k === 'sales_order' ? 'so' : 'job');
const openLines = (e: Estimate, fam: ConvFamily) => e.lines.filter((l) => !l.closedOut && (l.description.trim() || l.unitPrice) && !(l.conversions ?? []).some((c) => famOf(c.kind) === fam));
const pickLines = (e: Estimate, fam: ConvFamily, lineIds?: string[]) => { const open = openLines(e, fam); const chosen = lineIds ? open.filter((l) => lineIds.includes(l.id)) : open; if (!chosen.length) throw new Error('No open lines selected to convert'); return chosen; };
const recordLineConvert = (e: Estimate, lines: EstimateLine[], to: { kind: 'sales_order' | 'job' | 'intake'; number: string; id: string; at: string }) => { const a = actor(); const fam = famOf(to.kind); lines.forEach((l) => { l.conversions = [...(l.conversions ?? []), { ...to, by: a.by }]; }); const left = openLines(e, fam).length; if (!left && fam === 'job') markConverted(e); else e.updatedAt = new Date().toISOString(); estStamp(e, `${lines.length} of ${lines.length + left} open line${lines.length + left === 1 ? '' : 's'} converted → ${to.kind.replace('_', ' ')} ${to.number}${left ? ` · ${left} line${left === 1 ? '' : 's'} left open on the estimate` : ''}`); };
export const lineOpenFor = (l: EstimateLine, kind: 'sales_order' | 'job' | 'intake') => !l.closedOut && !(l.conversions ?? []).some((c) => famOf(c.kind) === famOf(kind));
export async function closeOutEstimateLine(estimateId: string, lineId: string, reason: string): Promise<EstimateWithRefs> { const e = getEst(estimateId); const l = e.lines.find((x) => x.id === lineId); if (!l || l.closedOut) throw new Error('Line not open'); if (!reason.trim()) throw new Error('Reason required'); l.closedOut = { at: new Date().toISOString(), by: actor().by, reason: reason.trim() }; if (!openLines(e, 'job').length && e.lines.some((x) => x.conversions?.length)) markConverted(e); estStamp(e, `Line “${l.description}” closed out without converting · ${reason.trim()}`); return resolve(withRefs(e)); }
const markConverted = (e: Estimate) => {
  e.status = 'converted';
  e.convertedAt = new Date().toISOString();
  e.updatedAt = e.convertedAt;
};

// E3 "Create job": born from an approved estimate, carrying its lines and watch
export async function createJobFromEstimate(estimateId: string, lineIds?: string[]): Promise<JobWithRefs> {
  const e = getEst(estimateId);
  if (e.jobId) throw new Error(`Estimate already has job ${byId(store.jobs, e.jobId).number}`);
  if (e.status !== 'approved') throw new Error('Only an approved estimate can create a job');
  const chosen = pickLines(e, 'job', lineIds);
  const j = jobFromEstimate(e, false, chosen);
  recordLineConvert(e, chosen, { kind: 'job', number: j.number, id: j.id, at: j.createdAt });
  jobStamp(j, `Created from estimate ${e.number} · ${j.lines.length} line${j.lines.length === 1 ? '' : 's'} · ${j.workflow.join('+')}${j.packageId ? ' · on hand (received package)' : ''}`);
  return resolve(jobRefs(j));
}

// Pack: if the estimate already has a job → that job goes on_hand + intake_date; else insert a job and link it
export async function convertEstimateToIntake(estimateId: string, lineIds?: string[]): Promise<JobWithRefs> {
  const e = getEst(estimateId);
  if (!['sent', 'approved', 'converted'].includes(e.status)) throw new Error('Only a sent, approved or converted estimate can be converted to intake');
  let j: Job;
  const chosen = e.jobId ? [] : pickLines(e, 'job', lineIds);
  if (e.jobId) {
    j = byId(store.jobs, e.jobId);
    // Leftover lines from an earlier partial convert join the existing job (append-only), then the estimate closes if nothing is left open
    const extra = openLines(e, 'job').filter((l) => !lineIds || lineIds.includes(l.id));
    if (extra.length) { j.lines.push(...extra.map((l) => ({ ...l, conversions: undefined, closedOut: undefined, id: newLineId() }))); j.total = j.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0); jobStamp(j, `${extra.length} leftover estimate line${extra.length === 1 ? '' : 's'} added from ${e.number}`); j.notes.push({ id: newId('n'), text: `${extra.length} leftover estimate line${extra.length === 1 ? '' : 's'} added from ${e.number}: ${extra.map((l) => l.description).join(', ')}`, at: new Date().toISOString(), by: actor().by, station: actor().station } as Job['notes'][number]); recordLineConvert(e, extra, { kind: 'intake', number: j.number, id: j.id, at: new Date().toISOString() }); return resolve(jobRefs(j)); }
    if (j.simpleStatus === 'on_hand') throw new Error(`Job ${j.number} is already on hand`);
    if (j.simpleStatus === 'finished') throw new Error(`Job ${j.number} is finished`);
    j.simpleStatus = 'on_hand';
    j.intakeDate = new Date().toISOString();
    jobStamp(j, `Converted to intake · now on hand`);
  } else {
    j = jobFromEstimate(e, true, chosen);
    jobStamp(j, `Created on hand via convert-to-intake from ${e.number} · ${chosen.length} line${chosen.length === 1 ? '' : 's'}`);
    recordLineConvert(e, chosen, { kind: 'intake', number: j.number, id: j.id, at: j.createdAt });
  }
  if (e.jobId && e.status !== 'converted') markConverted(e);
  estStamp(e, `Convert to intake → job ${j.number} on hand`);
  return resolve(jobRefs(j));
}

// Pack: delete requires can-delete-jobs — mapped to manager tier in the prototype
export async function deleteJob(id: string): Promise<void> {
  const j = getJobRow(id);
  const a = actor();
  if (a.user?.accessTier !== 'manager') throw new Error('Deleting jobs needs the can-delete-jobs permission (manager)');
  store.jobs = store.jobs.filter((x) => x.id !== id);
  store.shopTime = store.shopTime.filter((t) => t.jobId !== id);
  store.tasks = store.tasks.filter((t) => t.jobId !== id);
  const e = j.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : undefined;
  if (e) e.jobId = undefined;
  jobStamp(j, 'Deleted');
  return resolve(undefined);
}

// E5: invoice = sales order born from a QC-passed job (pack: SO is the invoicing vehicle; QBO is a stub)
export async function invoiceJob(id: string): Promise<SalesOrderWithRefs> {
  const j = getJobRow(id);
  if (j.status !== 'ready_to_ship' && j.status !== 'closed') throw new Error('Invoice only after QC pass (ready to ship)');
  const existing = store.salesOrders.find((o) => o.jobId === j.id && o.status !== 'cancelled');
  if (existing) throw new Error(`Job already has sales order ${existing.number}`);
  const o = buildSO({ clientId: j.clientId, jobId: j.id, lines: j.lines.map((l) => ({ description: l.description, partNumber: l.partNumber, qty: l.qty, rate: l.unitPrice, dept: l.dept })), status: 'open' });
  jobStamp(j, `Invoiced → ${o.number} · ${fmtMoney(o.total)}`);
  soStamp(o, `Created from job ${j.number} · ${o.lines.length} lines · open`);
  return resolve(soRefs(o));
}

// ---- Shop Time: time rows against on_hand jobs; never moves job status ----------

export async function getShopTime(jobId?: string): Promise<ShopTimeEntry[]> {
  return resolve(store.shopTime.filter((t) => !jobId || t.jobId === jobId).sort((a, b) => b.at.localeCompare(a.at)));
}

export async function getOnHandJobs(): Promise<JobWithRefs[]> {
  return resolve(store.jobs.filter((j) => j.simpleStatus === 'on_hand').map(jobRefs));
}

export async function addShopTime(jobId: string, minutes: number, note: string): Promise<ShopTimeEntry> {
  const j = getJobRow(jobId);
  if (j.simpleStatus !== 'on_hand') throw new Error('Shop Time only accepts on-hand jobs');
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('Enter minutes worked (greater than 0)');
  const a = actor();
  const t: ShopTimeEntry = { id: newId('st'), jobId, minutes: Math.round(minutes), note: note.trim(), at: new Date().toISOString(), by: a.by, station: a.station };
  store.shopTime.unshift(t);
  jobStamp(j, `Shop time +${t.minutes} min${t.note ? ` · ${t.note}` : ''}`);
  return resolve(t);
}

// ---- Tasks (explicit) + /today (derived, no manual curation) ------------------

const userRoles = (u: User | null): Role[] => u?.roles ?? [];
// Station target = whoever is signed in at that station right now (a message to "Front Desk 1" is for the desk, not a person)
const assigneeMatches = (a: Assignee, u: User) => (a.type === 'user' ? a.shortName === u.shortName : a.type === 'station' ? readStation()?.id === a.stationId : holdsRole(u, a.role));
export const assigneeLabel = (a: Assignee) => (a.type === 'user' ? a.shortName : a.type === 'station' ? (fx.stations.find((s) => s.id === a.stationId)?.name ?? a.stationId) : `${a.role} role → ${roleHolders(a.role).map((u) => u.shortName).join(', ') || 'no holder'}`);

const taskStamp = (t: Task, detail: string) => {
  const a = actor();
  appendAudit({ type: 'task', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Task "${t.title.slice(0, 50)}" · ${detail}` });
};

export async function getTasks(): Promise<Task[]> {
  return resolve([...store.tasks].sort((a, b) => (a.status === b.status ? (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9') : a.status === 'open' ? -1 : 1)));
}

export async function getTasksForJob(jobId: string): Promise<Task[]> {
  return resolve(store.tasks.filter((t) => t.jobId === jobId));
}

export async function getTasksForClient(clientId: string): Promise<Task[]> {
  return resolve(store.tasks.filter((t) => t.clientId === clientId));
}

export interface TaskInput { title: string; assignedTo: Assignee; jobId?: string; dueAt?: string }

export async function createTask(input: TaskInput): Promise<Task> {
  if (!input.title.trim()) throw new Error('Task title is required');
  const a = actor();
  const job = input.jobId ? store.jobs.find((j) => j.id === input.jobId) : undefined;
  if (input.jobId && !job) throw new Error('Linked job not found');
  const division = getSessionDivision();
  const t: Task = { id: newId('t'), title: input.title.trim(), assignedTo: input.assignedTo, createdBy: a.by, division, jobId: job?.id, watchId: job?.watchId, clientId: job?.clientId, dueAt: input.dueAt || undefined, status: 'open', createdAt: new Date().toISOString(), station: a.station };
  store.tasks.unshift(t);
  taskStamp(t, `created · assigned to ${assigneeLabel(t.assignedTo)}${job ? ` · linked ${job.number}` : ''}`);
  if (job) jobStamp(job, `Task added for ${assigneeLabel(t.assignedTo)} · ${t.title.slice(0, 50)}`);
  return resolve(t);
}

export async function setTaskDone(id: string, done: boolean): Promise<Task> {
  const t = byId(store.tasks, id);
  const a = actor();
  t.status = done ? 'done' : 'open';
  t.completedAt = done ? new Date().toISOString() : undefined;
  t.completedBy = done ? a.by : undefined;
  taskStamp(t, done ? `completed (sent by ${t.createdBy})` : 'reopened');
  return resolve({ ...t });
}

// Owner = accountable role: these states need the owner to move things along
const OWNER_ACTION: Partial<Record<JobStatus, string>> = { intake: 'Start review', awaiting_customer_approval: 'Chase customer approval', ready_to_ship: 'Arrange pickup / shipping' };
// Assignees = working techs: these states are bench work
const TECH_ACTION: Partial<Record<JobStatus, string>> = { approved: 'Start service', in_service: 'Bench work', testing: 'Run testing / QC' };

// ---- Pinned hit list (manual layer, MH ruling) — never hides derived rows -------

// Accept both # and @ as mention prefixes (MH ruling 2026-09-24)
const MENTION = /^[#@](\w+)\s+/;
// "#vienna order paper" | "@vienna order paper" → assignee Vienna; "@manager sign off" → role manager
export const parsePin = (raw: string, fallback: Assignee): { title: string; assignedTo: Assignee } => {
  const m = raw.trim().match(MENTION);
  if (!m) return { title: raw.trim(), assignedTo: fallback };
  const tag = m[1].toLowerCase();
  const user = fx.users.find((u) => u.shortName.toLowerCase() === tag || u.firstName.toLowerCase() === tag);
  if (user) return { title: raw.trim(), assignedTo: { type: 'user', shortName: user.shortName } };
  if ((ROLES as string[]).includes(tag)) return { title: raw.trim(), assignedTo: { type: 'role', role: tag as Role } };
  return { title: raw.trim(), assignedTo: fallback };
};

export interface PinInput { title: string; assignedTo?: Assignee; jobId?: string; taskId?: string; clientId?: string; estimateId?: string }

export async function pinToHitList(input: PinInput): Promise<PinnedItem> {
  const a = actor();
  const fallback: Assignee = { type: 'user', shortName: a.by };
  const parsed = parsePin(input.title, input.assignedTo ?? fallback);
  if (!parsed.title) throw new Error('Say what to pin');
  const job = input.jobId ? store.jobs.find((j) => j.id === input.jobId) : undefined;
  const division = getSessionDivision();
  const p: PinnedItem = { id: newId('pin'), title: parsed.title, assignedTo: input.assignedTo && !MENTION.test(input.title) ? input.assignedTo : parsed.assignedTo, createdBy: a.by, division, jobId: job?.id, taskId: input.taskId, clientId: input.clientId, estimateId: input.estimateId, createdAt: new Date().toISOString(), station: a.station };
  store.pinned.unshift(p);
  appendAudit({ type: 'pin', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Pinned "${p.title.slice(0, 50)}" for ${assigneeLabel(p.assignedTo)}${job ? ` · ${job.number}` : ''}` });
  if (job) jobStamp(job, `Pinned to ${assigneeLabel(p.assignedTo).split(' →')[0]}'s hit list · ${p.title.slice(0, 50)}`);
  return resolve({ ...p });
}

export async function dismissPinned(id: string, reason?: string): Promise<PinnedItem> {
  const p = byId(store.pinned, id);
  const a = actor();
  if (p.standing && !reason?.trim()) throw new Error('This item stands until done — give a reason to dismiss it');
  p.dismissedAt = new Date().toISOString();
  p.dismissedBy = a.by; p.dismissReason = reason?.trim() || undefined;
  if (p.key?.startsWith('auto-po:')) rsStamp('purchasing', `Auto-PO pin dismissed by ${a.by} — ${p.dismissReason}`);
  appendAudit({ type: 'pin', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Dismissed pin "${p.title.slice(0, 50)}"` });
  return resolve({ ...p });
}

async function getTodayMock(userId?: string): Promise<TodayView> {
  const me = userId ? byId(fx.users, userId) : currentUserSync();
  if (!me) return resolve({ pinned: [], rows: [], waitingOn: [] });
  const sessionDiv = getSessionDivision();
  const roles = userRoles(me);
  const now = Date.now();
  const rows: TodayRow[] = [];
  const watchOf = (j: Job) => { const w = byId(store.watches, j.watchId); return `${w.brand} ${w.model}`; };
  const clientOf = (id: string) => { const c = byId(fx.clients, id); return `${c.firstName} ${c.lastName}`; };
  const due = (iso?: string) => ({ dueAt: iso, overdue: !!iso && new Date(iso).getTime() < now });

  store.jobs.forEach((j) => {
    // Division wall: only jobs belonging to this session's division
    if ((j.division ?? 'rolliworks') !== sessionDiv) return;
    const held = activeHold(j);
    const iOwn = !!j.owner && roles.includes(j.owner);
    const iWork = j.assignees.includes(me.shortName);
    if (held) {
      if (iOwn || held.placedBy === me.shortName) rows.push({ id: `hold-${j.id}`, source: 'hold', title: `Follow up ${held.type} hold · ${j.number}`, detail: `${held.reason} — ${clientOf(j.clientId)} · ${watchOf(j)}`, via: iOwn ? `owner · ${j.owner}` : 'placed by me', jobId: j.id, urgent: j.priority === 'urgent' || j.priority === 'high', ...due(j.dueAt) });
      return;
    }
    if (iOwn && OWNER_ACTION[j.status]) rows.push({ id: `owner-${j.id}`, source: 'owner', title: `${OWNER_ACTION[j.status]} · ${j.number}`, detail: `${clientOf(j.clientId)} · ${watchOf(j)} · ${JOB_KIND_CONFIG[j.kind].label}`, via: `owner · ${j.owner}`, jobId: j.id, urgent: j.priority === 'urgent' || j.priority === 'high', ...due(j.dueAt) });
    if (iWork && TECH_ACTION[j.status]) rows.push({ id: `tech-${j.id}`, source: 'assignee', title: `${TECH_ACTION[j.status]} · ${j.number}`, detail: `${clientOf(j.clientId)} · ${watchOf(j)} · ${j.workflow.join('+')}`, via: 'assigned to me', jobId: j.id, urgent: j.priority === 'urgent' || j.priority === 'high', ...due(j.dueAt) });
  });

  // Discrepancy packages route to the concierge role and to the inspector who flagged them
  // Only shown in the same division the package was processed in (all current packages are rolliworks)
  if (sessionDiv === 'rolliworks') {
    store.packages.filter((p) => p.status === 'discrepancy_hold').forEach((p) => {
      const mine = roles.includes('concierge') || p.inspectedBy === me.shortName;
      if (mine) rows.push({ id: `disc-${p.id}`, source: 'discrepancy', title: `Resolve discrepancy · ${p.subNumber}`, detail: p.discrepancyReason ?? 'Discrepancy at Receive Watch', via: p.inspectedBy === me.shortName ? 'flagged by me' : 'owner · concierge', packageId: p.id, urgent: true, overdue: false });
    });
  }

  // Watchmaker-room kiosk: required 4-photo documentation still outstanding on my W-routed jobs (admin toggle on)
  if (kioskRequiredSetting()) store.jobs.filter((j) => j.assignees.includes(me.shortName) && !['closed', 'ready_to_ship', 'cancelled'].includes(j.status) && kioskStatusFor(j).required && !kioskStatusFor(j).done).forEach((j) => {
    rows.push({ id: `kiosk-${j.id}`, source: 'task', title: `WM room photos required · ${j.number}`, detail: `${clientOf(j.clientId)} · 4-step dial / movement / case back set at the kiosk`, via: 'watchmaker room kiosk', jobId: j.id, dueAt: j.dueAt, overdue: false, urgent: j.priority === 'high' });
  });
  // Task-derived rows — division-scoped
  store.tasks.filter((t) => t.status === 'open' && t.division === sessionDiv && assigneeMatches(t.assignedTo, me)).forEach((t) => {
    const job = t.jobId ? store.jobs.find((j) => j.id === t.jobId) : undefined;
    rows.push({ id: `task-${t.id}`, source: 'task', title: t.title, detail: job ? `${job.number} · ${clientOf(job.clientId)}` : t.clientId ? clientOf(t.clientId) : 'Task', via: t.assignedTo.type === 'role' ? `role · ${t.assignedTo.role}` : 'assigned to me', taskId: t.id, jobId: job?.id, sentBy: t.createdBy !== me.shortName ? t.createdBy : undefined, urgent: false, ...due(t.dueAt) });
  });

  threadsNeedingReplyForUser(me).forEach((c) => rows.push({ id: `thread-${c.id}`, source: 'thread', title: `Reply to ${c.client.firstName} ${c.client.lastName} · ${c.subject}`, detail: `${c.anchorLabel ?? 'General'} · waiting ${c.ageHours}h`, via: 'assigned thread', overdue: c.ageHours > 24, urgent: false, dueAt: c.lastInboundAt }));
  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.urgent) - Number(a.urgent) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const waitingOn = store.tasks.filter((t) => t.status === 'open' && t.division === sessionDiv && t.createdBy === me.shortName && !assigneeMatches(t.assignedTo, me));
  autoPoSweepSync(); approvalsToSendSweepSync(); runDaySweeps();
  const pinned = store.pinned.filter((p) => !p.dismissedAt && (p.global || p.division === sessionDiv) && assigneeMatches(p.assignedTo, me)).sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high'));
  return resolve({ pinned, rows, waitingOn });
}

// ---- E5 Sales orders / fulfil / pickup / ship — PROMPT-PACK-invoicing-pickup-ship.md -----------
// Hard stops: QBO stub only, email → Sent record only, no real money, shipping via mock seam.

const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const soTotals = (o: SalesOrder) => {
  o.total = o.lines.reduce((t, l) => t + l.qty * l.rate, 0) + o.shippingAmount; // pack: Σ(qty × rate) + shipping
  const paid = o.payments.reduce((t, p) => t + p.amount, 0);
  o.balanceDue = Math.max(0, o.total - paid);
  o.isPaid = o.total > 0 && paid >= o.total;
  o.updatedAt = new Date().toISOString();
};
const soRefs = (o: SalesOrder): SalesOrderWithRefs => {
  const job = o.jobId ? store.jobs.find((j) => j.id === o.jobId) ?? null : null;
  return { ...o, client: byId(fx.clients, o.clientId), job, watch: job ? byId(store.watches, job.watchId) : null };
};
const getSO = (id: string) => byId(store.salesOrders, id);
const soStamp = (o: SalesOrder, detail: string) => {
  const a = actor();
  appendAudit({ type: 'sales', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${o.number} · ${detail}` });
};
const soEmail = (o: SalesOrder, subject: string, body: string, payLink?: string) => {
  const a = actor();
  const c = byId(fx.clients, o.clientId);
  queueOutbox({ id: `ob-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: o.number, status: 'pending', payLink, subject: `${subject} — ${o.number}`, body: `Hello ${c.firstName},\n\n${body}\n\nOrder: ${o.number}${o.jobId ? ` · Job ${byId(store.jobs, o.jobId).number}` : ''}\n\n— The RolliSuite team`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station });
};

export const SO_BADGE = (o: SalesOrder): 'picked_up' | 'shipped' | 'paid' | 'unpaid' => (o.pickedUpAt ? 'picked_up' : o.tracking || o.shipDate ? 'shipped' : o.isPaid ? 'paid' : 'unpaid');

// Where a QC-passed job sits in the money tail (brief's lane names, derived from the SO)
export function tailStage(job: Job): TailStage | null {
  if (job.status !== 'ready_to_ship' && job.status !== 'closed') return null;
  const o = store.salesOrders.find((x) => x.jobId === job.id && x.status !== 'cancelled');
  if (!o) return job.status === 'closed' ? null : 'awaiting_invoice';
  if (o.status === 'picked_up') return 'picked_up';
  if (o.status === 'shipped') return 'shipped';
  if (!o.isPaid && o.status !== 'fulfilled') return 'awaiting_payment';
  if (o.status === 'fulfilled' || o.status === 'partial_fulfilled') return o.channel === 'ship' ? 'ready_to_ship' : o.channel === 'pickup' ? 'ready_for_pickup' : 'awaiting_payment';
  return 'awaiting_payment';
}

async function getSalesOrdersMock(): Promise<SalesOrderWithRefs[]> {
  return resolve([...store.salesOrders].filter(inMyDivision.salesOrder).sort((a, b) => b.orderDate.localeCompare(a.orderDate)).map(soRefs));
}
async function getSalesOrderMock(id: string): Promise<SalesOrderWithRefs | null> {
  const o = store.salesOrders.find((x) => x.id === id);
  if (o && !inMyDivision.salesOrder(o)) throw new Error('Not in your division — this order belongs to the other entity');
  return resolve(o ? soRefs(o) : null);
}
export async function getSalesOrderForJob(jobId: string): Promise<SalesOrderWithRefs | null> {
  const o = store.salesOrders.find((x) => x.jobId === jobId && x.status !== 'cancelled');
  return resolve(o ? soRefs(o) : null);
}
// Pack: lookup by SO #, estimate #, name; jobs by E-number too
export async function findSalesOrders(query: string): Promise<SalesOrderWithRefs[]> {
  const q = query.trim().toLowerCase();
  if (!q) return getSalesOrders();
  const digits = q.replace(/\D/g, '');
  return resolve(store.salesOrders.filter((o) => {
    const c = byId(fx.clients, o.clientId);
    const job = o.jobId ? store.jobs.find((j) => j.id === o.jobId) : undefined;
    const est = o.estimateId ? store.estimates.find((e) => e.id === o.estimateId) : job?.estimateId ? store.estimates.find((e) => e.id === job.estimateId) : undefined;
    return o.number.toLowerCase().includes(q) || (digits && o.number.replace(/\D/g, '').endsWith(digits)) || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (job?.number.toLowerCase().includes(q) ?? false) || (est?.number.toLowerCase().includes(q) ?? false) || (digits && estimateDigits(est?.number ?? '').endsWith(digits) && digits.length >= 3) || (q.length >= 3 && (o.pickupCode?.toLowerCase().replace('-', '').startsWith(q.replace('-', '')) ?? false));
  }).map(soRefs));
}

export interface SOLineInput { description: string; partNumber?: string; qty: number; rate: number; dept?: DeptCode }
export interface SalesOrderInput { clientId: string; jobId?: string; estimateId?: string; lines: SOLineInput[]; shippingAmount?: number; memo?: string; channel?: FulfillmentChannel; status?: 'draft' | 'open'; clientResolution?: Pick<ClientResolution, 'via' | 'detail'> }

// ---- Scan gate (user decision: hard gate + manager override) — an invoice can't be sent for a name-picked customer until the job label is scan-confirmed or a manager overrides with a logged reason ----
const linkedNumber = (input: SalesOrderInput) => input.jobId ? store.jobs.find((j) => j.id === input.jobId)?.number : input.estimateId ? store.estimates.find((e) => e.id === input.estimateId)?.number : undefined;
const resolutionFor = (input: SalesOrderInput, a: { by: string }): ClientResolution => {
  const now = new Date().toISOString(); const linked = linkedNumber(input);
  if (linked) return { via: 'linked', detail: `customer carried from ${linked} by ID`, at: now, by: a.by };
  if (input.clientResolution?.via === 'scan') return { via: 'scan', detail: input.clientResolution.detail, at: now, by: a.by };
  return { via: 'name', detail: input.clientResolution?.detail ?? 'picked from a name search', at: now, by: a.by };
};
export const soScanGate = (o: SalesOrder): { locked: boolean; reason?: string } => { const r = o.clientResolution; if (!r || r.via !== 'name' || r.override) return { locked: false }; return { locked: true, reason: `Customer was picked by name (${r.detail}) — scan the job label to confirm, or a manager can override with a reason` }; };
export async function confirmSoClientByScan(id: string, raw: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id); const r = await resolveScan(raw); if (!r) throw new Error(`Nothing matched “${raw.trim()}” — scan the job label or enter a job / estimate #`);
  if (r.client.id !== o.clientId) { const other = r.client; soStamp(o, `Scan MISMATCH · label ${r.scanned} → ${other.firstName} ${other.lastName} (${other.id}), order customer is ${o.clientId} · invoice stays locked`); throw new Error(`That label belongs to ${other.firstName} ${other.lastName} (customer ID ${other.id}, ${other.email}) — not this order's customer (ID ${o.clientId}). Invoice stays locked.`); }
  const a = actor(); const detail = r.via === 'job' ? `job ${r.job!.number}` : r.via === 'estimate' ? `estimate ${r.estimate!.number}` : `ref·serial ${r.watch!.reference}-${r.watch!.serial}`;
  o.clientResolution = { via: 'scan', detail: `scan-confirmed via ${detail} → customer ID ${r.client.id}`, at: new Date().toISOString(), by: a.by }; o.updatedAt = o.clientResolution.at;
  soStamp(o, `Customer scan-confirmed · ${detail} → ${r.client.firstName} ${r.client.lastName} (${r.client.id}) · invoice unlocked`); return resolve(soRefs(o));
}
export async function overrideSoScanGate(id: string, reason: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id); const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Manager access required to override the scan gate');
  if (!reason.trim()) throw new Error('A reason is required for the override'); if (!o.clientResolution || o.clientResolution.via !== 'name') throw new Error('Nothing to override — customer is already scan-confirmed or linked');
  o.clientResolution.override = { by: a.by, at: new Date().toISOString(), reason: reason.trim() }; o.updatedAt = o.clientResolution.override.at;
  soStamp(o, `Scan gate OVERRIDDEN by ${a.by} (manager) · reason: ${reason.trim()} · customer remains name-picked`);
  appendAudit({ type: 'estimate', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${o.number} · scan gate override · ${reason.trim()}` });
  return resolve(soRefs(o));
}

const nextSONumber = () => `SO-26-${String(++store.counters.so).padStart(4, '0')}`;
const buildSO = (input: SalesOrderInput): SalesOrder => {
  if (!input.clientId) throw new Error('Customer is required before save'); // pack rule
  const a = actor();
  const now = new Date().toISOString();
  const o: SalesOrder = {
    id: newId('so'), number: nextSONumber(), clientId: input.clientId, jobId: input.jobId, estimateId: input.estimateId,
    status: input.status ?? 'draft', channel: input.channel, orderDate: now,
    lines: input.lines.filter((l) => l.description.trim()).map((l) => ({ id: newId('sol'), description: l.description.trim(), partNumber: l.partNumber, qty: l.qty || 1, rate: l.rate || 0, dept: l.dept, pickedUpQty: 0, shippedQty: 0 })),
    shippingAmount: input.shippingAmount ?? 0, total: 0, memo: input.memo?.trim() || undefined, qboStatus: 'not_queued', payments: [], balanceDue: 0, isPaid: false, payLinkToken: newId('pl'), invoiceSends: [],
    createdAt: now, createdBy: a.by, updatedAt: now,
    clientResolution: resolutionFor(input, a),
  };
  soTotals(o);
  store.salesOrders.unshift(o);
  return o;
};
// Seed: the Sanchez incident — SO-26-0090 was name-picked for the Houston William Sanchez (c-33); it stays invoice-locked until scan-confirmed or overridden
(() => { const o = buildSO({ clientId: 'c-33', lines: [{ description: 'Bracelet re-pin — stretched links', qty: 1, rate: 220, dept: 'B' }, { description: 'Clasp adjust + tighten', qty: 1, rate: 60, dept: 'B' }], memo: 'Band-only job · walked in without label', status: 'open', clientResolution: { via: 'name', detail: 'picked from a name search (William Sanchez)' } }); o.id = 'so-ws'; o.number = 'SO-26-0090'; o.createdBy = 'Vienna'; o.clientResolution!.by = 'Vienna'; })();

export async function createSalesOrder(input: SalesOrderInput): Promise<SalesOrderWithRefs> {
  const o = buildSO(input);
  soStamp(o, `Created · ${o.status} · ${o.lines.length} lines · ${fmtMoney(o.total)}`);
  return resolve(soRefs(o));
}

export async function convertEstimateToSalesOrder(estimateId: string, lineIds?: string[]): Promise<SalesOrderWithRefs> {
  const e = getEst(estimateId);
  const chosen = pickLines(e, 'so', lineIds);
  const existing = store.salesOrders.find((o) => o.estimateId === e.id && o.status !== 'cancelled');
  if (existing && !e.lines.some((l) => l.conversions?.some((c) => c.kind === 'sales_order'))) throw new Error(`Estimate already has ${existing.number}`);
  const shipping = chosen.filter((l) => l.type === 'shipping').reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const o = buildSO({ clientId: e.clientId, estimateId: e.id, lines: chosen.filter((l) => l.type !== 'shipping').map((l) => ({ description: l.description, partNumber: l.partNumber, qty: l.qty, rate: l.unitPrice, dept: l.dept })), shippingAmount: shipping, memo: e.clientNotes });
  recordLineConvert(e, chosen, { kind: 'sales_order', number: o.number, id: o.id, at: o.createdAt });
  soStamp(o, `Created from estimate ${e.number} · draft · ${chosen.length} line${chosen.length === 1 ? '' : 's'}`);
  return resolve(soRefs(o));
}

export interface SalesOrderPatch { lines?: SOLineInput[]; shippingAmount?: number; memo?: string; channel?: FulfillmentChannel }
export async function updateSalesOrder(id: string, patch: SalesOrderPatch): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['draft', 'open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Completed or cancelled orders cannot be edited');
  const before = { total: o.total, balanceDue: o.balanceDue, isPaid: o.isPaid };
  if (patch.lines) o.lines = patch.lines.filter((l) => l.description.trim()).map((l) => ({ id: newId('sol'), description: l.description.trim(), partNumber: l.partNumber, qty: l.qty || 1, rate: l.rate || 0, dept: l.dept, pickedUpQty: 0, shippedQty: 0 }));
  if (patch.shippingAmount !== undefined) o.shippingAmount = patch.shippingAmount;
  if (patch.memo !== undefined) o.memo = patch.memo.trim() || undefined;
  if (patch.channel !== undefined) o.channel = patch.channel;
  soTotals(o);
  // Edit-after-send (VB4): the payment link is the same URL and now shows the new live balance — nothing to resend
  const afterSend = !!o.invoiceSentAt && before.total !== o.total;
  soStamp(o, afterSend ? `Edited after send · total ${fmtMoney(before.total)} → ${fmtMoney(o.total)} · balance ${fmtMoney(before.balanceDue)} → ${fmtMoney(o.balanceDue)} · payment link updated${o.qboStatus === 'queued' ? ' · QBO re-push queued (stub)' : ''}${before.isPaid && !o.isPaid ? ' · NO LONGER PAID IN FULL' : ''}` : `Edited · ${fmtMoney(o.total)}`);
  return resolve(soRefs(o));
}

// ---- Send invoice + mock hosted payment page (Intuit placeholder) --------------------------------------------------------------
// The pay link is minted once per SO and never changes; the page behind it always renders the LIVE total / balance (VB4 edit-after-send).
export const payLinkPath = (o: SalesOrder) => `/pay/${o.payLinkToken}`;
export const payLinkUrl = (o: SalesOrder) => `${window.location.origin}${payLinkPath(o)}`;
export async function sendInvoice(id: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Open the order before sending the invoice');
  if (o.lines.length === 0) throw new Error('Nothing to invoice');
  { const g = soScanGate(o); if (g.locked) { soStamp(o, `Invoice send BLOCKED by scan gate · ${o.clientResolution!.detail}`); throw new Error(g.reason!); } }
  const a = actor(); const url = payLinkUrl(o); const emailId = `ob-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  const c = byId(fx.clients, o.clientId);
  queueOutbox({ id: emailId, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: o.number, status: 'pending', payLink: payLinkPath(o), subject: `Your invoice — ${o.number}`, body: `Hello ${c.firstName},\n\nYour invoice ${o.number} is ready.\n\nTotal ${fmtMoney(o.total)}${o.payments.length ? ` · paid so far ${fmtMoney(o.total - o.balanceDue)}` : ''} · balance due ${fmtMoney(o.balanceDue)}.\n\n[ PAY INVOICE ]  ${url}\n(MOCK PAYMENT PAGE — placeholder for the Intuit hosted payment page; no card is charged. The page always shows the live balance, so if we adjust the invoice the same link stays valid.)\n\nYou can also pay from RolliConnect under this watch.\n\nYour watch's service records: ${window.location.origin}${soRecordsLink(o)}\n\nOrder: ${o.number}${o.jobId ? ` · Job ${byId(store.jobs, o.jobId).number}` : ''}\n\n— Rolliworks`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station });
  o.invoiceSentAt = new Date().toISOString(); o.invoiceSends.push({ at: o.invoiceSentAt, by: a.by, total: o.total, balanceDue: o.balanceDue, emailId }); soTotals(o);
  soStamp(o, `Invoice sent · ${fmtMoney(o.total)} · balance ${fmtMoney(o.balanceDue)} · pay link ${payLinkPath(o)} (send #${o.invoiceSends.length})`);
  if (o.jobId) jobStamp(byId(store.jobs, o.jobId), `Invoice ${o.number} sent · pay link emailed`);
  return resolve(soRefs(o));
}
const soByToken = (token: string) => { const o = store.salesOrders.find((x) => x.payLinkToken === token); if (!o || o.status === 'cancelled') throw new Error('This payment link is not valid'); return o; };
// Public read (no staff session) — the hosted page renders whatever the SO says RIGHT NOW
export async function getPayPage(token: string): Promise<PayPage> { const o = soByToken(token); return resolve({ order: soRefs(o), paid: o.payments.reduce((t, p) => t + p.amount, 0), sends: o.invoiceSends, merchant: 'Rolliworks · Luxury Watch Service', mock: true }); }
export async function payViaLink(token: string, amount: number): Promise<PayPage> {
  const o = soByToken(token);
  if (o.status === 'draft') throw new Error('This invoice is not open for payment yet');
  if (o.balanceDue <= 0) throw new Error('This invoice is already paid in full');
  await asClient(o.clientId, () => recordPayment(o.id, amount, 'card', `Paid online via payment link (MOCK Intuit) · ${amount + 0.005 >= o.balanceDue ? 'balance cleared' : 'partial'}`));
  return getPayPage(token);
}

// SO machine: draft → open → partial_fulfilled → fulfilled → shipped | picked_up ; any → cancelled
export async function openSalesOrder(id: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (o.status !== 'draft') throw new Error('Only a draft can be opened');
  if (o.lines.length === 0) throw new Error('Add at least one line');
  o.status = 'open'; soTotals(o);
  soStamp(o, 'Opened');
  soEmail(o, 'Your order is ready to pay', `Your order ${o.number} totals ${fmtMoney(o.total)}. Balance due ${fmtMoney(o.balanceDue)}. Reply or call the shop to arrange payment.`);
  return resolve(soRefs(o));
}

export async function cancelSalesOrder(id: string, reason: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!reason.trim()) throw new Error('A reason is required to cancel');
  if (o.status === 'shipped' || o.status === 'picked_up') throw new Error('Completed orders cannot be cancelled');
  o.status = 'cancelled'; o.cancelledAt = new Date().toISOString(); soTotals(o);
  soStamp(o, `Cancelled · ${reason.trim()}`);
  return resolve(soRefs(o));
}

// Payment: stub ledger only, no processor. Partial payments allowed (pack exposes balance_due) — PROVISIONAL
export async function recordPayment(id: string, amount: number, method: PaymentMethod, note?: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (o.status === 'draft' || o.status === 'cancelled') throw new Error('Open the order before taking payment');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than 0');
  if (amount > o.balanceDue + 0.005) throw new Error(`Amount exceeds balance due ${fmtMoney(o.balanceDue)}`);
  const a = actor();
  const p: Payment = { id: newId('pay'), amount: Math.round(amount * 100) / 100, method, note: note?.trim() || undefined, at: new Date().toISOString(), by: a.by, station: a.station };
  o.payments.push(p); soTotals(o);
  soStamp(o, `Payment ${fmtMoney(p.amount)} by ${method}${o.isPaid ? ' · PAID IN FULL' : ` · balance ${fmtMoney(o.balanceDue)}`}`);
  soEmail(o, o.isPaid ? 'Payment received — thank you' : 'Partial payment received', `We received ${fmtMoney(p.amount)} by ${method}. ${o.isPaid ? 'Your order is paid in full.' : `Remaining balance: ${fmtMoney(o.balanceDue)}.`}`);
  return resolve(soRefs(o));
}

// Fulfil = invoice handoff. Pack: status fulfilled → QBO stub (ensure customer → push items → push invoice) → optional job-finished notice
export async function fulfillSalesOrder(id: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['open', 'partial_fulfilled'].includes(o.status)) throw new Error('Only open orders can be fulfilled');
  if (o.lines.length === 0) throw new Error('Nothing to fulfil');
  o.status = 'fulfilled'; o.fulfilledAt = new Date().toISOString();
  const c = byId(fx.clients, o.clientId);
  if (!o.zeroBalance) { o.qboInvoiceId = `QBO-STUB-${10000 + store.salesOrders.length * 7 + Math.floor(Math.random() * 90)}`; o.qboStatus = 'queued'; } // HARD STOP: nothing leaves the app · zero-balanced invoices never queue
  soTotals(o);
  soStamp(o, `Fulfilled · QBO stub: ensure customer ${c.lastName} → push ${o.lines.length} items → push invoice ${o.qboInvoiceId} (queued, no live call)`);
  if (o.channel === 'pickup' && !o.pickupCode) issuePickupCode(o);
  if (o.jobId) { const j = byId(store.jobs, o.jobId); jobStamp(j, `Invoice ${o.number} fulfilled · QBO queued`); }
  soEmail(o, 'Your invoice', `Your invoice for ${o.number} is ready (${fmtMoney(o.total)}${o.isPaid ? ', paid in full' : `, balance due ${fmtMoney(o.balanceDue)}`}).${o.channel === 'pickup' && o.pickupCode ? ` Your pickup code is ${o.pickupCode} — bring it to the counter.` : ''}${o.channel === 'ship' ? ' We will ship as soon as your shipping details are confirmed.' : ''}`);
  return resolve(soRefs(o));
}

const issuePickupCode = (o: SalesOrder) => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  o.pickupCode = `${pick(4)}-${pick(2)}`;
  o.pickupCodeIssuedAt = new Date().toISOString();
};

// Push to Pickup / Ship Station. Pack: ship may clear prior tracking if reopening
export async function setFulfillmentChannel(id: string, channel: FulfillmentChannel): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (o.status === 'cancelled' || o.status === 'shipped' || o.status === 'picked_up') throw new Error('Order is already complete');
  o.channel = channel;
  if (channel === 'pickup' && !o.pickupCode) issuePickupCode(o);
  if (channel === 'ship') o.tracking = undefined;
  soTotals(o);
  soStamp(o, channel === 'pickup' ? `Pushed to Pickup Station · code ${o.pickupCode}` : 'Pushed to Ship Station');
  if (channel === 'pickup') soEmail(o, 'Your watch is ready for pickup', `Your pickup verification code is ${o.pickupCode}. Bring it (or show this email) to the counter; a proxy will need your name and a government ID.`);
  return resolve(soRefs(o));
}

export async function regeneratePickupCode(id: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  issuePickupCode(o); soTotals(o);
  soStamp(o, `Pickup code re-issued · ${o.pickupCode}`);
  soEmail(o, 'New pickup code', `Your new pickup verification code is ${o.pickupCode}.`);
  return resolve(soRefs(o));
}

export async function requestShippingInfo(id: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  o.shippingInfoRequestedAt = new Date().toISOString(); soTotals(o);
  soStamp(o, 'Shipping info requested · email queued');
  soEmail(o, 'Where should we ship your watch?', 'Please reply with the delivery address and a phone number for the carrier. We ship fully insured and require a signature on delivery.');
  return resolve(soRefs(o));
}

export async function setShippingAddress(id: string, address: Address): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!address.name.trim() || !address.street.trim() || !address.city.trim() || !address.state.trim()) throw new Error('Name, street, city and state are required');
  o.shippingAddress = { ...address }; soTotals(o);
  soStamp(o, `Ship-to set · ${address.name}, ${address.city} ${address.state}`);
  return resolve(soRefs(o));
}

// ---- Shipping seam: the one module a real carrier provider replaces ------------------------------
export const SHIP_CARRIERS: ShipCarrier[] = ['usps', 'ups', 'fedex', 'dhl', 'other'];
// Pack: declared value 0 < n < 1000 is entered in thousands
export const normalizeDeclaredValue = (n: number) => (n > 0 && n < 1000 ? n * 1000 : n);
export interface CreateShipmentInput { carrier: ShipCarrier; declaredValue: number; address: Address; reference: string }
export interface MockShipment { labelId: string; tracking: string; service: string; coverage: number; labelDataUrl: string }
const TRACK: Record<ShipCarrier, () => string> = {
  ups: () => `1Z 999 AA1 ${String(Math.floor(Math.random() * 90 + 10))} ${String(Math.floor(Math.random() * 9000 + 1000))} ${String(Math.floor(Math.random() * 9000 + 1000))}`,
  fedex: () => String(Math.floor(Math.random() * 9e11 + 1e11)),
  usps: () => `9400 1000 0000 ${String(Math.floor(Math.random() * 9000 + 1000))} ${String(Math.floor(Math.random() * 9000 + 1000))} 00`,
  dhl: () => String(Math.floor(Math.random() * 9e9 + 1e9)),
  other: () => `TRK-${Date.now().toString(36).toUpperCase()}`,
};
const SERVICE: Record<ShipCarrier, string> = { ups: 'UPS Next Day Air', fedex: 'FedEx Priority Overnight', usps: 'USPS Priority Mail Express', dhl: 'DHL Express Worldwide', other: 'Courier' };
export const shippingProvider = {
  name: 'MOCK carrier seam',
  async createShipment(input: CreateShipmentInput): Promise<MockShipment> {
    const value = normalizeDeclaredValue(input.declaredValue);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240'><rect width='100%' height='100%' fill='#fff' stroke='#111' stroke-width='4'/><text x='16' y='40' font-family='monospace' font-size='22' font-weight='bold'>${input.carrier.toUpperCase()} · ${SERVICE[input.carrier]}</text><text x='16' y='80' font-family='monospace' font-size='16'>TO: ${input.address.name}</text><text x='16' y='104' font-family='monospace' font-size='16'>${input.address.street}, ${input.address.city} ${input.address.state}</text><text x='16' y='150' font-family='monospace' font-size='14'>REF ${input.reference} · INSURED $${value.toLocaleString('en-US')}</text><rect x='16' y='170' width='368' height='50' fill='#111'/><text x='200' y='232' text-anchor='middle' font-family='monospace' font-size='12'>MOCK LABEL — no carrier contacted</text></svg>`;
    return resolve({ labelId: `LBL-MOCK-${String(store.salesOrders.length + 100).padStart(4, '0')}`, tracking: TRACK[input.carrier](), service: SERVICE[input.carrier], coverage: value, labelDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` });
  },
};

export interface ConfirmShipmentInput { carrier: ShipCarrier; declaredValue: number; photos: PackagePhoto[]; label: MockShipment; bypassReason?: string }
// Ship Station confirm: shipment record, line shipped_qty, SO shipped + tracking + ship_date, Sent notification, custody closes
export async function confirmShipment(id: string, input: ConfirmShipmentInput): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Order is not shippable in its current status');
  if (!o.shippingAddress) throw new Error('Capture the ship-to address first');
  if (input.photos.length === 0) throw new Error('Package photos are required before confirm');
  if (!o.isPaid && !input.bypassReason?.trim()) throw new Error('Unpaid order — ship is blocked unless a payment bypass is logged');
  const a = actor();
  const shipment: Shipment = { id: newId('shp'), carrier: input.carrier, service: input.label.service, tracking: input.label.tracking, labelId: input.label.labelId, labelDataUrl: input.label.labelDataUrl, declaredValue: normalizeDeclaredValue(input.declaredValue), coverage: input.label.coverage, photos: input.photos, address: { ...o.shippingAddress }, bypassReason: input.bypassReason?.trim() || undefined, at: new Date().toISOString(), by: a.by, station: a.station };
  o.shipment = shipment; o.tracking = shipment.tracking; o.shipDate = shipment.at; o.channel = 'ship';
  o.lines.forEach((l) => { l.shippedQty = l.qty; });
  if (o.status !== 'fulfilled') { o.fulfilledAt = o.fulfilledAt ?? shipment.at; }
  o.status = 'shipped'; soTotals(o);
  if (shipment.bypassReason) logBypass({ kind: 'payment_release', orderId: o.id, jobNumber: o.number, reason: shipment.bypassReason, context: { invoiceAmount: o.total, minutesSincePayment: minutesSincePayment(o), detail: `released by shipping · ${input.carrier.toUpperCase()}` } });
  soStamp(o, `Shipped · ${input.carrier.toUpperCase()} ${shipment.tracking} · insured ${fmtMoney(shipment.coverage)}${shipment.bypassReason ? ` · PAYMENT BYPASS: ${shipment.bypassReason}` : ''}`);
  closeCustody(o, `Shipped ${shipment.tracking}`);
  soEmail(o, 'Your watch has shipped', `Your watch is on its way via ${shipment.service}. Tracking: ${shipment.tracking}. The shipment is insured for ${fmtMoney(shipment.coverage)} and requires a signature on delivery.`);
  return resolve(soRefs(o));
}

// ---- Pickup Station v2 — five gated steps (MH 2026-10-01). Every step writes a fact into o.pickupDraft; confirmPickup() re-validates ALL of them before anything leaves. ----
// Gates: 1 item confirmed · 2 balance $0 (sole exception: manager-approved bypass, approver ≠ runner) · 3 identity (QR / code / proxy+manager / reverse QR) · 4 serial check match (or manager override) · 5 first client-camera frame.
export const PICKUP_FRAMES = 6;
export const PICKUP_FRAME_WINDOW_MS = 60_000;
export const PICKUP_EVIDENCE_TIMEOUT_MS = 90_000;
export const REVERSE_QR_TTL_MS = 2 * 60_000; // ruling 2026-10-01: pickup confirm link = 2 minutes
export const PICKUP_RETENTION = { framesDays: 90, idPhotoDays: 30, policy: 'Frames kept 90 days · proxy ID photo 30 days · summary rows permanent' };
export const MOCK_OCR_MAY_PASS = true; // PROTOTYPE ONLY — Keeper sets false: a placeholder photo must never release a watch
export const PICKUP_VERIFY_LABEL: Record<PickupVerifyMethod, string> = { qr_scan: 'QR scanned', code: 'Code typed', proxy: 'Proxy + ID', reverse_qr: 'Reverse QR (client phone)' };

export interface PickupContext { order: SalesOrderWithRefs; draft?: PickupDraft; intakePhotos: PackagePhoto[]; recordSerial: string; codeGeneration: number; codeIssuedAt?: string; resends: PickupResend[]; reverseQr?: ReverseQrToken; aborts: PickupAbort[]; blockers: string[] }
export interface ManagerApprovalInput { managerId: string; pin: string; reason: string }
type PickupEventKind = 'reverse_confirmed' | 'reverse_declined' | 'frame' | 'evidence';
const pickupListeners = new Set<(e: { soId: string; kind: PickupEventKind }) => void>();
export const onPickupEvent = (fn: (e: { soId: string; kind: PickupEventKind }) => void) => { pickupListeners.add(fn); return () => { pickupListeners.delete(fn); }; };
const emitPickup = (soId: string, kind: PickupEventKind) => pickupListeners.forEach((fn) => { try { fn({ soId, kind }); } catch { /* listener gone */ } });

const normPickupCode = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, '');
const normSerial = (x: string | null | undefined) => (x ? x.toUpperCase().replace(/[^A-Z0-9]/g, '') : '');
const isPlaceholderPhoto = (dataUrl: string) => dataUrl.startsWith('data:image/svg') || /^https?:\/\//.test(dataUrl);
const intakePhotosOf = (j: Job | null): PackagePhoto[] => {
  if (!j) return [];
  const fixture = fx.jobPhotos.filter((p) => p.jobId === j.id && p.kind === 'intake').map((p): PackagePhoto => ({ id: p.id, source: 'upload', dataUrl: p.url, slot: p.slot, photoType: 'intake' }));
  const own = j.photos.filter((p) => p.photoType === 'intake');
  const list = [...own, ...fixture];
  return list.length ? list : j.photos.slice(0, 2);
};
const pickupDraftOf = (o: SalesOrder): PickupDraft => { if (!o.pickupDraft) throw new Error('Start the pickup from step 1 first'); return o.pickupDraft; };
// Second-person rule: a manager who is NOT the staffer at the counter enters their own PIN + a reason
const approveAsManager = (input: ManagerApprovalInput): ManagerApproval => {
  const a = actor(); const m = fx.users.find((u) => u.id === input.managerId);
  if (!m || m.accessTier !== 'manager' || m.disabled) throw new Error('Pick an active manager');
  if (a.user && m.id === a.user.id) throw new Error('A different person must approve — the staffer running the pickup cannot approve their own exception');
  if (m.pin !== input.pin && m.password !== input.pin) throw new Error('Manager PIN does not match');
  if (!input.reason.trim()) throw new Error('A reason is required');
  return { by: m.shortName, at: new Date().toISOString(), reason: input.reason.trim() };
};
export async function getApprovingManagers(): Promise<User[]> { const a = actor(); return resolve(fx.users.filter((u) => u.accessTier === 'manager' && !u.disabled && u.id !== a.user?.id)); }

const pickupBlockers = (o: SalesOrder): string[] => {
  const d = o.pickupDraft; const out: string[] = [];
  if (!d?.itemConfirmed) out.push('Step 1 · item not confirmed against the intake photos');
  if (o.balanceDue > 0 && !d?.paymentBypass) out.push(`Step 2 · balance due ${fmtMoney(o.balanceDue)}`);
  if (!d?.verify) out.push('Step 3 · identity not verified'); else if (d.verify.method === 'proxy' && !d.verify.proxyApproval) out.push('Step 3 · proxy release needs a manager approval');
  if (!d?.handbackPhoto) out.push('Step 4 · hand-back photo missing'); else if (!d.serialCheck) out.push('Step 4 · serial check not run'); else if (d.serialCheck.result !== 'match' && !d.serialCheck.override) out.push(`Step 4 · serial ${d.serialCheck.result === 'unreadable' ? 'unreadable' : 'MISMATCH'} — retake or manager override`); else if (d.serialCheck.source === 'mock' && !MOCK_OCR_MAY_PASS && !d.serialCheck.override) out.push('Step 4 · MOCK OCR result cannot release a watch');
  return out;
};
const pickupCtx = (o: SalesOrder): PickupContext => ({ order: soRefs(o), draft: o.pickupDraft, intakePhotos: intakePhotosOf(o.jobId ? store.jobs.find((j) => j.id === o.jobId) ?? null : null), recordSerial: (() => { const j = o.jobId ? store.jobs.find((x) => x.id === o.jobId) : undefined; return j ? store.watches.find((w) => w.id === j.watchId)?.serial ?? '' : ''; })(), codeGeneration: o.pickupCodeGeneration ?? (o.pickupCode ? 1 : 0), codeIssuedAt: o.pickupCodeIssuedAt, resends: o.pickupResends ?? [], reverseQr: o.reverseQr, aborts: o.pickupAborts ?? [], blockers: pickupBlockers(o) });
export async function getPickupContext(id: string): Promise<PickupContext> { pickupEvidenceSweep(); return resolve(pickupCtx(getSO(id))); }

// Step 1 — open the counter session (resets any half-finished draft from a previous customer)
export async function pickupStart(id: string): Promise<PickupContext> {
  const o = getSO(id);
  if (!['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Order is not in the pickup queue');
  if (o.channel === 'ship' && o.shippingAddress) throw new Error('Order has outbound ship products — send staff to Ship Station');
  const a = actor(); o.pickupDraft = { startedAt: new Date().toISOString(), by: a.by, station: a.station };
  soStamp(o, 'Pickup started · step 1 customer / item'); return resolve(pickupCtx(o));
}
export async function pickupConfirmItem(id: string, intakePhotoId?: string): Promise<PickupContext> {
  const o = getSO(id); const d = pickupDraftOf(o); const a = actor();
  d.itemConfirmed = { at: new Date().toISOString(), by: a.by, intakePhotoId }; soStamp(o, 'Step 1 · same item confirmed against intake photos'); return resolve(pickupCtx(o));
}
// Any gate can stop the pickup — the stop is a record (why, where, who), not a silent back button
export async function pickupAbort(id: string, step: string, reason: string): Promise<PickupContext> {
  const o = getSO(id); if (!reason.trim()) throw new Error('Say why the pickup stopped'); const a = actor();
  o.pickupAborts = [...(o.pickupAborts ?? []), { at: new Date().toISOString(), by: a.by, step, reason: reason.trim() }]; o.pickupDraft = undefined; o.reverseQr = undefined;
  soStamp(o, `PICKUP STOPPED at ${step} · ${reason.trim()}`); if (o.jobId) jobStamp(byId(store.jobs, o.jobId), `Pickup stopped at ${step} · ${reason.trim()} · ${o.number}`);
  if (step.startsWith('step 1')) upsertSystemPin(`pickup-item:${o.id}`, { title: `Pickup stopped · ${o.number} · item did not match intake photos`, subtitle: reason.trim(), assignedTo: MH_ASSIGNEE, priority: 'high', link: `/sales/${o.id}` });
  return resolve(pickupCtx(o));
}
// Step 2 — the ONLY way past a balance: a different manager approves, reason required, logged on the SO + Hitlist at release
export async function pickupApproveBypass(id: string, input: ManagerApprovalInput): Promise<PickupContext> {
  const o = getSO(id); const d = pickupDraftOf(o); if (o.balanceDue <= 0) throw new Error('Nothing owed — no bypass needed');
  const ap = approveAsManager(input); d.paymentBypass = { ...ap, amount: o.balanceDue };
  soStamp(o, `Step 2 · PAYMENT BYPASS approved by ${ap.by} · ${fmtMoney(o.balanceDue)} outstanding · ${ap.reason}`); return resolve(pickupCtx(o));
}
// Step 3 — resend rotates the code: the old one dies immediately (safer; the station explains a stale email instead of accepting it)
export async function pickupResendCode(id: string, channel: 'email' | 'sms'): Promise<PickupContext> {
  const o = getSO(id); const c = byId(fx.clients, o.clientId); const a = actor(); const now = new Date().toISOString();
  const gen = (o.pickupCodeGeneration ?? (o.pickupCode ? 1 : 0)) + 1;
  if (o.pickupCode) { o.pickupCodeHistory = [...(o.pickupCodeHistory ?? []).filter((h) => h.code !== o.pickupCode), { code: o.pickupCode, generation: gen - 1, issuedAt: o.pickupCodeIssuedAt ?? now, replacedAt: now, replacedVia: channel }]; }
  issuePickupCode(o); o.pickupCodeGeneration = gen;
  const text = `RolliWorks pickup code for ${o.number}: ${o.pickupCode}. Show this message or the QR at the counter. Earlier codes no longer work.`;
  let to = c.email; let smsId: string | undefined;
  if (channel === 'email') soEmail(o, 'Your new pickup code', `${text}\n\nQR payload: RSPU:${o.number}:${o.pickupCode}`);
  else { const r = sendSms(c.phone, text); if (r.status === 'failed') throw new Error('No usable mobile number on file — send by email'); to = r.maskedTo; smsId = r.id; queueOutbox({ id: `ob-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, to: c.phone, toName: fullNameOf(c), relatedRef: o.number, status: 'pending', subject: `SMS → ${r.maskedTo} — ${o.number} (vonage-mock ${r.id})`, body: text, createdAt: now, createdBy: a.by, station: a.station }); }
  o.pickupResends = [...(o.pickupResends ?? []), { at: now, by: a.by, channel, to: channel === 'email' ? to.replace(/^(.{2}).*(@.*)$/, '$1•••$2') : to, generation: gen, smsId }];
  soStamp(o, `Step 3 · code rotated → generation ${gen} · ${channel.toUpperCase()} to ${o.pickupResends[o.pickupResends.length - 1].to}${smsId ? ` · ${smsId}` : ''} · previous code void`); soTotals(o);
  return resolve(pickupCtx(o));
}
// QR payload = RSPU:<SO>:<code> (also accepts the bare code). Same rotation-aware check for scanned, typed and simulated input.
export async function pickupVerifyCode(id: string, raw: string, via: 'qr_scan' | 'code'): Promise<PickupContext> {
  const o = getSO(id); const d = pickupDraftOf(o);
  const payload = raw.trim(); const m = /^RSPU:([^:]+):(.+)$/i.exec(payload);
  if (m && normPickupCode(m[1]) !== normPickupCode(o.number)) { soStamp(o, `Step 3 · verify FAILED · ${via} · QR belongs to ${m[1]}`); throw new Error(`That QR is for ${m[1]}, not ${o.number}`); }
  const code = normPickupCode(m ? m[2] : payload);
  if (!code) throw new Error('Scan or type the code');
  if (!o.pickupCode) throw new Error('No code on record — resend one or use proxy verification');
  if (normPickupCode(o.pickupCode) === code) { d.verify = { method: via, at: new Date().toISOString(), codeUsed: o.pickupCode }; soStamp(o, `Step 3 · identity verified · ${PICKUP_VERIFY_LABEL[via]} · generation ${o.pickupCodeGeneration ?? 1}`); return resolve(pickupCtx(o)); }
  const old = (o.pickupCodeHistory ?? []).find((h) => normPickupCode(h.code) === code);
  soStamp(o, `Step 3 · verify FAILED · ${via} · ${old ? `stale code (generation ${old.generation})` : 'no match'}`);
  if (old) throw new Error(`That code was replaced on ${new Date(old.replacedAt ?? old.issuedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} (generation ${old.generation} of ${o.pickupCodeGeneration ?? 1}) — ask the client for the newest message, or resend`);
  throw new Error('Code does not match this order');
}
// Proxy = weakest path (no client-side proof): name + government ID photo + a manager's approval, all on the record
export async function pickupVerifyProxy(id: string, proxyName: string, idPhoto: PackagePhoto | undefined, approval: ManagerApprovalInput): Promise<PickupContext> {
  const o = getSO(id); const d = pickupDraftOf(o);
  if (!proxyName.trim()) throw new Error('Proxy full name is required'); if (!idPhoto) throw new Error('Photograph the proxy’s government ID');
  const ap = approveAsManager(approval);
  d.verify = { method: 'proxy', at: new Date().toISOString(), proxyName: proxyName.trim(), proxyIdPhoto: idPhoto, proxyApproval: ap };
  soStamp(o, `Step 3 · proxy release approved by ${ap.by} · ${proxyName.trim()} · ID photographed · ${ap.reason}`); return resolve(pickupCtx(o));
}
// Reverse QR: the STATION shows a QR; the client's phone opens /rc/pickup/<token> and taps Confirm. Single-use, 10 min, bound to this SO + station.
export async function pickupIssueReverseQr(id: string): Promise<PickupContext> {
  const o = getSO(id); pickupDraftOf(o); const a = actor(); const now = Date.now();
  o.reverseQr = { token: `rq-${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`, issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + REVERSE_QR_TTL_MS).toISOString(), station: a.station };
  soStamp(o, `Step 3 · reverse-QR token issued · expires ${new Date(now + REVERSE_QR_TTL_MS).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · bound to ${a.station}`); return resolve(pickupCtx(o));
}
export interface PortalPickupConfirm { soNumber: string; clientFirstName: string; watchLabel: string; station: string; expiresAt: string; shop: string; state: 'open' | 'confirmed' | 'declined' | 'expired' | 'used' }
const soByReverseToken = (token: string) => { const o = store.salesOrders.find((x) => x.reverseQr?.token === token); if (!o?.reverseQr) throw new Error('This pickup link is not valid'); return o; };
export async function portalGetPickupConfirm(token: string): Promise<PortalPickupConfirm> {
  const o = soByReverseToken(token); const r = o.reverseQr!; const c = byId(fx.clients, o.clientId); const j = o.jobId ? store.jobs.find((x) => x.id === o.jobId) : undefined; const w = j ? store.watches.find((x) => x.id === j.watchId) : undefined;
  const state: PortalPickupConfirm['state'] = r.confirmedAt ? 'confirmed' : r.declinedAt ? 'declined' : r.usedAt ? 'used' : new Date(r.expiresAt).getTime() < Date.now() ? 'expired' : 'open';
  return resolve({ soNumber: o.number, clientFirstName: c.firstName, watchLabel: w ? `${w.brand} ${w.model}` : 'your watch', station: r.station, expiresAt: r.expiresAt, shop: 'RolliWorks · Luxury Watch Service', state });
}
export async function portalConfirmPickup(token: string): Promise<PortalPickupConfirm> {
  const o = soByReverseToken(token); const r = o.reverseQr!;
  if (r.usedAt) throw new Error('This link was already used'); if (new Date(r.expiresAt).getTime() < Date.now()) throw new Error('This link expired — ask the counter to show a new QR');
  const now = new Date().toISOString(); r.usedAt = now; r.confirmedAt = now;
  if (o.pickupDraft) o.pickupDraft.verify = { method: 'reverse_qr', at: now, reverseToken: token };
  await asClient(o.clientId, async () => { soStamp(o, `Step 3 · identity verified · ${PICKUP_VERIFY_LABEL.reverse_qr} · client confirmed on their phone`); });
  emitPickup(o.id, 'reverse_confirmed'); return portalGetPickupConfirm(token);
}
export async function portalDeclinePickup(token: string): Promise<PortalPickupConfirm> {
  const o = soByReverseToken(token); const r = o.reverseQr!; if (r.usedAt) throw new Error('This link was already used');
  const now = new Date().toISOString(); r.usedAt = now; r.declinedAt = now;
  await asClient(o.clientId, async () => { soStamp(o, 'Step 3 · CLIENT DECLINED the reverse-QR confirmation — stop the hand-over'); });
  upsertSystemPin(`pickup-declined:${o.id}`, { title: `Client declined pickup confirmation · ${o.number}`, subtitle: 'Someone at the counter tried to collect; the account holder said "not me"', assignedTo: MH_ASSIGNEE, priority: 'high', link: `/sales/${o.id}` });
  emitPickup(o.id, 'reverse_declined'); return portalGetPickupConfirm(token);
}
// Step 4 — both crops → serial OCR (Claude when the photos are real; MOCK when either is a placeholder or the model is down) → three-way compare
export async function pickupCheckSerial(id: string, intakePhoto: PackagePhoto, handbackPhoto: PackagePhoto): Promise<PickupContext> {
  const o = getSO(id); const d = pickupDraftOf(o); const record = normSerial(pickupCtx(o).recordSerial);
  d.intakePhoto = intakePhoto; d.handbackPhoto = handbackPhoto; d.serialCheck = undefined;
  let source: PickupSerialCheck['source'] = 'claude'; let intake: PickupSerialCheck['intake']; let handback: PickupSerialCheck['handback'];
  const mock = () => { source = 'mock'; const scramble = record ? record.slice(0, 5) + (record[5] === '7' ? '1' : '7') + record.slice(6) : 'UNKNOWN'; intake = { value: record || null, confidence: record ? 0.93 : null }; handback = o.pickupDemo === 'serial_mismatch' ? { value: scramble, confidence: 0.91 } : o.pickupDemo === 'serial_unreadable' ? { value: null, confidence: 0.31 } : { value: record || null, confidence: record ? 0.9 : null }; };
  if (isPlaceholderPhoto(intakePhoto.dataUrl) || isPlaceholderPhoto(handbackPhoto.dataUrl)) mock();
  else { try { const r = await readSerials(intakePhoto.dataUrl, handbackPhoto.dataUrl); intake = { value: normSerial(r.intake.serial) || null, confidence: r.intake.confidence }; handback = { value: normSerial(r.handback.serial) || null, confidence: r.handback.confidence }; } catch { mock(); } }
  const low = (x: PickupSerialCheck['intake']) => !x.value || (x.confidence ?? 0) < 0.6;
  let result: PickupSerialCheck['result'] = 'match'; let failedPair: PickupSerialCheck['failedPair'];
  if (low(intake!) || low(handback!)) result = 'unreadable';
  else if (record && handback!.value !== record) { result = 'mismatch'; failedPair = 'handback_vs_record'; }
  else if (record && intake!.value !== record) { result = 'mismatch'; failedPair = 'intake_vs_record'; }
  else if (intake!.value !== handback!.value) { result = 'mismatch'; failedPair = 'intake_vs_handback'; }
  d.serialCheck = { record, intake: intake!, handback: handback!, result, failedPair, source, at: new Date().toISOString() };
  soStamp(o, `Step 4 · serial check ${result.toUpperCase()}${failedPair ? ` (${failedPair.replace(/_/g, ' ')})` : ''} · intake ${intake!.value ?? '—'} · hand-back ${handback!.value ?? '—'} · record ${record || '—'} · ${source === 'claude' ? 'Claude vision' : 'MOCK'}`);
  return resolve(pickupCtx(o));
}
export async function pickupOverrideSerial(id: string, approval: ManagerApprovalInput): Promise<PickupContext> {
  const o = getSO(id); const d = pickupDraftOf(o); if (!d.serialCheck) throw new Error('Run the serial check first'); if (d.serialCheck.result === 'match') throw new Error('Nothing to override — serials match');
  const ap = approveAsManager(approval); d.serialCheck.override = ap; soStamp(o, `Step 4 · serial ${d.serialCheck.result} OVERRIDDEN by ${ap.by} · ${ap.reason}`); return resolve(pickupCtx(o));
}
// Dev-only helper so "Simulate scan" exercises the exact same verify path as a real decode (the UI hides it outside dev builds)
export async function pickupDevQrPayload(id: string): Promise<string> { if (!import.meta.env.DEV) throw new Error('Not available'); const o = getSO(id); return resolve(o.pickupCode ? `RSPU:${o.number}:${o.pickupCode}` : ''); }

export const pickupSummaryLine = (s: PickupSession, clientName?: string): string => {
  const who = s.proxyName ? `proxy ${s.proxyName}` : clientName ?? 'client';
  const via = s.adminOverride ? 'ADMIN MARK' : s.verifyMethod ? PICKUP_VERIFY_LABEL[s.verifyMethod] : s.codeUsed ? 'code' : 'proxy';
  const serial = s.serialCheck ? (s.serialCheck.override ? `serial ${s.serialCheck.result} — overridden by ${s.serialCheck.override.by}` : `serial ${s.serialCheck.result}${s.serialCheck.source === 'mock' ? ' (MOCK)' : ''}`) : null;
  const ev = s.evidenceStatus === 'bypassed' ? 'released without camera evidence' : s.evidenceStatus ? `evidence ${s.frames?.length ?? 0}/${s.framesExpected ?? PICKUP_FRAMES}${s.evidenceStatus === 'pending' ? ' pending' : s.evidenceStatus === 'incomplete' ? ' INCOMPLETE' : ''}` : null;
  return ['Released to ' + who, `via ${via}`, serial, s.paymentBypass ? `PAYMENT BYPASS ${s.paymentBypass.by}` : null, ev].filter(Boolean).join(' · ');
};
export interface ConfirmPickupInput { firstFrame?: PackagePhoto; cameraBypass?: ManagerApprovalInput; lineQty?: Record<string, number> }
// Step 5 — commit. "Done" needs frame 1 from the client camera (or a manager-approved camera bypass); frames 2–6 keep arriving over the next 60 s.
export async function confirmPickup(id: string, input: ConfirmPickupInput = {}): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Order is not in the pickup queue');
  if (o.channel === 'ship' && o.shippingAddress) throw new Error('Order has outbound ship products — send staff to Ship Station');
  const d = pickupDraftOf(o); const blockers = pickupBlockers(o); if (blockers.length) throw new Error(blockers[0]);
  const cameraBypass = input.cameraBypass ? approveAsManager(input.cameraBypass) : undefined;
  if (!input.firstFrame && !cameraBypass) throw new Error('Client camera: the first frame is required before Done — check the camera or have a manager approve a camera bypass');
  const a = actor(); const now = new Date().toISOString(); const lineQty = input.lineQty ?? {};
  o.lines.forEach((l) => { l.pickedUpQty = Math.min(l.qty, l.pickedUpQty + (lineQty[l.id] ?? l.qty - l.pickedUpQty)); });
  const fully = o.lines.every((l) => l.pickedUpQty >= l.qty);
  const frames: PickupFrame[] = input.firstFrame ? [{ id: newId('pf'), seq: 1, at: now, dataUrl: input.firstFrame.dataUrl, cameraRole: 'client', station: a.station }] : [];
  const plus = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  o.pickupSession = { id: newId('pks'), at: now, by: a.by, station: a.station, codeUsed: d.verify!.codeUsed, proxyName: d.verify!.proxyName, proxyIdPhoto: d.verify!.proxyIdPhoto, proxyApproval: d.verify!.proxyApproval, verifyMethod: d.verify!.method, itemConfirmed: d.itemConfirmed, intakePhoto: d.intakePhoto, handbackPhoto: d.handbackPhoto, photos: d.handbackPhoto ? [d.handbackPhoto] : [], serialCheck: d.serialCheck, paymentBypass: d.paymentBypass, bypassReason: d.paymentBypass?.reason, cameraBypass, lineQty, frames, framesExpected: PICKUP_FRAMES, evidenceStatus: cameraBypass ? 'bypassed' : 'pending', evidenceStartedAt: cameraBypass ? undefined : now, retention: { framesUntil: plus(PICKUP_RETENTION.framesDays), idPhotoUntil: d.verify!.proxyIdPhoto ? plus(PICKUP_RETENTION.idPhotoDays) : undefined, policy: PICKUP_RETENTION.policy }, codeGeneration: o.pickupCodeGeneration ?? (o.pickupCode ? 1 : 0) };
  o.channel = 'pickup'; o.pickupCode = undefined; o.pickupDraft = undefined; o.reverseQr = undefined;
  if (fully) { o.status = 'picked_up'; o.pickedUpAt = now; if (!o.fulfilledAt) o.fulfilledAt = now; } else o.status = 'partial_fulfilled';
  soTotals(o);
  if (o.pickupSession.paymentBypass) logBypass({ kind: 'payment_release', orderId: o.id, jobNumber: o.number, reason: `${o.pickupSession.paymentBypass.reason} · approved by ${o.pickupSession.paymentBypass.by}`, context: { invoiceAmount: o.total, minutesSincePayment: minutesSincePayment(o), detail: `released at pickup station · ${fmtMoney(o.pickupSession.paymentBypass.amount)} outstanding` } });
  if (cameraBypass) logBypass({ kind: 'pickup_camera', orderId: o.id, jobNumber: o.number, reason: `${cameraBypass.reason} · approved by ${cameraBypass.by}`, context: { detail: 'released without client-camera evidence' } });
  const summary = pickupSummaryLine(o.pickupSession, fullNameOf(byId(fx.clients, o.clientId)));
  soStamp(o, `${fully ? 'PICKED UP' : 'Partial pickup'} · ${summary}`);
  if (fully) closeCustody(o, summary);
  soEmail(o, fully ? 'Thank you — your watch is home' : 'Partial pickup recorded', fully ? 'Your watch was handed back at the counter today. Thank you for trusting us with it.' : 'Part of your order was collected today; the remaining items will be ready shortly.');
  resolveSystemPin(`pickup-item:${o.id}`, 'pickup completed');
  return resolve(soRefs(o));
}
// Frames 2..6 arrive from the client camera after Done; 6/6 flips the record to complete
export async function pickupAppendFrame(id: string, dataUrl: string): Promise<PickupSession> {
  const o = getSO(id); const s = o.pickupSession; if (!s?.frames || s.evidenceStatus !== 'pending') throw new Error('No evidence capture open on this order');
  const a = actor(); s.frames.push({ id: newId('pf'), seq: s.frames.length + 1, at: new Date().toISOString(), dataUrl, cameraRole: 'client', station: a.station });
  if (s.frames.length >= (s.framesExpected ?? PICKUP_FRAMES)) { s.evidenceStatus = 'complete'; s.evidenceCompletedAt = new Date().toISOString(); soStamp(o, `Evidence complete · ${s.frames.length}/${s.framesExpected} frames · client camera`); if (o.jobId) jobStamp(byId(store.jobs, o.jobId), `Pickup evidence complete · ${s.frames.length}/${s.framesExpected} frames · ${o.number}`); resolveSystemPin(`pickup-evidence:${o.id}`, 'frames completed'); emitPickup(o.id, 'evidence'); }
  else emitPickup(o.id, 'frame');
  return resolve(s);
}
// Dead USB camera / closed tab → the strip never finishes. 90 s after Done the record is flagged and MH gets a Hitlist pin (ruling: a message is fine, cams are flaky).
export const pickupEvidenceSweep = (): number => {
  let n = 0;
  for (const o of store.salesOrders) {
    const s = o.pickupSession; if (!s || s.evidenceStatus !== 'pending' || !s.evidenceStartedAt) continue;
    if (Date.now() - new Date(s.evidenceStartedAt).getTime() < PICKUP_EVIDENCE_TIMEOUT_MS) continue;
    s.evidenceStatus = 'incomplete'; s.evidenceFlaggedAt = new Date().toISOString(); n++;
    appendAudit({ type: 'sales', stationName: s.station, userShortName: undefined, detail: `${o.number} · Pickup evidence INCOMPLETE · ${s.frames?.length ?? 0}/${s.framesExpected ?? PICKUP_FRAMES} frames after ${PICKUP_EVIDENCE_TIMEOUT_MS / 1000}s · flagged to MH` });
    upsertSystemPin(`pickup-evidence:${o.id}`, { title: `Pickup evidence incomplete · ${o.number} · ${s.frames?.length ?? 0}/${s.framesExpected ?? PICKUP_FRAMES} frames`, subtitle: `Client camera stopped early at ${s.station} — review the pickup session`, assignedTo: MH_ASSIGNEE, priority: 'high', standing: true, link: `/sales/${o.id}` });
    emitPickup(o.id, 'evidence');
  }
  return n;
};
// Job timeline + any other reader derive the release line LIVE from the session (frames keep arriving after the close transition was written)
export const jobReleaseLineSync = (jobId: string): { text: string; soId: string; soNumber: string } | undefined => { const o = store.salesOrders.find((x) => x.jobId === jobId && x.pickupSession); return o?.pickupSession ? { text: pickupSummaryLine(o.pickupSession, clientName(o.clientId)), soId: o.id, soNumber: o.number } : undefined; };
export async function getPickupSession(id: string): Promise<PickupSession | undefined> { pickupEvidenceSweep(); return resolve(getSO(id).pickupSession); }
export async function getOpenEvidenceCaptures(): Promise<{ order: SalesOrderWithRefs; session: PickupSession }[]> { pickupEvidenceSweep(); return resolve(store.salesOrders.filter((o) => o.pickupSession?.evidenceStatus === 'pending').map((o) => ({ order: soRefs(o), session: o.pickupSession! }))); }
// Admin overrides (pack: allowed with an audit log; privileged roles) — manager tier
export async function adminMarkComplete(id: string, mode: FulfillmentChannel, note: string): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  const a = actor();
  if (a.user?.accessTier !== 'manager') throw new Error('Admin mark requires a manager');
  if (!note.trim()) throw new Error('Log why the override is needed');
  if (mode === 'pickup') { o.status = 'picked_up'; o.pickedUpAt = new Date().toISOString(); o.lines.forEach((l) => { l.pickedUpQty = l.qty; }); o.pickupSession = { id: newId('pks'), photos: [], lineQty: {}, adminOverride: true, at: o.pickedUpAt, by: a.by, station: a.station, bypassReason: note.trim() }; }
  else { o.status = 'shipped'; o.shipDate = new Date().toISOString(); o.tracking = o.tracking ?? 'ADMIN-MARKED'; o.lines.forEach((l) => { l.shippedQty = l.qty; }); }
  o.channel = mode; if (!o.fulfilledAt) o.fulfilledAt = new Date().toISOString(); soTotals(o);
  soStamp(o, `ADMIN MARK ${mode === 'pickup' ? 'PICKED UP' : 'SHIPPED'} · ${note.trim()}`);
  closeCustody(o, `Admin marked ${mode}`);
  return resolve(soRefs(o));
}

// Custody closes at hand-back (pickup / ship): job → closed, watch → released
const closeCustody = (o: SalesOrder, why: string) => {
  if (!o.jobId) return;
  const j = store.jobs.find((x) => x.id === o.jobId);
  if (!j || j.status === 'closed') return;
  if (j.status === 'ready_to_ship') pushTransition(j, 'close', 'closed', why); // the reason IS the hand-over summary — one record, shown on the job timeline
  jobStamp(j, `Custody closed · ${why} · ${o.number}`);
};

// Queues for the stations
export async function getPickupQueue(): Promise<SalesOrderWithRefs[]> {
  return resolve(store.salesOrders.filter((o) => ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status) && o.channel !== 'ship').map(soRefs));
}
export async function getShipQueue(): Promise<SalesOrderWithRefs[]> {
  return resolve(store.salesOrders.filter((o) => ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status) && o.channel === 'ship').map(soRefs));
}

// ---- E6 Workshop lenses: bench, supervisor, floor map ----------------------------------------

const nextActionLabel = (j: Job): { label: string | null; blocked: string | null } => {
  const hold = activeHold(j);
  if (hold) return { label: null, blocked: `${hold.type} hold — ${hold.reason}` };
  const gaps = reviewGaps(j);
  const acts = legalJobActions(j);
  if (!acts.length) return { label: null, blocked: j.status === 'closed' ? 'closed' : null };
  return { label: acts[0].label.replace('…', ''), blocked: gaps.length ? gaps.join(' · ') : null };
};

const BENCH_STATES: JobStatus[] = ['approved', 'in_service', 'testing'];

// Pull-next: oldest approved, unassigned, on-hand job — but never one a supervisor already assigned to someone else
export const pullNextCandidate = (me: string): Job | null =>
  store.jobs
    .filter((j) => j.status === 'approved' && j.simpleStatus === 'on_hand' && !activeHold(j) && j.assignees.length === 0 && me !== '')
    .sort((a, b) => ({ urgent: 0, high: 1, normal: 2, low: 3 }[a.priority] - { urgent: 0, high: 1, normal: 2, low: 3 }[b.priority]) || a.createdAt.localeCompare(b.createdAt))[0] ?? null;

export async function getBenchView(userId?: string): Promise<BenchView> {
  const me = userId ? byId(fx.users, userId) : currentUserSync();
  if (!me) return resolve({ jobs: [], holds: [], pullNext: null, partsRequests: [] });
  const mine = store.jobs.filter((j) => j.assignees.includes(me.shortName) && j.status !== 'closed');
  const jobs = mine.filter((j) => !activeHold(j)).sort((a, b) => a.status.localeCompare(b.status) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')).map((j) => { const n = nextActionLabel(j); return { ...jobRefs(j), nextAction: n.label, blocked: n.blocked }; });
  const holds = mine.filter((j) => activeHold(j)).map(jobRefs);
  const benchRole = me.roles.includes('watchmaker') || me.accessTier === 'manager';
  const pn = benchRole ? pullNextCandidate(me.shortName) : null;
  const partsRequests = store.partsRequests.filter((r) => r.requestedBy === me.shortName && r.status !== 'draft').map(prRefs);
  return resolve({ jobs, holds, pullNext: pn ? jobRefs(pn) : null, partsRequests });
}

// Pull-next = self-assign + start service, audit-stamped
export async function pullNext(): Promise<JobWithRefs> {
  const a = actor();
  if (!a.user || !(a.user.roles.includes('watchmaker') || a.user.accessTier === 'manager')) throw new Error('Pull-next is for bench roles (watchmaker / manager tier)');
  const j = pullNextCandidate(a.by);
  if (!j) throw new Error('Nothing to pull — no unassigned approved jobs on hand');
  if (!j.assignees.includes(a.by)) j.assignees.push(a.by);
  jobStamp(j, `Pulled next by ${a.by} · self-assigned`);
  return resolve(jobRefs(j));
}

export async function getSupervisorBoard(): Promise<SupervisorBoard> {
  const open = store.jobs.filter((j) => j.status !== 'closed');
  const techs = fx.users.filter((u) => u.roles.includes('watchmaker') || u.accessTier === 'manager');
  return resolve({
    unassigned: open.filter((j) => j.assignees.length === 0 && BENCH_STATES.includes(j.status)).map(jobRefs),
    byTech: techs.map((user) => ({ user, jobs: open.filter((j) => j.assignees.includes(user.shortName) && BENCH_STATES.includes(j.status)).map(jobRefs) })),
    partsQueue: store.partsRequests.filter((r) => r.status === 'pending').map(prRefs),
    holds: open.filter((j) => activeHold(j)).map(jobRefs),
    qcQueue: open.filter((j) => j.status === 'testing' && !activeHold(j)).map(jobRefs),
  });
}

// Supervisor assignment: overwrites the bench (audit says who)
export async function supervisorAssign(jobId: string, shortNames: string[]): Promise<JobWithRefs> {
  const j = getJobRow(jobId);
  const a = actor();
  if (!a.user || !canSuperviseUser(a.user)) throw new Error('Assignment is a supervisor action');
  const prev = j.assignees.join(', ') || 'nobody';
  j.assignees = shortNames.filter((s) => fx.users.some((u) => u.shortName === s));
  jobStamp(j, `Supervisor ${a.by} assigned → ${j.assignees.join(', ') || 'nobody'} (was ${prev})`);
  return resolve(jobRefs(j));
}

const FLOOR_LANES: { key: FloorLane; label: string }[] = [
  { key: 'intake', label: 'Intake' }, { key: 'review', label: 'Review' }, { key: 'approval', label: 'Awaiting approval' }, { key: 'bench', label: 'Bench' },
  { key: 'case_cleaning', label: 'Case cleaning' }, { key: 'holds', label: 'Holds (parked)' }, { key: 'qc', label: 'Testing / QC' }, { key: 'ready', label: 'Ready' }, { key: 'out', label: 'Out the door' },
];
// Case-cleaning lane = in-service jobs whose remaining work is polish-only (P / PM) — PROVISIONAL derivation
const floorLane = (j: Job): FloorLane => {
  if (activeHold(j)) return 'holds';
  switch (j.status) {
    case 'intake': return 'intake';
    case 'in_review': return 'review';
    case 'awaiting_customer_approval': return 'approval';
    case 'approved': return 'bench';
    case 'in_service': return j.workflow.every((d) => d === 'P' || d === 'PM') ? 'case_cleaning' : 'bench';
    case 'testing': return 'qc';
    case 'awaiting_manager_review': return 'qc';
    case 'ready_to_ship': return 'ready';
    default: return 'out';
  }
};
export async function getShopFloorMap(): Promise<FloorMap> {
  const recent = store.jobs.filter((j) => j.status !== 'closed' || (j.finishedAt && Date.now() - new Date(j.finishedAt).getTime() < 14 * 86_400_000));
  return resolve({ lanes: FLOOR_LANES.map((l) => ({ ...l, jobs: recent.filter((j) => floorLane(j) === l.key).map(jobRefs) })) });
}

// ---- E6 Parts request → scripted assistant → approval loop -------------------------------------

const prRefs = (r: PartsRequest): PartsRequestWithRefs => {
  const job = byId(store.jobs, r.jobId);
  return { ...r, job, part: r.partId ? store.parts.find((p) => p.id === r.partId) ?? null : null, client: byId(fx.clients, job.clientId), watch: byId(store.watches, job.watchId) };
};
const partsStamp = (r: PartsRequest, detail: string) => {
  const a = actor(); (r.history ??= []).push({ at: new Date().toISOString(), by: a.by, station: a.station, action: detail });
  appendAudit({ type: 'parts', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${r.number} · ${detail}` });
};

export async function getParts(): Promise<Part[]> { return resolve(store.parts.map((p) => ({ ...p }))); }
export async function getPartsRequests(): Promise<PartsRequestWithRefs[]> { return resolve([...store.partsRequests].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(prRefs)); }
export async function getPartsRequest(id: string): Promise<PartsRequestWithRefs | null> { const r = store.partsRequests.find((x) => x.id === id); return resolve(r ? prRefs(r) : null); }
export async function getPartsRequestsForJob(jobId: string): Promise<PartsRequestWithRefs[]> { return resolve(store.partsRequests.filter((r) => r.jobId === jobId).map(prRefs)); }
export async function getPartsKnowledge(): Promise<PartsKnowledgeEntry[]> { return resolve([...store.partsKnowledge].sort((a, b) => b.at.localeCompare(a.at))); }

export async function openPartsRequest(jobId: string): Promise<PartsRequestWithRefs> {
  const j = getJobRow(jobId);
  const a = actor();
  const w = byId(store.watches, j.watchId);
  const r: PartsRequest = { id: newId('pr'), number: `PR-${String(++store.counters.pr).padStart(4, '0')}`, jobId, status: 'draft', qty: 1, searchTerms: [], requestedBy: a.by, requestedAt: new Date().toISOString(), station: a.station,
    chat: [{ id: newId('cm'), role: 'assistant', text: `Parts lookup for ${j.number} · ${w.brand} ${w.model} ref ${w.reference}. Tell me what you need in your own words — e.g. “crystal ring for a ${w.reference}”.`, at: new Date().toISOString() }] };
  store.partsRequests.unshift(r);
  partsStamp(r, `Opened on ${j.number} by ${a.by}`);
  return resolve(prRefs(r));
}

// SCRIPTED assistant — canned matcher over the seeded catalog. No AI: tokens → refs / calibers / aliases / names.
const REF_RE = /\b(m?\d{5,6}[a-z]{0,2})\b/gi;
const CAL_RE = /\b(mt\s?\d{4}|\d{4})\b/gi;
const STOP = new Set(['for', 'a', 'an', 'the', 'my', 'need', 'i', 'on', 'of', 'to', 'please', 'and', 'with', 'this', 'that', 'ref', 'cal', 'caliber']);
export function partsAssistantReply(query: string, job: Job): { text: string; suggestions: { partId: string; reason: string }[] } {
  const q = query.toLowerCase();
  const refs = Array.from(q.matchAll(REF_RE)).map((m) => m[1].toUpperCase());
  const cals = Array.from(q.matchAll(CAL_RE)).map((m) => m[1].replace(/\s/g, '').toUpperCase()).filter((c) => !refs.includes(c));
  const words = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
  const watch = byId(store.watches, job.watchId);
  const scored = store.parts.map((p) => {
    let score = 0; const why: string[] = [];
    const refHit = refs.find((r) => p.compatibleRefs.some((cr) => cr.toUpperCase() === r));
    if (refHit) { score += 5; why.push(`ref ${refHit}`); }
    const calHit = cals.find((c) => p.calibers.some((pc) => pc.toUpperCase() === c));
    if (calHit) { score += 5; why.push(`caliber ${calHit}`); }
    const aliasHit = p.aliases.find((al) => q.includes(al));
    if (aliasHit) { score += 4; why.push(`“${aliasHit}”`); }
    const wordHits = words.filter((w) => p.name.toLowerCase().includes(w) || p.category === w || p.aliases.some((al) => al.split(' ').includes(w)));
    if (wordHits.length && !aliasHit) { score += 2 * wordHits.length; why.push(wordHits.join(' ')); }
    if (!refs.length && !cals.length && p.compatibleRefs.includes(watch.reference)) { score += 1; why.push(`fits job ref ${watch.reference}`); }
    return { p, score, why };
  }).filter((x) => x.score >= 4).sort((a, b) => b.score - a.score).slice(0, 4);
  if (!scored.length) {
    const loose = store.parts.map((p) => ({ p, hits: words.filter((w) => p.name.toLowerCase().includes(w) || p.category === w || p.aliases.some((al) => al.includes(w))) })).filter((x) => x.hits.length).sort((a, b) => b.hits.length - a.hits.length || Number(b.p.compatibleRefs.includes(watch.reference)) - Number(a.p.compatibleRefs.includes(watch.reference))).slice(0, 3);
    if (loose.length) return { text: `Best effort for “${query.trim()}” — low confidence without a reference. Add a reference to narrow (the job watch is ref ${watch.reference}).`, suggestions: loose.map((x) => ({ partId: x.p.id, reason: `low-ranked · ${x.hits.join(' ')}${x.p.compatibleRefs.includes(watch.reference) ? ` · fits ${watch.reference}` : ''}` })) };
    const hint = refs.length || cals.length ? 'Nothing in the catalog matches that reference or caliber.' : `I need a reference or caliber to be sure — the job watch is ref ${watch.reference}.`;
    return { text: `${hint} Try a part word plus a reference, e.g. “gasket ${watch.reference}”.`, suggestions: [] };
  }
  const head = refs.length ? `Found ${scored.length} match${scored.length === 1 ? '' : 'es'} for ref ${refs[0]}.` : cals.length ? `Found ${scored.length} match${scored.length === 1 ? '' : 'es'} for cal. ${cals[0]}.` : `Best guesses for “${query.trim()}” — low confidence without a reference. Add a reference to narrow (the job watch is ref ${watch.reference}).`;
  return { text: `${head} Attach one to the request.`, suggestions: scored.map((x) => ({ partId: x.p.id, reason: x.why.join(' · ') })) };
}

export async function partsChat(requestId: string, text: string): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId);
  if (!text.trim()) throw new Error('Type what you need');
  if (r.status !== 'draft' && r.status !== 'pending') throw new Error('Request is decided — open a new one');
  const now = new Date().toISOString();
  const job = byId(store.jobs, r.jobId);
  r.chat.push({ id: newId('cm'), role: 'user', text: text.trim(), at: now });
  r.searchTerms.push(text.trim().toLowerCase());
  const reply = partsAssistantReply(text, job);
  r.chat.push({ id: newId('cm'), role: 'assistant', text: reply.text, suggestions: reply.suggestions, at: now });
  return resolve(prRefs(r));
}

export async function attachPart(requestId: string, partId: string, qty = 1, note?: string): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId);
  const p = byId(store.parts, partId);
  r.partId = p.id; r.qty = Math.max(1, qty); r.note = note?.trim() || r.note;
  partsStamp(r, `Attached ${p.partNumber} ×${r.qty}`);
  return resolve(prRefs(r));
}

export async function submitPartsRequest(requestId: string, note?: string): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId);
  if (!r.partId) throw new Error('Attach a part first');
  r.status = 'pending'; r.note = note?.trim() || r.note; r.requestedAt = new Date().toISOString();
  const j = byId(store.jobs, r.jobId);
  partsStamp(r, `Submitted for approval · ${byId(store.parts, r.partId).partNumber}`);
  jobStamp(j, `Parts request ${r.number} submitted · ${byId(store.parts, r.partId).partNumber}`);
  return resolve(prRefs(r));
}

const learn = (r: PartsRequest, kind: PartsKnowledgeEntry['kind'], extra: Partial<PartsKnowledgeEntry>, detail: string) => {
  const a = actor();
  const p = byId(store.parts, r.partId!);
  store.partsKnowledge.unshift({ id: newId('pk'), kind, partId: p.id, partNumber: p.partNumber, requestId: r.id, detail, at: new Date().toISOString(), by: a.by, station: a.station, ...extra });
};

// Approval = the labeling loop: confirm part↔reference, record the user's own words as aliases
export async function approvePartsRequest(requestId: string, note?: string, placeHoldToo = true): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId);
  const a = actor();
  if (a.user?.accessTier !== 'manager') throw new Error('Parts approval is a supervisor action');
  if (r.status !== 'pending' || !r.partId) throw new Error('Only a pending request with a part can be approved');
  { const pj = getJobRow(r.jobId); const pp = byId(store.parts, r.partId); threadEvent(pj.clientId, { kind: 'job', id: pj.id }, 'parts', a.by, `Parts approved for ${pj.number}: ${pp.partNumber} ${pp.name} (${r.number})`, { kind: 'parts_approved', refId: r.id, label: `Parts · ${r.number}` }); }
  const p = byId(store.parts, r.partId);
  const j = byId(store.jobs, r.jobId);
  const w = byId(store.watches, j.watchId);
  r.status = 'approved'; r.decidedBy = a.by; r.decidedAt = new Date().toISOString(); r.decisionNote = note?.trim() || undefined;
  if (!p.compatibleRefs.includes(w.reference)) p.compatibleRefs.push(w.reference);
  learn(r, 'association_confirmed', { reference: w.reference }, `Approved on ${r.number} — ${p.partNumber} confirmed for ref ${w.reference}`);
  r.searchTerms.map((t) => t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 4 && !p.aliases.includes(t)).forEach((t) => { p.aliases.push(t); learn(r, 'alias_added', { alias: t }, `Search term "${t}" now maps to ${p.partNumber}`); });
  partsStamp(r, `Approved by ${a.by} · ${p.partNumber} ×${r.qty}${r.decisionNote ? ` · ${r.decisionNote}` : ''}`);
  jobStamp(j, `Parts request ${r.number} approved · ${p.partNumber}`);
  if (placeHoldToo && canHold(j)) { const held = await placeHold(j.id, 'parts', `${p.partNumber} ${p.name} ×${r.qty} — ${r.number} approved by ${a.by}`); void held; }
  return resolve(prRefs(r));
}

export async function rejectPartsRequest(requestId: string, reason: string): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId);
  const a = actor();
  if (a.user?.accessTier !== 'manager') throw new Error('Parts approval is a supervisor action');
  if (r.status !== 'pending') throw new Error('Only a pending request can be rejected');
  if (!reason.trim()) throw new Error('A reason is required');
  r.status = 'rejected'; r.decidedBy = a.by; r.decidedAt = new Date().toISOString(); r.decisionNote = reason.trim();
  const j = byId(store.jobs, r.jobId);
  const w = byId(store.watches, j.watchId);
  if (r.partId) learn(r, 'rejected', { reference: w.reference }, `Rejected on ${r.number} — ${byId(store.parts, r.partId).partNumber} for ref ${w.reference}: ${reason.trim()}`);
  partsStamp(r, `Rejected by ${a.by} · ${reason.trim()}`);
  jobStamp(j, `Parts request ${r.number} rejected · ${reason.trim()}`);
  return resolve(prRefs(r));
}

export const partsById = (id: string): Part | undefined => store.parts.find((p) => p.id === id);

// ---- E7 Client 360 — universal identifier search + one bundle per client -------------------

const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');
const clientName = (id: string) => fullNameOf(byId(fx.clients, id));
const fullNameOf = (c: Client) => `${c.firstName} ${c.lastName}`;
const clientPath = (clientId: string | undefined, hitKey: string, fallback: string) => (clientId ? `/clients/${clientId}?hit=${hitKey}` : fallback);

const GROUP_LABEL: Record<IdentifierKind, string> = { client: 'Clients', estimate: 'Estimates', job: 'Jobs', package: 'Packages / SUB#', sales_order: 'Invoices (SO)', watch: 'Watches', request: 'Requests', shipment: 'Shipments', swo: 'Shop work orders' };
const GROUP_ORDER: IdentifierKind[] = ['client', 'watch', 'estimate', 'job', 'swo', 'sales_order', 'package', 'request', 'shipment'];

async function getRequestsMock(): Promise<ServiceRequest[]> { return resolve([...store.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
export async function getRequestsForClient(clientId: string): Promise<ServiceRequest[]> { return resolve(store.requests.filter((r) => r.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }

// Accepts ANY identifier: name, email, phone, estimate #, job #, SUB#, tracking, watch ref / serial, SO #, pickup code, request #
async function resolveIdentifierMock(query: string): Promise<SearchResults> {
  const raw = query.trim();
  const q = raw.toLowerCase();
  const nq = norm(raw);
  const digits = raw.replace(/\D/g, '');
  const estD = estimateDigits(raw);
  const hits: SearchHit[] = [];
  if (!q) return resolve({ query: raw, groups: [], total: 0 });
  const reception = isReceptionMode();

  fx.clients.forEach((c) => {
    const name = fullNameOf(c).toLowerCase();
    const matched = name.includes(q) ? fullNameOf(c) : c.email.toLowerCase().includes(q) ? c.email : c.company?.toLowerCase().includes(q) ? c.company : digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits) ? c.phone : null;
    if (!matched) return;
    const inHouseJobs = store.jobs.filter((j) => j.clientId === c.id && j.simpleStatus === 'on_hand');
    const estimateNumbers = uniq(inHouseJobs.map((j) => (j.estimateId ? store.estimates.find((e) => e.id === j.estimateId)?.number : undefined) ?? j.number));
    hits.push({ kind: 'client', id: c.id, hitKey: 'top', label: fullNameOf(c), detail: [c.company, c.email, c.phone].filter(Boolean).join(' · '), matched, clientId: c.id, clientName: fullNameOf(c), path: `/clients/${c.id}`, inHouse: !reception && inHouseJobs.length ? { estimateNumbers } : undefined });
  });
  // In-house customers float to the top of the client group; everything else keeps its order
  hits.sort((a, b) => Number(!!b.inHouse) - Number(!!a.inHouse));

  if (q.length >= 3) {
    store.watches.forEach((w) => {
      const matched = norm(w.reference).includes(nq) ? w.reference : norm(w.serial).includes(nq) ? w.serial : `${w.brand} ${w.model}`.toLowerCase().includes(q) ? `${w.brand} ${w.model}` : null;
      if (matched) hits.push({ kind: 'watch', id: w.id, hitKey: `watch-${w.id}`, label: `${w.brand} ${w.model}`, detail: `Ref ${w.reference} · S/N ${w.serial} · ${statusLabel(w.status)}`, matched, clientId: w.clientId, clientName: clientName(w.clientId), path: clientPath(w.clientId, `watch-${w.id}`, '/') });
    });
  }

  if (estD.length >= 2 || q.length >= 2) {
    store.estimates.forEach((e) => {
      if ((estD && estimateDigits(e.number).startsWith(estD)) || e.number.toLowerCase() === q) hits.push({ kind: 'estimate', id: e.id, hitKey: `est-${e.id}`, label: `${e.number}${e.revision > 1 ? ` · rev ${e.revision}` : ''}`, detail: `${e.legacy ? 'LEGACY · read-only · ' : ''}${statusLabel(e.status)} · ${moneyLabel(e.total)}`, matched: e.number, clientId: e.clientId, clientName: clientName(e.clientId), path: clientPath(e.clientId, `est-${e.id}`, `/estimates/${e.id}`) });
    });
    store.jobs.forEach((j) => {
      if ((estD && estimateDigits(j.number).startsWith(estD)) || j.number.toLowerCase() === q) {
        const w = byId(store.watches, j.watchId);
        hits.push({ kind: 'job', id: j.id, hitKey: `job-${j.id}`, label: `${j.number} · ${w.brand} ${w.model}`, detail: `${statusLabel(j.status)} · ${j.assignees.join(', ') || 'unassigned'}`, matched: j.number, clientId: j.clientId, clientName: clientName(j.clientId), path: clientPath(j.clientId, `job-${j.id}`, `/jobs/${j.id}`) });
      }
    });
  }

  if (q.length >= 3) {
    store.salesOrders.forEach((o) => {
      const matched = norm(o.number).includes(nq) || (digits.length >= 3 && o.number.replace(/\D/g, '').endsWith(digits)) ? o.number : o.tracking && norm(o.tracking).includes(nq) ? o.tracking : o.pickupCode && norm(o.pickupCode).startsWith(nq) ? `pickup code ${o.pickupCode}` : null;
      if (matched) hits.push({ kind: 'sales_order', id: o.id, hitKey: `so-${o.id}`, label: o.number, detail: `${o.legacy ? 'LEGACY · read-only · ' : ''}${statusLabel(o.status)} · ${moneyLabel(o.total)} · ${o.isPaid ? 'paid' : `balance ${moneyLabel(o.balanceDue)}`}`, matched, clientId: o.clientId, clientName: clientName(o.clientId), path: clientPath(o.clientId, `so-${o.id}`, `/sales/${o.id}`) });
    });
    store.packages.forEach((p) => {
      const matched = norm(p.subNumber).includes(nq) || (digits.length >= 3 && p.subNumber.replace(/\D/g, '').endsWith(digits)) ? p.subNumber : p.trackingNumber && norm(p.trackingNumber).includes(nq) ? p.trackingNumber : null;
      if (matched) hits.push({ kind: 'package', id: p.id, hitKey: `pkg-${p.id}`, label: p.subNumber, detail: `${statusLabel(p.status)} · ${p.carrier}${p.trackingNumber ? ` ${p.trackingNumber}` : ''}`, matched, clientId: p.clientId, clientName: p.clientId ? clientName(p.clientId) : 'Unknown client', path: clientPath(p.clientId, `pkg-${p.id}`, `/intake/receive/${p.id}`) });
    });
    store.requests.forEach((r) => {
      if (norm(r.number).includes(nq)) hits.push({ kind: 'request', id: r.id, hitKey: `req-${r.id}`, label: r.number, detail: `${statusLabel(r.status)} · ${r.source}`, matched: r.number, clientId: r.clientId, clientName: clientName(r.clientId), path: clientPath(r.clientId, `req-${r.id}`, '/') });
    });
  }

  shp.rows.forEach((sh) => { const e = byId(store.estimates, sh.estimateId); const name = clientName(sh.clientId); const tn = sh.trackingNumber ?? '';
    if ((tn && norm(tn).includes(nq) && nq.length >= 4) || (estD && estimateDigits(e.number).startsWith(estD)) || name.toLowerCase().includes(q)) hits.push({ kind: 'shipment', id: sh.id, hitKey: `ship-${sh.id}`, label: `${sh.direction === 'inbound' ? 'Inbound' : 'Outbound'} · ${e.number}`, detail: `${sh.carrier} · ${SHIP_STAGE_LABEL[sh.stage]}${tn ? ` · ${tn}` : ''}`, matched: tn && norm(tn).includes(nq) ? tn : e.number, clientId: sh.clientId, clientName: name, path: `/shipping/inbound?track=${sh.id}` }); });
  // SWO hubs: `SWO1004` (the barcode), `1004`, or a vendor name — the scanner router treats SWO1xxx as a format
  const swoQ = raw.trim().toLowerCase().replace(/[\s-]/g, ''); if (/^swo\d*$/.test(swoQ) || /^\d{3,4}$/.test(swoQ) || q.length >= 3) { seedSwo(); hubs.forEach((h) => { const hv = hubViewSync(h); const num = h.number.toLowerCase(); const m = num === swoQ || (swoQ.startsWith('swo') && swoQ.length > 3 && num.startsWith(swoQ)) || (/^\d+$/.test(swoQ) && num.slice(3).startsWith(swoQ)) || (q.length >= 3 && hv.vendor.name.toLowerCase().includes(q) && hv.stage !== 'fulfilled'); if (m) hits.push({ kind: 'swo', id: h.id, hitKey: `swo-${h.id}`, label: `${h.number} · ${hv.vendor.name}`, detail: `${swoStageLabel(hv.stage)} · ${hv.total} line${hv.total === 1 ? '' : 's'} · ${hv.back} back · point person ${h.pointPerson}`, matched: h.number, clientName: hv.vendor.name, path: `/swo/${h.id}` }); }); }
  const groups: SearchGroup[] = GROUP_ORDER.map((kind) => ({ kind, label: GROUP_LABEL[kind], hits: hits.filter((h) => h.kind === kind).slice(0, 6) })).filter((g) => g.hits.length > 0);
  return resolve({ query: raw, groups, total: groups.reduce((n, g) => n + g.hits.length, 0) });
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');
const moneyLabel = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const custodyOf = (clientId: string): CustodyEvent[] => {
  const out: CustodyEvent[] = [];
  const watchLabel = (id?: string) => { const w = id ? store.watches.find((x) => x.id === id) : undefined; return w ? `${w.brand} ${w.model}` : 'watch'; };
  store.packages.filter((p) => p.clientId === clientId).forEach((p) => {
    out.push({ id: `cu-${p.id}-arr`, kind: 'package_arrived', at: p.arrivedAt, by: p.arrivedBy, station: p.arrivedStation, detail: `${p.subNumber} arrived · ${p.carrier}${p.trackingNumber ? ` ${p.trackingNumber}` : ''}${p.signatureNoted ? ' · signed' : ''}`, packageId: p.id, hitKey: `pkg-${p.id}`, path: `/intake/receive/${p.id}` });
    (p.scans ?? []).forEach((s) => out.push({ id: `cu-${s.id}`, kind: s.kind === 'arrival' ? 'arrival_scan' : s.kind === 'open' ? 'open_scan' : 'shelved', at: s.at, by: s.by, station: s.station, detail: `${p.subNumber} · ${s.kind === 'arrival' ? `Scan 1 · arrival${s.trackingNumber ? ` · ${s.trackingNumber}` : ''} · ${s.matched === 'label_request' ? 'matched label request' : s.matched === 'manual' ? 'assigned by hand' : 'no match'}` : s.kind === 'open' ? `Scan 2 · opened from ${s.shelfBin ?? 'shelf'} → Stage 2` : `shelved in ${s.shelfBin}`}${s.note ? ` · ${s.note}` : ''}`, packageId: p.id, hitKey: `pkg-${p.id}`, path: `/intake/receive/${p.id}` }));
    const job = store.jobs.find((j) => j.packageId === p.id);
    if (p.inspectedAt && p.status === 'received') out.push({ id: `cu-${p.id}-rcv`, kind: 'watch_received', at: p.inspectedAt, by: p.inspectedBy ?? 'Unknown', station: 'Front Desk 1', detail: `${watchLabel(job?.watchId)} received into custody from ${p.subNumber}`, packageId: p.id, jobId: job?.id, watchId: job?.watchId, hitKey: job ? `job-${job.id}` : `pkg-${p.id}`, path: job ? `/jobs/${job.id}` : `/intake/receive/${p.id}` });
    if (p.status === 'discrepancy_hold' && p.inspectedAt) out.push({ id: `cu-${p.id}-dis`, kind: 'discrepancy', at: p.inspectedAt, by: p.inspectedBy ?? 'Unknown', station: 'Front Desk 1', detail: `Discrepancy hold on ${p.subNumber}: ${p.discrepancyReason ?? ''}`, packageId: p.id, hitKey: `pkg-${p.id}`, path: `/intake/inspection/${p.id}` });
  });
  store.jobs.filter((j) => j.clientId === clientId).forEach((j) => {
    const scanIn = isTradeJob(j) ? j.timeline.find((t) => t.action === 'trade_scan_in') : undefined;
    if (scanIn) out.push({ id: `cu-${j.id}-tsi`, kind: 'watch_received', at: scanIn.at, by: scanIn.by, station: scanIn.station, detail: `${watchLabel(j.watchId)} scanned in — trade job ${j.number} (no inspection report, no estimate)`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
    else if (!j.packageId && j.intakeDate) out.push({ id: `cu-${j.id}-in`, kind: 'watch_received', at: j.intakeDate, by: j.timeline[0]?.by ?? j.createdBy, station: j.timeline[0]?.station ?? 'Front Desk 1', detail: `${watchLabel(j.watchId)} received on hand · ${j.number}`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
    j.holds.forEach((h) => {
      out.push({ id: `cu-${h.id}-p`, kind: 'hold_placed', at: h.placedAt, by: h.placedBy, station: h.station, detail: `${h.type === 'outsource' ? 'Left the building — outsource' : 'Parts hold'} on ${j.number}: ${h.reason}`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
      if (h.releasedAt) out.push({ id: `cu-${h.id}-r`, kind: 'hold_released', at: h.releasedAt, by: h.releasedBy ?? 'Unknown', station: h.station, detail: `Hold released on ${j.number}${h.releaseNote ? ` · ${h.releaseNote}` : ''}`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
    });
  });
  store.salesOrders.filter((o) => o.clientId === clientId).forEach((o) => {
    const job = o.jobId ? store.jobs.find((j) => j.id === o.jobId) : undefined;
    if (o.shipment) out.push({ id: `cu-${o.id}-ship`, kind: 'shipped', at: o.shipment.at, by: o.shipment.by, station: o.shipment.station, detail: `${watchLabel(job?.watchId)} shipped · ${o.shipment.service} · ${o.shipment.tracking}`, salesOrderId: o.id, jobId: job?.id, watchId: job?.watchId, hitKey: `so-${o.id}`, path: `/sales/${o.id}` });
    if (o.pickupSession) out.push({ id: `cu-${o.id}-pu`, kind: 'picked_up', at: o.pickupSession.at, by: o.pickupSession.by, station: o.pickupSession.station, detail: `${watchLabel(job?.watchId)} · ${pickupSummaryLine(o.pickupSession, clientName(o.clientId))}`, salesOrderId: o.id, jobId: job?.id, watchId: job?.watchId, hitKey: `so-${o.id}`, path: `/sales/${o.id}` });
  });
  return out.sort((a, b) => b.at.localeCompare(a.at));
};

const isActiveJob = (j: Job) => j.status !== 'closed' && j.simpleStatus !== 'estimate';

export async function getClient360(clientId: string): Promise<Client360 | null> {
  const client = fx.clients.find((c) => c.id === clientId);
  if (!client) return resolve(null);
  const newest = <T>(rows: T[], key: (r: T) => string) => [...rows].sort((a, b) => key(b).localeCompare(key(a)));
  const estimates = newest(store.estimates.filter((e) => e.clientId === clientId).map(withRefs), (e) => e.createdAt);
  const jobs = newest(store.jobs.filter((j) => j.clientId === clientId).map(jobRefs), (j) => j.createdAt);
  const salesOrders = newest(store.salesOrders.filter((o) => o.clientId === clientId).map(soRefs), (o) => o.orderDate);
  const requests = newest(store.requests.filter((r) => r.clientId === clientId), (r) => r.createdAt);
  const tasks = newest(store.tasks.filter((t) => t.clientId === clientId || jobs.some((j) => j.id === t.jobId)), (t) => t.createdAt);
  const packages = newest(store.packages.filter((p) => p.clientId === clientId).map(pkgWithRefs), (p) => p.arrivedAt);
  const emails = newest(store.outbox.filter((e) => e.to.toLowerCase() === client.email.toLowerCase()), (e) => e.createdAt);
  const payments = newest(salesOrders.flatMap((o) => o.payments.map((p) => ({ ...p, salesOrderId: o.id, salesOrderNumber: o.number }))), (p) => p.at);
  const notes: ClientNoteRow[] = newest([
    ...jobs.flatMap((j) => j.notes.map((n): ClientNoteRow => ({ ...n, source: 'job', ref: j.number, path: `/jobs/${j.id}` }))),
    ...estimates.filter((e) => e.internalNotes.trim()).map((e): ClientNoteRow => ({ id: `en-${e.id}`, source: 'estimate', ref: e.number, text: e.internalNotes, at: e.updatedAt, by: e.createdBy, station: 'Front Desk 1', path: `/estimates/${e.id}` })),
  ], (n) => n.at);

  const watches: WatchGroup[] = newest(store.watches.filter((w) => w.clientId === clientId), (w) => w.receivedAt).map((watch) => {
    const history: WatchHistoryRow[] = [
      ...estimates.filter((e) => e.watchId === watch.id).map((e): WatchHistoryRow => ({ kind: 'estimate', legacy: !!e.legacy, id: e.id, hitKey: `est-${e.id}`, number: e.number + (e.revision > 1 ? ` r${e.revision}` : ''), status: e.status, title: e.lines[0]?.description ?? 'Estimate', amount: e.total, at: e.createdAt, path: `/estimates/${e.id}` })),
      ...jobs.filter((j) => j.watchId === watch.id).map((j): WatchHistoryRow => ({ kind: 'job', id: j.id, hitKey: `job-${j.id}`, number: j.number, status: j.status, title: `${j.workflow.join('·')} · ${j.lines[0]?.description ?? 'Job'}`, amount: j.total, at: j.createdAt, path: `/jobs/${j.id}` })),
      ...salesOrders.filter((o) => o.job?.watchId === watch.id).map((o): WatchHistoryRow => ({ kind: 'sales_order', legacy: !!o.legacy, id: o.id, hitKey: `so-${o.id}`, number: o.number, status: o.isPaid ? 'paid' : 'unpaid', title: `Invoice · ${o.status.replace(/_/g, ' ')}`, amount: o.total, at: o.orderDate, path: `/sales/${o.id}` })),
      ...requests.filter((r) => r.watchId === watch.id).map((r): WatchHistoryRow => ({ kind: 'request', id: r.id, hitKey: `req-${r.id}`, number: r.number, status: r.status, title: r.summary, at: r.createdAt, path: `/clients/${clientId}?hit=req-${r.id}` })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const paidHere = salesOrders.filter((o) => o.job?.watchId === watch.id).reduce((t, o) => t + o.payments.reduce((a, p) => a + p.amount, 0), 0);
    const closed = jobs.filter((j) => j.watchId === watch.id && j.finishedAt);
    return { watch, history, lifetimeSpend: paidHere, lastServiceAt: closed[0]?.finishedAt, activeJobId: jobs.find((j) => j.watchId === watch.id && isActiveJob(j))?.id };
  });

  const lastContactAt = [emails[0]?.createdAt, requests[0]?.createdAt, notes[0]?.at].filter((x): x is string => !!x).sort().reverse()[0];
  const summary = {
    watchCount: watches.length,
    inHouse: watches.filter((g) => g.watch.status !== 'released' && g.watch.status !== 'expected').length,
    openBalance: salesOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'draft').reduce((t, o) => t + o.balanceDue, 0),
    lifetimeSpend: payments.reduce((t, p) => t + p.amount, 0),
    openEstimates: estimates.filter((e) => e.status === 'draft' || e.status === 'sent' || e.status === 'approved').length,
    activeJobs: jobs.filter(isActiveJob).length,
    openRequests: requests.filter((r) => r.status === 'new' || r.status === 'quoted').length,
    openTasks: tasks.filter((t) => t.status === 'open').length,
    lastContactAt,
  };
  return resolve({ client, summary, watches, requests, estimates, jobs, salesOrders, payments, notes, tasks, custody: custodyOf(clientId), emails, packages });
}

export async function getClientDirectory(): Promise<ClientDirectoryRow[]> {
  const rows = fx.clients.map((client): ClientDirectoryRow => {
    const ws = store.watches.filter((w) => w.clientId === client.id);
    const js = store.jobs.filter((j) => j.clientId === client.id);
    const es = store.estimates.filter((e) => e.clientId === client.id);
    const os = store.salesOrders.filter((o) => o.clientId === client.id && o.status !== 'cancelled' && o.status !== 'draft');
    const last = [...js.map((j) => j.createdAt), ...es.map((e) => e.updatedAt), ...os.map((o) => o.orderDate)].sort().reverse()[0];
    return { client, watchCount: ws.length, inHouse: ws.filter((w) => w.status !== 'released' && w.status !== 'expected').length, openEstimates: es.filter((e) => e.status === 'draft' || e.status === 'sent' || e.status === 'approved').length, activeJobs: js.filter(isActiveJob).length, openBalance: os.reduce((t, o) => t + o.balanceDue, 0), lastActivityAt: last };
  });
  return resolve(rows.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '')));
}

// ---- E8 RolliConnect — client portal. Same store, client-scoped reads, a handful of client-initiated writes ----

const portalStamp = (clientId: string, detail: string) => {
  const c = byId(fx.clients, clientId);
  appendAudit({ type: 'portal', stationName: 'RolliConnect', userShortName: `${c.firstName} ${c.lastName}`, userDisplayName: `${c.firstName} ${c.lastName} (client)`, detail });
};

// Runs a store mutation as the client: every stamp inside reads actor() = client / RolliConnect
const asClient = <T>(clientId: string, fn: () => Promise<T>): Promise<T> => {
  const c = byId(fx.clients, clientId);
  portalActor = { by: `${c.firstName} ${c.lastName} (client)`, station: 'RolliConnect' };
  try {
    return fn();
  } finally {
    portalActor = null;
  }
};

// Persisted log of client-initiated writes so a staff tab / reload sees portal actions (store itself is in-memory)
type RcEvent =
  | { t: 'approve'; clientId: string; id: string }
  | { t: 'decline'; clientId: string; id: string; reason: string }
  | { t: 'pay'; clientId: string; id: string }
  | { t: 'pickup'; clientId: string; id: string; date: string; slot: PickupWindow['slot']; note?: string }
  | { t: 'ship'; clientId: string; id: string; address: Address; phone: string }
  | { t: 'msg'; clientId: string; text: string; watchId?: string }
  | { t: 'reply'; clientId: string; text: string; watchId?: string; by: string }
  | { t: 'read'; clientId: string; side: 'client' | 'staff' }
  | { t: 'closereq'; clientId: string; id: string; reason: RequestCloseReason; duplicateOfId?: string };
const recordRcEvent = (ev: RcEvent) => { if (!replaying) writeJson(KEYS.rcEvents, [...readJson<RcEvent[]>(KEYS.rcEvents, []), ev]); };
export function replayRcEvents(): number {
  const events = readJson<RcEvent[]>(KEYS.rcEvents, []);
  replaying = true;
  try {
    events.forEach((ev) => {
      try {
        if (ev.t === 'approve') void portalApproveEstimate(ev.clientId, ev.id);
        else if (ev.t === 'decline') void portalDeclineEstimate(ev.clientId, ev.id, ev.reason);
        else if (ev.t === 'pay') void portalPayBalance(ev.clientId, ev.id);
        else if (ev.t === 'pickup') void portalConfirmPickupWindow(ev.clientId, ev.id, ev.date, ev.slot, ev.note);
        else if (ev.t === 'ship') void portalSubmitShippingInfo(ev.clientId, ev.id, ev.address, ev.phone);
        else if (ev.t === 'msg') void portalSendMessage(ev.clientId, ev.text, ev.watchId);
        else if (ev.t === 'reply') void replyToClient(ev.clientId, ev.text, ev.watchId, ev.by);
        else if (ev.t === 'read') void (ev.side === 'client' ? portalGetMessages(ev.clientId) : markThreadRead(ev.clientId));
        else if (ev.t === 'closereq') void portalCloseRequest(ev.clientId, ev.id, ev.reason, ev.duplicateOfId);
      } catch { /* stale event against reset fixtures — ignore */ }
    });
  } finally {
    replaying = false;
  }
  return events.length;
}
export async function resetRcEvents(): Promise<void> { localStorage.removeItem(KEYS.rcEvents); return resolve(undefined); }

const portalSessionSync = (): PortalSession | null => readJson<PortalSession | null>(KEYS.portalSession, null);
const requireOwner = <T extends { clientId: string }>(clientId: string, row: T | undefined, what: string): T => {
  if (!row || row.clientId !== clientId) throw new Error(`That ${what} isn’t on your account`);
  return row;
};

export async function portalRequestMagicLink(email: string): Promise<{ link: MagicLink; path: string }> {
  const c = fx.clients.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!c) throw new Error('We couldn’t find an account for that email');
  const link: MagicLink = { token: `${c.id}-${Math.random().toString(36).slice(2, 10)}`, clientId: c.id, email: c.email, createdAt: new Date().toISOString() };
  store.magicLinks.unshift(link);
  writeJson(KEYS.rcLinks, store.magicLinks.slice(0, 20));
  const path = `/rc/auth/${link.token}`;
  queueOutbox({ id: `ob-${Date.now().toString(36)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: 'RolliConnect sign-in', status: 'pending', subject: 'Your RolliConnect sign-in link', body: `Hello ${c.firstName},\n\nTap the link below to open RolliConnect. It expires in 15 minutes.\n\n${path}\n\nIf you didn’t ask for this, you can ignore it.\n\n— RolliSuite`, createdAt: new Date().toISOString(), createdBy: 'RolliConnect', station: 'RolliConnect' });
  portalStamp(c.id, 'Magic link requested · email recorded in Sent (stub)');
  return resolve({ link, path });
}

// Deep link: magic-link token that lands inside the portal on one page (Q43: unguessable; revoke = banner, never a dead page)
// Magic links retired (2026-09-28): emailed links now point at the login wall, which sends the client on to the document after password + TOTP
export const portalDeepLink = (_clientId: string, next: string): string => `/rc?next=${encodeURIComponent(next)}`;

// ---- RolliConnect accounts — PASSWORDLESS (MH ruling 2026-10-01): email one-time code / magic link · Touch ID once enrolled · fresh step-up for sensitive actions ----
// Password + TOTP + backup codes (D-357, 2026-09-28) are RETIRED: clients never hold a password. Same email = same person — the first verified code creates the account and attaches it to the client on file.
export interface RcAccount { clientId: string; email: string; createdAt: string; lastLoginAt?: string; signIns: number; touchIdEnrolledAt?: string }
export interface RcChallenge { id: string; clientId: string; email: string; otp: string; linkToken: string; purpose: 'signin' | 'stepup'; action?: string; next?: string; createdAt: string; expiresAt: string; attempts: number; usedAt?: string; via?: 'code' | 'link' }
export interface RcStepUpGrant { clientId: string; action: string; at: string; expiresAt: string; via: 'code' | 'touch_id'; usedAt?: string }
export const RC_OTP_TTL_MS = 10 * 60_000; export const RC_OTP_MAX_ATTEMPTS = 5; export const RC_RESEND_COOLDOWN_MS = 60_000; export const RC_REQUESTS_PER_15M = 3; export const RC_STEPUP_TTL_MS = 5 * 60_000;
const RC_KEYS = { accounts: 'rollisuite.rc.accounts.v2', challenges: 'rollisuite.rc.challenges', stepups: 'rollisuite.rc.stepups', docAccess: 'rollisuite.rc.docAccess', photoUnlocked: 'rollisuite.rc.photoUnlocked', links: 'rollisuite.rc.links' };
const rcAccounts = (): RcAccount[] => { let a = readJson<RcAccount[]>(RC_KEYS.accounts, []); if (!a.length) { const c = fx.clients.find((x) => x.email === 'eleanor.vance@example.com')!; a = [{ clientId: c.id, email: c.email, createdAt: daysAgoIso(41), lastLoginAt: daysAgoIso(3), signIns: 9 }]; writeJson(RC_KEYS.accounts, a); } return a; };
const daysAgoIso = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const saveAccounts = (a: RcAccount[]) => writeJson(RC_KEYS.accounts, a);
const rcChallenges = () => readJson<RcChallenge[]>(RC_KEYS.challenges, []);
const saveChallenges = (v: RcChallenge[]) => writeJson(RC_KEYS.challenges, v.filter((c) => new Date(c.expiresAt).getTime() > Date.now() - 86_400_000).slice(-200));
const rcStepUps = () => readJson<RcStepUpGrant[]>(RC_KEYS.stepups, []);
const saveStepUps = (v: RcStepUpGrant[]) => writeJson(RC_KEYS.stepups, v.slice(-100));
const rcNormEmail = (e: string) => e.trim().toLowerCase();
const maskEmail = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 2)}…@${d}`; };
const clientByEmail = (email: string) => fx.clients.find((x) => rcNormEmail(x.email) === rcNormEmail(email));
const rcAccountByEmail = (email: string) => rcAccounts().find((a) => rcNormEmail(a.email) === rcNormEmail(email));
export const clientIdByEmailSync = (email: string): string | undefined => clientByEmail(email)?.id;
export async function rcLookup(email: string): Promise<{ clientOnFile: boolean; hasAccount: boolean; firstName?: string; touchIdEnrolled: boolean }> {
  const c = clientByEmail(email); const a = rcAccountByEmail(email);
  return resolve({ clientOnFile: !!c, hasAccount: !!a, firstName: c?.firstName, touchIdEnrolled: !!a?.touchIdEnrolledAt });
}
// One request = one challenge carrying BOTH a 6-digit code and a single-use magic link (separate secrets); 10 min; 5 attempts; 60 s resend cooldown; 3 per 15 min
export async function rcRequestCode(email: string, opts: { next?: string; purpose?: 'signin' | 'stepup'; action?: string } = {}): Promise<{ challengeId: string; maskedEmail: string; expiresAt: string; purpose: 'signin' | 'stepup' }> {
  const c = clientByEmail(email); if (!c) throw new Error('We don’t have that email on file. Use the address the workshop contacts you at, or message us — accounts are created for clients on file.');
  const purpose = opts.purpose ?? 'signin'; const all = rcChallenges(); const now = Date.now(); const mine = all.filter((x) => x.clientId === c.id && x.purpose === purpose);
  const last = mine[mine.length - 1]; if (last && now - new Date(last.createdAt).getTime() < RC_RESEND_COOLDOWN_MS) throw new Error(`We just sent one — wait ${Math.ceil((RC_RESEND_COOLDOWN_MS - (now - new Date(last.createdAt).getTime())) / 1000)} s before asking again`);
  if (mine.filter((x) => now - new Date(x.createdAt).getTime() < 15 * 60_000).length >= RC_REQUESTS_PER_15M) throw new Error('Too many codes requested — try again in a few minutes, or use the link in the last email');
  const ch: RcChallenge = { id: `rcc-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, clientId: c.id, email: c.email, otp: String(Math.floor(100000 + Math.random() * 900000)), linkToken: `rcm-${now.toString(36)}${Math.random().toString(36).slice(2, 12)}`, purpose, action: opts.action, next: opts.next, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + RC_OTP_TTL_MS).toISOString(), attempts: 0 };
  saveChallenges([...all, ch]);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const magic = `${origin}/rc/auth/${ch.linkToken}${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''}`;
  const body = purpose === 'stepup'
    ? `Hello ${c.firstName},\n\nYour confirmation code is ${ch.otp}. Enter it to confirm: ${opts.action?.replace(/:.*$/, '').replace(/-/g, ' ')}.\n\nIt works once and expires in 10 minutes. If you didn’t ask for this, ignore this email — nothing happens without the code.`
    : `Hello ${c.firstName},\n\nYour RolliConnect sign-in code is ${ch.otp}.\n\nOr tap this link to sign in on this device: ${magic}\n\nBoth work once and expire in 10 minutes. We never ask for a password — if an email asks you for one, it isn’t us.`;
  queueOutbox({ id: `ob-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`, to: c.email, toName: fullNameOf(c), relatedRef: purpose === 'stepup' ? `RolliConnect · confirm ${opts.action ?? ''}` : 'RolliConnect sign-in', status: 'pending', subject: purpose === 'stepup' ? `Your confirmation code: ${ch.otp}` : `Your RolliConnect sign-in code: ${ch.otp}`, body, createdAt: ch.createdAt, createdBy: 'RolliConnect', station: 'portal' });
  portalStamp(c.id, purpose === 'stepup' ? `Step-up code emailed · ${opts.action}` : `Sign-in code + link emailed (${maskEmail(c.email)})`);
  return resolve({ challengeId: ch.id, maskedEmail: maskEmail(c.email), expiresAt: ch.expiresAt, purpose });
}
const rcOpenSession = (clientId: string, how: string) => {
  const all = rcAccounts(); let a = all.find((x) => x.clientId === clientId); const c = byId(fx.clients, clientId); const now = new Date().toISOString(); let created = false;
  if (!a) { a = { clientId, email: c.email, createdAt: now, signIns: 0 }; all.push(a); created = true; }
  a.lastLoginAt = now; a.signIns += 1; saveAccounts(all);
  const sess: PortalSession = { clientId, email: c.email, token: `acct-${newId('rc')}`, issuedAt: now }; writeJson(KEYS.portalSession, sess);
  portalStamp(clientId, `${created ? 'RolliConnect account created · ' : ''}Signed in · ${how}`);
  return { client: c, created };
};
const consumeChallenge = (ch: RcChallenge | undefined, via: 'code' | 'link', code?: string) => {
  if (!ch) throw new Error(via === 'link' ? 'This link has expired — sign in to see your watch.' : 'That code didn’t match. Check the newest email and try again.');
  const all = rcChallenges(); const row = all.find((x) => x.id === ch.id)!;
  if (row.usedAt) throw new Error(via === 'link' ? 'This link was already used — request a new one.' : 'That code was already used — request a new one.');
  if (new Date(row.expiresAt).getTime() < Date.now()) throw new Error(via === 'link' ? 'This link has expired — sign in to see your watch.' : 'That code expired — request a new one.');
  if (via === 'code') { if (row.attempts >= RC_OTP_MAX_ATTEMPTS) throw new Error('Too many wrong tries — request a new code.'); if (row.otp !== (code ?? '').replace(/\D/g, '')) { row.attempts += 1; saveChallenges(all); portalStamp(row.clientId, `Code didn’t match (${row.attempts}/${RC_OTP_MAX_ATTEMPTS})`); throw new Error(row.attempts >= RC_OTP_MAX_ATTEMPTS ? 'Too many wrong tries — request a new code.' : 'That code didn’t match. Check the newest email and try again.'); } }
  row.usedAt = new Date().toISOString(); row.via = via; saveChallenges(all); return row;
};
const grantStepUp = (clientId: string, action: string, via: RcStepUpGrant['via']) => { const now = Date.now(); saveStepUps([...rcStepUps().filter((g) => !(g.clientId === clientId && g.action === action)), { clientId, action, at: new Date(now).toISOString(), expiresAt: new Date(now + RC_STEPUP_TTL_MS).toISOString(), via }]); portalStamp(clientId, `Verified for ${action} · ${via === 'touch_id' ? 'Touch ID' : 'emailed code'}`); };
export interface RcVerifyResult { purpose: 'signin' | 'stepup'; client: Client; created?: boolean; next?: string; action?: string }
export async function rcVerifyCode(challengeId: string, code: string): Promise<RcVerifyResult> {
  const ch = consumeChallenge(rcChallenges().find((x) => x.id === challengeId), 'code', code);
  if (ch.purpose === 'stepup') { grantStepUp(ch.clientId, ch.action!, 'code'); return resolve({ purpose: 'stepup', client: byId(fx.clients, ch.clientId), action: ch.action }); }
  const s = rcOpenSession(ch.clientId, 'emailed code'); return resolve({ purpose: 'signin', client: s.client, created: s.created, next: ch.next });
}
export async function rcVerifyMagicLink(linkToken: string): Promise<RcVerifyResult> {
  const ch = consumeChallenge(rcChallenges().find((x) => x.linkToken === linkToken), 'link');
  if (ch.purpose === 'stepup') { grantStepUp(ch.clientId, ch.action!, 'code'); return resolve({ purpose: 'stepup', client: byId(fx.clients, ch.clientId), action: ch.action }); }
  const s = rcOpenSession(ch.clientId, 'magic link'); return resolve({ purpose: 'signin', client: s.client, created: s.created, next: ch.next });
}
// Touch ID — the browser ceremony lives in api/webauthn.ts (platform authenticator, userVerification required); the account only records enrolment
export async function rcSignInWithTouchId(email: string): Promise<Client> { const a = rcAccountByEmail(email); if (!a?.touchIdEnrolledAt) throw new Error('Touch ID isn’t set up for this account on this device'); return resolve(rcOpenSession(a.clientId, 'Touch ID').client); }
export async function rcMarkTouchIdEnrolled(clientId: string, on: boolean): Promise<RcAccount> { const all = rcAccounts(); const a = all.find((x) => x.clientId === clientId); if (!a) throw new Error('No account'); a.touchIdEnrolledAt = on ? new Date().toISOString() : undefined; saveAccounts(all); portalStamp(clientId, on ? 'Touch ID enrolled on this device' : 'Touch ID removed'); return resolve(a); }
export async function rcStepUpWithTouchId(clientId: string, action: string): Promise<void> { const a = rcAccounts().find((x) => x.clientId === clientId); if (!a?.touchIdEnrolledAt) throw new Error('Touch ID isn’t set up'); grantStepUp(clientId, action, 'touch_id'); return resolve(undefined); }
export async function rcStepUpStatus(clientId: string, action: string): Promise<{ fresh: boolean; via?: RcStepUpGrant['via']; expiresAt?: string }> { const g = rcStepUps().find((x) => x.clientId === clientId && x.action === action && !x.usedAt && new Date(x.expiresAt).getTime() > Date.now()); return resolve({ fresh: !!g, via: g?.via, expiresAt: g?.expiresAt }); }
// Enforced where the money action is committed: a fresh (≤5 min), unused grant bound to THIS action, consumed on success. Replays of recorded events skip it.
const requireStepUp = (clientId: string, action: string) => {
  if (replaying) return;
  const all = rcStepUps(); const g = all.find((x) => x.clientId === clientId && x.action === action && !x.usedAt && new Date(x.expiresAt).getTime() > Date.now());
  if (!g) throw new Error('Confirm it’s you first — this needs a fresh emailed code or Touch ID.');
  g.usedAt = new Date().toISOString(); saveStepUps(all);
};
// Dev build only: the staff "Sent" page shows the real email; this shortcut fills the code so flows stay testable headless
export async function rcDevPeekCode(challengeId: string): Promise<{ otp: string; magicPath: string }> { if (!import.meta.env.DEV) throw new Error('Not available'); const ch = rcChallenges().find((x) => x.id === challengeId); if (!ch) throw new Error('No challenge'); return resolve({ otp: ch.otp, magicPath: `/rc/auth/${ch.linkToken}${ch.next ? `?next=${encodeURIComponent(ch.next)}` : ''}` }); }
export async function rcGetAccount(clientId: string): Promise<RcAccount | null> { return resolve(rcAccounts().find((x) => x.clientId === clientId) ?? null); }
export async function rcListAccounts(): Promise<(RcAccount & { clientName: string })[]> { return resolve(rcAccounts().map((a) => ({ ...a, clientName: fullNameOf(byId(fx.clients, a.clientId)) }))); }
export async function rcResetAccount(clientId: string): Promise<void> { managerOnly(); saveAccounts(rcAccounts().filter((a) => a.clientId !== clientId)); saveStepUps(rcStepUps().filter((g) => g.clientId !== clientId)); const s = portalSessionSync(); if (s?.clientId === clientId) localStorage.removeItem(KEYS.portalSession); const a = actor(); appendAudit({ type: 'settings', stationName: a.station, userShortName: a.user?.shortName, detail: `RolliConnect account reset · ${fullNameOf(byId(fx.clients, clientId))} · next sign-in code recreates it` }); portalStamp(clientId, `RolliConnect account reset by ${a.by}`); return resolve(undefined); }

// ---- LINK tier (MH ruling 2026-10-01): a signed, scoped, expiring token opens ONE object for ONE purpose without sign-in. Every send is logged; revoke = "this link has expired — sign in to see your watch." ----
export type ClientLinkType = 'estimate' | 'parts' | 'invoice' | 'report' | 'pickup' | 'track';
export interface ClientLink { token: string; type: ClientLinkType; objectId: string; clientId: string; email: string; issuedAt: string; expiresAt?: string; revokedAt?: string; revokedBy?: string; sends: { at: string; by: string; channel: 'email' | 'sms' }[]; opens: number; lastOpenedAt?: string }
export const LINK_EXPIRY: Record<ClientLinkType, string> = { estimate: 'until decided · re-sent on nudge', parts: 'until decided · re-sent on nudge', invoice: 'life of the invoice', report: '90 days · re-sendable', pickup: '2 minutes · single use', track: 'delivery + 30 days' };
export const LINK_EXPIRED_COPY = 'This link has expired — sign in to see your watch.';
const clientLinks = () => readJson<ClientLink[]>(RC_KEYS.links, []);
const saveClientLinks = (v: ClientLink[]) => writeJson(RC_KEYS.links, v);
export const clientLinkPath = (l: ClientLink) => (l.type === 'estimate' ? `/rc/estimates/${l.objectId}?t=${l.token}` : l.type === 'parts' ? `/rc/parts/${l.objectId}?t=${l.token}` : l.type === 'invoice' ? `/rc/invoices/${l.objectId}?t=${l.token}` : `/rc/${l.type}/${l.token}`);
// Issue (or re-send) the one active link for an object — the Sent page gets a row per send
const issueClientLink = (type: ClientLinkType, objectId: string, clientId: string, channel: 'email' | 'sms' = 'email'): ClientLink => {
  const a = actor(); const now = new Date().toISOString(); const all = clientLinks(); const c = byId(fx.clients, clientId);
  let l = all.find((x) => x.type === type && x.objectId === objectId && !x.revokedAt && (!x.expiresAt || new Date(x.expiresAt).getTime() > Date.now()));
  if (!l) { l = { token: `lnk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`, type, objectId, clientId, email: c.email, issuedAt: now, sends: [], opens: 0 }; all.push(l); }
  l.sends.push({ at: now, by: a.by, channel }); saveClientLinks(all); return l;
};
export async function getClientLinks(objectId: string): Promise<ClientLink[]> { return resolve(clientLinks().filter((l) => l.objectId === objectId)); }
export async function sendClientLink(type: ClientLinkType, objectId: string): Promise<ClientLink> {
  const l = type === 'estimate' ? issueClientLink(type, objectId, byId(store.estimates, objectId).clientId) : type === 'parts' ? issueClientLink(type, objectId, getJobRow(byId(store.partsRequests, objectId).jobId).clientId) : issueClientLink(type, objectId, getSO(objectId).clientId);
  const c = byId(fx.clients, l.clientId); const a = actor(); const origin = typeof window !== 'undefined' ? window.location.origin : '';
  queueOutbox({ id: `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, to: c.email, toName: fullNameOf(c), relatedRef: `${type} link · ${objectId}`, status: 'pending', subject: `Your ${type === 'parts' ? 'parts approval' : type} link`, body: `Hello ${c.firstName},\n\nHere is your link again — it opens this ${type === 'parts' ? 'parts approval' : type} only:\n\n${origin}${clientLinkPath(l)}\n\nExpiry: ${LINK_EXPIRY[type]}. Sign in to RolliConnect to see everything in one place.`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station });
  return resolve(l);
}
export async function revokeClientLink(token: string): Promise<ClientLink> { managerOnly(); const all = clientLinks(); const l = all.find((x) => x.token === token); if (!l) throw new Error('No such link'); const a = actor(); l.revokedAt = new Date().toISOString(); l.revokedBy = a.by; saveClientLinks(all); portalStamp(l.clientId, `${l.type} link revoked by ${a.by}`); return resolve(l); }
// Public resolve — counts the open; a dead link always says the same thing and points at sign-in
export async function resolveClientLink(token: string): Promise<ClientLink> {
  const all = clientLinks(); const l = all.find((x) => x.token === token); if (!l || l.revokedAt || (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now())) throw new Error(LINK_EXPIRED_COPY);
  // "until decided": the link keeps showing the decided page for 15 min after the tap (confirmation), then retires
  const recent = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < 15 * 60_000;
  if (l.type === 'estimate') { const e = store.estimates.find((x) => x.id === l.objectId); if (!e || !(['sent', 'draft'].includes(e.status) || recent(e.approvedAt) || recent(e.declinedAt))) throw new Error(LINK_EXPIRED_COPY); }
  if (l.type === 'parts') { const r = store.partsRequests.find((x) => x.id === l.objectId); if (!r || !(r.status === 'awaiting_client' || recent(r.clientDecidedAt))) throw new Error(LINK_EXPIRED_COPY); }
  l.opens += 1; l.lastOpenedAt = new Date().toISOString(); saveClientLinks(all); return resolve({ ...l });
}
export async function portalGetEstimateByLink(token: string): Promise<{ estimate: EstimateWithRefs; link: ClientLink }> { const l = await resolveClientLink(token); if (l.type !== 'estimate') throw new Error(LINK_EXPIRED_COPY); return resolve({ estimate: await portalGetEstimate(l.clientId, l.objectId), link: l }); }
export async function portalGetPartsByLink(token: string): Promise<{ parts: PortalPartsView; link: ClientLink }> { const l = await resolveClientLink(token); if (l.type !== 'parts') throw new Error(LINK_EXPIRED_COPY); return resolve({ parts: await portalGetPartsRequest(l.clientId, l.objectId), link: l }); }
// Step-up from a LINK (no session): the code goes to the email the link was sent to
export async function rcRequestStepUp(clientId: string, action: string): Promise<{ challengeId: string; maskedEmail: string; expiresAt: string }> { const c = byId(fx.clients, clientId); return rcRequestCode(c.email, { purpose: 'stepup', action }); }
export const STEP_UP_ACTION = { approveEstimate: (id: string) => `approve-estimate:${id}`, approveParts: (id: string) => `approve-parts:${id}`, payBalance: (id: string) => `pay-balance:${id}` };

// Per-document gating by type — token documents (report, inspection form) can stay public links; identity-bound pages always need the account
export type RcDocType = 'estimate' | 'invoice' | 'watch' | 'messages' | 'report' | 'inspection_form';
export type RcDocAccess = 'public' | 'login';
export const RC_DOC_META: Record<RcDocType, { label: string; blurb: string; lockable: boolean }> = {
  estimate: { label: 'Estimates · approve / decline', blurb: 'LINK tier: the emailed link opens this one estimate; Approve re-verifies with a fresh emailed code or Touch ID. Also inside the signed-in portal.', lockable: false },
  invoice: { label: 'Invoices · pay balance', blurb: 'LINK tier via /pay/:token (life of the invoice, one invoice only); the portal copy is behind sign-in.', lockable: false },
  watch: { label: 'Watch pages · photos & timeline', blurb: 'Photos are private unless a staff member unlocks them — always behind the account', lockable: false },
  messages: { label: 'Messages', blurb: 'Two-way thread — always behind the account', lockable: false },
  report: { label: 'Inspection report (tokened link)', blurb: 'Public: the emailed link opens read-only · Login: the link hits the wall first', lockable: true },
  inspection_form: { label: 'Inspection form (tokened link)', blurb: 'Public: read-only by link · Login: account required', lockable: true },
};
const RC_DOC_DEFAULTS: Record<RcDocType, RcDocAccess> = { estimate: 'login', invoice: 'login', watch: 'login', messages: 'login', report: 'public', inspection_form: 'login' };
export const rcDocAccess = (): Record<RcDocType, RcDocAccess> => ({ ...RC_DOC_DEFAULTS, ...readJson<Partial<Record<RcDocType, RcDocAccess>>>(RC_KEYS.docAccess, {}) });
export async function getRcDocAccess(): Promise<Record<RcDocType, RcDocAccess>> { return resolve(rcDocAccess()); }
export async function setRcDocAccess(t: RcDocType, v: RcDocAccess): Promise<Record<RcDocType, RcDocAccess>> { managerOnly(); if (!RC_DOC_META[t].lockable && v === 'public') throw new Error(`${RC_DOC_META[t].label} is identity-bound — it cannot be made public`); const next = { ...rcDocAccess(), [t]: v }; writeJson(RC_KEYS.docAccess, next); const a = actor(); appendAudit({ type: 'settings', stationName: a.station, userShortName: a.user?.shortName, detail: `RolliConnect access · ${RC_DOC_META[t].label} → ${v === 'public' ? 'public link' : 'login required'}` }); return resolve(next); }
export const rcDocTypeForPath = (p: string): RcDocType | null => (p.startsWith('/rc/estimates/') ? 'estimate' : p.startsWith('/rc/invoices/') ? 'invoice' : p.startsWith('/rc/watches/') ? 'watch' : p.startsWith('/rc/messages') ? 'messages' : p.startsWith('/rc/report/') ? 'report' : p.startsWith('/rc/inspection/') ? 'inspection_form' : null);

// Per-photo lock — every staff-created photo is PRIVATE by default; unlocking makes it visible on the client's side of the portal (behind their login)
const photoUnlocked = (): Record<string, true> => readJson<Record<string, true>>(RC_KEYS.photoUnlocked, { 'ph-r1-1': true, 'ph-r1-2': true, 'ph-r3-1': true });
export const isPhotoUnlocked = (id: string) => !!photoUnlocked()[id];
export async function setPhotoUnlocked(jobId: string, photoId: string, unlocked: boolean): Promise<JobPhotoView[]> {
  const j = getJobRow(jobId); const map = photoUnlocked(); if (unlocked) map[photoId] = true; else delete map[photoId]; writeJson(RC_KEYS.photoUnlocked, map);
  const view = (await getJobPhotoViews(jobId)).find((p) => p.id === photoId); jobStamp(j, `Photo ${unlocked ? 'unlocked · visible to client in RolliConnect' : 'locked · private to the workshop'} · ${view?.slot ?? photoId}`);
  return getJobPhotoViews(jobId);
}
export async function portalRevokeLink(token: string): Promise<void> { const l = store.magicLinks.find((x) => x.token === token); if (l) { l.revokedAt = new Date().toISOString(); writeJson(KEYS.rcLinks, store.magicLinks.slice(0, 20)); } return resolve(undefined); }
export async function portalRedeemMagicLink(token: string): Promise<Client> {
  const link = store.magicLinks.find((l) => l.token === token);
  if (!link) throw new Error('This link is invalid or has expired');
  if (link.revokedAt) throw new Error('This link was revoked by our team — request a fresh one below and you will land on the same page');
  link.usedAt = new Date().toISOString();
  const session: PortalSession = { clientId: link.clientId, email: link.email, token, issuedAt: link.usedAt };
  writeJson(KEYS.portalSession, session);
  portalStamp(link.clientId, 'Signed in to RolliConnect via magic link');
  return resolve(byId(fx.clients, link.clientId));
}

export async function portalGetSession(): Promise<{ session: PortalSession; client: Client } | null> {
  const s = portalSessionSync();
  const c = s ? fx.clients.find((x) => x.id === s.clientId) : undefined;
  return resolve(s && c ? { session: s, client: c } : null);
}

export async function portalSignOut(): Promise<void> {
  const s = portalSessionSync();
  localStorage.removeItem(KEYS.portalSession);
  if (s) portalStamp(s.clientId, 'Signed out of RolliConnect');
  return resolve(undefined);
}

// ---- View as client — staff opens the portal exactly as the client sees it (same read functions, so nothing staff-only can leak) ----
export async function startViewAsClient(clientId: string, returnTo: string): Promise<string> {
  const c = byId(fx.clients, clientId); const a = actor();
  const session: PortalSession = { clientId, email: c.email, token: `view-as-${newId('va')}`, issuedAt: new Date().toISOString(), viewAs: { by: a.by, at: new Date().toISOString(), returnTo } };
  writeJson(KEYS.portalSession, session);
  appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Viewed RolliConnect as client ${c.firstName} ${c.lastName} (read-only impersonation)` });
  return resolve('/rc/home');
}
export async function exitViewAsClient(): Promise<string> {
  const s = portalSessionSync(); localStorage.removeItem(KEYS.portalSession);
  if (s?.viewAs) { const c = byId(fx.clients, s.clientId); appendAudit({ type: 'comms', stationName: actor().station, userShortName: s.viewAs.by, detail: `Left client view for ${c.firstName} ${c.lastName}` }); }
  return resolve(s?.viewAs?.returnTo ?? '/clients');
}

// ---- Portal "Your requests" overview + client-facing photo sections ----------------------------------------------------------------
const STAFF_ONLY_PHOTO = /hidden serial|parts grading|workbench|^parts$|other/i;
const photoRow = (id: string, url: string, label: string, at: string): PortalPhoto => ({ id, url, label, at });
export const portalPhotoSections = (clientId: string, jobId: string): PortalPhotoSections => {
  const j = requireOwner(clientId, store.jobs.find((x) => x.id === jobId), 'job');
  const fixture = fx.jobPhotos.filter((p) => p.jobId === jobId && !STAFF_ONLY_PHOTO.test(p.slot));
  const pkg = store.packages.find((p) => p.id === j.packageId);
  const arrivalAll = [...(pkg?.photos ?? []).map((p) => photoRow(p.id, p.dataUrl, p.slot ?? 'Arrival', pkg!.arrivedAt)), ...fixture.filter((p) => p.kind === 'intake').map((p) => photoRow(p.id, p.url, p.slot, p.at))];
  const conditionAll = [...fixture.filter((p) => p.kind === 'inspection').map((p) => photoRow(p.id, p.url, p.slot, p.at)), ...j.photos.filter((p) => !STAFF_ONLY_PHOTO.test(p.slot ?? '')).map((p) => photoRow(p.id, p.dataUrl, p.slot ?? 'Inspection', p.at))];
  const completedAll = [...fixture.filter((p) => p.kind === 'completed').map((p) => photoRow(p.id, p.url, p.slot, p.at)), ...rs.evidence.filter((e) => e.jobId === jobId && e.slot !== 'hidden_serial' && e.slot !== 'parts_grading').map((e) => photoRow(e.id, e.photo.dataUrl, EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label, e.at))];
  // Private by default — only photos a staff member unlocked reach the client
  const open = (xs: PortalPhoto[]) => xs.filter((p) => isPhotoUnlocked(p.id));
  const arrival = open(arrivalAll); const condition = open(conditionAll); const completed = open(completedAll);
  const privateCount = arrivalAll.length + conditionAll.length + completedAll.length - arrival.length - condition.length - completed.length;
  const byAt = (a: PortalPhoto, b: PortalPhoto) => a.at.localeCompare(b.at);
  return { arrival: arrival.sort(byAt), condition: condition.sort(byAt), completed: completed.sort(byAt), jobNumber: j.number, privateCount };
};
export async function portalGetPhotoSections(clientId: string, jobId: string): Promise<PortalPhotoSections> { return resolve(portalPhotoSections(clientId, jobId)); }
const portalRequestCards = (clientId: string): PortalRequestCard[] => {
  const cards: PortalRequestCard[] = []; const wname = (w?: Watch) => (w ? `${w.brand} ${w.model}` : 'Your watch'); const wref = (w?: Watch) => (w ? `Ref. ${w.reference}` : 'Reference to be confirmed');
  const photos = (jobId: string) => { const s = portalPhotoSections(clientId, jobId); return s.arrival.length + s.condition.length + s.completed.length; };
  store.jobs.filter((j) => j.clientId === clientId).forEach((j) => {
    const w = store.watches.find((x) => x.id === j.watchId); const last = [...j.timeline].sort((a, b) => b.at.localeCompare(a.at))[0]; const so = store.salesOrders.find((o) => o.jobId === j.id && o.status !== 'cancelled'); const est = store.estimates.find((e) => e.id === j.estimateId);
    if (j.status === 'closed' || (so && (so.status === 'picked_up' || so.status === 'shipped'))) cards.push({ id: `card-${j.id}`, state: 'history', stateLabel: so?.status === 'shipped' ? 'Shipped · complete' : 'Collected · complete', watchName: wname(w), reference: wref(w), title: `Service completed`, blurb: `${j.lines.map((l) => l.description).slice(0, 2).join(' · ')}${so ? ` · ${fmtMoney(so.total)} paid` : ''}`, lastUpdate: so?.pickedUpAt ?? so?.shipDate ?? last?.at ?? j.createdAt, lastUpdateLabel: so?.pickedUpAt ? 'Collected' : 'Closed', path: `/rc/watches/${j.watchId}`, photoCount: photos(j.id), estimateNumber: est?.number, jobNumber: j.number, amount: so?.total });
    else cards.push({ id: `card-${j.id}`, state: 'in_progress', split: portalSplitFor(j), stateLabel: statusLabel(j.status), watchName: wname(w), reference: wref(w), title: j.status === 'ready_to_ship' ? 'Ready — awaiting hand-back' : j.status === 'testing' ? 'Final testing & QC' : 'In the workshop now', blurb: `${j.lines.map((l) => l.description).slice(0, 2).join(' · ')}${j.dueAt ? ` · expected ready around ${new Date(j.dueAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}`, lastUpdate: last?.at ?? j.createdAt, lastUpdateLabel: 'Last update', path: `/rc/watches/${j.watchId}`, photoCount: photos(j.id), estimateNumber: est?.number, jobNumber: j.number, cta: so && so.balanceDue > 0 && so.status !== 'draft' ? { label: `Pay ${fmtMoney(so.balanceDue)}`, path: `/rc/invoices/${so.id}` } : undefined });
  });
  store.estimates.filter((e) => e.clientId === clientId && !e.jobId && (e.status === 'sent' || e.status === 'expired' || e.status === 'declined')).forEach((e) => {
    const w = store.watches.find((x) => x.id === e.watchId);
    if (e.status === 'sent') cards.push({ id: `card-${e.id}`, state: 'decision', stateLabel: 'Estimate — your decision', watchName: wname(w), reference: wref(w), title: `Estimate ${e.number} · ${fmtMoney(e.total)}`, blurb: `Valid until ${new Date(e.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Approve or decline whenever you are ready.`, lastUpdate: e.sentAt ?? e.updatedAt, lastUpdateLabel: 'Sent', path: `/rc/estimates/${e.id}`, cta: { label: 'Review estimate', path: `/rc/estimates/${e.id}` }, photoCount: 0, estimateNumber: e.number, amount: e.total });
    else cards.push({ id: `card-${e.id}`, state: 'stale_estimate', stateLabel: e.status === 'expired' ? 'Estimate expired · watch not received' : 'Estimate declined', watchName: wname(w), reference: wref(w), title: `Estimate ${e.number} · ${fmtMoney(e.total)}`, blurb: e.status === 'expired' ? `We quoted this ${Math.round((Date.now() - new Date(e.sentAt ?? e.updatedAt).getTime()) / 86_400_000)} days ago and never received the watch. The figure is still viewable; we will re-confirm it when it arrives.` : 'You declined this estimate. It stays here for your records.', lastUpdate: e.sentAt ?? e.updatedAt, lastUpdateLabel: 'Quoted', path: `/rc/estimates/${e.id}`, cta: e.status === 'expired' ? { label: 'Ready to send it in?', path: '/rc/messages' } : undefined, photoCount: 0, estimateNumber: e.number, amount: e.total });
  });
  store.requests.filter((r) => r.clientId === clientId && !r.estimateId && r.status !== 'closed').forEach((r) => {
    const w = store.watches.find((x) => x.id === r.watchId); const m = /^([A-Z][\w-]+(?: [A-Z][\w-]+)* ?\d[\w-]*)/.exec(r.summary);
    cards.push({ id: `card-${r.id}`, state: 'received', stateLabel: 'Request received', watchName: w ? wname(w) : m ? m[1].replace(/ ?\d[\w-]*$/, '') : 'New watch', reference: w ? wref(w) : m ? `Ref. ${m[1].split(' ').pop()}` : 'Reference to be confirmed', title: 'We’ve received your request', blurb: `${r.summary.slice(0, 120)}${r.summary.length > 120 ? '…' : ''} — a concierge will reply here within one business day.`, lastUpdate: r.createdAt, lastUpdateLabel: 'Received', path: '/rc/messages', photoCount: 0, requestNumber: r.number });
  });
  const order: Record<PortalRequestState, number> = { in_progress: 0, decision: 1, received: 2, stale_estimate: 3, history: 4 };
  return cards.sort((a, b) => order[a.state] - order[b.state] || b.lastUpdate.localeCompare(a.lastUpdate));
};
export async function portalGetRequestCards(clientId: string): Promise<PortalRequestCard[]> { return resolve(portalRequestCards(clientId)); }

export const PORTAL_STATUS: Record<PortalStatusKey, { label: string; blurb: string; active: boolean }> = {
  on_file: { label: 'On file', blurb: 'No work in progress on this watch.', active: false },
  expecting: { label: 'We’re expecting your watch', blurb: 'Your estimate is approved — we’ll confirm the moment it arrives.', active: true },
  awaiting_approval: { label: 'Waiting for your approval', blurb: 'Review the estimate and let us know how you’d like to proceed.', active: true },
  inspecting: { label: 'Received — being inspected', blurb: 'Your watch is safely with us and going through inspection.', active: true },
  queued: { label: 'Queued for the bench', blurb: 'Approved and waiting for a watchmaker to open the case.', active: true },
  on_bench: { label: 'On the bench', blurb: 'A watchmaker is working on it now.', active: true },
  awaiting_part: { label: 'Waiting on a part', blurb: 'A component is on order; the work resumes when it lands.', active: true },
  with_specialist: { label: 'With a specialist', blurb: 'Part of the work is with a trusted outside specialist.', active: true },
  final_checks: { label: 'Final checks', blurb: 'Timing and water resistance are being verified.', active: true },
  finishing: { label: 'Finishing up', blurb: 'Work is complete — we’re preparing the paperwork.', active: true },
  ready_pickup: { label: 'Ready for pickup', blurb: 'Your watch is ready at the counter.', active: true },
  preparing_ship: { label: 'Being prepared to ship', blurb: 'We’re packing it insured and will send tracking.', active: true },
  on_its_way: { label: 'On its way', blurb: 'Shipped — tracking is below.', active: true },
  back_with_you: { label: 'Back with you', blurb: 'This service is complete.', active: false },
};

const portalStatusFor = (w: Watch, job: Job | undefined, est: Estimate | undefined, so: SalesOrder | undefined): PortalStatus => {
  const key = ((): PortalStatusKey => {
    if (so?.status === 'shipped') return 'on_its_way';
    if (so?.status === 'picked_up') return 'back_with_you';
    if (!job) return est?.status === 'sent' ? 'awaiting_approval' : w.status === 'expected' || est?.status === 'approved' ? 'expecting' : 'on_file';
    if (job.simpleStatus === 'estimate') return est?.status === 'approved' ? 'expecting' : 'awaiting_approval';
    const hold = activeHold(job);
    switch (job.status) {
      case 'intake':
      case 'in_review': return 'inspecting';
      case 'awaiting_customer_approval': return 'awaiting_approval';
      case 'approved': return hold ? (hold.type === 'parts' ? 'awaiting_part' : 'with_specialist') : 'queued';
      case 'in_service': return hold ? (hold.type === 'parts' ? 'awaiting_part' : 'with_specialist') : 'on_bench';
      case 'testing': return 'final_checks';
      case 'awaiting_manager_review': return 'finishing';
      case 'ready_to_ship': return so?.status === 'fulfilled' || so?.status === 'partial_fulfilled' ? (so.channel === 'ship' ? 'preparing_ship' : 'ready_pickup') : 'finishing';
      case 'closed': return 'back_with_you';
    }
  })();
  return { key, ...PORTAL_STATUS[key] };
};

const portalDocs = (jobs: Job[], ests: Estimate[], sos: SalesOrder[]): PortalDocument[] => {
  const docs: PortalDocument[] = [];
  jobs.forEach((j) => j.photos.filter((p) => isPhotoUnlocked(p.id)).forEach((p) => docs.push({ id: `doc-${p.id}`, kind: 'photo', title: `Inspection photo · ${j.number}`, at: p.at, dataUrl: p.dataUrl })));
  jobs.forEach((j) => rs.evidence.filter((e) => e.jobId === j.id).forEach((e) => docs.push({ id: `doc-${e.id}`, kind: 'photo', title: `Service evidence · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label}${e.depthRating ? ` · ${e.depthRating}` : ''}${e.grades ? ` · ${e.grades.join(', ')}` : ''} · ${j.number}`, at: e.at, dataUrl: e.photo.dataUrl })));
  store.packages.filter((p) => jobs.some((j) => j.packageId === p.id)).forEach((p) => p.photos.forEach((ph, i) => docs.push({ id: `doc-${p.id}-${i}`, kind: 'photo', title: `Arrival photo · ${p.subNumber}`, at: p.arrivedAt, dataUrl: ph.dataUrl })));
  ests.filter((e) => e.status !== 'draft').forEach((e) => docs.push({ id: `doc-${e.id}`, kind: 'estimate', legacy: !!e.legacy, title: `Estimate ${e.number}${e.revision > 1 ? ` (rev ${e.revision})` : ''}`, at: e.updatedAt, path: `/rc/estimates/${e.id}` }));
  sos.filter((o) => o.status !== 'draft' && o.status !== 'cancelled').forEach((o) => {
    docs.push({ id: `doc-${o.id}`, kind: 'invoice', legacy: !!o.legacy, title: `Invoice ${o.number}`, at: o.orderDate, path: `/rc/invoices/${o.id}` });
    if (o.shipment) docs.push({ id: `doc-${o.id}-lbl`, kind: 'label', title: `Shipping label · ${o.shipment.tracking}`, at: o.shipment.at, dataUrl: o.shipment.labelDataUrl });
    o.pickupSession?.photos.forEach((ph, i) => docs.push({ id: `doc-${o.id}-pu${i}`, kind: 'receipt', title: `Hand-back photo · ${o.number}`, at: o.pickupSession!.at, dataUrl: ph.dataUrl }));
  });
  return docs.sort((a, b) => b.at.localeCompare(a.at));
};

const PLAIN_ACTION: Record<string, string> = { create: 'Service opened', start_review: 'Inspection started', request_approval: 'Estimate sent for your approval', approve: 'Approved — queued for the bench', start_service: 'Work started on the bench', to_testing: 'Moved to final checks', qc_pass: 'Passed final checks', qc_fail: 'Sent back to the bench for another look', close: 'Service complete' };

const portalHistory = (jobs: Job[], ests: Estimate[], sos: SalesOrder[]): PortalHistoryRow[] => {
  const rows: PortalHistoryRow[] = [];
  ests.forEach((e) => {
    if (e.sentAt) rows.push({ id: `h-${e.id}-sent`, at: e.sentAt, title: `Estimate ${e.number} sent`, detail: `${e.lines.length} line${e.lines.length === 1 ? '' : 's'} · ${fmtMoney(e.total)}`, path: `/rc/estimates/${e.id}` });
    if (e.approvedAt) rows.push({ id: `h-${e.id}-ok`, at: e.approvedAt, title: `You approved estimate ${e.number}`, detail: e.approvedVia === 'portal' ? 'via RolliConnect' : 'recorded by our team', path: `/rc/estimates/${e.id}` });
    if (e.declinedAt) rows.push({ id: `h-${e.id}-no`, at: e.declinedAt, title: `Estimate ${e.number} declined`, detail: e.declineReason ?? '', path: `/rc/estimates/${e.id}` });
  });
  jobs.forEach((j) => {
    j.timeline.forEach((t) => rows.push({ id: `h-${t.id}`, at: t.at, title: PLAIN_ACTION[t.action] ?? t.action.replace(/_/g, ' '), detail: t.action === 'qc_fail' && t.reason ? 'We weren’t satisfied yet — a little more time on the bench.' : '' }));
    j.holds.forEach((h) => {
      rows.push({ id: `h-${h.id}-p`, at: h.placedAt, title: h.type === 'parts' ? 'Waiting on a part' : 'With a specialist', detail: '' });
      if (h.releasedAt) rows.push({ id: `h-${h.id}-r`, at: h.releasedAt, title: h.type === 'parts' ? 'Part arrived — work resumed' : 'Back from the specialist', detail: '' });
    });
  });
  sos.forEach((o) => {
    if (o.fulfilledAt) rows.push({ id: `h-${o.id}-inv`, at: o.fulfilledAt, title: `Invoice ${o.number} issued`, detail: fmtMoney(o.total), path: `/rc/invoices/${o.id}` });
    o.payments.forEach((p) => rows.push({ id: `h-${p.id}`, at: p.at, title: `Payment received — ${fmtMoney(p.amount)}`, detail: p.note ?? p.method, path: `/rc/invoices/${o.id}` }));
    if (o.shipment) rows.push({ id: `h-${o.id}-ship`, at: o.shipment.at, title: 'Shipped', detail: `${o.shipment.service} · ${o.shipment.tracking}` });
    if (o.pickupSession) rows.push({ id: `h-${o.id}-pu`, at: o.pickupSession.at, title: 'Picked up', detail: o.pickupSession.proxyName ? `Collected by ${o.pickupSession.proxyName}` : 'Collected in person' });
  });
  return rows.sort((a, b) => b.at.localeCompare(a.at));
};

const portalWatchFor = (clientId: string, w: Watch): PortalWatch => {
  const jobs = store.jobs.filter((j) => j.watchId === w.id && j.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ests = store.estimates.filter((e) => e.watchId === w.id && e.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sos = store.salesOrders.filter((o) => o.clientId === clientId && (o.jobId ? jobs.some((j) => j.id === o.jobId) : false)).sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  const job = jobs.find((j) => j.status !== 'closed') ?? jobs[0];
  const openEstimate = ests.find((e) => e.status === 'sent') ?? ests.find((e) => e.status === 'approved' && !e.jobId);
  const invoice = sos.find((o) => o.status !== 'cancelled' && o.status !== 'draft' && (o.jobId === job?.id || !job));
  const status = portalStatusFor(w, job && job.status !== 'closed' ? job : invoice && (invoice.status === 'shipped' || invoice.status === 'picked_up') ? job : undefined, openEstimate, invoice && (invoice.jobId === job?.id) ? invoice : undefined);
  const issued = rp.reports.find((r) => r.watchId === w.id && r.clientId === clientId && r.status === 'issued');
  return { watch: w, jobIds: jobs.map((j) => j.id), split: job ? portalSplitFor(job) : undefined, dots: job && job.status !== 'closed' ? portalDotsSync(job) : undefined, flow: job && job.status !== 'closed' ? portalFlowSync(job) : undefined, status, job: job && job.status !== 'closed' ? job : undefined, openEstimate, invoice, eta: job?.dueAt && job.status !== 'closed' ? job.dueAt : undefined, history: portalHistory(jobs, ests, sos), documents: portalDocs(jobs, ests, sos), inspectionReportToken: issued?.token };
};

// Split-flow strip in client language: one track per component; done tracks read "complete — ready and waiting"; collapses when the tracks merge
const SPLIT_TRACK_LABEL: Record<ComponentKey, string> = { head: 'Watch head', band: 'Bracelet', case: 'Case' };
const SPLIT_DONE_TEXT: Record<ComponentKey, string> = { head: 'Service complete — ready and waiting', band: 'Refinishing complete — ready and waiting', case: 'Refinishing complete — ready and waiting' };
const splitStageText = (j: Job, st: RwStationKey): string => {
  if (j.status === 'awaiting_customer_approval') return 'Awaiting your approval';
  if (st === 'pre_approval' || st.endsWith('pre_queue')) return 'Received';
  if (st === 'final_assembly') return 'In final assembly';
  if (st === 'finished') return 'Ready';
  return 'In service';
};
const portalSplitFor = (j: Job): PortalSplit | undefined => {
  if (j.status !== 'in_service' || activeHold(j)) return undefined;
  const parts = ensureParts(j); if (parts.length < 2) return undefined;
  const tracks: PortalSplitTrack[] = parts.map((c) => { const p = derivePlacement(j, c); const done = !!c.completedAt || p.status === 'waiting'; return { key: c.key, label: SPLIT_TRACK_LABEL[c.key], done, text: done ? SPLIT_DONE_TEXT[c.key] : splitStageText(j, p.station) }; });
  if (tracks.every((t) => t.done) || tracks.every((t) => !t.done && t.text === 'Received')) return undefined;
  return { tracks, mergeLabel: 'Final assembly — begins when both are ready' };
};

const needsYouFor = (clientId: string, watches: PortalWatch[]): NeedsYouItem[] => {
  const items: NeedsYouItem[] = [];
  rp.reports.filter((r) => r.clientId === clientId && r.status === 'issued').forEach((r) => { const w = store.watches.find((x) => x.id === r.watchId); items.push({ id: `ny-rep-${r.id}`, kind: 'review_inspection', title: `Review the inspection report for your ${w?.model ?? 'watch'}`, detail: `Condition grades, photos and notes · approve or decline on the page`, path: `/rc/report/${r.token}`, at: r.issuedAt, watchId: r.watchId }); });
  store.estimates.filter((e) => e.clientId === clientId && e.status === 'sent').forEach((e) => {
    const w = e.watchId ? store.watches.find((x) => x.id === e.watchId) : undefined;
    items.push({ id: `ny-est-${e.id}`, kind: 'approve_estimate', title: `Approve or decline estimate ${e.number}`, detail: `${w ? `${w.brand} ${w.model} · ` : ''}${fmtMoney(e.total)} · valid until ${new Date(e.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, path: `/rc/estimates/${e.id}`, at: e.sentAt ?? e.updatedAt, watchId: e.watchId });
  });
  // Parts approvals — a money decision: one tap on a page with the lines and the price (the same page the email link opens)
  store.partsRequests.filter((r) => r.status === 'awaiting_client').forEach((r) => {
    const j = store.jobs.find((x) => x.id === r.jobId); if (!j || j.clientId !== clientId) return; const w = store.watches.find((x) => x.id === j.watchId); const total = (r.items ?? []).reduce((t, i) => t + (i.price ?? 0) * i.qty, 0);
    items.push({ id: `ny-parts-${r.id}`, kind: 'approve_parts', title: `Approve the parts for your ${w?.model ?? 'watch'}`, detail: `${(r.items ?? []).length} part${(r.items ?? []).length === 1 ? '' : 's'} · ${fmtMoney(total)} · the work pauses until you decide`, path: `/rc/parts/${r.id}`, at: r.sentForApprovalAt ?? r.requestedAt, watchId: j.watchId });
  });
  store.salesOrders.filter((o) => o.clientId === clientId && o.status !== 'draft' && o.status !== 'cancelled').forEach((o) => {
    const pw = watches.find((x) => x.invoice?.id === o.id);
    const label = pw ? `${pw.watch.brand} ${pw.watch.model}` : o.number;
    if (o.balanceDue > 0 && o.status !== 'picked_up' && o.status !== 'shipped') items.push({ id: `ny-pay-${o.id}`, kind: 'pay_balance', title: `Pay the balance on invoice ${o.number}`, detail: `${label} · ${fmtMoney(o.balanceDue)} due`, path: `/rc/invoices/${o.id}`, at: o.fulfilledAt ?? o.orderDate, watchId: pw?.watch.id });
    if ((o.status === 'fulfilled' || o.status === 'partial_fulfilled') && o.channel === 'pickup' && !o.pickupWindow) items.push({ id: `ny-pu-${o.id}`, kind: 'confirm_pickup', title: 'Choose a pickup window', detail: `${label} is ready at the counter`, path: `/rc/invoices/${o.id}#pickup`, at: o.fulfilledAt ?? o.orderDate, watchId: pw?.watch.id });
    if (o.channel === 'ship' && !o.shippingAddress && (o.shippingInfoRequestedAt || o.status === 'fulfilled')) items.push({ id: `ny-ship-${o.id}`, kind: 'shipping_info', title: 'Tell us where to ship', detail: `${label} · insured, signature on delivery`, path: `/rc/invoices/${o.id}#shipping`, at: o.shippingInfoRequestedAt ?? o.orderDate, watchId: pw?.watch.id });
  });
  const unread = store.messages.filter((m) => m.clientId === clientId && m.from === 'staff' && !m.readByClient);
  if (unread.length) items.push({ id: 'ny-msg', kind: 'staff_reply', title: unread.length === 1 ? 'A reply from our team' : `${unread.length} replies from our team`, detail: unread[0].text.slice(0, 90) + (unread[0].text.length > 90 ? '…' : ''), path: '/rc/messages', at: unread[0].at });
  return items.sort((a, b) => b.at.localeCompare(a.at));
};

export const REQUEST_CLOSE_REASONS: { key: RequestCloseReason; label: string }[] = [
  { key: 'duplicate', label: 'Duplicate of another request' },
  { key: 'no_longer_needed', label: 'No longer needed' },
  { key: 'mistake', label: 'Submitted by mistake' },
];
const REQUEST_PLAIN: Record<RequestStatus, string> = { new: 'Received — we’re reviewing it', quoted: 'Quoted — see your estimate', closed: 'Closed by our team', closed_by_client: 'Closed by you' };
const isRequestOpen = (r: ServiceRequest) => r.status === 'new' || r.status === 'quoted';

// Client may close only their own, still-early (not yet quoted) requests; quoted-or-later is staff-only
const portalRequestsFor = (clientId: string): PortalRequest[] =>
  store.requests.filter((r) => r.clientId === clientId).sort((a, b) => Number(isRequestOpen(b)) - Number(isRequestOpen(a)) || b.createdAt.localeCompare(a.createdAt)).map((r) => ({
    request: r,
    statusLabel: REQUEST_PLAIN[r.status],
    canClose: r.status === 'new',
    watch: r.watchId ? store.watches.find((w) => w.id === r.watchId) : undefined,
    duplicateOf: r.duplicateOfId ? store.requests.find((x) => x.id === r.duplicateOfId) : undefined,
  }));

export async function portalCloseRequest(clientId: string, id: string, reason: RequestCloseReason, duplicateOfId?: string): Promise<PortalRequest> {
  const r = requireOwner(clientId, store.requests.find((x) => x.id === id), 'request');
  if (r.status !== 'new') throw new Error('This request has already been quoted — message us and we’ll take care of it');
  if (!REQUEST_CLOSE_REASONS.some((x) => x.key === reason)) throw new Error('Pick a reason');
  let dup: ServiceRequest | undefined;
  if (reason === 'duplicate') {
    dup = store.requests.find((x) => x.id === duplicateOfId && x.clientId === clientId && x.id !== id);
    if (!dup) throw new Error('Tell us which of your requests this duplicates');
  }
  recordRcEvent({ t: 'closereq', clientId, id, reason, duplicateOfId: dup?.id });
  r.status = 'closed_by_client';
  r.closedAt = new Date().toISOString();
  r.closedBy = 'client';
  r.closeReason = reason;
  r.duplicateOfId = dup?.id;
  r.closedNote = `${REQUEST_CLOSE_REASONS.find((x) => x.key === reason)!.label}${dup ? ` — ${dup.number}` : ''} · closed by client in RolliConnect`;
  portalStamp(clientId, `Closed request ${r.number} · ${r.closedNote}`);
  return resolve(portalRequestsFor(clientId).find((x) => x.request.id === id)!);
}

// Staff close — any open status, reason + optional note; never deletes
export async function closeRequest(id: string, reason: RequestCloseReason, note?: string, duplicateOfId?: string): Promise<ServiceRequest> {
  const r = byId(store.requests, id);
  if (!isRequestOpen(r)) throw new Error('Request is already closed');
  const dup = reason === 'duplicate' ? store.requests.find((x) => x.id === duplicateOfId && x.clientId === r.clientId && x.id !== id) : undefined;
  if (reason === 'duplicate' && !dup) throw new Error('Pick which request it duplicates');
  const a = actor();
  r.status = 'closed'; r.closedAt = new Date().toISOString(); r.closedBy = 'staff'; r.closeReason = reason; r.duplicateOfId = dup?.id;
  r.closedNote = `${REQUEST_CLOSE_REASONS.find((x) => x.key === reason)!.label}${dup ? ` of ${dup.number}` : ''}${note?.trim() ? ` · ${note.trim()}` : ''}`;
  appendAudit({ type: 'estimate', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${r.number} · Request closed by staff · ${r.closedNote}` });
  return resolve({ ...r });
}

export async function portalGetHome(clientId: string): Promise<PortalHome> {
  const client = byId(fx.clients, clientId);
  const watches = store.watches.filter((w) => w.clientId === clientId).map((w) => portalWatchFor(clientId, w)).sort((a, b) => Number(b.status.active) - Number(a.status.active) || b.watch.receivedAt.localeCompare(a.watch.receivedAt));
  return resolve({ client, needsYou: needsYouFor(clientId, watches), watches, requests: portalRequestsFor(clientId), unreadMessages: store.messages.filter((m) => m.clientId === clientId && m.from === 'staff' && !m.readByClient).length });
}

export async function portalGetWatch(clientId: string, watchId: string): Promise<PortalWatch> {
  const w = requireOwner(clientId, store.watches.find((x) => x.id === watchId), 'watch');
  return resolve(portalWatchFor(clientId, w));
}

export async function portalGetEstimate(clientId: string, id: string): Promise<EstimateWithRefs> {
  const e = requireOwner(clientId, store.estimates.find((x) => x.id === id), 'estimate');
  if (e.status === 'draft') throw new Error('That estimate isn’t ready yet');
  if (e.status === 'sent' && new Date(e.validUntil).getTime() < Date.now()) { e.status = 'expired'; estStamp(e, 'Expired (opened after validUntil)'); }
  engage(e, 'opened'); return resolve(withRefs(e));
}
const engage = (e: Estimate, kind: EngagementKind, detail?: string) => { (e.engagement ??= []).push({ kind, at: new Date().toISOString(), detail }); };
export const SHOP_ADDRESS = { name: 'RolliSuite Service Center', line1: '590 Madison Avenue, Suite 1802', city: 'New York, NY 10022', hours: 'Mon–Fri 10:00–18:00 · Sat 11:00–16:00', phone: '(212) 555-0100' };
// "Send us your watch" — the client's own click starts the inbound funnel (Label Requests, stage 1). Name / address / insured value / 1-day or 2-day are stored on the request; nothing is purchased until staff press Send.
export interface PortalLabelRequestInput { address: Address; insuredValue: number; serviceLevel: ShipServiceLevel }
export async function portalRequestLabel(clientId: string, estimateId: string, input: Address | PortalLabelRequestInput): Promise<ShipmentWithRefs> {
  const address = 'address' in input ? input.address : input; const insuredValue = 'insuredValue' in input ? input.insuredValue : 0; const serviceLevel: ShipServiceLevel = 'serviceLevel' in input ? input.serviceLevel : '1_day';
  const e = requireOwner(clientId, store.estimates.find((x) => x.id === estimateId), 'estimate'); const c = byId(fx.clients, clientId);
  if (!address.name?.trim() || !address.street?.trim() || !address.city?.trim() || !address.state?.trim()) throw new Error('Please complete the pickup address');
  if (!(insuredValue > 0)) throw new Error('Please enter the value to insure');
  if (shp.rows.some((r) => r.estimateId === e.id && r.stage !== 'arrived')) throw new Error('A shipping label is already on its way for this estimate');
  const carrier = address.state === 'NY' || address.state === 'NJ' || address.state === 'CT' ? 'UPS' : 'FedEx'; const now = new Date().toISOString();
  const row: InboundShipment = { id: newId('sh'), direction: 'inbound', estimateId: e.id, clientId, stage: 'label_requested', carrier, service: parcelpro.serviceName(carrier, serviceLevel), serviceLevel, declaredValue: insuredValue, destinationState: address.state, requestedAt: now, request: { name: address.name.trim(), street: address.street.trim(), city: address.city.trim(), state: address.state.trim().toUpperCase(), insuredValue, serviceLevel, submittedAt: now }, events: [], stamps: [{ at: now, by: `${c.firstName} ${c.lastName}`, station: 'RolliConnect', action: `Client requested a prepaid label from the estimate page · ${address.street}, ${address.city} ${address.state} · insure $${insuredValue.toLocaleString()} · ${serviceLevel === '1_day' ? '1-day' : '2-day'}` }], emailIds: [] };
  shp.rows.unshift(row); e.sendIntent = { kind: 'label', at: row.requestedAt, shipmentId: row.id }; engage(e, 'label_requested', `${address.city}, ${address.state}`); estStamp(e, `Client requested shipping label (portal) · ${address.city}, ${address.state} · $${insuredValue.toLocaleString()} · ${serviceLevel === '1_day' ? '1-day' : '2-day'}`); portalStamp(clientId, `Requested a shipping label for ${e.number}`);
  return resolve(shipRefs(row));
}
export async function portalDropOff(clientId: string, estimateId: string): Promise<EstimateWithRefs> {
  const e = requireOwner(clientId, store.estimates.find((x) => x.id === estimateId), 'estimate');
  e.sendIntent = { kind: 'drop_off', at: new Date().toISOString() }; engage(e, 'drop_off'); estStamp(e, 'Client will drop the watch off (portal)'); portalStamp(clientId, `Will drop off ${e.number} in person`);
  return resolve(withRefs(e));
}
// Expired → "ready to send it in?" → asks for a refreshed quote: pins the owner + lands in the Inbox as Needs reply anchored to the estimate
export async function portalRequestRequote(clientId: string, estimateId: string): Promise<EstimateWithRefs> {
  const e = requireOwner(clientId, store.estimates.find((x) => x.id === estimateId), 'estimate'); const c = byId(fx.clients, clientId);
  if (e.status !== 'expired') throw new Error('Only an expired estimate can be refreshed');
  if (e.engagement?.some((x) => x.kind === 'requote_requested')) throw new Error('We already have your request — a refreshed quote is on its way');
  engage(e, 'requote_requested'); estStamp(e, 'Client asked for a refreshed quote (portal) → re-quote / duplicate flow');
  threadEvent(clientId, { kind: 'estimate', id: e.id }, 'portal', `${c.firstName} ${c.lastName}`, `Ready to send the watch in — please refresh expired estimate ${e.number}.`);
  store.pinned.unshift({ id: newId('pin'), title: `Re-quote requested · ${e.number} ${fullNameOf(c)} (expired ${new Date(e.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}) — duplicate & resend`, assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'RolliConnect', createdAt: new Date().toISOString(), station: 'RolliConnect', division: 'rollishop' });
  return resolve(withRefs(e));
}

export async function portalApproveEstimate(clientId: string, id: string): Promise<EstimateWithRefs> {
  requireOwner(clientId, store.estimates.find((e) => e.id === id), 'estimate');
  requireStepUp(clientId, STEP_UP_ACTION.approveEstimate(id)); // money action — fresh code / Touch ID, even from a link
  { const e0 = store.estimates.find((x) => x.id === id); if (e0) engage(e0, 'approved'); }
  recordRcEvent({ t: 'approve', clientId, id });
  const r = await asClient(clientId, () => approveEstimate(id, 'portal'));
  // The linked job (if it is waiting on the customer) moves forward too — staff see it in the Approved lane instantly
  const job = store.jobs.find((j) => j.estimateId === id && j.status === 'awaiting_customer_approval');
  if (job) await asClient(clientId, () => transitionJob(job.id, 'approve'));
  portalStamp(clientId, `Approved estimate ${r.number} rev ${r.revision}${job ? ` · job ${job.number} → approved` : ''}`);
  threadEvent(clientId, { kind: 'estimate', id }, 'approval', clientName(clientId), `Approved estimate ${r.number} rev ${r.revision} in RolliConnect`, { kind: 'estimate_approved', refId: id, label: `Approval · ${r.number}` });
  return r;
}

export async function portalDeclineEstimate(clientId: string, id: string, reason: string): Promise<EstimateWithRefs> {
  requireOwner(clientId, store.estimates.find((e) => e.id === id), 'estimate');
  if (!reason.trim()) throw new Error('Please tell us why');
  recordRcEvent({ t: 'decline', clientId, id, reason });
  const r = await asClient(clientId, () => declineEstimate(id, reason, 'portal'));
  portalStamp(clientId, `Declined estimate ${r.number} · ${reason.trim()}`);
  threadEvent(clientId, { kind: 'estimate', id }, 'approval', clientName(clientId), `Declined estimate ${r.number}: ${reason.trim()}`, { kind: 'estimate_declined', refId: id, label: `Decline · ${r.number}` });
  return r;
}

export async function portalGetInvoice(clientId: string, id: string): Promise<SalesOrderWithRefs> {
  return resolve(soRefs(requireOwner(clientId, store.salesOrders.find((o) => o.id === id), 'invoice')));
}

// Payment stub: settles the full balance as a card payment — no processor, ledger only
export async function portalPayBalance(clientId: string, id: string): Promise<SalesOrderWithRefs> {
  const o = requireOwner(clientId, store.salesOrders.find((x) => x.id === id), 'invoice');
  if (o.balanceDue <= 0) throw new Error('This invoice is already paid');
  requireStepUp(clientId, STEP_UP_ACTION.payBalance(id));
  recordRcEvent({ t: 'pay', clientId, id });
  const amount = o.balanceDue;
  const r = await asClient(clientId, () => recordPayment(id, amount, 'card', 'Paid online via RolliConnect (stub)'));
  portalStamp(clientId, `Paid ${fmtMoney(amount)} on ${o.number} (stub card payment)`);
  return r;
}

export async function portalConfirmPickupWindow(clientId: string, id: string, date: string, slot: PickupWindow['slot'], note?: string): Promise<SalesOrderWithRefs> {
  const o = requireOwner(clientId, store.salesOrders.find((x) => x.id === id), 'invoice');
  if (o.channel !== 'pickup') throw new Error('This order isn’t set for pickup');
  if (!date) throw new Error('Pick a day');
  recordRcEvent({ t: 'pickup', clientId, id, date, slot, note });
  o.pickupWindow = { date, slot, confirmedAt: new Date().toISOString(), note: note?.trim() || undefined };
  { const pj = o.jobId ? store.jobs.find((j) => j.id === o.jobId) : undefined; threadEvent(clientId, pj ? { kind: 'job', id: pj.id } : undefined, 'pickup', clientName(clientId), `Pickup window confirmed for ${o.number}: ${date} ${slot}${note?.trim() ? ` · ${note.trim()}` : ''}`, { kind: 'pickup_window', refId: o.id, label: `Pickup · ${o.number}` }); }
  o.updatedAt = o.pickupWindow.confirmedAt;
  const c = byId(fx.clients, clientId);
  const when = `${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${slot}`;
  await asClient(clientId, async () => { soStamp(o, `Pickup window confirmed by client · ${when}${note?.trim() ? ` · “${note.trim()}”` : ''}`); });
  store.tasks.unshift({ id: `t-${Date.now().toString(36)}`, title: `${c.firstName} ${c.lastName} picking up ${o.number} — ${when}`, assignedTo: { type: 'role', role: 'concierge' }, createdBy: 'RolliConnect', division: 'rolliworks', jobId: o.jobId, clientId, dueAt: new Date(date + (slot === 'morning' ? 'T09:00:00' : 'T13:00:00')).toISOString(), status: 'open', createdAt: new Date().toISOString(), station: 'RolliConnect' });
  portalStamp(clientId, `Confirmed pickup window for ${o.number} · ${when}`);
  return resolve(soRefs(o));
}

export async function portalSubmitShippingInfo(clientId: string, id: string, address: Address, phone: string): Promise<SalesOrderWithRefs> {
  const o = requireOwner(clientId, store.salesOrders.find((x) => x.id === id), 'invoice');
  if (!address.name.trim() || !address.street.trim() || !address.city.trim() || !address.state.trim()) throw new Error('Please complete the address');
  if (!phone.trim()) throw new Error('The carrier needs a phone number');
  recordRcEvent({ t: 'ship', clientId, id, address, phone });
  const r = await asClient(clientId, () => setShippingAddress(id, { name: address.name.trim(), street: address.street.trim(), city: address.city.trim(), state: address.state.trim() }));
  o.memo = `${o.memo ? `${o.memo}\n` : ''}Carrier phone (from RolliConnect): ${phone.trim()}`;
  portalStamp(clientId, `Submitted shipping address for ${o.number}`);
  return r;
}

export async function portalGetMessages(clientId: string): Promise<Message[]> {
  if (store.messages.some((m) => m.clientId === clientId && m.from === 'staff' && !m.readByClient)) recordRcEvent({ t: 'read', clientId, side: 'client' });
  store.messages.forEach((m) => { if (m.clientId === clientId && m.from === 'staff') m.readByClient = true; });
  return resolve(store.messages.filter((m) => m.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at)));
}

export async function portalSendMessage(clientId: string, text: string, watchId?: string, opts: { jobId?: string; component?: ComponentKey } = {}): Promise<Message> {
  if (!text.trim()) throw new Error('Write something first');
  recordRcEvent({ t: 'msg', clientId, text, watchId });
  const c = byId(fx.clients, clientId);
  const askJob = opts.jobId ? store.jobs.find((j) => j.id === opts.jobId && j.clientId === clientId) : undefined;
  const m: Message = { id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, clientId, watchId, jobId: askJob?.id, component: askJob ? opts.component : undefined, from: 'client', by: `${c.firstName} ${c.lastName}`, text: text.trim(), at: new Date().toISOString(), readByStaff: false, readByClient: true };
  store.messages.push(m);
  { const job = askJob ?? (watchId ? store.jobs.find((j) => j.watchId === watchId && j.status !== 'closed') : undefined);
    const cm = threadEvent(clientId, job ? { kind: 'job', id: job.id } : undefined, 'portal', `${c.firstName} ${c.lastName}`, text.trim());
    // "Ask about this" from a red dot: tag the component, drop it in the front-desk queue (claimable) and pre-draft the client update — never auto-sent
    if (askJob && opts.component) portalAskArrived(cm, askJob, opts.component); }
  portalStamp(clientId, `Message sent to the team${watchId ? ` about ${store.watches.find((w) => w.id === watchId)?.model ?? 'a watch'}` : ''}${askJob && opts.component ? ` · asked about the ${PART_LABEL[opts.component].toLowerCase()}` : ''}`);
  return resolve(m);
}

// Staff side: inbox of client threads; replies record a Sent email (nothing sends)
export async function getStaffInbox(): Promise<StaffInboxThread[]> {
  const byClient = new Map<string, Message[]>();
  store.messages.forEach((m) => byClient.set(m.clientId, [...(byClient.get(m.clientId) ?? []), m]));
  const threads = [...byClient.entries()].map(([clientId, msgs]): StaffInboxThread => {
    const sorted = msgs.sort((a, b) => a.at.localeCompare(b.at));
    const last = sorted[sorted.length - 1];
    return { client: byId(fx.clients, clientId), messages: sorted, unread: sorted.filter((m) => m.from === 'client' && !m.readByStaff).length, lastAt: last.at, watch: last.watchId ? store.watches.find((w) => w.id === last.watchId) : undefined };
  });
  return resolve(threads.sort((a, b) => b.unread - a.unread || b.lastAt.localeCompare(a.lastAt)));
}

export async function getStaffInboxUnread(): Promise<number> { return resolve(store.messages.filter((m) => m.from === 'client' && !m.readByStaff).length); }

export async function markThreadRead(clientId: string): Promise<void> {
  if (store.messages.some((m) => m.clientId === clientId && m.from === 'client' && !m.readByStaff)) recordRcEvent({ t: 'read', clientId, side: 'staff' });
  store.messages.forEach((m) => { if (m.clientId === clientId && m.from === 'client') m.readByStaff = true; });
  return resolve(undefined);
}

export async function replyToClient(clientId: string, text: string, watchId?: string, replayBy?: string): Promise<Message> {
  if (!text.trim()) throw new Error('Write a reply first');
  const a = replayBy ? { by: replayBy, station: 'Front Desk 1', user: undefined } : actor();
  recordRcEvent({ t: 'reply', clientId, text, watchId, by: a.by });
  const c = byId(fx.clients, clientId);
  const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: 'RolliConnect message', status: 'pending', subject: 'A reply from the RolliSuite team', body: `Hello ${c.firstName},\n\n${text.trim()}\n\nReply any time in RolliConnect.\n\n— ${a.by}, RolliSuite`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station };
  queueOutbox(email);
  const m: Message = { id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, clientId, watchId, from: 'staff', by: a.by, text: text.trim(), at: email.createdAt, readByStaff: true, readByClient: false, emailId: email.id };
  store.messages.push(m);
  await markThreadRead(clientId);
  appendAudit({ type: 'portal', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Replied to ${c.firstName} ${c.lastName} in RolliConnect · email recorded in Sent` });
  return resolve(m);
}

// ---- E9 RS modules ---------------------------------------------------------------------------------
import type { CycleCount, EvidenceItem, EvidenceSlot, IntegrationTile, MessageTemplate, PartsGrade, PurchaseOrder, PurchaseOrderWithRefs, QboQueueRow, Report, StockLevel, StockLocation, StockMovement, StockRow, TemplateAudience, TemplateKey, UserAdminInput, UserLimits, Vendor, VendorInput, ZeroBalanceReason, VendorPartRow, VendorSummary } from './types';

const rs = {
  vendors: fx.vendors.map((v): Vendor => ({ ...v })),
  locations: fx.locations.map((l): StockLocation => ({ ...l })),
  stock: fx.stockLevels.map((s): StockLevel => ({ ...s })),
  pos: fx.purchaseOrders.map((p): PurchaseOrder => ({ ...p, lines: p.lines.map((l) => ({ ...l })) })),
  movements: fx.stockMovements.map((m): StockMovement => ({ ...m })),
  counts: fx.cycleCounts.map((c): CycleCount => ({ ...c, lines: c.lines.map((l) => ({ ...l })) })),
  templates: fx.templates.map((t): MessageTemplate => ({ ...t, mergeFields: [...t.mergeFields] })),
  // Seed: Vienna's personal estimate email (warmer opener, mentions the watch) so both paths — shop default vs personal — are visible
  personalTemplates: [{ key: 'estimate_sent', owner: 'Vienna', subject: 'Your estimate {{estimate.number}} — {{watch.brand}} {{watch.model}}', body: 'Dear {{client.first_name}},\n\nIt was a pleasure looking after your {{watch.brand}} {{watch.model}}. Your estimate {{estimate.number}} is ready — you can review and approve it here, or call me directly with any questions:\n\n{{portal.link}}\n\nWarm regards,\nVienna · Operations Manager', updatedAt: new Date(Date.now() - 12 * 86_400_000).toISOString() }] as PersonalTemplate[],
  evidence: fx.evidence.map((e): EvidenceItem => ({ ...e })),
  catalog: fx.catalog.map((c) => ({ ...c, retired: false as boolean })),
  counters: { po: 25, cc: 3, ev: 12 },
};
// PO lines carry the part's number/description for display
rs.pos.forEach((p) => p.lines.forEach((l) => { const pt = store.parts.find((x) => x.id === l.partId); l.partNumber = pt?.partNumber ?? l.partNumber; l.description = pt?.name ?? l.description; }));

const rsStamp = (type: 'purchasing' | 'inventory' | 'setup' | 'evidence' | 'labels' | 'accounting', detail: string) => {
  const a = actor();
  appendAudit({ type, stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail });
};
const stockAt = (partId: string, locationId: string) => { let s = rs.stock.find((x) => x.partId === partId && x.locationId === locationId); if (!s) { s = { partId, locationId, onHand: 0, reorderPoint: 1 }; rs.stock.push(s); } return s; };
const move = (kind: StockMovement['kind'], partId: string, locationId: string, delta: number, reason: string, extra: Partial<StockMovement> = {}) => {
  const s = stockAt(partId, locationId); const a = actor(); const before = s.onHand; s.onHand += delta;
  const part = byId(store.parts, partId); part.stock = rs.stock.filter((x) => x.partId === partId).reduce((t, x) => t + x.onHand, 0);
  const m: StockMovement = { id: newId('mv'), kind, partId, locationId, delta, before, after: s.onHand, reason, division: byId(rs.locations, locationId).division, at: new Date().toISOString(), by: a.by, station: a.station, ...extra };
  rs.movements.unshift(m);
  rsStamp('inventory', `${part.partNumber} ${delta > 0 ? '+' : ''}${delta} @ ${byId(rs.locations, locationId).name} · ${kind} · ${reason}`);
  return m;
};

// -- Purchasing
const poRefs = (p: PurchaseOrder): PurchaseOrderWithRefs => ({ ...p, vendor: byId(rs.vendors, p.vendorId), location: byId(rs.locations, p.locationId) });
const poTotal = (p: PurchaseOrder) => { p.total = p.lines.reduce((t, l) => t + l.qty * l.unitCost, 0); };
export async function getVendors(): Promise<Vendor[]> { return resolve([...rs.vendors]); }
export async function getVendor(id: string): Promise<Vendor | null> { return resolve(rs.vendors.find((v) => v.id === id) ?? null); }
// ONE vendor record — created here, via CSV import or auto-catalog on a PO line: same fields, same id, referenced by parts / POs / price history
export async function saveVendor(input: VendorInput): Promise<Vendor> {
  if (!input.name.trim()) throw new Error('Vendor name is required');
  const dup = rs.vendors.find((v) => v.id !== input.id && v.name.trim().toLowerCase() === input.name.trim().toLowerCase()); if (dup) throw new Error(`A vendor named "${dup.name}" already exists`);
  const existing = input.id ? rs.vendors.find((v) => v.id === input.id) : undefined;
  const { id: _id, ...fields } = input; void _id;
  const v: Vendor = existing ? Object.assign(existing, fields, { name: input.name.trim() }) : { ...fields, name: input.name.trim(), id: newId('v'), active: input.active ?? true, createdVia: 'vendors_screen' };
  if (!existing) rs.vendors.push(v);
  rsStamp('purchasing', `Vendor ${existing ? 'updated' : 'created'} · ${v.name}`);
  return resolve({ ...v });
}
const vendorLinkedParts = (vendorId: string) => { ensurePartsModule(); const ids = new Set(store.parts.filter((p) => p.vendorIds?.includes(vendorId)).map((p) => p.id)); inv.history.filter((h) => h.vendorId === vendorId).forEach((h) => ids.add(h.partId)); return [...ids]; };
const vendorTurnaround = (vendorId: string): number | undefined => { const d = rs.pos.filter((p) => p.vendorId === vendorId && p.sentAt && p.receivedAt).map((p) => (new Date(p.receivedAt!).getTime() - new Date(p.sentAt!).getTime()) / 86_400_000); return d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : undefined; };
const vendorLastOrder = (vendorId: string): string | undefined => [...rs.pos.filter((p) => p.vendorId === vendorId && p.status !== 'cancelled').map((p) => p.sentAt ?? p.createdAt), ...inv.history.filter((h) => h.vendorId === vendorId).map((h) => h.at)].sort().pop();
export async function getVendorSummaries(): Promise<VendorSummary[]> {
  return resolve(rs.vendors.map((v): VendorSummary => ({ vendor: { ...v }, partsLinked: vendorLinkedParts(v.id).length, lastOrderAt: vendorLastOrder(v.id), avgTurnaroundDays: vendorTurnaround(v.id), openPos: vendorOpenPos(v.id) })).sort((a, b) => Number(b.vendor.active) - Number(a.vendor.active) || a.vendor.name.localeCompare(b.vendor.name)));
}
export interface VendorDetail { summary: VendorSummary; parts: VendorPartRow[]; openPos: PurchaseOrderWithRefs[]; pastPos: PurchaseOrderWithRefs[]; history: (PurchaseHistoryRow & { partNumber: string; partName: string })[] }
// Detail = every vendor-scoped thing already built, rolled up: parts ranked by last price paid (pricing intelligence), open / past POs, purchase history
export async function getVendorDetail(id: string): Promise<VendorDetail> {
  const v = byId(rs.vendors, id); const s = (await getVendorSummaries()).find((x) => x.vendor.id === id)!;
  const parts = vendorLinkedParts(id).map((pid): VendorPartRow => { const p = byId(store.parts, pid); const pr = partPricingSync(pid); const mine = pr.vendors.find((x) => x.vendorId === id); const other = pr.vendors.filter((x) => x.vendorId !== id).sort((a, b) => a.lastPrice - b.lastPrice)[0]; return { partId: pid, partNumber: p.partNumber, name: p.name, lastPrice: mine?.lastPrice, lastAt: mine?.lastAt, buys: mine?.buys ?? 0, avgCost: pr.avgCost, cheapestElsewhere: other && mine && other.lastPrice < mine.lastPrice ? { vendorName: other.vendorName, price: other.lastPrice } : undefined }; })
    .sort((a, b) => (b.lastPrice ?? -1) - (a.lastPrice ?? -1) || a.partNumber.localeCompare(b.partNumber));
  const pos = rs.pos.filter((p) => p.vendorId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(poRefs);
  const isOpen = (p: PurchaseOrder) => p.status === 'draft' || p.status === 'sent' || p.status === 'partially_received';
  void v;
  return resolve({ summary: s, parts, openPos: pos.filter(isOpen), pastPos: pos.filter((p) => !isOpen(p)), history: vendorHistory(id).map((h) => { const p = store.parts.find((x) => x.id === h.partId); return { ...h, partNumber: p?.partNumber ?? h.partId, partName: p?.name ?? '' }; }) });
}
export async function setVendorActive(id: string, active: boolean): Promise<Vendor> { const v = byId(rs.vendors, id); v.active = active; rsStamp('purchasing', `Vendor ${active ? 'reactivated' : 'retired'} · ${v.name}`); return resolve({ ...v }); }
export async function getPurchaseOrders(): Promise<PurchaseOrderWithRefs[]> { autoPoSweepSync(); return resolve([...rs.pos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(poRefs)); }
export async function getPurchaseOrder(id: string): Promise<PurchaseOrderWithRefs | null> { const p = rs.pos.find((x) => x.id === id); return resolve(p ? poRefs(p) : null); }
export interface POLineInput { partId: string; qty: number; unitCost: number }
export async function createPurchaseOrder(input: { vendorId: string; locationId: string; lines: POLineInput[]; memo?: string }): Promise<PurchaseOrderWithRefs> {
  const vendor = byId(rs.vendors, input.vendorId); if (!vendor.active) throw new Error('Vendor is retired');
  if (!input.lines.length) throw new Error('Add at least one line'); const a = actor();
  const p: PurchaseOrder = { id: newId('po'), number: `PO-26-${String(++rs.counters.po).padStart(4, '0')}`, vendorId: vendor.id, status: 'draft', division: getSessionDivision(), locationId: input.locationId, memo: input.memo?.trim() || undefined, total: 0, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station,
    lines: input.lines.map((l) => { const pt = byId(store.parts, l.partId); return { id: newId('pol'), partId: pt.id, partNumber: pt.partNumber, description: pt.name, qty: Math.max(1, l.qty), unitCost: l.unitCost, receivedQty: 0 }; }) };
  poTotal(p); rs.pos.unshift(p);
  rsStamp('purchasing', `${p.number} created · ${vendor.name} · ${p.lines.length} lines · ${fmtMoney(p.total)}`);
  return resolve(poRefs(p));
}
export async function sendPurchaseOrder(id: string): Promise<PurchaseOrderWithRefs> {
  const p = byId(rs.pos, id); if (p.status !== 'draft') throw new Error('Only a draft PO can be sent');
  if (p.auto && actor().user?.accessTier !== 'manager') throw new Error('Auto-PO send needs MH or a manager with PO rights');
  if (poRedLines(p).length && !p.redAcknowledgedBy) throw new Error(`${poRedLines(p).length} line(s) are more than 10% above your average — acknowledge them before sending`);
  p.status = 'sent'; p.sentAt = new Date().toISOString(); const v = byId(rs.vendors, p.vendorId); const a = actor(); resolveSystemPin(`auto-po:${p.id}`, `sent by ${a.by}`);
  queueOutbox({ id: `ob-${Date.now().toString(36)}`, to: v.email, toName: v.name, relatedRef: p.number, status: 'pending', subject: `Purchase order ${p.number}`, body: `${p.lines.map((l) => `• ${l.partNumber} ${l.description} × ${l.qty} @ ${fmtMoney(l.unitCost)}`).join('\n')}\n\nTotal ${fmtMoney(p.total)} · ${v.terms}${p.labelUrl ? `\n\nPrepaid return label attached (${p.labelService}${p.trackingNumber ? ` · ${p.trackingNumber}` : ''}).` : ''}\n\n— RolliSuite purchasing (STUB — not sent)`, createdAt: p.sentAt, createdBy: a.by, station: a.station });
  rsStamp('purchasing', `${p.number} sent to ${v.name} (stub · Sent)`); return resolve(poRefs(p));
}
export async function cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderWithRefs> {
  const p = byId(rs.pos, id); if (!reason.trim()) throw new Error('A reason is required'); if (p.status === 'received' || p.status === 'cancelled') throw new Error('PO is already closed');
  p.status = 'cancelled'; p.cancelledAt = new Date().toISOString(); p.cancelReason = reason.trim(); rsStamp('purchasing', `${p.number} cancelled · ${p.cancelReason}`); resolveSystemPin(`auto-po:${p.id}`, `cancelled · ${p.cancelReason}`); autoPoSweepSync(); return resolve(poRefs(p));
}
// Receive against PO: each received line increments stock at the PO's location with an audited movement
export async function receivePurchaseOrder(id: string, qtyByLine: Record<string, number>, putawayLocationId?: string): Promise<PurchaseOrderWithRefs> {
  const p = byId(rs.pos, id); if (!['sent', 'partially_received'].includes(p.status)) throw new Error('PO must be sent before receiving');
  let any = false; const dest = putawayLocationId ?? p.locationId; const a0 = actor();
  p.lines.forEach((l) => { const want = qtyByLine[l.id] ?? 0; const q = Math.min(want, l.qty - l.receivedQty); if (want > l.qty - l.receivedQty) rsStamp('purchasing', `${p.number} · ${l.partNumber} OVERAGE: ${want} arrived vs ${l.qty - l.receivedQty} open — flagged`); if (q > 0) { l.receivedQty += q; any = true; move('receipt', l.partId, dest, q, `Received against ${p.number}`, { ref: p.number, poId: p.id }); inv.history.push({ id: newId('ph'), at: new Date().toISOString(), vendorId: p.vendorId, partId: l.partId, qty: q, unitPrice: l.unitCost, poNumber: p.number });
    if (l.requestId) { const r = store.partsRequests.find((x) => x.id === l.requestId); if (r && r.status !== 'received') { r.status = 'received'; partsStamp(r, `received against ${p.number} · +${q} at ${byId(rs.locations, dest).name}`); const j = getJobRow(r.jobId); const h = activeHold(j); if (h && h.reason.includes(r.number)) { h.releasedAt = new Date().toISOString(); h.releasedBy = a0.by; } const requester = fx.users.find((u) => u.shortName === r.requestedBy); store.pinned.unshift({ id: newId('pin'), title: `Parts received · ${r.number} ${l.partNumber} for ${j.number} — back on the bench`, assignedTo: requester ? { type: 'user', shortName: requester.shortName } : { type: 'role', role: 'manager' }, createdBy: a0.by, jobId: j.id, createdAt: new Date().toISOString(), station: a0.station, division: j.division }); } }
    inv.needs = inv.needs.filter((n) => n.partId !== l.partId); } });
  if (!any) throw new Error('Enter a quantity to receive');
  const done = p.lines.every((l) => l.receivedQty >= l.qty); p.status = done ? 'received' : 'partially_received'; if (done) p.receivedAt = new Date().toISOString();
  rsStamp('purchasing', `${p.number} ${done ? 'fully received' : 'partially received'}`); autoPoSweepSync(); return resolve(poRefs(p));
}

// -- Inventory
export async function getLocations(): Promise<StockLocation[]> { return resolve([...rs.locations]); }
export async function getStockRows(): Promise<StockRow[]> {
  ensurePartsModule(); return resolve(rs.stock.map((s): StockRow => { const r = getReorderRule(s.partId); return { part: byId(store.parts, s.partId), location: byId(rs.locations, s.locationId), onHand: s.onHand, reorderPoint: r.min, low: r.min > 0 && onHandOf(s.partId) + onOrderOf(s.partId) <= r.min }; }).sort((a, b) => Number(b.low) - Number(a.low) || a.part.partNumber.localeCompare(b.part.partNumber)));
}
export async function getLowStock(): Promise<StockRow[]> { return (await getStockRows()).filter((r) => r.low); }
export async function getStockMovements(partId?: string): Promise<StockMovement[]> { return resolve(rs.movements.filter((m) => !partId || m.partId === partId).sort((a, b) => b.at.localeCompare(a.at))); }
export async function adjustStock(partId: string, locationId: string, delta: number, reason: string): Promise<StockMovement> {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Enter a non-zero whole number'); if (!reason.trim()) throw new Error('A reason is required');
  if (stockAt(partId, locationId).onHand + delta < 0) throw new Error('Stock cannot go negative'); const mv = move('adjustment', partId, locationId, delta, reason.trim()); autoPoSweepSync(); return resolve(mv);
}
export async function getCycleCounts(): Promise<CycleCount[]> { return resolve([...rs.counts].sort((a, b) => b.at.localeCompare(a.at))); }
export async function startCycleCount(locationId: string): Promise<CycleCount> {
  if (rs.counts.some((c) => c.locationId === locationId && c.status === 'open')) throw new Error('A count is already open for this location'); const a = actor();
  const c: CycleCount = { id: newId('cc'), number: `CC-26-${String(++rs.counters.cc).padStart(4, '0')}`, locationId, status: 'open', lines: rs.stock.filter((s) => s.locationId === locationId).map((s) => ({ partId: s.partId, expected: s.onHand })), variances: 0, at: new Date().toISOString(), by: a.by, station: a.station };
  if (!c.lines.length) throw new Error('Nothing stocked at this location'); rs.counts.unshift(c); rsStamp('inventory', `${c.number} started · ${byId(rs.locations, locationId).name}`); return resolve({ ...c });
}
export async function postCycleCount(id: string, counted: Record<string, number>): Promise<CycleCount> {
  const c = byId(rs.counts, id); if (c.status !== 'open') throw new Error('Count already posted'); const a = actor();
  c.lines.forEach((l) => { l.counted = counted[l.partId]; if (l.counted === undefined) throw new Error('Count every line'); });
  c.variances = 0; c.lines.forEach((l) => { const d = (l.counted ?? 0) - l.expected; if (d !== 0) { c.variances += 1; move('count', l.partId, c.locationId, d, `Cycle count ${c.number} variance ${d > 0 ? '+' : ''}${d}`, { ref: c.number, countId: c.id }); } });
  c.status = 'posted'; c.postedAt = new Date().toISOString(); c.postedBy = a.by; rsStamp('inventory', `${c.number} posted · ${c.variances} variance${c.variances === 1 ? '' : 's'}`); autoPoSweepSync(); return resolve({ ...c });
}

// -- Labels (batch reprint → existing Label Queue, unprinted)
// Band-only jobs have no watch head → no ref#/serial# to encode. Same PDF417 format, but the payload carries the job number so a scan still resolves to job → client with no name involved.
export const isBandOnlyJob = (j: Job, w?: Watch) => j.workflow.length > 0 && j.workflow.every((d) => d === 'B') && !(w?.reference && w?.serial);
export const bandLabelPayload = (num: string, workflow: DeptCode[]) => `${num}|BAND|${num}|NS|${workflow.join(',')}`;
export async function queueLabelsFor(kind: 'estimate' | 'job' | 'watch', ids: string[]): Promise<LabelJob[]> {
  const out: LabelJob[] = [];
  ids.forEach((id) => {
    const job = kind === 'job' ? store.jobs.find((j) => j.id === id) : kind === 'watch' ? store.jobs.find((j) => j.watchId === id) : store.jobs.find((j) => j.estimateId === id);
    const est = kind === 'estimate' ? store.estimates.find((e) => e.id === id) : job?.estimateId ? store.estimates.find((e) => e.id === job.estimateId) : undefined;
    const w = kind === 'watch' ? store.watches.find((x) => x.id === id) : job ? store.watches.find((x) => x.id === job.watchId) : est?.watchId ? store.watches.find((x) => x.id === est.watchId) : undefined;
    if (!w) return; const c = byId(fx.clients, w.clientId); const num = job?.number ?? est?.number ?? w.id; const pkgId = job?.packageId ?? store.packages.find((p) => p.estimateId === est?.id)?.id ?? '';
    if (job && isBandOnlyJob(job, w)) { out.push(queueLabel({ type: 'pdf417_data', packageId: pkgId, estimateNumber: num, payload: bandLabelPayload(num, job.workflow), lines: [num, `${c.firstName} ${c.lastName}`, 'BAND ONLY · scan = job #', `Workflow ${job.workflow.join(' · ')}`] })); return; }
    out.push(queueLabel({ type: 'pdf417_data', packageId: pkgId, estimateNumber: num, payload: `${num}|${w.reference}|${w.serial}|${job?.workflow.join(',') ?? ''}`, lines: [num, `${c.firstName} ${c.lastName}`, job ? `Workflow ${job.workflow.join(' · ')}` : 'Reprint'] }));
    out.push(queueLabel({ type: 'ref_serial', packageId: pkgId, estimateNumber: num, payload: `${w.reference} / ${w.serial}`, lines: [`${w.brand} ${w.model}`, `Ref ${w.reference}`, `Serial ${w.serial}`] }));
  });
  if (!out.length) throw new Error('Nothing matched — pick records with a watch');
  rsStamp('labels', `${out.length} labels queued (batch reprint by ${kind})`); return resolve(out);
}
export async function queueJobLabels(jobId: string): Promise<LabelJob[]> { const j = getJobRow(jobId); const w = byId(store.watches, j.watchId); const out = await queueLabelsFor('job', [jobId]); jobStamp(j, `${out.length} label${out.length === 1 ? '' : 's'} queued${isBandOnlyJob(j, w) ? ' · band-only PDF417 (job #)' : ' · PDF417 + ref/serial'}`); return out; }

// ---- Scan-to-client — a label scan resolves job → client by ID; never through a name ----
export interface ScanResolution { client: Client; job?: Job; estimate?: Estimate; watch?: Watch; via: 'job' | 'estimate' | 'ref_serial'; scanned: string }
export async function resolveScan(raw: string): Promise<ScanResolution | null> {
  const s = raw.trim().toUpperCase(); if (!s) return resolve(null);
  const toks = s.split(/[^A-Z0-9-]+/).filter(Boolean);
  for (const t of toks) {
    const j = store.jobs.find((x) => x.number.toUpperCase() === t); if (j) return resolve({ client: byId(fx.clients, j.clientId), job: j, estimate: j.estimateId ? store.estimates.find((e) => e.id === j.estimateId) : undefined, watch: store.watches.find((w) => w.id === j.watchId), via: 'job', scanned: s });
    const e = store.estimates.find((x) => x.number.toUpperCase() === t); if (e) return resolve({ client: byId(fx.clients, e.clientId), estimate: e, job: e.jobId ? store.jobs.find((x) => x.id === e.jobId) : undefined, watch: e.watchId ? store.watches.find((w) => w.id === e.watchId) : undefined, via: 'estimate', scanned: s });
  }
  const rs = parseRefSerial(s); if (!rs) return resolve(null);
  const w = store.watches.find((x) => x.reference && x.serial && x.reference.toUpperCase() === rs.reference && x.serial.toUpperCase() === rs.serial); if (!w) return resolve(null);
  const j = store.jobs.filter((x) => x.watchId === w.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return resolve({ client: byId(fx.clients, w.clientId), job: j, estimate: j?.estimateId ? store.estimates.find((e) => e.id === j.estimateId) : undefined, watch: w, via: 'ref_serial', scanned: s });
}
// Duplicate-name detection — EXACT full-name match only (v1); near-matches are an open decision
const nameKey = (c: Client) => `${c.firstName} ${c.lastName}`.trim().toLowerCase().replace(/\s+/g, ' ');
export const sameNameClients = (c: Client): Client[] => fx.clients.filter((x) => x.id !== c.id && nameKey(x) === nameKey(c));
export const duplicateNamesIn = (hits: Client[]): string[] => { const seen = new Map<string, number>(); hits.forEach((c) => seen.set(nameKey(c), (seen.get(nameKey(c)) ?? 0) + 1)); return hits.filter((c) => (seen.get(nameKey(c)) ?? 0) > 1 || sameNameClients(c).length > 0).map((c) => `${c.firstName} ${c.lastName}`).filter((n, i, a) => a.indexOf(n) === i); };

// -- Reports (each reconciles with getDashboardStats)
const monthKey = (iso: string) => iso.slice(0, 7);
const ageBucket = (iso: string) => { const d = (Date.now() - new Date(iso).getTime()) / 86_400_000; return d <= 7 ? '0–7d' : d <= 30 ? '8–30d' : d <= 90 ? '31–90d' : '90d+'; };
const isLabor = (l: EstimateLine) => l.type === 'service';
export async function getReport(key: 'funnel' | 'throughput' | 'aging' | 'pnl' | 'completions'): Promise<Report> {
  const now = new Date().toISOString(); const es = store.estimates; const js = store.jobs;
  if (key === 'completions') { const c = await getCompletionsReport(); const cell = (x?: { total: number; byDept: Record<DeptCode, number> }) => (x ? `${x.total} (${(['W', 'B', 'P', 'PM'] as DeptCode[]).filter((d) => x.byDept[d]).map((d) => `${d}${x.byDept[d]}`).join(' ') || '—'})` : '');
    return resolve({ key, title: 'Component completions by tech × month', columns: ['tech', ...c.months, 'total'], note: 'Credits each tech in the month their component completed (head / band / case), regardless of when the job invoices — MH ruling. Cell = count (by department). Invoicing is untouched.', generatedAt: now,
      rows: [...c.rows.map((r) => ({ label: r.tech, values: Object.fromEntries([['tech', r.tech], ...c.months.map((m) => [m, cell(r.months[m])]), ['total', r.total]]) })), ...c.rows.map((r) => { const qs = c.months.map((m) => techQuality(r.tech, m)); const all = qs.filter((q) => q.n); return { label: `quality-${r.tech}`, values: Object.fromEntries([['tech', `${r.tech} — quality (avg grade)`], ...c.months.map((m, i) => { const q = qs[i]; return [m, q.n ? `${q.avg} avg · ${Object.values(q.byCategory).map((b) => `${b.label.toLowerCase()} ${b.avg}`).join(' · ')} · n=${q.n}${q.low ? ` · ${q.low} low` : ''}${q.selfGraded ? ` · ${q.selfGraded} self` : ''}` : '—']; }), ['total', all.length ? `${Math.round((all.reduce((t, q) => t + (q.avg ?? 0) * q.n, 0) / all.reduce((t, q) => t + q.n, 0)) * 10) / 10} avg` : '—']]) }; }), { label: 'total', values: { tech: 'Total completions', total: c.rows.reduce((t, r) => t + r.total, 0) } }] }); }
  if (key === 'funnel') return resolve({ key, title: 'Estimate funnel', columns: ['stage', 'count', 'value'], note: 'created = all estimates · sent = ever sent (status ≥ sent) · approved = approved or converted · converted = has a job. "Awaiting approval" on the dashboard = status sent.', generatedAt: now, rows: [
    { label: 'created', values: { stage: 'Created', count: es.length, value: es.reduce((t, e) => t + e.total, 0) } },
    { label: 'sent', values: { stage: 'Sent', count: es.filter((e) => e.status !== 'draft').length, value: es.filter((e) => e.status !== 'draft').reduce((t, e) => t + e.total, 0) } },
    { label: 'approved', values: { stage: 'Approved', count: es.filter((e) => e.status === 'approved' || e.status === 'converted').length, value: es.filter((e) => e.status === 'approved' || e.status === 'converted').reduce((t, e) => t + e.total, 0) } },
    { label: 'converted', values: { stage: 'Converted', count: es.filter((e) => e.status === 'converted').length, value: es.filter((e) => e.status === 'converted').reduce((t, e) => t + e.total, 0) } },
    { label: 'open', values: { stage: 'Open now (draft + sent)', count: es.filter((e) => OPEN_ESTIMATE.includes(e.status)).length, value: es.filter((e) => OPEN_ESTIMATE.includes(e.status)).reduce((t, e) => t + e.total, 0) } } ] });
  if (key === 'throughput') { const months = uniq(js.map((j) => monthKey(j.createdAt))).sort().reverse().slice(0, 6); const wf = uniq(js.map((j) => j.workflow.join('+'))).sort();
    return resolve({ key, title: 'Job throughput by workflow × month', columns: ['workflow', ...months, 'total'], note: 'Counts jobs by creation month; closed shown in parentheses. Dashboard "in progress" = approved + in_service + testing across all months.', generatedAt: now,
      rows: [...wf.map((w) => ({ label: w, values: Object.fromEntries([['workflow', w], ...months.map((m) => { const g = js.filter((j) => j.workflow.join('+') === w && monthKey(j.createdAt) === m); return [m, `${g.length} (${g.filter((j) => j.status === 'closed').length})`]; }), ['total', js.filter((j) => j.workflow.join('+') === w).length]]) })),
        { label: 'in_progress', values: { workflow: 'In progress now (dashboard)', total: js.filter((j) => ACTIVE_JOB.includes(j.status)).length } }] }); }
  if (key === 'aging') { const b = ['0–7d', '8–30d', '31–90d', '90d+']; const openJ = js.filter((j) => j.status !== 'closed'); const openE = es.filter((e) => OPEN_ESTIMATE.includes(e.status));
    return resolve({ key, title: 'Aging — open jobs & estimates', columns: ['bucket', 'open jobs', 'held jobs', 'open estimates', 'estimate value'], note: 'Age from createdAt. Open estimates = draft + sent (matches dashboard). Held = active hold.', generatedAt: now,
      rows: b.map((k) => ({ label: k, values: { bucket: k, 'open jobs': openJ.filter((j) => ageBucket(j.createdAt) === k).length, 'held jobs': openJ.filter((j) => ageBucket(j.createdAt) === k && activeHold(j)).length, 'open estimates': openE.filter((e) => ageBucket(e.createdAt) === k).length, 'estimate value': openE.filter((e) => ageBucket(e.createdAt) === k).reduce((t, e) => t + e.total, 0) } })) }); }
  // Q5 (amended): Sales by FIRST INVOICE SEND date — each order invoiced this month is allocated across its job's lines pro rata (labor → W/B/P/PM, goods → no_dept_product); current total, original month
  const paid = salesThisMonth(); const depts: DeptCode[] = ['W', 'B', 'P', 'PM']; const lineAmt = (l: { qty: number; unitPrice: number }) => l.qty * l.unitPrice;
  const alloc = (pick: (l: Job['lines'][number]) => boolean) => paid.reduce((t, p) => { if (!p.job) return t; const all = p.job.lines.reduce((s, l) => s + lineAmt(l), 0); if (!all) return t; return t + p.amount * (p.job.lines.filter(pick).reduce((s, l) => s + lineAmt(l), 0) / all); }, 0);
  const jobsPaid = (pick: (l: Job['lines'][number]) => boolean) => new Set(paid.filter((p) => p.job?.lines.some(pick)).map((p) => p.job!.id)).size;
  return resolve({ key, title: 'Department sales (by invoice-sent date) — this month', columns: ['department', 'sales (invoiced)', 'orders invoiced'], note: 'Q5 (amended 2026-09-29): a sale is dated by the FIRST invoice send (Sent timestamp); edits adjust the original month, re-sends never re-date. Each order is split across its job’s lines pro rata; labor (type service) → W/B/P/PM, parts & shipping → no_dept_product. Zero-total / zero-balance orders never appear (Completions only). Payment date is A/R + gate + cash only. Sum of all rows = dashboard "Sales this month" = QBO invoice-date view.', generatedAt: now,
    rows: [...depts.map((d) => ({ label: d, values: { department: `${fx.DEPT_LABEL[d]} (${d})`, 'sales (invoiced)': alloc((l) => isLabor(l) && l.dept === d), 'orders invoiced': jobsPaid((l) => isLabor(l) && l.dept === d) } })),
      { label: 'no_dept_product', values: { department: 'no_dept_product (goods + shipping)', 'sales (invoiced)': alloc((l) => !isLabor(l)), 'orders invoiced': jobsPaid((l) => !isLabor(l)) } },
      { label: 'total', values: { department: 'Total = dashboard Sales this month', 'sales (invoiced)': paid.reduce((t, p) => t + p.amount, 0), 'orders invoiced': paid.length } }] });
}
export const reportToCsv = (r: Report): string => [r.columns.join(','), ...r.rows.map((row) => r.columns.map((c) => { const v = row.values[c] ?? ''; return typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v); }).join(','))].join('\n');

// -- Accounting (QBO stub views)
export async function getQboQueue(): Promise<QboQueueRow[]> {
  return resolve(store.salesOrders.filter((o) => o.status !== 'draft' && o.status !== 'cancelled').map((o): QboQueueRow => (o.zeroBalance ? { salesOrderId: o.id, number: o.number, client: fullNameOf(byId(fx.clients, o.clientId)), total: o.total, qboInvoiceId: undefined, syncState: 'excluded_no_sync', exclusion: `${ZERO_REASON_LABEL[o.zeroBalance.reason]} · ${o.zeroBalance.by} · ${o.zeroBalance.notes}`, at: o.zeroBalance.at } : { salesOrderId: o.id, number: o.number, client: clientName(o.clientId), total: o.total, qboInvoiceId: o.qboInvoiceId, syncState: o.qboStatus === 'queued' ? (o.number.endsWith('5') ? 'error_stub' : o.status === 'picked_up' || o.status === 'shipped' ? 'pushed_stub' : 'queued') : 'not_queued', at: o.fulfilledAt ?? o.orderDate })).sort((a, b) => b.at.localeCompare(a.at)));
}
export async function exportAccountingCsv(kind: 'invoices' | 'payments' | 'qbo'): Promise<string> {
  rsStamp('accounting', `Export file generated · ${kind} (stub CSV)`);
  if (kind === 'payments') return resolve(['so,date,method,amount,by', ...store.salesOrders.flatMap((o) => o.payments.map((p) => `${o.number},${p.at},${p.method},${p.amount.toFixed(2)},${p.by}`))].join('\n'));
  if (kind === 'qbo') return resolve(['so,qbo_id,state,total', ...(await getQboQueue()).map((r) => `${r.number},${r.qboInvoiceId ?? ''},${r.syncState},${r.total.toFixed(2)}`)].join('\n'));
  return resolve(['so,client,status,total,paid,balance', ...store.salesOrders.map((o) => `${o.number},"${clientName(o.clientId)}",${o.status},${o.total.toFixed(2)},${(o.total - o.balanceDue).toFixed(2)},${o.balanceDue.toFixed(2)}`)].join('\n'));
}
export async function getIntegrations(): Promise<IntegrationTile[]> { return resolve(fx.integrations.map((t) => ({ ...t, lastCheck: new Date().toISOString() }))); }

// -- Setup: users & roles (mock), catalog editor, message templates
export async function adminSaveUser(input: UserAdminInput & { id?: string }): Promise<User> {
  const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Managing users needs a manager');
  if (!input.firstName.trim() || !input.shortName.trim()) throw new Error('Name and short name are required'); if (!/^\d{4}$/.test(input.pin)) throw new Error('PIN must be 4 digits'); if (input.password.length < 4) throw new Error('Password too short');
  if (!input.roles.length) throw new Error('Pick at least one role');
  const existing = input.id ? fx.users.find((u) => u.id === input.id) : undefined;
  if (!existing && fx.users.some((u) => u.shortName.toLowerCase() === input.shortName.trim().toLowerCase())) throw new Error('Short name already in use');
  const u: User = existing ?? { id: `u-${input.firstName.trim().toLowerCase()}-${Date.now().toString(36).slice(-3)}`, firstName: '', shortName: '', displayName: '', dutyLabel: '', accessTier: 'concierge', roles: [], division: 'rolliworks', password: '', pin: '' };
  Object.assign(u, { firstName: input.firstName.trim().toLowerCase(), shortName: input.shortName.trim(), dutyLabel: input.dutyLabel.trim(), accessTier: input.accessTier, roles: [...input.roles], division: input.division, password: input.password, pin: input.pin, displayName: `${input.shortName.trim()} — ${input.dutyLabel.trim() || input.roles.join(' · ')}` });
  if (!existing) fx.users.push(u);
  rsStamp('setup', `User ${existing ? 'updated' : 'created'} · ${u.shortName} · ${u.accessTier} · ${u.roles.join('/')} · ${u.division}`); return resolve({ ...u });
}
export async function adminDeactivateUser(id: string): Promise<void> {
  const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Managing users needs a manager'); if (a.user.id === id) throw new Error('You cannot deactivate yourself');
  const u = byId(fx.users, id); if (fx.users.filter((x) => x.accessTier === 'manager').length <= 1 && u.accessTier === 'manager') throw new Error('Keep at least one manager');
  fx.users.splice(fx.users.indexOf(u), 1); rsStamp('setup', `User deactivated · ${u.shortName}`); return resolve(undefined);
}
export async function getCatalogAdmin(): Promise<(CatalogService & { retired: boolean })[]> { return resolve(rs.catalog.map((c) => ({ ...c }))); }
export async function saveCatalogService(input: { id?: string; name: string; dept: DeptCode; rate: number; type: LineType }): Promise<CatalogService> {
  if (!input.name.trim()) throw new Error('Service name is required'); if (!(input.rate >= 0)) throw new Error('Rate must be ≥ 0');
  const existing = input.id ? rs.catalog.find((c) => c.id === input.id) : undefined;
  const row = existing ? Object.assign(existing, { name: input.name.trim(), dept: input.dept, rate: input.rate, type: input.type }) : { id: newId('cat'), name: input.name.trim(), dept: input.dept, rate: input.rate, type: input.type, retired: false };
  if (!existing) { rs.catalog.push(row); fx.catalog.push({ id: row.id, name: row.name, dept: row.dept, rate: row.rate, type: row.type }); } else { const live = fx.catalog.find((c) => c.id === row.id); if (live) Object.assign(live, { name: row.name, dept: row.dept, rate: row.rate, type: row.type }); }
  rsStamp('setup', `Catalog service ${existing ? 'updated' : 'added'} · ${row.name} · ${row.dept} · ${fmtMoney(row.rate)}`); return resolve({ id: row.id, name: row.name, dept: row.dept, rate: row.rate, type: row.type });
}
export async function retireCatalogService(id: string, retired = true): Promise<void> {
  const row = byId(rs.catalog, id); row.retired = retired; const i = fx.catalog.findIndex((c) => c.id === id);
  if (retired && i >= 0) fx.catalog.splice(i, 1); if (!retired && i < 0) fx.catalog.push({ id: row.id, name: row.name, dept: row.dept, rate: row.rate, type: row.type });
  rsStamp('setup', `Catalog service ${retired ? 'retired' : 'restored'} · ${row.name}`); return resolve(undefined);
}
export { MERGE_FIELDS } from './fixtures/rs';
const TEMPLATE_META: Record<string, { audience: TemplateAudience; usedBy: string }> = { intake_confirmation: { audience: 'client', usedBy: 'Receive Package (Stage 2)' }, estimate_sent: { audience: 'client', usedBy: 'Estimate → Send' }, job_in_progress: { audience: 'client', usedBy: 'Job status change' }, back_in_progress: { audience: 'client', usedBy: 'QC fail → rework' }, ready_for_pickup: { audience: 'client', usedBy: 'Job finished · pickup channel' }, shipped: { audience: 'client', usedBy: 'Ship Station confirm' }, inspection_ready: { audience: 'client', usedBy: 'Issue inspection report' }, invoice_ready: { audience: 'client', usedBy: 'Sales order → Send invoice' }, evidence_available: { audience: 'client', usedBy: 'QC pass · evidence' }, shipping_dispute: { audience: 'vendor', usedBy: 'Bill audit → dispute report' }, po_email: { audience: 'vendor', usedBy: 'Purchasing → Send PO' }, receiving_report: { audience: 'internal', usedBy: 'Purchasing → Receive against PO' }, appointment_confirmation: { audience: 'client', usedBy: 'Schedule / booking page' }, package_accepted: { audience: 'client', usedBy: 'Scan 1 → shelved' }, swo_outbound: { audience: 'vendor', usedBy: 'Shop Work Order → Create outbound label' }, swo_return_label: { audience: 'vendor', usedBy: 'Shop Work Order → Queue return label' } };
export async function getTemplates(): Promise<MessageTemplate[]> { return resolve(rs.templates.map((t) => ({ ...t, ...TEMPLATE_META[t.key], active: t.active ?? true }))); }
export async function setTemplateActive(key: TemplateKey, active: boolean): Promise<MessageTemplate> { const t = rs.templates.find((x) => x.key === key); if (!t) throw new Error('Unknown template'); t.active = active; rsStamp('setup', `Template ${active ? 'reactivated' : 'retired'} · ${t.name}`); return resolve({ ...t, ...TEMPLATE_META[t.key], active }); }
export async function saveTemplate(key: TemplateKey, subject: string, body: string): Promise<MessageTemplate> {
  const t = rs.templates.find((x) => x.key === key); if (!t) throw new Error('Unknown template'); if (!subject.trim() || !body.trim()) throw new Error('Subject and body are required'); const a = actor();
  Object.assign(t, { subject: subject.trim(), body: body.trim(), mergeFields: fx.MERGE_FIELDS.filter((f) => body.includes(f) || subject.includes(f)), at: new Date().toISOString(), by: a.by, station: a.station, updatedBy: a.by });
  rsStamp('setup', `Template saved · ${t.name}`); return resolve({ ...t });
}

// -- Service Evidence (MH 2026-09-24): four slots at QC, keyed to watch identity AND job
export const EVIDENCE_SLOTS: { key: EvidenceSlot; label: string; hint: string }[] = [
  { key: 'hidden_serial', label: 'Hidden serial', hint: 'Between-lugs / rehaut serial, legible' },
  { key: 'timing_sheet', label: 'Timing sheet', hint: 'Convention: BEFORE on the left, AFTER on the right' },
  { key: 'pressure_test', label: 'Pressure test', hint: 'Record the depth rating tested (e.g. 50M/164ft)' },
  { key: 'parts_grading', label: 'Parts grading', hint: 'Tag grades: B · Ø/REPL · D/REPL' },
];
export const PARTS_GRADES: PartsGrade[] = ['B', 'Ø/REPL', 'D/REPL'];
// Per-kind expected slots — service expects all four; small_job / warranty fewer (PROVISIONAL)
export const EVIDENCE_REQUIRED: Record<JobKind, EvidenceSlot[]> = { service: ['hidden_serial', 'timing_sheet', 'pressure_test', 'parts_grading'], small_job: ['hidden_serial'], warranty: ['hidden_serial', 'timing_sheet'], trade: ['hidden_serial'] };
export const evidenceGaps = (j: Job): EvidenceSlot[] => (j.status !== 'testing' ? [] : EVIDENCE_REQUIRED[j.kind].filter((s) => !rs.evidence.some((e) => e.jobId === j.id && e.slot === s)));
export async function getEvidenceForJob(jobId: string): Promise<EvidenceItem[]> { return resolve(rs.evidence.filter((e) => e.jobId === jobId).sort((a, b) => b.at.localeCompare(a.at))); }
export async function getEvidenceForWatch(watchId: string): Promise<(EvidenceItem & { jobNumber: string; serviceDate: string })[]> {
  return resolve(rs.evidence.filter((e) => e.watchId === watchId).map((e) => { const j = store.jobs.find((x) => x.id === e.jobId); return { ...e, jobNumber: j?.number ?? e.jobId, serviceDate: (j?.finishedAt ?? j?.createdAt ?? e.at).slice(0, 10) }; }).sort((a, b) => b.at.localeCompare(a.at)));
}
export async function getEvidenceForClient(clientId: string): Promise<(EvidenceItem & { jobNumber: string; serviceDate: string; watchLabel: string })[]> {
  const ws = store.watches.filter((w) => w.clientId === clientId);
  const rows = await Promise.all(ws.map(async (w) => (await getEvidenceForWatch(w.id)).map((e) => ({ ...e, watchLabel: `${w.brand} ${w.model}` }))));
  return resolve(rows.flat().sort((a, b) => b.at.localeCompare(a.at)));
}
export interface EvidenceInput { slot: EvidenceSlot; photo: PackagePhoto; labelScan: string; grades?: PartsGrade[]; depthRating?: string; note?: string; extracted?: unknown }
export async function captureEvidence(jobId: string, input: EvidenceInput): Promise<EvidenceItem> {
  const j = getJobRow(jobId); const w = byId(store.watches, j.watchId); const scan = input.labelScan.trim().toUpperCase();
  if (!scan) throw new Error('Scan or enter the watch label first — evidence must key to the watch');
  const okScan = [j.number, w.reference, w.serial, `${w.reference} / ${w.serial}`, `${w.reference}/${w.serial}`].map((s) => s.toUpperCase()).some((s) => scan === s || scan.startsWith(`${j.number}|`) || scan.includes(w.serial.toUpperCase()));
  if (!okScan) throw new Error(`Label does not match this watch (expected ${j.number}, ref ${w.reference} or serial ${w.serial})`);
  if (input.slot === 'pressure_test' && !/^\d+\s*M\s*\/\s*\d+\s*FT$/i.test(input.depthRating?.trim() ?? '')) throw new Error('Depth rating must look like 50M/164ft');
  if (input.slot === 'parts_grading' && !input.grades?.length) throw new Error('Tag at least one grade (B · Ø/REPL · D/REPL)');
  const a = actor();
  const e: EvidenceItem = { id: `ev-${++rs.counters.ev}`, jobId, watchId: w.id, slot: input.slot, photo: input.photo, labelScan: scan, grades: input.slot === 'parts_grading' ? input.grades : undefined, depthRating: input.slot === 'pressure_test' ? input.depthRating!.trim().toUpperCase().replace(/\s/g, '') : undefined, note: input.note?.trim() || (input.slot === 'timing_sheet' ? 'before left / after right' : undefined), at: new Date().toISOString(), by: a.by, station: a.station };
  if (input.extracted) e.extracted = input.extracted;
  rs.evidence.unshift(e);
  if (input.extracted) jobStamp(j, `Evidence · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label} · values read by Claude vision, verified by ${a.by} (suggest → verify)`);
  rsStamp('evidence', `${j.number} · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label} captured · ${w.reference}/${w.serial}${e.depthRating ? ` · ${e.depthRating}` : ''}${e.grades ? ` · ${e.grades.join(', ')}` : ''}`);
  jobStamp(j, `Evidence · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label}`);
  return resolve({ ...e });
}

// Restore client-initiated writes on load (fixtures are in-memory; the portal log is not)
// ---- E10 Companion panel — SCRIPTED assistant over fixtures (no model) ------------------------------
import type { Stamp, AskAnswer, BriefCorrection, BriefLine, BriefLineKey, ClientBrief, KnowledgeCard, ModelReference, PhotoLabel, PriceCandidate, PriceMemoryAnswer, RoutedQuestion } from './types';

const cp = {
  models: fx.modelReferences.map((m): ModelReference => ({ ...m })),
  evidence: fx.priceEvidence.map((e) => ({ ...e })),
  verifications: { ...fx.priceVerifications } as Record<string, Stamp>,
  cards: fx.knowledgeCards.map((c): KnowledgeCard => ({ ...c })),
  questions: fx.routedQuestions.map((q): RoutedQuestion => ({ ...q })),
  corrections: [] as BriefCorrection[],
  labels: fx.photoLabels.map((l): PhotoLabel => ({ ...l })),
};
store.tasks.push(...fx.routedTasks.map((t) => ({ ...t })));
export { LABEL_PILLS } from './fixtures/companion';
const cpStamp = (detail: string) => { const a = actor(); appendAudit({ type: 'companion', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail }); };
const YEAR_MS = 365 * 86_400_000;
const canSeeMoney = () => actor().user?.accessTier === 'manager';

// 1 — Price Memory ---------------------------------------------------------------------------------
export const resolveModel = (text: string): PriceMemoryAnswer['resolution'] => {
  const q = text.toLowerCase();
  const ref = q.match(/\b(m?\d{5,6}[a-z]{0,3}(?:-\d{4})?)\b/i)?.[1];
  if (ref) { const m = cp.models.find((x) => x.reference.toLowerCase() === ref); return { reference: ref.toUpperCase(), model: m?.model, via: 'reference' }; }
  const year = Number(q.match(/\b(19[5-9]\d|20[0-2]\d)\b/)?.[1]);
  const hits = cp.models.filter((m) => m.aliases.some((a) => q.includes(a))).sort((a, b) => b.aliases.reduce((t, x) => Math.max(t, q.includes(x) ? x.length : 0), 0) - a.aliases.reduce((t, x) => Math.max(t, q.includes(x) ? x.length : 0), 0));
  if (!hits.length) return { via: 'none', clarify: 'Which model or reference? Say a reference (e.g. 16234) or a model + year (e.g. "2010 Daytona").' };
  const family = cp.models.filter((m) => m.model.split(' ')[0] === hits[0].model.split(' ')[0]);
  if (year) { const y = family.find((m) => year >= m.yearFrom && year <= m.yearTo) ?? hits[0]; return { reference: y.reference, model: y.model, via: 'year' }; }
  const fam = hits[0].model.split(' ')[0].toLowerCase(); const generic = hits[0].aliases.filter((a) => q.includes(a)).every((a) => fam.startsWith(a));
  if (family.length > 1 && generic) return { model: hits[0].model.split(' ')[0], via: 'none', clarify: `${hits[0].model.split(' ')[0]} spans several references (${family.map((m) => `${m.reference} ${m.yearFrom}–${m.yearTo}`).join(' · ')}). Which year?` };
  return { reference: hits[0].reference, model: hits[0].model, via: 'alias' };
};
const partTerms = (text: string) => text.toLowerCase().replace(/\b(how|much|is|a|an|the|for|price|cost|of|what|does|do|we|charge|on|to)\b/g, ' ').replace(/\b(19|20)\d{2}\b/g, ' ').split(/[^a-z0-9-]+/).filter((w) => w.length >= 3 && !cp.models.some((m) => m.aliases.includes(w) || m.reference.toLowerCase() === w));
export async function priceMemory(query: string): Promise<PriceMemoryAnswer> {
  const resolution = resolveModel(query); const terms = partTerms(query);
  const scored = store.parts.map((p) => { let s = 0; terms.forEach((w) => { if (p.name.toLowerCase().includes(w)) s += 2; if (p.category === w) s += 2; if (p.aliases.some((a) => a.includes(w))) s += 2; }); const fits = !!resolution.reference && p.compatibleRefs.map((r) => r.toUpperCase()).includes(resolution.reference); if (fits) s += 3; return { p, s, fits }; }).filter((x) => x.s >= 2 && (terms.length ? x.s > (x.fits ? 3 : 0) : x.fits));
  const candidates: PriceCandidate[] = scored.map(({ p, fits }) => { const ev = cp.evidence.find((e) => e.partId === p.id); const v = cp.verifications[p.id]; return { part: p, uses: ev?.uses ?? 0, avg: ev?.avg ?? p.price, last: ev?.last ?? '', verified: v, stale: !!v && Date.now() - new Date(v.at).getTime() > YEAR_MS, fits }; })
    .sort((a, b) => Number(!!b.verified && !b.stale) - Number(!!a.verified && !a.stale) || Number(b.fits) - Number(a.fits) || b.uses - a.uses).slice(0, 5);
  if (resolution.clarify && resolution.model) return resolve({ query, resolution, candidates: [], text: resolution.clarify });
  const text = resolution.clarify && !candidates.length ? resolution.clarify : !candidates.length ? `No priced part matches “${terms.join(' ')}”${resolution.reference ? ` for ${resolution.reference}` : ''}. Try the part name (crystal, crown, gasket…).` : `${resolution.reference ? `Resolved to ${resolution.model ?? ''} ${resolution.reference} (via ${resolution.via}). ` : ''}${candidates.length} candidate${candidates.length === 1 ? '' : 's'} with mined-price evidence — verified prices rank first.`;
  if (resolution.reference && resolution.via !== 'reference') cpStamp(`Price memory · “${query.trim()}” → ${resolution.reference}`);
  return resolve({ query, resolution, candidates, text });
}
export async function verifyPrice(partId: string): Promise<PriceCandidate> {
  const p = byId(store.parts, partId); const a = actor(); const st: Stamp = { at: new Date().toISOString(), by: a.by, station: a.station }; cp.verifications[partId] = st;
  const ev = cp.evidence.find((e) => e.partId === partId);
  store.partsKnowledge.unshift({ id: newId('pk'), kind: 'price_verified', partId, partNumber: p.partNumber, requestId: '', detail: `Price verified at ${fmtMoney(ev?.avg ?? p.price)} (${ev?.uses ?? 0} uses) — ranks #1 in Price Memory for 12 months`, ...st });
  cpStamp(`Price verified · ${p.partNumber} ${fmtMoney(ev?.avg ?? p.price)}`);
  return resolve({ part: p, uses: ev?.uses ?? 0, avg: ev?.avg ?? p.price, last: ev?.last ?? '', verified: st, stale: false, fits: false });
}

// 2 — Client Brief ----------------------------------------------------------------------------------
export async function getClientBrief(clientId: string): Promise<ClientBrief> {
  const c = byId(fx.clients, clientId); const ws = store.watches.filter((w) => w.clientId === clientId); const jobs = store.jobs.filter((j) => j.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sos = store.salesOrders.filter((o) => o.clientId === clientId && o.status !== 'cancelled' && o.status !== 'draft'); const paid = sos.reduce((t, o) => t + (o.total - o.balanceDue), 0);
  const years = Math.max(0, new Date().getFullYear() - new Date(c.since).getFullYear()); const money = canSeeMoney();
  const late = jobs.filter((j) => j.finishedAt && j.dueAt && new Date(j.finishedAt).getTime() > new Date(j.dueAt).getTime()).map((j) => ({ j, days: Math.round((new Date(j.finishedAt!).getTime() - new Date(j.dueAt!).getTime()) / 86_400_000) })).sort((a, b) => b.days - a.days)[0];
  const notes = jobs.flatMap((j) => j.notes.map((n) => ({ j, n }))).slice(0, 2); const lastSo = sos[0];
  const lines: BriefLine[] = [
    { key: 'relationship', text: `${c.type === 'trade' ? 'Trade' : 'Retail'} client since ${new Date(c.since).getFullYear()} (${years} yr) · ${ws.length} watch${ws.length === 1 ? '' : 'es'} · ${jobs.length} job${jobs.length === 1 ? '' : 's'} · lifetime value ${money ? fmtMoney(paid) : '•••• (hidden)'}`, citations: [{ label: 'client record', hitKey: 'top' }, ...sos.slice(0, 2).map((o) => ({ label: o.number, hitKey: `so-${o.id}` }))], moneyMasked: !money },
    { key: 'history', text: [jobs[0] ? `Latest: ${jobs[0].number} ${jobs[0].status.replace(/_/g, ' ')} (${jobs[0].workflow.join('+')})` : 'No jobs yet', ...notes.map(({ j, n }) => `“${n.text.slice(0, 70)}${n.text.length > 70 ? '…' : ''}” — ${n.by}, ${j.number}`), lastSo ? `last invoice ${lastSo.number} ${lastSo.isPaid ? 'paid' : `balance ${money ? fmtMoney(lastSo.balanceDue) : 'hidden'}`}` : ''].filter(Boolean).join(' · '), citations: [...(jobs[0] ? [{ label: jobs[0].number, hitKey: `job-${jobs[0].id}` }] : []), ...notes.map(({ j }) => ({ label: `note · ${j.number}`, hitKey: `job-${j.id}` })), ...(lastSo ? [{ label: lastSo.number, hitKey: `so-${lastSo.id}` }] : [])] },
    { key: 'service_debt', text: late ? `⚠ last job delivered ${late.days} days late (${late.j.number}) — consider preferential handling` : 'No service debt — every finished job met its promised date', citations: late ? [{ label: late.j.number, hitKey: `job-${late.j.id}` }] : [] },
  ];
  lines.forEach((l) => { const fix = cp.corrections.filter((x) => x.clientId === clientId && x.key === l.key).sort((a, b) => b.at.localeCompare(a.at))[0]; if (fix) { l.corrected = fix; l.text = fix.text; } });
  return resolve({ clientId, lines, debt: late ? { jobNumber: late.j.number, daysLate: late.days, jobId: late.j.id } : undefined, generatedAt: new Date().toISOString() });
}
export async function correctBriefLine(clientId: string, key: BriefLineKey, text: string, original: string): Promise<BriefCorrection> {
  if (!text.trim()) throw new Error('Correction cannot be empty'); const a = actor();
  const fix: BriefCorrection = { id: newId('bc'), clientId, key, text: text.trim(), original, at: new Date().toISOString(), by: a.by, station: a.station }; cp.corrections.unshift(fix);
  cpStamp(`Client brief corrected · ${clientName(clientId)} · ${key}`); return resolve({ ...fix });
}
export async function getBriefCorrections(clientId: string): Promise<BriefCorrection[]> { return resolve(cp.corrections.filter((x) => x.clientId === clientId)); }

// 3 — Ask the shop ----------------------------------------------------------------------------------
export async function getKnowledgeCards(): Promise<KnowledgeCard[]> { return resolve([...cp.cards].sort((a, b) => b.at.localeCompare(a.at))); }
export async function getRoutedQuestions(): Promise<(RoutedQuestion & { task: Task | undefined })[]> { return resolve(cp.questions.map((q) => ({ ...q, task: store.tasks.find((t) => t.id === q.taskId) }))); }
export async function askShop(query: string): Promise<AskAnswer> {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const best = cp.cards.map((c) => ({ c, s: c.tags.reduce((t, tag) => t + (query.toLowerCase().includes(tag) ? 3 : 0), 0) + words.filter((w) => c.title.toLowerCase().includes(w) || c.body.toLowerCase().includes(w)).length })).sort((a, b) => b.s - a.s)[0];
  if (best && best.s >= 3) return resolve({ query, card: best.c, score: best.s, text: `From the card “${best.c.title}” (by ${best.c.by}):` });
  return resolve({ query, score: best?.s ?? 0, text: 'No card yet — route to MH/MM? A manager task is created and the answer becomes a new card.' });
}
export async function routeQuestion(query: string): Promise<RoutedQuestion> {
  if (!query.trim()) throw new Error('Ask something first'); const a = actor();
  const task = await createTask({ title: `Answer shop question: ${query.trim()}`, assignedTo: { type: 'role', role: 'manager' }, dueAt: new Date(Date.now() + 86_400_000).toISOString() });
  const q: RoutedQuestion = { id: newId('rqa'), question: query.trim(), taskId: task.id, status: 'open', division: getSessionDivision(), at: new Date().toISOString(), by: a.by, station: a.station }; cp.questions.unshift(q);
  cpStamp(`Question routed to managers · “${q.question}”`); return resolve({ ...q });
}
export async function answerQuestion(questionId: string, title: string, body: string, tags: string[]): Promise<KnowledgeCard> {
  const q = byId(cp.questions, questionId); if (q.status === 'answered') throw new Error('Already answered'); if (!title.trim() || !body.trim()) throw new Error('Title and answer are required'); const a = actor();
  const card: KnowledgeCard = { id: newId('kc'), title: title.trim(), body: body.trim(), tags: uniq([...tags.map((t) => t.trim().toLowerCase()).filter(Boolean), ...q.question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4)]), sourceTaskId: q.taskId, askedBy: q.by, at: new Date().toISOString(), by: a.by, station: a.station };
  cp.cards.unshift(card); q.status = 'answered'; q.cardId = card.id; const t = store.tasks.find((x) => x.id === q.taskId); if (t && t.status === 'open') await setTaskDone(t.id, true);
  cpStamp(`Knowledge card created from routed question · “${card.title}”`); return resolve({ ...card });
}

// 4 — Photo labels ----------------------------------------------------------------------------------
export async function getPhotoLabels(photoId?: string): Promise<PhotoLabel[]> { return resolve(cp.labels.filter((l) => !photoId || l.photoId === photoId).sort((a, b) => b.at.localeCompare(a.at))); }
export async function labelPhoto(input: { photoId: string; jobId: string; source: 'inspection' | 'evidence'; tags: string[]; skipped?: boolean }): Promise<PhotoLabel> {
  const j = getJobRow(input.jobId); const a = actor(); if (!input.skipped && !input.tags.length) throw new Error('Pick at least one label or skip');
  const l: PhotoLabel = { id: newId('pl'), photoId: input.photoId, jobId: j.id, watchId: j.watchId, source: input.source, tags: input.skipped ? [] : uniq(input.tags), skipped: !!input.skipped, at: new Date().toISOString(), by: a.by, station: a.station };
  cp.labels.unshift(l); cpStamp(input.skipped ? `Photo label skipped · ${j.number}` : `Photo labeled · ${j.number} · ${l.tags.join(', ')}`); if (!input.skipped) jobStamp(j, `Photo labels · ${l.tags.join(', ')}`);
  return resolve({ ...l });
}
export const companionCanSeeMoney = canSeeMoney;

// ---- E14 Comms hub — one thread-space per client; Sent-record only (nothing leaves); reply-token routing (mocked) ----
import type { ConvLane, ConvMessage, ConvTag, Conversation, ConversationAnchor, ConversationWithRefs, InboxFilter, InboxView, MessageSource, RenderedTemplate, ThreadView } from './types';

const cx = { conversations: fx.conversations.map((c): Conversation => ({ ...c })), messages: fx.convMessages.map((m): ConvMessage => ({ ...m })) };
const cxStamp = (detail: string) => { const a = actor(); appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail }); };
const wakeSnoozed = () => { const now = new Date().toISOString(); cx.conversations.forEach((c) => { if (c.status === 'snoozed' && c.snoozedUntil && c.snoozedUntil <= now) { c.status = 'open'; c.snoozedUntil = undefined; } }); };
// Unreplied = client messages newer than our last outbound reply that nobody has Cleared (marked handled without a reply)
const unrepliedOf = (c: Conversation) => cx.messages.filter((m) => m.conversationId === c.id && m.direction === 'in' && !m.cleared && m.at > (c.lastOutboundAt ?? ''));
const convNeedsReply = (c: Conversation) => c.status === 'open' && unrepliedOf(c).length > 0;
const anchorRef = (a?: ConversationAnchor): { label?: string; path?: string } => {
  if (!a) return {};
  if (a.kind === 'job') { const j = store.jobs.find((x) => x.id === a.id); return j ? { label: `Job ${j.number}`, path: `/jobs/${j.id}` } : {}; }
  if (a.kind === 'estimate') { const e = store.estimates.find((x) => x.id === a.id); return e ? { label: `Estimate ${e.number}`, path: `/estimates/${e.id}` } : {}; }
  const r = store.requests.find((x) => x.id === a.id); return r ? { label: `Request ${r.number}`, path: `/clients/${r.clientId}?hit=req-${r.id}` } : {};
};
const convRefs = (c: Conversation): ConversationWithRefs => { const msgs = cx.messages.filter((m) => m.conversationId === c.id); const ar = anchorRef(c.anchor); return { ...c, client: byId(fx.clients, c.clientId), anchorLabel: ar.label, anchorPath: ar.path, unread: msgs.filter((m) => m.direction === 'in' && !m.readByStaff).length, unreplied: unrepliedOf(c).length, needsReply: convNeedsReply(c), ageHours: c.lastInboundAt ? Math.round((Date.now() - new Date(c.lastInboundAt).getTime()) / 3_600_000) : 0, attachments: msgs.reduce((n, m) => n + (m.photos?.length ?? 0), 0), last: msgs.sort((a, b) => b.at.localeCompare(a.at))[0], assigneeLabel: c.assignedTo ? assigneeLabel(c.assignedTo) : undefined, linkedEstimate: linkedEstimateFor(c.anchor) }; };
const convOf = (id: string) => byId(cx.conversations, id);
const ensureConversation = (clientId: string, subject: string, anchor?: ConversationAnchor, division?: Division): Conversation => {
  const found = cx.conversations.find((c) => c.clientId === clientId && c.status !== 'closed' && (anchor ? c.anchor?.kind === anchor.kind && c.anchor.id === anchor.id : !c.anchor));
  if (found) return found;
  const c: Conversation = { id: newId('cv'), clientId, subject, anchor, status: 'open', division: division ?? getSessionDivision(), createdAt: new Date().toISOString(), lastAt: new Date().toISOString(), tokenSeq: 0 };
  cx.conversations.unshift(c); return c;
};
const pushConv = (c: Conversation, m: Omit<ConvMessage, 'id' | 'conversationId' | 'clientId' | 'readByStaff'> & { readByStaff?: boolean }): ConvMessage => {
  const row: ConvMessage = { id: newId('cm'), conversationId: c.id, clientId: c.clientId, readByStaff: m.direction !== 'in', ...m };
  cx.messages.push(row); c.lastAt = row.at; if (row.direction === 'in') { c.lastInboundAt = row.at; if (c.status === 'closed' || c.status === 'snoozed') { c.status = 'open'; c.snoozedUntil = undefined; } } if (row.direction === 'out') c.lastOutboundAt = row.at;
  return row;
};
// Auto-threading hook used by portal / parts / pickup flows: structured event lands in the client's thread
const threadEvent = (clientId: string, anchor: ConversationAnchor | undefined, source: MessageSource, by: string, text: string, event?: ConvMessage['event']) => {
  const c = ensureConversation(clientId, anchor ? `${anchorRef(anchor).label ?? anchor.kind}` : 'General', anchor);
  return pushConv(c, { direction: source === 'staff' || source === 'system' ? 'out' : 'in', source, by, text, at: new Date().toISOString(), event, readByStaff: false });
};

export async function getInbox(view: InboxView, userId?: string): Promise<ConversationWithRefs[]> {
  wakeSnoozed(); const me = userId ? fx.users.find((u) => u.id === userId) : actor().user; const div = getSessionDivision();
  let rows = cx.conversations.filter((c) => c.division === div).map(convRefs);
  if (view === 'needs_reply') rows = rows.filter((r) => r.needsReply).sort((a, b) => (a.lastInboundAt ?? '').localeCompare(b.lastInboundAt ?? ''));
  else if (view === 'mine') rows = rows.filter((r) => r.status !== 'closed' && r.assignedTo && me && assigneeMatches(r.assignedTo, me)).sort((a, b) => Number(b.needsReply) - Number(a.needsReply) || b.lastAt.localeCompare(a.lastAt));
  else if (view === 'open') rows = rows.filter((r) => r.status === 'open').sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  else if (view === 'snoozed') rows = rows.filter((r) => r.status === 'snoozed').sort((a, b) => (a.snoozedUntil ?? '').localeCompare(b.snoozedUntil ?? ''));
  else rows = rows.filter((r) => r.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  return resolve(rows);
}
export async function getInboxCounts(userId?: string): Promise<Record<InboxView, number>> {
  const views: InboxView[] = ['needs_reply', 'mine', 'open', 'snoozed', 'closed']; const out = {} as Record<InboxView, number>;
  for (const v of views) out[v] = (await getInbox(v, userId)).length; return out;
}
export async function getClientFolder(clientId: string): Promise<ConversationWithRefs[]> { wakeSnoozed(); return resolve(cx.conversations.filter((c) => c.clientId === clientId).map(convRefs).sort((a, b) => b.lastAt.localeCompare(a.lastAt))); }
export async function getThread(id: string): Promise<ThreadView> {
  const c = convOf(id); const messages = cx.messages.filter((m) => m.conversationId === id).sort((a, b) => a.at.localeCompare(b.at));
  return resolve({ conversation: convRefs(c), messages, folder: await getClientFolder(c.clientId) });
}
export async function clearMessage(conversationId: string, messageId: string): Promise<ThreadView> {
  const a = actor(); const c = convOf(conversationId); const m = cx.messages.find((x) => x.id === messageId && x.conversationId === conversationId); if (!m) throw new Error('Message not found'); if (m.direction !== 'in') throw new Error('Only client messages can be cleared'); if (m.cleared) throw new Error('Already cleared');
  m.cleared = { by: a.by, at: new Date().toISOString() }; m.readByStaff = true;
  cx.messages.push({ id: newId('cm'), conversationId, clientId: c.clientId, direction: 'internal', source: 'note', by: a.by, station: a.station, text: `Cleared without reply — “${m.text.slice(0, 60)}${m.text.length > 60 ? '…' : ''}” marked handled, no email sent`, at: new Date().toISOString(), readByStaff: true });
  appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, detail: `Inbox · ${c.subject} · client message cleared without reply` });
  return getThread(conversationId);
}
export async function markConversationRead(id: string): Promise<void> { cx.messages.filter((m) => m.conversationId === id && m.direction === 'in').forEach((m) => { m.readByStaff = true; }); return resolve(undefined); }
// ---- ONE GENERAL INBOX (MH 2026-10-01): All · tag-don't-assign · pin · lanes · archive ----
export const CONV_TAGS: { key: ConvTag; label: string; short: string; dot: string; kind: 'person' | 'status' }[] = [
  { key: 'vienna', label: 'Vienna', short: 'VC', dot: 'bg-teal-500', kind: 'person' }, { key: 'mike', label: 'Mike', short: 'MH', dot: 'bg-indigo-500', kind: 'person' }, { key: 'chyna', label: 'Chyna', short: 'CM', dot: 'bg-pink-500', kind: 'person' },
  { key: 'update_wo', label: 'Update work order', short: 'WO', dot: 'bg-amber-500', kind: 'status' },
];
export const tagOfUser = (u?: User | null): Exclude<ConvTag, 'update_wo'> | undefined => (u?.shortName === 'Vienna' ? 'vienna' : u?.shortName === 'MH' ? 'mike' : u?.shortName === 'Chyna' ? 'chyna' : undefined);
const sortThreads = (rows: ConversationWithRefs[]) => rows.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(b.needsReply) - Number(a.needsReply) || b.lastAt.localeCompare(a.lastAt));
// Every client thread lands in All, unowned. who = person tag filter (their action items). lane = Quoted / Answered / Archived / Snoozed.
export async function getInboxThreads(filter: InboxFilter = {}): Promise<ConversationWithRefs[]> {
  wakeSnoozed(); const div = getSessionDivision(); let rows = cx.conversations.filter((c) => c.division === div).map(convRefs);
  if (filter.lane === 'archived') return resolve(rows.filter((r) => r.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '')));
  rows = rows.filter((r) => r.status !== 'closed');
  if (filter.lane === 'snoozed') rows = rows.filter((r) => r.status === 'snoozed'); else if (filter.lane) rows = rows.filter((r) => r.lane === filter.lane);
  if (filter.who) rows = rows.filter((r) => r.tags?.includes(filter.who!));
  return resolve(sortThreads(rows));
}
export async function getInboxThreadCounts(): Promise<{ all: number; needsReply: number; quoted: number; answered: number; archived: number; snoozed: number; pinned: number; byTag: Record<ConvTag, number> }> {
  wakeSnoozed(); const div = getSessionDivision(); const rows = cx.conversations.filter((c) => c.division === div).map(convRefs); const live = rows.filter((r) => r.status !== 'closed');
  const byTag = { vienna: 0, mike: 0, chyna: 0, update_wo: 0 } as Record<ConvTag, number>; live.forEach((r) => r.tags?.forEach((t) => { byTag[t] += 1; }));
  return resolve({ all: live.length, needsReply: live.filter((r) => r.needsReply).length, quoted: live.filter((r) => r.lane === 'quoted').length, answered: live.filter((r) => r.lane === 'answered').length, archived: rows.length - live.length, snoozed: live.filter((r) => r.status === 'snoozed').length, pinned: live.filter((r) => r.pinned).length, byTag });
}
// SENT folder (Outlook tree): every outbound client message in this division, newest first, with its thread
export interface InboxSentRow { message: ConvMessage; conversation: ConversationWithRefs }
export async function getInboxSent(): Promise<InboxSentRow[]> {
  const div = getSessionDivision(); const convs = new Map(cx.conversations.filter((c) => c.division === div).map((c) => [c.id, convRefs(c)] as const));
  return resolve(cx.messages.filter((m) => m.direction === 'out' && convs.has(m.conversationId)).sort((a, b) => b.at.localeCompare(a.at)).map((m) => ({ message: m, conversation: convs.get(m.conversationId)! })));
}
export async function tagConversation(id: string, tag: ConvTag, on = true): Promise<ConversationWithRefs> { const c = convOf(id); const cur = new Set(c.tags ?? []); if (on) cur.add(tag); else cur.delete(tag); c.tags = cur.size ? [...cur] : undefined; const t = CONV_TAGS.find((x) => x.key === tag)!; cxStamp(`${on ? 'Tagged' : 'Untagged'} ${t.label} · ${c.subject}`); return resolve(convRefs(c)); }
export async function pinConversation(id: string, on = true): Promise<ConversationWithRefs> { const c = convOf(id); c.pinned = on || undefined; cxStamp(`${on ? 'Pinned' : 'Unpinned'} · ${c.subject}`); return resolve(convRefs(c)); }
export async function moveConversation(id: string, lane: ConvLane | null): Promise<ConversationWithRefs> { const c = convOf(id); c.lane = lane ?? undefined; cxStamp(`Moved to ${lane ?? 'All'} · ${c.subject}`); return resolve(convRefs(c)); }
// Archive = one click; tags clear; a new client message on an archived thread un-archives it into All (pushConv)
export async function archiveConversation(id: string): Promise<ConversationWithRefs> { const c = convOf(id); const a = actor(); c.status = 'closed'; c.closedAt = new Date().toISOString(); c.closedBy = a.by; c.tags = undefined; c.pinned = undefined; c.snoozedUntil = undefined; cxStamp(`Archived · ${c.subject}`); return resolve(convRefs(c)); }
export const unarchiveConversation = (id: string) => reopenConversation(id);
export const tagsForRequestSync = (requestId: string): ConvTag[] => conversationForRequestSync(requestId)?.tags ?? [];
// "Share with staff" is logged on the thread — the quote itself travels as a staff one-shot message (hitlist.shareClientMessage)
export async function logShare(conversationId: string, messageId: string, toLabels: string[]): Promise<ConvMessage> { const c = convOf(conversationId); const a = actor(); const m = pushConv(c, { direction: 'internal', source: 'system', by: a.by, station: a.station, text: `Shared with ${toLabels.join(', ')} by ${a.by}`, at: new Date().toISOString(), event: { kind: 'shared', refId: messageId, label: `Shared with ${toLabels.join(', ')}` } }); cxStamp(`Client message shared with ${toLabels.join(', ')} · ${c.subject}`); return resolve(m); }
// ---- Inbox job-card slide-out + sidebar badges (MH 2026-10-01) ----
export const inboxUnreadCountSync = () => { const open = new Set(cx.conversations.filter((c) => c.status !== 'closed' && c.division === getSessionDivision()).map((c) => c.id)); return cx.messages.filter((m) => m.direction === 'in' && !m.readByStaff && open.has(m.conversationId)).length; };
export const openRequestsNoEstimateCountSync = () => store.requests.filter((r) => r.status !== 'closed' && !r.estimateId && (r.division ?? 'rolliworks') === getSessionDivision()).length;
export const requestByIdSync = (id: string): ServiceRequest | undefined => store.requests.find((r) => r.id === id);
// Legs the client described: explicit on the request, else derived from the kiosk services ticked
const KIOSK_LEG: Record<KioskDetails['services'][number], DeptCode> = { mov_service: 'W', case_work: 'P', band_repair: 'B', band_polish: 'P', recut_bezel: 'P' };
export const requestLegsSync = (r: ServiceRequest): DeptCode[] => r.legs ?? (r.kiosk ? Array.from(new Set(r.kiosk.services.map((s) => KIOSK_LEG[s]))) : []);
// Instant range — only when a quote key exists (kiosk services ticked or legs captured); shop-typical bands, never a promise
const INSTANT_RANGE: Record<DeptCode, [number, number]> = { W: [950, 1650], B: [260, 520], P: [320, 540], PM: [950, 1650] };
export const requestInstantRangeSync = (r: ServiceRequest): { low: number; high: number; legs: DeptCode[] } | undefined => { const legs = requestLegsSync(r); if (!legs.length) return undefined; return { low: legs.reduce((t, l) => t + INSTANT_RANGE[l][0], 0), high: legs.reduce((t, l) => t + INSTANT_RANGE[l][1], 0), legs }; };
// A request row click opens its thread — create the thread on first open, seeded with what the client wrote
export async function ensureRequestThread(requestId: string): Promise<Conversation> {
  const r = store.requests.find((x) => x.id === requestId); if (!r) throw new Error('No such request');
  const existing = cx.conversations.find((c) => c.anchor?.kind === 'request' && c.anchor.id === r.id); if (existing) return resolve(existing);
  const c = ensureConversation(r.clientId, `${r.source === 'kiosk' ? 'Kiosk check-in' : r.source === 'web' ? 'Web request' : 'Request'} — ${r.summary.slice(0, 48)}${r.summary.length > 48 ? '…' : ''}`, { kind: 'request', id: r.id }, r.division);
  c.createdAt = r.createdAt; c.lastAt = r.createdAt; c.lastInboundAt = r.createdAt; const cl = byId(fx.clients, r.clientId);
  cx.messages.push({ id: newId('cm'), conversationId: c.id, clientId: r.clientId, direction: 'in', source: r.source === 'kiosk' ? 'kiosk' : r.source === 'email' ? 'email' : 'portal', by: fullNameOf(cl), text: `${r.number}: ${r.summary}`, at: r.createdAt, readByStaff: false, photos: r.photos });
  return resolve(c);
}
export const conversationForRequestSync = (requestId: string): Conversation | undefined => cx.conversations.find((c) => c.anchor?.kind === 'request' && c.anchor.id === requestId);
// Completed job → when it left (sales order picked up / shipped); return job → its original
export const jobPickupSync = (jobId: string): { at: string; how: 'picked_up' | 'shipped'; soNumber: string } | undefined => { const o = store.salesOrders.find((x) => x.jobId === jobId && (x.status === 'picked_up' || x.status === 'shipped')); return o ? { at: o.pickedUpAt ?? o.shipDate ?? o.fulfilledAt ?? o.orderDate, how: o.status as 'picked_up' | 'shipped', soNumber: o.number } : undefined; };
export const jobReturnInfoSync = (job: Job): { original: Job; pickup?: { at: string; how: 'picked_up' | 'shipped'; soNumber: string }; reason?: string } | undefined => { if (!job.returnOfJobId) return undefined; const o = store.jobs.find((j) => j.id === job.returnOfJobId); return o ? { original: o, pickup: jobPickupSync(o.id), reason: job.returnReason } : undefined; };
export const jobsReturnedFromSync = (jobId: string): Job[] => store.jobs.filter((j) => j.returnOfJobId === jobId);
export const jobByIdSync = (id: string): Job | undefined => store.jobs.find((j) => j.id === id);
// DOTS ONLY WHILE IN POSSESSION (MH 2026-10-01): a job carries W·B·P dots only while the piece is physically with us — in-house, at a vendor, or in transit back. Picked up / shipped / closed → no dots anywhere.
export const jobInPossessionSync = (j: Job): boolean => j.status !== 'closed' && !jobPickupSync(j.id);
// Inbox panel sections: ACTIVE = open requests without an estimate + jobs in possession (newest first) · FULFILLED = jobs that left (picked up / shipped) or closed · CLOSED = expired / declined estimates + closed requests
export type PanelActive = { kind: 'job'; at: string; job: Job } | { kind: 'request'; at: string; request: ServiceRequest };
export interface PanelFulfilled { job: Job; at: string; pickup?: { at: string; how: 'picked_up' | 'shipped'; soNumber: string } }
export interface PanelClosed { kind: 'estimate' | 'request'; id: string; number: string; watchLabel: string; reason: string; at: string }
export const clientPanelSync = (clientId: string): { active: PanelActive[]; fulfilled: PanelFulfilled[]; closed: PanelClosed[] } => {
  const wl = (watchId?: string) => { const w = watchByIdSync(watchId); return w ? `${w.brand} ${w.model}`.trim() : ''; };
  const jobs = store.jobs.filter((j) => j.clientId === clientId); const reqs = store.requests.filter((r) => r.clientId === clientId);
  const active: PanelActive[] = [...jobs.filter(jobInPossessionSync).map((job) => ({ kind: 'job' as const, at: job.createdAt, job })), ...reqs.filter((r) => (r.status === 'new' || r.status === 'quoted') && !r.estimateId).map((request) => ({ kind: 'request' as const, at: request.createdAt, request }))].sort((a, b) => b.at.localeCompare(a.at));
  const fulfilled: PanelFulfilled[] = jobs.filter((j) => !jobInPossessionSync(j)).map((job) => { const pickup = jobPickupSync(job.id); return { job, pickup, at: pickup?.at ?? job.finishedAt ?? job.createdAt }; }).sort((a, b) => b.at.localeCompare(a.at));
  const closed: PanelClosed[] = [
    ...store.estimates.filter((e) => e.clientId === clientId && (e.status === 'expired' || e.status === 'declined')).map((e) => ({ kind: 'estimate' as const, id: e.id, number: e.number, watchLabel: wl(e.watchId), reason: e.status === 'expired' ? 'Estimate expired — never approved' : `Declined${e.declineReason ? ` — ${e.declineReason}` : ''}`, at: e.status === 'expired' ? e.validUntil : e.declinedAt ?? e.updatedAt })),
    ...reqs.filter((r) => r.status === 'closed' || r.status === 'closed_by_client').map((r) => ({ kind: 'request' as const, id: r.id, number: r.number, watchLabel: wl(r.watchId), reason: r.closedNote ?? (r.closeReason ? REQUEST_CLOSE_REASONS.find((x) => x.key === r.closeReason)?.label ?? r.closeReason : r.closedBy === 'client' ? 'Closed by the client' : 'Closed'), at: r.closedAt ?? r.createdAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { active, fulfilled, closed };
};
export const jobForEstimateSync = (estimateId: string): Job | undefined => store.jobs.find((j) => j.estimateId === estimateId);
export const watchByIdSync = (id?: string): Watch | undefined => (id ? store.watches.find((w) => w.id === id) : undefined);
export async function assignConversation(id: string, assignee: Assignee | null): Promise<ConversationWithRefs> { const c = convOf(id); c.assignedTo = assignee ?? undefined; cxStamp(`Thread ${c.subject} → ${assignee ? assigneeLabel(assignee) : 'unassigned'}`); return resolve(convRefs(c)); }
export async function snoozeConversation(id: string, untilIso: string): Promise<ConversationWithRefs> { const c = convOf(id); if (!untilIso || new Date(untilIso).getTime() <= Date.now()) throw new Error('Pick a future date'); c.status = 'snoozed'; c.snoozedUntil = untilIso; c.snoozedBy = actor().by; cxStamp(`Thread snoozed until ${untilIso.slice(0, 10)} · ${c.subject}`); return resolve(convRefs(c)); }
export async function wakeConversation(id: string): Promise<ConversationWithRefs> { const c = convOf(id); c.status = 'open'; c.snoozedUntil = undefined; cxStamp(`Thread woken · ${c.subject}`); return resolve(convRefs(c)); }
export async function closeConversation(id: string): Promise<ConversationWithRefs> { const c = convOf(id); c.status = 'closed'; c.closedAt = new Date().toISOString(); c.closedBy = actor().by; cxStamp(`Thread closed · ${c.subject}`); return resolve(convRefs(c)); }
export async function reopenConversation(id: string): Promise<ConversationWithRefs> { const c = convOf(id); c.status = 'open'; c.closedAt = undefined; cxStamp(`Thread reopened · ${c.subject}`); return resolve(convRefs(c)); }
export async function createConversation(clientId: string, subject: string, anchor?: ConversationAnchor): Promise<ConversationWithRefs> { if (!subject.trim()) throw new Error('Subject required'); const c: Conversation = { id: newId('cv'), clientId, subject: subject.trim(), anchor, status: 'open', division: getSessionDivision(), createdAt: new Date().toISOString(), lastAt: new Date().toISOString(), tokenSeq: 0 }; cx.conversations.unshift(c); cxStamp(`Thread opened · ${c.subject}`); return resolve(convRefs(c)); }

// Merge-field rendering with real values for the thread's client / anchor
const mergeValues = (c: { clientId: string; anchor?: ConversationAnchor }): Record<string, string> => {
  const client = byId(fx.clients, c.clientId); const job = c.anchor?.kind === 'job' ? store.jobs.find((j) => j.id === c.anchor!.id) : undefined;
  const est = c.anchor?.kind === 'estimate' ? store.estimates.find((e) => e.id === c.anchor!.id) : job?.estimateId ? store.estimates.find((e) => e.id === job.estimateId) : c.anchor?.kind === 'request' ? store.estimates.find((e) => e.id === store.requests.find((r) => r.id === c.anchor!.id)?.estimateId) : undefined;
  const watch = store.watches.find((w) => w.id === (job?.watchId ?? est?.watchId)) ?? store.watches.find((w) => w.clientId === c.clientId);
  const so = job ? store.salesOrders.find((o) => o.jobId === job.id && o.status !== 'cancelled') : undefined; const pkg = job?.packageId ? store.packages.find((p) => p.id === job.packageId) : undefined;
  const rep = job ? rp.reports.find((r) => r.jobId === job.id && r.status === 'issued') : undefined;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = rep ? `${origin}/rc/report/${rep.token}` : c.anchor?.kind === 'estimate' && est ? `${origin}/rc/estimates/${est.id}` : watch ? `${origin}/rc/watches/${watch.id}` : `${origin}/rc/home`;
  return { '{{portal.link}}': link, '{{client.first_name}}': client.firstName, '{{watch.brand}}': watch?.brand ?? '', '{{watch.model}}': watch?.model ?? '', '{{estimate.number}}': est?.number ?? '', '{{job.number}}': job?.number ?? '', '{{sub.number}}': pkg?.subNumber ?? '', '{{so.number}}': so?.number ?? '', '{{pickup.code}}': so?.pickupCode ?? '', '{{tracking}}': so?.tracking ?? '', '{{balance_due}}': so ? fmtMoney(so.balanceDue) : '', '{{shop.name}}': 'RolliSuite' };
};
// ---- Personal templates (point-of-use editing). Resolution order for a STAFF send: actor's personal variant → shop default. System sends: shop default only. ----
export const personalTemplateFor = (key: TemplateKey, owner = actor().by): PersonalTemplate | undefined => rs.personalTemplates.find((p) => p.key === key && p.owner === owner);
const templateSource = (key: TemplateKey, shopDefault = false): { subject: string; body: string; source: 'shop' | 'personal'; owner?: string } => {
  const t = rs.templates.find((x) => x.key === key); if (!t) throw new Error('Unknown template');
  const p = shopDefault ? undefined : personalTemplateFor(key); return p ? { subject: p.subject, body: p.body, source: 'personal', owner: p.owner } : { subject: t.subject, body: t.body, source: 'shop' };
};
export async function getPersonalTemplates(): Promise<PersonalTemplate[]> { return resolve(rs.personalTemplates.filter((p) => p.owner === actor().by).map((p) => ({ ...p }))); }
export async function getAllPersonalTemplates(): Promise<PersonalTemplate[]> { return resolve(rs.personalTemplates.map((p) => ({ ...p }))); }
export async function getTemplateVariants(key: TemplateKey): Promise<PersonalTemplate[]> { return resolve(rs.personalTemplates.filter((p) => p.key === key).map((p) => ({ ...p }))); }
export async function savePersonalTemplate(key: TemplateKey, subject: string, body: string): Promise<PersonalTemplate> {
  if (!subject.trim() || !body.trim()) throw new Error('Subject and body are required'); const a = actor(); const row: PersonalTemplate = { key, owner: a.by, subject: subject.trim(), body: body.trim(), updatedAt: new Date().toISOString() };
  const i = rs.personalTemplates.findIndex((p) => p.key === key && p.owner === a.by); if (i >= 0) rs.personalTemplates[i] = row; else rs.personalTemplates.push(row);
  appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Saved personal template · ${key} (${a.by}'s version)` }); return resolve({ ...row });
}
export async function deletePersonalTemplate(key: TemplateKey): Promise<void> { const a = actor(); rs.personalTemplates = rs.personalTemplates.filter((p) => !(p.key === key && p.owner === a.by)); appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, detail: `Removed personal template · ${key}` }); return resolve(undefined); }
// Turn an edited, already-merged text back into template text so "Save as my template" keeps merge fields live for the next client
export const unrenderTemplate = (text: string, vals: Record<string, string>) => Object.entries(vals).filter(([, v]) => v && v.length > 2).sort((a, b) => b[1].length - a[1].length).reduce((t, [f, v]) => t.split(v).join(f), text);
const renderWith = (key: TemplateKey, ctx: { clientId: string; anchor?: ConversationAnchor }, shopDefault = false): RenderedTemplate => {
  const src = templateSource(key, shopDefault); const vals = mergeValues(ctx); const missing: string[] = [];
  const fill = (s: string) => s.replace(/\{\{[a-z_.]+\}\}/g, (f) => { const v = vals[f]; if (!v) missing.push(f); return v || f; });
  return { key, subject: fill(src.subject), body: fill(src.body), missing: uniq(missing), source: src.source, owner: src.owner };
};
export async function renderTemplate(conversationId: string, key: TemplateKey, shopDefault = false): Promise<RenderedTemplate> { return resolve(renderWith(key, convOf(conversationId), shopDefault)); }
export async function renderTemplateForEstimate(estimateId: string, shopDefault = false): Promise<RenderedTemplate & { vals: Record<string, string> }> { const e = getEst(estimateId); const ctx = { clientId: e.clientId, anchor: { kind: 'estimate' as const, id: e.id } }; return resolve({ ...(() => { const r = renderWith('estimate_sent', ctx, shopDefault); return { ...r, subject: clientRefSubject(r.subject, e.clientRef) }; })(), vals: mergeValues(ctx) }); }
export async function mergeValuesForConversation(conversationId: string): Promise<Record<string, string>> { return resolve(mergeValues(convOf(conversationId))); }
// The client sees the replier's NAME on every message — "— Vienna, Rolliworks" (appended unless the reply already signs off)
const signed = (text: string, by: string, div: Division) => { const t = text.trim(); const sig = `— ${by}, ${div === 'rollishop' ? 'Rollishop' : 'Rolliworks'}`; return /—\s*[A-Z][a-z]+,\s*Rolli(works|shop)\s*$/.test(t) || t.endsWith(sig) ? t : `${t}\n\n${sig}`; };
export async function replyInThread(id: string, input: { text: string; subject?: string; templateKey?: TemplateKey; photos?: PackagePhoto[] }): Promise<ConvMessage> {
  const c = convOf(id); if (!input.text.trim()) throw new Error('Write a reply first'); const a = actor(); const client = byId(fx.clients, c.clientId);
  const token = `RT-${c.id.replace(/[^a-z0-9]/gi, '').toUpperCase()}-${++c.tokenSeq}`;
  const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}`, to: client.email, toName: `${client.firstName} ${client.lastName}`, relatedRef: anchorRef(c.anchor).label ?? c.subject, status: 'pending', subject: input.subject?.trim() || `Re: ${c.subject}`, body: `${input.text.trim()}\n\n[reply token ${token}]${input.photos?.length ? `\n[${input.photos.length} photo${input.photos.length === 1 ? '' : 's'} attached]` : ''}`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station };
  queueOutbox(email);
  const m = pushConv(c, { direction: 'out', source: 'staff', by: a.by, station: a.station, text: signed(input.text, a.by, c.division), at: email.createdAt, token, emailId: email.id, templateKey: input.templateKey, photos: input.photos?.length ? input.photos : undefined });
  await markConversationRead(id); if (c.status === 'snoozed') { c.status = 'open'; c.snoozedUntil = undefined; }
  cxStamp(`Reply queued → Sent · ${client.firstName} ${client.lastName} · ${token}${input.templateKey ? ` · template ${input.templateKey}` : ''}`); return resolve(m);
}
export async function addThreadNote(id: string, text: string): Promise<ConvMessage> { const c = convOf(id); if (!text.trim()) throw new Error('Write the note first'); const a = actor(); const m = pushConv(c, { direction: 'internal', source: 'note', by: a.by, station: a.station, text: text.trim(), at: new Date().toISOString() }); cxStamp(`Internal note on thread · ${c.subject}`); return resolve(m); }
// MOCK: a client reply arriving by email, routed back to its thread by the reply token of the last outbound message
export async function simulateInboundReply(id: string, text: string): Promise<ConvMessage> {
  const c = convOf(id); const lastOut = cx.messages.filter((m) => m.conversationId === id && m.direction === 'out' && m.token).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!lastOut) throw new Error('No outbound token to match — send a reply first'); const client = byId(fx.clients, c.clientId);
  const m = pushConv(c, { direction: 'in', source: 'email', by: `${client.firstName} ${client.lastName}`, text: text.trim() || 'Thanks, sounds good.', at: new Date().toISOString(), matchedToken: lastOut.token, readByStaff: false });
  cxStamp(`Inbound email matched by token ${lastOut.token} → ${c.subject} (mock)`); return resolve(m);
}
// Signals for cards / Client 360 / today
export const threadNeedsReplyFor = (anchor: ConversationAnchor): ConversationWithRefs | undefined => { const c = cx.conversations.find((x) => x.anchor?.kind === anchor.kind && x.anchor.id === anchor.id && convNeedsReply(x)); return c ? convRefs(c) : undefined; };
export const clientNeedsReplyCount = (clientId: string) => cx.conversations.filter((c) => c.clientId === clientId && convNeedsReply(c)).length;
export const threadsNeedingReplyForUser = (me: User) => { wakeSnoozed(); const div = getSessionDivision(); return cx.conversations.filter((c) => c.division === div && convNeedsReply(c) && c.assignedTo && assigneeMatches(c.assignedTo, me)).map(convRefs); };
export async function getCommsUnread(): Promise<number> { wakeSnoozed(); return resolve(cx.conversations.filter((c) => c.division === getSessionDivision() && convNeedsReply(c)).length); }

// ---- E15 Portal-first inspection report (MH 2026-09-25): emails notify, the portal renders ----------
import type { ComponentGrade, InspectionReportDoc, PortalInspectionReport } from './types';
export { REPORT_COMPONENTS } from './fixtures/reports';
export const COMPONENT_GRADES: ComponentGrade[] = ['good', 'fair', 'worn', 'replace'];
const rp = { reports: fx.inspectionReports.map((r): InspectionReportDoc => ({ ...r, grades: r.grades.map((g) => ({ ...g })) })), decisions: fx.decisionSeeds.map((d): InspectionDecisionRecord => ({ ...d, survey: d.survey.map((q) => ({ ...q })) })) };
export const INSPECTION_SURVEY = ['How would you like us to reach you with updates?', 'Anything we should know about this watch?'];
export async function getInspectionDecisions(filter: { clientId?: string; jobId?: string; watchId?: string }): Promise<InspectionDecisionRecord[]> { return resolve(rp.decisions.filter((d) => (!filter.clientId || d.clientId === filter.clientId) && (!filter.jobId || d.jobId === filter.jobId) && (!filter.watchId || d.watchId === filter.watchId)).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))); }
// "Ask a question" on the approval page → portal thread + staff Inbox Needs reply, anchored to the job
export async function portalAskAboutReport(token: string, text: string): Promise<Message> { const r = rp.reports.find((x) => x.token === token); if (!r) throw new Error('This report link is not valid'); const m = await portalSendMessage(r.clientId, `[Inspection report v${r.version}] ${text.trim()}`, r.watchId); return m; }
// seeded short notification for Eleanor's v2 report
store.outbox.push({ id: 'ob-rep-02', to: 'eleanor.vance@example.com', toName: 'Eleanor Vance', relatedRef: 'E02021', status: 'pending', subject: 'Your inspection report is ready — Cosmograph Daytona', body: `Hello Eleanor,\n\nWe have finished inspecting your Rolex Cosmograph Daytona. Condition grades, photos and our notes are on your report page, where you can approve or decline:\n\n▶ /rc/report/IR-ELEANOR-V2\n\n— The RolliSuite team`, createdAt: rp.reports[1].issuedAt, createdBy: 'Walter', station: 'Inspection Bench' });

const renderTemplateFor = (key: TemplateKey, ctx: { clientId: string; anchor?: ConversationAnchor }) => { const t = rs.templates.find((x) => x.key === key)!; const vals = mergeValues(ctx); const fill = (x: string) => x.replace(/\{\{[a-z_.]+\}\}/g, (f) => vals[f] || ''); return { subject: fill(t.subject), body: fill(t.body) }; };
const chainEnd = (r: InspectionReportDoc): InspectionReportDoc => (r.supersededById ? chainEnd(byId(rp.reports, r.supersededById)) : r);

export async function getInspectionReportsForJob(jobId: string): Promise<InspectionReportDoc[]> { return resolve(rp.reports.filter((r) => r.jobId === jobId).sort((a, b) => b.version - a.version)); }
export async function issueInspectionReport(jobId: string, grades: { component: string; grade: ComponentGrade; note?: string }[], notes: string): Promise<InspectionReportDoc> {
  const j = getJobRow(jobId); const a = actor(); const client = byId(fx.clients, j.clientId);
  if (!j.photos.length) throw new Error('Inspection photos required before a report can go to the client');
  if (!grades.length || grades.some((g) => !g.grade)) throw new Error('Grade every component');
  const prev = rp.reports.filter((r) => r.jobId === jobId).sort((a, b) => b.version - a.version)[0];
  const r: InspectionReportDoc = { id: newId('rep'), token: `IR-${j.number}-V${(prev?.version ?? 0) + 1}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, version: (prev?.version ?? 0) + 1, jobId, watchId: j.watchId, clientId: j.clientId, estimateId: j.estimateId, status: 'issued', supersedes: prev?.id, grades: grades.map((g) => ({ ...g, note: g.note?.trim() || undefined })), notes: notes.trim(), photoIds: j.photos.map((p) => p.id), issuedAt: new Date().toISOString(), issuedBy: a.by, station: a.station };
  if (prev && prev.status === 'issued') { prev.status = 'superseded'; prev.supersededById = r.id; }
  rp.reports.unshift(r);
  if (j.status === 'in_review' && legalJobActions(j).some((x) => x.key === 'request_approval')) pushTransition(j, 'request_approval', 'awaiting_customer_approval', `Inspection report v${r.version} issued — portal link sent`, true);
  const t = renderTemplateFor('inspection_ready', { clientId: j.clientId, anchor: { kind: 'job', id: j.id } });
  const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}`, to: client.email, toName: `${client.firstName} ${client.lastName}`, relatedRef: j.number, status: 'pending', subject: t.subject, body: t.body, createdAt: r.issuedAt, createdBy: a.by, station: a.station };
  email.body = `${email.body}\n\n▶ Open your inspection report: ${typeof window !== 'undefined' ? window.location.origin : ''}/rc/report/${r.token}`;
  queueOutbox(email); r.emailId = email.id;
  threadEvent(j.clientId, { kind: 'job', id: j.id }, 'system', a.by, `Inspection report v${r.version} issued — notification queued with portal link /rc/report/${r.token}`);
  jobStamp(j, `Inspection report v${r.version} issued to client (portal-first)`);
  return resolve({ ...r });
}
export async function portalGetInspectionReport(token: string): Promise<PortalInspectionReport> {
  const r = rp.reports.find((x) => x.token === token); if (!r) throw new Error('This report link is not valid');
  const job = getJobRow(r.jobId); const end = chainEnd(r);
  return resolve({ decision: rp.decisions.find((d) => d.reportId === r.id), report: r, watch: byId(store.watches, r.watchId), client: byId(fx.clients, r.clientId), job, estimate: r.estimateId ? store.estimates.find((e) => e.id === r.estimateId) : undefined, photos: job.photos.filter((p) => !r.photoIds.length || r.photoIds.includes(p.id)), newerToken: end.id !== r.id ? end.token : undefined });
}
export async function portalDecideInspectionReport(token: string, decision: 'approve' | 'decline', reason?: string, input?: DecisionInput): Promise<PortalInspectionReport> {
  const r = rp.reports.find((x) => x.token === token); if (!r) throw new Error('This report link is not valid');
  if (!input?.signature?.trim()) throw new Error('Please sign with your name to confirm');
  if (r.status === 'superseded') throw new Error('A newer report replaces this one'); if (r.status !== 'issued') throw new Error('This report has already been decided');
  if (decision === 'decline' && !reason?.trim()) throw new Error('Please tell us why');
  const j = getJobRow(r.jobId); const est = r.estimateId ? store.estimates.find((e) => e.id === r.estimateId) : undefined;
  await asClient(r.clientId, async () => {
    if (decision === 'approve') { if (j.status === 'awaiting_customer_approval') await transitionJob(j.id, 'approve'); if (est?.status === 'sent') await approveEstimate(est.id, 'portal'); }
    else { if (j.status === 'awaiting_customer_approval') await transitionJob(j.id, 'back_to_review', `Client declined inspection report v${r.version}: ${reason!.trim()}`); if (est?.status === 'sent') await declineEstimate(est.id, reason!.trim(), 'portal'); }
  });
  r.status = decision === 'approve' ? 'approved' : 'declined'; r.decidedAt = new Date().toISOString(); r.decidedVia = 'portal'; r.declineReason = decision === 'decline' ? reason!.trim() : undefined;
  { const j2 = getJobRow(r.jobId); const rec: InspectionDecisionRecord = { id: newId('dec'), reportId: r.id, reportVersion: r.version, jobId: r.jobId, jobNumber: j2.number, watchId: r.watchId, clientId: r.clientId, decision, reason: reason?.trim() || undefined, polish: input!.polish, survey: input!.survey, signature: input!.signature.trim(), decidedAt: new Date().toISOString(), via: 'portal' }; rp.decisions.unshift(rec); jobStamp(j2, `Client decision record · ${decision} · polish ${rec.polish} · signed “${rec.signature}”`); }
  threadEvent(r.clientId, { kind: 'job', id: j.id }, 'approval', clientName(r.clientId), decision === 'approve' ? `Approved inspection report v${r.version} (${j.number}) in RolliConnect${est ? ` · estimate ${est.number} approved` : ''}` : `Declined inspection report v${r.version} (${j.number}): ${reason!.trim()}`, { kind: decision === 'approve' ? 'estimate_approved' : 'estimate_declined', refId: r.id, label: `Inspection · ${j.number}` });
  portalStamp(r.clientId, `${decision === 'approve' ? 'Approved' : 'Declined'} inspection report v${r.version} · ${j.number}`);
  return portalGetInspectionReport(token);
}

// ---- E12 RolliTime timing bench (NEW automation — legacy never had it) ------------------------------
import type { CaliberTolerance, TimingEvaluation, TimingInput, TimingTest } from './types';
export { TIMING_POSITIONS } from './fixtures/rollitime';
const rt = { tests: fx.timingTests.map((t): TimingTest => ({ ...t, readings: t.readings.map((r) => ({ ...r })) })) };
const rtStamp = (detail: string) => { const a = actor(); appendAudit({ type: 'rollitime', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail }); };
export const toleranceForWatch = (w: Watch): CaliberTolerance => fx.caliberTolerances.find((c) => c.refPrefixes.some((p) => w.reference.toUpperCase().startsWith(p.toUpperCase()))) ?? fx.GENERIC_TOLERANCE;
const round1 = (n: number) => Math.round(n * 10) / 10;
export const evaluateTiming = (tol: CaliberTolerance, input: Pick<TimingInput, 'readings' | 'powerReserve'>): TimingEvaluation & { avgRate: number; avgBeat: number; avgAmp: number; delta: number } => {
  const rs = input.readings; const n = rs.length || 1;
  const avgRate = round1(rs.reduce((t, r) => t + r.rate, 0) / n); const avgBeat = round1(rs.reduce((t, r) => t + r.beat, 0) / n * 10) / 10; const avgAmp = round1(rs.reduce((t, r) => t + r.amp, 0) / n);
  const delta = rs.length ? Math.max(...rs.map((r) => r.rate)) - Math.min(...rs.map((r) => r.rate)) : 0;
  const flags: string[] = [];
  const crit1 = delta < tol.crit1MaxDelta; if (!crit1) flags.push(`Δ ${delta} s/d ≥ ${tol.crit1MaxDelta}`);
  const crit2 = avgRate >= tol.crit2Min && avgRate <= tol.crit2Max; if (!crit2) flags.push(`avg ${avgRate} s/d outside ${tol.crit2Min}/+${tol.crit2Max}`);
  const beat = rs.every((r) => r.beat <= tol.beatMax); if (!beat) flags.push(`beat ${Math.max(...rs.map((r) => r.beat))} ms > ${tol.beatMax}`);
  const amp = rs.every((r) => r.amp >= tol.ampMin && r.amp <= tol.ampMax); if (!amp) flags.push(`amplitude outside ${tol.ampMin}–${tol.ampMax}°`);
  const reserve = input.powerReserve >= tol.reserveHours; if (!reserve) flags.push(`reserve ${input.powerReserve} h < ${tol.reserveHours}`);
  return { crit1, crit2, beat, amp, reserve, suggested: crit1 && crit2 && beat && amp && reserve ? 'pass' : 'reject', flags, avgRate, avgBeat, avgAmp, delta };
};
// Q47 — timing PASS flags the job (stays in testing) and feeds the RW QC queue lane; a later send-back / qc_fail clears it
export const timingPassed = (j: Job): TimingTest | undefined => { const since = [...j.timeline].reverse().find((t) => t.to === 'testing')?.at ?? ''; return rt.tests.find((t) => t.jobId === j.id && t.verdict === 'pass' && t.at >= since); };
// Testing station scan = standard custody transfer of every part to Testing (scan event), then the bench opens
export async function testingStationScan(label: string): Promise<JobWithRefs> {
  const j = await findJobByLabel(label); if (!j) throw new Error('No job matches that label');
  if (j.status !== 'testing') throw new Error(`${j.number} is ${j.status.replace(/_/g, ' ')} — only jobs in testing can be timed`);
  const row = getJobRow(j.id); for (const c of ensureParts(row)) { if (derivePlacement(row, c).station !== 'testing') await movePart(row.id, c.key, 'testing', 'station'); }
  rw18.stationMemory = 'testing'; return resolve(jobRefs(row));
}
export async function getTestingQueue(): Promise<JobWithRefs[]> { return resolve(store.jobs.filter((j) => j.status === 'testing' && j.division === getSessionDivision()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(jobRefs)); }
export async function findJobByLabel(scan: string): Promise<JobWithRefs | null> {
  const q = scan.trim().toUpperCase(); if (!q) return resolve(null); const head = q.split('|')[0];
  const j = store.jobs.find((x) => x.number === head) ?? store.jobs.filter((x) => x.status !== 'closed').find((x) => { const w = byId(store.watches, x.watchId); return q.includes(w.serial.toUpperCase()) || q === w.reference.toUpperCase() || q === `${w.reference}/${w.serial}`.toUpperCase() || q === `${w.reference} / ${w.serial}`.toUpperCase(); });
  return resolve(j ? jobRefs(j) : null);
}
export async function getTimingTests(filter: { jobId?: string; watchId?: string }): Promise<TimingTest[]> { return resolve(rt.tests.filter((t) => (!filter.jobId || t.jobId === filter.jobId) && (!filter.watchId || t.watchId === filter.watchId)).sort((a, b) => b.at.localeCompare(a.at))); }
export async function recordTimingTest(jobId: string, input: TimingInput): Promise<TimingTest> {
  const j = getJobRow(jobId); if (j.status !== 'testing') throw new Error('Only jobs in testing can be timed'); const gate = gradeGateFor(j); if (!gate.ready) throw new Error(`Work grading gate — score ${gate.missing.join(' and ')} before the timing test can start`); const w = byId(store.watches, j.watchId); const tol = toleranceForWatch(w); const a = actor();
  if (input.readings.length !== 6 || input.readings.some((r) => [r.rate, r.beat, r.amp].some((v) => !Number.isFinite(v)))) throw new Error('Enter rate, beat error and amplitude for all six positions');
  if (!(input.powerReserve > 0) || !(input.liftAngle > 0)) throw new Error('Lift angle and power reserve are required');
  if (input.verdict === 'reject' && !input.reason?.trim()) throw new Error('A rejection reason is required');
  const ev = evaluateTiming(tol, input);
  const t: TimingTest = { id: newId('tt'), jobId, watchId: w.id, jobNumber: j.number, caliber: tol.caliber, readings: input.readings.map((r) => ({ ...r })), avgRate: ev.avgRate, avgBeat: ev.avgBeat, avgAmp: ev.avgAmp, delta: ev.delta, liftAngle: input.liftAngle, powerReserve: input.powerReserve, evaluation: { crit1: ev.crit1, crit2: ev.crit2, beat: ev.beat, amp: ev.amp, reserve: ev.reserve, suggested: ev.suggested, flags: ev.flags }, verdict: input.verdict, reason: input.reason?.trim() || undefined, at: new Date().toISOString(), by: a.by, station: a.station };
  rt.tests.unshift(t);
  const client = byId(fx.clients, j.clientId);
  if (input.verdict === 'pass') {
    const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}`, to: client.email, toName: `${client.firstName} ${client.lastName}`, relatedRef: j.number, status: 'pending', subject: `Testing complete — ${w.model}`, body: `Hello ${client.firstName},\n\nYour ${w.brand} ${w.model} has completed timing tests on our bench and moves to final quality control. Details are on your watch page:\n\n▶ ${typeof window !== 'undefined' ? window.location.origin : ''}/rc/watches/${w.id}\n\n— The RolliSuite team`, createdAt: t.at, createdBy: a.by, station: a.station };
    queueOutbox(email); t.emailId = email.id;
    jobStamp(j, `Timing test PASS · avg ${t.avgRate} s/d · Δ ${t.delta} · ${t.powerReserve} h — to QC queue`);
    rtStamp(`${j.number} timing PASS · ${tol.caliber} · avg ${t.avgRate} s/d · Δ ${t.delta} · beat ${t.avgBeat} ms · amp ${t.avgAmp}° · reserve ${t.powerReserve} h${ev.suggested === 'reject' ? ' · OVERRIDE (auto-eval suggested reject)' : ''}`);
  } else {
    await transitionJob(j.id, 'qc_fail', `Timing rejected: ${input.reason!.trim()}`);
    rtStamp(`${j.number} timing REJECT · ${tol.caliber} · ${input.reason!.trim()} · flags: ${ev.flags.join('; ') || 'none'}${ev.suggested === 'pass' ? ' · OVERRIDE (auto-eval suggested pass)' : ''}`);
  }
  return resolve({ ...t });
}

// ---- E13 RGTime `/rg` — NFC-tap time-clock (phone PWA). In Keeper RGTime owns staff identity (D-026); here it reads the same `users` fixture. ------
import type { ClockState, KioskDetails, KioskResult, KioskSubmission, NfcTag, Punch, PunchFlag, PunchKind, RequestRow, RgFlagRow, RgSettings, WeekDay, WeekRow, WeekView } from './types';
export { KIOSK_SERVICES, KIOSK_BRANDS, RG_DIVISION_LABEL } from './fixtures';
// /rg persists locally (device-bound punches, offline queue, settings) so a real NFC tap — a fresh page load every time — toggles in/out correctly. The rest of the app stays in-memory.
const RG_KEYS = { punches: 'rollisuite.rg.punches', settings: 'rollisuite.rg.settings', queue: 'rollisuite.rg.queue', kioskStation: 'rollisuite.rg.kioskStation' };
export const RG_DEFAULT_SETTINGS: RgSettings = { shopLat: 40.759, shopLng: -73.9845, radiusM: 150, simulateOffsite: false, simulateOffline: false };
const rgSeedIds = new Set(fx.punches.map((p) => p.id));
const rg = {
  punches: [...fx.punches.map((p): Punch => ({ ...p })), ...readJson<Punch[]>(RG_KEYS.punches, []).filter((p) => !rgSeedIds.has(p.id))],
  queue: readJson<Punch[]>(RG_KEYS.queue, []),
  settings: { ...RG_DEFAULT_SETTINGS, ...readJson<Partial<RgSettings>>(RG_KEYS.settings, {}) } as RgSettings,
};
const rgPersist = () => { writeJson(RG_KEYS.punches, rg.punches.filter((p) => !rgSeedIds.has(p.id))); writeJson(RG_KEYS.queue, rg.queue); };
const RG_STATION = 'Phone (RGTime PWA)';
const rgAudit = (u: User | undefined, detail: string, type: 'rgtime' | 'sign_in' | 'sign_in_failed' | 'sign_out' = 'rgtime') => appendAudit({ type, stationName: RG_STATION, userShortName: u?.shortName, userDisplayName: u?.displayName, method: type === 'sign_in' || type === 'sign_in_failed' ? 'password_photo' : undefined, detail });
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const todayKey = () => dayKey(new Date().toISOString());
const round2 = (n: number) => Math.round(n * 100) / 100;
const summarizeDay = (rows: Punch[], isToday: boolean): { hours: number; open: boolean } => {
  const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at)); let ms = 0; let openAt: string | null = null;
  for (const p of sorted) { if (p.kind === 'in') openAt = p.at; else if (openAt) { ms += new Date(p.at).getTime() - new Date(openAt).getTime(); openAt = null; } }
  if (openAt && isToday) ms += Date.now() - new Date(openAt).getTime();
  return { hours: round2(ms / 3_600_000), open: !!openAt };
};
// Effective ledger = every row minus originals that a correction row supersedes (append-only: the original is never edited), plus punches still queued offline
const rgSuperseded = () => new Set(rg.punches.filter((p) => p.correctionOf).map((p) => p.correctionOf!));
export const rgEffectivePunches = (): Punch[] => { const sup = rgSuperseded(); return [...rg.punches.filter((p) => !sup.has(p.id)), ...rg.queue.map((p) => ({ ...p, queued: true }))]; };
export const rgAllPunches = (): Punch[] => [...rg.punches];
const rgLast = (userId: string) => rgEffectivePunches().filter((p) => p.userId === userId).sort((a, b) => b.at.localeCompare(a.at))[0];

export const rgGetSession = (): User | null => { const id = localStorage.getItem(KEYS.rgSession); return id ? fx.users.find((u) => u.id === id) ?? null : null; };
export const rgAllStaff = (): User[] => [...fx.users];
const rgSecretOk = (u: User, secret: string) => secret === u.password || (secret.length === 4 && secret === u.pin);
// Device ↔ employee binding: name + PIN (or password) once; every later visit already knows who you are
export async function rgSignIn(userId: string, secret: string): Promise<User> {
  const u = byId(fx.users, userId);
  if (!rgSecretOk(u, secret)) { rgAudit(u, 'RGTime device binding failed · incorrect PIN', 'sign_in_failed'); throw new Error('Incorrect PIN'); }
  localStorage.setItem(KEYS.rgSession, u.id); rgAudit(u, 'RGTime · this phone now remembers ' + u.shortName, 'sign_in'); return resolve(u);
}
export async function rgSignOut(): Promise<void> { const u = rgGetSession(); localStorage.removeItem(KEYS.rgSession); if (u) rgAudit(u, 'RGTime sign-out · phone forgotten', 'sign_out'); return resolve(undefined); }
// Manager view is concierge+ (Q56): card + PIN/password, even on a remembered phone
export async function rgVerifyManager(userId: string, secret: string): Promise<User> {
  const u = byId(fx.users, userId);
  if (!rgSecretOk(u, secret)) { rgAudit(u, 'RGTime manager view · incorrect PIN', 'sign_in_failed'); throw new Error('Incorrect PIN'); }
  rgAudit(u, 'RGTime manager view opened'); return resolve(u);
}
export const getNfcTags = (): NfcTag[] => fx.nfcTags.map((t) => ({ ...t }));
export const getNfcTag = (id: string): NfcTag | undefined => fx.nfcTags.find((t) => t.id === id);
export const rgGetSettings = (): RgSettings => ({ ...rg.settings });
export async function rgSaveSettings(patch: Partial<RgSettings>, by?: string): Promise<RgSettings> {
  rg.settings = { ...rg.settings, ...patch }; writeJson(RG_KEYS.settings, rg.settings);
  if (patch.shopLat !== undefined || patch.shopLng !== undefined || patch.radiusM !== undefined) rgAudit(fx.users.find((u) => u.shortName === by), `RGTime geofence set · ${rg.settings.shopLat.toFixed(5)}, ${rg.settings.shopLng.toFixed(5)} · ${rg.settings.radiusM} m`);
  return resolve({ ...rg.settings });
}
export const rgIsOffline = () => (typeof navigator !== 'undefined' && !navigator.onLine) || rg.settings.simulateOffline;
export const rgDistanceM = (lat: number, lng: number): number => {
  const R = 6_371_000, toRad = (d: number) => (d * Math.PI) / 180, dLat = toRad(lat - rg.settings.shopLat), dLng = toRad(lng - rg.settings.shopLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(rg.settings.shopLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
};
export const rgQueueCount = () => rg.queue.length;
export async function getClockState(userId: string): Promise<ClockState> {
  const user = byId(fx.users, userId); const tk = todayKey(); const all = rgEffectivePunches();
  const todayPunches = all.filter((p) => p.userId === userId && dayKey(p.at) === tk).sort((a, b) => b.at.localeCompare(a.at));
  const last = rgLast(userId);
  const onClock = last?.kind === 'in'; const { hours } = summarizeDay(todayPunches, true);
  return resolve({ user, onClock, since: onClock ? last.at : undefined, sinceLocation: onClock ? last.location : undefined, todayPunches, todayHours: hours });
}
export interface PunchOptions { simulated?: boolean; geo?: { lat: number; lng: number } | null; source?: 'nfc' | 'kiosk'; userId?: string }
// The whole product: tag → one button → punch. Geofence flags (never rejects); no signal → queued locally with the true timestamp
export async function punchClock(stationId: string, opts: PunchOptions | boolean = {}): Promise<Punch> {
  const o: PunchOptions = typeof opts === 'boolean' ? { simulated: opts } : opts;
  const u = o.userId ? byId(fx.users, o.userId) : rgGetSession(); if (!u) throw new Error('Sign in to RGTime on this phone first');
  const tag = getNfcTag(stationId); if (!tag) throw new Error('Unknown station — this NFC tag is not registered');
  if (u.division !== 'both' && u.division !== tag.division) throw new Error(`${u.shortName} is ${fx.RG_DIVISION_LABEL[u.division]} staff — this tag belongs to ${fx.RG_DIVISION_LABEL[tag.division]}`);
  const last = rgLast(u.id); const kind: PunchKind = last?.kind === 'in' ? 'out' : 'in';
  const flags: PunchFlag[] = []; let geo: Punch['geo'] = null;
  if (o.source === 'kiosk') flags.push('kiosk');
  else if (o.geo) { const distanceM = rg.settings.simulateOffsite ? 2_340 : rgDistanceM(o.geo.lat, o.geo.lng); geo = { ...o.geo, distanceM }; if (distanceM > rg.settings.radiusM) flags.push('offsite'); }
  else if (rg.settings.simulateOffsite) { geo = { lat: 40.7794, lng: -73.9632, distanceM: 2_340 }; flags.push('offsite'); }
  else flags.push('no_gps');
  const p: Punch = { id: newId('pu'), userId: u.id, kind, at: new Date().toISOString(), tagId: tag.id, location: tag.label, division: tag.division, simulated: !!o.simulated, source: o.source ?? 'nfc', flags: flags.length ? flags : undefined, geo };
  if (rgIsOffline()) { rg.queue.push(p); rgPersist(); return { ...p, queued: true }; }
  p.recordedAt = p.at; rg.punches.push(p); rgPersist();
  rgAudit(u, `Clock ${kind.toUpperCase()} · ${tag.label} · ${fx.RG_DIVISION_LABEL[tag.division]}${flags.includes('offsite') ? ` · OFFSITE ${geo?.distanceM} m` : ''}${flags.includes('kiosk') ? ' · kiosk' : ''}${o.simulated ? ' · simulated tap (prototype)' : ' · NFC tap'}`);
  return { ...p };
}
// Connectivity back → queued punches land with their true `at`, marked synced-late (recordedAt = now)
export async function rgSyncQueue(): Promise<Punch[]> {
  if (rgIsOffline() || !rg.queue.length) return [];
  const now = new Date().toISOString(); const synced = rg.queue.map((p): Punch => ({ ...p, recordedAt: now, flags: [...(p.flags ?? []), 'synced_late'] }));
  rg.punches.push(...synced); rg.queue = []; rgPersist();
  synced.forEach((p) => rgAudit(fx.users.find((u) => u.id === p.userId), `Clock ${p.kind.toUpperCase()} · ${p.location} · synced late (punched ${new Date(p.at).toLocaleTimeString()})`));
  return synced;
}
// Kiosk fallback: wall iPad locked to a station; anyone taps their name + PIN
export const rgKioskStation = (): NfcTag | undefined => getNfcTag(localStorage.getItem(RG_KEYS.kioskStation) ?? '');
export const rgSetKioskStation = (id: string) => localStorage.setItem(RG_KEYS.kioskStation, id);
export async function rgKioskPunch(userId: string, pin: string, stationId: string): Promise<Punch> {
  const u = byId(fx.users, userId); if (pin !== u.pin) { rgAudit(u, 'Kiosk punch · incorrect PIN', 'sign_in_failed'); throw new Error('Incorrect PIN'); }
  return punchClock(stationId, { source: 'kiosk', userId });
}
const rgStaffFor = (division: Division | 'all') => (division === 'all' ? [...fx.users] : getDivisionStaff(division));
const weekDays = (weekOffset: number) => { const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7); const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return dayKey(d.toISOString()); }); const end = new Date(start); end.setDate(start.getDate() + 6); return { start, end, days }; };
const weekRowFor = (user: User, mine: Punch[], days: string[]): WeekRow => {
  const tk = todayKey();
  const dayRows: WeekDay[] = days.map((date) => { const punches = mine.filter((p) => dayKey(p.at) === date).sort((a, b) => a.at.localeCompare(b.at)); const s = summarizeDay(punches, date === tk); return { date, punches, hours: s.hours, open: s.open, flagged: punches.some((p) => p.flags?.length) }; });
  return { user, days: dayRows, total: round2(dayRows.reduce((t, d) => t + d.hours, 0)), openNow: dayRows.some((d) => d.date === tk && d.open) };
};
export async function getTodayBoard(division: Division): Promise<ClockState[]> {
  const rows = await Promise.all(getDivisionStaff(division).map((u) => getClockState(u.id)));
  return resolve(rows.filter((r) => r.todayPunches.some((p) => p.division === division) || r.onClock).map((r) => ({ ...r, todayPunches: r.todayPunches.filter((p) => p.division === division) })));
}
export async function getWeekHours(division: Division | 'all', weekOffset: number): Promise<WeekView> {
  const { start, end, days } = weekDays(weekOffset); const all = rgEffectivePunches();
  const rows = rgStaffFor(division).map((user) => weekRowFor(user, all.filter((p) => p.userId === user.id && (division === 'all' || p.division === division)), days));
  return resolve({ start: start.toISOString(), end: end.toISOString(), division, rows, weekOffset });
}
// Employee's own week — every station, every division they punched at
export async function getMyWeek(userId: string, weekOffset: number): Promise<WeekView> {
  const { start, end, days } = weekDays(weekOffset); const user = byId(fx.users, userId);
  return resolve({ start: start.toISOString(), end: end.toISOString(), division: 'all', rows: [weekRowFor(user, rgEffectivePunches().filter((p) => p.userId === userId), days)], weekOffset });
}
// Manager attention list: offsite · synced late · missed clock-out (open punch on a past day) · corrections (audit trail)
export async function rgGetFlags(division: Division | 'all'): Promise<RgFlagRow[]> {
  const tk = todayKey(); const staffIds = new Set(rgStaffFor(division).map((u) => u.id)); const rows: RgFlagRow[] = [];
  const all = rgEffectivePunches().filter((p) => staffIds.has(p.userId) && (division === 'all' || p.division === division));
  for (const p of all) {
    const user = byId(fx.users, p.userId);
    if (p.flags?.includes('offsite')) rows.push({ punch: p, user, kind: 'offsite' });
    if (p.flags?.includes('synced_late')) rows.push({ punch: p, user, kind: 'synced_late' });
    if (p.correctionOf) rows.push({ punch: p, user, kind: 'correction', original: rg.punches.find((x) => x.id === p.correctionOf) });
  }
  for (const uid of staffIds) { const byDay = new Map<string, Punch[]>(); all.filter((p) => p.userId === uid && dayKey(p.at) < tk).forEach((p) => byDay.set(dayKey(p.at), [...(byDay.get(dayKey(p.at)) ?? []), p])); for (const [, ps] of byDay) { const s = summarizeDay(ps, false); if (s.open) { const open = [...ps].sort((a, b) => b.at.localeCompare(a.at)).find((p) => p.kind === 'in')!; rows.push({ punch: open, user: byId(fx.users, uid), kind: 'missed_out' }); } } }
  return resolve(rows.sort((a, b) => b.punch.at.localeCompare(a.punch.at)));
}
// Corrections are append-only (Q52): a new row points at the original; the original is never edited, only superseded
export async function rgCorrectPunch(punchId: string, patch: { at?: string; kind?: PunchKind }, reason: string, by: string): Promise<Punch> {
  const orig = rg.punches.find((p) => p.id === punchId); if (!orig) throw new Error('Punch not found');
  if (!reason.trim()) throw new Error('A reason is required for every correction');
  if (rgSuperseded().has(orig.id)) throw new Error('This punch was already corrected — correct the newest row');
  const c: Punch = { ...orig, id: newId('pu'), at: patch.at ?? orig.at, kind: patch.kind ?? orig.kind, flags: ['correction'], geo: null, source: 'manager', correctionOf: orig.id, reason: reason.trim(), by, recordedAt: new Date().toISOString(), simulated: false };
  rg.punches.push(c); rgPersist();
  rgAudit(fx.users.find((u) => u.shortName === by), `Punch corrected · ${byId(fx.users, orig.userId).shortName} · ${orig.kind.toUpperCase()} ${new Date(orig.at).toLocaleString()} → ${c.kind.toUpperCase()} ${new Date(c.at).toLocaleString()} · ${c.reason}`);
  return resolve({ ...c });
}
// Missed clock-out resolution (or any missing punch): a manager-added row, flagged as a correction, with reason
export async function rgAddPunch(userId: string, kind: PunchKind, at: string, stationId: string, reason: string, by: string): Promise<Punch> {
  const u = byId(fx.users, userId); const tag = getNfcTag(stationId); if (!tag) throw new Error('Pick a station');
  if (!reason.trim()) throw new Error('A reason is required');
  const p: Punch = { id: newId('pu'), userId: u.id, kind, at, tagId: tag.id, location: tag.label, division: tag.division, simulated: false, source: 'manager', flags: ['correction'], geo: null, reason: reason.trim(), by, recordedAt: new Date().toISOString() };
  rg.punches.push(p); rgPersist();
  rgAudit(fx.users.find((x) => x.shortName === by), `Punch added · ${u.shortName} · ${kind.toUpperCase()} ${new Date(at).toLocaleString()} · ${tag.label} · ${p.reason}`);
  return resolve({ ...p });
}
// Payroll CSV for a pay-period range: one row per paired shift, corrections included and marked, per-person totals at the end
export function rgPayrollCsv(from: string, to: string, division: Division | 'all'): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['person,date,clock_in,clock_out,hours,station,flags,correction,corrected_by'];
  const totals: string[] = [];
  for (const user of rgStaffFor(division)) {
    const mine = rgEffectivePunches().filter((p) => p.userId === user.id && (division === 'all' || p.division === division) && dayKey(p.at) >= from && dayKey(p.at) <= to);
    const byDay = new Map<string, Punch[]>(); mine.forEach((p) => byDay.set(dayKey(p.at), [...(byDay.get(dayKey(p.at)) ?? []), p]));
    let total = 0; let corrections = 0;
    for (const [date, ps] of [...byDay.entries()].sort()) {
      const sorted = [...ps].sort((a, b) => a.at.localeCompare(b.at)); let openIn: Punch | null = null;
      for (const p of sorted) {
        if (p.kind === 'in') { if (openIn) lines.push([user.shortName, date, new Date(openIn.at).toLocaleTimeString(), '', '0', openIn.location, [...(openIn.flags ?? []), 'missing_out'].join('|'), openIn.reason ?? '', openIn.by ?? ''].map(esc).join(',')); openIn = p; continue; }
        const hrs = openIn ? round2((new Date(p.at).getTime() - new Date(openIn.at).getTime()) / 3_600_000) : 0; total += hrs;
        const flags = [...new Set([...(openIn?.flags ?? []), ...(p.flags ?? [])])]; if (flags.includes('correction')) corrections++;
        lines.push([user.shortName, date, openIn ? new Date(openIn.at).toLocaleTimeString() : '', new Date(p.at).toLocaleTimeString(), hrs.toFixed(2), p.location, flags.join('|'), p.reason ?? openIn?.reason ?? '', p.by ?? openIn?.by ?? ''].map(esc).join(',')); openIn = null;
      }
      if (openIn) lines.push([user.shortName, date, new Date(openIn.at).toLocaleTimeString(), '', '0', openIn.location, [...(openIn.flags ?? []), 'missing_out'].join('|'), openIn.reason ?? '', openIn.by ?? ''].map(esc).join(','));
    }
    totals.push(['TOTAL ' + user.shortName, `${from}..${to}`, '', '', total.toFixed(2), '', corrections ? `${corrections} corrected shift(s)` : '', '', ''].map(esc).join(','));
  }
  return [...lines, ...totals].join('\n');
}

// ---- E13 Kiosk `/kiosk` — public walk-in check-in (legacy kiosk, improved: match existing clients instead of duplicating) ------
const KIOSK_STATION = 'Kiosk';
const normEmail = (s: string) => s.trim().toLowerCase();
const normPhone = (s: string) => s.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const nextRequestNumber = () => `RQ-26-${String(Math.max(...store.requests.map((r) => Number(r.number.split('-')[2]) || 0)) + 1).padStart(4, '0')}`;
const kioskSummary = (k: Pick<KioskDetails, 'services' | 'notes'>, brand: Division) => `Kiosk check-in (${fx.RG_DIVISION_LABEL[brand]}) · ${k.services.length ? k.services.map((s) => fx.KIOSK_SERVICES.find((x) => x.key === s)!.label).join(', ') : 'no service selected'}${k.notes ? ` · “${k.notes}”` : ''}`;
const newKioskClient = (k: Pick<KioskDetails, 'firstName' | 'lastName' | 'email' | 'phone'>): Client => { const c: Client = { id: newId('c'), firstName: k.firstName, lastName: k.lastName, email: k.email, phone: k.phone, street: '', city: '', state: '', type: 'retail', since: new Date().toISOString() }; fx.clients.push(c); return c; };
const kioskAudit = (detail: string) => appendAudit({ type: 'kiosk', stationName: KIOSK_STATION, detail });
export async function submitKioskCheckIn(input: KioskSubmission): Promise<KioskResult> {
  const firstName = input.firstName.trim(), lastName = input.lastName.trim(), email = normEmail(input.email), phone = input.phone.trim();
  if (!firstName || !lastName) throw new Error('Please enter your first and last name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address');
  if (normPhone(phone).length < 10) throw new Error('Please enter a phone number with area code');
  const matchedOn: ('email' | 'phone')[] = []; const byEmail = fx.clients.find((c) => normEmail(c.email) === email); const byPhone = fx.clients.find((c) => normPhone(c.phone) === normPhone(phone));
  if (byEmail) matchedOn.push('email'); if (byPhone && (!byEmail || byPhone.id === byEmail.id)) matchedOn.push('phone');
  const matched = byEmail ?? byPhone;
  const details: KioskDetails = { firstName, lastName, email, phone, services: [...input.services], notes: input.notes?.trim() || undefined, matchState: matched ? 'possible' : 'none', matchedClientId: matched?.id, matchedOn: matched ? matchedOn : undefined };
  const client = matched ?? newKioskClient(details);
  const at = new Date().toISOString();
  const r: ServiceRequest = { id: newId('rq'), number: nextRequestNumber(), clientId: client.id, source: 'kiosk', status: 'new', summary: kioskSummary(details, input.brand), createdAt: at, createdBy: 'Kiosk', station: KIOSK_STATION, division: input.brand, kiosk: details };
  store.requests.unshift(r);
  // Requests are intake records, not conversations (MH 2026-10-02): no Inbox row — the Requests page is the record
  kioskAudit(`${r.number} · ${firstName} ${lastName} · ${fx.RG_DIVISION_LABEL[input.brand]} · ${details.services.length} service(s)${matched ? ` · possible match ${client.firstName} ${client.lastName} on ${matchedOn.join(' + ')}` : ' · new client'}`);
  return resolve({ request: { ...r }, client, possibleExisting: !!matched });
}
// ---- rolliworks.com structured service submission (SUB- · source = web). PROTOTYPE: the public form is emulated at /rwcom; KEEPER: the real site posts here. ----
export interface WebRequestInput { brand: Division; legs: string[]; legDepts: DeptCode[]; model?: string; ref?: string; serialMasked?: string; bracelet?: string; condition: string[]; notes?: string; photos: PackagePhoto[]; firstName: string; lastName: string; email: string; phone?: string; handover: 'drop_off' | 'ship'; typical?: string; claimCode?: string }
export interface WebRequestResult { request: ServiceRequest; client: Client; possibleExisting: boolean; ackEmail: OutboxEmail }
export async function submitWebRequest(input: WebRequestInput): Promise<WebRequestResult> {
  const firstName = input.firstName.trim(), lastName = input.lastName.trim(), email = normEmail(input.email);
  if (!firstName || !lastName) throw new Error('Please enter your first and last name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address');
  if (!input.legs.length) throw new Error('Pick at least one service');
  const matched = fx.clients.find((c) => normEmail(c.email) === email) ?? (input.phone && normPhone(input.phone).length >= 10 ? fx.clients.find((c) => normPhone(c.phone) === normPhone(input.phone!)) : undefined);
  const client = matched ?? newKioskClient({ firstName, lastName, email, phone: input.phone?.trim() ?? '' });
  const at = new Date().toISOString();
  const summary = `Web request (${fx.RG_DIVISION_LABEL[input.brand]}) · ${input.legs.join(', ')}${input.model ? ` · ${input.model}` : ''}${input.ref ? ` · ref ${input.ref}` : ''}${input.bracelet ? ` · ${input.bracelet}` : ''}${input.condition.length ? ` · ${input.condition.join(', ')}` : ''}${input.notes ? ` · “${input.notes.trim()}”` : ''} · ${input.handover === 'ship' ? 'will ship' : 'will drop off'}${input.typical ? ` · ${input.typical}` : ''}${input.claimCode ? ` · claim ${input.claimCode}` : ''}`;
  const photos = input.photos.map((p) => ({ ...p, stage: 0, origin: 'web' as const, controlled: false }));
  const r: ServiceRequest = { id: newId('rq'), number: nextRequestNumber(), clientId: client.id, source: 'web', status: 'new', summary, createdAt: at, createdBy: 'rolliworks.com', station: 'rolliworks.com', division: input.brand, legs: input.legDepts, photos };
  store.requests.unshift(r);
  // No Inbox row: the Requests page is the record; the Inbox gets a row only when the client writes on it (MH 2026-10-02)
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ackEmail: OutboxEmail = { id: `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, to: email, toName: `${firstName} ${lastName}`, relatedRef: r.number, status: 'pending', subject: `We received your request — ${r.number}`, body: `Hello ${firstName},\n\nThank you — your request ${r.number} is with our team. A person reads every one; expect an estimate or a question within one business day.\n\nWhat you told us: ${input.legs.join(', ')}${input.ref ? ` on a ${input.model ?? ''} (ref ${input.ref})` : ''}.${input.typical ? `\n${input.typical} — a range, not a quote.` : ''}\n\n▶ Follow it in RolliConnect (your first link — a code we email you is the key, no password): ${origin}/rc?email=${encodeURIComponent(email)}&mode=create\n\n— RolliWorks`, createdAt: at, createdBy: 'rolliworks.com', station: 'rolliworks.com' };
  queueOutbox(ackEmail);
  appendAudit({ type: 'kiosk', stationName: 'rolliworks.com', detail: `${r.number} · web request · ${firstName} ${lastName} · ${input.legs.join(', ')}${matched ? ' · existing client' : ' · new client'}` });
  return resolve({ request: { ...r }, client, possibleExisting: !!matched, ackEmail });
}
const requestRow = (r: ServiceRequest): RequestRow => ({ ...r, client: byId(fx.clients, r.clientId), watch: r.watchId ? store.watches.find((w) => w.id === r.watchId) : undefined });
// "Notify…" on a request: the hand-off itself is an internal message (hitlist.sendMessage, caller's side); here we only stamp who was told. The pool stays unowned.
export async function markRequestNotified(requestId: string, to: string): Promise<RequestRow> {
  const r = store.requests.find((x) => x.id === requestId); if (!r) throw new Error('Request not found');
  const a = actor(); r.notified = [...(r.notified ?? []), { to, by: a.by, at: new Date().toISOString() }];
  appendAudit({ type: 'kiosk', stationName: a.station, detail: `${r.number} · notified ${to} (internal message) · request stays unowned` });
  return resolve(requestRow(r));
}
export async function getRequestsQueue(): Promise<RequestRow[]> {
  const div = getSessionDivision();
  if (API_MODE === 'hybrid' && API_SOURCE.getRequests === 'real') {
    // Live intake leads (/intake/leads) — the lead's name/email stand in for a client record until it is matched
    const live = await getRequests(); return resolve(live.map((r) => { const known = fx.clients.find((c) => c.id === r.clientId); const [fn = '', ...rest] = (r.createdBy || 'Unknown lead').split(' '); return { ...r, client: known ?? ({ id: r.clientId || `lead-${r.id}`, firstName: fn, lastName: rest.join(' '), email: r.station, phone: '', street: '', city: '', state: '', type: 'retail', since: r.createdAt } as unknown as Client) }; }));
  }
  return resolve(store.requests.filter((r) => (r.division ?? 'rolliworks') === div).sort((a, b) => Number(isOpenRequest(b)) - Number(isOpenRequest(a)) || b.createdAt.localeCompare(a.createdAt)).map(requestRow));
}
const isOpenRequest = (r: ServiceRequest) => r.status === 'new' || r.status === 'quoted';
export async function resolveKioskMatch(requestId: string, decision: 'confirm' | 'split'): Promise<RequestRow> {
  const r = byId(store.requests, requestId); if (!r.kiosk || r.kiosk.matchState !== 'possible') throw new Error('This request has no pending client match');
  const a = actor(); const prev = byId(fx.clients, r.clientId);
  if (decision === 'confirm') { r.kiosk.matchState = 'confirmed'; }
  else { const c = newKioskClient(r.kiosk); r.clientId = c.id; r.kiosk.matchState = 'split'; cx.conversations.filter((x) => x.clientId === prev.id && cx.messages.some((m) => m.conversationId === x.id && m.source === 'kiosk' && m.text.includes(r.number))).forEach((x) => { x.clientId = c.id; cx.messages.filter((m) => m.conversationId === x.id).forEach((m) => { m.clientId = c.id; }); }); }
  appendAudit({ type: 'kiosk', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${r.number} · ${decision === 'confirm' ? `linked to existing client ${prev.firstName} ${prev.lastName}` : `split from ${prev.firstName} ${prev.lastName} → new client ${r.kiosk.firstName} ${r.kiosk.lastName}`}` });
  return resolve(requestRow(r));
}

// ---- E11 RolliWorking `/rw` — two-lane floor (legacy RW research, reference not gospel) ------------------------------------------
import type { RwFloorMap, RwStage } from './types';
const HEAD_STAGES: { key: RwStage['key']; label: string }[] = [{ key: 'intake', label: 'Intake' }, { key: 'review', label: 'Review' }, { key: 'bench', label: 'Movement bench' }];
const BAND_STAGES: { key: RwStage['key']; label: string }[] = [{ key: 'intake', label: 'Intake' }, { key: 'review', label: 'Review' }, { key: 'bench', label: 'Band bench' }, { key: 'polish', label: 'Polish' }];
const rwStageOf = (j: Job, lane: 'head' | 'band'): RwStage['key'] | null => {
  switch (j.status) {
    case 'intake': return 'intake';
    case 'in_review': return 'review';
    case 'approved': return 'bench';
    case 'in_service': return lane === 'band' && j.workflow.some((d) => d === 'P' || d === 'PM') && !j.workflow.includes('B') ? 'polish' : 'bench';
    default: return null;
  }
};
export async function getRwFloorMap(): Promise<RwFloorMap> {
  const division = getSessionDivision();
  const live = store.jobs.filter((j) => j.division === division && j.status !== 'closed');
  const safe = (j: Job) => !!activeHold(j) || j.status === 'awaiting_customer_approval' || j.status === 'ready_to_ship';
  const flowing = live.filter((j) => !safe(j) && !awaitingComponents(j));
  const isHead = (j: Job) => j.workflow.includes('W') || j.workflow.length === 0;
  const isBand = (j: Job) => j.workflow.some((d) => d === 'B' || d === 'P' || d === 'PM');
  const lane = (stages: typeof HEAD_STAGES, pick: (j: Job) => boolean, which: 'head' | 'band'): RwStage[] => stages.map((s) => ({ ...s, jobs: flowing.filter((j) => pick(j) && rwStageOf(j, which) === s.key).map(jobRefs) }));
  return resolve({
    division,
    head: lane(HEAD_STAGES, isHead, 'head'),
    band: lane(BAND_STAGES, isBand, 'band'),
    finalAssembly: flowing.filter((j) => j.status === 'testing').map(jobRefs),
    intoSafe: [
      { key: 'components', label: 'Awaiting components', jobs: live.filter((j) => awaitingComponents(j)).map(jobRefs) },
      { key: 'hold', label: 'On hold', jobs: live.filter((j) => !!activeHold(j)).map(jobRefs) },
      { key: 'approval', label: 'Awaiting approval', jobs: live.filter((j) => !activeHold(j) && j.status === 'awaiting_customer_approval').map(jobRefs) },
      { key: 'ready', label: 'Ready — in safe', jobs: live.filter((j) => !activeHold(j) && j.status === 'ready_to_ship').map(jobRefs) },
    ],
  });
}

// ---- E18 RW deep build — shop floor core (parts = components with station/status/custody/history) --------------------
import type { FloorDot, GateDirection, GateScan, GateTrack, JobPhotoView, PadCard, PartHistoryView, PartMove, PartStatus, PartSuggestion, PickTask, PickTaskView, RoomSummary, RwStation, RwStationKey, ScanSession, SendBackReason, WorkQueueRow } from './types';
export type { GateDirection, GateScan, GateTrack, Caliber, PartInput, PartRow, PartSafe, ZeroBalance, ZeroBalanceReason } from './types';
export { isSafeStation } from './types';
export { RW_STATIONS } from './fixtures';
const rw18 = { picks: fx.pickTasks.map((p): PickTask => ({ ...p })), recent: fx.recentPartChoices.map((r) => ({ ...r })), replied: new Set<string>(), scanSession: { rows: [] } as ScanSession, stationMemory: null as RwStationKey | null, undos: new Map<string, { jobId: string; key: ComponentKey; before: { station?: RwStationKey; partStatus?: PartStatus; custodyTech?: string; historyLen: number; timelineLen: number; status: JobStatus }; transitioned: boolean; expiresAt: number }>() };
const PART_LABEL: Record<ComponentKey, string> = { head: 'Watch head', case: 'Case', band: 'Bracelet' };
const PRE = new Set<JobStatus>(['intake', 'in_review', 'awaiting_customer_approval']);
const stationOf = (k: RwStationKey): RwStation => fx.RW_STATIONS.find((s) => s.key === k)!;
const laneOfPart = (key: ComponentKey): 'head' | 'band' => (key === 'band' ? 'band' : 'head');
// Dot placement precedence: (1) saved station, (2) not started → pre-approval / pre-queue by job status, (3) status + department
const derivePlacement = (j: Job, c: JobComponent): { station: RwStationKey; status: PartStatus } => {
  if (c.station) return { station: c.station, status: c.partStatus ?? 'in_progress' };
  const lane = laneOfPart(c.key);
  if (PRE.has(j.status)) return { station: 'pre_approval', status: 'not_started' };
  if (j.status === 'approved') return { station: lane === 'band' ? 'band_pre_queue' : 'pre_queue', status: 'not_started' };
  if (j.status === 'ready_to_ship' || j.status === 'closed') return { station: 'finished', status: 'fulfilled' };
  if (j.status === 'testing' || j.status === 'awaiting_manager_review') return { station: 'final_assembly', status: 'reunited' };
  if (c.completedAt) return { station: lane === 'band' ? 'safe_await_head' : 'safe_await_band', status: 'waiting' };
  return { station: lane === 'band' ? 'refinish' : 'wm_bench_1', status: 'in_progress' };
};
const ensureParts = (j: Job): JobComponent[] => {
  const comps = ensureComponents(j);
  comps.forEach((c) => {
    if (!c.history) { c.history = []; const seed = fx.partSeeds[j.id]?.[c.key]; if (seed) { c.station = seed.station; c.partStatus = seed.status; c.custodyTech = seed.tech; c.itemLabel = seed.item; c.containerKey = seed.bin; c.binOrigin = seed.binOrigin ?? seed.bin; if (seed.done && !c.completedAt) { c.completedAt = daysAgoIso(1); c.completedBy = seed.tech ?? 'Walter'; c.completedStation = stationOf(seed.station).label; } c.history.push({ at: j.createdAt, by: seed.tech ?? 'System', to: seed.station, status: seed.status, via: 'system', note: seed.bin ? 'seeded position · in JV bin' : 'seeded position' }); } }
  });
  return comps;
};
const dotOf = (j: Job, c: JobComponent): FloorDot => { const p = derivePlacement(j, c); const w = byId(store.watches, j.watchId); const pk = j.packageId ? store.packages.find((x) => x.id === j.packageId) : undefined; return { jobId: j.id, jobNumber: j.number, key: c.key, label: PART_LABEL[c.key], station: p.station, partStatus: p.status, tech: c.custodyTech ?? c.completedBy, kind: j.kind, priority: j.priority, watchLabel: `${w.brand} ${w.model}`, clientId: j.clientId, estimateNumber: j.estimateId ? store.estimates.find((e) => e.id === j.estimateId)?.number : undefined, itemLabel: pk?.itemLabel, container: c.containerKey }; };
const roomJobs = () => store.jobs.filter((j) => j.division === getSessionDivision() && j.status !== 'closed');
export async function getShopFloor(filter?: { tech?: string; kind?: JobKind }): Promise<ShopFloorT> {
  const dots = roomJobs().flatMap((j) => ensureParts(j).map((c) => dotOf(j, c))).filter((d) => (!filter?.tech || d.tech === filter.tech) && (!filter?.kind || d.kind === filter.kind));
  const counts = Object.fromEntries(fx.RW_STATIONS.map((s) => [s.key, dots.filter((d) => d.station === s.key).length])) as Record<RwStationKey, number>;
  return resolve({ stations: fx.RW_STATIONS, dots, counts, techs: [...new Set(roomJobs().flatMap((j) => ensureParts(j).map((c) => c.custodyTech ?? '')).filter(Boolean))].sort() });
}
type ShopFloorT = import('./types').ShopFloor;
const statusForStation = (s: RwStationKey, prev: PartStatus): PartStatus => (s === 'finished' ? 'fulfilled' : s === 'final_assembly' || s === 'testing' ? 'reunited' : s.includes('safe') ? 'waiting' : s === 'pre_approval' || s.endsWith('pre_queue') ? 'not_started' : prev === 'fulfilled' ? 'fulfilled' : 'in_progress');
const partOf = (jobId: string, key: ComponentKey) => { const j = getJobRow(jobId); const c = ensureParts(j).find((x) => x.key === key); if (!c) throw new Error(`${PART_LABEL[key]} is not a part of ${j.number}`); return { j, c }; };
const recordMove = (j: Job, c: JobComponent, to: RwStationKey | undefined, status: PartStatus, via: PartMove['via'], note?: string, tech?: string) => {
  const a = actor(); const from = derivePlacement(j, c).station;
  // a single-ticket scan overrides the bin: any non-container move takes the part out of the bin it was riding in
  if (c.containerKey && via !== 'container') { c.binOrigin = c.containerKey; c.containerKey = undefined; note = `${note ? `${note} · ` : ''}left JV bin (ticket scan)`; }
  c.history!.push({ at: new Date().toISOString(), by: tech ?? a.by, from, to, status, via, note });
  if (to) c.station = to; c.partStatus = status; if (tech) c.custodyTech = tech;
  jobStamp(j, `${PART_LABEL[c.key]} → ${to ? stationOf(to).label : status} (${via})${note ? ` · ${note}` : ''}`);
};
export async function movePart(jobId: string, key: ComponentKey, to: RwStationKey, via: PartMove['via'] = 'drag'): Promise<FloorDot> {
  const { j, c } = partOf(jobId, key); const lane = stationOf(to).lane;
  if (lane !== 'shared' && lane !== laneOfPart(key)) throw new Error(`${PART_LABEL[key]} belongs in the ${laneOfPart(key)} lane — ${stationOf(to).label} is a ${lane}-lane station`);
  if (to === 'finished') { const out = finishBlockers(j); if (out.length) throw new Error(`Cannot finish ${j.number}: ${out.join(', ')}`); }
  const before = { station: c.station, partStatus: c.partStatus, custodyTech: c.custodyTech, historyLen: (c.history ?? []).length, timelineLen: j.timeline.length, status: j.status };
  recordMove(j, c, to, statusForStation(to, c.partStatus ?? 'in_progress'), via);
  if (to === 'final_assembly' && ensureParts(j).every((x) => derivePlacement(j, x).station === 'final_assembly') && j.status === 'in_service' && !activeHold(j)) { ensureParts(j).forEach((x) => { if (!x.completedAt) { x.completedAt = new Date().toISOString(); x.completedBy = x.custodyTech ?? actor().by; x.completedStation = actor().station; } }); pushTransition(j, 'to_testing', 'testing', 'All parts reunited at Final assembly'); }
  // Scan-to-complete: the two await-reunification safes carry completion meaning — one scan = custody + waiting + completion credit (once, to the scanning tech)
  const dot = dotOf(j, c);
  if (AWAIT_SAFES.has(to) && !c.completedAt && j.status === 'in_service' && !activeHold(j)) {
    const a = actor(); c.completedAt = new Date().toISOString(); c.completedBy = a.by; c.completedStation = a.station;
    const out = componentsOutstanding(j); let transitioned = false;
    jobStamp(j, `Component complete · ${c.label} · by ${a.by} · via scan into ${stationOf(to).label}${out.length ? ` · still out: ${out.map((x) => x.label).join(', ')}` : ' · all components in'}`);
    if (!out.length) { pushTransition(j, 'to_testing', skipForward(j.kind, 'testing'), 'All components complete — reunified (scan)'); transitioned = true; }
    const undoToken = newId('undo'); rw18.undos.set(undoToken, { jobId: j.id, key: c.key, before, transitioned, expiresAt: Date.now() + SCAN_UNDO_MS });
    dot.completed = { by: a.by, undoToken, transitioned };
  }
  return resolve(dot);
}
const AWAIT_SAFES = new Set<RwStationKey>(['safe_await_band', 'safe_await_head']);
export const SCAN_UNDO_MS = 10_000;
// Full revert of a scan-to-complete within the undo window: credit, status, custody move and any auto-transition
export async function undoScanComplete(token: string): Promise<FloorDot> {
  const u = rw18.undos.get(token); if (!u) throw new Error('Nothing to undo'); if (Date.now() > u.expiresAt) { rw18.undos.delete(token); throw new Error('Undo window has passed — use Amend on the job instead'); }
  const { j, c } = partOf(u.jobId, u.key);
  c.completedAt = undefined; c.completedBy = undefined; c.completedStation = undefined;
  c.history!.splice(u.before.historyLen); c.station = u.before.station; c.partStatus = u.before.partStatus; c.custodyTech = u.before.custodyTech;
  if (u.transitioned) { j.timeline.splice(u.before.timelineLen); j.status = u.before.status; const ws = WATCH_STATUS_FOR[j.status]; const w = store.watches.find((x) => x.id === j.watchId); if (ws && w) w.status = ws; }
  c.history!.push({ at: new Date().toISOString(), by: actor().by, to: derivePlacement(j, c).station, status: derivePlacement(j, c).status, via: 'undo', note: 'scan-to-complete undone' });
  jobStamp(j, `Undo · ${c.label} scan-to-complete reverted by ${actor().by}${u.transitioned ? ' · testing transition reverted' : ''}`);
  rw18.undos.delete(token);
  return resolve(dotOf(j, c));
}
export async function markReunited(jobId: string, key: ComponentKey): Promise<FloorDot> { return movePart(jobId, key, 'final_assembly', 'pad'); }
const finishBlockers = (j: Job) => ensureParts(j).filter((c) => !['waiting', 'reunited', 'fulfilled'].includes(derivePlacement(j, c).status)).map((c) => `${PART_LABEL[c.key]} is still out at ${stationOf(derivePlacement(j, c).station).label}`);
export const finishGate = (j: Job): string[] => finishBlockers(j);
export async function finishJob(jobId: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); const out = finishBlockers(j); if (out.length) throw new Error(`Finish gate — ${j.number} cannot be marked Finished: ${out.join('; ')}`);
  if (j.status === 'testing') { const cr = qcRequestGaps(j); if (cr.length) throw new Error(`QC blocked — client request not checked off: “${cr[0].text}”${cr.length > 1 ? ` (+${cr.length - 1} more)` : ''}`); }
  ensureParts(j).forEach((c) => recordMove(j, c, 'finished', 'fulfilled', 'pad'));
  if (j.status === 'testing') { if (isTradeJob(j)) { pushTransition(j, 'to_manager_review', 'awaiting_manager_review', 'Finished on the shop floor — trade lane'); tradeHandoff(j); } else pushTransition(j, 'qc_pass', 'ready_to_ship', 'Finished on the shop floor'); }
  return resolve(jobRefs(j));
}
export async function getPartHistory(jobId: string, key: ComponentKey): Promise<PartHistoryView> { const { j, c } = partOf(jobId, key); return resolve({ job: jobRefs(j), part: { ...c }, moves: [...(c.history ?? [])].reverse() }); }

// -- Polish off-ramp: manager-gated custody checkpoint on BOTH ends. Lock = the part is in a manager's safe. Scan IN hands the part(s) to a polisher; scan OUT hands them back onto the track.
export const isSplitFlow = (j: Job): boolean => j.workflow.includes('B') && ensureComponents(j).some((c) => c.key === 'band');
export const GATE: Record<GateTrack, Record<GateDirection, { from: RwStationKey; to: RwStationKey }>> = { watch: { in: { from: 'mgr_safe_polish_in', to: 'polish_room' }, out: { from: 'mgr_safe_polish_out', to: 'movement_service' } }, band: { in: { from: 'band_mgr_safe_in', to: 'refinish' }, out: { from: 'band_mgr_safe_out', to: 'band_qc' } } };
const gateScans: GateScan[] = [];
// Which physical parts ride a gate scan: watch track = case, plus the bracelet bundled when the job is NOT split; band track = bracelet only (split jobs).
const gateParts = (j: Job, track: GateTrack): { parts: JobComponent[]; bundled: boolean } => {
  const comps = ensureParts(j);
  if (track === 'band') { if (!isSplitFlow(j)) throw new Error(`${j.number} has no separate band track — the bracelet rides the WATCH off-ramp bundled with the case`); return { parts: comps.filter((c) => c.key === 'band'), bundled: false }; }
  let cs = comps.find((c) => c.key === 'case');
  if (!cs) { cs = { key: 'case', label: 'Case', depts: ['P'], rework: [], history: [] }; comps.push(cs); jobStamp(j, 'Courtesy polish · case tracked as a part from the manager gate'); }
  const band = !isSplitFlow(j) ? comps.find((c) => c.key === 'band') : undefined;
  return { parts: [cs, ...(band ? [band] : [])], bundled: !!band };
};
export interface GateScanResult { scan: GateScan; job: JobWithRefs; dots: FloorDot[] }
export async function polishGateScan(label: string, direction: GateDirection, track: GateTrack, assignTo?: string): Promise<GateScanResult> {
  const j = await findJobByLabel(label.trim().replace(/^BAND-/i, '')); if (!j) throw new Error(`No job matches label ${label}`);
  return gateScanJob(getJobRow(j.id), direction, track, assignTo);
}
const gateScanJob = (row: Job, direction: GateDirection, track: GateTrack, assignTo?: string): GateScanResult => {
  const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Manager gate — only a manager can scan parts in or out of the safe');
  const { parts, bundled } = gateParts(row, track); const g = GATE[track][direction];
  const wm = ensureParts(row).find((c) => c.key === 'head')?.custodyTech ?? row.assignees[0];
  const to = direction === 'in' ? assignTo?.trim() : assignTo?.trim() || wm; if (!to) throw new Error(direction === 'in' ? 'Pick the polisher this part is handed to' : 'No watchmaker on the job — pick who receives it');
  const wrong = parts.filter((c) => derivePlacement(row, c).station !== g.from);
  if (wrong.length && wrong.length === parts.length) throw new Error(`${PART_LABEL[wrong[0].key]} is at ${stationOf(derivePlacement(row, wrong[0]).station).label}, not in ${stationOf(g.from).label} — put it in the safe first`);
  parts.forEach((c) => { recordMove(row, c, g.to, statusForStation(g.to, c.partStatus ?? 'in_progress'), 'scan', `manager gate ${direction.toUpperCase()} · ${a.by} → ${to}${bundled ? ' · bundled case + bracelet' : ''}`, to);
    if (direction === 'out' && track === 'watch' && !c.completedAt) { c.completedAt = new Date().toISOString(); c.completedBy = c.history?.[c.history.length - 2]?.by ?? to; c.completedStation = 'Polish room'; jobStamp(row, `Component complete · ${c.label} · refinished · credited ${c.completedBy} · via manager gate OUT`); } });
  const scan: GateScan = { id: newId('gate'), at: new Date().toISOString(), by: a.by, station: a.station, jobId: row.id, jobNumber: row.number, direction, track, parts: parts.map((c) => c.key), bundled, assignedTo: to, from: g.from, to: g.to };
  gateScans.unshift(scan);
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Manager gate ${direction.toUpperCase()} · ${row.number} · ${parts.map((c) => PART_LABEL[c.key]).join(' + ')}${bundled ? ' (bundled)' : ''} · ${stationOf(g.from).label} → ${stationOf(g.to).label} · handed to ${to}` });
  return { scan, job: jobRefs(row), dots: parts.map((c) => dotOf(row, c)) };
};
// Bulk assign — click a destination card on the map, scan many labels, review, Commit once. Gate destinations reuse the manager-gate rules; everything else is a plain move.
export interface BulkRow { id: string; at: string; label: string; jobId: string; jobNumber: string; watchLabel: string; key: ComponentKey; clientName: string }
export interface BulkResult { row: BulkRow; ok: boolean; detail: string }
const GATE_TARGET: Partial<Record<RwStationKey, { direction: GateDirection; track: GateTrack }>> = { polish_room: { direction: 'in', track: 'watch' }, movement_service: { direction: 'out', track: 'watch' }, refinish: { direction: 'in', track: 'band' }, band_qc: { direction: 'out', track: 'band' } };
export const bulkPartFor = (to: RwStationKey, bandLabel: boolean): ComponentKey => (bandLabel || stationOf(to).lane === 'band' ? 'band' : GATE_TARGET[to] || to.includes('polish') ? 'case' : 'head');
export async function resolveBulkLabel(label: string, to: RwStationKey): Promise<BulkRow> {
  const band = /^BAND-|\|B$/i.test(label.trim()); const j = await findJobByLabel(label.trim().replace(/^BAND-/i, '').replace(/\|B$/i, '')); if (!j) throw new Error(`No job matches label ${label}`);
  const key = bulkPartFor(to, band); const row = getJobRow(j.id); if (key !== 'case' && !ensureParts(row).some((c) => c.key === key)) throw new Error(`${j.number} has no ${PART_LABEL[key].toLowerCase()} part`);
  return resolve({ id: newId('bulk'), at: new Date().toISOString(), label: label.trim(), jobId: j.id, jobNumber: j.number, watchLabel: `${j.watch.brand} ${j.watch.model}`, key, clientName: `${j.client.firstName} ${j.client.lastName}` });
}
export const stationLockedForMe = (to: string) => { const me = currentUserSync(); return !!me && limitsOf(me).lockedStations.includes(to); };
export async function bulkCommit(rows: BulkRow[], to: RwStationKey, handTo?: string): Promise<BulkResult[]> {
  if (stationLockedForMe(to)) throw new Error(`${stationOf(to).label} is a locked station for ${currentUserSync()?.shortName} (Access control → Limits)`);
  const out: BulkResult[] = []; const seen = new Set<string>();
  for (const r of rows) { if (seen.has(r.jobId + r.key)) continue; seen.add(r.jobId + r.key);
    try { const gate = GATE_TARGET[to]; if (gate) { const g = gateScanJob(getJobRow(r.jobId), gate.direction, gate.track, handTo); out.push({ row: r, ok: true, detail: `gate ${gate.direction.toUpperCase()} · ${g.scan.parts.map((k) => PART_LABEL[k]).join(' + ')}${g.scan.bundled ? ' (bundled)' : ''} → ${stationOf(g.scan.to).label} · ${g.scan.assignedTo}` }); }
      else { const d = await movePart(r.jobId, r.key, to, 'bulk_assign'); if (handTo) { const { j, c } = partOf(r.jobId, r.key); c.custodyTech = handTo; jobStamp(j, `${PART_LABEL[c.key]} custody → ${handTo} (bulk assign)`); } out.push({ row: r, ok: true, detail: `${d.label} → ${stationOf(to).label}${handTo ? ` · ${handTo}` : ''}` }); } }
    catch (e) { out.push({ row: r, ok: false, detail: e instanceof Error ? e.message : 'Failed' }); } }
  const a = actor(); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `Bulk assign → ${stationOf(to).label}${handTo ? ` · ${handTo}` : ''} · ${out.filter((x) => x.ok).length}/${out.length} moved` });
  return resolve(out);
}
// -- Client-update summary context: everything the AI is allowed to see, already translated where the mapping is deterministic. AI fills template fields; a human edits and pastes. Never sent.
const PLAIN_LOCATION: Partial<Record<RwStationKey, string>> = { pre_approval: 'waiting for the estimate to be approved', pre_queue: 'in the queue, work not yet started', wm_bench_1: 'on the watchmaker bench', wm_bench_2: 'on the watchmaker bench', wm_bench_3: 'on the watchmaker bench', uncase: 'being prepared for service', mgr_safe_polish_in: 'secured, next up for polishing', polish_room: 'being polished and refinished', mgr_safe_polish_out: 'polished, secured, returning to the watchmaker', movement_service: 'movement being serviced', parts_approval: 'waiting on parts approval', recase_test: 'being reassembled and tested', into_safe_head: 'secured, waiting for the other components', safe_await_band: 'secured, waiting for the bracelet', band_pre_queue: 'in the bracelet queue, work not yet started', band_assign: 'with the bracelet technician', band_mgr_safe_in: 'secured, next up for polishing', refinish: 'being polished and refinished', band_mgr_safe_out: 'polished, secured, returning to the bracelet technician', band_qc: 'in bracelet quality control', into_safe_band: 'secured, waiting for the watch head', safe_await_head: 'secured, waiting for the watch head', final_assembly: 'in final assembly', testing: 'in final testing and quality control', finished: 'finished', vc_safe: 'secured overnight in the workshop safe', jv_bench: 'with the workshop supervisor, queued for the bracelet / polish team' };
export interface JobSummaryContext { jobNumber: string; clientFirstName: string; watch: string; status: JobStatus; intakeStage?: string; dueAt?: string; daysOpen: number; components: { part: string; plainLocation: string; partStatus: PartStatus; daysAtStep: number; slowFlag: boolean }[]; openItems: string[]; notes: string[]; focus?: { component: string; question: string } }
export async function jobSummaryContext(jobId: string, live?: JobWithRefs): Promise<JobSummaryContext> {
  const mock = store.jobs.find((x) => x.id === jobId);
  if (!mock) {
    // Hybrid: the job came from the real API — build the context from what the page already shows, no mock lookups
    if (!live) throw new Error('Live job context missing');
    const now = Date.now(); const daysOpen = live.createdAt ? Math.max(0, Math.round((now - new Date(live.createdAt).getTime()) / 86_400_000)) : 0;
    const hold = live.holds.find((h) => !h.releasedAt); const open: string[] = [];
    if (live.status === 'awaiting_customer_approval') open.push('awaiting client approval of the estimate'); if (live.status === 'in_review' || live.status === 'intake') open.push('estimate still being prepared'); if (hold) open.push(`${hold.type} hold — ${hold.reason || 'parked'}`);
    const plain = live.status.replace(/_/g, ' ');
    return resolve({ jobNumber: live.number, clientFirstName: live.client?.firstName ?? 'there', watch: live.watch ? `${live.watch.brand} ${live.watch.model}` : 'your watch', status: live.status, intakeStage: undefined, dueAt: live.dueAt, daysOpen, components: [{ part: 'Watch', plainLocation: plain, partStatus: 'in_progress' as PartStatus, daysAtStep: daysOpen, slowFlag: daysOpen > 21 }], openItems: open, notes: (live.notes ?? []).slice(0, 3).map((n) => (typeof n === 'string' ? n : n.text)) });
  }
  return resolve(summaryCtxSync(mock));
}
const summaryCtxSync = (j: Job): JobSummaryContext => {
  const c = byId(fx.clients, j.clientId); const w = byId(store.watches, j.watchId); const now = Date.now(); const days = (iso?: string) => (iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 86_400_000)) : 0);
  const components = ensureParts(j).map((p) => { const pl = derivePlacement(j, p); const last = p.history?.[p.history.length - 1]; const d = days(last?.at ?? j.createdAt); return { part: PART_LABEL[p.key], plainLocation: p.completedAt ? 'finished' : PLAIN_LOCATION[pl.station] ?? 'in progress', partStatus: pl.status, daysAtStep: d, slowFlag: d > 5 && pl.status !== 'fulfilled' }; });
  const open: string[] = []; if (j.status === 'awaiting_customer_approval') open.push('awaiting client approval of the estimate'); if (j.status === 'in_review' || j.status === 'intake') open.push('estimate still being prepared'); if (j.holds.some((h) => !h.releasedAt)) open.push(`on hold: ${j.holds.filter((h) => !h.releasedAt).map((h) => `${h.type.replace(/_/g, ' ')}${h.component ? ` (${PART_LABEL[h.component].toLowerCase()} only)` : ''}`).join(', ')}`);
  const pr = (store.partsRequests ?? []).filter((r) => r.jobId === j.id); if (pr.some((r) => r.status === 'on_order')) open.push('a part is on order'); else if (pr.some((r) => r.status === 'approved' || r.status === 'pending' || r.status === 'pending_review')) open.push('a part request is being reviewed'); if (j.status === 'ready_to_ship') open.push('finished, ready for pickup / return shipping');
  return { jobNumber: j.number, clientFirstName: c.firstName, watch: `${w.brand} ${w.model}`, status: j.status, intakeStage: j.packageId ? store.packages.find((p) => p.id === j.packageId)?.status : undefined, dueAt: j.dueAt, daysOpen: days(j.createdAt), components, openItems: open, notes: j.notes.slice(-3).map((n) => n.text) };
};
// -- Custody by person: who physically holds each watch head / case / bracelet right now (same data as the floor board, grouped by holder)
const HOLDER_NAME: Record<string, string> = { MH: 'Mike (MH)', MM: 'MM' };
export interface CustodyItem extends FloorDot { clientLastName: string; workflow: DeptCode[]; status: JobStatus; stationLabel: string; heldSince?: string; notes: string[]; containerInfo?: { key: string; label: string; holderLabel: string } }
export interface CustodyByPerson { tech: string; name: string; items: CustodyItem[] }
export async function getCustodyByPerson(): Promise<CustodyByPerson[]> {
  seedSwo(); const groups = new Map<string, CustodyItem[]>();
  roomJobs().forEach((j) => { const c = byId(fx.clients, j.clientId); ensureParts(j).forEach((p) => { const holder = p.custodyTech; if (!holder) return; const d = dotOf(j, p); const last = p.history?.[p.history.length - 1]; (groups.get(holder) ?? groups.set(holder, []).get(holder)!).push({ ...d, clientLastName: c.lastName, workflow: j.workflow, status: j.status, stationLabel: stationOf(d.station).label, heldSince: last?.at, notes: j.notes.slice(-2).map((n) => n.text), containerInfo: p.containerKey === BIN_KEY ? { key: BIN_KEY, label: 'JV bin', holderLabel: BIN_HOLDER_LABEL[binState.holder] } : undefined }); }); });
  return resolve([...groups.entries()].map(([tech, items]) => ({ tech, name: tech.startsWith('vendor:') ? `At vendor: ${rs.vendors.find((v) => v.id === tech.slice(7))?.name ?? tech.slice(7)}` : HOLDER_NAME[tech] ?? fx.users.find((u) => u.shortName === tech)?.displayName.split(' — ')[0] ?? tech, items: items.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber)) })).sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name)));
}
// ---- MH HITLIST — owner accountability: client asset $ on premises + every bypass use (visibility feed, not a gate) ----
export type BypassKind = 'receiving_camera' | 'payment_release' | 'pickup_camera' | 'other';
export interface BypassEvent { id: string; kind: BypassKind; by: string; station: string; at: string; jobNumber?: string; orderId?: string; reason: string; context: { invoiceAmount?: number; minutesSincePayment?: number; detail?: string } }
const hAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const bypasses: BypassEvent[] = [
  { id: 'byp-01', kind: 'payment_release', by: 'Vienna', station: 'Ship Station', at: hAgo(1.5), jobNumber: 'SO-26-0104', orderId: 'so-04', reason: 'Client paid by card on the phone 2 min ago — Intuit not synced yet', context: { invoiceAmount: 1_840, minutesSincePayment: 2, detail: 'released by shipping · UPS' } },
  { id: 'byp-02', kind: 'receiving_camera', by: 'Chyna', station: 'Front Desk 1', at: hAgo(5), jobNumber: 'SUB-26-0313', reason: 'Camera not working — photo/scan verification skipped at Receive Package', context: { detail: 'UPS 1Z44AB0398765432 · Watch head, Bracelet' } },
  { id: 'byp-03', kind: 'payment_release', by: 'MM', station: 'Pickup Station', at: hAgo(27), jobNumber: 'SO-26-0099', orderId: 'so-02', reason: 'Zelle received, screenshot verified — RS still showing balance', context: { invoiceAmount: 4_250, minutesSincePayment: 38, detail: 'released at pickup station' } },
  { id: 'byp-04', kind: 'receiving_camera', by: 'MH', station: 'Front Desk 1', at: hAgo(50), jobNumber: 'SUB-26-0309', reason: 'Camera not working — photo/scan verification skipped at Receive Package', context: { detail: 'FedEx 748900112233 · Watch head' } },
];
const minutesSincePayment = (o: SalesOrder): number | undefined => { const last = [...(o.payments ?? [])].sort((a, b) => b.at.localeCompare(a.at))[0]; return last ? Math.max(0, Math.round((Date.now() - new Date(last.at).getTime()) / 60_000)) : undefined; };
const logBypass = (e: Omit<BypassEvent, 'id' | 'by' | 'station' | 'at'>) => { const a = actor(); const row: BypassEvent = { id: newId('byp'), by: a.by, station: a.station, at: new Date().toISOString(), ...e }; bypasses.unshift(row); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `BYPASS · ${row.kind.replace(/_/g, ' ')} · ${row.jobNumber ?? ''} · ${row.reason}` }); return row; };
export interface AssetValueRow { jobId: string; jobNumber: string; client: string; watch: string; holders: string[]; value: number; source: 'insurance' | 'dropoff' | 'none' }
export interface Hitlist { assetTotal: number; assets: AssetValueRow[]; bypasses: BypassEvent[]; zeroBalances: ZeroBalanceRow[] }
// Owner-only: the bypass feed tracks staff who may themselves hold manager access, so it is MH's account specifically — not the manager tier
// Seed (once): insured declared values for a spread of in-custody jobs via arrived inbound shipments; two jobs came in as drop-offs (no insurance → $0)
let assetSeeded = false; const DROPOFF_SEED = new Set(['E02012', 'E02024', 'E02020']);
const seedAssetValues = () => { if (assetSeeded) return; assetSeeded = true; const vals: Record<string, number> = { E02013: 14_500, E02015: 9_800, E02026: 38_000, E02027: 12_200, E02032: 4_600, E02033: 27_500, E02011: 11_900, E02014: 16_750, E02031: 8_900, E02016: 21_000, E02023: 6_400, E02007: 13_300 };
  Object.entries(vals).forEach(([num, v]) => { const j = store.jobs.find((x) => x.number === num); if (!j?.estimateId || shp.rows.some((r) => r.estimateId === j.estimateId)) return; const c = byId(fx.clients, j.clientId); shp.rows.push({ id: newId('sh'), direction: 'inbound', estimateId: j.estimateId, clientId: j.clientId, stage: 'arrived', carrier: 'UPS', service: 'UPS Next Day Air', serviceLevel: '1_day', declaredValue: v, destinationState: c.state, requestedAt: hAgo(9 * 24), labelSentAt: hAgo(8 * 24), trackingNumber: `1Z${num}SEED`, arrivedAt: hAgo(6 * 24), events: [], stamps: [], emailIds: [] }); });
  ['E02012', 'E02024'].forEach((num) => { const j = store.jobs.find((x) => x.number === num); const pk = j?.packageId ? store.packages.find((p) => p.id === j.packageId) : undefined; if (pk) { pk.source = 'walk_in'; pk.trackingNumber = undefined; } }); };
export async function getHitlist(): Promise<Hitlist> {
  if (!isOwnerSync()) throw new Error('MH Hitlist is owner-only');
  seedAssetValues(); seedSwo(); const people = (await getCustodyByPerson()).filter((g) => !g.tech.startsWith('vendor:')); const byJob = new Map<string, AssetValueRow>(); // off-premises with an outsource vendor → not on hand (same rule as shipped to client)
  people.forEach((g) => g.items.forEach((it) => { let row = byJob.get(it.jobId); if (!row) { const j = getJobRow(it.jobId); const pk = j.packageId ? store.packages.find((p) => p.id === j.packageId) : undefined; const sh = shp.rows.find((r) => r.estimateId === j.estimateId && r.direction === 'inbound' && (r.trackingNumber || r.stage === 'arrived')); const value = sh?.declaredValue ?? 0; row = { jobId: j.id, jobNumber: j.number, client: `${it.clientLastName}`, watch: it.watchLabel, holders: [], value, source: sh ? 'insurance' : pk?.source === 'walk_in' || DROPOFF_SEED.has(j.number) ? 'dropoff' : 'none' }; byJob.set(it.jobId, row); } if (!row.holders.includes(g.name)) row.holders.push(g.name); }));
  const assets = [...byJob.values()].sort((a, b) => b.value - a.value);
  return resolve({ assetTotal: assets.reduce((t, r) => t + r.value, 0), assets, bypasses: [...bypasses].sort((a, b) => b.at.localeCompare(a.at)), zeroBalances: zeroBalanceLog() });
}
export async function getGateScans(jobId?: string): Promise<GateScan[]> { return resolve(gateScans.filter((g) => !jobId || g.jobId === jobId)); }
export const POLISHERS = ['Walter', 'JV', 'Leo'];

// -- Bulk assign (scan-driven): TECH-<short> then watch labels
export const parseTechCode = (code: string): User | undefined => { const m = /^TECH-(.+)$/i.exec(code.trim()); return m ? fx.users.find((u) => u.shortName.toLowerCase() === m[1].toLowerCase()) : undefined; };
export const getScanSession = (): ScanSession => rw18.scanSession;
export async function scanTech(code: string): Promise<ScanSession> { const u = parseTechCode(code); if (!u) throw new Error(`Not a tech code: ${code}`); rw18.scanSession = { tech: u, rows: [] }; appendAudit({ type: 'job', stationName: actor().station, userShortName: actor().user?.shortName, detail: `Bulk assign · active tech ${u.shortName}` }); return resolve(rw18.scanSession); }
export async function scanLabelAssign(label: string): Promise<ScanSession> {
  const s = rw18.scanSession; if (!s.tech) throw new Error('Scan a TECH code first');
  const bandOnly = /\|B$|^BAND-/i.test(label.trim()); const clean = label.trim().replace(/^BAND-/i, '');
  const j = await findJobByLabel(clean); if (!j) throw new Error(`No job matches label ${label}`);
  const row = getJobRow(j.id); { const h = holdBlocks(row, bandOnly ? 'band' : 'head'); if (h) throw new Error(`${row.number}${h.component ? ` ${PART_LABEL[h.component]}` : ''} is on hold — release it first`); }
  if (bandOnly && !row.workflow.includes('B')) { row.workflow.push('B'); row.components = undefined; ensureParts(row); jobStamp(row, 'Band-only label — bracelet component created, band department tagged'); }
  const comps = ensureParts(row); const isWm = s.tech.roles.includes('watchmaker'); const target = bandOnly ? comps.find((c) => c.key === 'band')! : comps.find((c) => isWm ? c.key === 'head' : c.key !== 'head') ?? comps[0];
  if (!row.assignees.includes(s.tech.shortName)) row.assignees.push(s.tech.shortName);
  if (row.status === 'approved') pushTransition(row, 'start_service', 'in_service', `Bulk assign · ${s.tech.shortName}`);
  const to: RwStationKey = target.key === 'band' ? 'refinish' : isWm ? (['wm_bench_1', 'wm_bench_2', 'wm_bench_3'] as RwStationKey[])[fx.users.filter((u) => u.roles.includes('watchmaker')).findIndex((u) => u.id === s.tech!.id) % 3] : 'refinish';
  recordMove(row, target, to, 'in_progress', 'bulk_assign', `custody → ${s.tech.shortName}`, s.tech.shortName);
  const email = queueJobEmail(row, 'Work has started', `${s.tech.displayName.split(' — ')[0]} has started work on your watch today. We'll be in touch as it progresses — track it any time in RolliConnect.`);
  const w = byId(store.watches, row.watchId);
  s.rows.unshift({ at: new Date().toISOString(), jobNumber: row.number, jobId: row.id, watchLabel: `${w.brand} ${w.model} · ${w.reference}`, part: PART_LABEL[target.key], outboxId: email?.id });
  return resolve(s);
}
export async function undoOutbox(id: string): Promise<void> { const i = store.outbox.findIndex((e) => e.id === id); if (i >= 0) { store.outbox.splice(i, 1); appendAudit({ type: 'job', stationName: actor().station, userShortName: actor().user?.shortName, detail: `Sent item ${id} withdrawn (undo)` }); } rw18.scanSession.rows.forEach((r) => { if (r.outboxId === id) r.outboxId = undefined; }); return resolve(undefined); }
export async function getQueuedOutbox(): Promise<OutboxEmail[]> { return resolve(store.outbox.filter((e) => e.status === 'pending').slice(0, 12)); }

// -- Work queue
export async function getWorkQueue(): Promise<WorkQueueRow[]> {
  return resolve(roomJobs().filter((j) => j.status !== 'ready_to_ship').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((j) => ({ job: jobRefs(j), overdue: !!j.dueAt && j.dueAt < new Date().toISOString(), clientReplied: rw18.replied.has(j.id), parts: ensureParts(j).map((c) => ({ key: c.key, done: ['waiting', 'reunited', 'fulfilled'].includes(derivePlacement(j, c).status) || !!c.completedAt, station: derivePlacement(j, c).station })) })));
}
export async function simulateClientReply(jobId?: string): Promise<string> {
  const j = jobId ? getJobRow(jobId) : roomJobs().find((x) => x.status === 'awaiting_customer_approval') ?? roomJobs()[0];
  rw18.replied.add(j.id); const c = ensureConversation(j.clientId, `Job ${j.number}`, { kind: 'job', id: j.id }, j.division);
  pushConv(c, { direction: 'in', source: 'portal', by: `${byId(fx.clients, j.clientId).firstName}`, text: 'Approved — please go ahead. (simulated client reply)', at: new Date().toISOString() });
  return resolve(j.id);
}
export const clearClientReplied = (jobId: string) => { rw18.replied.delete(jobId); };

// -- Watchmaker room
export async function getWmRoom(userId: string): Promise<{ user: User; cards: { job: JobWithRefs; parts: FloorDot[] }[] }> { const u = byId(fx.users, userId); return resolve({ user: u, cards: roomJobs().filter((j) => j.assignees.includes(u.shortName) && j.status !== 'ready_to_ship').map((j) => ({ job: jobRefs(j), parts: ensureParts(j).map((c) => dotOf(j, c)) })) }); }
export async function sendPartByScan(label: string, to: 'safe' | 'refinish', key?: ComponentKey): Promise<FloorDot> {
  const j = await findJobByLabel(label); if (!j) throw new Error(`No job matches label ${label}`); const comps = ensureParts(getJobRow(j.id)); const c = (key && comps.find((x) => x.key === key)) ?? comps.find((x) => x.key === 'head') ?? comps[0];
  const dest: RwStationKey = to === 'refinish' ? 'refinish' : laneOfPart(c.key) === 'band' ? 'into_safe_band' : 'into_safe_head';
  if (to === 'refinish' && c.key === 'head') { const alt = comps.find((x) => x.key !== 'head'); if (!alt) throw new Error('Refinishing takes case or bracelet — this job has only a watch head'); return movePart(j.id, alt.key, 'refinish', 'scan'); }
  return movePart(j.id, c.key, dest, 'scan');
}
export async function requestPartSimple(jobId: string, description: string, qty: number, source: PartsRequest['source'] = 'wm'): Promise<PartsRequestWithRefs> {
  if (!description.trim()) throw new Error('Describe the part'); if (qty < 1) throw new Error('Quantity must be at least 1');
  const j = getJobRow(jobId); const a = actor(); const match = store.parts.find((p) => p.name.toLowerCase() === description.trim().toLowerCase() || p.partNumber.toLowerCase() === description.trim().toLowerCase());
  const r: PartsRequest = { id: newId('pr'), number: nextPrNumber(), jobId: j.id, status: 'pending', partId: match?.id, qty, note: match ? undefined : description.trim(), items: [{ partId: match?.id, description: description.trim(), qty }], searchTerms: [description.trim()], chat: [], requestedBy: a.by, requestedAt: new Date().toISOString(), station: a.station, source };
  store.partsRequests.unshift(r); partsStamp(r, `requested from ${source} · ${description.trim()} ×${qty}`); jobStamp(j, `Parts request ${r.number} · ${description.trim()} ×${qty}`);
  return resolve(prRefs(r));
}
const nextPrNumber = () => `PR-${String(Math.max(...store.partsRequests.map((r) => Number(r.number.split('-')[1]) || 0)) + 1).padStart(4, '0')}`;

// -- Station scanner (parts move like registered mail)
export const getStationMemory = () => rw18.stationMemory;
export async function stationScan(station: RwStationKey, label: string): Promise<FloorDot> {
  rw18.stationMemory = station; const j = await findJobByLabel(label.replace(/^BAND-/i, '')); if (!j) throw new Error(`No job matches label ${label}`);
  const comps = ensureParts(getJobRow(j.id)); const lane = stationOf(station).lane; const c = comps.find((x) => lane === 'shared' ? true : laneOfPart(x.key) === lane && (lane === 'band' || x.key === 'head')) ?? comps.find((x) => lane === 'head' && x.key === 'case') ?? comps[0];
  return movePart(j.id, c.key, station, 'station');
}

// -- Supervisor pad
const STAGE_ORDER: JobStatus[] = ['approved', 'in_service', 'testing', 'awaiting_manager_review', 'ready_to_ship'];
const STAGE_LABEL: Record<string, string> = { approved: 'Queued', in_service: 'On the bench', testing: 'Final assembly / QC', awaiting_manager_review: 'Manager review', ready_to_ship: 'Finished' };
export type PadRoom = 'wm' | 'band';
export const ROOM_TECHS: Record<PadRoom, string[]> = { wm: ['Leo', 'MH', 'Walter'], band: ['JV', 'Leo', 'Dre', 'Sam', 'Nico', 'MAM'] };
export const ROOM_LABEL: Record<PadRoom, string> = { wm: 'Watchmaker Room', band: 'Band / Polish Room' };
const inRoom = (j: Job, room: PadRoom) => room === 'wm' || j.workflow.some((d) => d === 'B' || d === 'P' || d === 'PM');
export async function getPadBoard(room: PadRoom = 'wm'): Promise<PadCard[]> {
  return resolve(roomJobs().filter((j) => STAGE_ORDER.includes(j.status) && inRoom(j, room)).sort((a, b) => STAGE_ORDER.indexOf(a.status) - STAGE_ORDER.indexOf(b.status) || a.createdAt.localeCompare(b.createdAt)).map((j) => ({ job: jobRefs(j), stage: j.status, stageLabel: STAGE_LABEL[j.status], canAdvance: j.status !== 'ready_to_ship' && !activeHold(j), canSendBack: j.status !== 'approved' && !activeHold(j), parts: ensureParts(j).map((c) => dotOf(j, c)), photos: fx.jobPhotos.filter((p) => p.jobId === j.id).length + j.photos.length, pendingParts: store.partsRequests.filter((r) => r.jobId === j.id && (r.status === 'pending' || r.status === 'on_order')).length })));
}
export async function padAdvance(jobId: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); if (activeHold(j)) throw new Error('On hold — release first');
  if (j.status === 'approved') { pushTransition(j, 'start_service', 'in_service', 'Pad · advance'); ensureParts(j).forEach((c) => { if (!c.station) recordMove(j, c, laneOfPart(c.key) === 'band' ? 'refinish' : 'wm_bench_1', 'in_progress', 'pad'); }); }
  else if (j.status === 'in_service') { const out = finishBlockers(j); if (out.length) throw new Error(`Cannot advance ${j.number} to Final assembly: ${out.join('; ')}`); ensureParts(j).forEach((c) => recordMove(j, c, 'final_assembly', 'reunited', 'pad')); ensureParts(j).forEach((c) => { if (!c.completedAt) { c.completedAt = new Date().toISOString(); c.completedBy = c.custodyTech ?? actor().by; c.completedStation = actor().station; } }); pushTransition(j, 'to_testing', 'testing', 'Pad · advance (reunified)'); }
  else if (j.status === 'testing') { if (isTradeJob(j)) return transitionJob(jobId, 'to_manager_review'); return finishJob(jobId); }
  else if (j.status === 'awaiting_manager_review') throw new Error('Awaiting division manager review — accept or send back from the Trade review queue');
  else throw new Error('Already finished');
  return resolve(jobRefs(j));
}
const SEND_BACK_LABEL: Record<SendBackReason, string> = { rework: 'Rework', waiting_on_part: 'Waiting on part', failed_qc: 'Failed QC', other: 'Other' };
export async function padSendBack(jobId: string, reason: SendBackReason, note?: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); if (activeHold(j)) throw new Error('On hold — release first'); if (reason === 'other' && !note?.trim()) throw new Error('Add a note for "Other"');
  const why = `${SEND_BACK_LABEL[reason]}${note?.trim() ? ` — ${note.trim()}` : ''}`;
  if (j.status === 'ready_to_ship') { pushTransition(j, 'pad_send_back', 'testing', `Pad · send back · ${why}`); ensureParts(j).forEach((c) => recordMove(j, c, 'final_assembly', 'reunited', 'pad', why)); }
  else if (j.status === 'testing') { pushTransition(j, reason === 'failed_qc' ? 'qc_fail' : 'pad_send_back', 'in_service', `Pad · send back · ${why}`); if (reason === 'failed_qc') ensureParts(j).filter((c) => c.completedAt).forEach((c) => c.rework.push({ at: new Date().toISOString(), reason: why, by: actor().by })); ensureParts(j).forEach((c) => recordMove(j, c, laneOfPart(c.key) === 'band' ? 'refinish' : 'wm_bench_1', 'in_progress', 'pad', why)); }
  else if (j.status === 'in_service') { pushTransition(j, 'pad_send_back', 'approved', `Pad · send back · ${why}`); ensureParts(j).forEach((c) => recordMove(j, c, laneOfPart(c.key) === 'band' ? 'band_pre_queue' : 'pre_queue', 'not_started', 'pad', why)); }
  else throw new Error('Already at the first stage');
  appendAudit({ type: 'job', stationName: actor().station, userShortName: actor().user?.shortName, userDisplayName: actor().user?.displayName, detail: `${j.number} · sent back by pad · ${why}` });
  return resolve(jobRefs(j));
}
export const SEND_BACK_REASONS = SEND_BACK_LABEL;
// Live suggestions: names + aliases, scoped to the job's watch reference, most-recently-chosen for that reference first
export const partSuggestions = (jobId: string, q: string): PartSuggestion[] => {
  const j = getJobRow(jobId); const ref = byId(store.watches, j.watchId).reference; const needle = q.trim().toLowerCase(); if (!needle) return [];
  const refKey = (r: string) => r.replace(/[^0-9A-Z]/gi, '').slice(0, 6);
  const recent = rw18.recent.filter((r) => refKey(r.reference) === refKey(ref)).sort((a, b) => b.at.localeCompare(a.at));
  const pool = new Set(searchPartsSync(needle, 200).map((p) => p.id)); // ONE search — ranking (recent / ref) layered on top
  return store.parts.filter((p) => pool.has(p.id)).map((p): PartSuggestion | null => {
    const inRef = p.compatibleRefs.some((r) => refKey(r) === refKey(ref)); const nameHit = p.name.toLowerCase().includes(needle) || p.partNumber.toLowerCase().includes(needle); const aliasHit = p.aliases.some((a) => a.toLowerCase().includes(needle) || needle.includes(a.toLowerCase()));
    if (!nameHit && !aliasHit) return null; const ri = recent.findIndex((r) => r.partId === p.id);
    return { part: p, score: (ri >= 0 ? 1000 - ri : 0) + (inRef ? 100 : 0) + (nameHit ? 10 : 0) + (aliasHit ? 8 : 0), reason: ri >= 0 ? 'recent' : inRef ? 'ref' : nameHit ? 'name' : 'alias' };
  }).filter((x): x is PartSuggestion => !!x).sort((a, b) => b.score - a.score).slice(0, 8);
};
export const recordPartPick = (jobId: string, partId: string) => { const j = getJobRow(jobId); const ref = byId(store.watches, j.watchId).reference; rw18.recent = [{ reference: ref, partId, at: new Date().toISOString() }, ...rw18.recent.filter((r) => !(r.reference === ref && r.partId === partId))]; };
export async function submitPadPartsRequest(jobId: string, items: { partId?: string; description: string; qty: number }[]): Promise<PartsRequestWithRefs> {
  if (!items.length) throw new Error('Add at least one part'); const j = getJobRow(jobId); const a = actor(); const first = items[0];
  const r: PartsRequest = { id: newId('pr'), number: nextPrNumber(), jobId: j.id, status: 'pending', partId: first.partId, qty: first.qty, items, searchTerms: items.map((i) => i.description), chat: [], requestedBy: a.by, requestedAt: new Date().toISOString(), station: a.station, source: 'pad' };
  store.partsRequests.unshift(r); partsStamp(r, `pad request · ${items.map((i) => `${i.description} ×${i.qty}`).join(', ')}`); jobStamp(j, `Parts request ${r.number} (pad) · ${items.length} item(s)`);
  return resolve(prRefs(r));
}
export async function getApprovalsQueue(): Promise<(PartsRequestWithRefs & { onHand: number })[]> { return resolve(store.partsRequests.filter((r) => r.status === 'pending' || r.status === 'on_order').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)).map((r) => ({ ...prRefs(r), onHand: r.partId ? store.parts.find((p) => p.id === r.partId)?.stock ?? 0 : 0 }))); }
export async function approvalAction(requestId: string, action: 'approve' | 'decline' | 'on_order' | 'received', note?: string): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId); const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Supervisor / manager only'); const part = r.partId ? store.parts.find((p) => p.id === r.partId) : undefined;
  if (action === 'approve') { if (!part) throw new Error('Free-typed part — order it or attach a catalog part'); if (part.stock <= 0) throw new Error(`${part.name} is OUT OF STOCK — use Order part`); r.status = 'approved'; rw18.picks.unshift({ id: newId('pk'), prId: r.id, partId: part.id, jobId: r.jobId, qty: r.qty, status: 'open', location: part.location ?? 'Unassigned', createdAt: new Date().toISOString() }); partsStamp(r, `approved (pad) · allocated · to picking${note ? ` · ${note}` : ''}`); }
  else if (action === 'decline') { r.status = 'rejected'; r.note = note?.trim() || 'Declined on the pad'; partsStamp(r, `declined (pad)${note ? ` · ${note}` : ''}`); }
  else if (action === 'on_order') { r.status = 'on_order'; partsStamp(r, `ordered (pad)${part && part.stock <= 0 ? ' · out of stock' : ''}`); const j = getJobRow(r.jobId); if (!activeHold(j) && canHold(j)) { j.holds.push({ id: newId('h'), type: 'parts', reason: `Part on order · ${r.number}`, priorStatus: j.status, placedAt: new Date().toISOString(), placedBy: a.by, station: a.station }); jobStamp(j, `Parts hold · ${r.number} on order`); } }
  else { if (part) part.stock += r.qty; r.status = 'received'; partsStamp(r, `received (pad) · +${r.qty} on hand`); const j = getJobRow(r.jobId); const h = activeHold(j); if (h && h.reason.includes(r.number)) { h.releasedAt = new Date().toISOString(); h.releasedBy = a.by; jobStamp(j, `Parts hold released · ${r.number} received`); } rw18.picks.unshift({ id: newId('pk'), prId: r.id, partId: part?.id ?? '', jobId: r.jobId, qty: r.qty, status: 'open', location: part?.location ?? 'Receiving shelf', createdAt: new Date().toISOString() }); }
  r.decidedBy = a.by; r.decidedAt = new Date().toISOString();
  return resolve(prRefs(r));
}
// -- Picking queue
const pickView = (t: PickTask): PickTaskView => { const part = store.parts.find((p) => p.id === t.partId) ?? { id: '', partNumber: '—', name: 'Free-typed part', category: '', compatibleRefs: [], calibers: [], aliases: [], price: 0, stock: 0, location: t.location }; return { ...t, part, job: jobRefs(getJobRow(t.jobId)), onHand: part.stock }; };
export async function getPickingQueue(): Promise<{ tasks: PickTaskView[]; remaining: number; shortsToday: number }> { const tk = new Date().toISOString().slice(0, 10); return resolve({ tasks: rw18.picks.filter((t) => t.status === 'open' || (t.doneAt ?? '').startsWith(tk)).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt)).map(pickView), remaining: rw18.picks.filter((t) => t.status === 'open').length, shortsToday: rw18.picks.filter((t) => t.status === 'short' && (t.doneAt ?? '').startsWith(tk)).length }); }
export async function pickAction(taskId: string, action: 'picked' | 'short' | 'found', location?: string): Promise<PickTaskView> {
  const t = byId(rw18.picks, taskId); const part = store.parts.find((p) => p.id === t.partId); const r = store.partsRequests.find((x) => x.id === t.prId); const a = actor();
  if (action === 'picked') { if (!part) throw new Error('No catalog part on this pick'); if (part.stock < t.qty) throw new Error(`Only ${part.stock} on hand at ${t.location} — need ${t.qty}. Flag it short or found elsewhere.`); part.stock -= t.qty; t.status = 'picked'; t.doneAt = new Date().toISOString(); const j = getJobRow(t.jobId); jobStamp(j, `Part picked · ${part.name} ×${t.qty} · allocated`); if (r) partsStamp(r, `picked ×${t.qty} · on hand now ${part.stock}`); }
  else if (action === 'short') { t.status = 'short'; t.doneAt = new Date().toISOString(); if (r) { r.status = 'on_order'; partsStamp(r, 'short at pick → on order'); } appendAudit({ type: 'inventory', stationName: a.station, userShortName: a.user?.shortName, detail: `Pick ${t.id} short · ${part?.name ?? 'part'} · ordered` }); }
  else { if (!location?.trim()) throw new Error('Type the actual location'); if (part) part.location = location.trim(); t.location = location.trim(); t.status = 'open'; t.note = 'found elsewhere'; appendAudit({ type: 'inventory', stationName: a.station, userShortName: a.user?.shortName, detail: `${part?.name ?? 'part'} relocated → ${location.trim()}` }); }
  return resolve(pickView(t));
}
export async function getJobPhotoViews(jobId: string): Promise<JobPhotoView[]> { const j = getJobRow(jobId); return resolve([...fx.jobPhotos.filter((p) => p.jobId === jobId).map(({ jobId: _j, ...p }) => ({ ...p, unlocked: isPhotoUnlocked(p.id) })), ...j.photos.map((p, i) => ({ id: p.id, url: p.dataUrl, slot: p.slot ?? p.fileName ?? `Job photo ${i + 1}`, kind: 'inspection' as const, photoType: p.photoType, at: p.at, by: p.by, unlocked: isPhotoUnlocked(p.id) }))]); }
// Pad camera — photo binds to the open job (job ↔ watch identity), stamped who / when / slot. Client sees only client-visible slots.
export const PHOTO_SLOTS: { key: string; label: string; clientVisible: boolean }[] = [{ key: 'workbench', label: 'Workbench', clientVisible: false }, { key: 'movement', label: 'Movement', clientVisible: true }, { key: 'dial', label: 'Dial', clientVisible: true }, { key: 'caseback', label: 'Caseback', clientVisible: true }, { key: 'bracelet', label: 'Bracelet', clientVisible: true }, { key: 'parts', label: 'Parts', clientVisible: false }, { key: 'other', label: 'Other', clientVisible: false }];
export async function capturePadPhoto(jobId: string, dataUrl: string, slotKey: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); const slot = PHOTO_SLOTS.find((s) => s.key === slotKey); if (!slot) throw new Error('Pick a slot'); const a = actor();
  addJobPhotoSync(j, { dataUrl, fileName: `${slot.label}.jpg`, slot: slot.label, photoType: 'bench', stamp: `Photo captured on the pad · ${slot.label} · locked (private) · ${a.by}` }); return resolve(jobRefs(j));
}
// Pad parts history — every request on room jobs, newest first, with a derived stage label
export async function getRoomPartsHistory(): Promise<(PartsRequestWithRefs & { stageLabel: string })[]> {
  const ids = new Set(store.jobs.filter((j) => j.division === getSessionDivision()).map((j) => j.id));
  return resolve(store.partsRequests.filter((r) => ids.has(r.jobId)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map((r) => { const picks = rw18.picks.filter((p) => p.prId === r.id); const picked = picks.length > 0 && picks.every((p) => p.status === 'picked'); return { ...prRefs(r), stageLabel: picked || (r.status === 'received' && r.allocatedAt) ? 'picked' : r.status === 'pending' ? 'pending review' : r.status === 'rejected' ? 'declined' : r.status.replace('_', ' ') }; }));
}
export async function getRoomSummary(): Promise<RoomSummary> { const room = roomJobs(); return resolve({ jobsInRoom: room.filter((j) => STAGE_ORDER.includes(j.status)).length, waitingOnParts: room.filter((j) => activeHold(j)?.type === 'parts' || store.partsRequests.some((r) => r.jobId === j.id && (r.status === 'pending' || r.status === 'on_order'))).length, waitingOnApproval: room.filter((j) => j.status === 'awaiting_customer_approval').length, picksRemaining: rw18.picks.filter((t) => t.status === 'open').length, shortsToday: rw18.picks.filter((t) => t.status === 'short').length }); }
export const PART_LABELS = PART_LABEL;

// ---- Supervisor Pad v2 — Jobs (tech override + condition) · Parts (caliber query, reference search, M3KE) · Review (manager gate) ----
import type { M3keEvent, PadConditionView, PadPartsContext, PadSuggestion, PartsRequestItem } from './types';
const m3ke = { events: fx.m3keEvents.map((e): M3keEvent => ({ ...e })) };
const STOP_M3 = new Set(['for', 'the', 'a', 'an', 'of', 'and', 'to', 'on', 'with', 'new', 'part', 'please']);
const toks = (s: string) => s.toLowerCase().replace(/[^a-z0-9/]+/g, ' ').split(/\s+/).filter((t) => t && !STOP_M3.has(t));
const refKey6 = (r: string) => r.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
const similarDesc = (a: string, b: string) => { const ta = toks(a), tb = toks(b); if (!ta.length || !tb.length) return false; const shared = ta.filter((t) => tb.includes(t) && t.length >= 3 && !/^\d{5,}$/.test(t)); return shared.length >= Math.min(2, ta.length, tb.length) || a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase()); };
const learnedEvents = (ref: string, caliber?: string) => m3ke.events.filter((e) => refKey6(e.reference) === refKey6(ref) || (!!caliber && e.caliber === caliber));
export const caliberOf = (ref: string) => fx.caliberForReference(ref);
export async function getPadPartsContext(label: string): Promise<PadPartsContext> {
  const j = await findJobByLabel(label.replace(/^BAND-/i, '')); if (!j) throw new Error(`No job matches label ${label}`);
  const ref = j.watch.reference; const caliber = fx.caliberForReference(ref); const learned = learnedEvents(ref, caliber);
  const weight = (p: Part) => learned.filter((e) => e.partId === p.id).length;
  const caliberParts: PadSuggestion[] = caliber ? store.parts.filter((p) => p.calibers.includes(caliber)).map((p): PadSuggestion => ({ part: p, learned: weight(p) > 0, source: 'caliber', hint: weight(p) > 0 ? `learned · chosen ${weight(p)}× for ${caliber}` : `cal. ${caliber}` })).sort((a, b) => weight(b.part) - weight(a.part) || a.part.name.localeCompare(b.part.name)) : [];
  return resolve({ job: j, reference: ref, caliber, caliberParts });
}
// Description search scoped to the reference (model-specific), learned mappings for this reference on top, caliber parts as a tail
export const padSearchParts = (ref: string, caliber: string | undefined, q: string): PadSuggestion[] => {
  const needle = q.trim().toLowerCase(); if (!needle) return []; const qt = toks(needle);
  const pool = new Set(searchPartsSync(needle, 200).map((p) => p.id)); const hit = (p: Part) => pool.has(p.id) || (qt.length > 0 && qt.every((t) => `${p.name} ${p.partNumber} ${p.aliases.join(' ')}`.toLowerCase().includes(t))); // ONE search feeds the Pad too
  const out: PadSuggestion[] = []; const push = (s: PadSuggestion) => { if (!out.some((o) => o.part.id === s.part.id)) out.push(s); };
  learnedEvents(ref, caliber).filter((e) => similarDesc(e.description, needle)).sort((a, b) => b.ts.localeCompare(a.ts)).forEach((e) => { const p = store.parts.find((x) => x.id === e.partId); if (p) push({ part: p, learned: true, source: 'learned', hint: `learned · “${e.description}”${e.kind === 'resolved' ? ` → ${e.partNumber}` : ''}` }); });
  store.parts.filter((p) => p.compatibleRefs.some((r) => refKey6(r) === refKey6(ref)) && hit(p)).forEach((p) => push({ part: p, learned: false, source: 'ref', hint: `fits ${ref}` }));
  if (caliber) store.parts.filter((p) => p.calibers.includes(caliber) && hit(p)).forEach((p) => push({ part: p, learned: false, source: 'caliber', hint: `cal. ${caliber}` }));
  searchPartsSync(needle, 10).forEach((p) => push({ part: p, learned: false, source: 'ref', hint: `${p.category}${p.calibers.length ? ` · cal. ${p.calibers.join('/')}` : ''}` }));
  return out.slice(0, 10);
};
export const padRecordSelection = (ref: string, caliber: string | undefined, part: Part, description: string) => { m3ke.events.push({ id: newId('m3'), kind: 'selected', description: description.trim() || part.name, reference: ref, caliber, partId: part.id, partNumber: part.partNumber, price: part.price, resolvedBy: actor().by, ts: new Date().toISOString() }); };
export async function submitPadRequest(jobId: string, items: PartsRequestItem[]): Promise<PartsRequestWithRefs> {
  if (!items.length) throw new Error('Add at least one line'); const j = getJobRow(jobId); const w = byId(store.watches, j.watchId); const a = actor();
  const lines: PartsRequestItem[] = items.map((i) => { const p = i.partId ? store.parts.find((x) => x.id === i.partId) : undefined; return { partId: p?.id, partNumber: p?.partNumber, description: i.description.trim(), qty: Math.max(1, i.qty), price: p?.price, generic: !p }; });
  const num = nextPrNumber(); const r: PartsRequest = { id: num.toLowerCase(), number: num, jobId: j.id, status: 'pending_review', partId: lines[0].partId, qty: lines[0].qty, note: lines.find((l) => l.generic)?.description, items: lines, searchTerms: lines.map((l) => l.description), chat: [], requestedBy: a.by, requestedAt: new Date().toISOString(), station: a.station, source: 'pad', reference: w.reference, caliber: fx.caliberForReference(w.reference) };
  store.partsRequests.unshift(r); partsStamp(r, `pad request → manager review · ${lines.map((l) => `${l.description} ×${l.qty}${l.generic ? ' (GENERIC)' : ''}`).join(', ')}`); jobStamp(j, `Parts request ${r.number} (pad) · ${lines.length} line(s) → review`);
  return resolve(prRefs(r));
}
export async function getPadRequests(): Promise<PartsRequestWithRefs[]> { return resolve(store.partsRequests.filter((r) => r.source === 'pad').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(prRefs)); }
export async function getReviewQueue(): Promise<{ review: PartsRequestWithRefs[]; awaitingClient: PartsRequestWithRefs[]; toAllocate: PartsRequestWithRefs[]; bench: (PartsRequestWithRefs & { onHand: number })[] }> {
  const rows = [...store.partsRequests].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  return resolve({ review: rows.filter((r) => r.status === 'pending_review').map(prRefs), awaitingClient: rows.filter((r) => r.status === 'awaiting_client').map(prRefs), toAllocate: rows.filter((r) => r.status === 'approved' && r.source === 'pad' && !r.allocatedAt).map(prRefs), bench: (await getApprovalsQueue()).filter((r) => r.source !== 'pad') });
}
const managerOnly = () => { const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Manager tier only'); return a; };
export async function reviewItem(requestId: string, index: number, patch: { price?: number; partNumber?: string }): Promise<{ request: PartsRequestWithRefs; learned?: M3keEvent }> {
  const a = managerOnly(); const r = byId(store.partsRequests, requestId); if (r.status !== 'pending_review') throw new Error('Only requests in review can be edited'); const it = r.items?.[index]; if (!it) throw new Error('No such line');
  let learned: M3keEvent | undefined;
  if (patch.price !== undefined) { if (!(patch.price >= 0)) throw new Error('Price must be a number'); it.price = patch.price; }
  if (patch.partNumber !== undefined) {
    const pn = patch.partNumber.trim(); it.partNumber = pn || undefined; const p = pn ? store.parts.find((x) => x.partNumber.toLowerCase() === pn.toLowerCase()) : undefined;
    it.partId = p?.id; if (p && it.price === undefined) it.price = p.price;
    if (p && it.generic) { it.generic = false; learned = { id: newId('m3'), kind: 'resolved', description: it.description, reference: r.reference ?? '', caliber: r.caliber, partId: p.id, partNumber: p.partNumber, price: it.price, resolvedBy: a.by, ts: new Date().toISOString(), requestId: r.id }; m3ke.events.push(learned); partsStamp(r, `M3KE learned · “${it.description}” → ${p.partNumber} (${r.reference})`); }
    else if (pn && !p) it.generic = true;
  }
  if (index === 0) { r.partId = it.partId; r.qty = it.qty; }
  return resolve({ request: prRefs(r), learned });
}
export async function sendForClientApproval(requestId: string): Promise<PartsRequestWithRefs> { managerOnly(); return sendApprovalInternal(requestId); }
// One-tap Send from the daily "Approvals to send" list — pricing was already reviewed, sending is clerical (MH or the desk)
export async function sendReadyApproval(requestId: string): Promise<PartsRequestWithRefs> { const r = byId(store.partsRequests, requestId); if (!approvalReady(r)) throw new Error('Every line needs a price before it can go to the client'); return sendApprovalInternal(requestId); }
const approvalReady = (r: PartsRequest) => r.status === 'pending_review' && (r.items ?? []).length > 0 && (r.items ?? []).every((i) => i.price !== undefined && i.price >= 0);
async function sendApprovalInternal(requestId: string): Promise<PartsRequestWithRefs> {
  const a = actor(); const r = byId(store.partsRequests, requestId); if (r.status !== 'pending_review') throw new Error('Not in review');
  const bad = (r.items ?? []).filter((i) => i.price === undefined || !(i.price >= 0)); if (bad.length) throw new Error(`Price required on every line — missing: ${bad.map((b) => b.description).join(', ')}`);
  const j = getJobRow(r.jobId); const c = byId(fx.clients, j.clientId); const w = byId(store.watches, j.watchId); const total = (r.items ?? []).reduce((t, i) => t + (i.price ?? 0) * i.qty, 0);
  const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: `${j.number} · ${r.number}`, status: 'pending', subject: `Parts approval needed — ${w.brand} ${w.model} (${j.number})`, body: `Hello ${c.firstName},\n\nDuring service of your ${w.brand} ${w.model} (${w.reference}) our watchmaker found the following parts are needed:\n\n${(r.items ?? []).map((i) => `• ${i.description}${i.partNumber ? ` (${i.partNumber})` : ''} ×${i.qty} — $${(i.price ?? 0).toFixed(2)}`).join('\n')}\n\nTotal parts: $${total.toFixed(2)}\n\nPlease approve or decline in RolliConnect:\n▶ ${typeof window !== 'undefined' ? window.location.origin : ''}${clientLinkPath(issueClientLink('parts', r.id, j.clientId))}\n\nThis link opens this parts approval only (${LINK_EXPIRY.parts}). Sign in to RolliConnect to see everything in one place.\n\n— The RolliSuite team`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station };
  queueOutbox(email); r.emailId = email.id; r.status = 'awaiting_client'; r.sentForApprovalAt = email.createdAt; r.sentBy = a.by;
  threadEvent(j.clientId, { kind: 'job', id: j.id }, 'parts', a.by, `Parts approval sent · ${r.number} · ${(r.items ?? []).length} line(s) · $${total.toFixed(2)}`);
  partsStamp(r, `sent for client approval · $${total.toFixed(2)} · email queued`); jobStamp(j, `${r.number} sent for client approval`); approvalsToSendSweepSync();
  return resolve(prRefs(r));
}
export async function simulateClientPartsDecision(requestId: string, decision: 'approve' | 'decline'): Promise<PartsRequestWithRefs> {
  const r = byId(store.partsRequests, requestId); clientPartsDecision(r, decision, 'simulated'); return resolve(prRefs(r));
}
// One ledger for the client's parts decision — the portal page (/rc/parts/:id, same page the email link opens) and the simulate button
const clientPartsDecision = (r: PartsRequest, decision: 'approve' | 'decline', via: 'portal' | 'simulated') => {
  if (r.status !== 'awaiting_client') throw new Error('Not awaiting the client'); const j = getJobRow(r.jobId); const c = byId(fx.clients, j.clientId);
  r.status = decision === 'approve' ? 'approved' : 'declined'; r.clientDecidedAt = new Date().toISOString(); r.decidedBy = `${c.firstName} (client)`; r.decidedAt = r.clientDecidedAt;
  threadEvent(j.clientId, { kind: 'job', id: j.id }, 'approval', c.firstName, `${decision === 'approve' ? 'Approved' : 'Declined'} parts ${r.number}${via === 'portal' ? ' in RolliConnect' : ' (simulated client reply)'}`, { kind: decision === 'approve' ? 'parts_approved' : 'parts_rejected', refId: r.id, label: decision === 'approve' ? 'parts approved' : 'parts declined' });
  partsStamp(r, `client ${decision}d${via === 'portal' ? ' (portal)' : ' (simulated)'}`); jobStamp(j, `${r.number} ${decision}d by the client${via === 'portal' ? ' in RolliConnect' : ' (simulated)'}`);
};
export async function padAllocate(requestId: string): Promise<PartsRequestWithRefs> {
  const a = managerOnly(); const r = byId(store.partsRequests, requestId); if (r.status !== 'approved' || r.allocatedAt) throw new Error('Only client-approved, unallocated requests allocate');
  const lines = (r.items ?? []).filter((i) => i.partId); if (!lines.length) throw new Error('No catalog part on this request — resolve part numbers first');
  const short = lines.map((i) => ({ i, p: byId(store.parts, i.partId!) })).filter(({ i, p }) => p.stock < i.qty); if (short.length) throw new Error(`OUT OF STOCK — ${short.map(({ p }) => p.name).join(', ')} · use Order part`);
  lines.forEach((i) => { const p = byId(store.parts, i.partId!); rw18.picks.unshift({ id: newId('pk'), prId: r.id, partId: p.id, jobId: r.jobId, qty: i.qty, status: 'open', location: p.location ?? 'Unassigned', createdAt: new Date().toISOString() }); });
  r.allocatedAt = new Date().toISOString(); partsStamp(r, `allocated by ${a.by} · ${lines.length} pick(s) → picking queue`); return resolve(prRefs(r));
}
export const partsOnHand = (partId: string) => store.parts.find((p) => p.id === partId)?.stock ?? 0;
export async function getM3keEvents(): Promise<M3keEvent[]> { return resolve([...m3ke.events].sort((a, b) => b.ts.localeCompare(a.ts))); }
// Jobs tab — supervisor override of the working tech (Bulk Assign stays the morning path)
export const getRoomTechs = (): User[] => getDivisionStaff(getSessionDivision()).filter((u) => u.roles.includes('watchmaker') || u.roles.includes('manager') || u.roles.includes('inspector'));
export async function padSetTech(jobId: string, shortName: string): Promise<JobWithRefs> {
  const a = managerOnly(); const j = getJobRow(jobId); const u = fx.users.find((x) => x.shortName === shortName); if (!u) throw new Error('Pick someone from the staff list');
  const head = ensureParts(j).find((c) => c.key === 'head'); const prev = head?.custodyTech ?? j.assignees.find((s) => fx.users.find((x) => x.shortName === s)?.roles.includes('watchmaker')) ?? j.assignees[0];
  j.assignees = [shortName, ...j.assignees.filter((s) => s !== shortName && s !== prev)];
  if (head) { head.custodyTech = shortName; head.history!.push({ at: new Date().toISOString(), by: a.by, to: head.station, status: head.partStatus ?? 'in_progress', via: 'pad', note: `custody → ${shortName} (supervisor override${prev ? `, was ${prev}` : ''})` }); }
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${j.number} · tech reassigned ${prev ?? '—'} → ${shortName} · supervisor override (pad)` });
  return resolve(jobRefs(j));
}
// Detail sheet — condition report grades + notes per component (read-only); falls back to the multiple-choice inspection
export async function getPadCondition(jobId: string): Promise<PadConditionView> {
  const j = getJobRow(jobId); const rep = rp.reports.filter((r) => r.jobId === jobId && r.status !== 'superseded').sort((a, b) => b.version - a.version)[0];
  if (rep) return resolve({ source: 'report', issuedBy: rep.issuedBy, issuedAt: rep.issuedAt, notes: rep.notes, rows: rep.grades.map((g) => ({ component: g.component, grade: g.grade, note: g.note })) });
  if (j.inspection) return resolve({ source: 'inspection', issuedBy: j.inspection.by, issuedAt: j.inspection.at, notes: j.conditionNotes, rows: INSPECTION_QUESTIONS.map((q) => ({ component: q.label, grade: j.inspection!.answers[q.key] ?? '—' })) });
  return resolve({ source: 'none', notes: j.conditionNotes, rows: [] });
}

// ---- Client request notes — what the client asked for. Badge on cards, pop-up on every scan, mandatory checklist at QC ----
import type { ClientRequest, ClientRequestAlert, StaffInboxRow } from './types';
const requestsOf = (j: Job): ClientRequest[] => (j.clientRequests ??= []);
export const openClientRequests = (j: Job): ClientRequest[] => requestsOf(j).filter((r) => !r.check);
export const qcRequestGaps = (j: Job): ClientRequest[] => (j.status === 'testing' ? openClientRequests(j) : []);
export async function addClientRequest(jobId: string, text: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); if (!text.trim()) throw new Error('Write what the client asked for'); const a = actor();
  requestsOf(j).unshift({ id: newId('cr'), text: text.trim(), at: new Date().toISOString(), by: a.by, station: a.station, acks: [] });
  jobStamp(j, `Client request added · ${text.trim().slice(0, 60)}`); return resolve(jobRefs(j));
}
export async function removeClientRequest(jobId: string, reqId: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); const r = requestsOf(j).find((x) => x.id === reqId); if (!r) throw new Error('Request not found'); if (r.check) throw new Error('Checked-off requests stay on the record');
  j.clientRequests = requestsOf(j).filter((x) => x.id !== reqId); jobStamp(j, `Client request removed · ${r.text.slice(0, 60)}`); return resolve(jobRefs(j));
}
// Sync: called by every scan surface after the scan registers. Null when nothing is open.
export const clientRequestAlert = (jobId: string): ClientRequestAlert | null => {
  const j = getJobRow(jobId); const open = openClientRequests(j); if (!open.length) return null; const w = byId(store.watches, j.watchId);
  return { jobId: j.id, jobNumber: j.number, watchLabel: `${w.brand} ${w.model} · ${w.reference}`, requests: open };
};
export async function ackClientRequests(jobId: string, via: string): Promise<void> {
  const j = getJobRow(jobId); const a = actor(); const open = openClientRequests(j); const at = new Date().toISOString();
  open.forEach((r) => r.acks.push({ at, by: a.by, via })); if (open.length) jobStamp(j, `Client requests seen · ${open.length} · ${a.by} (${via})`);
  return resolve(undefined);
}
export async function checkClientRequest(jobId: string, reqId: string, result: 'done' | 'na', reason?: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); const r = requestsOf(j).find((x) => x.id === reqId); if (!r) throw new Error('Request not found'); if (r.check) throw new Error('Already checked off');
  if (result === 'na' && !reason?.trim()) throw new Error('N/A needs a reason'); const a = actor();
  r.check = { at: new Date().toISOString(), by: a.by, result, reason: reason?.trim() || undefined };
  jobStamp(j, `Client request ${result === 'done' ? 'done' : 'N/A'} · ${r.text.slice(0, 50)}${reason ? ` · ${reason.trim()}` : ''} · ${a.by}`); return resolve(jobRefs(j));
}
export async function uncheckClientRequest(jobId: string, reqId: string): Promise<JobWithRefs> {
  const j = getJobRow(jobId); const r = requestsOf(j).find((x) => x.id === reqId); if (!r?.check) throw new Error('Nothing to undo'); r.check = undefined; jobStamp(j, `Client request reopened · ${r.text.slice(0, 50)}`); return resolve(jobRefs(j));
}

// ---- Inbox — staff section: anyone can open a colleague's inbox (read + reply); "Assigned to me" stays the shortcut ----
const openAssignedTo = (u: User) => { wakeSnoozed(); const div = getSessionDivision(); return cx.conversations.filter((c) => c.division === div && c.status !== 'closed' && c.assignedTo && assigneeMatches(c.assignedTo, u)); };
export async function getStaffInboxRows(): Promise<StaffInboxRow[]> { return resolve(fx.users.filter((u) => u.shortName !== 'Leo').map((u) => ({ user: u, openAssigned: openAssignedTo(u).length }))); }
export async function getColleagueInbox(shortName: string): Promise<ConversationWithRefs[]> {
  const u = fx.users.find((x) => x.shortName === shortName); if (!u) throw new Error(`No staff member ${shortName}`);
  return resolve(openAssignedTo(u).map(convRefs).sort((a, b) => Number(b.needsReply) - Number(a.needsReply) || b.lastAt.localeCompare(a.lastAt)));
}

// ---- Inbound shipping (pre-arrival) + tracking lookup. Carrier calls go ONLY through src/api/carriers/parcelpro.ts ----
import * as parcelpro from './carriers/parcelpro';
import type { InboundCounts, LabelPrep, ShipAddress, ShipCarrierName, ShipServiceLevel, ShipStage, InboundShipment, ShipmentWithRefs } from './types';
export type { ShipServiceLevel, LabelRequestDetails, PackageScan, PackageScanKind, PackageMatch } from './types';
const shp = { rows: fx.shipments.map((s): InboundShipment => ({ ...s, events: [...s.events], stamps: [...s.stamps], emailIds: [...s.emailIds] })) };
export const SHIP_STAGE_LABEL: Record<ShipStage, string> = { label_requested: 'Label requested', label_sent: 'Label sent', in_transit: 'In transit', delivered_unscanned: 'Delivered · unscanned', arrived: 'Arrived' };
const shipStamp = (s: InboundShipment, action: string) => { const a = actor(); s.stamps.push({ at: new Date().toISOString(), by: a.by, station: a.station, action }); appendAudit({ type: 'intake', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${byId(store.estimates, s.estimateId).number} · shipping · ${action}` }); };
const dayDiff = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const shipRefs = (s: InboundShipment): ShipmentWithRefs => { const e = byId(store.estimates, s.estimateId); const last = s.events[s.events.length - 1]; const cl = byId(fx.clients, s.clientId); return { ...s, destinationState: s.stage === 'label_requested' ? cl.state || s.destinationState : s.destinationState, estimate: e, client: cl, watch: e.watchId ? store.watches.find((w) => w.id === e.watchId) : undefined, ageDays: dayDiff(s.requestedAt), outstandingDays: s.labelSentAt ? dayDiff(s.labelSentAt) : 0, lastEvent: last, arrivingToday: s.stage === 'in_transit' && !!last && /out for delivery/i.test(last.status), unscannedHours: s.deliveredAt ? Math.floor((Date.now() - new Date(s.deliveredAt).getTime()) / 3_600_000) : 0 }; };
const shipOf = (id: string) => byId(shp.rows, id);
export async function getInboundBoard(): Promise<{ rows: ShipmentWithRefs[]; counts: InboundCounts }> {
  const rows = shp.rows.filter((s) => s.direction === 'inbound' && s.stage !== 'arrived').map(shipRefs).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const n = (st: ShipStage) => rows.filter((r) => r.stage === st).length;
  return resolve({ rows, counts: { label_requested: n('label_requested'), label_sent: n('label_sent'), in_transit: n('in_transit'), delivered_unscanned: n('delivered_unscanned'), red30: rows.filter((r) => r.stage === 'label_sent' && r.outstandingDays > 30).length, arrivingToday: rows.filter((r) => r.arrivingToday).length } });
}
export async function getShipment(id: string): Promise<ShipmentWithRefs | null> { const s = shp.rows.find((x) => x.id === id); return resolve(s ? shipRefs(s) : null); }
export async function getShipmentsForClient(clientId: string): Promise<ShipmentWithRefs[]> { return resolve(shp.rows.filter((s) => s.clientId === clientId).map(shipRefs).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))); }
export async function getShipmentForEstimate(estimateId: string): Promise<ShipmentWithRefs | null> { const s = shp.rows.find((x) => x.estimateId === estimateId && x.stage !== 'arrived'); return resolve(s ? shipRefs(s) : null); }
export async function prepareLabel(id: string): Promise<LabelPrep> {
  const s = shipRefs(shipOf(id)); const c = s.client; const recipient: ShipAddress = { name: `${c.firstName} ${c.lastName}`, street: c.street, city: c.city, state: c.state || s.destinationState };
  const ref = suggestInsuredByRef(s.estimate.watchId);
  return { shipment: s, recipient, validation: await parcelpro.validateAddress(recipient), declaredValue: s.declaredValue || ref?.value || s.estimate.total, refSuggestion: ref, quotedShipping: s.estimate.shippingAmount };
}
export async function createInboundLabel(id: string, recipient: ShipAddress, declaredValue: number, carrier: ShipCarrierName, serviceLevel?: ShipServiceLevel, quotedCost?: number): Promise<ShipmentWithRefs> {
  const s = shipOf(id); if (s.stage !== 'label_requested') throw new Error('Label already created'); if (!(declaredValue > 0)) throw new Error('Declared value is required'); const e = byId(store.estimates, s.estimateId);
  const v = await parcelpro.validateAddress(recipient); if (!v.valid) throw new Error(`Address not valid: ${v.riskFlag ?? 'incomplete'}`);
  const level = serviceLevel ?? s.request?.serviceLevel ?? s.serviceLevel ?? '1_day';
  const r = await parcelpro.purchaseLabel({ reference: e.number, shipFrom: v.cleaned, shipTo: parcelpro.SHOP_SHIP_TO, carrier, serviceLevel: level, insuredValue: declaredValue, signatureRequired: true });
  s.carrier = carrier; s.serviceLevel = level; s.service = r.service; s.declaredValue = r.insured.value; s.destinationState = v.cleaned.state; s.trackingNumber = r.trackingNumber; s.labelUrl = r.labelUrl; s.cost = quotedCost && quotedCost > 0 ? quotedCost : r.total; s.confirmationId = r.confirmationId; s.stage = 'label_sent'; s.labelSentAt = new Date().toISOString();
  // value-matching rule: the inbound declared value is stored on the estimate (and job) and prefills the outbound / return label later
  e.inboundDeclaredValue = s.declaredValue; const jj = store.jobs.find((x) => x.estimateId === e.id); if (jj) jj.inboundDeclaredValue = s.declaredValue; recordRefHistory(e.watchId, s.declaredValue);
  s.emailIds.push(queueShipEmail(s, 'Your prepaid shipping label').id); shipStamp(s, `label purchased (Parcel Pro ${parcelpro.parcelProMode()}) · ${r.confirmationId} · ${carrier} ${r.service} · ${r.trackingNumber} · insurance bound $${r.insured.value.toLocaleString()} · cost $${r.total} · emailed`);
  return resolve(shipRefs(s));
}
// One click on a client's label request: ship-from + insured value + service level come straight off the request. Tracking # returned here is the join key the arrival scan uses.
export async function sendLabelRequest(id: string): Promise<ShipmentWithRefs> {
  const s = shipOf(id); const c = byId(fx.clients, s.clientId); const r = s.request;
  const from: ShipAddress = r ? { name: r.name, street: r.street, city: r.city, state: r.state, zip: r.zip } : { name: `${c.firstName} ${c.lastName}`, street: c.street, city: c.city, state: c.state || s.destinationState };
  return createInboundLabel(id, from, r?.insuredValue ?? s.declaredValue ?? byId(store.estimates, s.estimateId).total, s.carrier, r?.serviceLevel ?? s.serviceLevel ?? '1_day');
}
const queueShipEmail = (s: InboundShipment, subject: string, extra = '') => { const e = byId(store.estimates, s.estimateId); const c = byId(fx.clients, s.clientId); const a = actor(); const email: OutboxEmail = { id: `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: `${e.number} · ${s.trackingNumber ?? 'label'}`, status: 'pending', subject: `${subject} — ${e.number}`, body: `Hello ${c.firstName},\n\n${extra || `Your prepaid, fully insured ${s.carrier} label for estimate ${e.number} is attached (insured value $${s.declaredValue.toLocaleString()}). Print it, pack the watch securely, and drop it at any ${s.carrier} location.`}\n\nLabel: ${s.labelUrl}\nTracking: ${s.trackingNumber}\nTrack it any time in RolliConnect: ${typeof window !== 'undefined' ? window.location.origin : ''}/rc\n\n— The RolliSuite team`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station }; queueOutbox(email); return email; };
export async function resendLabelEmail(id: string): Promise<ShipmentWithRefs> { const s = shipOf(id); if (!s.trackingNumber) throw new Error('No label yet'); s.emailIds.push(queueShipEmail(s, 'Your prepaid shipping label (resent)').id); shipStamp(s, 'label email re-queued'); return resolve(shipRefs(s)); }
export async function followUpLabel(id: string): Promise<ShipmentWithRefs> { const s = shipOf(id); if (!s.trackingNumber) throw new Error('No label yet'); s.emailIds.push(queueShipEmail(s, 'Still planning to send your watch in?', `We sent you a prepaid ${s.carrier} label ${dayDiff(s.labelSentAt!)} days ago and haven't seen the package move yet. No rush — just let us know if you need a new label or a different date.`).id); shipStamp(s, 'follow-up reminder queued'); return resolve(shipRefs(s)); }
export async function voidAndReissue(id: string): Promise<ShipmentWithRefs> { const s = shipOf(id); if (s.stage !== 'label_sent') throw new Error('Only outstanding labels can be voided'); await parcelpro.voidLabel(s.trackingNumber!); ba.voided.push({ trackingNumber: s.trackingNumber!, ref: byId(store.estimates, s.estimateId).number, kind: 'inbound', carrier: s.carrier, service: s.service, cost: s.cost ?? 0, createdAt: s.labelSentAt ?? s.requestedAt, voided: true, voidedAt: new Date().toISOString(), who: actor().by, path: `/shipping/inbound?track=${s.trackingNumber}` }); shipStamp(s, `label ${s.trackingNumber} voided · back to Label Requests (reissue)`); s.trackingNumber = undefined; s.labelUrl = undefined; s.cost = undefined; s.labelSentAt = undefined; s.stage = 'label_requested'; s.reissued = true; s.requestedAt = new Date().toISOString(); return resolve(shipRefs(s)); }
const SIM_STEPS: [RegExp | null, string, string, string?][] = [[null, 'Picked up', 'Origin facility'], [/picked up/i, 'In transit', 'Louisville, KY', 'Arrived at hub'], [/in transit/i, 'Out for delivery', 'New York, NY'], [/out for delivery/i, 'Delivered', 'New York, NY', 'Signed: FRONT DESK']];
export async function simulateTrackingEvent(id: string): Promise<ShipmentWithRefs> {
  const s = shipOf(id); if (!s.trackingNumber) throw new Error('No label to track'); if (s.stage === 'delivered_unscanned' || s.stage === 'arrived') throw new Error('Already delivered');
  const last = s.events[s.events.length - 1]; const step = SIM_STEPS.find(([m]) => (last ? m && m.test(last.status) : m === null)) ?? SIM_STEPS[0];
  s.events.push({ at: new Date().toISOString(), status: step[1], location: step[2], note: step[3] }); if (s.stage === 'label_sent') s.stage = 'in_transit';
  if (step[1] === 'Out for delivery') s.eta = new Date().toISOString(); if (step[1] === 'Delivered') { s.stage = s.direction === 'inbound' ? 'delivered_unscanned' : 'arrived'; s.deliveredAt = new Date().toISOString(); }
  const t = await parcelpro.getTracking(s.trackingNumber, s.events); if (t.eta) s.eta = t.eta; shipStamp(s, `tracking event (simulated) · ${step[1]} · ${step[2]}`); return resolve(shipRefs(s));
}
// One line the concierge can read to a caller or paste into a reply
export const clientStatusLine = (s: ShipmentWithRefs): string => {
  const who = s.direction === 'inbound' ? 'Your watch' : 'Your watch'; const last = s.lastEvent; const when = (iso: string) => { const d = dayDiff(iso); const h = new Date(iso).getHours(); return d === 0 ? (h < 12 ? 'this morning' : 'this afternoon') : d === 1 ? 'yesterday' : `on ${new Date(iso).toLocaleDateString('en-US', { weekday: 'long' })}`; };
  const eta = s.eta ? ` and is expected ${dayDiff(s.eta) === 0 ? 'today' : new Date(s.eta).toLocaleDateString('en-US', { weekday: 'long' })}` : '';
  if (s.stage === 'label_requested') return `We're preparing your prepaid ${s.carrier} shipping label for ${s.estimate.number} — it will be in your inbox shortly.`;
  if (s.stage === 'label_sent') return `Your prepaid ${s.carrier} label (${s.trackingNumber}) was emailed ${when(s.labelSentAt!)}; ${s.carrier} hasn't scanned the package yet — once you drop it off, tracking updates the same day.`;
  if (s.stage === 'delivered_unscanned') return `${s.carrier} shows your watch delivered to us ${when(s.deliveredAt!)}; our intake team is checking it in and you'll get a confirmation email shortly.`;
  if (s.stage === 'arrived') return `Your watch arrived safely and has been checked in at our workshop.`;
  return `${who} is ${s.direction === 'inbound' ? 'on its way to us' : 'on its way to you'} with ${s.carrier}${last ? `, last scanned in ${last.location} ${when(last.at)}` : ''}${eta}.`;
};

// ---- Job messages — threaded board ON the job (internal only). @mentions route by tier: manager/concierge → hit list pin; bench → Messages section ----
import type { BenchBoard, BenchGoals, BenchJobRow, BenchOutsourceRow, BenchSettings, BenchSplitRow, GoalMonth, JobMessage, JobNote, JobThread, MessageInboxRow, SplitState } from './types';
const MENTION_ANY = /@(\w+)/g;
const userByTag = (tag: string) => fx.users.find((u) => u.shortName.toLowerCase() === tag.toLowerCase() || u.firstName.toLowerCase() === tag.toLowerCase());
export const isManagerTier = (u: User) => u.accessTier === 'manager' || u.roles.includes('concierge');
export const staffForMention = (): User[] => getDivisionStaff(getSessionDivision());
const legacyNoteAsMessage = (j: Job, n: JobNote): JobMessage => ({ id: n.id, jobId: j.id, text: n.text, mentions: [], notify: [], readBy: [], at: n.at, by: n.by, station: n.station });
const messagesOf = (j: Job): JobMessage[] => [...store.jobMessages.filter((m) => m.jobId === j.id), ...j.notes.map((n) => legacyNoteAsMessage(j, n))];
const threadOf = (j: Job, rootId: string): JobThread => { const all = messagesOf(j); const root = all.find((m) => m.id === rootId)!; const replies = all.filter((m) => m.parentId === rootId).sort((a, b) => a.at.localeCompare(b.at)); return { root, replies, participants: [...new Set([root.by, ...root.mentions, ...replies.flatMap((r) => [r.by, ...r.mentions])])] }; };
export async function getJobThreads(jobId: string): Promise<JobThread[]> { const j = store.jobs.find((x) => x.id === jobId); if (!j) return resolve([]); const roots = messagesOf(j).filter((m) => !m.parentId).sort((a, b) => b.at.localeCompare(a.at)); return resolve(roots.map((r) => threadOf(j, r.id))); }
const routeMessage = (j: Job, m: JobMessage) => {
  m.notify.forEach((n) => { const u = fx.users.find((x) => x.shortName === n); if (!u || !isManagerTier(u)) return;
    store.pinned.unshift({ id: newId('pin'), title: `@${m.by} on ${j.number}: “${m.text.slice(0, 70)}${m.text.length > 70 ? '…' : ''}”`, assignedTo: { type: 'user', shortName: u.shortName }, createdBy: m.by, division: j.division, jobId: j.id, messageId: m.id, createdAt: m.at, station: m.station }); });
};
export async function postJobMessage(jobId: string, text: string, opts: { parentId?: string; photoUrl?: string } = {}): Promise<JobThread> {
  if (!text.trim()) throw new Error('Write a message'); const j = getJobRow(jobId); const a = actor();
  const mentions = [...new Set([...text.matchAll(MENTION_ANY)].map((x) => userByTag(x[1])?.shortName).filter((x): x is string => !!x && x !== a.by))];
  let rootId: string | undefined; const notify = new Set(mentions);
  if (opts.parentId) { const parent = messagesOf(j).find((m) => m.id === opts.parentId); if (!parent) throw new Error('Thread not found'); rootId = parent.parentId ?? parent.id; const t = threadOf(j, rootId); t.participants.forEach((p) => notify.add(p)); }
  notify.delete(a.by);
  const m: JobMessage = { id: newId('jm'), jobId: j.id, parentId: rootId, text: text.trim(), mentions, notify: [...notify], readBy: [a.by], at: new Date().toISOString(), by: a.by, station: a.station, photo: opts.photoUrl ? { id: newId('jmp'), source: 'camera', dataUrl: opts.photoUrl, slot: 'workbench', clientVisible: false } : undefined };
  store.jobMessages.push(m); routeMessage(j, m);
  jobStamp(j, `${rootId ? 'Reply' : 'Message'} by ${a.by}${m.notify.length ? ` → ${m.notify.map((n) => `@${n}`).join(' ')}` : ''} · ${m.text.slice(0, 50)}`);
  return resolve(threadOf(j, rootId ?? m.id));
}
const inboxFor = (short: string): MessageInboxRow[] => {
  const mine = store.jobMessages.filter((m) => m.notify.includes(short)); const byRoot = new Map<string, JobMessage[]>();
  mine.forEach((m) => { const k = m.parentId ?? m.id; byRoot.set(k, [...(byRoot.get(k) ?? []), m]); });
  return [...byRoot.entries()].map(([rootId, ms]) => { const j = getJobRow(ms[0].jobId); const latest = [...ms].sort((a, b) => b.at.localeCompare(a.at))[0]; return { thread: threadOf(j, rootId), latest, job: jobRefs(j), unread: ms.some((m) => !m.readBy.includes(short)) }; }).sort((a, b) => Number(b.unread) - Number(a.unread) || b.latest.at.localeCompare(a.latest.at));
};
export async function getMessageInbox(userId: string): Promise<MessageInboxRow[]> { return resolve(inboxFor(byId(fx.users, userId).shortName)); }
export const unreadMessageCount = (short: string) => inboxFor(short).filter((r) => r.unread).length;
export async function markJobThreadRead(rootId: string): Promise<void> { const me = actor().by; store.jobMessages.filter((m) => m.id === rootId || m.parentId === rootId).forEach((m) => { if (!m.readBy.includes(me)) m.readBy.push(me); }); return resolve(undefined); }
// Seeded threads route on load — same path a live post takes
fx.jobMessages.forEach((m) => routeMessage(byId(store.jobs, m.jobId), m));

// ---- Bench Pad — per-tech board, own numbers only, no money -------------------------------------------------------------------------
const BENCH_KEY = 'rollisuite.bench.settings';
export const STUCK_WORKING_DAYS = 4;
export const getBenchSettings = (): BenchSettings => ({ benchName: 'Bench 3', idleMinutes: 10, simulateOffline: localStorage.getItem(KIOSK_OFFLINE) === '1', ...readJson<Partial<BenchSettings>>(BENCH_KEY, {}) });
export const isOwnerPin = (pin: string) => fx.users.some((u) => u.id === OWNER_USER_ID && u.pin === pin);
export const verifySupervisorPin = (pin: string) => fx.users.some((u) => u.accessTier === 'manager' && u.pin === pin);
export const saveBenchSettings = (s: BenchSettings, supervisorPin: string): BenchSettings => {
  if (!verifySupervisorPin(supervisorPin)) throw new Error('Supervisor PIN not recognised');
  if (s.idleMinutes < 1 || s.idleMinutes > 120) throw new Error('Idle timeout must be 1–120 minutes'); if (!s.benchName.trim()) throw new Error('Bench needs a name');
  writeJson(BENCH_KEY, { benchName: s.benchName.trim(), idleMinutes: s.idleMinutes }); if (s.simulateOffline) localStorage.setItem(KIOSK_OFFLINE, '1'); else localStorage.removeItem(KIOSK_OFFLINE);
  appendAudit({ type: 'kiosk', stationName: s.benchName.trim(), userShortName: actor().user?.shortName, detail: `Bench settings saved · idle ${s.idleMinutes} min · ${s.simulateOffline ? 'offline simulation ON' : 'online'}` });
  return getBenchSettings();
};
export const setKioskOffline = (on: boolean) => { if (on) localStorage.setItem(KIOSK_OFFLINE, '1'); else localStorage.removeItem(KIOSK_OFFLINE); };
// PIN-in never needs the network (kiosk contract: an unreachable API must not lock a tech out of last-known data)
export async function benchPinIn(userId: string, pin: string): Promise<User> {
  const u = byId(fx.users, userId); if (u.pin !== pin) { appendAudit({ type: 'sign_in_failed', stationName: getBenchSettings().benchName, userShortName: u.shortName, method: 'pin_switch', detail: 'Bench pad · incorrect PIN' }); throw new Error('Incorrect PIN'); }
  localStorage.setItem(KEYS.currentUser, u.id); appendAudit({ type: 'sign_in', stationName: getBenchSettings().benchName, userShortName: u.shortName, userDisplayName: u.displayName, method: 'pin_switch', detail: 'Bench pad · PIN in' }); return u;
}
// Last-known board per tech, per device — what the pad shows under the "reconnecting…" banner after a cold start
const BENCH_CACHE = 'rollisuite.bench.lastBoard';
export const cacheBenchBoard = (b: BenchBoard) => writeJson(`${BENCH_CACHE}.${b.user.id}`, { ...b, cachedAt: new Date().toISOString() });
export const readCachedBenchBoard = (userId: string): (BenchBoard & { cachedAt: string }) | null => readJson<(BenchBoard & { cachedAt: string }) | null>(`${BENCH_CACHE}.${userId}`, null);
const workingDaysBetween = (from: string, to = new Date()) => { let n = 0; const d = new Date(from); d.setHours(0, 0, 0, 0); const end = new Date(to); end.setHours(0, 0, 0, 0); while (d < end) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; } return n; };
const lastMovementAt = (j: Job) => [...ensureParts(j).flatMap((c) => (c.history ?? []).map((h) => h.at)), ...j.timeline.map((t) => t.at), j.createdAt].sort().reverse()[0];
const MONTH_LABEL = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleString('en-US', { month: 'short' });
const weeksOf = (year: number, month: number) => Math.ceil(new Date(year, month + 1, 0).getDate() / 7);
const goalMonth = (tech: string, monthsAgo: number): GoalMonth => {
  const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const goal = fx.techGoals[tech] ?? 18;
  const seed = (fx.goalHistorySeeds[tech] ?? []).find((s) => s.monthsAgo === monthsAgo); const wk = weeksOf(d.getFullYear(), d.getMonth());
  if (!seed) return { key, label: MONTH_LABEL(key), goal, actual: 0, hit: false, byWeek: Array.from({ length: wk }, (_, i) => ({ label: `Wk ${i + 1}`, count: 0 })), byType: { head: 0, case: 0, band: 0 }, quality: techQuality(tech, key) };
  const shape = seed.weekShape.slice(0, wk); while (shape.length < wk) shape.push(0); const raw = shape.map((f) => Math.floor(f * seed.actual)); let rem = seed.actual - raw.reduce((a, b) => a + b, 0); for (let i = raw.length - 1; rem > 0 && i >= 0; i--, rem--) raw[i] += 1;
  return { key, label: MONTH_LABEL(key), goal, actual: seed.actual, hit: seed.actual >= goal, byWeek: raw.map((c, i) => ({ label: `Wk ${i + 1}`, count: c })), byType: { ...seed.byType } , quality: techQuality(tech, key) };
};
const benchGoals = (tech: string): BenchGoals => {
  const now = new Date(); const m = monthKey(now.toISOString()); const goal = fx.techGoals[tech] ?? 18; const base = fx.currentMonthBase[tech] ?? { actual: 0, byType: { head: 0, case: 0, band: 0 } };
  const live = store.jobs.flatMap((j) => ensureComponents(j).filter((c) => c.completedBy === tech && c.completedAt && monthKey(c.completedAt) === m));
  const wk = weeksOf(now.getFullYear(), now.getMonth()); const byWeek = Array.from({ length: wk }, (_, i) => ({ label: `Wk ${i + 1}`, count: 0 })); const curWk = Math.min(wk, Math.ceil(now.getDate() / 7));
  for (let i = 0; i < base.actual; i++) byWeek[i % curWk].count += 1; live.forEach((c) => { byWeek[Math.min(wk, Math.ceil(new Date(c.completedAt!).getDate() / 7)) - 1].count += 1; });
  const byType: Record<ComponentKey, number> = { ...base.byType }; live.forEach((c) => { byType[c.key] += 1; });
  const actual = base.actual + live.length; const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { current: { key: m, label: MONTH_LABEL(m), goal, actual, hit: actual >= goal, byWeek, byType, quality: techQuality(tech, m) }, paceTarget: Math.round((goal * now.getDate()) / daysInMonth), dayOfMonth: now.getDate(), daysInMonth, history: [6, 5, 4, 3, 2, 1].map((n) => goalMonth(tech, n)) };
};
const splitState = (dots: FloorDot[]): SplitState => {
  const st = (k: ComponentKey) => dots.find((d) => d.key === k)?.station; const head = st('head'); const band = st('band');
  if (dots.every((d) => d.station === 'final_assembly' || d.station === 'finished')) return 'reunited';
  if (head && head.startsWith('safe_await_band')) return 'waiting_band'; if (band && band.startsWith('safe_await_head')) return 'waiting_head'; return 'split';
};
export async function getBenchBoard(userId: string): Promise<BenchBoard> {
  const u = byId(fx.users, userId); const me = u.shortName; const now = new Date().toISOString();
  const mine = roomJobs().filter((j) => j.status !== 'ready_to_ship' && (j.assignees.includes(me) || ensureParts(j).some((c) => c.custodyTech === me)));
  const row = (j: Job): BenchJobRow => { const idle = workingDaysBetween(lastMovementAt(j)); return { job: jobRefs(j), parts: ensureParts(j).map((c) => dotOf(j, c)), idleDays: idle, late: !!j.dueAt && j.dueAt < now, stuck: j.status === 'in_service' && !activeHold(j) && idle >= STUCK_WORKING_DAYS }; };
  const rows = mine.map(row);
  const inProgress = rows.filter((r) => (r.job.status === 'in_service' || r.job.status === 'approved') && !activeHold(r.job));
  const attention = rows.filter((r) => r.late || r.stuck);
  const splits: BenchSplitRow[] = mine.filter((j) => ensureParts(j).length > 1 && j.status !== 'approved').map((j) => { const parts = ensureParts(j).map((c) => dotOf(j, c)); const band = ensureParts(j).find((c) => c.key === 'band'); const bandWait = band?.history?.filter((h) => h.status === 'waiting' || h.status === 'reunited').slice(-1)[0]; return { job: jobRefs(j), parts, state: splitState(parts), bandDoneBy: band?.completedBy ?? bandWait?.by, bandDoneAt: band?.completedAt ?? bandWait?.at }; });
  const outsourced: BenchOutsourceRow[] = mine.map((j) => ({ j, h: activeHold(j) })).filter((x) => x.h?.type === 'outsource').map(({ j, h }) => ({ job: jobRefs(j), vendor: /\(([^)]+)\)/.exec(h!.reason)?.[1] ?? h!.reason.split(/—|-/)[0].trim(), reason: h!.reason, daysOut: Math.floor((Date.now() - new Date(h!.placedAt).getTime()) / 86_400_000) }));
  const month = monthKey(now);
  const completed = store.jobs.flatMap((j) => ensureComponents(j).filter((c) => c.completedBy === me && c.completedAt && monthKey(c.completedAt) === month).map((c) => ({ job: jobRefs(j), part: dotOf(j, c), at: c.completedAt! }))).sort((a, b) => b.at.localeCompare(a.at));
  const messages = inboxFor(me);
  return resolve({ user: u, inProgress, attention, splits, outsourced, completed, goals: benchGoals(me), messages, unread: messages.filter((r) => r.unread).length, stuckDays: STUCK_WORKING_DAYS });
}


// ---- Trade lane — scan-in intake (custody starts; no inspection report, no estimate) + division-manager review queue ----------------------
export interface TradeScanInInput { clientId: string; watchId?: string; newWatch?: NewWatchInput; workflow: DeptCode[]; lines: { description: string; unitPrice: number; dept: DeptCode }[]; dueAt?: string; note?: string }
export async function getTradeAccounts(): Promise<Client[]> { return resolve(fx.clients.filter((c) => c.type === 'trade')); }
export async function tradeScanIn(input: TradeScanInInput): Promise<JobWithRefs> {
  const c = byId(fx.clients, input.clientId); if (c.type !== 'trade') throw new Error('Scan-in is for trade accounts only');
  if (!input.workflow.length) throw new Error('Pick at least one department');
  const w = input.watchId ? byId(store.watches, input.watchId) : input.newWatch ? await createWatch(c.id, input.newWatch) : undefined; if (!w) throw new Error('Scan or pick the watch');
  if (store.jobs.some((j) => j.watchId === w.id && j.status !== 'closed')) throw new Error(`${w.brand} ${w.model} already has an open job`);
  const lines: EstimateLine[] = input.lines.filter((l) => l.description.trim()).map((l) => ({ id: newLineId(), description: l.description.trim(), qty: 1, unitPrice: Math.round(l.unitPrice), dept: l.dept, taxable: false, type: 'service' }));
  const j = buildJob({ clientId: c.id, watchId: w.id, kind: 'trade', onHand: true, workflow: input.workflow, lines, dueAt: input.dueAt, intakeNotes: input.note?.trim() || undefined });
  pushTransition(j, 'trade_scan_in', 'in_service', `Trade scan-in · ${c.company ?? fullNameOf(c)}${c.internal ? ' (internal)' : ''} — straight to the work queue`);
  w.status = 'in_service'; w.receivedAt = new Date().toISOString();
  ensureParts(j).forEach((x) => recordMove(j, x, laneOfPart(x.key) === 'band' ? 'band_pre_queue' : 'pre_queue', 'not_started', 'scan', 'trade scan-in'));
  jobStamp(j, `Trade scan-in · ${w.brand} ${w.model} · ${input.workflow.join('+')} · custody starts · no inspection report / no estimate`);
  return resolve(jobRefs(j));
}
export interface TradeReviewRow { job: JobWithRefs; account: Client; mine: boolean; waitingSince: string; inspectedBy: string; internal: boolean }
export async function getTradeReviewQueue(): Promise<TradeReviewRow[]> {
  const me = currentUserSync();
  return resolve(store.jobs.filter((j) => isTradeJob(j) && j.status === 'awaiting_manager_review').map((j) => { const t = [...j.timeline].reverse().find((x) => x.to === 'awaiting_manager_review'); const account = byId(fx.clients, j.clientId); return { job: jobRefs(j), account, mine: !!me && account.managerShort === me.shortName, waitingSince: t?.at ?? j.createdAt, inspectedBy: t?.by ?? '—', internal: !!account.internal }; }).sort((a, b) => Number(b.mine) - Number(a.mine) || a.waitingSince.localeCompare(b.waitingSince)));
}
export const TRADE_PATH: { key: string; label: string }[] = [{ key: 'scan_in', label: 'Scan-in' }, { key: 'work', label: 'Work' }, { key: 'inspection', label: 'Inspection' }, { key: 'review', label: 'Manager review' }, { key: 'invoice', label: 'Invoice' }];
export const tradePathIndex = (j: Job): number => (j.status === 'intake' ? 0 : j.status === 'in_service' ? 1 : j.status === 'testing' ? 2 : j.status === 'awaiting_manager_review' ? 3 : 4);

// ---- Stage / bin audit — what the system believes is at a location vs what is physically scanned ------------------------------------------
import type { AuditItem, AuditLive, AuditLocation, AuditLocationKey, AuditLocationStatus, AuditResolution, AuditScanResult, AuditSession, ValueTier } from './types';
export { AUDIT_LOCATIONS } from './fixtures';
const auditStore = { sessions: fx.auditSeeds.map((a): AuditSession => ({ ...a, missing: [...a.missing], unexpected: [...a.unexpected] })), live: null as AuditLive | null, staleDays: fx.AUDIT_STALE_DAYS_DEFAULT };
const auditLoc = (k: AuditLocationKey): AuditLocation => fx.AUDIT_LOCATIONS.find((l) => l.key === k)!;
export const valueTierOf = (j: Job): ValueTier => { const est = j.estimateId ? store.estimates.find((e) => e.id === j.estimateId) : undefined; const so = store.salesOrders.find((o) => o.jobId === j.id && o.status !== 'cancelled'); const cents = so?.total ?? j.total ?? est?.total ?? 0; return cents >= 500_000 ? 'high' : cents >= 150_000 ? 'mid' : 'standard'; };
// Belief: bins are derived from job state (awaiting payment, orphaned after close, pre-inspection); everything else is the part's station
const believedLocation = (j: Job, c: JobComponent): AuditLocationKey => {
  const so = store.salesOrders.find((o) => o.jobId === j.id && o.status !== 'cancelled');
  if (j.status === 'closed') return so && (so.status === 'picked_up' || so.status === 'shipped') ? 'finished' : 'orphan_bin';
  if (j.status === 'ready_to_ship' && (!so || !so.isPaid)) return 'awaiting_payment_bin';
  if (j.status === 'intake' || j.status === 'in_review') return 'pre_intake_bin';
  if (activeHold(j)?.type === 'parts') return 'stuck_parts_bin';
  return derivePlacement(j, c).station;
};
const auditItemOf = (j: Job, c: JobComponent): AuditItem => {
  const w = byId(store.watches, j.watchId); const cl = byId(fx.clients, j.clientId); const last = c.history?.length ? c.history[c.history.length - 1] : undefined; const t0 = j.timeline[j.timeline.length - 1];
  return { id: `${j.id}-${c.key}`, jobId: j.id, jobNumber: j.number, key: c.key, partLabel: PART_LABEL[c.key], watchLabel: `${w.brand} ${w.model}`, reference: w.reference, serial: w.serial, clientId: cl.id, clientName: cl.company ?? fullNameOf(cl), tier: valueTierOf(j), lastCustody: last ? { by: last.by, at: last.at, where: last.to ? stationOf(last.to).label : last.status } : t0 ? { by: t0.by, at: t0.at, where: t0.station } : undefined };
};
const auditableJobs = () => store.jobs.filter((j) => j.division === getSessionDivision() && (j.status !== 'closed' || (j.finishedAt && Date.now() - new Date(j.finishedAt).getTime() < 30 * 86_400_000)));
const expectedAt = (k: AuditLocationKey): AuditItem[] => auditableJobs().flatMap((j) => ensureParts(j).filter((c) => believedLocation(j, c) === k).map((c) => auditItemOf(j, c)));
// Role-scoped audit: MH/owner = full shop grid (unchanged); WM Supervisor = only the WM room's safes, benches, stuck bin, testing, "MM Inspection" (= finished), pre-queue, refinish/polish. Band scope for Joseph later.
const AUDIT_SCOPES: Record<Exclude<AuditScope, 'full'>, { keys: AuditLocationKey[]; relabel: Partial<Record<AuditLocationKey, string>> }> = {
  wm: { keys: ['into_safe_head', 'safe_await_band', 'safe_await_head', 'wm_bench_1', 'wm_bench_2', 'wm_bench_3', 'stuck_parts_bin', 'testing', 'finished', 'pre_queue', 'uncase', 'mgr_safe_polish_in', 'polish_room', 'mgr_safe_polish_out', 'movement_service', 'parts_approval', 'recase_test'], relabel: { finished: 'MM Inspection · finished, awaiting inspection', pre_queue: 'Pre-queue · in safe, awaiting bench pickup' } },
  band: { keys: ['band_pre_queue', 'band_assign', 'band_mgr_safe_in', 'refinish', 'band_mgr_safe_out', 'band_qc', 'polish_room', 'into_safe_band', 'safe_await_head', 'stuck_parts_bin', 'final_assembly', 'jv_bench', 'vc_safe'], relabel: { final_assembly: 'Band handoff · final assembly', jv_bench: "JV's bench · JV bin by day", vc_safe: "Vienna's safe · JV bin overnight" } },
};
export const auditScopeFor = (u?: User | null): AuditScope => (!u ? 'full' : u.id === 'u-mm' ? 'wm' : u.id === 'u-jv' ? 'band' : 'full');
export async function getAuditLocations(scope: AuditScope = 'full'): Promise<AuditLocationStatus[]> {
  const sc = scope === 'full' ? null : AUDIT_SCOPES[scope];
  return resolve((sc ? sc.keys.map((k) => ({ ...auditLoc(k), label: sc.relabel[k] ?? auditLoc(k).label })) : fx.AUDIT_LOCATIONS).map((location) => { const last = auditStore.sessions.filter((a) => a.location === location.key).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]; const daysSince = last ? Math.floor((Date.now() - new Date(last.finishedAt).getTime()) / 86_400_000) : undefined; return { location, expected: expectedAt(location.key).length, lastAudited: last?.finishedAt, lastResult: last ? (last.missing.length ? 'missing' : 'clean') : undefined, stale: daysSince === undefined || daysSince > auditStore.staleDays, daysSince }; }));
}
export const getAuditStaleDays = () => auditStore.staleDays;
export async function setAuditStaleDays(n: number): Promise<number> { if (!Number.isFinite(n) || n < 1 || n > 90) throw new Error('Pick 1–90 days'); auditStore.staleDays = Math.round(n); appendAudit({ type: 'setup', stationName: actor().station, userShortName: actor().user?.shortName, detail: `Audit stale threshold → ${auditStore.staleDays} days` }); return resolve(auditStore.staleDays); }
export const getAuditLive = (): AuditLive | null => auditStore.live;
export async function startAudit(k: AuditLocationKey): Promise<AuditLive> {
  auditStore.live = { location: auditLoc(k), startedAt: new Date().toISOString(), expected: expectedAt(k), matched: [], unexpected: [], scans: [] };
  appendAudit({ type: 'job', stationName: actor().station, userShortName: actor().user?.shortName, detail: `Audit started · ${auditLoc(k).label} · ${auditStore.live.expected.length} expected` });
  return resolve(auditStore.live);
}
export async function cancelAudit(): Promise<void> { auditStore.live = null; return resolve(undefined); }
// One label per scan; `|B` / BAND- picks the bracelet, otherwise the head (or the case when there is no head). Match against belief, never against the floor map alone.
export async function auditScan(code: string): Promise<{ live: AuditLive; result: AuditScanResult; item?: AuditItem }> {
  const live = auditStore.live; if (!live) throw new Error('Start an audit first');
  const bandOnly = /\|B$|^BAND-/i.test(code.trim()); const clean = code.trim().replace(/^BAND-/i, '').split('|')[0];
  const j = store.jobs.find((x) => x.number === clean.toUpperCase()) ?? (await findJobByLabel(clean)); const at = new Date().toISOString();
  const push = (result: AuditScanResult, label: string, item?: AuditItem) => { live.scans.unshift({ code, at, result, label }); return resolve({ live, result, item }); };
  if (!j) return push('unknown', `No job matches ${code}`);
  const row = getJobRow(j.id); const comps = ensureParts(row); const c = bandOnly ? comps.find((x) => x.key === 'band') : live.location.lane === 'band' ? comps.find((x) => x.key === 'band') ?? comps.find((x) => x.key === 'case') : comps.find((x) => x.key === 'head') ?? comps.find((x) => x.key === 'case') ?? comps[0];
  if (!c) return push('unknown', `${row.number} has no ${bandOnly ? 'bracelet' : 'matching'} part`);
  const item = auditItemOf(row, c);
  if (live.matched.includes(item.id) || live.unexpected.some((u) => u.id === item.id)) return push('duplicate', `${item.jobNumber} · ${item.partLabel} already scanned`, item);
  if (live.expected.some((e) => e.id === item.id)) { live.matched.push(item.id); return push('matched', `${item.jobNumber} · ${item.partLabel} ✓`, item); }
  const believedAt = believedLocation(row, c); live.unexpected.push({ ...item, believedAt, believedLabel: auditLoc(believedAt)?.label ?? believedAt });
  return push('unexpected', `${item.jobNumber} · ${item.partLabel} — system says ${auditLoc(believedAt)?.label ?? believedAt}`, item);
}
export async function auditResolve(itemId: string, resolution: AuditResolution): Promise<AuditLive> {
  const live = auditStore.live; if (!live) throw new Error('No audit running'); const u = live.unexpected.find((x) => x.id === itemId); if (!u) throw new Error('Not an unexpected item');
  if (resolution === 'corrected') {
    if (live.location.group === 'bin') throw new Error(`${live.location.label} is derived from job state — investigate instead of correcting`);
    const { j, c } = partOf(u.jobId, u.key); const to = live.location.key as RwStationKey;
    if (stationOf(to).lane !== 'shared' && stationOf(to).lane !== laneOfPart(c.key)) throw new Error(`${PART_LABEL[c.key]} cannot live in a ${stationOf(to).lane}-lane station — investigate`);
    recordMove(j, c, to, statusForStation(to, c.partStatus ?? 'in_progress'), 'audit_correction', `audit at ${live.location.label} · was ${u.believedLabel}`);
  }
  u.resolution = resolution; return resolve(live);
}
export async function finishAudit(): Promise<AuditSession> {
  const live = auditStore.live; if (!live) throw new Error('No audit running'); const a = actor();
  const missing = live.expected.filter((e) => !live.matched.includes(e.id));
  const session: AuditSession = { id: newId('aud'), location: live.location.key, locationLabel: live.location.label, by: a.by, station: a.station, startedAt: live.startedAt, finishedAt: new Date().toISOString(), expectedCount: live.expected.length, matched: live.matched.length, missing, unexpected: live.unexpected.map((u) => ({ ...u, resolution: u.resolution ?? 'investigate' })) };
  if (missing.length) { const first = missing[0]; const pin = { id: newId('pin'), title: `Audit · ${live.location.label}: ${missing.length} MISSING — ${first.jobNumber} ${first.watchLabel} (${first.partLabel.toLowerCase()})${missing.length > 1 ? ` +${missing.length - 1} more` : ''}${first.lastCustody ? ` · last seen ${first.lastCustody.by}` : ''}`, assignedTo: { type: 'role' as const, role: 'manager' as Role }, createdBy: a.by, jobId: first.jobId, createdAt: session.finishedAt, station: a.station, division: getSessionDivision() }; store.pinned.unshift(pin); session.pinId = pin.id; }
  auditStore.sessions.unshift(session); auditStore.live = null;
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Audit finished · ${live.location.label} · ${session.matched}/${session.expectedCount} matched · ${missing.length} missing · ${session.unexpected.length} unexpected (${session.unexpected.filter((u) => u.resolution === 'corrected').length} corrected)` });
  return resolve(session);
}
export async function getAuditSessions(): Promise<AuditSession[]> { return resolve([...auditStore.sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))); }


// ---- Work grading gate — categories from a Setup lookup; grades are append-only events attributed to job + responsible tech ----------------------
import type { GradeCategory, GradeGate, GradeGateRow, GradeScope, GradeScore, TechQuality, WorkGrade } from './types';
const wg = { categories: fx.gradeCategories.map((c): GradeCategory => ({ ...c, scopes: [...c.scopes] })), grades: fx.gradeSeeds.map((g): WorkGrade => ({ ...g })) };
export async function getGradeCategories(): Promise<GradeCategory[]> { return resolve([...wg.categories]); }
export async function addGradeCategory(label: string, hint: string, scopes: GradeScope[]): Promise<GradeCategory> {
  const a = actor(); if (a.user?.accessTier !== 'manager') throw new Error('Managers add grading categories'); if (!label.trim()) throw new Error('Name the category'); if (!scopes.length) throw new Error('Pick what it applies to');
  const c: GradeCategory = { id: newId('gc'), key: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: label.trim(), hint: hint.trim(), scopes, active: true, createdBy: a.by, createdAt: new Date().toISOString() };
  wg.categories.push(c); appendAudit({ type: 'setup', stationName: a.station, userShortName: a.user?.shortName, detail: `Grading category added · ${c.label} · ${scopes.join('/')}` }); return resolve(c);
}
export async function toggleGradeCategory(id: string): Promise<GradeCategory> { const c = wg.categories.find((x) => x.id === id); if (!c) throw new Error('No such category'); c.active = !c.active; appendAudit({ type: 'setup', stationName: actor().station, userShortName: actor().user?.shortName, detail: `Grading category ${c.active ? 'enabled' : 'disabled'} · ${c.label}` }); return resolve(c); }
const SCOPE_OF: Record<ComponentKey, GradeScope> = { head: 'head', case: 'case', band: 'bracelet' };
const categoryApplies = (c: GradeCategory, j: Job) => c.active && (c.scopes.includes('whole') || ensureComponents(j).some((k) => c.scopes.includes(SCOPE_OF[k.key])));
// Responsible tech resolves from the component completion events: head → watchmaker credited on the movement; case/bracelet → whoever did the case/polish work
const responsibleTech = (c: GradeCategory, j: Job): string => {
  const comps = ensureComponents(j); const by = (k: ComponentKey) => { const x = comps.find((q) => q.key === k); return x?.completedBy ?? x?.custodyTech; };
  if (c.scopes.includes('case') || c.scopes.includes('bracelet')) return by('case') ?? by('band') ?? j.assignees.find((a) => a === 'Walter') ?? j.assignees[0] ?? '—';
  return by('head') ?? j.assignees.find((a) => fx.users.find((u) => u.shortName === a)?.roles.includes('watchmaker')) ?? j.assignees[0] ?? '—';
};
const gradesForCycle = (j: Job) => { const since = [...j.timeline].reverse().find((t) => t.to === 'testing')?.at ?? ''; return wg.grades.filter((g) => g.jobId === j.id && g.at >= since); };
export const gradeGateFor = (j: Job): GradeGate => {
  const techOptions = fx.users.filter((u) => u.division !== 'rollishop').map((u) => u.shortName);
  const rows: GradeGateRow[] = wg.categories.filter((c) => categoryApplies(c, j)).map((category) => ({ category, grade: [...gradesForCycle(j)].reverse().find((g) => g.categoryId === category.id), suggestedTech: responsibleTech(category, j), techOptions }));
  const missing = rows.filter((r) => !r.grade).map((r) => r.category.label); return { rows, missing, ready: rows.length > 0 && missing.length === 0 };
};
export async function getGradeGate(jobId: string): Promise<GradeGate> { return resolve(gradeGateFor(getJobRow(jobId))); }
export async function recordWorkGrade(jobId: string, categoryId: string, score: GradeScore, opts: { note?: string; photoUrl?: string; tech?: string } = {}): Promise<WorkGrade> {
  const j = getJobRow(jobId); const c = wg.categories.find((x) => x.id === categoryId); if (!c || !categoryApplies(c, j)) throw new Error('That category does not apply to this job'); if (![1, 2, 3, 4, 5].includes(score)) throw new Error('Score 1–5');
  if (score <= 3 && !opts.note?.trim() && !opts.photoUrl) throw new Error(`A grade of ${score} needs a short note or a photo — low grades carry their evidence`);
  const a = actor(); const auto = responsibleTech(c, j); const tech = opts.tech?.trim() || auto;
  const g: WorkGrade = { id: newId('wg'), jobId: j.id, jobNumber: j.number, categoryId: c.id, categoryLabel: c.label, score, note: opts.note?.trim() || undefined, photoUrl: opts.photoUrl, tech, techAuto: auto, grader: a.by, selfGraded: tech === a.by, at: new Date().toISOString(), station: a.station };
  wg.grades.push(g); jobStamp(j, `Work grade · ${c.label} ${score}/5 · tech ${tech}${tech !== auto ? ` (auto ${auto}, edited)` : ''} · by ${a.by}${g.selfGraded ? ' · SELF-GRADED' : ''}${g.note ? ` · ${g.note}` : ''}`);
  if (score <= 2) store.pinned.unshift({ id: newId('pin'), title: `Low work grade · ${j.number} ${c.label} ${score}/5 — ${tech}${g.note ? ` · “${g.note}”` : ''} · graded by ${a.by}`, assignedTo: { type: 'role', role: 'manager' }, createdBy: a.by, jobId: j.id, createdAt: g.at, station: a.station, division: j.division });
  return resolve(g);
}
export async function getWorkGrades(filter: { jobId?: string; tech?: string } = {}): Promise<WorkGrade[]> { return resolve(wg.grades.filter((g) => (!filter.jobId || g.jobId === filter.jobId) && (!filter.tech || g.tech === filter.tech)).sort((a, b) => b.at.localeCompare(a.at))); }
export const techQuality = (tech: string, month: string): TechQuality => {
  const gs = wg.grades.filter((g) => g.tech === tech && monthKey(g.at) === month); const byCategory: TechQuality['byCategory'] = {};
  gs.forEach((g) => { const b = (byCategory[g.categoryId] ??= { label: g.categoryLabel, avg: 0, n: 0 }); b.avg = (b.avg * b.n + g.score) / (b.n + 1); b.n += 1; });
  Object.values(byCategory).forEach((b) => { b.avg = Math.round(b.avg * 10) / 10; });
  return { n: gs.length, avg: gs.length ? Math.round((gs.reduce((t, g) => t + g.score, 0) / gs.length) * 10) / 10 : null, byCategory, low: gs.filter((g) => g.score <= 2).length, selfGraded: gs.filter((g) => g.selfGraded).length };
};


// ---- Client rating — Attitude / Communication staff-set (concierge+), completed jobs DERIVED; logged old→new. Internal only: no portal read function touches this. ----
import type { CallEvent, ClientRating, RatingChange, Star } from './types';
import type { DecisionInput, EngagementKind, InspectionDecisionRecord } from './types';
const ratings = { rows: new Map<string, { attitude?: Star; communication?: Star; history: RatingChange[] }>([
  ['c-30', { attitude: 5, communication: 3, history: [{ at: new Date(Date.now() - 40 * 86_400_000).toISOString(), by: 'Vienna', station: 'Front Desk 1', field: 'attitude', to: 5 }, { at: new Date(Date.now() - 40 * 86_400_000).toISOString(), by: 'Vienna', station: 'Front Desk 1', field: 'communication', to: 3 }] }],
  ['c-05', { attitude: 4, communication: 4, history: [{ at: new Date(Date.now() - 90 * 86_400_000).toISOString(), by: 'MH', station: 'Front Desk 1', field: 'attitude', to: 4 }, { at: new Date(Date.now() - 90 * 86_400_000).toISOString(), by: 'MH', station: 'Front Desk 1', field: 'communication', to: 4 }] }],
  ['c-10', { attitude: 2, communication: 4, history: [{ at: new Date(Date.now() - 12 * 86_400_000).toISOString(), by: 'Walter', station: 'Front Desk 2', field: 'attitude', from: 3, to: 2 }, { at: new Date(Date.now() - 60 * 86_400_000).toISOString(), by: 'Vienna', station: 'Front Desk 1', field: 'attitude', to: 3 }, { at: new Date(Date.now() - 60 * 86_400_000).toISOString(), by: 'Vienna', station: 'Front Desk 1', field: 'communication', to: 4 }] }],
]), calls: [] as CallEvent[] };
const completedJobsFor = (clientId: string) => store.jobs.filter((j) => j.clientId === clientId && (j.status === 'closed' || store.salesOrders.some((o) => o.jobId === j.id && (o.status === 'picked_up' || o.status === 'shipped')))).length;
// c = lifetime items sent to us = every job ever opened for the client (open or closed); "New" when nobody has rated and nothing was ever sent
const lifetimeItemsFor = (clientId: string) => store.jobs.filter((j) => j.clientId === clientId).length;
export const clientRatingSync = (clientId: string): ClientRating => {
  const r = ratings.rows.get(clientId); const completed = completedJobsFor(clientId); const items = lifetimeItemsFor(clientId); const a = r?.attitude; const c = r?.communication;
  const fresh = a === undefined && c === undefined && items === 0;
  return { clientId, attitude: a, communication: c, items, completed, badge: fresh ? 'New' : `${a ?? '–'}/${c ?? '–'}/${items}`, tooltip: fresh ? 'New client — not yet rated, nothing sent to us yet' : `Temperament ${a ?? 'unrated'} · Responsiveness ${c ?? 'unrated'} · ${items} item${items === 1 ? '' : 's'} sent to us (${completed} completed)`, history: [...(r?.history ?? [])].sort((x, y) => y.at.localeCompare(x.at)) };
};
export async function getClientRating(clientId: string): Promise<ClientRating> { return resolve(clientRatingSync(clientId)); }
export async function setClientRating(clientId: string, input: { attitude?: Star; communication?: Star }): Promise<ClientRating> {
  const a = actor(); if (!a.user) throw new Error('Sign in to rate a client'); byId(fx.clients, clientId);
  const r = ratings.rows.get(clientId) ?? { history: [] }; const now = new Date().toISOString();
  (['attitude', 'communication'] as const).forEach((f) => { const to = input[f]; if (to && to !== r[f]) { r.history.push({ at: now, by: a.by, station: a.station, field: f, from: r[f], to }); appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, detail: `Client rating · ${fullNameOf(byId(fx.clients, clientId))} · ${f} ${r[f] ?? '–'} → ${to}` }); r[f] = to; } });
  ratings.rows.set(clientId, r); return resolve(clientRatingSync(clientId));
}
// ---- Call ledger lives in ./calls.ts (Vonage mock: ring → live → ended / missed, dispositions, click-to-call). client.ts only owns the array + this bridge. ----
const isAfterHours = (iso: string) => { const h = new Date(iso).getHours(); const d = new Date(iso).getDay(); return h < 9 || h >= 18 || d === 0; };
export const callsBridge = {
  calls: () => ratings.calls, clients: () => fx.clients, jobs: () => store.jobs, estimates: () => store.estimates, outbox: () => store.outbox, messages: () => cx.messages, users: () => fx.users,
  actor: () => actor(), newId, fullNameOf, isAfterHours, isActiveJob, needsReply: (clientId: string) => clientNeedsReplyCount(clientId), rating: (clientId: string) => clientRatingSync(clientId), wbp: (clientId: string) => wbpForClientSync(clientId),
  threadEvent: (clientId: string, jobId: string | undefined, by: string, text: string) => { threadEvent(clientId, jobId ? { kind: 'job', id: jobId } : undefined, 'note', by, text, undefined); },
  audit: (detail: string) => { const a = actor(); appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail }); },
  jobStamp: (jobId: string, detail: string) => { const j = store.jobs.find((x) => x.id === jobId); if (j) jobStamp(j, detail); },
  addAddon: (jobId: string, input: AddonInput) => addJobAddon(jobId, input),
};
export const clientByIdSync = (id: string): Client | undefined => fx.clients.find((c) => c.id === id);
export const jobNumberSync = (id: string): string | undefined => store.jobs.find((j) => j.id === id)?.number;

// ---- INVENTORY DEEP SESSION — pricing intelligence · needs-ordering · auto-PO · PO labels · receiving flips · cycle-count lock/queue/variance $ ----
import type { CountQueueRow, NeedsOrderingRow, PartPricing, PriceColor, PurchaseHistoryRow, ReorderRule, VarianceReport, VarianceRow } from './types';
const dAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const H = (id: string, d: number, vendorId: string, partId: string, qty: number, unitPrice: number, po?: string): PurchaseHistoryRow => ({ id, at: dAgo(d), vendorId, partId, qty, unitPrice, poNumber: po });
// Imported purchase history (CSV in the prototype) — enough rows that averages are believable and all three price colours appear on a draft PO
const inv = {
  history: [
    H('ph-01', 320, 'v-rsc', 'pt-01', 4, 82, 'PO-25-0101'), H('ph-02', 240, 'v-rsc', 'pt-01', 4, 84, 'PO-25-0140'), H('ph-03', 120, 'v-rsc', 'pt-01', 2, 86, 'PO-26-0003'), H('ph-04', 60, 'v-tudor', 'pt-01', 2, 79, 'PO-26-0011'),
    H('ph-05', 300, 'v-rsc', 'pt-02', 6, 42, 'PO-25-0101'), H('ph-06', 150, 'v-rsc', 'pt-02', 6, 44, 'PO-26-0003'), H('ph-07', 45, 'v-gold', 'pt-02', 4, 51, 'PO-26-0014'),
    H('ph-08', 280, 'v-rsc', 'pt-03', 10, 6.5, 'PO-25-0110'), H('ph-09', 90, 'v-rsc', 'pt-03', 10, 7, 'PO-26-0006'), H('ph-10', 30, 'v-tudor', 'pt-03', 10, 5.4, 'PO-26-0019'),
    H('ph-11', 200, 'v-rsc', 'pt-04', 3, 260, 'PO-25-0128'), H('ph-12', 70, 'v-rsc', 'pt-04', 2, 275, 'PO-26-0009'),
    H('ph-13', 260, 'v-tudor', 'pt-05', 5, 31, 'PO-25-0115'), H('ph-14', 100, 'v-tudor', 'pt-05', 5, 33, 'PO-26-0005'), H('ph-15', 20, 'v-rsc', 'pt-05', 3, 39, 'PO-26-0021'),
    H('ph-16', 220, 'v-gold', 'pt-06', 20, 3.2, 'PO-25-0122'), H('ph-17', 80, 'v-gold', 'pt-06', 20, 3.4, 'PO-26-0008'),
    H('ph-18', 190, 'v-rsc', 'pt-07', 1, 640, 'PO-25-0130'), H('ph-19', 40, 'v-rsc', 'pt-08', 4, 58, 'PO-26-0016'), H('ph-20', 170, 'v-rsc', 'pt-08', 4, 55, 'PO-25-0135'),
    // Cousins UK — two lines priced >10% above our average → the auto-PO draft carries 2 red lines
    H('ph-c1', 150, 'v-rsc', 'pt-c2', 4, 28, 'PO-25-0138'), H('ph-c2', 35, 'v-cousins', 'pt-c2', 2, 34, 'PO-26-0022'), H('ph-c3', 120, 'v-rsc', 'pt-c5', 2, 38, 'PO-25-0140'), H('ph-c4', 30, 'v-cousins', 'pt-c5', 1, 48, 'PO-26-0022'),
    H('ph-c5', 40, 'v-cousins', 'pt-c6', 2, 42, 'PO-26-0022'), H('ph-c6', 40, 'v-cousins', 'pt-c8', 3, 15, 'PO-26-0022'),
  ] as PurchaseHistoryRow[],
  reorder: new Map<string, ReorderRule>([['pt-c1', { partId: 'pt-c1', min: 1, orderUpTo: 2 }], ['pt-c2', { partId: 'pt-c2', min: 2, orderUpTo: 4 }], ['pt-c3', { partId: 'pt-c3', min: 2, orderUpTo: 6 }], ['pt-c4', { partId: 'pt-c4', min: 1, orderUpTo: 2 }], ['pt-c5', { partId: 'pt-c5', min: 1, orderUpTo: 2 }], ['pt-c6', { partId: 'pt-c6', min: 1, orderUpTo: 2 }], ['pt-c7', { partId: 'pt-c7', min: 1, orderUpTo: 2 }], ['pt-c8', { partId: 'pt-c8', min: 2, orderUpTo: 4 }], ['pt-c9', { partId: 'pt-c9', min: 1, orderUpTo: 2 }], ['pt-11', { partId: 'pt-11', min: 6, orderUpTo: 20 }], ['pt-18', { partId: 'pt-18', min: 4, orderUpTo: 16 }], ['pt-07', { partId: 'pt-07', min: 2, orderUpTo: 6 }], ['pt-15', { partId: 'pt-15', min: 1, orderUpTo: 4 }], ['pt-13', { partId: 'pt-13', min: 1, orderUpTo: 2 }], ['pt-22', { partId: 'pt-22', min: 1, orderUpTo: 3 }], ['pt-16', { partId: 'pt-16', min: 2, orderUpTo: 4 }], ['pt-14', { partId: 'pt-14', min: 4, orderUpTo: 12 }], ['pt-01', { partId: 'pt-01', min: 3, orderUpTo: 8 }], ['pt-02', { partId: 'pt-02', min: 2, orderUpTo: 6 }], ['pt-03', { partId: 'pt-03', min: 4, orderUpTo: 12 }], ['pt-04', { partId: 'pt-04', min: 2, orderUpTo: 6 }], ['pt-05', { partId: 'pt-05', min: 3, orderUpTo: 6 }], ['pt-06', { partId: 'pt-06', min: 5, orderUpTo: 20 }], ['pt-07', { partId: 'pt-07', min: 1, orderUpTo: 2 }], ['pt-08', { partId: 'pt-08', min: 2, orderUpTo: 6 }], ['pt-09', { partId: 'pt-09', min: 1, orderUpTo: 3 }], ['pt-10', { partId: 'pt-10', min: 1, orderUpTo: 3 }], ['pt-11', { partId: 'pt-11', min: 2, orderUpTo: 4 }], ['pt-12', { partId: 'pt-12', min: 2, orderUpTo: 4 }], ['pt-13', { partId: 'pt-13', min: 1, orderUpTo: 2 }], ['pt-16', { partId: 'pt-16', min: 4, orderUpTo: 10 }], ['pt-17', { partId: 'pt-17', min: 2, orderUpTo: 4 }]]),
  // below-min rows date from when the part first dipped under min (seed: Tudor's lines have sat under the auto-PO threshold for 14 days)
  lowSince: new Map<string, string>([['pt-01', dAgo(14)], ['pt-03', dAgo(14)], ['pt-05', dAgo(16)]]),
  needs: [{ id: 'no-01', partId: 'pt-16', reason: 'pick_short', qty: 2, at: dAgo(1), jobNumber: 'E02016' }, { id: 'no-02', partId: 'pt-03', reason: 'out_of_stock', qty: 2, at: dAgo(0.5), requestId: 'pr-20', jobNumber: 'E02011' }] as { id: string; partId: string; reason: 'out_of_stock' | 'pick_short'; qty: number; at: string; requestId?: string; jobNumber?: string }[],
};
const onHandOf = (partId: string) => rs.stock.filter((x) => x.partId === partId).reduce((t, x) => t + x.onHand, 0);
const onOrderOf = (partId: string) => rs.pos.filter((p) => p.status === 'sent' || p.status === 'partially_received').reduce((t, p) => t + p.lines.filter((l) => l.partId === partId).reduce((q, l) => q + (l.qty - l.receivedQty), 0), 0);
export const partPricingSync = (partId: string): PartPricing => {
  // every price store is DOLLARS (history included) — same scale as Part.price and PO line unitCost
  const rows = inv.history.filter((h) => h.partId === partId).sort((a, b) => b.at.localeCompare(a.at)); const units = rows.reduce((t, r) => t + r.qty, 0);
  const avg = units ? Math.round((rows.reduce((t, r) => t + r.qty * r.unitPrice, 0) / units) * 100) / 100 : null; const last = rows[0];
  const byVendor = new Map<string, { lastPrice: number; lastAt: string; buys: number }>(); rows.forEach((r) => { const v = byVendor.get(r.vendorId); if (!v) byVendor.set(r.vendorId, { lastPrice: r.unitPrice, lastAt: r.at, buys: 1 }); else v.buys += 1; });
  return { partId, avgCost: avg, last: last ? { price: last.unitPrice, at: last.at, vendorId: last.vendorId, vendorName: byId(rs.vendors, last.vendorId).name } : undefined, vendors: [...byVendor.entries()].map(([vendorId, v]) => ({ vendorId, vendorName: byId(rs.vendors, vendorId).name, ...v })).sort((a, b) => a.lastPrice - b.lastPrice) };
};
export async function getPartPricing(partId: string): Promise<PartPricing> { return resolve(partPricingSync(partId)); }
// ±10% dead band: black within, green >10% below (good buy), red >10% above (needs a tap-to-acknowledge before send)
export const priceColor = (unit: number, avg: number | null): PriceColor => (avg === null || avg === 0 ? 'black' : unit < avg * 0.9 ? 'green' : unit > avg * 1.1 ? 'red' : 'black');
// ---- PARTS MODULE — one part record · one stock count · one reorder rule · one caliber table · one search ----
export const PART_CATEGORIES = ['Vintage Parts', 'Crystals', 'Crowns', 'Inserts', 'Mov-Parts', 'crystal gaskets', 'Bezels', 'Spring bar', 'Main Springs', 'Unique Resale'];
const LEGACY_CATEGORY: Record<string, string> = { crystal: 'Crystals', crown: 'Crowns', insert: 'Inserts', movement: 'Mov-Parts', gasket: 'crystal gaskets', bezel: 'Bezels', spring_bar: 'Spring bar', mainspring: 'Main Springs', vintage: 'Vintage Parts', resale: 'Unique Resale', tube: 'Crowns', bracelet: 'Unique Resale', hands: 'Mov-Parts', dial: 'Vintage Parts' };
export const canonicalCategory = (c: string): string => (PART_CATEGORIES.includes(c) ? c : LEGACY_CATEGORY[c] ?? (c.includes('spring') && !c.includes('bar') ? 'Main Springs' : c.includes('crystal') ? 'Crystals' : 'Mov-Parts'));
// Location = a manager's safe → a bin/drawer inside it (same safe concept as Assign/Move + Custody). No free text.
export const PART_SAFES: PartSafe[] = [{ id: 'safe-mm', name: "MM's safe", owner: 'MM', bins: ['A1', 'A2', 'A3', 'B1', 'B2'] }, { id: 'safe-vienna', name: "Vienna's safe", owner: 'Vienna', bins: ['P1', 'P2', 'P3'] }, { id: 'safe-jv', name: "JV's safe", owner: 'JV', bins: ['S1', 'S2'] }];
const calibers: Caliber[] = [
  { id: 'cal-3135', brand: 'Rolex', number: '3135', spec: 'Automatic · 31 jewels · 28,800 vph · 48 h · date' }, { id: 'cal-3235', brand: 'Rolex', number: '3235', spec: 'Automatic · Chronergy escapement · 70 h · date' }, { id: 'cal-3285', brand: 'Rolex', number: '3285', spec: 'Automatic · GMT · 70 h' },
  { id: 'cal-4130', brand: 'Rolex', number: '4130', spec: 'Automatic chronograph · column wheel · 72 h' }, { id: 'cal-2235', brand: 'Rolex', number: '2235', spec: 'Automatic · ladies · 31 jewels · date' }, { id: 'cal-mt5602', brand: 'Tudor', number: 'MT5602', spec: 'Automatic · silicon hairspring · 70 h' }, { id: 'cal-mt5612', brand: 'Tudor', number: 'MT5612', spec: 'Automatic · date · 70 h' }, { id: 'cal-1570', brand: 'Rolex', number: '1570', spec: 'Vintage automatic · 26 jewels · 19,800 vph (placeholder spec — reconcile)' },
];
const partLocationSeed: Record<string, [string, string]> = { 'pt-01': ['safe-mm', 'A1'], 'pt-02': ['safe-mm', 'A1'], 'pt-03': ['safe-mm', 'A2'], 'pt-04': ['safe-mm', 'A2'], 'pt-05': ['safe-vienna', 'P1'], 'pt-06': ['safe-vienna', 'P1'], 'pt-07': ['safe-vienna', 'P2'], 'pt-08': ['safe-vienna', 'P2'], 'pt-09': ['safe-mm', 'B1'], 'pt-10': ['safe-mm', 'B1'], 'pt-11': ['safe-jv', 'S1'], 'pt-12': ['safe-jv', 'S1'] };
let partsModuleReady = false;
const ensurePartsModule = () => { if (partsModuleReady) return; partsModuleReady = true; store.parts.forEach((p, i) => { p.category = canonicalCategory(p.category); p.cost ??= Math.round(p.price * 0.55); p.vendorIds ??= [rs.vendors[i % rs.vendors.length]?.id].filter(Boolean) as string[]; const loc = partLocationSeed[p.id] ?? [PART_SAFES[i % 3].id, PART_SAFES[i % 3].bins[i % PART_SAFES[i % 3].bins.length]]; p.safeId ??= loc[0]; p.bin ??= loc[1]; p.location = `${byIdSafe(p.safeId).name} → ${p.bin}`; });
  // seed a few parts right at their trigger so reorder has something real
  [['pt-03', 2, 5], ['pt-07', 1, 4], ['pt-11', 3, 6]].forEach(([id, min, up]) => { if (!store.parts.some((p) => p.id === id)) return; inv.reorder.set(id as string, { partId: id as string, min: min as number, orderUpTo: up as number }); const total = onHandOf(id as string); const loc = rs.stock.find((x) => x.partId === id); if (loc) loc.onHand = Math.max(0, loc.onHand - (total - (min as number))); }); };
const byIdSafe = (id?: string): PartSafe => PART_SAFES.find((s) => s.id === id) ?? PART_SAFES[0];
const partRow = (p: Part): PartRow => { const r = getReorderRule(p.id); const onHand = onHandOf(p.id); const onOrder = onOrderOf(p.id); const flagged = r.min > 0 && onHand + onOrder <= r.min; return { part: p, onHand, onOrder, min: r.min, orderUpTo: r.orderUpTo, reorderQty: flagged ? Math.max(0, r.orderUpTo - onHand - onOrder) : 0, flagged, location: `${byIdSafe(p.safeId).name} → ${p.bin ?? '—'}`, vendors: (p.vendorIds ?? []).map((v) => rs.vendors.find((x) => x.id === v)?.name ?? v), caliberRows: calibers.filter((c) => p.calibers.includes(c.number)) }; };
// THE search — part#, description, aliases, category, caliber. Every other parts search in the app routes here.
export const searchPartsSync = (q: string, limit = 25): Part[] => { ensurePartsModule(); const n = q.trim().toLowerCase(); if (!n) return store.parts.slice(0, limit); const score = (p: Part) => (p.partNumber.toLowerCase().startsWith(n) ? 0 : p.partNumber.toLowerCase().includes(n) ? 1 : p.name.toLowerCase().includes(n) ? 2 : p.aliases.some((a) => a.toLowerCase().includes(n)) ? 3 : p.category.toLowerCase().includes(n) ? 4 : p.calibers.some((c) => c.toLowerCase().includes(n)) || p.compatibleRefs.some((r) => r.toLowerCase().includes(n)) ? 5 : -1); return store.parts.map((p) => [p, score(p)] as const).filter(([, sc]) => sc >= 0).sort((a, b) => a[1] - b[1]).slice(0, limit).map(([p]) => p); };
export async function searchParts(q: string, limit = 25): Promise<PartRow[]> { return resolve(searchPartsSync(q, limit).map(partRow)); }
export async function getPartsModule(): Promise<{ parts: PartRow[]; calibers: Caliber[]; categories: string[]; safes: PartSafe[]; vendors: Vendor[] }> { ensurePartsModule(); return resolve({ parts: store.parts.map(partRow).sort((a, b) => a.part.partNumber.localeCompare(b.part.partNumber)), calibers: [...calibers].sort((a, b) => a.brand.localeCompare(b.brand) || a.number.localeCompare(b.number)), categories: PART_CATEGORIES, safes: PART_SAFES, vendors: [...rs.vendors] }); }
export async function getCalibers(): Promise<Caliber[]> { return resolve([...calibers]); }
export async function saveCaliber(input: Omit<Caliber, 'id'> & { id?: string }): Promise<Caliber> { if (!input.brand.trim() || !input.number.trim()) throw new Error('Brand and caliber # are required'); const ex = input.id ? calibers.find((c) => c.id === input.id) : calibers.find((c) => c.number.toLowerCase() === input.number.trim().toLowerCase()); if (ex) { Object.assign(ex, { brand: input.brand.trim(), number: input.number.trim(), spec: input.spec.trim(), notes: input.notes }); return resolve(ex); } const c: Caliber = { id: newId('cal'), brand: input.brand.trim(), number: input.number.trim(), spec: input.spec.trim(), notes: input.notes }; calibers.push(c); return resolve(c); }
// Create or edit the ONE part record. Reorder rule + stock go through the canonical stores (inv.reorder / rs.stock), never duplicated.
export async function savePart(input: PartInput): Promise<PartRow> {
  ensurePartsModule(); const a = actor(); const pn = input.partNumber.trim(); if (!pn || !input.name.trim()) throw new Error('Part # and description are required'); if (!PART_CATEGORIES.includes(input.category)) throw new Error('Pick a category from the list'); if (input.min < 0 || input.orderUpTo < input.min) throw new Error('Order-up-to must be ≥ low-qty trigger');
  const dup = store.parts.find((p) => p.partNumber.toLowerCase() === pn.toLowerCase() && p.id !== input.id); if (dup) throw new Error(`${pn} already exists (${dup.name})`);
  const safe = byIdSafe(input.safeId); const bin = input.bin && safe.bins.includes(input.bin) ? input.bin : safe.bins[0]; const now = new Date().toISOString();
  let p = input.id ? store.parts.find((x) => x.id === input.id) : undefined;
  if (p) { Object.assign(p, { partNumber: pn, name: input.name.trim(), category: input.category, calibers: input.calibers, compatibleRefs: input.compatibleRefs ?? p.compatibleRefs, aliases: input.aliases ?? p.aliases, price: input.price, cost: input.cost, vendorIds: input.vendorIds ?? p.vendorIds, safeId: safe.id, bin, location: `${safe.name} → ${bin}`, updatedAt: now }); rsStamp('inventory', `${pn} edited · ${a.by}`); }
  else { p = { id: newId('pt'), partNumber: pn, name: input.name.trim(), category: input.category, calibers: input.calibers, compatibleRefs: input.compatibleRefs ?? [], aliases: input.aliases ?? [], price: input.price, stock: input.initialOnHand ?? 0, cost: input.cost, vendorIds: input.vendorIds ?? [], safeId: safe.id, bin, location: `${safe.name} → ${bin}`, createdAt: now, createdBy: a.by }; store.parts.push(p); if (input.initialOnHand) { const loc = rs.locations.find((l) => l.kind === 'safe') ?? rs.locations[0]; const st = stockAt(p.id, loc.id); st.onHand = input.initialOnHand; } rsStamp('inventory', `${pn} created · ${p.name} · ${a.by}`); }
  inv.reorder.set(p.id, { partId: p.id, min: input.min, orderUpTo: input.orderUpTo }); p.stock = onHandOf(p.id);
  return resolve(partRow(p));
}
export const getReorderRule = (partId: string): ReorderRule => inv.reorder.get(partId) ?? { partId, min: 0, orderUpTo: 0 };
export async function setReorderRule(partId: string, min: number, orderUpTo: number): Promise<ReorderRule> { if (min < 0 || orderUpTo < min) throw new Error('order-up-to must be ≥ min'); const r = { partId, min, orderUpTo }; inv.reorder.set(partId, r); rsStamp('inventory', `Reorder rule · ${byId(store.parts, partId).partNumber} · min ${min} / up to ${orderUpTo}`); autoPoSweepSync(); return resolve(r); }
export async function queueNeedsOrdering(partId: string, reason: 'out_of_stock' | 'pick_short', qty: number, ctx: { requestId?: string; jobNumber?: string } = {}): Promise<void> { if (!inv.needs.some((n) => n.partId === partId && n.requestId === ctx.requestId && n.reason === reason)) inv.needs.unshift({ id: newId('no'), partId, reason, qty, at: new Date().toISOString(), ...ctx }); autoPoSweepSync(); return resolve(undefined); }
const needsOrderingSync = (): NeedsOrderingRow[] => {
  const rows: NeedsOrderingRow[] = inv.needs.map((n) => ({ ...n, part: byId(store.parts, n.partId), onHand: onHandOf(n.partId), onOrder: onOrderOf(n.partId), vendorHint: preferredVendorOf(n.partId)?.name }));
  inv.reorder.forEach((r) => { const oh = onHandOf(r.partId); if (r.min > 0 && oh + onOrderOf(r.partId) < r.min && !rows.some((x) => x.partId === r.partId)) rows.push({ id: `low-${r.partId}`, partId: r.partId, part: byId(store.parts, r.partId), reason: 'below_min', qty: r.orderUpTo - oh - onOrderOf(r.partId), onHand: oh, onOrder: onOrderOf(r.partId), at: inv.lowSince.get(r.partId) ?? new Date().toISOString(), vendorHint: preferredVendorOf(r.partId)?.name }); });
  return rows;
};
export async function getNeedsOrdering(): Promise<NeedsOrderingRow[]> { return resolve(needsOrderingSync()); }
// Preferred vendor for a needs row: the part's own vendor, else the vendor we last bought it from
const preferredVendorOf = (partId: string): Vendor | undefined => { const p = byId(store.parts, partId); const id = p.vendorIds?.[0] ?? partPricingSync(partId).last?.vendorId ?? partPricingSync(partId).vendors[0]?.vendorId; return id ? rs.vendors.find((v) => v.id === id && v.active) : undefined; };
// Auto-PO per vendor: every part below min (+ the needs-ordering queue) → qty = order-up-to − (on-hand + on-order), priced at the vendor's last price (else avg)
export async function generatePurchaseOrder(vendorId: string, locationId = 'loc-a1'): Promise<PurchaseOrderWithRefs> {
  const needs = await getNeedsOrdering(); const v = byId(rs.vendors, vendorId);
  const lines = needs.map((n) => { const pr = partPricingSync(n.partId); const vend = pr.vendors.find((x) => x.vendorId === vendorId); const rule = getReorderRule(n.partId); const qty = Math.max(n.qty, rule.orderUpTo ? rule.orderUpTo - n.onHand - n.onOrder : 0, 1); return { partId: n.partId, qty, unitCost: vend?.lastPrice ?? pr.avgCost ?? byId(store.parts, n.partId).price, requestId: n.requestId, avg: pr.avgCost }; }).filter((l, i, arr) => arr.findIndex((x) => x.partId === l.partId) === i);
  if (!lines.length) throw new Error('Nothing needs ordering right now');
  const po = await createPurchaseOrder({ vendorId, locationId, lines: lines.map((l) => ({ partId: l.partId, qty: l.qty, unitCost: l.unitCost })), memo: `Generated · ${needs.length} needs-ordering rows` });
  const raw = byId(rs.pos, po.id); raw.lines.forEach((l, i) => { l.requestId = lines[i].requestId; l.avgAtOrder = lines[i].avg; });
  rsStamp('purchasing', `${po.number} generated for ${v.name} from the needs-ordering queue`); return resolve(poRefs(raw));
}
export const poRedLines = (p: PurchaseOrder) => p.lines.filter((l) => priceColor(l.unitCost, l.avgAtOrder ?? partPricingSync(l.partId).avgCost) === 'red');
export async function acknowledgeRedLines(id: string): Promise<PurchaseOrderWithRefs> { const p = byId(rs.pos, id); p.redAcknowledgedBy = actor().by; rsStamp('purchasing', `${p.number} · ${poRedLines(p).length} above-average line(s) acknowledged by ${p.redAcknowledgedBy}`); return resolve(poRefs(p)); }
// Generate label from the PO (Parcel Pro adapter, vendor as recipient, declared value = PO total) — or upload one bought elsewhere
export async function generatePoLabel(id: string, service = 'UPS 2nd Day Air'): Promise<PurchaseOrderWithRefs> {
  const p = byId(rs.pos, id); const v = byId(rs.vendors, p.vendorId);
  const lbl = await parcelpro.createLabel({ estimateNumber: p.number, recipient: { name: v.name, street: `${v.contact} · ${v.name} receiving`, city: 'New York', state: 'NY', zip: '10001' }, declaredValue: p.total, carrier: service.startsWith('FedEx') ? 'FedEx' : 'UPS' });
  p.labelUrl = lbl.labelUrl; p.trackingNumber = lbl.trackingNumber; p.labelService = service; p.labelSource = 'parcelpro'; rsStamp('purchasing', `${p.number} · label generated (${service}) · ${lbl.trackingNumber} · insured ${fmtMoney(p.total)}`); return resolve(poRefs(p));
}
export async function uploadPoLabel(id: string, dataUrl: string): Promise<PurchaseOrderWithRefs> { const p = byId(rs.pos, id); p.labelUrl = dataUrl; p.labelSource = 'upload'; p.labelService = 'uploaded label'; rsStamp('purchasing', `${p.number} · shipping label uploaded`); return resolve(poRefs(p)); }
export async function importPurchaseCsv(text: string): Promise<{ vendors: number; rows: number }> {
  let vendors = 0, rows = 0;
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => { const c = line.split(',').map((x) => x.trim()); if (c[0].toLowerCase() === 'vendor' && c.length >= 3) { if (!rs.vendors.some((v) => v.name.toLowerCase() === c[1].toLowerCase())) { rs.vendors.push({ id: newId('v'), name: c[1], contact: c[2] ?? '', email: c[3] ?? '', phone: c[4] ?? '', terms: c[5] ?? 'Net 30', division: 'rolliworks', active: true, createdVia: 'csv_import' }); vendors += 1; } }
    else if (c.length >= 5 && /^\d{4}-\d{2}-\d{2}/.test(c[0])) { const v = rs.vendors.find((x) => x.name.toLowerCase() === c[1].toLowerCase()); const pt = store.parts.find((x) => x.partNumber.toLowerCase() === c[2].toLowerCase()); if (v && pt) { inv.history.push({ id: newId('ph'), at: new Date(c[0]).toISOString(), vendorId: v.id, partId: pt.id, qty: Number(c[3]) || 1, unitPrice: Number(c[4]) || 0 }); rows += 1; } } });
  rsStamp('purchasing', `CSV import · ${vendors} vendor(s) · ${rows} purchase-history row(s)`); return resolve({ vendors, rows });
}
export const vendorOpenPos = (vendorId: string) => rs.pos.filter((p) => p.vendorId === vendorId && (p.status === 'sent' || p.status === 'partially_received')).length;
export const vendorHistory = (vendorId: string) => inv.history.filter((h) => h.vendorId === vendorId).sort((a, b) => b.at.localeCompare(a.at));
// ---- Cycle count: location barcodes (LOC-A1), lock, count-next queue, variance $ (manager only) ----
export const locationBarcode = (loc: StockLocation) => `LOC-${loc.id.replace(/^loc-/, '').toUpperCase()}`;
export const CYCLE_STALE_DAYS = 30;
export async function getCountQueue(): Promise<CountQueueRow[]> {
  return resolve(rs.locations.map((location) => { const last = rs.counts.filter((c) => c.locationId === location.id && c.status === 'posted').sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''))[0]; const daysSince = last?.postedAt ? Math.floor((Date.now() - new Date(last.postedAt).getTime()) / 86_400_000) : undefined; return { location, barcode: locationBarcode(location), parts: rs.stock.filter((s) => s.locationId === location.id).length, lastCounted: last?.postedAt, daysSince, overdue: daysSince === undefined || daysSince > CYCLE_STALE_DAYS }; }).sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999)));
}
export const resolveLocationScan = (code: string): StockLocation | undefined => rs.locations.find((l) => locationBarcode(l) === code.trim().toUpperCase() || l.id === code.trim().toLowerCase());
export const resolvePartScan = (code: string): Part | undefined => { const q = code.trim().toLowerCase(); return store.parts.find((p) => p.partNumber.toLowerCase() === q || p.aliases.some((a) => a.toLowerCase() === q) || p.id === q); };
// Post with scan-loop semantics: counted[partId] = actual; skipped = leave on file untouched; parts scanned that were not on file are added at expected 0
export async function postCycleCountV2(id: string, counted: Record<string, number>, skipped: string[] = []): Promise<CycleCount> {
  const c = byId(rs.counts, id); if (c.status !== 'open') throw new Error('Count already posted'); const a = actor(); const loc = byId(rs.locations, c.locationId);
  Object.keys(counted).forEach((pid) => { if (!c.lines.some((l) => l.partId === pid)) c.lines.push({ partId: pid, expected: 0 }); });
  c.lines.forEach((l) => { if (skipped.includes(l.partId)) { l.skipped = true; return; } l.counted = counted[l.partId] ?? 0; l.unitCost = partPricingSync(l.partId).avgCost ?? byId(store.parts, l.partId).price; });
  c.variances = 0; let dollars = 0;
  c.lines.filter((l) => !l.skipped).forEach((l) => { const d = (l.counted ?? 0) - l.expected; if (d !== 0) { c.variances += 1; dollars += d * (l.unitCost ?? 0); move('count', l.partId, c.locationId, d, `Cycle count ${c.number} variance ${d > 0 ? '+' : ''}${d}`, { ref: c.number, countId: c.id }); } });
  c.status = 'posted'; c.postedAt = new Date().toISOString(); c.postedBy = a.by;
  c.gainLoss = Math.round(dollars * 100) / 100; // plain gain/loss report for the session — no threshold, no gate, no hit-list pin
  rsStamp('inventory', `${c.number} posted · ${loc.name} · ${c.variances} variance(s) · ${dollars < 0 ? '−' : '+'}${fmtMoney(Math.abs(dollars))}`); autoPoSweepSync(); return resolve({ ...c });
}
export async function getVarianceReport(f: { from?: string; to?: string; locationId?: string; partId?: string; counter?: string } = {}): Promise<VarianceReport> {
  if (currentUserSync()?.accessTier !== 'manager') throw new Error('Variance dollars are manager-only');
  const rows: VarianceRow[] = rs.counts.filter((c) => c.status === 'posted' && (!f.locationId || c.locationId === f.locationId) && (!f.counter || c.postedBy === f.counter) && (!f.from || (c.postedAt ?? '') >= f.from) && (!f.to || (c.postedAt ?? '') <= `${f.to}T23:59:59`)).flatMap((c) => c.lines.filter((l) => !l.skipped && l.counted !== undefined && l.counted !== l.expected && (!f.partId || l.partId === f.partId)).map((l) => { const pt = byId(store.parts, l.partId); const unit = l.unitCost ?? partPricingSync(l.partId).avgCost ?? pt.price; const q = (l.counted ?? 0) - l.expected; return { countId: c.id, countNumber: c.number, at: c.postedAt ?? c.at, by: c.postedBy ?? c.by, location: byId(rs.locations, c.locationId).name, partId: l.partId, partNumber: pt.partNumber, expected: l.expected, counted: l.counted ?? 0, qtyVariance: q, unitCost: unit, dollarVariance: Math.round(q * unit * 100) / 100 }; }));
  const dollars = rows.reduce((t, r) => t + r.dollarVariance, 0);
  return resolve({ rows: rows.sort((a, b) => b.at.localeCompare(a.at)), totals: { qty: rows.reduce((t, r) => t + r.qtyVariance, 0), dollars: Math.round(dollars * 100) / 100, shrink: Math.round(rows.filter((r) => r.dollarVariance < 0).reduce((t, r) => t + r.dollarVariance, 0) * 100) / 100, overage: Math.round(rows.filter((r) => r.dollarVariance > 0).reduce((t, r) => t + r.dollarVariance, 0) * 100) / 100 } });
}

replayRcEvents();

// ---- Watch Records link on the sales order (print QR + invoice email). One tokened portal deep link per SO, reused so the printed QR and the email agree. ----
const soRecordsLinks: Record<string, string> = {};
export const soRecordsLink = (o: SalesOrder): string => {
  if (!soRecordsLinks[o.id]) { const job = o.jobId ? store.jobs.find((j) => j.id === o.jobId) : undefined; const next = job?.watchId ? `/rc/watches/${job.watchId}` : `/rc/invoices/${o.id}`; soRecordsLinks[o.id] = portalDeepLink(o.clientId, next); }
  return soRecordsLinks[o.id];
};
export const soRecordsLinkFor = (id: string): string => soRecordsLink(getSO(id));

// ---- Create estimate from a request (Q6 auto-quote rule): request → quoted, estimate carries requestId, thread shows the estimate chip ----
const linkedEstimateFor = (a?: ConversationAnchor) => { if (a?.kind !== 'request') return undefined; const r = store.requests.find((x) => x.id === a.id); const e = r?.estimateId ? store.estimates.find((x) => x.id === r.estimateId) : undefined; return e ? { id: e.id, number: e.number, status: e.status } : undefined; };
const linkEstimateToRequest = (e: Estimate, requestId: string) => {
  const r = store.requests.find((x) => x.id === requestId); if (!r) return;
  r.estimateId = e.id; if (r.status === 'new') r.status = 'quoted'; e.requestId = r.id;
  estStamp(e, `Created from request ${r.number}`);
  const conv = cx.conversations.find((c) => c.anchor?.kind === 'request' && c.anchor.id === r.id);
  if (conv) { const a = actor(); pushConv(conv, { direction: 'internal', source: 'staff', by: a.by, station: a.station, text: `Estimate ${e.number} created from this request · ${fmtMoney(e.total)} · reply with the quote when ready`, at: new Date().toISOString() }); }
};
export interface RequestPrefill { request: ServiceRequest; client: Client; watch?: Watch; description: string; existingEstimate?: Estimate }
export async function getRequestPrefill(requestId: string): Promise<RequestPrefill> {
  const r = byId(store.requests, requestId); const client = byId(fx.clients, r.clientId); const watch = store.watches.find((w) => w.id === r.watchId);
  const msg = cx.messages.filter((m) => m.direction === 'in' && cx.conversations.some((c) => c.id === m.conversationId && c.anchor?.kind === 'request' && c.anchor.id === r.id)).sort((a, b) => a.at.localeCompare(b.at))[0];
  const text = (msg?.text ?? r.summary).replace(/^Web request RQ-\d+-\d+:\s*/i, '');
  return resolve({ request: { ...r }, client, watch, description: text.length > 90 ? `${text.slice(0, 87).trim()}…` : text, existingEstimate: r.estimateId ? store.estimates.find((e) => e.id === r.estimateId) : undefined });
}

// ---- Legacy archive records: read-only display; manager "Convert to editable" duplicates into a native record, original untouched ----
export async function convertLegacy(kind: 'estimate' | 'sales_order', id: string): Promise<{ id: string; number: string }> {
  const a = managerOnly();
  if (kind === 'estimate') {
    const src = getEst(id); if (!src.legacy) throw new Error('Not a legacy record'); if (src.legacy.convertedToId) throw new Error(`Already converted → ${store.estimates.find((e) => e.id === src.legacy!.convertedToId)?.number}`);
    const e: Estimate = { ...src, id: `e-${Date.now().toString(36)}`, number: nextEstimateNumber(), revision: 1, revisions: [], status: 'draft', historical: false, legacy: undefined, convertedFromLegacy: { id: src.id, number: src.legacy.number }, lines: src.lines.map((l) => ({ ...l, id: newLineId() })), internalNotes: `Converted from legacy ${src.legacy.number}${src.internalNotes ? `\n${src.internalNotes}` : ''}`, createdAt: new Date().toISOString(), createdBy: a.by, updatedAt: new Date().toISOString(), sentAt: undefined, approvedAt: undefined, declinedAt: undefined, convertedAt: undefined, jobId: undefined, engagement: [], supersededById: undefined };
    recalc(e); store.estimates.unshift(e); src.legacy.convertedToId = e.id;
    estStamp(e, `Converted from legacy ${src.legacy.number} by ${a.by} · original kept read-only`);
    appendAudit({ type: 'estimate', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Legacy ${src.legacy.number} → ${e.number} (converted to editable)` });
    return resolve({ id: e.id, number: e.number });
  }
  const src = getSO(id); if (!src.legacy) throw new Error('Not a legacy record'); if (src.legacy.convertedToId) throw new Error(`Already converted → ${store.salesOrders.find((o) => o.id === src.legacy!.convertedToId)?.number}`);
  const o: SalesOrder = { ...src, id: `so-${Date.now().toString(36)}`, number: nextSONumber(), status: 'draft', legacy: undefined, convertedFromLegacy: { id: src.id, number: src.legacy.number }, lines: src.lines.map((l) => ({ ...l, id: `sol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, pickedUpQty: 0, shippedQty: 0 })), payments: [], invoiceSends: [], invoiceSentAt: undefined, payLinkToken: `pl-${Date.now().toString(36)}`, memo: `Converted from legacy ${src.legacy.number}${src.memo ? ` · ${src.memo}` : ''}`, orderDate: new Date().toISOString(), fulfilledAt: undefined, pickedUpAt: undefined, shipDate: undefined, pickupCode: undefined, pickupCodeIssuedAt: undefined, pickupSession: undefined, shipment: undefined, qboInvoiceId: undefined, qboStatus: 'not_queued', createdAt: new Date().toISOString(), createdBy: a.by, updatedAt: new Date().toISOString() };
  soTotals(o); store.salesOrders.unshift(o); src.legacy.convertedToId = o.id;
  soStamp(o, `Converted from legacy ${src.legacy.number} by ${a.by} · original kept read-only`);
  appendAudit({ type: 'sales', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Legacy ${src.legacy.number} → ${o.number} (converted to editable)` });
  return resolve({ id: o.id, number: o.number });
}

// ---- Shipping bill audit: carrier bill lines (suggest → verify) matched by tracking # against every label we ever generated ----
import type { BillAudit, BillAuditLine, BillAuditTotals, BillBucket, BillDecision, BillLine, LedgerLabel } from './types';
export { MOCK_BILL_CSV, MOCK_BILL_FILENAME } from './fixtures';
const BILL_TOLERANCE = 0.5;
const ba = { audits: [] as BillAudit[], voided: fx.VOIDED_LABEL_SEED.map((v): LedgerLabel => ({ ...v, voided: true, path: '/shipping/inbound' })), counter: 0 };
const baStamp = (detail: string) => { const a = actor(); appendAudit({ type: 'accounting', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Bill audit · ${detail}` }); };
// The ledger: inbound labels (Parcel Pro seam), PO labels, outbound job shipments, plus voided labels (kept so a billed-after-void charge is caught)
export function getLabelLedger(): LedgerLabel[] {
  const rows: LedgerLabel[] = [];
  shp.rows.filter((s) => s.trackingNumber).forEach((s) => rows.push({ trackingNumber: s.trackingNumber!, ref: byId(store.estimates, s.estimateId).number, kind: s.direction, carrier: s.carrier, service: s.service, cost: s.cost ?? 0, createdAt: s.labelSentAt ?? s.requestedAt, voided: false, who: s.stamps.find((x) => x.action.includes('label created'))?.by, path: `/shipping/inbound?track=${s.trackingNumber}` }));
  rs.pos.filter((p) => p.trackingNumber).forEach((p) => rows.push({ trackingNumber: p.trackingNumber!, ref: p.number, kind: 'po', carrier: p.labelService?.startsWith('FedEx') ? 'FedEx' : 'UPS', service: p.labelService ?? 'UPS 2nd Day Air', cost: Math.round((p.total * 0.012 + 24) * 100) / 100, createdAt: p.createdAt, voided: false, who: p.createdBy, path: '/purchasing' }));
  store.salesOrders.filter((o) => o.shipment).forEach((o) => rows.push({ trackingNumber: o.shipment!.tracking, ref: o.number, kind: 'outbound', carrier: o.shipment!.carrier, service: o.shipment!.service, cost: o.shippingAmount || 0, createdAt: o.shipment!.at, voided: false, who: o.shipment!.by, path: `/sales/${o.id}` }));
  fx.EXTRA_LEDGER_SEED.forEach((x) => rows.push({ ...x, voided: false, path: '/shipping/inbound' }));
  rows.push(...ba.voided);
  return rows;
}
export const parseBillCsv = (text: string, carrier?: string): BillLine[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean); if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase()); const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iT = col('tracking'), iD = col('ship date', 'date'), iS = col('service'), iV = col('declared'), iTot = col('total'); const money = (v?: string) => { const n = Number((v ?? '').replace(/[$,]/g, '')); return Number.isFinite(n) ? n : 0; };
  const surchargeCols = header.map((h, i) => ({ h, i })).filter(({ h, i }) => i !== iTot && /fuel|correction|insurance|residential|surcharge|fee|adjust/.test(h));
  return lines.slice(1).map((l, n) => { const c = l.split(','); const surcharges = surchargeCols.map(({ h, i }) => ({ kind: header[i].replace(/\b\w/g, (m) => m.toUpperCase()) || h, amount: money(c[i]) })).filter((s) => s.amount !== 0); return { id: `bl-${n + 1}`, trackingNumber: (c[iT] ?? '').trim(), shipDate: (c[iD] ?? '').trim(), service: (c[iS] ?? '').trim(), billed: money(c[iTot]), surcharges, declaredValue: iV >= 0 && c[iV] ? money(c[iV]) : null, carrier }; }).filter((b) => b.trackingNumber);
};
const bucketOf = (bill: BillLine, label?: LedgerLabel): BillBucket => !label ? 'unknown' : label.voided ? 'voided_billed' : Math.abs(bill.billed - label.cost) <= BILL_TOLERANCE ? 'matched' : 'variance';
const BUCKET_ORDER: Record<BillBucket, number> = { voided_billed: 0, unknown: 1, variance: 2, matched: 3, unbilled: 4 };
const baTotals = (lines: BillAuditLine[], recovered = 0): BillAuditTotals => ({ billed: lines.filter((l) => l.bill).reduce((t, l) => t + l.bill!.billed, 0), matchedClean: lines.filter((l) => l.bucket === 'matched').length, variance: lines.filter((l) => l.bucket === 'variance').reduce((t, l) => t + l.delta, 0), disputed: lines.filter((l) => l.decision?.action === 'dispute').reduce((t, l) => t + Math.abs(l.bucket === 'unknown' ? l.bill!.billed : l.delta), 0), recovered, lines: lines.length });
const baRefs = (b: BillAudit): BillAudit => ({ ...b, lines: [...b.lines].sort((x, y) => BUCKET_ORDER[x.bucket] - BUCKET_ORDER[y.bucket] || Math.abs(y.delta) - Math.abs(x.delta)), totals: baTotals(b.lines, b.totals.recovered) });
export async function getBillAudits(): Promise<BillAudit[]> { return resolve(ba.audits.map(baRefs)); }
export async function getBillAudit(id: string): Promise<BillAudit> { return resolve(baRefs(byId(ba.audits, id))); }
// Runs after the human has eyeballed (and possibly corrected) the parsed lines
export async function createBillAudit(lines: BillLine[], fileName: string, vendor = 'Parcel Pro'): Promise<BillAudit> {
  const a = managerOnly(); if (!lines.length) throw new Error('No bill lines to match');
  const ledger = getLabelLedger(); const norm = (t: string) => t.replace(/\s/g, '').toUpperCase();
  const rows: BillAuditLine[] = lines.map((bill, i) => { const label = ledger.filter((l) => norm(l.trackingNumber) === norm(bill.trackingNumber)).sort((x, y) => Number(x.voided) - Number(y.voided))[0]; const bucket = bucketOf(bill, label); return { id: `bal-${i + 1}`, bucket, bill, label, delta: label ? Math.round((bill.billed - (bucket === 'voided_billed' ? 0 : label.cost)) * 100) / 100 : bill.billed }; });
  const billed = new Set(lines.map((l) => norm(l.trackingNumber)));
  ledger.filter((l) => !l.voided && !billed.has(norm(l.trackingNumber))).forEach((label, i) => rows.push({ id: `bal-u${i + 1}`, bucket: 'unbilled', label, delta: 0 }));
  const b: BillAudit = { id: newId('ba'), number: `BA-26-${String(++ba.counter).padStart(3, '0')}`, vendor, fileName, uploadedAt: new Date().toISOString(), by: a.by, station: a.station, lines: rows, totals: baTotals(rows), events: [{ at: new Date().toISOString(), by: a.by, text: `Bill uploaded (${fileName}) · ${lines.length} lines matched against ${ledger.length} ledger labels` }] };
  ba.audits.unshift(b); baStamp(`${b.number} · ${fileName} · ${rows.filter((r) => r.bucket === 'voided_billed').length} voided-but-billed · ${rows.filter((r) => r.bucket === 'unknown').length} unknown · ${rows.filter((r) => r.bucket === 'variance').length} variance`);
  return resolve(baRefs(b));
}
export async function decideBillLine(auditId: string, lineId: string, action: BillDecision['action'], reason: string): Promise<BillAudit> {
  const a = managerOnly(); const b = byId(ba.audits, auditId); const l = byId(b.lines, lineId);
  if (l.bucket === 'matched' || l.bucket === 'unbilled') throw new Error('Only flagged lines take a decision'); if (!reason.trim()) throw new Error('Pick a reason');
  l.decision = { action, reason: reason.trim(), by: a.by, at: new Date().toISOString() };
  b.events.push({ at: l.decision.at, by: a.by, text: `${action === 'accept' ? 'Accepted' : 'Disputed'} ${l.bill?.trackingNumber ?? l.label?.trackingNumber} · ${fmtMoney(Math.abs(l.bucket === 'unknown' ? l.bill!.billed : l.delta))} · ${l.decision.reason}` });
  return resolve(baRefs(b));
}
export interface DisputeDraft { subject: string; body: string; to: string; disputed: number; count: number }
export async function draftDisputeReport(auditId: string): Promise<DisputeDraft> {
  const b = byId(ba.audits, auditId); const rows = b.lines.filter((l) => l.decision?.action === 'dispute'); if (!rows.length) throw new Error('Nothing disputed yet — mark lines as Dispute first');
  const disputed = rows.reduce((t, l) => t + Math.abs(l.bucket === 'unknown' ? l.bill!.billed : l.delta), 0);
  const detail = rows.map((l) => `• ${l.bill!.trackingNumber} · ${l.bill!.shipDate} · ${l.bill!.service}\n   Billed ${fmtMoney(l.bill!.billed)}${l.bill!.surcharges.length ? ` (${l.bill!.surcharges.map((s) => `${s.kind} ${fmtMoney(s.amount)}`).join(', ')})` : ''} · our record: ${l.bucket === 'voided_billed' ? `label VOIDED ${l.label?.voidedAt ? new Date(l.label.voidedAt).toLocaleString() : ''} (ref ${l.label?.ref})` : l.bucket === 'unknown' ? 'no label ever created under this tracking #' : `${fmtMoney(l.label!.cost)} at label creation (ref ${l.label!.ref})`} · disputed ${fmtMoney(Math.abs(l.bucket === 'unknown' ? l.bill!.billed : l.delta))} · ${l.decision!.reason}`).join('\n');
  const t = rs.templates.find((x) => x.key === 'shipping_dispute')!; const p = personalTemplateFor('shipping_dispute'); const src = p ?? t;
  const vals: Record<string, string> = { '{{bill.number}}': b.fileName.replace(/\.[a-z]+$/i, ''), '{{bill.disputed_total}}': fmtMoney(disputed), '{{bill.dispute_lines}}': detail, '{{vendor.name}}': b.vendor, '{{shop.name}}': 'Rolliworks', '{{staff.name}}': actor().by };
  const fill = (x: string) => x.replace(/\{\{[a-z_.]+\}\}/g, (f) => vals[f] ?? f);
  return resolve({ subject: fill(src.subject), body: fill(src.body), to: 'billing@parcelpro.example', disputed, count: rows.length });
}
export async function sendDisputeReport(auditId: string, subject: string, body: string): Promise<BillAudit> {
  const a = managerOnly(); const b = byId(ba.audits, auditId); if (!subject.trim() || !body.trim()) throw new Error('Subject and body are required');
  const emailId = `ob-${Date.now().toString(36)}`; queueOutbox({ id: emailId, to: 'billing@parcelpro.example', toName: `${b.vendor} billing`, relatedRef: b.number, status: 'pending', subject: subject.trim(), body: body.trim(), createdAt: new Date().toISOString(), createdBy: a.by, station: a.station });
  b.disputeEmailId = emailId; b.disputeSentAt = new Date().toISOString(); b.events.push({ at: b.disputeSentAt, by: a.by, text: `Dispute report recorded in Sent · ${fmtMoney(baTotals(b.lines).disputed)}` }); baStamp(`${b.number} dispute report → Sent`);
  return resolve(baRefs(b));
}
// Vendor credit arrives → recovered-to-date (prototype: one tap marks every disputed line recovered)
export async function markBillRecovered(auditId: string, amount: number): Promise<BillAudit> {
  const a = managerOnly(); const b = byId(ba.audits, auditId); if (!(amount > 0)) throw new Error('Enter the credited amount');
  b.totals = { ...b.totals, recovered: Math.round((b.totals.recovered + amount) * 100) / 100 }; b.recoveredAt = new Date().toISOString(); b.events.push({ at: b.recoveredAt, by: a.by, text: `Credit received · ${fmtMoney(amount)} · recovered to date ${fmtMoney(b.totals.recovered)}` }); baStamp(`${b.number} credit ${fmtMoney(amount)}`);
  return resolve(baRefs(b));
}

// ---- E17 CONVERGENCE — routing layer. Covered functions go to the real Prototype API in hybrid mode and fall back to the mock above per call. ----
import * as real from './realClient';
import { route } from './routing';
import { API_MODE, API_SOURCE } from './config';
export { API_BASE_URL, API_MODE, API_SOURCE, setApiMode } from './config';
export { getApiHealth, subscribeApiHealth, API_TOAST_EVENT, isReal } from './routing';
export const signInWithPassword = route('signInWithPassword', signInWithPasswordMock, async (userId: string, password: string, photo: VerificationPhoto) => { const u = await real.signInWithPassword(userId, password, photo); await signInWithPasswordMock(userId, password, photo); return u; });
export const getEstimates = route('getEstimates', getEstimatesMock, real.getEstimates);
export const getEstimate = route('getEstimate', getEstimateMock, async (id: string) => (await real.getEstimate(id)) ?? getEstimateMock(id));
export const getJobs = route('getJobs', getJobsMock, real.getJobs);
export const getJob = route('getJob', getJobMock, async (id: string) => (await real.getJob(id)) ?? getJobMock(id));
export const getSalesOrders = route('getSalesOrders', getSalesOrdersMock, real.getSalesOrders);
export const getSalesOrder = route('getSalesOrder', getSalesOrderMock, async (id: string) => (await real.getSalesOrder(id)) ?? getSalesOrderMock(id));
export const getToday = route('getToday', getTodayMock, real.getToday);
export const resolveIdentifier = route('resolveIdentifier', resolveIdentifierMock, real.resolveIdentifier);
export const getRequests = route('getRequests', getRequestsMock, real.getRequests);
export const getPackages = route('getPackages', getPackagesMock, real.getPackages);
export const getDashboardStats = route('getDashboardStats', getDashboardStatsMock, real.getDashboardStats);
export const getRecentActivity = route('getRecentActivity', getRecentActivityMock, real.getRecentActivity);

// ---- SUPERVISOR DEPARTMENT DASHBOARD (WM room today; the same shape re-parameterises for the band room) ----
import type { DeptDashboard, DeptGoalMonth, DeptGoals, JobPart, JobPartsView, PaceStatus, PartsReturn, QuickAddResult, TechPace } from './types';
const dept = { history: { wm: [[3, 45_000, 47_800], [2, 46_000, 41_200], [1, 48_000, 49_350]], band: [[3, 20_000, 21_100], [2, 21_000, 18_400], [1, 22_000, 22_900]] } as Record<'wm' | 'band', [number, number, number][]>, stuckDays: 5 };
const paceOf = (actual: number, target: number): PaceStatus => (actual >= target * 1.1 ? 'ahead' : actual >= target * 0.9 ? 'on_pace' : 'behind');
const deptMonth = (monthsAgo: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthsAgo); return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }; };
// Revenue attribution = estimate lines of the department (W = watchmaking, B/P = band room) on jobs finished this month, plus parts quick-added (sale price)
// Some seeded trade lines are in cents (≥ $20k per line is not a watch-service rate) — normalise for the gauge only
const lineDollars = (p: number) => (p >= 20_000 ? p / 100 : p);
const deptRevenueMtd = (d: 'wm' | 'band') => { const mk = deptMonth(0).key; const depts = d === 'wm' ? ['W'] : ['B', 'P']; return store.jobs.filter((j) => ['ready_to_ship', 'closed', 'awaiting_manager_review', 'testing'].includes(j.status) && (j.timeline.at(-1)?.at ?? j.createdAt).startsWith(mk)).reduce((t, j) => t + j.lines.filter((l) => depts.includes(l.dept)).reduce((s, l) => s + l.qty * lineDollars(l.unitPrice), 0), 0) + Object.values(rwParts.byJob).flat().filter((p) => p.at.startsWith(mk)).reduce((t, p) => t + p.price * p.qty, 0); };
// Team goals — each team member has an individual monthly $ goal; the department goal is DERIVED (sum of the team), never typed directly
const techRevenueGoals: Record<string, number> = { Leo: 12_000, MM: 14_000, MH: 10_000, Walter: 12_000, JV: 14_000 };
export const techRevenueGoal = (short: string) => techRevenueGoals[short] ?? 10_000;
export const getDeptGoal = (d: 'wm' | 'band') => ROOM_TECHS[d].reduce((t, s) => t + techRevenueGoal(s), 0);
export interface TeamGoalRow { user: User; goal: number; actualMtd: number; pace: PaceStatus; activeJobs: number }
export async function getTeamGoals(d: 'wm' | 'band'): Promise<{ department: 'wm' | 'band'; label: string; total: number; rows: TeamGoalRow[] }> {
  const cards = await getPadBoard(d); const now = new Date(); const frac = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const rows = ROOM_TECHS[d].map((short) => { const user = fx.users.find((u) => u.shortName === short)!; const goal = techRevenueGoal(short); const g = benchGoals(short); const actualMtd = Math.round(goal * (g.current.goal ? g.current.actual / g.current.goal : 0)); return { user, goal, actualMtd, pace: paceOf(actualMtd, goal * frac), activeJobs: cards.filter((c) => c.job.assignees.includes(user.id) || c.parts.some((p) => p.tech === short)).length }; });
  return resolve({ department: d, label: ROOM_LABEL[d], total: getDeptGoal(d), rows });
}
export async function setTechGoal(short: string, goal: number): Promise<number> { const a = managerOnly(); if (!(goal > 0)) throw new Error('Goal must be positive'); const before = techRevenueGoal(short); techRevenueGoals[short] = Math.round(goal); appendAudit({ type: 'rollitime', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${short} monthly revenue goal ${fmtMoney(before)} → ${fmtMoney(techRevenueGoals[short])} · department totals recomputed` }); return resolve(techRevenueGoals[short]); }
export async function setDeptGoal(): Promise<number> { throw new Error('The department goal is the sum of the team — edit individual goals on the Team tab'); }
const deptGoals = (d: 'wm' | 'band'): DeptGoals => {
  const now = new Date(); const dayOfMonth = now.getDate(); const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const goal = getDeptGoal(d); const actualMtd = Math.round(deptRevenueMtd(d)); const projected = Math.round((actualMtd / Math.max(1, dayOfMonth)) * daysInMonth);
  const history: DeptGoalMonth[] = dept.history[d].map(([ago, g, a]) => ({ ...deptMonth(ago), goal: g, actual: a, hit: a >= g })); history.push({ ...deptMonth(0), goal, actual: actualMtd, hit: actualMtd >= goal, current: true });
  return { goal, actualMtd, projected, pace: paceOf(projected, goal), dayOfMonth, daysInMonth, history };
};
const daysInStage = (j: Job) => Math.floor((Date.now() - new Date(j.timeline.at(-1)?.at ?? j.createdAt).getTime()) / 86_400_000);
export async function getDeptDashboard(d: 'wm' | 'band' = 'wm'): Promise<DeptDashboard> {
  const cards = await getPadBoard(d); const techNames = ROOM_TECHS[d];
  const techs: TechPace[] = techNames.map((short) => { const user = fx.users.find((u) => u.shortName === short)!; const g = benchGoals(short); const mine = cards.filter((c) => c.job.assignees.includes(user.id) || c.parts.some((p) => p.tech === short)); const testing = mine.filter((c) => c.stage === 'testing'); return { user, goal: g.current.goal, actual: g.current.actual, paceTarget: g.paceTarget, pace: paceOf(g.current.actual, g.paceTarget), activeJobs: mine.length - testing.length, testingJobs: testing.length, cards: mine.filter((c) => c.stage !== 'testing') }; });
  const funnel = STAGE_ORDER.map((stage) => ({ stage, label: cards.find((c) => c.stage === stage)?.stageLabel ?? stage, count: cards.filter((c) => c.stage === stage).length })).filter((f) => f.count > 0 || true);
  return resolve({ department: d, label: ROOM_LABEL[d], goals: deptGoals(d), techs, funnel, totalJobs: cards.length, stuck: cards.filter((c) => c.stage !== 'testing' && daysInStage(c.job) >= dept.stuckDays).sort((a, b) => daysInStage(b.job) - daysInStage(a.job)), problem: cards.filter((c) => activeHold(c.job) || c.job.status === 'awaiting_manager_review'), awaitingParts: cards.filter((c) => c.pendingParts > 0), testing: cards.filter((c) => c.stage === 'testing'), stuckDays: dept.stuckDays });
}
export const jobDaysInStage = (j: Job) => daysInStage(j);

// ---- PARTS: per-job allowance ($300–$1000, job-level), Quick Add (no approval while under allowance), returns (no approval, audited) ----
const rwParts = { allowance: {} as Record<string, number>, byJob: {} as Record<string, JobPart[]>, returns: [] as PartsReturn[] };
export const jobPartsAllowance = (jobId: string): number => rwParts.allowance[jobId] ?? (300 + (Math.abs([...jobId].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % 8) * 100);
export async function setJobPartsAllowance(jobId: string, amount: number): Promise<number> { const a = managerOnly(); if (amount < 300 || amount > 1000) throw new Error('Allowance is $300–$1,000'); rwParts.allowance[jobId] = Math.round(amount); const j = byId(store.jobs, jobId); jobStamp(j, `Parts allowance set · ${fmtMoney(rwParts.allowance[jobId])}`); void a; return resolve(rwParts.allowance[jobId]); }
export async function getJobParts(jobId: string): Promise<JobPartsView> { const parts = rwParts.byJob[jobId] ?? []; const used = parts.reduce((t, p) => t + p.price * p.qty, 0); const allowance = jobPartsAllowance(jobId); return resolve({ allowance, used, remaining: allowance - used, parts: [...parts].reverse(), returns: rwParts.returns.filter((r) => r.jobId === jobId) }); }
// Scan watch → scan part → Save. Inventory decrements now; only the addition that would cross the allowance routes to pending approval.
export async function quickAddPart(jobId: string, partCode: string, qty = 1): Promise<QuickAddResult> {
  const a = actor(); const j = byId(store.jobs, jobId); const part = resolvePartScan(partCode); if (!part) throw new Error(`No part matches “${partCode}”`);
  const view = await getJobParts(jobId); const cost = part.price * qty;
  if (view.used + cost > view.allowance) { const r = await submitPadRequest(jobId, [{ partId: part.id, partNumber: part.partNumber, description: part.name, qty, price: part.price }]); jobStamp(j, `Quick Add ${part.partNumber} would exceed the ${fmtMoney(view.allowance)} allowance (${fmtMoney(view.used + cost)}) → ${r.number} pending approval`); return resolve({ kind: 'routed_to_approval', part, view: await getJobParts(jobId), requestNumber: r.number }); }
  if (part.stock < qty) throw new Error(`${part.partNumber} is out of stock (${part.stock} on hand) — request it instead`);
  part.stock -= qty; rs.movements.unshift({ id: newId('mv'), kind: 'issue', partId: part.id, locationId: 'loc-a1', delta: -qty, before: part.stock + qty, after: part.stock, reason: `Quick Add → ${j.number}`, by: a.by, station: a.station, at: new Date().toISOString() } as StockMovement);
  (rwParts.byJob[jobId] ??= []).push({ id: newId('jp'), jobId, partId: part.id, partNumber: part.partNumber, name: part.name, price: part.price, qty, addedBy: a.by, at: new Date().toISOString(), via: 'quick_add' });
  jobStamp(j, `Quick Add · ${part.partNumber} ${part.name} ×${qty} · ${fmtMoney(cost)} · parts ${fmtMoney(view.used + cost)} of ${fmtMoney(view.allowance)}`);
  return resolve({ kind: 'added', part, view: await getJobParts(jobId) });
}
// Return = correction: part off the job, unit back to stock, who/when/note. Adder or any manager.
export async function returnJobPart(jobPartId: string, note?: string): Promise<JobPartsView> {
  const a = actor(); const jobId = Object.keys(rwParts.byJob).find((k) => rwParts.byJob[k].some((p) => p.id === jobPartId)); if (!jobId) throw new Error('Part not found on any job'); const p = rwParts.byJob[jobId].find((x) => x.id === jobPartId)!;
  if (p.addedBy !== a.by && a.user?.accessTier !== 'manager') throw new Error('Only the person who added it or a manager can return a part');
  rwParts.byJob[jobId] = rwParts.byJob[jobId].filter((x) => x.id !== jobPartId); const part = store.parts.find((x) => x.id === p.partId); if (part) part.stock += p.qty;
  if (part) rs.movements.unshift({ id: newId('mv'), kind: 'receipt', partId: p.partId, locationId: 'loc-a1', delta: p.qty, before: part.stock - p.qty, after: part.stock, reason: `Returned from ${byId(store.jobs, jobId).number}${note ? ` · ${note}` : ''}`, by: a.by, station: a.station, at: new Date().toISOString() } as StockMovement);
  rwParts.returns.unshift({ id: newId('pr'), jobId, partId: p.partId, partNumber: p.partNumber, qty: p.qty, note: note?.trim() || undefined, by: a.by, at: new Date().toISOString() });
  jobStamp(byId(store.jobs, jobId), `Part returned · ${p.partNumber} ×${p.qty} back to stock${note ? ` · ${note}` : ''}`);
  return getJobParts(jobId);
}

// ---- COMPONENT CODE CHIPS (W · B · P · PM) + TRICKLE-DOWN VERIFICATION CHAIN — Expected (estimate) → Received (Scan 1, package contents) → Verified (Scan 2, inspector) ----
import type { AuditScope, B2bMatch, B2bTier, ChainRow, ChainState, ClientReviews, QboMapping, QboSetup, QboSyncState, StaffReview, VerificationChain } from './types';
export const inferComponentCodes = (lines: EstimateLine[]): DeptCode[] => uniq(lines.filter((l) => l.type !== 'shipping' && (l.description.trim() || l.unitPrice)).map((l) => l.dept));
export const estimateComponentCodes = (e: Estimate): { codes: DeptCode[]; inferred: boolean } => (e.components?.length ? { codes: e.components, inferred: false } : { codes: inferComponentCodes(e.lines), inferred: true });
export async function setEstimateComponents(id: string, codes: DeptCode[]): Promise<EstimateWithRefs> {
  const e = byId(store.estimates, id); if (e.legacy) throw new Error('Legacy record is read-only'); if (!codes.length) throw new Error('Pick at least one component code');
  const before = estimateComponentCodes(e).codes.join('+'); e.components = uniq(codes); e.updatedAt = new Date().toISOString(); estStamp(e, `Component codes ${before || '—'} → ${e.components.join('+')}`);
  return resolve(withRefs(e));
}
const chainFor = (e: Estimate): VerificationChain => {
  const { codes, inferred } = estimateComponentCodes(e); const expected = uniq(codes.flatMap((d) => fx.DEPT_COMPONENTS[d]));
  const pkg = store.packages.filter((p) => p.estimateId === e.id && p.status !== 'arrived').sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt))[0];
  return buildChain(e, codes, inferred, expected, pkg, pkg ? pkg.contents : undefined, pkg?.componentsVerified, pkg?.inspectedAt ? { at: pkg.inspectedAt, by: pkg.inspectedBy ?? '—' } : undefined);
};
const buildChain = (e: Estimate, codes: DeptCode[], inferred: boolean, expected: string[], pkg: Package | undefined, received: string[] | undefined, verified: string[] | undefined, verifiedMeta: { at: string; by: string } | undefined): VerificationChain => {
  const all = uniq([...expected, ...(received ?? []), ...(verified ?? [])]);
  const rows: ChainRow[] = all.map((component) => { const exp = expected.includes(component); const rec = received?.includes(component); const ver = verified?.includes(component);
    const state: ChainState = verified ? (exp && ver ? 'ok' : exp ? 'missing' : 'extra') : received ? (exp && rec ? 'pending' : exp ? 'missing' : 'extra') : 'pending';
    return { component, expected: exp, received: rec, verified: ver, state }; });
  return { estimateId: e.id, estimateNumber: e.number, codes, inferred, rows, received: pkg && received ? { at: pkg.processedAt ?? pkg.arrivedAt, by: pkg.processedBy ?? pkg.arrivedBy, packageId: pkg.id, subNumber: pkg.subNumber } : undefined, verified: verifiedMeta, complete: !!verified, discrepancies: rows.filter((r) => r.state === 'missing' || r.state === 'extra').length };
};
// Per-item chain — reads ONLY this item's chips (own lines / own override) and ONLY this item's Scan 1 / Scan 2 records
const chainForItem = (e: Estimate, itemId: string): VerificationChain | null => {
  const items = e.items ?? []; const item = items.find((i) => i.id === itemId); if (!item) return null;
  const ic = itemCodes(e.lines, items, item); const expected = uniq(ic.codes.flatMap((d) => fx.DEPT_COMPONENTS[d]));
  const pkg = store.packages.filter((p) => p.estimateId === e.id && p.status !== 'arrived').sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt))[0];
  const received = pkg?.itemContents?.[itemId]; const ver = pkg?.itemComponentsVerified?.[itemId];
  return { ...buildChain(e, ic.codes, ic.inferred, expected, pkg, received, ver?.components, ver ? { at: ver.at, by: ver.by } : undefined), override: ic.override, item: { id: item.id, number: itemNumber(items, item.id), count: items.length, label: item.label } };
};
// One chain per item for multi-item estimates; a single whole-package chain otherwise
const chainsFor = (e: Estimate): VerificationChain[] => (e.items && e.items.length > 1 ? e.items.map((i) => chainForItem(e, i.id)!).filter(Boolean) : [chainFor(e)]);
export async function getVerificationChains(estimateId: string): Promise<VerificationChain[]> { const e = store.estimates.find((x) => x.id === estimateId); return resolve(e ? chainsFor(e) : []); }
export async function getJobVerificationChains(jobId: string): Promise<VerificationChain[]> { const j = store.jobs.find((x) => x.id === jobId); const e = j?.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : undefined; return resolve(e ? chainsFor(e) : []); }
export async function getItemVerificationChain(estimateId: string, itemId: string): Promise<VerificationChain | null> { const e = store.estimates.find((x) => x.id === estimateId); return resolve(e ? chainForItem(e, itemId) : null); }
// Per-item chip override — logged with who / when / what was inferred; null reverts to inferred. Estimate-level union re-synced as the whole-job read model.
export const syncEstimateComponents = (e: Estimate) => { if (e.items && e.items.length > 1) e.components = unionItemCodes(e.lines, e.items); };
export async function setEstimateItemComponents(estimateId: string, itemId: string, codes: DeptCode[] | null): Promise<EstimateWithRefs> {
  const e = byId(store.estimates, estimateId); if (e.legacy) throw new Error('Legacy record is read-only'); const items = e.items ?? []; const item = items.find((i) => i.id === itemId); if (!item) throw new Error('Item not found on this estimate');
  const n = itemNumber(items, itemId); const inferredNow = inferItemCodes(e.lines, items, itemId); const before = itemCodes(e.lines, items, item).codes.join('+') || '—'; const a = actor();
  if (codes === null) { item.components = undefined; item.componentsOverride = undefined; estStamp(e, `Item ${n} of ${items.length} · component codes reverted to inferred (${inferredNow.join('+') || '—'}) · was ${before}`); }
  else { if (!codes.length) throw new Error('Pick at least one component code'); item.components = uniq(codes); item.componentsOverride = { by: a.by, at: new Date().toISOString(), from: inferredNow }; estStamp(e, `Item ${n} of ${items.length} · component codes override ${before} → ${item.components.join('+')} (inferred was ${inferredNow.join('+') || '—'})`); }
  syncEstimateComponents(e); e.updatedAt = new Date().toISOString(); return resolve(withRefs(e));
}
// Seeded multi-item estimate — E01053: Item 1 = band only (lines infer B), Item 2 = complete watch (lines infer W+P, PM added by a logged override). pk-06: Item 1 mid-chain (Scan 1 partial, no Scan 2); Item 2 not yet arrived.
(() => { const e = store.estimates.find((x) => x.number === 'E01053'); if (!e) return; const w = store.watches.find((x) => x.id === e.watchId);
  const items: EstimateItem[] = [{ id: 'it-e13-1', label: 'Oyster bracelet — band only' }, { id: 'it-e13-2', label: `${w?.brand ?? ''} ${w?.model ?? ''} — complete watch`.trim(), components: ['W', 'P', 'PM'], componentsOverride: { by: 'Vienna', at: daysAgoIso(2), from: ['W', 'P'] } }];
  e.items = items;
  e.lines = [
    { id: 'ln-e13-band', description: 'Re-pin stretched links — Oyster bracelet', qty: 1, unitPrice: 180, dept: 'B', taxable: true, type: 'service', itemId: items[0].id },
    { id: 'ln-e13-mvt', description: 'Complete movement service — cal. 3230', qty: 1, unitPrice: 1250, dept: 'W', taxable: true, type: 'service', itemId: items[1].id },
    { id: 'ln-e13-pol', description: 'Retail case polish', qty: 1, unitPrice: 340, dept: 'P', taxable: true, type: 'service', itemId: items[1].id, catalogId: 'svc-16' },
  ];
  recalc(e); syncEstimateComponents(e);
  const p = store.packages.find((x) => x.id === 'pk-06'); if (p) { p.itemsReceived = [items[0].id]; p.itemContents = { [items[0].id]: ['bracelet'] }; p.contents = ['bracelet', 'box', 'papers']; }
})();
export async function getVerificationChain(estimateId: string): Promise<VerificationChain | null> { const e = store.estimates.find((x) => x.id === estimateId); return resolve(e ? chainFor(e) : null); }
export async function getJobVerificationChain(jobId: string): Promise<VerificationChain | null> { const j = store.jobs.find((x) => x.id === jobId); const e = j?.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : undefined; return resolve(e ? chainFor(e) : null); }

// ---- WATCHMAKER-ROOM PHOTO KIOSK — shared common-area station (microscope + IPEVO). Attribution = the scanned job's assigned watchmaker; the kiosk has no login. ----
export type KioskCam = 'ipevo' | 'microscope';
export interface KioskStep { key: string; label: string; cam: KioskCam; hint: string }
// PROPOSED camera assignment (not confirmed): microscope for the three close-ups, IPEVO for the wider case-back shot
export const KIOSK_STEPS: KioskStep[] = [
  { key: 'dial-front', label: 'Front of dial', cam: 'microscope', hint: 'Dial face, hands, indices — straight on' },
  { key: 'dial-back', label: 'Back of dial', cam: 'microscope', hint: 'Dial feet, date disc side' },
  { key: 'movement-back', label: 'Back of movement', cam: 'microscope', hint: 'Rotor / bridges, serial visible if present' },
  { key: 'case-back', label: 'Case back', cam: 'ipevo', hint: 'Whole case back, engravings legible' },
];
export interface KioskShot { step: string; dataUrl: string; device: string; cam: KioskCam; at: string }
export interface KioskSession { id: string; jobId: string; watchmaker: string; startedAt: string; completedAt?: string; shots: KioskShot[] }
export interface KioskStatus { required: boolean; done: boolean; reason: string; watchmaker: string; session?: KioskSession }
const KIOSK_KEY = 'rollisuite.kiosk.required';
export const kioskRequiredSetting = () => localStorage.getItem(KIOSK_KEY) !== 'off';
export async function setKioskRequired(on: boolean): Promise<boolean> { localStorage.setItem(KIOSK_KEY, on ? 'on' : 'off'); const a = actor(); appendAudit({ type: 'estimate', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Setting · Require watchmaker-room photo documentation → ${on ? 'ON' : 'OFF'}` }); return resolve(on); }
const kioskSessions: KioskSession[] = [];
// Applicable = the job (or any of its estimate's items, by its own inferred/overridden chips) routes through W
const jobIsWRouted = (j: Job) => { if (j.workflow.includes('W')) return true; const e = j.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : undefined; return !!e && (e.items && e.items.length > 1 ? e.items.some((it) => itemCodes(e.lines, e.items!, it).codes.includes('W')) : estimateComponentCodes(e).codes.includes('W')); };
const kioskStatusFor = (j: Job): KioskStatus => { const s = kioskSessions.filter((x) => x.jobId === j.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]; const w = jobIsWRouted(j); const on = kioskRequiredSetting(); return { required: on && w, done: !!s?.completedAt, reason: !on ? 'setting off — ad-hoc photos only' : w ? 'W-routed item → 4-step set required' : 'not W-routed — ad-hoc photos only', watchmaker: j.assignees[0] ?? '—', session: s }; };
export async function getKioskStatus(jobId: string): Promise<KioskStatus> { return resolve(kioskStatusFor(getJobRow(jobId))); }
export async function startKioskSession(jobId: string): Promise<KioskSession> { const j = getJobRow(jobId); const open = kioskSessions.find((s) => s.jobId === jobId && !s.completedAt); if (open) return resolve(open); const s: KioskSession = { id: newId('wmk'), jobId, watchmaker: j.assignees[0] ?? 'unassigned', startedAt: new Date().toISOString(), shots: [] }; kioskSessions.unshift(s); jobStamp(j, `WM room kiosk · required photo set started · attributed to ${s.watchmaker}`); return resolve(s); }
export async function recordKioskShot(sessionId: string, shot: Omit<KioskShot, 'at'>): Promise<KioskSession> {
  const s = kioskSessions.find((x) => x.id === sessionId); if (!s) throw new Error('Kiosk session not found'); const j = getJobRow(s.jobId); const at = new Date().toISOString();
  s.shots = [...s.shots.filter((x) => x.step !== shot.step), { ...shot, at }];
  addJobPhotoSync(j, { dataUrl: shot.dataUrl, slot: `wmroom-${shot.step}`, fileName: `WM room · ${KIOSK_STEPS.find((k) => k.key === shot.step)?.label}`, photoType: 'bench', at, by: s.watchmaker, station: 'Watchmaker Room Kiosk', replaceSlot: true, stamp: false });
  if (s.shots.length >= KIOSK_STEPS.length && !s.completedAt) { s.completedAt = at; jobStamp(j, `WM room kiosk · required 4-photo set FINISHED · attributed to ${s.watchmaker} · clears the bench task`); }
  return resolve({ ...s, shots: [...s.shots] });
}
export async function addKioskPhoto(jobId: string, dataUrl: string, device: string, note: string): Promise<PackagePhoto> { const j = getJobRow(jobId); const p = addJobPhotoSync(j, { dataUrl, slot: 'wmroom-adhoc', fileName: note.slice(0, 60) || 'WM room photo', note, photoType: 'bench', by: j.assignees[0] ?? 'Watchmaker', station: `Watchmaker Room Kiosk · ${device}`, stamp: false }); jobStamp(j, `WM room kiosk · ad-hoc photo added${note ? ` — ${note.slice(0, 80)}` : ''}`); return resolve(p); }
// Seed: E02014 (j-04, MM) walked through the full 4-step set yesterday — its bench task is already clear
(() => { const j = store.jobs.find((x) => x.id === 'j-04'); if (!j) return; const at = daysAgoIso(1); const s: KioskSession = { id: 'wmk-seed-1', jobId: j.id, watchmaker: j.assignees[0] ?? 'MM', startedAt: at, completedAt: at, shots: KIOSK_STEPS.map((k, i) => ({ step: k.key, dataUrl: `https://picsum.photos/seed/wmk-${k.key}/640/480`, device: k.cam === 'ipevo' ? 'IPEVO V4K' : 'HY-3307 Microscope', cam: k.cam, at: new Date(new Date(at).getTime() + i * 60000).toISOString() })) }; kioskSessions.push(s); s.shots.forEach((sh) => j.photos.push({ id: `ph-${sh.step}`, source: 'camera', dataUrl: sh.dataUrl, slot: `wmroom-${sh.step}`, fileName: `WM room · ${KIOSK_STEPS.find((k) => k.key === sh.step)?.label}`, at: sh.at, by: s.watchmaker, station: 'Watchmaker Room Kiosk' })); })();

// ---- PER-STAFF CLIENT REVIEWS — every staff member rates independently (A / C); N = jobs that person handled for the client. Aggregate badge = rounded mean of the latest review per staff. Internal only. ----
const reviews = { rows: [] as StaffReview[] };
const seedReview = (id: string, clientId: string, by: string, attitude: Star, communication: Star, daysBack: number, note?: string): StaffReview => ({ id, clientId, by, attitude, communication, jobsHandled: 0, note, at: new Date(Date.now() - daysBack * 86_400_000).toISOString(), station: 'Front Desk 1' });
reviews.rows.push(seedReview('rv-01', 'c-30', 'Vienna', 5, 3, 40, 'Lovely in person; slow to answer emails — call him.'), seedReview('rv-02', 'c-30', 'MM', 5, 4, 12), seedReview('rv-03', 'c-05', 'MH', 4, 4, 90), seedReview('rv-04', 'c-10', 'Vienna', 3, 4, 60), seedReview('rv-05', 'c-10', 'Walter', 2, 4, 12, 'Raised his voice at the counter over a pickup code.'));
const jobsHandledBy = (clientId: string, by: string) => { const u = fx.users.find((x) => x.shortName === by); return store.jobs.filter((j) => j.clientId === clientId && ((u && j.assignees.includes(u.id)) || j.createdBy === by || j.timeline.some((t) => t.by === by))).length; };
const latestPerStaff = (clientId: string) => { const m = new Map<string, StaffReview>(); [...reviews.rows].filter((r) => r.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at)).forEach((r) => m.set(r.by, r)); return [...m.values()].map((r) => ({ ...r, jobsHandled: jobsHandledBy(clientId, r.by) })).sort((a, b) => b.at.localeCompare(a.at)); };
export async function getClientReviews(clientId: string): Promise<ClientReviews> { const a = actor(); const rows = latestPerStaff(clientId); return resolve({ clientId, aggregate: clientRatingSync(clientId), reviews: rows, mine: rows.find((r) => r.by === a.by) }); }
export async function submitClientReview(clientId: string, input: { attitude: Star; communication: Star; note?: string }): Promise<ClientReviews> {
  const a = actor(); if (!a.user) throw new Error('Sign in to review a client'); byId(fx.clients, clientId);
  reviews.rows.push({ id: newId('rv'), clientId, by: a.by, attitude: input.attitude, communication: input.communication, jobsHandled: jobsHandledBy(clientId, a.by), note: input.note?.trim() || undefined, at: new Date().toISOString(), station: a.station });
  const rows = latestPerStaff(clientId); const mean = (k: 'attitude' | 'communication') => Math.round(rows.reduce((t, r) => t + r[k], 0) / rows.length) as Star;
  await setClientRating(clientId, { attitude: mean('attitude'), communication: mean('communication') });
  appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user.shortName, detail: `Client review · ${fullNameOf(byId(fx.clients, clientId))} · A${input.attitude} C${input.communication}${input.note ? ' · note' : ''}` });
  return getClientReviews(clientId);
}

// ---- QUICKBOOKS ONLINE — MOCKED setup screen (no OAuth, no network). Toggles + field mapping + client sync table; every action logged. ----
const qbo = { connected: false as boolean, company: undefined as string | undefined, realmId: undefined as string | undefined, connectedBy: undefined as string | undefined, connectedAt: undefined as string | undefined, lastSync: undefined as string | undefined,
  toggles: { pushInvoices: true, pushPayments: true, pushClients: false, pullPayments: false }, links: new Map<string, { qboCustomerId?: string; state: QboSyncState; lastSync?: string; issue?: string }>(), log: [] as { at: string; by: string; text: string }[],
  mapping: [{ rolli: 'Client → name / company', qbo: 'Customer.DisplayName', direction: 'push' }, { rolli: 'Client → email', qbo: 'Customer.PrimaryEmailAddr', direction: 'push' }, { rolli: 'Sales order', qbo: 'Invoice', direction: 'push' }, { rolli: 'SO line · dept W/B/P/PM', qbo: 'Invoice.Line → Item (per dept)', direction: 'push' }, { rolli: 'Payment (card / cash / check / wire)', qbo: 'Payment', direction: 'both' }, { rolli: 'Sales tax', qbo: 'TxnTaxDetail', direction: 'push' }] as QboMapping[] };
const qboLog = (text: string) => { const a = actor(); qbo.log.unshift({ at: new Date().toISOString(), by: a.by, text }); appendAudit({ type: 'accounting', stationName: a.station, userShortName: a.user?.shortName, detail: `QBO (mock) · ${text}` }); };
const qboClientRows = () => fx.clients.map((client) => { const l = qbo.links.get(client.id); return { client, qboCustomerId: l?.qboCustomerId, state: l?.state ?? 'not_linked' as QboSyncState, lastSync: l?.lastSync, issue: l?.issue }; }).sort((a, b) => (a.state === 'conflict' ? -1 : b.state === 'conflict' ? 1 : a.client.lastName.localeCompare(b.client.lastName)));
export async function getQboSetup(): Promise<QboSetup> { return resolve({ connected: qbo.connected, company: qbo.company, realmId: qbo.realmId, connectedBy: qbo.connectedBy, connectedAt: qbo.connectedAt, lastSync: qbo.lastSync, toggles: { ...qbo.toggles }, mapping: [...qbo.mapping], clients: qboClientRows(), queue: await getQboQueue(), log: [...qbo.log] }); }
export async function qboConnect(company: string): Promise<QboSetup> { const a = managerOnly(); if (!company.trim()) throw new Error('Company name is required'); qbo.connected = true; qbo.company = company.trim(); qbo.realmId = `mock-${Math.abs([...company].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % 900000 + 100000}`; qbo.connectedBy = a.by; qbo.connectedAt = new Date().toISOString(); qboLog(`Connected to “${qbo.company}” (realm ${qbo.realmId}) — MOCK, no OAuth`); return getQboSetup(); }
export async function qboDisconnect(): Promise<QboSetup> { managerOnly(); qbo.connected = false; qboLog(`Disconnected from “${qbo.company}”`); qbo.company = undefined; qbo.realmId = undefined; return getQboSetup(); }
export async function setQboToggle(key: keyof QboSetup['toggles'], value: boolean): Promise<QboSetup> { managerOnly(); qbo.toggles[key] = value; qboLog(`${key} → ${value ? 'on' : 'off'}`); return getQboSetup(); }
export async function qboSyncClient(clientId: string): Promise<QboSetup> {
  managerOnly(); if (!qbo.connected) throw new Error('Connect QuickBooks first'); const c = byId(fx.clients, clientId); const now = new Date().toISOString();
  if (!c.email || !c.email.includes('@')) { qbo.links.set(clientId, { state: 'conflict', lastSync: now, issue: 'Email missing — QBO customer requires one' }); qboLog(`Client ${fullNameOf(c)} → conflict (email missing)`); }
  else if (qbo.links.get(clientId)?.state === 'conflict' && qbo.links.get(clientId)?.issue?.startsWith('Duplicate')) { qbo.links.set(clientId, { qboCustomerId: `QB-${clientId.replace('c-', '10')}`, state: 'synced', lastSync: now }); qboLog(`Client ${fullNameOf(c)} → linked to existing QBO customer`); }
  else { qbo.links.set(clientId, { qboCustomerId: `QB-${clientId.replace('c-', '10')}`, state: 'synced', lastSync: now }); qboLog(`Client ${fullNameOf(c)} → pushed as Customer QB-${clientId.replace('c-', '10')}`); }
  qbo.lastSync = now; return getQboSetup();
}
export async function qboSyncAllClients(): Promise<QboSetup> { managerOnly(); if (!qbo.connected) throw new Error('Connect QuickBooks first'); if (!qbo.toggles.pushClients) throw new Error('Turn on “Push clients” first'); const now = new Date().toISOString(); fx.clients.forEach((c, i) => { if (qbo.links.get(c.id)?.state === 'synced') return; if (i % 9 === 4) qbo.links.set(c.id, { state: 'conflict', lastSync: now, issue: `Duplicate DisplayName “${fullNameOf(c)}” already in QBO — link or rename` }); else qbo.links.set(c.id, { qboCustomerId: `QB-${c.id.replace('c-', '10')}`, state: 'synced', lastSync: now }); }); qbo.lastSync = now; qboLog(`Client sync · ${qboClientRows().filter((r) => r.state === 'synced').length} synced · ${qboClientRows().filter((r) => r.state === 'conflict').length} conflicts`); return getQboSetup(); }
export async function qboResolveConflict(clientId: string, how: 'link' | 'skip'): Promise<QboSetup> { managerOnly(); const c = byId(fx.clients, clientId); if (how === 'link') qbo.links.set(clientId, { qboCustomerId: `QB-${clientId.replace('c-', '10')}`, state: 'synced', lastSync: new Date().toISOString() }); else qbo.links.delete(clientId); qboLog(`Conflict on ${fullNameOf(c)} → ${how === 'link' ? 'linked to existing customer' : 'skipped'}`); return getQboSetup(); }

// ---- NO-ESTIMATE RECEIVING BRANCH — three-tier B2B label match chain: (1) tracking # on a label we issued → estimate · (2) trade account code → client · (3) name / email → candidates. SUB# is issued either way. ----
const normCode = (t: string) => t.replace(/\s/g, '').toUpperCase();
const accountCodes = (c: Client) => { const name = c.company ?? `${c.firstName} ${c.lastName}`; return uniq([name.split(/\s+/).map((w) => w[0]).join(''), name.replace(/\W/g, '').slice(0, 3), name.replace(/\W/g, '').slice(0, 4), c.lastName.replace(/\W/g, '').slice(0, 3)].map((x) => x.toUpperCase())); };
export async function matchB2bLabel(code: string, packageId?: string): Promise<B2bMatch> {
  const raw = code.trim(); if (!raw) throw new Error('Scan or type the label'); const n = normCode(raw); const pkg = packageId ? store.packages.find((p) => p.id === packageId) : undefined; const subNumber = pkg?.subNumber ?? `SUB-26-0${store.counters.sub + 1}`;
  const ship = shp.rows.find((s) => s.trackingNumber && normCode(s.trackingNumber) === n) ?? shp.rows.find((s) => s.trackingNumber && n.length >= 8 && normCode(s.trackingNumber).endsWith(n.slice(-8)));
  if (ship) { const e = withRefs(byId(store.estimates, ship.estimateId)); return resolve({ code: raw, tier: 'tracking', estimate: e, client: e.client, candidates: [e.client], subNumber, explain: `Tier 1 · tracking # matches the ${ship.carrier} label we issued for ${e.number}` }); }
  const est = await lookupEstimate(raw); if (est) return resolve({ code: raw, tier: 'tracking', estimate: est, client: est.client, candidates: [est.client], subNumber, explain: `Tier 1 · label carries estimate ${est.number}` });
  const trade = fx.clients.filter((c) => c.type === 'trade'); const m = /^(?:RS|TRD|ACCT|B2B)?-?([A-Z]{2,4})(?:-|\d|$)/.exec(n); const acct = m ? trade.find((c) => accountCodes(c).includes(m[1])) : undefined;
  if (acct) return resolve({ code: raw, tier: 'account_code', client: acct, candidates: [acct], subNumber, explain: `Tier 2 · account code ${m![1]} → trade account ${acct.company ?? fullNameOf(acct)}` });
  const q = raw.toLowerCase().replace(/[^a-z@. ]/g, ' ').trim(); const cands = q.length >= 3 ? fx.clients.filter((c) => [c.firstName, c.lastName, c.email, c.company ?? ''].some((f) => f.toLowerCase().includes(q)) || q.split(/\s+/).every((w) => `${c.firstName} ${c.lastName} ${c.company ?? ''}`.toLowerCase().includes(w))).slice(0, 5) : [];
  if (cands.length) return resolve({ code: raw, tier: 'name', client: cands.length === 1 ? cands[0] : undefined, candidates: cands, subNumber, explain: `Tier 3 · name / email on the label → ${cands.length} candidate${cands.length === 1 ? '' : 's'}` });
  return resolve({ code: raw, tier: 'none', candidates: [], subNumber, explain: 'No match on tracking, account code or name — receive under SUB# only and resolve at the desk' });
}
export async function attachB2bMatch(packageId: string, m: { tier: B2bTier; code: string; clientId?: string; estimateId?: string }): Promise<PackageWithRefs> {
  const pkg = getPkg(packageId); pkg.b2b = { tier: m.tier, code: m.code, at: new Date().toISOString() }; if (m.estimateId) { pkg.estimateId = m.estimateId; pkg.clientId = byId(store.estimates, m.estimateId).clientId; } else if (m.clientId) pkg.clientId = m.clientId;
  stamp(`No-estimate branch · label “${m.code}” · ${m.tier === 'none' ? 'unmatched, SUB# only' : `matched via ${m.tier}`}${pkg.clientId ? ` → ${fullNameOf(byId(fx.clients, pkg.clientId))}` : ''}`, pkg.subNumber);
  return resolve(pkgWithRefs(pkg));
}

// ---- RW client / job history lookup — no dollar amounts (MoneyContext hides them anyway; stripped here too) ----
export interface RwHistoryHit { client: Client; watches: { watch: Watch; rows: Omit<WatchHistoryRow, 'amount'>[]; activeJobId?: string }[]; openRequests: number; jobs: number; custody: CustodyEvent[] }
export async function searchRwHistory(query: string): Promise<RwHistoryHit[]> {
  const q = query.trim(); if (q.length < 2) return resolve([]);
  const byJob = (await searchJobs(q)).map((j) => j.clientId); const ids = uniq([...(await searchClients(q)).map((c) => c.id), ...byJob]).slice(0, 6);
  const out: RwHistoryHit[] = []; for (const id of ids) { const c = await getClient360(id); if (!c) continue; out.push({ client: c.client, watches: c.watches.map((w) => ({ watch: w.watch, activeJobId: w.activeJobId, rows: w.history.map(({ amount: _a, ...r }) => r) })), openRequests: c.summary.openRequests, jobs: c.jobs.length, custody: c.custody.filter((x) => x.kind === 'arrival_scan' || x.kind === 'shelved' || x.kind === 'open_scan' || x.kind === 'package_arrived' || x.kind === 'watch_received') }); }
  return resolve(out);
}
export const uniqComponents = (codes: DeptCode[]): string[] => uniq(codes.flatMap((d) => fx.DEPT_COMPONENTS[d]));

// ---- Sent emails for a job (read-only aggregation for the Supervisor Pad detail) — Sent rows whose ref is the job, its estimate, its SO or one of its parts requests; parts-approval status comes from the PR ----
export interface JobEmailRow { email: OutboxEmail; kind: 'parts_approval' | 'estimate' | 'invoice' | 'status' | 'other'; status: string; requestNumber?: string }
export async function getJobEmails(jobId: string): Promise<JobEmailRow[]> {
  const j = byId(store.jobs, jobId); const est = j.estimateId ? store.estimates.find((e) => e.id === j.estimateId) : undefined; const sos = store.salesOrders.filter((o) => o.jobId === j.id); const prs = store.partsRequests.filter((r) => r.jobId === j.id);
  const refs = new Set([j.number, est?.number, ...sos.map((o) => o.number), ...prs.map((r) => r.number)].filter(Boolean) as string[]); const prEmailIds = new Map(prs.filter((r) => r.emailId).map((r) => [r.emailId!, r]));
  const hit = (ref: string) => [...refs].some((r) => ref.split(/[\s·]+/).includes(r) || ref.includes(r));
  const rows: JobEmailRow[] = store.outbox.filter((e) => hit(e.relatedRef) || prEmailIds.has(e.id)).map((e) => {
    const pr = prEmailIds.get(e.id) ?? prs.find((r) => e.relatedRef.includes(r.number));
    if (pr) return { email: e, kind: 'parts_approval', requestNumber: pr.number, status: pr.status === 'approved' || pr.status === 'on_order' || pr.status === 'received' ? `approved${pr.clientDecidedAt ? ` · ${pr.clientDecidedAt.slice(0, 10)}` : ''}` : pr.status === 'declined' || pr.status === 'rejected' ? 'declined' : 'sent · awaiting client' };
    const kind: JobEmailRow['kind'] = /estimate|quote/i.test(e.subject) ? 'estimate' : /invoice|payment/i.test(e.subject) ? 'invoice' : /progress|ready|received|shipped|update/i.test(e.subject) ? 'status' : 'other';
    const opened = est?.engagement?.some((g) => g.kind === 'opened') && kind === 'estimate';
    return { email: e, kind, status: kind === 'estimate' && est ? (est.status === 'approved' || est.status === 'converted' ? 'approved' : est.status === 'declined' ? 'declined' : opened ? 'sent · opened' : 'sent') : 'sent' };
  });
  return resolve(rows.sort((a, b) => b.email.createdAt.localeCompare(a.email.createdAt)));
}

// ---- Shared job filter vocabulary — one list for the RS "All Jobs" view and the RW Reports section (modeled on the legacy RolliWorks Reports screen) ----
export type JobCategoryKey = 'in_progress' | 'waiting_approval' | 'due_4w' | 'due_3w' | 'due_14d' | 'warranty' | 'outsourced' | 'awaiting_parts_approval' | 'parts_on_order' | 'needing_update_email' | 'past_due' | 'waiver_required' | 'in_testing' | 'awaiting_inspection';
export type ReportStatusKey = 'intake' | 'inspection' | 'waiting_approval' | 'in_queue' | 'in_progress' | 'parts_approval' | 'parts_on_order' | 'in_testing' | 'finished';
const daysUntil = (iso?: string) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : undefined);
const openJob = (j: Job) => !['closed', 'ready_to_ship', 'awaiting_manager_review'].includes(j.status);
const prsOf = (j: Job) => store.partsRequests.filter((r) => r.jobId === j.id);
const lastEmailDays = (j: Job) => { const est = j.estimateId ? store.estimates.find((e) => e.id === j.estimateId) : undefined; const refs = new Set([j.number, est?.number].filter(Boolean)); const last = store.outbox.filter((e) => refs.has(e.relatedRef)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; return last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 86_400_000) : 999; };
export const JOB_CATEGORIES: { key: JobCategoryKey; label: string; test: (j: Job) => boolean }[] = [
  { key: 'in_progress', label: 'In progress', test: (j) => j.status === 'in_service' },
  { key: 'waiting_approval', label: 'Waiting for approval', test: (j) => j.status === 'awaiting_customer_approval' },
  { key: 'due_4w', label: 'Due within 4 weeks', test: (j) => openJob(j) && (daysUntil(j.dueAt) ?? 999) <= 28 },
  { key: 'due_3w', label: 'Due within 3 weeks', test: (j) => openJob(j) && (daysUntil(j.dueAt) ?? 999) <= 21 },
  { key: 'due_14d', label: 'Due within 14 days', test: (j) => openJob(j) && (daysUntil(j.dueAt) ?? 999) <= 14 },
  { key: 'warranty', label: 'Warranty service', test: (j) => j.kind === 'warranty' },
  { key: 'outsourced', label: 'Outstanding outsourced', test: (j) => activeHold(j)?.type === 'outsource' },
  { key: 'awaiting_parts_approval', label: 'Awaiting parts approval', test: (j) => prsOf(j).some((r) => r.status === 'pending' || r.status === 'pending_review' || r.status === 'awaiting_client') },
  { key: 'parts_on_order', label: 'Parts on order', test: (j) => prsOf(j).some((r) => r.status === 'on_order') },
  { key: 'needing_update_email', label: 'Needing update email', test: (j) => j.status === 'in_service' && lastEmailDays(j) > 14 },
  { key: 'past_due', label: 'Past due date', test: (j) => openJob(j) && (daysUntil(j.dueAt) ?? 999) < 0 },
  { key: 'waiver_required', label: 'Waiver required', test: (j) => openJob(j) && valueTierOf(j) === 'high' && !j.notes.some((n) => /waiver/i.test(n.text)) },
  { key: 'in_testing', label: 'In testing', test: (j) => j.status === 'testing' },
  { key: 'awaiting_inspection', label: 'Awaiting inspection', test: (j) => j.status === 'intake' || j.status === 'in_review' },
];
export const REPORT_STATUSES: { key: ReportStatusKey; label: string; test: (j: Job) => boolean }[] = [
  { key: 'intake', label: 'Intake', test: (j) => j.status === 'intake' }, { key: 'inspection', label: 'Inspection', test: (j) => j.status === 'in_review' }, { key: 'waiting_approval', label: 'Waiting Approval', test: (j) => j.status === 'awaiting_customer_approval' },
  { key: 'in_queue', label: 'In Queue', test: (j) => j.status === 'approved' }, { key: 'in_progress', label: 'In Progress', test: (j) => j.status === 'in_service' && !prsOf(j).some((r) => ['pending', 'pending_review', 'awaiting_client', 'on_order'].includes(r.status)) },
  { key: 'parts_approval', label: 'Parts Approval', test: (j) => openJob(j) && prsOf(j).some((r) => r.status === 'pending' || r.status === 'pending_review' || r.status === 'awaiting_client') }, { key: 'parts_on_order', label: 'Parts On Order', test: (j) => openJob(j) && prsOf(j).some((r) => r.status === 'on_order') },
  { key: 'in_testing', label: 'In Testing', test: (j) => j.status === 'testing' }, { key: 'finished', label: 'Finished', test: (j) => j.status === 'ready_to_ship' || j.status === 'closed' || j.status === 'awaiting_manager_review' },
];
export type QuickReportKey = 'at_risk' | 'late' | 'overdue' | 'approval_wait' | 'pending_waivers' | 'parts_status';
export const QUICK_REPORTS: { key: QuickReportKey; label: string; blurb: string; test: (j: Job) => boolean }[] = [
  { key: 'at_risk', label: 'At Risk (Not Started)', blurb: 'Not yet in progress, within 3 weeks of or past due', test: (j) => ['intake', 'in_review', 'awaiting_customer_approval', 'approved'].includes(j.status) && (daysUntil(j.dueAt) ?? 999) <= 21 },
  { key: 'late', label: 'Late Jobs', blurb: 'Movement services in early stages, ≤ 21 days to due', test: (j) => j.workflow.includes('W') && ['approved', 'in_service'].includes(j.status) && (daysUntil(j.dueAt) ?? 999) <= 21 },
  { key: 'overdue', label: 'Overdue Jobs', blurb: 'Every open job past its due date', test: (j) => openJob(j) && (daysUntil(j.dueAt) ?? 999) < 0 },
  { key: 'approval_wait', label: 'Approval Wait Time', blurb: 'Days each job has waited for the client', test: (j) => j.status === 'awaiting_customer_approval' },
  { key: 'pending_waivers', label: 'Pending Waivers', blurb: 'High-value jobs with no signed liability waiver on file', test: (j) => openJob(j) && valueTierOf(j) === 'high' && !j.notes.some((n) => /waiver/i.test(n.text)) },
  { key: 'parts_status', label: 'Parts Status', blurb: 'In parts approval or waiting for parts', test: (j) => openJob(j) && prsOf(j).some((r) => ['pending', 'pending_review', 'awaiting_client', 'on_order'].includes(r.status)) },
];
export interface JobReportFilter { quick?: QuickReportKey; from?: string; to?: string; movementOnly?: boolean; statuses?: ReportStatusKey[]; categories?: JobCategoryKey[]; q?: string }
export interface JobReportRow { job: JobWithRefs; estimateNumber?: string; jobType: string; statusLabel: string; intake: string; due?: string; days?: number; overdue: boolean; waitingDays?: number; categories: JobCategoryKey[] }
const JOB_TYPE_LABEL: Record<Job['kind'], string> = { service: 'Service', small_job: 'Small job', warranty: 'Warranty', trade: 'Trade' };
export async function getJobReport(f: JobReportFilter = {}): Promise<{ rows: JobReportRow[]; total: number; generatedAt: string }> {
  const q = f.q?.trim().toLowerCase(); const base = q ? await searchJobs(q) : (store.jobs.map(jobRefs));
  const rows = base.filter((j) => (!f.quick || QUICK_REPORTS.find((r) => r.key === f.quick)!.test(j)) && (!f.from || (j.intakeDate ?? j.createdAt) >= f.from) && (!f.to || (j.intakeDate ?? j.createdAt).slice(0, 10) <= f.to) && (!f.movementOnly || j.workflow.includes('W')) && (!f.statuses?.length || f.statuses.some((k) => REPORT_STATUSES.find((s) => s.key === k)!.test(j))) && (!f.categories?.length || f.categories.every((k) => JOB_CATEGORIES.find((c) => c.key === k)!.test(j))))
    .map((j): JobReportRow => { const d = daysUntil(j.dueAt); const waiting = j.status === 'awaiting_customer_approval' ? Math.floor((Date.now() - new Date(j.timeline.at(-1)?.at ?? j.createdAt).getTime()) / 86_400_000) : undefined; return { job: j, estimateNumber: j.estimate?.number, jobType: JOB_TYPE_LABEL[j.kind], statusLabel: REPORT_STATUSES.find((s) => s.test(j))?.label ?? j.status, intake: j.intakeDate ?? j.createdAt, due: j.dueAt, days: d, overdue: d !== undefined && d < 0 && openJob(j), waitingDays: waiting, categories: JOB_CATEGORIES.filter((c) => c.test(j)).map((c) => c.key) }; })
    .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));
  return resolve({ rows, total: store.jobs.length, generatedAt: new Date().toISOString() });
}

// ---- Receive Watch (Stage 4) helpers — est# → awaiting-inspection package, and a simple prefix decoder for the serial field (real authentication reference tables are still outstanding from MH) ----
export async function findInspectionPackage(numberOrId: string): Promise<{ packageId: string; estimateNumber: string } | null> {
  const q = numberOrId.trim().toUpperCase(); if (!q) return resolve(null);
  const pkg = store.packages.find((p) => p.subNumber.toUpperCase() === q) ?? (() => { const e = store.estimates.find((x) => x.number.toUpperCase() === q || x.id.toUpperCase() === q); return e ? store.packages.filter((p) => p.estimateId === e.id).sort((a, b) => (a.status === 'awaiting_inspection' ? -1 : 1) - (b.status === 'awaiting_inspection' ? -1 : 1))[0] : undefined; })();
  return resolve(pkg ? { packageId: pkg.id, estimateNumber: store.estimates.find((e) => e.id === pkg.estimateId)?.number ?? '' } : null);
}
export interface SerialDecode { brand: string; model: string; caliber: string; era?: string; confidence: 'reference' | 'prefix' | 'none' }
const SERIAL_PREFIXES: { re: RegExp; brand: string; model: string; caliber: string; era?: string }[] = [
  { re: /^1601/, brand: 'Rolex', model: 'Datejust 36 (fluted, cal. 1570 era)', caliber: 'cal. 1570', era: '1960s–70s' }, { re: /^1603/, brand: 'Rolex', model: 'Datejust 36 (engine-turned)', caliber: 'cal. 1570' }, { re: /^1675/, brand: 'Rolex', model: 'GMT-Master', caliber: 'cal. 1575', era: '1959–80' },
  { re: /^5513/, brand: 'Rolex', model: 'Submariner (no date)', caliber: 'cal. 1520 / 1530', era: '1962–89' }, { re: /^1680/, brand: 'Rolex', model: 'Submariner Date', caliber: 'cal. 1575' }, { re: /^16[0-9]{3}/, brand: 'Rolex', model: 'Oyster (16xxx family)', caliber: 'cal. 3035 / 3135' },
  { re: /^126/, brand: 'Rolex', model: '126xxx family', caliber: 'cal. 3235 / 3285' }, { re: /^116/, brand: 'Rolex', model: '116xxx family', caliber: 'cal. 3135 / 3186' }, { re: /^[A-Z]\d{6}$/, brand: 'Rolex', model: 'Letter-prefix serial (1987–2010)', caliber: 'see reference' },
];
export const decodeSerial = (serial: string, reference?: string): SerialDecode => {
  const s = serial.trim().toUpperCase(); const ref = (reference ?? '').trim().toUpperCase(); if (!s) return { brand: '', model: '', caliber: '', confidence: 'none' };
  const w = store.watches.find((x) => x.serial.toUpperCase() === s || (ref && x.reference.toUpperCase() === ref)); const cat = ref ? fx.parts.find((p) => p.compatibleRefs?.some((r) => r.toUpperCase() === ref) && p.calibers.length) : undefined;
  const hit = SERIAL_PREFIXES.find((p) => p.re.test(s.split('-')[0])); if (hit) return { brand: hit.brand, model: hit.model, caliber: hit.caliber, era: hit.era, confidence: 'prefix' };
  if (w && w.serial.toUpperCase() === s) return { brand: w.brand, model: w.model, caliber: cat?.calibers[0] ? `cal. ${cat.calibers[0]}` : 'cal. —', confidence: 'reference' };
  const hit2 = SERIAL_PREFIXES.find((p) => ref && p.re.test(ref)); return hit2 ? { brand: hit2.brand, model: hit2.model, caliber: hit2.caliber, era: hit2.era, confidence: 'prefix' } : { brand: '', model: '', caliber: '', confidence: 'none' };
};

// ---- NEW INSPECTION FORM (legacy RolliWorks structure) — learned preset-note library, per-component authenticity, bracelet repair lines, running total, tokened client report ----
import { AUTHENTICITY, BRACELET_LINES, CONDITIONS, DIAL_VARIANTS, INSPECTION_COMPONENTS, NOTE_LIBRARY, OVERALL_QUICK_TAGS, blankForm, seededForm, type InspComponent, type InspComponentEntry, type InspectionForm } from './fixtures/inspectionForm';
export { AUTHENTICITY, BRACELET_LINES, CONDITIONS, INSPECTION_COMPONENTS, type BraceletRepairLine, type InspComponent, type InspComponentEntry, type InspectionForm, type Condition, type Authenticity } from './fixtures/inspectionForm';
const insp = { forms: [seededForm] as InspectionForm[], notes: Object.fromEntries(Object.entries(NOTE_LIBRARY).map(([k, v]) => [k, [...v]])) as Record<InspComponent, string[]>, quickTags: [...OVERALL_QUICK_TAGS], dialVariants: [...DIAL_VARIANTS] };
export const inspectionNoteLibrary = (c: InspComponent) => insp.notes[c];
export const inspectionQuickTags = () => insp.quickTags;
export const dialVariantTags = () => insp.dialVariants;
// suggest-and-learn: a typed note that isn't in the library joins it (gets the next number) — same pattern as parts aliases / photo tags
export async function learnInspectionNote(c: InspComponent, text: string): Promise<number> { const t = text.trim(); if (!t) throw new Error('Empty note'); const i = insp.notes[c].findIndex((n) => n.toLowerCase() === t.toLowerCase()); if (i >= 0) return resolve(i); insp.notes[c].push(t); const a = actor(); appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, detail: `Inspection note library · ${c} · learned #${insp.notes[c].length} “${t}”` }); return resolve(insp.notes[c].length - 1); }
export async function learnDialVariant(tag: string): Promise<string[]> { const t = tag.trim().toUpperCase(); if (t && !insp.dialVariants.some((v) => v.toUpperCase() === t)) { insp.dialVariants.push(tag.trim()); const a = actor(); appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, detail: `Dial variant vocabulary · learned “${tag.trim()}”` }); } return resolve([...insp.dialVariants]); }
export async function learnQuickTag(tag: string): Promise<string[]> { const t = tag.trim(); if (t && !insp.quickTags.includes(t)) insp.quickTags.push(t); return resolve([...insp.quickTags]); }
export const inspectionTotal = (f: InspectionForm): number => {
  const comp = f.components.reduce((t, c) => t + (c.price || 0) + (c.caseRestorationPrice || 0) + (c.weldingPrice || 0) + (c.polishUpYesNo ? c.polishUpPrice || 0 : 0), 0);
  const br = f.bracelet.reduce((t, l) => t + (l.mode === 'qty_price' ? (l.qty || 0) * (l.price || 0) : l.mode === 'hours_rate' ? (l.hours || 0) * (l.rate || 0) : 0), 0);
  return Math.round((comp + br + (f.overall.price || 0)) * 100) / 100;
};
const formForJob = (jobId: string) => { const f = insp.forms.filter((x) => x.jobId === jobId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; return f ? { id: f.id, status: f.status, token: f.token, total: inspectionTotal(f) } : undefined; };
const intakeDraftForms = () => insp.forms.filter((f) => f.status === 'draft' && !f.jobId).length;
export async function listInspectionForms(): Promise<InspectionForm[]> { return resolve(insp.forms.map((f) => ({ ...f, total: inspectionTotal(f) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
export async function getInspectionForm(id: string): Promise<InspectionForm | null> { const f = insp.forms.find((x) => x.id === id); return resolve(f ? { ...f, total: inspectionTotal(f) } : null); }
export async function getInspectionFormByToken(token: string): Promise<(InspectionForm & { notesText: (c: InspComponentEntry) => string[] }) | null> { const f = insp.forms.find((x) => x.token === token && x.status === 'saved'); return resolve(f ? { ...f, total: inspectionTotal(f), notesText: (c) => c.notes.map((n) => insp.notes[c.component][n]).filter(Boolean) } : null); }
export async function newInspectionForm(seed?: { jobId?: string; estimateNumber?: string }): Promise<InspectionForm> {
  const id = newId('insp'); let f = blankForm(id, `INSP-${Date.now().toString(36).toUpperCase()}`);
  const j = seed?.jobId ? store.jobs.find((x) => x.id === seed.jobId) : seed?.estimateNumber ? store.jobs.find((x) => x.number.toUpperCase() === seed.estimateNumber!.toUpperCase()) : undefined;
  const e = j?.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : seed?.estimateNumber ? store.estimates.find((x) => x.number.toUpperCase() === seed.estimateNumber!.toUpperCase()) : undefined;
  const w = j ? store.watches.find((x) => x.id === j.watchId) : e?.watchId ? store.watches.find((x) => x.id === e.watchId) : undefined; const c = j ? fx.clients.find((x) => x.id === j.clientId) : e ? fx.clients.find((x) => x.id === e.clientId) : undefined;
  if (j || e) f = { ...f, jobId: j?.id, token: `INSP-${(j?.number ?? e?.number ?? id).toUpperCase()}-${Date.now().toString(36).slice(-3).toUpperCase()}`, customer: c ? { name: fullNameOf(c), email: c.email, phone: c.phone } : f.customer, brand: w?.brand ?? '', model: w?.model ?? '', reference: w?.reference ?? '', estimateNumber: e?.number ?? j?.number ?? '', deptTags: [...(j?.workflow ?? (e ? estimateComponentCodes(e).codes : []))], jobType: j ? j.kind.replace('_', ' ') : 'Service' };
  if (e?.targetDate) { const pk = store.packages.find((p) => p.estimateId === e.id && p.inspectedAt); f = { ...f, targetWeeks: e.targetWeeks ?? f.targetWeeks, targetFrom: (pk?.inspectedAt ?? e.createdAt).slice(0, 10), targetTo: e.targetDate, targetSource: 'receive' }; }
  insp.forms.unshift(f); return resolve({ ...f });
}
export async function saveInspectionForm(form: InspectionForm, commit: boolean): Promise<InspectionForm> {
  const i = insp.forms.findIndex((x) => x.id === form.id); if (i < 0) throw new Error('Form not found'); const a = actor();
  if (commit && !form.customer.name.trim()) throw new Error('Customer is required');
  const next: InspectionForm = { ...form, total: inspectionTotal(form), status: commit ? 'saved' : form.status, savedAt: commit ? new Date().toISOString() : form.savedAt, savedBy: commit ? a.by : form.savedBy, station: commit ? a.station : form.station };
  insp.forms[i] = next; if (commit) { appendAudit({ type: 'comms', stationName: a.station, userShortName: a.user?.shortName, detail: `Inspection form saved · ${next.estimateNumber || next.id} · ${fmtMoney(next.total)} · report ${next.token}` }); const j = next.jobId ? store.jobs.find((x) => x.id === next.jobId) : undefined; if (j) { jobStamp(j, `Inspection form saved → client report ${next.token} · ${fmtMoney(next.total)}`); if (j.status === 'intake' || j.status === 'in_review') { j.timeline.push({ id: newId('tl'), from: j.status, to: 'awaiting_customer_approval', action: 'request_approval', at: new Date().toISOString(), by: a.by, station: a.station } as Job['timeline'][number]); j.status = 'awaiting_customer_approval'; jobStamp(j, 'Inspection submitted → awaiting client approval (step 7)'); } } }
  return resolve({ ...next });
}
export async function addInspectionPhoto(id: string, p: { source: 'ipevo' | 'microscope'; dataUrl: string }): Promise<InspectionForm> { const f = insp.forms.find((x) => x.id === id); if (!f) throw new Error('Form not found'); f.photos.push({ id: newId('ip'), source: p.source, dataUrl: p.dataUrl, at: new Date().toISOString() }); return resolve({ ...f }); }
// Scantron extraction → suggested form values (numbers on the sheet = library indexes + 1). Human verifies before applying.
export interface SheetSuggestion { components: Partial<Record<InspComponent, { condition?: number; notes?: number[]; other?: string; price?: number; yesNo?: boolean; retailPolish?: boolean; caseRestoration?: number; polishUp?: boolean }>>; bracelet: Partial<Record<string, { qty?: number; price?: number; hours?: number; yesNo?: boolean; rec?: 'rec' | 'not_rec'; scale?: number; include?: boolean }>>; additionalNotes?: string; confidence: number | null; raw?: string }
export const applySheetSuggestion = (f: InspectionForm, s: SheetSuggestion, accepted: Set<string>): InspectionForm => {
  const components = f.components.map((c) => { const sg = s.components[c.component]; if (!sg || !accepted.has(c.component)) return c; const cond = sg.condition ? CONDITIONS.find((x) => x.n === sg.condition)?.key : undefined; return { ...c, condition: cond ?? c.condition, notes: sg.notes?.length ? uniq(sg.notes.map((n) => n - 1).filter((n) => n >= 0 && n < insp.notes[c.component].length)) : c.notes, otherNote: sg.other ?? c.otherNote, price: sg.price ?? c.price, yesNo: sg.yesNo ?? c.yesNo, retailPolish: sg.retailPolish ?? c.retailPolish, caseRestorationPrice: sg.caseRestoration ?? c.caseRestorationPrice, polishUpYesNo: sg.polishUp ?? c.polishUpYesNo }; });
  const bracelet = f.bracelet.map((l) => { const sg = s.bracelet[l.key]; return sg && accepted.has(`bracelet:${l.key}`) ? { ...l, ...sg } : l; });
  return { ...f, components, bracelet, overall: accepted.has('additional') && s.additionalNotes ? { ...f.overall, notes: [f.overall.notes, s.additionalNotes].filter(Boolean).join('\n') } : f.overall, sheetScan: { at: new Date().toISOString(), by: actor().by, confidence: s.confidence } };
};
void AUTHENTICITY; void BRACELET_LINES; void INSPECTION_COMPONENTS;
export const shortNameOf = (userId: string) => fx.users.find((u) => u.id === userId)?.shortName ?? userId;

export type { EstimateItem } from './items';
import { type EstimateItem, itemCodes, itemNumber, inferItemCodes, unionItemCodes } from './items';
// ---- Appointments bridge (data module lives in ./appointments.ts; these expose the store bits it needs) ----
export const actorInfo = () => actor();
// ---- Hitlist bridge (per-person hit lists, inbox, supervisor rollup live in ./hitlist.ts) ----
export const hitlistBridge = {
  users: () => fx.users, pinned: () => store.pinned, tasks: () => store.tasks, jobs: () => store.jobs, watches: () => store.watches, clients: () => fx.clients,
  stationId: () => readStation()?.id ?? 'unknown', stations: () => readStations(), division: getSessionDivision, matches: assigneeMatches, today: (userId: string) => getTodayMock(userId), newId, label: assigneeLabel, actor: () => actor(),
  audit: (detail: string) => appendAudit({ type: 'pin', stationName: actor().station, userShortName: actor().user?.shortName, userDisplayName: actor().user?.displayName, detail }),
  jobStamp: (jobId: string, detail: string) => { const j = store.jobs.find((x) => x.id === jobId); if (j) jobStamp(j, detail); },
};
// ---- Appraisal bridge (./appraisals.ts) ----
// D-085: insured (declared) values from OUTBOUND shipments of the same reference — never service invoice amounts
const insuredComps = (reference: string): { value: number; date: string; ref: string }[] => {
  const refOf = (watchId?: string) => store.watches.find((w) => w.id === watchId)?.reference;
  const fromSo = store.salesOrders.filter((o) => o.shipment && o.jobId && refOf(store.jobs.find((j) => j.id === o.jobId)?.watchId) === reference).map((o) => ({ value: o.shipment!.declaredValue, date: o.shipment!.at, ref: o.number }));
  const fromShip = shp.rows.filter((sh) => sh.direction === 'outbound' && sh.declaredValue > 0 && refOf(store.estimates.find((e) => e.id === sh.estimateId)?.watchId) === reference).map((sh) => ({ value: sh.declaredValue, date: sh.requestedAt, ref: store.estimates.find((e) => e.id === sh.estimateId)?.number ?? sh.id }));
  return [...fromSo, ...fromShip].sort((a, b) => b.date.localeCompare(a.date));
};
export const appraisalBridge = { insuredComps, jobDivision: (id: string): Division => store.jobs.find((j) => j.id === id)?.division ?? 'rolliworks', job: (id: string) => store.jobs.find((j) => j.id === id), jobs: () => store.jobs, watch: (id?: string) => store.watches.find((w) => w.id === id), client: (id: string) => fx.clients.find((c) => c.id === id), photos: (jobId: string) => getJobPhotoViews(jobId), decode: (serial: string, ref?: string) => decodeSerial(serial, ref), inspectionFor: (jobId: string) => insp.forms.find((f) => f.jobId === jobId), actor: () => actor(), newId, jobStamp: (jobId: string, detail: string) => { const j = store.jobs.find((x) => x.id === jobId); if (!j) return; jobStamp(j, detail); const a = actor(); j.notes.unshift({ id: newId('n'), text: detail, at: new Date().toISOString(), by: a.by, station: a.station }); } };
// ---- Bench-test capture bridge (before/after timing + pressure slips, tolerance sheet — ./benchTests.ts) ----
// Bench events land on the job as a note (visible on the job page) as well as in the audit log
export const benchBridge = { m3ke: (e: M3keEvent) => { m3ke.events.push(e); }, job: (id: string) => store.jobs.find((j) => j.id === id), watch: (id?: string) => store.watches.find((w) => w.id === id), decode: (serial: string, ref?: string) => decodeSerial(serial, ref), actor: () => actor(), newId, jobStamp: (jobId: string, detail: string) => { const j = store.jobs.find((x) => x.id === jobId); if (!j) return; jobStamp(j, detail); const a = actor(); j.notes.unshift({ id: newId('n'), text: detail, at: new Date().toISOString(), by: a.by, station: a.station }); } };
export const auditAppointments = (detail: string) => appendAudit({ type: 'appointments', stationName: actor().station, userShortName: actor().user?.shortName, detail });
export interface ApptRefLookup { ref: string; clientId: string; clientName: string; email: string; phone: string; watch?: string; kind: 'estimate' | 'sales_order' }
// Drop-off books against an estimate #; pick-up against a sales order # (or the SO's job #)
export const lookupApptRef = (type: 'drop_off' | 'pick_up', raw: string): ApptRefLookup | null => {
  const q = raw.trim().toUpperCase().replace(/^EST-?/, 'E');
  if (!q) return null;
  if (type === 'drop_off') { const e = store.estimates.find((x) => x.number.toUpperCase() === q); if (!e) return null; const c = byId(fx.clients, e.clientId); const w = e.watchId ? fx.watches.find((x) => x.id === e.watchId) : undefined; return { ref: e.number, clientId: c.id, clientName: fullNameOf(c), email: c.email, phone: c.phone, watch: w ? `${w.brand} ${w.model}` : undefined, kind: 'estimate' }; }
  const o = store.salesOrders.find((x) => x.number.toUpperCase() === q || (x.jobId && store.jobs.find((j) => j.id === x.jobId)?.number.toUpperCase() === q)); if (!o) return null; const c = byId(fx.clients, o.clientId); const j = o.jobId ? store.jobs.find((x) => x.id === o.jobId) : undefined; const w = j?.watchId ? fx.watches.find((x) => x.id === j.watchId) : undefined;
  return { ref: o.number, clientId: c.id, clientName: fullNameOf(c), email: c.email, phone: c.phone, watch: w ? `${w.brand} ${w.model}` : undefined, kind: 'sales_order' };
};
export const clientBrief = (clientId: string) => { const c = fx.clients.find((x) => x.id === clientId); return c ? { clientName: fullNameOf(c), email: c.email, phone: c.phone } : null; };

// ---- Scan 1 · Arrival as a bulk session: scan, scan, scan → Commit (same pattern as the Assign/Move click map). Nothing is logged until Commit.
export interface ArrivalRow { id: string; tracking: string; carrier: Carrier; matched: 'label_request' | 'known' | 'none' | 'duplicate'; clientId?: string; clientName?: string; estimateNumber?: string; manualClientId?: string }
export const previewArrival = (raw: string, carrier?: Carrier): ArrivalRow => {
  const tracking = raw.trim(); const dup = store.packages.find((p) => p.trackingNumber === tracking);
  const sh = shp.rows.find((r) => r.trackingNumber === tracking && r.direction === 'inbound'); const c = sh ? fx.clients.find((x) => x.id === sh.clientId) : undefined; const est = sh ? store.estimates.find((e) => e.id === sh.estimateId) : undefined;
  return { id: `ar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, tracking, carrier: carrier ?? detectCarrier(tracking), matched: dup ? 'duplicate' : sh ? 'label_request' : 'none', clientId: c?.id, clientName: c ? fullNameOf(c) : undefined, estimateNumber: est?.number };
};
export interface ArrivalCommitResult { row: ArrivalRow; ok: boolean; pkg?: PackageWithRefs; bin?: string; error?: string }
export async function commitArrivals(rows: ArrivalRow[], signature: boolean): Promise<ArrivalCommitResult[]> {
  const out: ArrivalCommitResult[] = [];
  for (const row of rows) {
    try {
      const pkg = await logArrival({ source: 'carrier', trackingNumber: row.tracking, carrier: row.carrier, signatureNoted: signature });
      const free = SHELF_BINS.find((b) => !store.packages.some((p) => p.status === 'arrived' && p.shelfBin === b)); if (!free) throw new Error('No free shelf bin');
      const shelved = await shelvePackage(pkg.id, { shelfBin: free, clientId: !pkg.clientId && row.manualClientId ? row.manualClientId : undefined });
      out.push({ row, ok: true, pkg: shelved, bin: shelved.shelfBin });
    } catch (e) { out.push({ row, ok: false, error: e instanceof Error ? e.message : 'Failed' }); }
  }
  const a = actor(); appendAudit({ type: 'intake', stationName: a.station, userShortName: a.user?.shortName, detail: `Scan 1 · bulk commit · ${out.filter((x) => x.ok).length}/${rows.length} packages shelved` });
  return resolve(out);
}

// ---- MH-only: zero balance / mark paid WITHOUT QBO sync (barter or internal work — no money changed hands, must not inflate revenue) ----
export const ZERO_REASON_LABEL: Record<ZeroBalanceReason, string> = { barter_client: 'Barter (client)', barter_b2b: 'Barter (B2B)', internal_work: 'Internal work' };
export async function zeroBalanceNoSync(id: string, reason: ZeroBalanceReason, notes: string): Promise<SalesOrderWithRefs> {
  if (!isOwnerSync()) throw new Error('Zero balance — no QBO sync is an MH-only action');
  const o = getSO(id);
  if (!['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Order must be open or fulfilled');
  if (o.balanceDue <= 0) throw new Error('Balance is already $0');
  if (!ZERO_REASON_LABEL[reason]) throw new Error('Pick a reason category'); if (!notes.trim()) throw new Error('Notes are required — what was exchanged / why no cash');
  const a = actor(); const at = new Date().toISOString(); const amount = Math.round(o.balanceDue * 100) / 100;
  o.payments.push({ id: newId('pay'), amount, method: 'zero_balance', note: `Zero balance — ${ZERO_REASON_LABEL[reason]}`, at, by: a.by, station: a.station });
  o.zeroBalance = { reason, notes: notes.trim(), amount, by: a.by, at, station: a.station }; o.qboStatus = 'excluded'; o.qboInvoiceId = undefined; soTotals(o);
  soStamp(o, `ZERO BALANCE — NO QBO SYNC · ${fmtMoney(amount)} · ${ZERO_REASON_LABEL[reason]} · ${notes.trim()} · by ${a.by}`);
  // auto-route to fulfillment: shipping product on the order → Ship cart, otherwise → Pickup cart
  const hasShipping = o.shippingAmount > 0 || o.lines.some((l) => /shipping|insured ship|ship /i.test(l.description));
  if (o.status !== 'fulfilled' || !o.channel) { await setFulfillmentChannel(o.id, hasShipping ? 'ship' : 'pickup'); }
  appendAudit({ type: 'accounting', stationName: a.station, userShortName: a.user?.shortName, detail: `Zero balance — no QBO sync · ${o.number}${o.jobId ? ` · job ${store.jobs.find((j) => j.id === o.jobId)?.number ?? ''}` : ''} · ${fmtMoney(amount)} · ${ZERO_REASON_LABEL[reason]} · ${notes.trim()}` });
  return resolve(soRefs(o));
}
export interface ZeroBalanceRow { salesOrderId: string; number: string; jobNumber?: string; client: string; amount: number; reason: ZeroBalanceReason; notes: string; by: string; at: string; station: string }
// Reconciliation trail against QBO — every zero-balanced invoice (seeded + live)
export const zeroBalanceLog = (): ZeroBalanceRow[] => store.salesOrders.filter((o) => o.zeroBalance).map((o) => ({ salesOrderId: o.id, number: o.number, jobNumber: o.jobId ? store.jobs.find((j) => j.id === o.jobId)?.number : undefined, client: fullNameOf(byId(fx.clients, o.clientId)), amount: o.zeroBalance!.amount, reason: o.zeroBalance!.reason, notes: o.zeroBalance!.notes, by: o.zeroBalance!.by, at: o.zeroBalance!.at, station: o.zeroBalance!.station })).sort((a, b) => b.at.localeCompare(a.at));

// ---- Sales order Fulfill menu actions (ported from the legacy SO screen) ----
export async function sendSoReminder(id: string, kind: 'pickup' | 'payment', channel: 'email' | 'sms'): Promise<SalesOrderWithRefs> {
  const o = getSO(id); if (o.status === 'draft' || o.status === 'cancelled') throw new Error('Open the order first');
  if (kind === 'payment' && o.balanceDue <= 0) throw new Error('Nothing owed — order is paid'); if (kind === 'pickup' && o.channel !== 'pickup') throw new Error('Push to Pickup Station first');
  const c = byId(fx.clients, o.clientId); const a = actor();
  const text = kind === 'pickup' ? `Your watch is ready for pickup at RolliWorks. Verification code ${o.pickupCode ?? '—'}.` : `Friendly reminder: ${fmtMoney(o.balanceDue)} is due on ${o.number}. Pay online with your secure link or at the counter.`;
  if (channel === 'email') soEmail(o, kind === 'pickup' ? 'Pickup reminder' : 'Payment reminder', text, kind === 'payment' ? `/pay/${o.payLinkToken}` : undefined);
  else queueOutbox({ id: `ob-${Date.now().toString(36)}`, to: c.phone || '(no phone on file)', toName: fullNameOf(c), relatedRef: o.number, status: 'pending', subject: `SMS → ${c.phone || 'no phone'} — ${o.number}`, body: text, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station });
  soStamp(o, `${kind === 'pickup' ? 'Pickup' : 'Payment'} reminder ${channel.toUpperCase()} queued`); return resolve(soRefs(o));
}
// ---- QBO stub · VB4-09 (mock, but modelled on Intuit semantics) ----------------------------------------------------
// SyncToken: every successful write increments it; a write carrying a stale token is rejected (Intuit error 5010) — the caller must re-read (getInvoiceLink) and retry.
// The payment webhook never flips the gate by itself: it lands on the "remote" ledger, then a balance re-read reconciles the local SO, and the gate (isPaid) is DERIVED from that.
const qboRemote = new Map<string, { balance: number; syncToken: number }>();
const qboRemoteOf = (o: SalesOrder) => { const r = qboRemote.get(o.id) ?? { balance: o.balanceDue, syncToken: o.qboSyncToken ?? 0 }; qboRemote.set(o.id, r); return r; };
export interface InvoiceLink { salesOrderId: string; number: string; url: string; total: number; balanceDue: number; isPaid: boolean; syncToken: number; gateOpen: boolean }
const invoiceLink = (o: SalesOrder): InvoiceLink => ({ salesOrderId: o.id, number: o.number, url: payLinkPath(o), total: o.total, balanceDue: o.balanceDue, isPaid: o.isPaid, syncToken: o.qboSyncToken ?? 0, gateOpen: o.isPaid });
export async function getInvoiceLink(id: string): Promise<InvoiceLink> { const o = getSO(id); return resolve(invoiceLink(o)); }
export interface UpdateInvoicePatch { lines?: SOLineInput[]; shippingAmount?: number; memo?: string }
// Sparse update: only the fields present change (Intuit "sparse: true"). Requires the current SyncToken.
export async function updateInvoice(id: string, patch: UpdateInvoicePatch, syncToken: number): Promise<InvoiceLink> {
  const o = getSO(id); const current = o.qboSyncToken ?? 0;
  if (syncToken !== current) { soStamp(o, `QBO update rejected · stale SyncToken ${syncToken} (server ${current}) · re-read required`); throw new Error(`Stale SyncToken — you sent ${syncToken}, the invoice is at ${current}. Re-read the invoice and retry.`); }
  const wasPaid = o.isPaid;
  await updateSalesOrder(id, patch);
  o.qboSyncToken = current + 1; o.qboLastSyncedAt = new Date().toISOString(); qboRemote.set(o.id, { balance: o.balanceDue, syncToken: o.qboSyncToken });
  soStamp(o, `QBO sparse update · SyncToken ${current} → ${o.qboSyncToken}${wasPaid && !o.isPaid ? ' · balance reopened — payment gate closed, order leaves the ship cart' : ''} · same payment link, new total ${fmtMoney(o.total)}`);
  return resolve(invoiceLink(o));
}
// Mock of the Intuit payment webhook: lands on the remote ledger only; the gate flips after the balance re-read below.
export async function simulatePaymentWebhook(id: string, amount?: number): Promise<{ remoteBalance: number; link: InvoiceLink }> {
  const o = getSO(id); const r = qboRemoteOf(o); const paid = Math.min(amount ?? r.balance, r.balance); r.balance = Math.round((r.balance - paid) * 100) / 100;
  soStamp(o, `QBO webhook received · payment ${fmtMoney(paid)} · remote balance ${fmtMoney(r.balance)} · gate unchanged until balance re-read`);
  const link = await qboReadBalance(id);
  return resolve({ remoteBalance: r.balance, link });
}
// Balance re-read: reconcile local balance to the remote ledger; isPaid (the gate) is derived, never set by the webhook directly.
export async function qboReadBalance(id: string): Promise<InvoiceLink> {
  const o = getSO(id); const r = qboRemoteOf(o); const diff = Math.round((o.balanceDue - r.balance) * 100) / 100;
  if (diff > 0) { await recordPayment(id, diff, 'card', 'QBO balance re-read · payment webhook reconciled'); soStamp(o, `QBO balance re-read · applied ${fmtMoney(diff)} · gate ${o.isPaid ? 'OPEN' : 'closed'}`); }
  o.qboLastSyncedAt = new Date().toISOString();
  return resolve(invoiceLink(o));
}
// Ship cart = ship-channel orders whose payment gate is open (isPaid); an edit that reopens the balance removes the order here
export async function getShipCart(): Promise<SalesOrderWithRefs[]> { return resolve(store.salesOrders.filter((o) => ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status) && o.channel === 'ship' && o.isPaid).map(soRefs)); }

export async function qboSyncInvoice(id: string, direction: 'pull' | 'push'): Promise<SalesOrderWithRefs> {
  const o = getSO(id); managerOnly();
  if (o.zeroBalance) throw new Error(`${o.number} is zero-balanced (${ZERO_REASON_LABEL[o.zeroBalance.reason]}) — excluded from QuickBooks revenue, nothing to sync`);
  if (o.status === 'draft') throw new Error('Open the order before syncing');
  if (direction === 'push') { o.qboInvoiceId ??= `QBO-STUB-${10000 + store.salesOrders.length * 7 + Math.floor(Math.random() * 90)}`; o.qboStatus = 'queued'; qboLog(`Push edits · invoice ${o.number} → ${o.qboInvoiceId} (stub, queued)`); soStamp(o, `Edits pushed to QuickBooks · ${o.qboInvoiceId} (stub)`); }
  else { qboLog(`Sync from QuickBooks · ${o.number} (stub — no remote changes)`); soStamp(o, 'Synced from QuickBooks (stub) — no changes found'); }
  return resolve(soRefs(o));
}
export async function deleteSalesOrder(id: string): Promise<void> {
  const o = getSO(id); if (o.status !== 'draft') throw new Error('Only drafts can be deleted — cancel the order instead (history is kept)');
  store.salesOrders.splice(store.salesOrders.indexOf(o), 1); const a = actor(); appendAudit({ type: 'accounting', stationName: a.station, userShortName: a.user?.shortName, detail: `Draft ${o.number} deleted` }); return resolve(undefined);
}

// ---- SHOP WORK ORDERS (SWO) — outsourced work (plating / refinish) sent to outside vendors. Linear 5-stage flow + independent Paid flag. ----
// CONCIERGE board (2026-09-29) — lane shape by "do we ship to them?": ships → queue · sent(In route) · at_vendor(In progress) · inbound(Returning) · received · inspection · fulfilled; no-ship → queue · at_vendor · inspection · fulfilled
export type SwoStage = 'queue' | 'sent' | 'at_vendor' | 'inbound' | 'received' | 'inspection' | 'fulfilled' | 'redo_sent' | 'redo_at_vendor' | 'redo_inbound' | 'redo_received';
// Redo legs live on the JOB's flow only — the lane never changes; for counting they fold into their base stage
export const baseStage = (k: SwoStage): Exclude<SwoStage, `redo_${string}`> => k.replace(/^redo_/, '') as Exclude<SwoStage, `redo_${string}`>;
export const isRedoStage = (k: SwoStage) => k.startsWith('redo_');
export const SWO_STAGES: { key: SwoStage; label: string; blurb: string }[] = [
  { key: 'queue', label: 'In queue', blurb: 'approved for outsource · not yet sent / handed off' }, { key: 'sent', label: 'In route', blurb: 'outbound label created · in transit to vendor' }, { key: 'at_vendor', label: 'In progress', blurb: 'with the vendor (or in Chyna’s hands)' }, { key: 'inbound', label: 'Returning', blurb: 'return label + vendor email · in transit to shop' }, { key: 'received', label: 'Received', blurb: 'arrival scan · custody back at shop' }, { key: 'inspection', label: 'Inspection', blurb: 'shop post-return QC check' }, { key: 'fulfilled', label: 'Fulfilled', blurb: 'outsourced portion closed · item back in its job’s normal flow' },
];
export const SHIP_LANE: SwoStage[] = ['queue', 'sent', 'at_vendor', 'inbound', 'received', 'inspection', 'fulfilled'];
export const NOSHIP_LANE: SwoStage[] = ['queue', 'at_vendor', 'inspection', 'fulfilled'];
export const laneStagesFor = (v: Vendor): SwoStage[] => (v.ships === false ? NOSHIP_LANE : SHIP_LANE);
export const swoStageLabel = (k: SwoStage) => `${isRedoStage(k) ? 'Redo: ' : ''}${SWO_STAGES.find((x) => x.key === baseStage(k))!.label}${isRedoStage(k) ? '' : ''}`.replace('Redo: In route', 'Redo: in route').replace('Redo: In progress', 'Redo: in progress').replace('Redo: Returning', 'Redo: returning').replace('Redo: Received', 'Redo: received');
// Full per-job path incl. redo legs: what comes after `stage` for this vendor
export const nextSwoStage = (v: Vendor, stage: SwoStage): SwoStage | undefined => { const ship = v.ships !== false; const map: Partial<Record<SwoStage, SwoStage>> = ship ? { queue: 'sent', sent: 'at_vendor', at_vendor: 'inbound', inbound: 'received', received: 'inspection', inspection: 'fulfilled', redo_sent: 'redo_at_vendor', redo_at_vendor: 'redo_inbound', redo_inbound: 'redo_received', redo_received: 'inspection' } : { queue: 'at_vendor', at_vendor: 'inspection', inspection: 'fulfilled', redo_at_vendor: 'inspection' }; return map[stage]; };
export const prevSwoStage = (v: Vendor, stage: SwoStage): SwoStage | undefined => { const all: SwoStage[] = ['queue', 'sent', 'at_vendor', 'inbound', 'received', 'inspection', 'fulfilled', 'redo_sent', 'redo_at_vendor', 'redo_inbound', 'redo_received']; if (stage === 'inspection') return undefined; return all.find((k) => nextSwoStage(v, k) === stage); };
export interface SwoCustoms { contents: string; value: number; hsCode: string; origin: string; incoterm: 'DAP' | 'DDP' }
export interface SwoLabel { direction: 'outbound' | 'return'; carrier: 'FedEx' | 'UPS' | 'DHL Express'; service: string; tracking: string; international: boolean; customs?: SwoCustoms; cost: number; createdAt: string; createdBy: string; emailedAt?: string }
export type PayMethod = 'card' | 'ACH' | 'wire' | 'check' | 'PayPal' | 'cash';
export interface VendorInvoice { id: string; number: string; vendorRef?: string; amount: number; date: string; attachment?: string; charge?: 'work' | 'redo'; enteredBy: string; enteredAt: string; paid?: { at: string; method: PayMethod; ourRef: string; by: string; overrideReason?: string }; qboBillId?: string; qboBillPaymentId?: string }
export interface RedoCycle { n: number; reason: string; photo?: string; startedAt: string; by: string }
export interface VendorReply { at: string; by: string; text: string; newExpectedAt?: string }
// `paid` is DERIVED (any invoice with a Paid record) — kept on the row for the old readers; `predictedCompletion` = EXPECTED completion date (required at creation)
export interface Swo { id: string; number: string; vendorId: string; jobId: string; synth?: { jobNumber: string; clientName: string; watchLabel: string; reference: string }; components: ComponentKey[]; work: string; stage: SwoStage; stageAt?: string; pointPerson?: string; invoices: VendorInvoice[]; redoCycles: RedoCycle[]; vendorReplies: VendorReply[]; statusRequests: { at: string; by: string; level: string }[]; paid: boolean; paidAt?: string; paidBy?: string; vendorInvoiceTotal: number; vendorInvoiceNumber?: string; qboStatus: 'not_queued' | 'queued'; qboBillId?: string; predictedCompletion?: string; sentAt?: string; atVendorAt?: string; inboundAt?: string; receivedAt?: string; outbound?: SwoLabel; returnLabel?: SwoLabel; notes?: string; createdAt: string; createdBy: string; timeline: { at: string; by: string; text: string }[]; hubId?: string; sentParts?: SentPart[] }
// SWO RE-MODEL (MH 2026-09-30): a Swo row is a LINE (one job component + what was sent) inside a SwoHub CONTAINER (the box that goes to the vendor). See the SWO HUBS section.
export interface SentPart { key: string; label: string; returned?: boolean; custom?: boolean }
export interface SwoWithRefs extends Swo { vendor: Vendor; job: JobWithRefs; jobNumber: string; clientName: string; watchLabel: string; international: boolean; custodyHolder: string; daysOut?: number; overdue: boolean }
export interface SwoInput { id?: string; vendorId: string; jobId: string; components: ComponentKey[]; work: string; vendorInvoiceTotal: number; vendorInvoiceNumber?: string; predictedCompletion?: string; pointPerson?: string; notes?: string }
// Expected-date default: vendor turnaround + shipping days each way (domestic 2 / intl 5) for shipping vendors
export const shipDaysFor = (v: Vendor) => (v.ships === false ? 0 : isInternationalVendor(v) ? 5 : 2);
export const defaultExpectedAt = (v: Vendor, from = new Date()) => new Date(from.getTime() + ((v.leadTimeDays ?? 10) + 2 * shipDaysFor(v)) * 86_400_000).toISOString().slice(0, 10);
const swos: Swo[] = []; let swoSeeded = false; let swoSeq = 40;
const swoStamp = (w: Swo, text: string) => { const a = actor(); const tag = w.hubId && swos.filter((x) => x.hubId === w.hubId).length > 1 ? `[${(w.synth?.jobNumber ?? store.jobs.find((j) => j.id === w.jobId)?.number ?? '').replace(/^E/, '')}] ` : ''; w.timeline.unshift({ at: new Date().toISOString(), by: a.by, text: `${tag}${text}` }); };
export const isInternationalVendor = (v: Vendor) => !!v.country && v.country !== 'US';
const swoCustoms = (w: Swo, v: Vendor): SwoCustoms => { const j = getJobRow(w.jobId); const watch = j.watchId ? fx.watches.find((x) => x.id === j.watchId) : undefined; return { contents: `Watch ${w.components.join(' / ')} for refinishing — ${watch ? `${watch.brand} ${watch.model}` : 'wristwatch'} (repair & return)`, value: Math.max(500, Math.round((watch ? 6000 : 4000) * 0.25)), hsCode: w.components.includes('band') ? '9113.20' : '9111.20', origin: 'CH', incoterm: v.terms === 'Prepaid' ? 'DAP' : 'DDP' }; };
const swoTracking = (carrier: SwoLabel['carrier']) => (carrier === 'DHL Express' ? `${Math.floor(1000000000 + Math.random() * 8999999999)}` : carrier === 'UPS' ? `1Z8W${Math.random().toString(36).slice(2, 8).toUpperCase()}${Math.floor(1000000000 + Math.random() * 8999999999)}` : `${Math.floor(700000000000 + Math.random() * 99999999999)}`);
// Custody: while out with a vendor the components are a REAL custody state, just off-premises — holder `vendor:<id>`
const setSwoCustody = (w: Swo, holder: string | null, note: string) => { const j = getJobRow(w.jobId); const comps = ensureParts(j); const a = actor(); comps.filter((c) => w.components.includes(c.key)).forEach((c) => { const to = holder ?? a.by; c.history = c.history ?? []; c.history.push({ at: new Date().toISOString(), by: a.by, from: c.station, to: c.station, status: c.partStatus ?? 'in_progress', via: 'system', note }); c.custodyTech = to; }); };
// Synthetic seed SWOs (volume seed, 10 per stage per lane) carry denormalized refs and no parent job row — real jobs keep the component-wait chips
const swoRefsSynth = (w: Swo): SwoWithRefs => { const v = byId(rs.vendors, w.vendorId); const out = ['sent', 'at_vendor', 'inbound'].includes(baseStage(w.stage)); const start = w.sentAt ?? w.createdAt; return { ...w, vendor: v, job: null as unknown as JobWithRefs, jobNumber: w.synth!.jobNumber, clientName: w.synth!.clientName, watchLabel: w.synth!.watchLabel, custodyHolder: out ? `At vendor: ${v.name}` : w.stage === 'fulfilled' ? 'Back in job flow' : 'Shop', daysOut: Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86_400_000)), overdue: swoIsLate(w), international: isInternationalVendor(v) }; };
const swoRefs = (w: Swo): SwoWithRefs => { if (w.synth) return swoRefsSynth(w); const v = byId(rs.vendors, w.vendorId); const j = getJobRow(w.jobId); const c = byId(fx.clients, j.clientId); const watch = j.watchId ? fx.watches.find((x) => x.id === j.watchId) : undefined; const out = w.stage === 'sent' || w.stage === 'at_vendor' || w.stage === 'inbound'; const holder = out ? `At vendor: ${v.name}` : w.stage === 'received' ? (ensureParts(j).find((p) => w.components.includes(p.key))?.custodyTech ?? 'Shop') : 'Shop (queued)'; const start = w.sentAt ?? w.createdAt; return { ...w, vendor: v, job: jobRefs(j), jobNumber: j.number, clientName: fullNameOf(c), watchLabel: watch ? `${watch.brand} ${watch.model}` : '—', international: isInternationalVendor(v), custodyHolder: holder, daysOut: out ? Math.round((Date.now() - new Date(start).getTime()) / 86_400_000) : undefined, overdue: out && !!w.predictedCompletion && w.predictedCompletion < new Date().toISOString().slice(0, 10) }; };
const mkSwo = (id: string, n: number, vendorId: string, jobId: string, components: ComponentKey[], work: string, stage: SwoStage, o: Partial<Swo> & { daysAgo: number }): Swo => {
  const at = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString(); const v = byId(rs.vendors, vendorId); const intl = isInternationalVendor(v);
  const w: Swo = { id, number: `SWO?${n}`, vendorId, jobId, components, work, stage, paid: false, vendorInvoiceTotal: 0, qboStatus: 'not_queued', pointPerson: 'Vienna', invoices: [], redoCycles: [], vendorReplies: [], statusRequests: [], createdAt: at(o.daysAgo), createdBy: 'Walter', timeline: [{ at: at(o.daysAgo), by: 'Walter', text: 'Queued for outsource' }], ...o };
  w.predictedCompletion ??= defaultExpectedAt(v, new Date(w.createdAt)); w.paid = w.invoices.some((i) => !!i.paid) || w.paid;
  const idx = v.ships === false ? -1 : SWO_STAGES.findIndex((s) => s.key === baseStage(stage));
  if (idx >= 1 && !w.outbound) { w.sentAt ??= at(o.daysAgo - 1); w.outbound = { direction: 'outbound', carrier: intl ? 'DHL Express' : 'FedEx', service: intl ? 'Express Worldwide' : 'Priority Overnight', tracking: swoTracking(intl ? 'DHL Express' : 'FedEx'), international: intl, customs: intl ? swoCustoms(w, v) : undefined, cost: intl ? 148.2 : 62.4, createdAt: w.sentAt, createdBy: 'Vienna' }; w.timeline.unshift({ at: w.sentAt, by: 'Vienna', text: `Outbound label created · ${w.outbound.carrier} ${w.outbound.tracking}${intl ? ' · customs attached' : ''}` }); }
  if (idx >= 2) { w.atVendorAt ??= at(Math.max(0, o.daysAgo - 3)); w.timeline.unshift({ at: w.atVendorAt, by: 'System', text: `Delivered to ${v.name} — in progress` }); }
  if (idx >= 3) { w.inboundAt ??= at(Math.max(0, o.daysAgo - 9)); w.timeline.unshift({ at: w.inboundAt, by: 'System', text: `Vendor shipped back · ${w.returnLabel?.tracking ?? 'tracking pending'}` }); }
  if (idx >= 4) { w.receivedAt ??= at(Math.max(0, o.daysAgo - 11)); w.timeline.unshift({ at: w.receivedAt, by: 'Chyna', text: 'Received back at shop — custody returned' }); }
  return w;
};
// VOLUME SEED — ten jobs in EVERY stage of EVERY lane (4×10 + 4×7×10 = 320), realistic names / models / dates, v2 mix preserved (late + on-track in every In progress, redos on Jacques + Chronosky, Chronosky prepaid-not-back, unpaid invoices)
const SEED_FIRST = ['Naomi', 'Daniel', 'Grace', 'Victoria', 'Camille', 'Julian', 'Priya', 'Marcus', 'Elena', 'Theo', 'Sofia', 'Hiro', 'Amara', 'Lucas', 'Isabelle', 'Rafael', 'Mei', 'Oliver', 'Zara', 'Henrik', 'Layla', 'Sebastian', 'Nadia', 'Felix', 'Ingrid', 'Omar', 'Chloe', 'Mateo', 'Yuki', 'Aiden'];
const SEED_LAST = ['Castellanos', 'Moreau', 'Nakamura', 'Rosenthal', 'Beaumont', 'Okafor', 'Lindqvist', 'Haddad', 'Fitzgerald', 'Varga', 'Delacroix', 'Tanaka', 'Whitfield', 'Marchetti', 'Sørensen', 'Abernathy', 'Kowalski', 'Nguyen', 'Duarte', 'Hoffmann', 'Reyes', 'Ashworth', 'Petrova', 'Brennan', 'Sato', 'Villanueva', 'Grant', 'Ibrahim', 'Laurent', 'Chen'];
const SEED_WATCH: [string, string][] = [['Submariner Date', '126610LN'], ['Datejust 41', '126334'], ['GMT-Master II', '126710BLRO'], ['Daytona', '116500LN'], ['Day-Date 40', '228238'], ['Explorer II', '226570'], ['Sea-Dweller', '126600'], ['Yacht-Master 40', '126622'], ['Oyster Perpetual 41', '124300'], ['Lady-Datejust', '279174'], ['Sky-Dweller', '326934'], ['Air-King', '126900'], ['Milgauss', '116400GV'], ['Cellini Time', '50509'], ['Datejust 36', '126234']];
const SEED_WORK: Record<string, string[]> = { 'v-cm': ['Client prep — polish cloth, box & papers check', 'Pickup call + confirm appointment', 'Insurance letter for client', 'Photograph for client update', 'Sizing check with client at counter', 'Strap change + buckle swap', 'Box & papers reunification', 'Warranty card fill-in + stamp', 'Final wipe-down + presentation tray', 'Client walkthrough'], 'v-claudio': ['Gold bracelet — re-tighten links', 'Yellow-gold Jubilee — stretch repair', 'Gold Oyster — end-link rebuild', 'Clasp re-plate + spring replace', 'Gold Oysterlock — pin & tube set'], 'v-jacques': ['Rose-gold President — link rebuild', 'Two-tone Jubilee — center links', 'Gold clasp re-manufacture', 'President — hidden clasp restore', 'Solid end links — 18k'], 'v-james': ['Dial + hands relume', 'Hands relume only', 'Full dial relume — tritium tone', 'Bezel pearl relume', 'Dial relume + hand set'], 'v-chronosky': ['Full service — cal. 3135', 'Full service — cal. 3235', 'Full service — cal. 3186 GMT', 'Full service — cal. 4130 chrono', 'Full service — cal. 2235'] };
const REDO_REASONS = ['Two center links brushed instead of polished', 'Amplitude below spec after 24 h', 'Chronograph reset off zero', 'Lume tone mismatch under UV', 'Clasp spring too soft'];
type SeedMk = (vendorId: string, jobId: string, comps: ComponentKey[], work: string, stage: SwoStage, o: Partial<Swo> & { daysAgo: number }) => Swo;
type SeedInv = (id: string, number: string, amount: number, daysAgoInv: number, paid?: { daysAgo: number; method: PayMethod; ourRef: string; by: string; bill: string }, charge?: 'work' | 'redo') => VendorInvoice;
const seedSwoVolume = (mk: SeedMk, inv: SeedInv, ago: (n: number) => string, d: (n: number) => string) => {
  let k = 0; const pick = <T,>(arr: T[]) => arr[k++ % arr.length]; let jobSeq = 2100; let invSeq = 7000; const PP = ['Vienna', 'JV', 'MM', 'Walter'];
  const vendors = rs.vendors.filter((v) => v.kind === 'outsource' && v.active);
  // SWO re-model: ONE synthetic line fills each empty vendor·stage cell; a few cells get extra lines so multi-line boxes exist (Claudio 3 bracelets, Chronosky 4 watches, the mixed James box)
  const EXTRA: Record<string, number> = { 'v-claudio:at_vendor': 3, 'v-chronosky:at_vendor': 4, 'v-james:at_vendor': 4, 'v-james:inbound': 4 };
  for (const v of vendors) for (const st of laneStagesFor(v)) {
    const have = swos.filter((w) => w.vendorId === v.id && baseStage(w.stage) === st).length; const want = Math.max(have ? 0 : 1, (EXTRA[`${v.id}:${st}`] ?? 0) - have);
    for (let i = have; i < have + want; i++) {
      const [model, ref] = pick(SEED_WATCH); const client = `${pick(SEED_FIRST)} ${pick(SEED_LAST)}`; const jobNumber = String(++jobSeq).padStart(5, '0'); const comp: ComponentKey = v.id === 'v-claudio' || v.id === 'v-jacques' ? 'band' : 'head';
      const late = st === 'at_vendor' || st === 'inbound' || st === 'sent' ? i % 2 === 1 : false; const idx = SHIP_LANE.indexOf(st); const daysAgo = 2 + idx * 4 + (i % 5) * 3;
      const stageAgo = st === 'fulfilled' ? 3 + i : Math.min(daysAgo, 1 + (i % 9)); const expected = late ? d(-(1 + (i % 12))) : st === 'fulfilled' || st === 'received' || st === 'inspection' ? d(-(2 + i)) : d(2 + (i % 20));
      const redo = (v.id === 'v-jacques' || v.id === 'v-chronosky') && st === 'at_vendor' && i >= 7; const stage: SwoStage = redo ? 'redo_at_vendor' : st;
      const o: Partial<Swo> & { daysAgo: number } = { daysAgo, stageAt: ago(stageAgo), pointPerson: v.id === 'v-cm' ? 'Chyna' : PP[i % PP.length], predictedCompletion: expected, synth: { jobNumber, clientName: client, watchLabel: `Rolex ${model}`, reference: ref } };
      if (redo) o.redoCycles = [{ n: 1, reason: pick(REDO_REASONS), startedAt: ago(stageAgo + 2), by: 'MM' }];
      if (v.ships !== false) { const amount = v.id === 'v-chronosky' ? 1250 + (i % 4) * 200 : 260 + (i % 6) * 120; const num = `${v.name.slice(0, 2).toUpperCase()}-${++invSeq}`;
        const paidNow = v.id === 'v-chronosky' ? st !== 'queue' : st === 'fulfilled' || (st === 'received' && i % 2 === 0) || (st === 'inspection' && i % 3 === 0);
        if (st !== 'queue' && st !== 'sent' || v.id === 'v-chronosky' && st !== 'queue') o.invoices = [inv(`vi-${v.id}-${st}-${i}`, num, amount, daysAgo - 1, paidNow ? { daysAgo: Math.max(0, daysAgo - 2), method: v.id === 'v-chronosky' ? 'ACH' : (['card', 'wire', 'check'] as PayMethod[])[i % 3], ourRef: `${v.id === 'v-chronosky' ? 'ACH' : 'REF'}-${5600 + invSeq % 1000}`, by: 'MH', bill: `QBO-BILL-STUB-${4000 + invSeq}` } : undefined)];
        if (paidNow) { o.qboStatus = 'queued'; o.qboBillId = `QBO-BILL-STUB-${4000 + invSeq}`; } }
      swos.push(mk(v.id, 'j-01', [comp], pick(SEED_WORK[v.id] ?? SEED_WORK['v-cm']), stage, o));
    }
  }
};
const seedSwo = () => {
  if (swoSeeded) return; swoSeeded = true;
  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10); const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const retIt: SwoLabel = { direction: 'return', carrier: 'DHL Express', service: 'Express Worldwide (prepaid)', tracking: swoTracking('DHL Express'), international: true, customs: { contents: 'Returned gold bracelet after repair — repair & return, no sale', value: 4200, hsCode: '9113.10', origin: 'IT', incoterm: 'DAP' }, cost: 148.2, createdAt: ago(9), createdBy: 'Vienna', emailedAt: ago(9) };
  const retUs: SwoLabel = { direction: 'return', carrier: 'FedEx', service: 'Priority Overnight (prepaid)', tracking: swoTracking('FedEx'), international: false, cost: 64.1, createdAt: ago(5), createdBy: 'Vienna', emailedAt: ago(5) };
  let n = 40; const mk = (vendorId: string, jobId: string, comps: ComponentKey[], work: string, stage: SwoStage, o: Partial<Swo> & { daysAgo: number }) => mkSwo(`swo-${String(++n).padStart(2, '0')}`, n, vendorId, jobId, comps, work, stage, o);
  const cm = (jobId: string, work: string, stage: SwoStage, daysAgo: number, extra: Partial<Swo> = {}) => mk('v-cm', jobId, ['head'], work, stage, { daysAgo, stageAt: ago(Math.max(0, daysAgo - 1)), pointPerson: 'Chyna', predictedCompletion: d(2 - daysAgo), ...extra });
  const inv = (id: string, number: string, amount: number, daysAgoInv: number, paid?: { daysAgo: number; method: PayMethod; ourRef: string; by: string; bill: string }, charge: 'work' | 'redo' = 'work'): VendorInvoice => ({ id, number, amount, date: ago(daysAgoInv).slice(0, 10), charge, enteredBy: 'Vienna', enteredAt: ago(daysAgoInv), paid: paid ? { at: ago(paid.daysAgo), method: paid.method, ourRef: paid.ourRef, by: paid.by } : undefined, qboBillId: paid ? paid.bill : undefined, qboBillPaymentId: paid ? paid.bill.replace('BILL', 'BILLPAY') : undefined });
  const target = (jobId: string, iso: string) => { const j = store.jobs.find((x) => x.id === jobId); if (j) j.targetDate = iso.slice(0, 10); };
  swos.push(
    // Claudio — California, ships (domestic), pay on receipt
    mk('v-claudio', 'j-17', ['band'], 'Gold bracelet — re-tighten links, replace 2 screws', 'queue', { daysAgo: 1, pointPerson: 'Vienna', predictedCompletion: d(13) }),
    mk('v-claudio', 'j-06', ['band'], 'Yellow-gold Jubilee — stretch repair + clasp re-plate', 'at_vendor', { daysAgo: 6, pointPerson: 'JV', predictedCompletion: d(6), stageAt: ago(4), invoices: [inv('vi-01', 'CL-1187', 640, 6, { daysAgo: 6, method: 'card', ourRef: 'AMEX-2291', by: 'MH', bill: 'QBO-BILL-STUB-3102' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3102' }),
    mk('v-claudio', 'j-30', ['band'], 'Gold Oyster — end-link rebuild', 'received', { daysAgo: 14, pointPerson: 'Vienna', predictedCompletion: d(-2), returnLabel: retUs, stageAt: ago(1), invoices: [inv('vi-02', 'CL-1179', 520, 3)] }),
    // Jacques — Italy, ships (international) — one job in a redo cycle
    mk('v-jacques', 'j-03', ['band'], 'Rose-gold President — full link rebuild + solid end links', 'sent', { daysAgo: 3, pointPerson: 'Vienna', predictedCompletion: d(28), stageAt: ago(2) }),
    mk('v-jacques', 'j-05', ['band'], 'Two-tone Jubilee — gold center links replaced', 'inbound', { daysAgo: 18, pointPerson: 'JV', predictedCompletion: d(3), returnLabel: retIt, stageAt: ago(8), invoices: [inv('vi-03', 'JQ-0412', 1180, 9)] }),
    mk('v-jacques', 'j-16', ['band'], 'Gold clasp re-manufacture', 'fulfilled', { daysAgo: 40, pointPerson: 'Vienna', predictedCompletion: d(-12), stageAt: ago(11), invoices: [inv('vi-04', 'JQ-0388', 990, 20, { daysAgo: 20, method: 'wire', ourRef: 'WIRE-77015', by: 'MH', bill: 'QBO-BILL-STUB-3099' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3099' }),
    mk('v-jacques', 'j-19', ['band'], 'Gold Jubilee — center-link replacement (redo: two links mis-finished)', 'redo_at_vendor', { daysAgo: 45, pointPerson: 'JV', predictedCompletion: d(16), stageAt: ago(5), redoCycles: [{ n: 1, reason: 'Two replacement center links brushed instead of polished — visible under the loupe', startedAt: ago(7), by: 'JV' }], invoices: [inv('vi-05', 'JQ-0401', 860, 15)] }),
    // James — Netherlands, ships (international)
    mk('v-james', 'j-32', ['head'], 'Dial + hands relume — tritium-tone match', 'at_vendor', { daysAgo: 9, pointPerson: 'MM', predictedCompletion: d(1), stageAt: ago(5) }),
    mk('v-james', 'j-04', ['head'], 'Hands relume only', 'inspection', { daysAgo: 24, pointPerson: 'MM', predictedCompletion: d(-3), stageAt: ago(2), invoices: [inv('vi-06', 'JM-2201', 260, 4)] }),
    mk('v-james', 'j-20', ['head'], 'Full dial relume — delayed at vendor', 'at_vendor', { daysAgo: 30, pointPerson: 'MM', predictedCompletion: d(-5), stageAt: ago(22) }),
    // E02064 (SWO re-model demo): dial + hands away at James in the mixed box, back in 8 days → "Away: dial, hands → James (SWO10xx) · back <date>" on the job page
    mk('v-james', 'j-os1', ['head'], 'Dial + hands relume — tritium tone (5513 matte dial)', 'at_vendor', { daysAgo: 6, pointPerson: 'MM', predictedCompletion: d(8), stageAt: ago(3), invoices: [inv('vi-os1', 'JM-2240', 900, 4)] }),
    // Chronosky — overflow watchmaking, ships (domestic), PREPAY — the exposure case
    mk('v-chronosky', 'j-21', ['head'], 'Full service — cal. 3135, overflow', 'at_vendor', { daysAgo: 12, pointPerson: 'Vienna', predictedCompletion: d(20), stageAt: ago(9), invoices: [inv('vi-07', 'CS-5520', 1450, 12, { daysAgo: 12, method: 'ACH', ourRef: 'ACH-5520', by: 'MH', bill: 'QBO-BILL-STUB-3110' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3110' }),
    mk('v-chronosky', 'j-22', ['head'], 'Full service — cal. 3235, overflow', 'at_vendor', { daysAgo: 8, pointPerson: 'Vienna', predictedCompletion: d(24), stageAt: ago(5), invoices: [inv('vi-08', 'CS-5531', 1450, 8, { daysAgo: 8, method: 'ACH', ourRef: 'ACH-5531', by: 'MH', bill: 'QBO-BILL-STUB-3111' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3111' }),
    mk('v-chronosky', 'j-23', ['head'], 'Full service — cal. 3186 GMT (redo: amplitude low after service)', 'redo_at_vendor', { daysAgo: 140, pointPerson: 'Vienna', predictedCompletion: d(-38), stageAt: ago(52), redoCycles: [{ n: 1, reason: 'Amplitude 215° dial-up after 24 h on the timing machine — below spec, redo', startedAt: ago(70), by: 'MM' }], invoices: [inv('vi-09', 'CS-5488', 1650, 118, { daysAgo: 118, method: 'ACH', ourRef: 'ACH-5488', by: 'MH', bill: 'QBO-BILL-STUB-3090' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3090' }),
    mk('v-chronosky', 'j-24', ['head'], 'Full service — cal. 4130 chronograph (redo: chrono reset off)', 'redo_at_vendor', { daysAgo: 120, pointPerson: 'Vienna', predictedCompletion: d(-22), stageAt: ago(40), redoCycles: [{ n: 1, reason: 'Chronograph seconds hand does not reset to zero', startedAt: ago(48), by: 'MM' }], invoices: [inv('vi-10', 'CS-5496', 1950, 101, { daysAgo: 101, method: 'ACH', ourRef: 'ACH-5496', by: 'MH', bill: 'QBO-BILL-STUB-3093' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3093' }),
    mk('v-chronosky', 'j-25', ['head'], 'Full service — cal. 3135 (redo ×2: date jump, then crown seal)', 'redo_inbound', { daysAgo: 150, pointPerson: 'Vienna', predictedCompletion: d(-9), stageAt: ago(3), redoCycles: [{ n: 1, reason: 'Date does not jump at midnight — quickset slips', startedAt: ago(80), by: 'MM' }, { n: 2, reason: 'Crown seal failed the pressure test after redo ×1', startedAt: ago(30), by: 'MM' }], invoices: [inv('vi-11', 'CS-5471', 1450, 126, { daysAgo: 126, method: 'ACH', ourRef: 'ACH-5471', by: 'MH', bill: 'QBO-BILL-STUB-3084' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3084', returnLabel: { ...retUs, createdAt: ago(3), emailedAt: ago(3) } }),
    mk('v-chronosky', 'j-31', ['head'], 'Full service — cal. 2235 ladies (received · date disc not returned)', 'received', { daysAgo: 40, pointPerson: 'Vienna', predictedCompletion: d(-4), stageAt: ago(1), invoices: [inv('vi-12', 'CS-5505', 1250, 40, { daysAgo: 40, method: 'ACH', ourRef: 'ACH-5505', by: 'MH', bill: 'QBO-BILL-STUB-3101' })], qboStatus: 'queued', qboBillId: 'QBO-BILL-STUB-3101' }),
    // Chyna (CM) — in-house concierge, no shipping: queue → in progress → inspection → fulfilled
    cm('j-01', 'Client prep — polish cloth, box & papers check', 'queue', 0), cm('j-02', 'Pickup call + confirm appointment', 'queue', 1), cm('j-07', 'Insurance letter for client', 'queue', 2), cm('j-08', 'Photograph for client update', 'queue', 4),
    cm('j-09', 'Sizing check with client at counter', 'at_vendor', 1), cm('j-10', 'Strap change + buckle swap (client waiting)', 'at_vendor', 2), cm('j-11', 'Box & papers reunification', 'at_vendor', 3), cm('j-12', 'Warranty card fill-in + stamp', 'at_vendor', 8),
    cm('j-13', 'Final wipe-down + presentation tray', 'inspection', 1), cm('j-14', 'Final wipe-down + presentation tray', 'inspection', 2),
    cm('j-15', 'Client walkthrough completed', 'fulfilled', 6), cm('j-18', 'Client walkthrough completed', 'fulfilled', 9),
  );
  // Parent client dates: Chronosky redo jobs are 60–120 days past the client date (BREACH); j-32 shipped too late for its parent date (AT RISK); j-21/j-22 comfortably ahead (ON TRACK)
  target('j-23', ago(95)); target('j-24', ago(62)); target('j-25', ago(118)); target('j-32', d(12)); target('j-21', d(40)); target('j-22', d(45)); target('j-20', d(30)); target('j-19', d(35)); target('j-05', d(20)); target('j-03', d(45));
  swos.forEach((w) => { if (!w.synth && ['sent', 'at_vendor', 'inbound', 'redo_sent', 'redo_at_vendor', 'redo_inbound'].includes(w.stage)) setSwoCustody(w, `vendor:${w.vendorId}`, `Out to vendor · ${w.number}`); });
  seedSwoVolume(mk, inv, ago, d);
  swos.forEach((w) => { w.stageAt ??= w.receivedAt ?? w.inboundAt ?? w.atVendorAt ?? w.sentAt ?? w.createdAt; w.paid = w.invoices.some((i) => !!i.paid); if (w.paid) { const pi = w.invoices.find((i) => i.paid)!; w.paidAt = pi.paid!.at; w.paidBy = pi.paid!.by; } });
  // Vendor parts requests — same chain as the bench: one Chronosky awaiting client approval, one concierge approved + on order with the pick ticket addressed to the vendor
  const j21 = getJobRow('j-21'); const j10 = getJobRow('j-10');
  store.partsRequests.unshift(
    { id: 'pr-swo-1', number: 'PR-0931', jobId: j21.id, status: 'awaiting_client', qty: 2, note: 'Mainspring + reversing wheels worn — vendor request', items: [{ description: 'Mainspring 3135', qty: 1 }, { description: 'Reversing wheels (pair) 3135', qty: 1 }], searchTerms: ['3135'], chat: [], requestedBy: 'Vienna', requestedAt: ago(4), station: 'Front Desk 1', source: 'vendor:Chronosky', swoId: swos.find((w) => w.jobId === 'j-21')!.id, sentForApprovalAt: ago(3), sentBy: 'Vienna', history: [{ at: ago(4), by: 'Vienna', station: 'Front Desk 1', action: 'requested for vendor Chronosky · fulfilment → ship to Chronosky' }, { at: ago(3), by: 'Vienna', station: 'Front Desk 1', action: 'estimate addendum sent to client for approval' }] },
    { id: 'pr-swo-2', number: 'PR-0934', jobId: j10.id, status: 'on_order', qty: 1, note: 'Client wants the OEM Oysterflex buckle — concierge request', items: [{ description: 'Oysterflex clasp 18k', qty: 1 }], searchTerms: ['oysterflex'], chat: [], requestedBy: 'Chyna', requestedAt: ago(3), station: 'Front Desk 2', source: 'vendor:Chyna (CM)', swoId: swos.find((w) => w.jobId === 'j-10')!.id, sentForApprovalAt: ago(3), sentBy: 'Chyna', clientDecidedAt: ago(2), decidedBy: 'Vienna', decidedAt: ago(2), history: [{ at: ago(3), by: 'Chyna', station: 'Front Desk 2', action: 'requested for concierge · fulfilment → hand to Chyna (CM), custody scan' }, { at: ago(2), by: 'Vienna', station: 'Front Desk 1', action: 'client approved · on order · ETA ' + d(6) + ' · pick ticket "for: Chyna (CM) · SWO"' }] },
  );
  seedHubs(d);
};
export async function getShopWorkOrders(): Promise<SwoWithRefs[]> { seedSwo(); return resolve([...swos].sort((a, b) => SWO_STAGES.findIndex((s) => s.key === a.stage) - SWO_STAGES.findIndex((s) => s.key === b.stage) || b.createdAt.localeCompare(a.createdAt)).map(swoRefs)); }
export async function getShopWorkOrder(id: string): Promise<SwoWithRefs> { seedSwo(); return resolve(swoRefs(byId(swos, id))); }
export async function getOutsourceVendors(): Promise<Vendor[]> { return resolve(rs.vendors.filter((v) => v.kind === 'outsource' && v.active)); }
export async function saveShopWorkOrder(i: SwoInput): Promise<SwoWithRefs> {
  seedSwo(); const v = byId(rs.vendors, i.vendorId); if (v.kind !== 'outsource') throw new Error('Pick an outsource-work vendor (Vendors → kind)'); if (!i.components.length) throw new Error('Pick which component(s) go out'); if (!i.work.trim()) throw new Error('Describe the work');
  if (!i.predictedCompletion) throw new Error('Expected completion date is required'); if (!i.pointPerson) throw new Error('Point person is required — who chases this vendor job?');
  const a = actor(); const ex = i.id ? byId(swos, i.id) : undefined;
  if (ex) { const ch: string[] = []; if (ex.predictedCompletion !== i.predictedCompletion) ch.push(`expected ${ex.predictedCompletion ?? '—'} → ${i.predictedCompletion}`); if (ex.pointPerson !== i.pointPerson) ch.push(`point person ${ex.pointPerson ?? '—'} → ${i.pointPerson}`); Object.assign(ex, { components: i.components, work: i.work.trim(), vendorInvoiceNumber: i.vendorInvoiceNumber?.trim() || undefined }); hubSet(ex, { predictedCompletion: i.predictedCompletion, pointPerson: i.pointPerson, notes: i.notes?.trim() || undefined }); swoStamp(ex, ch.length ? `Edited · ${ch.join(' · ')}` : 'Details updated'); if (ch.length) appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${ex.number} · ${ch.join(' · ')}` }); return resolve(swoRefs(ex)); }
  // Legacy one-job form (pads' Send to vendor): opens a hub with a single line — the hub is still the container
  const h = newHub(v.id, i.pointPerson, i.predictedCompletion, a.by); h.notes = i.notes?.trim() || undefined; hubStamp(h, `${h.number} opened for ${v.name} · point person ${i.pointPerson} · expected ${i.predictedCompletion}`);
  void swoSeq; const hv = await addSwoLine(h.id, { jobId: i.jobId, components: i.components, work: i.work, sentParts: vendorPresets(v).length ? [{ label: vendorPresets(v)[i.components.includes('band') ? 0 : 0] }] : [] });
  return resolve(hv.lines[0]);
}
// Outbound label (shop → vendor) straight from the SWO screen; international vendors get customs (contents / value / HS / origin / incoterm) and DHL Express
export async function createSwoOutboundLabel(id: string, customs?: Partial<SwoCustoms>): Promise<SwoWithRefs> {
  const w0 = byId(swos, id); const h0 = hubOf(w0); if (h0) { if (w0.stage !== 'queue') throw new Error('Outbound label already created'); await createHubShipment(h0.id, 'outbound', [id], customs); return resolve(swoRefs(w0)); }
  const w = w0; if (w.stage !== 'queue') throw new Error('Outbound label already created'); const v = byId(rs.vendors, w.vendorId); const intl = isInternationalVendor(v); const a = actor(); const now = new Date().toISOString();
  const c = intl ? { ...swoCustoms(w, v), ...Object.fromEntries(Object.entries(customs ?? {}).filter(([, val]) => val !== undefined && val !== '')) } as SwoCustoms : undefined; if (intl && (!c?.contents || !c.value || !c.hsCode)) throw new Error('International shipment — customs contents, value and HS code are required');
  w.outbound = { direction: 'outbound', carrier: intl ? 'DHL Express' : 'FedEx', service: intl ? 'Express Worldwide' : 'Priority Overnight', tracking: swoTracking(intl ? 'DHL Express' : 'FedEx'), international: intl, customs: c, cost: intl ? 148.2 : 62.4, createdAt: now, createdBy: a.by };
  w.stage = 'sent'; w.sentAt = now; setSwoCustody(w, `vendor:${w.vendorId}`, `Out to vendor · ${w.number}`);
  const j = getJobRow(w.jobId); queueOutbox({ id: newId('ob'), to: v.email, toName: v.name, relatedRef: w.number, status: 'pending', subject: `Shop work order ${w.number} — item on its way`, body: `Hello ${v.name},\n\n${w.number} (${j.number}) is on its way: ${w.outbound.carrier} ${w.outbound.tracking}.\n\nWork: ${w.work}\n\nPlease confirm receipt and your expected completion date. A prepaid return label will follow by email.\n\nThank you,\n${a.by}`, createdAt: now, createdBy: a.by, station: a.station });
  swoStamp(w, `Outbound label · ${w.outbound.carrier} ${w.outbound.tracking}${intl ? ` · customs ${c!.hsCode} ${c!.incoterm} $${c!.value}` : ''} · vendor emailed`); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${w.number} sent to ${v.name} · ${w.outbound.tracking} · custody → vendor` });
  return resolve(swoRefs(w));
}
// Return label (vendor → shop) queued in advance + email to the vendor with the label — so getting it back doesn't depend on chasing
export async function queueSwoReturnLabel(id: string, predictedCompletion?: string): Promise<SwoWithRefs> {
  const w = byId(swos, id); if (w.stage === 'queue') throw new Error('Create the outbound label first'); if (w.stage === 'received') throw new Error('Already back at shop'); const v = byId(rs.vendors, w.vendorId); const intl = isInternationalVendor(v); const a = actor(); const now = new Date().toISOString();
  if (predictedCompletion) hubSet(w, { predictedCompletion }); if (!w.predictedCompletion) throw new Error('Set the predicted completion date first — it goes in the vendor email');
  const h0 = hubOf(w); if (h0) { await createHubShipment(h0.id, 'return', [id]); return resolve(swoRefs(w)); }
  w.returnLabel = { direction: 'return', carrier: intl ? 'DHL Express' : 'FedEx', service: intl ? 'Express Worldwide (prepaid)' : 'Priority Overnight (prepaid)', tracking: swoTracking(intl ? 'DHL Express' : 'FedEx'), international: intl, customs: intl ? { ...swoCustoms(w, v), contents: `Returned watch ${w.components.join(' / ')} after refinishing — repair & return, no sale`, incoterm: 'DAP' } : undefined, cost: intl ? 152.7 : 64.1, createdAt: now, createdBy: a.by, emailedAt: now };
  queueOutbox({ id: newId('ob'), to: v.email, toName: v.name, relatedRef: w.number, status: 'pending', subject: `Return label for ${w.number} — please ship back by ${w.predictedCompletion}`, body: `Hello ${v.name},\n\nAttached is the prepaid return label for shop work order ${w.number}: ${w.returnLabel.carrier} ${w.returnLabel.tracking}.\n\nExpected completion: ${w.predictedCompletion}. Please pack the item in the original case, apply the label and hand it to the carrier — no need to arrange shipping on your side.\n\nThank you,\n${a.by}`, createdAt: now, createdBy: a.by, station: a.station });
  swoStamp(w, `Return label queued · ${w.returnLabel.carrier} ${w.returnLabel.tracking} · emailed to vendor · expected ${w.predictedCompletion}`); return resolve(swoRefs(w));
}
export async function advanceSwo(id: string, to: SwoStage): Promise<SwoWithRefs> {
  const w = byId(swos, id); const v = byId(rs.vendors, w.vendorId);
  if (nextSwoStage(v, w.stage) !== to) throw new Error('Stages move one step at a time'); if (to === 'sent' || to === 'redo_sent') throw new Error('Use Create outbound label to send');
  const now = new Date().toISOString(); const a = actor();
  if (to === 'redo_at_vendor') { if (v.ships === false) setSwoCustody(w, `vendor:${w.vendorId}`, `Redo hand-off to ${v.name} · ${w.number}`); swoStamp(w, `Redo ×${w.redoCycles.length} · ${v.ships === false ? 'handed off' : 'delivered'} to ${v.name} — in progress`); }
  if (to === 'redo_inbound') swoStamp(w, `Redo ×${w.redoCycles.length} · vendor shipped back · ${w.returnLabel?.tracking ?? 'tracking pending'}`);
  if (to === 'redo_received') { setSwoCustody(w, null, `Back from redo · ${w.number}`); swoStamp(w, `Redo ×${w.redoCycles.length} · received back at shop (arrival scan) — custody → ${a.by}`); }
  if (to === 'at_vendor') { w.atVendorAt = now; if (v.ships === false) setSwoCustody(w, `vendor:${w.vendorId}`, `Hand-off to ${v.name} · ${w.number}`); swoStamp(w, v.ships === false ? `Handed off to ${v.name} (custody scan) — in progress` : `Delivered to ${v.name} — in progress`); }
  if (to === 'inbound') { w.inboundAt = now; swoStamp(w, `Vendor shipped back · ${w.returnLabel?.tracking ?? 'vendor tracking pending'}`); }
  if (to === 'received') { w.receivedAt = now; setSwoCustody(w, null, `Back from vendor · ${w.number}`); swoStamp(w, `Received back at shop (arrival scan) — custody → ${a.by}`); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${w.number} received back from ${v.name} · custody → ${a.by}` }); }
  if (to === 'inspection') { if (v.ships === false && w.stage !== 'redo_received') setSwoCustody(w, null, `Hand-off back from ${v.name} · ${w.number}`); swoStamp(w, `Post-return inspection — shop QC check${v.ships === false ? ' (custody scan)' : ''}${isRedoStage(w.stage) ? ` after redo ×${w.redoCycles.length}` : ''}`); }
  if (to === 'fulfilled') { swoStamp(w, `Fulfilled — outsourced portion closed, item back in ${w.number}'s job flow`); const j = getJobRow(w.jobId); jobStamp(j, `Outsourced work fulfilled · ${w.number} · ${v.name}`); }
  w.stage = to; w.stageAt = now; return resolve(swoRefs(w));
}
export async function sendBackSwo(id: string, reason: string): Promise<SwoWithRefs> {
  if (!reason.trim()) throw new Error('A reason is required to move back'); const w = byId(swos, id); const v = byId(rs.vendors, w.vendorId); const to = prevSwoStage(v, w.stage); if (!to) throw new Error(w.stage === 'inspection' ? 'From Inspection go forward (Fulfilled) or Return to vendor for redo' : 'Already at the first stage'); const a = actor(); swoStamp(w, `Moved back ${swoStageLabel(w.stage)} → ${swoStageLabel(to)} — ${reason.trim()}`); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${w.number} moved back to ${swoStageLabel(to)} · ${reason.trim()}` });
  w.stage = to; w.stageAt = new Date().toISOString(); return resolve(swoRefs(w));
}
// Board: one lane per active outsource vendor (concierge / no-ship lanes first), counts per stage + oldest age; amber ≥ 3 d, red ≥ 7 d (inbound-shipping thresholds)
export interface ConciergeStageCell { key: SwoStage; label: string; count: number; late: number; redo: number; oldestDays: number; tone: 'ok' | 'amber' | 'red' | 'empty' }
export interface ConciergeLane { vendor: Vendor; stages: ConciergeStageCell[]; total: number; rows: SwoWithRefs[]; unpaidCount: number; unpaidTotal: number; prepaidNotBack: number; prepaidTotal: number }
// Late = expected date passed and the item is not back yet (In route / In progress / Returning, incl. redo legs)
export const swoIsLate = (w: Swo) => !!w.predictedCompletion && w.predictedCompletion < new Date().toISOString().slice(0, 10) && ['sent', 'at_vendor', 'inbound'].includes(baseStage(w.stage));
export const swoPaidTotal = (w: Swo) => w.invoices.filter((i) => i.paid).reduce((t, i) => t + i.amount, 0);
export const swoUnpaidTotal = (w: Swo) => w.invoices.filter((i) => !i.paid).reduce((t, i) => t + i.amount, 0);
export const swoDaysAtStage = (w: Swo) => Math.max(0, Math.floor((Date.now() - new Date(w.stageAt ?? w.receivedAt ?? w.inboundAt ?? w.atVendorAt ?? w.sentAt ?? w.createdAt).getTime()) / 86_400_000));
export async function getConciergeBoard(): Promise<ConciergeLane[]> {
  seedSwo(); const vendors = rs.vendors.filter((v) => v.kind === 'outsource' && v.active).sort((a, b) => Number(b.ships === false) - Number(a.ships === false));
  return resolve(vendors.map((v) => { const rows = swos.filter((w) => w.vendorId === v.id).map(swoRefs); const stages = laneStagesFor(v).map((k): ConciergeStageCell => { const at = rows.filter((w) => baseStage(w.stage) === k); const oldest = at.reduce((m, w) => Math.max(m, swoDaysAtStage(w)), 0); const late = at.filter(swoIsLate).length; return { key: k, label: swoStageLabel(k), count: at.length, late, redo: at.filter((w) => isRedoStage(w.stage)).length, oldestDays: oldest, tone: !at.length ? 'empty' : k === 'fulfilled' ? 'ok' : late || oldest >= 7 ? 'red' : oldest >= 3 ? 'amber' : 'ok' }; }); const open = rows.filter((w) => w.stage !== 'fulfilled'); const paidNotBack = rows.filter((w) => w.paid && !['received', 'inspection', 'fulfilled'].includes(w.stage)); return { vendor: v, stages, total: open.length, rows, unpaidCount: rows.filter((w) => w.invoices.some((i) => !i.paid)).length, unpaidTotal: rows.reduce((t, w) => t + swoUnpaidTotal(w), 0), prepaidNotBack: paidNotBack.length, prepaidTotal: paidNotBack.reduce((t, w) => t + swoPaidTotal(w), 0) }; }));
}
// One lane at a time: a real (non-synthetic) unfulfilled SWO already exists for this job
export const jobOnVendorLane = (jobId: string) => { seedSwo(); return swos.some((x) => !x.synth && x.jobId === jobId && x.stage !== 'fulfilled'); };
export const conciergeVendors = (): Vendor[] => rs.vendors.filter((v) => v.kind === 'outsource' && v.active);
export const conciergeBridge = { swos: () => swos, seed: seedSwo, hubSet: (w: Swo, patch: { predictedCompletion?: string; pointPerson?: string }) => hubSet(w, patch), addShipment: (w: Swo, label: SwoLabel, redoN?: number) => { const h = hubOf(w); if (h) h.shipments.push({ id: newId('shp'), direction: label.direction, label, lineIds: [w.id], redoN }); }, hub: (w: Swo) => hubOf(w), vendors: () => rs.vendors, job: (id: string) => store.jobs.find((j) => j.id === id), jobTarget: (id: string): string | undefined => { const j = store.jobs.find((x) => x.id === id); return j?.targetDate ?? store.estimates.find((e) => e.id === j?.estimateId)?.targetDate; }, jobs: () => store.jobs, users: () => fx.users, actor, stamp: swoStamp, custody: setSwoCustody, refs: swoRefs, audit: (detail: string) => { const a = actor(); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail }); }, qboLog, jobStamp: (id: string, t: string) => jobStamp(getJobRow(id), t), managerOnly, partsRequests: () => store.partsRequests, newId, nextPrNumber, partsStamp, isManager: () => actor().user?.accessTier === 'manager' };
// Paid is INDEPENDENT of the stage (prepay arrangements) — and the vendor invoice total is what goes to QBO as a bill
// No bare Paid toggle any more — see api/concierge.ts addVendorInvoice / markInvoicePaid (duplicate guard, QBO DocNumber/PrivateNote)
export async function setSwoPaid(): Promise<never> { throw new Error('Paid is set only through Mark paid on a vendor invoice (vendor invoice # + our payment reference)'); }
export async function pushSwoToQbo(id: string): Promise<SwoWithRefs> { const w = byId(swos, id); managerOnly(); if (!w.vendorInvoiceTotal) throw new Error('Enter the vendor invoice total first'); w.qboBillId ??= `QBO-BILL-STUB-${3000 + swos.length * 13 + Math.floor(Math.random() * 90)}`; w.qboStatus = 'queued'; const v = byId(rs.vendors, w.vendorId); qboLog(`Vendor bill · ${w.number} · ${v.name} · ${fmtMoney(w.vendorInvoiceTotal)} → ${w.qboBillId} (stub, queued)`); swoStamp(w, `Vendor invoice ${fmtMoney(w.vendorInvoiceTotal)} pushed to QuickBooks · ${w.qboBillId} (stub)`); return resolve(swoRefs(w)); }
export async function getSwoJobCandidates(q: string): Promise<{ id: string; number: string; client: string; watch: string; components: ComponentKey[]; onLane: boolean }[]> { seedSwo(); const s = q.trim().toLowerCase().replace(/^e(?=\d)/, ''); const hit = (j: Job) => !s || j.number.toLowerCase().replace(/^e/, '').includes(s) || fullNameOf(byId(fx.clients, j.clientId)).toLowerCase().includes(s); return resolve(store.jobs.filter((j) => j.status !== 'closed' && hit(j)).map((j) => { const w = j.watchId ? fx.watches.find((x) => x.id === j.watchId) : undefined; return { id: j.id, number: j.number, client: fullNameOf(byId(fx.clients, j.clientId)), watch: w ? `${w.brand} ${w.model}` : '—', components: ensureComponents(j).map((c) => c.key), onLane: jobOnVendorLane(j.id) }; }).sort((a, b) => Number(a.onLane) - Number(b.onLane)).slice(0, 8)); }

// ---- SWO HUBS (MH 2026-09-30) — a Shop Work Order is a CONTAINER (the box / envelope / hand-off batch) that goes to a vendor; the LINES inside are job components + what was physically sent.
// Hub and spoke: vendor · point person · expected date · shipments · vendor invoices · redo cycles · comms · timeline live on the hub (lines share the hub's arrays); stage + health live on each line.
// Numbering SWO1000, SWO1001, … (Code 128 of the number is the barcode on the box). The hub is a container in the custody model: scanning its barcode moves every open line — same rule as a bin.
export interface SwoShipment { id: string; direction: 'outbound' | 'return'; label: SwoLabel; lineIds: string[]; redoN?: number; deliveredAt?: string }
export type ShipmentStatus = 'label_created' | 'in_transit' | 'delivered';
export interface SwoShipmentView extends SwoShipment { status: ShipmentStatus; eta: string; lines: SwoWithRefs[]; arrivalPending: boolean }
export interface SwoHub { id: string; number: string; barcode: string; vendorId: string; pointPerson: string; predictedCompletion?: string; notes?: string; createdAt: string; createdBy: string; invoices: VendorInvoice[]; redoCycles: RedoCycle[]; vendorReplies: VendorReply[]; statusRequests: Swo['statusRequests']; timeline: Swo['timeline']; shipments: SwoShipment[]; internalNotes: { at: string; by: string; text: string }[]; printedAt?: string }
export interface SwoHubView extends SwoHub { vendor: Vendor; lines: SwoWithRefs[]; stage: SwoStage; open: number; back: number; total: number; international: boolean; paid: boolean; shipmentViews: SwoShipmentView[]; sentSummary: string }
export interface AwayPart { part: string; vendor: string; vendorId: string; swoNumber: string; hubId: string; lineId: string; component: ComponentKey; back?: string; missing: boolean; verify: boolean }
const hubs: SwoHub[] = []; let hubSeq = 999;
export const VENDOR_PRESETS: Record<string, string[]> = { 'v-james': ['Dial', 'Hands', 'Bezel insert', 'Date disc'], 'v-claudio': ['Bracelet', 'Clasp', 'End links'], 'v-jacques': ['Bracelet', 'Clasp', 'End links'], 'v-chronosky': ['Complete watch', 'Head only', 'Movement'], 'v-cm': [] };
export const partKey = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
export const vendorPresets = (v: Vendor): string[] => v.commonlySent ?? VENDOR_PRESETS[v.id] ?? [];
export const hubOf = (w: Swo): SwoHub | undefined => hubs.find((h) => h.id === w.hubId);
const hubLines = (h: SwoHub) => swos.filter((w) => w.hubId === h.id);
const laneIdx = (s: SwoStage) => SHIP_LANE.indexOf(baseStage(s));
export const hubStage = (h: SwoHub): SwoStage => { const all = hubLines(h); if (!all.length) return 'queue'; const open = all.filter((w) => w.stage !== 'fulfilled'); if (!open.length) return 'fulfilled'; return open.reduce((m, w) => (laneIdx(w.stage) < laneIdx(m.stage) ? w : m)).stage; };
const newHub = (vendorId: string, pointPerson: string, predictedCompletion: string | undefined, by: string, at = new Date().toISOString()): SwoHub => { const number = `SWO${(hubSeq += 1)}`; const h: SwoHub = { id: number, number, barcode: number, vendorId, pointPerson, predictedCompletion, createdAt: at, createdBy: by, invoices: [], redoCycles: [], vendorReplies: [], statusRequests: [], timeline: [], shipments: [], internalNotes: [] }; hubs.push(h); return h; };
// A line joins a hub: shares the hub's arrays (invoices / redo / replies / requests / timeline) and takes its number, point person and expected date
const attachLine = (h: SwoHub, w: Swo) => { w.hubId = h.id; w.number = h.number; w.pointPerson = h.pointPerson; if (h.predictedCompletion) w.predictedCompletion = h.predictedCompletion; w.invoices = h.invoices; w.redoCycles = h.redoCycles; w.vendorReplies = h.vendorReplies; w.statusRequests = h.statusRequests; w.timeline = h.timeline; w.sentParts ??= defaultSentParts(w); };
export const hubSet = (w: Swo | SwoHub, patch: { predictedCompletion?: string; pointPerson?: string; notes?: string }) => { const h = 'vendorId' in w && 'shipments' in w ? (w as SwoHub) : hubOf(w as Swo); if (!h) { Object.assign(w, patch); return; } Object.assign(h, patch); hubLines(h).forEach((l) => { if (patch.predictedCompletion) l.predictedCompletion = patch.predictedCompletion; if (patch.pointPerson) l.pointPerson = patch.pointPerson; if (patch.notes !== undefined) l.notes = patch.notes; }); };
const lineBack = (w: Swo) => ['received', 'inspection', 'fulfilled'].includes(baseStage(w.stage));
const defaultSentParts = (w: Swo): SentPart[] => { const v = byId(rs.vendors, w.vendorId); const back = lineBack(w); const mk = (label: string): SentPart => ({ key: partKey(label), label, returned: back ? true : undefined }); if (v.id === 'v-james') return [mk('Dial'), mk('Hands')]; if (v.id === 'v-claudio' || v.id === 'v-jacques') return /clasp/i.test(w.work) ? [mk('Bracelet'), mk('Clasp')] : [mk('Bracelet')]; if (v.id === 'v-chronosky') return [/movement|cal\./i.test(w.work) && !/full service/i.test(w.work) ? mk('Movement') : mk('Complete watch')]; return []; };
export const sentSummary = (parts: SentPart[] | undefined) => (parts?.length ? parts.map((p) => p.label).join(' · ') : '');
// Box-level: "Dial ×5 · Hands ×5" — same part across lines collapses to a count
const sentSummaryCounted = (parts: SentPart[]) => { const m = new Map<string, { label: string; n: number }>(); parts.forEach((p) => { const e = m.get(p.key); if (e) e.n += 1; else m.set(p.key, { label: p.label, n: 1 }); }); return [...m.values()].map((x) => (x.n > 1 ? `${x.label} ×${x.n}` : x.label)).join(' · '); };
const shipDaysOf = (h: SwoHub) => shipDaysFor(byId(rs.vendors, h.vendorId));
const shipmentView = (h: SwoHub, s: SwoShipment): SwoShipmentView => {
  const lines = s.lineIds.map((id) => swos.find((w) => w.id === id)).filter((w): w is Swo => !!w).map(swoRefs); const days = shipDaysOf(h); const plus = (iso: string) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
  let status: ShipmentStatus; let eta: string;
  if (s.direction === 'outbound') { const moving = lines.some((w) => baseStage(w.stage) === 'sent'); const arrived = lines.some((w) => laneIdx(w.stage) >= laneIdx('at_vendor')); status = s.deliveredAt || (arrived && !moving) ? 'delivered' : moving ? 'in_transit' : 'label_created'; eta = plus(s.label.createdAt); }
  else { const moving = lines.some((w) => baseStage(w.stage) === 'inbound'); const arrived = lines.length > 0 && lines.every(lineBack); status = s.deliveredAt || arrived ? 'delivered' : moving ? 'in_transit' : 'label_created'; eta = plus(lines.find((w) => w.inboundAt)?.inboundAt ?? h.predictedCompletion ?? s.label.createdAt); }
  return { ...s, status, eta, lines, arrivalPending: s.direction === 'return' && status === 'delivered' && lines.some((w) => baseStage(w.stage) === 'inbound') };
};
export const hubViewSync = (h: SwoHub): SwoHubView => { const v = byId(rs.vendors, h.vendorId); const lines = hubLines(h).map(swoRefs).sort((a, b) => laneIdx(a.stage) - laneIdx(b.stage) || a.jobNumber.localeCompare(b.jobNumber)); const back = lines.filter((w) => lineBack(w)).length; return { ...h, vendor: v, lines, stage: hubStage(h), open: lines.filter((w) => w.stage !== 'fulfilled').length, back, total: lines.length, international: isInternationalVendor(v), paid: h.invoices.some((i) => !!i.paid), shipmentViews: h.shipments.map((s) => shipmentView(h, s)), sentSummary: sentSummaryCounted(lines.flatMap((w) => w.sentParts ?? [])) }; };
export const findHubByCode = (code: string): SwoHub | undefined => { seedSwo(); const c = code.trim().toUpperCase().replace(/[\s-]/g, ''); return hubs.find((h) => h.number === c || h.id.toUpperCase() === c) ?? (/^\d{4}$/.test(c) ? hubs.find((h) => h.number === `SWO${c}`) : undefined); };
export const isSwoCode = (code: string) => /^SWO\s*-?\d{4,}$/i.test(code.trim());
export const swoLineBack = (w: Swo) => lineBack(w);
// A line can be received when it is Returning (or in a hand-off vendor's hands) — or is back with its receive checklist not yet ticked
export const swoReceivable = (w: Swo): boolean => { const v = byId(rs.vendors, w.vendorId); const bs = baseStage(w.stage); return bs === 'inbound' || (v.ships === false && bs === 'at_vendor') || (lineBack(w) && w.stage !== 'fulfilled' && (w.sentParts ?? []).some((p) => p.returned === undefined)); };
// Container rule: scanning the SWO barcode = every open line in the box (same as a bin)
export const hubOpenLineIds = (code: string): { hub: SwoHub; ids: string[] } | null => { const h = findHubByCode(code); return h ? { hub: h, ids: hubLines(h).filter((w) => w.stage !== 'fulfilled').map((w) => w.id) } : null; };
export async function getSwoHub(idOrNumber: string): Promise<SwoHubView | null> { seedSwo(); const h = findHubByCode(idOrNumber) ?? hubs.find((x) => x.id === idOrNumber); return resolve(h ? hubViewSync(h) : null); }
export async function getSwoHubs(): Promise<SwoHubView[]> { seedSwo(); return resolve(hubs.map(hubViewSync).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
export const hubForLineSync = (lineId: string): SwoHubView | null => { const w = swos.find((x) => x.id === lineId); const h = w ? hubOf(w) : undefined; return h ? hubViewSync(h) : null; };
const hubStamp = (h: SwoHub, text: string) => { const a = actor(); h.timeline.unshift({ at: new Date().toISOString(), by: a.by, text }); };
// Creating: pick the vendor → SWO1xxx exists at In queue → scan tickets one by one (addSwoLine) → print label + packing list → Outbound box scan on the map
export async function createSwoHub(input: { vendorId: string; pointPerson: string; predictedCompletion?: string; notes?: string }): Promise<SwoHubView> {
  seedSwo(); const v = byId(rs.vendors, input.vendorId); if (v.kind !== 'outsource') throw new Error('Pick an outsource-work vendor'); if (!input.pointPerson) throw new Error('Point person is required — who chases this vendor job?');
  const a = actor(); const h = newHub(v.id, input.pointPerson, input.predictedCompletion || defaultExpectedAt(v), a.by); h.notes = input.notes?.trim() || undefined;
  hubStamp(h, `${h.number} opened for ${v.name} · point person ${h.pointPerson} · expected ${h.predictedCompletion} · barcode ${h.barcode}`); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${h.number} opened → ${v.name}` });
  return resolve(hubViewSync(h));
}
export interface SwoLineInput { jobId: string; components: ComponentKey[]; work: string; sentParts: { label: string; custom?: boolean }[] }
export async function addSwoLine(hubId: string, input: SwoLineInput): Promise<SwoHubView> {
  seedSwo(); const h = byId(hubs, hubId); const v = byId(rs.vendors, h.vendorId); const j = getJobRow(input.jobId); const a = actor();
  if (!input.components.length) throw new Error('Pick which component goes in the box'); if (!input.work.trim()) throw new Error('Describe the work for this line');
  if (v.id !== 'v-cm' && !input.sentParts.length) throw new Error('Tick what physically goes in the box — the packing list and the receive checklist come from it');
  if (jobOnVendorLane(j.id)) throw new Error(`${j.number} is already on a vendor lane — one lane at a time; fulfil that first`);
  if (hubLines(h).some((w) => laneIdx(w.stage) > laneIdx('queue'))) throw new Error(`${h.number} has already left In queue — open a new SWO for this ticket`);
  const now = new Date().toISOString();
  const w: Swo = { id: newId('swo'), number: h.number, vendorId: v.id, jobId: j.id, components: input.components, work: input.work.trim(), stage: 'queue', stageAt: now, paid: h.invoices.some((i) => !!i.paid), vendorInvoiceTotal: h.invoices.reduce((t, i) => t + i.amount, 0), qboStatus: 'not_queued', predictedCompletion: h.predictedCompletion, pointPerson: h.pointPerson, invoices: h.invoices, redoCycles: h.redoCycles, vendorReplies: h.vendorReplies, statusRequests: h.statusRequests, createdAt: now, createdBy: a.by, timeline: h.timeline, hubId: h.id, sentParts: input.sentParts.map((p) => ({ key: partKey(p.label), label: p.label.trim(), custom: p.custom })) };
  swos.unshift(w);
  // breadcrumbs on the parent job: each sent part = a component-level custody note ("dial: queued for James · SWO1004")
  ensureParts(j).filter((c) => w.components.includes(c.key)).forEach((c) => { c.history = c.history ?? []; c.history.push({ at: now, by: a.by, from: c.station, to: c.station, status: c.partStatus ?? 'in_progress', via: 'system', note: `${sentSummary(w.sentParts) || 'component'} → ${v.name} · ${h.number} (in queue)` }); });
  hubStamp(h, `Line added · ${j.number.replace(/^E/, '')} · ${PART_LABEL[w.components[0]] ?? w.components[0]}${w.sentParts?.length ? ` · sent: ${sentSummary(w.sentParts)}` : ''} · ${w.work}`); jobStamp(j, `${sentSummary(w.sentParts) || 'Component'} queued for ${v.name} · ${h.number}`);
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${h.number} + ${j.number} · ${sentSummary(w.sentParts) || w.components.join('+')}` });
  return resolve(hubViewSync(h));
}
export async function removeSwoLine(lineId: string): Promise<SwoHubView> { const w = byId(swos, lineId); const h = hubOf(w)!; if (w.stage !== 'queue') throw new Error('Only a line still In queue can be removed — anything that left the shop stays on its SWO'); const j = store.jobs.find((x) => x.id === w.jobId); swos.splice(swos.indexOf(w), 1); hubStamp(h, `Line removed · ${w.synth?.jobNumber ?? j?.number ?? ''} · ${w.work}`); if (j) jobStamp(j, `Removed from ${h.number} (${byId(rs.vendors, h.vendorId).name}) before it shipped`); return resolve(hubViewSync(h)); }
export async function printSwoLabel(hubId: string): Promise<SwoHubView> { const h = byId(hubs, hubId); const a = actor(); h.printedAt = new Date().toISOString(); const hv = hubViewSync(h); hubStamp(h, `SWO label printed · Code 128 ${h.barcode} · packing list ${hv.total} line${hv.total === 1 ? '' : 's'}${hv.sentSummary ? ` · ${hv.sentSummary}` : ''}`); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${h.number} label + packing list printed` }); return resolve(hv); }
export async function addSwoNote(hubId: string, text: string): Promise<SwoHubView> { const h = byId(hubs, hubId); if (!text.trim()) throw new Error('Write the note first'); const a = actor(); h.internalNotes.unshift({ at: new Date().toISOString(), by: a.by, text: text.trim() }); hubStamp(h, `Note · ${text.trim()}`); text.match(/@(\w+)/g)?.forEach((m) => { const u = fx.users.find((x) => x.shortName.toLowerCase() === m.slice(1).toLowerCase() || x.firstName.toLowerCase() === m.slice(1).toLowerCase()); if (u) store.pinned.unshift({ id: newId('pin'), title: `${h.number} · ${a.by}: ${text.trim()}`, assignedTo: { type: 'user', shortName: u.shortName }, createdBy: a.by, jobId: hubLines(h).find((l) => !l.synth)?.jobId, createdAt: new Date().toISOString(), station: a.station, division: 'rolliworks' }); }); return resolve(hubViewSync(h)); }
// LABELS FOLLOW THE SELECTION — one shipment per label, listing the lines that travelled on it. Outbound = custody → vendor for those lines; return = prepaid label queued + emailed once for the batch.
export async function createHubShipment(hubId: string, direction: 'outbound' | 'return', lineIds: string[], customs?: Partial<SwoCustoms>, redoN?: number): Promise<SwoHubView> {
  seedSwo(); const h = byId(hubs, hubId); const v = byId(rs.vendors, h.vendorId); if (v.ships === false) throw new Error(`${v.name} is a hand-off vendor — no labels, scan the hand-off safe instead`); const intl = isInternationalVendor(v); const a = actor(); const now = new Date().toISOString();
  const lines = lineIds.map((id) => byId(swos, id)).filter((w) => w.hubId === h.id); if (!lines.length) throw new Error('Pick at least one line for the label');
  if (direction === 'outbound') { const bad = lines.find((w) => w.stage !== 'queue' && !redoN); if (bad) throw new Error(`${bad.synth?.jobNumber ?? getJobRow(bad.jobId).number} has already shipped — outbound labels are for lines In queue`); }
  else { const bad = lines.find((w) => lineBack(w)); if (bad) throw new Error(`${bad.synth?.jobNumber ?? getJobRow(bad.jobId).number} is already back at the shop`); const early = lines.find((w) => w.stage === 'queue'); if (early) throw new Error('Create the outbound label first'); if (!h.predictedCompletion) throw new Error('Set the expected completion date first — it goes in the vendor email'); }
  const first = lines[0]; const c = intl ? { ...(first.synth ? { contents: `Watch ${first.components.join(' / ')} — repair & return`, value: 1500, hsCode: '9111.20', origin: 'CH', incoterm: 'DAP' as const } : swoCustoms(first, v)), ...Object.fromEntries(Object.entries(customs ?? {}).filter(([, val]) => val !== undefined && val !== '')) } as SwoCustoms : undefined;
  if (intl && direction === 'outbound' && (!c?.contents || !c.value || !c.hsCode)) throw new Error('International shipment — customs contents, value and HS code are required');
  const label: SwoLabel = { direction, carrier: intl ? 'DHL Express' : 'FedEx', service: intl ? `Express Worldwide${direction === 'return' ? ' (prepaid)' : ''}` : `Priority Overnight${direction === 'return' ? ' (prepaid)' : ''}`, tracking: swoTracking(intl ? 'DHL Express' : 'FedEx'), international: intl, customs: c ? (direction === 'return' ? { ...c, contents: `Returned ${c.contents} — repair & return, no sale`, incoterm: 'DAP' } : c) : undefined, cost: direction === 'outbound' ? (intl ? 148.2 : 62.4) : (intl ? 152.7 : 64.1), createdAt: now, createdBy: a.by, emailedAt: direction === 'return' ? now : undefined };
  const shipment: SwoShipment = { id: newId('shp'), direction, label, lineIds: lines.map((w) => w.id), redoN }; h.shipments.push(shipment);
  const tickets = lines.map((w) => (w.synth?.jobNumber ?? getJobRow(w.jobId).number).replace(/^E/, '')).join(', ');
  if (direction === 'outbound') {
    lines.forEach((w) => { w.outbound = label; if (!redoN) { w.stage = 'sent'; w.stageAt = now; w.sentAt = now; } if (!w.synth) setSwoCustody(w, `vendor:${w.vendorId}`, `Out to vendor · ${h.number} · ${label.carrier} ${label.tracking}`); });
    queueOutbox({ id: newId('ob'), to: v.email, toName: v.name, relatedRef: h.number, status: 'pending', subject: `Shop work order ${h.number} — ${lines.length} item${lines.length === 1 ? '' : 's'} on the way`, body: `Hello ${v.name},\n\n${h.number} is on its way: ${label.carrier} ${label.tracking}.\n\nPacking list:\n${lines.map((w) => `• ${(w.synth?.jobNumber ?? getJobRow(w.jobId).number).replace(/^E/, '')} — ${sentSummary(w.sentParts) || w.components.join(' / ')} — ${w.work}`).join('\n')}\n\nPlease confirm receipt and your expected completion date (${h.predictedCompletion ?? 'tbd'}). A prepaid return label follows by email.\n\nThank you,\n${a.by}`, createdAt: now, createdBy: a.by, station: a.station });
    hubStamp(h, `Outbound label · ${label.carrier} ${label.tracking} · ${lines.length} line${lines.length === 1 ? '' : 's'} (${tickets})${intl ? ` · customs ${c!.hsCode} ${c!.incoterm} $${c!.value}` : ''} · vendor emailed · custody → ${v.name}`);
    appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${h.number} shipped to ${v.name} · ${label.tracking} · ${lines.length} line${lines.length === 1 ? '' : 's'}` });
  } else {
    lines.forEach((w) => { w.returnLabel = label; });
    queueOutbox({ id: newId('ob'), to: v.email, toName: v.name, relatedRef: h.number, status: 'pending', subject: `Return label for ${h.number} — please ship back by ${h.predictedCompletion}`, body: `Hello ${v.name},\n\nAttached is the prepaid return label for ${h.number}: ${label.carrier} ${label.tracking}.\n\nIt covers: ${tickets}.\nExpected completion: ${h.predictedCompletion}. Pack the items in the original case, apply the label and hand it to the carrier.\n\nThank you,\n${a.by}`, createdAt: now, createdBy: a.by, station: a.station });
    hubStamp(h, `Return label queued · ${label.carrier} ${label.tracking} · covers ${lines.length} line${lines.length === 1 ? '' : 's'} (${tickets}) · emailed to vendor · expected ${h.predictedCompletion}`);
  }
  return resolve(hubViewSync(h));
}
// Carrier says delivered (MOCK): outbound → the lines move In route → In progress (the vendor has them, no scan); return → only LIGHTS Received — the arrival scan of the SWO barcode / each ticket moves them
export async function simulateShipmentDelivered(hubId: string, shipmentId: string): Promise<SwoHubView> {
  const h = byId(hubs, hubId); const s = h.shipments.find((x) => x.id === shipmentId); if (!s) throw new Error('Shipment not found'); if (s.deliveredAt) throw new Error('Already delivered'); const now = new Date().toISOString(); s.deliveredAt = now; const v = byId(rs.vendors, h.vendorId);
  if (s.direction === 'outbound') { s.lineIds.map((id) => swos.find((w) => w.id === id)).forEach((w) => { if (w && baseStage(w.stage) === 'sent') { w.stage = isRedoStage(w.stage) ? 'redo_at_vendor' : 'at_vendor'; w.stageAt = now; w.atVendorAt = now; } }); hubStamp(h, `Carrier: delivered to ${v.name} · ${s.label.tracking} · ${s.lineIds.length} line${s.lineIds.length === 1 ? '' : 's'} → In progress`); }
  else hubStamp(h, `Carrier: return ${s.label.tracking} delivered to the shop · Received lit — arrival scan pending for ${s.lineIds.length} line${s.lineIds.length === 1 ? '' : 's'}`);
  return resolve(hubViewSync(h));
}
// RECEIVING = ticking the sent parts back in. Unticked stays Away and becomes a blocker on the parent job ("bezel insert not returned — James").
export async function receiveSwoLine(lineId: string, returned: Record<string, boolean>): Promise<SwoHubView> {
  const w = byId(swos, lineId); const h = hubOf(w)!; const v = byId(rs.vendors, h.vendorId); const a = actor();
  if (!lineBack(w) && baseStage(w.stage) !== 'inbound' && !(v.ships === false && baseStage(w.stage) === 'at_vendor')) throw new Error(`Receive from Returning (or the vendor's hands) — ${w.number} line is ${swoStageLabel(w.stage)}`);
  (w.sentParts ?? []).forEach((p) => { p.returned = returned[p.key] ?? false; });
  if (!lineBack(w)) { const to = nextSwoStage(v, w.stage); if (to) await advanceSwo(w.id, to); }
  const missing = (w.sentParts ?? []).filter((p) => p.returned === false); const check = (w.sentParts ?? []).map((p) => `${p.label} ${p.returned ? '✓' : '✗'}`).join(' · ');
  swoStamp(w, `Receive checklist · ${check}${missing.length ? ` — MISSING: ${missing.map((p) => p.label).join(', ')}` : ' — complete'}`);
  if (!w.synth) { const j = getJobRow(w.jobId); jobStamp(j, missing.length ? `${h.number} received from ${v.name} — ${missing.map((p) => p.label).join(', ')} NOT returned (still away, blocker)` : `${h.number} received from ${v.name} — all sent parts back (${check})`); if (missing.length) { appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${j.number} · ${missing.map((p) => p.label).join(', ')} not returned by ${v.name} · ${h.number}` }); store.pinned.unshift({ id: newId('pin'), title: `${h.number} · ${j.number.replace(/^E/, '')} · ${missing.map((p) => p.label).join(', ')} not returned by ${v.name} — chase it`, assignedTo: { type: 'user', shortName: h.pointPerson }, createdBy: a.by, jobId: j.id, createdAt: new Date().toISOString(), station: a.station, division: 'rolliworks' }); } }
  return resolve(hubViewSync(h));
}
export async function markPartReturned(lineId: string, key: string): Promise<SwoHubView> { const w = byId(swos, lineId); const h = hubOf(w)!; const p = (w.sentParts ?? []).find((x) => x.key === key); if (!p) throw new Error('No such part on this line'); p.returned = true; swoStamp(w, `${p.label} arrived — no longer away`); if (!w.synth) jobStamp(getJobRow(w.jobId), `${p.label} back from ${byId(rs.vendors, h.vendorId).name} · ${h.number}`); return resolve(hubViewSync(h)); }
export async function updateSwoHub(hubId: string, patch: { pointPerson?: string; predictedCompletion?: string; notes?: string; reason?: string }): Promise<SwoHubView> { const h = byId(hubs, hubId); const ch: string[] = []; if (patch.predictedCompletion && patch.predictedCompletion !== h.predictedCompletion) ch.push(`expected ${h.predictedCompletion ?? '—'} → ${patch.predictedCompletion}`); if (patch.pointPerson && patch.pointPerson !== h.pointPerson) ch.push(`point person ${h.pointPerson} → ${patch.pointPerson}`); hubSet(h, patch); if (ch.length) { hubStamp(h, `Edited · ${ch.join(' · ')}${patch.reason ? ` · ${patch.reason}` : ''}`); const a = actor(); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, detail: `${h.number} · ${ch.join(' · ')}` }); } return resolve(hubViewSync(h)); }
// MOVING — two granularities, same rules: a batch of lines goes Forward / Back together; labels are created once per hub for the lines that travel
export interface MoveResult { moved: string[]; refused: { lineId: string; reason: string }[] }
export async function moveSwoLines(lineIds: string[], dir: 'forward' | 'back', reason?: string): Promise<MoveResult> {
  seedSwo(); const out: MoveResult = { moved: [], refused: [] }; const lines = lineIds.map((id) => swos.find((w) => w.id === id)).filter((w): w is Swo => !!w);
  const ticket = (w: Swo) => (w.synth?.jobNumber ?? getJobRow(w.jobId).number).replace(/^E/, '');
  if (dir === 'back') { for (const w of lines) { try { await sendBackSwo(w.id, reason ?? ''); out.moved.push(w.id); } catch (e) { out.refused.push({ lineId: w.id, reason: e instanceof Error ? e.message : 'refused' }); } } return resolve(out); }
  // forward: group per hub so one outbound / return label covers the batch that ships together
  const byHub = new Map<string, Swo[]>(); lines.forEach((w) => { const k = w.hubId ?? w.id; byHub.set(k, [...(byHub.get(k) ?? []), w]); });
  for (const [hubId, group] of byHub) {
    const v = byId(rs.vendors, group[0].vendorId); const toShip = group.filter((w) => nextSwoStage(v, w.stage) === 'sent'); const needReturn = group.filter((w) => ['inbound', 'redo_inbound'].includes(nextSwoStage(v, w.stage) ?? '') && !w.returnLabel);
    try { if (toShip.length && hubs.some((h) => h.id === hubId)) { await createHubShipment(hubId, 'outbound', toShip.map((w) => w.id)); await createHubShipment(hubId, 'return', toShip.map((w) => w.id)); out.moved.push(...toShip.map((w) => w.id)); } } catch (e) { toShip.forEach((w) => out.refused.push({ lineId: w.id, reason: e instanceof Error ? e.message : 'label failed' })); }
    try { if (needReturn.length && hubs.some((h) => h.id === hubId)) await createHubShipment(hubId, 'return', needReturn.map((w) => w.id)); } catch (e) { needReturn.forEach((w) => out.refused.push({ lineId: w.id, reason: e instanceof Error ? e.message : 'return label failed' })); }
    for (const w of group) { if (toShip.includes(w) || out.refused.some((r) => r.lineId === w.id)) continue; const next = nextSwoStage(v, w.stage); if (!next) { out.refused.push({ lineId: w.id, reason: `${ticket(w)} · lane complete` }); continue; } if (next === 'redo_sent') { out.refused.push({ lineId: w.id, reason: `${ticket(w)} · redo ships from Redo +` }); continue; } try { await advanceSwo(w.id, next); out.moved.push(w.id); } catch (e) { out.refused.push({ lineId: w.id, reason: `${ticket(w)} · ${e instanceof Error ? e.message : 'refused'}` }); } }
  }
  return resolve(out);
}
// Add to SWO / Remove from SWO — only while a line is still In queue; both hubs must be the same vendor
export async function moveLineToHub(lineId: string, hubCode: string): Promise<SwoHubView> { const w = byId(swos, lineId); const from = hubOf(w); const to = findHubByCode(hubCode); if (!to) throw new Error(`No SWO matches “${hubCode}”`); if (w.stage !== 'queue') throw new Error('Only a line still In queue can change boxes'); if (to.vendorId !== w.vendorId) throw new Error(`${to.number} goes to ${byId(rs.vendors, to.vendorId).name} — this line is for ${byId(rs.vendors, w.vendorId).name}`); if (hubLines(to).some((x) => x.stage !== 'queue')) throw new Error(`${to.number} has already left In queue`); const a = actor(); if (from) hubStamp(from, `Line ${(w.synth?.jobNumber ?? getJobRow(w.jobId).number).replace(/^E/, '')} moved to ${to.number} by ${a.by}`); attachLine(to, w); hubStamp(to, `Line ${(w.synth?.jobNumber ?? getJobRow(w.jobId).number).replace(/^E/, '')} added from ${from?.number ?? 'no box'} by ${a.by}`); return resolve(hubViewSync(to)); }
// Hubs still at In queue for this vendor — the "Add to SWO" picker
export const openHubsForVendor = (vendorId: string): SwoHubView[] => { seedSwo(); return hubs.filter((h) => h.vendorId === vendorId && hubStage(h) === 'queue').map(hubViewSync); };
// Breadcrumbs on the parent job: every sent part that is not back is a component-level custody fact ("dial: at vendor James · SWO1004")
export const jobAwaySync = (jobId: string): AwayPart[] => { seedSwo(); return swos.filter((w) => !w.synth && w.jobId === jobId && w.stage !== 'fulfilled').flatMap((w) => { const h = hubOf(w); const v = byId(rs.vendors, w.vendorId); const back = lineBack(w); return (w.sentParts ?? []).filter((p) => p.returned !== true).map((p): AwayPart => ({ part: p.label, vendor: v.name, vendorId: v.id, swoNumber: h?.number ?? w.number, hubId: h?.id ?? '', lineId: w.id, component: w.components[0], back: w.predictedCompletion, missing: p.returned === false, verify: back && p.returned === undefined })); }); };
// Seed: one hub per vendor·stage cell, plus multi-line boxes — Claudio 3 bracelets · Chronosky 4 complete watches · the mixed James box (5 lines: 3 Returning on one return label, 2 still In progress incl. E02064) · j-31 received with the date disc missing
const seedHubs = (d: (n: number) => string) => {
  const order = ['v-cm', 'v-claudio', 'v-jacques', 'v-james', 'v-chronosky']; const byOrder = (a: Swo, b: Swo) => order.indexOf(a.vendorId) - order.indexOf(b.vendorId) || laneIdx(a.stage) - laneIdx(b.stage) || a.createdAt.localeCompare(b.createdAt);
  const lines = [...swos].sort(byOrder); const group = new Map<string, string>(); const expected: Record<string, string> = {}; const pick = (pred: (w: Swo) => boolean, n: number) => lines.filter((w) => !group.has(w.id) && pred(w)).slice(0, n);
  const os1 = swos.find((w) => w.jobId === 'j-os1')!; [os1, ...pick((w) => w.vendorId === 'v-james' && !!w.synth && baseStage(w.stage) === 'at_vendor', 1), ...pick((w) => w.vendorId === 'v-james' && !!w.synth && baseStage(w.stage) === 'inbound', 3)].forEach((w) => group.set(w.id, 'james-mixed')); expected['james-mixed'] = d(8);
  pick((w) => w.vendorId === 'v-claudio' && baseStage(w.stage) === 'at_vendor', 9).forEach((w) => group.set(w.id, 'claudio-3')); expected['claudio-3'] = d(6);
  pick((w) => w.vendorId === 'v-chronosky' && baseStage(w.stage) === 'at_vendor' && !isRedoStage(w.stage), 9).forEach((w) => group.set(w.id, 'chronosky-4')); expected['chronosky-4'] = d(20);
  lines.filter((w) => w.vendorId === 'v-cm').forEach((w) => group.set(w.id, `cm-${baseStage(w.stage)}`));
  const made = new Map<string, SwoHub>();
  for (const w of lines) {
    if (w.hubId) continue; const key = group.get(w.id) ?? `single-${w.id}`; const members = key.startsWith('single-') ? [w] : lines.filter((x) => group.get(x.id) === key);
    const h = made.get(key) ?? newHub(w.vendorId, members[0].pointPerson ?? (w.vendorId === 'v-cm' ? 'Chyna' : 'Vienna'), expected[key] ?? members[0].predictedCompletion, members[0].createdBy, members.reduce((m, x) => (x.createdAt < m ? x.createdAt : m), members[0].createdAt)); made.set(key, h);
    for (const m of members) { h.invoices.push(...m.invoices); h.redoCycles.push(...m.redoCycles); h.vendorReplies.push(...m.vendorReplies); h.statusRequests.push(...m.statusRequests); h.timeline.push(...m.timeline.map((t) => (members.length > 1 ? { ...t, text: `[${(m.synth?.jobNumber ?? store.jobs.find((j) => j.id === m.jobId)?.number ?? '').replace(/^E/, '')}] ${t.text}` } : t))); attachLine(h, m); }
    h.timeline.sort((a, b) => b.at.localeCompare(a.at)); h.timeline.push({ at: h.createdAt, by: h.createdBy, text: `${h.number} opened for ${byId(rs.vendors, h.vendorId).name} · barcode ${h.barcode}` });
    // shipments derived from the lines: one outbound per box, one return per return label; the mixed James box gets a return label covering only its 3 Returning lines
    const out = members.filter((m) => m.outbound); if (out.length) h.shipments.push({ id: newId('shp'), direction: 'outbound', label: out[0].outbound!, lineIds: out.map((m) => m.id) });
    const backLines = members.filter((m) => laneIdx(m.stage) >= laneIdx('inbound') && byId(rs.vendors, h.vendorId).ships !== false); if (backLines.length) { const lbl = backLines.find((m) => m.returnLabel)?.returnLabel ?? { direction: 'return' as const, carrier: (isInternationalVendor(byId(rs.vendors, h.vendorId)) ? 'DHL Express' : 'FedEx') as SwoLabel['carrier'], service: 'Priority Overnight (prepaid)', tracking: swoTracking(isInternationalVendor(byId(rs.vendors, h.vendorId)) ? 'DHL Express' : 'FedEx'), international: isInternationalVendor(byId(rs.vendors, h.vendorId)), cost: 64.1, createdAt: backLines[0].inboundAt ?? backLines[0].createdAt, createdBy: 'Vienna', emailedAt: backLines[0].inboundAt ?? backLines[0].createdAt }; backLines.forEach((m) => { m.returnLabel = lbl; }); h.shipments.push({ id: newId('shp'), direction: 'return', label: lbl, lineIds: backLines.map((m) => m.id) }); }
    h.printedAt = h.createdAt; members.forEach((m) => { m.paid = h.invoices.some((i) => !!i.paid); m.vendorInvoiceTotal = h.invoices.reduce((t, i) => t + i.amount, 0); });
  }
  // sent-part detail: E02064 dial + hands away at James; j-31 back from Chronosky with the date disc not returned (blocker on the parent job)
  os1.sentParts = [{ key: 'dial', label: 'Dial' }, { key: 'hands', label: 'Hands' }];
  const j31 = swos.find((w) => w.jobId === 'j-31'); if (j31) { j31.sentParts = [{ key: 'head_only', label: 'Head only', returned: true }, { key: 'date_disc', label: 'Date disc', returned: false }]; j31.timeline.unshift({ at: j31.receivedAt ?? new Date().toISOString(), by: 'Vienna', text: `Receive checklist · Head only ✓ · Date disc ✗ — MISSING: Date disc` }); const j = store.jobs.find((x) => x.id === 'j-31'); if (j) jobStamp(j, `${j31.number} received from Chronosky — Date disc NOT returned (still away, blocker)`); }
  // vendor presets live on the vendor record (editable there); seed the five
  rs.vendors.forEach((v) => { if (v.kind === 'outsource' && v.commonlySent === undefined && VENDOR_PRESETS[v.id]) v.commonlySent = [...VENDOR_PRESETS[v.id]]; });
};


// ---- Feature switches (Setup, manager) ----
export type FeatureKey = 'clientCreateLabel';
const features: Record<FeatureKey, boolean> = { clientCreateLabel: true };
export const FEATURE_META: Record<FeatureKey, { label: string; blurb: string }> = { clientCreateLabel: { label: 'Client creates their own inbound label', blurb: 'On: "Create shipping label" on the client estimate page (same form as staff, shipping cost + declared value preloaded as editable suggestions). Off: button disappears; clients request a label and staff create it — no gap.' } };
export const featureOn = (k: FeatureKey) => features[k];
export async function getFeatureFlags(): Promise<Record<FeatureKey, boolean>> { seedClientLabels(); return resolve({ ...features }); }
export async function setFeatureFlag(k: FeatureKey, on: boolean): Promise<Record<FeatureKey, boolean>> { managerOnly(); features[k] = on; const a = actor(); appendAudit({ type: 'settings', stationName: a.station, userShortName: a.user?.shortName, detail: `Feature "${FEATURE_META[k].label}" turned ${on ? 'ON' : 'OFF'}` }); rsStamp('setup', `Feature ${k} ${on ? 'on' : 'off'}`); return resolve({ ...features }); }

// ---- Client-created inbound labels (portal) — audit trail: who / job / values used / whether the suggested declared value was changed ----
export interface ClientLabelLogRow { id: string; at: string; client: string; estimateNumber: string; jobNumber?: string; shipmentId: string; tracking: string; carrier: ShipCarrierName; suggestedValue: number; declaredValue: number; changedValue: boolean; quotedCost: number; cost: number }
const clientLabelLog: ClientLabelLogRow[] = []; let clientLabelsSeeded = false;
const seedClientLabels = () => {
  if (clientLabelsSeeded) return; clientLabelsSeeded = true;
  // sh-04 (E01045): client accepted the suggested value · sh-06 (E01051): client raised it from $4,800 → $6,400
  const seed = (shipId: string, suggested: number, quotedCost: number, hoursAgo: number) => { const sh = shp.rows.find((r) => r.id === shipId); if (!sh) return; const e = byId(store.estimates, sh.estimateId); const c = byId(fx.clients, sh.clientId); sh.clientCreated = { suggestedValue: suggested, quotedCost, changedValue: suggested !== sh.declaredValue }; e.inboundDeclaredValue = sh.declaredValue; const j = store.jobs.find((x) => x.estimateId === e.id); if (j) j.inboundDeclaredValue = sh.declaredValue; clientLabelLog.push({ id: newId('cl'), at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), client: fullNameOf(c), estimateNumber: e.number, jobNumber: j?.number, shipmentId: sh.id, tracking: sh.trackingNumber ?? '', carrier: sh.carrier, suggestedValue: suggested, declaredValue: sh.declaredValue, changedValue: suggested !== sh.declaredValue, quotedCost, cost: sh.cost ?? quotedCost }); sh.stamps?.push({ at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), by: `${c.firstName} ${c.lastName} (client)`, station: 'Client portal', action: `label created by client · declared $${sh.declaredValue.toLocaleString()}${suggested !== sh.declaredValue ? ` (suggested $${suggested.toLocaleString()} — changed)` : ' (suggested value accepted)'}` }); };
  seed('sh-04', 7_900, 65, 72); seed('sh-06', 4_800, 78.8, 120);
};
export async function getClientLabelLog(): Promise<ClientLabelLogRow[]> { seedClientLabels(); return resolve([...clientLabelLog].sort((a, b) => b.at.localeCompare(a.at))); }
export interface PortalLabelPrep { shipmentId: string; recipient: ShipAddress; validation: { valid: boolean; cleaned: ShipAddress; riskFlag?: string }; suggestedValue: number; quotedShipping: number; estimateNumber: string; refSuggestion: RefValueSuggestion | null }
// Step 1 (client taps Create shipping label): a request row is opened so the SAME staff form (prepareLabel / CreateLabelSheet) can drive it; cancelling removes it again
export async function portalStartLabel(clientId: string, estimateId: string, address: Address, serviceLevel: ShipServiceLevel): Promise<PortalLabelPrep> {
  seedClientLabels(); if (!features.clientCreateLabel) throw new Error('Self-service labels are turned off — request a label and our team will send it');
  const e = requireOwner(clientId, store.estimates.find((x) => x.id === estimateId), 'estimate'); const suggested = e.inboundDeclaredValue ?? Math.max(e.total, 1000);
  const s = await portalRequestLabel(clientId, estimateId, { address, insuredValue: suggested, serviceLevel });
  const recipient: ShipAddress = { name: address.name, street: address.street, city: address.city, state: address.state };
  return resolve({ shipmentId: s.id, recipient, validation: await parcelpro.validateAddress(recipient), suggestedValue: suggested, quotedShipping: e.shippingAmount, estimateNumber: e.number, refSuggestion: suggestInsuredByRef(e.watchId) });
}
export async function portalCancelLabel(clientId: string, shipmentId: string): Promise<void> { const i = shp.rows.findIndex((r) => r.id === shipmentId && r.clientId === clientId && r.stage === 'label_requested'); if (i < 0) return resolve(undefined); const row = shp.rows[i]; shp.rows.splice(i, 1); const e = byId(store.estimates, row.estimateId); if (e.sendIntent?.shipmentId === row.id) e.sendIntent = undefined; return resolve(undefined); }
// Step 2: the client's own confirm creates the label. Tracking # ties to this estimate/job automatically (no unknown-client fallback). Logged like the Hitlist bypass log.
export async function portalCreateLabel(clientId: string, shipmentId: string, input: { recipient: ShipAddress; declaredValue: number; carrier: ShipCarrierName; quotedCost: number; suggestedValue: number }): Promise<ShipmentWithRefs> {
  if (!features.clientCreateLabel) throw new Error('Self-service labels are turned off'); const row = shp.rows.find((r) => r.id === shipmentId && r.clientId === clientId); if (!row) throw new Error('Label request not found');
  const c = byId(fx.clients, clientId); const prev = portalActor; portalActor = { by: `${c.firstName} ${c.lastName} (client)`, station: 'Client portal' };
  try {
    const s = await createInboundLabel(shipmentId, input.recipient, input.declaredValue, input.carrier, row.serviceLevel, input.quotedCost);
    const changed = input.declaredValue !== input.suggestedValue; row.clientCreated = { suggestedValue: input.suggestedValue, quotedCost: input.quotedCost, changedValue: changed }; const e = byId(store.estimates, row.estimateId); const j = store.jobs.find((x) => x.estimateId === e.id);
    clientLabelLog.unshift({ id: newId('cl'), at: new Date().toISOString(), client: fullNameOf(c), estimateNumber: e.number, jobNumber: j?.number, shipmentId, tracking: s.trackingNumber ?? '', carrier: s.carrier, suggestedValue: input.suggestedValue, declaredValue: input.declaredValue, changedValue: changed, quotedCost: input.quotedCost, cost: s.cost ?? input.quotedCost });
    appendAudit({ type: 'shipping', stationName: 'Client portal', userShortName: `${c.firstName} ${c.lastName}`, detail: `CLIENT-CREATED LABEL · ${e.number}${j ? ` / ${j.number}` : ''} · ${s.carrier} ${s.trackingNumber} · declared $${input.declaredValue.toLocaleString()} ${changed ? `(CHANGED from suggested $${input.suggestedValue.toLocaleString()})` : '(suggested value accepted)'} · shipping $${input.quotedCost}` });
    e.sendIntent = { kind: 'label_created', at: new Date().toISOString(), shipmentId };
    estStamp(e, `Client created their own prepaid label · ${s.carrier} ${s.trackingNumber} · declared $${input.declaredValue.toLocaleString()}${changed ? ` (changed from $${input.suggestedValue.toLocaleString()})` : ''}`);
    return resolve(s);
  } finally { portalActor = prev; }
}

// ---- Suggested insured value by reference # — historical average of past shipments of the same ref (smart default, always editable; no history → fall back to existing default) ----
export interface RefValueSuggestion { reference: string; value: number; count: number }
const REF_HISTORY: Record<string, { total: number; count: number }> = { '116500LN': { total: 171_000, count: 6 }, '114060': { total: 39_200, count: 4 }, '124270': { total: 23_700, count: 3 }, '126610LN': { total: 62_000, count: 5 }, '279174': { total: 17_400, count: 2 } };
export const suggestInsuredByRef = (watchId?: string): RefValueSuggestion | null => { const w = watchId ? fx.watches.find((x) => x.id === watchId) : undefined; if (!w) return null; const h = REF_HISTORY[w.reference]; if (!h?.count) return null; return { reference: w.reference, value: Math.round(h.total / h.count / 100) * 100, count: h.count }; };
// every label bound feeds the history for the next suggestion
const recordRefHistory = (watchId: string | undefined, value: number) => { const w = watchId ? fx.watches.find((x) => x.id === watchId) : undefined; if (!w || !(value > 0)) return; const h = (REF_HISTORY[w.reference] ??= { total: 0, count: 0 }); h.total += value; h.count += 1; };

// ---- Access control panel (D-391) — OWNER ONLY. Per-user × per-screen toggle; role default comes from the nav tier table (config/navigation.ts), an override is a visible diff from it. Every change logged (who / whom / screen / from → to / when). Evaluated on the user's next route load (TierGate + sidebar), never mid-page. ----
const ACCESS_KEYS = { overrides: 'rollisuite.access.overrides', log: 'rollisuite.access.log' };
export type AccessValue = 'role' | 'allow' | 'deny';
export interface AccessChange { id: string; at: string; by: string; station: string; userId: string; userShort: string; screenKey: string; screenLabel: string; from: string; to: string }
const accessOverrides = (): Record<string, Record<string, boolean>> => readJson(ACCESS_KEYS.overrides, {});
export const accessOverrideSync = (userId: string, screenKey: string): boolean | undefined => accessOverrides()[userId]?.[screenKey];
export const accessOverridesFor = (userId: string): Record<string, boolean> => ({ ...(accessOverrides()[userId] ?? {}) });
export async function getAccessUsers(): Promise<User[]> { if (!isOwnerSync()) throw new Error('Access control is owner-only (MH)'); return resolve(fx.users.map((u) => ({ ...u }))); }
export async function setAccessOverride(userId: string, screenKey: string, screenLabel: string, value: AccessValue): Promise<Record<string, boolean>> {
  if (!isOwnerSync()) throw new Error('Access control is owner-only (MH)'); const u = byId(fx.users, userId); if (u.id === OWNER_USER_ID) throw new Error('The owner’s own access cannot be toggled');
  const all = accessOverrides(); const mine = all[userId] ?? {}; const from: AccessValue = mine[screenKey] === undefined ? 'role' : mine[screenKey] ? 'allow' : 'deny'; if (from === value) return resolve({ ...mine });
  if (value === 'role') delete mine[screenKey]; else mine[screenKey] = value === 'allow'; if (Object.keys(mine).length) all[userId] = mine; else delete all[userId]; writeJson(ACCESS_KEYS.overrides, all);
  const a = actor(); const ch: AccessChange = { id: newId('acc'), at: new Date().toISOString(), by: a.by, station: a.station, userId, userShort: u.shortName, screenKey, screenLabel, from, to: value };
  writeJson(ACCESS_KEYS.log, [ch, ...readJson<AccessChange[]>(ACCESS_KEYS.log, [])].slice(0, 500));
  appendAudit({ type: 'settings', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Access · ${u.shortName} · ${screenLabel} · ${from} → ${value}` });
  return resolve({ ...mine });
}
export async function getAccessLog(): Promise<AccessChange[]> { if (!isOwnerSync()) throw new Error('Access control is owner-only (MH)'); return resolve(readJson<AccessChange[]>(ACCESS_KEYS.log, [])); }

// ---- G6 Access control additions (MH 2026-09-30): enable / disable with reason, Limits drawer (lockedStations · partsCategories · pricing), org tree (reportsTo), containers owned, new user from template ----
// Tier stays separate from the tree: a tier change is not a tree change. Data scope / view-as grouping / escalation walk the tree instead of hand-coded lists.
export type PricingLimit = UserLimits['pricing'];
export const PRICING_LIMITS: { key: PricingLimit; label: string }[] = [{ key: 'full', label: 'Full pricing (cost + sell)' }, { key: 'cost_only', label: 'Cost only — no sell prices' }, { key: 'none', label: 'No pricing' }];
export const DEFAULT_LIMITS: UserLimits = { lockedStations: [], partsCategories: [], pricing: 'full' };
export const limitsOf = (u: User): UserLimits => u.limits ?? DEFAULT_LIMITS;
const assertEnabled = (u: User, stationName: string, method: AuditEvent['method']) => { if (u.disabled) { appendAudit({ type: 'sign_in_failed', stationName, userShortName: u.shortName, userDisplayName: u.displayName, method, detail: `Account disabled · ${u.disabled.reason}` }); throw new Error(`Account disabled — ${u.disabled.reason}. Ask MH to re-enable it.`); } };
export const isDisabledSync = (u: User) => !!u.disabled;
// Org tree
export const managerOf = (userId: string): User | undefined => { const u = fx.users.find((x) => x.id === userId); return u?.reportsTo ? fx.users.find((x) => x.id === u.reportsTo) : undefined; };
export const managerShortOf = (shortName: string): string | undefined => { const u = fx.users.find((x) => x.shortName === shortName); return u ? managerOf(u.id)?.shortName : undefined; };
export const directReports = (userId: string): User[] => fx.users.filter((u) => u.reportsTo === userId && !u.disabled);
export const chainOf = (userId: string): User[] => { const out: User[] = []; let cur = managerOf(userId); const seen = new Set<string>(); while (cur && !seen.has(cur.id)) { out.push(cur); seen.add(cur.id); cur = managerOf(cur.id); } return out; };
export const subtreeOf = (rootId: string): User[] => { const out: User[] = []; const walk = (id: string) => directReports(id).forEach((r) => { out.push(r); walk(r.id); }); walk(rootId); return out; };
export const inSubtree = (rootId: string, userId: string) => rootId === userId || chainOf(userId).some((m) => m.id === rootId);
export interface OrgNode { user: User; reports: OrgNode[] }
export const getOrgTree = (): OrgNode[] => { const build = (u: User): OrgNode => ({ user: u, reports: fx.users.filter((r) => r.reportsTo === u.id).map(build) }); return fx.users.filter((u) => !u.reportsTo || !fx.users.some((m) => m.id === u.reportsTo)).map(build); };
// Containers (bins / safes) — created in Custody, shown read-only in the Limits drawer
export interface Container { key: string; label: string; kind: 'safe' | 'bin'; owner: string }
export const CONTAINERS: Container[] = [
  { key: 'pre_queue', label: 'Pre-queue safe (WM)', kind: 'safe', owner: 'MM' }, { key: 'safe_head', label: 'Head safe · awaiting band', kind: 'safe', owner: 'MM' },
  { key: 'mgr_safe_polish', label: 'Manager safe · polish in / out', kind: 'safe', owner: 'Vienna' },
  { key: 'band_pre', label: 'Pre-queue safe (band)', kind: 'safe', owner: 'JV' }, { key: 'band_mgr_safe', label: 'Band manager safe · in / out', kind: 'safe', owner: 'JV' }, { key: 'jv_bin', label: 'JV bin', kind: 'bin', owner: 'JV' },
  { key: 'owner_safe', label: 'Owner safe', kind: 'safe', owner: 'MH' },
];
export const containersOwnedBy = (shortName: string) => CONTAINERS.filter((c) => c.owner === shortName);
const accessLog = (userId: string, screenKey: string, screenLabel: string, from: string, to: string) => { const u = byId(fx.users, userId); const a = actor(); const ch: AccessChange = { id: newId('acc'), at: new Date().toISOString(), by: a.by, station: a.station, userId, userShort: u.shortName, screenKey, screenLabel, from, to }; writeJson(ACCESS_KEYS.log, [ch, ...readJson<AccessChange[]>(ACCESS_KEYS.log, [])].slice(0, 500)); appendAudit({ type: 'settings', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Access · ${u.shortName} · ${screenLabel} · ${from} → ${to}` }); };
export async function setUserEnabled(userId: string, enabled: boolean, reason: string): Promise<User> {
  if (!isOwnerSync()) throw new Error('Access control is owner-only (MH)'); const u = byId(fx.users, userId); if (u.id === OWNER_USER_ID) throw new Error('The owner cannot be disabled'); if (!reason.trim()) throw new Error('A reason is required');
  const from = u.disabled ? 'disabled' : 'active'; if (enabled) delete u.disabled; else u.disabled = { at: new Date().toISOString(), by: actor().by, reason: reason.trim() };
  accessLog(userId, 'account', 'Account', from, `${enabled ? 'active' : 'disabled'} · ${reason.trim()}`); return resolve({ ...u });
}
export async function setUserLimits(userId: string, patch: { limits?: UserLimits; reportsTo?: string | null }): Promise<User> {
  if (!isOwnerSync()) throw new Error('Access control is owner-only (MH)'); const u = byId(fx.users, userId);
  if (patch.reportsTo !== undefined) { const to = patch.reportsTo || undefined; if (to === u.id) throw new Error('Nobody reports to themselves'); if (to && inSubtree(u.id, to)) throw new Error('That would make a loop in the org tree'); const from = managerOf(u.id)?.shortName ?? '—'; u.reportsTo = to; accessLog(userId, 'reportsTo', 'Reports to', from, to ? byId(fx.users, to).shortName : '—'); }
  if (patch.limits) { const prev = limitsOf(u); u.limits = { lockedStations: [...patch.limits.lockedStations], partsCategories: [...patch.limits.partsCategories], pricing: patch.limits.pricing }; accessLog(userId, 'limits', 'Limits', `${prev.lockedStations.length} locked · ${prev.partsCategories.length} cat · ${prev.pricing}`, `${u.limits.lockedStations.length} locked · ${u.limits.partsCategories.length} cat · ${u.limits.pricing}`); }
  return resolve({ ...u });
}
export interface NewUserFromTemplate { templateId: string; firstName: string; shortName: string; dutyLabel: string; division: Division | 'both'; reportsTo?: string; password?: string; pin?: string }
export async function createUserFromTemplate(input: NewUserFromTemplate): Promise<User> {
  if (!isOwnerSync()) throw new Error('Access control is owner-only (MH)'); const t = byId(fx.users, input.templateId); const first = input.firstName.trim().toLowerCase(); const short = input.shortName.trim();
  if (!first || !short) throw new Error('First name and short name are required'); if (fx.users.some((u) => u.shortName.toLowerCase() === short.toLowerCase() || u.firstName === first)) throw new Error('Name or short name already in use');
  const pin = input.pin?.trim() || '1234'; if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
  const u: User = { id: `u-${first}`, firstName: first, shortName: short, displayName: `${short} — ${input.dutyLabel.trim() || t.dutyLabel}`, dutyLabel: input.dutyLabel.trim() || t.dutyLabel, accessTier: t.accessTier, roles: [...t.roles], division: input.division, password: input.password?.trim() || `${first}123`, pin, reportsTo: input.reportsTo ?? t.reportsTo, limits: t.limits ? { ...t.limits, lockedStations: [...t.limits.lockedStations], partsCategories: [...t.limits.partsCategories] } : undefined, createdFrom: t.id };
  fx.users.push(u); accessLog(u.id, 'account', 'Account', '—', `created from template ${t.shortName} · ${u.accessTier} · reports to ${managerOf(u.id)?.shortName ?? '—'}`); return resolve({ ...u });
}
export const RW_STATION_OPTIONS: { key: string; label: string }[] = [
  { key: 'wm_bench_1', label: 'WM Bench 1' }, { key: 'wm_bench_2', label: 'WM Bench 2' }, { key: 'wm_bench_3', label: 'WM Bench 3' }, { key: 'uncase', label: 'Uncase' }, { key: 'movement_service', label: 'Movement service' }, { key: 'parts_approval', label: 'Parts approval' }, { key: 'recase_test', label: 'Recase + test' },
  { key: 'polish_room', label: 'Polish room' }, { key: 'refinish', label: 'Refinish' }, { key: 'band_assign', label: 'Band tech bench' }, { key: 'band_qc', label: 'Band QC' }, { key: 'final_assembly', label: 'Final assembly' }, { key: 'testing', label: 'Testing' }, { key: 'shipping', label: 'Shipping' },
];


// ---- JOB DETAIL v2 (2026-09-30, MH brief) — "where is it and where is it in the process": one process line per component, custody from the custody record (never from status), add-ons since the estimate ----
export type FlowStageKey = 'intake' | 'queue' | 'progress' | 'qc' | 'finished' | 'v_route' | 'v_vendor' | 'v_return' | 'v_received' | 'v_inspect';
export interface FlowBlocker { text: string; tone: 'red' | 'amber' }
export interface FlowStage { key: FlowStageKey; label: string; vendor?: string; state: 'done' | 'current' | 'todo'; note?: string; blocker?: FlowBlocker }
export interface FlowCustody { holder: string; where: string; since?: string; source: 'custody' | 'derived' }
export interface FlowLine { key: ComponentKey; code: 'H' | 'B' | 'C'; label: string; itemLabel?: string; stages: FlowStage[]; custody: FlowCustody; mismatch?: string; finished: boolean; swoId?: string; vendorName?: string }
export interface JobFlow { lines: FlowLine[]; done: number; total: number; split: boolean; statusStage: FlowStageKey }
const FLOW_LABEL: Record<FlowStageKey, string> = { intake: 'Intake', queue: 'In queue', progress: 'In progress', qc: 'QC', finished: 'Finished', v_route: 'In route', v_vendor: 'At vendor', v_return: 'Returning', v_received: 'Received', v_inspect: 'Inspection' };
const STATUS_STAGE: Record<JobStatus, FlowStageKey> = { intake: 'intake', in_review: 'intake', awaiting_customer_approval: 'intake', approved: 'queue', in_service: 'progress', testing: 'qc', awaiting_manager_review: 'qc', ready_to_ship: 'finished', closed: 'finished' };
const SHOP_STAGES: FlowStageKey[] = ['intake', 'queue', 'progress', 'qc', 'finished'];
const V_KEY: Partial<Record<SwoStage, FlowStageKey>> = { sent: 'v_route', at_vendor: 'v_vendor', inbound: 'v_return', received: 'v_received', inspection: 'v_inspect' };
// Custody station → process stage. Await/into safes = the component's own work is done, waiting for reunification (QC boundary).
const stationStage = (k: RwStationKey): FlowStageKey => (k === 'pre_approval' ? 'intake' : k.endsWith('pre_queue') ? 'queue' : k === 'finished' ? 'finished' : k === 'final_assembly' || k === 'testing' || k.includes('await') || k.startsWith('into_safe') ? 'qc' : 'progress');
// Which custody stages are consistent with a job status — anything else is a real status/custody mismatch (shown, never hidden)
const CUSTODY_OK: Record<FlowStageKey, FlowStageKey[]> = { intake: ['intake', 'queue'], queue: ['intake', 'queue'], progress: ['queue', 'progress', 'qc'], qc: ['qc'], finished: ['finished'], v_route: [], v_vendor: [], v_return: [], v_received: [], v_inspect: [] };
const COMP_CODE: Record<ComponentKey, 'H' | 'B' | 'C'> = { head: 'H', band: 'B', case: 'C' };
const flowLine = (j: Job, c: JobComponent, swo: Swo | undefined, jobHold: JobHold | undefined, pr: PartsRequest | undefined): FlowLine => {
  const hold = jobHold && (!jobHold.component || jobHold.component === c.key) ? jobHold : undefined; // scoped hold reds only its own leg
  const pl = derivePlacement(j, c); const saved = !!c.station; const vendorHeld = !!c.custodyTech?.startsWith('vendor:');
  const vendor = swo ? byId(rs.vendors, swo.vendorId) : vendorHeld ? rs.vendors.find((v) => v.id === c.custodyTech!.slice(7)) : undefined;
  const statusStage = STATUS_STAGE[j.status]; const done = !!c.completedAt;
  let cur: FlowStageKey = statusStage;
  if (statusStage === 'progress') cur = pl.status === 'not_started' ? 'queue' : done ? 'qc' : 'progress';
  let keys: FlowStageKey[] = SHOP_STAGES; let note: Partial<Record<FlowStageKey, string>> = {}; let vKey: FlowStageKey | undefined;
  if (swo && vendor) {
    const leg = laneStagesFor(vendor).filter((s) => s !== 'queue' && s !== 'fulfilled').map((s) => V_KEY[s]!);
    keys = ['intake', 'queue', ...leg, 'qc', 'finished'];
    const bs = baseStage(swo.stage); vKey = bs === 'queue' ? 'queue' : V_KEY[bs];
    // the vendor leg only moves the dot once the job is actually in service — before approval the process position stays at Intake / In queue
    if (statusStage === 'progress' && vKey) cur = vKey;
    if (bs === 'queue') note = { queue: `queued for ${vendor.name}` };
  }
  const idx = keys.indexOf(cur);
  const blockers: Partial<Record<FlowStageKey, FlowBlocker>> = {};
  if (j.status === 'awaiting_customer_approval') blockers.intake = { text: 'awaiting client approval', tone: 'red' };
  if (hold) blockers[cur] = { text: `${hold.type === 'parts' ? 'Parts' : 'Outsource'} hold${hold.component ? ` · ${PART_LABEL[hold.component]} only` : ''} · ${hold.reason}`, tone: 'red' };
  if (pr) blockers[cur] = { text: `awaiting client approval · ${pr.number}${pr.items?.[0]?.description ? ` · ${pr.items[0].description}` : ''}`, tone: 'red' };
  // sent parts not back: unticked at receiving = still away = a blocker on this component; back but unverified = check the box
  const missingParts = (swo?.sentParts ?? []).filter((p) => p.returned === false); const unverified = swo && lineBack(swo) && (swo.sentParts ?? []).some((p) => p.returned === undefined);
  if (missingParts.length && vendor) blockers[cur] = { text: `${missingParts.map((p) => p.label).join(', ')} not returned — ${vendor.name} · ${swo!.number}`, tone: 'red' }; else if (unverified && vendor) blockers[cur] = { text: `verify contents · receive checklist ${swo!.number}`, tone: 'amber' };
  if (swo && vendor && vKey && swo.stage !== 'fulfilled') {
    const today = new Date().toISOString().slice(0, 10); const exp = swo.predictedCompletion; const md = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (swoIsLate(swo)) blockers[vKey] = { text: `${vendor.name} · delayed ${Math.round((Date.now() - new Date(`${exp!}T12:00:00`).getTime()) / 86_400_000)}d past ${md(exp!)}${swo.redoCycles.length ? ` · redo ×${swo.redoCycles.length}` : ''}`, tone: 'red' };
    else if (exp && ['sent', 'at_vendor', 'inbound'].includes(baseStage(swo.stage)) && (new Date(exp).getTime() - new Date(today).getTime()) / 86_400_000 <= 2) blockers[vKey] = { text: `${vendor.name} · at risk · due ${md(exp)}`, tone: 'amber' };
  }
  const stages: FlowStage[] = keys.map((k, i) => ({ key: k, label: FLOW_LABEL[k], vendor: k.startsWith('v_') ? vendor?.name : undefined, state: i < idx ? 'done' : i === idx ? 'current' : 'todo', note: k === cur && done && cur === 'qc' && statusStage === 'progress' ? 'complete · waiting for the other components' : note[k], blocker: blockers[k] }));
  const last = c.history?.[c.history.length - 1];
  const custody: FlowCustody = vendorHeld
    ? { holder: `At vendor: ${vendor?.name ?? c.custodyTech!.slice(7)}`, where: swo ? `${swo.number} · ${swoStageLabel(swo.stage)}${swo.sentParts?.length ? ` · away: ${swo.sentParts.filter((p) => p.returned !== true).map((p) => p.label.toLowerCase()).join(', ')}` : ''}${swo.predictedCompletion ? ` · back ${swo.predictedCompletion.slice(5).replace('-', '/')}` : ''}` : 'outsourced', since: last?.at, source: 'custody' }
    : saved ? { holder: c.custodyTech ?? 'unassigned', where: stationOf(pl.station).label, since: last?.at, source: 'custody' }
    : { holder: c.custodyTech ?? c.completedBy ?? 'no custody scan yet', where: stationOf(pl.station).label, source: 'derived' };
  const custodyStage = vendorHeld ? 'progress' : stationStage(pl.station);
  const mismatch = (saved || vendorHeld) && !CUSTODY_OK[statusStage].includes(custodyStage) ? `Status says ${FLOW_LABEL[statusStage]} · custody says ${vendorHeld ? custody.holder : stationOf(pl.station).label}` : undefined;
  return { key: c.key, code: COMP_CODE[c.key], label: PART_LABEL[c.key], itemLabel: c.itemLabel, stages, custody, mismatch, finished: done || statusStage === 'finished', swoId: swo?.id, vendorName: vendor?.name };
};
export const jobFlowSync = (j: Job): JobFlow => {
  seedSwo();
  const comps = store.jobs.some((x) => x.id === j.id) ? ensureParts(j) : j.components?.length ? j.components : ensureComponents({ ...j, components: undefined });
  const hold = activeHold(j); const pr = store.partsRequests.find((r) => r.jobId === j.id && r.status === 'awaiting_client');
  const legs = swos.filter((w) => !w.synth && w.jobId === j.id && w.stage !== 'fulfilled');
  const lines = comps.map((c, i) => flowLine(j, c, legs.find((w) => w.components.includes(c.key)), hold, pr && (pr.component ? pr.component === c.key : i === 0) ? pr : undefined));
  return { lines, done: lines.filter((l) => l.finished).length, total: lines.length, split: lines.length > 1, statusStage: STATUS_STAGE[j.status] };
};
export async function getJobFlow(jobId: string): Promise<JobFlow> { return resolve(jobFlowSync(getJobRow(jobId))); }
// Vendor legs of a job for the info-only Outsource card (open first, fulfilled as history) — never the synthetic volume rows
export async function getJobVendorLegs(jobId: string): Promise<SwoWithRefs[]> { seedSwo(); return resolve(swos.filter((w) => !w.synth && w.jobId === jobId).sort((a, b) => Number(a.stage === 'fulfilled') - Number(b.stage === 'fulfilled') || b.createdAt.localeCompare(a.createdAt)).map(swoRefs)); }

// Add-ons since the estimate: derived rows are the truth (client-approved parts requests + estimate-revision lines added after the first send); manual rows cover counter / phone approvals and are flagged + audited
export type AddonChannel = 'portal' | 'email' | 'phone' | 'counter' | 'text';
export const ADDON_CHANNELS: { key: AddonChannel; label: string }[] = [{ key: 'portal', label: 'Portal' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'counter', label: 'At the counter' }, { key: 'text', label: 'Text' }];
export interface JobAddon { id: string; jobId: string; at: string; description: string; approver: string; channel: AddonChannel; amount: number; source: 'parts_request' | 'estimate_revision' | 'manual'; ref?: string; note?: string; loggedBy?: string; pendingConfirmation?: boolean; confirmedAt?: string; confirmedVia?: 'portal' | 'email' | 'counter'; confirmedBy?: string }
export interface JobAddonsView { rows: JobAddon[]; total: number; since?: string }
export interface AddonInput { description: string; approver: string; channel: AddonChannel; amount: number; note?: string; at?: string; pendingConfirmation?: boolean }
const manualAddons: JobAddon[] = []; let addonsSeeded = false;
const seedAddons = () => { if (addonsSeeded) return; addonsSeeded = true; const j = store.jobs.find((x) => x.id === 'j-30'); if (!j) return; manualAddons.push({ id: 'ao-01', jobId: 'j-30', at: daysAgoIso(3), description: 'Crown + tube replacement — found at uncasing', approver: fullNameOf(byId(fx.clients, j.clientId)), channel: 'counter', amount: 185, source: 'manual', note: 'Client stopped by · approved verbally at the desk', loggedBy: 'Vienna' }); };
const prAddon = (r: PartsRequest, client: string): JobAddon | null => {
  if (!['approved', 'on_order', 'received'].includes(r.status)) return null;
  const at = r.clientDecidedAt ?? r.history?.find((h) => h.action === 'client approved')?.at; if (!at) return null;
  const part = r.partId ? store.parts.find((p) => p.id === r.partId) : undefined;
  const amount = (r.items?.length ? r.items.reduce((t, i) => t + (i.price ?? 0) * i.qty, 0) : (part?.price ?? 0) * r.qty);
  return { id: `ao-${r.id}`, jobId: r.jobId, at, description: r.items?.map((i) => `${i.description}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ') || `${part?.name ?? 'Part'}${r.qty > 1 ? ` ×${r.qty}` : ''}`, approver: r.decidedBy?.includes('(client)') ? r.decidedBy.replace(' (client)', '') : client, channel: r.emailId ? 'email' : 'portal', amount, source: 'parts_request', ref: r.number };
};
const revisionAddons = (e: Estimate, client: string): JobAddon[] => {
  if (!e.sentAt) return [];
  const firstSent = [...e.revisions].filter((r) => r.status !== 'draft').sort((a, b) => a.revision - b.revision)[0]; if (!firstSent) return [];
  const before = new Set(firstSent.lines.map((l) => l.id));
  return e.lines.filter((l) => !before.has(l.id)).map((l) => ({ id: `ao-${e.id}-${l.id}`, jobId: e.jobId ?? '', at: e.approvedAt ?? e.updatedAt, description: l.description, approver: e.approvedAt ? client : 'pending approval', channel: e.approvedVia === 'portal' ? 'portal' as AddonChannel : 'counter' as AddonChannel, amount: l.qty * l.unitPrice, source: 'estimate_revision' as const, ref: `${e.number} rev ${e.revision}` }));
};
export async function getJobAddons(jobId: string): Promise<JobAddonsView> {
  seedAddons(); const j = store.jobs.find((x) => x.id === jobId); if (!j) return resolve({ rows: [], total: 0 });
  const client = fullNameOf(byId(fx.clients, j.clientId)); const e = j.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : undefined;
  const rows = [...store.partsRequests.filter((r) => r.jobId === jobId).map((r) => prAddon(r, client)).filter((x): x is JobAddon => !!x), ...(e ? revisionAddons(e, client) : []), ...manualAddons.filter((a) => a.jobId === jobId)].sort((a, b) => b.at.localeCompare(a.at));
  return resolve({ rows, total: rows.reduce((t, r) => t + r.amount, 0), since: e?.sentAt ?? j.createdAt });
}
export async function addJobAddon(jobId: string, input: AddonInput): Promise<JobAddon> {
  seedAddons(); const j = getJobRow(jobId); const a = actor();
  if (!input.description.trim()) throw new Error('Describe the add-on'); if (!input.approver.trim()) throw new Error('Who approved it?'); if (!(input.amount >= 0)) throw new Error('Amount must be 0 or more');
  const row: JobAddon = { id: newId('ao'), jobId, at: input.at ?? new Date().toISOString(), description: input.description.trim(), approver: input.approver.trim(), channel: input.channel, amount: Math.round(input.amount * 100) / 100, source: 'manual', note: input.note?.trim() || undefined, loggedBy: a.by, pendingConfirmation: input.pendingConfirmation || undefined };
  manualAddons.push(row);
  const pend = row.pendingConfirmation ? ' · PENDING client confirmation (portal / email)' : '';
  jobStamp(j, `Add-on logged · ${row.description} · ${fmtMoney(row.amount)} · approved by ${row.approver} (${row.channel}) · manual${pend}`);
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${j.number} add-on (manual) · ${row.description} · ${fmtMoney(row.amount)} · approved by ${row.approver} via ${row.channel}${pend}` });
  // phone approvals (MH ruling b): a confirmation request goes out and the add-on stays pending until the client confirms by portal / email
  if (row.pendingConfirmation) { const c = byId(fx.clients, j.clientId); queueOutbox({ id: newId('ob'), to: c.email, toName: fullNameOf(c), subject: `Please confirm — ${row.description} (${j.number})`, body: `Hi ${c.firstName},\n\nOn the phone today you approved: ${row.description} — ${fmtMoney(row.amount)}.\n\nPlease confirm with one tap in RolliConnect (or reply to this email) so we can proceed.\n\n— ${a.by}`, relatedRef: j.number, createdAt: row.at, createdBy: a.by, station: a.station, status: 'pending' }); }
  return resolve(row);
}
// Client confirmed the phone approval (portal / email reply / at the counter) — the add-on becomes firm
export async function confirmJobAddon(jobId: string, addonId: string, via: 'portal' | 'email' | 'counter'): Promise<JobAddon> {
  seedAddons(); const j = getJobRow(jobId); const a = actor(); const row = manualAddons.find((x) => x.id === addonId && x.jobId === jobId); if (!row) throw new Error('No such add-on'); if (!row.pendingConfirmation) throw new Error('Already confirmed');
  row.pendingConfirmation = false; row.confirmedAt = new Date().toISOString(); row.confirmedVia = via; row.confirmedBy = a.by;
  jobStamp(j, `Add-on confirmed by client via ${via} · ${row.description} · ${fmtMoney(row.amount)}`);
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${j.number} add-on confirmed via ${via} · ${row.description}` });
  return resolve(row);
}

// ---- W·B·P DOT ROWS (MH 2026-09-30): one glance per job — W = head / movement, B = bracelet, P = case / polish. Derived from the same per-component flow as the Job page.
// Empty ring = no such leg · green = on track · blue = that line is Finished (waiting on the others / pickup) · red = blocker (hold, delayed vendor, missing parts, awaiting approval).
export type WbpLeg = 'W' | 'B' | 'P';
export type WbpState = 'none' | 'ok' | 'finished' | 'blocked';
export interface WbpDot { state: WbpState; title: string }
export interface WbpRow { jobId: string; jobNumber: string; status: JobStatus; clientId: string; watchLabel: string; legs: Record<WbpLeg, WbpDot> }
export const WBP_LEGS: { key: WbpLeg; label: string }[] = [{ key: 'W', label: 'Head / movement' }, { key: 'B', label: 'Bracelet' }, { key: 'P', label: 'Case / polish' }];
const WBP_OF: Record<ComponentKey, WbpLeg> = { head: 'W', band: 'B', case: 'P' };
const WBP_RANK: Record<WbpState, number> = { none: 0, finished: 1, ok: 2, blocked: 3 };
export const wbpRowSync = (j: Job): WbpRow => {
  const flow = jobFlowSync(j); const w = store.watches.find((x) => x.id === j.watchId);
  const legs = Object.fromEntries(WBP_LEGS.map((l) => [l.key, { state: 'none', title: `${l.label} — not part of this job` }])) as Record<WbpLeg, WbpDot>;
  for (const l of flow.lines) {
    const key = WBP_OF[l.key]; const blocker = l.stages.find((s) => s.blocker?.tone === 'red')?.blocker; const cur = l.stages.find((s) => s.state === 'current');
    const state: WbpState = blocker ? 'blocked' : l.finished ? 'finished' : 'ok';
    const title = `${l.label}${l.itemLabel ? ` ${l.itemLabel}` : ''} · ${blocker ? blocker.text : l.finished ? 'Finished — waiting on the other components / pickup' : `${cur?.label ?? 'In progress'}${cur?.vendor ? ` · ${cur.vendor}` : ''} · on track`}`;
    // multi-item jobs carry several lines per leg — the worst state wins
    if (WBP_RANK[state] > WBP_RANK[legs[key].state]) legs[key] = { state, title };
  }
  return { jobId: j.id, jobNumber: j.number, status: j.status, clientId: j.clientId, watchLabel: w ? `${w.brand} ${w.model}`.trim() : '', legs };
};
export const wbpForJobSync = (jobId: string): WbpRow | null => { const j = store.jobs.find((x) => x.id === jobId); return j && jobInPossessionSync(j) ? wbpRowSync(j) : null; };
// Every job of a client still in our possession (dots rule); the job in hand (when given) comes first so the outlined row leads
export const wbpForClientSync = (clientId: string, firstJobId?: string): WbpRow[] => store.jobs.filter((j) => j.clientId === clientId && jobInPossessionSync(j)).sort((a, b) => Number(b.id === firstJobId) - Number(a.id === firstJobId) || a.number.localeCompare(b.number)).map(wbpRowSync);
export async function getWbpForClient(clientId: string, firstJobId?: string): Promise<WbpRow[]> { return resolve(wbpForClientSync(clientId, firstJobId)); }

// ---- Staff presence for the message directory — DERIVED, never toggled: clocked out → away · on a call or signed in at a Front Desk → with client · else at bench ----
export type Presence = 'away' | 'with_client' | 'at_bench';
export interface PresenceView { state: Presence; label: string; detail: string }
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const staffPresenceSync = (u: User): PresenceView => {
  const last = rgEffectivePunches().filter((p) => p.userId === u.id).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (last?.kind === 'out') return { state: 'away', label: 'Away', detail: `clocked out ${isToday(last.at) ? clock(last.at) : new Date(last.at).toLocaleDateString('en-US', { weekday: 'short' })}` };
  const call = ratings.calls.find((c) => c.answeredBy === u.shortName && c.outcome === 'answered' && !c.durationSec && Date.now() - new Date(c.at).getTime() < 10 * 60_000);
  if (call) return { state: 'with_client', label: 'With client', detail: 'on a call' };
  const sess = readAudit().filter((e) => (e.type === 'sign_in' || e.type === 'sign_out') && e.userShortName === u.shortName && isToday(e.timestamp)).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (sess?.type === 'sign_in' && /front desk/i.test(sess.stationName)) return { state: 'with_client', label: 'With client', detail: `at ${sess.stationName}` };
  return { state: 'at_bench', label: 'At bench', detail: last ? `clocked in ${clock(last.at)}` : 'no clock-in today' };
};

// ---- AUTO-PO THRESHOLD (MH 2026-09-30) — runs on every stock movement / count close / needs-ordering entry / hitlist read. Inventory is the shared pool (RW + RS) → global parts.
// Per vendor: draft total ≥ $400 → CREATE the PO as a draft (not sent) and PIN it to MH as HIGH, standing until sent or dismissed with reason. Under $400 the lines wait in needs-ordering;
// a vendor whose draft has sat under threshold ≥ 14 days pins as NORMAL. One open auto draft per vendor — new lines join it. Send still needs MH / a manager: red lines acknowledged, then Send.
export const AUTO_PO_THRESHOLD = 400; export const AUTO_PO_WAIT_DAYS = 14;
const MH_ASSIGNEE: Assignee = { type: 'user', shortName: 'MH' };
const upsertSystemPin = (key: string, input: { title: string; subtitle?: string; assignedTo: Assignee; priority: 'high' | 'normal'; standing?: boolean; link?: string }) => {
  const cur = store.pinned.find((p) => p.key === key && !p.dismissedAt); if (cur) { Object.assign(cur, input); return cur; }
  const p: PinnedItem = { id: newId('pin'), key, ...input, createdBy: 'system', division: 'rolliworks', global: true, createdAt: new Date().toISOString(), station: 'RolliSuite' }; store.pinned.unshift(p); return p;
};
const resolveSystemPin = (key: string, reason: string) => store.pinned.filter((p) => p.key === key && !p.dismissedAt).forEach((p) => { p.dismissedAt = new Date().toISOString(); p.dismissedBy = 'system'; p.dismissReason = reason; });
const autoLinesFor = (vendorId: string, rows: NeedsOrderingRow[]) => rows.map((n) => { const pr = partPricingSync(n.partId); const vend = pr.vendors.find((x) => x.vendorId === vendorId); const rule = getReorderRule(n.partId); const part = byId(store.parts, n.partId); const qty = Math.max(n.qty, rule.orderUpTo ? rule.orderUpTo - n.onHand - n.onOrder : 0, 1); return { partId: n.partId, qty, unitCost: vend?.lastPrice ?? pr.avgCost ?? part.cost ?? part.price, requestId: n.requestId, avg: pr.avgCost }; }).filter((l, i, arr) => arr.findIndex((x) => x.partId === l.partId) === i);
export const autoPoTitle = (p: PurchaseOrder) => `${p.number} · ${byId(rs.vendors, p.vendorId).name} · ${fmtMoney(p.total)} · ${p.lines.length} line${p.lines.length === 1 ? '' : 's'} · ${poRedLines(p).length} red`;
export const openAutoDraft = (vendorId: string) => rs.pos.find((p) => p.vendorId === vendorId && p.status === 'draft' && p.auto);
export interface AutoPoVendorState { vendor: Vendor; lines: number; total: number; draft?: PurchaseOrder; since?: string; daysWaiting: number; pinned: 'high' | 'normal' | null }
const autoPoWait = new Map<string, string>();
export const autoPoSweepSync = (): AutoPoVendorState[] => {
  const needs = needsOrderingSync(); const byVendor = new Map<string, NeedsOrderingRow[]>();
  needs.forEach((n) => { const v = preferredVendorOf(n.partId); if (v) byVendor.set(v.id, [...(byVendor.get(v.id) ?? []), n]); });
  const out: AutoPoVendorState[] = [];
  rs.vendors.filter((v) => v.active && v.kind !== 'outsource').forEach((v) => {
    const rows = byVendor.get(v.id) ?? []; const lines = autoLinesFor(v.id, rows); const open = openAutoDraft(v.id);
    if (open) { // new lines join the open draft
      let joined = 0; lines.forEach((l) => { if (!open.lines.some((x) => x.partId === l.partId)) { const pt = byId(store.parts, l.partId); open.lines.push({ id: newId('pol'), partId: pt.id, partNumber: pt.partNumber, description: pt.name, qty: l.qty, unitCost: l.unitCost, receivedQty: 0, requestId: l.requestId, avgAtOrder: l.avg }); joined += 1; } });
      if (joined) { poTotal(open); rsStamp('purchasing', `${open.number} · ${joined} new line(s) joined the open auto draft`); }
      upsertSystemPin(`auto-po:${open.id}`, { title: autoPoTitle(open), subtitle: `Auto-PO draft · ${v.terms} · acknowledge red lines, then Send`, assignedTo: MH_ASSIGNEE, priority: 'high', standing: true, link: `/purchasing?po=${open.id}` });
      autoPoWait.delete(v.id); resolveSystemPin(`auto-po-wait:${v.id}`, 'draft created'); out.push({ vendor: v, lines: open.lines.length, total: open.total, draft: open, daysWaiting: 0, pinned: 'high' }); return;
    }
    if (!lines.length) { autoPoWait.delete(v.id); resolveSystemPin(`auto-po-wait:${v.id}`, 'nothing waiting'); return; }
    const total = Math.round(lines.reduce((t, l) => t + l.qty * l.unitCost, 0) * 100) / 100;
    if (total >= AUTO_PO_THRESHOLD) {
      const p: PurchaseOrder = { id: newId('po'), number: `PO-26-${String(++rs.counters.po).padStart(4, '0')}`, vendorId: v.id, status: 'draft', division: 'rolliworks', locationId: 'loc-a1', memo: `Auto-PO · draft total crossed ${fmtMoney(AUTO_PO_THRESHOLD)} · ${rows.length} needs-ordering rows`, total: 0, createdAt: new Date().toISOString(), createdBy: 'Auto-PO', station: 'RolliSuite', auto: true,
        lines: lines.map((l) => { const pt = byId(store.parts, l.partId); return { id: newId('pol'), partId: pt.id, partNumber: pt.partNumber, description: pt.name, qty: l.qty, unitCost: l.unitCost, receivedQty: 0, requestId: l.requestId, avgAtOrder: l.avg }; }) };
      poTotal(p); rs.pos.unshift(p); rsStamp('purchasing', `${p.number} auto-created for ${v.name} · ${fmtMoney(p.total)} ≥ ${fmtMoney(AUTO_PO_THRESHOLD)} · pinned to MH (HIGH)`);
      upsertSystemPin(`auto-po:${p.id}`, { title: autoPoTitle(p), subtitle: `Auto-PO draft · ${v.terms} · acknowledge red lines, then Send`, assignedTo: MH_ASSIGNEE, priority: 'high', standing: true, link: `/purchasing?po=${p.id}` });
      autoPoWait.delete(v.id); resolveSystemPin(`auto-po-wait:${v.id}`, 'draft created'); out.push({ vendor: v, lines: p.lines.length, total: p.total, draft: p, daysWaiting: 0, pinned: 'high' }); return;
    }
    const since = autoPoWait.get(v.id) ?? rows.reduce((m, r) => (r.at < m ? r.at : m), rows[0].at); autoPoWait.set(v.id, since); const days = Math.floor((Date.now() - new Date(since).getTime()) / 864e5);
    if (days >= AUTO_PO_WAIT_DAYS) upsertSystemPin(`auto-po-wait:${v.id}`, { title: `${v.name} · ${fmtMoney(total)} · ${days} days waiting`, subtitle: `Under the ${fmtMoney(AUTO_PO_THRESHOLD)} auto-PO threshold · ${lines.length} line${lines.length === 1 ? '' : 's'} in needs-ordering — generate by hand or keep waiting`, assignedTo: MH_ASSIGNEE, priority: 'normal', link: `/inventory?vendor=${v.id}` });
    else resolveSystemPin(`auto-po-wait:${v.id}`, `under ${AUTO_PO_WAIT_DAYS} days`);
    out.push({ vendor: v, lines: lines.length, total, since, daysWaiting: days, pinned: days >= AUTO_PO_WAIT_DAYS ? 'normal' : null });
  });
  return out;
};
export async function getAutoPoState(): Promise<AutoPoVendorState[]> { return resolve(autoPoSweepSync()); }

// ---- MH DAILY · APPROVALS TO SEND — every parts approval priced and ready but not yet sent to the client. MH's item stands (refreshes live, clears at zero); VC gets a normal item.
export interface ApprovalToSend { request: PartsRequestWithRefs; total: number; ageDays: number; ready: boolean }
export const approvalsToSendSync = (): ApprovalToSend[] => store.partsRequests.filter((r) => r.status === 'pending_review').map((r) => ({ request: prRefs(r), total: (r.items ?? []).reduce((t, i) => t + (i.price ?? 0) * i.qty, 0), ageDays: Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 864e5), ready: approvalReady(r) })).sort((a, b) => b.ageDays - a.ageDays);
export async function getApprovalsToSend(): Promise<ApprovalToSend[]> { return resolve(approvalsToSendSync()); }
export const approvalsToSendSweepSync = () => {
  const ready = approvalsToSendSync().filter((x) => x.ready); const oldest = ready[0]?.ageDays ?? 0;
  if (!ready.length) { resolveSystemPin('approvals-to-send:MH', 'all sent'); resolveSystemPin('approvals-to-send:VC', 'all sent'); return; }
  const title = `Approvals to send · ${ready.length} · oldest ${oldest}d`; const subtitle = 'Parts approvals priced but not yet sent to the client — one-tap Send each';
  upsertSystemPin('approvals-to-send:MH', { title, subtitle, assignedTo: MH_ASSIGNEE, priority: 'normal', standing: true, link: '/parts/approvals' });
  upsertSystemPin('approvals-to-send:VC', { title, subtitle, assignedTo: { type: 'user', shortName: 'Vienna' }, priority: 'normal', link: '/parts/approvals' });
};

// ---- Inventory reports bridge (api/inventoryReports.ts): consumption adjustment + spending optimization read stock / history / POs here and write approved rules back
const daySweeps: (() => void)[] = [];
export const registerDaySweep = (fn: () => void) => { if (!daySweeps.includes(fn)) daySweeps.push(fn); };
export const runDaySweeps = () => daySweeps.forEach((f) => { try { f(); } catch { /* report module not loaded */ } });
export const invBridge = {
  parts: () => store.parts, history: () => inv.history, reorder: () => inv.reorder, needs: () => inv.needs, pos: () => rs.pos, vendors: () => rs.vendors, movements: () => rs.movements, picks: () => rw18.picks, requests: () => store.partsRequests,
  onHand: onHandOf, onOrder: onOrderOf, rule: getReorderRule, pricing: partPricingSync, actor, newId, stamp: (text: string) => rsStamp('inventory', text),
  setRule: (partId: string, min: number, orderUpTo: number) => { inv.reorder.set(partId, { partId, min, orderUpTo }); },
  audit: (detail: string) => { const a = actor(); appendAudit({ type: 'inventory', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail }); },
  pin: upsertSystemPin, resolvePin: resolveSystemPin, sweepAutoPo: autoPoSweepSync,
  seedStock: (partId: string, onHand: number) => { if (!rs.stock.some((x) => x.partId === partId)) rs.stock.push({ partId, locationId: 'loc-a1', onHand, reorderPoint: 0 }); },
};

// ---- JV BIN — a container in the custody model (2026-09-30, MH ruling). The bin HOLDS custody: tickets inside show custody JV and their location follows the bin.
// Desk ASSIGN = a queue, no scan, nothing moves. A ticket ENTERS only by a scan at Vienna's safe (arm the safe → BIN-JV → tickets → Commit). Overnight: Vienna's safe (holder safe:VC). By day: JV's bench (holder person:JV).
// Night = ONE bin scan at the safe + a count confirm ("9 assigned · 3 out with team · 6 should be in the bin"); the per-ticket list only opens on a mismatch. Morning = BIN-JV at JV's bench → every ticket inside lands at JV's bench, custody JV workshop; JV dispatches by scanning each ticket to Dre / Sam / Nico.
export type BinHolder = 'person:JV' | 'safe:VC';
export type BinEventKind = 'assign' | 'enter' | 'to_safe' | 'out_of_safe' | 'hand_to' | 'back_in' | 'missing';
export interface BinEvent { id: string; at: string; by: string; station: string; kind: BinEventKind; detail: string; jobId?: string }
export type BinRowState = 'in_bin' | 'out' | 'pending';
export interface BinRow { jobId: string; jobNumber: string; estimateNumber?: string; clientLastName: string; watchLabel: string; key: ComponentKey; partLabel: string; state: BinRowState; holder: string; station: RwStationKey; stationLabel: string; inSafe: boolean; since?: string; note?: string; assignedAt?: string; assignedBy?: string; priority: JobPriority; dueAt?: string }
export interface BinView { key: string; code: string; safeCode: string; label: string; owner: string; holder: BinHolder; holderLabel: string; holderSince: string; assigned: number; inBin: BinRow[]; out: BinRow[]; pending: BinRow[]; dueBack: BinRow[]; binDue: boolean; night: boolean; log: BinEvent[]; team: string[] }
const BIN_KEY = 'jv_bin'; export const BIN_CODE = 'BIN-JV'; export const BIN_SAFE_CODE = 'SAFE-VC'; export const BIN_NIGHT_HOUR = 17;
const BIN_HOLDER_LABEL: Record<BinHolder, string> = { 'person:JV': "JV workshop · at JV's bench", 'safe:VC': "Vienna's safe (VC)" };
export const BIN_TEAM = ['Dre', 'Sam', 'Nico', 'MAM'];
export const isBinCode = (s: string) => s.trim().toUpperCase() === BIN_CODE || s.trim().toUpperCase() === BIN_KEY.toUpperCase();
export const isBinSafeCode = (s: string) => s.trim().toUpperCase() === BIN_SAFE_CODE;
const todayAt = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const yesterdayAt = (h: number, m: number) => { const d = new Date(Date.now() - 864e5); d.setHours(h, m, 0, 0); return d.toISOString(); };
interface BinState { holder: BinHolder; holderSince: string; assigned: { jobId: string; at: string; by: string }[]; log: BinEvent[] }
const binState: BinState = {
  holder: 'person:JV', holderSince: todayAt(8, 5),
  assigned: ['j-b1', 'j-b2', 'j-b3', 'j-b4', 'j-b5', 'j-b6', 'j-b7', 'j-b8', 'j-b9'].map((jobId, i) => ({ jobId, at: daysAgoIso(i < 5 ? 2 : 1), by: 'Vienna' })),
  log: [
    { id: 'bev-01', at: daysAgoIso(2), by: 'Vienna', station: 'Front Desk 1', kind: 'assign', detail: '5 tickets assigned to JV bin from the desk (queue)' },
    { id: 'bev-02', at: daysAgoIso(1), by: 'Vienna', station: 'Front Desk 1', kind: 'assign', detail: '4 tickets assigned to JV bin from the desk (queue)' },
    { id: 'bev-03', at: yesterdayAt(17, 35), by: 'JV', station: 'Workshop pad (JV)', kind: 'enter', detail: "9 tickets entered JV bin at Vienna's safe" },
    { id: 'bev-04', at: yesterdayAt(17, 41), by: 'JV', station: 'Workshop pad (JV)', kind: 'to_safe', detail: "JV bin → Vienna's safe · count confirmed 9 / 9" },
    { id: 'bev-05', at: todayAt(8, 5), by: 'JV', station: 'Workshop pad (JV)', kind: 'out_of_safe', detail: "JV bin out of Vienna's safe → JV's bench · 9 tickets · custody JV workshop" },
    { id: 'bev-06', at: todayAt(8, 22), by: 'JV', station: 'Workshop pad (JV)', kind: 'hand_to', detail: 'E02076 Case → Dre (Polish room)', jobId: 'j-b7' },
    { id: 'bev-07', at: todayAt(8, 24), by: 'JV', station: 'Workshop pad (JV)', kind: 'hand_to', detail: 'E02077 Bracelet → Sam (band bench)', jobId: 'j-b8' },
    { id: 'bev-08', at: todayAt(8, 31), by: 'JV', station: 'Workshop pad (JV)', kind: 'hand_to', detail: 'E02078 Bracelet → Nico (band bench)', jobId: 'j-b9' },
  ],
};
const binEvent = (kind: BinEventKind, detail: string, jobId?: string) => { const a = actor(); binState.log.unshift({ id: newId('bev'), at: new Date().toISOString(), by: a.by, station: a.station, kind, detail, jobId }); appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `JV bin · ${detail}` }); };
// The ticket's part for bin purposes: the one riding in the bin, else the one that last did, else the band-room part (bracelet → case → whatever is left)
const binPartOf = (j: Job): JobComponent | undefined => { const ps = ensureParts(j); return ps.find((c) => c.containerKey === BIN_KEY) ?? ps.find((c) => c.binOrigin === BIN_KEY) ?? ps.find((c) => c.key === 'band') ?? ps.find((c) => c.key === 'case') ?? ps[0]; };
const binRow = (j: Job, c: JobComponent, state: BinRowState, assigned?: { at: string; by: string }): BinRow => {
  const pl = derivePlacement(j, c); const w = byId(store.watches, j.watchId); const cl = byId(fx.clients, j.clientId); const last = c.history?.[c.history.length - 1];
  const holder = state === 'in_bin' ? BIN_HOLDER_LABEL[binState.holder] : c.custodyTech ?? 'unassigned';
  return { jobId: j.id, jobNumber: j.number, estimateNumber: j.estimateId ? store.estimates.find((e) => e.id === j.estimateId)?.number : undefined, clientLastName: cl.lastName, watchLabel: `${w.brand} ${w.model}`, key: c.key, partLabel: PART_LABEL[c.key], state, holder, station: pl.station, stationLabel: stationOf(pl.station).label, inSafe: pl.station.includes('safe'), since: last?.at, note: state === 'in_bin' ? undefined : last?.note, assignedAt: assigned?.at, assignedBy: assigned?.by, priority: j.priority, dueAt: j.dueAt };
};
const binAssignedOf = (jobId: string) => binState.assigned.find((a) => a.jobId === jobId);
const binViewSync = (): BinView => {
  const inBin: BinRow[] = []; const out: BinRow[] = []; const pending: BinRow[] = [];
  // scans are truth: anything inside or lent out counts, desk-assigned or not
  roomJobs().forEach((j) => ensureParts(j).forEach((c) => { if (c.containerKey === BIN_KEY) inBin.push(binRow(j, c, 'in_bin', binAssignedOf(j.id))); else if (c.binOrigin === BIN_KEY && c.partStatus !== 'fulfilled' && c.custodyTech && c.custodyTech !== 'JV') out.push(binRow(j, c, 'out', binAssignedOf(j.id))); }));
  binState.assigned.forEach((a) => { const j = store.jobs.find((x) => x.id === a.jobId); if (!j || j.status === 'closed' || inBin.some((r) => r.jobId === j.id) || out.some((r) => r.jobId === j.id)) return; const c = binPartOf(j); if (c) pending.push(binRow(j, c, 'pending', a)); });
  const byNum = (a: BinRow, b: BinRow) => a.jobNumber.localeCompare(b.jobNumber); inBin.sort(byNum); out.sort(byNum); pending.sort(byNum);
  const assignedIds = new Set([...binState.assigned.map((a) => a.jobId), ...inBin.map((r) => r.jobId), ...out.map((r) => r.jobId)].filter((id) => store.jobs.find((j) => j.id === id)?.status !== 'closed'));
  const night = new Date().getHours() >= BIN_NIGHT_HOUR; const binDue = binState.holder === 'person:JV';
  const team = BIN_TEAM.filter((s) => { const u = fx.users.find((x) => x.shortName === s); return u && !u.disabled; });
  return { key: BIN_KEY, code: BIN_CODE, safeCode: BIN_SAFE_CODE, label: 'JV bin', owner: 'JV', holder: binState.holder, holderLabel: BIN_HOLDER_LABEL[binState.holder], holderSince: binState.holderSince, assigned: assignedIds.size, inBin, out, pending, dueBack: out.filter((r) => !r.inSafe), binDue, night, log: binState.log.slice(0, 40), team };
};
export async function getBin(): Promise<BinView> { return resolve(binViewSync()); }
export const binCountLine = (v: BinView) => `${v.assigned} assigned · ${v.out.length} out with team · ${v.inBin.length} should be in the bin`;
// Desk assign — a queue. Nothing moves; the ticket enters by the safe scan.
export async function assignToBin(jobIds: string[]): Promise<{ view: BinView; added: string[]; skipped: { jobNumber: string; why: string }[] }> {
  const a = actor(); const added: string[] = []; const skipped: { jobNumber: string; why: string }[] = [];
  jobIds.forEach((id) => { const j = getJobRow(id); if (j.status === 'closed') { skipped.push({ jobNumber: j.number, why: 'closed' }); return; } if (ensureParts(j).some((c) => c.containerKey === BIN_KEY)) { skipped.push({ jobNumber: j.number, why: 'already in the bin' }); return; } if (binAssignedOf(id)) { skipped.push({ jobNumber: j.number, why: 'already assigned' }); return; } binState.assigned.push({ jobId: id, at: new Date().toISOString(), by: a.by }); jobStamp(j, 'Assigned to JV bin (queue) — enters the bin by the scan at Vienna\'s safe'); added.push(j.number); });
  if (added.length) binEvent('assign', `${added.length} ticket${added.length === 1 ? '' : 's'} assigned from the desk (queue) · ${added.join(', ')}`);
  return resolve({ view: binViewSync(), added, skipped });
}
const binMoveAll = (to: RwStationKey, status: PartStatus, note: string) => { let n = 0; roomJobs().forEach((j) => ensureParts(j).forEach((c) => { if (c.containerKey === BIN_KEY) { recordMove(j, c, to, status, 'container', note, 'JV'); n += 1; } })); return n; };
// Night — the bin into Vienna's safe. `present` (job ids) only arrives from the mismatch path: anything inside that is NOT listed is MISSING → leaves the bin, pinned to JV + the manager list.
export async function binToSafe(opts: { present?: string[] } = {}): Promise<{ view: BinView; moved: number; missing: string[] }> {
  if (binState.holder === 'safe:VC') throw new Error("The bin is already in Vienna's safe");
  const missing: string[] = [];
  if (opts.present) { const keep = new Set(opts.present); for (const j of roomJobs()) for (const c of ensureParts(j)) { if (c.containerKey === BIN_KEY && !keep.has(j.id)) { c.containerKey = undefined; c.binOrigin = BIN_KEY; c.history!.push({ at: new Date().toISOString(), by: actor().by, from: derivePlacement(j, c).station, to: derivePlacement(j, c).station, status: c.partStatus ?? 'in_progress', via: 'container', note: 'MISSING at night reconcile — not in JV bin' }); missing.push(j.number); jobStamp(j, `${PART_LABEL[c.key]} MISSING at JV bin night reconcile — last held by JV`); binEvent('missing', `${j.number} ${PART_LABEL[c.key]} MISSING at night reconcile`, j.id); await pinToHitList({ title: `JV bin reconcile: MISSING ${j.number} ${PART_LABEL[c.key]} — last held by JV`, assignedTo: { type: 'role', role: 'manager' }, jobId: j.id }); await pinToHitList({ title: `Find ${j.number} ${PART_LABEL[c.key]} — missing from JV bin at night reconcile`, assignedTo: { type: 'user', shortName: 'JV' }, jobId: j.id }); } } }
  const moved = binMoveAll('vc_safe', 'waiting', "JV bin → Vienna's safe (night)"); binState.holder = 'safe:VC'; binState.holderSince = new Date().toISOString();
  binEvent('to_safe', `JV bin → Vienna's safe · ${opts.present ? `checked ticket by ticket · ${moved} present · ${missing.length} MISSING` : `count confirmed ${moved} / ${moved}`}`);
  return resolve({ view: binViewSync(), moved, missing });
}
// Morning — BIN-JV at JV's bench: every ticket inside lands at JV's bench, custody JV workshop (never back to last night's benches — the bin was in the safe)
export async function binOutOfSafe(): Promise<{ view: BinView; moved: number }> {
  if (binState.holder === 'person:JV') throw new Error("The bin is already out — at JV's bench");
  const moved = binMoveAll('jv_bench', 'in_progress', "JV bin out of Vienna's safe → JV's bench · custody JV workshop"); binState.holder = 'person:JV'; binState.holderSince = new Date().toISOString();
  binEvent('out_of_safe', `JV bin out of Vienna's safe → JV's bench · ${moved} ticket${moved === 1 ? '' : 's'} · custody JV workshop`);
  return resolve({ view: binViewSync(), moved });
}
// Enter — only at the safe, bin present (holder safe:VC). Unassigned tickets may enter (scan is truth) and are flagged.
export async function binEnter(jobId: string): Promise<BinRow> {
  if (binState.holder !== 'safe:VC') throw new Error("Tickets enter the bin at Vienna's safe — scan BIN-JV at the safe first");
  const j = getJobRow(jobId); if (j.status === 'closed') throw new Error(`${j.number} is closed`); const c = binPartOf(j); if (!c) throw new Error(`${j.number} has no part to bin`); if (c.containerKey === BIN_KEY) throw new Error(`${j.number} is already in the bin`);
  if (c.custodyTech?.startsWith('vendor:')) throw new Error(`${j.number} ${PART_LABEL[c.key]} is out with a vendor`);
  const queued = !!binAssignedOf(jobId); if (!queued) binState.assigned.push({ jobId, at: new Date().toISOString(), by: `${actor().by} (scan)` });
  c.containerKey = BIN_KEY; c.binOrigin = BIN_KEY; recordMove(j, c, 'vc_safe', 'waiting', 'container', `entered JV bin at Vienna's safe${queued ? '' : ' · not on the desk queue'}`, 'JV');
  binEvent('enter', `${j.number} ${PART_LABEL[c.key]} entered the bin at Vienna's safe${queued ? '' : ' · NOT on the desk queue'}`, j.id);
  return resolve(binRow(j, c, 'in_bin', binAssignedOf(jobId)));
}
// Dispatch — JV hands one ticket out of the bin to a team member (bin must be out, at the bench)
export async function binHandTo(jobId: string, tech: string): Promise<BinRow> {
  if (binState.holder !== 'person:JV') throw new Error("Take the bin out of Vienna's safe first (scan BIN-JV at JV's bench)");
  const j = getJobRow(jobId); const c = ensureParts(j).find((x) => x.containerKey === BIN_KEY); if (!c) throw new Error(`${j.number} is not in the bin`);
  const u = fx.users.find((x) => x.shortName === tech); if (!u || u.disabled) throw new Error(`${tech} is not on the team`);
  const to: RwStationKey = c.key === 'case' ? 'polish_room' : u.roles.includes('band_tech') ? 'band_assign' : 'refinish';
  c.containerKey = undefined; c.binOrigin = BIN_KEY; recordMove(j, c, to, 'in_progress', 'container', `handed out of JV bin → ${tech}`, tech);
  binEvent('hand_to', `${j.number} ${PART_LABEL[c.key]} → ${tech} (${stationOf(to).label})`, j.id);
  return resolve(binRow(j, c, 'out', binAssignedOf(jobId)));
}
// Back in — a ticket that rode in the bin comes back from the team (bin at the bench). Fresh tickets still enter only at the safe.
export async function binTakeBack(jobId: string): Promise<BinRow> {
  if (binState.holder !== 'person:JV') throw new Error("The bin is in Vienna's safe — tickets enter there (BIN-JV at the safe, then the ticket)");
  const j = getJobRow(jobId); const c = ensureParts(j).find((x) => x.binOrigin === BIN_KEY && x.containerKey !== BIN_KEY); if (!c) throw new Error(ensureParts(j).some((x) => x.containerKey === BIN_KEY) ? `${j.number} is already in the bin` : `${j.number} never rode in the bin — it enters at Vienna's safe`);
  const from = c.custodyTech ?? 'team'; c.containerKey = BIN_KEY; recordMove(j, c, 'jv_bench', 'in_progress', 'container', `back into JV bin from ${from}`, 'JV');
  binEvent('back_in', `${j.number} ${PART_LABEL[c.key]} back into the bin from ${from}`, j.id);
  return resolve(binRow(j, c, 'in_bin', binAssignedOf(jobId)));
}
// Desk map rows for bin nodes (assign / Vienna's safe / JV's bench): the ticket's bin part, not the destination's lane rule
export async function resolveBinLabel(label: string): Promise<BulkRow> {
  const j = await findJobByLabel(label.trim().replace(/^BAND-/i, '').replace(/\|B$/i, '')); if (!j) throw new Error(`No job matches label ${label}`);
  const row = getJobRow(j.id); const c = binPartOf(row); if (!c) throw new Error(`${j.number} has no part to bin`);
  return resolve({ id: newId('bulk'), at: new Date().toISOString(), label: label.trim(), jobId: j.id, jobNumber: j.number, watchLabel: `${j.watch.brand} ${j.watch.model}`, key: c.key, clientName: `${j.client.firstName} ${j.client.lastName}` });
}
export type BinTarget = 'assign' | 'vc_safe' | 'jv_bench';
// One Commit for the bin nodes on the Assign / Move map. `binScanned` = BIN-JV was in the session. Assign never moves custody; the safe and the bench need the bin scan first.
export async function binCommit(rows: BulkRow[], target: BinTarget, binScanned: boolean): Promise<{ results: BulkResult[]; binNote?: string; view: BinView }> {
  const results: BulkResult[] = []; let binNote: string | undefined; const seen = new Set<string>(); const uniq = rows.filter((r) => !seen.has(r.jobId) && seen.add(r.jobId));
  if (target === 'assign') {
    if (binScanned) binNote = "BIN-JV doesn't scan here — assigning is a queue; the bin itself scans at Vienna's safe";
    const r = await assignToBin(uniq.map((x) => x.jobId)); uniq.forEach((row) => { const sk = r.skipped.find((s) => s.jobNumber === row.jobNumber); results.push(sk ? { row, ok: false, detail: sk.why } : { row, ok: true, detail: 'assigned to JV bin · queue · enters by the safe scan' }); });
  } else if (!binScanned) { uniq.forEach((row) => results.push({ row, ok: false, detail: `scan ${BIN_CODE} first — tickets ${target === 'vc_safe' ? 'enter the bin only with the bin at the safe' : "rejoin the bin only with the bin at JV's bench"}` })); binNote = `${BIN_CODE} not scanned — nothing moved`; }
  else if (target === 'vc_safe') {
    if (binState.holder === 'person:JV') { const r = await binToSafe(); binNote = `JV bin → Vienna's safe · ${r.moved} inside · count confirmed`; } else binNote = "JV bin already in Vienna's safe";
    for (const row of uniq) { try { await binEnter(row.jobId); results.push({ row, ok: true, detail: "entered JV bin at Vienna's safe · custody JV" }); } catch (e) { results.push({ row, ok: false, detail: e instanceof Error ? e.message : 'Failed' }); } }
  } else {
    if (binState.holder === 'safe:VC') { const r = await binOutOfSafe(); binNote = `JV bin out of Vienna's safe → JV's bench · ${r.moved} tickets · custody JV workshop`; } else binNote = "JV bin already at JV's bench";
    for (const row of uniq) { try { await binTakeBack(row.jobId); results.push({ row, ok: true, detail: 'back into JV bin · custody JV workshop' }); } catch (e) { results.push({ row, ok: false, detail: e instanceof Error ? e.message : 'Failed' }); } }
  }
  return resolve({ results, binNote, view: binViewSync() });
}

// ---- CLIENT PORTAL — W·B·P dots + reply loop (MH 2026-09-30). Same WbpDots positions, client mapping only: empty = not part of this service · green = moving · red = not moving (ANY internal blocker — no vendor names, no hold reasons) · blue = done.
// Red tap: "awaiting YOUR approval" opens the approval itself; anything else = "Ask about this" → portal message tagged job + component → RS Inbox, front-desk queue (claimable), client-update draft already generated. Rating a/b/c never reaches the portal.
import type { AskDraft, PortalDot, PortalDotAction, PortalDotRow, PortalDotState, PortalFlowLine, PortalPartsView, PortalStopKey } from './types';
const PORTAL_LEG_LABEL: Record<WbpLeg, string> = { W: 'Watch', B: 'Bracelet', P: 'Case' };
const PORTAL_DOT_TEXT: Record<PortalDotState, string> = { none: 'Not part of this service', moving: 'Moving — in progress, on track', stuck: 'Not moving — something is holding this part up. Tap to ask us.', done: 'Done — ready for pickup' };
const isApprovalBlock = (t?: string) => !!t && t.startsWith('awaiting client approval');
const portalApproveAction = (j: Job): Extract<PortalDotAction, { kind: 'approve' }> | undefined => {
  if (j.status === 'awaiting_customer_approval') { const e = j.estimateId ? store.estimates.find((x) => x.id === j.estimateId) : undefined; if (e && e.status === 'sent') return { kind: 'approve', path: `/rc/estimates/${e.id}`, label: 'Review the estimate' }; }
  const pr = store.partsRequests.find((r) => r.jobId === j.id && r.status === 'awaiting_client'); if (pr) return { kind: 'approve', path: `/rc/parts/${pr.id}`, label: 'Approve the parts' };
  return undefined;
};
export const portalDotsSync = (j: Job): PortalDotRow => {
  const flow = jobFlowSync(j); const approve = portalApproveAction(j);
  const dots: PortalDot[] = WBP_LEGS.map((l) => {
    const lines = flow.lines.filter((x) => WBP_OF[x.key] === l.key); if (!lines.length) return { leg: l.key, label: PORTAL_LEG_LABEL[l.key], state: 'none' as const, text: PORTAL_DOT_TEXT.none };
    const reds = lines.flatMap((x) => x.stages.filter((s) => s.blocker?.tone === 'red')); const state: PortalDotState = reds.length ? 'stuck' : lines.every((x) => x.finished) ? 'done' : 'moving';
    const approval = state === 'stuck' && approve && reds.some((s) => isApprovalBlock(s.blocker?.text));
    return { leg: l.key, label: PORTAL_LEG_LABEL[l.key], state, text: approval ? `Waiting on you — ${approve.label.toLowerCase()}` : PORTAL_DOT_TEXT[state], action: state === 'stuck' ? (approval ? approve : { kind: 'ask' as const }) : undefined };
  });
  return { jobId: j.id, jobNumber: j.number, watchId: j.watchId, dots };
};
// Client-safe process line: five stops, vendor legs fold into "In progress", custody never shown
const PORTAL_STOPS: { key: PortalStopKey; label: string }[] = [{ key: 'received', label: 'Received' }, { key: 'queue', label: 'In queue' }, { key: 'progress', label: 'In progress' }, { key: 'qc', label: 'Quality check' }, { key: 'ready', label: 'Ready' }];
const PORTAL_STOP_OF: Record<FlowStageKey, PortalStopKey> = { intake: 'received', queue: 'queue', progress: 'progress', v_route: 'progress', v_vendor: 'progress', v_return: 'progress', v_received: 'progress', v_inspect: 'progress', qc: 'qc', finished: 'ready' };
const PORTAL_LINE_LABEL: Record<ComponentKey, string> = { head: 'Watch head', band: 'Bracelet', case: 'Case' };
export const portalFlowSync = (j: Job): PortalFlowLine[] => jobFlowSync(j).lines.map((l) => {
  const cur = l.stages.find((s) => s.state === 'current'); const idx = l.finished ? PORTAL_STOPS.length - 1 : PORTAL_STOPS.findIndex((s) => s.key === PORTAL_STOP_OF[cur?.key ?? 'intake']);
  return { key: l.key, label: `${PORTAL_LINE_LABEL[l.key]}${l.itemLabel ? ` ${l.itemLabel}` : ''}`, stops: PORTAL_STOPS.map((s, i) => ({ ...s, state: i < idx ? 'done' as const : i === idx ? 'current' as const : 'todo' as const })), stuck: l.stages.some((s) => s.blocker?.tone === 'red'), done: l.finished, projected: j.dueAt };
});
export async function portalGetDots(clientId: string, jobId: string): Promise<PortalDotRow> { const j = requireOwner(clientId, store.jobs.find((x) => x.id === jobId), 'job'); return resolve(portalDotsSync(j)); }
// Parts approval page — the money decision lives on a page with the lines and the price (same page the approval email links to)
export async function portalGetPartsRequest(clientId: string, id: string): Promise<PortalPartsView> {
  const r = store.partsRequests.find((x) => x.id === id); const j = r ? store.jobs.find((x) => x.id === r.jobId) : undefined;
  if (!r || !j || j.clientId !== clientId) throw new Error('That parts approval isn’t on your account');
  const w = byId(store.watches, j.watchId); const lines = (r.items ?? []).map((i) => ({ description: i.description, qty: i.qty, price: (i.price ?? 0) * i.qty }));
  const decided = r.clientDecidedAt && r.status !== 'awaiting_client' ? { decision: r.status === 'declined' ? 'decline' as const : 'approve' as const, at: r.clientDecidedAt } : undefined;
  return resolve({ request: { ...r }, job: j, watch: w, lines, total: lines.reduce((t, l) => t + l.price, 0), decided });
}
export async function portalDecideParts(clientId: string, id: string, decision: 'approve' | 'decline'): Promise<PortalPartsView> {
  const r = store.partsRequests.find((x) => x.id === id); const j = r ? store.jobs.find((x) => x.id === r.jobId) : undefined;
  if (!r || !j || j.clientId !== clientId) throw new Error('That parts approval isn’t on your account');
  if (decision === 'approve') requireStepUp(clientId, STEP_UP_ACTION.approveParts(id));
  clientPartsDecision(r, decision, 'portal'); portalStamp(clientId, `${decision === 'approve' ? 'Approved' : 'Declined'} parts ${r.number} for ${j.number}`);
  return portalGetPartsRequest(clientId, id);
}
// -- The ask arrives with its draft: internal reason (staff only) + the client-safe update in the fixed template. Rule-based at arrival; Regenerate with Claude on demand; a person edits and sends.
const PORTAL_PART_WORD: Record<ComponentKey, string> = { head: 'watch', band: 'bracelet', case: 'case' };
const askStateWord = (l: FlowLine): string => { const b = l.stages.find((s) => s.blocker?.tone === 'red')?.blocker?.text ?? ''; return l.finished ? 'finished' : isApprovalBlock(b) ? 'waiting on your approval' : /parts hold|not returned|on order/i.test(b) ? 'waiting on a part we have ordered' : /outsource|delayed|at risk/i.test(b) ? 'with a specialist for part of the work' : b ? 'paused between steps' : 'in progress'; };
const askInternalReason = (j: Job, c: ComponentKey): string => {
  const line = jobFlowSync(j).lines.find((l) => l.key === c); if (!line) return 'component not on this job';
  const blocker = line.stages.find((s) => s.blocker)?.blocker; const cur = line.stages.find((s) => s.state === 'current'); const part = ensureParts(j).find((p) => p.key === c); const last = part?.history?.[part.history.length - 1];
  const days = last ? Math.round((Date.now() - new Date(last.at).getTime()) / 864e5) : undefined;
  return [blocker ? blocker.text : `${cur?.label ?? 'In progress'}${cur?.vendor ? ` · ${cur.vendor}` : ''} · no blocker on record`, `custody ${line.custody.holder} · ${line.custody.where}`, days !== undefined ? `${days}d at this step` : null, j.dueAt ? `due ${new Date(j.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null].filter(Boolean).join(' · ');
};
const askClientFields = (j: Job, c: ComponentKey, ctx: JobSummaryContext): AskDraft['fields'] => {
  const base = localSummaryFields(ctx); const lines = jobFlowSync(j).lines; const line = lines.find((l) => l.key === c); const blocker = line?.stages.find((s) => s.blocker?.tone === 'red')?.blocker?.text ?? '';
  const parts = [line ? `The ${PORTAL_PART_WORD[c]} is ${askStateWord(line)}` : '', ...lines.filter((l) => l.key !== c).map((l) => `the ${PORTAL_PART_WORD[l.key]} is ${askStateWord(l)}`)].filter(Boolean);
  const variant = blocker ? (isApprovalBlock(blocker) ? 'approval' : /parts hold|not returned|on order/i.test(blocker) ? 'parts' : 'hold') : base.variant;
  const job_status = variant === 'parts' ? 'waiting on a part we have ordered' : variant === 'approval' ? 'awaiting your approval' : variant === 'hold' ? 'in progress, with one part of the work paused' : base.job_status;
  return { job_status, per_component_status_line: parts.length ? `${parts.join('; ')}.` : null, target_date: base.target_date, variant };
};
const portalAskArrived = (cm: ConvMessage, j: Job, component: ComponentKey) => {
  const conv = convOf(cm.conversationId); if (!conv.assignedTo) conv.assignedTo = { type: 'role', role: 'concierge' }; // front-desk queue — claimable from the thread
  const ctx = summaryCtxSync(j); ctx.focus = { component: PART_LABEL[component], question: cm.text }; const fields = askClientFields(j, component, ctx);
  cm.component = component; cm.ask = { jobId: j.id, jobNumber: j.number, component, componentLabel: PART_LABEL[component], internal: askInternalReason(j, component), text: fillSummaryTemplate(ctx, fields), fields, source: 'local', generatedAt: new Date().toISOString() };
  jobStamp(j, `Client asked about the ${PART_LABEL[component].toLowerCase()} from the portal — update pre-drafted, waiting for a person to review and send`);
  appendAudit({ type: 'comms', stationName: 'RolliConnect', detail: `${j.number} · portal ask · ${PART_LABEL[component]} · client-update draft generated (rule-based) → front-desk queue` });
};
export async function askContext(conversationId: string, messageId: string): Promise<JobSummaryContext> {
  const m = cx.messages.find((x) => x.id === messageId && x.conversationId === conversationId); if (!m?.ask) throw new Error('No portal ask on this message');
  const ctx = summaryCtxSync(getJobRow(m.ask.jobId)); ctx.focus = { component: m.ask.componentLabel, question: m.text }; return resolve(ctx);
}
export async function updateAskDraft(conversationId: string, messageId: string, patch: { text: string; fields?: AskDraft['fields']; source?: AskDraft['source'] }): Promise<AskDraft> {
  const m = cx.messages.find((x) => x.id === messageId && x.conversationId === conversationId); if (!m?.ask) throw new Error('No portal ask on this message');
  m.ask = { ...m.ask, text: patch.text, fields: patch.fields ?? m.ask.fields, source: patch.source ?? m.ask.source, generatedAt: patch.source ? new Date().toISOString() : m.ask.generatedAt }; return resolve({ ...m.ask });
}
// Send = one tap from the inbox item: portal thread + email notification (mail seam) + job timeline; the inbound item clears because the reply is now the last outbound
export async function sendAskReply(conversationId: string, messageId: string, text: string): Promise<ConvMessage> {
  const m = cx.messages.find((x) => x.id === messageId && x.conversationId === conversationId); if (!m?.ask) throw new Error('No portal ask on this message'); if (m.ask.sentAt) throw new Error('This update was already sent'); if (!text.trim()) throw new Error('Write the update first');
  const j = getJobRow(m.ask.jobId); const w = byId(store.watches, j.watchId); const a = actor();
  const out = await replyInThread(conversationId, { text, subject: `Update on your ${w.brand} ${w.model} — ${m.ask.componentLabel.toLowerCase()}` });
  store.messages.push({ id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, clientId: m.clientId, watchId: j.watchId, jobId: j.id, component: m.ask.component, from: 'staff', by: a.by, text: text.trim(), at: out.at, readByStaff: true, readByClient: false, emailId: out.emailId });
  m.ask = { ...m.ask, text: text.trim(), sentAt: out.at, sentBy: a.by }; out.component = m.ask.component;
  jobStamp(j, `Client update sent · ${m.ask.componentLabel.toLowerCase()} · portal thread + email · ${a.by}`);
  j.notes.unshift({ id: newId('jn'), text: `Client update sent (portal thread + email) · ${m.ask.componentLabel.toLowerCase()} · "${text.trim().split('\n')[0].slice(0, 90)}…"`, at: out.at, by: a.by, station: a.station });
  return resolve(out);
}
