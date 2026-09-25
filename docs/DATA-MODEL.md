# DATA-MODEL — RolliSuite prototype → KEEPER schema brief

Truth: `frontend/src/api/types.ts` (shapes) + `frontend/src/api/client.ts` (invariants, derived fields). Rows live in an in-memory `store` seeded from `frontend/src/api/fixtures/`; only station list / device registration / session / audit log / RolliConnect session + event log + magic links persist (localStorage). Everything else resets on reload.

For KEEPER: every entity below is a Postgres table unless marked **derived**. Every `Stamp {at, by, station}` becomes `(…_at timestamptz, …_by user_id, …_station_id)`. Every `type X = 'a' | 'b'` union is a **lookup table**, not a Postgres enum (principle 7) — the union lists the seed rows.

Accommodation-set legend: `[A:job_kind]` job_kind lookup · `[A:owner]` owner ≠ assignees · `[A:roles]` party roles · `[A:audit]` audit/telemetry timestamps · `[A:stage]` pipeline stage tracking. ✅ implemented · ◐ partial · ✗ absent.

## 1. Identity, device, audit

### User (`fixtures/users.ts`, 4 rows)
| field | type | notes |
|---|---|---|
| id | `u-<name>` | PK |
| firstName, shortName, displayName, dutyLabel | text | **shortName is the actor key** written into every `by` field (`MH`, `Walter`, `Vienna`, `MM`) — KEEPER: replace with user_id FK |
| accessTier | lookup `manager \| concierge` | route/visibility gate only |
| roles | `Role[]` lookup `concierge \| manager \| inspector \| watchmaker` | **[A:roles ✅]** many-to-many; resolved at read time by `roleHolders(role)` |
| division | lookup `rolliworks \| rollishop \| both` | `both` = inherits the station's division at sign-in |
| password, pin | text | prototype plaintext (`firstname123` / `1234`) — KEEPER: hash |

### Station (`fixtures/stations.ts`, 6 rows) — `{ id, name, division: Division }`. Device-bound: `localStorage rollisuite.prototype.stationId`. Session division = `getSessionDivision()` = station.division (fallback `rolliworks`).

### AuditEvent (localStorage `rollisuite.prototype.auditLog`, newest first, **cap 60**) **[A:audit ◐]**
| field | notes |
|---|---|
| id, timestamp | |
| type | lookup `sign_in \| sign_in_failed \| sign_out \| station_registered \| station_renamed \| station_reset \| intake \| estimate \| job \| task \| pin \| sales \| parts \| portal` |
| stationName, userShortName?, userDisplayName? | who/where (names, not ids) |
| method? `password_photo \| pin_switch`, cameraStatus? `captured \| no_camera \| denied`, photoDataUrl? | sign-in only |
| detail | `"<record number> · <what happened>"` free text |
Drift: `closeRequest` (staff) writes `type: 'estimate'` — there is no `request` audit type. During RolliConnect replay audit is muted.

### Division (`rolliworks | rollishop`) — dimension, not entity. Carried by: Station, User(+both), Job, Task, PinnedItem. **Not** carried by Package, Estimate, SalesOrder, Watch, Client, PartsRequest, ServiceRequest, Message (see open questions).

## 2. Clients & watches

### Client (`fixtures/clients.ts`, 25) — `id, firstName, lastName, email, phone, company?, street, city, state, type: retail|trade, since`. `createClient` writes blank address, type retail. Emails are the join key for Outbox → Client 360 emails and for RolliConnect magic links.

### Watch (`fixtures/watches.ts`, 21) — `id, clientId→Client, brand: Rolex|Tudor, model, reference, serial, dial, bracelet, status: WatchStatus, receivedAt`.
`WatchStatus` lookup: `expected | intake | awaiting_approval | in_service | awaiting_parts | qc | awaiting_pickup | released`. **Display-only projection** written by intake stage 4, job transitions (`WATCH_STATUS_FOR`), holds. Seeds drift from their jobs (e.g. w-14 `awaiting_approval` while j-21 is `ready_to_ship`) — KEEPER should derive it, not store it.

## 3. Requests & estimates

### ServiceRequest (`fixtures/requests.ts`, 9) — the ask before an estimate
| field | notes |
|---|---|
| id, number `RQ-26-nnnn` | no counter in code (no create function) |
| clientId→Client, watchId?→Watch, estimateId?→Estimate | quoted ⇔ estimateId set (by seed only) |
| source | lookup `call \| email \| web \| walk_in` |
| status | lookup `new \| quoted \| closed \| closed_by_client` |
| summary | client's words |
| createdAt, createdBy, station | **[A:audit ✅]** |
| closedAt?, closedNote?, closedBy? `staff \| client`, closeReason? lookup `duplicate \| no_longer_needed \| mistake`, duplicateOfId?→ServiceRequest | enum-plus-note pattern |

