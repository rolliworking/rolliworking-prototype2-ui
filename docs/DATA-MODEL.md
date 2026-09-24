# DATA-MODEL — RolliSuite prototype (E1–E4)

Source of truth: `frontend/src/api/types.ts`. All rows live in-memory in `frontend/src/api/client.ts` (`store`) seeded from `frontend/src/api/fixtures/`. Station/audit/session persist to `localStorage`; everything else resets on reload.

Legend — **P-17 accommodation set**: `[P17:job_kind]` `[P17:party_roles]` `[P17:telemetry]` `[P17:portal]`. ✅ implemented · ◐ partial · ✗ not present.

## Entities

### User (`users.ts`)
| field | type | notes |
|---|---|---|
| id | string | `u-michael` |
| firstName, shortName, displayName, dutyLabel | string | shortName is the audit/actor key (`MH`, `Walter`, `Vienna`, `MM`) |
| accessTier | `manager \| concierge` | visibility gate only |
| roles | `Role[]` | `concierge \| manager \| inspector \| watchmaker` — **[P17:party_roles ✅]** role holders resolved at read time |
| password, pin | string | prototype creds (visible on screen) |

### Station (`stations.ts`) — device-bound; `{ id, name }`. localStorage `rollisuite.prototype.stationId`.

### AuditEvent (localStorage, cap 60)
| field | notes |
|---|---|
| type | `sign_in \| sign_in_failed \| sign_out \| station_registered \| station_renamed \| station_reset \| intake \| estimate \| job \| task` |
| timestamp, stationName, userShortName, userDisplayName | who/when/where **[P17:telemetry ◐]** |
| method, cameraStatus, photoDataUrl | sign-in only |
| detail | `"<ref> · <what>"` |

### Client (`clients.ts`, 25) — `id, firstName, lastName, email, phone, company?, street, city, state, type: retail|trade, since`.

### Watch (`watches.ts`, 19) — `id, clientId→Client, brand: Rolex|Tudor, model, reference, serial, dial, bracelet, status: WatchStatus, receivedAt`. `WatchStatus = expected|intake|in_service|awaiting_approval|awaiting_parts|qc|awaiting_pickup|released` (synced from job transitions, see STATE-MACHINES).

### Estimate (`estimates.ts`, 19)
| field | notes |
|---|---|
| id, number | number `E` + 5 digits (E01041…), sequence `counters.estimate` |
| revision, revisions[] | `EstimateRevision` snapshots (never overwritten) |
| clientId→Client, watchId?→Watch | single optional watch |
| department | derived `primaryDepartment(lines)` (legacy field) |
| status | `draft \| sent \| approved(provisional) \| converted \| expired \| declined` |
| lines[] | `EstimateLine` |
| subtotal, shippingAmount, taxAmount(=0), total | `totalsFor(lines)` |
| validUntil, clientNotes, messageNotes, internalNotes | |
| billingAddress, shippingAddress, shippingMirrorsBilling | `Address` |
| historical | read-only flag |
| createdAt/By, updatedAt, sentAt?, approvedAt?, convertedAt?, declinedAt?, declineReason? | |
| jobId? | →Job set by create-job / convert-to-intake |

### EstimateLine — `id, description, qty, unitPrice, dept: DeptCode(W|B|P|PM), taxable, type: service|part|shipping, catalogId?, partNumber?`. Shared by Estimate and Job.

### CatalogService (`catalog.ts`, 22) — `id, name, dept, rate, type`.

### Package (`intake.ts`, 10)
| field | notes |
|---|---|
| id, subNumber | `SUB-26-03xx` sequence `counters.sub` |
| source `carrier\|walk_in`, carrier, trackingNumber?, signatureNoted | |
| clientId?, estimateId? | |
| status | `arrived → processed → awaiting_inspection → received \| discrepancy_hold` |
| arrivedAt/By/Station, processedAt/By, workOrderAt/By, inspectedAt/By | stage stamps **[P17:telemetry ◐]** |
| contents[], photos[] `PackagePhoto`, receiptPrinted, bin?, notes? | |
| workflow? `DeptCode[]` | set at Receive Watch — **routing authority** for the job |
| discrepancyReason? | |

