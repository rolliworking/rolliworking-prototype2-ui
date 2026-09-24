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

