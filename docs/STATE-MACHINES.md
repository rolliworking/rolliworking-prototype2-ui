# STATE-MACHINES — RolliSuite prototype → KEEPER transition functions

Everything here is enforced today in `frontend/src/api/client.ts`. In KEEPER each machine becomes: a status lookup table, a `transition(<entity>_id, action, reason)` SQL function that validates from-state + guards + required reason, and an append-only transition table. The UI must call the function, never `UPDATE status`.

Notation: `✉` = client email queued to Outbox · `reason*` = required non-empty · **who** = what the client module enforces today (route tiers are UI-only and listed separately).

## 1. Job pipeline

`JOB_FLOW` (linear, left → right on the floor map):
`intake → in_review → awaiting_customer_approval → approved → in_service → testing → ready_to_ship → closed`

### 1.1 Actions (`JOB_ACTIONS`) — the only buttons that render
| from | action key | label | to | reason | ✉ | who (client module) |
|---|---|---|---|---|---|---|
| intake | start_review | Start review | in_review | | | any signed-in |
| in_review | request_approval | Send for customer approval | awaiting_customer_approval | | ✉ approval request | any; **review gate** |
| in_review | approve_direct | Mark approved (estimate pre-approved) | approved | | | any; **review gate**; provisional |
| awaiting_customer_approval | approve | Customer approved | approved | | | any (also called by portal as the client) |
| awaiting_customer_approval | back_to_review | Back to review… | in_review | reason* | | any |
| approved | start_service | Start service | in_service | | | any |
| in_service | to_testing | Send to testing / QC | testing | | | any |
| testing | qc_pass | QC pass → ready to ship | ready_to_ship | | ✉ watch ready | any |
| testing | qc_fail | QC fail → back to service… | in_service | reason* | ✉ delay notice (reason in body) | any |
| ready_to_ship | close | Close job | closed | | | any; also fired by `closeCustody` |
| closed | — | | | | | terminal |

### 1.2 Guards (all in `transitionJob`)
1. `activeHold(job)` → **zero legal actions**; throws "Job is on hold — release the hold first".
2. Action key must be in `legalJobActions(job)` (after per-kind redirect) else throws.
3. `needsReason` and blank reason → throws.
4. `reviewGaps(job)` non-empty → throws (only non-empty when `status === 'in_review'`): photos.length === 0 → "Inspection photos required (every kind)"; `JOB_KIND_CONFIG[kind].inspectionReport && !inspection` → "Inspection report not completed".
5. Tier gating per action: **none** in the module (only UI route tiers). `deleteJob` = manager tier.

### 1.3 Side effects (`pushTransition`)
| to | watch.status | job |
|---|---|---|
| awaiting_customer_approval | awaiting_approval | |
| in_service | in_service | |
| testing | qc | |
| ready_to_ship | awaiting_pickup | |
| closed | released | `finishedAt = now`, `simpleStatus = finished` |
| intake / in_review / approved | (unchanged) | |
Always: push `JobTransition {from, to, action, reason?, emailQueued, at, by, station}`; audit `job`; email if `notifies` (`EMAIL_FOR[action]`).

### 1.4 Per-kind config (`JOB_KIND_CONFIG` — lookup table)
| kind | label | default_owner_role | skipStages | inspectionReport | inspectionPhotos |
|---|---|---|---|---|---|
| service | Service | null (manual owner) | [] | true | true |
| small_job | Small job | concierge | [awaiting_customer_approval] (provisional) | false | true |
| warranty | Warranty | concierge | [] | false | true |
Planned rows (not in code): `rehab`, `internal`.

**Stage-skip mechanism** (`skipForward`): each action's `to` walks forward through `JOB_FLOW` while the stage is in `skipStages`. Redirected actions are tagged `provisional` and dropped if a non-redirected action already lands on the same target. Effect today: small_job at `in_review` shows only "Mark approved" (request_approval → approved collapses into approve_direct). KEEPER: `job_kind.skip_stages text[]` read by the transition function.

**Owner auto-set**: at create, `owner = JOB_KIND_CONFIG[kind].defaultOwnerRole`. `setJobOwner(id, role|null)` may change it any time; audited with holder names.

