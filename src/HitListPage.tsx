import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getHitList,
  listPackageArrivalScans,
  listSalesOrders,
  listShippingLabelsForReceive,
  setHitListItemDone,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;

const CATEGORY_ORDER = [
  "overdue",
  "due_today",
  "due_this_week",
  "parts_pending",
  "attention",
  "completed_today",
] as const;

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

function sortItems(items: Row[]) {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_RANK[String(a.priority || "normal")] ?? 9;
    const pb = PRIORITY_RANK[String(b.priority || "normal")] ?? 9;
    if (pa !== pb) return pa - pb;
    const oa = Number(a.days_overdue ?? a.days_waiting ?? 0);
    const ob = Number(b.days_overdue ?? b.days_waiting ?? 0);
    return ob - oa;
  });
}

export function HitListPage() {
  const [date, setDate] = useState(todayIso());
  const [technician, setTechnician] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [resolvedDate, setResolvedDate] = useState(date);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unpaid, setUnpaid] = useState<Row[]>([]);
  const [pendingPkgs, setPendingPkgs] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Row[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tech = technician.trim() || undefined;
      const tryDates = [date, addDays(date, 1)];
      let loaded: Row[] = [];
      let used = date;

      for (const d of tryDates) {
        const res = await getHitList({ date: d, technician: tech });
        const rows = ((res as { items?: Row[] }).items || []) as Row[];
        if (rows.length > 0 || d === date) {
          loaded = rows;
          used = d;
          if (rows.length > 0) break;
        }
      }

      // If today+tomorrow empty, still show today's empty; side lists load anyway
      setItems(loaded);
      setResolvedDate(used);

      const [sos, pkgs, labs] = await Promise.all([
        listSalesOrders({ limit: 20 }),
        listPackageArrivalScans({ status: "pending", limit: 10 }),
        listShippingLabelsForReceive({ limit: 10 }),
      ]);

      const soItems = ((sos as { items?: Row[] }).items || []) as Row[];
      setUnpaid(
        soItems
          .filter((r) => r.is_paid !== true && !["cancelled", "picked_up", "shipped"].includes(String(r.status)))
          .slice(0, 5)
      );
      setPendingPkgs(((pkgs as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
      setLabels(((labs as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
    } catch (e) {
      setError(errMsg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date, technician]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const row of items) {
      const cat = String(row.category || "attention");
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    for (const [k, list] of map) map.set(k, sortItems(list));
    return map;
  }, [items]);

  const technicians = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      if (row.technician) set.add(String(row.technician));
    }
    return [...set].sort();
  }, [items]);

  async function onDone(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await setHitListItemDone(id);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1>Daily hit list</h1>
      <p className="sub">
        Workshop day board from rebuild seed rows. Dismiss hides the row. Owner id UNKNOWN — technician
        filter only.
      </p>

      <div className="toolbar">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Technician
          <input
            list="tech-options"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            placeholder="all (blank)"
          />
          <datalist id="tech-options">
            {["michael", "mm", "vienna", "walter", ...technicians].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          Refresh
        </button>
      </div>

      {resolvedDate !== date ? (
        <div className="banner">
          No open rows for {date}; showing {resolvedDate}.
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="split">
        <div>
          {loading ? (
            <p className="empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="empty">No open hit-list items for this date</p>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const rows = grouped.get(cat) || [];
              if (rows.length === 0) return null;
              return (
                <section className="panel" key={cat} style={{ marginBottom: "0.75rem" }}>
                  <h2>{cat.replace(/_/g, " ")}</h2>
                  <ul>
                    {rows.map((row) => (
                      <li key={String(row.id)}>
                        <span>
                          <strong>{String(row.estimate_number || "—")}</strong>
                          {row.customer_name ? ` · ${String(row.customer_name)}` : ""}
                          <br />
                          <span className="sub" style={{ margin: 0 }}>
                            {String(row.description || row.status || "")}
                            {row.technician ? ` · ${String(row.technician)}` : ""}
                            {row.priority ? ` · ${String(row.priority)}` : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="linkish"
                          disabled={busyId === String(row.id)}
                          onClick={() => void onDone(String(row.id))}
                        >
                          Done
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <div>
          <section className="panel" style={{ marginBottom: "0.75rem" }}>
            <h2>Unpaid sales orders</h2>
            {unpaid.length === 0 ? (
              <p className="empty">None in recent window</p>
            ) : (
              <ul>
                {unpaid.map((row) => (
                  <li key={String(row.id)}>
                    <span>{String(row.so_number || row.id)}</span>
                    <span>{String(row.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel" style={{ marginBottom: "0.75rem" }}>
            <h2>Unreceived packages</h2>
            {pendingPkgs.length === 0 ? (
              <p className="empty">No pending scans</p>
            ) : (
              <ul>
                {pendingPkgs.map((row) => (
                  <li key={String(row.id)}>
                    <span>{String(row.tracking_number || row.carrier || row.id)}</span>
                    <span>{String(row.receive_status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h2>Shipping labels</h2>
            {labels.length === 0 ? (
              <p className="empty">No labels with tracking</p>
            ) : (
              <ul>
                {labels.map((row) => (
                  <li key={String(row.id)}>
                    <span>{String(row.tracking_number)}</span>
                    <span>
                      {(row.estimate as { estimate_number?: string } | null)?.estimate_number || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
