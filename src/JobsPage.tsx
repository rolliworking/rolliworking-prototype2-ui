import { useCallback, useEffect, useState } from "react";
import {
  createJob,
  getJob,
  listEstimates,
  listJobs,
  search,
  searchCustomersForReceive,
  updateJobStatus,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;

const STATUSES = [
  "",
  "intake",
  "awaiting_inspection",
  "in_review",
  "in_service",
  "testing",
  "ready_to_ship",
  "closed",
];

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

export function JobsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [globalQ, setGlobalQ] = useState("");
  const [globalHits, setGlobalHits] = useState<Row | null>(null);

  const [newStatus, setNewStatus] = useState("intake");
  const [createCustomerId, setCreateCustomerId] = useState("");
  const [custQ, setCustQ] = useState("PRACTICE");
  const [custHits, setCustHits] = useState<Row[]>([]);
  const [createEstimateId, setCreateEstimateId] = useState("");
  const [customerEstimates, setCustomerEstimates] = useState<Row[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listJobs({
        q: q.trim() || undefined,
        status: status || undefined,
        limit: 50,
      });
      setItems(((res as { items?: Row[] }).items || []) as Row[]);
    } catch (e) {
      setError(errMsg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = (await getJob(selectedId)) as Row;
        if (!cancelled) {
          setDetail(row);
          setNewStatus(String(row.status || "intake"));
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!createCustomerId) {
      setCustomerEstimates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await listEstimates({ customer_id: createCustomerId, limit: 20 });
        if (cancelled) return;
        const items = ((res as { items?: Row[] }).items || []) as Row[];
        setCustomerEstimates(items);
        if (!createEstimateId && items[0]?.id) {
          setCreateEstimateId(String(items[0].id));
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createCustomerId]);

  async function onGlobalSearch() {
    if (globalQ.trim().length < 2) {
      setError("Search needs at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = (await search(globalQ.trim())) as Row;
      setGlobalHits(res);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFindCustomer() {
    setBusy(true);
    try {
      const res = await searchCustomersForReceive({ q: custQ.trim(), limit: 10 });
      setCustHits(((res as { items?: Row[] }).items || []) as Row[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    if (!createEstimateId.trim()) {
      setError("Pick a customer estimate to link the job (rebuild jobs have no customer_id column)");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const job = (await createJob({
        status: "intake",
        workflow_type_committed: "STANDARD",
        estimate_id: createEstimateId.trim(),
      })) as Row;
      setNotice(`Created job ${String(job.id).slice(0, 8)} linked to estimate`);
      setSelectedId(String(job.id));
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStatus() {
    if (!selectedId || !newStatus) return;
    setBusy(true);
    setNotice(null);
    try {
      const job = (await updateJobStatus(selectedId, { status: newStatus })) as Row;
      setDetail(job);
      setNotice(`Status → ${String(job.status)}`);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const clients = ((globalHits?.clients as Row[] | undefined) || []) as Row[];
  const estimates = ((globalHits?.estimates as Row[] | undefined) || []) as Row[];
  const jobsHit = ((globalHits?.jobs as Row[] | undefined) || []) as Row[];
  const watches = ((globalHits?.watches as Row[] | undefined) || []) as Row[];

  return (
    <>
      <h1>Jobs</h1>
      <p className="sub">
        Workshop jobs list + status. Create Job page was unbound in legacy — prototype create is estimate-linked
        when an estimate id is supplied. Global search sits here for cross-table lookup.
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Global search</h2>
        <div className="toolbar">
          <label>
            Query
            <input value={globalQ} onChange={(e) => setGlobalQ(e.target.value)} placeholder="min 2 chars" />
          </label>
          <button type="button" disabled={busy} onClick={() => void onGlobalSearch()}>
            Search
          </button>
        </div>
        {globalHits ? (
          <div className="panels">
            <section className="panel">
              <h2>Clients ({clients.length})</h2>
              {clients.length === 0 ? (
                <p className="empty">None</p>
              ) : (
                <ul>
                  {clients.slice(0, 5).map((c) => (
                    <li key={String(c.id)}>
                      <span>{String(c.full_name || c.name || c.id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h2>Estimates ({estimates.length})</h2>
              {estimates.length === 0 ? (
                <p className="empty">None</p>
              ) : (
                <ul>
                  {estimates.slice(0, 5).map((e) => (
                    <li key={String(e.id)}>
                      <span>{String(e.estimate_number || e.id)}</span>
                      <span>{String(e.status || "")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h2>Jobs ({jobsHit.length})</h2>
              {jobsHit.length === 0 ? (
                <p className="empty">None</p>
              ) : (
                <ul>
                  {jobsHit.slice(0, 5).map((j) => (
                    <li key={String(j.id)}>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => setSelectedId(String(j.id))}
                      >
                        {String(j.id).slice(0, 8)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h2>Watches ({watches.length})</h2>
              {watches.length === 0 ? (
                <p className="empty">None</p>
              ) : (
                <ul>
                  {watches.slice(0, 5).map((w) => (
                    <li key={String(w.id)}>
                      <span>
                        {[w.brand, w.model].filter(Boolean).join(" ") || String(w.id)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Create job</h2>
        <div className="toolbar">
          <label>
            Customer search (optional context)
            <input value={custQ} onChange={(e) => setCustQ(e.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => void onFindCustomer()}>
            Find
          </button>
          <label>
            Customer
            <select
              value={createCustomerId}
              onChange={(e) => {
                setCreateCustomerId(e.target.value);
                setCreateEstimateId("");
              }}
            >
              <option value="">—</option>
              {custHits.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || String(c.email || c.id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estimate (required link)
            <select
              value={createEstimateId}
              onChange={(e) => setCreateEstimateId(e.target.value)}
            >
              <option value="">—</option>
              {customerEstimates.map((est) => (
                <option key={String(est.id)} value={String(est.id)}>
                  {String(est.estimate_number || est.id)} · {String(est.status || "")}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy || !createEstimateId} onClick={() => void onCreate()}>
            Create
          </button>
        </div>
        <p className="sub">
          Rebuild jobs have no customer_id — pick a customer, then an estimate for that customer. The
          job links via estimate_id.
        </p>
      </div>

      <div className="toolbar">
        <label>
          Filter
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="estimate # / name" />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">all</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="banner">{notice}</div> : null}

      <div className="split">
        <div className="panel table-wrap">
          {loading ? (
            <p className="empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="empty">No jobs</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Estimate</th>
                  <th>Customer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = String(row.id);
                  return (
                    <tr
                      key={id}
                      className={selectedId === id ? "selected" : undefined}
                      onClick={() => setSelectedId(id)}
                    >
                      <td>{id.slice(0, 8)}</td>
                      <td>{String(row.estimate_number || "—")}</td>
                      <td>{String(row.customer_name || "—")}</td>
                      <td>{String(row.status || "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Detail</h2>
          {!selectedId ? (
            <p className="empty">Select a job</p>
          ) : !detail ? (
            <p className="empty">Loading…</p>
          ) : (
            <>
              <p>
                <strong>{String(detail.id).slice(0, 8)}</strong> · {String(detail.status)}
              </p>
              <p className="sub">
                Estimate {String(detail.estimate_number || "—")} ·{" "}
                {String(detail.customer_name || "—")} · workflow{" "}
                {String(detail.workflow_type_committed || detail.workflow_type_suggested || "—")}
              </p>
              <div className="toolbar">
                <label>
                  New status
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    {STATUSES.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={() => void onStatus()}>
                  Update status
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
