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
