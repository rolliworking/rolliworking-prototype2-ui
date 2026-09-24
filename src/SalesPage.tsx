import { useCallback, useEffect, useState } from "react";
import {
  createSalesOrder,
  completePickup,
  confirmShipment,
  fulfillSalesOrder,
  generatePickupCode,
  getSalesOrder,
  getSalesOrderInvoiceStatus,
  listSalesOrders,
  lookupPickupQueue,
  lookupShipQueue,
  searchCustomersForReceive,
  updateSalesOrder,
  PrototypeApiError,
} from "./api/client";

type Row = Record<string, unknown>;

const STATUSES = ["", "draft", "open", "partial", "fulfilled", "shipped", "picked_up", "cancelled"];

function money(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function customerLabel(row: Row) {
  const c = row.customer as
    | { first_name?: string | null; last_name?: string | null }
    | null
    | undefined;
  if (row.customer_name) return String(row.customer_name);
  if (!c) return "—";
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "—";
}

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

export function SalesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [pickupQueue, setPickupQueue] = useState<Row[]>([]);
  const [shipQueue, setShipQueue] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [invoice, setInvoice] = useState<Row | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [signatureRef, setSignatureRef] = useState("");
  const [photoRefs, setPhotoRefs] = useState("");
  const [shipPackagePhotos, setShipPackagePhotos] = useState("");
  const [shipLabelPhoto, setShipLabelPhoto] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [custQ, setCustQ] = useState("PRACTICE");
  const [custHits, setCustHits] = useState<Row[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lineDesc, setLineDesc] = useState("Service");
  const [linePrice, setLinePrice] = useState("100");
  const [channel, setChannel] = useState<"pickup" | "ship">("pickup");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, pickup, ship] = await Promise.all([
        listSalesOrders({
          q: q.trim() || undefined,
          status: status || undefined,
          limit: 50,
        }),
        lookupPickupQueue({ limit: 10 }),
        lookupShipQueue({ limit: 10 }),
      ]);
      setItems(((list as { items?: Row[] }).items || []) as Row[]);
      setPickupQueue(((pickup as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
      setShipQueue(((ship as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
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
      setInvoice(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const [order, inv] = await Promise.all([
          getSalesOrder(selectedId),
          getSalesOrderInvoiceStatus(selectedId),
        ]);
        if (!cancelled) {
          setDetail(order as Row);
          setInvoice(inv as Row);
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

  async function refreshDetail(id: string) {
    const [order, inv] = await Promise.all([
      getSalesOrder(id),
      getSalesOrderInvoiceStatus(id),
    ]);
    setDetail(order as Row);
    setInvoice(inv as Row);
    await reload();
  }

  async function onFulfill() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      const channel =
        String(detail?.fulfillment_channel || "") === "ship" ? "ship" : "pickup";
      await fulfillSalesOrder(selectedId, { fulfillment_channel: channel });
      setNotice("Fulfilled with stub QBO invoice id — no live QuickBooks");
      await refreshDetail(selectedId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onMarkPaid() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateSalesOrder(selectedId, { is_paid: true });
      setNotice("Marked paid (prototype flag only — no real money)");
      await refreshDetail(selectedId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPickupComplete(adminForce = false) {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      const photos = photoRefs
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = (await completePickup({
        sales_order_id: selectedId,
        admin_force: adminForce,
        signature_ref: signatureRef.trim() || undefined,
        photo_refs: photos.length ? photos : undefined,
      })) as Row;
      const session = (res.pickup as { session?: { id?: string } } | undefined)?.session;
      setNotice(
        `Pickup complete${adminForce ? " (admin force)" : ""}${
          session?.id ? ` · session ${String(session.id).slice(0, 8)}` : ""
        } — refs are proxies, no blob upload`
      );
      await refreshDetail(selectedId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onShipConfirm() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      const packagePhotos = shipPackagePhotos
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = (await confirmShipment({
        sales_order_id: selectedId,
        create_mock_label: true,
        declared_value: 2500,
        package_photo_refs: packagePhotos.length ? packagePhotos : undefined,
        label_photo_ref: shipLabelPhoto.trim() || undefined,
      })) as Row;
      const tracking =
        (res.tracking_number as string) ||
        ((res.shipment as { tracking_number?: string; mock_label?: { tracking?: { tracking_number?: string } } } | undefined)
          ?.tracking_number) ||
        ((res.shipment as { mock_label?: { tracking?: { tracking_number?: string } } } | undefined)?.mock_label
          ?.tracking?.tracking_number);
      const shipId = (res.shipment as { record?: { id?: string } } | undefined)?.record?.id;
      setNotice(
        `Shipped with mock label${tracking ? ` · ${tracking}` : ""}${
          shipId ? ` · shipment ${String(shipId).slice(0, 8)}` : ""
        } — no carrier charge`
      );
      await refreshDetail(selectedId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPickupCode() {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = (await generatePickupCode({ sales_order_id: selectedId })) as Row;
      const code = String(res.code || "");
      setPickupCode(code);
      setNotice(`Pickup code ${code}${res.pickup_url_hint ? ` · ${String(res.pickup_url_hint)}` : ""}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFindCustomers() {
    setBusy(true);
    setError(null);
    try {
      const res = await searchCustomersForReceive({ q: custQ.trim(), limit: 10 });
      setCustHits(((res as { items?: Row[] }).items || []) as Row[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateSo() {
    if (!customerId) {
      setError("Pick a customer before creating an order");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const order = (await createSalesOrder({
        customer_id: customerId,
        status: "draft",
        fulfillment_channel: channel,
        lines: [
          {
            description: lineDesc.trim() || "Line",
            quantity: 1,
            unit_price: Number(linePrice) || 0,
          },
        ],
      })) as Row;
      setNotice(`Created ${String(order.so_number || order.id)}`);
      setShowCreate(false);
      setSelectedId(String(order.id));
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
      <h1>Sales</h1>
      <p className="sub">
        Orders list + fulfill / pickup / ship against prototype-api. Live QBO, email, and carriers stay
        off. Pickup accepts optional signature_ref + photo_refs as string proxies (no blob store).
      </p>

      <div className="toolbar">
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="SO #, customer…"
          />
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
        <button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Hide create" : "New sales order"}
        </button>
      </div>

      {showCreate ? (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Create sales order</h2>
          <div className="toolbar">
            <label>
              Customer search
              <input value={custQ} onChange={(e) => setCustQ(e.target.value)} />
            </label>
            <button type="button" disabled={busy} onClick={() => void onFindCustomers()}>
              Find
            </button>
            <label>
              Customer
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">select…</option>
                {custHits.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      String(c.email || c.id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Channel
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as "pickup" | "ship")}
              >
                <option value="pickup">pickup</option>
                <option value="ship">ship</option>
              </select>
            </label>
          </div>
          <div className="toolbar">
            <label>
              Line
              <input value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} />
            </label>
            <label>
              Price
              <input value={linePrice} onChange={(e) => setLinePrice(e.target.value)} />
            </label>
            <button type="button" disabled={busy || !customerId} onClick={() => void onCreateSo()}>
              Save draft
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="banner">{notice}</div> : null}

      <div className="panels" style={{ marginBottom: "1rem" }}>
        <section className="panel">
          <h2>Pickup queue</h2>
          {pickupQueue.length === 0 ? (
            <p className="empty">Empty</p>
          ) : (
            <ul>
              {pickupQueue.map((row) => (
                <li key={String(row.id)}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setSelectedId(String(row.id))}
                  >
                    {String(row.so_number || row.id)}
                  </button>
                  <span>{String(row.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Ship queue</h2>
          {shipQueue.length === 0 ? (
            <p className="empty">Empty</p>
          ) : (
            <ul>
              {shipQueue.map((row) => (
                <li key={String(row.id)}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setSelectedId(String(row.id))}
                  >
                    {String(row.so_number || row.id)}
                  </button>
                  <span>{String(row.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="split">
        <div className="panel table-wrap">
          {loading ? (
            <p className="empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="empty">No sales orders</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>SO</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Paid</th>
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
                      <td>{String(row.so_number || id.slice(0, 8))}</td>
                      <td>{customerLabel(row)}</td>
                      <td>{money(row.total_amount)}</td>
                      <td>{String(row.status || "—")}</td>
                      <td>{row.is_paid ? "yes" : "no"}</td>
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
            <p className="empty">Select a row or queue item</p>
          ) : detailLoading ? (
            <p className="empty">Loading…</p>
          ) : !detail ? (
            <p className="empty">Not found</p>
          ) : (
            <>
              <p>
                <strong>{String(detail.so_number || detail.id)}</strong> · {String(detail.status)}{" "}
                · {money(detail.total_amount)}
              </p>
              <p className="sub" style={{ marginBottom: "0.75rem" }}>
                {customerLabel(detail)}
                {detail.fulfillment_channel
                  ? ` · channel ${String(detail.fulfillment_channel)}`
                  : ""}
                {detail.tracking_number ? ` · track ${String(detail.tracking_number)}` : ""}
                {invoice ? (
                  <>
                    <br />
                    Invoice stub: {String(invoice.qbo_invoice_id || invoice.invoice_id || "none")} ·
                    paid flag {String(invoice.is_paid ?? detail.is_paid ?? false)}
                  </>
                ) : null}
              </p>
              <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
                <label>
                  Signature ref (proxy)
                  <input
                    value={signatureRef}
                    onChange={(e) => setSignatureRef(e.target.value)}
                    placeholder="sig://demo-pad-1"
                  />
                </label>
                <label>
                  Photo refs (comma / newline)
                  <input
                    value={photoRefs}
                    onChange={(e) => setPhotoRefs(e.target.value)}
                    placeholder="photo://front, photo://back"
                  />
                </label>
                <label>
                  Ship package photos
                  <input
                    value={shipPackagePhotos}
                    onChange={(e) => setShipPackagePhotos(e.target.value)}
                    placeholder="photo://pkg-1"
                  />
                </label>
                <label>
                  Ship label photo
                  <input
                    value={shipLabelPhoto}
                    onChange={(e) => setShipLabelPhoto(e.target.value)}
                    placeholder="photo://label"
                  />
                </label>
              </div>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy || String(detail.status) === "fulfilled"}
                  onClick={() => void onFulfill()}
                >
                  Fulfill (QBO stub)
                </button>
                <button type="button" disabled={busy || Boolean(detail.is_paid)} onClick={() => void onMarkPaid()}>
                  Mark paid
                </button>
                <button type="button" disabled={busy} onClick={() => void onPickupComplete(false)}>
                  Complete pickup
                </button>
                <button type="button" disabled={busy} onClick={() => void onPickupComplete(true)}>
                  Admin pickup
                </button>
                <button type="button" disabled={busy} onClick={() => void onShipConfirm()}>
                  Ship (mock label)
                </button>
                <button type="button" disabled={busy} onClick={() => void onPickupCode()}>
                  Generate pickup code
                </button>
              </div>
              {pickupCode ? (
                <p className="banner" style={{ marginTop: "0.75rem" }}>
                  Active code: <strong>{pickupCode}</strong>
                </p>
              ) : null}
              {lines.length === 0 ? (
                <p className="empty">No lines</p>
              ) : (
                <ul>
                  {lines.map((line) => (
                    <li key={String(line.id)}>
                      <span>{String(line.description || "Line")}</span>
                      <span>
                        {Number(line.quantity ?? line.qty_ordered) || 1} × {money(line.unit_price)}
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