### OutboxEmail (`intake.ts`) — `id, to, toName, subject, body, relatedRef, createdAt/By, station, status: 'pending'`. Never sent.
### LabelJob — `id, type: pdf417_data|ref_serial, packageId, estimateNumber, payload, lines[], createdAt/By, station, printed`.

### Job (`jobs.ts`, 20)
| field | type | notes |
|---|---|---|
| id, number | | number `E` + 5 digits from `counters.job` (E02011…) — provisional whether it shares the estimate sequence |
| clientId→Client, watchId→Watch (required), estimateId?→Estimate, packageId?→Package | | |
| **kind** | `service \| small_job \| warranty` | **[P17:job_kind ✅]** orthogonal to workflow & status; per-kind config in `JOB_KIND_CONFIG` |
| workflow | `DeptCode[]` | from received package, else line depts |
| department | `Department` | legacy derived (dashboard P&L) |
| status | `JobStatus` | see STATE-MACHINES |
| simpleStatus | `estimate \| on_hand \| finished` | Shop Time lists on_hand only |
| priority | `low \| normal \| high \| urgent` | |
| lines[], total | | carried from estimate |
| **owner** | `Role?` | accountable shepherd, **role-based** **[P17:party_roles ✅]**; auto from kind; never called "PM" |
| **assignees** | `string[]` | working techs (shortNames), many |
| intakeDate?, intakeNotes?, conditionNotes?, dueAt?, finishedAt? | | |
| createdAt, createdBy | | |
| timeline[] | `JobTransition` | `{from,to,action,reason?,emailQueued?, at,by,station}` append-only **[P17:telemetry ✅]** |
| holds[] | `JobHold` | `{type: parts\|outsource, reason, priorStatus, placedAt/By, station, releasedAt?/By?, releaseNote?}` |
| notes[] | `JobNote` | `{text, at, by, station}` |
| photos[] | `JobPhoto` | `PackagePhoto & Stamp` |

### ShopTimeEntry (`jobs.ts`) — `id, jobId→Job, minutes, note, at, by, station`. Never moves job status.

### Task (`tasks.ts`, 10)
| field | notes |
|---|---|
| id, title | |
| assignedTo | `Assignee = {type:'user', shortName} \| {type:'role', role}` — role resolves to current holders **[P17:party_roles ✅]** |
| createdBy | cross-assignment = createdBy ≠ assignee |
| jobId?, watchId?, clientId? | linked tasks appear on the job timeline card |
| dueAt?, status `open\|done`, createdAt, station, completedAt?, completedBy? | |

### Derived (not stored)
- `TodayRow` — `/today` union: owner-action jobs + assignee bench jobs + holds I own/placed + discrepancy packages (concierge role / inspector who flagged) + open tasks to me/my roles. `TodayView = { rows, waitingOn: Task[] }`.
- `DashboardStats`, `QuoteContext`, `InspectionContext`, `WatchMatch`, `*WithRefs` joins.

## Relationships
```
Client 1─* Watch 1─* Estimate ?─1 Job *─1 Watch
Estimate 1─? Package (estimateId)   Package ?─1 Job (packageId, via received package)
Job 1─* JobTransition / JobHold / JobNote / JobPhoto / ShopTimeEntry / Task
User *─* Role (users.roles)   Job.owner → Role   Task.assignedTo → User | Role
OutboxEmail.relatedRef → Estimate.number | Job.number | Package.subNumber (string ref only)
```

## P-17 accommodation status
| item | status | where |
|---|---|---|
| job_kind | ✅ | `Job.kind`, `JOB_KIND_CONFIG` (label, default_owner_role, skipStages) |
| party roles | ✅ | `User.roles`, `Job.owner: Role`, `Task.assignedTo` role variant, `roleHolders()` |
| telemetry timestamps | ◐ | `Stamp {at,by,station}` on transitions/holds/notes/photos/shop time/tasks; package stage stamps; no device/geo telemetry |
| portal grants | ✗ | no client portal identity or grant table yet (Wix/portal intake rule from pack is documented, not modelled) |

## Removed
- `HitListItem` / `hitList.ts` (manual hit list) → replaced by derived `/today` + `Task`.
- Legacy Job fields `technician`, `startedAt`, `completedAt`, `assignedTo` → `assignees[]`, `createdAt`, `finishedAt`.
