# API-SURFACE — `frontend/src/api/client.ts`

The ONLY data-access module. Screens import `* as api from '@/api/client'` and call these. All async functions resolve after 120 ms simulated latency; writes mutate the in-memory `store` and audit-stamp via `appendAudit` (localStorage). "Stub" = deliberately throws / does nothing real. `*WithRefs` = row joined with client/watch(/estimate/pkg).

Re-exports: `export * from './types'`; constants `CONTENT_PILLS, CARRIERS, BINS, DEPT_LABEL, DEPT_COMPONENTS, JOB_FLOW, DEPT_OF_CODE, computeEstimateTotals, ESTIMATE_TAX_RATE_DISPLAY`.

## Station / device
| function | returns | notes |
|---|---|---|
| `getStation()` | `Station \| null` | first call on a fresh device mocks pre-registration as "Front Desk 1" |
| `getStations()` | `Station[]` | |
| `addStation(name)` | `Station` | dedupes by name |
| `registerStation(stationId, adminUserId, password)` | `Station` | manager + password; audit `station_registered` |
| `renameStation(name)` | `Station` | audit |
| `resetDeviceRegistration()` | `void` | clears station + session |

## Audit / auth
| function | returns | notes |
|---|---|---|
| `getAuditLog()` | `AuditEvent[]` | newest first, cap 60 |
| `getUsers()` | `User[]` | |
| `getCurrentUser()` | `User \| null` | localStorage session |
| `hasSignedInToday(userId)` / `getUsersSignedInToday()` | `boolean` / `User[]` | derived from audit log |
| `signInWithPassword(userId, password, photo)` | `User` | throws on bad password (audited) |
| `switchUserWithPin(userId, pin)` | `User` | requires prior password sign-in today |
| `signOut()` | `void` | |

## Clients / watches
| function | returns | notes |
|---|---|---|
| `getClients()` / `getClient(id)` | `Client[]` / `Client \| null` | |
| `searchClients(q)` | `Client[]` (≤8) | name, email, company, phone digits |
| `getWatches()` / `getWatchesForClient(clientId)` | `Watch[]` | |
| `createClient(NewClientInput)` | `Client` | |
| `createWatch(clientId, NewWatchInput)` | `Watch` | status `expected` |

## Estimates
| function | returns | notes |
|---|---|---|
| `getEstimates()` / `getEstimate(id)` / `getEstimatesForClient(clientId)` | `EstimateWithRefs` rows | |
| `searchEstimates(q, status?)` | `EstimateWithRefs[]` | number digits / name / email |
| `lookupEstimate(numberOrId)` | `EstimateWithRefs \| null` | scan-friendly (strips E/EST/zeros) |
| `getServiceCatalog()` | `CatalogService[]` | |
| `getQuoteContext(clientId, watchId?, excludeId?)` | `QuoteContext` | |
| `createEstimate(EstimateInput)` | `EstimateWithRefs` | draft |
| `updateEstimate(id, EstimatePatch)` | `EstimateWithRefs` | draft only (autosave) |
| `reviseEstimate(id, patch)` | `EstimateWithRefs` | rev N+1, snapshot |
| `duplicateEstimate(id)` | `EstimateWithRefs` | new draft |
| `deleteEstimate(id)` | `void` | blocked if converted / package linked |
| `markEstimateSent(id)` / `sendEstimate(id)` | `EstimateWithRefs` / `{estimate, email}` | send queues Outbox |
| `declineEstimate(id, reason)` / `approveEstimate(id)` / `reopenEstimate(id)` | `EstimateWithRefs` | approve is provisional |
| `convertEstimate(id, 'job'\|'intake'\|'sales_order')` | `JobWithRefs` | `job`→createJobFromEstimate, `intake`→convertEstimateToIntake, **`sales_order` STUB (throws)** |
| `calcShipping(ShippingCalcInput)` | `{amount, overnight, insuredValue}` | sync, display-only |

