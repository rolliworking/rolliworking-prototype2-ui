import { useEffect, useState } from "react";
import {
  getHitList,
  listEstimates,
  listSalesOrders,
  lookupShipQueue,
  PrototypeApiError,
} from "./api/client";
import { AuthGate } from "./AuthGate";
import { EstimatesPage } from "./EstimatesPage";
import { HitListPage } from "./HitListPage";
import { IntakePage } from "./IntakePage";
import { RolesPage } from "./RolesPage";
import { SalesPage } from "./SalesPage";
import { ShopTimePage } from "./ShopTimePage";
import { clearSession, loadSession, SessionUser } from "./session";

type NavId =
  | "dashboard"
  | "estimates"
  | "hit-list"
  | "sales"
  | "intake"
  | "shop-time"
  | "roles";

type Row = Record<string, unknown>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSos, setOpenSos] = useState<Row[]>([]);
  const [readyShip, setReadyShip] = useState<Row[]>([]);
  const [hitList, setHitList] = useState<Row[]>([]);
  const [estimates, setEstimates] = useState<Row[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [sos, ship, hits, est] = await Promise.all([
          listSalesOrders({ limit: 50 }),
          lookupShipQueue({ limit: 10 }),
          getHitList({ date: todayIso() }),
          listEstimates({ limit: 8 }),
        ]);
        if (cancelled) return;

        const soItems = ((sos as { items?: Row[] }).items || []) as Row[];
        const open = soItems.filter((row) =>
          ["draft", "open", "partial", "partial_fulfilled", "fulfilled"].includes(
            String(row.status || "")
          )
        );
        setOpenSos(open.slice(0, 5));

        const today = todayIso();
        const monthPrefix = today.slice(0, 7);
        let daySum = 0;
        let monthSum = 0;
        for (const row of soItems) {
          const total = Number(row.total_amount ?? row.total ?? 0) || 0;
          const rawDate = String(row.order_date || row.created_at || "");
          const d = rawDate.slice(0, 10);
          if (d === today) daySum += total;
          if (d.startsWith(monthPrefix)) monthSum += total;
        }
        setTodayRevenue(daySum);
        setMonthRevenue(monthSum);

        setReadyShip(((ship as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
        setHitList(((hits as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
        setEstimates(((est as { items?: Row[] }).items || []).slice(0, 5) as Row[]);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof PrototypeApiError
            ? `${e.message}${e.code ? ` (${e.code})` : ""}`
            : e instanceof Error
              ? e.message
              : "Failed to load dashboard";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="sub">Loading dashboard from prototype-api…</p>;
  if (error) {
    return (
      <div className="error">
        Could not reach prototype-api. Start it on :8787, then refresh. {error}
      </div>
    );
  }

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const dayOfMonth = new Date().getDate();
  const breakevenTarget = (140000 / daysInMonth) * dayOfMonth;
  const vsBreakeven = monthRevenue - breakevenTarget;

  return (
    <>
      <div className="grid">
        <div className="card">
          <div className="label">Today's SO revenue</div>
          <div className="value">{money(todayRevenue)}</div>
        </div>
        <div className="card">
          <div className="label">Month's SO total</div>
          <div className="value">{money(monthRevenue)}</div>
        </div>
        <div className="card">
          <div className="label">vs Breakeven</div>
          <div className="value">
            {vsBreakeven >= 0 ? "+" : ""}
            {money(vsBreakeven)}
          </div>
          <div className="note">Target to date {money(breakevenTarget)} ($140k / month)</div>
        </div>
        <div className="card">
          <div className="label">Open hit-list</div>
          <div className="value">{hitList.length}</div>
          <div className="note">Today's seeded rows (page shows 5)</div>
        </div>
        <div className="card">
          <div className="label">Inventory value</div>
          <div className="value">—</div>
          <div className="note">UNKNOWN — no Contract inventory ops yet</div>
        </div>
        <div className="card">
          <div className="label">Low stock</div>
          <div className="value">—</div>
          <div className="note">UNKNOWN — available after cutover / inventory slice</div>
        </div>
        <div className="card">
          <div className="label">Client watches</div>
          <div className="value">—</div>
          <div className="note">UNKNOWN — count API not exposed; custody seed exists</div>
        </div>
        <div className="card">
          <div className="label">QBO token</div>
          <div className="value">stub</div>
          <div className="note">Informational only — no live QuickBooks</div>
        </div>
      </div>

      <div className="actions">
        <button type="button" disabled title="Create SO via API / later Emergent screen">
          Create SO
        </button>
        <button type="button" disabled title="Ship station later">
          Ship Station
        </button>
        <button type="button" disabled title="No inventory Contract ops yet">
          Add Part
        </button>
      </div>

      <div className="panels">
        <section className="panel">
          <h2>Open sales orders</h2>
          {openSos.length === 0 ? (
            <p className="empty">No open sales orders</p>
          ) : (
            <ul>
              {openSos.map((row) => (
                <li key={String(row.id)}>
                  <span>
                    {String(row.so_number || row.id)} · {String(row.customer_name || "—")}
                  </span>
                  <span>
                    {money(row.total_amount ?? row.total)} · {String(row.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Ready to ship</h2>
          {readyShip.length === 0 ? (
            <p className="empty">No orders ready to ship</p>
          ) : (
            <ul>
              {readyShip.map((row) => (
                <li key={String(row.id)}>
                  <span>{String(row.so_number || row.id)}</span>
                  <span>Ready · {String(row.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Recent estimates</h2>
          {estimates.length === 0 ? (
            <p className="empty">No estimates</p>
          ) : (
            <ul>
              {estimates.map((row) => (
                <li key={String(row.id)}>
                  <span>
                    {String(row.estimate_number || row.id)} ·{" "}
                    {String((row.customer as { last_name?: string } | null)?.last_name || "")}
                  </span>
                  <span>{String(row.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Today's hit list</h2>
          {hitList.length === 0 ? (
            <p className="empty">No open hit-list items</p>
          ) : (
            <ul>
                  {hitList.map((row) => (
                <li key={String(row.id)}>
                  <span>
                    {String(row.estimate_number || "")}
                    {row.estimate_number ? " · " : ""}
                    {String(row.description || row.id)}
                  </span>
                  <span>{String(row.technician || "")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Low stock alerts</h2>
          <p className="empty">UNKNOWN — inventory Contract ops not in Phase A API</p>
        </section>

        <section className="panel">
          <h2>Open purchase orders</h2>
          <p className="empty">UNKNOWN — purchasing Contract ops not in Phase A API</p>
        </section>
      </div>
    </>
  );
}

export function App() {
  const [nav, setNav] = useState<NavId>("dashboard");
  const [user, setUser] = useState<SessionUser | null>(() => loadSession().user);

  useEffect(() => {
    const { user: stored } = loadSession();
    if (stored) setUser(stored);
  }, []);

  if (!user) {
    return <AuthGate onSignedIn={setUser} />;
  }

  return (
    <div className="shell">
      <nav className="nav" aria-label="Primary">
        <div className="brand">Rolliworks Prototype</div>
        {(
          [
            ["dashboard", "Home"],
            ["estimates", "Estimates"],
            ["hit-list", "Hit list"],
            ["sales", "Sales"],
            ["intake", "Intake"],
            ["shop-time", "Shop time"],
            ["roles", "Roles"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={nav === id ? "active" : undefined}
            onClick={() => setNav(id)}
          >
            {label}
          </button>
        ))}
        <div className="nav-user">
          <span>{String(user.display_name || user.username || "signed in")}</span>
          <button
            type="button"
            onClick={() => {
              clearSession();
              setUser(null);
            }}
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">
        <div className="banner">
          DRAFT prototype · API <code>http://127.0.0.1:8787</code> · no real email / money /
          carriers
        </div>
        {nav === "dashboard" ? (
          <>
            <h1>Home</h1>
            <p className="sub">E1 shell dashboard — live reads from Contract client where available.</p>
            <Dashboard />
          </>
        ) : null}
        {nav === "estimates" ? <EstimatesPage /> : null}
        {nav === "hit-list" ? <HitListPage /> : null}
        {nav === "sales" ? <SalesPage /> : null}
        {nav === "intake" ? <IntakePage /> : null}
        {nav === "shop-time" ? <ShopTimePage /> : null}
        {nav === "roles" ? <RolesPage /> : null}
      </main>
    </div>
  );
}
