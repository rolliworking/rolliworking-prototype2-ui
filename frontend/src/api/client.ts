// The ONLY data-access module in the app. Screens call these functions and nothing else.
// Today they resolve from local fixtures; later this file alone is repointed at the real API.
import * as fx from './fixtures';
import type {
  ActivityEvent,
  Client,
  DashboardStats,
  Department,
  Estimate,
  EstimateWithRefs,
  HitListItem,
  Job,
  JobWithRefs,
  User,
  Watch,
} from './types';

export * from './types';

const LATENCY_MS = 120;
const SESSION_KEY = 'rollisuite.prototype.currentUserId';

const resolve = <T>(value: T): Promise<T> =>
  new Promise((r) => setTimeout(() => r(value), LATENCY_MS));

// mutable in-memory copies so "writes" work within a session
const store = {
  hitList: fx.hitList.map((i) => ({ ...i })),
};

const byId = <T extends { id: string }>(rows: T[], id: string): T => {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`Fixture row not found: ${id}`);
  return row;
};

const withRefs = <T extends { clientId: string; watchId: string }>(row: T) => ({
  ...row,
  client: byId(fx.clients, row.clientId),
  watch: byId(fx.watches, row.watchId),
});

const isThisMonth = (iso?: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

// ---- Auth / users -----------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  return resolve(fx.users);
}

export async function getCurrentUser(): Promise<User | null> {
  const id = localStorage.getItem(SESSION_KEY);
  return resolve(id ? fx.users.find((u) => u.id === id) ?? null : null);
}

export async function signInWithBadge(badgeCode: string): Promise<User> {
  const code = badgeCode.trim().toLowerCase();
  const user = fx.users.find((u) => u.badgeCode === code);
  if (!user) throw new Error('Badge not recognized');
  localStorage.setItem(SESSION_KEY, user.id);
  return resolve(user);
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
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
  return resolve(fx.watches);
}

export async function getWatchesForClient(clientId: string): Promise<Watch[]> {
  return resolve(fx.watches.filter((w) => w.clientId === clientId));
}

// ---- Estimates --------------------------------------------------------------

export async function getEstimates(): Promise<EstimateWithRefs[]> {
  return resolve(fx.estimates.map(withRefs));
}

export async function getEstimatesForClient(clientId: string): Promise<EstimateWithRefs[]> {
  return resolve(fx.estimates.filter((e) => e.clientId === clientId).map(withRefs));
}

// ---- Jobs -------------------------------------------------------------------

export async function getJobs(): Promise<JobWithRefs[]> {
  return resolve(fx.jobs.map(withRefs));
}

export async function getJobsForClient(clientId: string): Promise<JobWithRefs[]> {
  return resolve(fx.jobs.filter((j) => j.clientId === clientId).map(withRefs));
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

const OPEN_ESTIMATE: Estimate['status'][] = ['draft', 'sent', 'awaiting_approval'];
const ACTIVE_JOB: Job['status'][] = ['queued', 'in_progress', 'awaiting_parts', 'qc'];

export async function getDashboardStats(): Promise<DashboardStats> {
  const completedThisMonth = fx.jobs.filter((j) => isThisMonth(j.completedAt));
  return resolve({
    watchesInHouse: fx.watches.filter((w) => w.status !== 'released').length,
    openEstimates: fx.estimates.filter((e) => OPEN_ESTIMATE.includes(e.status)).length,
    awaitingApproval: fx.estimates.filter((e) => e.status === 'awaiting_approval').length,
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
