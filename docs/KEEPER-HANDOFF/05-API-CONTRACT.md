# 05 — API CONTRACT (target surface for the real backend)

Every exported function of `src/api/client.ts`, generated from the code (`_gen.py`). Screens only ever call these. In KEEPER each `async` entry becomes an HTTP endpoint (or RPC); each `sync` helper becomes either a server-computed field or a shared pure function.

Columns: **kind** (async = crosses the wire; sync = pure/derived; const = lookup table) · **signature** as written · **side effects** detected in the body (audit rows, Outbox email, comms thread, job status change, label queue, localStorage) · **callers** (screens / components that call `api.<name>`).

Read with `04-DATA-MODEL-VS-KEEPER.md` for the shapes and `08-AUDIT-TAXONOMY.md` for what "audit" means per call.


## Station (device-bound)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getSessionDivision` | sync | `= (): Division => readStation()?.division ?? 'rolliworks';` | audit | components/companion/CompanionPanel.tsx, pages/InboxPage.tsx, pages/RequestsPage.tsx, pages/rs/PurchasingPage.tsx, pages/rt/RtShell.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwShell.tsx |
| `getStation` | async | `(): Promise<Station \| null>` | audit, localStorage | auth/AuthContext.tsx |
| `getStations` | async | `(): Promise<Station[]>` | audit, localStorage | pages/StationSetupPage.tsx |
| `addStation` | async | `(name: string, division: Division = 'rolliworks'): Promise<Station>` | audit, localStorage | pages/StationSetupPage.tsx |
| `registerStation` | async | `(stationId: string, adminUserId: string, password: string): Promise<Station>` | audit, localStorage | pages/StationSetupPage.tsx |
| `renameStation` | async | `(name: string): Promise<Station>` | audit, localStorage | pages/SetupPage.tsx |
| `resetDeviceRegistration` | async | `(): Promise<void>` | audit, localStorage | pages/SetupPage.tsx |

## Division helpers

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getDivisionStaff` | sync | `= (div: Division): User[] =>` | audit, localStorage | components/jobs/ComponentBits.tsx, components/today/NewTaskForm.tsx, components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx, components/today/StaffHitListModal.tsx, pages/InboxPage.tsx, pages/rt/RtShell.tsx, pages/rw/RwShell.tsx |
| `getDivisionRoles` | sync | `= (div: Division): Role[] =>` | audit, localStorage | components/today/NewTaskForm.tsx, components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx, pages/InboxPage.tsx |

## Audit log

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getAuditLog` | async | `(): Promise<AuditEvent[]>` | audit, localStorage | pages/AuditLogPage.tsx, pages/SetupPage.tsx |

## Auth / users

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getUsers` | async | `(): Promise<User[]>` | audit, localStorage | components/jobs/JobPanels.tsx, pages/SetupPage.tsx, pages/SetupRsPanels.tsx, pages/SignInPage.tsx, pages/StationSetupPage.tsx, pages/jobs/JobCreatePage.tsx |
| `getCurrentUser` | async | `(): Promise<User \| null>` | audit, localStorage | auth/AuthContext.tsx |
| `hasSignedInToday` | async | `(userId: string): Promise<boolean>` | audit, localStorage | pages/rw/RwShell.tsx |
| `getUsersSignedInToday` | async | `(): Promise<User[]>` | audit, localStorage | components/layout/UserSwitcher.tsx, pages/SignInPage.tsx |
| `signInWithPassword` | async | `(userId: string, password: string, photo: VerificationPhoto): Promise<User>` | audit, localStorage | auth/AuthContext.tsx |
| `switchUserWithPin` | async | `(userId: string, pin: string): Promise<User>` | audit, localStorage | auth/AuthContext.tsx |
| `signOut` | async | `(): Promise<void>` | audit, localStorage | auth/AuthContext.tsx |

## Clients

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getClients` | async | `(): Promise<Client[]>` | none (read) | pages/intake/ArrivalPage.tsx |
| `getClient` | async | `(id: string): Promise<Client \| null>` | none (read) | — (internal / other client.ts functions only) |
| `searchClients` | async | `(query: string): Promise<Client[]>` | none (read) | components/estimates/EstimateForm.tsx |

## Watches

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getWatches` | async | `(): Promise<Watch[]>` | none (read) | pages/rs/RsPages.tsx |
| `getWatchesForClient` | async | `(clientId: string): Promise<Watch[]>` | none (read) | components/estimates/EstimateForm.tsx, pages/rc/RcMessagesPage.tsx |

## Estimates

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getEstimates` | async | `(): Promise<EstimateWithRefs[]>` | none (read) | pages/rs/RsPages.tsx |
| `getEstimate` | async | `(id: string): Promise<EstimateWithRefs \| null>` | none (read) | components/companion/CompanionPanel.tsx, pages/estimates/EstimateDetailPage.tsx |
| `getEstimatesForClient` | async | `(clientId: string): Promise<EstimateWithRefs[]>` | none (read) | pages/jobs/JobCreatePage.tsx |

## Jobs (read)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getJobs` | async | `(): Promise<JobWithRefs[]>` | none (read) | components/today/NewTaskForm.tsx, pages/rs/RsPages.tsx |
| `getJob` | async | `(id: string): Promise<JobWithRefs \| null>` | none (read) | components/companion/CompanionPanel.tsx, components/companion/CompanionTabs.tsx, pages/jobs/JobDetailPage.tsx, pages/rt/RtTestPage.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwJobPage.tsx |
| `getJobsForClient` | async | `(clientId: string): Promise<JobWithRefs[]>` | audit | — (internal / other client.ts functions only) |

## Activity

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getRecentActivity` | async | `(limit = 10): Promise<ActivityEvent[]>` | audit | components/dashboard/RecentActivity.tsx |

## Dashboard

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getDashboardStats` | async | `(): Promise<DashboardStats>` | audit | pages/Dashboard.tsx, pages/rs/RsPages.tsx |

