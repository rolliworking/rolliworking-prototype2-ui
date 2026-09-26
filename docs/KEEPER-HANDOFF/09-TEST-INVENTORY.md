# 09 — TEST INVENTORY (regression checklist KEEPER must also pass)

One section per testing-agent iteration (`/app/test_reports/iteration_N.json`). Each verified acceptance line is restated as a checkbox. KEEPER passes when every box can be ticked against the production build (same behaviours, different implementation).

## Iteration 1

_Completed E2E testing of RolliSuite ERP - 7 core modules (Dashboard, Customers, Estimates, Jobs, Sales Orders, Watches, Parts). Backend: 18/18 tests passed. Frontend: All modules functional after fixing auth token bug in useWatches.ts and useParts.ts hooks._


## Iteration 2

_Full end-to-end frontend testing of RolliSuite prototype (Vite + React 18 + TS, no backend, fixture-driven). Executed all 13 features listed in the review request. Result: 12/13 features fully working, 1 minor data-fixture discrepancy (MM hit-list count). No console errors, no critical issues._


## Iteration 3

_RolliSuite prototype ROUND 2 (staff-card sign-in with password + webcam photo, PIN fast-switch, device-bound stations, audit log). All 10 features in the review request verified end-to-end via Playwright against the public preview URL. 10/10 pass, 0 console errors._


## Iteration 4

_RolliSuite INTAKE flow (Session E2) round: partial verification. Stage 1 Arrival, Stage 2 list/detail-navigation, and outbox tab were exercised successfully. However multiple data-testids explicitly named in the review request DO NOT EXIST in the current DOM, blocking clean scripted verification of counts, row-level navigation, and hold-count assertions. Recommend main agent add these testids and re-test._


## Iteration 5

