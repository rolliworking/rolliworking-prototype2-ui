# 02 — DECISIONS CONSOLIDATED (every MH ruling, as recorded)

Source: `/app/docs/DECISIONS.md`, reproduced **as recorded** (rows were written at ruling time; the original chat text is not in the repo). Order is chronological by session; each block is tagged with the modules it touches. Status column: **locked** = build it exactly; **provisional (amber)** = MH has not ruled — see `03-OPEN-QUESTIONS.md`.

# DECISIONS — dated log

Format: date · decision · one-line rationale · status (locked / provisional).

| date | decision | rationale | status |
|---|---|---|---|
| 2026-06 E1 | Standalone Vite/React prototype at `/app/frontend`, zero backend; legacy Fastify/Prisma monorepo untracked | Evaluate UI/flow with fake data; repoint one module later | locked |
| 2026-06 E1 | Single data module `src/api/client.ts`; fixtures in `src/api/fixtures/` | Screens stay ignorant of transport; one-file swap to real API | locked |
| 2026-06 E1 | Visibility by access tier only (`manager`/`concierge`); duty label is display | Simplest gate that matches the two real audiences | locked |
| 2026-06 E1-R2 | Badge sign-in replaced by staff card + password + webcam photo; PIN fast-switch after first daily sign-in | Accountability photo per shift; fast switching at shared stations | locked |
| 2026-06 E1-R2 | Station is device-bound (localStorage), named by a manager | Every audit row needs a "where" | locked |
| 2026-06 E2 | Intake as four visible stages on one page with counts | Shop floor reads left → right; no hidden wizard | locked |
| 2026-06 E2 | Workflow (W/B/P/PM) set at Receive Watch is the routing authority | Pack correction; inspection is where the truth is known | locked |
| 2026-06 E2 | Discrepancy = hold on the package with reasons, not a rejection | Keeps the record; concierge follows up | locked |
| 2026-06 E3 | Estimate numbers `E` + 5 digits; `converted` shown as "Closed"; tax computed but "not applied" | Pack fields/enums win over the brief | locked |
| 2026-06 E3 | Staff-recorded `approved` status added and flagged provisional | Needed to gate "Create job"; not a legacy transition | provisional |
| 2026-06 E3 | Revisions snapshot prior version, never overwrite | Client has seen it; history must survive | locked |
| 2026-06 E4 | Job statuses = pack DB enum, linear machine, buttons only | Brief demanded legal-actions-only; pack gave the enum | locked |
| 2026-06 E4 | Holds are an overlay (`holds[]`) not a status; own board lane | Pack enum has no hold state; "park and return to prior status" falls out for free | locked |
| 2026-06 E4 | Client emails on request_approval / qc_pass / qc_fail | Pack silent on notify points → simplest set, flagged | provisional |
| 2026-06 E4 | Job number `E` + digits from own sequence starting E02011 | Pack says `E`+digits from next-job-id; unknown if shared with estimates | provisional |
| 2026-06 E4 | Shop Time writes time rows only, never status; on_hand jobs only | Pack: the only live legacy job route; keep its contract | locked |
| 2026-06 E4 | Invoice / sales-order targets are throwing stubs, audited | No silent dead buttons | locked |
| 2026-06 E4+ | **job_kind is orthogonal** to workflow and status (`service \| small_job \| warranty`) | Kind drives routing/config; workflow drives departments; status drives pipeline — three axes, no cross-products | locked |
| 2026-06 E4+ | **owner ≠ assignees**: `owner: Role` (accountable shepherd), `assignees: string[]` (working techs) | One accountable party per job, many hands on it; owner is role-based so coverage survives staffing changes | locked |
| 2026-06 E4+ | **Naming rule: "PM" is the precious-metals DeptCode only**; accountability is always "owner" | Avoid the project-manager collision in schema, UI, docs | locked |
| 2026-06 E4+ | Per-kind config is a lookup table `JOB_KIND_CONFIG {label, defaultOwnerRole, skipStages}`; small_job/warranty auto-route owner to `concierge` | User instruction; adding a kind = adding a row | locked (skipStages values provisional) |
| 2026-06 E4+ | `small_job` skips `awaiting_customer_approval` | Demonstrates the skip mechanism; exact per-kind skip set not confirmed | provisional |
| 2026-06 E4+ | Roles are `concierge \| manager \| inspector \| watchmaker` on `User.roles[]`; resolved at read time | Same mechanism for owner routing and role-assigned tasks | locked |
| 2026-06 E4+ | `/today` is **derived** (owner actions + bench + holds/discrepancies I own + tasks to me/my roles); no manual curation; manual hit-list fixture removed | 80% of the list is already in state; curation drifts | locked |
| 2026-06 E4+ | Tasks are the explicit 20%: title, assignee (user or role), creator, optional job/watch/client link, due, status; linked tasks show on the job timeline card; creator gets "waiting-on" for free | Cross-assignment visibility without a PM module | locked |
| 2026-06 E4+ | Out of scope for tasks: subtasks, kanban, comments, priority schemes | It's a hit list, not project management | locked |
| 2026-06 E4+ | Discrepancy packages route to concierge role holders + the inspector who flagged them | Mirrors owner routing; someone must chase the client | provisional |
| 2026-06 MH ruling | **Inspection by kind**: `small_job` and `warranty` get NO inspection report (multiple-choice form step); inspection PHOTOS stay mandatory for every kind. `JOB_KIND_CONFIG.inspectionReport` (service only) + `inspectionPhotos: true`; `reviewGaps()` gates leaving `in_review` | Report is overhead the small/warranty flow doesn't need; photos are the evidence every job needs | locked (MH) — overrides prior provisional |
| 2026-06 MH ruling | `small_job` customer-approval skip **stays provisional** (amber tag kept) | MH did not rule on it | provisional |
| 2026-06 MH ruling | **Manual hit list returns alongside the derived view**: "Add to hit list" (from a job, a task, or freeform, assignable to any person or role, `#vienna order paper` syntax) → "Pinned" section at top of that person's `/today`, dismissible. Derived + pinned = the daily list; **nothing derived may be hidden by pinning** | Derivation covers the 80%; people still need to hand someone a one-liner | locked (MH) — overrides "no manual layer" |
| 2026-06 E5 | **Sales order is the invoicing vehicle** (pack): "invoice" = SO fulfilled with a stub QBO id; no separate invoice entity | Pack wins over the brief's "Invoice" noun; one entity, one number sequence | locked |
| 2026-06 E5 | QBO push is a HARD-STOP stub: `qboStatus: queued` + fake `QBO-STUB-nnnnn`, nothing external | Prototype rule; visible state so staff see the handoff happened | locked |
| 2026-06 E5 | Payments are a stub ledger on the SO; **partial payments allowed**; `isPaid` / `balanceDue` derived | Pack exposes balance_due; no processor in scope | provisional (partials) |
| 2026-06 E5 | Pickup is **signature-free** (locked decision) — pack's signature step dropped; identity = pickup code on the record OR proxy name + government-ID photo; hand-back photos required | Brief's locked decision overrides the pack's optional signature capture | locked |
| 2026-06 E5 | Custody closes at hand-back (pickup complete / ship confirm), not at fulfil: job → closed, watch → released | Watch is physically in the shop until it leaves | provisional (pack says "release where applicable" at fulfil) |
| 2026-06 E5 | Unpaid gates: **ship blocked** unless bypass reason logged; pickup allowed with logged bypass (pack: "ship gated; pickup more open") | Pack rule; both bypasses audited | locked |
| 2026-06 E5 | Shipping = one mock seam `shippingProvider.createShipment` (label + tracking + coverage); declared value 0<n<1000 read as thousands; IFS Infosure click path is dead | Carrier open commercially; a provider replaces one object | locked |
| 2026-06 E5 | Brief's tail lanes (awaiting invoice → awaiting payment → ready for pickup / ready to ship → closed) are **derived** (`tailStage`) from job + SO, shown as a pill on job cards, not stored | Pack's SO machine is the truth; the brief's names are a read model | locked |
| 2026-06 E6 | Bench / Supervisor / Floor are **lenses** over the same job store — no new status, no new writes except assignment, pull-next and parts | Role-based routing (principle 6); one truth, three views | locked |
| 2026-06 E6 | Pull-next = oldest approved, on-hand, unassigned job (priority first); a job a supervisor assigned to someone else is never pullable | Supervisor assignment is authoritative | locked |
| 2026-06 E6 | Parts assistant is **scripted** (ref / caliber / alias / keyword scoring over the seeded catalog) — no AI, flagged amber | Brief: canned responses; the value is the labeling loop, not the model | locked |
| 2026-06 E6 | Approval = labeling: confirms part↔reference (`compatibleRefs`), records the requester's search terms as `aliases`, both logged to Parts Knowledge; rejections logged too; approval places a parts hold when the job can take one | Makes the learning loop visible and auditable | locked (auto-hold provisional) |
| 2026-06 E6 | Floor map lanes: intake · review · approval · bench · **case cleaning** (in-service, P/PM-only workflow) · holds · QC · ready · out | Brief asked for a case-cleaning lane; derivation from workflow is provisional | provisional (cleaning rule) |
| 2026-06 E6 | Uploaded Contract v1 HTTP client saved at `docs/reference/contract-v1-client.ts` as the future repoint target for `client.ts` | Same operation names where possible (`convertEstimateToSalesOrder`, `fulfillSalesOrder`, `confirmShipment`…) | noted |
| 2026-06 E7 | **Client 360 is a read model** — `getClient360(id)` bundles watches (grouped, each with its own history), requests, estimates (+revisions), jobs, invoices/payments, notes, tasks, custody, emails; **no new writes** | One screen to answer the phone; everything already exists in the store | locked |
| 2026-06 E7 | `ServiceRequest` added as a minimal entity: source `call \| email \| web \| walk_in`, status `new → quoted → closed`, optional watch + estimate link | Brief asks for "open requests with status"; nothing modelled the ask-before-estimate | locked (user choice 1a) |
| 2026-06 E7 | **Custody events are derived**, not stored: package arrived / watch received (package or on-hand) / discrepancy / hold placed (outsource = left the building) / hold released / shipped / picked up | Every event already has a stamp on its record; a second ledger would drift | locked (user choice 2a) |
| 2026-06 E7 | Universal search `resolveIdentifier(q)` accepts name / email / phone / company / estimate # / job # / SUB# / tracking (package or shipment) / watch ref or serial / SO # / pickup code / request #; hits are grouped; **every hit with a client resolves to `/clients/:id?hit=<key>`** and the row flashes; hits without a client (unknown-client packages) open the record itself | Brief: "resolving to a client page" | locked (user choice 4a) |
| 2026-06 E7 | Rich seed = Naomi Castellanos (c-10): 3 watches, estimates 2023 → today incl. a rev-2, 4 jobs, 2 invoices, requests, tasks, 6 emails, custody trail | Already had intake same-watch seeding | locked (user choice 3a) |
| 2026-06 E7 | Top-bar search replaced by the same resolver (client-only search retired); sidebar "Clients" (all tiers) → `/clients` directory + search | Concierge answers the phone | locked |
| 2026-06 E8 | **RolliConnect is a separate route-space `/rc`** with its own shell (`RcShell`), own session key `rollisuite.rc.session`, own look (cream / serif / one accent), loud DRAFT banner; no staff nav or links; unknown `/rc/*` → portal 404, never the ERP | Brief: customer-grade, isolated | locked |
| 2026-06 E8 | Magic-link sign-in is a **stub**: `portalRequestMagicLink(email)` queues an Outbox email and shows the link on screen; `portalRedeemMagicLink(token)` opens the session. Single-use/expiry NOT enforced (StrictMode double-effect) | Nothing sends; the demo must be clickable | provisional |
| 2026-06 E8 | Portal writes call the **same store functions staff use** (`approveEstimate(id,'portal')`, `declineEstimate(..,'portal')`, `recordPayment`, `setShippingAddress`, `transitionJob('approve')`), stamped as the client via `asClient()` (actor = "Name (client)" / station "RolliConnect"), audit type `portal` | "Approval shows up in RS instantly" | locked |
| 2026-06 E8 | Approving an estimate in the portal also moves its linked job `awaiting_customer_approval → approved` | Otherwise the watch still reads "waiting for your approval" | locked |
| 2026-06 E8 | **Portal event replay**: client-initiated writes (+ staff replies) are appended to `rollisuite.rc.events` and replayed against the in-memory store on load (`replayRcEvents`, audit muted while replaying); Setup has "Reset RolliConnect data" | Store is in-memory; a staff tab / reload must still see portal actions | locked (prototype mechanism) |
| 2026-06 E8 | Status is **words, never a percent**: `PORTAL_STATUS` lookup (14 keys) derived from job status + holds + SO + open estimate (`portalStatusFor`, job-first) | Brief | locked |
| 2026-06 E8 | Payment stub = **full balance only**, method card, note "Paid online via RolliConnect (stub)" | User did not want a partial-amount choice; simplest stub | locked |
| 2026-06 E8 | Pickup window = date + slot (morning 9–12 / afternoon 1–5) + optional note → `SalesOrder.pickupWindow` + concierge task; shown on SO detail and Pickup Station | User choice 4a | locked |
| 2026-06 E8 | Messages: one thread per client (`Message` entity, optional watch ref). Client posts → staff `/inbox` (all tiers); staff reply → message + Outbox email, nothing sends | Brief | locked |
| 2026-06 E8 | Seeds: Eleanor Vance (E01042 sent + j-11 awaiting approval, now linked), Harrison Whitfield (E02011 on the bench), Grace Nakamura (SO-26-0103 fulfilled/pickup, now **partially paid** $1,000 of $1,470). `e-12 E01052` changed sent → **draft** so Grace's watch reads "Ready for pickup" | User choice 1a; coherent canonical states | locked |
| 2026-06 E8 (4) | **Client-side request close**: a client may close their OWN request only while `new` (not yet quoted) with a reason picker `duplicate \| no_longer_needed \| mistake`; "duplicate" requires pointing at another of their requests. Result: `status = closed_by_client`, `closedBy/closeReason/duplicateOfId/closedNote`, audited (`portal`), replayed. Quoted-or-later shows "Message us about this request" (pre-filled `Re RQ-…`); closing there is **staff-only** (`closeRequest`, any open status, reason + note). Closed requests fold under a toggle in the portal and dim on Client 360. **Never deleted** | User instruction (4) | locked |

