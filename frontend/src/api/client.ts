// The ONLY data-access module in the app. Screens call these functions and nothing else.
// Today they resolve from local fixtures; later this file alone is repointed at the real API.
import * as fx from './fixtures';
import type {
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
  Part,
  PartsKnowledgeEntry,
  PartsRequest,
  PartsRequestWithRefs,
  SupervisorBoard,
  Payment,
  PaymentMethod,
  PinnedItem,
  SalesOrder,
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
  PackagePhoto,
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
};
const AUDIT_CAP = 60;

const resolve = <T>(value: T): Promise<T> =>
  new Promise((r) => setTimeout(() => r(value), LATENCY_MS));

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
  partsRequests: fx.partsRequests.map((r): PartsRequest => ({ ...r, chat: [...r.chat], searchTerms: [...r.searchTerms] })),
  partsKnowledge: fx.partsKnowledge.map((k): PartsKnowledgeEntry => ({ ...k })),
  salesOrders: fx.salesOrders.map((o): SalesOrder => ({ ...o, lines: o.lines.map((l) => ({ ...l })), payments: [...o.payments] })),
  packages: fx.packages.map((p) => ({ ...p, contents: [...p.contents], photos: [...p.photos] })),
  outbox: fx.outbox.map((e) => ({ ...e })),
  labels: fx.labels.map((l) => ({ ...l })),
  watches: fx.watches.map((w) => ({ ...w })),
  estimates: fx.estimates.map((e): Estimate => ({ ...e, lines: e.lines.map((l) => ({ ...l })), revisions: e.revisions.map((r): EstimateRevision => ({ ...r, lines: r.lines.map((l) => ({ ...l })) })), jobId: fx.jobs.find((j) => j.estimateId === e.id)?.id })),
  jobs: fx.jobs.map((j): Job => ({ ...j, lines: j.lines.map((l) => ({ ...l })), timeline: [...j.timeline], holds: j.holds.map((h) => ({ ...h })), notes: [...j.notes], photos: [...j.photos], workflow: [...j.workflow], assignees: [...j.assignees], inspection: j.inspection ? { ...j.inspection, answers: { ...j.inspection.answers } } : undefined })),
  shopTime: fx.shopTime.map((t) => ({ ...t })),
  requests: fx.requests.map((r): ServiceRequest => ({ ...r })),
  messages: fx.messages.map((m): Message => ({ ...m })),
  magicLinks: readJson<MagicLink[]>('rollisuite.rc.magicLinks', []),
  counters: { sub: 314, label: 3, estimate: 1058, job: 2030, so: 107, pr: 44 },
};

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
  if (saved) return saved.map((s) => ({ ...s, division: s.division ?? 'rolliworks' }));
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
  fx.users.filter((u) => u.division === div || u.division === 'both');

/** Roles that have at least one holder in `div`. */
export const getDivisionRoles = (div: Division): Role[] =>
  ROLES.filter((r) => getDivisionStaff(div).some((u) => u.roles.includes(r)));

// ---- Audit log --------------------------------------------------------------

const readAudit = (): AuditEvent[] => readJson<AuditEvent[]>(KEYS.audit, []);

// RolliConnect writes are replayed from localStorage on load (see replayRcEvents); the audit log is already persisted, so skip stamping during replay
let replaying = false;
function appendAudit(e: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
  const event: AuditEvent = { ...e, id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() };
  if (!replaying) writeJson(KEYS.audit, [event, ...readAudit()].slice(0, AUDIT_CAP));
  return event;
}

export async function getAuditLog(): Promise<AuditEvent[]> {
  return resolve(readAudit());
}

// ---- Auth / users -----------------------------------------------------------

const currentUserSync = (): User | null => {
  const id = localStorage.getItem(KEYS.currentUser);
  return id ? fx.users.find((u) => u.id === id) ?? null : null;
};

const signedInTodaySync = (userId: string) =>
  readAudit().some((e) => e.type === 'sign_in' && e.method === 'password_photo' && e.userShortName === byId(fx.users, userId).shortName && isToday(e.timestamp));

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

export async function signInWithPassword(userId: string, password: string, photo: VerificationPhoto): Promise<User> {
  const user = byId(fx.users, userId);
  const stationName = stationNameOrUnknown();
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
  if (user.pin !== pin) {
    appendAudit({ type: 'sign_in_failed', stationName, userShortName: user.shortName, userDisplayName: user.displayName, method: 'pin_switch', detail: 'Incorrect PIN' });
    throw new Error('Incorrect PIN');
  }
  localStorage.setItem(KEYS.currentUser, user.id);
  appendAudit({ type: 'sign_in', stationName, userShortName: user.shortName, userDisplayName: user.displayName, method: 'pin_switch', detail: 'Fast switch · PIN verified' });
  return resolve(user);
}

