# 01 — ROUTE MAP (all route-spaces, with access) — refreshed 2026-10-02 (rows tagged **[v2]** were added 2026-09-30 → 2026-10-02)

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
| `/hitlist/:slug` | a person's Hitlist | — | RequireAuth + `canViewHitlist` (self · their supervisor · manager tier · MH via View-as; others → own list) | own (of slug) |
| `/hitlist/:slug/team` | supervisor team rollup (JV → Dre/Sam/Nico/MAM) | — | RequireAuth; `isSupervisor(slug)` else notice | team |
| `/requests` | service requests queue — RQ pool, unowned; rating · dots · source · age · **Tags** column (right-click); row click → `/inbox?thread=&panel=1` (D-441, D-461) | manager, concierge | TierGate(ALL) | division |
| `/requests/new` **[v2]** | **Request Builder on behalf of a client** (`?client=<id>`; `BuilderMode 'staff'`, D-468) | — | TierGate(ALL via `/requests`) | division |
| `/requests/:id` **[v2]** | requests page with the row preselected | — | TierGate(ALL) | division |
| `/inbox` | **Inbox v2** — flat list, tabs Portal · Team · Calls (+ **Views** owner only `?section=views&as=`), WHO + lane filters, job-card slide-out `?panel=1`, context chip (`modules/inbox-v2.md`) | manager, concierge | TierGate(ALL); **Portal tab content = `canClientComms` (MH · Vienna · Chyna) only**, others see the restricted note | division |
| `/messages/all` **[v2]** | redirect → `/inbox?section=staff&staff=<Short>` (legacy folder URL) | — | TierGate | — |
| `/calls` **[v2]** | global call log (Vonage MOCK): in / out, who answered, duration, disposition, recording link; sidebar missed badge (`modules/calls-telephony.md`). **[10-03]** "Simulate incoming call" panel (`calls-simulate-*`, any number + outcome) drives the same screen-pop the Vonage webhook would — **NOT-KEEPER, KEEPER D-405** | — | TierGate(MGR) | all |
| `/shipping/inbound` | inbound shipping stages / labels / tracking | manager, concierge | TierGate(ALL) | all |
| `/shipping/bill-audit` | carrier bill audit (dollars) | manager | TierGate(MGR) | all |
| `/intake` (+ `receive`, `receive/:id`, `work-order`, `inspection`, `inspection/:id`, `history`, `photos`, `inspect`, `inspect/new`, `inspect/:id`, `awaiting-approval`, **`sent`** (`outbox` → redirect, D-419), `labels`, `trade`) | arrival → receive → work order → receive watch → inspection → Sent / label queue / trade scan-in | manager, concierge | TierGate(ALL) | user division (packages via linked job; mock path) |
| `/estimates`, `/estimates/new`, `/estimates/:id` | estimates | manager, concierge | TierGate(ALL) | user division (mock path; live API rows unwalled ⚠) |
| `/jobs`, `/jobs/all`, `/jobs/new`, `/jobs/shop-time`, `/jobs/:id`, `/jobs/:jobId/appraisal/:id` | jobs board / list (W · B · P column, D-416) / **Job Detail v2** (process flow, add-ons — `modules/job-detail-v2-wbp.md`) / appraisal (signer selector) | manager | TierGate(MGR) | all |
| `/inspection/new`, `/inspection/:id`, `/inspection-photos` | redirects into `/intake/inspect*` | — | RequireAuth | — |
| `/clients`, `/clients/:id` | universal search, Client 360 (in-house badge hidden in reception mode) | manager, concierge | TierGate(ALL) | all |
| `/appointments` | schedule | manager, concierge | TierGate(ALL) | division |
| `/bench` | My bench (desktop) | manager, concierge | TierGate(ALL) | own |
| `/supervisor` | supervisor board | manager | TierGate(MGR) | all |
| `/floor`, `/floor/lanes` | floor map | manager | TierGate(MGR) | all |
| `/assign` | Assign / Move | manager | TierGate(MGR) | all |
| `/custody` | unified custody view | manager | TierGate(MGR) | all |
| `/parts`, `/parts/knowledge`, `/parts/approvals` **[v2]** | parts catalog, learned knowledge, **Approvals to send** (MH daily item, one-tap Send — D-418) | manager | TierGate(MGR) | all |
| `/inventory`, `/inventory/reports` **[v2]** | inventory; consumption / spending reports (`api/inventoryReports.ts`) | manager | TierGate(MGR) | all |
| `/inventory/count` | cycle count — counts + locations for every tier; variance report ($) manager-only | manager, concierge | TierGate(ALL) | all |
| `/purchasing`, `/purchasing/vendors`, `/purchasing/vendors/:id` | purchasing; vendors (`kind parts \| outsource`, country) | manager | TierGate(MGR) | all |
| `/concierge` **[v2]** | **Concierge** — one lane per vendor, TRACK \| ASSIGN views, slide-out, destination-first scan commit (`modules/concierge-swo.md`) | manager | TierGate(MGR) | all |
| `/swo`, `/swo/:id` **[v2]** | SWO list · **SWO hub page** (container + lines, shipments, invoices, notes) | manager | TierGate(MGR) | all |
| `/labels` | label queue + printers | manager, concierge | TierGate(ALL) | all |
| `/reports` | reports (+ label quality row) | manager | TierGate(MGR) | all |
| `/accounting` | accounting / QBO queue | manager | TierGate(MGR) | all |
| `/integrations`, `/integrations/quickbooks` | integration tiles (the WatchM8 tile links to `/setup/integrations/watchm8`), QBO setup; **`/integrations/watchm8` → redirect [10-03]** | manager | TierGate(MGR) | all |
| `/setup`, `/setup/audit-log` | users, catalog, templates, printers, feature switches, RolliConnect access, audit log (shows `as <viewed>` chip) | manager | TierGate(MGR) | all |
| `/setup/access` **[v2]** | **Access control** — users × screens overrides, enable / disable, Limits drawer, org tree, new user from template (D-391, D-398…D-401) | owner | TierGate `ownerOnly` + owner checks in API (`setAccessOverride`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate`) | all |
| `/setup/inspection` **[v2]** | inspection setup — variant sets + candidates, shot lists, tags, WatchM8 **Data out** (`modules/inspection-labels.md`) | manager | TierGate(MGR via `/setup`) | all |
| `/setup/rate-card` **[v2]** | **Rate card** (`?key=` prefill from a request line — D-472) | manager | TierGate(MGR via `/setup`) | all |
| `/setup/bonus-plans` **[2026-10-02]** | **Bonus plans** — working days, plans, tiers, Show to staff / Show payout (`specs/SPEC-BONUS-TARGETS.md`) | owner | TierGate(MGR via `/setup`) + `isOwnerSync` in page + API | all |
| `/analytics/bonuses` **[2026-10-02]** | **Bonuses** — cards, pace, projected payout, totals, closed periods, Mark paid, CSV, NOT-KEEPER As-of | MH + Operations Manager | TierGate via `NavItem.only = BONUS_ANALYTICS_USER_IDS` + page check | all |
| `/analytics` **[2026-10-02]** | **Analytics** — Safes vs insurance card (per-safe value on hand vs limit, drawer by value, Move… → `/assign?dest=`) above the Bonuses cards (`specs/SPEC-SAFES-INSURANCE.md`) | MH + Operations Manager | `canSeeSafes` page check | all |
| `/setup/containers` **[2026-10-02]** | **Containers** — safes (limit + policy ref) · shelves · bins, parent chain, re-parent every tray / station / shelf bin (D-488) | owner | TierGate(MGR via `/setup`) + `isOwnerSync` in page + API | all |
| `/setup/org` **[10-03]** | **Setup → Organisation** — tabs Entities · Departments · Stations (device registry: device type, camera role, reception, paired kiosk, clock point, intercom presets) · Org tree · Staff (invites, activation status, MH-only disable) (`specs/SPEC-SETUP-ORG.md`, KEEPER D-427 · D-429 · D-426) | manager | TierGate(MGR via `/setup`); **disable / enable = `isOwnerSync` in page + API** | all |
| `/setup/custody` **[10-03]** | **Custody · audit mode** — start / pause / resume / close an audit (whole shop · station group · safe), scan node → bin → items, Unaccounted list, item stubs, coverage % + trend, audit-log CSV (`specs/SPEC-CUSTODY-AUDIT.md`, KEEPER D-432); same panel on `/rw/pad` Audit | manager (desktop); pad = supervisor / manager | TierGate(MGR via `/setup`); audit writes are audited, **not tier-gated** (OPEN) | all |
| `/setup/integrations/watchm8` **[10-03]** | **Setup → Integrations → WatchM8** — export switch per environment (prod · staging · dev, default OFF), class toggles (specimen only), export log (append-only, hash, licence, agreement ref, ack) (KEEPER D-430). Lives **under Setup so the owner-only prod rule inherits** (MH 2026-10-03); **`/integrations/watchm8` redirects here** | manager | TierGate(MGR via `/setup`); **prod switch = owner + agreement ref in the API** (`canToggle.prod`) | all |
| `/time` **[10-03]** | **Time clock** (replaces RGTime, `specs/SPEC-TIME-CLOCK.md`, KEEPER D-426) — Who's in · Week · Flags · Export · Settings; `?tab=` | manager, concierge | TierGate(ALL); **concierge tier = Who's in + own week only**; corrections / flags / export / settings manager-only in the API | all (manager) / own (concierge) |
| `/rwcom` **[v2]** | **rw.com emulator** (phone / desktop frame, entity switch, instrumentation) — NOT KEEPER as an RS screen (`modules/rwcom-emulator.md`) | manager | TierGate(MGR) | — |
| `/help` | help | manager, concierge | TierGate(ALL) | — |
| `/sales`, `/sales/new`, `/sales/:id`, `/sales/pickup`, `/sales/ship` | sales orders (Fulfill ▾ menu, zero-balance MH-only), **Pickup Station — five gated steps** (`specs/SPEC-PICKUP-STATION.md`) **+ v2 gap rows [10-03]** (`specs/SPEC-PICKUP-V2.md`, KEEPER D-414: any-reference open, Gate 2 QBO read, lockout, ≥ $10k kiosk second factor, authorized persons, Reolink stamp, identity photos), ship station (scan gate + manager override) | manager, concierge | TierGate(ALL); pickup exceptions need a **different manager's PIN + reason** in the API; identity photos stripped for non-managers in the data layer | user division (mock path) |
| `/wm-kiosk` | **Watchmaker-room photo kiosk** (common area, guided 4-step + ad-hoc) | — | RequireAuth — left open to any signed-in tier in the prototype; **auth expected: station** | all |
| `/actions/:action`, section placeholders, `*` | placeholders / not found | — | RequireAuth | — |

## B. RolliWorking bench app `/rw` — `RwRoleGuard` → `RwShell` (MoneyContext = `roleKind !== 'watchmaker'`)
| route | purpose | landing for | guard | data scope |
|---|---|---|---|---|
| `/rw` (index) | Bench (desktop-style) | — | RwRoleGuard | own |
| `/rw/bench` | **Bench Pad** (kiosked, PIN board, idle re-lock) | watchmaker (Leo) | RwRoleGuard | own |
| `/rw/pad` | **Supervisor Pad** (WM room) | supervisor (MM, JV) | RwRoleGuard `pad` (`padAllowed` = supervisor/manager) | room |
| `/rw/band` | Band Pad (`RwPadPage room="band"`) — home of band techs / polishers; **Bin** tab (JV bin container custody, `modules/jv-bin-containers.md`) | band_tech (Dre, Sam, Nico, MAM) | RwRoleGuard `pad band` (supervisor / manager / band_tech) | room |
| `/rw/concierge`, `/rw/swo/:id` **[v2]** | Concierge TRACK \| ASSIGN on the pad ("Vendors" tab), SWO hub page | — | RwRoleGuard `pad` (supervisor / manager) | all |
| `/rw/messages` **[v2]** | staff messages page (bubble store) inside the RW shell | — | RwRoleGuard | own |
| `/rw/inspect`, `/rw/inspect/:jobId` **[v2]** | guided-shot / opinion-label rig (`?rig=kiosk\|bench` decides `controlled`) | — | RwRoleGuard — **open to every RW role**; ⚠ the kiosk rig implies a station token | all |
| `/rw/device` **[v2]** | Device check (standalone PWA, rear camera, Touch ID, Web Push note, offline queue, Guided Access note — D-406) | — | RwRoleGuard | — |
| `/rw/hitlist`, `/rw/today`, `/rw/hitlist/:slug`, `/rw/hitlist/:slug/team` | Hitlist inside the RW shell (no $ for watchmakers) | — | RwRoleGuard | own / team |
| `/rw/jobs`, `/rw/jobs/:id` | jobs, job detail (hide-money) | — | RwRoleGuard | all |
| `/rw/parts` | parts | — | RwRoleGuard | all |
| `/rw/qc` | QC lane | — | RwManagerOnly | all |
| `/rw/supervisor` | supervisor board | — | RwManagerOnly | all |
| `/rw/bulk` | Bulk Assign (scan) | — | RwManagerOnly | all |
| `/rw/floor` | shop floor + manager gate scan (`accessTier === 'manager'` inside `gateScan`) | — | RwRoleGuard; gate action manager-only in API | all |
| `/rw/assign`, `/rw/queue`, `/rw/station` | assign/move, work queue, station scan | — | RwRoleGuard `pad` (supervisor / manager only) | all |
| `/rw/wm`, `/rw/history`, `/rw/reports`, `/rw/picking`, `/rw/evidence` | WM room, history lookup, reports, picking, evidence | — | RwRoleGuard | all |
| `/rw/testing`, `/rw/testing/test/:jobId` (`/rt*` redirect here) | timing bench (RolliTime) | — | RwRoleGuard | all |

## C. Public / station / token routes
| route | purpose | landing for | guard | data scope |
|---|---|---|---|---|
| `/kiosk` | **Front-desk check-in kiosk** (walk-in) | — | none — left open in the prototype; **auth expected: station** | none |
| `/time/pad` **[10-03]** | **Time Clock pad** — wall iPad (lock to a clock-point station with a manager PIN → staff cards → Touch ID / PIN → IN / OUT) and NFC tag tap (`?station=<id>`, remembered device = one-button confirm); offline queue, geofence flags (`specs/SPEC-TIME-CLOCK.md`, KEEPER D-426) | — | none — left open; lock = any manager PIN, punch = the person's PIN / Touch ID; **auth expected: station token** | none → one punch |
| `/rg/*` **[10-03]** | **redirects only** (RGTime retired, D-498): `/rg`, `/rg/kiosk` → `/time/pad`; `/rg/clock?station=…` → `/time/pad?station=…` (query kept so printed tags work); `/rg/manager` → `/time`; `/rg/week` → `/time?tab=week` | — | `RgRedirect` | — |
| `/pay/:token` | mock payment page from invoice email | — | mock token, left open in the prototype; **auth expected: token** | one SO |
| `/www` **[v2]** | **public mount of the rw.com emulator** (`?tab=identify\|check\|request`) — where `/rc/request/new` sends visitors without a portal session (D-469); `submitWebRequest` lands an unowned RQ (D-457) | — | none — public by design; **auth expected: none (public form) + bot / rate protection** | none |
| `/track`-style public page | **not built** (P1 — `14 §2`) | — | — | — |

## D. RolliConnect client portal `/rc` — **passwordless since 2026-10-01** (`14-CLIENT-PORTAL-INVENTORY.md`)
| route | purpose | guard | data scope |
|---|---|---|---|
| `/rc` (email → 6-digit code / magic link), `/rc/signup` (redirects into the same flow), `/rc/auth/:token` (magic link, single-use 10 min) | sign-in: `rcRequestCode` → `rcVerifyCode` / `rcVerifyMagicLink`; Touch ID (`rcSignInWithTouchId`) once enrolled; password + TOTP RETIRED | none (public) | — |
| `/rc/home`, `/rc/account`, `/rc/estimates/:id`, `/rc/invoices/:id`, `/rc/watches/:id`, `/rc/messages` | portal (dots + process line on home / watch; Ask → RS Inbox) | portal session (`rcSession`) via `LockWall`; estimate / invoice / parts also open with a LINK token `?t=` | one client |
| `/rc/parts/:id` **[v2]** | parts-approval page (one-tap approve / decline, step-up on approve — D-426) | portal session **or** LINK token | one request |
| `/rc/request/new` **[v2]** | **Request Builder** (client / trade mode) — **signed-in only** (D-469); no session → redirect `/www?tab=request` (the lock wall does not intercept it) | portal session | one client |
| `/rc/pickup/:token` **[v2]** | reverse-QR pickup confirmation (Yes / That's not me), single-use, **2 min**, bound to SO + station | token (public) | one SO |
| `/rc/report/:token`, `/rc/inspection/:token` | tokened deep links (report approvals, inspection form) — doc access toggles in Setup ▸ RolliConnect access | token (`rcDocAccess`: report public by default, form login) | one client |

## ⚠ UNGUARDED list (consumed by the lockdown build) — after the 2026-09-29 fix batch, re-checked 2026-10-02, **re-checked 2026-10-03**
Fixed: `/rw/assign` `/rw/queue` `/rw/station` (pad guard) · `/rw/band` (pad guard + band_tech) · `/hitlist/:slug` (`canViewHitlist`) · division wall on intake / estimates / sales (mock path) · `/setup/access` + owner API checks · pickup exceptions (second-person manager PIN in the API) · **[10-03]** identity photos stripped in the data layer for non-managers (`soRefs`, `staffPhotos`) · WatchM8 prod switch owner + agreement ref in the API · disable / enable owner-only in the API.
Left open in the prototype by ruling, tagged in `05-API-CONTRACT.md`: `/kiosk` (station), **`/time/pad` (station — replaces `/rg/kiosk`)**, `/wm-kiosk` (station), `/pay/:token` (token), **`/www` (public form — needs bot / rate protection, not a session)**, **`/rc/pickup/:token` (token, 2 min)**.
Still ⚠: rows served by the live staging API bypass the division wall (no division on the wire) · `/rw/inspect?rig=kiosk` marks shots `controlled` on any RW session (should be a station token) · `pickupAppendFrame` (client-camera frames) is callable by any staff session (auth expected: station) · Inbox **Views** (owner reads another person's inbox) and tag / pin / archive are not audited (`08` families 51, 59) · `/rwcom` is a staff screen for an emulator that is NOT KEEPER · **[10-03]** custody audit start / close / backfill are audited but not tier-gated (OPEN) · the kiosk second factor (`pickupKioskConfirmOtp`, `pickupKioskIdPhoto`) is called from the counter's session in the prototype (inline kiosk frame) — the real kiosk is its own station.