## Intake
| function | returns | notes |
|---|---|---|
| `detectCarrier(tracking)` | `Carrier` | sync |
| `getPackages(status?)` / `getPackage(id)` / `getIntakeCounts()` | | |
| `logArrival(ArrivalInput)` | `PackageWithRefs` | stage 1 |
| `receivePackage(id, ReceivePackageInput)` | `{pkg, email}` | stage 2, Outbox email if client known |
| `printDropOffReceipt(id)` | `PackageWithRefs` | mock print flag |
| `recordWorkOrder(id, bin)` | `PackageWithRefs` | stage 3 |
| `findPackageForInspection(estimateNumber)` | `PackageWithRefs \| null` | scan → stage 4 |
| `getInspectionContext(packageId)` | `InspectionContext` | expected components, suggested workflow |
| `findWatchBySerial(ref, serial)` | `WatchMatch \| null` | same-watch fork; includes job history |
| `computeDiscrepancies(ctx, input)` | `string[]` | sync, pure |
| `receiveWatch(packageId, ReceiveWatchInput)` | `ReceiveWatchResult` | received + labels, or discrepancy_hold |
| `getOutbox()` | `OutboxEmail[]` | never sends |
| `getLabelQueue()` / `setLabelPrinted(id, bool)` | `LabelJob[]` / `LabelJob` | mock print |

## Jobs (E4)
| function | returns | notes |
|---|---|---|
| `getJobs()` / `getJob(id)` / `getJobsForClient(clientId)` | `JobWithRefs` rows (client, watch, estimate, pkg) | |
| `searchJobs(q)` | `JobWithRefs[]` | number, client, ref, serial, model, assignee, owner |
| `legalJobActions(job)` | `JobAction[]` | sync; empty while held; applies per-kind skipStages |
| `activeHold(job)` / `canHold(job)` | `JobHold \| undefined` / `boolean` | sync |
| `JOB_KIND_CONFIG` | const | `{label, defaultOwnerRole, skipStages, inspectionReport, inspectionPhotos}` per kind |
| `INSPECTION_QUESTIONS` | const | multiple-choice form rows (key, label, options) |
| `reviewGaps(job)` | `string[]` | sync; what blocks leaving in_review (photos every kind; report if kind requires) |
| `saveInspectionReport(id, answers)` | `JobWithRefs` | service kind only; every question required |
| `ROLES` / `roleHolders(role)` | `Role[]` / `User[]` | sync |
| `transitionJob(id, actionKey, reason?)` | `JobWithRefs` | validates legality; queues email if action notifies |
| `setJobOwner(id, role \| null)` | `JobWithRefs` | owner = role |
| `toggleAssignee(id, shortName)` | `JobWithRefs` | add/remove working tech |
| `placeHold(id, type, reason)` / `releaseHold(id, note?)` | `JobWithRefs` | |
| `addJobNote(id, text)` / `addJobPhotos(id, photos)` | `JobWithRefs` | |
| `updateJobFields(id, {priority?, dueAt?, conditionNotes?, intakeNotes?})` | `JobWithRefs` | |
| `createJob(CreateJobInput)` | `JobWithRefs` | status intake; owner from kind config; existence check on number |
| `createJobFromEstimate(estimateId)` | `JobWithRefs` | approved only; marks estimate converted |
| `convertEstimateToIntake(estimateId)` | `JobWithRefs` | existing job → on_hand, else insert |
| `deleteJob(id)` | `void` | manager only (can-delete-jobs); cascades shop time + tasks, unlinks estimate |
| `invoiceJob(id)` | `never` | **STUB — throws** "Invoicing arrives in E5" (audited) |
| `getShopTime(jobId?)` / `getOnHandJobs()` | `ShopTimeEntry[]` / `JobWithRefs[]` | |
| `addShopTime(jobId, minutes, note)` | `ShopTimeEntry` | on_hand only; never changes status |

