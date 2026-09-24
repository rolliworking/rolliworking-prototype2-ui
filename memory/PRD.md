# RolliSuite — Prototype UI (Session E1)

## Original problem statement (current direction, June 2026)
Build the shell of an internal ERP web app for a luxury watch service center. PROTOTYPE for internal
evaluation — fake data only. Architecture rule: ALL data access goes through ONE module `src/api/client`
exporting typed functions; screens never fetch directly. Client returns mock data from fixtures in one
folder; later only that module is repointed at the real API.

User choice (this session): standalone prototype app at `/app/frontend` (Vite + React 18 + TS + Tailwind),
zero backend. Legacy monorepo (`/app/apps/rollisuite-api`, `/app/apps/rollisuite-web`, Fastify/Prisma) is
left untouched for reference and is NOT served.

## Users / access tiers
| badge | display | tier |
|---|---|---|
| michael | MH — Inspector · Manager | manager |
| walter | Walter — Inspector · Manager | manager |
| vienna | Vienna — Concierge · Admin assistant | concierge |
| mm | MM — Watchmaker Room Supervisor · Manager | manager |
Duty label is display-only; visibility governed solely by tier. Concierge sidebar: Dashboard, Daily Hit List,
Intake, Estimates, Labels, Help. Direct URL to manager-only route → Restricted page.

