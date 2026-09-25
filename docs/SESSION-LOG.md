# SESSION-LOG — RolliSuite prototype

One entry per build session: what was built · what was decided · what was tested · what remains stubbed. E1–E8 entries are condensed from the session reports in `git log`; E9 and the documentation pass are this fork's work.

---

## E1 — Shell, sign-in, dashboard
- **Built**: standalone Vite + React 18 + TS app at `/app/frontend`; single data module `src/api/client.ts` over fixtures; tier-filtered sidebar (15 items, every one routes), global client search, dashboard (KPI cards, department P&L, hit list, recent activity), Estimates / Jobs / Hit List tables.
- **Round 2**: badge sign-in replaced by staff card + password + webcam verification photo (graceful no-camera / denied); PIN fast-switch after first daily sign-in; device-bound station (mock pre-registered "Front Desk 1"), manager-gated rename / reset / "Name this station"; audit log with photo thumbnails.
- **Decided**: visibility by access tier only; station = device; legacy monorepo untracked.
- **Tested**: testing agent iteration_2 (13/13), iteration_3 (10/10 + regression).
- **Stubbed**: all data in-memory; five quick actions → placeholders.

## E2 — Intake four-stage flow
- **Built**: `/intake` with stage tabs + live counts: Arrival (scan-first tracking, carrier auto-detect, signature, duplicate guard, walk-in → SUB#), Receive Package (estimate scan pre-fills, webcam + multi-file photos, content pills, mock receipt, confirmation email → Outbox), Work Order (bin), Receive Watch (pre-populated checklist with W/B/P/PM tags, expected components, ref/serial + NS, mandatory same-watch fork, workflow picker, live discrepancy list → received + 2 labels or discrepancy hold). Outbox and Label Queue pages.
- **Decided**: workflow set at Receive Watch is the routing authority; discrepancy = hold with reasons, not rejection.
- **Tested**: iteration_5 (one bug — receipt print wiped unsaved pills/photos — fixed).
- **Stubbed**: emails never send; labels/receipts are flags; any tier can run all stages.

## E3 — Estimates
- **Built**: list / create / edit / revise / approve-decline / send / duplicate / delete at `/estimates`; 22-item catalog with dept tags, custom lines, amount→rate back-calc, drag reorder, 450 ms autosave, quote-context strip, print preview, Outbox send, revision snapshots.
- **Decided**: pack wins (E+5-digit numbers, statuses, tax 8.25% "not applied", single optional watch, decline needs reason, reopen → draft, mark-as-sent sets no sentAt); staff `approved` status is provisional.
- **Tested**: iteration_6 (all flows, zero console errors).
- **Stubbed**: Create job / Convert flagged stubs (wired in E4/E5).

## E4 — Jobs
- **Built**: `/jobs` board (9 lanes incl. On hold) ↔ grouped list, search; `/jobs/:id` detail (watch card, dept-tagged lines, timeline, assignees, holds park/release, notes, photos, shop time, priority/due/condition edits); `/jobs/new`; Shop Time (on-hand only); E3 "Create job" + "Convert to intake" wired.
- **Decided**: pack DB enum as a linear machine, buttons only; holds are an overlay; emails on request_approval / qc_pass / qc_fail (provisional); job number `E` + digits from its own sequence (provisional); invoice / SO convert are throwing stubs.
- **Tested**: iteration_7.
- **E4+ (docs + kind/owner/today/tasks)**: `Job.kind` + `JOB_KIND_CONFIG` (small_job/warranty owner → concierge; small_job skips customer approval, provisional); role-based `owner` ≠ plural `assignees`; `User.roles`; derived `/today`; tasks with user/role assignment; six handoff docs. Tested iteration_8.
- **MH rulings**: inspection by kind (report only for service; photos for all) with `reviewGaps` gate; pinned manual hit list on top of the derived view with `#name` / `#role` syntax. Tested iteration_9/10. Password confusion (`michael1123`) resolved as a typo.

## E5 — Money tail (invoicing, pickup, ship)
- **Built**: Sales Orders as the invoicing vehicle (`/sales` list/detail/create, lines, stub payment ledger with partials, Fulfil → QBO hard-stop stub, push to Pickup/Ship, pickup code issue/consume, request-shipping-info, ship-to, admin marks, cancel); Pickup Station (code OR proxy + ID photo, hand-back photos, unpaid bypass, signature-free); Ship Station (mock label + tracking + coverage via `shippingProvider`, declared-value thousands rule, photos, unpaid block unless bypass); custody closes → job closed, watch released; tail pills on job cards; E3/E4 stubs wired (`invoiceJob`, `convertEstimateToSalesOrder`).
- **Tested**: iteration_11 (10/10).
- **Stubbed**: QBO, payments, carrier, email.

## E6 — Workshop lenses + parts chat
- **Built**: Bench (`/bench`: my jobs + next action/blocker, holds, parts requests, pull-next), Supervisor (`/supervisor`: unassigned, per-tech assign, parts approval queue, holds, QC queue), Floor Map (`/floor`, 9 lanes incl. Case cleaning); parts request → scripted assistant over 25-part catalog → attach → submit → approve/reject; approval learns part↔reference + aliases into Parts Knowledge (`/parts/knowledge`).
- **Decided**: lenses add no statuses; pull-next rule; assistant is scripted, no AI; approval = labeling + auto parts hold.
- **Tested**: iteration_12/13.
- **Noted**: uploaded Contract v1 HTTP client saved at `docs/reference/contract-v1-client.ts` as the repoint target.

## E7 — Client 360
- **Built**: `resolveIdentifier` universal search (name/email/phone/estimate #/job #/SUB#/tracking/ref/serial/SO #/pickup code/request #) → grouped hits → `/clients/:id?hit=` with flash; `/clients` directory; `/clients/:id` Client 360 read model (watch groups with merged history, estimates + revisions, jobs, invoices/payments, requests, notes & tasks, derived custody, emails); `ServiceRequest` entity; Naomi Castellanos rich seed.
- **Tested**: iteration_14 (100%).
- **Stubbed / missing**: no request create or quote function.

## E8 — RolliConnect (client portal)
- **Built**: `/rc` separate route-space and shell; magic-link stub sign-in; home = Needs-you + watches with plain-language status (`PORTAL_STATUS`); estimate approve/decline (advances linked job), pay-now (full balance stub), pickup window (→ SO + concierge task), shipping-info form, documents + history per watch, message thread; staff `/inbox` with replies → Outbox; portal event replay (`rollisuite.rc.events`) + Setup reset; (4) client-side request close with reason picker, staff `closeRequest`.
- **Tested**: iteration_15 (~98%, read-state fix re-verified), iteration_16/17 closing regression (100%).
- **Reviewer notes (not failures)**: Pickup Station lets a wrong code reach the photo step; bare one-word parts queries need a ref; Floor Map chips dead-end concierge at Restricted `/jobs/:id`.

## E9 — Division wall + global quick-add (MH rulings, dated 2026-09-24 in code/docs)
- **Built**: `Division = rolliworks | rollishop` on Station, User (+`both`), Job, Task, PinnedItem; session inherits the station's division (`getSessionDivision`); RS Counter station; Walter → rollishop with 2 tasks + 2 pins; `getToday` filters jobs/tasks/pins/discrepancies by division; `getDivisionStaff/Roles` drive every assignee picker; Staff hit-list viewer (full-screen modal, prev/next through same-division staff, read-only pinned + derived); `@name` / `@role` accepted wherever `#` was; global quick-add (`＋` in top bar, `Alt+T`, `QuickAddProvider`/`useQuickAdd`) with division-scoped autocomplete, context attachment of the current job/client/estimate, confirmation toast. Sign-in polish: no-camera handled, show/hide password, whitespace trimmed, one-click prototype password fill.
- **Decided**: the wall is the division, not the tier — no cross-division visibility even for managers; pins/tasks stamped with division at creation; `@` and `#` equivalent.
- **Tested**: iteration_18 (14/14 scoping tests).
- **Stubbed / not done**: no write is division-checked; packages/estimates/SOs/parts have no division; portal-created pickup task hard-codes rolliworks. Concierge Floor Map dead-end (P2) still open.

## Documentation pass (this session) — for KEEPER
- **Produced** from the code as it stands (E1–E9): `DATA-MODEL.md` (every entity/field, accommodation-set flags, drift), `STATE-MACHINES.md` (jobs pipeline with guards/side effects/per-kind skips, holds, SO, estimate, intake, parts, request, projections, tier enforcement summary), `API-SURFACE.md` (every export of `client.ts` with signature, return, side effects, stubs), `DESIGN-PRINCIPLES.md` (19 locked patterns with KEEPER enforcement column), `DECISIONS.md` (today's restated rulings + drift row), `SEED-DATA.md` (exact coverage and deliberate gaps), this log.
- **Decided / restated**: job_kind lookup table seeded service/warranty/small_job (rehab/internal planned); job_kind ⊥ workflow; per-kind config for billing semantics, stage skips, default_owner_role; owner ≠ assignees; "PM" = precious metals only; derived `/today` + tasks table with role assignment; parts alias table (search_misses → resolution → scoped term→part_id) — schema decision, prototype only has flat `aliases[]`.
- **Drift found (code is truth)**: counts (25 jobs / 11 packages / 24 estimates / 21 watches / 15 tasks / 6 pins / 8 SOs); station list; `invoiceJob` real; `addStation(name, division)`; watch statuses hand-set in seed lag their jobs; `closeRequest` audits as type `estimate`.
- **Tested**: none required — no code changed. Build untouched.
- **Scope note**: the brief said "through E4 + today's session"; the codebase already contains E5–E8 and E9, so all of it is documented — KEEPER should treat E5–E8 as in-scope contract, not future work.

### Open questions / ambiguities for KEEPER's builder
1. **Number sequences** — jobs (`E02011…`) and estimates (`E01041…`) share the `E` prefix but use separate counters. One shared sequence, or two with a prefix change? Collisions are possible today.
2. **Division on money/intake records** — Package, Estimate, SalesOrder, PartsRequest, ServiceRequest, Message carry no division. Should they inherit from the job/station, and should RLS apply to them?
3. **Division-checked writes** — nothing prevents a rollishop session from mutating a rolliworks job via URL. Intended?
4. **`both`-division users** — MH inherits the station's division. Should `both` be a real value in `user.division` or a `user_division` join?
5. **Discrepancy resolution** — there is no function to release a package from `discrepancy_hold`. What are the legal exits (re-inspect → received? return to client? escalate)?
6. **ServiceRequest lifecycle** — no create or quote function; `quoted` is only set in seed. Who quotes (estimate creation trigger?) and what's the request number sequence?
7. **`expired` estimates** — no code path sets it. Nightly job on `validUntil`, or drop the status?
8. **Estimate `approved` (provisional)** and portal approval semantics: staff-recorded approval doesn't advance a linked job, portal approval does. Should they be symmetric?
9. **`approve_direct` and small_job stage skip** — both still provisional. Confirm the real per-kind skip sets and whether `approve_direct` survives.
10. **Tier gating** — the module enforces only six manager checks; route tiers are UI-only. Which actions need DB-level role checks (e.g. transitions, holds, owner change)?
11. **Watch.status** — stored today, drifts in seed; recommend deriving. Confirm.
12. **`Job.department`, `Estimate.department`** — legacy derived columns used only by dashboard P&L. Keep or compute?
13. **Audit event identity** — prototype stores shortNames and station names, not ids, and caps at 60. KEEPER should use FKs; confirm retention.
14. **Station for package stage stamps** — only arrival records a station; `custodyOf` hard-codes "Front Desk 1" for received/discrepancy rows. Add `processed_station`, `work_order_station`, `inspected_station`?
15. **`closeRequest` audit type** — currently `estimate`; add a `request` audit type?
16. **Portal pickup task** — created with `division: 'rolliworks'`, `createdBy: 'RolliConnect'`, `station: 'RolliConnect'`; should portal actions have a system actor row and inherit the job's division?
17. **Magic link** — body claims 15-minute expiry; code enforces none and links are reusable. Confirm single-use + TTL.
18. **`receiveWatch` overwrites `watch.reference/serial`** with the received values even on a discrepancy. Should the estimate's watch record be immutable and the received values live on the package?
19. **`invoiceJob` on a closed job** is allowed (status ready_to_ship OR closed). Intended for late invoicing?
20. **`convertEstimateToIntake` from a `converted` estimate** is allowed (re-uses the job). Confirm.
21. **Pull-next does not start service** — only self-assigns; the tech then presses "Start service". Intended two-step?
22. **Case-cleaning lane derivation** (in_service with P/PM-only workflow) is provisional; confirm or replace with an explicit stage.
23. **Parts alias scope** — decision says "scoped term → part_id"; scope by reference, caliber, or global? Prototype has no scope.
24. **Billing semantics per kind** — decided as a per-kind column but not defined. What are the values (e.g. `charge`, `warranty_no_charge`, `counter_sale`)?
25. **Payments** — partial payments are provisional; portal pay is full-balance only. Confirm both for KEEPER.
26. **Custody close at hand-back vs fulfil** — provisional (pack says release at fulfil). Confirm hand-back.
27. **Date anomaly** — E9 rows are dated 2026-09-24 while the prototype environment reports June 2026. Treat E9 dates as labels, not timestamps.
28. **Concierge access to `/jobs/:id`** — Floor Map links dead-end concierge users (Restricted). Read-only job view for concierge, or hide the chips?

## E9b — Remaining RS modules + Service Evidence (2026-09-25)
- **Polish**: pickup code verified before the photo step; parts assistant best-effort low-ranked suggestions + "add a reference to narrow"; Floor Map chips route concierge to Client 360.
- **Built**: Purchasing (vendors, POs create/send-stub/cancel, receive-against-PO → audited stock receipts), Inventory (stock by location with LOW flags, movements, reasoned adjustments, cycle counts with variances, low-stock → Create PO shortcut), Labels (batch reprint by job/estimate/watch, ranges → Label Queue), Reports (funnel, throughput, aging, labor-only P&L; CSV; reconcile line), Accounting (invoice/payment registers, QBO queue with fake sync states, CSV export stub), Setup (Users & Roles, catalog editor, 6 message templates with merge fields, Locations/Printers stubs), Integrations tiles, Help quickstarts, **Service Evidence** four-slot capture at QC keyed to watch label + job with QC-pass gate, Client 360 Evidence section, portal documents.
- **Decided**: see DECISIONS "E9". Cross-division inventory rules and per-kind evidence sets stay amber.
- **Tested**: testing agent iteration_19 — 17/18 confirmed, the one wording mismatch (parts fallback phrase) fixed after the run; zero console errors.
- **Stubbed**: PO send (Outbox), QBO sync states, CSV "export file", printers, integrations connect, template wiring into Outbox bodies.
- **New open questions**: 29. Cross-division stock visibility / transfer rules? 30. Should `Part.stock` be dropped in favour of Σ StockLevel? 31. Evidence retention & who may delete/redo a slot (currently append-only, multiple items per slot allowed)? 32. Should templates drive the Outbox writers (merge-field rendering rules)? 33. `issue` movements — should job part fitting create them automatically (parts request approval → issue on hold release)?

## E10 — Companion panel (2026-09-25)
- **Built**: docked right panel (top-bar Bot button / Alt+M), context-aware, amber "scripted assistant"; Price Memory (model_references resolution, clarifying question, mined evidence, Verify → green check → ranks #1, stale > 12 mo → "re-verify pricing", knowledge-log rows); Client Brief (3 lines, citations to Client 360 hit keys, service-debt flag from promised-vs-delivered, stored corrections cited on later briefs); Ask-the-shop (6 cards, miss → route → manager task → answer → new card, task closed); Photo labels (word pills on inspection + evidence photos, skippable, provenance, labels log). Tier: non-manager sees no money totals (amber pending ruling).
- **Tested**: iteration_20 (~90%) → fixed: model-only clarify path, duplicate React key, pill testid slug, debt days (~90). Retest below.
- **Open questions**: 34. Hide-money ruling for bench/concierge tiers? 35. Should price verifications expire automatically or only flag? 36. Who may correct a brief (any staff today)? 37. Should routed questions honor division for who can answer? 38. Photo-label vocabulary ownership (lookup table editable in Setup?).

## E14 — Comms hub (2026-09-25)
- **Built**: conversation model (client folder, anchors, sources, reply tokens with visible matches), five inbox views with counts/unread/age, assign to user or role, snooze/wake/close/reopen, composer with template picker + merge-field preview + photos → Outbox, internal notes, simulate-inbound (mock token routing), reply indicators on job cards & estimate rows, Client 360 → thread-space link, `/today` `thread` rows, auto-threaded events from portal approve/decline, portal messages, parts approval, pickup window.
- **Stubbed**: email/kiosk/photo ingestion (fixtures + simulate button); portal photo submission does not exist as a feature.
- **Open questions**: 39. Should the legacy `Message` store be retired in favour of `ConvMessage` (portal reads it today)? 40. Token format/expiry and what happens on an unmatched inbound (new general thread?) 41. Can concierge tier close threads? 42. Should auto-thread events count as "needs reply"? (today yes for approvals/pickup — they are inbound)

## E15 — Portal-first client content (2026-09-25)
- **Built**: `/rc/report/:token` public inspection-report page (grades, photos, notes, approve/decline with reason, supersede forwarding); staff issue flow on the job page; templates converted to short notification + `{{portal.link}}` (+3 new keys); `sendEstimate` body shortened; Needs-you + watch card entry points; decisions auto-thread into Comms and flip job/estimate status. Principle recorded in DECISIONS.
- **Open questions**: 43. Token TTL / revocation for report links? 44. Should staff be able to record a client's verbal decision on a report (`decidedVia: staff`)? 45. Component list & grade words — final vocabulary? 46. Persist portal report decisions in the RC replay log?
