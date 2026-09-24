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
| `JOB_KIND_CONFIG` | const | `{label, defaultOwnerRole, skipStages}` per kind |
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

## Tasks + Today
| function | returns | notes |
|---|---|---|
| `getTasks()` / `getTasksForJob(jobId)` / `getTasksForClient(clientId)` | `Task[]` | |
| `createTask({title, assignedTo, jobId?, dueAt?})` | `Task` | links watch/client from job; stamps job audit |
| `setTaskDone(id, done)` | `Task` | |
| `assigneeLabel(Assignee)` | `string` | sync; role → holders |
| `getToday(userId?)` | `TodayView {rows, waitingOn}` | derived, no manual curation (see STATE-MACHINES / DESIGN-PRINCIPLES) |

## Dashboard / activity
| function | returns | notes |
|---|---|---|
| `getDashboardStats()` | `DashboardStats` | inProgress = approved+in_service+testing; awaitingPickup = ready_to_ship; revenue = closed this month |
| `getRecentActivity(limit)` | `ActivityEvent[]` | static fixture |

## Stubs / not wired (explicit)
- `convertEstimate(id,'sales_order')` — throws.
- `invoiceJob(id)` — throws (E5).
- Estimates list "Convert to invoice" menu row — display-only.
- Email sending, label printing, receipt printing — mocked flags / Outbox only.
- No HTTP, no `fetch`; repoint this file to the real API when it exists.
