# RolliSuite — Rebuild Specification (as built through 2026-09-27)

Audience: the production rebuild team (Cursor/Claude + real Supabase backend). This documents **what the prototype actually does today**, precisely enough to rebuild from. Anything that is a placeholder, a judgment call, or unspecified is flagged as such — nothing here should be carried forward as a business decision unless marked **RULING**.

Companion docs (older modules, still valid unless contradicted here): `docs/STATE-MACHINES.md`, `docs/DATA-MODEL.md`, `docs/API-SURFACE.md`, `docs/DECISIONS.md`, `docs/SEED-DATA.md`, `docs/KEEPER-HANDOFF/*`, `docs/E17-CONVERGENCE-REPORT.md`. Source of truth for every rule below is `frontend/src/api/client.ts` (mock domain layer), `frontend/src/api/realClient.ts` (live wire mapping), `frontend/src/api/types.ts`.

Legend: **MOCK** = in-memory, resets on reload · **LIVE** = read from `https://rolligroup-prototype-api.fly.dev` · **STAND-IN** = placeholder value/logic to replace · **OPEN** = unresolved question for MH.

---

## 0. Cross-cutting

### 0.1 Roles / tiers / divisions
- `AccessTier = 'manager' | 'concierge'` (only two tiers exist). `Division = 'rolliworks' | 'rollishop'`.
- Staff seed (`fixtures/users.ts`): michael (MH, manager, owner-level), mm (MM, manager, Watchmaker Room Supervisor), walter (manager, RolliShop), vienna (concierge, front desk), **leo** (watchmaker, concierge tier — took over every bench record formerly seeded under the erroneous name "Rosa"), **chyna** (Concierge, concierge tier, no bench data), **joseph** (manager, Band / Polish Room Manager). Passwords `firstname123`, PIN `1234`.
- **RULING (MH 2026-09-27):** "Rosa" was a data error → Chyna, role Concierge. Concierge must never appear as a bench/repair assignee.
- **OPEN (Q91):** what a Concierge card sees on the Supervisor Pad. Today: non-manager on `/rw/pad` gets a read-only *Parts Request History* + Picking tab with an amber "open question" banner. This is a **placeholder, not a ruling**. Cycle-count access for concierge also OPEN.

### 0.2 Hybrid data source
`config.ts → API_SOURCE` decides per function: `real` = `realClient.ts` (HTTP) with automatic fallback to mock + toast (`data-testid="api-toast"`) on failure; `mock` = `client.ts`. `localStorage['rollisuite.api.mode']='mock'` forces all-mock. Endpoint↔function mapping is published by the API at `GET /contract`.

| Function | Source | Endpoint | Notes |
|---|---|---|---|
| signInWithPassword | LIVE | `POST /auth/sign-in` → fallback `POST /auth/switch-user {username, pin, device_id, camera_fallback}` → `session_token` (Bearer) | device-bound UUID per browser |
| getEstimates / getEstimate | LIVE | `GET /estimates`, `/estimates/:id` | `valid_until` mapped → `validUntil` |
| getJobs / getJob | LIVE | `GET /jobs`, `/jobs/:id` | see §6.2 mapping |
| getSalesOrders / getSalesOrder | LIVE | `GET /sales-orders[/:id]` | |
| getToday | LIVE | `GET /today?user_id=` | |
| resolveIdentifier | LIVE | `GET /search?q=` | |
| getRequests | LIVE | `GET /intake/leads` | repointed 2026-09-27 (was `/client-requests`, wrong source) |
| getPackages | LIVE (404 → mock) | `GET /intake/packages` | API side not implemented |
| getDashboardStats / getRecentActivity | LIVE-derived | computed from the three list endpoints | no KPI endpoint |
| everything else | MOCK | — | all writes are MOCK |

**Mock rule (RULING):** never overwrite physical-tracking history; all stamps/timelines are append-only.

### 0.3 Numbering (RULING — keep separate, do not unify)
- Estimates `E#####` (e.g. E02041). Jobs share the estimate number when created from one.
- Portal / web / email / call asks → **`RQ-YY-####`** (ServiceRequest). Live leads from `/intake/leads` are shown as `RQ-YY-XXXX` derived from id — **STAND-IN**.
- Physical no-estimate receiving → **`SUB-YY-####`** (Package.subNumber, `store.counters.sub`).
- Sales orders `SO-YY-####`, parts requests `PR-####`, inspection reports `INSP-<EST>-<3 chars>` (token), legacy client reports `IR-…`.

### 0.4 Suggest → verify (RULING pattern)
Every AI/VLM output (bill audit, scantron extraction, parts alias suggestions, photo tags) is shown for human acceptance and **never auto-commits**. Every learned vocabulary (parts aliases, photo detail tags, inspection preset notes, dial variants, quick tags) grows append-only when a human types a new value.

---

## 1. Intake linear flow (stages 1–7 built)

Shell: `components/intake/IntakeLayout.tsx` — step tab bar with live counts: 1 Arrival → 2 Receive Package → 3 Work Order → 4 Receive Watch → 5 Photos → 6 Inspection → 7 Awaiting Approval (5–7 relocate the former sidebar screens; `pages/intake/IntakeStepPages.tsx`).

