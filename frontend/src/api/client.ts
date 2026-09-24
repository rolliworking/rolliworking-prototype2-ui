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
  Department,
  Address,
  CatalogService,
  Estimate,
  EstimateLine,
  EstimateRevision,
  EstimateStatus,
  EstimateWithRefs,
  HitListItem,
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
  hitList: fx.hitList.map((i) => ({ ...i })),
  packages: fx.packages.map((p) => ({ ...p, contents: [...p.contents], photos: [...p.photos] })),
  outbox: fx.outbox.map((e) => ({ ...e })),
  labels: fx.labels.map((l) => ({ ...l })),
  watches: fx.watches.map((w) => ({ ...w })),
  estimates: fx.estimates.map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l })), revisions: [] as EstimateRevision[] })),
  counters: { sub: 314, label: 3, estimate: 1058 },
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

// ---- Jobs -------------------------------------------------------------------

const jobRefs = (j: Job): JobWithRefs => ({ ...j, client: byId(fx.clients, j.clientId), watch: byId(store.watches, j.watchId) });

export async function getJobs(): Promise<JobWithRefs[]> {
  return resolve(fx.jobs.map(jobRefs));
}

export async function getJobsForClient(clientId: string): Promise<JobWithRefs[]> {
  return resolve(fx.jobs.filter((j) => j.clientId === clientId).map(jobRefs));
}

// ---- Daily hit list ---------------------------------------------------------

export async function getHitList(): Promise<HitListItem[]> {
  return resolve(store.hitList.map((i) => ({ ...i })));
}

export async function setHitListItemDone(id: string, done: boolean): Promise<HitListItem> {
  const item = byId(store.hitList, id);
  item.done = done;
  return resolve({ ...item });
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
const ACTIVE_JOB: Job['status'][] = ['queued', 'in_progress', 'awaiting_parts', 'qc'];

export async function getDashboardStats(): Promise<DashboardStats> {
  const completedThisMonth = fx.jobs.filter((j) => isThisMonth(j.completedAt));
  return resolve({
    watchesInHouse: store.watches.filter((w) => w.status !== 'released' && w.status !== 'expected').length,
    openEstimates: store.estimates.filter((e) => OPEN_ESTIMATE.includes(e.status)).length,
    awaitingApproval: store.estimates.filter((e) => e.status === 'sent').length,
    inProgress: fx.jobs.filter((j) => ACTIVE_JOB.includes(j.status)).length,
    awaitingPickup: fx.jobs.filter((j) => j.status === 'awaiting_pickup').length,
    revenueThisMonth: completedThisMonth.reduce((t, j) => t + j.total, 0),
    departments: DEPARTMENTS.map((d) => ({
      ...d,
      mtdRevenue: completedThisMonth.filter((j) => j.department === d.key).reduce((t, j) => t + j.total, 0),
      jobCount: fx.jobs.filter((j) => j.department === d.key).length,
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
  const jobs = fx.jobs.filter((j) => j.watchId === watch.id);
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

export async function convertEstimate(id: string, target: 'job' | 'sales_order' | 'intake'): Promise<never> {
  const e = getEst(id);
  estStamp(e, `Convert to ${target} requested — not wired in this session`);
  throw new Error(`Convert to ${target.replace('_', ' ')} isn’t wired yet — target arrives in a later session`);
}

export interface ShippingCalcInput { units: number; hiAk: boolean; saturday: boolean }
// Display-only legacy calculator (UNKNOWN whether it persists) — never written on save
export function calcShipping(i: ShippingCalcInput) {
  const overnight = i.units > 25;
  const amount = 35 + (overnight ? 25 : 0) + i.units * 1.5 + (i.hiAk ? 30 : 0) + (i.saturday ? 20 : 0);
  return { amount, overnight, insuredValue: i.units * 1000 };
}