### 1.5 Holds (overlay, not a status)
| action | precondition | effect |
|---|---|---|
| `placeHold(id, type: parts\|outsource, reason*)` | no active hold · `simpleStatus === 'on_hand'` · status ∈ {approved, in_service, testing} (`canHold`) | push `JobHold {priorStatus = status, placedAt/By, station}`; status **unchanged**; `parts` → watch.status = awaiting_parts; audit |
| `releaseHold(id, note?)` | active hold exists | `releasedAt/By/releaseNote`; `status = priorStatus` (no-op by construction); watch.status re-synced via `WATCH_STATUS_FOR`; hold kept in history |
| `approvePartsRequest(…, placeHoldToo=true)` | `canHold(job)` | auto-places a `parts` hold with the part + PR number as reason |
While held: board shows job in **On hold** lane, floor map in **Holds (parked)**, `/today` shows a hold row to the owner role and to whoever placed it, `legalJobActions` = [].

### 1.6 simpleStatus (pack tri-state)
| event | simpleStatus |
|---|---|
| `createJob({onHand:false})` / `createJobFromEstimate` with no received package | estimate |
| `createJob({onHand:true})` / `createJobFromEstimate` with received package / `convertEstimateToIntake` | on_hand (+ `intakeDate = now`) |
| transition to closed | finished |
Shop Time, holds, pull-next, `isActiveJob` all require `on_hand`.

### 1.7 Entry points
| function | precondition | result |
|---|---|---|
| `createJob(input)` | clientId, watchId (must belong to client); number uniqueness check | status intake, timeline `[create]`, division = session, owner from kind |
| `createJobFromEstimate(estimateId)` | estimate.status === approved · no jobId · has watchId | job at intake carrying lines; workflow = received package workflow else line depts; `packageId` if received pkg; estimate → converted, jobId set |
| `convertEstimateToIntake(estimateId)` | estimate.status ∈ {sent, approved, converted} | if jobId: job must not be on_hand/finished → on_hand + intakeDate; else new on_hand job; estimate → converted |
| `deleteJob(id)` | actor tier manager | removes job, its shop time and tasks; clears estimate.jobId |

### 1.8 Money tail (derived `tailStage(job)`, only for ready_to_ship / closed)
`no SO → awaiting_invoice` · `SO not paid && not fulfilled → awaiting_payment` · `fulfilled|partial + ship → ready_to_ship` · `fulfilled|partial + pickup → ready_for_pickup` · `SO shipped → shipped` · `SO picked_up → picked_up` · `closed && no SO → null`.

## 2. Sales order (invoice)
`draft → open → (partial_fulfilled ⇄) fulfilled → shipped | picked_up` · `{draft, open, partial_fulfilled, fulfilled} → cancelled`

| action | from | to | guards | side effects | ✉ |
|---|---|---|---|---|---|
| `createSalesOrder` | — | draft (or open if `status:'open'`) | clientId required | totals | |
| `convertEstimateToSalesOrder` | — | draft | no non-cancelled SO for estimate | non-shipping lines → lines; shipping lines → shippingAmount; memo = clientNotes | |
| `invoiceJob(jobId)` | job ready_to_ship or closed | **open** | no non-cancelled SO for job | lines from job.lines | |
| `updateSalesOrder` | draft, open | same | | lines replaced (qty flags reset) | |
| `openSalesOrder` | draft | open | ≥1 line | | ✉ ready to pay |
| `recordPayment(amount, method, note?)` | not draft/cancelled | same | 0 < amount ≤ balanceDue | payment row; `isPaid/balanceDue` | ✉ paid / partial |
| `fulfillSalesOrder` | open, partial_fulfilled | fulfilled | ≥1 line | `fulfilledAt`; `qboInvoiceId = QBO-STUB-…`, `qboStatus = queued`; pickup code if channel pickup; job audit | ✉ invoice (+ code) |
| `setFulfillmentChannel(pickup\|ship)` | not cancelled/shipped/picked_up | same | | pickup → issue code if none; ship → clear tracking | ✉ code (pickup only) |
| `regeneratePickupCode` | any | same | | new code | ✉ new code |
| `requestShippingInfo` | any | same | | `shippingInfoRequestedAt` | ✉ where to ship |
| `setShippingAddress(address)` | any | same | name/street/city/state | | |
| `confirmShipment({carrier, declaredValue, photos, label, bypassReason?})` | open, partial_fulfilled, fulfilled | **shipped** | address set · photos ≥1 · paid OR bypassReason* | `shipment` record; `tracking`, `shipDate`, `channel=ship`; all `shippedQty = qty`; `fulfilledAt` if missing; **closeCustody** | ✉ shipped |
| `confirmPickup({code?, proxyName?, proxyIdPhoto?, photos, lineQty?, bypassReason?})` | open, partial_fulfilled, fulfilled | **picked_up** or partial_fulfilled | not (channel ship && address set) · code matches OR (proxyName && proxyIdPhoto) · photos ≥1 · paid OR bypassReason* | `pickupSession`; `pickedUpQty += lineQty ?? remaining`; code consumed; `channel=pickup`; fully → `pickedUpAt`, **closeCustody** | ✉ thank you / partial |
| `adminMarkComplete(pickup\|ship, note*)` | any non-terminal | picked_up / shipped | actor tier manager | synthetic session/tracking `ADMIN-MARKED`; **closeCustody**; audit `ADMIN MARK` | |
| `cancelSalesOrder(reason*)` | not shipped/picked_up | cancelled | | `cancelledAt` | |
`closeCustody(so)`: if `job.status === 'ready_to_ship'` → `pushTransition(close)`; job audit "Custody closed". Watch → released via §1.3.
Queues: pickup = status ∈ {open, partial_fulfilled, fulfilled} && channel ≠ ship; ship = same && channel === ship.