### Estimate (`fixtures/estimates.ts`, 24)
| field | notes |
|---|---|
| id, number | `E` + 5 digits, sequence `counters.estimate` (next E01059) |
| revision, revisions[] `EstimateRevision` | snapshot `{revision, status, lines, subtotal, shippingAmount, total, validUntil, clientNotes, messageNotes, internalNotes, savedAt, savedBy}` pushed on every `reviseEstimate`; never overwritten |
| clientId→Client, watchId?→Watch | single optional watch |
| department | legacy derived `primaryDepartment(lines)`: `watchmaking \| band \| polish` (dashboard P&L only) |
| status | lookup `draft \| sent \| approved \| converted \| expired \| declined` (`approved` provisional) |
| lines[] `EstimateLine` | see below |
| subtotal, shippingAmount, taxAmount(=0), total | `totalsFor(lines)`; tax rate 8.25% shown "not applied" |
| validUntil, clientNotes, messageNotes, internalNotes | |
| billingAddress, shippingAddress `Address {name, street, city, state}`, shippingMirrorsBilling | |
| historical | read-only (seeded 2023–24 rows) |
| createdAt/By, updatedAt, sentAt?, approvedAt?, approvedVia? `staff \| portal`, convertedAt?, declinedAt?, declineReason? | **[A:audit ◐]** no station on estimate stamps |
| jobId?→Job | set by `createJobFromEstimate` / `convertEstimateToIntake`; back-filled at store init from `jobs.estimateId` |

### EstimateLine — `id, description, qty, unitPrice, dept: DeptCode, taxable, type: service|part|shipping, catalogId?→CatalogService, partNumber?`. Reused verbatim as `Job.lines`.
`DeptCode` lookup `W | B | P | PM` (Watch · Band · Polish · **Precious Metals** — never "project manager"). `DEPT_OF_CODE`: W→watchmaking, B→band, P→polish, PM→watchmaking. `DEPT_COMPONENTS`: W→[watch head] · B→[bracelet, clasp] · P→[watch head, bracelet] · PM→[watch head].

### CatalogService (`fixtures/catalog.ts`, 22) — `id, name, dept, rate, type`.

## 4. Intake

### Package (`fixtures/intake.ts`, 11) **[A:stage ✅]**
| field | notes |
|---|---|
| id, subNumber `SUB-26-0nnn` | `counters.sub` (next SUB-26-0315) |
| source lookup `carrier \| walk_in`, carrier lookup `FedEx \| UPS \| USPS \| DHL \| Hand delivery`, trackingNumber? (unique), signatureNoted | |
| clientId?, estimateId? | linked at stage 2 |
| status | lookup `arrived \| processed \| awaiting_inspection \| received \| discrepancy_hold` |
| arrivedAt/By/Station · processedAt/By · workOrderAt/By · inspectedAt/By | stage stamps **[A:audit ◐]** — only arrival records station |
| contents[] (from `CONTENT_PILLS` lookup), photos[] `PackagePhoto {id, source: webcam\|upload, dataUrl, fileName?}`, receiptPrinted, notes? | |
| bin? lookup `inspection \| concierge` | stage 3 |
| workflow? `DeptCode[]` | stage 4 — **routing authority** for the job |
| discrepancyReason? | joined list of `computeDiscrepancies` |

### OutboxEmail (`store.outbox`) — `id, to, toName, subject, body, relatedRef (number string), createdAt, createdBy, station, status: 'pending'`. Never sent. `relatedRef` is a display string, not a FK.
### LabelJob (`store.labels`) — `id lb-nn, type: pdf417_data|ref_serial, packageId→Package, estimateNumber, payload, lines[], createdAt/By, station, printed`.

## 5. Jobs

