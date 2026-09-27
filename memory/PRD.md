# RolliSuite — Product Requirements Document

**Last updated**: 2026-09-27  
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
