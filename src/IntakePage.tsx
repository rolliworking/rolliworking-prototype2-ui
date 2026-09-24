import { useCallback, useEffect, useState } from "react";
import {
  createPackageArrivalScan,
  getReceiveWatchPrefill,
  listIntakeLeads,
  listPackageArrivalScans,
  listShippingLabelsForReceive,
  lookupEstimateForReceive,
  matchPackageArrival,
  markWatchLabelPrinted,
  receiveWatch,
  recordPackageDropOff,
  searchCustomersForReceive,
  sendLeadFollowup,
  updateIntakeLead,
  updatePackageArrivalOutcome,
  voidReceivedWatch,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;
type Tab = "packages" | "watch" | "leads";

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

function customerName(c: Row | null | undefined) {
  if (!c) return "—";
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || String(c.email || "—");
}

export function IntakePage() {
  const [tab, setTab] = useState<Tab>("packages");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // packages
  const [arrivals, setArrivals] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Row[]>([]);
  const [carrier, setCarrier] = useState("FedEx");
  const [tracking, setTracking] = useState("");
  const [matchEstimate, setMatchEstimate] = useState("");
  const [dropEstimateId, setDropEstimateId] = useState("");
  const [dropNotes, setDropNotes] = useState("");

  // watch
  const [prefillNumber, setPrefillNumber] = useState("");
  const [prefill, setPrefill] = useState<Row | null>(null);
  const [watchBrand, setWatchBrand] = useState("");
  const [watchModel, setWatchModel] = useState("");
  const [watchSerial, setWatchSerial] = useState("");
  const [deptW, setDeptW] = useState(true);
  const [deptB, setDeptB] = useState(false);
  const [lastPropertyId, setLastPropertyId] = useState<string | null>(null);

  // leads
  const [leads, setLeads] = useState<Row[]>([]);
  const [leadStatus, setLeadStatus] = useState("");

  const reloadPackages = useCallback(async () => {
    const [a, l] = await Promise.all([
      listPackageArrivalScans({ limit: 30 }),
      listShippingLabelsForReceive({ limit: 15 }),
    ]);
    setArrivals(((a as { items?: Row[] }).items || []) as Row[]);
    setLabels(((l as { items?: Row[] }).items || []) as Row[]);
  }, []);

  const reloadLeads = useCallback(async () => {
    const res = await listIntakeLeads({
      status: leadStatus || undefined,
      limit: 40,
    });
    setLeads(((res as { items?: Row[] }).items || []) as Row[]);
  }, [leadStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        if (tab === "packages") await reloadPackages();
        if (tab === "leads") await reloadLeads();
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, reloadPackages, reloadLeads]);

  async function onScan() {
    if (!tracking.trim()) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await createPackageArrivalScan({
        carrier,
        tracking_number: tracking.trim(),
        scanned_by: "michael",
      });
      setTracking("");
      setNotice("Package scan created (pending)");
      await reloadPackages();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onMatch(arrivalId: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      let estimateId: string | undefined;
      const term = matchEstimate.trim();
      if (term) {
        if (/^[0-9a-f-]{36}$/i.test(term)) {
          estimateId = term;
        } else {
          const found = await lookupEstimateForReceive({ estimate_number: term });
          const items = ((found as { items?: Row[] }).items || []) as Row[];
          estimateId = items[0] ? String(items[0].id) : undefined;
          if (!estimateId) throw new Error("No estimate matched that number");
        }
      }
      await matchPackageArrival(arrivalId, {
        matched_estimate_id: estimateId,
        receive_status: "received",
      });
      setNotice("Arrival matched / received");
      await reloadPackages();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onOutcome(arrivalId: string, receive_status: string) {
    setBusy(true);
    setError(null);
    try {
      await updatePackageArrivalOutcome(arrivalId, { receive_status });
      setNotice(`Outcome → ${receive_status}`);
      await reloadPackages();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDropOff() {
    if (!dropEstimateId.trim()) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      let estimateId = dropEstimateId.trim();
      if (!/^[0-9a-f-]{36}$/i.test(estimateId)) {
        const found = await lookupEstimateForReceive({ estimate_number: estimateId });
        const items = ((found as { items?: Row[] }).items || []) as Row[];
        if (!items[0]) throw new Error("Estimate not found for drop-off");
        estimateId = String(items[0].id);
      }
      const res = (await recordPackageDropOff({
        estimate_id: estimateId,
        notes: dropNotes || undefined,
        received_by: "michael",
      })) as Row;
      setNotice(`Drop-off recorded · ${String(res.tracking_number || res.id)}`);
      setDropNotes("");
      await reloadPackages();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPrefill() {
    if (!prefillNumber.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await getReceiveWatchPrefill({
        estimate_number: prefillNumber.trim(),
      })) as Row;
      setPrefill(res);
      const est = res.estimate as Row | undefined;
      setWatchBrand(String(est?.watch_brand || ""));
      setWatchModel(String(est?.watch_model || ""));
      setNotice("Prefill loaded");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReceiveWatch() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const est = prefill?.estimate as Row | undefined;
      let customerId = est?.customer
        ? String((est.customer as Row).id)
        : undefined;
      if (!customerId) {
        const search = await searchCustomersForReceive({ q: "PRACTICE" });
        const items = ((search as { items?: Row[] }).items || []) as Row[];
        customerId = items[0] ? String(items[0].id) : undefined;
      }
      if (!customerId) throw new Error("customer_id required — load prefill or PRACTICE customer");

      const prop = (await receiveWatch({
        customer_id: customerId,
        estimate_id: est?.id ? String(est.id) : undefined,
        brand: watchBrand || undefined,
        model: watchModel || undefined,
        serial: watchSerial || undefined,
        department_flags: { W: deptW, B: deptB, P: false, PM: false },
        notes: "prototype receive",
      })) as Row;
      setLastPropertyId(String(prop.id));
      setNotice(`Watch received into custody · ${String(prop.id).slice(0, 8)}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLabelPrinted() {
    if (!lastPropertyId) return;
    setBusy(true);
    try {
      await markWatchLabelPrinted(lastPropertyId);
      setNotice("Label marked printed");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onVoidWatch() {
    if (!lastPropertyId) return;
    if (!window.confirm("Void this just-received custody row?")) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await voidReceivedWatch(lastPropertyId);
      setNotice(`Voided custody ${lastPropertyId.slice(0, 8)}`);
      setLastPropertyId(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLeadDone(id: string) {
    setBusy(true);
    try {
      await updateIntakeLead(id, { status: "done" });
      setNotice("Lead marked done");
      await reloadLeads();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLeadFollowup(id: string) {
    setBusy(true);
    try {
      const res = (await sendLeadFollowup(id, {})) as { outbox_id?: string };
      setNotice(`Follow-up queued · outbox ${res.outbox_id || "(ok)"} — no real mail`);
      await reloadLeads();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Intake</h1>
      <p className="sub">
        Packages, receive watch, and leads against prototype-api. IFS label clicks stay dead. Photos /
        signature: UNKNOWN — simplest omit.
      </p>

      <div className="actions">
        {(
          [
            ["packages", "Packages"],
            ["watch", "Receive watch"],
            ["leads", "Leads"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={tab === id ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="banner">{notice}</div> : null}

      {tab === "packages" ? (
        <>
          <div className="panel" style={{ marginBottom: "1rem" }}>
            <h2>Scan package</h2>
            <div className="toolbar">
              <label>
                Carrier
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                  {["FedEx", "UPS", "USPS", "DHL", "Other"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tracking
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </label>
              <button type="button" disabled={busy || !tracking.trim()} onClick={() => void onScan()}>
                Create scan
              </button>
            </div>
            <div className="toolbar">
              <label>
                Match estimate #
                <input
                  value={matchEstimate}
                  onChange={(e) => setMatchEstimate(e.target.value)}
                  placeholder="optional for Match"
                />
              </label>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1rem" }}>
            <h2>In-person drop-off</h2>
            <div className="toolbar">
              <label>
                Estimate # or id
                <input value={dropEstimateId} onChange={(e) => setDropEstimateId(e.target.value)} />
              </label>
              <label>
                Notes
                <input value={dropNotes} onChange={(e) => setDropNotes(e.target.value)} />
              </label>
              <button
                type="button"
                disabled={busy || !dropEstimateId.trim()}
                onClick={() => void onDropOff()}
              >
                Record drop-off
              </button>
            </div>
          </div>

          <div className="split">
            <div className="panel table-wrap">
              <h2>Arrival scans</h2>
              {arrivals.length === 0 ? (
                <p className="empty">None</p>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Carrier</th>
                      <th>Tracking</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrivals.map((row) => (
                      <tr key={String(row.id)}>
                        <td>{String(row.carrier || "—")}</td>
                        <td>{String(row.tracking_number || "—")}</td>
                        <td>{String(row.receive_status || "—")}</td>
                        <td>
                          <button
                            type="button"
                            className="linkish"
                            disabled={busy}
                            onClick={() => void onMatch(String(row.id))}
                          >
                            Match
                          </button>{" "}
                          <button
                            type="button"
                            className="linkish"
                            disabled={busy}
                            onClick={() => void onOutcome(String(row.id), "needs_review")}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="panel">
              <h2>Labels for receive</h2>
              {labels.length === 0 ? (
                <p className="empty">None</p>
              ) : (
                <ul>
                  {labels.map((row) => (
                    <li key={String(row.id)}>
                      <span>{String(row.tracking_number)}</span>
                      <span>
                        {(row.estimate as { estimate_number?: string } | null)?.estimate_number ||
                          "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === "watch" ? (
        <div className="panel">
          <h2>Receive watch</h2>
          <div className="toolbar">
            <label>
              Prefill estimate #
              <input value={prefillNumber} onChange={(e) => setPrefillNumber(e.target.value)} />
            </label>
            <button type="button" disabled={busy} onClick={() => void onPrefill()}>
              Load prefill
            </button>
          </div>
          {prefill?.estimate ? (
            <p className="sub">
              Estimate {String((prefill.estimate as Row).estimate_number)} ·{" "}
              {customerName((prefill.estimate as Row).customer as Row)}
              {prefill.existing_property
                ? ` · existing custody ${String((prefill.existing_property as Row).id).slice(0, 8)}`
                : ""}
            </p>
          ) : null}
          <div className="toolbar">
            <label>
              Brand
              <input value={watchBrand} onChange={(e) => setWatchBrand(e.target.value)} />
            </label>
            <label>
              Model
              <input value={watchModel} onChange={(e) => setWatchModel(e.target.value)} />
            </label>
            <label>
              Serial
              <input value={watchSerial} onChange={(e) => setWatchSerial(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <label>
              <input type="checkbox" checked={deptW} onChange={(e) => setDeptW(e.target.checked)} /> W
            </label>
            <label>
              <input type="checkbox" checked={deptB} onChange={(e) => setDeptB(e.target.checked)} /> B
            </label>
            <button type="button" disabled={busy} onClick={() => void onReceiveWatch()}>
              Receive into custody
            </button>
            <button type="button" disabled={busy || !lastPropertyId} onClick={() => void onLabelPrinted()}>
              Mark label printed
            </button>
            <button type="button" disabled={busy || !lastPropertyId} onClick={() => void onVoidWatch()}>
              Void receive
            </button>
          </div>
        </div>
      ) : null}

      {tab === "leads" ? (
        <>
          <div className="toolbar">
            <label>
              Status
              <select value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
                <option value="">all</option>
                {["new", "done", "archived", "na", "awaiting"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void reloadLeads()} disabled={busy}>
              Refresh
            </button>
          </div>
          <div className="panel table-wrap">
            {leads.length === 0 ? (
              <p className="empty">No leads</p>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{String(row.name || "—")}</td>
                      <td>{String(row.email || "—")}</td>
                      <td>{String(row.status || "—")}</td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          disabled={busy}
                          onClick={() => void onLeadDone(String(row.id))}
                        >
                          Done
                        </button>{" "}
                        <button
                          type="button"
                          className="linkish"
                          disabled={busy}
                          onClick={() => void onLeadFollowup(String(row.id))}
                        >
                          Follow-up
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