_Full RolliSuite INTAKE Session E2 four-stage flow verified end-to-end in a single SPA session. Every requested data-testid now exists and behaves per spec: tab counts (arrived=3/processed=2/awaiting_inspection=3/received=1), hold-count '1 on discrepancy hold', arrival-receive-<id>, receive-open-<id> (real anchor links), receive-row-<id>, wo-row-<id>/wo-select-<id>, inspection-open-<id>/inspection-row-<id>, label-<id>-toggle/label-<id>-state. Stages 1-4 (arrival scan+duplicate hint+walk-in, receive-package with estimate match+auto-pills+custom pill+photo upload/remove+process, outbox generation, work-order commit with bin, inspection scan/fork/clean/discrepancy paths, label queue toggle+state…_


_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- Inspection detail (pk-07): `[data-testid='line-check-0']` checkbox input is covered by a decorative <span>; Playwright clicks are intercepted unless force=True. Not a functional bug for humans but a data-testid on the clickable label would improve testability.

## Iteration 6

_Full E3 ESTIMATES module verified end-to-end in one SPA session (manager MH). Every spec bullet passes: list (19 rows) + all six status filter counts (draft 2, sent 4, approved 5, converted 6 shown as 'Closed', expired 1, declined 1); search variants ('EST-1042', 'E01042', '1042', 'vance', 'okafor@') resolve correctly; est-date-filter + provisional-tag rendered on the list header. Row-menu print/duplicate/delete flows all work: est-print-e-17 opens print-preview & closes; est-duplicate-e-17 → new draft with number E01059; deleting the new duplicate removes it; deleting e-13 shows 'An intake package is linked to this estimate'; deleting converted e-01 shows 'Converted estimates cannot be dele…_


## Iteration 7

_E4 JOBS module verified end-to-end against the review spec. Jobs board renders 9 lanes (intake=2, in_review=2, awaiting_customer_approval=1, approved=2, in_service=3, on_hold=2, testing=2, ready_to_ship=2, closed=4 = 20 total). Search auto-focuses; 'E02014', 'Lindqvist', and serial 'P4M8Q1Z6' all narrow to j-04. wf-filter-W and job-filter-intake narrow lanes correctly. view-list opens grouped [data-testid=jobs-table] with group-toggle-closed collapsed by default; expanding + clicking job-row-j-01 navigates to /jobs/j-01. Full state machine on j-12 works: act-start_review → In review (timeline 'Review started' by MH · Front Desk 1), act-request_approval → Awaiting customer approval (timeline …_


_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- Dashboard KPI 'In progress': Spec: In progress = approved+in_service+testing. Seed fixture makes that 2+3+2=7, but the KPI shows 9 — appears to include in_review (2) as well. Either the KPI formula or the spec should be reconciled.

## Iteration 8

_Frontend-only verification of RolliSuite E5 changes: job KIND (service/small_job/warranty) + per-kind config, ROLE-based owner (separate from assignees), derived /today per user (replacing manual hit-list), and cross-assigned tasks with waiting-on / linked-tasks. All 10 requested scenarios PASS. Backend testing skipped (in-memory prototype, no backend)._


_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- /setup/audit-log: `audit-filter-job` is a filter chip button (not an input). The review request phrased it as if it accepted a job value; behavior is fine but naming suggests input. Cosmetic only.

## Iteration 9

_Frontend-only verification of sign-in behaviour on /sign-in for the RolliSuite prototype. Reproduced the user's report: typing 'michael1123' on the michael card returns a visible 'Incorrect password' error and does not navigate — this is a user typo, NOT a bug. The correct password 'michael123' signs in successfully and lands on the dashboard with 'MH — Inspector · Manager' header. walter/walter123 and mm/mm123 also sign in successfully. Trailing space in password is (correctly) rejected — no silent trimming. Audit log shows a 'Sign in failed' row for the michael1123 attempt as expected._


## Iteration 10

_Frontend-only verification of two new MH rulings (Inspection by job kind + manual Pinned hit-list). All 9 spec scenarios exercised end-to-end across michael, vienna, and mm sessions on the deployed preview URL. Every observable behaviour matches the spec: review-gate booleans, inspection form validation + save flash, photo requirement across all job kinds, small_job/warranty skip of the report (inspection-none) with photos still required, kind-specific action buttons (approve_direct only for small_job), auto-transition to Awaiting-customer-approval and Approved after upload, no review-gate on jobs past review, seeded photo on j-16, pin-modal prefill (job + task), Vienna/MM pinned lists, dism…_


## Iteration 11

_Frontend-only verification of E5 (SESSION) — Sales Orders as invoicing vehicle, QBO push (stub), stub payment ledger with partial payments, Pickup Station, Ship Station, custody-closes-on-pickup/ship, job invoice + estimate-convert wiring, and admin marks. All 10 spec scenarios exercised end-to-end on the deployed preview URL as michael and vienna. Every observable behaviour matches the spec except one minor search UX nit noted below. Zero console errors observed on /sales, /sales/so-*, /sales/pickup, /sales/ship, /sales/new and /jobs/j-02 (only a pre-existing React key warning inside InspectionPanel which is unrelated to E5)._


## Iteration 12

_E6 frontend-only verification on the preview URL. Signed in as mm/mm123 (manager) and vienna/vienna123 (concierge). Exercised Bench view (/bench), Supervisor board (/supervisor), Parts request chat + approve/reject loop, Parts Knowledge page (/parts/knowledge), Shop floor map (/floor), assistant fallbacks (thing / gasket 126610 / mainspring 3235 / empty send), rejection path + knowledge log, and manager-only nav for concierge. All primary spec expectations are met with 0 console errors on /bench, /supervisor, /floor, /parts/knowledge and /jobs/j-01 with the parts modal open. One functional issue found: after pulling E02020 the pull-next card shows 'Nothing waiting' instead of E02025 (spec ex…_


## Iteration 13

_Retest of the two E6 fixes from iteration_12. Both fixes verified working on preview URL with 0 console errors. (1) After mm pulls E02020, pull-next card correctly refreshes to E02025, then to bench-pull-empty 'Nothing waiting — supervisor-assigned jobs are never pulled by others.'; bench-job-j-10 and bench-job-j-15 both appear in My jobs. (2) Vienna (concierge) sees bench-pull-empty text 'Pull-next is for bench roles (watchmaker / inspector).' and NO bench-pull-next button rendered. (3) Regression pass: Michael (inspector) sees pull candidate E02020 and bench-job-j-05 / j-18 present._


## Iteration 14

_E7 Client 360 tested end-to-end. All acceptance criteria pass: /clients directory (25 rows, Naomi c-10 near top at row 7, autofocused clients-search-input); Client 360 page for c-10 renders full data (3 watch groups w-20/w-10/w-21 with correct history rows and open-job link, 7 estimates newest-first with E01040 rev-2 badge and expandable revision e-23-1, 4 jobs, 2 SOs with 3 payments, 3 requests with request-estimate-link-rq-01, notes/tasks card with '2 open tasks · 8 notes', 10 custody rows newest first, 6 emails with expandable body). All stats match spec (Watches '3 · 1 in house', Open estimates 2, Active jobs 1, Requests 2, Tasks 2, Balance $0.00, Lifetime $935.00). Global search resolve…_


## Iteration 15

_E8 RolliConnect (client portal) end-to-end. Verified: /rc login (draft banner, no staff nav leak, three demo buttons, unknown-email error, magic-link redemption to /rc/home), session guard (signed-out redirect + portal-404 for unknown /rc paths when signed in), sign-out. Eleanor: Needs You lists exactly 1 estimate item; approve flow shows decided text; watch status transitions to 'Queued for the bench'; state persists across reload. Decline flow (fresh state): reason required, decline recorded with reason text. Harrison: watch 'On the bench', documents (3 items incl estimate link), history (~15 plain-language rows), messages page shows msg-01/msg-02 with context; client-sent message appears.…_


## Iteration 16

_Closing regression pass. New E8 follow-ups (a) message read-state persists across reload and (b) client-side request close with reason picker — BOTH PASS end-to-end and replay correctly. Spot-checked prior coverage (E5/E6/E7/E8): role/nav for u-michael (sidebar renders full manager set including Dashboard, Today, Clients, Inbox, Intake, Estimates, Jobs, Bench, Supervisor, Floor Map, Parts Knowledge, Sales, Setup and more), universal search resolvers all resolve to correct entity groups (Naomi→client, E01040→estimate, 794644790132→package SUB-26-0291, W4T9L36N→watch, SO-25-0042→sales order, RQ-26-0041→request, zzzzqq→global-search-empty), /clients/c-10 renders (Watches 3 · 1 in house, Request…_


## Iteration 17

_Iteration_17 second-half regression covering concierge role, E5 Sales/Pickup/Ship, E6 Bench/Supervisor/Floor/Parts chat, and E8 Eleanor+Grace portal flows. ALL scoped items pass. No blockers found; no console errors observed (React Router future-flag warnings ignored).  CONCIERGE (u-vienna): sidebar renders exactly {Dashboard, Today, Clients, Inbox, Intake, Estimates, Bench, Floor Map, Sales, Labels, Help}. /jobs, /supervisor, /parts/knowledge, /setup → RestrictedPage (data-testid=restricted-page). /today, /bench, /floor, /sales, /clients, /inbox all render for vienna. /today renders rows for u-michael and u-mm; dashboard OK for u-mm and u-vienna.  E5 SALES LIST + DETAIL (vienna): /sales sho…_


## Iteration 18

_Division ruling + hit-list quick-add upgrade: All 14 scoped tests pass on a Rolliworks session (st-01, u-michael). TopBar shows 'Front Desk 1 · ROLLIWORKS' badge and + quickadd button. Today subtitle shows 'division: Rolliworks'. Staff hit lists modal shows MH (both), Vienna, MM — Walter absent. QuickAddOverlay opens via + button and Alt+T, @vi autocomplete shows Vienna, @vienna Call client #1 → toast 'Pinned to Vienna's list'. PinForm @mention routes correctly via parsePin (API logic confirmed). # syntax backward-compat works. AssigneeSelect and NewTaskForm show only Rolliworks staff. Alt+T on /jobs/j-01 shows 'job j-01 attached' context label. Walter's Today (switched to st-rs RolliShop se…_


_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- PinForm (Today · Pinned card): When @mention (e.g. @vienna) is typed in the pin text input, the 'For' select does not update visually to reflect Vienna — it stays on MH. The API correctly routes to Vienna via parsePin, but the UI can mislead the user into thinking it's pinning to MH. Consider syncin

## Iteration 19

_E9 session validation: sign-in, POLISH 1 (pickup code verify with wrong→error/correct→advance), Purchasing (5 POs / 5 vendors / receive PO-02 → status 'Received — awaiting approval' with received qty stamped), Inventory (5 low-flags on stock tab, 6 rows on low-tab, create-po link opens pre-filled po-create-modal, adjust with empty reason → 'A reason is required', with reason → new movement, cycle-count location select + start), Labels (25 pickable rows, queue count updates), Reports (funnel/throughput/aging/pnl tabs all render tables, reconcile line shows dashboard stats), Accounting (7 invoices, 7 payments, 6 QBO rows across states), Integrations (tiles with health badges), Help (4 role qui…_


## Iteration 20

_E10 Companion Panel — full frontend validation. Panel toggle (topbar-companion-btn / Alt+M / companion-close), amber scripted banner, and four tabs all wired. PRICE MEMORY resolves 16234 via reference and 2010 daytona via year with candidates & evidence; Verify moves a candidate to verified badge and re-asking ranks it #1; stale pt-02 badge shows on '16613'; 'widget' shows a clarify. ASK THE SHOP returns the WR and Turnaround cards; unknown 'do we service omega' shows ask-miss + route creates a new open routed item AND a /today task; answering the seeded rq-ask-01 creates a new knowledge card (kc-*), flips status to answered→kc-…, and re-asking 'cellini quartz' returns the new card. CLIENT B…_


## Iteration 21

_Retest of E10 Companion after iteration_20 fixes. 4 of 5 fixes verified. PRICE clarify for model-only 'crown for a daytona' still FAILS — the resolver's clarify branch returns clarify text but priceMemory() text-selection logic still surfaces the candidate-list message because part-matching still produces candidates; the amber-styled 'Which year' question never renders. All other regressions are fixed: (a) BRIEF service_debt now reads '90 days late (E02018)' (in the 85–95 range) with ZERO React duplicate-key warnings on /clients/c-10; (b) LABELS pill testids use double underscores exactly as spec — 'pill-ev-05-dial__original' and 'pill-ev-05-hands__correct' exist; selecting both + label-save…_


## Iteration 22

_E14 Comms Hub end-to-end verification as MH. All spec items pass: five inbox views with exact counts (needs_reply=2, mine=0, open=3, snoozed=1, closed=1), needs_reply ordering (cv-05 Naomi first oldest, then cv-01 Harrison), unread badge + 'waiting 5h' age on cv-01. Thread cv-01: anchor chip 'Job E02011 →' → /jobs/j-01, msg-source badges (staff, portal, internal note · never sent, email), tokens RT-CV01-1/RT-CV01-2, msg-matched-cm-05 '↩ matched RT-CV01-2'. Assign→MH bumps mine to 1; /today shows today-open-thread-cv-01 with text 'Reply to Harrison Whitfield · Submariner service — progress' and href /inbox?thread=cv-01. Template job_in_progress preview renders REAL values ('Hello Harrison,' +…_


## Iteration 23

_E15 verified: Portal inspection report page (/rc/report/:token), staff 'Issue inspection report' loop on job page, short {portal.link} notification templates, RolliConnect home surfacing 'Review the inspection report'. All primary acceptance items pass; two minor deviations noted below._

- [ ] V1 shows rc-report-superseded banner and auto-forwards to V2 within ≤3s
- [ ] V2 head reads 'Cosmograph Daytona' version 2
- [ ] rc-report-grades renders exactly 8 rows; rc-grade-Gaskets='Needs replacing'; rc-grade-Movement='Worn'
- [ ] rc-report-notes mentions estimate E01042
- [ ] Decision card shows rc-report-approve and rc-report-decline
- [ ] Decline with empty reason → rc-error 'Please tell us why'
- [ ] Approve → rc-report-decided 'You approved this report on …'; decision card removed
- [ ] Invalid token /rc/report/NOPE → rc-report-error
- [ ] j-11 shows report-status-rep-01 'superseded' + report-status-rep-02 'issued', links /rc/report/IR-ELEANOR-V1 and /rc/report/IR-ELEANOR-V2, status 'awaiting customer approval'
- [ ] j-18: report-issue-open disabled with 0 photos; enabled after PhotoCapture upload
- [ ] report-form → grade Gaskets=replace + notes → report-issue → toast 'Report issued · notification queued to Outbox' and new row with link /rc/report/IR-E02028-V1-BCQC (matches IR-E02028-V1-…)
- [ ] j-18 status flips to 'awaiting customer approval'
- [ ] Outbox top email: subject 'Your inspection report is ready — Datejust 36', 4-line body 'Hello Hannah,' + inspection body + '▶ https://…/rc/report/IR-E02028-V1-BCQC' + signature, NO unfilled {{…}} tokens, NO line items
- [ ] Composer template 'inspection_ready' on cv-01 preview: 4 non-empty lines, 'Hello Harrison,' + '▶ http…/rc/watches/w-01' (falls back to watch page — no issued report on j-01), no {{…}} leftovers
- [ ] /setup lists inspection_ready, invoice_ready, evidence_available (9 templates present in fixture)
- [ ] RolliConnect magic-link flow: /rc → email → /rc/auth/c-02-<token> → /rc/home; Needs-you shows 'Review the inspection report for your Cosmograph Daytona'; watch card has rc-watch-report-w-02 'Inspection report ready →' linking /rc/report/IR-ELEANOR-V2

## Iteration 24

_E12 RolliTime timing bench — end-to-end frontend testing of /rt shell, sign-in, testing queue, scan resolution, Witschi-style timing test page, auto-evaluation, PASS + REJECT flows, watch history append-only, job page timing card, Outbox notifications, integrations tile, and audit-log rows. All spec bullets verified pass._

- [ ] /rt with no staff session shows rt-sign-in card grid (rt-card-u-michael present); wrong password → rt-error 'Incorrect password'; correct michael123 → rt-queue-page; header rt-user shows MH; rt-sign-out present.
- [ ] Queue: rt-queue-count '2 jobs in testing · oldest first'; rows rt-queue-j-05 (E02015 Submariner) and rt-queue-j-16 (E02026 Lady-Datejust) with caliber label (Generic mechanical (provisional) shown since ref 279174/116610LV do not match seeded refPrefixes — matches spec's 'watch tolerance may be generic — fine' note).
- [ ] Scan E02026 → /rt/test/j-16. Scan E02011 (in_service) → rt-scan-error 'E02011 is in service — only jobs in testing can be timed'. Scan NOPE → rt-scan-error 'No job matches that label'.
- [ ] Test page /rt/test/j-16: rt-job-card renders E02026 + brand/model/ref/serial + tolerance label + status testing · MM; rt-row-DU..CR each with rate/beat/amp inputs; rt-lift prefilled to 52 (generic liftAngle=52 for unmatched ref 279174; caveat below).
- [ ] timing-history seeded rt-panel shows timing-test-tt-01 with rose (REJECT) styling; timing-verdict-tt-01=REJECT; no 'tech override' badge (suggested=reject=verdict).
- [ ] rt-pass and rt-reject disabled until 18 readings + reserve filled.
- [ ] Out-of-tolerance highlight: rt-DU-beat=1.5 gives class border-rose-400.
- [ ] Fill all six positions rate=2 beat=0.3 amp=250 reserve=50 → rt-avg-row shows AVG +2 Δ 0 beat 0.3 amp 250; rt-eval renders 'Suggested: PASS'.
- [ ] Change rt-CL-rate=40 → rt-suggested 'Suggested: REJECT' with flags 'Δ 38 s/d ≥ 30'.
- [ ] REJECT with empty rt-reason → rt-error 'A rejection reason is required'.
- [ ] Reject with reason 'Amplitude drift after 24h' → rt-done 'E02026 rejected — back to in progress under MM' + Outbox notice line; new timing entry in done panel with tech override badge (auto suggested pass).
- [ ] rt-back-queue returns to queue; queue count drops to 1 job; rt-queue-j-16 removed.
- [ ] In-app nav to /jobs/j-16: status pill 'in service'; timeline mentions 'Amplitude drift after 24h' rejection reason; job-timing-card shows 2 tests (new REJECT + tt-01) for this watch, newest first.
- [ ] Outbox top email (Intake → Outbox): E02026 present, subject/body reflect back-to-in-progress notice.
- [ ] PASS flow on j-05: rt-pass enabled after full fill; rt-done 'E02015 passed — moved to the QC queue'; job-timing-card + job-open-rollitime link present on /jobs/j-05; status remains 'testing'.
- [ ] /integrations tile: RolliTime present, health 'not connected — stub', blurb mentions /rt.
- [ ] /setup/audit-log: 'rollitime' audit rows visible with 'timing REJECT · generic · Amplitude drift after 24h · flags: none · OVERRIDE (auto-eval suggested pass)' (timing PASS row confirmed in separate session).
- [ ] Regression: /today, /jobs, /supervisor render with no console errors (only React-Router v7 future-flag warnings).

## Iteration 25

_E13 RGTime phone time-clock (/rg, /rg/clock, /rg/manager), public kiosk (/kiosk), and staff Requests page (/requests) — full-frontend end-to-end verification. All spec bullets from the review request verified pass, including RG sign-in remembered per-device, wrong-password error, simulated NFC tap punch in/out with 'simulated' marker on today's punches, unknown-tag page, division mismatch error, manager gate + manager-only cards, week grid with division-scoped rows for rolliworks (MH/Vienna/MM) and rollishop (MH/Walter), rg-week-division select for 'both'-division managers, prev/next week navigation with next disabled at offset 0, day-detail on cell click, and full sign-out. Kiosk: idle → br…_

- [ ] /rg shows rg-sign-in with 4 staff cards; wrong password → rg-error 'Incorrect password'; correct 'vienna123' → rg-home with rg-status (On/Off the clock) and rg-today-punches list.
- [ ] Reload of /rg keeps the session (localStorage-backed). rg-sign-out returns to rg-sign-in.
- [ ] rg-tag-select for Vienna offers only 'Front Desk — Rolliworks · Rolliworks' (rolliworks-only). rg-tag-go navigates to /rg/clock?tag=...&sim=1, rg-clock-location reads 'Front Desk — Rolliworks', rg-clock-confirm reads 'Clock in|out — Vienna'. Confirming → rg-clock-done 'Clocked in|out' and auto-returns to /rg within ~4s; status flips; today's punches gains a '· simulated' row.
- [ ] /rg/clock?tag=bogus → rg-clock-unknown 'Unknown tag'. /rg/clock?tag=tag-rs-counter as Vienna → rg-clock-error 'Vienna is Rolliworks staff — this tag belongs to RolliShop'.
- [ ] As Vienna (concierge) rg-manager-link is absent; direct /rg/manager shows rg-manager-gate with 3 manager cards (Michael, Walter, MM); michael123 password → rg-week-grid.
- [ ] Week grid: rg-week-range 'this week', rolliworks rows u-michael/u-vienna/u-mm present, u-walter absent; rg-week-division select present for 'both' managers; switching to rollishop reveals u-walter and keeps u-michael; rg-week-next disabled at offset 0; rg-week-prev → 'last week' label; clicking a non-empty rg-week-cell-* opens rg-day-detail.
- [ ] /kiosk shows kiosk-idle (no staff nav chrome). Touch → kiosk-brand with kiosk-brand-rolliworks / kiosk-brand-rollishop. Services step shows 'Skip — Continue' initially and 'Continue (2)' after toggling two. Empty form submit → kiosk-error 'Please enter your first and last name'. Valid submission → kiosk-thanks with kiosk-thanks-ref 'Reference RQ-26-00xx' and auto-resets within ~5s.
- [ ] Kiosk existing-client match (email harrison.whitfield@example.com, name 'Harry Whit') → new request shows request-match-* amber box mentioning Harrison Whitfield and client link → /clients/c-01. Clicking request-split-* replaces the box with 'Split into a new client record' and re-points the client link to a fresh c-* record.
- [ ] Phone-only match (phone 212-555-0101) creates a possible match; request-confirm-* → 'Linked to existing client (confirmed)'.
- [ ] Nav has a Requests item; /requests header shows open count + division; requests-view-open / requests-view-all chips filter; seeded RQ-26-0041 present under All; request-open-* links to /clients/:id.
- [ ] Division wall: a kiosk submission with brand rollishop (RQ-26-0048) is NOT visible at a rolliworks station (st-01) on /requests.
- [ ] Kiosk dim: idle on /kiosk ~32s → kiosk-dim overlay appears; clicking it removes the overlay.
- [ ] Regression: Client 360 for Harrison (/clients/c-01) renders client360-requests including a kiosk-source row; /setup/audit-log shows data-event-type='kiosk' and 'rgtime' rows in-session; no unhandled console errors (only React-Router v7 future-flag warnings).

_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- Kiosk /kiosk — form step: Email field uses type="email", so an invalid address (e.g. 'not-an-email') is blocked by native HTML5 validation and the API-level check `Please enter a valid email address` is never surfaced through data-testid=kiosk-error. The last app-level error (e.g. 'Please enter your
- Audit log /setup/audit-log: AuditEventType includes 'kiosk' and 'rgtime' rows (verified rendering in the All view), but the FilterChip strip has no chips for them — only Sign-ins / Station / Intake / Estimates / Jobs / Sales / RolliConnect. Managers can't filter for kiosk or RGTime activity. Add aud

## Iteration 26

_E14 RolliWorking (/rw) standalone workshop route-space + per-component completion (MH ruling) — full frontend e2e verification. Every review-request bullet passed after resolving a couple of test-flow issues (using correct /sign-in testid `staff-card-michael` and ReasonModal `-reason`/`-confirm` suffixes). RW sign-in shows only 3 division cards (michael/vienna/mm; walter absent), wrong-secret→rw-error, mm/mm123→bench-page inside rw-shell with the full manager nav (Bench Jobs Parts QC Supervisor Floor Evidence My today). Access boundary: /rw job number links rewrite to /rw/jobs/:id and no RS sidebar/Dashboard is rendered inside /rw. Hide-money: /rw/jobs/j-24 job-lines shows `job-lines-no-mone…_

- [ ] RW sign-in: 3 rolliworks division cards (michael, vienna, mm), walter absent. Wrong secret → rw-error. mm/mm123 → bench-page inside rw-shell; rw-nav has Bench/Jobs/Parts/QC/Supervisor/Floor/Evidence/My today for manager MM.
- [ ] Access boundary: /rw bench job link href /jobs/j-24 navigates to /rw/jobs/j-24; no RS Dashboard link or `sidebar` testid inside /rw.
- [ ] Hide-money: /rw/jobs/j-24 job-lines has job-lines-no-money 'Amounts hidden in RolliWorking (hide-money default, pending MH)', no job-total, no '$' on page. RS /jobs/j-24 shows job-total. /rw/jobs search 'Castellanos' → rw-jobs-count '4 jobs'.
- [ ] RW pages: rw-parts-page (rw-parts-mine, rw-parts-job, rw-parts-start), rw-qc-page, supervisor-page with 'component completions this month' text, rw-floor-page (rw-lane-head/-band, rw-final-assembly, rw-into-safe, rw-safe-components, rw-safe-hold), rw-evidence-page scan E02026 → rw-evidence-job, bogus → rw-evidence-error.
- [ ] As Vienna (concierge): rw-nav hides QC and Supervisor; direct /rw/qc and /rw/supervisor render rw-restricted; rw-sign-out returns to rw-sign-in.
- [ ] Component completion (MM): bench row shows component-chips-j-03 + component-done-j-03-head; click → bench-flash 'Watch head marked complete — all components in → testing'; nav to /rw/jobs/j-03 shows components-progress 2/2 + component-done-by-head 'MM …'; pushState to RS /supervisor shows sup-qc-j-03.
- [ ] Reunification j-06: rw-act-to_testing → rw-job-error 'Reunification rule: mark every component complete first — still out: Case'. component-complete-case flips job to Testing / QC.
- [ ] Single-track j-24: 0/1 → rw-act-to_testing → 1/1, done by MM.
- [ ] RS /jobs: lane-awaiting_components with lane-count-awaiting_components=1, job-card-j-03 with component-chips-j-03, job-filter-awaiting_components chip.
- [ ] RS /jobs/j-03 amend: component-amend-j-03-case select + save re-attributes Case Walter→MH, component-done-by-case shows 'done by MH … (amended from Walter by MH)'. /reports report-tab-completions → MH count 1→2 after amend (delta +1). /supervisor sup-completions-mm and sup-completions-walter present.
- [ ] QC fail j-16: act-qc_fail → reason-modal-qc_fail-{reason,confirm} → components stay 2/2, component-rework-head 'rework ×1', component-rework-case 'rework ×1', job back to In service.
- [ ] Regression: RS /bench renders bench-page; RS /jobs/j-24 shows job-total; /rt /rc /rg /kiosk shells all load; no unhandled console errors (only React-Router v7 future-flag warnings).
