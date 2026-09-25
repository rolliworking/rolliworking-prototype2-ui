# API-SURFACE — `frontend/src/api/client.ts` (the contract KEEPER implements)

Rules: this is the ONLY data-access module; screens `import * as api from '@/api/client'`. Every `async` function resolves after 120 ms fake latency and **throws `Error(message)`** on guard failure (messages are user-facing; keep them). Writes mutate the in-memory `store`, audit via `appendAudit`, and return the fresh row (usually `*WithRefs`). Sync exports are pure helpers or lookup constants the UI reads. Re-export: `export * from './types'`.

Actor resolution (`actor()`): `{by: user.shortName | 'Unknown', station: station.name | 'Unregistered device'}`; while a portal call runs inside `asClient()`, `by = "<First Last> (client)"`, `station = 'RolliConnect'`.

Legend: **STUB** = deliberately fake / throws · **sync** = not a Promise · `WithRefs` joins per DATA-MODEL §10.

## 1. Station / device / division
| export | signature | returns | side effects / notes |
|---|---|---|---|
| `getSessionDivision` sync | `() => Division` | station.division ?? 'rolliworks' | |
| `getDivisionStaff` sync | `(div) => User[]` | users with `division === div \|\| 'both'` | |
| `getDivisionRoles` sync | `(div) => Role[]` | roles with ≥1 holder in div | |
| `getStation` | `() => Station \| null` | | first call on a fresh device auto-registers `st-01` and audits `station_registered` (mock) |
| `getStations` | `() => Station[]` | | backfills `division='rolliworks'` on legacy saved rows |
| `addStation` | `(name, division='rolliworks') => Station` | existing row if name matches (case-insensitive) | persists list |
| `registerStation` | `(stationId, adminUserId, password) => Station` | | throws unless manager tier + correct password; audit |
| `renameStation` | `(name) => Station` | | audit `station_renamed` |
| `resetDeviceRegistration` | `() => void` | | clears station + current user; audit `station_reset` |

## 2. Audit / auth
| export | signature | returns | notes |
|---|---|---|---|
| `getAuditLog` | `() => AuditEvent[]` | newest first, ≤60 | |
| `getUsers` | `() => User[]` | | includes password/pin (prototype) |
| `getCurrentUser` | `() => User \| null` | | localStorage session |
| `hasSignedInToday` | `(userId) => boolean` | | a `sign_in` + `password_photo` audit row today |
| `getUsersSignedInToday` | `() => User[]` | | |
| `signInWithPassword` | `(userId, password, photo: VerificationPhoto) => User` | | wrong password → audit `sign_in_failed` + throw "Incorrect password"; success audits with camera status + photo |
| `switchUserWithPin` | `(userId, pin) => User` | | throws if no password sign-in today; wrong PIN audited |
| `signOut` | `() => void` | | audit |

## 3. Clients / watches
| export | signature | returns | notes |
|---|---|---|---|
| `getClients` / `getClient(id)` | | `Client[]` / `Client \| null` | |
| `searchClients` | `(q) => Client[]` ≤8 | | name / email / company substring; phone digits (≥3) |
| `getWatches` / `getWatchesForClient(clientId)` | | `Watch[]` | |
| `createClient` | `(NewClientInput {firstName, lastName, email, phone}) => Client` | | blank address, type retail; **not audited** |
| `createWatch` | `(clientId, NewWatchInput {brand, model, reference, serial, partNumber?}) => Watch` | | status expected; ref uppercased, serial default `NS`; **not audited** |