## Sales orders / fulfil / pickup / ship (E5)
| function | returns | notes |
|---|---|---|
| `getSalesOrders()` / `getSalesOrder(id)` / `getSalesOrderForJob(jobId)` | `SalesOrderWithRefs` (client, job, watch) | |
| `findSalesOrders(q)` | `SalesOrderWithRefs[]` | SO #, estimate #, job #, name, pickup code |
| `SO_BADGE(order)` / `tailStage(job)` | `'picked_up'\|'shipped'\|'paid'\|'unpaid'` / `TailStage \| null` | sync read models |
| `createSalesOrder(input)` / `updateSalesOrder(id, patch)` | `SalesOrderWithRefs` | customer required; edit draft/open only |
| `convertEstimateToSalesOrder(estimateId)` | `SalesOrderWithRefs` | draft; shipping lines → shippingAmount |
| `invoiceJob(jobId)` | `SalesOrderWithRefs` | **now real**: open SO from a ready_to_ship job's lines |
| `openSalesOrder` / `cancelSalesOrder(id, reason)` / `fulfillSalesOrder(id)` | `SalesOrderWithRefs` | fulfil = QBO **STUB** (queued state only) |
| `recordPayment(id, amount, method, note?)` | `SalesOrderWithRefs` | stub ledger, partial ok |
| `setFulfillmentChannel(id, 'pickup'\|'ship')` / `regeneratePickupCode(id)` | `SalesOrderWithRefs` | |
| `requestShippingInfo(id)` / `setShippingAddress(id, address)` | `SalesOrderWithRefs` | Outbox / address |
| `shippingProvider.createShipment({carrier, declaredValue, address, reference})` | `MockShipment {labelId, tracking, service, coverage, labelDataUrl}` | **the seam** a real carrier replaces; `SHIP_CARRIERS`, `normalizeDeclaredValue` |
| `confirmShipment(id, {carrier, declaredValue, photos, label, bypassReason?})` | `SalesOrderWithRefs` | shipped + custody closed |
| `confirmPickup(id, {code?, proxyName?, proxyIdPhoto?, photos, lineQty?, bypassReason?})` | `SalesOrderWithRefs` | picked_up / partial + custody closed |
| `adminMarkComplete(id, 'pickup'\|'ship', note)` | `SalesOrderWithRefs` | manager only, audited |
| `getPickupQueue()` / `getShipQueue()` | `SalesOrderWithRefs[]` | station queues |

## Workshop lenses + parts (E6)
| function | returns | notes |
|---|---|---|
| `getBenchView(userId?)` | `BenchView {jobs(+nextAction, blocked), holds, pullNext, partsRequests}` | derived for the signed-in user |
| `pullNextCandidate(me)` / `pullNext()` | `Job \| null` / `JobWithRefs` | self-assign, audited |
| `getSupervisorBoard()` | `SupervisorBoard {unassigned, byTech, partsQueue, holds, qcQueue}` | |
| `supervisorAssign(jobId, shortNames[])` | `JobWithRefs` | manager; overwrites assignees, audited |
| `getShopFloorMap()` | `FloorMap {lanes[]}` | 9 lanes incl. case_cleaning |
| `getParts()` / `partsById(id)` / `getPartsKnowledge()` | | catalog + knowledge log |
| `getPartsRequests()` / `getPartsRequest(id)` / `getPartsRequestsForJob(jobId)` | `PartsRequestWithRefs` | |
| `openPartsRequest(jobId)` / `partsChat(id, text)` / `attachPart(id, partId, qty?)` / `submitPartsRequest(id, note?)` | `PartsRequestWithRefs` | |
| `partsAssistantReply(query, job)` | `{text, suggestions}` | sync, **scripted** — no AI |
| `approvePartsRequest(id, note?)` / `rejectPartsRequest(id, reason)` | `PartsRequestWithRefs` | manager; labeling loop |

## Tasks + Today
| function | returns | notes |
|---|---|---|
| `getTasks()` / `getTasksForJob(jobId)` / `getTasksForClient(clientId)` | `Task[]` | |
| `createTask({title, assignedTo, jobId?, dueAt?})` | `Task` | links watch/client from job; stamps job audit |
| `setTaskDone(id, done)` | `Task` | |
| `assigneeLabel(Assignee)` | `string` | sync; role → holders |
| `getToday(userId?)` | `TodayView {pinned, rows, waitingOn}` | rows derived (no curation); pinned = manual layer for me / my roles |
| `parsePin(raw, fallback)` | `{title, assignedTo}` | sync; `#vienna …` / `#manager …` prefix → assignee |
| `pinToHitList({title, assignedTo?, jobId?, taskId?})` | `PinnedItem` | audit type `pin`; job-linked pins also stamp the job |
| `dismissPinned(id)` | `PinnedItem` | done = dismissed, kept |

## Dashboard / activity
| function | returns | notes |
|---|---|---|
| `getDashboardStats()` | `DashboardStats` | inProgress = approved+in_service+testing; awaitingPickup = ready_to_ship; revenue = closed this month |
| `getRecentActivity(limit)` | `ActivityEvent[]` | static fixture |

