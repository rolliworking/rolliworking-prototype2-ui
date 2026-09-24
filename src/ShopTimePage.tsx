import { useCallback, useEffect, useState } from "react";
import {
  completeShopTimeEntry,
  createShopTimeEntry,
  listOnHandJobsForShopTime,
  listShopTimeEntries,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

function fmtWhen(v: unknown) {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export function ShopTimePage() {
  const [entries, setEntries] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [technician, setTechnician] = useState("michael");
  const [filterTech, setFilterTech] = useState("");
  const [jobId, setJobId] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, onHand] = await Promise.all([
        listShopTimeEntries({
          technician: filterTech.trim() || undefined,
          limit: 50,
        }),
        listOnHandJobsForShopTime({ limit: 50 }),
      ]);
      setEntries(((list as { items?: Row[] }).items || []) as Row[]);
      setJobs(((onHand as { items?: Row[] }).items || []) as Row[]);
    } catch (e) {
      setError(errMsg(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterTech]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreateManual() {
    if (!technician.trim()) {
      setError("technician is required");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const mins = Number(minutes) || 0;
      const ended = new Date();
      const started = new Date(ended.getTime() - mins * 60000);
      const job = jobs.find((j) => String(j.id) === jobId);
      const entry = (await createShopTimeEntry({
        technician: technician.trim(),
        job_id: jobId || undefined,
        estimate_number: job?.estimate_number ? String(job.estimate_number) : undefined,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
        minutes: mins,
        notes: notes || undefined,
      })) as Row;
      setNotice(`Logged ${entry.minutes ?? mins} min for ${technician}`);
      setNotes("");
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStartOpen() {
    if (!technician.trim()) {
      setError("technician is required");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const job = jobs.find((j) => String(j.id) === jobId);
      const entry = (await createShopTimeEntry({
        technician: technician.trim(),
        job_id: jobId || undefined,
        estimate_number: job?.estimate_number ? String(job.estimate_number) : undefined,
        started_at: new Date().toISOString(),
        notes: notes || "timer start",
      })) as Row;
      setNotice(`Timer started · ${String(entry.id).slice(0, 8)}`);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStop(entryId: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const entry = (await completeShopTimeEntry(entryId, {
        notes: notes.trim() || undefined,
      })) as Row;
      setNotice(`Timer stopped · ${entry.minutes ?? "?"} min`);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Shop time</h1>
      <p className="sub">
        Time entries against on-hand jobs. Writes shop_time rows only — does not change job status.
        Open timers stop via completeShopTimeEntry (ended_at + minutes).
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Log time</h2>
        <div className="toolbar">
          <label>
            Technician
            <input value={technician} onChange={(e) => setTechnician(e.target.value)} />
          </label>
          <label>
            On-hand job
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">none</option>
              {jobs.map((j) => (
                <option key={String(j.id)} value={String(j.id)}>
                  {String(j.estimate_number || j.id).slice(0, 12)} · {String(j.status || "")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minutes
            <input value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
          <label>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => void onCreateManual()}>
            Save completed entry
          </button>
          <button type="button" disabled={busy} onClick={() => void onStartOpen()}>
            Start open timer
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label>
          Filter technician
          <input
            value={filterTech}
            onChange={(e) => setFilterTech(e.target.value)}
            placeholder="all"
          />
        </label>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="banner">{notice}</div> : null}

      <div className="panel table-wrap">
        {loading ? (
          <p className="empty">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="empty">No shop-time entries</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Estimate</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Min</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.technician || "—")}</td>
                  <td>{String(row.estimate_number || "—")}</td>
                  <td>{fmtWhen(row.started_at)}</td>
                  <td>{fmtWhen(row.ended_at)}</td>
                  <td>{row.minutes != null ? String(row.minutes) : "—"}</td>
                  <td>{String(row.notes || "")}</td>
                  <td>
                    {!row.ended_at ? (
                      <button
                        type="button"
                        className="linkish"
                        disabled={busy}
                        onClick={() => void onStop(String(row.id))}
                      >
                        Stop
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