## 4. Estimates
| export | signature | returns | notes |
|---|---|---|---|
| `getEstimates` | `() => EstimateWithRefs[]` | newest createdAt first | |
| `getEstimate(id)` / `getEstimatesForClient(clientId)` | | `EstimateWithRefs \| null` / `[]` | |
| `searchEstimates` | `(q, status?: EstimateStatus \| 'all') => EstimateWithRefs[]` | | number digits prefix / client name / email |
| `lookupEstimate` | `(numberOrId) => EstimateWithRefs \| null` | | scan-friendly: strips `EST-`, `E`, leading zeros |
| `getServiceCatalog` | `() => CatalogService[]` | | |
| `getQuoteContext` | `(clientId, watchId?, excludeId?) => QuoteContext {clientEstimates, watchEstimates}` | | |
| `createEstimate` | `(EstimateInput) => EstimateWithRefs` | draft | audit `estimate` |
| `updateEstimate` | `(id, EstimatePatch) => EstimateWithRefs` | | draft only; **not audited** (autosave) |
| `reviseEstimate` | `(id, EstimatePatch) => EstimateWithRefs` | | draft/sent; snapshot; audit |
| `duplicateEstimate` | `(id) => EstimateWithRefs` | new draft | audit |
| `deleteEstimate` | `(id) => void` | | throws if converted or package-linked; audit |
| `markEstimateSent` | `(id) => EstimateWithRefs` | sent, no sentAt | audit |
| `sendEstimate` | `(id) => {estimate, email: OutboxEmail}` | sent + sentAt | Outbox email with line list |
| `declineEstimate` | `(id, reason, via='staff') => EstimateWithRefs` | declined | |
| `approveEstimate` | `(id, via='staff') => EstimateWithRefs` | approved (provisional) | |
| `reopenEstimate` | `(id) => EstimateWithRefs` | draft | |
| `convertEstimate` | `(id, 'job' \| 'intake' \| 'sales_order') => JobWithRefs` | | `job` → `createJobFromEstimate`; `intake` → `convertEstimateToIntake`; **`sales_order` STUB → throws** "Use convertEstimateToSalesOrder for sales orders" |
| `calcShipping` sync | `(ShippingCalcInput {units, hiAk, saturday}) => {amount, overnight, insuredValue}` | | display only, never persisted |
| `computeEstimateTotals` sync | `(lines) => {subtotal, shippingAmount, taxAmount, total}` | | re-export of `totalsFor` |
| `ESTIMATE_TAX_RATE_DISPLAY` | `0.0825` | | shown "not applied" |
Types exported: `NewClientInput, NewWatchInput, EstimateInput, EstimatePatch = Partial<Omit<EstimateInput,'clientId'>>, ShippingCalcInput`.

## 5. Intake
| export | signature | returns | notes |
|---|---|---|---|
| `CONTENT_PILLS, CARRIERS, BINS, DEPT_LABEL, DEPT_COMPONENTS` | lookups | | re-exported from fixtures |
| `detectCarrier` sync | `(tracking) => Carrier` | | `1Z…`→UPS · `9[2-5]\d{18,20}`→USPS · 12/15 digits→FedEx · 10 digits→DHL · else FedEx |
| `getPackages` | `(status?) => PackageWithRefs[]` | newest arrival first | |
| `getPackage(id)` | | `PackageWithRefs \| null` | |
| `getIntakeCounts` | `() => Record<PackageStatus, number>` | | lane counts |
| `logArrival` | `(ArrivalInput {source, trackingNumber?, carrier?, signatureNoted, clientId?}) => PackageWithRefs` | arrived | throws: carrier without tracking; duplicate tracking |
| `receivePackage` | `(id, ReceivePackageInput {trackingNumber?, estimateId?, clientId?, contents, photos, notes?}) => {pkg, email \| null}` | processed | email only if client resolvable |
| `printDropOffReceipt` | `(id) => PackageWithRefs` | | mock flag + audit |
| `recordWorkOrder` | `(id, bin: Bin) => PackageWithRefs` | awaiting_inspection | |
| `findPackageForInspection` | `(estimateNumber) => PackageWithRefs \| null` | | package with that estimate at awaiting_inspection |
| `getInspectionContext` | `(packageId) => InspectionContext` | | throws if package lacks estimate+watch |
| `findWatchBySerial` | `(reference, serial) => WatchMatch \| null` | | null for NS or history-less expected watches |
| `computeDiscrepancies` sync | `(ctx, ReceiveWatchInput) => string[]` | | pure |
| `receiveWatch` | `(packageId, ReceiveWatchInput) => ReceiveWatchResult {pkg, discrepancies, labels}` | received / discrepancy_hold | see STATE-MACHINES §4 |
| `getOutbox` | `() => OutboxEmail[]` | | never sends |
| `getLabelQueue` / `setLabelPrinted(id, printed)` | | `LabelJob[]` / `LabelJob` | mock print, audited |

