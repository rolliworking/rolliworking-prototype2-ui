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
    └── pages/ BadgeSignIn, Dashboard, HitListPage, EstimatesPage, JobsPage, ClientDetailPage, Placeholders
```
Package manager: yarn 1.22 (frontend/package.json sets `packageManager: yarn@1.22.22` to bypass the root
monorepo's yarn@4 corepack check). Supervisor runs `yarn start` in /app/frontend.

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
- P0: SESSION E5 Invoicing / Pickup — wire `invoiceJob` stub, pickup/ship flow from ready_to_ship, "Convert to invoice" estimate stub. Await user PROMPT-PACK-invoicing.md (pack wins).
- P1: Labels section (reuse Label Queue), tier restrictions per intake stage, persist intake/jobs store to localStorage, sales-order convert target
- P1: Repoint `src/api/client.ts` at the real RolliSuite API (Fastify) when ready
- P2: Inspection photos gallery mock, Reports charts, Sales/Purchasing/Inventory tables from fixtures
- P2: Persist hit-list done state to localStorage; owner "assign to me" action
