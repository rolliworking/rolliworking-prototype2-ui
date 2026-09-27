# 05 — API CONTRACT (target surface for the real backend)

Every exported function of `src/api/client.ts`, generated from the code (`_gen.py`). Screens only ever call these. In KEEPER each `async` entry becomes an HTTP endpoint (or RPC); each `sync` helper becomes either a server-computed field or a shared pure function.

Columns: **kind** (async = crosses the wire; sync = pure/derived; const = lookup table) · **signature** as written · **side effects** detected in the body (audit rows, Outbox email, comms thread, job status change, label queue, localStorage) · **callers** (screens / components that call `api.<name>`).

Read with `04-DATA-MODEL-VS-KEEPER.md` for the shapes and `08-AUDIT-TAXONOMY.md` for what "audit" means per call.


## Station (device-bound)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getSessionDivision` | sync | `= (): Division => readStation()?.division ?? 'rolliworks';` | audit | components/companion/CompanionPanel.tsx, components/rw/RwBits.tsx, components/rw/bench/BenchLock.tsx, pages/InboxPage.tsx, pages/RequestsPage.tsx, pages/rs/PurchasingPage.tsx, pages/rw/RwBulkAssignPage.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwShell.tsx |
| `getStation` | async | `(): Promise<Station \| null>` | audit, localStorage | auth/AuthContext.tsx |
| `getStations` | async | `(): Promise<Station[]>` | audit, localStorage | pages/StationSetupPage.tsx |
| `addStation` | async | `(name: string, division: Division = 'rolliworks'): Promise<Station>` | audit, localStorage | pages/StationSetupPage.tsx |
| `registerStation` | async | `(stationId: string, adminUserId: string, password: string): Promise<Station>` | audit, localStorage | pages/StationSetupPage.tsx |
| `renameStation` | async | `(name: string): Promise<Station>` | audit, localStorage | pages/SetupPage.tsx |
| `resetDeviceRegistration` | async | `(): Promise<void>` | audit, localStorage | pages/SetupPage.tsx |

## Division helpers

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getDivisionStaff` | sync | `= (div: Division): User[] =>` | audit, localStorage | components/jobs/ComponentBits.tsx, components/rw/RwBits.tsx, components/rw/bench/BenchLock.tsx, components/today/NewTaskForm.tsx, components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx, components/today/StaffHitListModal.tsx, pages/InboxPage.tsx, pages/rw/RwBulkAssignPage.tsx, pages/rw/RwShell.tsx |
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
| `getWatchesForClient` | async | `(clientId: string): Promise<Watch[]>` | none (read) | components/estimates/EstimateForm.tsx, pages/intake/TradeScanInPage.tsx, pages/rc/RcMessagesPage.tsx |

## Estimates

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getEstimates` | async | `(): Promise<EstimateWithRefs[]>` | none (read) | pages/rs/RsPages.tsx |
| `getEstimate` | async | `(id: string): Promise<EstimateWithRefs \| null>` | none (read) | components/companion/CompanionPanel.tsx, pages/estimates/EstimateDetailPage.tsx |
| `getEstimatesForClient` | async | `(clientId: string): Promise<EstimateWithRefs[]>` | none (read) | pages/jobs/JobCreatePage.tsx |

