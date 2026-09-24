import { useCallback, useEffect, useState } from "react";
import {
  deleteEstimate,
  getEstimate,
  listEstimates,
  sendEstimateEmail,
  updateEstimate,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;

const STATUSES = ["", "draft", "sent", "converted", "expired", "declined"] as const;

function money(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function customerLabel(row: Row) {
  const c = row.customer as
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | null
    | undefined;
  if (!c) return "—";
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.email || "—";
}

function statusLabel(status: unknown) {
  const s = String(status || "");
  if (s === "converted") return "Closed";
  return s || "—";
}

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

export function EstimatesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEstimates({
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
      setDetailLoading(true);
      setNotice(null);
      try {
        const row = (await getEstimate(selectedId)) as Row;
        if (!cancelled) setDetail(row);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setError(errMsg(e));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function onDelete(id: string, number: string) {
    if (!window.confirm(`Delete estimate ${number || id}? This cannot be undone.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteEstimate(id);
      if (selectedId === id) setSelectedId(null);
      setNotice(`Deleted ${number || id}`);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onMarkSent() {
    if (!selectedId || !detail) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateEstimate(selectedId, { status: "sent" });
      const email = (detail.customer as { email?: string } | null)?.email;
      if (email) {
        const out = (await sendEstimateEmail(selectedId, {
          to: email,
          context: "estimate_review",
        })) as { outbox_id?: string };
        setNotice(`Marked sent · outbox ${out.outbox_id || "(queued)"} — no real mail`);
      } else {
        setNotice("Marked sent · no customer email for outbox");
      }
      const row = (await getEstimate(selectedId)) as Row;
      setDetail(row);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateEstimate(selectedId, { status: "declined" });
      setNotice("Status set to declined");
      const row = (await getEstimate(selectedId)) as Row;
      setDetail(row);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReopen() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateEstimate(selectedId, { status: "draft" });
      setNotice("Reopened as draft");
      const row = (await getEstimate(selectedId)) as Row;
      setDetail(row);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const lines = ((detail?.lines as Row[] | undefined) || []) as Row[];

  return (
    <>
      <h1>Estimates</h1>
      <p className="sub">
        E3 list + detail against prototype-api. Convert-to-invoice / print / duplicate: not wired
        (UNKNOWN — simplest omit).
      </p>

      <div className="toolbar">
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="number, customer, watch…"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">all</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s === "converted" ? "closed (converted)" : s}
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
            <p className="empty">No estimates</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Watch</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = String(row.id);
                  const num = String(row.estimate_number || id.slice(0, 8));
                  return (
                    <tr
                      key={id}
                      className={selectedId === id ? "selected" : undefined}
                      onClick={() => setSelectedId(id)}
                    >
                      <td>E{num.replace(/^E/i, "")}</td>
                      <td>{customerLabel(row)}</td>
                      <td>
                        {[row.watch_brand, row.watch_model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td>{statusLabel(row.status)}</td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDelete(id, num);
                          }}
                        >
                          Delete
                        </button>
                      </td>
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
            <p className="empty">Select a row</p>
          ) : detailLoading ? (
            <p className="empty">Loading detail…</p>
          ) : !detail ? (
            <p className="empty">Not found</p>
          ) : (
            <>
              <p>
                <strong>E{String(detail.estimate_number || "").replace(/^E/i, "")}</strong> ·{" "}
                {statusLabel(detail.status)} · total {money(detail.total_amount ?? detail.subtotal)}
              </p>
              <p className="sub" style={{ marginBottom: "0.75rem" }}>
                {customerLabel(detail)}
                {detail.watch_brand || detail.watch_model
                  ? ` · ${[detail.watch_brand, detail.watch_model].filter(Boolean).join(" ")}`
                  : ""}
              </p>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "converted"}
                  onClick={() => void onMarkSent()}
                >
                  Send (outbox)
                </button>
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "declined"}
                  onClick={() => void onDecline()}
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "draft"}
                  onClick={() => void onReopen()}
                >
                  Reopen
                </button>
              </div>
              {lines.length === 0 ? (
                <p className="empty">No lines</p>
              ) : (
                <ul>
                  {lines.map((line) => (
                    <li key={String(line.id)}>
                      <span>{String(line.description || "Line")}</span>
                      <span>
                        {Number(line.quantity) || 1} × {money(line.unit_price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