## 3. Estimate
`draft → sent → approved → converted` · `sent → declined → draft` · `sent → expired (seed only) → draft`
| action | from | to | guards / effects |
|---|---|---|---|
| `createEstimate` | — | draft | clientId; blank lines dropped; totals; message default "Thank you for your business." |
| `updateEstimate(patch)` | draft (not historical) | draft | in-place autosave |
| `reviseEstimate(patch)` | draft, sent (not historical) | same | snapshot pushed to `revisions[]`, `revision += 1` |
| `duplicateEstimate` | any | new draft | new number, rev 1, validUntil +30d |
| `deleteEstimate` | not converted · no package linked | — | |
| `markEstimateSent` | draft | sent | **no sentAt**, no email ("went out some other way") |
| `sendEstimate` | draft, sent | sent | ≥1 line; `sentAt`; ✉ estimate (or "Updated estimate") |
| `declineEstimate(reason*, via)` | sent | declined | `declinedAt, declineReason` |
| `approveEstimate(via)` | sent | approved | `approvedAt, approvedVia`; **provisional** status |
| `reopenEstimate` | declined, expired | draft | clears decline fields |
| `convertEstimate(id, 'job'\|'intake')` | see §1.7 | converted | `'sales_order'` **throws** — use `convertEstimateToSalesOrder` (does *not* change estimate status) |
No function sets `expired`; it exists only in seed. Portal approve additionally runs §1.1 `approve` on a linked job waiting on the customer.

## 4. Intake — 4-stage package flow
`arrived → processed → awaiting_inspection → received | discrepancy_hold`
| stage | function | guard | effects |
|---|---|---|---|
| 1 Arrival | `logArrival({source, trackingNumber?, carrier?, signatureNoted, clientId?})` | carrier source needs tracking; tracking unique | SUB#, `arrivedAt/By/Station`, carrier auto-detected (`detectCarrier`) or "Hand delivery" for walk-in; audit `intake` |
| 2 Receive Package | `receivePackage(id, {trackingNumber?, estimateId?, clientId?, contents, photos, notes?})` | status arrived; ≥1 content pill | processed; `clientId = estimate.clientId ?? input.clientId ?? existing`; photos; ✉ confirmation if client known |
| — | `printDropOffReceipt(id)` | | `receiptPrinted = true` (mock) |
| 3 Work Order | `recordWorkOrder(id, bin)` | status processed | awaiting_inspection; `bin`, `workOrderAt/By` |
| 4 Receive Watch | `receiveWatch(id, ReceiveWatchInput)` | status awaiting_inspection; linked estimate **with watch**; reference + serial (NS allowed); ≥1 workflow dept | `inspectedAt/By`, `workflow` stored; **watch.reference/serial overwritten** with the received values (serial only if ≠ NS); `discrepancies = computeDiscrepancies` → empty: `received`, 2 labels queued (pdf417 payload `E#\|SUB#\|ref\|serial\|W,B`, ref/serial label), watch.status = awaiting_approval · non-empty: `discrepancy_hold`, `discrepancyReason`, watch.status = intake |
`computeDiscrepancies` (pure): missing expected component (from `DEPT_COMPONENTS` of estimate line depts) · serial differs (unless NS) · reference differs · `extraWatch` · `sameWatchDecision === 'conflict'`.
Same-watch fork: `findWatchBySerial(ref, serial)` returns history only if the watch has jobs/packages or status ≠ expected; UI forces `sameWatchDecision: returning | conflict`.
No release-from-discrepancy function exists: discrepancy packages surface on `/today` (concierge role + flagging inspector, rolliworks only) and stay held. **Gap for KEEPER.**