export async function signOut(): Promise<void> {
  const user = currentUserSync();
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

export async function getEstimates(): Promise<EstimateWithRefs[]> {
  return resolve([...store.estimates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(withRefs));
}

export async function getEstimate(id: string): Promise<EstimateWithRefs | null> {
  const e = store.estimates.find((x) => x.id === id);
  return resolve(e ? withRefs(e) : null);
}

export async function getEstimatesForClient(clientId: string): Promise<EstimateWithRefs[]> {
  return resolve(store.estimates.filter((e) => e.clientId === clientId).map(withRefs));
}

// ---- Jobs (read) -------------------------------------------------------------

const jobRefs = (j: Job): JobWithRefs => ({
  ...j,
  client: byId(fx.clients, j.clientId),
  watch: byId(store.watches, j.watchId),
  estimate: j.estimateId ? store.estimates.find((e) => e.id === j.estimateId) ?? null : null,
  pkg: j.packageId ? store.packages.find((p) => p.id === j.packageId) ?? null : store.packages.find((p) => p.estimateId && p.estimateId === j.estimateId) ?? null,
});

export async function getJobs(): Promise<JobWithRefs[]> {
  return resolve([...store.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(jobRefs));
}

export async function getJob(id: string): Promise<JobWithRefs | null> {
  const j = store.jobs.find((x) => x.id === id);
  return resolve(j ? jobRefs(j) : null);
}

export async function getJobsForClient(clientId: string): Promise<JobWithRefs[]> {
  return resolve(store.jobs.filter((j) => j.clientId === clientId).map(jobRefs));
}

// ---- Activity ---------------------------------------------------------------

export async function getRecentActivity(limit = 10): Promise<ActivityEvent[]> {
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

export async function getDashboardStats(): Promise<DashboardStats> {
  const completedThisMonth = store.jobs.filter((j) => isThisMonth(j.finishedAt));
  return resolve({
    watchesInHouse: store.watches.filter((w) => w.status !== 'released' && w.status !== 'expected').length,
    openEstimates: store.estimates.filter((e) => OPEN_ESTIMATE.includes(e.status)).length,
    awaitingApproval: store.estimates.filter((e) => e.status === 'sent').length,
    inProgress: store.jobs.filter((j) => ACTIVE_JOB.includes(j.status)).length,
    awaitingPickup: store.jobs.filter((j) => j.status === 'ready_to_ship').length,
    revenueThisMonth: completedThisMonth.reduce((t, j) => t + j.total, 0),
    departments: DEPARTMENTS.map((d) => ({
      ...d,
      mtdRevenue: completedThisMonth.filter((j) => j.department === d.key).reduce((t, j) => t + j.total, 0),
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
  const u = currentUserSync();
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

export async function getPackages(status?: PackageStatus): Promise<PackageWithRefs[]> {
  const rows = store.packages.filter((p) => !status || p.status === status);
  return resolve(rows.map(pkgWithRefs).sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt)));
}

export async function getPackage(id: string): Promise<PackageWithRefs | null> {
  const p = store.packages.find((x) => x.id === id);
  return resolve(p ? pkgWithRefs(p) : null);
}

export async function getIntakeCounts(): Promise<Record<PackageStatus, number>> {
  const counts: Record<PackageStatus, number> = { arrived: 0, processed: 0, awaiting_inspection: 0, received: 0, discrepancy_hold: 0 };
  store.packages.forEach((p) => (counts[p.status] += 1));
  return resolve(counts);
}

export interface ArrivalInput {
  source: PackageSource;
  trackingNumber?: string;
  carrier?: Carrier;
  signatureNoted: boolean;
  clientId?: string;
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
  stamp(input.source === 'walk_in' ? `Walk-in logged (${pkg.carrier})` : `Package arrived via ${pkg.carrier}${input.signatureNoted ? ' · signature noted' : ''}`, pkg.subNumber);
  return resolve(pkgWithRefs(pkg));
}

const estimateDigits = (s: string) => s.trim().toUpperCase().replace(/^EST-?/, '').replace(/^E/, '').replace(/^0+/, '');

export async function lookupEstimate(numberOrId: string): Promise<EstimateWithRefs | null> {
  const q = estimateDigits(numberOrId);
  const est = store.estimates.find((e) => e.id === numberOrId || (q && estimateDigits(e.number) === q));
  return resolve(est ? withRefs(est) : null);
}

export interface ReceivePackageInput {
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
    store.outbox.unshift(email);
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

export async function getInspectionContext(packageId: string): Promise<InspectionContext> {
  const pkg = pkgWithRefs(getPkg(packageId));
  if (!pkg.estimate || !pkg.estimate.watch) throw new Error('Package has no linked estimate with a watch — go back to Receive Package');
  const depts = uniq(pkg.estimate.lines.map((l) => l.dept));
  const expectedComponents = uniq(depts.flatMap((d) => fx.DEPT_COMPONENTS[d]));
  return resolve({ pkg, estimate: pkg.estimate, expectedComponents, suggestedWorkflow: depts });
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
  const ctx = await getInspectionContext(packageId);
  const pkg = getPkg(packageId);
  if (pkg.status !== 'awaiting_inspection') throw new Error('Package is not awaiting inspection');
  if (!input.reference.trim() || !input.serial.trim()) throw new Error('Reference and serial are required (use NS if unreadable)');
  if (input.workflow.length === 0) throw new Error('Pick at least one workflow department');
  const a = actor();
  const discrepancies = computeDiscrepancies(ctx, input);
  pkg.inspectedAt = new Date().toISOString();
  pkg.inspectedBy = a.by;
  pkg.workflow = [...input.workflow];
  pkg.notes = input.notes || pkg.notes;

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
      queueLabel({ type: 'ref_serial', packageId: pkg.id, estimateNumber: est.number, payload: `${ref} / ${ser}`, lines: [`${est.watch!.brand} ${est.watch!.model}`, `Ref ${ref}`, `Serial ${ser}`] }),
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
  clientId: string;
  watchId?: string;
  lines: EstimateLine[];
  validUntil: string;
  clientNotes: string;
  messageNotes: string;
  internalNotes: string;
  billingAddress: Address;
  shippingAddress: Address;
  shippingMirrorsBilling: boolean;
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
    subtotal: 0, shippingAmount: 0, taxAmount: 0, total: 0,
    validUntil: input.validUntil,
    clientNotes: input.clientNotes,
    messageNotes: input.messageNotes || 'Thank you for your business.',
    internalNotes: input.internalNotes,
    billingAddress: input.billingAddress,
    shippingAddress: input.shippingMirrorsBilling ? input.billingAddress : input.shippingAddress,
    shippingMirrorsBilling: input.shippingMirrorsBilling,
    historical: false,
    createdAt: new Date().toISOString(),
    createdBy: a.by,
    updatedAt: new Date().toISOString(),
  };
  recalc(e);
  store.estimates.unshift(e);
  estStamp(e, `Draft created · ${lines.length} line${lines.length === 1 ? '' : 's'} · ${e.total.toFixed(2)}`);
  return resolve(withRefs(e));
}

export type EstimatePatch = Partial<Omit<EstimateInput, 'clientId'>>;

const applyPatch = (e: Estimate, patch: EstimatePatch) => {
  if (patch.lines) e.lines = realLines(patch.lines).map((l) => ({ ...l, id: l.id || newLineId() }));
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

export async function sendEstimate(id: string): Promise<{ estimate: EstimateWithRefs; email: OutboxEmail }> {
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
    subject: `${again ? 'Updated estimate' : 'Your estimate'} ${e.number}${w ? ` — ${w.brand} ${w.model}` : ''}`,
    body: `Hello ${c.firstName},\n\n${again ? 'Here is the updated estimate' : 'Here is your estimate'} ${e.number} (revision ${e.revision})${w ? ` for your ${w.brand} ${w.model} ${w.reference}` : ''}.\n\n${e.lines.map((l) => `• ${l.description} × ${l.qty} — $${(l.qty * l.unitPrice).toFixed(2)}`).join('\n')}\n\nTotal: $${e.total.toFixed(2)}\nValid until ${new Date(e.validUntil).toLocaleDateString('en-US')}\n\n${e.messageNotes}\n\n— The RolliSuite team`,
    createdAt: new Date().toISOString(), createdBy: a.by, station: a.station,
  };
  store.outbox.unshift(email);
  e.status = 'sent';
  e.sentAt = new Date().toISOString();
  e.updatedAt = e.sentAt;
  estStamp(e, `${again ? 'Sent again' : 'Sent'} · rev ${e.revision} · email queued to Outbox`);
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

export async function convertEstimate(id: string, target: 'job' | 'sales_order' | 'intake'): Promise<JobWithRefs> {
  if (target === 'job') return createJobFromEstimate(id);
  if (target === 'intake') return convertEstimateToIntake(id);
  throw new Error('Use convertEstimateToSalesOrder for sales orders');
}

export interface ShippingCalcInput { units: number; hiAk: boolean; saturday: boolean }
// Display-only legacy calculator (UNKNOWN whether it persists) — never written on save
export function calcShipping(i: ShippingCalcInput) {
  const overnight = i.units > 25;
  const amount = 35 + (overnight ? 25 : 0) + i.units * 1.5 + (i.hiAk ? 30 : 0) + (i.saturday ? 20 : 0);
  return { amount, overnight, insuredValue: i.units * 1000 };
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
  ready_to_ship: [{ key: 'close', label: 'Close job', to: 'closed', tone: 'primary' }],
  closed: [],
};

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

const WATCH_STATUS_FOR: Partial<Record<JobStatus, Watch['status']>> = { in_service: 'in_service', testing: 'qc', ready_to_ship: 'awaiting_pickup', closed: 'released', awaiting_customer_approval: 'awaiting_approval' };

const getJobRow = (id: string) => byId(store.jobs, id);
const nextJobNumber = () => `E${String(++store.counters.job).padStart(5, '0')}`; // pack: `E` + digits from a next-job-id sequence
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

const jobStamp = (j: Job, detail: string) => {
  const a = actor();
  appendAudit({ type: 'job', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `${j.number} · ${detail}` });
};

const queueJobEmail = (j: Job, subject: string, body: string) => {
  const a = actor();
  const c = byId(fx.clients, j.clientId);
  const w = byId(store.watches, j.watchId);
  const email: OutboxEmail = {
    id: `ob-${Date.now().toString(36)}`,
    to: c.email, toName: `${c.firstName} ${c.lastName}`,
    relatedRef: j.number, status: 'pending',
    subject: `${subject} — ${w.brand} ${w.model} (${j.number})`,
    body: `Hello ${c.firstName},\n\n${body}\n\nJob: ${j.number} · ${w.brand} ${w.model} ${w.reference}\n\n— The RolliSuite team`,
    createdAt: new Date().toISOString(), createdBy: a.by, station: a.station,
  };
  store.outbox.unshift(email);
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
  if (action.key === 'qc_pass') { const ev = evidenceGaps(j); if (ev.length) throw new Error(`Evidence missing at QC: ${ev.map((k) => EVIDENCE_SLOTS.find((x) => x.key === k)!.label).join(', ')}`); }
  const mail = action.notifies ? EMAIL_FOR[action.key] : undefined;
  let queued = false;
  if (mail) { const [s, b] = mail(j, reason?.trim()); queueJobEmail(j, s, b); queued = true; }
  pushTransition(j, action.key, action.to, reason?.trim(), queued);
  jobStamp(j, `${action.label.replace('…', '')} · ${humanizeStatus(action.to)}${reason ? ` · ${reason.trim()}` : ''}${queued ? ' · client email queued' : ''}`);
  return resolve(jobRefs(j));
}

const humanizeStatus = (s: string) => s.replace(/_/g, ' ');

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
  service: { label: 'Service', defaultOwnerRole: null, skipStages: [], inspectionReport: true, inspectionPhotos: true },
  small_job: { label: 'Small job', defaultOwnerRole: 'concierge', skipStages: ['awaiting_customer_approval'], inspectionReport: false, inspectionPhotos: true },
  warranty: { label: 'Warranty', defaultOwnerRole: 'concierge', skipStages: [], inspectionReport: false, inspectionPhotos: true },
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
export const ROLES: Role[] = ['concierge', 'manager', 'inspector', 'watchmaker'];
export const roleHolders = (role: Role): User[] => fx.users.filter((u) => u.roles.includes(role));

export async function setJobOwner(id: string, role: Role | null): Promise<JobWithRefs> {
  const j = getJobRow(id);
  const prev = j.owner;
  j.owner = role ?? undefined;
  jobStamp(j, role ? `Owner → ${role} (${roleHolders(role).map((u) => u.shortName).join(', ') || 'no holder'})${prev ? ` · was ${prev}` : ''}` : `Owner cleared (was ${prev ?? 'none'})`);
  return resolve(jobRefs(j));
}

export async function placeHold(id: string, type: HoldType, reason: string): Promise<JobWithRefs> {
  const j = getJobRow(id);
  if (!reason.trim()) throw new Error('A hold reason is required');
  if (activeHold(j)) throw new Error('Job already has an active hold');
  if (!canHold(j)) throw new Error('Holds apply to on-hand jobs that are approved, in service or in testing');
  const a = actor();
  j.holds.unshift({ id: newId('jh'), type, reason: reason.trim(), priorStatus: j.status, placedAt: new Date().toISOString(), placedBy: a.by, station: a.station });
  const w = store.watches.find((x) => x.id === j.watchId);
  if (w && type === 'parts') w.status = 'awaiting_parts';
  jobStamp(j, `${type === 'parts' ? 'Parts' : 'Outsource'} hold placed · ${reason.trim()} · parked from ${humanizeStatus(j.status)}`);
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

export async function addJobPhotos(id: string, photos: PackagePhoto[]): Promise<JobWithRefs> {
  const j = getJobRow(id);
  const a = actor();
  photos.forEach((p) => j.photos.unshift({ ...p, at: new Date().toISOString(), by: a.by, station: a.station }));
  jobStamp(j, `${photos.length} photo${photos.length === 1 ? '' : 's'} attached`);
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

const jobFromEstimate = (e: Estimate, onHand: boolean): Job => {
  if (!e.watchId) throw new Error('Estimate has no watch — add one before creating a job');
  const pkg = receivedPkgFor(e.id);
  const j = buildJob({ clientId: e.clientId, watchId: e.watchId, estimateId: e.id, onHand: onHand || !!pkg, lines: e.lines, workflow: pkg?.workflow, intakeNotes: pkg?.notes });
  j.packageId = pkg?.id;
  e.jobId = j.id;
  return j;
};

const markConverted = (e: Estimate) => {
  e.status = 'converted';
  e.convertedAt = new Date().toISOString();
  e.updatedAt = e.convertedAt;
};

// E3 "Create job": born from an approved estimate, carrying its lines and watch
export async function createJobFromEstimate(estimateId: string): Promise<JobWithRefs> {
  const e = getEst(estimateId);
  if (e.jobId) throw new Error(`Estimate already has job ${byId(store.jobs, e.jobId).number}`);
  if (e.status !== 'approved') throw new Error('Only an approved estimate can create a job');
  const j = jobFromEstimate(e, false);
  markConverted(e);
  estStamp(e, `Converted → job ${j.number}`);
  jobStamp(j, `Created from estimate ${e.number} · ${j.lines.length} line${j.lines.length === 1 ? '' : 's'} · ${j.workflow.join('+')}${j.packageId ? ' · on hand (received package)' : ''}`);
  return resolve(jobRefs(j));
}

// Pack: if the estimate already has a job → that job goes on_hand + intake_date; else insert a job and link it
export async function convertEstimateToIntake(estimateId: string): Promise<JobWithRefs> {
  const e = getEst(estimateId);
  if (!['sent', 'approved', 'converted'].includes(e.status)) throw new Error('Only a sent, approved or converted estimate can be converted to intake');
  let j: Job;
  if (e.jobId) {
    j = byId(store.jobs, e.jobId);
    if (j.simpleStatus === 'on_hand') throw new Error(`Job ${j.number} is already on hand`);
    if (j.simpleStatus === 'finished') throw new Error(`Job ${j.number} is finished`);
    j.simpleStatus = 'on_hand';
    j.intakeDate = new Date().toISOString();
    jobStamp(j, `Converted to intake · now on hand`);
  } else {
    j = jobFromEstimate(e, true);
    jobStamp(j, `Created on hand via convert-to-intake from ${e.number}`);
  }
  if (e.status !== 'converted') markConverted(e);
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
const assigneeMatches = (a: Assignee, u: User) => (a.type === 'user' ? a.shortName === u.shortName : u.roles.includes(a.role));
export const assigneeLabel = (a: Assignee) => (a.type === 'user' ? a.shortName : `${a.role} role → ${roleHolders(a.role).map((u) => u.shortName).join(', ') || 'no holder'}`);

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

export async function dismissPinned(id: string): Promise<PinnedItem> {
  const p = byId(store.pinned, id);
  const a = actor();
  p.dismissedAt = new Date().toISOString();
  p.dismissedBy = a.by;
  appendAudit({ type: 'pin', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Dismissed pin "${p.title.slice(0, 50)}"` });
  return resolve({ ...p });
}

export async function getToday(userId?: string): Promise<TodayView> {
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

  // Task-derived rows — division-scoped
  store.tasks.filter((t) => t.status === 'open' && t.division === sessionDiv && assigneeMatches(t.assignedTo, me)).forEach((t) => {
    const job = t.jobId ? store.jobs.find((j) => j.id === t.jobId) : undefined;
    rows.push({ id: `task-${t.id}`, source: 'task', title: t.title, detail: job ? `${job.number} · ${clientOf(job.clientId)}` : t.clientId ? clientOf(t.clientId) : 'Task', via: t.assignedTo.type === 'role' ? `role · ${t.assignedTo.role}` : 'assigned to me', taskId: t.id, jobId: job?.id, sentBy: t.createdBy !== me.shortName ? t.createdBy : undefined, urgent: false, ...due(t.dueAt) });
  });

  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.urgent) - Number(a.urgent) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const waitingOn = store.tasks.filter((t) => t.status === 'open' && t.division === sessionDiv && t.createdBy === me.shortName && !assigneeMatches(t.assignedTo, me));
  const pinned = store.pinned.filter((p) => !p.dismissedAt && p.division === sessionDiv && assigneeMatches(p.assignedTo, me));
  return resolve({ pinned, rows, waitingOn });
}

// ---- E5 Sales orders / fulfil / pickup / ship — PROMPT-PACK-invoicing-pickup-ship.md -----------
// Hard stops: QBO stub only, email Outbox only, no real money, shipping via mock seam.

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
const soEmail = (o: SalesOrder, subject: string, body: string) => {
  const a = actor();
  const c = byId(fx.clients, o.clientId);
  store.outbox.unshift({ id: `ob-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: o.number, status: 'pending', subject: `${subject} — ${o.number}`, body: `Hello ${c.firstName},\n\n${body}\n\nOrder: ${o.number}${o.jobId ? ` · Job ${byId(store.jobs, o.jobId).number}` : ''}\n\n— The RolliSuite team`, createdAt: new Date().toISOString(), createdBy: a.by, station: a.station });
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

export async function getSalesOrders(): Promise<SalesOrderWithRefs[]> {
  return resolve([...store.salesOrders].sort((a, b) => b.orderDate.localeCompare(a.orderDate)).map(soRefs));
}
export async function getSalesOrder(id: string): Promise<SalesOrderWithRefs | null> {
  const o = store.salesOrders.find((x) => x.id === id);
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
export interface SalesOrderInput { clientId: string; jobId?: string; estimateId?: string; lines: SOLineInput[]; shippingAmount?: number; memo?: string; channel?: FulfillmentChannel; status?: 'draft' | 'open' }

const nextSONumber = () => `SO-26-${String(++store.counters.so).padStart(4, '0')}`;
const buildSO = (input: SalesOrderInput): SalesOrder => {
  if (!input.clientId) throw new Error('Customer is required before save'); // pack rule
  const a = actor();
  const now = new Date().toISOString();
  const o: SalesOrder = {
    id: newId('so'), number: nextSONumber(), clientId: input.clientId, jobId: input.jobId, estimateId: input.estimateId,
    status: input.status ?? 'draft', channel: input.channel, orderDate: now,
    lines: input.lines.filter((l) => l.description.trim()).map((l) => ({ id: newId('sol'), description: l.description.trim(), partNumber: l.partNumber, qty: l.qty || 1, rate: l.rate || 0, dept: l.dept, pickedUpQty: 0, shippedQty: 0 })),
    shippingAmount: input.shippingAmount ?? 0, total: 0, memo: input.memo?.trim() || undefined, qboStatus: 'not_queued', payments: [], balanceDue: 0, isPaid: false,
    createdAt: now, createdBy: a.by, updatedAt: now,
  };
  soTotals(o);
  store.salesOrders.unshift(o);
  return o;
};

export async function createSalesOrder(input: SalesOrderInput): Promise<SalesOrderWithRefs> {
  const o = buildSO(input);
  soStamp(o, `Created · ${o.status} · ${o.lines.length} lines · ${fmtMoney(o.total)}`);
  return resolve(soRefs(o));
}

export async function convertEstimateToSalesOrder(estimateId: string): Promise<SalesOrderWithRefs> {
  const e = getEst(estimateId);
  const existing = store.salesOrders.find((o) => o.estimateId === e.id && o.status !== 'cancelled');
  if (existing) throw new Error(`Estimate already has ${existing.number}`);
  const shipping = e.lines.filter((l) => l.type === 'shipping').reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const o = buildSO({ clientId: e.clientId, estimateId: e.id, lines: e.lines.filter((l) => l.type !== 'shipping').map((l) => ({ description: l.description, partNumber: l.partNumber, qty: l.qty, rate: l.unitPrice, dept: l.dept })), shippingAmount: shipping, memo: e.clientNotes });
  estStamp(e, `Converted → sales order ${o.number} (draft)`);
  soStamp(o, `Created from estimate ${e.number} · draft`);
  return resolve(soRefs(o));
}

export interface SalesOrderPatch { lines?: SOLineInput[]; shippingAmount?: number; memo?: string; channel?: FulfillmentChannel }
export async function updateSalesOrder(id: string, patch: SalesOrderPatch): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['draft', 'open'].includes(o.status)) throw new Error('Only draft or open orders can be edited');
  if (patch.lines) o.lines = patch.lines.filter((l) => l.description.trim()).map((l) => ({ id: newId('sol'), description: l.description.trim(), partNumber: l.partNumber, qty: l.qty || 1, rate: l.rate || 0, dept: l.dept, pickedUpQty: 0, shippedQty: 0 }));
  if (patch.shippingAmount !== undefined) o.shippingAmount = patch.shippingAmount;
  if (patch.memo !== undefined) o.memo = patch.memo.trim() || undefined;
  if (patch.channel !== undefined) o.channel = patch.channel;
  soTotals(o);
  soStamp(o, `Edited · ${fmtMoney(o.total)}`);
  return resolve(soRefs(o));
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
  o.qboInvoiceId = `QBO-STUB-${10000 + store.salesOrders.length * 7 + Math.floor(Math.random() * 90)}`; // HARD STOP: nothing leaves the app
  o.qboStatus = 'queued';
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
// Ship Station confirm: shipment record, line shipped_qty, SO shipped + tracking + ship_date, Outbox notification, custody closes
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
  soStamp(o, `Shipped · ${input.carrier.toUpperCase()} ${shipment.tracking} · insured ${fmtMoney(shipment.coverage)}${shipment.bypassReason ? ` · PAYMENT BYPASS: ${shipment.bypassReason}` : ''}`);
  closeCustody(o, `Shipped ${shipment.tracking}`);
  soEmail(o, 'Your watch has shipped', `Your watch is on its way via ${shipment.service}. Tracking: ${shipment.tracking}. The shipment is insured for ${fmtMoney(shipment.coverage)} and requires a signature on delivery.`);
  return resolve(soRefs(o));
}

export interface ConfirmPickupInput { code?: string; proxyName?: string; proxyIdPhoto?: PackagePhoto; photos: PackagePhoto[]; lineQty?: Record<string, number>; bypassReason?: string }
// Pickup Station complete: verify code (or proxy name + ID photo), photos required, consume code, picked_up_qty, custody closes. Signature-free (locked decision).
export async function confirmPickup(id: string, input: ConfirmPickupInput): Promise<SalesOrderWithRefs> {
  const o = getSO(id);
  if (!['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)) throw new Error('Order is not in the pickup queue');
  if (o.channel === 'ship' && o.shippingAddress) throw new Error('Order has outbound ship products — send staff to Ship Station');
  const codeOk = !!o.pickupCode && input.code?.trim().toUpperCase().replace(/\s/g, '') === o.pickupCode.replace(/\s/g, '');
  const proxyOk = !!input.proxyName?.trim() && !!input.proxyIdPhoto;
  if (!codeOk && !proxyOk) throw new Error('Verify identity: pickup code, or proxy name + government ID photo');
  if (input.photos.length === 0) throw new Error('Hand-back photos are required to complete');
  if (!o.isPaid && !input.bypassReason?.trim()) throw new Error(`Balance due ${fmtMoney(o.balanceDue)} — take payment or log a bypass reason`);
  const a = actor();
  const lineQty = input.lineQty ?? {};
  o.lines.forEach((l) => { l.pickedUpQty = Math.min(l.qty, l.pickedUpQty + (lineQty[l.id] ?? l.qty - l.pickedUpQty)); });
  const fully = o.lines.every((l) => l.pickedUpQty >= l.qty);
  o.pickupSession = { id: newId('pks'), codeUsed: codeOk ? o.pickupCode : undefined, proxyName: input.proxyName?.trim() || undefined, proxyIdPhoto: input.proxyIdPhoto, photos: input.photos, lineQty, bypassReason: input.bypassReason?.trim() || undefined, at: new Date().toISOString(), by: a.by, station: a.station };
  o.channel = 'pickup';
  if (codeOk) o.pickupCode = undefined; // consumed
  if (fully) { o.status = 'picked_up'; o.pickedUpAt = o.pickupSession.at; if (!o.fulfilledAt) o.fulfilledAt = o.pickedUpAt; } else o.status = 'partial_fulfilled';
  soTotals(o);
  soStamp(o, `${fully ? 'Picked up' : 'Partial pickup'} · ${codeOk ? 'code verified' : `proxy ${input.proxyName} (ID photo)`}${o.pickupSession.bypassReason ? ` · PAYMENT BYPASS: ${o.pickupSession.bypassReason}` : ''}`);
  if (fully) closeCustody(o, 'Picked up at counter');
  soEmail(o, fully ? 'Thank you — your watch is home' : 'Partial pickup recorded', fully ? 'Your watch was handed back at the counter today. Thank you for trusting us with it.' : 'Part of your order was collected today; the remaining items will be ready shortly.');
  return resolve(soRefs(o));
}

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
  if (j.status === 'ready_to_ship') pushTransition(j, 'close', 'closed');
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
  const benchRole = me.roles.includes('watchmaker') || me.roles.includes('inspector');
  const pn = benchRole ? pullNextCandidate(me.shortName) : null;
  const partsRequests = store.partsRequests.filter((r) => r.requestedBy === me.shortName && r.status !== 'draft').map(prRefs);
  return resolve({ jobs, holds, pullNext: pn ? jobRefs(pn) : null, partsRequests });
}

// Pull-next = self-assign + start service, audit-stamped
export async function pullNext(): Promise<JobWithRefs> {
  const a = actor();
  if (!a.user || !(a.user.roles.includes('watchmaker') || a.user.roles.includes('inspector'))) throw new Error('Pull-next is for bench roles (watchmaker / inspector)');
  const j = pullNextCandidate(a.by);
  if (!j) throw new Error('Nothing to pull — no unassigned approved jobs on hand');
  if (!j.assignees.includes(a.by)) j.assignees.push(a.by);
  jobStamp(j, `Pulled next by ${a.by} · self-assigned`);
  return resolve(jobRefs(j));
}

export async function getSupervisorBoard(): Promise<SupervisorBoard> {
  const open = store.jobs.filter((j) => j.status !== 'closed');
  const techs = fx.users.filter((u) => u.roles.includes('watchmaker') || u.roles.includes('inspector'));
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
  if (a.user?.accessTier !== 'manager') throw new Error('Assignment is a supervisor action (manager tier)');
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
  const a = actor();
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

const GROUP_LABEL: Record<IdentifierKind, string> = { client: 'Clients', estimate: 'Estimates', job: 'Jobs', package: 'Packages / SUB#', sales_order: 'Invoices (SO)', watch: 'Watches', request: 'Requests' };
const GROUP_ORDER: IdentifierKind[] = ['client', 'watch', 'estimate', 'job', 'sales_order', 'package', 'request'];

export async function getRequests(): Promise<ServiceRequest[]> { return resolve([...store.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
export async function getRequestsForClient(clientId: string): Promise<ServiceRequest[]> { return resolve(store.requests.filter((r) => r.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }

// Accepts ANY identifier: name, email, phone, estimate #, job #, SUB#, tracking, watch ref / serial, SO #, pickup code, request #
export async function resolveIdentifier(query: string): Promise<SearchResults> {
  const raw = query.trim();
  const q = raw.toLowerCase();
  const nq = norm(raw);
  const digits = raw.replace(/\D/g, '');
  const estD = estimateDigits(raw);
  const hits: SearchHit[] = [];
  if (!q) return resolve({ query: raw, groups: [], total: 0 });

  fx.clients.forEach((c) => {
    const name = fullNameOf(c).toLowerCase();
    const matched = name.includes(q) ? fullNameOf(c) : c.email.toLowerCase().includes(q) ? c.email : c.company?.toLowerCase().includes(q) ? c.company : digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits) ? c.phone : null;
    if (matched) hits.push({ kind: 'client', id: c.id, hitKey: 'top', label: fullNameOf(c), detail: [c.company, c.email, c.phone].filter(Boolean).join(' · '), matched, clientId: c.id, clientName: fullNameOf(c), path: `/clients/${c.id}` });
  });

  if (q.length >= 3) {
    store.watches.forEach((w) => {
      const matched = norm(w.reference).includes(nq) ? w.reference : norm(w.serial).includes(nq) ? w.serial : `${w.brand} ${w.model}`.toLowerCase().includes(q) ? `${w.brand} ${w.model}` : null;
      if (matched) hits.push({ kind: 'watch', id: w.id, hitKey: `watch-${w.id}`, label: `${w.brand} ${w.model}`, detail: `Ref ${w.reference} · S/N ${w.serial} · ${statusLabel(w.status)}`, matched, clientId: w.clientId, clientName: clientName(w.clientId), path: clientPath(w.clientId, `watch-${w.id}`, '/') });
    });
  }

  if (estD.length >= 2 || q.length >= 2) {
    store.estimates.forEach((e) => {
      if ((estD && estimateDigits(e.number).startsWith(estD)) || e.number.toLowerCase() === q) hits.push({ kind: 'estimate', id: e.id, hitKey: `est-${e.id}`, label: `${e.number}${e.revision > 1 ? ` · rev ${e.revision}` : ''}`, detail: `${statusLabel(e.status)} · ${moneyLabel(e.total)}`, matched: e.number, clientId: e.clientId, clientName: clientName(e.clientId), path: clientPath(e.clientId, `est-${e.id}`, `/estimates/${e.id}`) });
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
      if (matched) hits.push({ kind: 'sales_order', id: o.id, hitKey: `so-${o.id}`, label: o.number, detail: `${statusLabel(o.status)} · ${moneyLabel(o.total)} · ${o.isPaid ? 'paid' : `balance ${moneyLabel(o.balanceDue)}`}`, matched, clientId: o.clientId, clientName: clientName(o.clientId), path: clientPath(o.clientId, `so-${o.id}`, `/sales/${o.id}`) });
    });
    store.packages.forEach((p) => {
      const matched = norm(p.subNumber).includes(nq) || (digits.length >= 3 && p.subNumber.replace(/\D/g, '').endsWith(digits)) ? p.subNumber : p.trackingNumber && norm(p.trackingNumber).includes(nq) ? p.trackingNumber : null;
      if (matched) hits.push({ kind: 'package', id: p.id, hitKey: `pkg-${p.id}`, label: p.subNumber, detail: `${statusLabel(p.status)} · ${p.carrier}${p.trackingNumber ? ` ${p.trackingNumber}` : ''}`, matched, clientId: p.clientId, clientName: p.clientId ? clientName(p.clientId) : 'Unknown client', path: clientPath(p.clientId, `pkg-${p.id}`, `/intake/receive/${p.id}`) });
    });
    store.requests.forEach((r) => {
      if (norm(r.number).includes(nq)) hits.push({ kind: 'request', id: r.id, hitKey: `req-${r.id}`, label: r.number, detail: `${statusLabel(r.status)} · ${r.source}`, matched: r.number, clientId: r.clientId, clientName: clientName(r.clientId), path: clientPath(r.clientId, `req-${r.id}`, '/') });
    });
  }

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
    const job = store.jobs.find((j) => j.packageId === p.id);
    if (p.inspectedAt && p.status === 'received') out.push({ id: `cu-${p.id}-rcv`, kind: 'watch_received', at: p.inspectedAt, by: p.inspectedBy ?? 'Unknown', station: 'Front Desk 1', detail: `${watchLabel(job?.watchId)} received into custody from ${p.subNumber}`, packageId: p.id, jobId: job?.id, watchId: job?.watchId, hitKey: job ? `job-${job.id}` : `pkg-${p.id}`, path: job ? `/jobs/${job.id}` : `/intake/receive/${p.id}` });
    if (p.status === 'discrepancy_hold' && p.inspectedAt) out.push({ id: `cu-${p.id}-dis`, kind: 'discrepancy', at: p.inspectedAt, by: p.inspectedBy ?? 'Unknown', station: 'Front Desk 1', detail: `Discrepancy hold on ${p.subNumber}: ${p.discrepancyReason ?? ''}`, packageId: p.id, hitKey: `pkg-${p.id}`, path: `/intake/inspection/${p.id}` });
  });
  store.jobs.filter((j) => j.clientId === clientId).forEach((j) => {
    if (!j.packageId && j.intakeDate) out.push({ id: `cu-${j.id}-in`, kind: 'watch_received', at: j.intakeDate, by: j.timeline[0]?.by ?? j.createdBy, station: j.timeline[0]?.station ?? 'Front Desk 1', detail: `${watchLabel(j.watchId)} received on hand · ${j.number}`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
    j.holds.forEach((h) => {
      out.push({ id: `cu-${h.id}-p`, kind: 'hold_placed', at: h.placedAt, by: h.placedBy, station: h.station, detail: `${h.type === 'outsource' ? 'Left the building — outsource' : 'Parts hold'} on ${j.number}: ${h.reason}`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
      if (h.releasedAt) out.push({ id: `cu-${h.id}-r`, kind: 'hold_released', at: h.releasedAt, by: h.releasedBy ?? 'Unknown', station: h.station, detail: `Hold released on ${j.number}${h.releaseNote ? ` · ${h.releaseNote}` : ''}`, jobId: j.id, watchId: j.watchId, hitKey: `job-${j.id}`, path: `/jobs/${j.id}` });
    });
  });
  store.salesOrders.filter((o) => o.clientId === clientId).forEach((o) => {
    const job = o.jobId ? store.jobs.find((j) => j.id === o.jobId) : undefined;
    if (o.shipment) out.push({ id: `cu-${o.id}-ship`, kind: 'shipped', at: o.shipment.at, by: o.shipment.by, station: o.shipment.station, detail: `${watchLabel(job?.watchId)} shipped · ${o.shipment.service} · ${o.shipment.tracking}`, salesOrderId: o.id, jobId: job?.id, watchId: job?.watchId, hitKey: `so-${o.id}`, path: `/sales/${o.id}` });
    if (o.pickupSession) out.push({ id: `cu-${o.id}-pu`, kind: 'picked_up', at: o.pickupSession.at, by: o.pickupSession.by, station: o.pickupSession.station, detail: `${watchLabel(job?.watchId)} released at pickup${o.pickupSession.proxyName ? ` to ${o.pickupSession.proxyName}` : ''}${o.pickupSession.codeUsed ? ` · code ${o.pickupSession.codeUsed}` : ''}`, salesOrderId: o.id, jobId: job?.id, watchId: job?.watchId, hitKey: `so-${o.id}`, path: `/sales/${o.id}` });
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
      ...estimates.filter((e) => e.watchId === watch.id).map((e): WatchHistoryRow => ({ kind: 'estimate', id: e.id, hitKey: `est-${e.id}`, number: e.number + (e.revision > 1 ? ` r${e.revision}` : ''), status: e.status, title: e.lines[0]?.description ?? 'Estimate', amount: e.total, at: e.createdAt, path: `/estimates/${e.id}` })),
      ...jobs.filter((j) => j.watchId === watch.id).map((j): WatchHistoryRow => ({ kind: 'job', id: j.id, hitKey: `job-${j.id}`, number: j.number, status: j.status, title: `${j.workflow.join('·')} · ${j.lines[0]?.description ?? 'Job'}`, amount: j.total, at: j.createdAt, path: `/jobs/${j.id}` })),
      ...salesOrders.filter((o) => o.job?.watchId === watch.id).map((o): WatchHistoryRow => ({ kind: 'sales_order', id: o.id, hitKey: `so-${o.id}`, number: o.number, status: o.isPaid ? 'paid' : 'unpaid', title: `Invoice · ${o.status.replace(/_/g, ' ')}`, amount: o.total, at: o.orderDate, path: `/sales/${o.id}` })),
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
  store.outbox.unshift({ id: `ob-${Date.now().toString(36)}`, to: c.email, toName: `${c.firstName} ${c.lastName}`, relatedRef: 'RolliConnect sign-in', status: 'pending', subject: 'Your RolliConnect sign-in link', body: `Hello ${c.firstName},\n\nTap the link below to open RolliConnect. It expires in 15 minutes.\n\n${path}\n\nIf you didn’t ask for this, you can ignore it.\n\n— RolliSuite`, createdAt: new Date().toISOString(), createdBy: 'RolliConnect', station: 'RolliConnect' });
  portalStamp(c.id, 'Magic link requested · email queued to Outbox (stub)');
  return resolve({ link, path });
}

export async function portalRedeemMagicLink(token: string): Promise<Client> {
  const link = store.magicLinks.find((l) => l.token === token);
  if (!link) throw new Error('This link is invalid or has expired');
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
      case 'ready_to_ship': return so?.status === 'fulfilled' || so?.status === 'partial_fulfilled' ? (so.channel === 'ship' ? 'preparing_ship' : 'ready_pickup') : 'finishing';
      case 'closed': return 'back_with_you';
    }
  })();
  return { key, ...PORTAL_STATUS[key] };
};

const portalDocs = (jobs: Job[], ests: Estimate[], sos: SalesOrder[]): PortalDocument[] => {
  const docs: PortalDocument[] = [];
  jobs.forEach((j) => j.photos.forEach((p) => docs.push({ id: `doc-${p.id}`, kind: 'photo', title: `Inspection photo · ${j.number}`, at: p.at, dataUrl: p.dataUrl })));
  jobs.forEach((j) => rs.evidence.filter((e) => e.jobId === j.id).forEach((e) => docs.push({ id: `doc-${e.id}`, kind: 'photo', title: `Service evidence · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label}${e.depthRating ? ` · ${e.depthRating}` : ''}${e.grades ? ` · ${e.grades.join(', ')}` : ''} · ${j.number}`, at: e.at, dataUrl: e.photo.dataUrl })));
  store.packages.filter((p) => jobs.some((j) => j.packageId === p.id)).forEach((p) => p.photos.forEach((ph, i) => docs.push({ id: `doc-${p.id}-${i}`, kind: 'photo', title: `Arrival photo · ${p.subNumber}`, at: p.arrivedAt, dataUrl: ph.dataUrl })));
  ests.filter((e) => e.status !== 'draft').forEach((e) => docs.push({ id: `doc-${e.id}`, kind: 'estimate', title: `Estimate ${e.number}${e.revision > 1 ? ` (rev ${e.revision})` : ''}`, at: e.updatedAt, path: `/rc/estimates/${e.id}` }));
  sos.filter((o) => o.status !== 'draft' && o.status !== 'cancelled').forEach((o) => {
    docs.push({ id: `doc-${o.id}`, kind: 'invoice', title: `Invoice ${o.number}`, at: o.orderDate, path: `/rc/invoices/${o.id}` });
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
  return { watch: w, status, job: job && job.status !== 'closed' ? job : undefined, openEstimate, invoice, eta: job?.dueAt && job.status !== 'closed' ? job.dueAt : undefined, history: portalHistory(jobs, ests, sos), documents: portalDocs(jobs, ests, sos) };
};

const needsYouFor = (clientId: string, watches: PortalWatch[]): NeedsYouItem[] => {
  const items: NeedsYouItem[] = [];
  store.estimates.filter((e) => e.clientId === clientId && e.status === 'sent').forEach((e) => {
    const w = e.watchId ? store.watches.find((x) => x.id === e.watchId) : undefined;
    items.push({ id: `ny-est-${e.id}`, kind: 'approve_estimate', title: `Approve or decline estimate ${e.number}`, detail: `${w ? `${w.brand} ${w.model} · ` : ''}${fmtMoney(e.total)} · valid until ${new Date(e.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, path: `/rc/estimates/${e.id}`, at: e.sentAt ?? e.updatedAt, watchId: e.watchId });
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
  return resolve(withRefs(e));
}

export async function portalApproveEstimate(clientId: string, id: string): Promise<EstimateWithRefs> {
  requireOwner(clientId, store.estimates.find((e) => e.id === id), 'estimate');
  recordRcEvent({ t: 'approve', clientId, id });
  const r = await asClient(clientId, () => approveEstimate(id, 'portal'));
  // The linked job (if it is waiting on the customer) moves forward too — staff see it in the Approved lane instantly
  const job = store.jobs.find((j) => j.estimateId === id && j.status === 'awaiting_customer_approval');
  if (job) await asClient(clientId, () => transitionJob(job.id, 'approve'));
  portalStamp(clientId, `Approved estimate ${r.number} rev ${r.revision}${job ? ` · job ${job.number} → approved` : ''}`);
  return r;
}

export async function portalDeclineEstimate(clientId: string, id: string, reason: string): Promise<EstimateWithRefs> {
  requireOwner(clientId, store.estimates.find((e) => e.id === id), 'estimate');
  if (!reason.trim()) throw new Error('Please tell us why');
  recordRcEvent({ t: 'decline', clientId, id, reason });
  const r = await asClient(clientId, () => declineEstimate(id, reason, 'portal'));
  portalStamp(clientId, `Declined estimate ${r.number} · ${reason.trim()}`);
  return r;
}

export async function portalGetInvoice(clientId: string, id: string): Promise<SalesOrderWithRefs> {
  return resolve(soRefs(requireOwner(clientId, store.salesOrders.find((o) => o.id === id), 'invoice')));
}

// Payment stub: settles the full balance as a card payment — no processor, ledger only
export async function portalPayBalance(clientId: string, id: string): Promise<SalesOrderWithRefs> {
  const o = requireOwner(clientId, store.salesOrders.find((x) => x.id === id), 'invoice');
  if (o.balanceDue <= 0) throw new Error('This invoice is already paid');
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

export async function portalSendMessage(clientId: string, text: string, watchId?: string): Promise<Message> {
  if (!text.trim()) throw new Error('Write something first');
  recordRcEvent({ t: 'msg', clientId, text, watchId });
  const c = byId(fx.clients, clientId);
  const m: Message = { id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, clientId, watchId, from: 'client', by: `${c.firstName} ${c.lastName}`, text: text.trim(), at: new Date().toISOString(), readByStaff: false, readByClient: true };
  store.messages.push(m);
  portalStamp(clientId, `Message sent to the team${watchId ? ` about ${store.watches.find((w) => w.id === watchId)?.model ?? 'a watch'}` : ''}`);
  return resolve(m);
}

// Staff side: inbox of client threads; replies queue an Outbox email (nothing sends)
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
  store.outbox.unshift(email);
  const m: Message = { id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, clientId, watchId, from: 'staff', by: a.by, text: text.trim(), at: email.createdAt, readByStaff: true, readByClient: false, emailId: email.id };
  store.messages.push(m);
  await markThreadRead(clientId);
  appendAudit({ type: 'portal', stationName: a.station, userShortName: a.user?.shortName, userDisplayName: a.user?.displayName, detail: `Replied to ${c.firstName} ${c.lastName} in RolliConnect · email queued to Outbox` });
  return resolve(m);
}

// ---- E9 RS modules ---------------------------------------------------------------------------------
import type { CycleCount, EvidenceItem, EvidenceSlot, IntegrationTile, MessageTemplate, PartsGrade, PurchaseOrder, PurchaseOrderWithRefs, QboQueueRow, Report, StockLevel, StockLocation, StockMovement, StockRow, TemplateKey, UserAdminInput, Vendor } from './types';

const rs = {
  vendors: fx.vendors.map((v): Vendor => ({ ...v })),
  locations: fx.locations.map((l): StockLocation => ({ ...l })),
  stock: fx.stockLevels.map((s): StockLevel => ({ ...s })),
  pos: fx.purchaseOrders.map((p): PurchaseOrder => ({ ...p, lines: p.lines.map((l) => ({ ...l })) })),
  movements: fx.stockMovements.map((m): StockMovement => ({ ...m })),
  counts: fx.cycleCounts.map((c): CycleCount => ({ ...c, lines: c.lines.map((l) => ({ ...l })) })),
  templates: fx.templates.map((t): MessageTemplate => ({ ...t, mergeFields: [...t.mergeFields] })),
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
export async function saveVendor(input: Omit<Vendor, 'id' | 'active'> & { id?: string }): Promise<Vendor> {
  if (!input.name.trim()) throw new Error('Vendor name is required');
  const existing = input.id ? rs.vendors.find((v) => v.id === input.id) : undefined;
  const v: Vendor = existing ? Object.assign(existing, { ...input }) : { ...input, id: newId('v'), active: true };
  if (!existing) rs.vendors.push(v);
  rsStamp('purchasing', `Vendor ${existing ? 'updated' : 'created'} · ${v.name}`);
  return resolve({ ...v });
}
export async function setVendorActive(id: string, active: boolean): Promise<Vendor> { const v = byId(rs.vendors, id); v.active = active; rsStamp('purchasing', `Vendor ${active ? 'reactivated' : 'retired'} · ${v.name}`); return resolve({ ...v }); }
export async function getPurchaseOrders(): Promise<PurchaseOrderWithRefs[]> { return resolve([...rs.pos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(poRefs)); }
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
  p.status = 'sent'; p.sentAt = new Date().toISOString(); const v = byId(rs.vendors, p.vendorId); const a = actor();
  store.outbox.unshift({ id: `ob-${Date.now().toString(36)}`, to: v.email, toName: v.name, relatedRef: p.number, status: 'pending', subject: `Purchase order ${p.number}`, body: `${p.lines.map((l) => `• ${l.partNumber} ${l.description} × ${l.qty} @ ${fmtMoney(l.unitCost)}`).join('\n')}\n\nTotal ${fmtMoney(p.total)} · ${v.terms}\n\n— RolliSuite purchasing (STUB — not sent)`, createdAt: p.sentAt, createdBy: a.by, station: a.station });
  rsStamp('purchasing', `${p.number} sent to ${v.name} (stub · Outbox)`); return resolve(poRefs(p));
}
export async function cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderWithRefs> {
  const p = byId(rs.pos, id); if (!reason.trim()) throw new Error('A reason is required'); if (p.status === 'received' || p.status === 'cancelled') throw new Error('PO is already closed');
  p.status = 'cancelled'; p.cancelledAt = new Date().toISOString(); p.cancelReason = reason.trim(); rsStamp('purchasing', `${p.number} cancelled · ${p.cancelReason}`); return resolve(poRefs(p));
}
// Receive against PO: each received line increments stock at the PO's location with an audited movement
export async function receivePurchaseOrder(id: string, qtyByLine: Record<string, number>): Promise<PurchaseOrderWithRefs> {
  const p = byId(rs.pos, id); if (!['sent', 'partially_received'].includes(p.status)) throw new Error('PO must be sent before receiving');
  let any = false;
  p.lines.forEach((l) => { const q = Math.min(qtyByLine[l.id] ?? 0, l.qty - l.receivedQty); if (q > 0) { l.receivedQty += q; any = true; move('receipt', l.partId, p.locationId, q, `Received against ${p.number}`, { ref: p.number, poId: p.id }); } });
  if (!any) throw new Error('Enter a quantity to receive');
  const done = p.lines.every((l) => l.receivedQty >= l.qty); p.status = done ? 'received' : 'partially_received'; if (done) p.receivedAt = new Date().toISOString();
  rsStamp('purchasing', `${p.number} ${done ? 'fully received' : 'partially received'}`); return resolve(poRefs(p));
}

// -- Inventory
export async function getLocations(): Promise<StockLocation[]> { return resolve([...rs.locations]); }
export async function getStockRows(): Promise<StockRow[]> {
  return resolve(rs.stock.map((s): StockRow => ({ part: byId(store.parts, s.partId), location: byId(rs.locations, s.locationId), onHand: s.onHand, reorderPoint: s.reorderPoint, low: s.onHand <= s.reorderPoint })).sort((a, b) => Number(b.low) - Number(a.low) || a.part.partNumber.localeCompare(b.part.partNumber)));
}
export async function getLowStock(): Promise<StockRow[]> { return (await getStockRows()).filter((r) => r.low); }
export async function getStockMovements(partId?: string): Promise<StockMovement[]> { return resolve(rs.movements.filter((m) => !partId || m.partId === partId).sort((a, b) => b.at.localeCompare(a.at))); }
export async function adjustStock(partId: string, locationId: string, delta: number, reason: string): Promise<StockMovement> {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Enter a non-zero whole number'); if (!reason.trim()) throw new Error('A reason is required');
  if (stockAt(partId, locationId).onHand + delta < 0) throw new Error('Stock cannot go negative'); return resolve(move('adjustment', partId, locationId, delta, reason.trim()));
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
  c.status = 'posted'; c.postedAt = new Date().toISOString(); c.postedBy = a.by; rsStamp('inventory', `${c.number} posted · ${c.variances} variance${c.variances === 1 ? '' : 's'}`); return resolve({ ...c });
}

// -- Labels (batch reprint → existing Label Queue, unprinted)
export async function queueLabelsFor(kind: 'estimate' | 'job' | 'watch', ids: string[]): Promise<LabelJob[]> {
  const out: LabelJob[] = [];
  ids.forEach((id) => {
    const job = kind === 'job' ? store.jobs.find((j) => j.id === id) : kind === 'watch' ? store.jobs.find((j) => j.watchId === id) : store.jobs.find((j) => j.estimateId === id);
    const est = kind === 'estimate' ? store.estimates.find((e) => e.id === id) : job?.estimateId ? store.estimates.find((e) => e.id === job.estimateId) : undefined;
    const w = kind === 'watch' ? store.watches.find((x) => x.id === id) : job ? store.watches.find((x) => x.id === job.watchId) : est?.watchId ? store.watches.find((x) => x.id === est.watchId) : undefined;
    if (!w) return; const c = byId(fx.clients, w.clientId); const num = job?.number ?? est?.number ?? w.id; const pkgId = job?.packageId ?? store.packages.find((p) => p.estimateId === est?.id)?.id ?? '';
    out.push(queueLabel({ type: 'pdf417_data', packageId: pkgId, estimateNumber: num, payload: `${num}|${w.reference}|${w.serial}|${job?.workflow.join(',') ?? ''}`, lines: [num, `${c.firstName} ${c.lastName}`, job ? `Workflow ${job.workflow.join(' · ')}` : 'Reprint'] }));
    out.push(queueLabel({ type: 'ref_serial', packageId: pkgId, estimateNumber: num, payload: `${w.reference} / ${w.serial}`, lines: [`${w.brand} ${w.model}`, `Ref ${w.reference}`, `Serial ${w.serial}`] }));
  });
  if (!out.length) throw new Error('Nothing matched — pick records with a watch');
  rsStamp('labels', `${out.length} labels queued (batch reprint by ${kind})`); return resolve(out);
}

// -- Reports (each reconciles with getDashboardStats)
const monthKey = (iso: string) => iso.slice(0, 7);
const ageBucket = (iso: string) => { const d = (Date.now() - new Date(iso).getTime()) / 86_400_000; return d <= 7 ? '0–7d' : d <= 30 ? '8–30d' : d <= 90 ? '31–90d' : '90d+'; };
const isLabor = (l: EstimateLine) => l.type === 'service';
export async function getReport(key: 'funnel' | 'throughput' | 'aging' | 'pnl'): Promise<Report> {
  const now = new Date().toISOString(); const es = store.estimates; const js = store.jobs;
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
  const closed = js.filter((j) => isThisMonth(j.finishedAt)); const depts: DeptCode[] = ['W', 'B', 'P', 'PM'];
  const labor = (d: DeptCode) => closed.reduce((t, j) => t + j.lines.filter((l) => isLabor(l) && l.dept === d).reduce((s, l) => s + l.qty * l.unitPrice, 0), 0);
  const goods = closed.reduce((t, j) => t + j.lines.filter((l) => !isLabor(l)).reduce((s, l) => s + l.qty * l.unitPrice, 0), 0);
  return resolve({ key, title: 'Department P&L (labor only) — this month', columns: ['department', 'labor revenue', 'closed jobs'], note: 'Labor lines (type service) attribute to W/B/P/PM; parts & shipping lines are excluded as no_dept_product. Sum of all rows = dashboard "revenue this month".', generatedAt: now,
    rows: [...depts.map((d) => ({ label: d, values: { department: `${fx.DEPT_LABEL[d]} (${d})`, 'labor revenue': labor(d), 'closed jobs': closed.filter((j) => j.lines.some((l) => isLabor(l) && l.dept === d)).length } })),
      { label: 'no_dept_product', values: { department: 'no_dept_product (goods, excluded)', 'labor revenue': goods, 'closed jobs': closed.filter((j) => j.lines.some((l) => !isLabor(l))).length } },
      { label: 'total', values: { department: 'Total = dashboard revenue', 'labor revenue': closed.reduce((t, j) => t + j.total, 0), 'closed jobs': closed.length } }] });
}
export const reportToCsv = (r: Report): string => [r.columns.join(','), ...r.rows.map((row) => r.columns.map((c) => { const v = row.values[c] ?? ''; return typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v); }).join(','))].join('\n');

// -- Accounting (QBO stub views)
export async function getQboQueue(): Promise<QboQueueRow[]> {
  return resolve(store.salesOrders.filter((o) => o.status !== 'draft' && o.status !== 'cancelled').map((o): QboQueueRow => ({ salesOrderId: o.id, number: o.number, client: clientName(o.clientId), total: o.total, qboInvoiceId: o.qboInvoiceId, syncState: o.qboStatus === 'queued' ? (o.number.endsWith('5') ? 'error_stub' : o.status === 'picked_up' || o.status === 'shipped' ? 'pushed_stub' : 'queued') : 'not_queued', at: o.fulfilledAt ?? o.orderDate })).sort((a, b) => b.at.localeCompare(a.at)));
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
export async function getTemplates(): Promise<MessageTemplate[]> { return resolve(rs.templates.map((t) => ({ ...t }))); }
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
export const EVIDENCE_REQUIRED: Record<JobKind, EvidenceSlot[]> = { service: ['hidden_serial', 'timing_sheet', 'pressure_test', 'parts_grading'], small_job: ['hidden_serial'], warranty: ['hidden_serial', 'timing_sheet'] };
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
export interface EvidenceInput { slot: EvidenceSlot; photo: PackagePhoto; labelScan: string; grades?: PartsGrade[]; depthRating?: string; note?: string }
export async function captureEvidence(jobId: string, input: EvidenceInput): Promise<EvidenceItem> {
  const j = getJobRow(jobId); const w = byId(store.watches, j.watchId); const scan = input.labelScan.trim().toUpperCase();
  if (!scan) throw new Error('Scan or enter the watch label first — evidence must key to the watch');
  const okScan = [j.number, w.reference, w.serial, `${w.reference} / ${w.serial}`, `${w.reference}/${w.serial}`].map((s) => s.toUpperCase()).some((s) => scan === s || scan.startsWith(`${j.number}|`) || scan.includes(w.serial.toUpperCase()));
  if (!okScan) throw new Error(`Label does not match this watch (expected ${j.number}, ref ${w.reference} or serial ${w.serial})`);
  if (input.slot === 'pressure_test' && !/^\d+\s*M\s*\/\s*\d+\s*FT$/i.test(input.depthRating?.trim() ?? '')) throw new Error('Depth rating must look like 50M/164ft');
  if (input.slot === 'parts_grading' && !input.grades?.length) throw new Error('Tag at least one grade (B · Ø/REPL · D/REPL)');
  const a = actor();
  const e: EvidenceItem = { id: `ev-${++rs.counters.ev}`, jobId, watchId: w.id, slot: input.slot, photo: input.photo, labelScan: scan, grades: input.slot === 'parts_grading' ? input.grades : undefined, depthRating: input.slot === 'pressure_test' ? input.depthRating!.trim().toUpperCase().replace(/\s/g, '') : undefined, note: input.note?.trim() || (input.slot === 'timing_sheet' ? 'before left / after right' : undefined), at: new Date().toISOString(), by: a.by, station: a.station };
  rs.evidence.unshift(e);
  rsStamp('evidence', `${j.number} · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label} captured · ${w.reference}/${w.serial}${e.depthRating ? ` · ${e.depthRating}` : ''}${e.grades ? ` · ${e.grades.join(', ')}` : ''}`);
  jobStamp(j, `Evidence · ${EVIDENCE_SLOTS.find((s) => s.key === e.slot)!.label}`);
  return resolve({ ...e });
}

// Restore client-initiated writes on load (fixtures are in-memory; the portal log is not)
replayRcEvents();