| 2026-09-24 E9 (MH) | **Division dimension** `rolliworks \| rollishop` added. Stations carry `division`; sessions inherit it. Seed: Front Desk 1–5, Inspection Bench, Watchmaker Room, Shipping → `rolliworks`; new station **RS Counter** → `rollishop`. Staff: michael = `both` (inherits whichever station his device is registered at); vienna + mm = `rolliworks`; walter = `rollishop`. Walter seeded with 2 rollishop tasks + 2 rollishop pins. | MH ruling; wall is the division, not the tier — no cross-division visibility even for managers | locked |
| 2026-09-24 E9 (MH) | **Hit lists are division-scoped**: `getToday()` filters tasks, pinned items, and job rows by the session's station division. Pins + tasks stamped with `division` at creation. `getDivisionStaff(div)` and `getDivisionRoles(div)` power all scoped pickers. `AssigneeSelect` (pins + tasks) only shows same-division people/roles. Staff hit-list viewer: managers + concierge tier can open a full-screen modal listing same-division staff with prev/next; shows their full today (pinned + derived, read-only). | MH ruling; visibility cap = division | locked |
| 2026-09-24 E9 (MH) | **@mention syntax** accepted everywhere `#` is parsed — `@name`, `@role`, `#name`, `#role` are equivalent. `MENTION` regex replaces `HASHTAG`. | MH ruling; backward-compatible | locked |
| 2026-09-24 E9 (MH) | **Global quick-add** (`＋` button in top bar, `Alt+T` shortcut): one-line overlay from any screen. `@name`/`@role` routes to that person/role's today; unprefixed text pins to self. Autocomplete dropdown shows same-division staff + roles only. Context-aware: if opened while on `/jobs/:id`, `/clients/:id`, or `/estimates/:id`, that record is attached as a tappable link on the pin. Toast confirms pinned destination. Implemented as `QuickAddProvider` wrapping `AppShell`; `useQuickAdd()` hook opens it from anywhere. | MH ruling | locked |

