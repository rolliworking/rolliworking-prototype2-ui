# RolliSuite — Product Requirements Document

**Last updated**: 2026-09-26  
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
