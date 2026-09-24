# STATE-MACHINES — RolliSuite prototype

## 1. Jobs pipeline (`JOB_FLOW`, `JOB_ACTIONS` in `client.ts`)

Full status list (pack DB enum), shop-floor map reads left → right:

`intake → in_review → awaiting_customer_approval → approved → in_service → testing → ready_to_ship → closed`

### Legal transitions (only these render as buttons — never a status dropdown)
| from | action key | label | to | reason | client email | who can trigger |
|---|---|---|---|---|---|---|
| intake | start_review | Start review | in_review | | | any signed-in staff |
| in_review | request_approval | Send for customer approval | awaiting_customer_approval | | ✉ approval request (provisional) | any |
| in_review | approve_direct | Mark approved (estimate pre-approved) | approved | | | any — provisional (not in pack) |
| awaiting_customer_approval | approve | Customer approved | approved | | | any |
| awaiting_customer_approval | back_to_review | Back to review… | in_review | required | | any |
| approved | start_service | Start service | in_service | | | any |
| in_service | to_testing | Send to testing / QC | testing | | | any |
| testing | qc_pass | QC pass → ready to ship | ready_to_ship | | ✉ watch ready (provisional) | any |
| testing | qc_fail | QC fail → back to service… | in_service | required | ✉ delay notice | any |
| ready_to_ship | close | Close job | closed | | | any |
| closed | — | (invoice stub, next session) | | | | |

Guards: `activeHold(job)` ⇒ zero actions (hold must be released first). `transitionJob` validates the key against `legalJobActions(job)`; unknown key throws. Tier gating per action is **not** implemented (pack: only `can-delete-jobs` permission exists → mapped to manager tier for `deleteJob`).

### Side effects on transition
| to | watch.status | job fields |
|---|---|---|
| awaiting_customer_approval | awaiting_approval | |
| in_service | in_service | |
| testing | qc | |
| ready_to_ship | awaiting_pickup | |
| closed | released | finishedAt=now, simpleStatus=finished |
Every transition appends `JobTransition {from,to,action,reason?,emailQueued?,at,by,station}` and an audit event type `job`.

### Holds (overlay, not a status)
- `placeHold(type: parts|outsource, reason*)` allowed when `simpleStatus=on_hand` and status ∈ {approved, in_service, testing}, no active hold.
- Status field unchanged while held; board shows job in **On hold** lane; actions hidden. `parts` hold sets watch.status=awaiting_parts.
- `releaseHold(note?)` → status = `priorStatus` (unchanged by construction), watch status re-synced, hold kept in `holds[]` with releasedAt/By.

### Simple status (pack: `estimate | on_hand | finished`)
| event | simpleStatus |
|---|---|
| createJob(onHand=false) / createJobFromEstimate without received package | estimate |
| createJob(onHand=true), createJobFromEstimate with received package, convertEstimateToIntake | on_hand (+ intakeDate) |
| close | finished |

### Per-kind config (`JOB_KIND_CONFIG`, lookup table — PROVISIONAL values)
| kind | label | default_owner_role | skipStages |
|---|---|---|---|
| service | Service | — (manual owner) | [] |
| small_job | Small job | concierge | [awaiting_customer_approval] |
| warranty | Warranty | concierge | [] |

Stage-skip mechanism: `legalJobActions` maps each action's target through `skipForward(kind, to)` (walks `JOB_FLOW` past skipped stages). Redirected actions are flagged provisional and dropped if a non-redirected action already reaches the same target (e.g. small_job in_review shows only "Mark approved"). Owner auto-set at creation from `default_owner_role`; service takes normal (manual) owner pick.

### Estimate → Job entry points
| function | precondition | result |
|---|---|---|
| `createJobFromEstimate` (`convertEstimate(id,'job')`) | estimate.status=approved, no jobId, has watch | job status intake; lines+watch carried; workflow from received package else line depts; estimate → converted, jobId set |
| `convertEstimateToIntake` (`convertEstimate(id,'intake')`) | status ∈ sent/approved/converted | existing job → on_hand + intakeDate; else new job on_hand; estimate → converted |
| `convertEstimate(id,'sales_order')` | | throws (stub) |

## 2. Estimates (E3)
`draft → sent → approved(provisional) → converted` · `sent → declined → draft (reopen)` · `sent → expired → draft (reopen)`.
| action | from | to | notes |
|---|---|---|---|
| markEstimateSent | draft | sent | no sentAt, no email |
| sendEstimate | draft/sent | sent | ✉ Outbox, sentAt |
| reviseEstimate | draft/sent | same | rev N+1, snapshot kept |
| declineEstimate(reason*) | sent | declined | |
| approveEstimate | sent | approved | staff-recorded, provisional |
| reopenEstimate | declined/expired | draft | |
| deleteEstimate | any except converted / linked package | — | |

## 3. Intake — 4-stage package flow (E2)
`arrived → processed → awaiting_inspection → received | discrepancy_hold`
| stage | function | guard | outputs |
|---|---|---|---|
| 1 Arrival | `logArrival` | tracking required for carrier; duplicate tracking rejected | SUB#, arrivedAt/By/Station |
| 2 Receive Package | `receivePackage` | status=arrived, ≥1 content pill | processed; estimate/client link; photos; ✉ confirmation if client known |
| 3 Work Order | `recordWorkOrder(bin)` | status=processed | awaiting_inspection, bin |
| 4 Receive Watch | `receiveWatch` | status=awaiting_inspection; ref+serial; ≥1 workflow dept | `received` + 2 labels + watch.status=awaiting_approval, **workflow stored (routing authority)** — or `discrepancy_hold` with reasons, watch.status=intake |
Discrepancies (`computeDiscrepancies`): missing component, serial/ref mismatch, extra watch, same-serial conflict. Discrepancy packages route to `/today` for concierge role holders and the inspector who flagged them.

## 4. Watch status (derived, display only)
`expected → intake → awaiting_approval → in_service → qc → awaiting_pickup → released`, plus `awaiting_parts` while a parts hold is active. Written by intake stage 4, job transitions, holds.

## 5. Task
`open ⇄ done` via `setTaskDone(id, bool)`; completion stamps completedAt/By; audit type `task`.

## 6. Auth / station
Device: `unregistered → registered(stationId)` (`registerStation` manager+password; `resetDeviceRegistration` back). Session: `signInWithPassword` (photo) → `switchUserWithPin` (only if signed in today) → `signOut`.