## Architecture
```
/app/frontend
├── index.html, vite.config.ts (0.0.0.0:3000, allowedHosts), tailwind.config.js, tsconfig.json
└── src
    ├── api/client.ts          # THE ONLY data-access module (async, 120ms simulated latency)
    ├── api/types.ts           # shared types
    ├── api/fixtures/          # users, clients(25), watches(15), estimates(12), jobs(10), hitList(10), activity(10), time helpers
    ├── auth/AuthContext.tsx   # user + station session
    ├── components/auth/       # StaffCard, SignInPanel, CameraPreview, PinInput
    ├── hooks/useCamera.ts     # getUserMedia + canvas capture
    ├── config/navigation.ts   # NAV_ITEMS (tiers, pinned), QUICK_ACTIONS
    ├── components/layout/     # AppShell (+PrototypeBanner), Sidebar, TopBar, GlobalSearch
    ├── components/ui/         # Card, Table, Button/PageHeader/FilterChip, Pills (StatusPill, OwnerChip)
    ├── components/dashboard/  # KpiCards (KpiRow, DeptPnlStrip), HitListPanel, RecentActivity
    ├── components/hitlist/HitListRow.tsx
    ├── hooks/useAsync.ts, hooks/useHitList.ts
    └── pages/ SignIn, Dashboard, TodayPage, estimates/, jobs/, sales/, workshop/, clients/{ClientsPage,Client360Page}, Placeholders
```
Package manager: yarn 1.22 (frontend/package.json sets `packageManager: yarn@1.22.22` to bypass the root
monorepo's yarn@4 corepack check). Supervisor runs `yarn start` in /app/frontend.

## Implemented — Session E7 Client 360 (2026-06) — tested via testing agent, iteration_14.json, 100% pass
- `resolveIdentifier(q)`: ANY identifier (name / email / phone / company / estimate # / job # / SUB# / tracking incl. shipments / watch ref or serial / SO # / pickup code / request #) → grouped `SearchHit[]`; each hit routes to `/clients/:id?hit=<key>` (record path when no client). Top-bar `GlobalSearch` now wraps `IdentifierSearch` (grouped dropdown, ↑/↓/Enter/Esc, clear); `/clients` page has the same box inline + directory (`getClientDirectory`, recent activity first).
- `/clients/:id` = Client 360 (`getClient360`, read model, no writes): sticky identity header w/ stats (watches · in house, open estimates, active jobs, requests, tasks, balance due, lifetime paid, last contact), left column Watches (groups, per-watch merged history EST/JOB/INV/REQ newest first, open-job link), Estimates (rev badge + expandable prior revisions), Jobs, Invoices & payments; right column Requests, Notes & tasks, Custody (derived: arrived / received / discrepancy / hold placed-released / shipped / picked up), Emails (expandable body, Outbox link). `?hit=` scrolls to + flashes `data-hit` row (`useHitHighlight`, `.hit-flash`).
- New entity `ServiceRequest` (fixtures/requests.ts, new → quoted → closed, source call/email/web/walk_in). Sidebar "Clients" for all tiers. Old ClientDetailPage removed.
- Seed: Naomi Castellanos (c-10) — w-20 Datejust 31 (j-24 E02007 in_service, e-23 E01040 rev 2 w/ seeded rev 1, pk-11 SUB-26-0291 FedEx 794644790132), w-10 OP 41 (e-13/e-10/e-22/e-20, j-08/j-23, so-05), w-21 Tudor BB58 (e-21/e-24, j-25, so-08 SO-25-0042 two payments, picked up 2024); rq-01..03, t-11..13, ob-03..08. Store now preserves fixture `revisions`.
- Docs updated: DECISIONS ×6 (E7), API-SURFACE, DATA-MODEL (ServiceRequest + read models + hitKey convention), STATE-MACHINES 5c/5d, SEED-DATA (Naomi table + search smoke identifiers), DESIGN-PRINCIPLES #16.

## Implemented — Session E6 Workshop lenses + parts chat (2026-06) — tested via testing agent, iteration_12 + 13, all pass
- `/bench` (all tiers): my assigned jobs with next legal action + blocked reason, my holds, pull-next (oldest approved on-hand unassigned, priority first; bench roles only; supervisor-assigned jobs never pullable), my parts requests. `/supervisor` (manager): unassigned bench work + per-tech lists with assign toggles (`supervisorAssign`, audited), parts-approval queue, holds parked under supervisor with logged transitions, QC queue. `/floor` (all tiers): 9 lanes incl. Case cleaning (in-service P/PM-only — provisional), job chips.
- Parts loop: job detail "Parts request" → modal chat with SCRIPTED assistant (`partsAssistantReply`: ref/caliber/alias/keyword scoring over 25-part seeded catalog, no AI) → attach → submit → supervisor approve (confirms part↔ref in `compatibleRefs`, records search terms as `aliases`, logs `association_confirmed` + `alias_added`, places parts hold if possible) / reject (reason, logged). `/parts/knowledge` (manager) shows the log + catalog with aliases. Audit type `parts`.
- Fixtures `parts.ts` (catalog, pr-01..04, knowledge pk-01..03). Docs updated (DECISIONS ×6, STATE-MACHINES 1c, API-SURFACE, DATA-MODEL, SEED-DATA, DESIGN-PRINCIPLES #15). Uploaded Contract v1 HTTP client saved at `/app/docs/reference/contract-v1-client.ts` (future repoint target).

## Implemented — Session E5 Money tail: Sales orders / fulfil / pickup / ship (2026-06) — tested via testing agent, iteration_11.json, 10/10 pass
Built to `/app/PROMPT-PACK-invoicing-pickup-ship.md` (pack wins): SO is the invoicing vehicle.
- `SalesOrder` (draft → open → partial_fulfilled → fulfilled → shipped | picked_up; any → cancelled), lines qty×rate + shipping, stub payment ledger (partial ok, balanceDue/isPaid derived), fulfil = QBO HARD-STOP stub (`qboStatus: queued`, fake id), channel pickup/ship, pickup code (issued on push/fulfil, consumed at pickup), ship-to address + request-info email, `shippingProvider` mock seam (label + tracking + coverage; declared 0<n<1000 ×1000), Shipment + PickupSession records. Custody closes at pickup/ship → job closed, watch released. Admin marks (manager, reason, audited). Unpaid: ship blocked without bypass; pickup allowed with logged bypass. Signature-free pickup (locked decision; pack's signature step dropped). Audit type `sales`.
- Screens: `/sales` list (badges paid/unpaid/shipped/picked up, search incl. pickup code), `/sales/:id` & `/sales/new` (create/edit, actions, payments, hand-back panel), `/sales/pickup` Pickup Station (customer → invoice → verify → photos → complete), `/sales/ship` Ship Station (order → tracking → review → email). Quick actions Ship/Pickup route there. `invoiceJob` now real (job detail "Create invoice (SO)"), `convertEstimateToSalesOrder` wired, tail pill (`tailStage`) on job cards/header.
- Seeds so-01..so-07 across every SO stage + jobs j-21/j-22 ready_to_ship. Docs updated (DECISIONS ×8, STATE-MACHINES 1b, API-SURFACE, DATA-MODEL, SEED-DATA).

## Implemented — MH rulings: inspection-by-kind + pinned hit list (2026-06) — tested via testing agent, iteration_10.json, all pass
- `JOB_KIND_CONFIG.inspectionReport` (service only) + `inspectionPhotos: true` (all kinds). `reviewGaps()` gates leaving in_review (photos every kind; multiple-choice report `INSPECTION_QUESTIONS` for service via `saveInspectionReport`). UI: ReviewGate strip, disabled action buttons, Inspection card (form / summary / "skipped for kind"). small_job approval skip stays provisional (amber).
- Pinned manual layer: `PinnedItem` fixtures, `pinToHitList` (from job `act-pin`, from derived task row hover pin, freeform with `#name`/`#role` prefix via `parsePin`), `dismissPinned`; `/today` shows Pinned card above Derived; dashboard panel shows pinned first; nothing derived hidden. Audit type `pin`.
- Docs updated: DECISIONS (2 MH rulings dated/attributed), STATE-MACHINES (per-kind table + review gate + pinned lifecycle), DATA-MODEL, API-SURFACE, SEED-DATA, DESIGN-PRINCIPLES (#13 amended, #14 added).
- iteration_9.json: "michael1123" password report = user typo; michael123 works.

## Implemented — E4+ Kind / Owner / Today / Tasks (2026-06) — tested via testing agent, iteration_8.json, all pass
- `Job.kind` service | small_job | warranty (orthogonal to workflow/status). `JOB_KIND_CONFIG` lookup: label, defaultOwnerRole (small_job & warranty → concierge), skipStages (small_job skips awaiting_customer_approval — provisional). `legalJobActions` applies skips.
- `Job.owner: Role` (accountable, role-based, resolved to holders via `roleHolders`) ≠ `Job.assignees: string[]` (working techs, toggle multi). "PM" reserved for precious-metals DeptCode. `User.roles[]` added (concierge/manager/inspector/watchmaker).
- `/today` (nav "Today", pinned; /hit-list → redirect): DERIVED per-user view = owner-action jobs (intake/awaiting/ready_to_ship) + bench jobs assigned to me (approved/in_service/testing) + holds I own/placed + discrepancy packages (concierge role / flagging inspector) + open tasks to me or my roles. Dashboard panel shows same rows. Manual hit-list fixture removed.
- Tasks (`fixtures/tasks.ts`, 10): title, assignedTo user|role, createdBy, optional job/watch/client link, due, open|done; "Send a task" form on /today; waiting-on list for creator; linked tasks on job timeline card; audit type 'task'.
- Docs written for handoff: `/app/docs/{DATA-MODEL,STATE-MACHINES,API-SURFACE,DESIGN-PRINCIPLES,DECISIONS,SEED-DATA}.md` (P-17 flags: job_kind ✅, party roles ✅, telemetry ◐, portal grants ✗).

## Implemented — Session E4 Jobs (2026-06) — tested via testing agent, iteration_7.json, all pass
Built to the user's PROMPT-PACK-jobs.md (pack wins over brief). Reconciliations & provisional (amber) items:
- Status enum (DB): intake | in_review | awaiting_customer_approval | approved | in_service | testing | ready_to_ship | closed. Linear machine in `JOB_ACTIONS` (client.ts); only legal actions render as buttons (`legalJobActions`). Extra provisional action: in_review → approved "estimate pre-approved". Testing: qc_pass → ready_to_ship; qc_fail (reason required) → in_service.
- Simple status estimate | on_hand | finished (Shop Time lists on_hand only). Priority low/normal/high/urgent. Job id `E` + 5 digits from own sequence (E02011…; provisional whether it shares the estimate sequence).
- Client emails → Outbox on request_approval / qc_pass / qc_fail (pack silent → provisional). Watch status synced on transitions.
- Holds: parts | outsource, reason required, allowed on on_hand jobs in approved/in_service/testing; status untouched while held (actions blocked), "On hold" board lane; release → prior status; history kept.
- Assignment from staff list; stamped notes; photos (webcam/upload via PhotoCapture); priority/due/condition edits; audit type 'job' on everything (Jobs filter on audit log).
- Estimate wiring: `convertEstimate(id,'job')` = createJobFromEstimate (approved only; lines+watch carried; workflow from received package else line depts; estimate → converted + jobId). `convertEstimate(id,'intake')` = convertEstimateToIntake (sent/approved/converted: existing job → on_hand + intakeDate, else insert on hand). Both reachable from estimate detail actions and list More menu; "Open job" link on converted estimates. Sales-order convert still stub. Invoice action on ready_to_ship/closed = stub (E5). Delete job = manager only.
- Screens: /jobs (board lanes w/ counts + grouped collapsible list, toggle; search job#/client/ref/serial/tech; workflow W/B/P/PM + status chips; URL params), /jobs/:id (watch card w/ estimate + package links, lines w/ dept tags, notes, photos, shop time, timeline, assignment, holds, details), /jobs/new (customer → watch → fields, optional estimate link, on-hand checkbox), /jobs/shop-time (on-hand picker, minutes, note, entries).
- Fixtures: 20 jobs across every status/workflow (2 active holds, 1 released, 1 QC-fail history), 5 shop-time rows. Dashboard KPIs: In progress = approved+in_service+testing; Awaiting pickup = ready_to_ship.
- Files: api/fixtures/jobs.ts, components/jobs/{JobBits,JobBoard,JobTimeline,JobPanels}.tsx, components/ui/Modal.tsx, pages/JobsPage.tsx, pages/jobs/{JobDetailPage,JobCreatePage,ShopTimePage}.tsx. Pack saved at /app/PROMPT-PACK-jobs.md.

## Implemented — Session E3 Estimates (2026-06) — tested via testing agent, iteration_6.json, all pass
Built to the user's PROMPT-PACK-estimates.md (pack wins over brief on rules). Reconciliations:
- Numbers now `E` + 5 digits (E01041…); search strips EST-/E/leading zeros. All fixtures swept (intake, labels, hit list, activity).
- Status enum: draft | sent | approved (PROVISIONAL — staff-recorded, flagged) | converted (list shows "Closed") | expired | declined. `awaiting_approval` removed (dashboard "Awaiting approval" KPI = sent count).
- Money: extended = qty×rate; subtotal = Σ; shipping = Σ shipping-type lines; tax = 0 (8.25% shown "not applied", provisional); total = subtotal. Amount edit back-calcs rate round((amount/qty)×100)/100.
- Fields: single optional watch (existing or new brand/model/ref/serial/part#), valid until (today+30), client/message/internal notes, billing + shipping (mirror), historical read-only, sentAt/convertedAt/approvedAt/declinedAt/declineReason, revision + revisions[] snapshots.
- Screens: /estimates list (search, status chips, page 50, row menu open/print/duplicate/delete, provisional date filter + batch/convert-to-invoice stubs), /estimates/new (client search or new client, watch picker, catalog picker with inherited dept W/B/P/PM, custom lines, drag/arrow reorder, shipping calculator display + add-as-line, quote-context strip), /estimates/:id (draft autosave 450ms; sent → Revise creates rev N+1 keeping prior; mark-as-sent no sent-at; Send/Send again modal w/ context strip → Outbox; Decline w/ required reason; Approve provisional → Create job / Convert stubs not wired; Reopen; print preview; duplicate; delete rules).
- Service catalog fixture (22 items w/ dept + type). 19 seeded estimates across every status incl. one historical.
- Audit type 'estimate' for every action; Estimates filter on audit log.

## Implemented — Session E2 Intake (2026-06) — tested via testing agent, iteration_5.json (all stages pass; receipt-print state bug found & fixed)
- Intake sub-nav (/intake) with 4 stage tabs + live counts + hold count; Outbox (/intake/outbox) and Label Queue (/intake/labels).
- Stage 1 Arrival: scan-first tracking input (Enter = scan, auto-focus, clears & refocuses), carrier auto-detect (1Z→UPS, 12/15 digits→FedEx, 94…→USPS, 10 digits→DHL), signature flag, duplicate-tracking guard, walk-in (client or unknown) → SUB# record. Shelf list with time/by/station.
- Stage 2 Receive Package: /intake/receive/:id — tracking, estimate # scan (lookupEstimate pre-fills client + expected content pills from dept scope), photos via webcam (useCamera) + multi-file upload, content word pills + free-text add, notes, mock drop-off receipt print, Process → status processed + confirmation email queued to Outbox (never sends).
- Stage 3 Work Order: select processed pkg → confirm handwritten WO checkbox → inspection/concierge bin → awaiting_inspection.
- Stage 4 Receive Watch: /intake/inspection scan estimate barcode → /intake/inspection/:id pre-populated (trickle-down): line checklist w/ dept badges W/B/P/PM, expected components derived via DEPT_COMPONENTS, client concerns, ref/serial prefilled + NS button, MANDATORY same-watch fork (findWatchBySerial → watch with job/package history; pk-06 Naomi OP 124300/D7W3F9K2 seeded to trigger; conflict if other client), workflow picker, live discrepancy list (missing component, serial/ref mismatch, extra watch, conflict). Commit → received + 2 labels (pdf417_data + ref_serial, unprinted) or discrepancy_hold with reasons.
- Audit: every action → AuditEvent type 'intake' with who/station/when (Intake filter on /setup/audit-log).
- Fixtures: packages pk-01..pk-10 at every stage, outbox ob-01/02, labels lb-01/02, estimates e-13..e-16, watches w-16..w-18 (status 'expected', excluded from in-house KPI), EstimateLine.dept + Estimate.concerns added. Intake store is IN-MEMORY (resets on reload).
- Assumption noted: any tier can operate all four stages (tier restrictions later).

## Implemented — Round 2 (2026-06) — tested via testing agent, iteration_3.json, 10/10 pass
- Badge sign-in REMOVED. New: staff cards → password → webcam captures one verification photo on submit (useCamera hook; graceful no_camera / denied fallback) → sign_in audit event with photo + station stamp. Failed attempts logged (sign_in_failed).
- Fast switch: header "Switch user" lists users signed in today (derived from audit log) → 4-digit PIN only, no photo. Sign-in screen also offers PIN for in-today users. Mock creds shown on screen: password firstname123, PIN 1234.
- Device-bound station: mocked pre-registered "Front Desk 1" (localStorage). New device → /station-setup (manager select + password + pick/add station). Setup page (manager only): rename station, "Reset registration" (simulate new device), credentials table, audit preview.
- Audit log at /setup/audit-log: events (sign_in, sign_in_failed, sign_out, station_registered/renamed/reset) with photo thumbnails (zoom), station, method, camera status. Capped at 60 entries in localStorage.
- Repo trim: .gitignore + git rm --cached for apps/, packages/, lovable-source/, rolliworking-source/, backend/, root docs/configs. Repo now ships only frontend/, README.md, memory/, .emergent/, .gitignore. Legacy stays in workspace as naming reference only.
- localStorage keys: rollisuite.prototype.{currentUserId,deviceInitialized,stationId,stations,auditLog}

## Implemented — Round 1 (2026-06, session E1) — tested via testing agent, iteration_2.json, 13/13 pass
- (superseded) Badge sign-in, Switch user in persistent header
- Amber "PROTOTYPE — fake data" banner on every screen
- Sidebar (15 items, Hit List pinned/green), tier-filtered; placeholders for unbuilt sections; 404 page
- Top bar: global client search (name/email/phone/company, keyboard nav, dropdown → /clients/:id) + 5 action buttons → /actions/:key placeholders
- Dashboard: 6 KPI cards (clickable to filtered lists), dept P&L strip, Daily Hit List panel with working checkboxes + owner chips, Recent activity (10)
- Daily Hit List page (owner filters, show-completed), Estimates & Jobs tables with status filter chips (?status=), Client detail page

## Backlog
- P0: Next module per E-session order (user to brief + prompt pack). Keep /app/docs/*.md updated after each module.
- P1: Requests create/close actions (Quick action "Request" still a placeholder; ServiceRequest is read-only), client edit/create from Client 360
- P1: Portal grants (P-17 ✗), split-custody warning (pack UNKNOWN, not built), customer/invoice mismatch confirm dialog, real inspection question set, confirm per-kind skipStages
- P1: Labels section (reuse Label Queue), tier restrictions per intake stage, persist intake/jobs store to localStorage, sales-order convert target
- P1: Repoint `src/api/client.ts` at the real RolliSuite API (Fastify) when ready
- P2: Inspection photos gallery mock, Reports charts, Sales/Purchasing/Inventory tables from fixtures
- P2: Persist hit-list done state to localStorage; owner "assign to me" action
