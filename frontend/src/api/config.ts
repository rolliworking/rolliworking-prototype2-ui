// E17 — the ONE place the app knows about the real Prototype API. Fake staging data only; no secrets live here or anywhere in this app.
export const API_BASE_URL = 'https://rolligroup-prototype-api.fly.dev';

export type ApiMode = 'hybrid' | 'mock';
const MODE_KEY = 'rollisuite.api.mode';
// 'mock' restores the pre-E17 behaviour entirely (safety line if the API goes down mid-walk). Default: hybrid.
export const API_MODE: ApiMode = (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY) === 'mock') ? 'mock' : 'hybrid';
export const setApiMode = (m: ApiMode) => { localStorage.setItem(MODE_KEY, m); window.location.reload(); };

export type ApiSource = 'real' | 'mock';
// The visible split: every client function the contract covers (inferred — /contract is a stub without maps_to) and where it is served from.
export const API_SOURCE: Record<string, ApiSource> = {
  signInWithPassword: 'real',   // POST /auth/sign-in → fallback POST /auth/switch-user (PIN)
  getEstimates: 'real',         // GET /estimates — realClient ready; UNPARKED 2026-09-27 (Cursor fixed the wire shape) — was: API has no valid_until → list view throws 'Invalid time value' (report §B)
  getEstimate: 'real',          // GET /estimates/:id
  getJobs: 'real',              // GET /jobs — realClient ready; UNPARKED 2026-09-27 (Cursor fixed the wire shape) — was: status vocabulary (awaiting_inspection, complete) not in JobStatus → board lanes crash (report §B)
  getJob: 'real',               // GET /jobs/:id — realClient ready; UNPARKED 2026-09-27 (Cursor fixed the wire shape) — was: no number/watch/timeline/lines on the wire → detail view crashes (report §B)
  getSalesOrders: 'real',       // GET /sales-orders
  getSalesOrder: 'real',        // GET /sales-orders/:id
  getToday: 'real',             // GET /today?user_id=   (hit list; /hit-list is deprecated per D-186)
  resolveIdentifier: 'real',    // GET /search?q=
  getRequests: 'real',          // GET /intake/leads (repointed per /contract)
  getPackages: 'real',          // GET /intake/packages  (404 today — falls back to mock, see report)
  getDashboardStats: 'real',    // derived from /estimates + /jobs + /sales-orders (no KPI endpoint in the contract)
  getRecentActivity: 'real',    // derived from created_at of /jobs + /estimates + /sales-orders
};