## Intake

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `CONTENT_PILLS` | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |
| `CARRIERS` | const | `fixture re-export` | none (read) | pages/intake/ArrivalPage.tsx |
| `BINS` | const | `fixture re-export` | none (read) | pages/intake/WorkOrderPage.tsx |
| `DEPT_LABEL` | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |
| `DEPT_COMPONENTS` | const | `fixture re-export` | none (read) | pages/intake/ReceivePackagePage.tsx |
| `detectCarrier` | sync | `= (tracking: string): Carrier =>` | audit | — (internal / other client.ts functions only) |
| `getPackages` | async | `(status?: PackageStatus): Promise<PackageWithRefs[]>` | audit | pages/intake/ArrivalPage.tsx, pages/intake/ReceivePackageListPage.tsx, pages/intake/ReceiveWatchListPage.tsx, pages/intake/WorkOrderPage.tsx |
| `getPackage` | async | `(id: string): Promise<PackageWithRefs \| null>` | audit | pages/intake/ReceivePackagePage.tsx |
| `getIntakeCounts` | async | `(): Promise<Record<PackageStatus, number>>` | audit | components/intake/IntakeLayout.tsx |
| `logArrival` | async | `(input: ArrivalInput): Promise<PackageWithRefs>` | audit | pages/intake/ArrivalPage.tsx |
| `lookupEstimate` | async | `(numberOrId: string): Promise<EstimateWithRefs \| null>` | audit, email → Outbox | pages/intake/ReceivePackagePage.tsx |
| `receivePackage` | async | `(id: string, input: ReceivePackageInput): Promise<` | audit, email → Outbox | pages/intake/ReceivePackagePage.tsx |
| `printDropOffReceipt` | async | `(id: string): Promise<PackageWithRefs>` | audit | pages/intake/ReceivePackagePage.tsx |
| `recordWorkOrder` | async | `(id: string, bin: Bin): Promise<PackageWithRefs>` | audit, label queue | pages/intake/WorkOrderPage.tsx |
| `findPackageForInspection` | async | `(estimateNumber: string): Promise<PackageWithRefs \| null>` | label queue | pages/intake/ReceiveWatchListPage.tsx |
| `getInspectionContext` | async | `(packageId: string): Promise<InspectionContext>` | label queue | pages/intake/ReceiveWatchPage.tsx |
| `findWatchBySerial` | async | `(reference: string, serial: string): Promise<WatchMatch \| null>` | label queue | pages/intake/ReceiveWatchPage.tsx |
| `computeDiscrepancies` | sync | `(ctx: InspectionContext, input: ReceiveWatchInput): string[]` | audit | pages/intake/ReceiveWatchPage.tsx |
| `receiveWatch` | async | `(packageId: string, input: ReceiveWatchInput): Promise<ReceiveWatchResult>` | audit, email → Outbox, label queue | pages/intake/ReceiveWatchPage.tsx |
| `getOutbox` | async | `(): Promise<OutboxEmail[]>` | audit, email → Outbox, label queue | pages/intake/OutboxPage.tsx |
| `getLabelQueue` | async | `(): Promise<LabelJob[]>` | audit, label queue | pages/intake/LabelQueuePage.tsx, pages/rs/RsPages.tsx |
| `setLabelPrinted` | async | `(id: string, printed: boolean): Promise<LabelJob>` | audit, label queue | pages/intake/LabelQueuePage.tsx |

## Estimates (E3)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `totalsFor as computeEstimateTotals` | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |
| `ESTIMATE_TAX_RATE_DISPLAY` | sync | `= TAX_RATE_UNAPPLIED;` | audit | — (internal / other client.ts functions only) |
| `getServiceCatalog` | async | `(): Promise<CatalogService[]>` | none (read) | components/estimates/LineEditor.tsx |
| `searchEstimates` | async | `(query: string, status?: EstimateStatus \| 'all'): Promise<EstimateWithRefs[]>` | none (read) | pages/estimates/EstimatesListPage.tsx |
| `getQuoteContext` | async | `(clientId: string, watchId?: string, excludeId?: string): Promise<QuoteContext>` | none (read) | components/estimates/EstimateModals.tsx, pages/estimates/EstimateCreatePage.tsx |
| `createClient` | async | `(input: NewClientInput): Promise<Client>` | none (read) | components/estimates/EstimateForm.tsx |
| `createWatch` | async | `(clientId: string, input: NewWatchInput): Promise<Watch>` | audit | components/estimates/EstimateForm.tsx |
| `createEstimate` | async | `(input: EstimateInput): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateCreatePage.tsx |
| `updateEstimate` | async | `(id: string, patch: EstimatePatch): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `reviseEstimate` | async | `(id: string, patch: EstimatePatch): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `duplicateEstimate` | async | `(id: string): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `deleteEstimate` | async | `(id: string): Promise<void>` | audit, email → Outbox | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `markEstimateSent` | async | `(id: string): Promise<EstimateWithRefs>` | audit, email → Outbox | pages/estimates/EstimateDetailPage.tsx |
| `sendEstimate` | async | `(id: string): Promise<` | audit, email → Outbox | components/estimates/EstimateModals.tsx |
| `declineEstimate` | async | `(id: string, reason: string, via: 'staff' \| 'portal' = 'staff'): Promise<EstimateWithRefs>` | audit | components/estimates/EstimateModals.tsx |
| `approveEstimate` | async | `(id: string, via: 'staff' \| 'portal' = 'staff'): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `reopenEstimate` | async | `(id: string): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `convertEstimate` | async | `(id: string, target: 'job' \| 'sales_order' \| 'intake'): Promise<JobWithRefs>` | none (read) | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `calcShipping` | sync | `(i: ShippingCalcInput)` | none (read) | components/estimates/EstimateForm.tsx |

## Jobs (E4) — state machine per PROMPT-PACK-jobs.md

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `JOB_FLOW` | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |
| `DEPT_OF_CODE` | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |

