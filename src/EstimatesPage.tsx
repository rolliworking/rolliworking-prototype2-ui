import { useCallback, useEffect, useState } from "react";
import {
  convertEstimateToIntake,
  convertEstimateToSalesOrder,
  createEstimate,
  deleteEstimate,
  getEstimate,
  listEstimates,
  replaceEstimateLines,
  searchCustomersForReceive,
  sendEstimateEmail,
  updateEstimate,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;
type CustomerHit = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

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

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [custQ, setCustQ] = useState("PRACTICE");
  const [custHits, setCustHits] = useState<CustomerHit[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [lineDesc, setLineDesc] = useState("Service");
  const [linePrice, setLinePrice] = useState("250");

  // revise lines on selected estimate
  const [editLines, setEditLines] = useState<{ description: string; quantity: string; unit_price: string }[]>(
    []
  );

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
      setEditLines([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setNotice(null);
      try {
        const row = (await getEstimate(selectedId)) as Row;
        if (!cancelled) {
          setDetail(row);
          const existing = ((row.lines as Row[] | undefined) || []).map((line) => ({
            description: String(line.description || ""),
            quantity: String(line.quantity ?? 1),
            unit_price: String(line.unit_price ?? 0),
          }));
          setEditLines(
            existing.length
              ? existing
              : [{ description: "", quantity: "1", unit_price: "0" }]
          );
        }
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

  async function onSearchCustomers() {
    const term = custQ.trim();
    if (term.length < 2) {
      setError("Customer search needs at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await searchCustomersForReceive({ q: term, limit: 10 });
      setCustHits(((res as { items?: CustomerHit[] }).items || []) as CustomerHit[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    if (!customerId) {
      setError("Pick a customer before saving");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const price = Number(linePrice) || 0;
      const created = (await createEstimate({
        customer_id: customerId,
        new_watch: {
          brand: brand || undefined,
          model: model || undefined,
          serial: serial || undefined,
        },
        lines: lineDesc.trim()
          ? [{ description: lineDesc.trim(), quantity: 1, unit_price: price }]
          : [],
      })) as Row;
      setNotice(`Created E${String(created.estimate_number || "").replace(/^E/i, "")}`);
      setShowCreate(false);
      setBrand("");
      setModel("");
      setSerial("");
      setSelectedId(String(created.id));
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onConvertSo() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      const order = (await convertEstimateToSalesOrder(selectedId, {})) as Row;
      setNotice(`Converted to SO ${String(order.so_number || order.id)}`);
      const row = (await getEstimate(selectedId)) as Row;
      setDetail(row);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onConvertIntake() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      const job = (await convertEstimateToIntake(selectedId)) as Row;
      setNotice(`Converted to intake job ${String(job.id).slice(0, 8)}`);
      const row = (await getEstimate(selectedId)) as Row;
      setDetail(row);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveLines() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const lines = editLines
        .filter((l) => l.description.trim())
        .map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
        }));
      const row = (await replaceEstimateLines(selectedId, { lines })) as Row;
      setDetail(row);
      setNotice(`Lines saved · total ${money(row.total_amount ?? row.subtotal)}`);
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
        E3 list, create, detail, send, decline/reopen, convert to SO or intake. Print / duplicate:
        UNKNOWN — omitted.
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
        <button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Hide create" : "New estimate"}
        </button>
      </div>

      {showCreate ? (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Create estimate</h2>
          <div className="toolbar">
            <label>
              Customer search
              <input value={custQ} onChange={(e) => setCustQ(e.target.value)} />
            </label>
            <button type="button" disabled={busy} onClick={() => void onSearchCustomers()}>
              Find
            </button>
            <label>
              Customer
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">select…</option>
                {custHits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="toolbar">
            <label>
              Brand
              <input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label>
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label>
              Serial
              <input value={serial} onChange={(e) => setSerial(e.target.value)} />
            </label>
          </div>
          <div className="toolbar">
            <label>
              Line description
              <input value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} />
            </label>
            <label>
              Unit price
              <input value={linePrice} onChange={(e) => setLinePrice(e.target.value)} />
            </label>
            <button type="button" disabled={busy || !customerId} onClick={() => void onCreate()}>
              Save draft
            </button>
          </div>
        </div>
      ) : null}

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
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "converted"}
                  onClick={() => void onConvertSo()}
                >
                  Convert → SO
                </button>
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "converted"}
                  onClick={() => void onConvertIntake()}
                >
                  Convert → intake
                </button>
              </div>
              <h2 style={{ marginTop: "1rem" }}>Revise lines</h2>
              {editLines.map((line, idx) => (
                <div className="toolbar" key={idx}>
                  <label>
                    Description
                    <input
                      value={line.description}
                      disabled={String(detail.status) === "converted"}
                      onChange={(e) => {
                        const next = [...editLines];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setEditLines(next);
                      }}
                    />
                  </label>
                  <label>
                    Qty
                    <input
                      value={line.quantity}
                      disabled={String(detail.status) === "converted"}
                      onChange={(e) => {
                        const next = [...editLines];
                        next[idx] = { ...next[idx], quantity: e.target.value };
                        setEditLines(next);
                      }}
                    />
                  </label>
                  <label>
                    Price
                    <input
                      value={line.unit_price}
                      disabled={String(detail.status) === "converted"}
                      onChange={(e) => {
                        const next = [...editLines];
                        next[idx] = { ...next[idx], unit_price: e.target.value };
                        setEditLines(next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="linkish"
                    disabled={busy || String(detail.status) === "converted"}
                    onClick={() => setEditLines(editLines.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="actions">
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "converted"}
                  onClick={() =>
                    setEditLines([
                      ...editLines,
                      { description: "", quantity: "1", unit_price: "0" },
                    ])
                  }
                >
                  Add line
                </button>
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "converted"}
                  onClick={() => void onSaveLines()}
                >
                  Save lines
                </button>
              </div>
              {lines.length === 0 ? (
                <p className="empty">No saved lines yet</p>
              ) : (
                <p className="sub">Saved: {lines.length} line(s)</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
