# Module — Jobs (pipeline · kinds · holds · owner/assignees · inspection · evidence · report to client · timing · components)

## Screens & layout intent
- `/jobs`: **board** (lanes: Intake · In review · Awaiting customer · Approved · In service · **Awaiting components** · On hold · Testing/QC · Ready to ship · Closed) or **list**; workflow filter (W/B/P/PM counts), status filter chips with counts, search. Cards: number, client, watch, kind/priority, assignee chips, owner badge, hold badge, component chips (when a split job has ≥1 component done), reply indicator.
- `/jobs/:id`: header (number, status+hold, kind, priority, workflow badges, simple status, owner, money-tail pill), actions bar (legal actions; reason modals; Create invoice; Parts request; Add to hit list; Delete = manager), review gate banner, hold banner. Left column cards: Watch, Line items (money), **Components**, Inspection (multiple-choice form, service kind only), Notes, Inspection report to client, Timing tests, Service evidence (4 slots), Photos, Parts requests, Shop time. Right: Status timeline + linked tasks, Owner, Assignees, Holds, Details (priority, due, intake notes).
- `/jobs/new`, `/jobs/shop-time` per route map.

## Fields
| field | type | required | validation |
|---|---|---|---|
| kind | `service \| small_job \| warranty` | yes | lookup `JOB_KIND_CONFIG` |
| workflow | DeptCode[] | yes on create | from estimate lines or received package |
| priority | `low \| normal \| high \| urgent` | default normal | |
| owner | Role or null | no | defaults per kind (small_job/warranty → concierge) |
| assignees | shortName[] | no | staff list; toggled |
| dueAt, intakeNotes, conditionNotes | date/text | no | |
| notes[] | text stamped | no | non-empty |
| photos[] | image + caption | ≥1 required to leave review | |
| inspection (service kind) | multiple-choice per question (`INSPECTION_QUESTIONS`) | required to leave review when kind has report | |
| hold | type parts\|outsource + reason | reason required | `canHold`: on-hand, status ∈ approved/in_service/testing |
| shop time | minutes >0, note | | never moves status |
| evidence slot | hidden_serial · timing_sheet · pressure_test · parts_grading; photo required; labelScan; depthRating (pressure); grades (parts) | per kind (`EVIDENCE_REQUIRED`) | keyed to watch AND job; append-only |
| component | head/band/case; completedBy/At/Station; amended*; rework[] | | see below |

## Calculated
`total` (Σ lines), `simpleStatus` (estimate / on_hand / finished), `tailStage` (money tail after ready), `reviewGaps`, `evidenceGaps`, `legalJobActions` (per-kind stage-skip), `awaitingComponents`, `componentsDone/Outstanding`, watch status projection.

## State machine
Full tables in `source/STATE-MACHINES.md` §1 (actions, guards, side effects, kinds, holds, simpleStatus, entry points, money tail) and §15 (components). Summary of guards on `transitionJob`: hold → no actions; legal action; reason if required; review gaps (photos; report when kind requires); `qc_pass` needs evidence slots; `to_testing` needs all components complete (single implicit component is auto-completed by the actor); `qc_fail` appends a rework entry on every completed component (credit stands — ruling 2026-09-26).

### Components (ruling 2026-09-26)
- Derived from workflow: W → Watch head, B → Band, P/PM → Case; none → one implicit "Watch". Stored on the job.
- "Mark complete" (job page, RS + RW; inline on bench rows) only while `in_service` and not on hold; records the actor as `completedBy`; audited. Manager may **amend attribution** (audited, `amendedFrom`).
- ≥1 but not all complete → **Awaiting components** bin (board lane/filter/pill; RW floor Into-safe). Last completion → auto `to_testing` ("All components complete — reunified").
- Credit counts in the month of `completedAt` (Reports → Tech completions; Supervisor per-tech count). Invoicing unchanged.

## Emails (Outbox) and threads
`request_approval` → approval request; `qc_pass` → watch ready; `qc_fail` → delay with reason. Inspection report issue → short notification with `/rc/report/:token` link; portal decisions thread into Comms and flip job/estimate status.

## Tier/division
Jobs board/detail/new/shop-time = manager tier in RS; the same job page content minus money/invoice/estimate/client/delete is available to all staff in `/rw`. Division stamped on create (session); `⚠ DRIFT`: job lists are not walled by division in RS (RW lookups are).

## Behaviours discovered during build
- Owner ≠ "PM" (PM is precious metals). Owner is a role; assignees are people.
- Parts approval auto-places a parts hold when allowed.
- Inspection report to client (E15) is a separate versioned document with supersede chain; approving it approves the linked estimate and advances the job.
- Timing tests (E12) are append-only watch history, surfaced on the job page.
- `⚠ DRIFT`: `deleteJob` hard-deletes (and its shop time/tasks) — KEEPER: soft delete + audit.