## 6. Jobs
| export | signature | returns | notes |
|---|---|---|---|
| `JOB_FLOW`, `DEPT_OF_CODE` | lookups | | |
| `JOB_KIND_CONFIG` | `Record<JobKind, {label, defaultOwnerRole, skipStages, inspectionReport, inspectionPhotos}>` | | per-kind table |
| `INSPECTION_QUESTIONS` | `{key, label, options[]}[]` | 5 rows | placeholder set |
| `ROLES` | `Role[]` | | |
| `roleHolders` sync | `(role) => User[]` | | |
| `activeHold` sync | `(job) => JobHold \| undefined` | | |
| `canHold` sync | `(job) => boolean` | | |
| `legalJobActions` sync | `(job) => JobAction[]` | `JobAction {key, label, to, needsReason?, notifies?, tone?, provisional?}` | [] while held; per-kind redirect |
| `reviewGaps` sync | `(job) => string[]` | | empty unless in_review |
| `getJobs` | `() => JobWithRefs[]` | newest first | |
| `getJob(id)` / `getJobsForClient(clientId)` | | | |
| `searchJobs` | `(q) => JobWithRefs[]` | | number / client / ref / serial / model / assignee / owner |
| `transitionJob` | `(id, actionKey, reason?) => JobWithRefs` | | full guard chain; ✉ when `notifies` |
| `saveInspectionReport` | `(id, answers: Record<key, option>) => JobWithRefs` | | throws for kinds without report; all questions required |
| `setJobOwner` | `(id, role \| null) => JobWithRefs` | | |
| `toggleAssignee` | `(id, shortName) => JobWithRefs` | | must be a staff shortName |
| `placeHold` | `(id, type: HoldType, reason) => JobWithRefs` | | |
| `releaseHold` | `(id, note?) => JobWithRefs` | | |
| `addJobNote` | `(id, text) => JobWithRefs` | | |
| `addJobPhotos` | `(id, photos: PackagePhoto[]) => JobWithRefs` | | stamps each photo |
| `updateJobFields` | `(id, JobFieldsPatch {priority?, dueAt?: string \| null, conditionNotes?, intakeNotes?}) => JobWithRefs` | | audits only changed fields |
| `createJob` | `(CreateJobInput {clientId, watchId, estimateId?, kind?, priority?, dueAt?, assignees?, conditionNotes?, intakeNotes?, onHand, workflow?, lines?}) => JobWithRefs` | intake | number from `counters.job`; existence check |
| `createJobFromEstimate` | `(estimateId) => JobWithRefs` | | approved estimates only |
| `convertEstimateToIntake` | `(estimateId) => JobWithRefs` | | |
| `deleteJob` | `(id) => void` | | manager tier; cascades shop time + tasks; unlinks estimate |
| `invoiceJob` | `(id) => SalesOrderWithRefs` | **open SO** | job must be ready_to_ship/closed and have no live SO. (Earlier doc said STUB — **drift: it is real since E5**) |
| `getShopTime` | `(jobId?) => ShopTimeEntry[]` | newest first | |
| `getOnHandJobs` | `() => JobWithRefs[]` | | simpleStatus on_hand |
| `addShopTime` | `(jobId, minutes, note) => ShopTimeEntry` | | on_hand only; minutes > 0; never changes status |
Types exported: `JobAction, JobFieldsPatch, CreateJobInput`.