### Job (`fixtures/jobs.ts`, 25)
| field | type | notes |
|---|---|---|
| id, number | | `E` + 5 digits from `counters.job` (next E02031) — **separate sequence from estimates, same prefix** |
| clientId→Client, watchId→Watch (required), estimateId?→Estimate, packageId?→Package | | `jobRefs` also infers pkg via `packages.estimateId` when `packageId` is null |
| **kind** | lookup `service \| small_job \| warranty` | **[A:job_kind ✅]** in code a TS union + `JOB_KIND_CONFIG` record; KEEPER: `job_kind` table with columns `label, default_owner_role, skip_stages[], inspection_report bool, inspection_photos bool`; planned rows `rehab`, `internal` |
| workflow | `DeptCode[]` | orthogonal to kind; from received package else line depts; default `['W']` |
| department | legacy | `DEPT_OF_CODE[workflow[0]]` |
| status | `JobStatus` lookup | see STATE-MACHINES §1 |
| simpleStatus | lookup `estimate \| on_hand \| finished` | pack's legacy tri-state |
| priority | lookup `low \| normal \| high \| urgent` | |
| division | Division | stamped from session at create |
| lines[], total | | `total = Σ qty × unitPrice` |
| **owner** | `Role?` | **[A:owner ✅]** one accountable *role*; auto from `JOB_KIND_CONFIG.defaultOwnerRole`; never "PM" |
| **assignees** | `string[]` shortNames | working techs, many |
| intakeDate?, intakeNotes?, conditionNotes?, dueAt?, finishedAt? | | intakeDate set when on_hand |
| createdAt, createdBy | | |
| timeline[] `JobTransition` | `{id, from: JobStatus\|null, to, action, reason?, emailQueued?, at, by, station}` | append-only **[A:stage ✅][A:audit ✅]**; first row `action:'create', from:null` |
| holds[] `JobHold` | `{id, type: parts\|outsource, reason, priorStatus, placedAt, placedBy, station, releasedAt?, releasedBy?, releaseNote?}` | overlay; active = `!releasedAt`; at most one active |
| notes[] `JobNote` | `{id, text} & Stamp` | |
| photos[] `JobPhoto` | `PackagePhoto & Stamp` | review gate: ≥1 for every kind |
| inspection? `InspectionReport` | `{answers: Record<questionKey, option>} & Stamp` | service kind only; questions = `INSPECTION_QUESTIONS` lookup |

### ShopTimeEntry (`fixtures/jobs.ts`, 5) — `id, jobId→Job, minutes, note` & Stamp. Never moves status; on_hand jobs only.

## 6. Tasks & pinned items

### Task (`fixtures/tasks.ts`, 15)
| field | notes |
|---|---|
| id, title | |
| assignedTo `Assignee` | `{type:'user', shortName} \| {type:'role', role}` **[A:roles ✅]** — KEEPER: nullable `assignee_user_id` + nullable `assignee_role`, exactly one set |
| createdBy | "waiting-on" = createdBy ≠ assignee match |
| division | stamped from session |
| jobId?, watchId?, clientId? | watch/client copied from job at create |
| dueAt?, status `open \| done`, createdAt, station, completedAt?, completedBy? | |

### PinnedItem (`fixtures/tasks.ts`, 6) — manual hit-list layer
| field | notes |
|---|---|
| id, title | title may start with `@name`/`@role`/`#name`/`#role` (parsed by `parsePin`, prefix kept in title) |
| assignedTo `Assignee`, createdBy, division, createdAt, station | |
| jobId?, taskId?, clientId?, estimateId? | provenance / context link (quick-add attaches current route record) |
| dismissedAt?, dismissedBy? | dismissed = done; never deleted |

## 7. Money tail

### SalesOrder (`fixtures/salesOrders.ts`, 8) — the invoice
| field | notes |
|---|---|
| id, number `SO-26-nnnn` | `counters.so` (next SO-26-0108) |
| clientId→Client, jobId?→Job, estimateId?→Estimate | |
| status | lookup `draft \| open \| partial_fulfilled \| fulfilled \| shipped \| picked_up \| cancelled` |
| channel? lookup `ship \| pickup` | |
| orderDate, shipDate?, fulfilledAt?, cancelledAt?, pickedUpAt? | |
| lines[] `SOLine {id, description, partNumber?, qty, rate, dept?, pickedUpQty, shippedQty}` | |
| shippingAmount, total | derived `Σ qty×rate + shipping` on every write (`soTotals`) |
| memo? | portal appends carrier phone here |
| qboInvoiceId? `QBO-STUB-nnnnn`, qboStatus lookup `not_queued \| queued` | HARD-STOP stub |
| payments[] `Payment {id, method: card\|cash\|check\|wire\|other, amount, note?} & Stamp` | ledger only |
| balanceDue, isPaid | derived: `max(0,total−paid)`, `total>0 && paid≥total` |
| pickupCode? `XXXX-XX`, pickupCodeIssuedAt? | alphabet excludes I/L/O/0/1; consumed (nulled) on code-verified pickup |
| shippingAddress? `Address`, shippingInfoRequestedAt?, tracking? | |
| pickupWindow? `{date, slot: morning\|afternoon, confirmedAt, note?}` | portal write |
| shipment? `Shipment {id, carrier: usps\|ups\|fedex\|dhl\|other, service, tracking, labelId, labelDataUrl, declaredValue, coverage, photos[], address, bypassReason?} & Stamp` | |
| pickupSession? `PickupSession {id, codeUsed?, proxyName?, proxyIdPhoto?, photos[], lineQty: Record<lineId, n>, bypassReason?, adminOverride?} & Stamp` | signature-free |
| createdAt/By, updatedAt | |