### Package (MOCK) — `Package`
`id, subNumber, trackingNumber?, carrier, status: 'arrived'|'processed'|'awaiting_inspection'|'received'|'discrepancy_hold', estimateId?, clientId?, contents: string[] (component names), workflow: DeptCode[], photos: PackagePhoto[], notes?, arrivedAt/By/Station, processedAt/By, workOrderAt/By, inspectedAt/By, componentsVerified?: string[], discrepancyReason?, b2b?: {tier, code, at}, shelfBin?: 'BIN-01'…'BIN-12', scans?: PackageScan[] {id, kind: 'arrival'|'shelved'|'open', at, by, station, trackingNumber?, clientId?, shipmentId?, shelfBin?, matched: 'label_request'|'manual'|'none', note?}, openedAt?/openedBy?`.

### 1.0 Two-scan receive (MOCK, `TwoScanBits.tsx`, client.ts `logArrival` / `shelvePackage` / `openScan` / `getShelf` / `getPackageCustody`)
**Scan 1 — Arrival** (`/intake`, continuous through the day): tracking # → `logArrival` matches an inbound `InboundShipment.trackingNumber` (Part A join key) → client + estimate resolved (`matched: 'label_request'`), else `'none'` → `ShelveCard` offers a manual client pick (fallback, never a dead end) → shelf bin (select or scan `BIN-04` / `bin 4` / `4`, `normBin`) → `shelvePackage`: occupancy check, `shelved` scan event (who/station/time/bin/client), courtesy Sent email **“We have your package — not yet opened”** (distinct from the Stage-2 “received and processed” email; sent once, only when a client is known). Shelf board (`ShelfBoard`, 12 bins) is queryable at any time; corner lookup shows a client's occupied bin chip.
**Scan 2 — Open** (`OpenScanCard` on Arrival + Receive Package list; end-of-day batch): bin / tracking / SUB# → `openScan` logs the `open` event (`openedAt/By`) and routes to the existing `/intake/receive/:id` (Stage 2 `receivePackage` — no duplicated logic). The Stage-2 list “Open” link also fires `openScan`. A package opened without Scan 2 is flagged on the receive page.
**Chain of custody**: `PackageCustodyCard` (receive page, job detail via `job.packageId`), Client 360 Custody section (`custodyOf` emits `arrival_scan` / `shelved` / `open_scan` `CustodyEvent`s), `/rw/history` “Chain of custody · packages” block, corner lookup bin chip. Every row = timestamp · staff · station · bin · tracking — enough to line up with IP-cam footage later.

Transitions: `arrived` (Stage 1 arrival scan) → `processed` (Stage 2 receivePackage: contents pills + photos + client/estimate link) → `awaiting_inspection` (Stage 3 work order) → `received` (Stage 4 receiveWatch commit, no discrepancies) **or** `discrepancy_hold` (commit with discrepancies; reason stored; labels not queued).

### 1.1 Stage 2 — No-estimate branch (MOCK, `NoEstimatePanel`, `matchB2bLabel`, `attachB2bMatch`)
Shown when the package has no estimate. Input = scanned/typed B2B label. **Three-tier match chain, first hit wins:**
1. `tracking`: label equals (whitespace/case-insensitive) an inbound shipment tracking # we issued, or its last 8 chars match (label ≥ 8 chars); **or** label is an estimate number → link estimate (+ client).
2. `account_code`: regex `^(RS|TRD|ACCT|B2B)?-?([A-Z]{2,4})(-|\d|$)` → code compared to trade clients' candidate codes: initials of company/name, first 3 and first 4 letters of company/name, first 3 of last name. → link client only.
3. `name`: label (letters/@/. only, ≥3 chars) substring of first/last/email/company, or every word matches → up to 5 candidates; single candidate auto-selected.
4. `none`: receive under SUB# only; resolve at desk.
`attachB2bMatch` writes `pkg.b2b`, sets `estimateId`/`clientId`, stamps the package. **STAND-IN:** the account-code vocabulary is heuristic; real trade account codes must come from the customer table.

### 1.2 Stage 4 — Receive Watch (`pages/intake/ReceiveWatchPage.tsx`) — the VERIFIED step
Order on screen (RULING from MH brief): (1) scan estimate barcode / type est# or SUB# → `findInspectionPackage` navigates to that package; (2) customer; (3) **What was received** — read-only recap of `pkg.contents`, `pkg.notes`, Scan-1 photos; (4) **Inspector's confirmation** — tap pills for what is physically in hand (`componentsReceived`), free text, "extra watch" flag; (5) component code chips (W/B/P/PM) pre-selected from `ctx.suggestedWorkflow`, overridable; (6) serial + reference with auto-decode; (7) date received = `pkg.processedAt ?? arrivedAt` (read-only); (8) copy of the estimate lines with per-line verify checkboxes + total; (9) Cancel / Save / Save & Print.

Rules:
- **Discrepancies** = expected component not confirmed in hand, serial/reference mismatch vs estimate watch (unless serial = `NS`), extra watch flagged, unverified lines. Any discrepancy → commit sets `discrepancy_hold`, requires reason, queues no labels.
- **Same-watch check:** reference+serial matched against watch history → fork `returning` (same client) vs `conflict` (different client) must be decided before commit. `NS` skips it.
- Commit writes `pkg.componentsVerified`, creates 2 component labels (unprinted); **Save & Print** opens the **label print dialog** (`LabelPrintDialog` in `components/intake/LabelBits.tsx`: preview, include, printer, copies → `setLabelPrinted`); result screen shows printed count + Reprint. Label Queue reuses the dialog for "Print all unprinted". Result screen offers "Start inspection → camera" (`/inspection/new?est=<E#>&camera=1`).
- **Serial auto-decode (`decodeSerial`) — STAND-IN prefix table**, not real reference data: `1601→Datejust 36 cal.1570`, `1603`, `1675 GMT cal.1575`, `5513 Sub cal.1520/1530`, `1680 Sub Date cal.1575`, `16xxx→cal.3035/3135`, `126→cal.3235/3285`, `116→cal.3135/3186`, `[A-Z]\d{6}→letter-prefix 1987–2010`. Order: prefix match on the part before `-` → exact serial in our watch records → reference prefix. Real authentication reference PDFs are **outstanding from MH**.