**Modules touched:** cross-cutting

## Documentation pass (for KEEPER) — decisions restated / confirmed today

| date | decision | rationale | status |
|---|---|---|---|
| Docs pass | **Prototype is an instrument, not the product.** KEEPER (Supabase/Postgres) implements the same `client.ts` surface; all state rules move to the DB (constraints, triggers, RLS, transition functions). The UI's legal-actions rendering is a preview of those rules. | One contract, two implementations; fixtures become KEEPER's test cases | locked |
| Docs pass | **`job_kind` is a lookup table**, seeded `service`, `warranty`, `small_job`; `rehab` and `internal` planned rows. Columns: `label, default_owner_role, skip_stages[], inspection_report, inspection_photos` (+ billing semantics, see next). Prototype holds it as `JOB_KIND_CONFIG` record — same rows. | Adding a kind = adding a row, not a deploy | locked |
| Docs pass | **`job_kind ⊥ workflow`**: kind (service / warranty / small_job …) and workflow departments (W / B / P / PM) are orthogonal axes; status is a third. No cross-product tables. | Kind drives routing & billing, workflow drives who works, status drives pipeline | locked |
| Docs pass | **Per-kind config carries billing semantics, stage skips and `default_owner_role`**; `small_job` and `warranty` default owner → `concierge`; `service` owner is set manually. Billing semantics (e.g. warranty = no charge, small_job = counter sale) are **not yet in code** — KEEPER adds the column. | Same lookup row answers "who shepherds it", "which stages", "how it bills" | locked (billing column pending) |
| Docs pass | **Owner is separate from assignees.** `owner` = one accountable *role* (resolved to holders); `assignees` = many working users. Ownership is called **"owner"**; **"PM" is reserved for the precious-metal workflow code** and never means project manager. | Coverage survives staffing changes; no vocabulary collision | locked |
| Docs pass | **`/today` hit lists are derived** (owner actions, bench work, holds, discrepancies, tasks to me/my roles) **plus a `tasks` table with user-or-role assignment** and a pinned manual layer on top. Division-scoped. | 80% computed, 20% explicit; nothing curated by hand | locked |
| Docs pass | **Parts alias table**: KEEPER normalizes the prototype's `Part.aliases[]` into `part_alias(term, part_id, scope, source_request_id)` fed by a **search-miss → resolution** loop: a query that finds nothing is recorded as a miss; when a supervisor approves a request the requester's terms resolve to a `part_id`, scoped (by reference / caliber / global). Prototype today: aliases are flat strings on `Part`, learned only on approval, plus `PartsKnowledgeEntry` log; **no search_misses record exists** — drift to close in KEEPER. | Make the labeling loop first-class and queryable | locked (schema) / ◐ (prototype) |
| Docs pass | **Where code and an earlier doc disagree, code is truth**; drift is noted in each doc's "Drift" section rather than silently fixed. Known: counts (25 jobs, 11 packages, 24 estimates, 21 watches, 15 tasks, 6 pins, 8 SOs); stations are Front Desk 1–2 · Inspection Bench · Watchmaker Room · Shipping · RS Counter (E9 row above says "Front Desk 1–5" — wrong); `invoiceJob` is real (E5), not a stub. | Honesty for the rebuild | noted |

