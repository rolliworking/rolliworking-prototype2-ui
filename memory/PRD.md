# RolliSuite — Product Requirements Document

**Last updated**: 2026-09-30  
**Status**: Active prototype (fake data, no backend)

---

## Problem Statement

Build the shell of an internal ERP web app ("RolliSuite") for a luxury watch service center. This is a PROTOTYPE for internal evaluation using fake data only.

---

## Architecture Rule (inviolable)

ALL data access must go through ONE module at `src/api/client.ts` that exports typed async functions. Screens never fetch directly and never talk to a database. All data returns from local in-memory fixtures seeded in `src/api/fixtures/`.

---

## User Roles

| Role | Access Tier | Notes |
|------|-------------|-------|
| Manager | manager | Full write access |
| Inspector | manager | Inspection flows |
| Watchmaker | manager | Bench / workshop |
| Concierge | concierge | Client-facing, read-heavy |

**Division** (added 2026-09-24):  
- `rolliworks` — service center side  
- `rollishop` — boutique/retail side  
- Staff can be `both` (michael)  
- Session division = station's division; wall is the division, not the tier

**Seeded staff**: michael (both), vienna (rolliworks), mm (rolliworks), walter (rollishop)

---

## Functional Modules

| ID | Module | Status |
|----|--------|--------|
| E1 | Dashboard + Auth | ✅ Done |
| E2 | Intake | ✅ Done |
| E3 | Estimates | ✅ Done |
| E4 | Jobs | ✅ Done |
| E5 | Invoicing / Shipping | ✅ Done |
| E6 | Workshop / Parts | ✅ Done |
| E7 | Client 360 | ✅ Done |
| E8 | RolliConnect (Client Portal) | ✅ Done |
| E9–E10, E12, E14–E15 | RS modules, Companion, RolliTime, Comms, Portal-first | ✅ Done |
| E13 | RGTime /rg + Kiosk /kiosk + /requests | ✅ Done |
| E11 | RolliWorking standalone /rw + per-component completion ruling | ✅ Done |

---

## What's Been Implemented

### E1 — Dashboard + Auth (2026-06)
- Role-based sign-in with password + photo capture (camera optional)
- Station registration (device-bound, division-stamped)
- PIN fast-switch for subsequent sign-ins
- Show/hide password toggle + fill-prototype-password convenience button
- Dashboard stats, activity feed, mini today widget

### E2 — Intake (2026-06)
- Drop-off flow (walk-in, estimate-linked, or direct job)
- Package receive flow with discrepancy handling

### E3 — Estimates (2026-06)
- Full estimate lifecycle: draft → sent → approved/declined/revised
- Multi-line service quotes with department codes
- Revision history

### E4 — Jobs (2026-06)
- Job creation from estimates or direct intake
- Status machine: intake → review → approval → watchmaking → QC → ready/ship → closed
- Hold system (parts, outsource, client, warranty)
- Job detail with timeline, notes, photos, tasks

### E5 — Invoicing / Shipping (2026-06)
- Sales orders with partial payment support
- Pickup window scheduling with code
- Shipment with label + tracking stub
- Tail stage derived from SO state

### E6 — Workshop / Parts (2026-06)
- Bench, Supervisor, Floor Map lenses
- Pull-next logic
- Parts assistant (scripted, no AI)
- Parts approval → knowledge base

### E7 — Client 360 (2026-06)
- Universal search resolving to client page
- Dense client record: watches, requests, estimates, jobs, invoices, notes, emails, custody trail
- ServiceRequest entity (source, status, messages, close logic)

### E8 — RolliConnect (2026-06)
- Separate route-space `/rc` with own session + shell
- Magic-link stub sign-in
- Estimate approval/decline, pickup scheduling, shipping address
- Message threads, portal event replay
- Client-side request close with reason picker

### Division dimension (2026-09-24, MH ruling)
- `Division = 'rolliworks' | 'rollishop'` on Station, User, Task, PinnedItem, Job
- Stations seeded: Front Desk 1–5, Inspection Bench, Watchmaker Room, Shipping → rolliworks; RS Counter → rollishop
- `getToday()` division-scoped (tasks, pins, job rows)
- `getDivisionStaff()` / `getDivisionRoles()` helpers
- AssigneeSelect + NewTaskForm: same-division only
- Staff hit-list viewer: full-screen modal, managers + concierge, same-division team, prev/next
- Station setup page shows division badge per station

### Hit-list quick-add upgrade (2026-09-24, MH ruling)
- `@name` / `@role` accepted everywhere `#` was parsed (MENTION regex)
- `PinForm` "For" select syncs live when @mention typed
- Global `+` button (TopBar) + `Alt+T` shortcut → QuickAddOverlay
- @mention autocomplete: same-division staff + roles only
- Context attachment: `/jobs/:id`, `/clients/:id`, `/estimates/:id` auto-linked
- Toast confirms: "Pinned to Vienna's list"
- `QuickAddProvider` wraps AppShell

### E11 — RolliWorking standalone /rw (2026-09-26) + per-component completion (MH ruling, first board walk)
- `/rw` route-space: dark workshop shell, own sign-in (division cards, password/PIN, no camera), nav Bench · Jobs · Parts · QC (mgr) · Supervisor (mgr) · Floor · Evidence · My today; link guard rewrites `/jobs/:id` → `/rw/jobs/:id` and blocks other RS links (access boundary, prototype shares one origin/session); `MoneyContext` hides all amounts in /rw (amber default); `.rw-dark` CSS skin restyles re-homed E6 components. New: Jobs lookup, bench Job page, Parts, QC lane (evidence-gated Pass / Fail), Evidence capture, two-lane legacy floor (`getRwFloorMap`, amber vs 9-lane).
- Components: `Job.components[]` head/band/case (W / B / P+PM), Mark complete (job detail RS+RW, inline bench buttons), manager Amend attribution, Awaiting components bin (RS board lane/filter/pill, RW floor Into-safe), reunification gate on Send to testing, auto-transition on last completion, Reports → Tech completions, Supervisor completions/month; QC-fail keeps credit + rework log (amber). Invoicing untouched.
- Tested iteration_26: 100%
- QC-fail credit ruling (2026-09-26): credit stands (locked).

