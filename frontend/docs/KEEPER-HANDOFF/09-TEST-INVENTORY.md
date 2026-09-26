# 09 — TEST INVENTORY (regression checklist KEEPER must also pass)

One section per testing-agent iteration (`/app/test_reports/iteration_N.json`). Each verified acceptance line is restated as a checkbox. KEEPER passes when every box can be ticked against the production build (same behaviours, different implementation).

## Iteration 1

_Completed E2E testing of RolliSuite ERP - 7 core modules (Dashboard, Customers, Estimates, Jobs, Sales Orders, Watches, Parts). Backend: 18/18 tests passed. Frontend: All modules functional after fixing auth token bug in useWatches.ts and useParts.ts hooks._


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- LOW PRIORITY: Investigate Customers API pagination - only showing 1 of 3 customers in UI

## Iteration 2

_Full end-to-end frontend testing of RolliSuite prototype (Vite + React 18 + TS, no backend, fixture-driven). Executed all 13 features listed in the review request. Result: 12/13 features fully working, 1 minor data-fixture discrepancy (MM hit-list count). No console errors, no critical issues._


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- MINOR (data): Spec expects 'hit-filter-mm shows only MM items (4)' but fixtures currently render 3 MM hit-list items (h-02, h-08, h-10). Either add one more MM-owned item to /app/frontend/src/api/fixtures/hitList (or equivalent) OR update the spec to match actual data (3).

## Iteration 3

_RolliSuite prototype ROUND 2 (staff-card sign-in with password + webcam photo, PIN fast-switch, device-bound stations, audit log). All 10 features in the review request verified end-to-end via Playwright against the public preview URL. 10/10 pass, 0 console errors._


## Iteration 4

_RolliSuite INTAKE flow (Session E2) round: partial verification. Stage 1 Arrival, Stage 2 list/detail-navigation, and outbox tab were exercised successfully. However multiple data-testids explicitly named in the review request DO NOT EXIST in the current DOM, blocking clean scripted verification of counts, row-level navigation, and hold-count assertions. Recommend main agent add these testids and re-test._


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- ADD data-testid on IntakeLayout count spans: intake-count-arrived, intake-count-processed, intake-count-awaiting_inspection, intake-count-received, intake-hold-count. These are called out explicitly in the spec.
- ADD row navigation testids: receive-open-<pkgId> on each ReceivePackageListPage row Open action (currently the Open cell is not even an <a>). Also wo-row-<pkgId> on WorkOrder rows and inspection-row-<pkgId> (or ensure a[href$='/pk-XX'] exists) so scan-vs-click flows are testable.
- VERIFY label-<id>-toggle and label-<id>-state testids exist on LabelQueuePage cards; expose data-state='unprinted'|'printed' as attribute so labels-filter-all can be verified.
- INVESTIGATE receive-process-button remaining disabled after estimate match + photo upload: confirm whether auto-selected content pills persist when the user re-runs the estimate lookup (e.g. after typing an unknown estimate first) — Finish panel showed '0 content pills' in one run despite the match 
- Full retest is needed after testids are added; the vast majority of business logic appears wired up per screenshots — only automation coverage is blocked.

## Iteration 5