**Modules touched:** all

## E9 (remaining RS modules + evidence) — 2026-09-25

| date | decision | rationale | status |
|---|---|---|---|
| E9 | **Purchasing**: `Vendor`, `PurchaseOrder` (`draft → sent → partially_received → received`, any open → `cancelled` with reason). Send = Outbox stub. **Receive-against-PO increments stock at the PO's location via an audited `StockMovement(kind: receipt)`**; PO carries `division` + `locationId`. | Brief; receiving is the only path that creates stock from outside | locked (send stub) |
| E9 | **Inventory**: stock lives in `StockLevel(partId, locationId, onHand, reorderPoint)`; `Part.stock` becomes a derived sum. Movements kinds `receipt \| adjustment \| count \| issue`, each `Stamp`ed with before/after. Adjustment needs a reason; stock never negative. Cycle count = snapshot expected → count → post variances as `count` movements. Low stock = `onHand ≤ reorderPoint` → "Create PO" shortcut pre-fills Purchasing. Locations are division-stamped. | Brief | locked |
| E9 | **Cross-division inventory rules are NOT ruled** — all locations visible to everyone; POs/locations stamped only. | MH has not ruled | provisional (amber) |
| E9 | **Labels**: batch reprint by job / estimate / watch (multi-select, prefix or `A–B` range) queues the same two label types to the existing Label Queue, unprinted. | Brief | locked |
| E9 | **Reports** (`getReport`): funnel · throughput (workflow × month) · aging (0–7 / 8–30 / 31–90 / 90+ d) · **department P&L labor-only** (`type === 'service'` lines → W/B/P/PM; parts/shipping = `no_dept_product`). Every report carries a reconciliation note; totals equal dashboard cards. CSV via `reportToCsv`. | Brief | locked |
| E9 | **Accounting** = QBO stub views: invoice register, payment register, queue with fake sync states (`queued` / `pushed_stub` / `error_stub` — SO numbers ending in 5 show error), CSV export stub. Nothing external. | Brief | locked (stub) |
| E9 | **Setup**: Users & Roles (create / edit / deactivate, tier, duty label display-only, division, mock password + 4-digit PIN; guards: can't deactivate self or last manager); catalog editor (add / edit / retire — retired rows leave the live catalog); six message templates with `{{merge.fields}}`; Locations / Printers stub cards. **Templates are edited but Outbox bodies still come from code** — wiring pending. | Brief | locked (template wiring provisional) |
| E9 | **Integrations** tiles: QBO, shipping, RolliTime, Email — all `not_connected` / `stub`. Help = per-role quickstart placeholders. | Honesty | locked |
| E9 (MH 2026-09-24) | **Service Evidence at QC**: four slots `hidden_serial · timing_sheet (before left / after right) · pressure_test (structured depth "50M/164ft") · parts_grading (grade tags B · Ø/REPL · D/REPL)`; each item keys to **watch AND job**, filed only after scanning/entering the watch label (job #, ref or serial — validated). `EVIDENCE_REQUIRED` per kind: service = all four (**QC pass gate**); small_job = hidden_serial; warranty = hidden_serial + timing_sheet — reduced sets **provisional**. Client 360 gains an Evidence section grouped by service date; portal documents include evidence photos. | MH spec | locked (per-kind sets provisional) |
| E9 polish | Pickup Station validates the code **before** the photo step; parts assistant returns low-ranked best-effort suggestions with "add a reference to narrow" for bare words; Floor Map chips route concierge to Client 360 (`?hit=job-…`) instead of a Restricted job page. | Regression notes | locked |

**Modules touched:** purchasing-inventory, labels-reports-accounting, setup-integrations-help, jobs (evidence)

## E10 — Companion panel (M3KE front door) — 2026-09-25

| date | decision | rationale | status |
|---|---|---|---|
| E10 | **Docked companion panel** (right, 400 px) across all staff screens; toggled by top-bar Bot button or **Alt+M**; context follows the route (`/clients/:id`, `/jobs/:id` → its client, `/estimates/:id` → its client). Whole panel carries an amber **"scripted assistant"** banner — every answer is computed from fixtures, no model is called. | Front door for M3KE without pretending intelligence | locked |
| E10 | **Price Memory**: colloquial → reference via `model_references` fixture (`reference` regex → `alias` → `alias + year window`); model-only queries that span several references (Daytona, Sub) **ask one clarifying question**; unresolvable → clarify. Candidates carry mined evidence `{uses, avg, last}` (fixture `priceEvidence`). **Verify** stores `{by, at, station}`; verified ranks #1 for 12 months, then shows amber **"re-verify pricing"**. Verifications write `price_verified` rows to the Parts Knowledge log. | Prices are labels too; make the loop visible | locked |
| E10 | **Client Brief** = 3 derived lines (relationship · history highlights with citations `hitKey` → Client 360 · **service debt** from `finishedAt − dueAt` on closed jobs). Staff **corrections** are stored (`BriefCorrection` with original text) and replace the line on future briefs, cited "corrected by X". Naomi seeded with E02018 delivered ~90 days late. | Human overrides beat generated text and stay auditable | locked |
| E10 | **Ask the shop**: freeform → seeded knowledge cards (tag + word scoring, threshold 3). Miss → "route to MH/MM" creates a **manager-role task** + `RoutedQuestion`; a manager answering it from the panel **creates a new card**, links `sourceTaskId`, and closes the task. | Every unanswered question becomes documentation | locked |
| E10 | **Photo labels**: word pills (`LABEL_PILLS`: dial · hands · bracelet · condition) offered on inspection and evidence photos, **skippable**, stored per photo (`PhotoLabel` with provenance) and shown in a labels log; also stamped on the job timeline. | Cheap supervised labels at point of work | locked |
| E10 | **Tier/division**: non-manager tiers see price/parts/ask but **no money totals** (lifetime value, avg price masked) — amber pending MH's hide-money ruling; routed questions and tasks stamped with the session division. All companion actions audit as type `companion`. | Least privilege until ruled | provisional (money) |

**Modules touched:** auth-stations, dashboard-today

## E14 — Comms hub (staff inbox) — 2026-09-25

| date | decision | rationale | status |
|---|---|---|---|
| E14 | **Conversation model**: one thread-space (folder) per client; each `Conversation` optionally anchored to a request / estimate / job (context chip → record). `ConvMessage.direction` `in \| out \| internal`, `source` lookup `portal \| email \| kiosk \| approval \| photo \| parts \| pickup \| staff \| note \| system`. The legacy E8 `Message` store stays for the portal UI; portal sends also land in the thread. | The conversation is the relationship timeline | locked |
| E14 | **Reply-token routing (mocked)**: every outbound carries `RT-<CONV>-<n>` (also written into the Outbox body); inbound replies carry `matchedToken` and the match is shown on the message. A "Simulate inbound" button emulates an email reply matched to the last outbound token. | Make the routing mechanism testable without email | locked (mock) |
| E14 | **Views**: Needs reply (default; `lastInboundAt > lastOutboundAt`, oldest first, age shown) · Assigned to me (user or my roles) · All open · Snoozed (until a date; wakes automatically on read) · Closed. Inbound on a snoozed/closed thread reopens it. Division-scoped by `conversation.division`. | Work list, not a mailbox | locked |
| E14 | **Composer**: template picker over the Setup message templates with **merge fields rendered from the thread's client / anchor** (unfilled fields flagged amber), free text, photo attachments; queue → Outbox + thread `out` message. **Internal notes** are a distinct `internal` direction, never sent, audited. | Point-of-work labeling of comms | locked |
| E14 | **Signals**: job cards and estimate rows show a `reply` indicator when an anchored thread needs reply (legacy WorkQueue pattern); Client 360 emails card links to the client's thread-space; `/today` gains derived `thread` rows for needs-reply threads assigned to me/my roles. | Comms debt visible where work happens | locked |
| E14 | **Auto-threading**: portal estimate approve/decline, parts approval, pickup-window confirmation and portal messages land as structured event messages (`event.kind`) in the client's anchored thread. Photo submission from the portal is seeded only (no portal upload exists). | Structured events, not chat | locked (photo submission provisional) |
| E14 | Audit type `comms` for assign / snooze / wake / close / reopen / reply / note / simulated inbound. Kiosk and email inbound are fixtures — no ingestion exists. | Honesty | noted |

**Modules touched:** auth-stations, dashboard-today

## E15 — Portal-first client content (MH ruling, 2026-09-25)

| date | decision | rationale | status |
|---|---|---|---|
| 2026-09-25 (MH) | **"Client emails notify; the portal renders. No HTML-attachment content to clients."** Every client email is a short notification with **one prominent link** (`{{portal.link}}`); all rich content (estimate lines, inspection grades, photos, evidence, invoices) renders as a page in RolliConnect. | One place to read, one place to act; nothing stale in an inbox | **locked (principle)** |
| E15 | **Portal inspection report page** `/rc/report/:token` — public via token (no session needed), shows condition grades per component (`good \| fair \| worn \| replace` + note), inspection photos, notes, link to the matching estimate, **Approve / Decline (reason required)** on the page. Honors the **supersede chain**: an outdated token shows "a newer report replaces this one" and forwards to the latest. Reachable from the watch card on `/rc/home` ("Inspection report ready →") and Needs-you (`review_inspection`). | Client acts where the content is | locked |
| E15 | **Staff issue flow** (job page → "Issue inspection report to client"): requires inspection photos; supersedes the previous issued report; moves an `in_review` job to `awaiting_customer_approval` (transition stamped, email flagged as queued); queues the short `inspection_ready` notification to Outbox; posts a system message in the client's Comms thread. **Portal decision** approves/declines the job (`approve` / `back_to_review` with the client's reason) and the linked sent estimate, auto-threads as an approval event, audits `portal`. | Full loop: staff → Outbox → portal → decision → staff status | locked |
| E15 | All templates converted to **short notification bodies**: `intake_confirmation, estimate_sent, inspection_ready, job_in_progress, back_in_progress, evidence_available, invoice_ready, ready_for_pickup, shipped`, each with a single `▶ {{portal.link}}`. `sendEstimate` email body likewise (no line list). Composer preview shows the short form; `{{portal.link}}` resolves per anchor (report token → estimate page → watch page → home). | Ruling | locked |
| E15 | Report component list & grade vocabulary are placeholders; portal decisions are not persisted to the RolliConnect replay log (reload resets). | UNKNOWN | provisional (amber) |

**Modules touched:** auth-stations, dashboard-today

## E12 — RolliTime `/rt` timing bench — 2026-09-25 (NEW automation, no legacy precedent)

| date | decision | rationale | status |
|---|---|---|---|
| E12 | **Own route-space `/rt`** with a minimal "RolliTime" shell; standard staff card + password sign-in (no camera at the bench → `no_camera`, audited). Home = **testing queue** (jobs in `testing`, session division, oldest first) + scan/enter watch label (job #, ref/serial, or PDF417 payload). | One-job station, same pattern as /rc | locked |
| E12 | **Timing test structured like Witschi output**: six positions `DU DD CD CL CU CR` × (rate s/d, beat error ms, amplitude °), computed **AVG** row + Δ (max−min rate), lift angle, power reserve. **Caliber tolerance sets** seeded (3135, 3235/3285, 4130, MT5402 + generic fallback) matched by reference prefix; targets shown beside every field; out-of-tolerance cells highlight live. | Mirror the real bench sheet | locked (field mapping provisional) |
| E12 | **Auto-evaluation suggests a verdict** (Crit1 Δ < max; Crit2 avg within min/max; beat ≤ max in every position; amplitude within range in every position; reserve ≥ hours) — **the tech decides**; overrides are flagged in the audit row. | Human verdict, machine hint | locked |
| E12 | **PASS** → test saved (append-only, keyed to job AND watch), job stamped "to QC queue" (**status stays `testing`** — the supervisor's QC queue already is `testing`; the timing pass is a flag on the timeline), "Testing complete" short email → Outbox with portal link. **REJECT** → reason required → `transitionJob(qc_fail)` (back to `in_service` under its assignees, "back to in progress" email) + rejection logged. | Reuse the existing QC-fail transition rather than a new status | locked (QC-queue handoff provisional) |
| E12 | Tests are **append-only watch history** (multiple per job, newest first) — surfaced on `/rt/test/:jobId` and the job page "Timing tests" card; this is the future health-history dataset. Audit type `rollitime`. | Data asset | locked |
| E12 | Unruled: exact Crit1/Crit2 definitions per caliber, per-position rate bounds, whether PASS should create an explicit `timing_passed` sub-status, Witschi file import. | UNKNOWN | provisional (amber) |

**Modules touched:** auth-stations, dashboard-today

## E13 — RGTime `/rg` + public Kiosk `/kiosk` — 2026-09-25 (MH ruling on NFC)

| date | decision | rationale | status |
|---|---|---|---|
| E13 | **RGTime is a phone PWA** (`/rg`, manifest `/rg-manifest.webmanifest`, `start_url /rg`, standalone). Staff sign in once (card + password) and the login is **remembered per staff member per device** (`rollisuite.rg.session`, separate from the station session and from `/rc`). "Forget phone" clears it. | Staff clock from their own phones; no shared terminal | locked |
| E13 | **Clock in/out is an NFC tap.** Physical tags at fixed locations are written with `/rg/clock?tag=<tag-id>` (seed: `tag-fd-rw` Front Desk — Rolliworks, `tag-rs-counter` RS Counter). Opening that URL on a remembered phone shows the tag's location + **one confirm button**; the punch records person, tag, location, **division from the tag**, timestamp. Clock-out is the same tap (kind toggles on the person's last punch). Division-scoped staff cannot punch on the other division's tag. | One tap, no menus; the tag carries the place and the division | locked |
| E13 | Prototype has no NFC → **"Simulate NFC tap" picker** on `/rg` navigates to the real tag URL (`&sim=1`, punch flagged `simulated`). The URL structure is production-real: a physical tag written today works the day we deploy. | Preview constraint | locked |
| E13 | **Manager view `/rg/manager`**: card + password, **manager tier only**, even on a remembered phone. Week grid (Mon–Sun, hours per day, week total, open-punch amber, on-the-clock dot), prev/next week, division toggle for `both` staff. Hours = paired in→out punches at that division's tags; an open punch on today accrues live. | Same auth bar as /rt for anything beyond "my own punch" | locked |
| E13 | **Staff identity**: in Keeper **RGTime owns staff identity (D-026)**; RolliSuite reads it. The prototype mocks this by reading the shared `users` fixture. | Single source of truth for people | locked (mock here) |
| E13 | **Hardening — Keeper decision, not built**: plain NFC tags are cloneable and the URL is bookmarkable (a saved link could clock in from home). Options recorded for Keeper: (a) NTAG 424 DNA-style **rotating tap codes** (SUN/CMAC in the URL, server-verified, single-use), (b) **geolocation sanity check** on punch (device within N m of the tag's known location), (c) both. | Recorded so Keeper's builder chooses | provisional (amber) |
| E13 | **Kiosk `/kiosk` is public**: no session, no staff chrome, full-screen. Flow per legacy kiosk: idle → brand pick (Rolliworks / RolliShop) → optional service multi-select (Mov Service, Case Work, Band Repair, Band Polish, Recut Bezel; **"Skip — Continue"** when none) → form (first/last/email/phone required, notes optional) → thank-you **auto-reset after 5 s**. Screen **dims after 30 s** idle (touch to wake); an abandoned mid-flow resets to idle after 2 min. | Faithful to the legacy kiosk, with the two obvious fixes below | locked |
| E13 | **Submission creates a `ServiceRequest`** `source: kiosk`, `division` from the brand pick, `station: Kiosk`, `createdBy: Kiosk`, `kiosk{…}` details; lands in the **staff `/requests` queue** (new page, division-scoped) and threads a `kiosk`-source message into the client's General conversation. Audit type `kiosk`. | Requests are the "ask before an estimate" — that is what a walk-in is | locked |
| E13 | **Match, don't duplicate** (improvement on legacy): normalised **email OR phone** match against existing clients → request links to the matched client with `matchState: possible` and the queue shows **"Possible existing client — Confirm link / Not the same — new client"**; staff decision audited. No match → a new client record is created (`type: retail`, kiosk-sourced). | Legacy silently created duplicates | locked |
| E13 | Unruled: PWA offline/queued punches; punch **edits/corrections** by a manager (none built — punches are append-only); overtime/breaks rules; whether concierge tier may see the week grid; kiosk signature/ID capture; kiosk match when the kiosk name differs from the matched record (today: staff decides). | UNKNOWN | provisional (amber) |

**Modules touched:** auth-stations, dashboard-today

## E11 — RolliWorking standalone `/rw` (workshop app draft) — 2026-09-26

| date | decision | rationale | status |
|---|---|---|---|
| E11 | **`/rw` is its own route-space** with its own shell and identity ("RolliWorking", dark, dense, tablet-friendly). No RS sidebar; no RS route is reachable from it. Nav: Bench · Jobs · Parts · QC (manager tier) · Supervisor (manager tier) · Floor · Evidence · My today. Home = **My Bench**. | Same pattern as /rc, /rt: one audience, one shell | locked |
| E11 | **Access boundary (restated, locked)**: RW standalone is an ACCESS BOUNDARY in Keeper — bench tiers authenticate into RW only and **cannot reach RS at all**. RS keeps its embedded workshop views unchanged as the "RW-mini". The prototype shares one origin and one station session (a shortcut, not the spec). | Ruling | locked |
| E11 | **Boundary enforcement in the prototype**: the shell intercepts every in-app link produced by re-homed components — `/jobs/:id` is rewritten to `/rw/jobs/:id`; any other RS path is blocked with an inline "not reachable from RolliWorking" notice. Keeper enforces this server-side by tier, not by link rewriting. | Reuse E6 components verbatim without forking them | locked (mechanism prototype-only) |
| E11 | **Own sign-in** inside the shell: same card model, station division decides who appears, password on the first sign-in of the day and PIN after (reuses `signInWithPassword` / `switchUserWithPin`); no camera at the bench → `no_camera`, audited. Accepts all staff; the experience centers on bench roles. | Ruling | locked |
| E11 | **Hide-money in /rw**: no dollar amount is rendered anywhere in RolliWorking (`MoneyContext` → `LinesTable` drops Rate/Ext/Total and shows "Amounts hidden…"). Applied as the amber default pending MH's hide-money ruling for bench tiers. | Ruling (default) | provisional (amber) |
| E11 | **Re-home, don't rebuild**: Bench, Supervisor board and My today are the existing E6/E1 pages rendered inside the RW shell; Job page, Jobs lookup, Parts, QC, Evidence capture are thin compositions of the existing panels (`LinesTable`, `InspectionPanel`, `EvidencePanel`, `TimingCard`, `PartsRequestModal`, …). Same `client.ts` data → actions in /rw appear instantly in RS's workshop views and vice versa (verified). | One truth, two shells | locked |
| E11 | **Bench Job page** (`/rw/jobs/:id`) shows: legal actions + parts request, watch, work lines (no money), inspection, notes, service evidence, timing tests, photos, parts requests, shop time, timeline + linked tasks, assignees, holds. It **omits**: invoice/SO, estimate link, Client 360 link, delete, pin-to-hit-list. | Bench needs, not front-desk needs | locked (omission list provisional) |
| E11 | **QC lane** (`/rw/qc`, manager tier): jobs in `testing` with evidence slot completeness (`n/required`), **Pass** (disabled until required slots are filed — same gate as `qc_pass`) and **Fail…** (reason → `qc_fail`, client notified). | Supervisor's QC queue as an actionable lane | locked |
| E11 | **Evidence capture station** (`/rw/evidence`): scan/enter the watch label → job → the four QC slots (`EvidencePanel`); or pick from the testing queue with slot counts. | Ruling (the four QC slots) | locked |
| E11 | **Floor map — legacy two-lane style** (`/rw/floor`), rendered so MH can compare against the nine-lane RS map: **head lane** (jobs whose workflow includes W, or has no workflow) Intake → Review → Movement bench; **band lane** (workflow includes B/P/PM) Intake → Review → Band bench → Polish (in-service polish-only); both converge into **Final assembly** (= `testing`); **Into safe** off-ramp = holds, awaiting approval, ready (in safe). Chips carry **part-colored dots** per department (W indigo · B amber · P teal · PM rose). Division-scoped to the station. A job with W and B appears in both lanes (parallel head/band work). | Legacy RW research (reference, not gospel) | provisional (amber) — **MH to rule: two-lane vs nine-lane for Keeper** |
| E11 | Unruled: which lane model Keeper keeps; hide-money for bench tiers (default applied); whether concierge tier belongs in RW at all (today: allowed, QC/Supervisor hidden); whether RW needs its own station registry; offline/tablet install (PWA) for RW; whether the RW job page should expose Owner changes. | UNKNOWN | provisional (amber) |

**Modules touched:** auth-stations, dashboard-today

## Per-component completion, decoupled from invoicing — MH ruling (first board walk), 2026-09-26

| date | decision | rationale | status |
|---|---|---|---|
| 2026-09-26 | **Components**: every job has components derived from its workflow — `W` → **Watch head**, `B` → **Band**, `P`/`PM` → **Case**. A single-track job (or one with no workflow) has one implicit component. Stored on the job (`Job.components[]`), derived on first touch for pre-ruling fixtures. | Ruling | locked (P/PM → "case" mapping provisional) |
| 2026-09-26 | **Mark complete per component** — on the job detail "Components" card (RS and `/rw`) and inline on the `/rw` bench row ("Watch head done"). Records `completedBy` (the tech who did the work = current actor), `completedAt`, station; audited (`job`). Only while the job is `in_service` and not on hold. **Supervisor / manager can amend attribution** (`amendedFrom / amendedBy / amendedAt`, audited). | Ruling | locked |
| 2026-09-26 | **New board bin "Awaiting components"**: a job in service with ≥1 component complete but not all. Shows per-component chips (✓ + tech initials vs still-out). Appears on the RS Jobs board (lane between In service and On hold), the Jobs status filter, the `/rw` bench row status and the `/rw` two-lane floor's Into-safe off-ramp (legacy safe-await). | Ruling · matches legacy safe-await | locked |
| 2026-09-26 | **Reunification rule**: when the LAST component completes the job auto-transitions `in_service → testing` (timeline reason "All components complete — reunified"). The manual "Send to testing / QC" action is **gated**: a split job with components still out throws; a single-component job completes its implicit component (credit to the actor) and moves on. Never finishable until all components are in. | Ruling | locked |
| 2026-09-26 | **Tech monthly numbers count component completions**: Reports → "Tech completions" (count by tech × month, with W/B/P/PM breakdown); Supervisor board shows each tech's completions this month. Credit lands in the month the component completed, **regardless of when the job invoices**. | Ruling | locked |
| 2026-09-26 | **Invoicing untouched** — the sales order still waits for the whole job (`ready_to_ship` / `closed`); only credit moves earlier. | Ruling | locked |
| 2026-09-26 | **QC-fail after completion: credit stands** (MH ruling 2026-09-26). Completion is not revoked; the rework is logged separately on each completed component (`rework[] {at, reason, by}`, shown as "rework ×n"). | Ruling | locked |
| 2026-09-26 | Unruled: whether P and PM should be separate components (today both = Case); whether a component can be un-completed (today: amend attribution only); whether an amended attribution moves the month credit (today: yes, the row carries one `completedBy`); whether completions on rollishop jobs count in the same report (today: yes, all divisions). | UNKNOWN | provisional (amber) |

**Modules touched:** jobs, workshop, rolliworking, labels-reports-accounting

## Client request notes — MH brief, 2026-09-26

| date | decision | rationale | status |
|---|---|---|---|
| 2026-09-26 | **Client requests** live on the job (`Job.clientRequests[]`): short items of what the client asked for, stamped who/when/station. Added from the RS job page, the `/rw` job page and the Supervisor Pad. Internal notes remain a separate concept and never render client-side. | Brief | locked |
| 2026-09-26 | **Badge on cards**: `/rw/pad` and `/rw/wm` cards show amber "CLIENT REQUESTS (n)" with the open items listed on the card, never in a tab. | Brief | locked |
| 2026-09-26 | **Scan pop-up**: every label scan in the workshop (Bulk Assign, Station Scanner, WM room, Pad) pops a modal with the open requests in large type. The scan registers regardless; the modal persists until "Understood", which logs `{by, at, via}` per request (audited `job`). Re-surfaces on every scan while any request is open. | Brief | locked |
| 2026-09-26 | **QC enforcement**: in `testing` every request is a mandatory checklist item — Done, or N/A with a required reason (who/when logged). `qc_pass` is disabled/throws with a message naming the first unchecked request; Pad Advance-from-QC and `finishJob` share the gate. | Brief | locked |
| 2026-09-26 | Unruled: portal visibility of requests; once-per-person ack vs every scan; N/A restricted to supervisor tier. | UNKNOWN | provisional (amber) |

**Modules touched:** jobs, rolliworking, workshop

## Inbox — Staff section, 2026-09-26

| date | decision | rationale | status |
|---|---|---|---|
| 2026-09-26 | Inbox sidebar lists every staff member with their open-assigned thread count; any staff member can open any colleague's inbox and **read and reply**; "Assigned to me" remains the personal shortcut. Assignment is not changed by replying from a colleague's inbox. | Brief | locked |
| 2026-09-26 | Unruled: audit row on viewing a colleague's inbox; auto-reassign on reply. | UNKNOWN | provisional (amber) |

**Modules touched:** comms-hub

## Supervisor Pad v2 — MH brief + ruling, 2026-09-26

| date | decision | rationale | status |
|---|---|---|---|
| 2026-09-26 | `/rw/pad` is scoped to ONE user — the watchmaker-room supervisor on an iPad — with its own tablet-native UI (Jobs · Parts · Review). | Brief | locked |
| 2026-09-26 | **Sale prices are shown on the supervisor's pad** (Parts tab suggestions and request lines, Review tab). Overrides the `/rw` hide-money default for this screen only. | MH ruling | locked |
| 2026-09-26 | Parts flow: scan → job/reference/caliber → automatic caliber query → reference-scoped description search (learned on top) → GENERIC free-text fallback → **Manager review**, never straight to the client. Manager fills price (required) + part#, then "Send for client approval" (Outbox). | Brief | locked |
| 2026-09-26 | **M3KE capture**: every resolution of a generic description to a real part# (+price) and every supervisor selection is appended to one inspectable log (`m3keEvents`); learned mappings rank top for that reference / caliber and are tagged. | Brief (training-data plumbing) | locked |
| 2026-09-26 | Tech reassignment from the pad is a **supervisor override** (audited); scan assignment via Bulk Assign remains the morning path. | Brief | locked |
| 2026-09-26 | Unruled: portal action in the approval email; token similarity vs model; caliber as a watch attribute; whether bench (WM) requests also pass the manager gate. | UNKNOWN | provisional (amber) |

**Modules touched:** rolliworking, workshop, comms-hub