## 8. Workshop / parts

### Part (`fixtures/parts.ts`, 25) — `id, partNumber, name, category, compatibleRefs[], calibers[], aliases[], price, stock`. `compatibleRefs` and `aliases` **grow on approval** (learning loop). KEEPER: normalize `aliases[]` → `part_alias(term, part_id, scope?, source_request_id)` and `compatibleRefs[]` → `part_reference(part_id, reference)`; see DECISIONS "parts alias table".
### PartsRequest (`fixtures/parts.ts`, 4) — `id, number PR-nnnn (counters.pr, next PR-0045), jobId→Job, status: draft|pending|approved|rejected, partId?→Part, qty, note?, searchTerms[], chat[] ChatMessage {id, role: user|assistant, text, suggestions?: {partId, reason}[], at}, requestedBy, requestedAt, station, decidedBy?, decidedAt?, decisionNote?`.
### PartsKnowledgeEntry (`fixtures/parts.ts`, 3) — `id, kind: association_confirmed|alias_added|rejected, partId, partNumber, reference?, alias?, requestId, detail` & Stamp. Append-only visible log.

## 9. RolliConnect (client portal)
| entity | fields | persistence |
|---|---|---|
| Message (`fixtures/portal.ts`, 3) | `id, clientId, watchId?, from: client\|staff, by, text, at, readByStaff, readByClient, emailId?→OutboxEmail` | in-memory + replay |
| MagicLink | `token '<clientId>-<rand>', clientId, email, createdAt, usedAt?` | localStorage `rollisuite.rc.magicLinks` (last 20); not single-use, no expiry |
| PortalSession | `clientId, email, token, issuedAt` | localStorage `rollisuite.rc.session` |
| RcEvent (replay log) | `approve \| decline \| pay \| pickup \| ship \| msg \| reply \| read \| closereq` with ids | localStorage `rollisuite.rc.events`, replayed at module load |

## 10. Derived read models (never stored — KEEPER: views / RPC)
`TodayView {pinned, rows: TodayRow[], waitingOn: Task[]}` · `TodayRow {id, source: owner\|assignee\|hold\|discrepancy\|task, title, detail, via, jobId?, taskId?, packageId?, dueAt?, overdue, urgent, sentBy?}` · `DashboardStats` · `QuoteContext` · `InspectionContext {pkg, estimate, expectedComponents, suggestedWorkflow}` · `WatchMatch {watch, client, jobs, packages}` · `BenchView` · `SupervisorBoard` · `FloorMap` (9 lanes) · `TailStage` · `SearchResults/SearchGroup/SearchHit` · `Client360` (+ `WatchGroup`, `WatchHistoryRow`, `CustodyEvent`, `ClientNoteRow`, `Client360Summary`) · `ClientDirectoryRow` · `PortalHome`, `PortalWatch`, `PortalStatus`, `NeedsYouItem`, `PortalDocument`, `PortalHistoryRow`, `PortalRequest` · `StaffInboxThread` · `*WithRefs` joins (`EstimateWithRefs {client, watch|null}`, `JobWithRefs {client, watch, estimate|null, pkg|null}`, `PackageWithRefs {client|null, estimate|null}`, `SalesOrderWithRefs {client, job|null, watch|null}`, `PartsRequestWithRefs {job, part|null, client, watch}`).

`hitKey` convention (Client 360 deep-link + flash): `top` · `watch-<id>` · `est-<id>` · `job-<id>` · `so-<id>` · `pkg-<id>` · `req-<id>`.

## 11. Relationships
```
Client 1─* Watch            Client 1─* Estimate ?─1 Watch          Client 1─* ServiceRequest ?─1 Watch ?─1 Estimate
Estimate 1─? Job (jobId)    Estimate 1─? Package (estimateId)      Package ?─1 Job (job.packageId)
Job *─1 Watch  Job *─1 Client  Job 1─* JobTransition | JobHold | JobNote | JobPhoto | ShopTimeEntry | Task | PartsRequest
Job 1─? SalesOrder (jobId, non-cancelled)   Estimate 1─? SalesOrder (estimateId)
SalesOrder 1─* Payment, 1─? Shipment, 1─? PickupSession, 1─? PickupWindow
User *─* Role   Job.owner → Role   Task.assignedTo / PinnedItem.assignedTo → User | Role
Station 1─1 Division   User → Division | both   Job/Task/PinnedItem → Division
PartsRequest ?─1 Part   Part 1─* alias (inline)   PartsKnowledgeEntry → Part, PartsRequest
Client 1─* Message   Client 1─* MagicLink   OutboxEmail.to = Client.email (string join)
```