### 1.3 Trickle-down chain — Expected → Received → Verified (MOCK)
- `Estimate.components?: DeptCode[]` — if absent, **inferred** = unique depts of non-shipping lines with text or price (`inferComponentCodes`). Toggling a chip on create/detail sets explicit codes (`setEstimateComponents`, stamped, cannot be applied to legacy/converted).
- Expected components = union of `DEPT_COMPONENTS[code]` (W→watch head…, B→bracelet/clasp…, P/PM per fixture). Received = `pkg.contents` (latest non-`arrived` package for the estimate). Verified = `pkg.componentsVerified`.
- Row state: verified present → `ok` (expected & verified) / `missing` (expected, not verified) / `extra` (verified, not expected); else received present → `pending`/`missing`/`extra`; else `pending`. `complete` = verified exists; `discrepancies` = count of missing+extra. Surfaced on estimate detail (`ChainForEstimate`), job detail (`ChainForJob`), Receive Watch pills.

---

## 2. Estimates (list/detail LIVE read; all writes MOCK)
`EstimateStatus = draft | sent | approved | converted | expired | declined`. Transitions (mock): draft →(send) sent →(client approve / approve_direct) approved →(create job / convert to intake / convert to SO) converted; sent → declined/expired. Revisions increment `revision`; estStamp append-only.
- `validUntil`: LIVE from `valid_until`. **STAND-IN:** API defaults to created + 30 days when nothing stored — pending a real policy.
- Convert to SO: creates draft SO from non-shipping lines, shipping lines summed into `shippingAmount`; guard: one non-cancelled SO per estimate. Convert to intake: job goes on hand (`simpleStatus='on_hand'`, `intakeDate=now`), estimate marked converted.
- **Requested, NOT built:** per-line checkbox (default checked) so only checked lines convert; unchecked stay open on the estimate with a record of what converted where.
- Component code chips (§1.3) on create and detail.

## 3. Jobs
### 3.1 Status machine (MOCK actions; LIVE read)
`JobStatus = intake → in_review → awaiting_customer_approval → approved → in_service → testing → (awaiting_manager_review, trade lane only) → ready_to_ship → closed`.
Actions (`client.ts` action table): in_review: `request_approval`→awaiting_customer_approval (notifies), `approve_direct`→approved (**provisional**, not in pack); awaiting_customer_approval: `approve`→approved, `back_to_review`(reason); approved: `start_service`; in_service: `to_testing`; testing: `qc_pass`→ready_to_ship (notifies), `qc_fail`→in_service (reason); trade lane testing → `awaiting_manager_review` then `trade_accept`→ready_to_ship (+invoice created, email only if not internal) or `trade_send_back`→in_service (reason); ready_to_ship: `close`. Holds: `HoldType = parts | outsource` (active hold = no `releasedAt`). `JobSimpleStatus` (portal-facing) = `estimate | on_hand | finished`. **LIVE STAND-IN:** `realClient.job()` defaults unknown `simple_status` to `'in_progress'`, which is NOT a member of this union — the API's `on_hand` maps through unchanged; the default must be corrected in the real build.
- Supervisor Pad advance/send-back uses `STAGE_ORDER = approved → in_service → testing → awaiting_manager_review → ready_to_ship`; send-back reasons `rework | waiting_on_part | failed_qc | other`. **Button order RULING:** Send back LEFT, Advance RIGHT everywhere.

### 3.2 Jobs board (`/jobs`)
Tabs: All lanes (status chip filters) · **Queue** = intake, in_review, awaiting_customer_approval, approved · **In progress** = in_service, awaiting_components, on_hold, testing, awaiting_manager_review — columns per tech (unassigned first) with tech + stage chip filters · **Finished** = ready_to_ship, closed. Board/list toggle via `?view=`; tab via `?tab=`. Card = number · client · model · reference · workflow badges · assignees (compact).
### 3.3 All Jobs (`/jobs/all`, manager) — shared category vocabulary (§9).
### 3.4 Job detail — adds verification chain card (§1.3) and decision records; unchanged otherwise.

## 4. Client 360 / ratings (MOCK, internal only)
- Per-staff reviews `StaffReview {by, attitude 1–5, communication 1–5, jobsHandled, note?, at, station}`; one visible row per staff (latest wins, history kept in `reviews.rows`). `N` = jobs for that client where the staff is assignee/creator/timeline actor. **Aggregate badge = rounded mean of latest review per staff**, written through `setClientRating` (its change log records `by`). Seeds rv-01..05. Badge/panel opens from any `RatingBadge`.

## 5. Inbox (MOCK)
Conversation `{id, clientId, subject, status: open|snoozed|closed, anchor?: {kind: request|job|estimate, id}, lastInboundAt, lastOutboundAt, assignee?}`; messages `{direction: in|out|internal, source, by, at, text, readByStaff, cleared?: {by, at}}`.
- `unread` = inbound not `readByStaff`. **`unreplied`** = inbound with `at > lastOutboundAt` and not `cleared`. `needsReply` = open && unreplied > 0.
- **Clear** (`clearMessage`): only inbound, once; sets `cleared`, appends an internal note "Cleared without reply — …", audit entry; no email.
- Thread pane = one collapsible card per conversation of the client (selected/most recent expanded), unreplied badge on cards and list rows. `?group=1` groups the list by anchor (`General` for unanchored).

