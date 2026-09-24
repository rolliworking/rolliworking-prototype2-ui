/**
 * Typed Contract v1 client for Phase A prototype-api (D-183).
 * OperationIds match documentation/api/CONTRACT-v1.yaml.
 * Base URL defaults to local prototype-api; override with VITE_PROTOTYPE_API_BASE.
 */

export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type ApiErrorBody = {
  message?: string;
  code?: string;
};

export class PrototypeApiError extends Error {
  status: number;
  code?: string;
  body?: ApiErrorBody;

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.message || `HTTP ${status}`);
    this.name = "PrototypeApiError";
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

export type ClientOptions = {
  baseUrl?: string;
  sessionToken?: string | null;
  deviceId?: string | null;
  fetchImpl?: typeof fetch;
};

function envBase(): string | undefined {
  return import.meta.env?.VITE_PROTOTYPE_API_BASE;
}

const DEFAULT_BASE = envBase() || "http://127.0.0.1:8787";

function resolveBase(opts?: ClientOptions): string {
  return (opts?.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
}

function sessionDefaults(): { sessionToken?: string; deviceId?: string } {
  try {
    const token = localStorage.getItem("prototype.session_token") || undefined;
    const deviceId = localStorage.getItem("prototype.device_id") || undefined;
    return {
      sessionToken: token && token !== "pin-switch" ? token : undefined,
      deviceId,
    };
  } catch {
    return {};
  }
}

async function request<T>(
  method: string,
  path: string,
  opts?: ClientOptions & { query?: Record<string, string | number | undefined | null>; body?: unknown }
): Promise<T> {
  const defaults = sessionDefaults();
  const sessionToken = opts?.sessionToken !== undefined ? opts.sessionToken : defaults.sessionToken;
  const deviceId = opts?.deviceId !== undefined ? opts.deviceId : defaults.deviceId;

  const url = new URL(resolveBase(opts) + path);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (opts?.body !== undefined) headers["content-type"] = "application/json";
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  if (deviceId) headers["x-device-id"] = deviceId;

  const fetchImpl = opts?.fetchImpl || fetch;
  const res = await fetchImpl(url, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!res.ok) {
    throw new PrototypeApiError(res.status, (parsed as ApiErrorBody) || undefined);
  }
  return parsed as T;
}

// --- auth (D-181) ---

export function signInWithPassword(
  body: { username: string; password: string; device_id: string; snapshot_ref?: string | null },
  opts?: ClientOptions
) {
  return request<Json>("POST", "/auth/sign-in", { ...opts, body });
}

export function switchUserWithPin(
  body: { pin: string; device_id: string },
  opts?: ClientOptions
) {
  return request<Json>("POST", "/auth/switch-user", { ...opts, body });
}

// --- hit list ---

export function getHitList(
  query: { date?: string; technician?: string } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/hit-list", { ...opts, query });
}

export function setHitListItemDone(itemId: string, opts?: ClientOptions) {
  return request<Json>("POST", `/hit-list/${encodeURIComponent(itemId)}/done`, { ...opts, body: {} });
}

// --- search ---

export function search(q: string, opts?: ClientOptions) {
  return request<Json>("GET", "/search", { ...opts, query: { q } });
}

// --- estimates ---

export function listEstimates(
  query: { status?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/estimates", { ...opts, query });
}

export function createEstimate(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/estimates", { ...opts, body });
}

export function getEstimate(estimateId: string, opts?: ClientOptions) {
  return request<Json>("GET", `/estimates/${encodeURIComponent(estimateId)}`, opts);
}

export function updateEstimate(estimateId: string, body: Json, opts?: ClientOptions) {
  return request<Json>("PATCH", `/estimates/${encodeURIComponent(estimateId)}`, { ...opts, body });
}

export function deleteEstimate(estimateId: string, opts?: ClientOptions) {
  return request<Json>("DELETE", `/estimates/${encodeURIComponent(estimateId)}`, opts);
}

export function replaceEstimateLines(
  estimateId: string,
  body: { lines: Json[] },
  opts?: ClientOptions
) {
  return request<Json>("PUT", `/estimates/${encodeURIComponent(estimateId)}/lines`, {
    ...opts,
    body,
  });
}

export function sendEstimateEmail(
  estimateId: string,
  body: { to?: string; context?: string } = {},
  opts?: ClientOptions
) {
  return request<Json>("POST", `/estimates/${encodeURIComponent(estimateId)}/send-email`, {
    ...opts,
    body,
  });
}

export function convertEstimateToSalesOrder(
  estimateId: string,
  body: Json = {},
  opts?: ClientOptions
) {
  return request<Json>(
    "POST",
    `/estimates/${encodeURIComponent(estimateId)}/convert-to-sales-order`,
    { ...opts, body }
  );
}

export function convertEstimateToIntake(estimateId: string, opts?: ClientOptions) {
  return request<Json>(
    "POST",
    `/estimates/${encodeURIComponent(estimateId)}/convert-to-intake`,
    { ...opts, body: {} }
  );
}

// --- sales orders / fulfill / pickup / ship ---

export function listSalesOrders(
  query: { status?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/sales-orders", { ...opts, query });
}

export function createSalesOrder(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/sales-orders", { ...opts, body });
}

export function getSalesOrder(salesOrderId: string, opts?: ClientOptions) {
  return request<Json>("GET", `/sales-orders/${encodeURIComponent(salesOrderId)}`, opts);
}

export function updateSalesOrder(salesOrderId: string, body: Json, opts?: ClientOptions) {
  return request<Json>("PATCH", `/sales-orders/${encodeURIComponent(salesOrderId)}`, {
    ...opts,
    body,
  });
}

export function fulfillSalesOrder(salesOrderId: string, body: Json = {}, opts?: ClientOptions) {
  return request<Json>("POST", `/sales-orders/${encodeURIComponent(salesOrderId)}/fulfill`, {
    ...opts,
    body,
  });
}

export function getSalesOrderInvoiceStatus(salesOrderId: string, opts?: ClientOptions) {
  return request<Json>(
    "GET",
    `/sales-orders/${encodeURIComponent(salesOrderId)}/invoice-status`,
    opts
  );
}

export function lookupPickupQueue(
  query: { so_number?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/pickup/queue", { ...opts, query });
}

export function completePickup(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/pickup/complete", { ...opts, body });
}

export function generatePickupCode(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/pickup/codes", { ...opts, body });
}

export function lookupShipQueue(
  query: { so_number?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/ship/queue", { ...opts, query });
}

export function confirmShipment(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/ship/confirm", { ...opts, body });
}

export function createShipment(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/shipping/shipments", { ...opts, body });
}

// --- jobs / shop time ---

export function listJobs(
  query: { status?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/jobs", { ...opts, query });
}

export function getJob(jobId: string, opts?: ClientOptions) {
  return request<Json>("GET", `/jobs/${encodeURIComponent(jobId)}`, opts);
}

export function createJob(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/jobs", { ...opts, body });
}

export function updateJobStatus(jobId: string, body: { status: string } & Json, opts?: ClientOptions) {
  return request<Json>("POST", `/jobs/${encodeURIComponent(jobId)}/status`, { ...opts, body });
}

export function listShopTimeEntries(
  query: { job_id?: string; technician?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/shop-time", { ...opts, query });
}

export function createShopTimeEntry(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/shop-time", { ...opts, body });
}

export function completeShopTimeEntry(
  entryId: string,
  body: { ended_at?: string; notes?: string } = {},
  opts?: ClientOptions
) {
  return request<Json>("POST", `/shop-time/${encodeURIComponent(entryId)}/complete`, {
    ...opts,
    body,
  });
}

export function listOnHandJobsForShopTime(query: { limit?: number } = {}, opts?: ClientOptions) {
  return request<Json>("GET", "/jobs/shop-time/on-hand-jobs", { ...opts, query });
}

// --- intake packages / receive ---

export function listPackageArrivalScans(
  query: { status?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/intake/packages", { ...opts, query });
}

export function createPackageArrivalScan(body: Json, opts?: ClientOptions) {
  return request<Json>("POST", "/intake/packages", { ...opts, body });
}

export function matchPackageArrival(scanId: string, body: Json = {}, opts?: ClientOptions) {
  return request<Json>("POST", `/intake/packages/${encodeURIComponent(scanId)}/match`, {
    ...opts,
    body,
  });
}

export function updatePackageArrivalOutcome(scanId: string, body: Json, opts?: ClientOptions) {
  return request<Json>("POST", `/intake/packages/${encodeURIComponent(scanId)}/outcome`, {
    ...opts,
    body,
  });
}

export function recordPackageDropOff(body: { estimate_id: string } & Json, opts?: ClientOptions) {
  return request<Json>("POST", "/intake/packages/drop-off", { ...opts, body });
}

export function lookupEstimateForReceive(
  query: { estimate_number?: string; tracking_number?: string } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/intake/packages/lookups/estimates", { ...opts, query });
}

export function listShippingLabelsForReceive(query: { limit?: number } = {}, opts?: ClientOptions) {
  return request<Json>("GET", "/intake/packages/lookups/shipping-labels", { ...opts, query });
}

export function searchCustomersForReceive(query: { q: string; limit?: number }, opts?: ClientOptions) {
  return request<Json>("GET", "/intake/packages/lookups/customers", { ...opts, query });
}

export function listClientWatches(
  query: { is_in_inventory?: boolean | "all"; limit?: number } = {},
  opts?: ClientOptions
) {
  const { is_in_inventory, limit } = query;
  const q: Record<string, string | number | null | undefined> = { limit };
  if (is_in_inventory === "all") q.is_in_inventory = "all";
  else if (typeof is_in_inventory === "boolean") q.is_in_inventory = is_in_inventory ? "true" : "false";
  return request<Json>("GET", "/intake/watches", { ...opts, query: q });
}

export function getReceiveWatchPrefill(
  query: { estimate_id?: string; estimate_number?: string },
  opts?: ClientOptions
) {
  return request<Json>("GET", "/intake/watches/prefill", { ...opts, query });
}

export function receiveWatch(body: { customer_id: string } & Json, opts?: ClientOptions) {
  return request<Json>("POST", "/intake/watches", { ...opts, body });
}

export function markWatchLabelPrinted(propertyId: string, opts?: ClientOptions) {
  return request<Json>(
    "POST",
    `/intake/watches/${encodeURIComponent(propertyId)}/label-printed`,
    { ...opts, body: {} }
  );
}

export function voidReceivedWatch(propertyId: string, opts?: ClientOptions) {
  return request<void>("DELETE", `/intake/watches/${encodeURIComponent(propertyId)}`, opts);
}

// --- intake leads ---

export function listIntakeLeads(
  query: { status?: string; q?: string; limit?: number } = {},
  opts?: ClientOptions
) {
  return request<Json>("GET", "/intake/leads", { ...opts, query });
}

export function updateIntakeLead(leadId: string, body: Json, opts?: ClientOptions) {
  return request<Json>("PATCH", `/intake/leads/${encodeURIComponent(leadId)}`, { ...opts, body });
}

export function deleteIntakeLeads(body: { ids: string[] }, opts?: ClientOptions) {
  return request<Json>("DELETE", "/intake/leads", { ...opts, body });
}

export function sendLeadFollowup(leadId: string, body: Json = {}, opts?: ClientOptions) {
  return request<Json>("POST", `/intake/leads/${encodeURIComponent(leadId)}/followup`, {
    ...opts,
    body,
  });
}

// --- roles ---

export function listRolePermissions(query: { role?: string } = {}, opts?: ClientOptions) {
  return request<Json>("GET", "/roles/permissions", { ...opts, query });
}

export function saveRolePermission(body: Json, opts?: ClientOptions) {
  return request<Json>("PUT", "/roles/permissions", { ...opts, body });
}