## Per-component completion (MH ruling, first board walk) — decoupled from invoicing

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `ensureComponents` | sync | `= (j: Job): JobComponent[] =>` | none (read) | — (internal / other client.ts functions only) |
| `componentsDone` | sync | `= (j: Job) => ensureComponents(j).filter((c) => c.completedAt).length;` | none (read) | — (internal / other client.ts functions only) |
| `componentsOutstanding` | sync | `= (j: Job): JobComponent[] => ensureComponents(j).filter((c) => !c.completedAt);` | none (read) | — (internal / other client.ts functions only) |
| `awaitingComponents` | sync | `= (j: Job) => j.status === 'in_service' && !activeHold(j) && componentsDone(j) > 0 && componentsOutstanding(j).length > 0;` | none (read) | components/jobs/ComponentBits.tsx, components/jobs/JobBoard.tsx, pages/workshop/BenchPage.tsx |
| `canCompleteComponent` | sync | `= (j: Job) => j.status === 'in_service' && !activeHold(j);` | none (read) | components/jobs/ComponentBits.tsx |
| `activeHold` | sync | `= (j: Job): JobHold \| undefined => j.holds.find((h) => !h.releasedAt);` | audit | components/jobs/JobBits.tsx, components/jobs/JobBoard.tsx, components/jobs/JobPanels.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwJobsPage.tsx, pages/workshop/BenchPage.tsx, pages/workshop/SupervisorPage.tsx |
| `legalJobActions` | sync | `(j: Job): JobAction[]` | audit, email → Outbox | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `canHold` | sync | `= (j: Job) => !activeHold(j) && j.simpleStatus === 'on_hand' && HOLDABLE.includes(j.status);` | audit | components/jobs/JobPanels.tsx |
| `transitionJob` | async | `(id: string, actionKey: string, reason?: string): Promise<JobWithRefs>` | audit, email → Outbox, job status | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwQcPage.tsx |
| `completeComponent` | async | `(jobId: string, key: ComponentKey): Promise<JobWithRefs>` | audit, job status | components/jobs/ComponentBits.tsx |
| `amendComponentAttribution` | async | `(jobId: string, key: ComponentKey, shortName: string): Promise<JobWithRefs>` | audit | components/jobs/ComponentBits.tsx |
| `getCompletionsReport` | async | `(): Promise<CompletionsReport>` | audit | — (internal / other client.ts functions only) |
| `completionsThisMonth` | sync | `= (tech: string) =>` | audit | pages/workshop/SupervisorPage.tsx |
| `toggleAssignee` | async | `(id: string, shortName: string): Promise<JobWithRefs>` | audit | components/jobs/JobPanels.tsx |
| `JOB_KIND_CONFIG` | sync | `: Record<JobKind,` | none (read) | components/jobs/EvidencePanel.tsx, components/jobs/InspectionPanel.tsx, components/jobs/JobBits.tsx, components/jobs/JobPanels.tsx, pages/jobs/JobCreatePage.tsx, pages/jobs/JobDetailPage.tsx |
| `INSPECTION_QUESTIONS` | sync | `:` | none (read) | components/jobs/InspectionPanel.tsx |
| `reviewGaps` | sync | `(j: Job): string[]` | audit, email → Outbox, job status | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `saveInspectionReport` | async | `(id: string, answers: Record<string, string>): Promise<JobWithRefs>` | audit | components/jobs/InspectionPanel.tsx |
| `ROLES` | sync | `: Role[] = ['concierge', 'manager', 'inspector', 'watchmaker'];` | none (read) | components/jobs/JobPanels.tsx, pages/SetupRsPanels.tsx |
| `roleHolders` | sync | `= (role: Role): User[] => fx.users.filter((u) => u.roles.includes(role));` | audit | components/jobs/JobBits.tsx, components/jobs/JobPanels.tsx |
| `setJobOwner` | async | `(id: string, role: Role \| null): Promise<JobWithRefs>` | audit | components/jobs/JobPanels.tsx |
| `placeHold` | async | `(id: string, type: HoldType, reason: string): Promise<JobWithRefs>` | audit | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `releaseHold` | async | `(id: string, note?: string): Promise<JobWithRefs>` | audit | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `addJobNote` | async | `(id: string, text: string): Promise<JobWithRefs>` | audit | components/jobs/JobPanels.tsx |
| `addJobPhotos` | async | `(id: string, photos: PackagePhoto[]): Promise<JobWithRefs>` | audit | components/jobs/JobPanels.tsx |
| `updateJobFields` | async | `(id: string, patch: JobFieldsPatch): Promise<JobWithRefs>` | audit | components/jobs/JobPanels.tsx |
| `searchJobs` | async | `(query: string): Promise<JobWithRefs[]>` | none (read) | pages/JobsPage.tsx, pages/rw/RwJobsPage.tsx |
| `createJob` | async | `(input: CreateJobInput): Promise<JobWithRefs>` | audit | pages/jobs/JobCreatePage.tsx |
| `createJobFromEstimate` | async | `(estimateId: string): Promise<JobWithRefs>` | none (read) | — (internal / other client.ts functions only) |
| `convertEstimateToIntake` | async | `(estimateId: string): Promise<JobWithRefs>` | none (read) | — (internal / other client.ts functions only) |
| `deleteJob` | async | `(id: string): Promise<void>` | audit | pages/jobs/JobDetailPage.tsx |
| `invoiceJob` | async | `(id: string): Promise<SalesOrderWithRefs>` | audit | pages/jobs/JobDetailPage.tsx |