## 6. LIVE wire mapping (`realClient.ts`) — replace with real schema
### 6.1 estimate(): `estimate_number→number`, `status` as-is, `total_amount→total`, `valid_until→validUntil`, customer → client stub (`client(w.customer, w.customer_id)`).
### 6.2 job(): `number ?? estimate_number ?? id[0:8]`, `customer_id/customer`, `watch_id`, `watch{brand,model,reference,serial}` (else `watch_reference`), `estimate_id`, `workflow_codes→workflow`, `job_kind→kind`, `lines[]→lines` (via `line()`), `total`, `assignee_user_ids→assignees`, `target_date→dueAt`, `created_at`, `owner_user_id→createdBy`, `simple_status→simpleStatus` (default `in_progress` **STAND-IN**), `timeline[] {id, from, to, action, reason, at, by, station}`, `holds[] snake→camel {placed_at, placed_by, released_at, released_by}`. **Status map STAND-IN (Cursor's judgment):** `complete|completed → ready_to_ship`; `awaiting_inspection → in_review`; `awaiting_approval → awaiting_customer_approval`; `awaiting_parts | hold | on_hold → in_service` (our JobStatus has no parts/hold status — holds live in `holds[]`). `department='watchmaking'`, `priority='normal'`, `division` from `entity_id==='rollishop'`, `notes/photos/components=[]` — all **STAND-IN**.
### 6.3 getRequests(): `/intake/leads` → `{id, number RQ-YY-XXXX (STAND-IN), clientId: customer_id, source: wix→web, status: open+awaiting_reply→new, open→in_progress, summary: name · watch_reference · notes, createdAt, createdBy: full_name, station: email}`. Requests page shows live leads with a client stub when unmatched.
### 6.4 Known: watch details/timelines thin on migrated data (expected, not a bug).

