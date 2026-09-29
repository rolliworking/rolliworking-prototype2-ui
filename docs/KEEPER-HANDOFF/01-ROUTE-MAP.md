# 01 — ROUTE MAP (all route-spaces, with access) — refreshed 2026-09-29

Legend — **landing for**: which role kinds land here right after sign-in (`roleKind()` in `src/config/roles.ts`: `watchmaker` · `supervisor` · `concierge` · `manager`; `owner` = MH only). **guard**: what is evaluated on route load, before data — `RequireAuth` (session + station + `desktopAllowed(roleKind)`), `TierGate` (`canAccess(navItem, user)` = `tiers` list + `ownerOnly`), `RwRoleGuard` (`rwAllowed` — concierge bounced; `pad` → `padAllowed`), `RwManagerOnly` (`accessTier === 'manager'`), `station` (device registration only), `owner` (`OWNER_USER_ID`), `portal` (RolliConnect session), `none`. **data scope**: what the signed-in identity filters — `own` (own jobs / own list), `team` (supervisor rollup), `division` (station division wall), `all`. With **View-as (D-385)** active every guard evaluates the VIEWED identity.

⚠ UNGUARDED = reachable without a session (or without the role check the screen's content implies). This list is what the lockdown build consumes.

## A. RolliSuite desktop `/` — all inside `RequireAuth` → `TierGate` (`src/App.tsx`)
`RequireAuth`: no station → `/station-setup`; no session → `/sign-in`; `roleKind === 'watchmaker'` → bounced to `/rw/bench` (toast). `TierGate`: nav item `tiers` (`ALL` = manager+concierge, `MGR` = manager) + `ownerOnly`.

| route | purpose | landing for | guard | data scope |
|---|---|---|---|---|
| `/station-setup` | register/rename/reset this device as a station (`deviceType` desktop/pad/kiosk, `receptionMode`) | — | station (manager password to register) | — |
| `/sign-in` | staff card → password + camera photo (first of day) or PIN; **owner on a pad → `/choose-view`** | — | none (public by design) | staff list = station division |
| `/choose-view` | **View-as picker (pad)** — tiles for pad accounts + kiosks + "My own view" | owner (pad sign-in) | owner (`realUser.id === OWNER_USER_ID`; non-owner → `/`) | all |
| `/` | Dashboard | manager, concierge | RequireAuth + TierGate(ALL) | division |
| `/home` | `HomeRedirect` → `homeRouteFor(user)` | — | RequireAuth | — |
| `/today`, `/hitlist`, `/hit-list` | own Hitlist (redirects to `/hitlist/<slug>`) | manager, concierge (home-screen pref) | RequireAuth | own |
| `/hitlist/owner` | MH Accountability (asset $ on hand, bypass feed, zero-balance log) | owner | TierGate `ownerOnly` + `isOwnerSync()` in `getHitlist` | all |
| `/hitlist/:slug` | any person's Hitlist | — | RequireAuth; person switcher only for manager/concierge | own (of slug) |
| `/hitlist/:slug/team` | supervisor team rollup (JV → Dre/Sam/Nico/MAM) | — | RequireAuth; `isSupervisor(slug)` else notice | team |
| `/requests` | service requests queue | manager, concierge | TierGate(ALL) | division |
| `/inbox` | comms hub | manager, concierge | TierGate(ALL) | division |
| `/shipping/inbound` | inbound shipping stages / labels / tracking | manager, concierge | TierGate(ALL) | all |
| `/shipping/bill-audit` | carrier bill audit (dollars) | manager | TierGate(MGR) | all |
| `/intake` (+ `receive`, `receive/:id`, `work-order`, `inspection`, `inspection/:id`, `history`, `photos`, `inspect`, `inspect/new`, `inspect/:id`, `awaiting-approval`, `outbox`, `labels`, `trade`) | arrival → receive → work order → receive watch → inspection → outbox / label queue / trade scan-in | manager, concierge | TierGate(ALL) | all ⚠ (no division wall) |
| `/estimates`, `/estimates/new`, `/estimates/:id` | estimates | manager, concierge | TierGate(ALL) | all ⚠ |
| `/jobs`, `/jobs/all`, `/jobs/new`, `/jobs/shop-time`, `/jobs/:id`, `/jobs/:jobId/appraisal/:id` | jobs board / list / detail / appraisal (signer selector) | manager | TierGate(MGR) | all |
| `/inspection/new`, `/inspection/:id`, `/inspection-photos` | redirects into `/intake/inspect*` | — | RequireAuth | — |
| `/clients`, `/clients/:id` | universal search, Client 360 (in-house badge hidden in reception mode) | manager, concierge | TierGate(ALL) | all |
| `/appointments` | schedule | manager, concierge | TierGate(ALL) | division |
| `/bench` | My bench (desktop) | manager, concierge | TierGate(ALL) | own |
| `/supervisor` | supervisor board | manager | TierGate(MGR) | all |
| `/floor`, `/floor/lanes` | floor map | manager | TierGate(MGR) | all |
| `/assign` | Assign / Move | manager | TierGate(MGR) | all |
| `/custody` | unified custody view | manager | TierGate(MGR) | all |
| `/parts`, `/parts/knowledge` | parts catalog, learned knowledge | manager | TierGate(MGR) | all |
| `/inventory`, `/inventory/count` | inventory, cycle count (variance $ = `accessTier === 'manager'` in `getVarianceReport`) | manager | TierGate(MGR) | all |
| `/purchasing`, `/purchasing/vendors`, `/purchasing/vendors/:id` | purchasing | manager | TierGate(MGR) | all |
| `/swo` | shipping work orders | manager | TierGate(MGR) | all |
| `/labels` | label queue + printers | manager, concierge | TierGate(ALL) | all |
| `/reports` | reports | manager | TierGate(MGR) | all |
| `/accounting` | accounting / QBO queue | manager | TierGate(MGR) | all |
| `/integrations`, `/integrations/quickbooks` | integration tiles, QBO setup | manager | TierGate(MGR) | all |
| `/setup`, `/setup/audit-log` | users, catalog, templates, printers, audit log (shows `as <viewed>` chip) | manager | TierGate(MGR) | all |
| `/help` | help | manager, concierge | TierGate(ALL) | — |
| `/sales`, `/sales/new`, `/sales/:id`, `/sales/pickup`, `/sales/ship` | sales orders, pickup station, ship station (scan gate + manager override) | manager, concierge | TierGate(ALL) | all ⚠ |
| `/wm-kiosk` | **Watchmaker-room photo kiosk** (common area, guided 4-step + ad-hoc) | — | RequireAuth only ⚠ UNGUARDED for role — any signed-in tier | all |
| `/actions/:action`, section placeholders, `*` | placeholders / not found | — | RequireAuth | — |

## B. RolliWorking bench app `/rw` — `RwRoleGuard` → `RwShell` (MoneyContext = `roleKind !== 'watchmaker'`)
| route | purpose | landing for | guard | data scope |
|---|---|---|---|---|
| `/rw` (index) | Bench (desktop-style) | — | RwRoleGuard | own |
| `/rw/bench` | **Bench Pad** (kiosked, PIN board, idle re-lock) | watchmaker (Leo, MM, Dre, Sam, Nico, MAM) | RwRoleGuard | own |
| `/rw/pad` | **Supervisor Pad** (WM room) | supervisor (JV) | RwRoleGuard `pad` (`padAllowed` = supervisor/manager) | room |
| `/rw/band` | Band Pad (`RwPadPage room="band"`) | — | RwRoleGuard only ⚠ UNGUARDED for pad tier (watchmakers reach it; $ hidden by MoneyContext) | room |
| `/rw/hitlist`, `/rw/today`, `/rw/hitlist/:slug`, `/rw/hitlist/:slug/team` | Hitlist inside the RW shell (no $ for watchmakers) | — | RwRoleGuard | own / team |
| `/rw/jobs`, `/rw/jobs/:id` | jobs, job detail (hide-money) | — | RwRoleGuard | all |
| `/rw/parts` | parts | — | RwRoleGuard | all |
| `/rw/qc` | QC lane | — | RwManagerOnly | all |
| `/rw/supervisor` | supervisor board | — | RwManagerOnly | all |
| `/rw/bulk` | Bulk Assign (scan) | — | RwManagerOnly | all |
| `/rw/floor` | shop floor + manager gate scan (`accessTier === 'manager'` inside `gateScan`) | — | RwRoleGuard; gate action manager-only in API | all |
| `/rw/assign`, `/rw/queue`, `/rw/wm`, `/rw/station`, `/rw/history`, `/rw/reports`, `/rw/picking`, `/rw/evidence` | assign/move, work queue, WM room, station scan, history lookup, reports, picking, evidence | — | RwRoleGuard only ⚠ (Assign/Move is NOT manager-only here — spec item 7 pending) | all |
| `/rw/testing`, `/rw/testing/test/:jobId` (`/rt*` redirect here) | timing bench (RolliTime) | — | RwRoleGuard | all |

## C. Public / station / token routes
| route | purpose | landing for | guard | data scope |
|---|---|---|---|---|
| `/kiosk` | **Front-desk check-in kiosk** (walk-in) | — | none ⚠ UNGUARDED (intended public; needs station token in prod) | none |
| `/rg/kiosk` | RGTime walk-in time-clock kiosk | — | none ⚠ UNGUARDED (station token intended) | none |
| `/rg`, `/rg/clock`, `/rg/week`, `/rg/manager` | RGTime phone PWA (own remembered session, name+PIN) | — | own PIN session; `/rg/manager` = concierge+ card + PIN | own / all |
| `/pay/:token` | mock payment page from invoice email | — | token ⚠ (token is a mock string, never expires) | one SO |
| `/track`-style public page | **not built** (spec item "public track page" pending) | — | — | — |

## D. RolliConnect client portal `/rc`
| route | purpose | guard | data scope |
|---|---|---|---|
| `/rc` (login), `/rc/signup`, `/rc/auth/:token` | email+password+TOTP (`000000`), signup with mocked verification link | none (public) | — |
| `/rc/home`, `/rc/account`, `/rc/estimates/:id`, `/rc/invoices/:id`, `/rc/watches/:id`, `/rc/messages` | portal | portal session (`rcSession`) | one client |
| `/rc/report/:token`, `/rc/inspection/:token` | tokened deep links (report approvals, inspection form) | token (`portalDeepLink`, revocable) | one client |

## ⚠ UNGUARDED list (consumed by the lockdown build)
1. `/kiosk` — public by design; production needs a station token (D-384) so a laptop can't pretend to be the kiosk.
2. `/rg/kiosk` — same.
3. `/pay/:token` — mock token, no expiry, no rate limit.
4. `/wm-kiosk` — any signed-in tier (concierge included) can open the watchmaker-room photo kiosk; intended: kiosk station or RW roles.
5. `/rw/band` — no `pad` guard (watchmakers can open the Band Pad; money is hidden but Assign/Advance actions are only API-gated).
6. `/rw/assign`, `/rw/queue`, `/rw/bulk`(manager-only ✔), `/rw/station` — Assign is not manager-only for concierge/supervisor (spec item 7).
7. `/hitlist/:slug` — any manager/concierge can read any person's list (ruled OK for admin assistants; concierge scope pending item 7).
8. Division wall missing on `/intake/*`, `/estimates/*`, `/sales/*` (pre-existing ⚠).