## Jobs (read)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getJobs` | async | `(): Promise<JobWithRefs[]>` | none (read) | components/clients/CallLedger.tsx, components/layout/CallPop.tsx, components/today/NewTaskForm.tsx, pages/rs/RsPages.tsx |
| `getJob` | async | `(id: string): Promise<JobWithRefs \| null>` | none (read) | components/companion/CompanionPanel.tsx, components/companion/CompanionTabs.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwJobPage.tsx, pages/rw/testing/RwTestingTestPage.tsx |
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
| `totalsFor as computeEstimateTotals` **[post-E16]** | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |
| `ESTIMATE_TAX_RATE_DISPLAY` | sync | `= TAX_RATE_UNAPPLIED;` | audit | — (internal / other client.ts functions only) |
| `getServiceCatalog` | async | `(): Promise<CatalogService[]>` | none (read) | components/estimates/LineEditor.tsx |
| `searchEstimates` | async | `(query: string, status?: EstimateStatus \| 'all'): Promise<EstimateWithRefs[]>` | none (read) | pages/estimates/EstimatesListPage.tsx |
| `getQuoteContext` | async | `(clientId: string, watchId?: string, excludeId?: string): Promise<QuoteContext>` | none (read) | components/estimates/EstimateModals.tsx, pages/estimates/EstimateCreatePage.tsx |
| `createClient` | async | `(input: NewClientInput): Promise<Client>` | none (read) | components/clients/NewClientFromCall.tsx, components/estimates/EstimateForm.tsx |
| `createWatch` | async | `(clientId: string, input: NewWatchInput): Promise<Watch>` | audit | components/estimates/EstimateForm.tsx |
| `createEstimate` | async | `(input: EstimateInput): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateCreatePage.tsx |
| `updateEstimate` | async | `(id: string, patch: EstimatePatch): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `reviseEstimate` | async | `(id: string, patch: EstimatePatch): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx |
| `duplicateEstimate` | async | `(id: string): Promise<EstimateWithRefs>` | audit | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `deleteEstimate` | async | `(id: string): Promise<void>` | audit, email → Outbox | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `markEstimateSent` | async | `(id: string): Promise<EstimateWithRefs>` | audit, email → Outbox | pages/estimates/EstimateDetailPage.tsx |
| `sendEstimate` | async | `(id: string, override?:` | audit, email → Outbox | components/estimates/EstimateModals.tsx |
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
| `awaitingComponents` | sync | `= (j: Job) => j.status === 'in_service' && !activeHold(j) && componentsDone(j) > 0 && componentsOutstanding(j).length > 0;` | none (read) | components/jobs/ComponentBits.tsx, components/jobs/JobBoard.tsx, pages/rw/RwWmPage.tsx, pages/rw/RwWorkQueuePage.tsx, pages/workshop/BenchPage.tsx |
| `canCompleteComponent` | sync | `= (j: Job) => j.status === 'in_service' && !activeHold(j);` | none (read) | components/jobs/ComponentBits.tsx |
| `isTradeJob` **[post-E16]** | sync | `= (j: Job) => j.kind === 'trade';` | audit, email → Outbox, job status | — (internal / other client.ts functions only) |
| `isInternalTrade` **[post-E16]** | sync | `= (clientId: string) => !!byId(fx.clients, clientId).internal;` | none (read) | components/jobs/JobBits.tsx |
| `TRADE_SEND_BACK` **[post-E16]** | sync | `:` | none (read) | components/jobs/JobBits.tsx |
| `activeHold` | sync | `= (j: Job): JobHold \| undefined => j.holds.find((h) => !h.releasedAt);` | audit | components/jobs/JobBits.tsx, components/jobs/JobBoard.tsx, components/jobs/JobPanels.tsx, components/rw/pad/PadJobs.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwWmPage.tsx, pages/workshop/BenchPage.tsx, pages/workshop/SupervisorPage.tsx |
| `legalJobActions` | sync | `(j: Job): JobAction[]` | audit, email → Outbox | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `canHold` | sync | `= (j: Job) => !activeHold(j) && j.simpleStatus === 'on_hand' && HOLDABLE.includes(j.status);` | audit | components/jobs/JobPanels.tsx |
| `transitionJob` | async | `(id: string, actionKey: string, reason?: string): Promise<JobWithRefs>` | audit, email → Outbox, job status | components/dashboard/TradeReviewPanel.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwQcPage.tsx |
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
| `updateSalesOrder` | async | `(id: string, patch: SalesOrderPatch): Promise<SalesOrderWithRefs>` | audit, email → Outbox | pages/sales/SalesOrderDetailPage.tsx |

## Send invoice + mock hosted payment page (Intuit placeholder)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `payLinkPath` **[post-E16]** | sync | `= (o: SalesOrder) => `/pay/$` | audit, job status | pages/rc/RcInvoicePage.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `payLinkUrl` **[post-E16]** | sync | `= (o: SalesOrder) => `$` | audit, email → Outbox | — (internal / other client.ts functions only) |
| `sendInvoice` **[post-E16]** | async | `(id: string): Promise<SalesOrderWithRefs>` | audit, email → Outbox | pages/sales/SalesOrderDetailPage.tsx |
| `getPayPage` **[post-E16]** | async | `(token: string): Promise<PayPage>` | audit | pages/PayPage.tsx |
| `payViaLink` **[post-E16]** | async | `(token: string, amount: number): Promise<PayPage>` | audit | pages/PayPage.tsx |
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
| `portalDeepLink` **[post-E16]** | sync | `= (clientId: string, next: string): string =>` | audit, localStorage | — (internal / other client.ts functions only) |
| `portalRevokeLink` **[post-E16]** | async | `(token: string): Promise<void>` | audit, localStorage | — (internal / other client.ts functions only) |
| `portalRedeemMagicLink` | async | `(token: string): Promise<Client>` | audit, localStorage | pages/rc/RcAuthPage.tsx |
| `portalGetSession` | async | `(): Promise<` | audit, localStorage | rc/RcSession.tsx |
| `portalSignOut` | async | `(): Promise<void>` | audit, localStorage | rc/RcSession.tsx |

## View as client — staff opens the portal exactly as the client sees it (same read functions, so nothing staff-only can leak)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `startViewAsClient` **[post-E16]** | async | `(clientId: string, returnTo: string): Promise<string>` | audit, localStorage | components/clients/ViewAsClientButton.tsx |
| `exitViewAsClient` **[post-E16]** | async | `(): Promise<string>` | audit, localStorage | rc/RcShell.tsx |

## Portal "Your requests" overview + client-facing photo sections

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `portalPhotoSections` **[post-E16]** | sync | `= (clientId: string, jobId: string): PortalPhotoSections =>` | none (read) | — (internal / other client.ts functions only) |
| `portalGetPhotoSections` **[post-E16]** | async | `(clientId: string, jobId: string): Promise<PortalPhotoSections>` | none (read) | rc/RcPhotoSections.tsx |
| `portalGetRequestCards` **[post-E16]** | async | `(clientId: string): Promise<PortalRequestCard[]>` | none (read) | pages/rc/RcHomePage.tsx |
| `PORTAL_STATUS` | sync | `: Record<PortalStatusKey,` | none (read) | — (internal / other client.ts functions only) |
| `REQUEST_CLOSE_REASONS` | sync | `:` | none (read) | components/clients/SideSections.tsx, pages/rc/RcRequestsCard.tsx |
| `portalCloseRequest` | async | `(clientId: string, id: string, reason: RequestCloseReason, duplicateOfId?: string): Promise<PortalRequest>` | audit, email → Outbox, localStorage | pages/rc/RcRequestsCard.tsx |
| `closeRequest` | async | `(id: string, reason: RequestCloseReason, note?: string, duplicateOfId?: string): Promise<ServiceRequest>` | audit | components/clients/SideSections.tsx |
| `portalGetHome` | async | `(clientId: string): Promise<PortalHome>` | audit | pages/rc/RcHomePage.tsx, pages/rc/RcMessagesPage.tsx |
| `portalGetWatch` | async | `(clientId: string, watchId: string): Promise<PortalWatch>` | audit | pages/rc/RcWatchPage.tsx |
| `portalGetEstimate` | async | `(clientId: string, id: string): Promise<EstimateWithRefs>` | audit | pages/rc/RcEstimatePage.tsx |
| `SHOP_ADDRESS` **[post-E16]** | sync | `` | audit | rc/RcSendWatch.tsx |
| `portalRequestLabel` **[post-E16]** | async | `(clientId: string, estimateId: string, address: Address): Promise<ShipmentWithRefs>` | audit | rc/RcSendWatch.tsx |
| `portalDropOff` **[post-E16]** | async | `(clientId: string, estimateId: string): Promise<EstimateWithRefs>` | audit, comms thread, job status | rc/RcSendWatch.tsx |
| `portalRequestRequote` **[post-E16]** | async | `(clientId: string, estimateId: string): Promise<EstimateWithRefs>` | audit, comms thread, job status | pages/rc/RcEstimatePage.tsx |
| `portalApproveEstimate` | async | `(clientId: string, id: string): Promise<EstimateWithRefs>` | email → Outbox, localStorage | pages/rc/RcEstimatePage.tsx |
| `portalDeclineEstimate` | async | `(clientId: string, id: string, reason: string): Promise<EstimateWithRefs>` | audit, email → Outbox, localStorage | pages/rc/RcEstimatePage.tsx |
| `portalGetInvoice` | async | `(clientId: string, id: string): Promise<SalesOrderWithRefs>` | audit, comms thread | pages/rc/RcInvoicePage.tsx |
| `portalPayBalance` | async | `(clientId: string, id: string): Promise<SalesOrderWithRefs>` | audit, email → Outbox, localStorage | — (internal / other client.ts functions only) |
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

## Personal templates (point-of-use editing). Resolution order for a STAFF send: actor's personal variant → shop default. System sends: shop default only.

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `personalTemplateFor` **[post-E16]** | sync | `= (key: TemplateKey, owner = actor().by): PersonalTemplate \| undefined => rs.personalTemplates.find((p) => p.key === key && p.owner === owner);` | audit | components/comms/TemplateEdit.tsx, pages/InboxPage.tsx |
| `getPersonalTemplates` **[post-E16]** | async | `(): Promise<PersonalTemplate[]>` | audit | — (internal / other client.ts functions only) |
| `getAllPersonalTemplates` **[post-E16]** | async | `(): Promise<PersonalTemplate[]>` | audit | pages/SetupRsPanels.tsx |
| `getTemplateVariants` **[post-E16]** | async | `(key: TemplateKey): Promise<PersonalTemplate[]>` | audit | — (internal / other client.ts functions only) |
| `savePersonalTemplate` **[post-E16]** | async | `(key: TemplateKey, subject: string, body: string): Promise<PersonalTemplate>` | audit | components/comms/TemplateEdit.tsx, pages/InboxPage.tsx |
| `deletePersonalTemplate` **[post-E16]** | async | `(key: TemplateKey): Promise<void>` | audit | components/comms/TemplateEdit.tsx |
| `unrenderTemplate` **[post-E16]** | sync | `= (text: string, vals: Record<string, string>) => Object.entries(vals).filter(([, v]) => v && v.length > 2).sort((a, b) => b[1].length - a[1].length).reduce((t, [f, v]) => t.split(v).join(f), text);` | email → Outbox, comms thread | components/comms/TemplateEdit.tsx, pages/InboxPage.tsx |
| `renderTemplate` | async | `(conversationId: string, key: TemplateKey, shopDefault = false): Promise<RenderedTemplate>` | audit, email → Outbox, comms thread | pages/InboxPage.tsx |
| `renderTemplateForEstimate` **[post-E16]** | async | `(estimateId: string, shopDefault = false): Promise<RenderedTemplate &` | audit, email → Outbox, comms thread | components/estimates/EstimateModals.tsx |
| `mergeValuesForConversation` **[post-E16]** | async | `(conversationId: string): Promise<Record<string, string>>` | audit, email → Outbox, comms thread | pages/InboxPage.tsx |
| `replyInThread` | async | `(id: string, input:` | audit, email → Outbox, comms thread | pages/InboxPage.tsx |
| `addThreadNote` | async | `(id: string, text: string): Promise<ConvMessage>` | audit, comms thread | pages/InboxPage.tsx |
| `simulateInboundReply` | async | `(id: string, text: string): Promise<ConvMessage>` | audit, comms thread | pages/InboxPage.tsx |
| `threadNeedsReplyFor` | sync | `= (anchor: ConversationAnchor): ConversationWithRefs \| undefined =>` | email → Outbox | components/jobs/JobBits.tsx, pages/estimates/EstimatesListPage.tsx |
| `clientNeedsReplyCount` | sync | `= (clientId: string) => cx.conversations.filter((c) => c.clientId === clientId && convNeedsReply(c)).length;` | comms thread | — (internal / other client.ts functions only) |
| `threadsNeedingReplyForUser` | sync | `= (me: User) =>` | audit, email → Outbox | — (internal / other client.ts functions only) |
| `getCommsUnread` | async | `(): Promise<number>` | email → Outbox | — (internal / other client.ts functions only) |

## E15 Portal-first inspection report (MH 2026-09-25): emails notify, the portal renders

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `REPORT_COMPONENTS` | const | `fixture re-export` | none (read) | components/jobs/InspectionReportPanel.tsx |
| `COMPONENT_GRADES` | sync | `: ComponentGrade[] = ['good', 'fair', 'worn', 'replace'];` | none (read) | components/jobs/InspectionReportPanel.tsx |
| `INSPECTION_SURVEY` **[post-E16]** | sync | `= ['How would you like us to reach you with updates?', 'Anything we should know about this watch?'];` | email → Outbox | pages/rc/RcReportPage.tsx |
| `getInspectionDecisions` **[post-E16]** | async | `(filter:` | email → Outbox | components/jobs/JobDecisionRecords.tsx, pages/rc/RcWatchPage.tsx |
| `portalAskAboutReport` **[post-E16]** | async | `(token: string, text: string): Promise<Message>` | email → Outbox | pages/rc/RcReportPage.tsx |
| `getInspectionReportsForJob` | async | `(jobId: string): Promise<InspectionReportDoc[]>` | audit, email → Outbox, comms thread, job status | components/jobs/InspectionReportPanel.tsx |
| `issueInspectionReport` | async | `(jobId: string, grades:` | audit, email → Outbox, comms thread, job status | components/jobs/InspectionReportPanel.tsx |
| `portalGetInspectionReport` | async | `(token: string): Promise<PortalInspectionReport>` | job status | pages/rc/RcReportPage.tsx |
| `portalDecideInspectionReport` | async | `(token: string, decision: 'approve' \| 'decline', reason?: string, input?: DecisionInput): Promise<PortalInspectionReport>` | audit, comms thread, job status | pages/rc/RcReportPage.tsx |

## E12 RolliTime timing bench (NEW automation — legacy never had it)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `TIMING_POSITIONS` | const | `fixture re-export` | none (read) | pages/rw/testing/RwTestingTestPage.tsx |
| `toleranceForWatch` | sync | `= (w: Watch): CaliberTolerance => fx.caliberTolerances.find((c) => c.refPrefixes.some((p) => w.reference.toUpperCase().startsWith(p.toUpperCase()))) ?? fx.GENERIC_TOLERANCE;` | audit, email → Outbox, job status | pages/rw/testing/RwTestingQueuePage.tsx, pages/rw/testing/RwTestingTestPage.tsx |
| `evaluateTiming` | sync | `= (tol: CaliberTolerance, input: Pick<TimingInput, 'readings' \| 'powerReserve'>): TimingEvaluation &` | audit, email → Outbox, job status | pages/rw/testing/RwTestingTestPage.tsx |
| `timingPassed` **[post-E16]** | sync | `= (j: Job): TimingTest \| undefined =>` | none (read) | pages/rw/RwQcPage.tsx |
| `testingStationScan` **[post-E16]** | async | `(label: string): Promise<JobWithRefs>` | none (read) | pages/rw/testing/RwTestingQueuePage.tsx |
| `getTestingQueue` | async | `(): Promise<JobWithRefs[]>` | none (read) | pages/rw/testing/RwTestingQueuePage.tsx |
| `findJobByLabel` | async | `(scan: string): Promise<JobWithRefs \| null>` | none (read) | pages/rw/RwBulkAssignPage.tsx, pages/rw/RwEvidencePage.tsx |
| `getTimingTests` | async | `(filter:` | email → Outbox | components/jobs/TimingCard.tsx, pages/rw/testing/RwTestingTestPage.tsx |
| `recordTimingTest` | async | `(jobId: string, input: TimingInput): Promise<TimingTest>` | audit, email → Outbox | pages/rw/testing/RwTestingTestPage.tsx |

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
| `getRwFloorMap` | async | `(): Promise<RwFloorMap>` | none (read) | — (internal / other client.ts functions only) |

## E18 RW deep build — shop floor core (parts = components with station/status/custody/history)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `RW_STATIONS` **[post-E16]** | const | `fixture re-export` | none (read) | components/rw/RwBits.tsx, components/rw/pad/PadJobs.tsx, pages/rw/RwFloorPage.tsx, pages/rw/RwStationScanPage.tsx, pages/rw/RwWmPage.tsx, pages/rw/RwWorkQueuePage.tsx |
| `getShopFloor` **[post-E16]** | async | `(filter?:` | audit | pages/rw/RwFloorPage.tsx |
| `movePart` **[post-E16]** | async | `(jobId: string, key: ComponentKey, to: RwStationKey, via: PartMove['via'] = 'drag'): Promise<FloorDot>` | none (read) | pages/rw/RwFloorPage.tsx, pages/rw/RwWmPage.tsx |
| `SCAN_UNDO_MS` **[post-E16]** | sync | `= 10_000;` | audit, job status | components/rw/AuditPanel.tsx |
| `undoScanComplete` **[post-E16]** | async | `(token: string): Promise<FloorDot>` | audit, job status | components/rw/AuditPanel.tsx |
| `markReunited` **[post-E16]** | async | `(jobId: string, key: ComponentKey): Promise<FloorDot>` | audit, job status | — (internal / other client.ts functions only) |
| `finishGate` **[post-E16]** | sync | `= (j: Job): string[] => finishBlockers(j);` | audit, job status | — (internal / other client.ts functions only) |
| `finishJob` **[post-E16]** | async | `(jobId: string): Promise<JobWithRefs>` | audit, job status | pages/rw/RwFloorPage.tsx |
| `getPartHistory` **[post-E16]** | async | `(jobId: string, key: ComponentKey): Promise<PartHistoryView>` | audit, email → Outbox, job status | pages/rw/RwFloorPage.tsx |
| `parseTechCode` **[post-E16]** | sync | `= (code: string): User \| undefined =>` | audit, email → Outbox, job status | pages/rw/RwBulkAssignPage.tsx |
| `getScanSession` **[post-E16]** | sync | `= (): ScanSession => rw18.scanSession;` | audit, email → Outbox, job status | pages/rw/RwBulkAssignPage.tsx |
| `scanTech` **[post-E16]** | async | `(code: string): Promise<ScanSession>` | audit, email → Outbox, job status | pages/rw/RwBulkAssignPage.tsx |
| `scanLabelAssign` **[post-E16]** | async | `(label: string): Promise<ScanSession>` | audit, email → Outbox, job status | pages/rw/RwBulkAssignPage.tsx |
| `undoOutbox` **[post-E16]** | async | `(id: string): Promise<void>` | audit, email → Outbox, comms thread | pages/rw/RwBulkAssignPage.tsx |
| `getQueuedOutbox` **[post-E16]** | async | `(): Promise<OutboxEmail[]>` | email → Outbox, comms thread | pages/rw/RwBulkAssignPage.tsx |
| `getWorkQueue` **[post-E16]** | async | `(): Promise<WorkQueueRow[]>` | comms thread | pages/rw/RwWorkQueuePage.tsx |
| `simulateClientReply` **[post-E16]** | async | `(jobId?: string): Promise<string>` | comms thread | pages/rw/RwWorkQueuePage.tsx |
| `clearClientReplied` **[post-E16]** | sync | `= (jobId: string) =>` | audit | — (internal / other client.ts functions only) |
| `getWmRoom` **[post-E16]** | async | `(userId: string): Promise<` | audit | pages/rw/RwWmPage.tsx |
| `sendPartByScan` **[post-E16]** | async | `(label: string, to: 'safe' \| 'refinish', key?: ComponentKey): Promise<FloorDot>` | audit | pages/rw/RwWmPage.tsx |
| `requestPartSimple` **[post-E16]** | async | `(jobId: string, description: string, qty: number, source: PartsRequest['source'] = 'wm'): Promise<PartsRequestWithRefs>` | audit | pages/rw/RwWmPage.tsx |
| `getStationMemory` **[post-E16]** | sync | `= () => rw18.stationMemory;` | job status | pages/rw/RwStationScanPage.tsx |
| `stationScan` **[post-E16]** | async | `(station: RwStationKey, label: string): Promise<FloorDot>` | job status | pages/rw/RwStationScanPage.tsx |
| `getPadBoard` **[post-E16]** | async | `(): Promise<PadCard[]>` | job status | pages/rw/RwPadPage.tsx |
| `padAdvance` **[post-E16]** | async | `(jobId: string): Promise<JobWithRefs>` | job status | components/rw/pad/PadJobs.tsx |
| `padSendBack` **[post-E16]** | async | `(jobId: string, reason: SendBackReason, note?: string): Promise<JobWithRefs>` | audit, job status | components/rw/pad/PadJobs.tsx |
| `SEND_BACK_REASONS` **[post-E16]** | sync | `= SEND_BACK_LABEL;` | audit | components/rw/pad/PadJobs.tsx |
| `partSuggestions` **[post-E16]** | sync | `= (jobId: string, q: string): PartSuggestion[] =>` | audit | — (internal / other client.ts functions only) |
| `recordPartPick` **[post-E16]** | sync | `= (jobId: string, partId: string) =>` | audit | — (internal / other client.ts functions only) |
| `submitPadPartsRequest` **[post-E16]** | async | `(jobId: string, items:` | audit | — (internal / other client.ts functions only) |
| `getApprovalsQueue` **[post-E16]** | async | `(): Promise<(PartsRequestWithRefs &` | audit | — (internal / other client.ts functions only) |
| `approvalAction` **[post-E16]** | async | `(requestId: string, action: 'approve' \| 'decline' \| 'on_order' \| 'received', note?: string): Promise<PartsRequestWithRefs>` | audit | components/rw/pad/PadReview.tsx |
| `getPickingQueue` **[post-E16]** | async | `(): Promise<` | audit | pages/rw/RwPickingPage.tsx |
| `pickAction` **[post-E16]** | async | `(taskId: string, action: 'picked' \| 'short' \| 'found', location?: string): Promise<PickTaskView>` | audit | pages/rw/RwPickingPage.tsx |
| `getJobPhotoViews` **[post-E16]** | async | `(jobId: string): Promise<JobPhotoView[]>` | audit | components/rw/RwBits.tsx, components/rw/pad/PadJobs.tsx |
| `PHOTO_SLOTS` **[post-E16]** | sync | `:` | none (read) | components/rw/pad/PadCamera.tsx |
| `capturePadPhoto` **[post-E16]** | async | `(jobId: string, dataUrl: string, slotKey: string): Promise<JobWithRefs>` | audit | components/rw/pad/PadCamera.tsx |
| `getRoomPartsHistory` **[post-E16]** | async | `(): Promise<(PartsRequestWithRefs &` | none (read) | components/rw/pad/PadHistory.tsx |
| `getRoomSummary` **[post-E16]** | async | `(): Promise<RoomSummary>` | none (read) | pages/rw/RwPadPage.tsx |
| `PART_LABELS` **[post-E16]** | sync | `= PART_LABEL;` | none (read) | pages/rw/RwWorkQueuePage.tsx |

## Supervisor Pad v2 — Jobs (tech override + condition) · Parts (caliber query, reference search, M3KE) · Review (manager gate)

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `caliberOf` **[post-E16]** | sync | `= (ref: string) => fx.caliberForReference(ref);` | none (read) | components/rw/pad/PadJobs.tsx |
| `getPadPartsContext` **[post-E16]** | async | `(label: string): Promise<PadPartsContext>` | none (read) | components/rw/pad/PadParts.tsx, pages/rw/RwPadPage.tsx |
| `padSearchParts` **[post-E16]** | sync | `= (ref: string, caliber: string \| undefined, q: string): PadSuggestion[] =>` | none (read) | components/rw/pad/PadParts.tsx, components/rw/pad/PadReview.tsx |
| `padRecordSelection` **[post-E16]** | sync | `= (ref: string, caliber: string \| undefined, part: Part, description: string) =>` | audit | components/rw/pad/PadParts.tsx |
| `submitPadRequest` **[post-E16]** | async | `(jobId: string, items: PartsRequestItem[]): Promise<PartsRequestWithRefs>` | audit | components/rw/pad/PadParts.tsx |
| `getPadRequests` **[post-E16]** | async | `(): Promise<PartsRequestWithRefs[]>` | audit | pages/rw/RwPadPage.tsx |
| `getReviewQueue` **[post-E16]** | async | `(): Promise<` | audit | components/rw/pad/PadReview.tsx, pages/rw/RwPadPage.tsx |
| `reviewItem` **[post-E16]** | async | `(requestId: string, index: number, patch:` | audit | components/rw/pad/PadReview.tsx |
| `sendForClientApproval` **[post-E16]** | async | `(requestId: string): Promise<PartsRequestWithRefs>` | audit, email → Outbox, comms thread | components/rw/pad/PadReview.tsx |
| `simulateClientPartsDecision` **[post-E16]** | async | `(requestId: string, decision: 'approve' \| 'decline'): Promise<PartsRequestWithRefs>` | audit, comms thread | components/rw/pad/PadReview.tsx |
| `padAllocate` **[post-E16]** | async | `(requestId: string): Promise<PartsRequestWithRefs>` | audit | components/rw/pad/PadReview.tsx |
| `partsOnHand` **[post-E16]** | sync | `= (partId: string) => store.parts.find((p) => p.id === partId)?.stock ?? 0;` | audit | components/rw/pad/PadReview.tsx |
| `getM3keEvents` **[post-E16]** | async | `(): Promise<M3keEvent[]>` | audit | components/rw/pad/PadReview.tsx |
| `getRoomTechs` **[post-E16]** | sync | `= (): User[] => getDivisionStaff(getSessionDivision()).filter((u) => u.roles.includes('watchmaker') \|\| u.roles.includes('manager') \|\| u.roles.includes('inspector'));` | audit | components/rw/pad/PadJobs.tsx |
| `padSetTech` **[post-E16]** | async | `(jobId: string, shortName: string): Promise<JobWithRefs>` | audit | components/rw/pad/PadJobs.tsx |
| `getPadCondition` **[post-E16]** | async | `(jobId: string): Promise<PadConditionView>` | audit | components/rw/pad/PadJobs.tsx |

## Client request notes — what the client asked for. Badge on cards, pop-up on every scan, mandatory checklist at QC

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `openClientRequests` **[post-E16]** | sync | `= (j: Job): ClientRequest[] => requestsOf(j).filter((r) => !r.check);` | audit | components/jobs/ClientRequests.tsx, components/rw/pad/PadJobs.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `qcRequestGaps` **[post-E16]** | sync | `= (j: Job): ClientRequest[] => (j.status === 'testing' ? openClientRequests(j) : []);` | audit, email → Outbox, job status | components/jobs/ClientRequests.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwQcPage.tsx |
| `addClientRequest` **[post-E16]** | async | `(jobId: string, text: string): Promise<JobWithRefs>` | audit | components/jobs/ClientRequests.tsx |
| `removeClientRequest` **[post-E16]** | async | `(jobId: string, reqId: string): Promise<JobWithRefs>` | audit | components/jobs/ClientRequests.tsx |
| `clientRequestAlert` **[post-E16]** | sync | `= (jobId: string): ClientRequestAlert \| null =>` | audit | pages/rw/RwBulkAssignPage.tsx, pages/rw/RwPadPage.tsx, pages/rw/RwStationScanPage.tsx, pages/rw/RwWmPage.tsx |
| `ackClientRequests` **[post-E16]** | async | `(jobId: string, via: string): Promise<void>` | audit | components/jobs/ClientRequests.tsx |
| `checkClientRequest` **[post-E16]** | async | `(jobId: string, reqId: string, result: 'done' \| 'na', reason?: string): Promise<JobWithRefs>` | audit | components/jobs/ClientRequests.tsx |
| `uncheckClientRequest` **[post-E16]** | async | `(jobId: string, reqId: string): Promise<JobWithRefs>` | audit | components/jobs/ClientRequests.tsx |

## Inbox — staff section: anyone can open a colleague's inbox (read + reply); "Assigned to me" stays the shortcut

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getStaffInboxRows` **[post-E16]** | async | `(): Promise<StaffInboxRow[]>` | audit | pages/InboxPage.tsx |
| `getColleagueInbox` **[post-E16]** | async | `(shortName: string): Promise<ConversationWithRefs[]>` | audit | pages/InboxPage.tsx |

## Inbound shipping (pre-arrival) + tracking lookup. Carrier calls go ONLY through src/api/carriers/parcelpro.ts

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `SHIP_STAGE_LABEL` **[post-E16]** | sync | `: Record<ShipStage, string>` | none (read) | components/shipping/ShippingBits.tsx |
| `getInboundBoard` **[post-E16]** | async | `(): Promise<` | none (read) | pages/shipping/InboundShippingPage.tsx |
| `getShipment` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs \| null>` | audit | components/shipping/ShippingBits.tsx |
| `getShipmentsForClient` **[post-E16]** | async | `(clientId: string): Promise<ShipmentWithRefs[]>` | audit | components/shipping/ShippingBits.tsx |
| `getShipmentForEstimate` **[post-E16]** | async | `(estimateId: string): Promise<ShipmentWithRefs \| null>` | audit | components/shipping/ShippingBits.tsx |
| `prepareLabel` **[post-E16]** | async | `(id: string): Promise<LabelPrep>` | audit | components/shipping/ShippingBits.tsx |
| `createInboundLabel` **[post-E16]** | async | `(id: string, recipient: ShipAddress, declaredValue: number, carrier: ShipCarrierName): Promise<ShipmentWithRefs>` | audit, email → Outbox | components/shipping/ShippingBits.tsx |
| `resendLabelEmail` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | audit | pages/shipping/InboundShippingPage.tsx |
| `followUpLabel` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | audit | pages/shipping/InboundShippingPage.tsx |
| `voidAndReissue` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | audit | pages/shipping/InboundShippingPage.tsx |
| `simulateTrackingEvent` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | audit | components/shipping/ShippingBits.tsx, pages/shipping/InboundShippingPage.tsx |
| `clientStatusLine` **[post-E16]** | sync | `= (s: ShipmentWithRefs): string =>` | none (read) | components/shipping/ShippingBits.tsx |

## Job messages — threaded board ON the job (internal only). @mentions route by tier: manager/concierge → hit list pin; bench → Messages section

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `isManagerTier` **[post-E16]** | sync | `= (u: User) => u.accessTier === 'manager' \|\| u.roles.includes('concierge');` | none (read) | components/jobs/JobMessages.tsx, components/rw/bench/BenchLock.tsx |
| `staffForMention` **[post-E16]** | sync | `= (): User[] => getDivisionStaff(getSessionDivision());` | none (read) | components/jobs/JobMessages.tsx |
| `getJobThreads` **[post-E16]** | async | `(jobId: string): Promise<JobThread[]>` | audit | components/jobs/JobMessages.tsx |
| `postJobMessage` **[post-E16]** | async | `(jobId: string, text: string, opts:` | audit | components/jobs/JobMessages.tsx |
| `getMessageInbox` **[post-E16]** | async | `(userId: string): Promise<MessageInboxRow[]>` | audit, localStorage | pages/rw/RwWmPage.tsx |
| `unreadMessageCount` **[post-E16]** | sync | `= (short: string) => inboxFor(short).filter((r) => r.unread).length;` | audit, localStorage | — (internal / other client.ts functions only) |
| `markJobThreadRead` **[post-E16]** | async | `(rootId: string): Promise<void>` | audit, localStorage | components/rw/bench/BenchMessages.tsx |

## Bench Pad — per-tech board, own numbers only, no money

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `STUCK_WORKING_DAYS` **[post-E16]** | sync | `= 4;` | audit, localStorage | — (internal / other client.ts functions only) |
| `getBenchSettings` **[post-E16]** | sync | `= (): BenchSettings => (` | audit, localStorage | pages/rw/RwBenchPage.tsx |
| `verifySupervisorPin` **[post-E16]** | sync | `= (pin: string) => fx.users.some((u) => u.accessTier === 'manager' && u.pin === pin);` | audit, localStorage | components/rw/bench/BenchSettings.tsx |
| `saveBenchSettings` **[post-E16]** | sync | `= (s: BenchSettings, supervisorPin: string): BenchSettings =>` | audit, localStorage | components/rw/bench/BenchSettings.tsx |
| `setKioskOffline` **[post-E16]** | sync | `= (on: boolean) =>` | audit, localStorage | — (internal / other client.ts functions only) |
| `benchPinIn` **[post-E16]** | async | `(userId: string, pin: string): Promise<User>` | audit, localStorage | components/rw/bench/BenchLock.tsx |
| `cacheBenchBoard` **[post-E16]** | sync | `= (b: BenchBoard) => writeJson(`$` | localStorage | pages/rw/RwBenchPage.tsx |
| `readCachedBenchBoard` **[post-E16]** | sync | `= (userId: string): (BenchBoard &` | none (read) | pages/rw/RwBenchPage.tsx |
| `getBenchBoard` **[post-E16]** | async | `(userId: string): Promise<BenchBoard>` | none (read) | pages/rw/RwBenchPage.tsx |

## Trade lane — scan-in intake (custody starts; no inspection report, no estimate) + division-manager review queue

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getTradeAccounts` **[post-E16]** | async | `(): Promise<Client[]>` | audit, job status | pages/intake/TradeScanInPage.tsx |
| `tradeScanIn` **[post-E16]** | async | `(input: TradeScanInInput): Promise<JobWithRefs>` | audit, job status | pages/intake/TradeScanInPage.tsx |
| `getTradeReviewQueue` **[post-E16]** | async | `(): Promise<TradeReviewRow[]>` | none (read) | components/dashboard/TradeReviewPanel.tsx |
| `TRADE_PATH` **[post-E16]** | sync | `:` | none (read) | components/jobs/JobBits.tsx |
| `tradePathIndex` **[post-E16]** | sync | `= (j: Job): number => (j.status === 'intake' ? 0 : j.status === 'in_service' ? 1 : j.status === 'testing' ? 2 : j.status === 'awaiting_manager_review' ? 3 : 4);` | none (read) | components/jobs/JobBits.tsx |

## Stage / bin audit — what the system believes is at a location vs what is physically scanned

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `AUDIT_LOCATIONS` **[post-E16]** | const | `fixture re-export` | none (read) | — (internal / other client.ts functions only) |
| `valueTierOf` **[post-E16]** | sync | `= (j: Job): ValueTier =>` | audit | — (internal / other client.ts functions only) |
| `getAuditLocations` **[post-E16]** | async | `(): Promise<AuditLocationStatus[]>` | audit | components/rw/AuditPanel.tsx, components/rw/SetupAuditsCard.tsx, pages/rw/RwFloorPage.tsx |
| `getAuditStaleDays` **[post-E16]** | sync | `= () => auditStore.staleDays;` | audit | components/rw/AuditPanel.tsx, components/rw/SetupAuditsCard.tsx |
| `setAuditStaleDays` **[post-E16]** | async | `(n: number): Promise<number>` | audit | components/rw/SetupAuditsCard.tsx |
| `getAuditLive` **[post-E16]** | sync | `= (): AuditLive \| null => auditStore.live;` | audit | components/rw/AuditPanel.tsx, pages/rw/RwStationScanPage.tsx |
| `startAudit` **[post-E16]** | async | `(k: AuditLocationKey): Promise<AuditLive>` | audit | components/rw/AuditPanel.tsx |
| `cancelAudit` **[post-E16]** | async | `(): Promise<void>` | none (read) | components/rw/AuditPanel.tsx |
| `auditScan` **[post-E16]** | async | `(code: string): Promise<` | none (read) | components/rw/AuditPanel.tsx |
| `auditResolve` **[post-E16]** | async | `(itemId: string, resolution: AuditResolution): Promise<AuditLive>` | audit | components/rw/AuditPanel.tsx |
| `finishAudit` **[post-E16]** | async | `(): Promise<AuditSession>` | audit | components/rw/AuditPanel.tsx |
| `getAuditSessions` **[post-E16]** | async | `(): Promise<AuditSession[]>` | audit | components/rw/AuditPanel.tsx, components/rw/SetupAuditsCard.tsx |

## Work grading gate — categories from a Setup lookup; grades are append-only events attributed to job + responsible tech

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `getGradeCategories` **[post-E16]** | async | `(): Promise<GradeCategory[]>` | audit | components/rw/SetupGradingCard.tsx |
| `addGradeCategory` **[post-E16]** | async | `(label: string, hint: string, scopes: GradeScope[]): Promise<GradeCategory>` | audit | components/rw/SetupGradingCard.tsx |
| `toggleGradeCategory` **[post-E16]** | async | `(id: string): Promise<GradeCategory>` | audit | components/rw/SetupGradingCard.tsx |
| `gradeGateFor` **[post-E16]** | sync | `= (j: Job): GradeGate =>` | audit, email → Outbox, job status | — (internal / other client.ts functions only) |
| `getGradeGate` **[post-E16]** | async | `(jobId: string): Promise<GradeGate>` | audit | components/rw/GradeGatePanel.tsx |
| `recordWorkGrade` **[post-E16]** | async | `(jobId: string, categoryId: string, score: GradeScore, opts:` | audit | components/rw/GradeGatePanel.tsx |
| `getWorkGrades` **[post-E16]** | async | `(filter:` | none (read) | — (internal / other client.ts functions only) |
| `techQuality` **[post-E16]** | sync | `= (tech: string, month: string): TechQuality =>` | none (read) | — (internal / other client.ts functions only) |

## Client rating — Attitude / Communication staff-set (concierge+), completed jobs DERIVED; logged old→new. Internal only: no portal read function touches this.

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `clientRatingSync` **[post-E16]** | sync | `= (clientId: string): ClientRating =>` | none (read) | components/clients/RatingBadge.tsx |
| `getClientRating` **[post-E16]** | async | `(clientId: string): Promise<ClientRating>` | audit | — (internal / other client.ts functions only) |
| `setClientRating` **[post-E16]** | async | `(clientId: string, input:` | audit | components/clients/RatingBadge.tsx |

## Call ledger (mock of Vonage VIP, both directions later). Every call = a comms event on the client; missed calls weigh like unanswered email.

| export | kind | signature | side effects | callers |
|---|---|---|---|---|
| `receiveInboundCall` **[post-E16]** | async | `(ev: InboundCallEvent): Promise<ScreenPop>` | audit, comms thread | — (internal / other client.ts functions only) |
| `getCallEvents` **[post-E16]** | async | `(filter: CallFilter \| string` | audit, comms thread | components/clients/CallLedger.tsx |
| `callCountsSync` **[post-E16]** | sync | `= (clientId?: string, jobId?: string): CallCounts =>` | audit, comms thread | components/clients/CallLedger.tsx |
| `getCallCounts` **[post-E16]** | async | `(clientId?: string, jobId?: string): Promise<CallCounts>` | audit, comms thread | — (internal / other client.ts functions only) |
| `logCall` **[post-E16]** | async | `(input:` | audit, comms thread | components/clients/CallLedger.tsx |
| `addCallNote` **[post-E16]** | async | `(id: string, text: string): Promise<CallEvent>` | audit, comms thread | components/clients/CallLedger.tsx, components/layout/CallPop.tsx |
| `linkCallToJob` **[post-E16]** | async | `(id: string, jobId?: string): Promise<CallEvent>` | audit, comms thread | components/clients/CallLedger.tsx, components/layout/CallPop.tsx |
| `getMissedCalls` **[post-E16]** | async | `(): Promise<MissedCallRow[]>` | comms thread | components/layout/MissedCallsPanel.tsx |
| `resolveMissedCall` **[post-E16]** | async | `(id: string, resolution: 'called_back' \| 'handled', note?: string): Promise<CallEvent>` | comms thread | components/layout/MissedCallsPanel.tsx |

_Total exports: 461 · baseline at E16: 296 · **[post-E16] new: 165**._

Post-E16 exports (diff list for coverage): `totalsFor as computeEstimateTotals`, `isTradeJob`, `isInternalTrade`, `TRADE_SEND_BACK`, `payLinkPath`, `payLinkUrl`, `sendInvoice`, `getPayPage`, `payViaLink`, `portalDeepLink`, `portalRevokeLink`, `startViewAsClient`, `exitViewAsClient`, `portalPhotoSections`, `portalGetPhotoSections`, `portalGetRequestCards`, `SHOP_ADDRESS`, `portalRequestLabel`, `portalDropOff`, `portalRequestRequote`, `personalTemplateFor`, `getPersonalTemplates`, `getAllPersonalTemplates`, `getTemplateVariants`, `savePersonalTemplate`, `deletePersonalTemplate`, `unrenderTemplate`, `renderTemplateForEstimate`, `mergeValuesForConversation`, `INSPECTION_SURVEY`, `getInspectionDecisions`, `portalAskAboutReport`, `timingPassed`, `testingStationScan`, `RW_STATIONS`, `getShopFloor`, `movePart`, `SCAN_UNDO_MS`, `undoScanComplete`, `markReunited`, `finishGate`, `finishJob`, `getPartHistory`, `parseTechCode`, `getScanSession`, `scanTech`, `scanLabelAssign`, `undoOutbox`, `getQueuedOutbox`, `getWorkQueue`, `simulateClientReply`, `clearClientReplied`, `getWmRoom`, `sendPartByScan`, `requestPartSimple`, `getStationMemory`, `stationScan`, `getPadBoard`, `padAdvance`, `padSendBack`, `SEND_BACK_REASONS`, `partSuggestions`, `recordPartPick`, `submitPadPartsRequest`, `getApprovalsQueue`, `approvalAction`, `getPickingQueue`, `pickAction`, `getJobPhotoViews`, `PHOTO_SLOTS`, `capturePadPhoto`, `getRoomPartsHistory`, `getRoomSummary`, `PART_LABELS`, `caliberOf`, `getPadPartsContext`, `padSearchParts`, `padRecordSelection`, `submitPadRequest`, `getPadRequests`, `getReviewQueue`, `reviewItem`, `sendForClientApproval`, `simulateClientPartsDecision`, `padAllocate`, `partsOnHand`, `getM3keEvents`, `getRoomTechs`, `padSetTech`, `getPadCondition`, `openClientRequests`, `qcRequestGaps`, `addClientRequest`, `removeClientRequest`, `clientRequestAlert`, `ackClientRequests`, `checkClientRequest`, `uncheckClientRequest`, `getStaffInboxRows`, `getColleagueInbox`, `SHIP_STAGE_LABEL`, `getInboundBoard`, `getShipment`, `getShipmentsForClient`, `getShipmentForEstimate`, `prepareLabel`, `createInboundLabel`, `resendLabelEmail`, `followUpLabel`, `voidAndReissue`, `simulateTrackingEvent`, `clientStatusLine`, `isManagerTier`, `staffForMention`, `getJobThreads`, `postJobMessage`, `getMessageInbox`, `unreadMessageCount`, `markJobThreadRead`, `STUCK_WORKING_DAYS`, `getBenchSettings`, `verifySupervisorPin`, `saveBenchSettings`, `setKioskOffline`, `benchPinIn`, `cacheBenchBoard`, `readCachedBenchBoard`, `getBenchBoard`, `getTradeAccounts`, `tradeScanIn`, `getTradeReviewQueue`, `TRADE_PATH`, `tradePathIndex`, `AUDIT_LOCATIONS`, `valueTierOf`, `getAuditLocations`, `getAuditStaleDays`, `setAuditStaleDays`, `getAuditLive`, `startAudit`, `cancelAudit`, `auditScan`, `auditResolve`, `finishAudit`, `getAuditSessions`, `getGradeCategories`, `addGradeCategory`, `toggleGradeCategory`, `gradeGateFor`, `getGradeGate`, `recordWorkGrade`, `getWorkGrades`, `techQuality`, `clientRatingSync`, `getClientRating`, `setClientRating`, `receiveInboundCall`, `getCallEvents`, `callCountsSync`, `getCallCounts`, `logCall`, `addCallNote`, `linkCallToJob`, `getMissedCalls`, `resolveMissedCall`