## 7. Tasks / Today / Pins
| export | signature | returns | notes |
|---|---|---|---|
| `assigneeLabel` sync | `(Assignee) => string` | `"MM"` or `"concierge role → Vienna"` | |
| `getTasks` | `() => Task[]` | open first, then by dueAt | not division-filtered |
| `getTasksForJob(jobId)` / `getTasksForClient(clientId)` | | `Task[]` | |
| `createTask` | `(TaskInput {title, assignedTo, jobId?, dueAt?}) => Task` | | division = session; copies watch/client from job; audits task + job |
| `setTaskDone` | `(id, done) => Task` | | |
| `parsePin` sync | `(raw, fallback: Assignee) => {title, assignedTo}` | | `^[#@](\w+)\s+` → user by shortName/firstName, else role, else fallback; prefix stays in title |
| `pinToHitList` | `(PinInput {title, assignedTo?, jobId?, taskId?, clientId?, estimateId?}) => PinnedItem` | | mention in title **overrides** explicit `assignedTo`; division = session; audit `pin`; job audit if linked |
| `dismissPinned` | `(id) => PinnedItem` | | |
| `getToday` | `(userId?) => TodayView {pinned, rows, waitingOn}` | | **division-scoped** to the session station; rows: owner actions (`intake`, `awaiting_customer_approval`, `ready_to_ship` for jobs whose owner role ∈ my roles), bench (`approved/in_service/testing` where I'm an assignee), holds (owner or placer), discrepancy packages (concierge role or flagging inspector; rolliworks only), open tasks to me/my roles; sort overdue → urgent → dueAt; `waitingOn` = my open tasks assigned to others; `pinned` = active pins to me/my roles |

## 8. Dashboard / activity
| export | signature | notes |
|---|---|---|
| `getDashboardStats` | `() => DashboardStats` | inHouse = watches not released/expected; openEstimates = draft+sent; awaitingApproval = sent; inProgress = approved+in_service+testing; awaitingPickup = ready_to_ship; revenue = Σ total of jobs finished this month; per-department P&L |
| `getRecentActivity` | `(limit=10) => ActivityEvent[]` | **static fixture**, not derived |

## 9. Sales orders / pickup / ship
| export | signature | returns | notes |
|---|---|---|---|
| `SO_BADGE` sync | `(so) => 'picked_up' \| 'shipped' \| 'paid' \| 'unpaid'` | | |
| `tailStage` sync | `(job) => TailStage \| null` | | |
| `getSalesOrders` | `() => SalesOrderWithRefs[]` | newest orderDate first | |
| `getSalesOrder(id)` / `getSalesOrderForJob(jobId)` | | `\| null` | job lookup ignores cancelled |
| `findSalesOrders` | `(q) => SalesOrderWithRefs[]` | | SO #, digits suffix, client, job #, estimate #, pickup code prefix (≥3) |
| `createSalesOrder` | `(SalesOrderInput {clientId, jobId?, estimateId?, lines: SOLineInput[], shippingAmount?, memo?, channel?, status?: 'draft' \| 'open'}) => SalesOrderWithRefs` | | |
| `convertEstimateToSalesOrder` | `(estimateId) => SalesOrderWithRefs` | draft | does not change estimate status |
| `updateSalesOrder` | `(id, SalesOrderPatch {lines?, shippingAmount?, memo?, channel?}) => SalesOrderWithRefs` | | draft/open only |
| `openSalesOrder` / `cancelSalesOrder(id, reason)` / `fulfillSalesOrder(id)` | | | fulfil = **QBO STUB** (`qboInvoiceId`, `qboStatus: queued`) |
| `recordPayment` | `(id, amount, method: PaymentMethod, note?) => SalesOrderWithRefs` | | **STUB ledger**; partial allowed |
| `setFulfillmentChannel` | `(id, 'pickup' \| 'ship') => SalesOrderWithRefs` | | |
| `regeneratePickupCode` / `requestShippingInfo` / `setShippingAddress(id, Address)` | | | |
| `SHIP_CARRIERS` | `ShipCarrier[]` | | |
| `normalizeDeclaredValue` sync | `(n) => n` | `0<n<1000 → n×1000` | pack rule |
| `shippingProvider.createShipment` | `(CreateShipmentInput {carrier, declaredValue, address, reference}) => MockShipment {labelId, tracking, service, coverage, labelDataUrl}` | | **STUB carrier seam** — SVG label, fake tracking; the one object a real carrier replaces |
| `confirmShipment` | `(id, ConfirmShipmentInput {carrier, declaredValue, photos, label: MockShipment, bypassReason?}) => SalesOrderWithRefs` | shipped | closes custody |
| `confirmPickup` | `(id, ConfirmPickupInput {code?, proxyName?, proxyIdPhoto?, photos, lineQty?, bypassReason?}) => SalesOrderWithRefs` | picked_up / partial | closes custody when complete |
| `adminMarkComplete` | `(id, 'pickup' \| 'ship', note) => SalesOrderWithRefs` | | manager tier |
| `getPickupQueue` / `getShipQueue` | `() => SalesOrderWithRefs[]` | | |
Types exported: `SOLineInput, SalesOrderInput, SalesOrderPatch, CreateShipmentInput, MockShipment, ConfirmShipmentInput, ConfirmPickupInput`.

## 10. Workshop lenses / parts
| export | signature | returns | notes |
|---|---|---|---|
| `pullNextCandidate` sync | `(me: shortName) => Job \| null` | | approved · on_hand · no hold · unassigned; priority then oldest |
| `getBenchView` | `(userId?) => BenchView {jobs(+nextAction, blocked), holds, pullNext, partsRequests}` | | pullNext only for watchmaker/inspector roles; partsRequests = mine, non-draft |
| `pullNext` | `() => JobWithRefs` | | bench roles only; self-assign; audit (does **not** start service) |
| `getSupervisorBoard` | `() => SupervisorBoard {unassigned, byTech, partsQueue, holds, qcQueue}` | | techs = watchmaker/inspector users |
| `supervisorAssign` | `(jobId, shortNames[]) => JobWithRefs` | | manager tier; **overwrites** assignees |
| `getShopFloorMap` | `() => FloorMap {lanes[9]}` | | open jobs + closed within 14 days; `case_cleaning` = in_service with P/PM-only workflow (provisional) |
| `getParts` / `partsById(id)` sync / `getPartsKnowledge` | | `Part[]` / `Part \| undefined` / `PartsKnowledgeEntry[]` | |
| `getPartsRequests` / `getPartsRequest(id)` / `getPartsRequestsForJob(jobId)` | | `PartsRequestWithRefs` | |
| `openPartsRequest` | `(jobId) => PartsRequestWithRefs` | draft | |
| `partsAssistantReply` sync | `(query, job) => {text, suggestions: {partId, reason}[]}` | | **SCRIPTED** scorer: ref +5, caliber +5, alias +4, word ×2, fits job ref +1; threshold 4; top 4 |
| `partsChat` | `(requestId, text) => PartsRequestWithRefs` | | |
| `attachPart` | `(requestId, partId, qty=1, note?) => PartsRequestWithRefs` | | |
| `submitPartsRequest` | `(requestId, note?) => PartsRequestWithRefs` | pending | |
| `approvePartsRequest` | `(requestId, note?, placeHoldToo=true) => PartsRequestWithRefs` | approved | manager tier; learning loop; auto parts hold |
| `rejectPartsRequest` | `(requestId, reason) => PartsRequestWithRefs` | rejected | manager tier |

## 11. Client 360 / search / requests
| export | signature | returns | notes |
|---|---|---|---|
| `resolveIdentifier` | `(q) => SearchResults {query, groups: SearchGroup[], total}` | | clients (any length), watches/SO/packages/requests (≥3 chars), estimates/jobs (≥2); ≤6 hits per group; `hit.path` = `/clients/:id?hit=<key>` or record route when no client |
| `getClient360` | `(clientId) => Client360 \| null` | | full bundle; notes = job notes + estimate internalNotes; custody derived |
| `getClientDirectory` | `() => ClientDirectoryRow[]` | by last activity | |
| `getRequests` / `getRequestsForClient(clientId)` | | `ServiceRequest[]` newest first | **no create / quote function** |
| `closeRequest` | `(id, reason: RequestCloseReason, note?, duplicateOfId?) => ServiceRequest` | closed | staff |
| `REQUEST_CLOSE_REASONS` | `{key, label}[]` | 3 rows | |

## 12. RolliConnect (portal)
| export | signature | returns | notes |
|---|---|---|---|
| `portalRequestMagicLink` | `(email) => {link: MagicLink, path}` | | **STUB**: Outbox email + link returned for on-screen display; throws if email unknown |
| `portalRedeemMagicLink` | `(token) => Client` | | sets `usedAt`, writes session; not single-use |
| `portalGetSession` | `() => {session, client} \| null` | | |
| `portalSignOut` | `() => void` | | |
| `portalGetHome` | `(clientId) => PortalHome {client, needsYou, watches, requests, unreadMessages}` | | watches sorted active first |
| `portalGetWatch` | `(clientId, watchId) => PortalWatch` | | owner-checked |
| `portalGetEstimate` | `(clientId, id) => EstimateWithRefs` | | owner-checked; drafts throw |
| `portalApproveEstimate` | `(clientId, id) => EstimateWithRefs` | | `approveEstimate(id,'portal')` as client + `transitionJob(job,'approve')` if job awaits customer; replayed |
| `portalDeclineEstimate` | `(clientId, id, reason) => EstimateWithRefs` | | replayed |
| `portalGetInvoice` | `(clientId, id) => SalesOrderWithRefs` | | |
| `portalPayBalance` | `(clientId, id) => SalesOrderWithRefs` | | **STUB**: full balance, card, note "Paid online via RolliConnect (stub)"; replayed |
| `portalConfirmPickupWindow` | `(clientId, id, date 'YYYY-MM-DD', slot, note?) => SalesOrderWithRefs` | | channel must be pickup; writes `pickupWindow` + concierge Task (division rolliworks, createdBy 'RolliConnect'); replayed |
| `portalSubmitShippingInfo` | `(clientId, id, Address, phone) => SalesOrderWithRefs` | | `setShippingAddress` as client; phone appended to memo; replayed |
| `portalGetMessages` | `(clientId) => Message[]` | oldest first | marks staff messages read (replayed) |
| `portalSendMessage` | `(clientId, text, watchId?) => Message` | | replayed |
| `portalCloseRequest` | `(clientId, id, reason, duplicateOfId?) => PortalRequest` | | `new` only; replayed |
| `getStaffInbox` | `() => StaffInboxThread[]` | unread first | |
| `getStaffInboxUnread` | `() => number` | | |
| `markThreadRead` | `(clientId) => void` | | replayed |
| `replyToClient` | `(clientId, text, watchId?, replayBy?) => Message` | | Outbox email + staff message; audit `portal`; replayed with original `by` |
| `PORTAL_STATUS` | `Record<PortalStatusKey, {label, blurb, active}>` | 14 rows | |
| `replayRcEvents` sync | `() => number` | | runs at module load; audit muted |
| `resetRcEvents` | `() => void` | | Setup → "Reset RolliConnect data" |

## 13. Stubs / seams (explicit list)
| where | behaviour | KEEPER replaces with |
|---|---|---|
| `convertEstimate(id,'sales_order')` | throws | remove; use `convertEstimateToSalesOrder` |
| `fulfillSalesOrder` QBO | fake id + `queued` | QBO push job / webhook |
| `recordPayment`, `portalPayBalance` | ledger rows only | processor |
| `shippingProvider` | SVG label + random tracking | carrier API |
| Outbox (`store.outbox`) | never sends | email provider |
| labels / receipts | `printed` flags | print service |
| `portalRequestMagicLink` | link shown on screen; no expiry | auth provider |
| `partsAssistantReply` | scripted scorer | optional LLM behind same signature |
| `getRecentActivity` | static rows | derived from audit/transition tables |
| `replayRcEvents` / localStorage | prototype persistence | real DB (delete entirely) |
| "Convert to invoice" row on Estimates list menu | display-only | wire to `convertEstimateToSalesOrder` |

## 14. Drift vs earlier API-SURFACE
- `invoiceJob` listed twice before (STUB and real) — **real** only.
- `addStation(name)` → `addStation(name, division)`.
- `getToday` now division-scoped; `getDivisionStaff/Roles`, `getSessionDivision` new.
- `parsePin` accepts `@` and `#`.
- `PinInput` gained `clientId`, `estimateId`.
- Reference contract: `docs/reference/contract-v1-client.ts` (uploaded HTTP client) — operation names should converge where possible (`convertEstimateToSalesOrder`, `fulfillSalesOrder`, `confirmShipment`…).

## 15. E9 — RS modules (appended; all async unless marked sync)
| export | signature | notes |
|---|---|---|
| `getVendors` / `getVendor(id)` / `saveVendor(input)` / `setVendorActive(id, active)` | `Vendor` rows | save = create or update; audit `purchasing` |
| `getPurchaseOrders` / `getPurchaseOrder(id)` | `PurchaseOrderWithRefs {vendor, location}` | |
| `createPurchaseOrder({vendorId, locationId, lines: POLineInput[], memo?})` | draft PO `PO-26-nnnn` | vendor must be active; division = session |
| `sendPurchaseOrder(id)` | sent | Outbox email to vendor (**STUB**) |
| `receivePurchaseOrder(id, qtyByLine)` | partially_received / received | each qty → `StockMovement receipt` at PO location; `Part.stock` re-summed |
| `cancelPurchaseOrder(id, reason)` | cancelled | reason required |
| `getLocations` / `getStockRows` / `getLowStock` / `getStockMovements(partId?)` | `StockLocation[]` / `StockRow[]` / `StockMovement[]` | `StockRow.low = onHand ≤ reorderPoint` |
| `adjustStock(partId, locationId, delta, reason)` | `StockMovement` | non-zero integer, reason, never negative |
| `getCycleCounts` / `startCycleCount(locationId)` / `postCycleCount(id, counted)` | `CycleCount` | one open count per location; variances → `count` movements |
| `queueLabelsFor('estimate'\|'job'\|'watch', ids[])` | `LabelJob[]` | 2 labels per record, unprinted; audit `labels` |
| `getReport('funnel'\|'throughput'\|'aging'\|'pnl')` / `reportToCsv(report)` sync | `Report {columns, rows, note}` | reconciles with `getDashboardStats` |
| `getQboQueue()` / `exportAccountingCsv('invoices'\|'payments'\|'qbo')` | `QboQueueRow[]` / csv string | **STUB**; export audited `accounting` |
| `getIntegrations()` | `IntegrationTile[]` | all stub / not connected |
| `adminSaveUser(input)` / `adminDeactivateUser(id)` | `User` / void | manager only; guards self + last manager |
| `getCatalogAdmin()` / `saveCatalogService(input)` / `retireCatalogService(id, retired=true)` | catalog rows with `retired` | retired rows removed from live `getServiceCatalog` |
| `getTemplates()` / `saveTemplate(key, subject, body)` / `MERGE_FIELDS` | `MessageTemplate` | not yet used by Outbox writers |
| `EVIDENCE_SLOTS`, `PARTS_GRADES`, `EVIDENCE_REQUIRED`, `evidenceGaps(job)` sync | lookups | gaps only while `testing` |
| `getEvidenceForJob(jobId)` / `getEvidenceForWatch(watchId)` / `getEvidenceForClient(clientId)` | `EvidenceItem[]` (+ jobNumber, serviceDate, watchLabel) | |
| `captureEvidence(jobId, {slot, photo, labelScan, grades?, depthRating?, note?})` | `EvidenceItem` | label must match job #/ref/serial; depth `^\d+M/\d+ft$`; grading needs ≥1 grade; audit `evidence` + job stamp |
| `transitionJob(…, 'qc_pass')` | | now also throws when `evidenceGaps(job)` non-empty |
New audit types: `purchasing · inventory · setup · evidence · labels · accounting`.

## 16. E10 — Companion (scripted; all audit type `companion`)
| export | signature | notes |
|---|---|---|
| `resolveModel(text)` sync | `→ {reference?, model?, via: reference\|alias\|year\|none, clarify?}` | model_references fixture |
| `priceMemory(query)` | `PriceMemoryAnswer {resolution, candidates: PriceCandidate[], text}` | candidates ranked verified-fresh → fits ref → uses; ≤5 |
| `verifyPrice(partId)` | `PriceCandidate` | stores Stamp; knowledge log `price_verified` |
| `getClientBrief(clientId)` / `correctBriefLine(clientId, key, text, original)` / `getBriefCorrections(clientId)` | `ClientBrief` / `BriefCorrection` | money masked unless manager tier (`moneyMasked`) |
| `askShop(query)` / `routeQuestion(query)` / `answerQuestion(questionId, title, body, tags[])` / `getKnowledgeCards()` / `getRoutedQuestions()` | `AskAnswer` / `RoutedQuestion` / `KnowledgeCard` | route creates a manager-role Task; answer creates a card + closes the task |
| `getPhotoLabels(photoId?)` / `labelPhoto({photoId, jobId, source, tags, skipped?})` / `LABEL_PILLS` | `PhotoLabel` | ≥1 tag unless skipped; job timeline stamp |
| `companionCanSeeMoney()` sync | boolean | manager tier |

## 17. E14 — Comms hub (audit type `comms`)
| export | signature | notes |
|---|---|---|
| `getInbox(view: InboxView, userId?)` / `getInboxCounts(userId?)` | `ConversationWithRefs[]` / counts | wakes snoozed threads whose date passed; division-scoped |
| `getClientFolder(clientId)` / `getThread(id)` / `markConversationRead(id)` | folder / `ThreadView {conversation, messages, folder}` | |
| `assignConversation(id, Assignee \| null)` / `snoozeConversation(id, untilIso)` / `wakeConversation(id)` / `closeConversation(id)` / `reopenConversation(id)` / `createConversation(clientId, subject, anchor?)` | `ConversationWithRefs` | snooze needs a future date |
| `renderTemplate(conversationId, key)` | `RenderedTemplate {subject, body, missing[]}` | merge fields from client / anchor job / estimate / SO / package |
| `replyInThread(id, {text, subject?, templateKey?, photos?})` | `ConvMessage` (out, token) | Outbox email with `[reply token …]`; marks inbound read; wakes snoozed |
| `addThreadNote(id, text)` | `ConvMessage` (internal) | never sent |
| `simulateInboundReply(id, text)` | `ConvMessage` (in, `matchedToken`) | **MOCK** email reply routed by last outbound token |
| `threadNeedsReplyFor(anchor)` sync / `clientNeedsReplyCount(clientId)` sync / `threadsNeedingReplyForUser(user)` sync / `getCommsUnread()` | indicators | used by job cards, estimate rows, `/today` |
Hooks: `portalApproveEstimate`, `portalDeclineEstimate`, `portalSendMessage`, `portalConfirmPickupWindow`, `approvePartsRequest` now also call the internal `threadEvent(...)`.

## 18. E15 — Portal-first inspection report
| export | signature | notes |
|---|---|---|
| `REPORT_COMPONENTS`, `COMPONENT_GRADES` | lookups | 8 components · `good\|fair\|worn\|replace` |
| `getInspectionReportsForJob(jobId)` | `InspectionReportDoc[]` newest version first | |
| `issueInspectionReport(jobId, grades[], notes)` | `InspectionReportDoc` | photos required; supersedes; in_review → awaiting_customer_approval; Outbox `inspection_ready`; comms system message; job stamp |
| `portalGetInspectionReport(token)` | `PortalInspectionReport {report, watch, client, job, estimate?, photos, newerToken?}` | public by token; `newerToken` when superseded |
| `portalDecideInspectionReport(token, 'approve'\|'decline', reason?)` | `PortalInspectionReport` | as client: job approve / back_to_review(reason), estimate approve / decline; comms approval event; audit `portal` |
Template keys gained `inspection_ready`, `invoice_ready`, `evidence_available`; merge field `{{portal.link}}`; `PortalWatch.inspectionReportToken`; `NeedsYouKind.review_inspection`.