### Supervisor Pad v2 (2026-09-26) — MH ruling: sale prices shown on the pad
- `/rw/pad` rebuilt tablet-native: Jobs (stepper, Advance/Send back, tech picker = supervisor override, detail sheet photos + condition report), Parts (scan → ref/caliber → caliber query → reference-scoped search with learned tag → GENERIC fallback → manager review, prices shown), Review (manager: price + part# per line, M3KE capture toast, Send for client approval → Outbox, simulated client decision, Allocate → Picking, bench WM approvals, M3KE log sheet).
- Files: `components/rw/pad/{PadBits,PadJobs,PadParts,PadReview}.tsx`, client.ts Pad v2 section, fixtures parts.ts (pt-33..48, CALIBER_BY_REF, m3keEvents, PR-0050), reports.ts (rep-03..05).
- Tested iteration_29 (all pass). Docs: SESSION-LOG, DECISIONS, OPEN-QUESTIONS Q77–80.

### Personal templates — point-of-use editing (2026-09-26)
- Edit next to Send (estimate Send modal, Inbox composer): Just this send / Save as my template (de-rendered to merge fields, badged with the user's name, auto-used for their future sends); shop default remains in Setup → Templates with a read-only Variants (n) list; system sends use shop default. Seed: Vienna's estimate_sent variant. Self-tested.

### View as client + multi-request demo client (2026-09-26)
- View-as-client (Client 360 + Inbox thread) with amber banner/exit, audited; portal home 'Your requests' cards (4 lifecycle states, watch identity on every card); client photo sections Arrival/Condition/Completed with lightbox, staff-only slots excluded; Robert Calloway (c-30) seeded across R1–R4; expired-estimate aging chip on Client 360.

### Send invoice + mock payment link (2026-09-26, VB4 edit-after-send mirror)
- "Send invoice" queues an Outbox email with a Pay button → `/pay/<token>` MOCK Intuit hosted page (live total/paid/balance, partial payments). Same link on the portal invoice. Editing the SO after send (shipping/lines) updates the page instantly, no resend; SO page shows told-vs-now per send; full payment flips badge to Paid. Self-tested end to end.

### KEEPER handoff refresh (2026-09-26)
- `/app/docs/KEEPER-HANDOFF/` covers everything post-E16: 8 new module specs, [post-E16] API census (389 exports), audit families 26–39, Q81–Q89, data-model dispositions, Parcel Pro seam, route map, not-Keeper list. Regenerate with `python3 _gen.py` after code changes.

### Bench Pad `/rw/bench` + kiosk contract + goal history + Job Messages (2026-09-26)
- Bench Pad: one kiosked iPad per bench — PIN lock (card + keypad, auto-submit), per-tech board: In progress (part-location chips) · Needs attention (stuck ≥4 working days / late) · Bands & splits (reunification state, band completed by whom/when) · Outsourced (vendor, days out) · Messages · Completed · Goals. No money, own numbers only.
- Kiosk: idle re-lock (default 10 min → PIN pad → straight back), no external links, "reconnecting…" banner + per-device last-board cache (cold start works offline), sticky header/clock, long-press gear → supervisor PIN → bench name / idle timeout / simulate-offline (localStorage; AMBER: Keeper registers device identity server-side).
- Goals: pace-line bar for the current month + 6 month tiles (goal vs actual, green check / red X equal weight, tap → by week + by component type). Rosa seeded hit 4 / missed 2 (17/18, 11/18).
- Job Messages: threaded internal board replaces flat notes on RS job page, RW job page, Supervisor Pad detail, WM room, Bench Pad. `@Short` routes by tier — manager/concierge → hit-list pin (click → job at thread), bench → Messages section with unread badge + per-person read state; replies re-notify the thread. Seeded Rosa→@MM (photo)→MM reply @Vienna + ambient note. Job Story not built (message ledger ready for its Comms lane). Tested iteration_32 + 33 (all pass).

### Inbound Shipping stages + Track a package (2026-09-26)
- `/shipping/inbound`: 4 stage tabs (Label Requests → Sent → In Transit → Delivered-unscanned), KPI strip, create-label sheet via mock Parcel Pro adapter (`api/carriers/parcelpro.ts`), resend / follow-up / void+reissue, simulate carrier scan, intake arrival auto-match by tracking#. Seeds sh-01..sh-10.
- Track a package: global search SHIPMENTS group, `TrackingPanel` slide-over (status/ETA, carrier, insured, newest-first events, copyable client one-liner), `TrackButton` on Client 360 + Inbox thread header.
- MH ruling (Inbox fix): button appears whenever the client has ANY shipment — anchored estimate's live shipment first, else client shipments newest-first; several → one button + `+N` badge, panel lists the rest ("Also for <client>", tap to switch). Tested iteration_30 + iteration_31.

### Supervisor Pad additions (2026-09-26)
- Parts tab segment **History**: every past request in the room, search by part name/number/PR#, status + job filters, detail sheet with "Who touched it"; composer shows "Past requests on this job".
- iPad camera: `<input type=file accept=image/* capture=environment>` on every job card / detail → slot sheet (client-visible vs internal) → attach / attach & shoot another → writes to the shared job photos (RS + RW job pages). Local object URLs only (prototype — no upload).
- Pad `Sheet` closes on Escape; fixture id collision pr-04 → pr-14 fixed. Tested iteration_31 (all pass).

### Inbox Staff section + Client request notes (2026-09-26)
- Inbox: "Staff" sidebar section (MH/Walter/Vienna/MM + open-assigned counts) → colleague inbox view (`?staff=`), header "X’s inbox", "Back to my inbox", read + reply. `getStaffInboxRows`, `getColleagueInbox`.
- Client requests: `Job.clientRequests[]`; amber card on RS + RW job pages (far from internal Notes); Pad per-card "Client request" add; CLIENT REQUESTS (n) badge + list on pad/wm cards; scan pop-up with "Understood" ack (Bulk/Station/WM/Pad scan) logging who/when; mandatory QC checklist (Done / N/A+reason / undo) gating qc_pass, finishJob, Pad Advance. Seeds j-30, j-04, j-16. `components/jobs/ClientRequests.tsx`.
- Tested iteration_28 (all pass). Docs: SESSION-LOG, DECISIONS, OPEN-QUESTIONS Q72–76.
- NOT built (superseded by MH): the earlier "Note to client" portal-visible notes idea.

### E18 — RW deep build part 1: shop floor core (2026-09-26)
- Under `/rw`: Shop Floor (two-lane, part-coloured dots blue/purple/green, drag, history slide-over, finish gate, counts, tech/type filters), Bulk Assign (TECH-xx + label scans, band-only labels → bracelet component + B dept, outbox queue with undo), Work Queue (part dots, filters, simulate client reply), Watchmaker Room `/rw/wm` (fullscreen, scan to safe/refinish, Request part, PIN switch), Station Scanner, **Supervisor Pad** `/rw/pad` (iPad-first: Advance/Send back w/ reasons, live-suggestion parts composer with learning recency, approvals w/ on-hand + OUT OF STOCK → Order part, photos grid + lightbox, header w/ clock), Picking `/rw/picking`.
- Model: components extended (station, partStatus, custodyTech, history), PickTask, PartsRequest on_order/received + items/source, Part.location. Seeds: j-30..j-33, Rosa (rosa/rosa123), 32 parts, 10 PRs, 10 photos.
- Tested iteration_27: 100% app-level pass. Docs: DECISIONS E18, SESSION-LOG (Q67–71), API-SURFACE §23; KEEPER-HANDOFF/source refreshed (module spec rolliworking.md should be extended in the next docs pass — TODO).
- Next: MH walks the screens on the iPad → reactions → E18 part 2 (full parts workflow).

### E16 — KEEPER handoff package (2026-09-26)
- `/app/docs/KEEPER-HANDOFF/`: 00-INDEX, 01-ROUTE-MAP, modules/ (17), 02-DECISIONS-CONSOLIDATED, 03-OPEN-QUESTIONS (verdict sheet), 04-DATA-MODEL-VS-KEEPER, 05-API-CONTRACT (generated), 06-SEAMS, 07-COMMS-AND-TEMPLATES, 08-AUDIT-TAXONOMY (generated), 09-TEST-INVENTORY (generated), 10-NOT-KEEPER, source/ copies, `_gen.py`. Re-run `python3 docs/KEEPER-HANDOFF/_gen.py` after any code change and re-copy `source/`.
- Next: MH answers 03-OPEN-QUESTIONS line by line; keep module specs in sync with rulings.

### E13 — RGTime /rg + public Kiosk /kiosk (2026-09-25, MH ruling: NFC tap)
- RGTime phone PWA (manifest /rg-manifest.webmanifest, start_url /rg): remembered per-device login (`rollisuite.rg.session`), status card, today's punches, Simulate-NFC-tap picker → real tag URL `/rg/clock?tag=<id>` one-button confirm (in/out toggles, division from tag, `simulated` flag), `/rg/manager` card+password manager-only week grid (Mon–Sun, totals, open-punch amber, prev/next, division toggle, day detail). Seeded tags: tag-fd-rw, tag-rs-counter; ~2 weeks punches.
- Kiosk: idle → brand → services (Skip — Continue) → form → thanks (5 s reset); 30 s dim, 2 min abandon reset; creates ServiceRequest source kiosk + General-thread message + `kiosk` audit; email/phone match → `possible existing client`.
- New staff `/requests` page (nav): division-scoped queue, Confirm link / Not the same → new client actions. Audit filters Kiosk/RGTime added.
- Hardening (NTAG 424 rotating codes / geolocation check) recorded in DECISIONS as Keeper decision — not built. Staff identity: Keeper RGTime owns (D-026), mocked via users fixture.
- Tested iteration_25: 100%; two design notes fixed (kiosk noValidate email error, audit filter chips)

### E12 — RolliTime /rt timing bench (2026-09-25)
- Own shell + bench sign-in, testing queue, label scan, Witschi-style 6-position test with caliber tolerances, live highlighting, auto-suggested verdict, PASS (email + QC flag) / REJECT (reason → qc_fail + email), append-only watch history, job Timing card. Tested iteration_24: 100%

### E15 — Portal-first client content (MH ruling 2026-09-25)
- Principle locked: emails notify, portal renders. /rc/report/:token inspection report page (grades, photos, notes, approve/decline, supersede forwarding); staff issue flow; 9 short templates with {{portal.link}}; decisions auto-thread + flip status
- Tested iteration_23 (~92%) → decline-error fix + timeline reason applied

### E14 — Comms hub (2026-09-25)
- Inbox → client thread-space: anchored conversations, sources, mocked reply-token routing, 5 views, assign/snooze/close, template composer with merge-field preview + photos → Outbox, internal notes, reply indicators (jobs/estimates), Client 360 link, /today thread rows, auto-threaded portal/parts/pickup events
- Tested iteration_22: 100%

### E10 — Companion panel (2026-09-25)
- Docked scripted assistant (Bot button / Alt+M), context-aware; Price Memory (model_references, evidence, Verify/stale), Client Brief (citations, service debt, corrections), Ask-the-shop (cards, route → manager task → answer → card), Photo labels (pills, provenance, log); money hidden for non-managers (amber)
- Tested iteration_20/21; final clarify fix applied after run 21 (logic-only change)

### E9b — Remaining RS modules + evidence (2026-09-25)
- Polish: pickup code pre-check, parts best-effort fallback, concierge Floor Map routing
- Purchasing, Inventory, Labels, Reports, Accounting, Setup (Users/Catalog/Templates/Locations/Printers), Integrations, Help — all seeded, audited, stubs amber
- Service Evidence: 4 QC slots keyed to watch label + job, QC-pass gate, Client 360 section
- Tested iteration_19 (17/18 → wording fix applied)

### Documentation pass for KEEPER (this fork)
- Rewrote `/app/docs/` from code as truth: DATA-MODEL, STATE-MACHINES, API-SURFACE, DESIGN-PRINCIPLES, DECISIONS (+ restated rulings), SEED-DATA; created SESSION-LOG (E1–E9 + 28 open questions for KEEPER's builder)
- Drift noted explicitly (counts, station list, `invoiceJob` real, `addStation` division arg, watch.status seed lag, `closeRequest` audit type)
- No code changes

---

## Data Models (key types)

```typescript
Division = 'rolliworks' | 'rollishop'
Station { id, name, division: Division }
User { id, roles, firstName, shortName, displayName, dutyLabel, accessTier, division: Division | 'both', password, pin }
Job { ..., division: Division }
Task { ..., division: Division }
PinnedItem { ..., division: Division, clientId?, estimateId? }
ServiceRequest { id, number, clientId, watchId, source, status, messages, closedReason }
```

---

## Pending / Backlog

### P2 Issues
- (fixed E9b) Concierge Floor Map dead-end
- P2: message templates edited in Setup are not yet used by Outbox writers
- P2: cross-division inventory rules unruled (amber)

### Upcoming
- Job Story (VB3-13) read-view over all ledgers incl. the new message ledger (Comms lane); Job Lookup floating tool (VB3-12); View as client (VB3-14)
- Stuck threshold per job type (currently single default 4 working days)
- E18 part 2 (full parts workflow) once MH walks the pad on the iPad
- amber items in DECISIONS (RGTime hardening, punch corrections, kiosk signature capture)
- 03-OPEN-QUESTIONS.md verdicts (Q1–Q80) pending from MH

---

## Constraints (locked)
- No backend, no database — pure frontend mocking
- `src/api/client.ts` is the only data access layer
- Staff views (`/`) are dense + keyboard-friendly
- Client views (`/rc`) are warm + customer-grade
- No cross-division visibility (wall = division, not tier)

### Docs publishing rule (2026-09-26)
- `/app/frontend/docs/` is the PUBLISHED copy of `/app/docs/` (GitHub sync was not carrying `/app/docs`). Keep byte-identical: run `bash /app/docs/sync-to-frontend.sh` after any docs edit (`_gen.py` runs it automatically). Never edit `frontend/docs` directly.

### Stage / bin audit · Trade job flow · Scan-to-complete · Client split strip (2026-09-27, MH briefs)
- **Audit**: `/rw/station` Move ↔ Audit toggle + `/rw/pad` Audit tab (`components/rw/AuditPanel.tsx`). 14 stations + 3 derived bins (`AUDIT_LOCATIONS`), belief vs scanned → ✓ matched / ? unexpected (Correct location = `via: 'audit_correction'`, or Investigate) / ⚠ missing (identity · client · value tier · last custody). Append-only `AuditSession`; missing → manager hit-list pin. Floor chips `floor-audited-<key>` amber after N days (Setup → Audits, `setAuditStaleDays`, default 7). Seeds aud-01 clean (WM Bench 2), aud-02 missing (Safe await band, j-32 head, pin-audit-01).
- **Trade jobs**: `JobKind 'trade'`, `JobStatus 'awaiting_manager_review'` (JOB_FLOW; other kinds skip it via `skipStages`), `Client.managerShort/internal`; c-31 RolliShop (internal, Walter), c-25 Vidal (external, MH). `/intake/trade` scan-in (`tradeScanIn`) → in_service; testing → `to_manager_review` (pin to account manager, own division) → Dashboard `TradeReviewPanel` Accept (`trade_accept` → SO; internal = no email, external = invoice email) / Send back (reason picker → bench, rework). `TradePathStrip` on RS/RW job pages; `KindPill` shows account. Seeds j-t1 E02050 (band at Refinishing), j-t2 E02051 (awaiting Walter, pin-trade-01). `queueJobEmail` suppressed for trade accounts.
- **Scan-to-complete**: `movePart` into safe_await_band/head completes the component (credit to scanning tech, once) + auto-transition when all in; `FloorDot.completed` → `CompleteToast` (station page + floor) with 10 s `undoScanComplete` full revert (`SCAN_UNDO_MS`).
- **Client split strip**: `PortalSplit` on `PortalWatch`/`PortalRequestCard` (`portalSplitFor`), `rc/RcSplitStrip.tsx` (full on watch page, compact on cards). Seed: j-r3 band complete (Rosa, safe_await_head), head on WM Bench 2.
- Job counter now seeded from max job number (was colliding at E02031).

### RolliTime re-homed + Work grading gate (2026-09-27)
- `/rt` → `/rw/testing` (+ `/rw/testing/test/:jobId`), redirects kept; files `pages/rw/testing/`. RW nav "Testing"; `RwStationKey 'testing'` station (floor right column, auditable); `testingStationScan` = custody transfer of all parts; `timingPassed(j)` Q47 flag → `/rw/qc` "timing pass" badge, sorted first.
- **Grading gate** (`GradeGatePanel`): categories = Setup lookup (`SetupGradingCard`, `addGradeCategory/toggle`, scopes head/case/bracelet/whole; seeds Cleanliness · Case condition), 1–5 tap, note/photo required ≤3, tech auto-resolved from component completions (editable), self-graded flag, append-only `WorkGrade`; ≤2 pins manager list; `recordTimingTest` throws until gate ready; Start test button locked with missing names. Bench Goals tiles show ★ avg; Reports → Tech completions gains quality rows. Seeds `gradeSeeds` (Rosa/MM history, wg-07 self-grade, wg-12 low → pin-grade-01); j-16 E02026 in testing ungraded (blocked).

### Client rating badge + incoming-call screen-pop MOCK (2026-09-27)
- `ClientRating` A/C/N (`clientRatingSync`, `setClientRating` logged), `RatingBadge`/`RatingEditor` on Client 360, Inbox thread, RS/RW job pages, RW job lookup rows, call toast. STRICTLY internal — never imported by /rc. Seeds c-30 5/3, c-05 4/4, c-10 2/4.
- `src/api/telephony.ts` seam (`onInboundCall` → `receiveInboundCall` → `onScreenPop` listeners) — the one file a Vonage VIP webhook replaces. TopBar 📞 dev menu (`SimulateCallMenu`), `CallPopToast` (known → Client 360 + Companion; unknown → `/clients?new=1&phone=` → `NewClientFromCall`). Call events → client comms history + audit log. MOCKED.
- Tested iteration_35 (all pass after counter fix; two reported misses were reload artefacts, re-verified in-app).

### Deliverables
- `/app/frontend/public/supervisor-pad-screens.zip` — 15 PNG iPad screens + INDEX.txt (script `/app/memory/tools/pad_shots.py`).

### Estimates as URLs · Portal inspection approvals · Call ledger · Missed calls (2026-09-27)
- `portalDeepLink(clientId, next)` magic-link deep links (MagicLink.next/revokedAt; RcAuthPage honours `?next=`); estimate + inspection emails carry one link, no attachments. RcEstimatePage: immutable copy note + Download PDF (print), superseded banner (`supersededById` set by duplicateEstimate), expired → `portalRequestRequote` (concierge pin + Inbox event), `RcSendWatch` (portalRequestLabel → InboundShipment stage label_requested; portalDropOff; `SHOP_ADDRESS`), `engagement[]` on Estimate. Seed e-r4 E02060 (Calloway Day-Date w-43, sent).
- RcReportPage: polish choice, `INSPECTION_SURVEY`, signature required, ask-a-question (`portalAskAboutReport` → portalSendMessage → Inbox), `InspectionDecisionRecord` (rp.decisions; `getInspectionDecisions`) shown via `RcDecisionRecord` on report + watch page, `JobDecisionRecords` on staff job page. Seeds rep-r3 pending (token IR-E02040-V1-CALLOWAY), dec-r1.
- Call ledger (`CallEvent` full: direction/outcome/duration/jobId/notes/afterHours/resolution): `getCallEvents(filter)`, `callCountsSync`, `logCall`, `addCallNote`, `linkCallToJob`, `getMissedCalls`, `resolveMissedCall`; `receiveInboundCall` handles answered:false → ScreenPop kind 'missed'. UI: `CallLedger.tsx` (CallCounter on Client 360 header, CallHistoryModal w/ filters + Log call, CallRow notes/job chips, JobCallsLine on job page), `CallPop.tsx` (missed toast, CallNotePrompt after call), `MissedCallsPanel` in Inbox needs_reply, dev menu missed/voicemail options (`telephony.ts`). 7 seeded calls (c-30 ×5, c-05, unknown). Tested iteration_36 (pass; li-count notes were nested note rows, not bugs).

### Inventory deep session + Claude vision evidence pipeline (2026-09-27; fork-fixed + tested iteration_37)
- **Count mode** `/inventory/count` (`CycleCountPage.tsx`, entry button on Inventory header `inv-count-mode`): LOC-xx location lock (scan or Lock), part scan → qty → variance colours, zero/skip gate on Confirm, switch-location prompt, `postCycleCountV2` → audited adjustment movements + lastCounted, count-next queue (`CYCLE_STALE_DAYS` 30), manager-only Variance report + CSV. MGR tier (Inventory gate) — Q91 asks about bench techs.
- **Purchasing deep** (`PurchasingDeep.tsx`): Needs-ordering queue → Generate PO per vendor, price-vs-average colouring with manager Acknowledge for red lines, Parcel Pro label / upload on PO, put-away location on receive, vendor cards + CSV import.
- **Claude vision — REAL via Emergent key** (`api/ai.ts` → `backend/ai_routes.py`, claude-sonnet-4-6): `extractEvidenceSheet` (timing_sheet / pressure_test photo → `SheetExtractVerify` suggest → tap-to-correct → Verified, mounted in `EvidencePanel`) and `draftClientStatusLine` ("Draft with Claude" in the tracking panel, falls back to static line). Only AI seam in the app.
- Fork fix: `PoModal` missing `locations` prop (TS2304 build break). Docs: DECISIONS, SESSION-LOG, OPEN-QUESTIONS Q91 synced.

### RGTime deep session · Bill audit · SO QR · Estimate from request · Legacy archive (2026-09-27; tested iteration_38)
- **RGTime `/rg`**: `?station=` tag URLs (door-main…), name+PIN device binding, one-button clock with huge confirmation, **localStorage persistence for /rg only** (punches/queue/settings/kiosk lock), real geolocation geofence (Manager → Settings; placeholder Manhattan coords — MH to set real ones) → `offsite` flag never rejects, offline queue + `rg-sw.js` → `synced_late`, My week `/rg/week`, Manager (concierge+) Week/Flags/Export CSV/Settings, append-only corrections + missed clock-out resolution, Kiosk `/rg/kiosk`. Seeds: 5 staff × 2 weeks incl. offsite, synced-late, missed clock-out, correction, open punches.
- **Bill audit `/shipping/bill-audit`** (manager): PDF/image → Claude `/api/ai/extract-bill`; CSV local; verify parsed lines → match vs `getLabelLedger()` → buckets (voided-billed $34 seed on top) → Accept/Dispute → `shipping_dispute` template → Outbox; summary strip + recovered credits; append-only sessions.
- **SO Print/PDF** with QR → tokened Watch Records link (also in invoice email). **Create estimate from request** (Inbox header + /requests → prefilled form → request quoted, estimate chip, "Reply with the quote"). **Legacy archive** (E-8842/INV-8842/E-7710 read-only badges everywhere; manager Convert to editable).

## Pending / next
- Real shop lat/lng for the RGTime geofence (user left the field blank). Q91 verdict (bench techs in count mode). Backlog: amber/provisional items (Q57 floor lanes, per-kind evidence slots, cross-division inventory rules, templates → Outbox wiring for legacy emails, hide-money for non-manager tiers).

### Code review fixes (2026-09-27; tested iteration_39, backend 16/16)
- `ai_routes.extract_bill`: message built once, `text` assigned on a single path; return type hints on `server.py` routes; test files: implicit boolean asserts + type hints. No behaviour change.

### E17 Convergence — hybrid mock → real API (2026-09-27; tested iteration_40)
- `src/api/config.ts` (API_BASE_URL https://rolligroup-prototype-api.fly.dev, API_MODE hybrid|mock via localStorage `rollisuite.api.mode`, API_SOURCE split), `src/api/routing.ts` (route + per-call mock fallback + toast + health), `src/api/realClient.ts` (hand-generated from stub /contract — no maps_to), routed exports at the tail of `client.ts`; AppShell banner "· LIVE API / · MOCK" (click flips mode), ApiToast, RouteErrorBoundary (never white-screen).
- Live: sign-in (sign-in 401 → switch-user PIN), dashboard KPIs/activity (derived), today, search, estimate detail, SOs, requests (stub), packages. Parked at mock (real impl ready): getEstimates list, getJobs, getJob — shape gaps. Full findings: `docs/E17-CONVERGENCE-REPORT.md`.
- Remaining briefs from the same message (not started): component chips + trickle-down chain, per-staff client reviews, QBO setup screen, station intercom + paging, Band room pad + WM department dashboard, no-estimate receiving branch (SUB#).

### iPad screenshot zip (2026-09-27, 4th request — delivered)
- `scripts/ipad_screens.py` (Playwright, 1024×768 @2x) → `frontend/public/ipad-screens/*.png` + `frontend/public/ipad-screens-2026-09-27.zip`, served at `<REACT_APP_BACKEND_URL>/ipad-screens-2026-09-27.zip`. Contains what exists today: WM Supervisor Pad (Jobs/Parts/Review/Audit), supervisor view, bench view, work queue, RW jobs lookup, picking, RW today, Jobs board (all lanes / list / in service / testing / closed / shop time). NOT built yet (queued briefs): Band/Polish Room pad, WM department goal dashboard, Queue/In-progress/Finished job tabs. Re-run the script after those ship.

### Supervisor Pad dashboard + parts Quick Add/returns + request history (2026-09-27; tested iteration_41 ~92%, Rosa gate = standing ruling)
- `PadDashboard.tsx` (DeptGoalTracker reusable), `PadQuickAdd.tsx`, `PadReview.tsx` RequestHistory chips; client.ts: getDeptDashboard/setDeptGoal, jobPartsAllowance/setJobPartsAllowance/getJobParts/quickAddPart/returnJobPart.
- Backlog (not built): OOS → client notice email; "also used on" cross-ref display; pad job-row density; RW history lookup; Band room pad; component chips + trickle-down; per-staff client reviews; QBO setup; intercom + paging; SUB# receiving branch. Re-run `scripts/ipad_screens.py` after Band pad ships.

### Queued-brief batch — everything built + full iPad screen set (2026-09-27; tested iteration_42 ≈100%)
- **Quick fix**: Send back LEFT / Advance RIGHT on Pad job cards + Dashboard TradeReviewPanel.
- **Rosa gate fixed**: `/rw/pad` no longer manager-only; bench tier mounts the pad with only Requests (read-only `pad-review-readonly`) + Picking tabs.
- **Component code chips + trickle-down chain**: `Estimate.components` (W/B/P/PM, inferred from lines until toggled — `inferComponentCodes`, `estimateComponentCodes`, `setEstimateComponents`), `Package.componentsVerified` written at Scan 2, `getVerificationChain`/`getJobVerificationChain` → Expected → Received → Verified rows (ok/missing/extra/pending). UI: `components/estimates/ComponentChain.tsx` on estimate create/detail, job detail, and "What's in the box" pills on Receive Watch (`box-pill-*`).
- **Per-staff client reviews**: `StaffReview` (A/C per staff, N = jobs handled, note), `getClientReviews`/`submitClientReview`; aggregate badge = rounded mean of latest review per staff (still via `setClientRating`, logged). `RatingEditor` is now the drill-down review panel. Seeds rv-01..05.
- **QBO setup (MOCKED)**: `/integrations/quickbooks` (`QboSetupPage`): connect/disconnect, push/pull toggles, fixed field mapping, client sync table (synced/conflict/not linked, link/skip), invoice push queue, activity log. Linked from the Integrations qbo tile.
- **Intercom + paging (MOCK)**: `src/api/intercom.ts` (ring → live → hang up, storewide page overlay 8 s, Daily.co TODO seam) + `IntercomButton` in RS TopBar and RW shell header.
- **Band / Polish Room Manager Pad**: `/rw/band` = `RwPadPage room="band"`; `getPadBoard(room)` filters B/P/PM workflows; `ROOM_TECHS` (band: Joseph, Rosa); new staff **joseph / joseph123** (manager, rolliworks). RW nav "Band Pad" (manager).
- **No-estimate SUB# branch**: `NoEstimatePanel` on Receive Package — `matchB2bLabel` 3-tier chain (tracking/estimate # → trade account code → name/email → none) + `attachB2bMatch` (pkg.b2b stamp, client link or SUB#-only).
- **Inbox threading**: `?group=1` toggle groups threads by request / job / estimate anchor (General for unanchored).
- **Jobs board tabs**: All lanes · Queue · In progress (columns per tech, chip filters tech + stage) · Finished (`components/jobs/JobTabs.tsx`, `?tab=`); `JobCard` density tightened.
- **RW History lookup**: `/rw/history` (`searchRwHistory`, no amounts) — client → watches → every record; RW nav "History".
- **Screens**: `scripts/ipad_screens.py` rewritten (35 screens + INDEX.txt, forces mock mode, handles PIN-day sign-in) → `frontend/public/ipad-screens-2026-09-27.zip` (same public URL).
- Gauge hygiene: `lineDollars` normalises cents-scale seeded trade lines for the dept revenue gauge only.
- Not done / open: docs/KEEPER-HANDOFF regen (`_gen.py`) not re-run this session; Daily.co + Intuit OAuth remain Keeper.

### Addenda batch 2 (2026-09-27; tested iteration_43 ≈98%, two cosmetic notes left as-is)
- **Seed correction**: "Rosa" was a data error → **Chyna — Concierge** (`u-chyna`, chyna123, concierge tier, no bench data). Her former bench history/goals/assignments moved to new watchmaker **Leo** (`u-leo`, leo123) so E02031/E02032/E02050 etc. are tech-assigned. Global rename in fixtures (bench, jobs, parts, rw, tasks, components, rgtime) + `ROOM_TECHS`.
- **OPEN QUESTION for MH (Q91)**: what should a Concierge card see on the Supervisor Pad? Current read-only Parts Request History (+ Picking tab) is a PLACEHOLDER with an amber banner (`pad-concierge-open-question`) — not a ruling.
- **Pad job detail**: `getJobEmails(jobId)` aggregates Outbox rows for the job / estimate / SO / PRs (parts-approval first, status from PR: sent · awaiting client / approved / declined); DetailSheet shows Intake/Inspection/Completed photo groups, "Inspection report · condition on arrival", Sent emails (read-only, expandable body). Seeds ob-pr37 (PR-0037, E02031), ob-e2031.
- **Audit scoped by role**: `AuditScope 'full'|'wm'|'band'`, `AUDIT_SCOPES` + `auditScopeFor(user)`; MH/owner full grid unchanged; MM (WM Supervisor) sees safes, WM benches, new derived `stuck_parts_bin` (parts hold), testing, "MM Inspection" (= finished), pre-queue, refinish, polish; Joseph band scope on `/rw/band`. `AuditPanel scope` prop; `/rw/station` stays full.
- **Team tab**: `techRevenueGoals` per staff ($), `getTeamGoals(room)`, `setTechGoal`; department goal is DERIVED = sum of the room's team (`getDeptGoal`); DeptGoalTracker goal is read-only (`dept-goal-total`, `dept-goal-derived`); `setDeptGoal` now throws. Seeds WM 12k/14k/10k/12k = $48k, band Joseph 14k + Leo 12k.
- **Sidebar**: RW-only screens (Bench, Supervisor, Floor Map) nest under one "RW" accordion (`nav-rw-group`, `nav-rw-toggle`, `nav-rw-items`); new top-level **All Jobs** (`/jobs/all`, `AllJobsPage`) — 14 combinable category chips + search, list-density rows.
- **RW Reports** `/rw/reports` (`RwReportsPage`): 6 quick reports, date range / movement-only / 9 statuses / 11 categories (shared `JOB_CATEGORIES`, `REPORT_STATUSES`, `QUICK_REPORTS`, `getJobReport`), results table with red overdue days, **Print Report** → real US Letter via `@media print` + `@page { size: letter }` (`.print-area`, repeating thead).
- Screens zip regenerated (39 screens incl. Team, job detail emails, scoped audit, All Jobs, Reports, sidebar RW group) at the same URL.

### Batch 3 (2026-09-27; tested iteration_44, all findings fixed + self-verified)
- **Corner history lookup widget** (`components/layout/CornerLookup.tsx`): fixed bottom-right pill on RS (AppShell) and RW (RwShell, hidden on fullscreen pad/bench). Name / email / est# / SO# / job# → clients, estimates, jobs, sales orders. `/rw/history` page kept as supplement.
- **Inbox thread cards**: right pane = `ThreadStack`, one collapsible card per thread of the client (selected/most recent expanded), `unreplied` count on `ConversationWithRefs` (inbound after last outbound, not cleared) shown on cards + list rows; `clearMessage()` marks a client message handled without reply (internal note + audit). Numbering confirmed: RQ-##-#### (portal/web) vs SUB-YY-#### (physical receiving) — kept separate.
- **LIVE flip**: `API_SOURCE.getEstimates/getJobs/getJob = real`. realClient: `estimate()` maps `valid_until`; `job()` maps number, simple_status, watch_id/watch, lines, total, timeline, holds (camelCase), customer; status map `complete → ready_to_ship` (Cursor's call, flagged). `getRequests` → `/intake/leads`; `getRequestsQueue` shows live leads in hybrid mode. Walkthrough (sign-in → estimates → detail → board → job) renders live, no fallback toasts. Estimate header shows "Valid until". **User must click "Save to GitHub"** to land on main.
- **Receive Watch (Stage 4) redesign**: 1 scan est#/SUB# (`findInspectionPackage`) → 2 customer → 3 what was received (read-only) → 4 inspector's confirmation (box pills + in-hand notes) → 5 component chips (override) → 6 serial + reference with `decodeSerial` (prefix table; real reference tables outstanding) → 7 date received → 8 estimate copy → 9 Cancel / Save / Save & Print (labels marked printed). Result → "Start inspection → camera".
- **New Inspection form** (`/inspection/new`, `/inspection/:id`; `fixtures/inspectionForm.ts`): top bar Scan Label / Camera / Scan Sheet + 2-stage indicator; watch details (dept tags W/B/P/PM/SJ, type dropdowns, target weeks + range); per-component cards Dial/Hands/Bezel/Crown/Case/Crystal/Bracelet with numbered condition (1–6, +7 Waiver on Dial/Hands), **authenticity Genuine / Not genuine / Genuine but not correct / Undetermined**, learned numbered preset notes (`learnInspectionNote`), Other + Add Note, waiver, $ price, Yes/No summary, free-form notes; Case extras (retail polish, restoration $, welding $); Crystal polish-up Y/N; Dial variant tags (BUCKLEY/SIGMA/Mk… + learn); bracelet repair 6 lines; overall notes + quick tags + waiver; running total; live **report preview** (`InspectionReportView`) with Draft/Save/PDF/Print; client page `/rc/inspection/:token` (public allow-list). Seed `insp-01` = Calloway E02040, $1,962.
- **Camera flow** (`InspectionCameraFlow`): reuses `useCamera`; 2× IPEVO then microscope; SPACE = shutter; placeholder frames without hardware; chained from Receive Watch save (`?camera=1`).
- **Scan Sheet — REAL Claude Vision**: backend `POST /api/ai/extract-inspection-sheet` (image or PDF, same `_chat/_pdf_to_images` pattern as bill audit) with the v1.1 schema (green highlighter = selection, red ink = handwriting); `ai.extractInspectionSheet` → `SheetVerify` suggest→verify → `applySheetSuggestion`. Verified end-to-end on a synthetic sheet (`public/sample-scantron.png`): Dial 3/#1,#2/$120/Y, Crown 4/#2/$55, links $165 Y, band polish 6 include, notes — confidence 0.82.
- **OUTSTANDING FROM MH**: the real "Inspection Scantron — Rolliworks v1.1" PDF and the legacy inspection form screenshots were NOT attached to the message — extraction was built and tested against the written schema only. Add to outstanding files (with auth reference PDFs, Q48/Q49).

### Documentation pass (2026-09-27)
- Wrote `docs/REBUILD-SPEC-2026-09-27.md` (also served at `<REACT_APP_BACKEND_URL>/REBUILD-SPEC-2026-09-27.md`): per-module purpose / data model / state machines / business rules / API surface (LIVE vs MOCK) / consolidated STAND-INS / OPEN questions / queued build items.
- QUEUED (not built, user said "stop building for this message"): (1) WM Room Jobs list-view toggle; (2) per-line checkbox partial convert to SO / intake with leftover-line record; (3) intake flow steps 5 Photos / 6 Inspection / 7 Awaiting Approval — relocate existing screens, remove sidebar entries, live counts.

### Parcel Pro label request + two-scan receive (2026-09-27; tested iteration_47, 100%)
- **insp-save**: could not reproduce via SPA nav (works); hardened with a StrictMode double-create guard (`creating` ref) + `console.warn` on save failure. Awaiting Approval report LINK variant verified.
- **Part A (MOCK Parcel Pro)**: `RcSendWatch` form = name / address / **insured value** / **1-day · 2-day** → `portalRequestLabel(clientId, estimateId, {address, insuredValue, serviceLevel})` → `InboundShipment.request: LabelRequestDetails`. Staff `/shipping/inbound` Label Requests: Ship-from · Insured · Service columns + one-click **Send** (`sendLabelRequest` → `parcelpro.purchaseLabel` = label + insurance in ONE call → `confirmationId`, `trackingNumber`, `labelUrl`, `cost`, stage `label_sent`, label email to Outbox). `PARCELPRO_API_KEY` at the top of `api/carriers/parcelpro.ts` is the one-line live switch (`parcelProMode()` shown on the page). Seeds sh-01 (1-day, Eleanor) / sh-02 (2-day, Isabella) carry portal forms.
- **Part B (two-scan)**: Scan 1 `/intake` → `logArrival` matches tracking # to the label request (`PackageScan.matched` label_request / manual / none) → `ShelveCard` (manual client fallback, bin select or bin scan `BIN-04`/`bin 4`) → `shelvePackage` (occupancy check, custody event, courtesy “We have your package — not yet opened” Outbox email once per package). 12 shelf bins (`SHELF_BINS`, `getShelf`, `ShelfBoard`). Scan 2 `OpenScanCard` (Arrival + Receive list) → `openScan` (bin / tracking / SUB#) → `/intake/receive/:id` (existing Stage 2); the list “Open” link also fires `openScan`; “opened without Scan 2” badge otherwise.
- **Chain of custody**: `PackageCustodyCard` on receive page + job detail (`job.packageId`), Client 360 Custody rows (`arrival_scan` / `shelved` / `open_scan`), `/rw/history` packages block, corner-lookup bin chip (`shelfPackagesSync`). Seeds pk-01 BIN-01 (unknown client), pk-02 BIN-02 (Kowalski, matched).
- **Shop Floor station map (2026-09-27; tested iteration_48, 100%)** — MH ruling: prototype it here, do not carry the two-lane dot board forward. `/rw/floor` replaced by `components/rw/StationMap.tsx` + rebuilt `RwFloorPage.tsx`: WAT track (Pre-approval → Pre-queue 🔒 → Assign watchmaker → Uncase → *[Manager safe 🔒 → Assign refinisher → Manager safe 🔒]* → Movement service → Parts approval → Recase + test → Manager safe 🔒 → Final assembly) and BRA track (Pre-queue 🔒 → Assign band tech → *[same gated leg]* → QC inspect → Manager safe 🔒); shared Final assembly → Testing → Finished. Amber solid = off-ramp, dashed = track (SVG overlay measured from DOM). Lock = that manager's safe (owner shown). New stations `uncase, mgr_safe_polish_in, polish_room, mgr_safe_polish_out, movement_service, parts_approval, recase_test, band_assign, band_mgr_safe_in, band_mgr_safe_out, band_qc`; `polish` removed. `polishGateScan(label, in|out, watch|band, polisher?)` manager-only, guard = part must be in the gate's safe, OUT hands custody back to the head's WM and completes case/bundled band with refinisher credit; `GateScan` ledger (`getGateScans`) under the map. Bundling: `isSplitFlow` — non-split jobs send case (+ bracelet) together, W-only jobs get a courtesy `case` part at the gate; split jobs use `BAND-` label on the BRA leg. Tabs: Manager gate scan · Bulk assign (embedded) · Component lookup. Docs: REBUILD-SPEC §7.3.

### Shop Floor · Bulk assign + Component lookup rebuilt (2026-09-27; tested iteration_49, 100%)
- **Bulk assign** (`components/rw/FloorPanels.tsx` BulkPanel): destination = click a station/safe card on the map (`StationMap onSelect`, `data-selected`) → scan many (`resolveBulkLabel`: rows only, no move) → per-row remove → **Commit** (`bulkCommit`) moves all at once; gate destinations (`polish_room`/`movement_service`/`refinish`/`band_qc`) run the manager-gate rules per item (`gateScanJob`), moved/blocked per row, hand-to required for gate IN. TECH-code “Morning handout” kept as a narrow secondary mode behind a link.
- **Component lookup** (LookupPanel): one bar for est# / ref# / barcode / client name with type-ahead (`searchClients`), client → components with `roomCode` badges (`W · MM`, `P · Walter`, `B · Joseph`, FA/T/✓), est# per job when several, item label from Receive Watch (`ReceiveWatchInput.itemLabel` → `Package.itemLabel` → `FloorDot.itemLabel`, field `rw-item-label`; same page serves band-only jobs); map dims other dots and shows est# + badge on the client's (`focus`). Seed pk-11 (E02007/E01040) itemLabel `1/2`.

### Shop Floor reachable from the desktop app (2026-09-27; self-tested)
- Desktop `/floor` now renders the station map (`RwFloorPage` in a dark wrapper `desktop-shop-floor`) inside the RS shell; sidebar RW group item renamed **Shop Floor** (manager tier). Legacy 9-lane chip board moved to `/floor/lanes` (not in nav).
- Links added: desktop Supervisor board header → `sup-shop-floor-link` (/floor); Supervisor Pad (`/rw/pad`, manager only) header pill `pad-shop-floor-link` + bottom tab `pad-tab-floor` (/rw/floor). Kiosk path `/rw/floor` unchanged.

### Sidebar restructure — Part 1 (2026-09-27; self-tested; more groups to come)
- `config/navigation.ts`: `NavGroupKey = 'intake'|'clients'|'rw'`, `NAV_GROUPS` (header may itself be a page via `path`). Items carry `group`. **Intake** ▸ Requests · Inbox · **Shipping** (renamed from Inbound; page h1 now "Shipping") · Estimates · Bill Audit (header → /intake). **Clients** ▸ Jobs · All Jobs · Sales (header → /clients). RW folder unchanged (Bench · Supervisor · Shop Floor).
- `components/layout/Sidebar.tsx` rewritten around a generic `Group` (header NavLink + chevron toggle `nav-<group>-toggle`, children `nav-<group>-items`, auto-open when a child route is active). Routes untouched. Test ids: `nav-intake`, `nav-clients`, `nav-rw`, children keep `nav-<key>` (e.g. `nav-inbound` = Shipping).

### Assign / Move — separate destination-map screen (2026-09-27; self-tested)
- New sidebar item **Assign / Move** (`/assign`, manager tier, top-level; also `/rw/assign` in the RW kiosk nav). `components/rw/DestinationMap.tsx` reuses `NODES`/`SHARED_NODES` from StationMap for the identical structure but renders NO job badges/counts — generic clickable nodes only. Click node → `BulkPanel` (showHandout=false) scan mode → running list (client · est# · watch · part) → Commit (`bulkCommit`, same gate/bundling rules). `/rw/floor` untouched.
- Assign/Move map refinements (2026-09-27): Pre-approval / Pre-queue (both tracks) removed from `DestinationMap` (`HIDDEN`), tracks start at Assign watchmaker / Assign band tech. Map is blank by rule — no counts/badges ever; the only job data is the single-job lookup bar on the page (`assign-lookup-input`, est#/ref#/barcode) which marks ONLY that job's parts on the nodes (`dest-mark-<job>-<part>`). `/rw/floor` untouched.

### AI client-update summary + corner widget embed + Assign/Move polish (2026-09-27; tested iteration_50, 100%)
- **Summary (template fill)**: backend `/api/ai/job-summary` (Claude, `SUMMARY_SYSTEM`, JSON fields only: job_status · per_component_status_line|null · target_date · variant queue/progress/finished_qc/approval/parts/hold/ready). `client.ts jobSummaryContext(jobId)` builds the allowed context (client first name, status, dueAt, per-part `PLAIN_LOCATION` translation of station keys, days at step, open items: awaiting approval / estimate pending / hold / part on order / ready). `ai.ts fillSummaryTemplate` assembles the fixed template in code; `localSummaryFields` = rule-based fallback when the model fails (source badge shows which). `components/jobs/JobSummaryDraft.tsx` = Generate → editable textarea → Copy; never sends. Mounted on `/jobs/:id` (“Client update · summary draft” card) and inside the corner lookup job panel.
- **Corner History lookup**: job rows now expand inline (`corner-job-<id>`, widget widens to 820px): “Where it is now” badges (`roomCode`), embedded `DestinationMap` (zoom .62, offset-based connector geometry so it stays aligned) with only that job's parts, summary draft; `corner-job-open-<id>` jumps to the job. Previously it only linked out — fixed.
- **/assign**: BRA safe → Final assembly merge is drawn (was already a transition on the board; rendering confirmed on both maps).
- Assign/Move map: manager-safe nodes now show a safe image (`/safe.png`, generated + background-removed) instead of the lock glyph (`safe-icon`). Shop Floor board unchanged.

### Custody (staff possession view) (2026-09-27; self-tested)
- Sidebar **Custody** (`/custody`, manager tier) directly below Assign / Move. `client.ts getCustodyByPerson()` groups every part (`custodyTech`) of non-closed jobs by holder (same data as the floor board / custody log) → `pages/rw/CustodyPage.tsx`: one section per person (name + count), thin 32px rows collapsed by default = Est# · client last name · model · dept tag (`DeptBadge`, part → W / B / P / PM); expand = part, where (safe lock, station, status, since), job link + status + workflow chips, last notes. Seeds: Vienna (safes: E01049 case PM, E02023 band+case, E02031 case, E02032 head), Chyna (finished pieces at desk: E01043, E02017, E02029 ×2, E02030), Mike/MH (fresh intake: E02020, E02022 ×2, E02024) plus Walter/MM/Leo/Joseph from existing seeds. `HOLDER_NAME` maps MH → "Mike (MH)".
- Assign/Move map tweaks: safe nodes = safe image only (no labels); BRA flow inline straight (no off-ramp); shared column relabelled Final QC / Invoicing → Awaiting Payment → Awaiting Shipping (map-only labels).

### Sidebar Part 2 — Parts & Inventory group (2026-09-27; self-tested)
- `NAV_GROUPS` + `parts` group (folder, no header page): **Parts & Inventory** ▸ Inventory · Purchasing · Parts Knowledge · **Parts** (stub). Routes unchanged. Test ids: `nav-parts` (group button), `nav-parts-items`, `nav-inventory`, `nav-purchasing`, `nav-parts-knowledge`, `nav-parts-catalog`.
- **Parts stub** `/parts` (`pages/rs/PartsStubPage.tsx`): "coming soon" listing what a Parts home would own and where the pieces live today (Inventory / Purchasing / Parts Knowledge). FLAGGED for its own build — no catalog functionality invented.
- **Parts Knowledge = M3KE / Jarvis (external app)**: banner on `/parts/knowledge` (`m3ke-handoff-banner`); local mirror kept as the prototype stand-in. OPEN QUESTION for MH: new tab vs embedded (iframe) + the M3KE URL → then the nav entry becomes an external launch.
- Custody revised (2026-09-27): two-column grid (`custody-grid`), each person collapsible & collapsed by default (`custody-toggle-<tech>`, header = name + count only; `custody-list-<tech>` on expand). No bin sub-headers exist in this prototype's Custody data (user mentioned Vienna's bin sub-headers — flagged).

### Parts module (consolidated) + MH Hitlist (2026-09-27; self-tested)
- **Parts** `/parts` (`pages/rs/PartsPage.tsx`, replaces stub): tabs Parts · Calibers · Reorder. ONE record via `savePart(PartInput)` (create/edit modal `PartForm`: part#, description, category from `PART_CATEGORIES` (existing list ported, legacy keys mapped by `canonicalCategory`), caliber links to the ONE caliber table (`calibers`, `saveCaliber`), cost, sell price, vendors, **location = safe → bin** (`PART_SAFES`, no free text), low-qty trigger + order-up-to (→ canonical `inv.reorder`), initial on hand). `getPartsModule()` / `PartRow` (onHand, onOrder, flagged = onHand+onOrder ≤ trigger, reorderQty = up-to − onHand − onOrder). Inventory's per-location reorderPoint retired: `getStockRows().low` now derives from the canonical rule. ONE search `searchPartsSync/searchParts` (part#, description, alias, category, caliber, ref) — Pad `padSearchParts` and `suggestParts` now pull their candidate pool from it. PO-line inline create: `po-new-part` in the New PO modal opens `PartForm` preset with the PO vendor; saved part is appended as a line at cost. Seeds: 3 parts set at trigger (pt-03/07/11) + existing → Reorder tab shows 6.
- **MH Hitlist** `/hitlist` (`pages/rs/HitlistPage.tsx`, manager-only nav above Custody) — first real instance of the manager hit list: live **Client asset value on hand** tile (Σ inbound-shipment declared value for every job in custody; drop-offs $0; per-job rows insured/drop-off/no value; auto-refresh 15 s) + **Bypass use** feed (`BypassEvent`, newest first): `receiving_camera` (new checkbox `receive-camera-bypass` on Receive Package — photos now required unless bypassed) and `payment_release` (wired into `confirmShipment` / `confirmPickup` when a bypassReason is given; shows invoice $ + minutes since payment, green ≤ 10 min "within Intuit sync lag", red otherwise). 4 seeded entries across Vienna/Chyna/MM/MH. Other bypass buttons in the app: none found beyond these two.

### Hitlist MH-only lock + bypass logging verified · Vendors screen (2026-09-28; tested iteration_51, 12/12 pass)
- **Hitlist owner-only**: `OWNER_USER_ID='u-michael'`, `NavItem.ownerOnly`, `canAccess()`/`navForUser()` (`config/navigation.ts`), route `TierGate` + `getHitlist()` throw → MM/Vienna/Walter/Joseph see no nav entry and a Restricted page. `findNavItem` now longest-path match.
- **Bypass logging FIRED + LOGGED end to end**: receiving-camera (pk-01 → SUB-26-0311, MH · Front Desk 1 · carrier detail), payment-release at Ship (SO-26-0102 after $100 payment → "invoice $480 · 0 min · within Intuit sync lag", green) and Pickup (SO-26-0103 → "invoice $1,470 · ~2000 min · beyond sync lag — check", red).
- **Vendors** `/purchasing/vendors` (`pages/rs/VendorsPage.tsx`, `components/rs/VendorForm.tsx`; nav under Parts & Inventory): searchable list (parts linked · open POs · last order · avg turnaround · active pill), Add/Edit modal (contact, terms, account ref, min order, preferred method, lead time, shipping notes, notes, active), duplicate-name guard; detail `/purchasing/vendors/:id` = contact / terms / shipping / glance cards + Parts linked ranked by last price paid (avg all vendors, "cheaper elsewhere" flag) + open / past POs (link opens PO modal via `/purchasing?po=`) + purchase history. `saveVendor(VendorInput)`, `getVendorSummaries`, `getVendorDetail`; `Vendor.createdVia`. Purchasing page Vendors card → links + "Manage vendors →"; Vendor cards get a "detail" link. Seed **Swiss Supply Geneva** (`v-swiss`, created via the screen).
- **Pricing units fix**: history `unitPrice` = cents everywhere (receivePurchaseOrder now ×100); `partPricingSync` returns dollars → PriceCell / Generate PO / vendor hints on one scale (vendor card history was showing $8,600 for an $86 crystal).
- Known minor (pre-existing): Generate PO flashes the parent's generic "Updated" alongside the PO-number message.

### Estimate layout · Ship calc service level (2026-09-28; self-tested)
- New estimate: Component-code chips moved ABOVE the catalog picker in Lines; Billing & Shipping (`EstimateAddresses`, split out of `EstimateMeta`) sits under the client name on create (`estimate-addresses`) and as the first card on detail (`detail-addresses-card`, editable in edit mode).
- Shipping calculator: 2-day (base) / 1-day (+25) toggle (`ship-level-2_day|1_day`, `ship-breakdown`); >$25k insured (units > 25) forces 1-day and disables 2-day; added line labelled with the level. `calcShipping` returns `serviceLevel`, `forcedOvernight`.

### Schedule + booking rules · Arrival bulk/Scan 2 camera · Template managers · Price units · Cycle count (2026-09-28; tested iteration_52 — 10/10 exercised pass, A1/A2/S3/S4 self-verified)
- **Schedule** `/appointments` (sidebar Intake ▸ Schedule, all staff; `pages/SchedulePage.tsx`, `api/appointments.ts`): month calendar (closed days by weekday pattern + one-off closed dates), day slots (30 min, capacity n/n, FULL blocks booking), add/edit modal (Drop Off → est#, Pick Up → SO#/job# lookup via `lookupApptRef`; manual client when no ref), statuses booked → arrived → completed / no-show / cancelled, Close/Reopen day. Seeds: 4 today, next open day 10:00 + 14:30 at capacity, 1 closed date. Public booking page (upload.rolliworks.com/book) is EXTERNAL — `validateBooking` is the shared rule set it must call.
- **Today**: `AppointmentsTodayCard` on every `/today` — drop-off = time + est#, pick-up = time + SO# + client (MH ruling).
- **Booking rules** (Setup → `booking-rules-card`, `BookingRulesCard`): per-weekday open + hours, 30-min slots fixed, capacity/slot, min notice, max days ahead, enabled types, est#/SO# required, confirmation message; one source for both surfaces. Seed Mon–Fri 9–6, Sat 10–3, Sun closed, cap 2.
- **Intake Arrival**: Scan 1 = bulk session (`ArrivalSession`, `previewArrival`/`commitArrivals`: rows label_request / none (manual client) / duplicate → Commit logs + shelves + audits all at once). Scan 2 = one at a time → `openScan` → `/intake/receive/:id?camera=1` launches `InspectionCameraFlow` (IPEVO 2 shots + microscope) into the Photos card (`receive-ipevo-start` re-opens).
- **Email template manager** (Setup `setup-templates-card`): 14 templates incl. new `po_email` (vendor), `receiving_report` (internal), `appointment_confirmation`, `package_accepted`; audience + used-by (`TEMPLATE_META`), search, Retire/Reactivate (`setTemplateActive`), point-of-use edits untouched.
- **Job Template Manager** relocated to Bill Audit tab (`/shipping/bill-audit?tab=templates`; `api/jobTemplates.ts`, `components/setup/JobTemplateManager.tsx`): 20 seeds (19 active, 1 archived, 8 needs-review), search / category / dept / unreviewed / archived filters, expand = lines + migration review row (confirm or correct W/B/P/PM), create · edit · duplicate · archive, duplicate-name guard. Not on Setup.
- **Price units fixed at source**: purchase history in DOLLARS (seed `H`, CSV import, receive-against-PO), PO label cost formula in dollars, no /100 anywhere; 25-295-C1 $86/$79 avg $82.83; Generate PO (RSC) = $1,386; PO-26-0022 lines red vs avg, Send blocked until acknowledged.
- **Cycle count**: `varianceThreshold` + manager pin REMOVED; `postCycleCountV2` sets `CycleCount.gainLoss` and the page shows `cc-gain-loss` unconditionally.
- Known: in hybrid/LIVE mode the Arrival "arrived today" table reads packages from the live API (pre-existing routing) — mock mode shows the committed rows.

### Zero balance — no QBO sync (MH only) + Sales Order Fulfill menu (2026-09-28; self-tested in browser)
- `zeroBalanceNoSync(id, reason, notes)` (`client.ts`, owner-only via `isOwnerSync`): reason ∈ barter_client | barter_b2b | internal_work (required), notes required → pushes a `zero_balance` Payment for the balance, sets `SalesOrder.zeroBalance`, `qboStatus='excluded'`, clears qboInvoiceId; SO stamp + `accounting` audit row (who/when/SO/job/reason/notes). **Auto-routes**: shipping product on order → Ship Station, else Pickup Station. `fulfillSalesOrder` never queues an excluded order; `qboSyncInvoice` refuses it. Performance credit untouched (Completions report is component-completion based).
- Visible everywhere: SO badge `so-zero-balance-badge` + Payments card detail; MoneyStrip QBO "Excluded — no QBO sync"; Accounting → QBO queue `excluded_no_sync` state with reason/notes (`acct-qbo-exclusion-*`); MH Hitlist → "Zero balance — no QBO sync" log (`zero-balance-log`, `zeroBalanceLog()`).
- Seeds: SO-26-0108 (so-09, job E01887/Walter, barter client, $700) and SO-26-0109 (so-10, job E01903/MM, internal work, $1,250) — $0 balance, Paid, excluded.
- **Fulfill ▾ menu** on SO detail (`components/sales/FulfillMenu.tsx`, `so-fulfill-menu`, items `so-menu-*`): Fulfill (Save & Continue) · Save · Save and Close | Edit Performance Report (→ `/reports?key=completions`) | Sync from / Push Edits to QuickBooks (`qboSyncInvoice`, stub) | Send Shipping Info Request · Pickup Reminder Email/SMS · Payment Reminder Email/SMS (`sendSoReminder` → Outbox) | Push to Ship / Pickup Station (`setFulfillmentChannel`) | Create Appraisal / Warranty Estimate (→ `/estimates/new?client=&kind=&from=`, prefills client + internal note) | Zero balance — no QBO sync (MH only) | Print Sales Order · Delete (draft → `deleteSalesOrder`; otherwise Cancel modal).

### Shop Work Orders · Client-facing Create Label · Ref# insured-value suggestion (2026-09-28; self-tested in browser)
- **SWO** `/swo` (Parts & Inventory ▸ Shop Work Orders; `pages/rs/SwoPage.tsx`, logic in client.ts tail): 5-stage condensed board (In queue → Sent → Received/In progress → Inbound → Received) + independent **Paid** flag; outbound label from the SWO (international vendors → DHL Express + customs contents/value/HS/origin/incoterm, required), predicted completion date, **return label queued in advance + vendor email** (Outbox), Push vendor invoice to QBO (bill stub), Paid-vs-not table. **Custody**: components out with a vendor get holder `vendor:<id>` → Custody screen group "At vendor: …"; Hitlist asset total excludes them (verified $75,350 with E02027 etc. excluded); receiving back returns custody to the receiving user. Vendors reuse the Vendor module with `kind: parts | outsource` + `country` (VendorForm/VendorsPage filter). Seeds: 4 outsource vendors (Goldsmith US, Precision Refinish LA US, Genève Polissage CH, HK Dial & Case HK), SWO-26-0041…0046 across all stages, 0041 PAID while in progress (prepay), 0042 with return label + email queued + predicted date.
- **Client-facing Create Label** (`RcSendWatch` → shared `CreateLabelSheet mode="client"`): same form as staff; shipping cost (estimate `shippingAmount`) + declared value preloaded as editable suggestions (`label-cost-input`, `label-value-input`, `label-value-changed`); `portalStartLabel` → `portalCreateLabel` (tracking auto-tied to estimate/job, `sendIntent.kind='label_created'`); value-matching: `Estimate/Job.inboundDeclaredValue` set on every inbound label and prefills Ship Station declared value; audit `shipping` row + `getClientLabelLog()` card on Inbound Shipping (`client-label-log`); seeds sh-04 (accepted $7,900) and sh-06 (changed $4,800 → $6,400). **Feature switch** Setup → Feature switches (`feature-toggle-clientCreateLabel`, `getFeatureFlags/setFeatureFlag`): OFF → portal shows the old "Request shipping label" (staff creates), no gap.
- **Suggested insured value by ref#** (`suggestInsuredByRef`, `REF_HISTORY`): staff sheet + portal show "Suggested: $X (avg of N past shipments of ref R)"; refs 116500LN $28,500/6, 114060 $9,800/4, 124270 $7,900/3, 126610LN $12,400/5, 279174 $8,700/2; no history (e.g. 228238 Day-Date) → fallback to estimate total. Every bound label feeds the history.

### Receive Watch audit vs 9-step spec + label dialog (2026-09-28; self-tested E2E)
- Audit result: steps 1–8 (scan est#/SUB# resolve, customer, what-was-received recap, inspector pills + extra-watch, W/B/P/PM chips, serial+reference auto-decode, date received, estimate copy with per-line verify) were present. **Missing**: step 9 "Save & Print" only flipped a flag — no label dialog; Label Queue had per-card mock print only; decode didn't warn when the decoded model ≠ estimate watch.
- Built: `components/intake/LabelBits.tsx` (`LabelCard`, `Pdf417`, `Linear` extracted; new **`LabelPrintDialog`** — preview both labels, include checkboxes, printer select, copies, Print → `setLabelPrinted`, Done). Receive Watch **Save & Print → commit → dialog** (`label-print-dialog`), result screen shows printed count + **Reprint** (`inspection-result-print`); Save alone leaves labels queued with "Print now". Label Queue gets **Print all unprinted** (`labels-print-all`) using the same dialog. Serial decode shows `serial-decode-mismatch` badge when the decoded model differs from the estimate watch.
- Verified: pk-06 (E01053) scan → 4/4 pills → line verified → Save & Print → dialog 2 labels → copies 2 → "Sent to Zebra ZD421 — Front Desk 1 · 4 labels" → result "2 component labels printed · Received — awaiting approval".

### Receive Watch Pass 2 — camera engine, photo card, Intake History (2026-09-28; testing agent iteration_53: 14/14 pass)
- `hooks/useCamera.ts`: `useCamera(active, deviceId?)` + `devices` (enumerateDevices). `components/inspection/InspectionCameraFlow.tsx` rewritten: header camera selector (real labels; `MOCK_CAMERAS` "IPEVO V4K (mock)" / "HY-3307 (mock)" when no hardware), count<2 → IPEVO stage, then auto hand-off to microscope (no cap), live "N captured", Done gated until 2 shots, manual switch flagged.
- Receive Watch Card 7 · Inspection photos (`rw-photo-scan`, `rw-photo-use-fields`, `rw-photo-count`): `api.parseRefSerial` accepts `REF / SER`, `REF-SER`, `Ref … Serial …`, PDF417 payload; wrong watch blocked (`rw-photo-error`). Every shot → `api.addPackageInspectionPhoto` (pkg.photos slot `inspection-<source>-n`, cascades to job when estimate.jobId).
- Labels: watch label lines = `labelModel` (decode w/ estimate fallback) · Ref · Serial · `LastName · Est#`. `LabelPrintDialog` `presets` prop: `INTAKE_COPY_PRESETS` 7/14/13 + custom (Save & Print, Label Queue), `REPRINT_COPY_PRESETS` 1/2/3/5 + custom (History reprint).
- **Watch Intake History** `/intake/history` (`pages/intake/WatchIntakeHistoryPage.tsx`, tab `intake-tab-history`): search brand/model/ref/serial/est#/customer; Date · Customer · Watch · Estimate# · Status (+ Labeled badge when any label printed) · Edit (`IntakeEditDialog` → `api.updateIntakeRecord`, audit-stamped, labels follow the fix) · Labels reprint · Open.

### Staff Hitlist — per-person, inbox, flag-to, supervisor rollup (2026-09-28; testing agent iteration_54: 14/14 pass + self-verified landing/Pad flag)
- `api/hitlist.ts` (bridge `hitlistBridge` in client.ts): `slugOf/userBySlug`, `TEAM_MAP` (Joseph → band_tech+polisher; MM → watchmaker), `getInbox/markInboxRead/unreadCount` (seeded ib-01…09), `flagToHitlist` (inbox item + Pinned row w/ photo), `getTeamHitlist`, `reassign` (pin or task, audited), `getHomeScreen/setHomeScreen/homeRouteFor` (localStorage `rollisuite.home.<station>.<user>`).
- Roles: `polisher`, `band_tech` added; staff Dre (polisher), Sam (band_tech), Nico (both) under Joseph; seeded team tasks/pins (`t-team-*`, `pin-team-*`).
- Routes: `/today` & `/hitlist` → own slug (or team when home=team); `/hitlist/:slug` (`PersonHitlistPage` → `TodayPage forUser`), `/hitlist/:slug/team` (`TeamHitlistPage`: merged Pinned+Derived tagged per tech, filter chips, inline Reassign selects, drill-in), `/hitlist/owner` = old MH accountability page (nav "MH Accountability"). RW shell: `/rw/hitlist/...`, nav `rw-nav-hitlist` first.
- `TodayPage`: header "Hitlist · X", bookmark chip, person switcher (managers/concierge), Team view link for supervisors, home-screen badge, `InboxPanel` (unread dot, photo lightbox, job link, read/unread toggle).
- Flag to: `components/today/FlagTo.tsx` picker (people/roles) in Pad `CameraCapture` sheet ("Attach & flag") and Receive Watch photos card (`rw-flag-send`).
- Setup ▸ This station: `setup-home-screen` buttons default / hitlist / team (team only for supervisors); sign-in and PIN switch land via `homeRouteFor`.

### RolliConnect accounts + TOTP, login wall, per-doc gating, per-photo lock (2026-09-28; testing agent iteration_55: 23/24 → /rc/auth redirect fixed + self-verified)
- Magic links RETIRED (`portalDeepLink` now → `/rc?next=…`; `/rc/auth/:token` redirects to `/rc`). Client login = email on file + password + TOTP (fixed demo code `000000`, user decision) + 8 single-use backup codes. `client.ts` "RolliConnect accounts": `rcLookup/rcSignup/rcConfirmTotp/rcSignIn/rcVerifyTotp/rcGetAccount/rcRegenerateBackupCodes/rcListAccounts/rcResetAccount`; accounts persist in localStorage `rollisuite.rc.accounts` (seeded: Eleanor · `Rolli2026!` · TOTP on · backup codes, K7Q2-M9X4 used).
- Pages: `RcLoginPage` (creds → totp / totp_setup), `RcSignupPage` (`/rc/signup`: email+password → `TotpSetup` mock QR + secret + code → backup codes w/ copy/download + "saved" checkbox → signed in), `RcAccountPage` (`/rc/account`: TOTP status, codes remaining, regenerate). `rc/RcTotpBits.tsx` (MockQr, BackupCodes, TotpSetup).
- Login wall: `RcShell` → `LockWall` (`rc-lock-wall`, Sign in / Create account, preserves `?next`). Per-document gating `RC_DOC_META`/`rcDocAccess` (localStorage `rollisuite.rc.docAccess`): estimate/invoice/watch/messages always login (identity-bound); report default public, inspection_form default login — toggled in Setup ▸ RolliConnect access (`RcAccessCard`, also lists accounts + Reset).
- Per-photo lock: all staff photos PRIVATE by default (`isPhotoUnlocked`, localStorage `rollisuite.rc.photoUnlocked`, seeded ph-r1-1/ph-r1-2/ph-r3-1). Toggle on job Photos panel (`photo-lock-<id>`) and RW PhotoGrid (`rw-photo-lock-<id>`), job-stamped. `portalPhotoSections` filters by unlock + returns `privateCount` ("N more photos are private to the workshop").

### Bench-test capture + Target completion moved to Receive Watch (2026-09-28; testing agent iteration_56: 16/17 → timeline visibility fixed + self-verified)
- `api/benchTests.ts` (bridge `benchBridge`): `CALIBER_SPECS` (Rolex Cal. 31xx / 3235 / 2235), seeded `bt-01` (j-r1 before/after: hand-filled before sheet + Proofmaster PASS + Witschi 6-pos + avg/Δ) and `bt-02` (j-r3 tolerance sheet, header → 31xx 94%). `captureBenchTest(jobId, kind, photoUrl)` mocked extraction (1.1s), `overrideBenchCaliber` (re-judges measured vs new spec; "corrected by · sheet matched …"), `deleteBenchCapture`. Bench events → job notes + audit; `JobTimeline` now also renders `j.notes` (kind `note`).
- `components/jobs/BenchTestsPanel.tsx` on the job page (`job-bench-tests-card`): Photo / Use sample slip per kind, source photo kept + lightbox, structured panels, caliber match indicator + override select, grades chips, IN/OUT OF SPEC verdict. Sample photos `/public/bench/*.jpg` (generated).
- Target completion: set ONCE on Receive Watch Card 6 (`rw-target-week-2/4/6/8/12`, `rw-target-date`, `rw-target-summary`) → `pkg.targetWeeks/targetDate` + `estimate.targetWeeks/targetDate`. `newInspectionForm` prefills `targetTo/targetFrom/targetSource='receive'`; inspection form shows read-only `insp-target-readonly` (input removed); report view "Target <date> (N weeks)"; estimate detail `estimate-target`; RC estimate `rc-estimate-target`; Intake History badge + Edit dialog target fields (cascade to estimate + existing forms).
- Fixed pre-existing bug: `/inspection/new?est=…` redirect dropped the query string (estimate never prefilled) → `InspectionNewRedirect` preserves `search`.

### Guided authentication capture + Multi-item estimates/templates/Receive Watch picker (2026-09-28; testing agent iteration_57: all reachable assertions pass)
- `api/authCapture.ts`: `AUTH_STEPS` (11 steps w/ cam assignment; rehaut = microscope), sessions (seed `auth-01` on j-r1, rehaut Unsure), `startAuthSession`, `recordAuthShot` (attaches to job photos slot `auth-<step>`, stamps flags + completion). `components/inspection/GuidedAuthCapture.tsx`: overlay (label, IPEVO/Microscope badge, auto-switch + manual select, per-step Authentic/Unsure/Fake + note, step strip, Next/Finish) + `AuthCapturePanel` on the job page (`job-auth-card`). Open with MH (not built): cyclops magnification, crystal micro-etched crown.
- `api/items.ts`: `EstimateItem {id, flow W/B/H/O, label}`, positional numbering (`itemNumber`), `linesFor`, `removeItem`. `EstimateLine.itemId`, `Estimate.items`, `Package.itemsReceived`, `JobTemplateLine.item`, `JobTemplate.items`. `components/estimates/MultiItemBits.tsx` (`AddItemButton` flow menu, `MultiItemPanel` "Multi-item estimate — Progress: X of N", `FlowTag`).
- Estimate create: "Start from template" select (`create-template-select`) + "Add Additional Item" (`create-add-item`) distinct from add-line; panel only when >1 item; lines filtered per selected item. Job Template Manager (`/shipping/bill-audit` templates tab): `jt-add-item`, `jt-items-panel`, per-line `jt-line-item-<i>`; seeded `jt-multi` 2-item template. Receive Watch: card 3b `rw-items-card` picker only when estimate.items > 1; `api.setItemReceived` ("Mark in hand"), progress = items in hand. Seed: E01053 (pk-06) 2 items, item 1 in hand.
- OPEN QUESTIONS flagged to user (not assumed): renumbering after partial receive (ids are stable so custody follows the item, numbers re-flow); flow required up-front at "Add Additional Item" (currently required via the flow menu).

### Appraisal Creation tool (2026-09-28; testing agent iteration_58: all assertions pass except 2 nits — testid fixed; "fresh draft inherits the job's existing after-work photo" kept by design)
- `api/appraisals.ts` (bridge `appraisalBridge`): `createAppraisal(jobId)` pulls client/watch/decode caliber/inspection condition/auth flags summary/photos; `INVOICE_HISTORY` mock by ref → placeholder avg (`valueSource` placeholder/confirmed/none); `updateAppraisal`, `attachAfterPhoto` (job photo slot `after-work`), `finalizeAppraisal` (requires confirmed value; stamps `SIGNER` "Michael H" SVG, locks). Numbering APR-YYYY-NNNN sequential (seed APR-2026-0032 on j-08). `PURPOSES` Insurance/Fair Market/Estate/Resale; `DISCLAIMER` exact wording; `COMPANY` header line.
- `pages/jobs/AppraisalPage.tsx` (`/jobs/:jobId/appraisal/:id`): left rail editor (date, purpose, value w/ placeholder badge + Confirm, after-work photo capture/sample, all fields, authenticity statement) + `AppraisalDocument` (header, date/purpose/number, client row, flowing item description, authenticity line, field table beside Reference + After photos, boxed total w/ badge, signature block, disclaimer). "Download PDF" = window.print with print stylesheet. `components/jobs/AppraisalsPanel.tsx` on job page (`create-appraisal` enabled for ready_to_ship/closed).
- Reference PDF (Appraisal_Report_-_APR-2026-0032.pdf) was NOT in the received attachments — layout built from the written spec.

### B2B Client Reference # + email subject threading (2026-09-28; testing agent iteration_59: all A1–A5 pass + self-verified live outbox prefix)
- `Estimate.clientRef` + `Job.clientRef` (kept in sync — one reference per job/package; written to the estimate AND every linked job). `client.ts` "B2B client reference": `clientRefSubject(subject, ref)` → `[REF: <ref>] <subject>` (FORMAT PLACEHOLDER — open decision), `clientRefFor(relatedRef)` resolves estimate#/job#/SUB#/SO# tokens, `queueOutbox(email)` = single choke point for ALL 19 outbound-mail sites (replaced `store.outbox.unshift`), `setClientRef(estimateId)`, `setJobClientRef(jobId)`, `jobClientRef(j)`. Pre-seeded outbox emails are NOT retroactively prefixed (queue-time only).
- Receive Watch card 6 → `rw-client-ref-card` (`ClientRefInput` scanner-friendly: Enter blurs, never submits; `rw-client-ref`), live `SubjectPreview` (`rw-client-ref-preview[-text]`, `data-has-ref`). `receiveWatch` + `updateIntakeRecord` persist it. `components/intake/ClientRefBits.tsx`. Pills: `estimate-client-ref-pill` (read-only on legacy/historical), `job-client-ref-pill` (always shown, works for jobs without estimate) → inline editor `*-edit-input` / `*-save` / `*-cancel`. Send modal subject preview + `renderTemplateForEstimate` apply the prefix.
- Seed: e-04 / job E02013 (`/jobs/j-03`) = `B2B-88421`; everything else blank.
- OPEN (flagged, not assumed): exact subject format; per-item vs per-job scope (built per job/package).

### Band-only labels · scan-to-client · duplicate-name toast (2026-09-28; testing agent iteration_59: B1–B9 pass)
- Seed: clients c-32 & c-33 both "William Sanchez" (NYC (212) 555-0132 / Houston (713) 555-0133); band-only job E02060 (`j-ws1`, w-52 no ref/serial); watch job E02061 (`j-ws2`, 126710BLRO / M4R7K2P9).
- `isBandOnlyJob(j, w)` (workflow all-B and no ref+serial), `bandLabelPayload` = `E02060|BAND|E02060|NS|B` (same PDF417 format; job # instead of ref/serial). `queueLabelsFor` handles band-only (1 PDF417, no REF/SER label); `queueJobLabels(jobId)`; Job Detail `act-print-label` ("Print label · band only" / "Print labels") → `LabelPrintDialog`.
- `resolveScan(raw)` → `{client, job?, estimate?, watch?, via: job|estimate|ref_serial}` by ID only (job#, estimate#, PDF417 payload, REF-SERIAL). `ScanClientField` (`client-scan`, `client-scan-go`, `client-scan-error`) rendered FIRST in `ClientPicker` (Estimate create, Job create, new Sales Order); resolved badge `client-resolved-via`; Estimate create also preselects the scanned watch (`scanWatch` ref).
- Duplicate names: `sameNameClients`, `duplicateNamesIn` (EXACT full-name match, v1). `components/ui/Toast.tsx` (`toast.warn`, `ToastHost` in App; `toast-warn`, `toast-text`, `toast-dismiss`; 8s, non-blocking). Fires on name-search results, on picking a duplicate-name client (`client-dup-badge`, `client-hit-dup-<id>`), and in the global `IdentifierSearch`.
- OPEN (flagged, not assumed): hard-gate scan before invoice finalize vs encouraged default (built: encouraged, name fallback kept); near-match/nickname detection (built: exact only).

### Scan gate on invoicing — hard gate + manager override (2026-09-28; user decision; testing agent iteration_60 B1–B7 pass)
- `SalesOrder.clientResolution { via: scan|linked|name, detail, at, by, override? }` set in `buildSO` via `resolutionFor` (job/estimate-linked → linked; picker scan → scan; else name). `soScanGate(o)` locks `sendInvoice` for name-picked orders (stamped 'Invoice send BLOCKED'). `confirmSoClientByScan(id, raw)` — MISMATCH (label → other customer) stays locked + stamped; match → via scan. `overrideSoScanGate(id, reason)` requires `accessTier === 'manager'`, reason required, stamped + audited. Legacy/seeded orders w/o resolution are not gated.
- UI `components/sales/ScanGate.tsx`: `so-client-resolution` badge (data-via/data-locked), `so-scan-gate` card (`so-gate-scan`, `so-gate-scan-go`, manager-only `so-gate-override-reason`/`so-gate-override-go`, else `so-gate-ask-manager`); `act-send-invoice` disabled while locked. `/sales/new` picker passes resolution (scan vs name). Seed `/sales/so-ws` = SO-26-0090 (c-33 Houston Sanchez, name-picked, open, locked).
- Email subject format LOCKED as final: `[REF: <ref>] <subject>`.

### Multi-item: per-item Lines + inferred chips + per-item trickle-down chain (2026-09-28; user "go"; testing agent iteration_60 A1–A10 pass, A9 self-verified)
- `api/items.ts`: `EstimateItem { id, label, components?, componentsOverride? {by,at,from} }` — `flow`/`ITEM_FLOWS`/`FlowTag` REMOVED. `inferItemCodes` (this item's lines only), `itemCodes` (override or inferred), `unionItemCodes` (whole-job read model only). Templates `items: {label}[]`.
- `client.ts`: `getInspectionContext(packageId, itemId?)` item-scoped for multi (expected/suggested from item chips, `receivedForItem` from `pkg.itemContents[item]`, `ctx.item {id,number,count,label,inferred}`); `setItemScan(pkgId, itemId, {received?, verified?})` → `Package.itemContents` / `itemComponentsVerified` (per-item keys, stamped 'Item n of N · Scan 1/2'); `receiveWatch` w/ `input.itemId` writes per-item verified + `itemWorkflow`, package-level = union; `chainForItem`/`chainsFor`/`getVerificationChains`/`getJobVerificationChains`/`getItemVerificationChain` (VerificationChain gains `item`, `override`); `setEstimateItemComponents(estId, itemId, codes|null)` logged override / revert + `syncEstimateComponents` (e.components = union); `applyPatch` handles `items` and BLOCKS removal of custody-touched items; `createEstimate` stamps seeded overrides.
- UI: `components/estimates/ItemSection.tsx` = [Item N of M header (2+ only)] → chips (`item-N-chips-*`, `-source`, `-revert`) → this item's LineEditor; used stacked on Create (`create-items`, `create-add-item` plain button, `item-N-label/-remove`) and Detail (`detail-items`, `detail-add-item` in edit mode; single-item uses synthetic `SINGLE` item, chips → `setEstimateComponents`). Chain card = `ChainForEstimate` stacked (`estimate-chain-item-N-*`), chips moved above the tables. Receive Watch card 3b: `rw-item-scope`, `rw-item-scan1-*`, `rw-item-scan2-*`, `ChainForItem` (`item-chain-*`); cards 4/5 + discrepancies re-scope on item switch (ctx refetch → form prefill resets by design); `inspection-commit` disabled tooltip added (fork / identity / codes).
- Seed E01053: Item 1 'Oyster bracelet — band only' (B line → infers B), Item 2 'complete watch' (W+P lines, override W+P+PM by Vienna). pk-06: `itemContents[it1]=['bracelet']` (Scan 1 partial), no Scan 2; Item 2 nothing.
- OPEN (defaults built, flagged): PM chip does NOT auto-trigger vendor custody transfer (manual); item removal BLOCKED once custody-scanned.

### Watchmaker-room photo kiosk (2026-09-28; testing agent iteration_61: K1–K9 + R1 all pass)
- Route `/wm-kiosk` (nav 'WM Photo Kiosk'); `pages/kiosk/WmKioskPage.tsx`: scan (job # / ref-serial / PDF417 via `resolveScan`, needs `r.job`), job card (`wmk-watchmaker` = job.assignees[0] — kiosk has NO login), `wmk-required` (data-required/data-done), `GuidedKiosk` 4 steps (`KIOSK_STEPS` in client.ts: dial-front µ, dial-back µ, movement-back µ, case-back IPEVO — PROPOSED camera assignment), `AdHocKiosk` (shutter → note → @-mention chips `wmk-tag-<shortName>`, MH preselected, Vienna labelled '(VC)' — no 'VC' staff record exists, MAPPED TO VIENNA, flagged).
- Camera plumbing extracted to `hooks/useStepCamera.ts` (auto per step + manual override + placeholder frames) and reused by `GuidedAuthCapture` — not rebuilt.
- client.ts kiosk block: `kioskRequiredSetting` (localStorage `rollisuite.kiosk.required`, default ON), `setKioskRequired` (audited), `kioskStatusFor` (required = toggle ON && W-routed: job.workflow W or any estimate item's own chips include W), `startKioskSession/recordKioskShot` (attaches job photos slot `wmroom-<step>`, completes at 4/4, jobStamps attributed to the watchmaker), `addKioskPhoto`. Derived hitlist row `kiosk-<jobId>` 'WM room photos required · E0xxxx' in `getTodayMock` for the assignee (clears when session complete; flows to supervisor team view automatically). Seed: j-04 E02014 complete session `wmk-seed-1`.
- Photos-with-notes mechanism = EXISTING `flagToHitlist` (Inbox + Pinned hitlist) — extended with `from` override (attribution to the job's watchmaker) and looped per tag. NEW `replyToInbox(inboxId, text)` → reply lands in the ORIGINAL SENDER's inbox + pinned ('Reply from MH · E0xxxx — …'), `replyToId`; `InboxPanel` gained Reply (`inbox-reply-<id>`, `-input-`, `-send-`, `inbox-reply-tag-`). Seeds ib-10 (Leo → MH photo, j-16) / ib-11 (MH → Leo reply).
- `components/setup/KioskSettingCard.tsx` (`setup-kiosk-required`, `setup-kiosk-state`), `components/rw/KioskRequirementBanner.tsx` on RwJobPage (`rw-kiosk-requirement`).
- OPEN (flagged, defaults built): camera per step (proposed µ×3 + IPEVO); @VC identity (mapped to Vienna); hard gate vs soft tracking on completion (built: soft — task row + banner, no status block); every W item vs dial-separated only (built: every W item — MM currently sees ~8 outstanding rows, noisy); accepted scan formats (both, same as Receive Watch).

### Global search — in-house customer highlight + est# (2026-09-29; self-tested via Playwright, both scenarios + toast)
- `SearchHit.inHouse?: { estimateNumbers }` set in `resolveIdentifier` client hits when the customer has any job with `simpleStatus === 'on_hand'` (est# = linked estimate number, else the job's E0xxxx number); client hits sorted in-house first. `SearchHitList`: amber left-border row (`data-in-house=true`), 'IN-HOUSE' badge + `search-hit-est-<clientId>-<num>` chips. Display/sort only — click still explicit; duplicate-name toast unchanged.
- Seeds: William Sanchez ×2 BOTH in-house (E02060 / E02061); Daniel Okafor ×2 (c-34 Chicago none, c-35 Miami in-house E02062 — floats above c-34).


### Review 4fc901d — Batch 1 (2026-09-29; self-tested via Playwright on mock + LIVE API)
1. `realClient.ts` hold mapper: priorStatus/station/releaseNote mapped (+ `WireHold` fields). Live SEED48-48 renders "Parts hold" with no crash.
2. Live jobs: `getJobThreads` returns [] for non-mock jobs; `jobSummaryContext(jobId, live?)` builds from the live `JobWithRefs` (JobSummaryDraft passes `job`). Live b5ec23e5… shows no "Fixture row not found"; Generate summary drafts.
3. RolliConnect signup = email → one-time verification link (Outbox mock, `rollisuite.rc.invites`, `/rc/signup?verify=<token>`) → password → TOTP. `rcRequestSignup`, `rcVerifyInvite`, `rcSignup(email, password, token)` (token single-use); `rcResetAccount` issues a fresh invite. Login page had no Provisional badge (already clean). Page steps: `data-step` email | check-email | verifying | password | totp.
4. Appraisals: `SIGNERS` per entity (rolliworks→MH `sig-mh`, rollishop→Walter `sig-walter`), `signersFor(entity, actingShortName)` authorized only when acting user IS the signer; `finalizeAppraisal(id, signerId)` records signedBy/signedByShortName/signatureId/signatureUrl; UI `apr-signer-select` (+ Provisional badge), `apr-finalize` disabled "Not authorized to sign for Rolliworks" for MM. Placeholder value = avg insured value of outbound shipments per reference (`appraisalBridge.insuredComps`: SO shipments + outbound `shp.rows`), comparables show ref + date; seeds sh-10/sh-11 (ref 124300).
- PENDING (user answered, not built): Q5 Sales vs Completions, Q6 per-component credit, Q7 concierge permissions-as-data, item 8 a–k, batches 3–4.

### Role-based landing + route guarding (2026-09-29; self-tested all four roles)
- `src/config/roles.ts`: roleKind = watchmaker (room role, concierge tier) | supervisor (room role, manager tier) | concierge | manager. Homes: `/rw/bench`, `/rw/pad`, `/`, `/`. `homeRouteFor` (hitlist.ts) + SignInPage use it. Guards in App.tsx: `RequireAuth` (desktop) redirects watchmakers → `/rw/bench`; `RwRoleGuard` on `/rw` redirects concierge → `/`; `pad` variant redirects non-supervisors → their home. Toast "Not available for your role (…)". Seeds: MM demoted to watchmaker; JV added as WM-room supervisor (TEAM_MAP MM→JV; ROOM_TECHS + JV).
- Known: RW hitlist asset $ totals visible to watchmakers at `/rw/hitlist/<name>` (flagged, not changed).

### Seed corrections + money scoping + reception mode (2026-09-29; user corrections; self-tested via paced Playwright — testing_agent timed out on Cloudflare/429 pacing, no report file)
- **JV = Workshop Supervisor (band/polish)**: merged the former `u-joseph` seed into `u-jv` (roles manager+polisher+band_tech; dutyLabel "Workshop Supervisor (band/polish)"); all seed refs (`'Joseph'` → `'JV'`: safe owner, POLISHERS, ROOM_TECHS.band, goals, inbox, tasks, StationMap owners) re-pointed. `TEAM_MAP` = JV → band_tech+polisher only; **watchmaker room has no supervisor** (slot empty — `/hitlist/mm/team` shows "doesn't supervise a team"). JV removed from `ROOM_TECHS.wm`; `auditScopeFor` → band scope for JV / "Workshop Supervisor".
- **Vienna = Operations Manager** (roles [manager], manager tier, lands `/`); personal template signature updated; Chyna stays concierge.
- **No $ for watchmakers under /rw**: `RwShell` MoneyContext = `roleKind(user) !== 'watchmaker'`; new `useFmtMoney()` (returns '—' when hidden) wired through all pad components (`PadDashboard`, `PadQuickAdd`, `PadReview`, `PadParts`, `PadBits.Price`). Verified MM sees zero `$` on bench/hitlist/parts/jobs/band/history/queue; JV + managers keep totals.
- **Reception mode (station flag)**: `Station.receptionMode` — seeded ON for st-01 Front Desk 1 & st-02 Front Desk 2 (localStorage backfill for saved stations). `?reception=1|0` query override persists in sessionStorage for the browser session. `isReceptionMode()` drops `inHouse` (badge + est numbers) from client search hits; TopBar shows `header-reception-badge` (data-source=station|query).
- Redeploy: user must click **Deploy** in Emergent (agent cannot push to rollisuite-emergent.emergent.host).

### Owner "View as" (D-385) + MAM seed + WM 1–8 stations (2026-09-29; self-tested via paced Playwright: desktop picker, pad Choose-a-view, banner, guard bounce, dual attribution in audit)
- Identity split in `client.ts`: `realUserSync()` (device sign-in) vs `viewAsSync()` (sessionStorage `rollisuite.prototype.viewAsUserId`, owner only) → `currentUserSync() = viewAs ?? real`; every guard/scope/landing evaluates the viewed user. `actor().by = "MH (as MM)"` + `onBehalfOf`; `appendAudit` auto-stamps actor=MH, on-behalf-of=viewed; audit types `view_as_started`/`view_as_ended`; `AuditEvent.onBehalfOf` (chip in Audit log). `isOwnerSync()` false while viewing.
- API: `getViewAs`, `startViewAs(userId)`, `stopViewAs`. AuthContext exposes `realUser`, `viewingAs`, `startViewAs`, `stopViewAs`.
- UI: `components/layout/ViewAs.tsx` (`ViewAsPicker` in TopBar + RW header, `ViewAsBanner` fixed on every screen, `useViewAs`), `pages/ChooseViewPage.tsx` at `/choose-view` (pad tiles + kiosks + My own view). `SignInPage`: owner on a pad → `/choose-view`. `config/device.ts`: `isPadDevice(station)` = station.deviceType → `?device=ipad|desktop` override → touch+≤1366 (prototype only, D-384).
- Seeds: `u-mam` Matthew Monteverde "MAM" band tech part-time (matthew123 / 1234) → in JV's team; stations `st-wm1…8` "WM 1–8" (deviceType pad), `st-jv-pad`, `st-kiosk-fd`, `st-kiosk-wm`; `Station.deviceType`.
### KEEPER-HANDOFF docs refresh (2026-09-29; documentation-only)
- New `11-INTEGRATIONS.md`, `12-ROLES-AND-ACCESS.md`, `13-INTEGRATION-GAPS.md`; rewrote `01-ROUTE-MAP.md` (landing/guard/scope + ⚠ UNGUARDED); appended `03` (Q92–Q100), `04`, `06`, `10`, `00-INDEX`; `docs/DECISIONS.md` 2026-09-29 block → `02`; `_gen.py` now emits `source` + `auth expected` columns and `[post-refresh]` tags (`_baseline_refresh.txt`, 461 exports at 2ae5e1a) and audit families 40–50. Mirrored to `frontend/docs`. User must **Save to GitHub**.
- Pending spec items: 5 (Sales vs Completions), 6 (direct tech credit), 7 (concierge scope: `/rw/assign` guard, cycle count for concierge), 8–25.

### Fix batch UNGUARDED/DRIFT + MM supervisor correction (2026-09-29; self-tested via paced Playwright + in-page module calls)
- `roles.ts`: `RoleKind` adds `band_tech` (→ `/rw/band`); supervisor = role `supervisor` or manager+room role; `canSupervise`, `teamFamily`, `FAMILY_TONE`. MM seed → roles [supervisor], concierge tier (no $), lands `/rw/pad`; seed jobs/rw components MM→Leo; `Role` adds 'supervisor'.
- Guards: `/rw/assign|queue|station` pad-guarded; `/rw/band` pad guard admitting band_tech; `canViewHitlist` on `/hitlist/:slug`; RW nav for non-manager supervisors = `SUPERVISOR_NAV`; MoneyContext = accessTier manager.
- `hitlist.ts`: TEAM_MAP MM (W + B·P read-only via `readOnlyRoles`), `isTech`, `supervisorOf`, `teamRowReadOnly`, `canViewHitlist`; TeamHitlistPage legend + family chips + read-only rows.
- Division wall `inMyDivision.*` on estimates/SOs/packages (mock path; detail throws). Reception idle sign-out `useReceptionIdleSignOut` (5 min). Nav `cycle-count` ALL tiers.
- QBO stub: `getInvoiceLink`, `updateInvoice(id, patch, syncToken)`, `simulatePaymentWebhook`, `qboReadBalance`, `getShipCart`; `SalesOrder.qboSyncToken/qboLastSyncedAt`. Verified edit-after-send path.
- Docs updated: 01, 03 (Q92/94/98/99 resolved, Q101–102), 11 (§2 QBO, §9 labels), 12, `_gen.py` (token auth), DECISIONS.md block → 02, regenerated 05/08/09. Remaining drift listed in 12 §8. User must Save to GitHub.

### REBUILD-SPEC items 5–7 (2026-09-29; MH pasted spec text; testing agent iteration_62 5/9 pass + 4 env-inconclusive, all re-verified by paced self-test)
- **5 Paging + one-shot messages** (D-389): `intercom.ts` zones Everyone · WM Room · Front / Floor (`PAGE_ZONES`, `zoneOfStation`, `pageTargetsMe`) — banner only on targeted stations (`PageOverlay` + standalone `PageBanner` on fullscreen pads/benches). `hitlist.ts`: `Assignee` gains `station`; `sendMessage` (person / #role claimable / station; text or **dictation** via browser Web Speech; optional photo + job), `claimMessage` (role queue → first claimer owns it, pin follows), `markMessageDone` (pin dismissed), `getSent` + `messageStatus` delivered → seen → done. UI: `MessageComposer.tsx`, `MessagesPopover.tsx` (top bar RS + RW header, New / Sent, unread badge, outside-click close), Pad tab **Page** (`PadComms.tsx`: zones, presets, tap-to-call, composer, Sent), `InboxPanel` Done / Reopen / Claim + status chips + station chip. Seed ib-12 (JV → station Front Desk 1). Job notes w/ @mentions untouched (record); message = nudge.
- **6 One photo pipeline** (D-390): `addJobPhoto` / `addJobPhotoSync` + `PHOTO_TYPES` (intake · bench · post_work · inspection), locked by default; routed: pad camera, WM kiosk guided/ad-hoc, inspection dual-camera, auth capture, appraisal after-work, desktop attach (type select). `PhotosPanel`: type chips w/ counts, per-photo type chip, lock / unlock / re-lock, client-visible count.
- **7 Access control panel** (D-391): `/setup/access` owner-only (`AccessControlPage.tsx`): users × `SCREENS`, cell toggle (right-click = reset to role), amber-ring override diff + "n from role" + row reset, hover header → description box, group filter, change log. `canAccess` = override ?? role default (`accessOverrideSync`, localStorage `rollisuite.access.overrides`; log `rollisuite.access.log`; `settings` audit). Enforced by TierGate + sidebar on next route load — verified Chyna sees /jobs when allowed, Restricted when reset.
- **8 Concierge module** — spec text pending from MH (standalone sidebar button, one board, lane per vendor, lane shape by "do we ship to them?", counts per stage → cards → job screen). NOT started.
- **Q5 AMENDED (MH 2026-09-29, final): Sales dated by FIRST INVOICE SEND (`saleDateOf`); edits adjust the original month; payment date = A/R / gate / cash only; zero-total never in Sales, still in Completions.** Dashboard KPI "Sales this month · invoices sent, MTD"; Reports → pnl = department sales by invoice-sent date (pro-rata lines). Seeds w/o a send → orderDate STAND-IN; live wire lacks invoice_sent_at.
- Docs: DECISIONS.md block, REBUILD-SPEC §12e, KEEPER-HANDOFF regenerated (`_gen.py`, 734 exports) + synced to frontend/docs. User must **Save to GitHub**.

### Batch groups 1–4 (2026-09-29; self-tested via paced Playwright, all pass; groups 5–8 QUEUED)
- **G1 Q5 amended**: Sales by first invoice send (`saleDateOf`), KPI + Reports relabelled, DECISIONS block.
- **G2 MH = Owner / Super Admin** (seed, labels, 12-ROLES); `inspector` = task role → manager tier (`holdsRole`); **AccessTier `supervisor`** (MM); View-as never asks credentials; **mandatory `/choose-view` entry screen** after every MH sign-in (Continue as MH logged `session_continued_as_self`; grouped tiles; exit returns there). Front-desk initials VC/CM shown on tiles; shortNames NOT renamed (MH to confirm).
- **G3 iPad role tab bar** (`components/rw/RoleTabBar.tsx`, D-393) on all `/rw/*`; `/rw/messages` page; pad internal tabs lifted 64 px; View-as banner above the bar; bench PIN-in syncs shell identity. Verified every tab ↔ screen for Leo, Dre, JV, MH-as-MM at 1180×820; `/choose-view` + kiosks have no bar.
- **G4 Concierge** (`pages/rs/ConciergePage.tsx`, D-394) replaces the SWO front: 4 seeded vendors, lane shape by `ships`, 7/4 stages, counts + aging → cards → job (+ back link), advance / back-with-reason, Paid/QBO hidden on the CM lane, vendor quick-add, "Send to vendor" on job detail. Seeds: CM 12 jobs (4/4/2/2), Claudio 3 (one Paid while In progress), Jacques 3 (one intl Returning), James 2. Counts = cards verified on every stage. NOT wired: supervisor-pad outsource-hold entry.
- **QUEUED (next)**: G5 Hitlist layout + 20-row seeds + raw digits everywhere (D-382: display digits only, accept both on input) + "MH · Owner" header; G6 Access control New-user-from-template + Enable/Disable + Active/Disabled filter; G7 Theme tokens (black/grey/neon baby blue); G8 iPad-first PWA pass.

### Concierge v2 (2026-09-29; MH full paste; paced Playwright self-tests pass — counts = cards on every stage, N·M late split adds up)
- D-395 in DECISIONS. `api/concierge.ts` (health, chips, alerts, invoices + duplicate guard, redo, outstanding, escalation, vendor parts requests), `components/concierge/VendorInvoices.tsx`, `components/jobs/ComponentWaitChips.tsx`, `pages/rs/ConciergePage.tsx` v2. Chips verified on MM pad, JV pad, Leo bench, job detail, jobs board, hitlist, click map.
- Still queued: G5 Hitlist layout, G6 Access control template/disable + Limits, G7 Theme tokens, G8 iPad PWA; supervisor-pad outsource-hold → Concierge.

### Concierge v3 — TRACK | ACTION + slide-out + 320 seed (2026-09-29; D-396; visually verified 2026-09-30)
- `ConciergePage` view toggle remembered per user; `components/concierge/ActionMap.tsx` (lookup / scan several → tap destination → one custody commit), `SlidePanel.tsx` (right third / full sheet, Esc), `SwoCard.tsx`; manual QBO push removed. `seedSwoVolume` = 10 synthetic SWOs per stage per lane (`Swo.synth`, parent `j-01`); synthetic rows are excluded from component-wait chips and the one-lane-at-a-time guard.

### G5–G8 + pad Send-to-vendor (2026-09-30; testing agent iteration_63 → 2 findings fixed + self-verified via `/app/memory/tools/dbg_vendor.py`, `smoke_hitlist.py`, `smoke_g6g8.py`)
- **G5 Hitlist (D-397, D-382)**: `TodayPage` header "Hitlist · MH · Owner" (`roleTitle`); `hitlist-top-row` Appointments | Pinned (stack < lg); `InboxChip` + `InboxDrawer` slide-out (`components/today/InboxDrawer.tsx`); `DerivedGroups.tsx` Overdue → Urgent → Due today → Upcoming → No date with "N waiting on a component"; `ComponentWaitChips compact` = worst 3 + `+N more`; `estDigits` raw digits; seeds t-mh-01…10 + pin-mh-01…06 (MH = 25 rows).
- **G6 Access control (D-398…401)**: `User.reportsTo / limits / disabled / createdFrom`; org tree helpers (`managerOf`, `directReports`, `chainOf`, `subtreeOf`, `inSubtree`, `getOrgTree`); tree walks in `hitlist.ts` (`getTeam`, `supervisorOf`, `isSupervisor`, `teamLabel`), `/choose-view` groups, Concierge escalation L2 = point person's manager. `AccessLimitsDrawer.tsx` (reports-to, locked stations `RW_STATION_OPTIONS`, `PART_CATEGORIES`, pricing, `CONTAINERS` read-only, enable/disable with reason) + `NewUserFromTemplate.tsx`; page filter `access-status-*`, row `access-limits-<id>`; enforcement `stationLockedForMe` (bulkCommit + DestinationMap `data-limited`), `pricing: none` hides money in RW; `assertEnabled` blocks all sign-ins; `getDivisionStaff` hides disabled users. Seed JV limits + reportsTo tree.
- **G7 (D-402)**: `--accent #5CE1FF` (Tailwind `accent`), `--warn`; selection/active/focus highlights re-pointed from amber to accent across RW shell, pads, maps, choose-view, action map. Yellow = warn only.
- **G8 (D-403…408)**: `/rw-manifest.webmanifest` + `rw-icon.svg` injected by `RwShell`, `viewport-fit=cover`, safe-area insets, 44 pt CSS rule, `inputMode`; `api/offline.ts` scan queue + replay (station scanner, reconcile; banners `rw-offline-banner`/`rw-replay-banner`); `api/webauthn.ts` Touch ID enrol/assert + `signInWithTouchId` (audit method `touch_id`; PROTOTYPE — no server verification); `/rw/device` Device check (standalone, rear camera, Touch ID, Web Push note, offline queue, Guided Access note); long-press brand → `OwnerPinGate` → `/choose-view` (+ bench gear owner path via `isOwnerPin`); `ContainerReconcile.tsx` on the band pad (BIN-JV, night prompt 17:00, missing → pins).
- **Pad Send to vendor**: `pad-send-vendor-<job>` (disabled when `jobOnVendorLane`) → same `SwoForm` (point person default Chyna, save needs work + components) → In queue on the lane; verified Claudio 10 → 11.
- Not tree-derived (by design): paging zones (rooms, not people). Not built: Walter's tree position beyond MH (RolliShop has no manager layer).

### Concierge ACTION MAP — interactive (2026-09-30; D-409; verified via `/app/memory/tools/smoke_actionmap.py` desktop + `pad` arg)
- `ActionMap.tsx`: lookup bar on top (+ wedge scanner hook `useWedge`), job strip with removable chips + health chips, legal-set intersection, pulsing current node, dimmed non-legal nodes, tappable counts (`anode-count-*` → SlidePanel; `panel-pick-*` loads into the strip), bottom bar (`action-bottom`, `action-commit` refuses without scans / reason), commit → outbound label + return label + vendor email for the box, arrival scan for Received, status moves otherwise. `SlidePanel` gained `onPick` + `pad` (full-width). Pad page `pages/rw/RwConciergePage.tsx` at `/rw/concierge` ("Vendors" tab for supervisors) with `CameraLookup.tsx` (BarcodeDetector, NOT-KEEPER).

### Concierge TRACK | ASSIGN split (2026-09-30; D-410; verified via `/app/memory/tools/smoke_actionmap.py` desktop + `pad`)
- `ActionMap.tsx` now exports `TrackMap` (progress: tappable counts `tnode-count-*`, aging/late/redo chips, `tlane-name-*` → outstanding) and `ActionMap` (Assign/Move contract; counts display-only; `active` prop gates the wedge listener). Toggle renamed ACTION → ASSIGN (`VIEWS`, `readView` in `ConciergePage.tsx`, reused by `RwConciergePage.tsx`). SlidePanel "Assign · load … into the lookup strip" only on Track cards → switches to ASSIGN with the job loaded; ASSIGN stays mounted hidden so the strip survives view flips. Old light lane table retired.

### Job Detail v2 — process flow rebuild (2026-09-30; D-411; testing agent iteration_64 — all 11 flows pass)
- `/jobs/:id` rebuilt: **Item header** (`components/jobs/ItemHeader.tsx`: model · ref · serial · client + rating · status/hold/priority chips · photo strip + lightbox · "Request SUB-" → submission · Est → estimate · SO) replaces the Watch card; **Process flow** (`ProcessFlow.tsx` + `jobFlowSync`/`getJobFlow` in client.ts): one line per component (H/B/C, item labels 1/3…), Intake → In queue → In progress → QC → Finished, filled dot = status position, red ring = blocker (awaiting approval on Intake, holds / PR awaiting client on current dot), vendor legs replace In progress with lane stages (dashed), late vendor = red / due ≤2d = amber, custody label from the custody record with amber **status / custody mismatch** badge, `N / M components finished`; **Add-ons since estimate** (`AddOnsPanel.tsx`, `getJobAddons`/`addJobAddon`: derived = client-approved parts requests + estimate-revision lines after first send; manual rows flagged + audited); **Original estimate** + **Inspection report** collapsed (`CollapsedCard.tsx`); **Outsource / concierge** info-only (`OutsourceInfo.tsx`, `getJobVendorLegs`; Send-to-vendor button removed); **More** (Photos · Parts requests · Messages · Bench tests · Timing · Service evidence · Shop time · Appraisals · Auth photos, collapsed, counts on the first two). Removed: Components completion card, verification-chain card, Line items card. Right column unchanged.
- Seeds: j-30 E02031 (3 lines, blocker, Claudio leg at Received, PR-0056 + manual add-on ao-01), **j-mi1 E02063** (multi-item 1/3 · 2/3 · 3/3, head finished), **j-os1 E02064** (head at James 6d late), clients c-36/c-37, watches w-55/w-56. `JobComponent.itemLabel`, `partSeeds[].item`. Live-API jobs render one derived line (no component data on the wire).
- Tools: `/app/memory/tools/smoke_jobdetail.py`, `smoke_jobdetail_live.py`.

### Concierge ASSIGN — destination-first (2026-09-30; D-412; self-tested via /app/memory/tools/seed_destfirst.py)
- `ActionMap.tsx` rewritten: arm a node first (bottom bar "Destination: … — scan labels"), scan any number of labels → chips with per-chip verdict (`data-verdict` legal | refused | pending; refused = red + reason, excluded from commit), COMMIT moves all legal chips in one event (custody nodes: scans are the custody scans, lookup chips need a scan; Back/Redo: one reason for the batch), refused chips + armed destination persist after commit and across a TRACK flip, Clear strip, Esc disarms. Lookup-first still lights common legal nodes (`DestinationMap softLegal` prop — lights without disabling).
- Pending user decision: Vonage screen-pop + call log spec (5 questions asked via ask_human: blue dot default, phone-approval pending vs immediate, rating c = lifetime items, pop tiers, /calls page + role queue). Build starts when MH answers.
