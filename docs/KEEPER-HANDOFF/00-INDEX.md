# 00 — INDEX · KEEPER HANDOFF PACKAGE

**Purpose of the prototype (read this first).** RolliSuite-prototype is an *instrument*, not a codebase to inherit. It exists to make behaviour concrete enough that MH could rule on it screen by screen: every status, button, guard, email, label and audit row you see in the prototype is **specification**; the way it is implemented (React SPA, one in-memory mock module, fixtures, `localStorage`, scripted "assistants", simulated NFC taps) is **not**. KEEPER is the production system: a real backend, real persistence, real identity, real integrations, the same behaviours. When this package and the prototype code disagree, the **code is the truth** and the disagreement is flagged here as `⚠ DRIFT`. When the code and a ruling disagree, the ruling wins and the code is listed as a known gap.

**Who this is for.** A builder (or build pipeline) who has never seen the prototype or the conversations. Plain language; every term is defined the first time it is used; nothing is "as discussed".

## How to read the set (in this order)
1. **This index** → 2. **`01-ROUTE-MAP.md`** (what exists, who reaches it) → 3. **`modules/*.md`** for the module you are building (the **[v2]** specs supersede older sections where they say so) → 4. **`02-DECISIONS-CONSOLIDATED.md`** (rulings, chronological, tagged by module) → 5. **`03-OPEN-QUESTIONS.md`** (MH's verdict sheet: everything still amber) → 6. **`04-DATA-MODEL-VS-KEEPER.md`** (every entity, prototype shape → KEEPER shape) → 7. **`05-API-CONTRACT.md`** (every data function; the backend surface) → 8. **`06-SEAMS.md`**, **`07-COMMS-AND-TEMPLATES.md`**, **`08-AUDIT-TAXONOMY.md`** → 9. **`09-TEST-INVENTORY.md`** (regression checklist) → 10. **`10-NOT-KEEPER.md`** (explicit do-not-inherit list) → 11. **`11`–`15`** (integrations census, roles, gaps, portal inventory, UI conventions) → 12. **`specs/`** (BUILT-with-gap-check and PLANNED feature specs).

## Files
| file | contains |
|---|---|
| `00-INDEX.md` | this page; vocabulary |
| `01-ROUTE-MAP.md` | every route: purpose, **landing for**, **guard**, **data scope**; ⚠ UNGUARDED list for the lockdown build (refreshed 2026-09-29) |
| `modules/auth-stations.md` | device/station registration, staff sign-in (password + photo, PIN fast-switch), sessions, divisions, tiers |
| `modules/dashboard-today.md` | dashboard stats, `/today` derived hit list, pins, tasks, `@mention` quick-add, staff hit-list viewer |
| `modules/intake.md` | arrival → receive package → work order → receive watch (discrepancies), drop-off, outbox, label queue |
| `modules/estimates.md` | estimate lifecycle, lines, revisions, send/approve/decline, conversion |
| `modules/jobs.md` | job pipeline, kinds, holds, owner/assignees, inspection, photos, notes, shop time, evidence, inspection report to client, timing card, **components** — page layout superseded by `job-detail-v2-wbp.md` **[v2]** |
| `modules/sales.md` | sales orders (invoices), payments, pickup station (codes/proxy), ship station (labels/insurance), custody close — pickup flow superseded by `specs/SPEC-PICKUP-STATION.md` **[v2]** |
| `modules/workshop.md` | bench, supervisor board, nine-lane floor map, parts requests + scripted assistant, parts knowledge |
| `modules/client-360.md` | universal search, client record, service requests (incl. kiosk match), custody trail |
| `modules/rolliconnect.md` | `/rc` client portal: home, estimates, invoices, watches, messages, inspection report page, request close — sign-in + tiers superseded by `14-CLIENT-PORTAL-INVENTORY.md`; dots / Ask in `job-detail-v2-wbp.md` §4; request builder in `request-builder.md` **[v2]** |
| `modules/comms-hub.md` | `/inbox` thread model, reply tokens, composer + templates, auto-threading — views / assignment / Staff section superseded by `inbox-v2.md` **[v2]** |
| `modules/companion-panel.md` | docked scripted assistant: price memory, client brief, ask-the-shop, photo labels |
| `modules/purchasing-inventory.md` | vendors, purchase orders, receiving, stock levels/locations/movements, cycle counts |
| `modules/labels-reports-accounting.md` | label queue + printers, reports (incl. tech completions), accounting/QBO stub |
| `modules/setup-integrations-help.md` | users, catalog, templates, locations, printers, audit log, integrations tiles, help |
| `modules/rolliworking.md` | `/rw` standalone workshop app: shell, access boundary, hide-money, QC lane, evidence station, two-lane floor |
| `modules/rw-shop-floor.md` **[post-E16]** | two-lane shop floor map, part dots (coloured by part), drag semantics, auto-reunification, finish gate, work queue |
| `modules/rw-bulk-assign.md` **[post-E16]** | scan-driven Bulk Assign (custody + assign + start, band-only labels, courtesy email + 30-min undo), station scanner, Watchmaker Room bench mode |
| `modules/rw-supervisor-pad.md` **[post-E16]** | iPad Supervisor Pad: Jobs / Parts / Review, stage fwd/back with reasons, reassignment, three-tier parts query, M3KE learned suggestions, manager gate, camera capture, parts history |
| `modules/rw-bench-pad.md` **[post-E16]** | kiosked Bench Pad per watchmaker bench: PIN board, sections, stuck/late derivations, goal history + pace line, kiosk contract (idle re-lock, offline banner, per-device settings) |
| `modules/rw-picking.md` **[post-E16]** | approve → pick → allocate: pick tasks, locations, stock decrement, short handling, found-elsewhere location update |
| `modules/job-messages.md` **[post-E16]** | threaded internal messages on every job, `@mention` routing by tier (hit-list pins vs bench Messages), unread/read model, notify-on-reply |
| `modules/client-requests.md` **[post-E16]** | job-attached client instructions: badges, scan modal + acknowledgment log, QC checklist gate |
| `modules/shipping-inbound.md` **[post-E16]** | inbound shipping stages, aging rules, KPI strip, tracking panel + Track button fallback, the Parcel Pro adapter (4 functions, exact signatures) |
| `modules/rollitime.md` | `/rt` timing bench: queue, Witschi-style test, tolerances, pass/reject |
| `modules/rgtime.md` | `/rg` phone time-clock PWA: NFC tag URLs, punches, manager week grid |
| `modules/kiosk-requests.md` | `/kiosk` public walk-in check-in and the staff `/requests` queue |
| `02-DECISIONS-CONSOLIDATED.md` | every MH ruling as recorded, chronological, tagged by module |
| `03-OPEN-QUESTIONS.md` | verdict sheet: question · where it shows · what the prototype does · what each answer changes |
| `04-DATA-MODEL-VS-KEEPER.md` | full entity model; every prototype shortcut marked against the production requirement, with migration note |
| `05-API-CONTRACT.md` | every `client.ts` export: signature, side effects, callers (generated by `_gen.py`) |
| `06-SEAMS.md` | integration seams and what the real implementation needs |
| `07-COMMS-AND-TEMPLATES.md` | portal-first principle, all templates, reply-token routing, auto-thread events |
| `08-AUDIT-TAXONOMY.md` | every audit type, fields, emitters (generated) |
| `09-TEST-INVENTORY.md` | every testing iteration restated as a checklist (generated) |
| `10-NOT-KEEPER.md` | do-not-inherit list with replacements |
| `11-INTEGRATIONS.md` **[2026-09-29]** | integrations census — one section per seam: file, exports + exact signatures, request/response TS shapes, mock behaviour, TODO markers, swap point, callers |
| `12-ROLES-AND-ACCESS.md` **[2026-09-29]** | role model as implemented: `roleKind`, guards, manager/MH-only checks, concierge restrictions, reception mode, sessions, View-as (D-385), seed identities + stations, ⚠ DRIFT list |
| `13-INTEGRATION-GAPS.md` **[2026-09-29]** | one line per seam: what the real implementation needs that the prototype does not know (Cursor reads this first) |
| `14-CLIENT-PORTAL-INVENTORY.md` **[2026-10-01]** | client portal BUILT vs PLACEHOLDER against the three-tier ruling (PUBLIC · LINK · SIGNED-IN); expiry defaults; build order |
| `15-UI-CONVENTIONS.md` **[v2 2026-10-02]** | every UI rule as one line with the D-number or spec file that owns it (colour / dots / numbers / Inbox / panels / pads / messaging / money) |
| `specs/SPEC-PICKUP-STATION.md` **[v2]** | Pickup Station five gated steps — **BUILT** + gap check (✓ / ⚠ GAP) against MH's gate list; the ⚠ GAP rows are MH's next paste |
| `specs/SPEC-LONG-TERM-STORAGE.md` **[v2]** | Long-term storage — **PLANNED**; one-paragraph summary + the pieces it will add; full text arrives with the build |
| `specs/SPEC-BONUS-TARGETS.md` **[2026-10-02]** | Bonus targets — **BUILT**: view seam (`v_bonus_*`, invoice vs completed date), bases incl. Joseph = Band Room − Matthew, working-day pacing (Setup value), automatic EOM close + early close, Mark paid, CSV, staff card, NOT-KEEPER "As of" |
| `specs/SPEC-SAFES-INSURANCE.md` **[2026-10-02]** | Safes vs insurance — **BUILT** (owning ruling D-425 → D-488…D-494): containers as data with limits + policy refs, node → parent, value on hand per safe (appraisal → declared → ref typical → unvalued; head = watch − bracelet; bench = no safe; unopened packages in FD), Analytics card + drawer + Move…, standing MH/VC pins + station toast |
| `modules/inbox-v2.md` **[v2]** | one general Inbox: flat list, Portal · Team · Calls · Views, tags-not-assignment, job-card slide-out + quick actions, reply channel, context chip, share with staff, Requests ≠ Inbox |
| `modules/request-builder.md` **[v2]** | Request Builder (client · trade · staff), quote key, rate card, outcomes Auto-quoted / Estimate queued / Draft, rw.com landing |
| `modules/calls-telephony.md` **[v2]** | Vonage MOCK: live-call state machine, screen-pop card, dispositions → pending add-on, call ledger, `/calls`, SMS seam |
| `modules/concierge-swo.md` **[v2]** | Concierge vendor lanes, TRACK \| ASSIGN, destination-first commit, SWO hubs (containers) + lines, vendor custody, health / escalation |
| `modules/job-detail-v2-wbp.md` **[v2]** | Job Detail v2 process flow + add-ons, W·B·P dots on every client surface, jobs-list column, component-scoped holds, portal dots + Ask reply loop |
| `modules/jv-bin-containers.md` **[v2]** | JV bin — a container that holds custody: assign / enter / hand-to / take-back / night count / morning out; the pattern LTS reuses |
| `modules/inspection-labels.md` **[v2]** | opinion labels (revisions, blind second opinion), guided shots (controlled vs ad-hoc), variant sets + candidates, tags vocabulary, specimen gate, WatchM8 export |
| `modules/rwcom-emulator.md` **[v2]** | `/rwcom` + public `/www`: identify · check · request flows, URL = state, claim codes, `watchm8.ts` engine seam, instrumentation (NOT KEEPER) |
| `source/` | verbatim copies of the working docs the package consolidates (STATE-MACHINES, DATA-MODEL, API-SURFACE, SEED-DATA, DESIGN-PRINCIPLES, SESSION-LOG, DECISIONS) — cited by section number from the module specs |
| `_gen.py` | regenerates 02/05/08/09 from the code; run after any prototype change. `_baseline_e16.txt` = the 296 exports at E16 (**[post-E16]**); `_baseline_refresh.txt` = the 461 exports at the 2026-09-29 refresh (**[post-refresh]**); `_baseline_refresh2.txt` = the 723 exports before the v2 pass (**[v2]** = added 2026-09-30 → 2026-10-02). 05 carries `source` (real \| mock) and `auth expected` (incl. `owner`) per export |

## Refresh v2 — 2026-10-02 (documentation-only pass after the 2026-09-30 → 2026-10-02 build queue)
Covers: G5 Hitlist layout · G6 Access control (org tree, limits, enable/disable, templates) · G7 accent tokens · G8 iPad PWA pass (offline queue, Touch ID, device check) · Concierge TRACK | ASSIGN + SWO hubs · Job Detail v2 · W·B·P dots (staff + portal) · Messaging bubble + directory · Inspection opinion labels + WatchM8 feed · Auto-PO + MH daily items · **Outbox → Sent** · JV bin · Portal dots + Ask reply loop · Vonage screen-pop + `/calls` · Inbox job-card slide-out → one general Inbox (tags) → **Inbox v2 flat + Views + context chip** · **Pickup Station five gated steps (BUILT)** · Client portal three tiers (passwordless, LINK tier) · rw.com emulator · Request Builder + rate card. New files: `15`, `specs/*`, 8 module specs above. Rewritten / appended: `01` (routes **[v2]**, UNGUARDED re-check), `04` (v2 entity table), `06` (seam index), `07` (reply channel, new emails, Sent), `10` (v2 scaffolding), `11` (§4 Sent, §6 read-serials, §10 QR decode, §11 Touch ID, §12 offline/polling, §13 telephony v2 + SMS, §15 Supabase Auth, §16 WatchM8 engine), `12` (Inbox comms gate, Views, G6, approvals rule, drift), `13` (gaps 16–22), `14` (request builder rows), `03` (Q103–Q112), `_gen.py` (families 51–62, `[v2]` tag, `email → Sent`, 02 module tags); `02/05/08/09` regenerated. **Pickup Station**: documented as built, then checked line by line against MH's gate list — ⚠ GAP rows in `specs/SPEC-PICKUP-STATION.md` are the next paste. **LTS**: PLANNED stub only.
Vocabulary addendum: **Tag** = a pointer on a thread ("look at this"), never ownership · **Lane** (Inbox) = Quoted / Answered sections · **Views** = owner opens a staff inbox as they see it · **Dots** = W · B · P row (staff) / client-word dots (portal) · **Hub** = the SWO container (box) that travels to a vendor; **line** = one job's components inside it · **Bin** = a container that holds custody (JV bin; LTS safe reuses it) · **Gate** = a Pickup Station step whose fact is re-validated at release · **Second-person rule** = exceptions need a different manager's PIN + reason · **LINK tier** = one object, one purpose, signed expiring token, no sign-in · **Step-up** = fresh re-verification bound to one action · **Quote key** = `<ref|BAND>-<legs> · material · type · construction` shared by request line, rate row and estimate line · **Sent** = the record of what left RS (was Outbox).

## Refresh 2026-09-29 (documentation-only session, after the build queue: role landings · corrections batch · View-as · reception stub)
Added `11-INTEGRATIONS.md`, `12-ROLES-AND-ACCESS.md`, `13-INTEGRATION-GAPS.md`; rewrote `01-ROUTE-MAP.md` with landing/guard/scope + ⚠ UNGUARDED; appended post-refresh entities to `04`, seam index to `06`, event families 40–50 to `08`, Q92–Q100 to `03`, the 2026-09-29 rulings block to `02` (via `docs/DECISIONS.md`), iterations 59–61 to `09`, scaffolding to `10`. Every ⚠ DRIFT is listed in `12 §8` and inline. Vocabulary addendum: **owner** = MH (`OWNER_USER_ID`), **View-as** = owner impersonation of a view with dual attribution (actor / on-behalf-of), **station** now carries `deviceType` (desktop · pad · kiosk) and `receptionMode`; **WM 1–8 are stations (bench iPads), not people**.

## Post-E16 refresh (2026-09-26, documentation session)
Covers everything built after the package was created: E18 RW deep build part 1 (shop floor, bulk assign, station scanner, WM room, work queue), Supervisor Pad v1/v2 (+ history, camera), client request notes, Inbox Staff section, inbound shipping + Parcel Pro adapter + Track a package, Bench Pad + kiosk contract + goal history, Job Messages. **Not built** (queued, not amber): Job Story (VB3-13), Job Lookup (VB3-12), View as client (VB3-14), client-facing photo organisation (VB3-15), E18 part 2. New vocabulary: **Part** (a component with a floor position), **Lane** (head / band / shared), **Custody** (the tech holding a part), **Pad** (Supervisor Pad), **Bench Pad** (kiosked iPad per bench; device = station, PIN = person), **M3KE event** (a manager's resolution/selection recorded as training data), **Client request** (job-attached instruction), **Hit-list pin from a mention**.

## Vocabulary (used everywhere)
- **RS / RolliSuite** — the staff ERP at `/` (front desk + management). **RW / RolliWorking** — the bench app at `/rw`. **RC / RolliConnect** — client portal at `/rc`. **RT / RolliTime** — timing bench at `/rt`. **RG / RGTime** — phone time-clock at `/rg`. **Kiosk** — public walk-in screen at `/kiosk`. Together: the six **route-spaces**; each is an **access boundary** in KEEPER (own authentication, no cross-reach).
- **Division** — `rolliworks` (service center) or `rollishop` (boutique). A **station** (registered device) carries a division; the signed-in session inherits it; visibility is walled by division, not by tier.
- **Tier** — `manager` or `concierge` access tier (what you may see/do). **Role** — job title(s): manager, inspector, watchmaker, concierge (who gets which derived work). Staff: MH (manager+inspector, both divisions), Walter (manager+inspector, rollishop), Vienna (concierge, rolliworks), MM (manager+watchmaker, rolliworks).
- **Job** — a service ticket for one watch. **Estimate** — the quote before the job. **Sales order (SO)** — the invoice after. **Service request** — the "ask" before an estimate exists (call/email/web/walk-in/kiosk). **Package (SUB#)** — an intake parcel. **Hold** — a parking overlay on a job (parts or outsource), not a status. **Component** — head / band / case work unit inside a job (MH ruling 2026-09-26).
- **Sent** — where every client email lands as a pending row (nothing is sent). **Portal-first** — emails only notify; content renders in `/rc` behind a link.
- **Amber / provisional** — a behaviour built as the simplest plausible version because MH has not ruled; listed in `03-OPEN-QUESTIONS.md`. **Locked** — ruled; build exactly.
- **Audit** — one append-only row per write (`08-AUDIT-TAXONOMY.md`). **Stamp** — `{at, by, station}` on a record.

## Ground rules KEEPER inherits (behavioural, not technical)
1. Screens never touch storage directly; every read/write goes through one typed surface (`05-API-CONTRACT.md`). 2. Status changes only through transition functions with guards and reasons (`source/STATE-MACHINES.md`). 3. Every write is audited. 4. Division wall on every read and write (the prototype only walls reads — `⚠ DRIFT`, see `04`). 5. Money is hidden from bench tiers (amber default). 6. Client-facing content is portal-first.