## 12. Counters (in `store.counters`) — `sub 314 · label 3 · estimate 1058 · job 2030 · so 107 · pr 44`. KEEPER: sequences; decide whether job and estimate share one `E` sequence (open question).

## 13. Accommodation-set status
| item | status | where |
|---|---|---|
| job_kind lookup table | ✅ (as config record) | `Job.kind`, `JOB_KIND_CONFIG` — table in KEEPER |
| owner vs assignees | ✅ | `Job.owner: Role`, `Job.assignees: string[]` |
| party roles | ✅ | `User.roles[]`, `Assignee` role variant, `roleHolders`, `getDivisionRoles` |
| audit / telemetry timestamps | ◐ | `Stamp` on transitions/holds/notes/photos/shop time/tasks/pins/payments/shipment/pickup; package stage stamps lack station except arrival; estimate stamps lack station; AuditEvent capped at 60 and stores names not ids; no device/geo telemetry |
| pipeline stage tracking | ✅ | `Job.timeline` append-only; `Package` stage timestamps; SO date columns (`orderDate, fulfilledAt, shipDate, pickedUpAt, cancelledAt`) |
| division wall | ◐ | Station/User/Job/Task/Pin only |
| portal grants (proxy pickup etc.) | ✗ | pickup proxy is captured ad hoc at the counter (`PickupSession.proxyName`) |

## 14. Drift vs earlier docs (code is truth)
- Jobs: 25 (was "20"); packages 11 (was 10); estimates 24 (was 19); tasks 15 (was 10); pins 6 (was 4); watches 21 (was 19); SOs 8 (was 7).
- `Job.division`, `Task.division`, `PinnedItem.division`, `PinnedItem.clientId/estimateId`, `User.division`, `Station.division` added (E9) — earlier DATA-MODEL omitted them.
- `Estimate.approvedVia`, `SalesOrder.pickupWindow`, `ServiceRequest.closedBy/closeReason/duplicateOfId` present (E8).
- Removed for good: `HitListItem`, legacy `Job.technician/startedAt/completedAt/assignedTo`.

## 15. E9 additions (`fixtures/rs.ts`)
| entity | fields | notes |
|---|---|---|
| Vendor (5) | id, name, contact, email, phone, terms, division, active, notes? | retire = `active=false` |
| PurchaseOrder (5) | id, number `PO-26-nnnn`, vendorId, status lookup `draft\|sent\|partially_received\|received\|cancelled`, division, locationId, lines[] `POLine {id, partId, partNumber, description, qty, unitCost, receivedQty}`, total, memo?, createdAt/By, station, sentAt?, receivedAt?, cancelledAt?, cancelReason? | counter `po` (next PO-26-0026) |
| StockLocation (5) | id, name, division, kind `drawer\|cabinet\|safe\|bench` | |
| StockLevel (13) | partId, locationId, onHand, reorderPoint | PK (partId, locationId); `Part.stock` = Σ onHand (derived) |
| StockMovement (5) | id, kind `receipt\|adjustment\|count\|issue`, partId, locationId, delta, before, after, reason, ref?, poId?, jobId?, countId?, division & Stamp | append-only |
| CycleCount (1) | id, number `CC-26-nnnn`, locationId, status `open\|posted`, lines[] `{partId, expected, counted?}`, variances, postedAt/By & Stamp | counter `cc` |
| MessageTemplate (6) | key lookup, name, subject, body, mergeFields[], updatedBy & Stamp | |
| EvidenceItem (12) | id, jobId, watchId, slot lookup `hidden_serial\|timing_sheet\|pressure_test\|parts_grading`, photo, labelScan, grades? `PartsGrade[]` (`B \| Ø/REPL \| D/REPL`), depthRating? (`50M/164ft`), note? & Stamp | keyed to watch AND job; counter `ev` |
| IntegrationTile (4) | key, name, health `not_connected\|stub`, blurb, lastCheck | static |
Derived: `StockRow`, `Report`, `QboQueueRow`. Catalog admin adds `retired` flag (separate admin copy; retired rows removed from live catalog).