## Client 360 (E7)
| function | returns | notes |
|---|---|---|
| `resolveIdentifier(q)` | `SearchResults {query, groups[], total}` | ANY identifier → grouped `SearchHit[]` (client · watch · estimate · job · sales_order · package · request), ≤6 per group; `hit.path` = `/clients/:id?hit=<hitKey>` or the record path when no client |
| `getClient360(clientId)` | `Client360 \| null` | read model: summary, `watches: WatchGroup[]` (per-watch merged history newest first), requests, estimates (with `revisions[]`), jobs, salesOrders, payments (flattened), notes (job notes + estimate internal notes), tasks (client-linked or via jobs), custody (derived), emails (Outbox to client.email), packages |
| `getClientDirectory()` | `ClientDirectoryRow[]` | `/clients` list: watch counts, open estimates, active jobs, balance, last activity |
| `getRequests()` / `getRequestsForClient(clientId)` | `ServiceRequest[]` | read-only in E7 (no create/close yet) |

## RolliConnect — client portal (E8)
| function | returns | notes |
|---|---|---|
| `portalRequestMagicLink(email)` | `{link, path}` | stub: Outbox email + on-screen link `/rc/auth/:token`; links persisted (`rollisuite.rc.magicLinks`) |
| `portalRedeemMagicLink(token)` / `portalGetSession()` / `portalSignOut()` | `Client` / `{session, client} \| null` / void | session key `rollisuite.rc.session` |
| `portalGetHome(clientId)` | `PortalHome {client, needsYou[], watches: PortalWatch[], unreadMessages}` | needs-you kinds: approve_estimate · pay_balance · confirm_pickup · shipping_info · staff_reply |
| `portalGetWatch(clientId, watchId)` | `PortalWatch {status, job?, openEstimate?, invoice?, eta?, history[], documents[]}` | owner-checked; drafts hidden |
| `portalGetEstimate` / `portalApproveEstimate` / `portalDeclineEstimate(.., reason)` | `EstimateWithRefs` | via `approveEstimate(id,'portal')`; approve also `transitionJob(job,'approve')` when the linked job waits on the customer |
| `portalGetInvoice` / `portalPayBalance` | `SalesOrderWithRefs` | pay = full balance, card, stub note |
| `portalConfirmPickupWindow(clientId, soId, date, slot, note?)` | `SalesOrderWithRefs` | sets `pickupWindow`, creates concierge task |
| `portalSubmitShippingInfo(clientId, soId, address, phone)` | `SalesOrderWithRefs` | via `setShippingAddress`; phone appended to memo |
| `portalCloseRequest(clientId, requestId, reason, duplicateOfId?)` | `PortalRequest` | only `new` requests; duplicate needs a sibling request |
| `closeRequest(id, reason, note?, duplicateOfId?)` | `ServiceRequest` | staff; any open status; never deletes |
| `REQUEST_CLOSE_REASONS` | lookup | duplicate · no_longer_needed · mistake |
| `portalGetMessages(clientId)` / `portalSendMessage(clientId, text, watchId?)` | `Message[]` / `Message` | reading marks staff replies read |
| `getStaffInbox()` / `getStaffInboxUnread()` / `markThreadRead(clientId)` / `replyToClient(clientId, text, watchId?)` | threads / number / void / `Message` | staff side; reply queues Outbox email |
| `PORTAL_STATUS` | lookup | 14 plain-language statuses (label, blurb, active) |
| `replayRcEvents()` / `resetRcEvents()` | number / void | portal write log persisted in `rollisuite.rc.events`, replayed at module load |

## Stubs / not wired (explicit)
- `convertEstimate(id,'sales_order')` — throws (use `convertEstimateToSalesOrder`).
- QBO push — state only (`qboStatus`, fake id). Payments — ledger only. Carrier — `shippingProvider` mock.
- Estimates list "Convert to invoice" menu row — display-only.
- Email sending, label printing, receipt printing — mocked flags / Outbox only.
- RolliConnect: magic link (no email, no expiry), payment (ledger only), messages (no push). Nothing external.
- No HTTP, no `fetch`; repoint this file to the real API when it exists.