## 7. RolliWorking (RW) — Supervisor Pad `/rw/pad` (WM) and `/rw/band` (Band/Polish, Joseph)
`RwPadPage room='wm'|'band'`. Tabs (manager): Dashboard · Jobs · Parts · Requests (= *Parts Request History*) · Audit · Team (+ Picking nav). Room scope: `getPadBoard(room)` — WM = all room jobs in `STAGE_ORDER`; band = jobs whose workflow includes B, P or PM. `ROOM_TECHS = {wm: [Leo, MM, MH, Walter], band: [Joseph, Leo]}` (**STAND-IN roster**).
- **Dashboard** (`getDeptDashboard`): department goal/pace gauge, per-tech pace, funnel, expandable stuck (>`STUCK_WORKING_DAYS` in stage) / problem / awaiting-parts / testing sections, roster, scan-to-open. Revenue MTD = W (or B/P/PM) lines of finished-this-month jobs + quick-add parts. `lineDollars`: lines ≥ 20 000 treated as cents (**STAND-IN** for mixed-unit seed data).
- **Team** (`getTeamGoals`, `setTechGoal`): each member has an individual monthly $ goal (`techRevenueGoals`, seeds Leo 12k, MM 14k, MH 10k, Walter 12k, Joseph 14k); **department goal = sum of the room's team (derived, read-only)**; `setDeptGoal` throws. Pace = actual/(goal × month fraction). Tech "actual" is scaled from component-count goals — **STAND-IN**.
- **Jobs**: cards with Send back / Advance (+ camera). Detail sheet: photo groups (intake / inspection / completed), "Inspection report · condition on arrival", **Sent emails** (`getJobEmails`: Sent rows whose `relatedRef` contains the job #, estimate #, SO #, or a PR # of the job; parts-approval status from the PR: `approved/on_order/received→approved`, `declined/rejected→declined`, else `sent · awaiting client`; estimate emails `approved/declined/sent·opened/sent`). Read-only. **Requested, NOT built:** list-view toggle.
- **Parts**: scan-to-narrow, per-job $ allowance, Quick Add (routes to approval when over allowance), Returns. **Requests** tab = Parts Request History (renamed from Review). PR statuses: `draft | pending | pending_review | awaiting_client | approved | declined | rejected | on_order | received`.
- **Audit** — role-scoped (`auditScopeFor(user)`): `full` for MH/owner (unchanged grid); `wm` for MM (id `u-mm` or dutyLabel ~ "Watchmaker Room Supervisor"): into_safe_head, safe_await_band, safe_await_head, wm_bench_1..3, **stuck_parts_bin** (derived bin: job with active `parts` hold), testing, finished (relabelled *MM Inspection*), pre_queue (relabelled), refinish, polish; `band` for Joseph: band_pre_queue, refinish, polish, into_safe_band, safe_await_head, stuck_parts_bin, final_assembly. Same interaction (pick location → scan/reconcile, amber if stale 7 days). `/rw/station` stays full.
- **Concierge on pad:** see §0.1 OPEN.

### 7.1 RW Reports `/rw/reports` + shared filter vocabulary (§9); Print = US Letter via `@media print { @page { size: letter } }`, `.print-area`, repeating `thead`.
### 7.2 RW History `/rw/history` (kept) + **Corner lookup widget** (`CornerLookup`, RS + RW, bottom-right): name/email/est#/SO#/job# → `searchClients`, `searchJobs`, `lookupEstimate`, `getSalesOrders` filter; RW variant links to `/rw/history?q=` and `/rw/jobs/:id`; hidden on fullscreen pad/bench. No $ amounts in RW.

### 7.3 Shop Floor station map `/rw/floor` (MOCK; `components/rw/StationMap.tsx`, `pages/rw/RwFloorPage.tsx`) — replaces the two-lane dot board
- **Tracks**: WAT = Pre-approval → Pre-queue 🔒 → Assign watchmaker (WM Bench 1–3) → Uncase → *[off-ramp]* → Movement service → Parts approval → Recase + test → Manager safe 🔒 → Final assembly. BRA (split jobs only) = Pre-queue 🔒 → Assign band tech → *[off-ramp]* → QC inspect → Manager safe 🔒 → Final assembly. Shared column: Final assembly → Testing → Finished.
- **Off-ramp (branch-and-return, amber solid vs dashed track)** under each track: Manager safe 🔒 (`mgr_safe_polish_in` / `band_mgr_safe_in`) → Assign refinisher (`polish_room` shared lane / `refinish` band lane — same physical Polish Room) → Manager safe 🔒 (`mgr_safe_polish_out` / `band_mgr_safe_out`). Connectors are an SVG overlay measured from the DOM (`useLayoutEffect` + ResizeObserver).
- **Lock = manager's safe** everywhere (`isSafeStation(k) = k.includes('safe')`, status `waiting`): node shows the owner (Vienna for the polish gates today — MM later; MM for WM safes; Joseph for band safes). Assign-type nodes go dark amber with a “… needed” CTA when any part in them has no tech.
- **Manager gate scans** (`polishGateScan(label, 'in'|'out', 'watch'|'band', assignTo?)`, manager tier only): IN moves the part(s) from the safe to the refinisher (`custodyTech = polisher`); OUT moves them back onto the track (watch → `movement_service`, band → `band_qc`), hands custody to the head's watchmaker, and on the WATCH track marks case/bundled band **complete** (refinish credit to the polisher). Guard: the part must physically be in the gate's safe. Every scan writes `PartMove` history (`via: 'scan'`), a job stamp, an audit row and a `GateScan` ledger row (`getGateScans`) shown under the map as “Chain of custody · manager gate scans”.
- **Bundling rule** (`isSplitFlow(j) = workflow has B && band component`): not split → case + bracelet ride the WATCH off-ramp together (`bundled: true` when a band part exists); a W-only job gets a courtesy-polish `case` part created at the gate. Split (WB/WBP) → bracelet uses the BRA off-ramp via its `BAND-` label; scanning it on the band track for a non-split job throws.
- **Tabs below the map** (`components/rw/FloorPanels.tsx`): Manager gate scan (direction · track auto/BAND- · hand-to polisher `POLISHERS`) · **Bulk assign** — click-to-destination: clicking any station/safe card on the map (`StationMap onSelect`) puts the session into “Assigning to <card>”; scans (`resolveBulkLabel`) only append rows (time · job · client · watch · part; part = band for BAND-/band-lane, case for polish-leg destinations, else head) with per-row remove; **Commit** (`bulkCommit`) moves everything at once — gate destinations (`polish_room`, `movement_service`, `refinish`, `band_qc`) run the manager-gate rules per item (guards, bundling, credit) and report moved/blocked per row; “Hand to” is required for gate IN. The TECH-code “morning handout” (`RwBulkAssignPage`) is kept as a clearly-labelled narrow mode behind a link, not as the general Bulk Assign. · **Component lookup** — one bar: est# / ref# / scanned barcode / client name with type-ahead (`searchClients`, partial first/last name, same pattern as global search); a client → every component with a room/custodian badge (`roomCode`: `W · MM`, `P · Walter`, `B · Joseph`, `FA`/`T`/`✓`), est# per job when the client has several, and the **item label** (1/3, 2/3…) typed on Receive Watch (`ReceiveWatchInput.itemLabel` → `Package.itemLabel` → `FloorDot.itemLabel`; the same page serves band-only jobs — there is no separate Receive Band page). The map dims every other dot and shows est# + badge on the client's dots (`focus`). Drag-drop moves + part history slide-over kept from the old board. Removed station `polish`; seeds j-06 (case in safe-in), j-17 (polish room), j-30 (case in safe-out, band in band safe-in), j-31 band → refinish. Audit scopes updated with the new stations.

### 7.4 Assign / Move `/assign` + AI client-update summary
- **Assign / Move** (`pages/rw/AssignMovePage.tsx`, `components/rw/DestinationMap.tsx`): destination picker built from the same `NODES` as the station map minus Pre-approval/Pre-queue; NO job counts/badges by rule; click node → `BulkPanel` scan session → Commit (`bulkCommit`, gate rules). Single-job lookup bar marks only that job's parts. Also in the RW kiosk nav (`/rw/assign`). Sidebar: top-level item, manager tier.
- **Client-update summary** (suggest-only, never sent): `POST /api/ai/job-summary` → Claude fills {job_status, per_component_status_line, target_date, variant}; template text is assembled client-side (`ai.ts fillSummaryTemplate`), rule-based fallback `localSummaryFields`. Context = `client.ts jobSummaryContext` (station → plain language via `PLAIN_LOCATION`, days at step, open items). UI `components/jobs/JobSummaryDraft.tsx` on job detail + corner lookup (which now expands a job inline with location badges + embedded mini map).

## 8. Inspection
### 8.1 New Inspection form (`/inspection/new`, `/inspection/:id`; MOCK; `fixtures/inspectionForm.ts`)
Top bar: **Scan Label** (job # / estimate # / SUB# → new pre-filled form), **Camera** (§8.2), **Scan Sheet** (§8.3), stage pills *Customer* → *Watch & Inspection*.
Form `InspectionForm`: `customer{name,email,phone}`, `brand, model, reference, estimateNumber, targetWeeks (+from/to dates), deptTags ⊂ {W,B,P,PM,SJ}` (pre-set from the job workflow / estimate chips, overridable), `inspectionType` (Complete Watch | Watch Head Only | Band Only | Movement Only — **STAND-IN list**), `jobType`.
Per component (Dial, Hands, Bezel, Crown, Case, Crystal, Bracelet): `condition` 1 Excellent / 2 Very Good / 3 Good / 4 Fair / 5 Poor / 6 NONE (+7 Waiver on Dial & Hands only); **authenticity** `genuine | not_genuine | genuine_not_correct | undetermined` (RULING labels); `notes: number[]` = indexes into the **learned per-component library** (`NOTE_LIBRARY` seeds, `learnInspectionNote` appends; the displayed number = index+1 and equals the scantron option number); `otherNote`, `extraNotes[]`, `waiver`, `price`, `yesNo` (adds a Yes/No item to the client report). Case extras: `retailPolish`, `caseRestorationPrice`, `weldingPrice`. Crystal extras: `polishUpPrice`, `polishUpYesNo`. Dial extras: `dialVariants` from learned vocabulary (`DIAL_VARIANTS` seeds BUCKLEY, SIGMA, Mk1–3, Tropical, Spider, Ghost, Pumpkin lume, Underline; `learnDialVariant`).
Bracelet repair lines (fixed 6): links (qty×price, Y/N), steel_side (hrs @ $98, Rec/Not Rec, note "polishing will be required if welding is done"), steel_center (hrs @ $98), gold_center (qty×price), foil_thin (qty×price, Y/N), band_polish (0–10 scale, Include-in-email toggle). **STAND-IN:** $98/hr default rate.
Overall: notes, quick tags (learned; seeds incl. "Low Amplitude / Pallet Fork"), price, yesNo, waiver-for-job.
**Total** = Σ component (price + caseRestoration + welding + polishUp if yes) + Σ bracelet (qty×price or hours×rate; scale lines $0) + overall price.
Save: draft (no validation) or commit (requires customer name and ≥1 graded component) → `status='saved'`, `savedAt/By/station`, job stamp, audit; report served at **`/rc/inspection/:token`** (public allow-list, read-only, print). Report content: ROLLIWORKS / Inspection Notes header, customer, watch details, per-component findings (non-genuine authenticity shown), bracelet lines with qty/hours, overall notes, **Yes/No summary** (components with `yesNo`, bracelet lines with yesNo/rec/include, overall yesNo), total. Seed `insp-01` (Calloway, E02040, $1 962).
**OPEN / outstanding:** the real "Inspection Scantron — Rolliworks v1.1" PDF and legacy form screenshots were **not received**; form and extraction were built from the written brief only.
### 8.2 Camera flow (`InspectionCameraFlow`, reuses `useCamera`): shots 1–2 = IPEVO, shot 3 = microscope; **SPACE = shutter**; placeholder frame if no device; photos stored on the form `{source, dataUrl}` (MOCK, base64 in memory — production must use object storage). Chained from Receive Watch save via `?camera=1`. **STAND-IN:** device selection (which camera is IPEVO vs microscope) is not implemented — one stream is used for both.
### 8.3 Scan Sheet — REAL Claude Vision (`POST /api/ai/extract-inspection-sheet`, backend `ai_routes.py`; `ai.extractInspectionSheet`)
Request `{fileBase64 (data URL), mime, fileName}` — image or PDF (PDF pages rasterised). Prompt encodes the v1.1 schema: **green highlighter/circle = selected number; red ink = handwriting**. Response `{components: {Dial|Hands|Bezel|Crown|Case|Crystal|Bracelet: {condition n|null, notes [n], other, price, yesNo, retailPolish?, caseRestoration?, polishUp?}}, bracelet: {links{qty,price,yesNo}, steel_side{hours,rec}, steel_center{hours,rec}, gold_center{qty,price,rec}, foil_thin{qty,price,yesNo}, band_polish{scale,include}}, additionalNotes, confidence 0–1, raw}`. UI `SheetVerify`: one accept checkbox per marked section (defaults: sections with any value), **Apply** maps numbers → form (`applySheetSuggestion`: condition n → key, note n → index n−1, bracelet fields spread), records `sheetScan{at, by, confidence}`. Verified end-to-end on a synthetic sheet (`public/sample-scantron.png`, confidence 0.82). Uses the Emergent LLM key server-side; **production: own Anthropic key, never in the frontend**.
### 8.4 Legacy inspection report (`issueInspectionReport`, `/rc/report/:token`) still exists (grades per component + notes) — the new form report is a **second** path; consolidation is OPEN.

## 9. Shared job filter vocabulary (`JOB_CATEGORIES`, `REPORT_STATUSES`, `QUICK_REPORTS`, `getJobReport`) — used by `/jobs/all` and `/rw/reports`
`openJob` = status ∉ {closed, ready_to_ship, awaiting_manager_review}. `daysUntil(dueAt)`.
Categories: in_progress (`in_service`) · waiting_approval (`awaiting_customer_approval`) · due_4w/3w/14d (open && days ≤ 28/21/14) · warranty (`kind='warranty'`) · outsourced (active hold `outsource`) · awaiting_parts_approval (PR ∈ pending/pending_review/awaiting_client) · parts_on_order (PR on_order) · needing_update_email (in_service && last outbound email for job/estimate > 14 days — **STAND-IN threshold**) · past_due (open && days < 0) · **waiver_required (STAND-IN proxy: open && valueTier high && no note containing "waiver")** · in_testing · awaiting_inspection (intake|in_review). Multi-select = AND, combined with search.
Report statuses: Intake, Inspection(in_review), Waiting Approval, In Queue(approved), In Progress(in_service w/o open PR), Parts Approval, Parts On Order, In Testing, Finished(ready_to_ship|closed|awaiting_manager_review).
Quick reports: at_risk (not started ∧ days ≤ 21) · late (W workflow ∧ approved|in_service ∧ days ≤ 21) · overdue · approval_wait (waitingDays = since last timeline entry — **STAND-IN**) · pending_waivers (proxy above) · parts_status (any open PR). Filters: intake date range, movement-only (W), statuses, categories, Clear.

## 10. QuickBooks Online (`/integrations/quickbooks`) — **MOCK end to end** (no OAuth, no network)
State: connected flag, company/realmId (hash of name), toggles `pushInvoices, pushPayments, pushClients, pullPayments`, fixed mapping table (Client→Customer.DisplayName/PrimaryEmailAddr, SO→Invoice, line dept→Item, Payment↔Payment, tax→TxnTaxDetail), client links `synced | pending | conflict | not_linked` (conflict seeded when email missing or every 9th client on "Sync all" = duplicate DisplayName; resolve link/skip), invoice queue = SOs with `qboStatus='queued'`, activity log. Manager tier only for mutations. Everything here is UI contract only.

## 11. Intercom + storewide paging (`api/intercom.ts`) — **MOCK**, voice-only by design
Stations = seeded stations + rooms + pads. `ring(to)` → `ringing` → `live` after 1.4 s → `hangUp`; one call at a time; busy/offline guards. `pageAll(by, text)` → overlay banner 8 s. **Production seam:** Daily.co audio rooms (TODO comment in file). Not audited.

## 12. Other modules built earlier (see companion docs)
Dashboard, Today/hit list, Clients directory, Requests, Inbound shipments, Labels, Sales orders + payment links + QBO queue, Purchasing/POs, Inventory + cycle counts, Bill audit (Claude Vision, suggest→verify), RGTime clock (`/rg/clock`, service worker, geo gate), RolliConnect portal (`/rc/*`, tokened links), Bench pad, Picking, Floor map, Station scan, Legacy archive display, Screenshot generator `scripts/ipad_screens.py`. Their state machines are in `docs/STATE-MACHINES.md`; SO statuses `draft | open | partial_fulfilled | fulfilled | shipped | picked_up | cancelled`; Package/PR statuses above; `RequestStatus = new | quoted | closed | closed_by_client`; `RequestSource = call | email | web | walk_in | kiosk`; `ConversationStatus = open | snoozed | closed`.

## 12a. Parcel Pro label request — client form → staff one-click Send (MOCK adapter, `api/carriers/parcelpro.ts`)
- **Client** (`rc/RcSendWatch.tsx` on `/rc/estimates/:id`): Name · Street/City/State · **Insured value** · **1-day / 2-day** → `portalRequestLabel(clientId, estimateId, {address, insuredValue, serviceLevel})` → `InboundShipment` stage `label_requested` with `request: LabelRequestDetails {name, street, city, state, zip?, insuredValue, serviceLevel, submittedAt}`; `declaredValue = insuredValue`, `service = serviceName(carrier, level)`. Nothing is purchased yet.
- **Staff** (`/shipping/inbound` · 1 · Label Requests): columns Ship-from · Insured value · Service · Requested · Age; **Send** (`ship-send-<id>`, `sendLabelRequest`) purchases straight off the request; **Edit…** opens the old sheet (`createInboundLabel`, now also takes `serviceLevel`). Both call `parcelpro.purchaseLabel(PurchaseLabelRequest {reference, shipFrom, shipTo: SHOP_SHIP_TO, carrier, serviceLevel, insuredValue, signatureRequired})` → `PurchaseLabelResponse {confirmationId, trackingNumber, labelUrl (PDF), service, insured {bound, value, premium}, postage, total}` — one call = label + insurance bound. On success: `trackingNumber` (join key for Scan 1), `labelUrl`, `cost`, `confirmationId`, stage `label_sent`, label email queued to Sent, stamp “label purchased (Parcel Pro mock) · PP-…”. Tracking panel shows confirmation + what the client requested.
- **One-line swap**: `PARCELPRO_API_KEY` at the top of `parcelpro.ts` (`parcelProMode()` = `mock` | `live`); the inbound page header shows the mode. `createLabel()` kept as a thin wrapper for older callers (PO labels).

## 12b. Vendors (`/purchasing/vendors`, `/purchasing/vendors/:id`) — MOCK, one vendor record
- **Record**: `Vendor` = name · contact (person / email / phone) · payment terms · `accountRef` (our # with them) · `minOrder` · `preferredMethod` · `leadTimeDays` · `shippingNotes` · notes · `active` · `createdVia` (`seed | vendors_screen | csv_import | po_line`). Same record whichever way it was born — CSV import, PO-line auto-catalog and the Vendors screen all write `rs.vendors`; parts (`vendorIds`), POs (`vendorId`) and price history (`vendorId`) reference by id, so an edit shows everywhere at once.
- **API**: `saveVendor(VendorInput)` (create/edit, duplicate-name guard), `setVendorActive`, `getVendorSummaries()` (parts linked = `vendorIds` ∪ history rows; last order = max PO sent/created ∪ history date; avg turnaround = mean sent→received over received POs; open POs), `getVendorDetail(id)` (parts ranked by last price paid to this vendor with avg-all-vendors and "cheaper elsewhere" flag; open / past POs; history rows).
- **Rule**: inactive vendor drops out of Generate PO (`gen-po-vendor`) and New PO (`po-vendor`) pickers; stays in PO list, vendor list (dimmed, Reactivate) and purchase history.
- **Units fix**: `inv.history.unitPrice` is CENTS (seed + CSV + `receivePurchaseOrder`); `partPricingSync` now returns DOLLARS (same scale as PO `unitCost`), so price-vs-average colouring, vendor hints and Generate PO unit costs are on one scale.
- Seeds: 5 existing vendors + **Swiss Supply Geneva** (`v-swiss`, all new fields, `createdVia: vendors_screen`).

## 12c. MH Hitlist access — OWNER ONLY (not manager tier)
- `OWNER_USER_ID = 'u-michael'`; `NavItem.ownerOnly` → `canAccess(item, user)` used by the sidebar (`navForUser`) and the route `TierGate`; `getHitlist()` throws for any other account. Vienna / MM / Walter / Joseph see neither the nav entry nor the data. Rationale: the bypass feed tracks staff who may hold manager access themselves.
- Verified end to end (iteration_51): receiving-camera bypass on Receive Package, payment-release bypass at Ship (green, 0 min) and Pickup (red, >10 min) all fire `logBypass` and land on `/hitlist` with staff · station · time · job/SO# · invoice $ · minutes since payment.

## 12d. Schedule / booking rules · Arrival bulk + Scan 2 camera · Template managers · Price units (2026-09-28)
- `api/appointments.ts`: `BookingRules` (per-weekday hours, 30-min slots, capacityPerSlot, overrides, lead/max-ahead, enabled types, required refs, closedDates, confirmation) → `slotsFor(date)`, `validateBooking(input, source)` = the single rule set for the EXTERNAL booking page and the internal `/appointments`; `saveAppointment`, `setAppointmentStatus`, `setClosedDate`, `getAppointmentsToday` (on every `/today`).
- Arrival Scan 1 = bulk session → `commitArrivals` (logArrival + auto bin + shelve + one audit row); Scan 2 = single → `openScan` → `/intake/receive/:id?camera=1` → `InspectionCameraFlow`.
- Email templates: `MessageTemplate.audience/usedBy/active`, `setTemplateActive`; new keys `po_email`, `receiving_report`, `appointment_confirmation`, `package_accepted`.
- Job templates: `api/jobTemplates.ts` (`JobTemplate` with `depts` vs `inferredDepts`, `reviewed`, `archived`; `reviewJobTemplate` = VB10-04 one-time review) — UI under Bill Audit tab.
- Money: every price store is DOLLARS (purchase history converted at source). Cycle count has no threshold/pin — `CycleCount.gainLoss` report only.

## 12e. Spec items 5–7 shipped (2026-09-29) — see DECISIONS D-389 / D-390 / D-391
- **5 Paging + one-shot messages**: `api/intercom.ts` zones (`PAGE_ZONES`, `zoneOfStation`, `pageTargetsMe`), `api/hitlist.ts` (`sendMessage`, `claimMessage`, `markMessageDone`, `getSent`, `messageStatus`, station targets), UI `components/layout/MessageComposer.tsx` (+ `useDictation`), `MessagesPopover.tsx` (top bar), `components/rw/pad/PadComms.tsx` (pad tab), `InboxPanel` Done / Claim / status chips. MOCK; Daily.co seam untouched; dictation = browser Web Speech API. STAND-IN: station targeting = the station id in the device session.
- **6 One photo pipeline**: `addJobPhoto` / `addJobPhotoSync` + `PHOTO_TYPES`; four entry points route through it; `PhotosPanel` type chips + lock. Photos remain base64 / object URLs in memory (STAND-IN → object storage).
- **7 Access control panel**: `/setup/access` owner-only; `canAccess` honours per-user overrides; log + audit. STAND-IN: overrides live in localStorage of the device — Keeper stores them server-side per user.
- **8 Concierge module**: spec pending from MH.

## 13. Consolidated STAND-INS to replace in production
1. Job status map `complete→ready_to_ship`, `awaiting_parts/hold→in_service`; default `simpleStatus`, `priority`, `department`, `division` derivation. 2. `valid_until` = created+30 d. 3. Lead numbering `RQ-YY-XXXX` from id. 4. Serial prefix decode table. 5. B2B account-code heuristics. 6. `lineDollars` cents/dollars heuristic. 7. Team "actual" scaled from component-count goals; roster lists. 8. Waiver-required proxy; 14-day update-email threshold; approval wait-time origin. 9. $98/hr bracelet rate; inspection type list. 10. Camera device assignment (IPEVO vs microscope). 11. Base64 photos in memory (→ object storage). 12. QBO and intercom entirely mocked. 13. Audit scope membership lists (WM/band) and `stuck_parts_bin` derivation. 14. Concierge pad placeholder view.

## 14. OPEN questions (unanswered)
- Q91: Concierge access on the Supervisor Pad + cycle-count access.
- Real scantron PDF / legacy inspection form screenshots (field mapping ground truth); authentication reference PDFs; Q48/Q49.
- Estimate `valid_until` policy. Whether API "complete" truly means ready-to-ship.
- Consolidate the two client inspection reports (legacy graded report vs new form report)?
- Band room audit locations and roster confirmation (Joseph).
- Which real trade account codes exist for tier-2 B2B matching.

## 15. Queued build items (requested, not started)
(none — the Polish off-ramp station map shipped, see §7.3)