## Shop Time: time rows against on_hand jobs; never moves job status

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getShopTime` | async | `(jobId?: string): Promise<ShopTimeEntry[]>` | audit | components/jobs/JobPanels.tsx, pages/jobs/ShopTimePage.tsx |
| `getOnHandJobs` | async | `(): Promise<JobWithRefs[]>` | audit | pages/jobs/ShopTimePage.tsx |
| `addShopTime` | async | `(jobId: string, minutes: number, note: string): Promise<ShopTimeEntry>` | audit | pages/jobs/ShopTimePage.tsx |

## Tasks (explicit) + /today (derived, no manual curation)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `assigneeLabel` | sync | `= (a: Assignee) => (a.type === 'user' ? a.shortName : `$` | comms thread | components/jobs/JobPanels.tsx, components/today/TodayBits.tsx |
| `getTasks` | async | `(): Promise<Task[]>` | audit | — (internal / other client.ts functions only) |
| `getTasksForJob` | async | `(jobId: string): Promise<Task[]>` | audit | components/jobs/JobPanels.tsx |
| `getTasksForClient` | async | `(clientId: string): Promise<Task[]>` | audit | — (internal / other client.ts functions only) |
| `createTask` | async | `(input: TaskInput): Promise<Task>` | audit | components/today/NewTaskForm.tsx |
| `setTaskDone` | async | `(id: string, done: boolean): Promise<Task>` | audit | components/dashboard/HitListPanel.tsx, pages/TodayPage.tsx |

## Pinned hit list (manual layer, MH ruling) — never hides derived rows

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `parsePin` | sync | `= (raw: string, fallback: Assignee):` | audit | components/today/QuickAddOverlay.tsx |
| `pinToHitList` | async | `(input: PinInput): Promise<PinnedItem>` | audit | components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx |
| `dismissPinned` | async | `(id: string): Promise<PinnedItem>` | audit | components/dashboard/HitListPanel.tsx, pages/TodayPage.tsx |
| `getToday` | async | `(userId?: string): Promise<TodayView>` | none (read) | components/dashboard/HitListPanel.tsx, components/today/StaffHitListModal.tsx, pages/TodayPage.tsx |

## E5 Sales orders / fulfil / pickup / ship — PROMPT-PACK-invoicing-pickup-ship.md

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `SO_BADGE` | sync | `= (o: SalesOrder): 'picked_up' \| 'shipped' \| 'paid' \| 'unpaid' => (o.pickedUpAt ? 'picked_up' : o.tracking \|\| o.shipDate ? 'shipped' : o.isPaid ? 'paid' : 'unpaid');` | none (read) | components/sales/SalesBits.tsx |
| `tailStage` | sync | `(job: Job): TailStage \| null` | none (read) | components/jobs/JobBits.tsx, pages/jobs/JobDetailPage.tsx |
| `getSalesOrders` | async | `(): Promise<SalesOrderWithRefs[]>` | none (read) | pages/rs/RsPages.tsx |
| `getSalesOrder` | async | `(id: string): Promise<SalesOrderWithRefs \| null>` | none (read) | pages/sales/PickupStationPage.tsx, pages/sales/SalesOrderDetailPage.tsx, pages/sales/ShipStationPage.tsx |
| `getSalesOrderForJob` | async | `(jobId: string): Promise<SalesOrderWithRefs \| null>` | none (read) | pages/jobs/JobDetailPage.tsx |
| `findSalesOrders` | async | `(query: string): Promise<SalesOrderWithRefs[]>` | none (read) | pages/sales/PickupStationPage.tsx, pages/sales/SalesOrdersPage.tsx, pages/sales/ShipStationPage.tsx |
| `createSalesOrder` | async | `(input: SalesOrderInput): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `convertEstimateToSalesOrder` | async | `(estimateId: string): Promise<SalesOrderWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `updateSalesOrder` | async | `(id: string, patch: SalesOrderPatch): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `openSalesOrder` | async | `(id: string): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `cancelSalesOrder` | async | `(id: string, reason: string): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `recordPayment` | async | `(id: string, amount: number, method: PaymentMethod, note?: string): Promise<SalesOrderWithRefs>` | audit | components/sales/SalesBits.tsx |
| `fulfillSalesOrder` | async | `(id: string): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `setFulfillmentChannel` | async | `(id: string, channel: FulfillmentChannel): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `regeneratePickupCode` | async | `(id: string): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx |
| `requestShippingInfo` | async | `(id: string): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx, pages/sales/ShipStationPage.tsx |
| `setShippingAddress` | async | `(id: string, address: Address): Promise<SalesOrderWithRefs>` | audit | pages/sales/SalesOrderDetailPage.tsx, pages/sales/ShipStationPage.tsx |

## Shipping seam: the one module a real carrier provider replaces

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `SHIP_CARRIERS` | sync | `: ShipCarrier[] = ['usps', 'ups', 'fedex', 'dhl', 'other'];` | none (read) | pages/sales/ShipStationPage.tsx |
| `normalizeDeclaredValue` | sync | `= (n: number) => (n > 0 && n < 1000 ? n * 1000 : n);` | none (read) | pages/sales/ShipStationPage.tsx |
| `shippingProvider` | sync | `` | none (read) | pages/sales/ShipStationPage.tsx |
| `confirmShipment` | async | `(id: string, input: ConfirmShipmentInput): Promise<SalesOrderWithRefs>` | audit | pages/sales/ShipStationPage.tsx |
| `confirmPickup` | async | `(id: string, input: ConfirmPickupInput): Promise<SalesOrderWithRefs>` | audit | pages/sales/PickupStationPage.tsx |
| `adminMarkComplete` | async | `(id: string, mode: FulfillmentChannel, note: string): Promise<SalesOrderWithRefs>` | audit, job status | pages/sales/SalesOrderDetailPage.tsx |
| `getPickupQueue` | async | `(): Promise<SalesOrderWithRefs[]>` | none (read) | pages/sales/PickupStationPage.tsx |
| `getShipQueue` | async | `(): Promise<SalesOrderWithRefs[]>` | none (read) | pages/sales/ShipStationPage.tsx |

## E6 Workshop lenses: bench, supervisor, floor map

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `pullNextCandidate` | sync | `= (me: string): Job \| null =>` | audit | — (internal / other client.ts functions only) |
| `getBenchView` | async | `(userId?: string): Promise<BenchView>` | audit | pages/rw/RwPartsPage.tsx, pages/workshop/BenchPage.tsx |
| `pullNext` | async | `(): Promise<JobWithRefs>` | audit | pages/workshop/BenchPage.tsx |
| `getSupervisorBoard` | async | `(): Promise<SupervisorBoard>` | audit | pages/rw/RwEvidencePage.tsx, pages/rw/RwQcPage.tsx, pages/workshop/SupervisorPage.tsx |
| `supervisorAssign` | async | `(jobId: string, shortNames: string[]): Promise<JobWithRefs>` | audit | pages/workshop/SupervisorPage.tsx |
| `getShopFloorMap` | async | `(): Promise<FloorMap>` | audit | pages/workshop/FloorMapPage.tsx |

## E6 Parts request → scripted assistant → approval loop

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getParts` | async | `(): Promise<Part[]>` | audit | pages/rs/PurchasingPage.tsx, pages/workshop/PartsKnowledgePage.tsx |
| `getPartsRequests` | async | `(): Promise<PartsRequestWithRefs[]>` | audit | pages/rw/RwPartsPage.tsx |
| `getPartsRequest` | async | `(id: string): Promise<PartsRequestWithRefs \| null>` | audit | — (internal / other client.ts functions only) |
| `getPartsRequestsForJob` | async | `(jobId: string): Promise<PartsRequestWithRefs[]>` | audit | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `getPartsKnowledge` | async | `(): Promise<PartsKnowledgeEntry[]>` | audit | pages/workshop/PartsKnowledgePage.tsx |
| `openPartsRequest` | async | `(jobId: string): Promise<PartsRequestWithRefs>` | audit | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwPartsPage.tsx |
| `partsAssistantReply` | sync | `(query: string, job: Job):` | none (read) | — (internal / other client.ts functions only) |
| `partsChat` | async | `(requestId: string, text: string): Promise<PartsRequestWithRefs>` | audit | components/parts/PartsChat.tsx |
| `attachPart` | async | `(requestId: string, partId: string, qty = 1, note?: string): Promise<PartsRequestWithRefs>` | audit, comms thread | components/parts/PartsChat.tsx |
| `submitPartsRequest` | async | `(requestId: string, note?: string): Promise<PartsRequestWithRefs>` | audit, comms thread | components/parts/PartsChat.tsx |
| `approvePartsRequest` | async | `(requestId: string, note?: string, placeHoldToo = true): Promise<PartsRequestWithRefs>` | audit, comms thread | components/parts/PartsChat.tsx |
| `rejectPartsRequest` | async | `(requestId: string, reason: string): Promise<PartsRequestWithRefs>` | audit | components/parts/PartsChat.tsx |
| `partsById` | sync | `= (id: string): Part \| undefined => store.parts.find((p) => p.id === id);` | none (read) | components/parts/PartsChat.tsx, pages/rs/InventoryPage.tsx |

## E7 Client 360 — universal identifier search + one bundle per client

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getRequests` | async | `(): Promise<ServiceRequest[]>` | none (read) | — (internal / other client.ts functions only) |
| `getRequestsForClient` | async | `(clientId: string): Promise<ServiceRequest[]>` | none (read) | — (internal / other client.ts functions only) |
| `resolveIdentifier` | async | `(query: string): Promise<SearchResults>` | none (read) | components/clients/IdentifierSearch.tsx |
| `getClient360` | async | `(clientId: string): Promise<Client360 \| null>` | email → Outbox | pages/clients/Client360Page.tsx |
| `getClientDirectory` | async | `(): Promise<ClientDirectoryRow[]>` | audit | pages/clients/ClientsPage.tsx |

## E8 RolliConnect — client portal. Same store, client-scoped reads, a handful of client-initiated writes

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `replayRcEvents` | sync | `(): number` | email → Outbox, localStorage | — (internal / other client.ts functions only) |
| `resetRcEvents` | async | `(): Promise<void>` | audit, email → Outbox, localStorage | pages/SetupPage.tsx |
| `portalRequestMagicLink` | async | `(email: string): Promise<` | audit, email → Outbox, localStorage | pages/rc/RcLoginPage.tsx |
| `portalRedeemMagicLink` | async | `(token: string): Promise<Client>` | audit, localStorage | pages/rc/RcAuthPage.tsx |
| `portalGetSession` | async | `(): Promise<` | audit, localStorage | rc/RcSession.tsx |
| `portalSignOut` | async | `(): Promise<void>` | audit, localStorage | rc/RcSession.tsx |
| `PORTAL_STATUS` | sync | `: Record<PortalStatusKey,` | none (read) | — (internal / other client.ts functions only) |
| `REQUEST_CLOSE_REASONS` | sync | `:` | none (read) | components/clients/SideSections.tsx, pages/rc/RcRequestsCard.tsx |
| `portalCloseRequest` | async | `(clientId: string, id: string, reason: RequestCloseReason, duplicateOfId?: string): Promise<PortalRequest>` | audit, email → Outbox, localStorage | pages/rc/RcRequestsCard.tsx |
| `closeRequest` | async | `(id: string, reason: RequestCloseReason, note?: string, duplicateOfId?: string): Promise<ServiceRequest>` | audit | components/clients/SideSections.tsx |
| `portalGetHome` | async | `(clientId: string): Promise<PortalHome>` | audit, comms thread, job status | pages/rc/RcHomePage.tsx, pages/rc/RcMessagesPage.tsx |
| `portalGetWatch` | async | `(clientId: string, watchId: string): Promise<PortalWatch>` | audit, comms thread, job status | pages/rc/RcWatchPage.tsx |
| `portalGetEstimate` | async | `(clientId: string, id: string): Promise<EstimateWithRefs>` | audit, comms thread, job status | pages/rc/RcEstimatePage.tsx |
| `portalApproveEstimate` | async | `(clientId: string, id: string): Promise<EstimateWithRefs>` | email → Outbox, localStorage | pages/rc/RcEstimatePage.tsx |
| `portalDeclineEstimate` | async | `(clientId: string, id: string, reason: string): Promise<EstimateWithRefs>` | audit, email → Outbox, localStorage | pages/rc/RcEstimatePage.tsx |
| `portalGetInvoice` | async | `(clientId: string, id: string): Promise<SalesOrderWithRefs>` | audit, comms thread | pages/rc/RcInvoicePage.tsx |
| `portalPayBalance` | async | `(clientId: string, id: string): Promise<SalesOrderWithRefs>` | audit, email → Outbox, localStorage | pages/rc/RcInvoicePage.tsx |
| `portalConfirmPickupWindow` | async | `(clientId: string, id: string, date: string, slot: PickupWindow['slot'], note?: string): Promise<SalesOrderWithRefs>` | audit, email → Outbox, localStorage | pages/rc/RcInvoicePage.tsx |
| `portalSubmitShippingInfo` | async | `(clientId: string, id: string, address: Address, phone: string): Promise<SalesOrderWithRefs>` | audit, email → Outbox, localStorage | pages/rc/RcInvoicePage.tsx |
| `portalGetMessages` | async | `(clientId: string): Promise<Message[]>` | audit, email → Outbox, localStorage | pages/rc/RcMessagesPage.tsx |
| `portalSendMessage` | async | `(clientId: string, text: string, watchId?: string): Promise<Message>` | audit, email → Outbox, localStorage | pages/rc/RcMessagesPage.tsx |
| `getStaffInbox` | async | `(): Promise<StaffInboxThread[]>` | audit, email → Outbox | — (internal / other client.ts functions only) |
| `getStaffInboxUnread` | async | `(): Promise<number>` | audit, email → Outbox | — (internal / other client.ts functions only) |
| `markThreadRead` | async | `(clientId: string): Promise<void>` | audit, email → Outbox, localStorage | — (internal / other client.ts functions only) |
| `replyToClient` | async | `(clientId: string, text: string, watchId?: string, replayBy?: string): Promise<Message>` | audit, email → Outbox, localStorage | — (internal / other client.ts functions only) |

## E9 RS modules

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getVendors` | async | `(): Promise<Vendor[]>` | audit | pages/rs/PurchasingPage.tsx |
| `getVendor` | async | `(id: string): Promise<Vendor \| null>` | audit | — (internal / other client.ts functions only) |
| `saveVendor` | async | `(input: Omit<Vendor, 'id' \| 'active'> &` | audit | pages/rs/PurchasingPage.tsx |
| `setVendorActive` | async | `(id: string, active: boolean): Promise<Vendor>` | audit, email → Outbox | pages/rs/PurchasingPage.tsx |
| `getPurchaseOrders` | async | `(): Promise<PurchaseOrderWithRefs[]>` | audit, email → Outbox | pages/rs/PurchasingPage.tsx |
| `getPurchaseOrder` | async | `(id: string): Promise<PurchaseOrderWithRefs \| null>` | audit, email → Outbox | — (internal / other client.ts functions only) |
| `createPurchaseOrder` | async | `(input:` | audit, email → Outbox | pages/rs/PurchasingPage.tsx |
| `sendPurchaseOrder` | async | `(id: string): Promise<PurchaseOrderWithRefs>` | audit, email → Outbox | pages/rs/PurchasingPage.tsx |
| `cancelPurchaseOrder` | async | `(id: string, reason: string): Promise<PurchaseOrderWithRefs>` | audit | pages/rs/PurchasingPage.tsx |
| `receivePurchaseOrder` | async | `(id: string, qtyByLine: Record<string, number>): Promise<PurchaseOrderWithRefs>` | audit | pages/rs/PurchasingPage.tsx |
| `getLocations` | async | `(): Promise<StockLocation[]>` | audit | pages/SetupRsPanels.tsx, pages/rs/InventoryPage.tsx, pages/rs/PurchasingPage.tsx |
| `getStockRows` | async | `(): Promise<StockRow[]>` | audit | pages/rs/InventoryPage.tsx |
| `getLowStock` | async | `(): Promise<StockRow[]>` | audit | — (internal / other client.ts functions only) |
| `getStockMovements` | async | `(partId?: string): Promise<StockMovement[]>` | audit, label queue | pages/rs/InventoryPage.tsx |
| `adjustStock` | async | `(partId: string, locationId: string, delta: number, reason: string): Promise<StockMovement>` | audit, label queue | pages/rs/InventoryPage.tsx |
| `getCycleCounts` | async | `(): Promise<CycleCount[]>` | audit, label queue | pages/rs/InventoryPage.tsx |
| `startCycleCount` | async | `(locationId: string): Promise<CycleCount>` | audit, label queue | pages/rs/InventoryPage.tsx |
| `postCycleCount` | async | `(id: string, counted: Record<string, number>): Promise<CycleCount>` | audit, label queue | pages/rs/InventoryPage.tsx |
| `queueLabelsFor` | async | `(kind: 'estimate' \| 'job' \| 'watch', ids: string[]): Promise<LabelJob[]>` | audit, label queue | pages/rs/RsPages.tsx |
| `getReport` | async | `(key: 'funnel' \| 'throughput' \| 'aging' \| 'pnl' \| 'completions'): Promise<Report>` | none (read) | pages/rs/RsPages.tsx |
| `reportToCsv` | sync | `= (r: Report): string => [r.columns.join(','), ...r.rows.map((row) => r.columns.map((c) =>` | audit | pages/rs/RsPages.tsx |
| `getQboQueue` | async | `(): Promise<QboQueueRow[]>` | audit | pages/rs/RsPages.tsx |
| `exportAccountingCsv` | async | `(kind: 'invoices' \| 'payments' \| 'qbo'): Promise<string>` | audit | pages/rs/RsPages.tsx |
| `getIntegrations` | async | `(): Promise<IntegrationTile[]>` | audit | pages/rs/RsPages.tsx |
| `adminSaveUser` | async | `(input: UserAdminInput &` | audit | pages/SetupRsPanels.tsx |
| `adminDeactivateUser` | async | `(id: string): Promise<void>` | audit | pages/SetupRsPanels.tsx |
| `getCatalogAdmin` | async | `(): Promise<(CatalogService &` | audit | pages/SetupRsPanels.tsx |
| `saveCatalogService` | async | `(input:` | audit | pages/SetupRsPanels.tsx |
| `retireCatalogService` | async | `(id: string, retired = true): Promise<void>` | audit | pages/SetupRsPanels.tsx |
| `MERGE_FIELDS` | const | `fixture re-export` | none (read) | pages/SetupRsPanels.tsx |
| `getTemplates` | async | `(): Promise<MessageTemplate[]>` | audit | pages/SetupRsPanels.tsx |
| `saveTemplate` | async | `(key: TemplateKey, subject: string, body: string): Promise<MessageTemplate>` | audit | pages/SetupRsPanels.tsx |
| `EVIDENCE_SLOTS` | sync | `:` | none (read) | components/companion/CompanionTabs.tsx, components/jobs/EvidencePanel.tsx, pages/rw/RwQcPage.tsx |
| `PARTS_GRADES` | sync | `: PartsGrade[] = ['B', 'Ø/REPL', 'D/REPL'];` | none (read) | components/jobs/EvidencePanel.tsx |
| `EVIDENCE_REQUIRED` | sync | `: Record<JobKind, EvidenceSlot[]>` | none (read) | components/jobs/EvidencePanel.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwQcPage.tsx |
| `evidenceGaps` | sync | `= (j: Job): EvidenceSlot[] => (j.status !== 'testing' ? [] : EVIDENCE_REQUIRED[j.kind].filter((s) => !rs.evidence.some((e) => e.jobId === j.id && e.slot === s)));` | audit, email → Outbox, job status | components/jobs/EvidencePanel.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwQcPage.tsx |
| `getEvidenceForJob` | async | `(jobId: string): Promise<EvidenceItem[]>` | none (read) | components/companion/CompanionTabs.tsx, components/jobs/EvidencePanel.tsx |
| `getEvidenceForWatch` | async | `(watchId: string): Promise<(EvidenceItem &` | none (read) | components/jobs/EvidencePanel.tsx |
| `getEvidenceForClient` | async | `(clientId: string): Promise<(EvidenceItem &` | audit | components/jobs/EvidencePanel.tsx |
| `captureEvidence` | async | `(jobId: string, input: EvidenceInput): Promise<EvidenceItem>` | audit | components/jobs/EvidencePanel.tsx |

## E10 Companion panel — SCRIPTED assistant over fixtures (no model)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `LABEL_PILLS` | const | `fixture re-export` | none (read) | components/companion/CompanionTabs.tsx |
| `resolveModel` | sync | `= (text: string): PriceMemoryAnswer['resolution'] =>` | audit | — (internal / other client.ts functions only) |
| `priceMemory` | async | `(query: string): Promise<PriceMemoryAnswer>` | audit | components/companion/CompanionTabs.tsx |
| `verifyPrice` | async | `(partId: string): Promise<PriceCandidate>` | audit | components/companion/CompanionTabs.tsx |
| `getClientBrief` | async | `(clientId: string): Promise<ClientBrief>` | none (read) | components/companion/CompanionTabs.tsx |
| `correctBriefLine` | async | `(clientId: string, key: BriefLineKey, text: string, original: string): Promise<BriefCorrection>` | audit | components/companion/CompanionTabs.tsx |
| `getBriefCorrections` | async | `(clientId: string): Promise<BriefCorrection[]>` | audit | — (internal / other client.ts functions only) |
| `getKnowledgeCards` | async | `(): Promise<KnowledgeCard[]>` | audit | components/companion/CompanionTabs.tsx |
| `getRoutedQuestions` | async | `(): Promise<(RoutedQuestion &` | audit | components/companion/CompanionTabs.tsx |
| `askShop` | async | `(query: string): Promise<AskAnswer>` | audit | components/companion/CompanionTabs.tsx |
| `routeQuestion` | async | `(query: string): Promise<RoutedQuestion>` | audit | components/companion/CompanionTabs.tsx |
| `answerQuestion` | async | `(questionId: string, title: string, body: string, tags: string[]): Promise<KnowledgeCard>` | audit | components/companion/CompanionTabs.tsx |
| `getPhotoLabels` | async | `(photoId?: string): Promise<PhotoLabel[]>` | audit | components/companion/CompanionTabs.tsx |
| `labelPhoto` | async | `(input:` | audit | components/companion/CompanionTabs.tsx |
| `companionCanSeeMoney` | sync | `= canSeeMoney;` | audit | — (internal / other client.ts functions only) |

## E14 Comms hub — one thread-space per client; Outbox-only sends; reply-token routing (mocked)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getInbox` | async | `(view: InboxView, userId?: string): Promise<ConversationWithRefs[]>` | audit | pages/InboxPage.tsx |
| `getInboxCounts` | async | `(userId?: string): Promise<Record<InboxView, number>>` | audit | pages/InboxPage.tsx |
| `getClientFolder` | async | `(clientId: string): Promise<ConversationWithRefs[]>` | audit | pages/InboxPage.tsx |
| `getThread` | async | `(id: string): Promise<ThreadView>` | audit | pages/InboxPage.tsx |
| `markConversationRead` | async | `(id: string): Promise<void>` | audit | pages/InboxPage.tsx |
| `assignConversation` | async | `(id: string, assignee: Assignee \| null): Promise<ConversationWithRefs>` | audit | pages/InboxPage.tsx |
| `snoozeConversation` | async | `(id: string, untilIso: string): Promise<ConversationWithRefs>` | audit | pages/InboxPage.tsx |
| `wakeConversation` | async | `(id: string): Promise<ConversationWithRefs>` | audit | pages/InboxPage.tsx |
| `closeConversation` | async | `(id: string): Promise<ConversationWithRefs>` | audit | pages/InboxPage.tsx |
| `reopenConversation` | async | `(id: string): Promise<ConversationWithRefs>` | audit | pages/InboxPage.tsx |
| `createConversation` | async | `(clientId: string, subject: string, anchor?: ConversationAnchor): Promise<ConversationWithRefs>` | audit | — (internal / other client.ts functions only) |
| `renderTemplate` | async | `(conversationId: string, key: TemplateKey): Promise<RenderedTemplate>` | audit, email → Outbox, comms thread | pages/InboxPage.tsx |
| `replyInThread` | async | `(id: string, input:` | audit, email → Outbox, comms thread | pages/InboxPage.tsx |
| `addThreadNote` | async | `(id: string, text: string): Promise<ConvMessage>` | audit, comms thread | pages/InboxPage.tsx |
| `simulateInboundReply` | async | `(id: string, text: string): Promise<ConvMessage>` | audit, email → Outbox, comms thread | pages/InboxPage.tsx |
| `threadNeedsReplyFor` | sync | `= (anchor: ConversationAnchor): ConversationWithRefs \| undefined =>` | email → Outbox | components/jobs/JobBits.tsx, pages/estimates/EstimatesListPage.tsx |
| `clientNeedsReplyCount` | sync | `= (clientId: string) => cx.conversations.filter((c) => c.clientId === clientId && convNeedsReply(c)).length;` | email → Outbox | — (internal / other client.ts functions only) |
| `threadsNeedingReplyForUser` | sync | `= (me: User) =>` | audit, email → Outbox | — (internal / other client.ts functions only) |
| `getCommsUnread` | async | `(): Promise<number>` | email → Outbox | — (internal / other client.ts functions only) |

## E15 Portal-first inspection report (MH 2026-09-25): emails notify, the portal renders

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `REPORT_COMPONENTS` | const | `fixture re-export` | none (read) | components/jobs/InspectionReportPanel.tsx |
| `COMPONENT_GRADES` | sync | `: ComponentGrade[] = ['good', 'fair', 'worn', 'replace'];` | none (read) | components/jobs/InspectionReportPanel.tsx |
| `getInspectionReportsForJob` | async | `(jobId: string): Promise<InspectionReportDoc[]>` | audit, email → Outbox, comms thread, job status | components/jobs/InspectionReportPanel.tsx |
| `issueInspectionReport` | async | `(jobId: string, grades:` | audit, email → Outbox, comms thread, job status | components/jobs/InspectionReportPanel.tsx |
| `portalGetInspectionReport` | async | `(token: string): Promise<PortalInspectionReport>` | audit, comms thread, job status | pages/rc/RcReportPage.tsx |
| `portalDecideInspectionReport` | async | `(token: string, decision: 'approve' \| 'decline', reason?: string): Promise<PortalInspectionReport>` | audit, comms thread, job status | pages/rc/RcReportPage.tsx |

## E12 RolliTime timing bench (NEW automation — legacy never had it)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `TIMING_POSITIONS` | const | `fixture re-export` | none (read) | pages/rt/RtTestPage.tsx |
| `toleranceForWatch` | sync | `= (w: Watch): CaliberTolerance => fx.caliberTolerances.find((c) => c.refPrefixes.some((p) => w.reference.toUpperCase().startsWith(p.toUpperCase()))) ?? fx.GENERIC_TOLERANCE;` | audit, email → Outbox, job status | pages/rt/RtQueuePage.tsx, pages/rt/RtTestPage.tsx |
| `evaluateTiming` | sync | `= (tol: CaliberTolerance, input: Pick<TimingInput, 'readings' \| 'powerReserve'>): TimingEvaluation &` | audit, email → Outbox, job status | pages/rt/RtTestPage.tsx |
| `getTestingQueue` | async | `(): Promise<JobWithRefs[]>` | none (read) | pages/rt/RtQueuePage.tsx |
| `findJobByLabel` | async | `(scan: string): Promise<JobWithRefs \| null>` | none (read) | pages/rt/RtQueuePage.tsx, pages/rw/RwEvidencePage.tsx |
| `getTimingTests` | async | `(filter:` | audit, email → Outbox | components/jobs/TimingCard.tsx, pages/rt/RtTestPage.tsx |
| `recordTimingTest` | async | `(jobId: string, input: TimingInput): Promise<TimingTest>` | audit, email → Outbox, job status | pages/rt/RtTestPage.tsx |

## E13 RGTime `/rg` — NFC-tap time-clock (phone PWA). In Keeper RGTime owns staff identity (D-026); here it reads the same `users` fixture.

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `KIOSK_SERVICES` | const | `fixture re-export` | none (read) | pages/kiosk/KioskSteps.tsx |
| `KIOSK_BRANDS` | const | `fixture re-export` | none (read) | pages/kiosk/KioskPage.tsx, pages/kiosk/KioskSteps.tsx |
| `RG_DIVISION_LABEL` | const | `fixture re-export` | none (read) | pages/RequestsPage.tsx, pages/rg/RgClockPage.tsx, pages/rg/RgHomePage.tsx, pages/rg/RgManagerPage.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwShell.tsx |
| `rgGetSession` | sync | `= (): User \| null =>` | localStorage | pages/rg/RgShell.tsx |
| `rgAllStaff` | sync | `= (): User[] => [...fx.users];` | localStorage | pages/rg/RgManagerPage.tsx, pages/rg/RgShell.tsx |
| `rgSignIn` | async | `(userId: string, password: string): Promise<User>` | localStorage | pages/rg/RgShell.tsx |
| `rgSignOut` | async | `(): Promise<void>` | localStorage | pages/rg/RgShell.tsx |
| `rgVerifyManager` | async | `(userId: string, password: string): Promise<User>` | none (read) | pages/rg/RgManagerPage.tsx |
| `getNfcTags` | sync | `= (): NfcTag[] => fx.nfcTags.map((t) => (` | none (read) | pages/rg/RgHomePage.tsx |
| `getNfcTag` | sync | `= (id: string): NfcTag \| undefined => fx.nfcTags.find((t) => t.id === id);` | none (read) | pages/rg/RgClockPage.tsx |
| `getClockState` | async | `(userId: string): Promise<ClockState>` | none (read) | pages/rg/RgClockPage.tsx, pages/rg/RgHomePage.tsx |
| `punchClock` | async | `(tagId: string, simulated: boolean): Promise<Punch>` | none (read) | pages/rg/RgClockPage.tsx |
| `getTodayBoard` | async | `(division: Division): Promise<ClockState[]>` | none (read) | — (internal / other client.ts functions only) |
| `getWeekHours` | async | `(division: Division, weekOffset: number): Promise<WeekView>` | audit | pages/rg/RgManagerPage.tsx |

## E13 Kiosk `/kiosk` — public walk-in check-in (legacy kiosk, improved: match existing clients instead of duplicating)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `submitKioskCheckIn` | async | `(input: KioskSubmission): Promise<KioskResult>` | comms thread | pages/kiosk/KioskPage.tsx |
| `getRequestsQueue` | async | `(): Promise<RequestRow[]>` | audit | pages/RequestsPage.tsx |
| `resolveKioskMatch` | async | `(requestId: string, decision: 'confirm' \| 'split'): Promise<RequestRow>` | audit | pages/RequestsPage.tsx |

## E11 RolliWorking `/rw` — two-lane floor (legacy RW research, reference not gospel)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getRwFloorMap` | async | `(): Promise<RwFloorMap>` | none (read) | pages/rw/RwFloorPage.tsx |

_Total exports: 297._