_Full RolliSuite INTAKE Session E2 four-stage flow verified end-to-end in a single SPA session. Every requested data-testid now exists and behaves per spec: tab counts (arrived=3/processed=2/awaiting_inspection=3/received=1), hold-count '1 on discrepancy hold', arrival-receive-<id>, receive-open-<id> (real anchor links), receive-row-<id>, wo-row-<id>/wo-select-<id>, inspection-open-<id>/inspection-row-<id>, label-<id>-toggle/label-<id>-state. Stages 1-4 (arrival scan+duplicate hint+walk-in, receive-package with estimate match+auto-pills+custom pill+photo upload/remove+process, outbox generation, work-order commit with bin, inspection scan/fork/clean/discrepancy paths, label queue toggle+state…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Fix ReceivePackagePage state reset on receipt-print (see RCA)
- Verify audit-log intake events include a 'Package arrived' (or equivalent) row per spec, OR update the spec's expected string list to match the actual audit phrasing
- Consider adding data-testid to line-check LABELS (not just the hidden input) so Playwright can click without force=True
- Optional: expose disabling reason on receive-process-button via title/aria (e.g. 'Add at least one photo and one content pill')

_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- Inspection detail (pk-07): `[data-testid='line-check-0']` checkbox input is covered by a decorative <span>; Playwright clicks are intercepted unless force=True. Not a functional bug for humans but a data-testid on the clickable label would improve testability.

## Iteration 6

_Full E3 ESTIMATES module verified end-to-end in one SPA session (manager MH). Every spec bullet passes: list (19 rows) + all six status filter counts (draft 2, sent 4, approved 5, converted 6 shown as 'Closed', expired 1, declined 1); search variants ('EST-1042', 'E01042', '1042', 'vance', 'okafor@') resolve correctly; est-date-filter + provisional-tag rendered on the list header. Row-menu print/duplicate/delete flows all work: est-print-e-17 opens print-preview & closes; est-duplicate-e-17 → new draft with number E01059; deleting the new duplicate removes it; deleting e-13 shows 'An intake package is linked to this estimate'; deleting converted e-01 shows 'Converted estimates cannot be dele…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- None functional — all spec bullets pass. If a truly deterministic KPI test is needed, take the KPI snapshot BEFORE any mutating actions (or run KPIs in a separate SPA session).

## Iteration 7

_E4 JOBS module verified end-to-end against the review spec. Jobs board renders 9 lanes (intake=2, in_review=2, awaiting_customer_approval=1, approved=2, in_service=3, on_hold=2, testing=2, ready_to_ship=2, closed=4 = 20 total). Search auto-focuses; 'E02014', 'Lindqvist', and serial 'P4M8Q1Z6' all narrow to j-04. wf-filter-W and job-filter-intake narrow lanes correctly. view-list opens grouped [data-testid=jobs-table] with group-toggle-closed collapsed by default; expanding + clicking job-row-j-01 navigates to /jobs/j-01. Full state machine on j-12 works: act-start_review → In review (timeline 'Review started' by MH · Front Desk 1), act-request_approval → Awaiting customer approval (timeline …_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Optional: add `[data-testid=st-error]` message on empty-minutes submit in Shop Time (spec parity).
- Optional: always render `create-job-submit` (disabled if client/watch missing) so the 'Watch is required on create' guard is reachable.
- Optional: hide `act-invoice` on closed jobs, or accept current behavior as intentional pre-E5 stub.
- Optional: reconcile Dashboard 'In progress' KPI formula with spec (should be approved+in_service+testing = 7 with current seed; observed 9).

_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- Dashboard KPI 'In progress': Spec: In progress = approved+in_service+testing. Seed fixture makes that 2+3+2=7, but the KPI shows 9 — appears to include in_review (2) as well. Either the KPI formula or the spec should be reconciled.

## Iteration 8

_Frontend-only verification of RolliSuite E5 changes: job KIND (service/small_job/warranty) + per-kind config, ROLE-based owner (separate from assignees), derived /today per user (replacing manual hit-list), and cross-assigned tasks with waiting-on / linked-tasks. All 10 requested scenarios PASS. Backend testing skipped (in-memory prototype, no backend)._


_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- /setup/audit-log: `audit-filter-job` is a filter chip button (not an input). The review request phrased it as if it accepted a job value; behavior is fine but naming suggests input. Cosmetic only.

## Iteration 9

_Frontend-only verification of sign-in behaviour on /sign-in for the RolliSuite prototype. Reproduced the user's report: typing 'michael1123' on the michael card returns a visible 'Incorrect password' error and does not navigate — this is a user typo, NOT a bug. The correct password 'michael123' signs in successfully and lands on the dashboard with 'MH — Inspector · Manager' header. walter/walter123 and mm/mm123 also sign in successfully. Trailing space in password is (correctly) rejected — no silent trimming. Audit log shows a 'Sign in failed' row for the michael1123 attempt as expected._


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- No code change required. User-reported issue is a typo: 'michael1123' is one character off from the correct 'michael123'. The rule (firstname + '123') and the on-screen hint 'password firstname123, PIN 1234' are consistent with the implementation.

## Iteration 10

_Frontend-only verification of two new MH rulings (Inspection by job kind + manual Pinned hit-list). All 9 spec scenarios exercised end-to-end across michael, vienna, and mm sessions on the deployed preview URL. Every observable behaviour matches the spec: review-gate booleans, inspection form validation + save flash, photo requirement across all job kinds, small_job/warranty skip of the report (inspection-none) with photos still required, kind-specific action buttons (approve_direct only for small_job), auto-transition to Awaiting-customer-approval and Approved after upload, no review-gate on jobs past review, seeded photo on j-16, pin-modal prefill (job + task), Vienna/MM pinned lists, dism…_


## Iteration 11

_Frontend-only verification of E5 (SESSION) — Sales Orders as invoicing vehicle, QBO push (stub), stub payment ledger with partial payments, Pickup Station, Ship Station, custody-closes-on-pickup/ship, job invoice + estimate-convert wiring, and admin marks. All 10 spec scenarios exercised end-to-end on the deployed preview URL as michael and vienna. Every observable behaviour matches the spec except one minor search UX nit noted below. Zero console errors observed on /sales, /sales/so-*, /sales/pickup, /sales/ship, /sales/new and /jobs/j-02 (only a pre-existing React key warning inside InspectionPanel which is unrelated to E5)._


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- OPTIONAL — Sales search: make pickup-code match substring/prefix (or drop the exact-equality branch) so typing part of the pickup code surfaces the SO. Currently only the full code matches (client.ts line 1510).

## Iteration 12

_E6 frontend-only verification on the preview URL. Signed in as mm/mm123 (manager) and vienna/vienna123 (concierge). Exercised Bench view (/bench), Supervisor board (/supervisor), Parts request chat + approve/reject loop, Parts Knowledge page (/parts/knowledge), Shop floor map (/floor), assistant fallbacks (thing / gasket 126610 / mainspring 3235 / empty send), rejection path + knowledge log, and manager-only nav for concierge. All primary spec expectations are met with 0 console errors on /bench, /supervisor, /floor, /parts/knowledge and /jobs/j-01 with the parts modal open. One functional issue found: after pulling E02020 the pull-next card shows 'Nothing waiting' instead of E02025 (spec ex…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Fix pullNextCandidate filter so it excludes jobs already assigned to me. Current filter includes '(assignees.length===0 || assignees.includes(me))' which lets the just-pulled j-10 (now assignees=[MM]) win the sort over unassigned j-15, and getBenchView then nulls the whole pullNext because pn.assign
- Decide whether concierge (Vienna) should be able to fire pull-next from /bench. Today the button is rendered for her and the call succeeds (self-assigns MM/current actor to the job). If concierges must not pull, hide the Pull button when user.accessTier !== 'manager' (or check roles.includes('watchm

## Iteration 13

_Retest of the two E6 fixes from iteration_12. Both fixes verified working on preview URL with 0 console errors. (1) After mm pulls E02020, pull-next card correctly refreshes to E02025, then to bench-pull-empty 'Nothing waiting — supervisor-assigned jobs are never pulled by others.'; bench-job-j-10 and bench-job-j-15 both appear in My jobs. (2) Vienna (concierge) sees bench-pull-empty text 'Pull-next is for bench roles (watchmaker / inspector).' and NO bench-pull-next button rendered. (3) Regression pass: Michael (inspector) sees pull candidate E02020 and bench-job-j-05 / j-18 present._


## Iteration 14

_E7 Client 360 tested end-to-end. All acceptance criteria pass: /clients directory (25 rows, Naomi c-10 near top at row 7, autofocused clients-search-input); Client 360 page for c-10 renders full data (3 watch groups w-20/w-10/w-21 with correct history rows and open-job link, 7 estimates newest-first with E01040 rev-2 badge and expandable revision e-23-1, 4 jobs, 2 SOs with 3 payments, 3 requests with request-estimate-link-rq-01, notes/tasks card with '2 open tasks · 8 notes', 10 custody rows newest first, 6 emails with expandable body). All stats match spec (Watches '3 · 1 in house', Open estimates 2, Active jobs 1, Requests 2, Tasks 2, Balance $0.00, Lifetime $935.00). Global search resolve…_


## Iteration 15

_E8 RolliConnect (client portal) end-to-end. Verified: /rc login (draft banner, no staff nav leak, three demo buttons, unknown-email error, magic-link redemption to /rc/home), session guard (signed-out redirect + portal-404 for unknown /rc paths when signed in), sign-out. Eleanor: Needs You lists exactly 1 estimate item; approve flow shows decided text; watch status transitions to 'Queued for the bench'; state persists across reload. Decline flow (fresh state): reason required, decline recorded with reason text. Harrison: watch 'On the bench', documents (3 items incl estimate link), history (~15 plain-language rows), messages page shows msg-01/msg-02 with context; client-sent message appears.…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Optional: persist a 'messages viewed' rc event (or per-thread lastReadAt) so read-state survives page reload and staff-tab reloads; otherwise revise spec wording.

## Iteration 16

_Closing regression pass. New E8 follow-ups (a) message read-state persists across reload and (b) client-side request close with reason picker — BOTH PASS end-to-end and replay correctly. Spot-checked prior coverage (E5/E6/E7/E8): role/nav for u-michael (sidebar renders full manager set including Dashboard, Today, Clients, Inbox, Intake, Estimates, Jobs, Bench, Supervisor, Floor Map, Parts Knowledge, Sales, Setup and more), universal search resolvers all resolve to correct entity groups (Naomi→client, E01040→estimate, 794644790132→package SUB-26-0291, W4T9L36N→watch, SO-25-0042→sales order, RQ-26-0041→request, zzzzqq→global-search-empty), /clients/c-10 renders (Watches 3 · 1 in house, Request…_


## Iteration 17

_Iteration_17 second-half regression covering concierge role, E5 Sales/Pickup/Ship, E6 Bench/Supervisor/Floor/Parts chat, and E8 Eleanor+Grace portal flows. ALL scoped items pass. No blockers found; no console errors observed (React Router future-flag warnings ignored).  CONCIERGE (u-vienna): sidebar renders exactly {Dashboard, Today, Clients, Inbox, Intake, Estimates, Bench, Floor Map, Sales, Labels, Help}. /jobs, /supervisor, /parts/knowledge, /setup → RestrictedPage (data-testid=restricted-page). /today, /bench, /floor, /sales, /clients, /inbox all render for vienna. /today renders rows for u-michael and u-mm; dashboard OK for u-mm and u-vienna.  E5 SALES LIST + DETAIL (vienna): /sales sho…_


## Iteration 18

_Division ruling + hit-list quick-add upgrade: All 14 scoped tests pass on a Rolliworks session (st-01, u-michael). TopBar shows 'Front Desk 1 · ROLLIWORKS' badge and + quickadd button. Today subtitle shows 'division: Rolliworks'. Staff hit lists modal shows MH (both), Vienna, MM — Walter absent. QuickAddOverlay opens via + button and Alt+T, @vi autocomplete shows Vienna, @vienna Call client #1 → toast 'Pinned to Vienna's list'. PinForm @mention routes correctly via parsePin (API logic confirmed). # syntax backward-compat works. AssigneeSelect and NewTaskForm show only Rolliworks staff. Alt+T on /jobs/j-01 shows 'job j-01 attached' context label. Walter's Today (switched to st-rs RolliShop se…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Optional UX enhancement: sync the PinForm 'For' select to reflect the resolved @mention target so the user sees who the pin will go to before submitting.

_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_
- PinForm (Today · Pinned card): When @mention (e.g. @vienna) is typed in the pin text input, the 'For' select does not update visually to reflect Vienna — it stays on MH. The API correctly routes to Vienna via parsePin, but the UI can mislead the user into thinking it's pinning to MH. Consider syncin

## Iteration 19

_E9 session validation: sign-in, POLISH 1 (pickup code verify with wrong→error/correct→advance), Purchasing (5 POs / 5 vendors / receive PO-02 → status 'Received — awaiting approval' with received qty stamped), Inventory (5 low-flags on stock tab, 6 rows on low-tab, create-po link opens pre-filled po-create-modal, adjust with empty reason → 'A reason is required', with reason → new movement, cycle-count location select + start), Labels (25 pickable rows, queue count updates), Reports (funnel/throughput/aging/pnl tabs all render tables, reconcile line shows dashboard stats), Accounting (7 invoices, 7 payments, 6 QBO rows across states), Integrations (tiles with health badges), Help (4 role qui…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Align parts-chat fallback wording: the 'bare word / no-ref' scored branch should carry the same 'Add a reference to narrow (job watch ref …)' guidance the loose branch already has, or the routing rules should tighten so 'crown' falls into the loose branch. Non-blocking but violates the E9 polish acc

## Iteration 20

_E10 Companion Panel — full frontend validation. Panel toggle (topbar-companion-btn / Alt+M / companion-close), amber scripted banner, and four tabs all wired. PRICE MEMORY resolves 16234 via reference and 2010 daytona via year with candidates & evidence; Verify moves a candidate to verified badge and re-asking ranks it #1; stale pt-02 badge shows on '16613'; 'widget' shows a clarify. ASK THE SHOP returns the WR and Turnaround cards; unknown 'do we service omega' shows ask-miss + route creates a new open routed item AND a /today task; answering the seeded rq-ask-01 creates a new knowledge card (kc-*), flips status to answered→kc-…, and re-asking 'cellini quartz' returns the new card. CLIENT B…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Fix duplicate React key in CompanionTabs.tsx ClientTab brief-cite map — include line.key or index in the key.
- Trigger clarifying answer (amber) for model-only queries like 'crown for a daytona' — currently it silently defaults to the newest reference alias.
- Reconcile pill/tag testid slug format with spec double-underscore, or update spec to match single-underscore (t.replace(/[^a-z0-9]+/gi,'_')). Selectors currently ship as single '_'.
- Emit a 'photo labeled' entry to the audit log on labelPhoto() for parity with price_verified/brief_corrected/question_routed.
- Nudge E02018 fixture delivery date so debt calculation returns ~80–90 days (currently 110).

## Iteration 21

_Retest of E10 Companion after iteration_20 fixes. 4 of 5 fixes verified. PRICE clarify for model-only 'crown for a daytona' still FAILS — the resolver's clarify branch returns clarify text but priceMemory() text-selection logic still surfaces the candidate-list message because part-matching still produces candidates; the amber-styled 'Which year' question never renders. All other regressions are fixed: (a) BRIEF service_debt now reads '90 days late (E02018)' (in the 85–95 range) with ZERO React duplicate-key warnings on /clients/c-10; (b) LABELS pill testids use double underscores exactly as spec — 'pill-ev-05-dial__original' and 'pill-ev-05-hands__correct' exist; selecting both + label-save…_


_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- In src/api/client.ts priceMemory(): when resolveModel() returns a clarify (family >1 && generic), do NOT compute/show candidates — return { candidates: [], text: resolution.clarify }. That makes the amber bg-amber-50 branch fire and satisfies the spec (Which year, 116520 · 116500LN, no price-candida

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

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Decouple portal decline validation error from fetch-error state — keep the report visible when reason is empty (use only the inline <RcError/> inside the decision card, don't setError at top level).
- Emit a job-timeline event ('Sent to customer for approval' or similar) when a report is issued so the status transition is auditable.
- Confirm that issuing a report writes the 'Inspection report v1 issued — notification queued with portal link' system message into the client's comms thread; couldn't observe it in the /inbox listing.

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

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Kiosk email field: drop type="email" or handle the invalidevent so the API's 'Please enter a valid email address' message is actually shown via kiosk-error. Currently a bad email is silently blocked by native validation and any stale 'first/last name' error remains visible.
- AuditLogPage: add audit-filter-kiosk and audit-filter-rgtime FilterChips (AuditEventType already includes both).

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

## Iteration 27

_E18 RolliWorking route-space full frontend e2e. Ran a single-tab session (in-memory store) covering sign-in as MM, nav completeness, /rw/floor two-lane map + drag + history + finish gate, /rw/bulk scan flow + outbox + undo + band-only + bogus, /rw/queue filters + simulate reply + no-money, /rw/wm cards + request-part + to-safe + refinish scan + PIN switch, /rw/station picker + scan + bogus, /rw/pad summary + advance/send-back/photos + parts composer (with learning ranking + free text) + approvals (out-of-stock/order/received/approve/decline), /rw/picking summary + short/picked/found/scan + no-money, cross-screen consistency, and /rw/jobs/j-30 regression. 32/35 asserted bullets passed on firs…_

- [ ] Sign-in /rw as mm with password mm123 (placeholder said 'password (first sign-in today)'). rw-nav includes Bench, Shop Floor, Work Queue, Bulk Assign, Jobs, Parts, WM Room, Station Scan, QC, Supervisor, Pad, Picking, Evidence (no missing labels).
- [ ] Shop Floor /rw/floor: rw-floor-page renders; all head-lane stations (pre_approval, pre_queue, wm_bench_1..3, into_safe_head, safe_await_band), band-lane stations (band_pre_queue, refinish, polish, into_safe_band, safe_await_head), plus final_assembly and finished exist. Seed dots verified: floor-dot-j-30-{head,case,band}, floor-dot-j-32-head, floor-dot-j-31-band. floor-count-wm_bench_1 numeric ('2'). floor-filter-tech='Rosa' reduces dots 35→3; floor-filter-kind='warranty' applies.
- [ ] Floor history + finish gate: click floor-dot-j-31-band → floor-history slide-over renders with E02032. floor-finish-job → floor-message reads 'Finish gate — E02032 cannot be marked Finished: Bracelet is still out at Polish'. floor-history-move-into_safe_band → dot now inside floor-station-into_safe_band; re-click floor-finish-job → 'E02032 finished'.
- [ ] Drag j-01-head → floor-station-wm_bench_3 succeeds (count 1→2, dot appears inside that station).
- [ ] Bulk Assign /rw/bulk: bulk-active-tech-name initially 'Scan TECH code'. Type 'TECH-ROSA'+Enter → bulk-active-tech-name 'Rosa'. Scan 'E02025' → bulk-row-j-15 appears with 'Watch head', bulk-flash 'E02025 → Rosa · Watch head · started', outbox gains queued entry with bulk-undo-* button. Scan 'BAND-E02007' → bulk-row-j-24 with 'Bracelet' and /rw/jobs/j-24 renders Bracelet in components. Scan 'ZZZZ-BOGUS-999' → bulk-scan-error appears.
- [ ] Work Queue /rw/queue: queue-table populates 19 rows; queue-filter-overdue toggle reduces rows (19→0 with fixtures). queue-simulate-reply → queue-flash + at least one queue-replied-* badge with amber highlight. No '$' character on page.
- [ ] WM Room /rw/wm: no rw-nav header inside wm shell; 7 wm-card-* cards for MM. wm-request-part-j-01 → wm-request-form-j-01 → desc 'Crown tube' qty 2 → wm-flash 'PR-0054 pending · Crown tube ×2'. wm-to-safe-j-01-head → part-loc-j-01-head chip 'Watch head · Into safe'. PIN modal opens via rw-pin-switch and rw-pin-card-u-rosa + rw-pin-input 1234 + rw-pin-go is present and clickable (see caveat).
- [ ] Station Scanner /rw/station: station-pick-polish → station-active shows Polish. Scan 'E02016' → station-log gains a Case row for E02016. Scan 'ZZZZ-BOGUS' → station-scan-error.
- [ ] Supervisor Pad /rw/pad: no rw-nav; pad-summary numeric (jobs/parts/approval). pad-advance-j-15 (queued) → pad-flash 'advanced' + pad-stage-j-15 'On the bench'. pad-advance-j-31 (bracelet out) → blocking message names Bracelet. pad-sendback-j-04 → pad-sendback-modal, pad-sendback-confirm disabled until reason; pad-reason-other with empty note → pad-sendback-error; pad-reason-rework → confirm → flash 'sent back · Rework'. pad-photos-j-01 → rw-photo-view with 3 tiles, click tile → rw-lightbox opens, rw-photo-close closes. Big buttons ≥48px tall.
- [ ] Pad parts composer: pad-request-j-04 → composer; typing 'insert' lists suggestions whose first entry carries the 'fits ref' badge (for ref 126710). pad-suggest-pt-27 present; picking pt-27 adds pad-item-0 qty 1; pad-item-plus-0 → qty 2. Re-typing 'insert' → pt-27 is FIRST and carries 'last chosen' badge (ranking learned). Typing 'zzz-nothing' surfaces pad-freetype-add for free-text. pad-composer-submit → flash 'PR-#### pending · N item(s)'.
- [ ] Pad approvals: pad-tab-approvals shows queue. pad-approval-pr-05 shows pad-out-of-stock-pr-05 + pad-order-pr-05 (no Approve); click Order → pad-received-pr-05 appears; click Received → card gone. pad-approval-pr-09 (free-text/uncatalogued) shows pad-order-pr-09. pad-approve-pr-04 → pad-allocated-pr-04 'Allocated → picking queue' then card gone. pad-decline-pr-08 → card gone.
- [ ] Picking /rw/picking: pick-remaining numeric; pick-card-pk-04 shows pick-alert-pk-04 and no pick-picked-pk-04 button (short-only), pick-short-pk-04 short-orders it. pick-picked-pk-01 → flash 'picked'. pick-found-pk-02 → pick-found-input-pk-02 'Cabinet Z · Drawer 1 · Bin 1' + pick-found-save → pick-location-pk-02 updates. Scan '3135-310' picks pk-03. No '$'.
- [ ] Cross-screen consistency: after pad-advance-j-15, Work Queue queue-row-j-15 status shows In service; Shop Floor has floor-dot-j-15-head at floor-station-wm_bench_1; /rw/wm part-loc-j-01-head reads 'WM Bench 3' after prior drag.
- [ ] Regression: /rw/jobs/j-30 shows job-lines-no-money and body contains no '$'.

## Iteration 28

_Frontend-only regression for RolliSuite: (A) Inbox Staff section + colleague inbox and (B) Client Request Notes across Job page, Supervisor Pad, WM Room, Bulk Assign, Station Scanner, RW QC queue, plus QC gate enforcement. All headline features verified working end-to-end; only one minor discrepancy vs test-spec around E02014 bulk-scan (see below). Tests executed via Playwright using client-side popstate navigation to sidestep the preview proxy 429 rate-limiting on cold module loads._

- [ ] inbox_staff: {"counts": {"MH": 0, "Walter": 1, "Vienna": 2, "MM": 0}, "vienna_header": "Vienna\u2019s inbox \u00b7 2 open assigned \u00b7 read & reply", "url_param": "?staff=Vienna", "back_to_mine": "works, header cleared", "view_open_clears_staff": true, "thread_view_open
- [ ] job_j30: {"badge": "Client requests (1)", "card_present": true, "cr_01_row": true, "positions": {"card_top": 299, "notes_top": 1281}, "add_flash": "client request added", "add_badge": "Client requests (2)", "remove_works": true}
- [ ] qc_j16_staff: {"qc_pass_initially_disabled": true, "qc_pass_title": "QC blocked \u2014 client request not checked off: \u201cCall before shipping \u2014 client wants to collect in person\u201d", "gate_text": "QC cannot complete \u2014 unchecked: \u2026", "cr03_check_text":
- [ ] pad: {"j30_requests_visible": true, "j04_requests_visible": true, "j16_qc_checklist_visible": true, "pad_advance_j16_blocked": "QC blocked \u2014 client request not checked off: \u201cCall before shipping\u2026\u201d", "pad_advance_j16_after_done": "E02026 advanced
- [ ] station: {"pick_wm_bench_2": true, "scan_E02031_log_row": true, "modal_appears": true}
- [ ] wm: {"wm_card_j04_present": true, "badge_text_j04": "Client requests (1) Relume hands + new crystal gasket", "scan_E02014_modal": true, "wm_flash": "E02014 \u00b7 Watch head \u2192 Into safe"}
- [ ] rw_qc: {"rw_qc_j16": true, "rw_qc_requests_j16_text": "client request unchecked: Call before shipping \u2014 client wants to collect in person", "rw_qc_pass_j16_disabled": true, "rw_qc_pass_j16_title": "QC blocked \u2014 client request not checked off: \u201cCall bef
- [ ] regression: {"rw_floor": "loads", "jobs_list": "loads", "inbox_normal_views_load": true}

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Decide expected behavior when a held job (E02014) is bulk-scanned: either allow the client-request-modal to surface before the hold rejection, or update the test spec. WM Room scan and Station Scan work correctly for this case.

## Iteration 29

_Frontend-only end-to-end test of Supervisor Pad v2 at /rw/pad. Sign-in (MM/mm123) → Pad shell → Jobs tab (tech override, detail sheet + lightbox + condition report with tritium note, stepper send-back/advance, QC-blocked advance) → Parts tab (scan E02016, caliber-3135 suggestions, learned pt-05 mainspring tag, black-insert→pt-17 learned, crystal-ring→pt-02, mainspring→pt-05, freetype generic, qty+, submit to manager review) → Review tab (PR-0050/review-card-pr-20 resolve 'crystal ring for 16610' → 25-16610 with violet M3KE toast + price auto-fill $140 + generic-badge removal, Send-for-client-approval, Sim-approve, Allocate → +2 picks, M3KE log sheet with resolved row, bench approve PR-0046 +…_

- [ ] shell: {"pad-title": "Jobs", "pad-sum-picks-initial": "4 picks", "all_testids_present": true}
- [ ] jobs_tech: {"j04_chip_before": "MM", "tech_sheet": true, "override_toast": "E02014 \u2192 Rosa \u00b7 supervisor override", "j04_chip_after": "Rosa", "reverted_to_MM": true}
- [ ] jobs_detail_j06: {"sheet": true, "photos": 3, "cond_case/crystal/movement": true, "notes_contain_tritium": true, "lightbox_opens_and_closes": true, "sheet_close_works": true}
- [ ] stepper: {"j01_stage_before": "On the bench", "sendback_modal": true, "confirm_disabled_until_reason": true, "sendback_toast": "E02011 sent back \u00b7 Rework", "stage_after_sendback": "Queued", "advance_toast": "E02011 advanced", "stage_after_advance": "On the bench",
- [ ] parts_scan_E02016: {"header": "E02016 \u00b7 16610 \u00b7 Submariner Date \u00b7 cal. 3135", "caliber_suggestions": 14, "pt-05_present_with_learned_tag_in_caliber_list": true, "top_of_caliber_list": "pad-cal-pt-05"}
- [ ] parts_search: {"black_insert_top": "pad-suggest-pt-17 (learned)", "crystal_ring_present": ["pt-01", "pt-02"], "mainspring": "pt-05 present", "unobtainium_bracket": "no suggests + pad-freetype-add present"}
- [ ] parts_compose: {"item0": "pt-17 315-24280 $260", "item1_generic_badge": true, "item1_text_contains_no_price_and_generic": true, "qty0_after_plus": "2", "submit_toast": "PR-0054 \u2192 manager review \u00b7 2 line(s)", "observed_total": "$560 (spec expects $520)", "my_request
- [ ] review_pr20_resolve: {"review-card-pr-20": true, "review-line-pr-20-0_present": true, "review-generic-pr-20-0_present_pre": true, "review-send-pr-20_disabled_pre": true, "review-missing-pr-20": true, "learn_toast": "M3KE learned: \u201ccrystal ring for 16610\u201d \u2192 25-16610"
- [ ] client_decision_allocate: {"sim_approve_toast": "PR-0050 approved by client (simulated)", "allocate-card-pr-20": true, "picks_before": "4 picks", "picks_after": "6 picks (+2)"}
- [ ] learned_loop_closes: {"crystal_ring_suggest_order": ["pad-suggest-pt-02", "pad-suggest-pt-02-learned", "pad-suggest-pt-01"], "pt02_first": true, "pt02_learned_tag": true}
- [ ] bench_section: {"approval-pr-05_visible": true, "out-of-stock-pr-05_visible": true, "approve-pr-06_toast": "PR-0046 approved \u00b7 allocated \u2192 picking", "order-pr-05_toast": "PR-0045 \u2192 on order", "received-pr-05_visible_after": true}
- [ ] global_scan: {"E02031_client-request-modal": true, "pad-card-j-30_class": "border-amber-400 ring-2 ring-amber-400/50"}

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Reconcile Parts composer total for 2×$260 + generic no-price line: spec expects $520, observed $560. Check whether an implicit surcharge or an extra hidden line is included, or update spec.
- Make new-PR review-card testids use the visible PR code (e.g. review-card-pr-0054) instead of the internal opaque id, so E2E tests can target them predictably.

## Iteration 30

_Frontend-only E2E of Shipping — Inbound (/shipping/inbound) as MM. Verified sign-in, page load, KPI strip, stage tabs with counts, 4 stages end-to-end (create label with FedEx → Outbox email queued, resend/follow-up/void+reissue with reissued badge, in-transit simulate to out-for-delivery, delivered_unscanned rose row with 5h chip), TrackingPanel for sh-06 (Inbound·to us, UPS·Next Day Air Saver, insured $6,400, newest-first events with Louisville, copyable client one-liner containing 'on its way to us with UPS' and 'Louisville', Copy → 'Copied', close), Outbound sh-09 (Outbound·to client, client line contains 'on its way to you'). Global search returns SHIPMENTS group for tracking#, est# and…_

- [ ] kpis: {"labels-to-send": "3", "outstanding": "2", "in-transit": "2", "arriving-today": "1", "unscanned": "1", "outstanding_hint": "contains '1 over 30 days' with rose-700"}
- [ ] tab_counts: {"label_requested": "3", "label_sent": "2", "in_transit": "2", "delivered_unscanned": "1"}
- [ ] stage1: {"sh-01": "$28,500", "sh-02": "$9,800", "sh-03": "$4,200", "sh-03_age": "9d amber"}
- [ ] create_label_sh-03: {"prefilled_value": "4200", "validation": "Address verified (Parcel Pro) \u00b7 cleaned to 675 Madison Ave, \u2026", "carrier_fedex_click": true, "confirm_flash": "Label created \u00b7 FedEx 918605230066 \u00b7 insured $4,200 \u00b7 email queued", "counts_afte
- [ ] stage2: {"sh-04_out": "3d green", "sh-05_out": "34d rose", "resend_sh-04": "Label email re-queued to Outbox", "followup_sh-05": "Follow-up reminder queued", "void_sh-04": "Label voided \u00b7 back to Label Requests (reissue)", "sh-04_gone_from_stage2": true, "sh-04_in
- [ ] stage3: {"arriving_today_section": true, "arriving-sh-07": true, "sh-06_last_before": "In transit \u00b7 Louisville, KY", "sim_sh-06_flash": "Tracking event simulated", "sh-06_last_after": "Out for delivery \u00b7 New York, NY", "arriving_count_after_sim": 2, "sim_sh-
- [ ] stage4: {"sh-08_row_rose": true, "sh-08_unscanned": "5h red", "arrival_href": "/intake"}
- [ ] tracking_panel_sh-06: {"direction": "Inbound \u00b7 to us", "carrier": "UPS \u00b7 UPS Next Day Air Saver", "insured": "$6,400", "event_0": "In transit \u00b7 Louisville, KY \u00b7 Arrived at hub", "client_line_ok": true, "copy_becomes_Copied": true, "close_works": true}
- [ ] tracking_panel_sh-09_outbound: {"direction": "Outbound \u00b7 to client", "client_line_has_on_its_way_to_you": true}
- [ ] search: {"794612385590": "SHIPMENTS + Inbound \u00b7 E01056", "E01053": "SHIPMENTS + E01053", "Kowalski": "SHIPMENTS + E01055", "click_794612385590": "navigates to /shipping/inbound?track=sh-05 and opens tracking-panel"}
- [ ] client360_c-13: {"stavros": true, "client360-track-sh-06_present": true, "opens_tracking_panel": true}
- [ ] inbox: {"threads_all_open": 3, "eleanor_thread_opens": true, "thread-track-*_buttons_in_header": [], "expected_thread-track-sh-01": false}
- [ ] arrival_auto_match: {"scan_tracking_1Z9Q4R7T0187654321_on_/intake": "submitted via Enter", "sh-08_removed_from_stage4": true, "count_1_to_0": true}
- [ ] regression: {"/intake": "renders (Intake page, 3 arrival rows)", "/dashboard": "renders"}

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- Inbox thread header TrackButton: fall back to clientId-based shipment lookup when estimateId lookup returns none, so that opening any thread of a client with a shipment (e.g. Eleanor Vance c-02 → sh-01) shows the thread-track-* button as the spec expects.

## Iteration 31

_Frontend-only E2E of (A) the Inbox 'Track a package' TrackButton refactor and (B) Supervisor Pad additions (Parts Request History + iPad camera capture). Signed in as MM/mm123 at /sign-in; all further routing via window.history.pushState + PopStateEvent to preserve in-memory mock state. A1-A4 all PASS: Inbox thread for Eleanor Vance (anchor E01042) renders thread-track-sh-01 ('Track E01042 · Label requested') with '+1' badge (thread-track-more); clicking opens tracking-panel with primary sh-01 'Label requested' and tracking-others 'Also for Eleanor · 1 more' listing tracking-other-sh-10 (E01042 · Delivered); switching to sh-10 flips status to 'Delivered' and swaps the others list to tracking…_

- [ ] A1_thread_track_sh-01: text='Track E01042 · Label requested', badge thread-track-more='+1'
- [ ] A2_panel_flow: {"initial_status": "Label requested", "others_header": "Also for Eleanor \u00b7 1 more", "other_sh-10": "E01042 \u00b7 Delivered \u00b7 Sep 5", "after_switch_status": "Delivered", "after_switch_other_sh-01": "E01042 \u00b7 Label requested \u00b7 Sep 25", "clos
- [ ] A3_c02: {"client360-track-sh-01": true, "client360-track-more": "+1", "panel_others_sh-10": true}
- [ ] A3_c13: {"client360-track-sh-06": true, "no_more_badge": true}
- [ ] A4_inbound_counts: {"label_requested": 3, "label_sent": 2, "in_transit": 2, "delivered_unscanned": 1, "sh-10_absent": true}
- [ ] B1_history: {"segment_ok": true, "row_count": 27, "sample": ["pad-hist-pr-03", "pad-hist-pr-04", "pad-hist-pr-05"]}
- [ ] B2_filters: {"search_insert_rows": 7, "no_match_message": true, "status_options": ["All statuses", "pending review", "awaiting client", "approved", "declined", "on order", "received", "picked"], "job_select_present": true}
- [ ] B3_detail: {"opens": "pad-hist-pr-04", "pad-hist-steps_present": true, "esc_closes": false}
- [ ] B4_past_on_job: {"E02016_chips": "16610 \u00b7 cal. 3135", "pad-past-on-job": "Past requests on this job \u00b7 4"}
- [ ] B5_camera: {"jobs_with_camera": 18, "input_attrs": {"type": "file", "accept": "image/*", "capture": "environment"}, "sheet_opens": true, "slots": ["pad-slot-workbench", "pad-slot-movement", "pad-slot-dial", "pad-slot-caseback", "pad-slot-bracelet", "pad-slot-parts", "pad
- [ ] B6_another: {"pad-photo-another_present": true, "sheet_reopens_after_retrigger": true, "cam_badge_after_three": "+3"}
- [ ] B6b_shared_job_photos: {"rs_/jobs/j-10_photo_testids": ["photo-grid", "nav-inspection-photos", "job-photos-card", "photos-panel", "photos-toggle"], "rw_/rw/jobs/j-10_photo_testids": ["photo-grid", "rw-job-photos", "photos-panel", "photos-toggle"]}
- [ ] B7_regression: {"pad-tab-review_present": true, "scan_E02031_client_request_alert": true, "alert_text": "CLIENT REQUESTS \u00b7 READ BEFORE YOU TOUCH IT \u00b7 E02031 \u00b7 Rolex Datejust 31 \u00b7 278274 \u00b7 Photograph movement before casing \u00b7 Understood"}

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- PadHistory: dedupe rows by request id so React does not warn 'two children with the same key pr-04' (appears twice under the 'All statuses' history list). Likely inside getRoomPartsHistory / merge step in src/api/client.ts.
- HistoryDetail sheet: bind Escape to close and/or expose a pad-hist-detail-close button for testability.
- (Optional) Add a data-testid on the RS/RW job-page photo strip that reflects pad-captured photos (e.g. pad-photo-<id> alongside inspection photos) so downstream tests can verify capturePadPhoto propagation without falling back to counting <img> nodes.

## Iteration 32

_Frontend-only E2E of the three new blocks on /rw/bench (Bench Pad + kiosk behaviours + Job Messages). Ran on viewport 1366x1024 (bench) and 1920x1080 (RS/Vienna). A1-A5 all PASS: bench-lock keypad, staff cards (bench-card-u-rosa), header 'Bench 3' + rw-clock, auto-submit on 4th digit, wrong-PIN error, Rosa's board counts (in-progress 3 · attention 1 · splits 3 · outsourced 1 · messages 1 · completed 7), stuck flag bench-flag-stuck-j-24 ('stuck · no scan movement 5 working days'), split card bench-split-band-j-32 ('band completed by Walter · Sep 18'), bench-out-j-06 (Goldsmith & Co., '4 days out'), no '$' anywhere, 16 part-loc chips. Goals: 7/18, pace 'pace line today · 16 (-9) · day 26/30', …_

- [ ] A1_lock: {"bench-name": "Bench 3", "rw-clock_ok": true, "keys": ["bench-key-1..0", "bench-key-del"], "wrong_pin_hint": "Incorrect PIN", "auto_submit_on_4th_digit": true, "reaches_bench-board": true}
- [ ] A2_counts: {"in_progress": "3", "attention": "1", "splits": "3", "outsourced": "1", "messages": "1", "completed": "7", "stuck_flag_text": "stuck \u00b7 no scan movement 5 working days", "split_band_j-32_text": "band completed by Walter \u00b7 Sep 18", "out_j-06_days": "4
- [ ] A3_goals: {"actual": "7 / 18", "pace": "pace line today \u00b7 16 (-9) \u00b7 day 26/30", "pace_marker": true, "tiles": ["bench-month-2026-03", "bench-month-2026-04", "bench-month-2026-05", "bench-month-2026-06", "bench-month-2026-07", "bench-month-2026-08"], "hits": 4,
- [ ] A4_messages_row: {"row_id": "bench-msg-row-jm-01", "bench-unread": "1 unread", "preview_text": "MM: Adding crown to the parts request, @Vienna please prep a revised estimate", "thread_sheet_opens": true, "msg-jm-01_photo": true, "msg-jm-01_routed": "-> @MM", "msg-jm-02_routed"
- [ ] A5_reply: {"picker_opens_on_@MM": true, "input_after_pick": "On it @MM ", "new_reply_routed": "-> @MM @Vienna", "author_Rosa_excluded_from_routed": true, "bench-msg-j-30_opens_sheet": true, "unrouted_thread_created": true}
- [ ] B1_settings: {"plain_click_gear_opens": false, "longpress_opens": true, "wrong_pin_error": "Supervisor PIN not recognised", "all_fields_present": true, "save_updates_name_to_Bench_7": true, "offline_banner_visible": true, "board_still_rendered_after_offline": true, "reload
- [ ] B1_offline_reload_regression: AFTER reload with offline ON, unlocking fails with 'NETWORK_UNREACHABLE' and the pad never returns to the board (see bug).
- [ ] B3_kiosk: {"external_anchors": [], "bench-header_position": "sticky", "header_visible_after_scroll_800px": true}
- [ ] C1_pins: {"MM_today_pin_present": true, "MM_pin_text_contains_Crown_is_worse_and_at_MM": true, "Vienna_today_pin_present": true, "Vienna_pin_link_href": "/jobs/j-30#msg-jm-02", "pin_container_testid_pattern": "pinned-pin-<id>", "dismiss_testid_pattern": "pin-dismiss-pi
- [ ] C2_composer: {"msg-new-at_opens_picker_on_click": false, "picker_opens_on_typed_@": true, "picker_lists": "MH \u00b7 Vienna \u00b7 MM (hit list) \u00b7 Rosa (bench)", "photo_input_attrs": {"type": "file", "accept": "image/*", "capture": "environment"}, "send_creates_top_th
- [ ] C3_wm_and_pad: {"/rw/wm": {"wm-unread": true, "wm-messages": true, "bench-msg-rows": 1, "wm-msg-<jobId>_buttons": 7, "E02016_visible": true}, "/rw/pad": {"pad-detail-messages": true, "messages-panel_inside": true, "composer_inside": true}}
- [ ] C4_regressions: {"/jobs/j-24_has_Caseback_gasket_ambient_note": true}

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- HIGH: Offline-mode PIN unlock — while KIOSK_OFFLINE is true, api.benchPinIn (and refreshStation) reject with NETWORK_UNREACHABLE so the pad cannot be unlocked after reload. Resolve the PIN check against the local fixture (or bypass the reject) so the pad enters the board and simply shows the reconne
- MEDIUM: Add the missing bench-lock-now manual lock control on the /rw/bench header (returns to bench-lock immediately, next to bench-gear).
- MEDIUM: Wire msg-new-at button to open msg-new-picker after inserting '@' (currently only inserts '@' and does not toggle the picker open state). Same fix likely applies wherever MessageComposer is reused (RS /jobs, /rw/pad detail).
- LOW: Testid naming consistency for /today pins — spec quotes 'pin-<id>' + 'pin-dismiss-<id>' but actual is 'pinned-pin-<id>' + 'pin-dismiss-pin-<id>'. Consider aligning to the spec pattern to simplify automation.

## Iteration 33

_Confirmation retest of iteration_32 fixes on /rw/bench plus the previously-skipped 70s idle re-lock. All six spec items PASS. F1 (offline cold start): after priming Rosa's cache once, setting rollisuite.kiosk.offline=1 + clearing prototype.currentUserId + reload, bench-lock renders; PIN 1234 as Rosa enters bench-board directly (no NETWORK_UNREACHABLE), bench-offline-banner is visible reading 'reconnecting…\nshowing last data', job cards (bench-job-j-30, bench-job-j-33 as E02033 etc.) are rendered from cache; clearing the flag makes the banner disappear within ~6s and the board refreshes to live data. F2: bench-lock-now button IS rendered in the header between rw-clock (x=1122) and bench-gear…_

- [ ] F1_offline: {"initial_lock": true, "prime_cache_ok": true, "reload_with_offline_flag_lock": true, "pin_in_offline_reaches_board": true, "network_unreachable_text": false, "bench-offline-banner_visible": true, "bench-offline-banner_text": "reconnecting\u2026\\nshowing last
- [ ] F2_lock_now: {"button_present": true, "clock_x": 1122, "lock_now_x": 1246, "gear_x": 1302, "position_between_clock_and_gear": true, "click_returns_to_lock": true, "rosa_preselected_amber": true, "pin_1234_returns_to_board": true}
- [ ] F3_msg_new_at: {"click_inserts_at": true, "click_opens_picker": true, "picker_options": ["msg-new-pick-u-michael (MH \u00b7 HIT LIST)", "msg-new-pick-u-vienna (Vienna \u00b7 HIT LIST)", "msg-new-pick-u-mm (MM \u00b7 HIT LIST)", "msg-new-pick-u-rosa (Rosa \u00b7 BENCH)"], "pi
- [ ] F4_section_testids: {"duplicates": [], "bench-msg-job": ["j-30", "j-32", "j-24"], "bench-msg-attn": ["j-24"], "bench-msg-split": ["j-06", "j-30", "j-32"], "bench-msg-out": ["j-06"], "bench-job": ["j-30", "j-32", "j-24"], "bench-attn": ["j-24"], "bench-out": ["j-06"]}
- [ ] F5_idle_relock: {"longpress_opens_settings": true, "supervisor_pin_accepted": true, "idle_1_saved": true, "wait_seconds": 72, "auto_returned_to_lock": true, "bench-lock-hint": "PIN for Rosa", "pin_1234_restores_board": true, "counts_intact_after_relock": {"in_progress": "3",
- [ ] F6_counts_and_pin: {"in_progress": 3, "attention": 1, "splits": 3, "outsourced": 1, "messages": 1, "completed": 7, "goal_hits": 4, "month_tiles_elements": 12, "mm_today_pin_present": true, "mm_pin_link": "/jobs/j-30#msg-jm-01", "mm_pin_text_contains": "@Rosa on E02031: \"Crown i

_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_
- LOW (optional polish): Append the 'saved HH:MM' timestamp to bench-offline-banner text so it matches the spec 'reconnecting… showing last data · saved HH:MM' (currently only 'reconnecting… showing last data' is displayed).

## Iteration 34

_Ran full frontend E2E for RolliSuite View-as-Client block (T1–T8) via Playwright against the public preview URL as Vienna (staff) and robert.calloway@example.com (portal magic link). All acceptance criteria for T1–T7 pass; T8 verified for Robert (magic-link auto-login, no banner, 4 cards) — Camille cross-client isolation was set up but full assertion was cut mid-run (see context note). Zero staff-only leak strings found on /rc/home, /rc/watches/w-42, /rc/messages while viewing-as._