## 5. Parts request
`draft → pending → approved | rejected`
| action | from | who | effects |
|---|---|---|---|
| `openPartsRequest(jobId)` | — | any | draft, PR number, assistant greeting |
| `partsChat(id, text)` | draft, pending | any | user msg + scripted reply (`partsAssistantReply`), `searchTerms += text` |
| `attachPart(id, partId, qty=1, note?)` | any | any | `partId, qty` |
| `submitPartsRequest(id, note?)` | draft with partId | any | pending; `requestedAt` reset; job audit |
| `approvePartsRequest(id, note?, placeHoldToo=true)` | pending with partId | **manager tier** | approved; `part.compatibleRefs += watch.reference`; `part.aliases += searchTerms (≥4 chars, normalized)`; knowledge `association_confirmed` + `alias_added` per term; parts hold if `canHold(job)` |
| `rejectPartsRequest(id, reason*)` | pending | **manager tier** | rejected; knowledge `rejected` (if partId) |

## 6. Service request
`new → quoted → closed` (staff) · `new → closed_by_client` (portal)
| action | from | who | effects |
|---|---|---|---|
| (create) | — | — | **no function**; seed only |
| (quote) | new → quoted | — | **no function**; `estimateId` set in seed only |
| `closeRequest(id, reason, note?, duplicateOfId?)` | new, quoted | staff | closed; `closedBy='staff'`; duplicate requires sibling request of same client; audit (type `estimate` — drift) |
| `portalCloseRequest(clientId, id, reason, duplicateOfId?)` | new only, own request | client | closed_by_client; replayed |
Never deleted.

## 7. Task · Pinned item
- Task: `open ⇄ done` via `setTaskDone(id, bool)`; `completedAt/By` set/cleared; audit `task`. Created by `createTask` (staff) or by `portalConfirmPickupWindow` (concierge role, division rolliworks).
- PinnedItem: `active → dismissed` via `dismissPinned`; never deleted; audit `pin`.

## 8. Watch status (projection)
`expected → intake → awaiting_approval → in_service → qc → awaiting_pickup → released`, plus `awaiting_parts` while a parts hold is active. Writers: `createWatch` (expected), `receiveWatch`, `pushTransition`, `placeHold/releaseHold`. Not written by `closeCustody` beyond the job close, nor by SO events. KEEPER: derive.

## 9. Custody (derived projection, Client 360)
`package_arrived → watch_received | discrepancy → (hold_placed → hold_released)* → shipped | picked_up`; each row links to its source record (package / job / SO). Not a table.

## 10. RolliConnect portal status (projection `portalStatusFor`, job-first)
| condition | key |
|---|---|
| SO shipped | on_its_way |
| SO picked_up | back_with_you |
| no job: estimate sent | awaiting_approval |
| no job: watch expected or estimate approved | expecting |
| no job otherwise | on_file |
| job.simpleStatus estimate | estimate approved ? expecting : awaiting_approval |
| intake, in_review | inspecting |
| awaiting_customer_approval | awaiting_approval |
| approved | hold ? (parts → awaiting_part · outsource → with_specialist) : queued |
| in_service | hold ? same : on_bench |
| testing | final_checks |
| ready_to_ship | SO fulfilled/partial ? (ship → preparing_ship · pickup → ready_pickup) : finishing |
| closed | back_with_you |

## 11. Message · MagicLink · Session
- Message: written once; `readByStaff` flips in `markThreadRead`/`replyToClient`; `readByClient` flips in `portalGetMessages`. Both flips are replayed.
- MagicLink: `created → usedAt` on redeem; **not** single-use, **no** expiry (body text says 15 min — untrue).
- Device: `unregistered → registered(stationId)` via `registerStation` (manager + password) · `resetDeviceRegistration` clears station + session. First load auto-registers as `st-01` (mock).
- Staff session: `signInWithPassword` (audit with photo) → `switchUserWithPin` only if that user has a `password_photo` sign-in **today** → `signOut`.

## 12. Tier / role enforcement summary
| enforced in client module | rule |
|---|---|
| `registerStation` | manager tier + own password |
| `deleteJob` | manager tier |
| `supervisorAssign` | manager tier |
| `approvePartsRequest`, `rejectPartsRequest` | manager tier |
| `adminMarkComplete` | manager tier |
| `pullNext` | role watchmaker or inspector |
| `saveInspectionReport` | kind must have `inspectionReport` |
| portal `requireOwner` | row.clientId === session client |
| UI-only (route tiers in `config/navigation.ts`) | Jobs, Supervisor, Parts Knowledge, Setup (+ unbuilt sections) = manager; everything else both tiers |
Division wall enforced only in `getToday` (rows/tasks/pins) and pickers (`getDivisionStaff/Roles`); **no** write is division-checked.
