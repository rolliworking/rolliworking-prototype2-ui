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
  Assignee,
  PinnedItem,
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
} from './types';

export * from './types';

const LATENCY_MS = 120;

const KEYS = {
  currentUser: 'rollisuite.prototype.currentUserId',
  deviceInitialized: 'rollisuite.prototype.deviceInitialized',
  stationId: 'rollisuite.prototype.stationId',
  stations: 'rollisuite.prototype.stations',
  audit: 'rollisuite.prototype.auditLog',
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
  packages: fx.packages.map((p) => ({ ...p, contents: [...p.contents], photos: [...p.photos] })),
  outbox: fx.outbox.map((e) => ({ ...e })),
  labels: fx.labels.map((l) => ({ ...l })),
  watches: fx.watches.map((w) => ({ ...w })),
  estimates: fx.estimates.map((e): Estimate => ({ ...e, lines: e.lines.map((l) => ({ ...l })), revisions: [] as EstimateRevision[], jobId: fx.jobs.find((j) => j.estimateId === e.id)?.id })),
  jobs: fx.jobs.map((j): Job => ({ ...j, lines: j.lines.map((l) => ({ ...l })), timeline: [...j.timeline], holds: j.holds.map((h) => ({ ...h })), notes: [...j.notes], photos: [...j.photos], workflow: [...j.workflow], assignees: [...j.assignees], inspection: j.inspection ? { ...j.inspection, answers: { ...j.inspection.answers } } : undefined })),
  shopTime: fx.shopTime.map((t) => ({ ...t })),
  counters: { sub: 314, label: 3, estimate: 1058, job: 2028 },
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
  if (saved) return saved;
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

export async function getStation(): Promise<Station | null> {
  return resolve(readStation());
}

export async function getStations(): Promise<Station[]> {
  return resolve(readStations());
}

export async function addStation(name: string): Promise<Station> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Station name is required');
  const list = readStations();
  const existing = list.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return resolve(existing);
  const st: Station = { id: `st-${Date.now().toString(36)}`, name: trimmed };
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

// ---- Audit log --------------------------------------------------------------

const readAudit = (): AuditEvent[] => readJson<AuditEvent[]>(KEYS.audit, []);

function appendAudit(e: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
  const event: AuditEvent = { ...e, id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() };
  writeJson(KEYS.audit, [event, ...readAudit()].slice(0, AUDIT_CAP));
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

const actor = () => {
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

export async function declineEstimate(id: string, reason: string): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.status !== 'sent') throw new Error('Only a sent estimate can be declined');
  if (!reason.trim()) throw new Error('A decline reason is required');
  e.status = 'declined';
  e.declinedAt = new Date().toISOString();
  e.declineReason = reason.trim();
  e.updatedAt = e.declinedAt;
  estStamp(e, `Declined · ${e.declineReason}`);
  return resolve(withRefs(e));
}

// PROVISIONAL: staff records "client said yes". Not a legacy status transition — flagged in the UI.
export async function approveEstimate(id: string): Promise<EstimateWithRefs> {
  const e = getEst(id);
  if (e.status !== 'sent') throw new Error('Only a sent estimate can be approved');
  e.status = 'approved';
  e.approvedAt = new Date().toISOString();
  e.updatedAt = e.approvedAt;
  estStamp(e, 'Approved by client (recorded by staff — provisional status)');
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
  const e = getEst(id);
  estStamp(e, 'Convert to sales order requested — not wired in this session');
  throw new Error('Convert to sales order isn’t wired yet — target arrives in a later session');
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

export async function invoiceJob(id: string): Promise<never> {
  const j = getJobRow(id);
  jobStamp(j, 'Create invoice requested — arrives in the invoicing session');
  throw new Error('Invoicing arrives in the next session (E5) — stub');
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
  const t: Task = { id: newId('t'), title: input.title.trim(), assignedTo: input.assignedTo, createdBy: a.by, jobId: job?.id, watchId: job?.watchId, clientId: job?.clientId, dueAt: input.dueAt || undefined, status: 'open', createdAt: new Date().toISOString(), station: a.station };
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

const HASHTAG = /^#(\w+)\s+/;
// "#vienna order paper" → assignee Vienna; "#manager sign off" → role manager
export const parsePin = (raw: string, fallback: Assignee): { title: string; assignedTo: Assignee } => {
  const m = raw.trim().match(HASHTAG);
  if (!m) return { title: raw.trim(), assignedTo: fallback };
  const tag = m[1].toLowerCase();
  const user = fx.users.find((u) => u.shortName.toLowerCase() === tag || u.firstName.toLowerCase() === tag);
  if (user) return { title: raw.trim(), assignedTo: { type: 'user', shortName: user.shortName } };
  if ((ROLES as string[]).includes(tag)) return { title: raw.trim(), assignedTo: { type: 'role', role: tag as Role } };
  return { title: raw.trim(), assignedTo: fallback };
};

export interface PinInput { title: string; assignedTo?: Assignee; jobId?: string; taskId?: string }

export async function pinToHitList(input: PinInput): Promise<PinnedItem> {
  const a = actor();
  const fallback: Assignee = { type: 'user', shortName: a.by };
  const parsed = parsePin(input.title, input.assignedTo ?? fallback);
  if (!parsed.title) throw new Error('Say what to pin');
  const job = input.jobId ? store.jobs.find((j) => j.id === input.jobId) : undefined;
  const p: PinnedItem = { id: newId('pin'), title: parsed.title, assignedTo: input.assignedTo && !HASHTAG.test(input.title) ? input.assignedTo : parsed.assignedTo, createdBy: a.by, jobId: job?.id, taskId: input.taskId, createdAt: new Date().toISOString(), station: a.station };
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
  const roles = userRoles(me);
  const now = Date.now();
  const rows: TodayRow[] = [];
  const watchOf = (j: Job) => { const w = byId(store.watches, j.watchId); return `${w.brand} ${w.model}`; };
  const clientOf = (id: string) => { const c = byId(fx.clients, id); return `${c.firstName} ${c.lastName}`; };
  const due = (iso?: string) => ({ dueAt: iso, overdue: !!iso && new Date(iso).getTime() < now });

  store.jobs.forEach((j) => {
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
  store.packages.filter((p) => p.status === 'discrepancy_hold').forEach((p) => {
    const mine = roles.includes('concierge') || p.inspectedBy === me.shortName;
    if (mine) rows.push({ id: `disc-${p.id}`, source: 'discrepancy', title: `Resolve discrepancy · ${p.subNumber}`, detail: p.discrepancyReason ?? 'Discrepancy at Receive Watch', via: p.inspectedBy === me.shortName ? 'flagged by me' : 'owner · concierge', packageId: p.id, urgent: true, overdue: false });
  });

  store.tasks.filter((t) => t.status === 'open' && assigneeMatches(t.assignedTo, me)).forEach((t) => {
    const job = t.jobId ? store.jobs.find((j) => j.id === t.jobId) : undefined;
    rows.push({ id: `task-${t.id}`, source: 'task', title: t.title, detail: job ? `${job.number} · ${clientOf(job.clientId)}` : t.clientId ? clientOf(t.clientId) : 'Task', via: t.assignedTo.type === 'role' ? `role · ${t.assignedTo.role}` : 'assigned to me', taskId: t.id, jobId: job?.id, sentBy: t.createdBy !== me.shortName ? t.createdBy : undefined, urgent: false, ...due(t.dueAt) });
  });

  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.urgent) - Number(a.urgent) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const waitingOn = store.tasks.filter((t) => t.status === 'open' && t.createdBy === me.shortName && !assigneeMatches(t.assignedTo, me));
  const pinned = store.pinned.filter((p) => !p.dismissedAt && assigneeMatches(p.assignedTo, me));
  return resolve({ pinned, rows, waitingOn });
}
