# 05 — API CONTRACT (target surface for the real backend)

Every exported function of `src/api/client.ts`, generated from the code (`_gen.py`). Screens only ever call these. In KEEPER each `async` entry becomes an HTTP endpoint (or RPC); each `sync` helper becomes either a server-computed field or a shared pure function.

Columns: **kind** (async = crosses the wire; sync = pure/derived; const = lookup table) · **signature** as written · **source** = `real` when `API_SOURCE[name] === 'real'` in `src/api/config.ts` (served by `realClient.ts`, mock fallback on failure) else `mock` · **auth expected** = best reading of what the real endpoint must require: `staff` (device session + role check) · `station` (station token — kiosks/pads) · `client-portal` (RolliConnect session or deep-link token) · `token` (tokened public pages: `/pay/:token`, `/rc/pickup/:token`, LINK-tier estimate / parts pages) · `public` (the public form POST — rate-limit, no session) · `owner` (MH only — `isOwnerSync`) · `webhook` (provider → server, signed) · `none` · **side effects** detected in the body · **callers**.

Tags: **[post-E16]** = not in the E16 baseline; **[post-refresh]** = added after the 2026-09-29 refresh (`_baseline_refresh.txt`); **[v2]** = added 2026-09-30 → 2026-10-02 (`_baseline_refresh2.txt`).

Read with `04-DATA-MODEL-VS-KEEPER.md` for the shapes and `08-AUDIT-TAXONOMY.md` for what "audit" means per call.


## B2B client reference (their barcode / internal tracking #) — captured at Receive Watch, lives on the estimate, threads into every client email subject for that job

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `clientRefSubject` **[post-E16]** **[post-refresh]** | sync | `= (subject: string, ref?: string) => (ref?.trim() ? `[REF: $` | mock | staff | audit, email → Sent | components/estimates/EstimateModals.tsx |
| `setClientRef` **[post-E16]** **[post-refresh]** | async | `(estimateId: string, ref: string): Promise<EstimateWithRefs>` | mock | staff | none (read) | pages/estimates/EstimateDetailPage.tsx |
| `setJobClientRef` **[post-E16]** **[post-refresh]** | async | `(jobId: string, ref: string): Promise<void>` | mock | staff | none (read) | components/jobs/ItemHeader.tsx |
| `jobClientRef` **[post-E16]** **[post-refresh]** | sync | `= (j: Job &` | mock | staff | audit, localStorage | components/jobs/ItemHeader.tsx |

## Station (device-bound)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `isReceptionMode` **[post-E16]** **[post-refresh]** | sync | `= (): boolean =>` | mock | none | none (read) | components/layout/AppShell.tsx, components/layout/TopBar.tsx |
| `receptionSource` **[post-E16]** **[post-refresh]** | sync | `= (): 'query' \| 'station' \| null => (sessionStorage.getItem(RECEPTION_OVERRIDE) !== null ? 'query' : readStation()?.receptionMode ? 'station' : null);` | mock | none | none (read) | components/layout/TopBar.tsx |
| `getSessionDivision` | sync | `= (): Division => readStation()?.division ?? 'rolliworks';` | mock | staff | none (read) | components/companion/CompanionPanel.tsx, components/jobs/JobTabs.tsx, components/requests/RequestSheet.tsx, components/rs/VendorForm.tsx, components/rw/RwBits.tsx, components/rw/bench/BenchLock.tsx, pages/RequestsPage.tsx, pages/rw/RwBulkAssignPage.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwShell.tsx |
| `getStation` | async | `(): Promise<Station \| null>` | mock | none | none (read) | auth/AuthContext.tsx |
| `getStations` | async | `(): Promise<Station[]>` | mock | none | none (read) | pages/StationSetupPage.tsx |
| `addStation` | async | `(name: string, division: Division = 'rolliworks'): Promise<Station>` | mock | staff | localStorage | pages/StationSetupPage.tsx |
| `registerStation` | async | `(stationId: string, adminUserId: string, password: string): Promise<Station>` | mock | none | audit, localStorage | pages/StationSetupPage.tsx |
| `renameStation` | async | `(name: string): Promise<Station>` | mock | none | audit, localStorage | pages/SetupPage.tsx |
| `resetDeviceRegistration` | async | `(): Promise<void>` | mock | staff | audit, localStorage | pages/SetupPage.tsx |

## Division helpers

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getDivisionStaff` | sync | `= (div: Division): User[] =>` | mock | staff | none (read) | components/jobs/ComponentBits.tsx, components/jobs/JobTabs.tsx, components/layout/CallPop.tsx, components/layout/MessageComposer.tsx, components/layout/MessageDirectory.tsx, components/layout/ShareCompose.tsx, components/layout/ViewAs.tsx, components/requests/RequestSheet.tsx, components/rw/RwBits.tsx, components/rw/bench/BenchLock.tsx, components/today/FlagTo.tsx, components/today/NewTaskForm.tsx, components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx, components/today/StaffHitListModal.tsx, pages/ChooseViewPage.tsx, pages/TodayPage.tsx, pages/kiosk/WmKioskPage.tsx, pages/rs/CallsPage.tsx, pages/rw/RwBulkAssignPage.tsx, pages/rw/RwShell.tsx |
| `getDivisionRoles` | sync | `= (div: Division): Role[] =>` | mock | staff | audit, localStorage | components/layout/MessageComposer.tsx, components/layout/MessageDirectory.tsx, components/layout/ShareCompose.tsx, components/today/FlagTo.tsx, components/today/NewTaskForm.tsx, components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx |

## Audit log

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getAuditLog` | async | `(): Promise<AuditEvent[]>` | mock | staff | localStorage | pages/AuditLogPage.tsx, pages/SetupPage.tsx |

## Auth / users

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `OWNER_USER_ID` **[post-E16]** **[post-refresh]** | sync | `= 'u-michael';` | mock | staff | localStorage | components/inbox/ViewsSection.tsx, components/layout/ViewAs.tsx, components/setup/AccessLimitsDrawer.tsx, pages/ChooseViewPage.tsx, pages/SignInPage.tsx, pages/TodayPage.tsx, pages/rs/AccessControlPage.tsx, pages/rw/RwShell.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `isOwnerSync` **[post-E16]** **[post-refresh]** | sync | `= (): boolean => realUserSync()?.id === OWNER_USER_ID && !viewAsSync();` | mock | staff | none (read) | components/comms/TemplatesSheet.tsx, pages/InboxPage.tsx, pages/TodayPage.tsx, pages/setup/TemplatesPage.tsx |
| `getViewAs` **[post-E16]** **[post-refresh]** | async | `(): Promise<ViewAsState \| null>` | mock | none | none (read) | auth/AuthContext.tsx |
| `continueAsSelf` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<void>` | mock | staff | audit | components/layout/ViewAs.tsx |
| `startViewAs` **[post-E16]** **[post-refresh]** | async | `(userId: string): Promise<User>` | mock | owner | audit | auth/AuthContext.tsx |
| `stopViewAs` **[post-E16]** **[post-refresh]** | async | `(): Promise<void>` | mock | owner | audit | auth/AuthContext.tsx |
| `getUsers` | async | `(): Promise<User[]>` | mock | staff | none (read) | components/jobs/JobPanels.tsx, pages/SetupPage.tsx, pages/SetupRsPanels.tsx, pages/SignInPage.tsx, pages/StationSetupPage.tsx, pages/jobs/JobCreatePage.tsx |
| `getCurrentUser` | async | `(): Promise<User \| null>` | mock | none | none (read) | auth/AuthContext.tsx |
| `hasSignedInToday` | async | `(userId: string): Promise<boolean>` | mock | none | none (read) | pages/rw/RwShell.tsx |
| `getUsersSignedInToday` | async | `(): Promise<User[]>` | mock | none | audit, localStorage | components/layout/UserSwitcher.tsx, pages/SignInPage.tsx |
| `switchUserWithPin` | async | `(userId: string, pin: string): Promise<User>` | mock | none | audit, localStorage | auth/AuthContext.tsx |
| `signInWithTouchId` **[post-E16]** **[post-refresh]** **[v2]** | async | `(userId: string): Promise<User>` | mock | none | audit, localStorage | auth/AuthContext.tsx |
| `signOut` | async | `(): Promise<void>` | mock | staff | audit, localStorage | auth/AuthContext.tsx |

## Clients

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getClients` | async | `(): Promise<Client[]>` | mock | staff | none (read) | pages/intake/ArrivalPage.tsx |
| `getClient` | async | `(id: string): Promise<Client \| null>` | mock | staff | none (read) | pages/estimates/EstimateCreatePage.tsx |
| `searchClients` | async | `(query: string): Promise<Client[]>` | mock | staff | none (read) | components/estimates/EstimateForm.tsx, components/layout/CallPop.tsx, components/layout/CornerLookup.tsx, components/rw/FloorPanels.tsx, pages/RequestNewPage.tsx |

## Watches

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getWatches` | async | `(): Promise<Watch[]>` | mock | staff | none (read) | pages/rs/RsPages.tsx |
| `getWatchesForClient` | async | `(clientId: string): Promise<Watch[]>` | mock | staff | none (read) | components/estimates/EstimateForm.tsx, pages/intake/TradeScanInPage.tsx, pages/rc/RcMessagesPage.tsx |

## Estimates

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `inMyDivision` **[post-E16]** **[post-refresh]** **[v2]** | sync | `` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getEstimatesForClient` | async | `(clientId: string): Promise<EstimateWithRefs[]>` | mock | staff | none (read) | pages/jobs/JobCreatePage.tsx |

## Jobs (read)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getJobsForClient` | async | `(clientId: string): Promise<JobWithRefs[]>` | mock | staff | none (read) | components/clients/CallLedger.tsx |

## Dashboard

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `saleDateOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (o: SalesOrder): string \| undefined => (o.zeroBalance \|\| o.total <= 0 \|\| o.status === 'draft' \|\| o.status === 'cancelled' ? undefined : o.invoiceSends[0]?.at ?? o.invoiceSentAt ?? o.orderDate /* STAND-IN for seeded ord` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Intake

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `CONTENT_PILLS` | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `CARRIERS` | const | `fixture re-export` | mock | staff | none (read) | pages/intake/ArrivalPage.tsx |
| `BINS` | const | `fixture re-export` | mock | staff | none (read) | pages/intake/WorkOrderPage.tsx |
| `DEPT_LABEL` | const | `fixture re-export` | mock | staff | none (read) | components/estimates/ComponentChain.tsx |
| `DEPT_COMPONENTS` | const | `fixture re-export` | mock | staff | none (read) | components/estimates/ComponentChain.tsx, pages/intake/ReceivePackagePage.tsx |
| `detectCarrier` | sync | `= (tracking: string): Carrier =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getPackage` | async | `(id: string): Promise<PackageWithRefs \| null>` | mock | staff | none (read) | pages/intake/ReceivePackagePage.tsx |
| `getIntakeCounts` | async | `(): Promise<Record<IntakeCountKey, number>>` | mock | staff | none (read) | components/intake/IntakeLayout.tsx |
| `getIntakePhotoQueue` **[post-E16]** **[post-refresh]** | async | `(): Promise<IntakeStepJob[]>` | mock | staff | none (read) | pages/intake/IntakeStepPages.tsx |
| `getAwaitingApprovalQueue` **[post-E16]** **[post-refresh]** | async | `(): Promise<IntakeStepJob[]>` | mock | staff | none (read) | pages/intake/IntakeStepPages.tsx |
| `logArrival` | async | `(input: ArrivalInput): Promise<PackageWithRefs>` | mock | staff | audit | pages/intake/ArrivalPage.tsx |

## Two-scan receive: Scan 1 = arrival + shelf bin (chain of custody starts), Scan 2 = open (feeds Stage 2 · Receive Package)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `SHELF_BINS` **[post-E16]** **[post-refresh]** | sync | `= Array.from(` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getShelf` **[post-E16]** **[post-refresh]** | async | `(): Promise<ShelfRow[]>` | mock | staff | email → Sent | components/intake/TwoScanBits.tsx, pages/intake/ArrivalPage.tsx |
| `shelvePackage` **[post-E16]** **[post-refresh]** | async | `(id: string, input:` | mock | staff | audit | components/intake/TwoScanBits.tsx |
| `openScan` **[post-E16]** **[post-refresh]** | async | `(query: string): Promise<PackageWithRefs>` | mock | staff | audit | components/intake/TwoScanBits.tsx, pages/intake/ReceivePackageListPage.tsx |
| `shelfPackagesSync` **[post-E16]** **[post-refresh]** | sync | `= (clientId: string): Package[] => store.packages.filter((p) => p.clientId === clientId && p.status === 'arrived' && !!p.shelfBin);` | mock | staff | none (read) | components/layout/CornerLookup.tsx |
| `getPackageCustody` **[post-E16]** **[post-refresh]** | async | `(packageId: string): Promise<PackageCustody \| null>` | mock | staff | none (read) | components/intake/TwoScanBits.tsx |
| `lookupEstimate` | async | `(numberOrId: string): Promise<EstimateWithRefs \| null>` | mock | staff | none (read) | components/layout/CornerLookup.tsx, pages/inspection/InspectionFormPage.tsx, pages/intake/ReceivePackagePage.tsx |
| `receivePackage` | async | `(id: string, input: ReceivePackageInput): Promise<` | mock | staff | audit, email → Sent | pages/intake/ReceivePackagePage.tsx |
| `printDropOffReceipt` | async | `(id: string): Promise<PackageWithRefs>` | mock | staff | audit | pages/intake/ReceivePackagePage.tsx |
| `recordWorkOrder` | async | `(id: string, bin: Bin): Promise<PackageWithRefs>` | mock | staff | audit | pages/intake/WorkOrderPage.tsx |
| `findPackageForInspection` | async | `(estimateNumber: string): Promise<PackageWithRefs \| null>` | mock | staff | none (read) | pages/intake/ReceiveWatchListPage.tsx |
| `getInspectionContext` | async | `(packageId: string, itemId?: string): Promise<InspectionContext>` | mock | staff | none (read) | pages/intake/ReceiveWatchPage.tsx |
| `setItemScan` **[post-E16]** **[post-refresh]** | async | `(packageId: string, itemId: string, patch:` | mock | staff | audit | pages/intake/ReceiveWatchPage.tsx |
| `findWatchBySerial` | async | `(reference: string, serial: string): Promise<WatchMatch \| null>` | mock | staff | label queue | pages/intake/ReceiveWatchPage.tsx |
| `computeDiscrepancies` | sync | `(ctx: InspectionContext, input: ReceiveWatchInput): string[]` | mock | staff | none (read) | pages/intake/ReceiveWatchPage.tsx |
| `receiveWatch` | async | `(packageId: string, input: ReceiveWatchInput): Promise<ReceiveWatchResult>` | mock | staff | audit, label queue | pages/intake/ReceiveWatchPage.tsx |
| `getOutbox` | async | `(): Promise<OutboxEmail[]>` | mock | staff | email → Sent | pages/intake/SentPage.tsx |
| `getLabelQueue` | async | `(): Promise<LabelJob[]>` | mock | staff | label queue | pages/intake/LabelQueuePage.tsx, pages/rs/RsPages.tsx |
| `setLabelPrinted` | async | `(id: string, printed: boolean): Promise<LabelJob>` | mock | staff | audit, label queue | components/intake/LabelBits.tsx, pages/intake/LabelQueuePage.tsx |

## Receive Watch extras — watch-label prefill from the serial decode, shared ref·serial scan parser, inspection photos, intake history + post-hoc edit

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `labelModel` **[post-E16]** **[post-refresh]** | sync | `= (watch:` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `parseRefSerial` **[post-E16]** **[post-refresh]** | sync | `= (raw: string):` | mock | staff | none (read) | pages/intake/ReceiveWatchPage.tsx |
| `setItemReceived` **[post-E16]** **[post-refresh]** | async | `(packageId: string, itemId: string, received: boolean): Promise<PackageWithRefs>` | mock | staff | audit | pages/intake/ReceiveWatchPage.tsx |
| `isInspectionPhoto` **[post-E16]** **[post-refresh]** | sync | `= (p: PackagePhoto) => !!p.slot?.startsWith('inspection-');` | mock | staff | none (read) | pages/intake/ReceiveWatchPage.tsx |
| `addPackageInspectionPhoto` **[post-E16]** **[post-refresh]** | async | `(packageId: string, p:` | mock | staff | audit | pages/intake/ReceiveWatchPage.tsx |
| `getIntakeHistory` **[post-E16]** **[post-refresh]** | async | `(q = ''): Promise<IntakeHistoryRow[]>` | mock | staff | label queue | pages/intake/WatchIntakeHistoryPage.tsx |
| `getLabelsForPackage` **[post-E16]** **[post-refresh]** | async | `(packageId: string): Promise<LabelJob[]>` | mock | staff | label queue | — (internal / other client.ts functions only) |
| `updateIntakeRecord` **[post-E16]** **[post-refresh]** | async | `(packageId: string, input: IntakeEditInput): Promise<PackageWithRefs>` | mock | staff | audit, label queue | components/intake/IntakeHistoryBits.tsx |

## Estimates (E3)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `totalsFor as computeEstimateTotals` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `ESTIMATE_TAX_RATE_DISPLAY` | sync | `= TAX_RATE_UNAPPLIED;` | mock | staff | audit | — (internal / other client.ts functions only) |
| `getServiceCatalog` | async | `(): Promise<CatalogService[]>` | mock | staff | none (read) | components/estimates/LineEditor.tsx |
| `searchEstimates` | async | `(query: string, status?: EstimateStatus \| 'all'): Promise<EstimateWithRefs[]>` | mock | staff | none (read) | pages/estimates/EstimatesListPage.tsx |
| `getQuoteContext` | async | `(clientId: string, watchId?: string, excludeId?: string): Promise<QuoteContext>` | mock | staff | none (read) | components/estimates/EstimateModals.tsx, pages/estimates/EstimateCreatePage.tsx |
| `createClient` | async | `(input: NewClientInput): Promise<Client>` | mock | staff | none (read) | components/clients/NewClientFromCall.tsx, components/estimates/EstimateForm.tsx |
| `createWatch` | async | `(clientId: string, input: NewWatchInput): Promise<Watch>` | mock | staff | none (read) | components/estimates/EstimateForm.tsx |
| `createEstimate` | async | `(input: EstimateInput): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateCreatePage.tsx |
| `updateEstimate` | async | `(id: string, patch: EstimatePatch): Promise<EstimateWithRefs>` | mock | staff | none (read) | pages/estimates/EstimateDetailPage.tsx |
| `reviseEstimate` | async | `(id: string, patch: EstimatePatch): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `duplicateEstimate` | async | `(id: string): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `deleteEstimate` | async | `(id: string): Promise<void>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `markEstimateSent` | async | `(id: string): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `sendEstimate` | async | `(id: string, override?:` | mock | staff | audit, email → Sent | components/estimates/EstimateModals.tsx |
| `declineEstimate` | async | `(id: string, reason: string, via: 'staff' \| 'portal' = 'staff'): Promise<EstimateWithRefs>` | mock | staff | audit | components/estimates/EstimateModals.tsx |
| `approveEstimate` | async | `(id: string, via: 'staff' \| 'portal' = 'staff'): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `reopenEstimate` | async | `(id: string): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `convertEstimate` | async | `(id: string, target: 'job' \| 'sales_order' \| 'intake', lineIds?: string[]): Promise<JobWithRefs>` | mock | staff | none (read) | pages/estimates/EstimateDetailPage.tsx, pages/estimates/EstimatesListPage.tsx |
| `calcShipping` | sync | `(i: ShippingCalcInput)` | mock | staff | none (read) | components/estimates/EstimateForm.tsx |

## Jobs (E4) — state machine per PROMPT-PACK-jobs.md

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `JOB_FLOW` | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `DEPT_OF_CODE` | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Per-component completion (MH ruling, first board walk) — decoupled from invoicing

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `ensureComponents` | sync | `= (j: Job): JobComponent[] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `componentsDone` | sync | `= (j: Job) => ensureComponents(j).filter((c) => c.completedAt).length;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `componentsOutstanding` | sync | `= (j: Job): JobComponent[] => ensureComponents(j).filter((c) => !c.completedAt);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `awaitingComponents` | sync | `= (j: Job) => j.status === 'in_service' && !activeHold(j) && componentsDone(j) > 0 && componentsOutstanding(j).length > 0;` | mock | staff | none (read) | components/jobs/ComponentBits.tsx, components/jobs/JobBoard.tsx, pages/rw/RwWmPage.tsx, pages/rw/RwWorkQueuePage.tsx, pages/workshop/BenchPage.tsx |
| `holdBlocks` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job, key?: ComponentKey): JobHold \| undefined =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `canCompleteComponent` | sync | `= (j: Job, key?: ComponentKey) => j.status === 'in_service' && !holdBlocks(j, key);` | mock | staff | none (read) | components/jobs/ComponentBits.tsx |
| `isTradeJob` **[post-E16]** | sync | `= (j: Job) => j.kind === 'trade';` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `isInternalTrade` **[post-E16]** | sync | `= (clientId: string) => !!byId(fx.clients, clientId).internal;` | mock | staff | none (read) | components/jobs/JobBits.tsx |
| `TRADE_SEND_BACK` **[post-E16]** | sync | `:` | mock | staff | none (read) | components/jobs/JobBits.tsx |
| `activeHold` | sync | `= (j: Job): JobHold \| undefined => j.holds.find((h) => !h.releasedAt);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/jobs/JobBits.tsx, components/jobs/JobBoard.tsx, components/jobs/JobDetailContent.tsx, components/jobs/JobPanels.tsx, components/rw/pad/PadJobs.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwWmPage.tsx, pages/workshop/BenchPage.tsx, pages/workshop/SupervisorPage.tsx |
| `legalJobActions` | sync | `(j: Job): JobAction[]` | mock | staff | none (read) | components/jobs/JobDetailContent.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `canHold` | sync | `= (j: Job) => !activeHold(j) && j.simpleStatus === 'on_hand' && HOLDABLE.includes(j.status);` | mock | staff | audit, email → Sent, job status | components/jobs/JobPanels.tsx |
| `transitionJob` | async | `(id: string, actionKey: string, reason?: string): Promise<JobWithRefs>` | mock | staff | audit, email → Sent, job status | components/dashboard/TradeReviewPanel.tsx, components/jobs/JobDetailContent.tsx, pages/intake/IntakeStepPages.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwQcPage.tsx |
| `completeComponent` | async | `(jobId: string, key: ComponentKey): Promise<JobWithRefs>` | mock | staff | audit, job status | components/jobs/ComponentBits.tsx |
| `amendComponentAttribution` | async | `(jobId: string, key: ComponentKey, shortName: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/ComponentBits.tsx |
| `getCompletionsReport` | async | `(): Promise<CompletionsReport>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `completionsThisMonth` | sync | `= (tech: string) =>` | mock | staff | none (read) | pages/workshop/SupervisorPage.tsx |
| `toggleAssignee` | async | `(id: string, shortName: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/JobPanels.tsx |
| `JOB_KIND_CONFIG` | sync | `: Record<JobKind,` | mock | staff | none (read) | components/jobs/EvidencePanel.tsx, components/jobs/InspectionPanel.tsx, components/jobs/JobBits.tsx, components/jobs/JobDetailContent.tsx, components/jobs/JobPanels.tsx, pages/jobs/JobCreatePage.tsx |
| `INSPECTION_QUESTIONS` | sync | `:` | mock | staff | none (read) | components/jobs/InspectionPanel.tsx |
| `reviewGaps` | sync | `(j: Job): string[]` | mock | staff | none (read) | pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `saveInspectionReport` | async | `(id: string, answers: Record<string, string>): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/InspectionPanel.tsx |
| `ROLES` | sync | `: Role[] = ['concierge', 'manager', 'inspector', 'watchmaker', 'polisher', 'band_tech'];` | mock | staff | none (read) | components/jobs/JobPanels.tsx, pages/SetupRsPanels.tsx |
| `roleHolders` | sync | `= (role: Role): User[] => fx.users.filter((u) => holdsRole(u, role));` | mock | staff | none (read) | components/jobs/JobBits.tsx, components/jobs/JobPanels.tsx |
| `setJobOwner` | async | `(id: string, role: Role \| null): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/JobPanels.tsx |
| `placeHold` | async | `(id: string, type: HoldType, reason: string, component?: ComponentKey): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/JobDetailContent.tsx, pages/rw/RwJobPage.tsx |
| `releaseHold` | async | `(id: string, note?: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/JobDetailContent.tsx, pages/rw/RwJobPage.tsx |
| `addJobNote` | async | `(id: string, text: string, origin?: string): Promise<JobWithRefs>` | mock | staff | audit | components/inbox/InboxJobCard.tsx, components/jobs/JobPanels.tsx |

## ONE photo pipeline (D-390). Every entry point ends here: locked (private) by default, typed, stamped. Unlock = client sees it in RolliConnect.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `PHOTO_TYPES` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/jobs/JobPanels.tsx |
| `addJobPhotoSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job, p: AddJobPhotoInput): PackagePhoto & Stamp =>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `addJobPhoto` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string, p: AddJobPhotoInput): Promise<PackagePhoto & Stamp>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `addJobPhotos` | async | `(id: string, photos: PackagePhoto[], photoType: PhotoType = 'bench'): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/JobPanels.tsx |
| `updateJobFields` | async | `(id: string, patch: JobFieldsPatch): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/JobPanels.tsx |
| `searchJobs` | async | `(query: string): Promise<JobWithRefs[]>` | mock | staff | none (read) | components/layout/CornerLookup.tsx, components/layout/MessageComposer.tsx, components/layout/MessageDirectory.tsx, components/rw/FloorPanels.tsx, pages/JobsPage.tsx, pages/inspection/InspectionFormPage.tsx, pages/rw/AssignMovePage.tsx, pages/rw/RwInspectPage.tsx, pages/rw/RwJobsPage.tsx |
| `createJob` | async | `(input: CreateJobInput): Promise<JobWithRefs>` | mock | staff | audit | pages/jobs/JobCreatePage.tsx |
| `lineOpenFor` **[post-E16]** **[post-refresh]** | sync | `= (l: EstimateLine, kind: 'sales_order' \| 'job' \| 'intake') => !l.closedOut && !(l.conversions ?? []).some((c) => famOf(c.kind) === famOf(kind));` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `closeOutEstimateLine` **[post-E16]** **[post-refresh]** | async | `(estimateId: string, lineId: string, reason: string): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `createJobFromEstimate` | async | `(estimateId: string, lineIds?: string[]): Promise<JobWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `convertEstimateToIntake` | async | `(estimateId: string, lineIds?: string[]): Promise<JobWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `deleteJob` | async | `(id: string): Promise<void>` | mock | staff | audit | pages/jobs/JobDetailPage.tsx |
| `invoiceJob` | async | `(id: string): Promise<SalesOrderWithRefs>` | mock | staff | audit | pages/jobs/JobDetailPage.tsx |

## Shop Time: time rows against on_hand jobs; never moves job status

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getShopTime` | async | `(jobId?: string): Promise<ShopTimeEntry[]>` | mock | staff | none (read) | components/jobs/JobPanels.tsx, pages/jobs/ShopTimePage.tsx |
| `getOnHandJobs` | async | `(): Promise<JobWithRefs[]>` | mock | staff | none (read) | pages/jobs/ShopTimePage.tsx |
| `addShopTime` | async | `(jobId: string, minutes: number, note: string): Promise<ShopTimeEntry>` | mock | staff | audit | pages/jobs/ShopTimePage.tsx |

## Tasks (explicit) + /today (derived, no manual curation)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `assigneeLabel` | sync | `= (a: Assignee) => (a.type === 'user' ? a.shortName : a.type === 'station' ? (fx.stations.find((s) => s.id === a.stationId)?.name ?? a.stationId) : `$` | mock | staff | audit | components/jobs/JobPanels.tsx, components/layout/MessageComposer.tsx, components/rw/pad/PadCamera.tsx, components/today/TodayBits.tsx, pages/hitlist/TeamHitlistPage.tsx, pages/intake/ReceiveWatchPage.tsx |
| `getTasks` | async | `(): Promise<Task[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getTasksForJob` | async | `(jobId: string): Promise<Task[]>` | mock | staff | none (read) | components/jobs/JobPanels.tsx |
| `getTasksForClient` | async | `(clientId: string): Promise<Task[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `createTask` | async | `(input: TaskInput): Promise<Task>` | mock | staff | audit | components/today/NewTaskForm.tsx |
| `setTaskDone` | async | `(id: string, done: boolean): Promise<Task>` | mock | staff | audit | components/dashboard/HitListPanel.tsx, pages/TodayPage.tsx, pages/hitlist/TeamHitlistPage.tsx |

## Pinned hit list (manual layer, MH ruling) — never hides derived rows

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `parsePin` | sync | `= (raw: string, fallback: Assignee):` | mock | staff | none (read) | components/today/QuickAddOverlay.tsx |
| `pinToHitList` | async | `(input: PinInput): Promise<PinnedItem>` | mock | staff | audit, hitlist pin | components/today/PinBits.tsx, components/today/QuickAddOverlay.tsx |
| `dismissPinned` | async | `(id: string, reason?: string): Promise<PinnedItem>` | mock | staff | audit | components/dashboard/HitListPanel.tsx, pages/TodayPage.tsx, pages/hitlist/TeamHitlistPage.tsx |

## E5 Sales orders / fulfil / pickup / ship — PROMPT-PACK-invoicing-pickup-ship.md

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `SO_BADGE` | sync | `= (o: SalesOrder): 'picked_up' \| 'shipped' \| 'paid' \| 'unpaid' => (o.pickedUpAt ? 'picked_up' : o.tracking \|\| o.shipDate ? 'shipped' : o.isPaid ? 'paid' : 'unpaid');` | mock | staff | none (read) | components/sales/SalesBits.tsx |
| `tailStage` | sync | `(job: Job): TailStage \| null` | mock | staff | none (read) | components/jobs/ItemHeader.tsx, components/jobs/JobBits.tsx |
| `getSalesOrderForJob` | async | `(jobId: string): Promise<SalesOrderWithRefs \| null>` | mock | staff | none (read) | pages/jobs/JobDetailPage.tsx |
| `findSalesOrders` | async | `(query: string): Promise<SalesOrderWithRefs[]>` | mock | staff | none (read) | pages/sales/PickupStationPage.tsx, pages/sales/SalesOrdersPage.tsx, pages/sales/ShipStationPage.tsx |

## Scan gate (user decision: hard gate + manager override) — an invoice can't be sent for a name-picked customer until the job label is scan-confirmed or a manager overrides with a logged reason

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `soScanGate` **[post-E16]** **[post-refresh]** | sync | `= (o: SalesOrder):` | mock | staff | none (read) | components/sales/ScanGate.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `confirmSoClientByScan` **[post-E16]** **[post-refresh]** | async | `(id: string, raw: string): Promise<SalesOrderWithRefs>` | mock | staff | audit | components/sales/ScanGate.tsx |
| `overrideSoScanGate` **[post-E16]** **[post-refresh]** | async | `(id: string, reason: string): Promise<SalesOrderWithRefs>` | mock | staff | audit | components/sales/ScanGate.tsx |
| `createSalesOrder` | async | `(input: SalesOrderInput): Promise<SalesOrderWithRefs>` | mock | staff | audit | pages/sales/SalesOrderDetailPage.tsx |
| `convertEstimateToSalesOrder` | async | `(estimateId: string, lineIds?: string[]): Promise<SalesOrderWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `updateSalesOrder` | async | `(id: string, patch: SalesOrderPatch): Promise<SalesOrderWithRefs>` | mock | staff | audit | pages/sales/SalesOrderDetailPage.tsx |

## Send invoice + mock hosted payment page (Intuit placeholder)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `payLinkPath` **[post-E16]** | sync | `= (o: SalesOrder) => `/pay/$` | mock | staff | none (read) | pages/rc/RcInvoicePage.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `payLinkUrl` **[post-E16]** | sync | `= (o: SalesOrder) => `$` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `sendInvoice` **[post-E16]** | async | `(id: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | components/sales/pickup/StepsEarly.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `getPayPage` **[post-E16]** | async | `(token: string): Promise<PayPage>` | mock | token | none (read) | pages/PayPage.tsx |
| `payViaLink` **[post-E16]** | async | `(token: string, amount: number): Promise<PayPage>` | mock | token | none (read) | pages/PayPage.tsx |
| `openSalesOrder` | async | `(id: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | pages/sales/SalesOrderDetailPage.tsx |
| `cancelSalesOrder` | async | `(id: string, reason: string): Promise<SalesOrderWithRefs>` | mock | staff | audit | pages/sales/SalesOrderDetailPage.tsx |
| `recordPayment` | async | `(id: string, amount: number, method: PaymentMethod, note?: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | components/sales/SalesBits.tsx |
| `fulfillSalesOrder` | async | `(id: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | components/sales/FulfillMenu.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `setFulfillmentChannel` | async | `(id: string, channel: FulfillmentChannel): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | components/sales/FulfillMenu.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `regeneratePickupCode` | async | `(id: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | pages/sales/SalesOrderDetailPage.tsx |
| `requestShippingInfo` | async | `(id: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | components/sales/FulfillMenu.tsx, pages/sales/SalesOrderDetailPage.tsx, pages/sales/ShipStationPage.tsx |
| `setShippingAddress` | async | `(id: string, address: Address): Promise<SalesOrderWithRefs>` | mock | staff | audit | pages/sales/SalesOrderDetailPage.tsx, pages/sales/ShipStationPage.tsx |

## Shipping seam: the one module a real carrier provider replaces

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `SHIP_CARRIERS` | sync | `: ShipCarrier[] = ['usps', 'ups', 'fedex', 'dhl', 'other'];` | mock | staff | none (read) | pages/sales/ShipStationPage.tsx |
| `normalizeDeclaredValue` | sync | `= (n: number) => (n > 0 && n < 1000 ? n * 1000 : n);` | mock | staff | none (read) | pages/sales/ShipStationPage.tsx |
| `shippingProvider` | sync | `` | mock | staff | none (read) | pages/sales/ShipStationPage.tsx |
| `confirmShipment` | async | `(id: string, input: ConfirmShipmentInput): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | pages/sales/ShipStationPage.tsx |

## Pickup Station v2 — five gated steps (MH 2026-10-01). Every step writes a fact into o.pickupDraft; confirmPickup() re-validates ALL of them before anything leaves.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `PICKUP_FRAMES` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 6;` | mock | staff | none (read) | components/sales/PickupSessionCard.tsx, components/sales/pickup/EvidenceStrip.tsx, components/sales/pickup/StepsLate.tsx, pages/sales/PickupStationPage.tsx |
| `PICKUP_FRAME_WINDOW_MS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 60_000;` | mock | staff | none (read) | components/sales/pickup/EvidenceStrip.tsx, components/sales/pickup/StepsLate.tsx, pages/sales/PickupStationPage.tsx |
| `PICKUP_EVIDENCE_TIMEOUT_MS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 90_000;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `REVERSE_QR_TTL_MS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 2 * 60_000; // ruling 2026-10-01: pickup confirm link = 2 minutes` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `PICKUP_RETENTION` **[post-E16]** **[post-refresh]** **[v2]** | sync | `` | mock | staff | none (read) | components/sales/pickup/StepVerify.tsx, components/sales/pickup/StepsLate.tsx |
| `MOCK_OCR_MAY_PASS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= true; // PROTOTYPE ONLY — Keeper sets false: a placeholder photo must never release a watch` | mock | staff | none (read) | components/sales/pickup/StepsLate.tsx |
| `PICKUP_VERIFY_LABEL` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: Record<PickupVerifyMethod, string>` | mock | staff | none (read) | components/sales/PickupSessionCard.tsx, components/sales/pickup/StepVerify.tsx, components/sales/pickup/StepsLate.tsx |
| `onPickupEvent` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (fn: (e:` | mock | staff | none (read) | components/sales/pickup/EvidenceStrip.tsx, components/sales/pickup/StepVerify.tsx |
| `getApprovingManagers` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<User[]>` | mock | staff | none (read) | components/sales/pickup/PickupBits.tsx |
| `getPickupContext` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<PickupContext>` | mock | staff | none (read) | components/sales/pickup/StepVerify.tsx, components/sales/pickup/StepsEarly.tsx, components/sales/pickup/StepsLate.tsx |
| `pickupStart` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<PickupContext>` | mock | staff | audit | pages/sales/PickupStationPage.tsx |
| `pickupConfirmItem` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, intakePhotoId?: string): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepsEarly.tsx |
| `pickupAbort` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, step: string, reason: string): Promise<PickupContext>` | mock | staff | audit, hitlist pin | components/sales/pickup/StepVerify.tsx, components/sales/pickup/StepsEarly.tsx |
| `pickupApproveBypass` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, input: ManagerApprovalInput): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepsEarly.tsx |
| `pickupResendCode` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, channel: 'email' \| 'sms'): Promise<PickupContext>` | mock | staff | audit, email → Sent, sms (MOCK) | components/sales/pickup/StepVerify.tsx |
| `pickupVerifyCode` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, raw: string, via: 'qr_scan' \| 'code'): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepVerify.tsx |
| `pickupVerifyProxy` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, proxyName: string, idPhoto: PackagePhoto \| undefined, approval: ManagerApprovalInput): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepVerify.tsx |
| `pickupIssueReverseQr` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepVerify.tsx |
| `portalGetPickupConfirm` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<PortalPickupConfirm>` | mock | token | none (read) | pages/rc/RcPickupConfirmPage.tsx |
| `portalConfirmPickup` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<PortalPickupConfirm>` | mock | token | audit | pages/rc/RcPickupConfirmPage.tsx |
| `portalDeclinePickup` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<PortalPickupConfirm>` | mock | token | audit, hitlist pin | pages/rc/RcPickupConfirmPage.tsx |
| `pickupCheckSerial` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, intakePhoto: PackagePhoto, handbackPhoto: PackagePhoto): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepsLate.tsx |
| `pickupOverrideSerial` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, approval: ManagerApprovalInput): Promise<PickupContext>` | mock | staff | audit | components/sales/pickup/StepsLate.tsx |
| `pickupDevQrPayload` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<string>` | mock | staff | none (read) | components/sales/pickup/StepVerify.tsx |
| `pickupSummaryLine` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (s: PickupSession, clientName?: string): string =>` | mock | staff | none (read) | components/sales/PickupSessionCard.tsx, pages/sales/PickupStationPage.tsx |
| `confirmPickup` | async | `(id: string, input: ConfirmPickupInput` | mock | staff | audit, email → Sent | components/sales/pickup/StepsLate.tsx |
| `pickupAppendFrame` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, dataUrl: string): Promise<PickupSession>` | mock | station | audit | components/sales/pickup/EvidenceStrip.tsx |
| `pickupEvidenceSweep` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): number =>` | mock | staff | audit, hitlist pin | — (internal / other client.ts functions only) |
| `jobReleaseLineSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (jobId: string):` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getPickupSession` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<PickupSession \| undefined>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getOpenEvidenceCaptures` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<` | mock | staff | none (read) | components/sales/pickup/EvidenceStrip.tsx |
| `adminMarkComplete` | async | `(id: string, mode: FulfillmentChannel, note: string): Promise<SalesOrderWithRefs>` | mock | staff | audit, job status | pages/sales/SalesOrderDetailPage.tsx |
| `getPickupQueue` | async | `(): Promise<SalesOrderWithRefs[]>` | mock | staff | none (read) | pages/sales/PickupStationPage.tsx |
| `getShipQueue` | async | `(): Promise<SalesOrderWithRefs[]>` | mock | staff | none (read) | pages/sales/ShipStationPage.tsx |

## E6 Workshop lenses: bench, supervisor, floor map

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `pullNextCandidate` | sync | `= (me: string): Job \| null =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getBenchView` | async | `(userId?: string): Promise<BenchView>` | mock | staff | none (read) | pages/rw/RwPartsPage.tsx, pages/workshop/BenchPage.tsx |
| `pullNext` | async | `(): Promise<JobWithRefs>` | mock | staff | audit | pages/workshop/BenchPage.tsx |
| `getSupervisorBoard` | async | `(): Promise<SupervisorBoard>` | mock | staff | none (read) | pages/rw/RwEvidencePage.tsx, pages/rw/RwQcPage.tsx, pages/workshop/SupervisorPage.tsx |
| `supervisorAssign` | async | `(jobId: string, shortNames: string[]): Promise<JobWithRefs>` | mock | staff | audit | pages/workshop/SupervisorPage.tsx |
| `getShopFloorMap` | async | `(): Promise<FloorMap>` | mock | staff | audit | pages/workshop/FloorMapPage.tsx |

## E6 Parts request → scripted assistant → approval loop

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getParts` | async | `(): Promise<Part[]>` | mock | staff | none (read) | pages/rs/PurchasingPage.tsx, pages/workshop/PartsKnowledgePage.tsx |
| `getPartsRequests` | async | `(): Promise<PartsRequestWithRefs[]>` | mock | staff | none (read) | components/rw/pad/PadReview.tsx, pages/rw/RwPartsPage.tsx |
| `getPartsRequest` | async | `(id: string): Promise<PartsRequestWithRefs \| null>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getPartsRequestsForJob` | async | `(jobId: string): Promise<PartsRequestWithRefs[]>` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx |
| `getPartsKnowledge` | async | `(): Promise<PartsKnowledgeEntry[]>` | mock | staff | none (read) | pages/workshop/PartsKnowledgePage.tsx |
| `openPartsRequest` | async | `(jobId: string): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/inbox/InboxJobCard.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwPartsPage.tsx |
| `partsAssistantReply` | sync | `(query: string, job: Job):` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `partsChat` | async | `(requestId: string, text: string): Promise<PartsRequestWithRefs>` | mock | staff | none (read) | components/parts/PartsChat.tsx |
| `attachPart` | async | `(requestId: string, partId: string, qty = 1, note?: string): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/parts/PartsChat.tsx |
| `submitPartsRequest` | async | `(requestId: string, note?: string): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/parts/PartsChat.tsx |
| `approvePartsRequest` | async | `(requestId: string, note?: string, placeHoldToo = true): Promise<PartsRequestWithRefs>` | mock | staff | audit, comms thread | components/parts/PartsChat.tsx |
| `rejectPartsRequest` | async | `(requestId: string, reason: string): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/parts/PartsChat.tsx |
| `partsById` | sync | `= (id: string): Part \| undefined => store.parts.find((p) => p.id === id);` | mock | staff | none (read) | components/parts/PartsChat.tsx, pages/rs/InventoryPage.tsx |

## E7 Client 360 — universal identifier search + one bundle per client

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getRequestsForClient` | async | `(clientId: string): Promise<ServiceRequest[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getClient360` | async | `(clientId: string): Promise<Client360 \| null>` | mock | staff | email → Sent | pages/clients/Client360Page.tsx |
| `getClientDirectory` | async | `(): Promise<ClientDirectoryRow[]>` | mock | staff | audit, localStorage | pages/clients/ClientsPage.tsx |

## E8 RolliConnect — client portal. Same store, client-scoped reads, a handful of client-initiated writes

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `replayRcEvents` | sync | `(): number` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `resetRcEvents` | async | `(): Promise<void>` | mock | staff | localStorage | pages/SetupPage.tsx |
| `portalRequestMagicLink` | async | `(email: string): Promise<` | mock | client-portal | audit, email → Sent, localStorage | — (internal / other client.ts functions only) |
| `portalDeepLink` **[post-E16]** | sync | `= (_clientId: string, next: string): string => `/rc?next=$` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |

## RolliConnect accounts — PASSWORDLESS (MH ruling 2026-10-01): email one-time code / magic link · Touch ID once enrolled · fresh step-up for sensitive actions

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `RC_OTP_TTL_MS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 10 * 60_000; export const RC_OTP_MAX_ATTEMPTS = 5; export const RC_RESEND_COOLDOWN_MS = 60_000; export const RC_REQUESTS_PER_15M = 3; export const RC_STEPUP_TTL_MS = 5 * 60_000;` | mock | staff | localStorage | — (internal / other client.ts functions only) |
| `clientIdByEmailSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (email: string): string \| undefined => clientByEmail(email)?.id;` | mock | staff | none (read) | pages/rc/RcLoginPage.tsx |
| `rcLookup` **[post-E16]** **[post-refresh]** | async | `(email: string): Promise<` | mock | client-portal | none (read) | pages/rc/RcLoginPage.tsx |
| `rcRequestCode` **[post-E16]** **[post-refresh]** **[v2]** | async | `(email: string, opts:` | mock | client-portal | audit, email → Sent, localStorage | pages/rc/RcLoginPage.tsx |
| `rcVerifyCode` **[post-E16]** **[post-refresh]** **[v2]** | async | `(challengeId: string, code: string): Promise<RcVerifyResult>` | mock | client-portal | none (read) | pages/rc/RcLoginPage.tsx, rc/RcAuthBits.tsx |
| `rcVerifyMagicLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(linkToken: string): Promise<RcVerifyResult>` | mock | token | none (read) | pages/rc/RcMagicPage.tsx |
| `rcSignInWithTouchId` **[post-E16]** **[post-refresh]** **[v2]** | async | `(email: string): Promise<Client>` | mock | client-portal | none (read) | pages/rc/RcLoginPage.tsx |
| `rcMarkTouchIdEnrolled` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, on: boolean): Promise<RcAccount>` | mock | client-portal | audit | pages/rc/RcAccountPage.tsx |
| `rcStepUpWithTouchId` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, action: string): Promise<void>` | mock | client-portal | none (read) | rc/RcAuthBits.tsx |
| `rcStepUpStatus` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, action: string): Promise<` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |
| `rcDevPeekCode` **[post-E16]** **[post-refresh]** **[v2]** | async | `(challengeId: string): Promise<` | mock | client-portal | none (read) | rc/RcAuthBits.tsx |
| `rcGetAccount` **[post-E16]** **[post-refresh]** | async | `(clientId: string): Promise<RcAccount \| null>` | mock | client-portal | none (read) | pages/rc/RcAccountPage.tsx, rc/RcAuthBits.tsx |
| `rcListAccounts` **[post-E16]** **[post-refresh]** | async | `(): Promise<(RcAccount &` | mock | client-portal | none (read) | pages/SetupRsPanels.tsx |
| `rcResetAccount` **[post-E16]** **[post-refresh]** | async | `(clientId: string): Promise<void>` | mock | client-portal | audit, localStorage | pages/SetupRsPanels.tsx |

## LINK tier (MH ruling 2026-10-01): a signed, scoped, expiring token opens ONE object for ONE purpose without sign-in. Every send is logged; revoke = "this link has expired — sign in to see your watch."

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `LINK_EXPIRY` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: Record<ClientLinkType, string>` | mock | staff | none (read) | components/rc/ClientLinksCard.tsx, pages/SetupRsPanels.tsx |
| `LINK_EXPIRED_COPY` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 'This link has expired — sign in to see your watch.';` | mock | staff | localStorage | pages/rc/RcReportPage.tsx, rc/RcAuthBits.tsx |
| `clientLinkPath` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (l: ClientLink) => (l.type === 'estimate' ? `/rc/estimates/$` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |
| `getClientLinks` **[post-E16]** **[post-refresh]** **[v2]** | async | `(objectId: string): Promise<ClientLink[]>` | mock | staff | none (read) | components/rc/ClientLinksCard.tsx |
| `sendClientLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(type: ClientLinkType, objectId: string): Promise<ClientLink>` | mock | staff | email → Sent | components/rc/ClientLinksCard.tsx |
| `revokeClientLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<ClientLink>` | mock | client-portal | audit | components/rc/ClientLinksCard.tsx |
| `resolveClientLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<ClientLink>` | mock | token | none (read) | — (internal / other client.ts functions only) |
| `portalGetEstimateByLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<` | mock | token | none (read) | pages/rc/RcEstimatePage.tsx |
| `portalGetPartsByLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(token: string): Promise<` | mock | token | none (read) | pages/rc/RcPartsPage.tsx |
| `rcRequestStepUp` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, action: string): Promise<` | mock | client-portal | none (read) | rc/RcAuthBits.tsx |
| `STEP_UP_ACTION` **[post-E16]** **[post-refresh]** **[v2]** | sync | `` | mock | staff | none (read) | pages/rc/RcEstimatePage.tsx, pages/rc/RcPartsPage.tsx |
| `RC_DOC_META` **[post-E16]** **[post-refresh]** | sync | `: Record<RcDocType,` | mock | staff | none (read) | pages/SetupRsPanels.tsx, rc/RcShell.tsx |
| `rcDocAccess` **[post-E16]** **[post-refresh]** | sync | `= (): Record<RcDocType, RcDocAccess> => (` | mock | client-portal | none (read) | rc/RcShell.tsx |
| `getRcDocAccess` **[post-E16]** **[post-refresh]** | async | `(): Promise<Record<RcDocType, RcDocAccess>>` | mock | client-portal | none (read) | pages/SetupRsPanels.tsx |
| `setRcDocAccess` **[post-E16]** **[post-refresh]** | async | `(t: RcDocType, v: RcDocAccess): Promise<Record<RcDocType, RcDocAccess>>` | mock | staff | audit, localStorage | pages/SetupRsPanels.tsx |
| `rcDocTypeForPath` **[post-E16]** **[post-refresh]** | sync | `= (p: string): RcDocType \| null => (p.startsWith('/rc/estimates/') ? 'estimate' : p.startsWith('/rc/invoices/') ? 'invoice' : p.startsWith('/rc/watches/') ? 'watch' : p.startsWith('/rc/messages') ? 'messages' : p.startsW` | mock | client-portal | none (read) | rc/RcShell.tsx |
| `isPhotoUnlocked` **[post-E16]** **[post-refresh]** | sync | `= (id: string) => !!photoUnlocked()[id];` | mock | staff | none (read) | components/jobs/JobPanels.tsx |
| `setPhotoUnlocked` **[post-E16]** **[post-refresh]** | async | `(jobId: string, photoId: string, unlocked: boolean): Promise<JobPhotoView[]>` | mock | staff | audit, localStorage | components/jobs/JobPanels.tsx, components/rw/RwBits.tsx |
| `portalRevokeLink` **[post-E16]** | async | `(token: string): Promise<void>` | mock | client-portal | localStorage | — (internal / other client.ts functions only) |
| `portalRedeemMagicLink` | async | `(token: string): Promise<Client>` | mock | token | audit, localStorage | — (internal / other client.ts functions only) |
| `portalGetSession` | async | `(): Promise<` | mock | client-portal | none (read) | rc/RcSession.tsx |
| `portalSignOut` | async | `(): Promise<void>` | mock | client-portal | audit, localStorage | rc/RcSession.tsx |

## View as client — staff opens the portal exactly as the client sees it (same read functions, so nothing staff-only can leak)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `startViewAsClient` **[post-E16]** | async | `(clientId: string, returnTo: string): Promise<string>` | mock | owner | audit, localStorage | components/clients/ViewAsClientButton.tsx |
| `exitViewAsClient` **[post-E16]** | async | `(): Promise<string>` | mock | staff | audit, localStorage | rc/RcShell.tsx |

## Portal "Your requests" overview + client-facing photo sections

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `portalPhotoSections` **[post-E16]** | sync | `= (clientId: string, jobId: string): PortalPhotoSections =>` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |
| `portalGetPhotoSections` **[post-E16]** | async | `(clientId: string, jobId: string): Promise<PortalPhotoSections>` | mock | client-portal | none (read) | rc/RcPhotoSections.tsx |
| `portalGetRequestCards` **[post-E16]** | async | `(clientId: string): Promise<PortalRequestCard[]>` | mock | client-portal | none (read) | pages/rc/RcHomePage.tsx |
| `PORTAL_STATUS` | sync | `: Record<PortalStatusKey,` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `REQUEST_CLOSE_REASONS` | sync | `:` | mock | staff | none (read) | components/clients/SideSections.tsx, pages/rc/RcRequestsCard.tsx |
| `portalCloseRequest` | async | `(clientId: string, id: string, reason: RequestCloseReason, duplicateOfId?: string): Promise<PortalRequest>` | mock | client-portal | audit | pages/rc/RcRequestsCard.tsx |
| `closeRequest` | async | `(id: string, reason: RequestCloseReason, note?: string, duplicateOfId?: string): Promise<ServiceRequest>` | mock | staff | audit | components/clients/SideSections.tsx |
| `portalGetHome` | async | `(clientId: string): Promise<PortalHome>` | mock | client-portal | none (read) | pages/rc/RcHomePage.tsx, pages/rc/RcMessagesPage.tsx |
| `portalGetWatch` | async | `(clientId: string, watchId: string): Promise<PortalWatch>` | mock | client-portal | none (read) | pages/rc/RcWatchPage.tsx |
| `portalGetEstimate` | async | `(clientId: string, id: string): Promise<EstimateWithRefs>` | mock | client-portal | audit | pages/rc/RcEstimatePage.tsx |
| `SHOP_ADDRESS` **[post-E16]** | sync | `` | mock | staff | none (read) | rc/RcSendWatch.tsx |
| `portalRequestLabel` **[post-E16]** | async | `(clientId: string, estimateId: string, input: Address \| PortalLabelRequestInput): Promise<ShipmentWithRefs>` | mock | client-portal | audit | rc/RcSendWatch.tsx |
| `portalDropOff` **[post-E16]** | async | `(clientId: string, estimateId: string): Promise<EstimateWithRefs>` | mock | client-portal | audit | rc/RcSendWatch.tsx |
| `portalRequestRequote` **[post-E16]** | async | `(clientId: string, estimateId: string): Promise<EstimateWithRefs>` | mock | client-portal | audit, comms thread | pages/rc/RcEstimatePage.tsx |
| `portalApproveEstimate` | async | `(clientId: string, id: string): Promise<EstimateWithRefs>` | mock | client-portal | audit, comms thread, job status | pages/rc/RcEstimatePage.tsx |
| `portalDeclineEstimate` | async | `(clientId: string, id: string, reason: string): Promise<EstimateWithRefs>` | mock | client-portal | audit, comms thread | pages/rc/RcEstimatePage.tsx |
| `portalGetInvoice` | async | `(clientId: string, id: string): Promise<SalesOrderWithRefs>` | mock | client-portal | none (read) | pages/rc/RcInvoicePage.tsx |
| `portalPayBalance` | async | `(clientId: string, id: string): Promise<SalesOrderWithRefs>` | mock | client-portal | audit | — (internal / other client.ts functions only) |
| `portalConfirmPickupWindow` | async | `(clientId: string, id: string, date: string, slot: PickupWindow['slot'], note?: string): Promise<SalesOrderWithRefs>` | mock | token | audit, comms thread | pages/rc/RcInvoicePage.tsx |
| `portalSubmitShippingInfo` | async | `(clientId: string, id: string, address: Address, phone: string): Promise<SalesOrderWithRefs>` | mock | client-portal | audit | pages/rc/RcInvoicePage.tsx |
| `portalGetMessages` | async | `(clientId: string): Promise<Message[]>` | mock | client-portal | none (read) | pages/rc/RcMessagesPage.tsx |
| `portalSendMessage` | async | `(clientId: string, text: string, watchId?: string, opts:` | mock | client-portal | audit, comms thread | pages/rc/RcMessagesPage.tsx |
| `getStaffInbox` | async | `(): Promise<StaffInboxThread[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getStaffInboxUnread` | async | `(): Promise<number>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `markThreadRead` | async | `(clientId: string): Promise<void>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `replyToClient` | async | `(clientId: string, text: string, watchId?: string, replayBy?: string): Promise<Message>` | mock | staff | audit, email → Sent | — (internal / other client.ts functions only) |

## E9 RS modules

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getVendors` | async | `(): Promise<Vendor[]>` | mock | staff | none (read) | pages/rs/PurchasingPage.tsx |
| `getVendor` | async | `(id: string): Promise<Vendor \| null>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `saveVendor` | async | `(input: VendorInput): Promise<Vendor>` | mock | staff | audit | components/rs/VendorForm.tsx, pages/rs/ConciergePage.tsx |
| `getVendorSummaries` **[post-E16]** **[post-refresh]** | async | `(): Promise<VendorSummary[]>` | mock | staff | none (read) | pages/rs/VendorsPage.tsx |
| `getVendorDetail` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<VendorDetail>` | mock | staff | none (read) | pages/rs/VendorsPage.tsx |
| `setVendorActive` | async | `(id: string, active: boolean): Promise<Vendor>` | mock | staff | audit | pages/rs/PurchasingPage.tsx, pages/rs/VendorsPage.tsx |
| `getPurchaseOrders` | async | `(): Promise<PurchaseOrderWithRefs[]>` | mock | staff | none (read) | pages/rs/PurchasingPage.tsx |
| `getPurchaseOrder` | async | `(id: string): Promise<PurchaseOrderWithRefs \| null>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `createPurchaseOrder` | async | `(input:` | mock | staff | audit | pages/rs/PurchasingPage.tsx |
| `sendPurchaseOrder` | async | `(id: string): Promise<PurchaseOrderWithRefs>` | mock | staff | audit, email → Sent | pages/rs/PurchasingPage.tsx |
| `cancelPurchaseOrder` | async | `(id: string, reason: string): Promise<PurchaseOrderWithRefs>` | mock | staff | audit | pages/rs/PurchasingPage.tsx |
| `receivePurchaseOrder` | async | `(id: string, qtyByLine: Record<string, number>, putawayLocationId?: string): Promise<PurchaseOrderWithRefs>` | mock | staff | audit | pages/rs/PurchasingPage.tsx |
| `getLocations` | async | `(): Promise<StockLocation[]>` | mock | staff | none (read) | pages/SetupRsPanels.tsx, pages/rs/InventoryPage.tsx, pages/rs/PurchasingPage.tsx |
| `getStockRows` | async | `(): Promise<StockRow[]>` | mock | staff | none (read) | pages/rs/InventoryPage.tsx |
| `getLowStock` | async | `(): Promise<StockRow[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getStockMovements` | async | `(partId?: string): Promise<StockMovement[]>` | mock | staff | none (read) | pages/rs/InventoryPage.tsx |
| `adjustStock` | async | `(partId: string, locationId: string, delta: number, reason: string): Promise<StockMovement>` | mock | staff | none (read) | pages/rs/InventoryPage.tsx |
| `getCycleCounts` | async | `(): Promise<CycleCount[]>` | mock | staff | none (read) | pages/rs/InventoryPage.tsx |
| `startCycleCount` | async | `(locationId: string): Promise<CycleCount>` | mock | staff | audit | pages/rs/CycleCountPage.tsx, pages/rs/InventoryPage.tsx |
| `postCycleCount` | async | `(id: string, counted: Record<string, number>): Promise<CycleCount>` | mock | staff | audit | pages/rs/InventoryPage.tsx |
| `isBandOnlyJob` **[post-E16]** **[post-refresh]** | sync | `= (j: Job, w?: Watch) => j.workflow.length > 0 && j.workflow.every((d) => d === 'B') && !(w?.reference && w?.serial);` | mock | staff | none (read) | components/jobs/JobDetailContent.tsx, pages/jobs/JobDetailPage.tsx |
| `bandLabelPayload` **[post-E16]** **[post-refresh]** | sync | `= (num: string, workflow: DeptCode[]) => `$` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `queueLabelsFor` | async | `(kind: 'estimate' \| 'job' \| 'watch', ids: string[]): Promise<LabelJob[]>` | mock | staff | audit, label queue | pages/rs/RsPages.tsx |
| `queueJobLabels` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<LabelJob[]>` | mock | staff | audit, label queue | pages/jobs/JobDetailPage.tsx |

## Scan-to-client — a label scan resolves job → client by ID; never through a name

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `resolveScan` **[post-E16]** **[post-refresh]** | async | `(raw: string): Promise<ScanResolution \| null>` | mock | staff | none (read) | components/estimates/EstimateForm.tsx, pages/kiosk/WmKioskPage.tsx |
| `sameNameClients` **[post-E16]** **[post-refresh]** | sync | `= (c: Client): Client[] => fx.clients.filter((x) => x.id !== c.id && nameKey(x) === nameKey(c));` | mock | staff | none (read) | components/estimates/EstimateForm.tsx |
| `duplicateNamesIn` **[post-E16]** **[post-refresh]** | sync | `= (hits: Client[]): string[] =>` | mock | staff | none (read) | components/estimates/EstimateForm.tsx |
| `getReport` | async | `(key: 'funnel' \| 'throughput' \| 'aging' \| 'pnl' \| 'completions'): Promise<Report>` | mock | staff | none (read) | pages/rs/RsPages.tsx |
| `reportToCsv` | sync | `= (r: Report): string => [r.columns.join(','), ...r.rows.map((row) => r.columns.map((c) =>` | mock | staff | none (read) | pages/rs/RsPages.tsx |
| `getQboQueue` | async | `(): Promise<QboQueueRow[]>` | mock | staff | none (read) | pages/rs/RsPages.tsx |
| `exportAccountingCsv` | async | `(kind: 'invoices' \| 'payments' \| 'qbo'): Promise<string>` | mock | staff | audit | pages/rs/RsPages.tsx |
| `getIntegrations` | async | `(): Promise<IntegrationTile[]>` | mock | staff | none (read) | pages/rs/RsPages.tsx |
| `adminSaveUser` | async | `(input: UserAdminInput &` | mock | staff | audit | pages/SetupRsPanels.tsx |
| `adminDeactivateUser` | async | `(id: string): Promise<void>` | mock | staff | audit | pages/SetupRsPanels.tsx |
| `getCatalogAdmin` | async | `(): Promise<(CatalogService &` | mock | staff | none (read) | pages/SetupRsPanels.tsx |
| `saveCatalogService` | async | `(input:` | mock | staff | audit | pages/SetupRsPanels.tsx |
| `retireCatalogService` | async | `(id: string, retired = true): Promise<void>` | mock | staff | audit | pages/SetupRsPanels.tsx |
| `MERGE_FIELDS` | const | `fixture re-export` | mock | staff | none (read) | components/comms/TemplateForm.tsx |
| `getTemplates` | async | `(): Promise<MessageTemplate[]>` | mock | staff | none (read) | pages/SetupRsPanels.tsx |
| `setTemplateActive` **[post-E16]** **[post-refresh]** | async | `(key: TemplateKey, active: boolean): Promise<MessageTemplate>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `saveTemplate` | async | `(key: TemplateKey, subject: string, body: string): Promise<MessageTemplate>` | mock | staff | audit | components/setup/LongTermStorageCard.tsx |
| `EVIDENCE_SLOTS` | sync | `:` | mock | staff | none (read) | components/companion/CompanionTabs.tsx, components/jobs/EvidencePanel.tsx, pages/rw/RwQcPage.tsx |
| `PARTS_GRADES` | sync | `: PartsGrade[] = ['B', 'Ø/REPL', 'D/REPL'];` | mock | staff | none (read) | components/jobs/EvidencePanel.tsx |
| `EVIDENCE_REQUIRED` | sync | `: Record<JobKind, EvidenceSlot[]>` | mock | staff | none (read) | components/jobs/EvidencePanel.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwQcPage.tsx |
| `evidenceGaps` | sync | `= (j: Job): EvidenceSlot[] => (j.status !== 'testing' ? [] : EVIDENCE_REQUIRED[j.kind].filter((s) => !rs.evidence.some((e) => e.jobId === j.id && e.slot === s)));` | mock | staff | none (read) | components/jobs/EvidencePanel.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwQcPage.tsx |
| `getEvidenceForJob` | async | `(jobId: string): Promise<EvidenceItem[]>` | mock | staff | none (read) | components/companion/CompanionTabs.tsx, components/jobs/EvidencePanel.tsx |
| `getEvidenceForWatch` | async | `(watchId: string): Promise<(EvidenceItem &` | mock | staff | none (read) | components/jobs/EvidencePanel.tsx |
| `getEvidenceForClient` | async | `(clientId: string): Promise<(EvidenceItem &` | mock | staff | none (read) | components/jobs/EvidencePanel.tsx |
| `captureEvidence` | async | `(jobId: string, input: EvidenceInput): Promise<EvidenceItem>` | mock | staff | audit | components/jobs/EvidencePanel.tsx |

## E10 Companion panel — SCRIPTED assistant over fixtures (no model)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `LABEL_PILLS` | const | `fixture re-export` | mock | staff | none (read) | components/companion/CompanionTabs.tsx |
| `resolveModel` | sync | `= (text: string): PriceMemoryAnswer['resolution'] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `priceMemory` | async | `(query: string): Promise<PriceMemoryAnswer>` | mock | staff | audit | components/companion/CompanionTabs.tsx |
| `verifyPrice` | async | `(partId: string): Promise<PriceCandidate>` | mock | staff | audit | components/companion/CompanionTabs.tsx |
| `getClientBrief` | async | `(clientId: string): Promise<ClientBrief>` | mock | staff | none (read) | components/companion/CompanionTabs.tsx |
| `correctBriefLine` | async | `(clientId: string, key: BriefLineKey, text: string, original: string): Promise<BriefCorrection>` | mock | staff | audit | components/companion/CompanionTabs.tsx |
| `getBriefCorrections` | async | `(clientId: string): Promise<BriefCorrection[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getKnowledgeCards` | async | `(): Promise<KnowledgeCard[]>` | mock | staff | none (read) | components/companion/CompanionTabs.tsx |
| `getRoutedQuestions` | async | `(): Promise<(RoutedQuestion &` | mock | staff | none (read) | components/companion/CompanionTabs.tsx |
| `askShop` | async | `(query: string): Promise<AskAnswer>` | mock | staff | none (read) | components/companion/CompanionTabs.tsx |
| `routeQuestion` | async | `(query: string): Promise<RoutedQuestion>` | mock | staff | audit | components/companion/CompanionTabs.tsx |
| `answerQuestion` | async | `(questionId: string, title: string, body: string, tags: string[]): Promise<KnowledgeCard>` | mock | staff | audit | components/companion/CompanionTabs.tsx |
| `getPhotoLabels` | async | `(photoId?: string): Promise<PhotoLabel[]>` | mock | staff | none (read) | components/companion/CompanionTabs.tsx |
| `labelPhoto` | async | `(input:` | mock | staff | audit | components/companion/CompanionTabs.tsx |
| `companionCanSeeMoney` | sync | `= canSeeMoney;` | mock | staff | audit, comms thread | — (internal / other client.ts functions only) |

## E14 Comms hub — one thread-space per client; Sent-record only (nothing leaves); reply-token routing (mocked)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getInbox` | async | `(view: InboxView, userId?: string): Promise<ConversationWithRefs[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getInboxCounts` | async | `(userId?: string): Promise<Record<InboxView, number>>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getClientFolder` | async | `(clientId: string): Promise<ConversationWithRefs[]>` | mock | staff | none (read) | pages/InboxPage.tsx |
| `getThread` | async | `(id: string): Promise<ThreadView>` | mock | staff | none (read) | components/inbox/ThreadView.tsx, pages/InboxPage.tsx |
| `clearMessage` **[post-E16]** **[post-refresh]** | async | `(conversationId: string, messageId: string): Promise<ThreadView>` | mock | staff | audit | components/inbox/ThreadView.tsx |
| `markConversationRead` | async | `(id: string): Promise<void>` | mock | staff | none (read) | pages/InboxPage.tsx |

## ONE GENERAL INBOX (MH 2026-10-01): All · tag-don't-assign · pin · lanes · archive

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `CONV_TAGS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/inbox/ThreadContextMenu.tsx, components/inbox/ThreadView.tsx, pages/InboxPage.tsx |
| `tagOfUser` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (u?: User \| null): Exclude<ConvTag, 'update_wo'> \| undefined => (u?.shortName === 'Vienna' ? 'vienna' : u?.shortName === 'MH' ? 'mike' : u?.shortName === 'Chyna' ? 'chyna' : undefined);` | mock | staff | none (read) | components/inbox/ViewsSection.tsx, pages/InboxPage.tsx |
| `getInboxThreads` **[post-E16]** **[post-refresh]** **[v2]** | async | `(filter: InboxFilter` | mock | staff | none (read) | components/inbox/ViewsSection.tsx, pages/InboxPage.tsx |
| `getInboxThreadCounts` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<` | mock | staff | none (read) | pages/InboxPage.tsx |
| `getInboxSent` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<InboxSentRow[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `tagConversation` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, tag: ConvTag, on = true): Promise<ConversationWithRefs>` | mock | staff | audit | pages/InboxPage.tsx |
| `pinConversation` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, on = true): Promise<ConversationWithRefs>` | mock | staff | audit | pages/InboxPage.tsx |
| `moveConversation` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, lane: ConvLane \| null): Promise<ConversationWithRefs>` | mock | staff | audit, comms thread | pages/InboxPage.tsx |
| `archiveConversation` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<ConversationWithRefs>` | mock | staff | audit | pages/InboxPage.tsx |
| `unarchiveConversation` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id: string) => reopenConversation(id);` | mock | staff | none (read) | pages/InboxPage.tsx |
| `tagsForRequestSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (requestId: string): ConvTag[] => conversationForRequestSync(requestId)?.tags ?? [];` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `logShare` **[post-E16]** **[post-refresh]** **[v2]** | async | `(conversationId: string, messageId: string, toLabels: string[]): Promise<ConvMessage>` | mock | staff | audit, comms thread | — (internal / other client.ts functions only) |

## Inbox job-card slide-out + sidebar badges (MH 2026-10-01)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `inboxUnreadCountSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= () =>` | mock | staff | none (read) | components/layout/Sidebar.tsx |
| `openRequestsNoEstimateCountSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= () => store.requests.filter((r) => r.status !== 'closed' && !r.estimateId && (r.division ?? 'rolliworks') === getSessionDivision()).length;` | mock | staff | none (read) | components/layout/Sidebar.tsx |
| `requestByIdSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id: string): ServiceRequest \| undefined => store.requests.find((r) => r.id === id);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/layout/MessageText.tsx |
| `requestLegsSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (r: ServiceRequest): DeptCode[] => r.legs ?? (r.kiosk ? Array.from(new Set(r.kiosk.services.map((s) => KIOSK_LEG[s]))) : []);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/requests/RequestSheet.tsx |
| `requestInstantRangeSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (r: ServiceRequest):` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/requests/RequestSheet.tsx |
| `ensureRequestThread` **[post-E16]** **[post-refresh]** **[v2]** | async | `(requestId: string): Promise<Conversation>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `conversationForRequestSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (requestId: string): Conversation \| undefined => cx.conversations.find((c) => c.anchor?.kind === 'request' && c.anchor.id === requestId);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `jobPickupSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (jobId: string):` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx |
| `jobReturnInfoSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (job: Job):` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/jobs/ItemHeader.tsx |
| `jobsReturnedFromSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (jobId: string): Job[] => store.jobs.filter((j) => j.returnOfJobId === jobId);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/jobs/ItemHeader.tsx |
| `jobByIdSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id: string): Job \| undefined => store.jobs.find((j) => j.id === id);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `jobInPossessionSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job): boolean => j.status !== 'closed' && !jobPickupSync(j.id);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx |
| `clientPanelSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (clientId: string):` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx |
| `jobForEstimateSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (estimateId: string): Job \| undefined => store.jobs.find((j) => j.estimateId === estimateId);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx |
| `watchByIdSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id?: string): Watch \| undefined => (id ? store.watches.find((w) => w.id === id) : undefined);` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/requests/RequestSheet.tsx |
| `assignConversation` | async | `(id: string, assignee: Assignee \| null): Promise<ConversationWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `snoozeConversation` | async | `(id: string, untilIso: string): Promise<ConversationWithRefs>` | mock | staff | audit | components/inbox/ThreadView.tsx |
| `wakeConversation` | async | `(id: string): Promise<ConversationWithRefs>` | mock | staff | audit | components/inbox/ThreadView.tsx |
| `closeConversation` | async | `(id: string): Promise<ConversationWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `reopenConversation` | async | `(id: string): Promise<ConversationWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `createConversation` | async | `(clientId: string, subject: string, anchor?: ConversationAnchor): Promise<ConversationWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |

## Personal templates (point-of-use editing). Resolution order for a STAFF send: actor's personal variant → shop default. System sends: shop default only.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `personalTemplateFor` **[post-E16]** | sync | `= (key: TemplateKey, owner = actor().by): PersonalTemplate \| undefined => rs.personalTemplates.find((p) => p.key === key && p.owner === owner);` | mock | staff | none (read) | components/comms/TemplateEdit.tsx, components/inbox/ThreadView.tsx |
| `getPersonalTemplates` **[post-E16]** | async | `(): Promise<PersonalTemplate[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getAllPersonalTemplates` **[post-E16]** | async | `(): Promise<PersonalTemplate[]>` | mock | staff | none (read) | pages/SetupRsPanels.tsx, pages/setup/TemplatesPage.tsx |
| `getTemplateVariants` **[post-E16]** | async | `(key: TemplateKey): Promise<PersonalTemplate[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `savePersonalTemplate` **[post-E16]** | async | `(key: TemplateKey, subject: string, body: string): Promise<PersonalTemplate>` | mock | staff | audit | components/comms/TemplateEdit.tsx, components/inbox/ThreadView.tsx |
| `deletePersonalTemplate` **[post-E16]** | async | `(key: TemplateKey): Promise<void>` | mock | staff | audit | components/comms/TemplateEdit.tsx |
| `unrenderTemplate` **[post-E16]** | sync | `= (text: string, vals: Record<string, string>) => Object.entries(vals).filter(([, v]) => v && v.length > 2).sort((a, b) => b[1].length - a[1].length).reduce((t, [f, v]) => t.split(v).join(f), text);` | mock | staff | none (read) | components/comms/TemplateBar.tsx, components/comms/TemplateEdit.tsx, components/inbox/ThreadView.tsx |

## Template library (MH 2026-10-02): ONE message_templates store behind the Inbox composer, Estimate → Send and Setup → Templates. Visibility = own division + shared (MH 'both' sees all). Pins = per user, max 6, one tap inserts body + attachments.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `TEMPLATE_CATEGORIES` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/comms/TemplateBar.tsx, components/comms/TemplateBits.tsx, components/comms/TemplateForm.tsx, components/comms/TemplatesSheet.tsx, pages/SetupRsPanels.tsx, pages/setup/TemplatesPage.tsx |
| `MAX_TEMPLATE_PINS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 6;` | mock | staff | none (read) | components/comms/TemplateBar.tsx, components/comms/TemplatesSheet.tsx, pages/SetupRsPanels.tsx, pages/setup/TemplatesPage.tsx |
| `TEMPLATES_CHANGED_EVENT` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 'rollisuite:templates-changed';` | mock | staff | none (read) | components/comms/TemplateBar.tsx, components/comms/TemplatesSheet.tsx, pages/setup/TemplatesPage.tsx |
| `templateUsageSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (key: TemplateKey) => cx.messages.filter((m) => m.templateKey === key).length;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getTemplateLibrary` **[post-E16]** **[post-refresh]** **[v2]** | async | `(opts:` | mock | staff | none (read) | components/comms/TemplatesSheet.tsx, pages/setup/TemplatesPage.tsx |
| `pinnedKeysSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): TemplateKey[] => [...pinsOf(tplOwner()).keys];` | mock | staff | none (read) | components/comms/TemplateBar.tsx, components/comms/TemplatesSheet.tsx, pages/SetupRsPanels.tsx, pages/setup/TemplatesPage.tsx |
| `getPinnedTemplates` **[post-E16]** **[post-refresh]** **[v2]** | async | `(channel?: ReplyChannel): Promise<MessageTemplate[]>` | mock | staff | none (read) | components/comms/TemplateBar.tsx |
| `pinTemplate` **[post-E16]** **[post-refresh]** **[v2]** | async | `(key: TemplateKey, on: boolean): Promise<TemplateKey[]>` | mock | staff | audit | components/comms/TemplateBar.tsx, components/comms/TemplatesSheet.tsx, pages/setup/TemplatesPage.tsx |
| `reorderPins` **[post-E16]** **[post-refresh]** **[v2]** | async | `(keys: TemplateKey[]): Promise<TemplateKey[]>` | mock | staff | none (read) | pages/setup/TemplatesPage.tsx |
| `createTemplate` **[post-E16]** **[post-refresh]** **[v2]** | async | `(input: TemplateInput): Promise<MessageTemplate>` | mock | staff | audit | components/comms/TemplatesSheet.tsx, pages/setup/TemplatesPage.tsx |
| `updateTemplate` **[post-E16]** **[post-refresh]** **[v2]** | async | `(key: TemplateKey, patch: Partial<TemplateInput>): Promise<MessageTemplate>` | mock | staff | audit | components/comms/TemplatesSheet.tsx, pages/setup/TemplatesPage.tsx |
| `archiveTemplate` **[post-E16]** **[post-refresh]** **[v2]** | async | `(key: TemplateKey, archived: boolean): Promise<MessageTemplate>` | mock | staff | none (read) | components/comms/TemplatesSheet.tsx, pages/setup/TemplatesPage.tsx |
| `reorderTemplates` **[post-E16]** **[post-refresh]** **[v2]** | async | `(category: TemplateCategory, keys: TemplateKey[]): Promise<void>` | mock | staff | audit | pages/setup/TemplatesPage.tsx |
| `saveDraftAsTemplate` **[post-E16]** **[post-refresh]** **[v2]** | async | `(ctx:` | mock | staff | none (read) | components/comms/TemplateBar.tsx |
| `renderTemplate` | async | `(conversationId: string, key: TemplateKey, shopDefault = false): Promise<RenderedTemplate>` | mock | staff | none (read) | components/inbox/ThreadView.tsx |
| `renderTemplateForEstimate` **[post-E16]** | async | `(estimateId: string, shopDefault = false, key: TemplateKey = 'estimate_sent'): Promise<RenderedTemplate &` | mock | staff | none (read) | components/estimates/EstimateModals.tsx |
| `mergeValuesForConversation` **[post-E16]** | async | `(conversationId: string): Promise<Record<string, string>>` | mock | staff | none (read) | components/comms/TemplateBar.tsx, components/inbox/ThreadView.tsx |
| `replyChannelSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (conversationId: string): ReplyChannel =>` | mock | staff | none (read) | components/inbox/ThreadView.tsx |
| `replyInThread` | async | `(id: string, input:` | mock | staff | audit, email → Sent, comms thread | components/inbox/ThreadView.tsx |
| `addThreadNote` | async | `(id: string, text: string): Promise<ConvMessage>` | mock | staff | audit, comms thread | components/inbox/InboxJobCard.tsx, components/inbox/ThreadView.tsx |
| `logPartsRequestOnThread` **[post-E16]** **[post-refresh]** **[v2]** | async | `(conversationId: string, requestId: string): Promise<ConvMessage>` | mock | staff | audit, comms thread | components/inbox/InboxJobCard.tsx |
| `simulateInboundReply` | async | `(id: string, text: string): Promise<ConvMessage>` | mock | webhook | audit, comms thread | components/inbox/ThreadView.tsx |
| `threadNeedsReplyFor` | sync | `= (anchor: ConversationAnchor): ConversationWithRefs \| undefined =>` | mock | staff | none (read) | components/jobs/JobBits.tsx, pages/estimates/EstimatesListPage.tsx |
| `clientNeedsReplyCount` | sync | `= (clientId: string) => cx.conversations.filter((c) => c.clientId === clientId && convNeedsReply(c)).length;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `threadsNeedingReplyForUser` | sync | `= (me: User) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getCommsUnread` | async | `(): Promise<number>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## E15 Portal-first inspection report (MH 2026-09-25): emails notify, the portal renders

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `REPORT_COMPONENTS` | const | `fixture re-export` | mock | staff | none (read) | components/jobs/InspectionReportPanel.tsx |
| `COMPONENT_GRADES` | sync | `: ComponentGrade[] = ['good', 'fair', 'worn', 'replace'];` | mock | staff | none (read) | components/jobs/InspectionReportPanel.tsx |
| `INSPECTION_SURVEY` **[post-E16]** | sync | `= ['How would you like us to reach you with updates?', 'Anything we should know about this watch?'];` | mock | staff | none (read) | pages/rc/RcReportPage.tsx |
| `getInspectionDecisions` **[post-E16]** | async | `(filter:` | mock | staff | none (read) | components/jobs/JobDecisionRecords.tsx, pages/rc/RcWatchPage.tsx |
| `portalAskAboutReport` **[post-E16]** | async | `(token: string, text: string): Promise<Message>` | mock | client-portal | email → Sent | pages/rc/RcReportPage.tsx |
| `getInspectionReportsForJob` | async | `(jobId: string): Promise<InspectionReportDoc[]>` | mock | staff | none (read) | components/jobs/InspectionReportPanel.tsx |
| `issueInspectionReport` | async | `(jobId: string, grades:` | mock | staff | audit, email → Sent, comms thread, job status | components/jobs/InspectionReportPanel.tsx |
| `portalGetInspectionReport` | async | `(token: string): Promise<PortalInspectionReport>` | mock | client-portal | none (read) | pages/rc/RcReportPage.tsx |
| `portalDecideInspectionReport` | async | `(token: string, decision: 'approve' \| 'decline', reason?: string, input?: DecisionInput): Promise<PortalInspectionReport>` | mock | client-portal | audit, comms thread, job status | pages/rc/RcReportPage.tsx |

## E12 RolliTime timing bench (NEW automation — legacy never had it)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `TIMING_POSITIONS` | const | `fixture re-export` | mock | staff | none (read) | components/jobs/SheetExtractVerify.tsx, pages/rw/testing/RwTestingTestPage.tsx |
| `toleranceForWatch` | sync | `= (w: Watch): CaliberTolerance => fx.caliberTolerances.find((c) => c.refPrefixes.some((p) => w.reference.toUpperCase().startsWith(p.toUpperCase()))) ?? fx.GENERIC_TOLERANCE;` | mock | staff | none (read) | pages/rw/testing/RwTestingQueuePage.tsx, pages/rw/testing/RwTestingTestPage.tsx |
| `evaluateTiming` | sync | `= (tol: CaliberTolerance, input: Pick<TimingInput, 'readings' \| 'powerReserve'>): TimingEvaluation &` | mock | staff | none (read) | pages/rw/testing/RwTestingTestPage.tsx |
| `timingPassed` **[post-E16]** | sync | `= (j: Job): TimingTest \| undefined =>` | mock | staff | none (read) | pages/rw/RwQcPage.tsx |
| `testingStationScan` **[post-E16]** | async | `(label: string): Promise<JobWithRefs>` | mock | staff | none (read) | pages/rw/testing/RwTestingQueuePage.tsx |
| `getTestingQueue` | async | `(): Promise<JobWithRefs[]>` | mock | staff | none (read) | pages/rw/testing/RwTestingQueuePage.tsx |
| `findJobByLabel` | async | `(scan: string): Promise<JobWithRefs \| null>` | mock | staff | none (read) | components/rw/FloorPanels.tsx, components/rw/pad/PadBin.tsx, pages/rw/AssignMovePage.tsx, pages/rw/RwBulkAssignPage.tsx, pages/rw/RwEvidencePage.tsx |
| `getTimingTests` | async | `(filter:` | mock | staff | none (read) | components/jobs/TimingCard.tsx, pages/rw/testing/RwTestingTestPage.tsx |
| `recordTimingTest` | async | `(jobId: string, input: TimingInput): Promise<TimingTest>` | mock | staff | audit, email → Sent, job status | pages/rw/testing/RwTestingTestPage.tsx |

## E13 RGTime `/rg` — NFC-tap time-clock (phone PWA). In Keeper RGTime owns staff identity (D-026); here it reads the same `users` fixture.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `KIOSK_SERVICES` | const | `fixture re-export` | mock | staff | none (read) | pages/kiosk/KioskSteps.tsx |
| `KIOSK_BRANDS` | const | `fixture re-export` | mock | staff | none (read) | pages/kiosk/KioskPage.tsx, pages/kiosk/KioskSteps.tsx |
| `RG_DIVISION_LABEL` | const | `fixture re-export` | mock | staff | none (read) | components/rwcom/RequestTab.tsx, pages/RequestsPage.tsx, pages/RwcomPage.tsx, pages/rg/RgClockPage.tsx, pages/rg/RgHomePage.tsx, pages/rg/RgKioskPage.tsx, pages/rg/RgManagerPage.tsx, pages/rw/RwJobsPage.tsx, pages/rw/RwShell.tsx |
| `RG_DEFAULT_SETTINGS` **[post-E16]** **[post-refresh]** | sync | `: RgSettings` | mock | staff | audit, localStorage | — (internal / other client.ts functions only) |
| `rgEffectivePunches` **[post-E16]** **[post-refresh]** | sync | `= (): Punch[] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `rgAllPunches` **[post-E16]** **[post-refresh]** | sync | `= (): Punch[] => [...rg.punches];` | mock | staff | none (read) | pages/rg/RgManagerPage.tsx |
| `rgGetSession` | sync | `= (): User \| null =>` | mock | staff | localStorage | pages/rg/RgShell.tsx |
| `rgAllStaff` | sync | `= (): User[] => [...fx.users];` | mock | staff | none (read) | pages/rg/RgKioskPage.tsx, pages/rg/RgManagerPage.tsx, pages/rg/RgShell.tsx |
| `rgSignIn` | async | `(userId: string, secret: string): Promise<User>` | mock | staff | audit, localStorage | pages/rg/RgShell.tsx |
| `rgSignOut` | async | `(): Promise<void>` | mock | staff | audit, localStorage | pages/rg/RgShell.tsx |
| `rgVerifyManager` | async | `(userId: string, secret: string): Promise<User>` | mock | staff | audit | pages/rg/RgManagerPage.tsx |
| `getNfcTags` | sync | `= (): NfcTag[] => fx.nfcTags.map((t) => (` | mock | staff | none (read) | pages/rg/RgHomePage.tsx, pages/rg/RgKioskPage.tsx, pages/rg/RgManagerPage.tsx |
| `getNfcTag` | sync | `= (id: string): NfcTag \| undefined => fx.nfcTags.find((t) => t.id === id);` | mock | staff | none (read) | pages/rg/RgClockPage.tsx, pages/rg/RgKioskPage.tsx |
| `rgGetSettings` **[post-E16]** **[post-refresh]** | sync | `= (): RgSettings => (` | mock | staff | none (read) | pages/rg/RgClockPage.tsx, pages/rg/RgManagerPage.tsx |
| `rgSaveSettings` **[post-E16]** **[post-refresh]** | async | `(patch: Partial<RgSettings>, by?: string): Promise<RgSettings>` | mock | staff | audit, localStorage | pages/rg/RgClockPage.tsx, pages/rg/RgManagerPage.tsx |
| `rgIsOffline` **[post-E16]** **[post-refresh]** | sync | `= () => (typeof navigator !== 'undefined' && !navigator.onLine) \|\| rg.settings.simulateOffline;` | mock | staff | none (read) | pages/rg/RgShell.tsx |
| `rgDistanceM` **[post-E16]** **[post-refresh]** | sync | `= (lat: number, lng: number): number =>` | mock | staff | none (read) | pages/rg/RgClockPage.tsx |
| `rgQueueCount` **[post-E16]** **[post-refresh]** | sync | `= () => rg.queue.length;` | mock | staff | none (read) | pages/rg/RgShell.tsx |
| `getClockState` | async | `(userId: string): Promise<ClockState>` | mock | staff | none (read) | pages/rg/RgClockPage.tsx, pages/rg/RgHomePage.tsx |
| `punchClock` | async | `(stationId: string, opts: PunchOptions \| boolean` | mock | staff | audit | pages/rg/RgClockPage.tsx |
| `rgSyncQueue` **[post-E16]** **[post-refresh]** | async | `(): Promise<Punch[]>` | mock | staff | audit | pages/rg/RgShell.tsx |
| `rgKioskStation` **[post-E16]** **[post-refresh]** | sync | `= (): NfcTag \| undefined => getNfcTag(localStorage.getItem(RG_KEYS.kioskStation) ?? '');` | mock | station | localStorage | pages/rg/RgKioskPage.tsx |
| `rgSetKioskStation` **[post-E16]** **[post-refresh]** | sync | `= (id: string) => localStorage.setItem(RG_KEYS.kioskStation, id);` | mock | staff | localStorage | pages/rg/RgKioskPage.tsx |
| `rgKioskPunch` **[post-E16]** **[post-refresh]** | async | `(userId: string, pin: string, stationId: string): Promise<Punch>` | mock | station | audit | pages/rg/RgKioskPage.tsx |
| `getTodayBoard` | async | `(division: Division): Promise<ClockState[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getWeekHours` | async | `(division: Division \| 'all', weekOffset: number): Promise<WeekView>` | mock | staff | none (read) | pages/rg/RgManagerPage.tsx |
| `getMyWeek` **[post-E16]** **[post-refresh]** | async | `(userId: string, weekOffset: number): Promise<WeekView>` | mock | staff | none (read) | pages/rg/RgWeekPage.tsx |
| `rgGetFlags` **[post-E16]** **[post-refresh]** | async | `(division: Division \| 'all'): Promise<RgFlagRow[]>` | mock | staff | none (read) | pages/rg/RgManagerPage.tsx |
| `rgCorrectPunch` **[post-E16]** **[post-refresh]** | async | `(punchId: string, patch:` | mock | staff | audit | pages/rg/RgManagerPage.tsx |
| `rgAddPunch` **[post-E16]** **[post-refresh]** | async | `(userId: string, kind: PunchKind, at: string, stationId: string, reason: string, by: string): Promise<Punch>` | mock | staff | audit | pages/rg/RgManagerPage.tsx |
| `rgPayrollCsv` **[post-E16]** **[post-refresh]** | sync | `(from: string, to: string, division: Division \| 'all'): string` | mock | staff | audit | pages/rg/RgManagerPage.tsx |

## E13 Kiosk `/kiosk` — public walk-in check-in (legacy kiosk, improved: match existing clients instead of duplicating)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `submitKioskCheckIn` | async | `(input: KioskSubmission): Promise<KioskResult>` | mock | staff | audit | pages/kiosk/KioskPage.tsx |

## rolliworks.com structured service submission (SUB- · source = web). PROTOTYPE: the public form is emulated at /rwcom; KEEPER: the real site posts here.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `submitWebRequest` **[post-E16]** **[post-refresh]** **[v2]** | async | `(input: WebRequestInput): Promise<WebRequestResult>` | mock | public | audit, email → Sent | components/rwcom/RequestTab.tsx |

## PORTAL REQUEST BUILDER (MH 2026-10-02): structured lines → RQ + estimate. Regular client → Draft estimate; trade (autoQuote) → quoted instantly when every line resolves in the rate card, else a draft is QUEUED for pricing.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `builderLineDescription` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (l: RequestLine, group?: string) => `$` | mock | staff | none (read) | components/requests/RequestLines.tsx |
| `submitBuilderRequest` **[post-E16]** **[post-refresh]** **[v2]** | async | `(input: BuilderSubmitInput): Promise<BuilderSubmitResult>` | mock | staff | audit, email → Sent | components/requests/RequestBuilder.tsx |
| `getRateCard` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= rb.getRateCard;` | mock | staff | none (read) | pages/setup/RateCardPage.tsx |
| `saveRateCardRow` **[post-E16]** **[post-refresh]** **[v2]** | async | `(input: rb.RateRowInput): Promise<RateCardRow>` | mock | staff | audit | pages/setup/RateCardPage.tsx |
| `liveRateSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= rb.matchRate;` | mock | staff | none (read) | components/requests/RequestLines.tsx |
| `markRequestNotified` **[post-E16]** **[post-refresh]** **[v2]** | async | `(requestId: string, to: string): Promise<RequestRow>` | mock | staff | audit | components/requests/RequestSheet.tsx |
| `getRequestsQueue` | async | `(): Promise<RequestRow[]>` | mock | staff | none (read) | pages/RequestsPage.tsx |
| `resolveKioskMatch` | async | `(requestId: string, decision: 'confirm' \| 'split'): Promise<RequestRow>` | mock | staff | audit | pages/RequestsPage.tsx |

## E11 RolliWorking `/rw` — two-lane floor (legacy RW research, reference not gospel)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getRwFloorMap` | async | `(): Promise<RwFloorMap>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## E18 RW deep build — shop floor core (parts = components with station/status/custody/history)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `isSafeStation` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/rw/FloorPanels.tsx, pages/rw/CustodyPage.tsx, pages/rw/RwFloorPage.tsx |
| `RW_STATIONS` **[post-E16]** | const | `fixture re-export` | mock | staff | none (read) | components/rw/FloorPanels.tsx, components/rw/RwBits.tsx, components/rw/pad/PadJobs.tsx, pages/rw/RwFloorPage.tsx, pages/rw/RwStationScanPage.tsx, pages/rw/RwWmPage.tsx, pages/rw/RwWorkQueuePage.tsx |
| `getShopFloor` **[post-E16]** | async | `(filter?:` | mock | staff | audit | components/layout/CornerLookup.tsx, pages/rw/AssignMovePage.tsx, pages/rw/RwFloorPage.tsx |
| `movePart` **[post-E16]** | async | `(jobId: string, key: ComponentKey, to: RwStationKey, via: PartMove['via'] = 'drag'): Promise<FloorDot>` | mock | staff | audit, job status | pages/rw/RwFloorPage.tsx, pages/rw/RwWmPage.tsx |
| `SCAN_UNDO_MS` **[post-E16]** | sync | `= 10_000;` | mock | staff | none (read) | components/rw/AuditPanel.tsx |
| `undoScanComplete` **[post-E16]** | async | `(token: string): Promise<FloorDot>` | mock | staff | audit | components/rw/AuditPanel.tsx |
| `markReunited` **[post-E16]** | async | `(jobId: string, key: ComponentKey): Promise<FloorDot>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `finishGate` **[post-E16]** | sync | `= (j: Job): string[] => finishBlockers(j);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `finishJob` **[post-E16]** | async | `(jobId: string): Promise<JobWithRefs>` | mock | staff | job status | pages/rw/RwFloorPage.tsx |
| `getPartHistory` **[post-E16]** | async | `(jobId: string, key: ComponentKey): Promise<PartHistoryView>` | mock | staff | none (read) | pages/rw/RwFloorPage.tsx |
| `isSplitFlow` **[post-E16]** **[post-refresh]** | sync | `= (j: Job): boolean => j.workflow.includes('B') && ensureComponents(j).some((c) => c.key === 'band');` | mock | staff | none (read) | components/rw/FloorPanels.tsx |
| `GATE` **[post-E16]** **[post-refresh]** | sync | `: Record<GateTrack, Record<GateDirection,` | mock | staff | audit | — (internal / other client.ts functions only) |
| `polishGateScan` **[post-E16]** **[post-refresh]** | async | `(label: string, direction: GateDirection, track: GateTrack, assignTo?: string): Promise<GateScanResult>` | mock | staff | audit | pages/rw/RwFloorPage.tsx |
| `bulkPartFor` **[post-E16]** **[post-refresh]** | sync | `= (to: RwStationKey, bandLabel: boolean): ComponentKey => (bandLabel \|\| stationOf(to).lane === 'band' ? 'band' : GATE_TARGET[to] \|\| to.includes('polish') ? 'case' : 'head');` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `resolveBulkLabel` **[post-E16]** **[post-refresh]** | async | `(label: string, to: RwStationKey): Promise<BulkRow>` | mock | staff | none (read) | components/rw/FloorPanels.tsx |
| `stationLockedForMe` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (to: string) =>` | mock | staff | none (read) | components/rw/DestinationMap.tsx |
| `bulkCommit` **[post-E16]** **[post-refresh]** | async | `(rows: BulkRow[], to: RwStationKey, handTo?: string): Promise<BulkResult[]>` | mock | staff | audit | components/rw/FloorPanels.tsx |
| `jobSummaryContext` **[post-E16]** **[post-refresh]** | async | `(jobId: string, live?: JobWithRefs): Promise<JobSummaryContext>` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/jobs/JobSummaryDraft.tsx |
| `getCustodyByPerson` **[post-E16]** **[post-refresh]** | async | `(): Promise<CustodyByPerson[]>` | mock | staff | none (read) | pages/rw/CustodyPage.tsx |

## MH HITLIST — owner accountability: client asset $ on premises + every bypass use (visibility feed, not a gate)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getHitlist` **[post-E16]** **[post-refresh]** | async | `(): Promise<Hitlist>` | mock | staff | none (read) | pages/rs/HitlistPage.tsx |
| `getGateScans` **[post-E16]** **[post-refresh]** | async | `(jobId?: string): Promise<GateScan[]>` | mock | staff | none (read) | pages/rw/RwFloorPage.tsx |
| `POLISHERS` **[post-E16]** **[post-refresh]** | sync | `= ['Walter', 'JV', 'Leo'];` | mock | staff | none (read) | components/rw/FloorPanels.tsx, pages/rw/RwFloorPage.tsx |
| `parseTechCode` **[post-E16]** | sync | `= (code: string): User \| undefined =>` | mock | staff | none (read) | pages/rw/RwBulkAssignPage.tsx |
| `getScanSession` **[post-E16]** | sync | `= (): ScanSession => rw18.scanSession;` | mock | staff | none (read) | pages/rw/RwBulkAssignPage.tsx |
| `scanTech` **[post-E16]** | async | `(code: string): Promise<ScanSession>` | mock | staff | audit | pages/rw/RwBulkAssignPage.tsx |
| `scanLabelAssign` **[post-E16]** | async | `(label: string): Promise<ScanSession>` | mock | staff | audit, email → Sent, job status | pages/rw/RwBulkAssignPage.tsx |
| `undoOutbox` **[post-E16]** | async | `(id: string): Promise<void>` | mock | staff | audit, email → Sent | pages/rw/RwBulkAssignPage.tsx |
| `getQueuedOutbox` **[post-E16]** | async | `(): Promise<OutboxEmail[]>` | mock | staff | email → Sent | pages/rw/RwBulkAssignPage.tsx |
| `getWorkQueue` **[post-E16]** | async | `(): Promise<WorkQueueRow[]>` | mock | staff | none (read) | pages/rw/RwWorkQueuePage.tsx |
| `simulateClientReply` **[post-E16]** | async | `(jobId?: string): Promise<string>` | mock | webhook | comms thread | pages/rw/RwWorkQueuePage.tsx |
| `clearClientReplied` **[post-E16]** | sync | `= (jobId: string) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getWmRoom` **[post-E16]** | async | `(userId: string): Promise<` | mock | staff | none (read) | pages/rw/RwWmPage.tsx |
| `sendPartByScan` **[post-E16]** | async | `(label: string, to: 'safe' \| 'refinish', key?: ComponentKey): Promise<FloorDot>` | mock | staff | none (read) | pages/rw/RwWmPage.tsx |
| `requestPartSimple` **[post-E16]** | async | `(jobId: string, description: string, qty: number, source: PartsRequest['source'] = 'wm'): Promise<PartsRequestWithRefs>` | mock | staff | audit | pages/rw/RwWmPage.tsx |
| `getStationMemory` **[post-E16]** | sync | `= () => rw18.stationMemory;` | mock | staff | none (read) | pages/rw/RwStationScanPage.tsx |
| `stationScan` **[post-E16]** | async | `(station: RwStationKey, label: string): Promise<FloorDot>` | mock | staff | none (read) | pages/rw/RwDevicePage.tsx, pages/rw/RwShell.tsx, pages/rw/RwStationScanPage.tsx |
| `ROOM_TECHS` **[post-E16]** **[post-refresh]** | sync | `: Record<PadRoom, string[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `ROOM_LABEL` **[post-E16]** **[post-refresh]** | sync | `: Record<PadRoom, string>` | mock | staff | none (read) | pages/rw/RwPadPage.tsx |
| `getPadBoard` **[post-E16]** | async | `(room: PadRoom = 'wm'): Promise<PadCard[]>` | mock | staff | none (read) | pages/rw/RwPadPage.tsx |
| `padAdvance` **[post-E16]** | async | `(jobId: string): Promise<JobWithRefs>` | mock | staff | job status | components/rw/pad/PadJobs.tsx |
| `padSendBack` **[post-E16]** | async | `(jobId: string, reason: SendBackReason, note?: string): Promise<JobWithRefs>` | mock | staff | audit, job status | components/rw/pad/PadJobs.tsx |
| `SEND_BACK_REASONS` **[post-E16]** | sync | `= SEND_BACK_LABEL;` | mock | staff | none (read) | components/rw/pad/PadJobs.tsx |
| `partSuggestions` **[post-E16]** | sync | `= (jobId: string, q: string): PartSuggestion[] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `recordPartPick` **[post-E16]** | sync | `= (jobId: string, partId: string) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `submitPadPartsRequest` **[post-E16]** | async | `(jobId: string, items:` | mock | staff | audit | — (internal / other client.ts functions only) |
| `getApprovalsQueue` **[post-E16]** | async | `(): Promise<(PartsRequestWithRefs &` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `approvalAction` **[post-E16]** | async | `(requestId: string, action: 'approve' \| 'decline' \| 'on_order' \| 'received', note?: string): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/rw/pad/PadReview.tsx |
| `getPickingQueue` **[post-E16]** | async | `(): Promise<` | mock | staff | none (read) | pages/rw/RwPickingPage.tsx |
| `pickAction` **[post-E16]** | async | `(taskId: string, action: 'picked' \| 'short' \| 'found', location?: string): Promise<PickTaskView>` | mock | staff | audit | pages/rw/RwPickingPage.tsx |
| `getJobPhotoViews` **[post-E16]** | async | `(jobId: string): Promise<JobPhotoView[]>` | mock | staff | none (read) | components/rw/RwBits.tsx, components/rw/pad/PadJobs.tsx |
| `PHOTO_SLOTS` **[post-E16]** | sync | `:` | mock | staff | none (read) | components/rw/pad/PadCamera.tsx |
| `capturePadPhoto` **[post-E16]** | async | `(jobId: string, dataUrl: string, slotKey: string): Promise<JobWithRefs>` | mock | staff | none (read) | components/rw/pad/PadCamera.tsx |
| `getRoomPartsHistory` **[post-E16]** | async | `(): Promise<(PartsRequestWithRefs &` | mock | staff | none (read) | components/rw/pad/PadHistory.tsx |
| `getRoomSummary` **[post-E16]** | async | `(): Promise<RoomSummary>` | mock | staff | none (read) | pages/rw/RwPadPage.tsx |
| `PART_LABELS` **[post-E16]** | sync | `= PART_LABEL;` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/inbox/ThreadList.tsx, components/jobs/JobBits.tsx, components/jobs/JobDetailContent.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwWorkQueuePage.tsx |

## Supervisor Pad v2 — Jobs (tech override + condition) · Parts (caliber query, reference search, M3KE) · Review (manager gate)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `caliberOf` **[post-E16]** | sync | `= (ref: string) => fx.caliberForReference(ref);` | mock | staff | none (read) | components/rw/pad/PadJobs.tsx |
| `getPadPartsContext` **[post-E16]** | async | `(label: string): Promise<PadPartsContext>` | mock | staff | none (read) | components/rw/pad/PadDashboard.tsx, components/rw/pad/PadParts.tsx, pages/rw/RwPadPage.tsx |
| `padSearchParts` **[post-E16]** | sync | `= (ref: string, caliber: string \| undefined, q: string): PadSuggestion[] =>` | mock | staff | none (read) | components/rw/pad/PadParts.tsx, components/rw/pad/PadReview.tsx |
| `padRecordSelection` **[post-E16]** | sync | `= (ref: string, caliber: string \| undefined, part: Part, description: string) =>` | mock | staff | none (read) | components/rw/pad/PadParts.tsx |
| `submitPadRequest` **[post-E16]** | async | `(jobId: string, items: PartsRequestItem[]): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/rw/pad/PadParts.tsx |
| `getPadRequests` **[post-E16]** | async | `(): Promise<PartsRequestWithRefs[]>` | mock | staff | none (read) | pages/rw/RwPadPage.tsx |
| `getReviewQueue` **[post-E16]** | async | `(): Promise<` | mock | staff | none (read) | components/rw/pad/PadReview.tsx, pages/rw/RwPadPage.tsx |
| `reviewItem` **[post-E16]** | async | `(requestId: string, index: number, patch:` | mock | staff | audit | components/rw/pad/PadReview.tsx |
| `sendForClientApproval` **[post-E16]** | async | `(requestId: string): Promise<PartsRequestWithRefs>` | mock | staff | none (read) | components/rw/pad/PadReview.tsx |
| `sendReadyApproval` **[post-E16]** **[post-refresh]** **[v2]** | async | `(requestId: string): Promise<PartsRequestWithRefs>` | mock | staff | audit, email → Sent, comms thread | pages/rs/ApprovalsToSendPage.tsx |
| `simulateClientPartsDecision` **[post-E16]** | async | `(requestId: string, decision: 'approve' \| 'decline'): Promise<PartsRequestWithRefs>` | mock | webhook | audit, comms thread | components/rw/pad/PadReview.tsx |
| `padAllocate` **[post-E16]** | async | `(requestId: string): Promise<PartsRequestWithRefs>` | mock | staff | audit | components/rw/pad/PadReview.tsx |
| `partsOnHand` **[post-E16]** | sync | `= (partId: string) => store.parts.find((p) => p.id === partId)?.stock ?? 0;` | mock | staff | none (read) | components/rw/pad/PadReview.tsx |
| `getM3keEvents` **[post-E16]** | async | `(): Promise<M3keEvent[]>` | mock | staff | none (read) | components/rw/pad/PadReview.tsx |
| `getRoomTechs` **[post-E16]** | sync | `= (): User[] => getDivisionStaff(getSessionDivision()).filter((u) => u.roles.includes('watchmaker') \|\| u.roles.includes('manager') \|\| u.roles.includes('inspector'));` | mock | staff | none (read) | components/rw/pad/PadJobs.tsx |
| `padSetTech` **[post-E16]** | async | `(jobId: string, shortName: string): Promise<JobWithRefs>` | mock | staff | audit | components/rw/pad/PadJobs.tsx |
| `getPadCondition` **[post-E16]** | async | `(jobId: string): Promise<PadConditionView>` | mock | staff | none (read) | components/rw/pad/PadJobs.tsx |

## Client request notes — what the client asked for. Badge on cards, pop-up on every scan, mandatory checklist at QC

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `openClientRequests` **[post-E16]** | sync | `= (j: Job): ClientRequest[] => requestsOf(j).filter((r) => !r.check);` | mock | staff | none (read) | components/jobs/ClientRequests.tsx, components/jobs/ItemHeader.tsx, components/rw/pad/PadJobs.tsx, pages/rw/RwJobPage.tsx |
| `qcRequestGaps` **[post-E16]** | sync | `= (j: Job): ClientRequest[] => (j.status === 'testing' ? openClientRequests(j) : []);` | mock | staff | none (read) | components/jobs/ClientRequests.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/RwQcPage.tsx |
| `addClientRequest` **[post-E16]** | async | `(jobId: string, text: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/ClientRequests.tsx |
| `removeClientRequest` **[post-E16]** | async | `(jobId: string, reqId: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/ClientRequests.tsx |
| `clientRequestAlert` **[post-E16]** | sync | `= (jobId: string): ClientRequestAlert \| null =>` | mock | staff | none (read) | pages/rw/RwBulkAssignPage.tsx, pages/rw/RwPadPage.tsx, pages/rw/RwStationScanPage.tsx, pages/rw/RwWmPage.tsx |
| `ackClientRequests` **[post-E16]** | async | `(jobId: string, via: string): Promise<void>` | mock | staff | audit | components/jobs/ClientRequests.tsx |
| `checkClientRequest` **[post-E16]** | async | `(jobId: string, reqId: string, result: 'done' \| 'na', reason?: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/ClientRequests.tsx |
| `uncheckClientRequest` **[post-E16]** | async | `(jobId: string, reqId: string): Promise<JobWithRefs>` | mock | staff | audit | components/jobs/ClientRequests.tsx |

## Inbox — staff section: anyone can open a colleague's inbox (read + reply); "Assigned to me" stays the shortcut

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getStaffInboxRows` **[post-E16]** | async | `(): Promise<StaffInboxRow[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getColleagueInbox` **[post-E16]** | async | `(shortName: string): Promise<ConversationWithRefs[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Inbound shipping (pre-arrival) + tracking lookup. Carrier calls go ONLY through src/api/carriers/parcelpro.ts

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `SHIP_STAGE_LABEL` **[post-E16]** | sync | `: Record<ShipStage, string>` | mock | staff | audit | components/shipping/ShippingBits.tsx |
| `getInboundBoard` **[post-E16]** | async | `(): Promise<` | mock | staff | none (read) | pages/shipping/InboundShippingPage.tsx |
| `getShipment` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs \| null>` | mock | staff | none (read) | components/shipping/ShippingBits.tsx |
| `getShipmentsForClient` **[post-E16]** | async | `(clientId: string): Promise<ShipmentWithRefs[]>` | mock | staff | none (read) | components/shipping/ShippingBits.tsx |
| `getShipmentForEstimate` **[post-E16]** | async | `(estimateId: string): Promise<ShipmentWithRefs \| null>` | mock | staff | none (read) | components/shipping/ShippingBits.tsx |
| `prepareLabel` **[post-E16]** | async | `(id: string): Promise<LabelPrep>` | mock | staff | none (read) | components/shipping/ShippingBits.tsx |
| `createInboundLabel` **[post-E16]** | async | `(id: string, recipient: ShipAddress, declaredValue: number, carrier: ShipCarrierName, serviceLevel?: ShipServiceLevel, quotedCost?: number): Promise<ShipmentWithRefs>` | mock | staff | audit | components/shipping/ShippingBits.tsx |
| `sendLabelRequest` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<ShipmentWithRefs>` | mock | staff | email → Sent | pages/shipping/InboundShippingPage.tsx |
| `resendLabelEmail` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | mock | staff | audit | pages/shipping/InboundShippingPage.tsx |
| `followUpLabel` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | mock | staff | audit | pages/shipping/InboundShippingPage.tsx |
| `voidAndReissue` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | mock | staff | audit | pages/shipping/InboundShippingPage.tsx |
| `simulateTrackingEvent` **[post-E16]** | async | `(id: string): Promise<ShipmentWithRefs>` | mock | webhook | audit | components/shipping/ShippingBits.tsx, pages/shipping/InboundShippingPage.tsx |
| `clientStatusLine` **[post-E16]** | sync | `= (s: ShipmentWithRefs): string =>` | mock | staff | none (read) | components/shipping/ShippingBits.tsx |

## Job messages — threaded board ON the job (internal only). @mentions route by tier: manager/concierge → hit list pin; bench → Messages section

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `isManagerTier` **[post-E16]** | sync | `= (u: User) => u.accessTier === 'manager' \|\| u.roles.includes('concierge');` | mock | staff | none (read) | components/jobs/JobMessages.tsx, components/rw/bench/BenchLock.tsx |
| `staffForMention` **[post-E16]** | sync | `= (): User[] => getDivisionStaff(getSessionDivision());` | mock | staff | none (read) | components/jobs/JobMessages.tsx |
| `getJobThreads` **[post-E16]** | async | `(jobId: string): Promise<JobThread[]>` | mock | staff | none (read) | components/jobs/JobMessages.tsx |
| `postJobMessage` **[post-E16]** | async | `(jobId: string, text: string, opts:` | mock | staff | audit | components/jobs/JobMessages.tsx |
| `getMessageInbox` **[post-E16]** | async | `(userId: string): Promise<MessageInboxRow[]>` | mock | staff | none (read) | pages/rw/RwWmPage.tsx |
| `unreadMessageCount` **[post-E16]** | sync | `= (short: string) => inboxFor(short).filter((r) => r.unread).length;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `markJobThreadRead` **[post-E16]** | async | `(rootId: string): Promise<void>` | mock | staff | none (read) | components/rw/bench/BenchMessages.tsx |

## Bench Pad — per-tech board, own numbers only, no money

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `STUCK_WORKING_DAYS` **[post-E16]** | sync | `= 4;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getBenchSettings` **[post-E16]** | sync | `= (): BenchSettings => (` | mock | station | localStorage | pages/rw/RwBenchPage.tsx |
| `isOwnerPin` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (pin: string) => fx.users.some((u) => u.id === OWNER_USER_ID && u.pin === pin);` | mock | staff | none (read) | components/rw/bench/BenchSettings.tsx |
| `verifySupervisorPin` **[post-E16]** | sync | `= (pin: string) => fx.users.some((u) => u.accessTier === 'manager' && u.pin === pin);` | mock | staff | none (read) | components/rw/bench/BenchSettings.tsx |
| `saveBenchSettings` **[post-E16]** | sync | `= (s: BenchSettings, supervisorPin: string): BenchSettings =>` | mock | station | audit, localStorage | components/rw/bench/BenchSettings.tsx |
| `setKioskOffline` **[post-E16]** | sync | `= (on: boolean) =>` | mock | staff | localStorage | — (internal / other client.ts functions only) |
| `benchPinIn` **[post-E16]** | async | `(userId: string, pin: string): Promise<User>` | mock | station | audit, localStorage | components/rw/bench/BenchLock.tsx |
| `cacheBenchBoard` **[post-E16]** | sync | `= (b: BenchBoard) => writeJson(`$` | mock | staff | localStorage | pages/rw/RwBenchPage.tsx |
| `readCachedBenchBoard` **[post-E16]** | sync | `= (userId: string): (BenchBoard &` | mock | staff | none (read) | pages/rw/RwBenchPage.tsx |
| `getBenchBoard` **[post-E16]** | async | `(userId: string): Promise<BenchBoard>` | mock | station | none (read) | pages/rw/RwBenchPage.tsx |

## Trade lane — scan-in intake (custody starts; no inspection report, no estimate) + division-manager review queue

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getTradeAccounts` **[post-E16]** | async | `(): Promise<Client[]>` | mock | staff | none (read) | pages/intake/TradeScanInPage.tsx |
| `tradeScanIn` **[post-E16]** | async | `(input: TradeScanInInput): Promise<JobWithRefs>` | mock | staff | audit, job status | pages/intake/TradeScanInPage.tsx |
| `getTradeReviewQueue` **[post-E16]** | async | `(): Promise<TradeReviewRow[]>` | mock | staff | none (read) | components/dashboard/TradeReviewPanel.tsx |
| `TRADE_PATH` **[post-E16]** | sync | `:` | mock | staff | none (read) | components/jobs/JobBits.tsx |
| `tradePathIndex` **[post-E16]** | sync | `= (j: Job): number => (j.status === 'intake' ? 0 : j.status === 'in_service' ? 1 : j.status === 'testing' ? 2 : j.status === 'awaiting_manager_review' ? 3 : 4);` | mock | staff | none (read) | components/jobs/JobBits.tsx |

## Stage / bin audit — what the system believes is at a location vs what is physically scanned

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `AUDIT_LOCATIONS` **[post-E16]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `valueTierOf` **[post-E16]** | sync | `= (j: Job): ValueTier =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `auditScopeFor` **[post-E16]** **[post-refresh]** | sync | `= (u?: User \| null): AuditScope => (!u ? 'full' : u.id === 'u-mm' ? 'wm' : u.id === 'u-jv' ? 'band' : 'full');` | mock | staff | none (read) | pages/rw/RwPadPage.tsx |
| `getAuditLocations` **[post-E16]** | async | `(scope: AuditScope = 'full'): Promise<AuditLocationStatus[]>` | mock | staff | none (read) | components/rw/AuditPanel.tsx, components/rw/SetupAuditsCard.tsx |
| `getAuditStaleDays` **[post-E16]** | sync | `= () => auditStore.staleDays;` | mock | staff | none (read) | components/rw/AuditPanel.tsx, components/rw/SetupAuditsCard.tsx |
| `setAuditStaleDays` **[post-E16]** | async | `(n: number): Promise<number>` | mock | staff | audit | components/rw/SetupAuditsCard.tsx |
| `getAuditLive` **[post-E16]** | sync | `= (): AuditLive \| null => auditStore.live;` | mock | staff | none (read) | components/rw/AuditPanel.tsx, pages/rw/RwStationScanPage.tsx |
| `startAudit` **[post-E16]** | async | `(k: AuditLocationKey): Promise<AuditLive>` | mock | staff | audit | components/rw/AuditPanel.tsx |
| `cancelAudit` **[post-E16]** | async | `(): Promise<void>` | mock | staff | none (read) | components/rw/AuditPanel.tsx |
| `auditScan` **[post-E16]** | async | `(code: string): Promise<` | mock | staff | none (read) | components/rw/AuditPanel.tsx |
| `auditResolve` **[post-E16]** | async | `(itemId: string, resolution: AuditResolution): Promise<AuditLive>` | mock | staff | none (read) | components/rw/AuditPanel.tsx |
| `finishAudit` **[post-E16]** | async | `(): Promise<AuditSession>` | mock | staff | audit | components/rw/AuditPanel.tsx |
| `getAuditSessions` **[post-E16]** | async | `(): Promise<AuditSession[]>` | mock | staff | none (read) | components/rw/AuditPanel.tsx, components/rw/SetupAuditsCard.tsx |

## Work grading gate — categories from a Setup lookup; grades are append-only events attributed to job + responsible tech

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getGradeCategories` **[post-E16]** | async | `(): Promise<GradeCategory[]>` | mock | staff | none (read) | components/rw/SetupGradingCard.tsx |
| `addGradeCategory` **[post-E16]** | async | `(label: string, hint: string, scopes: GradeScope[]): Promise<GradeCategory>` | mock | staff | audit | components/rw/SetupGradingCard.tsx |
| `toggleGradeCategory` **[post-E16]** | async | `(id: string): Promise<GradeCategory>` | mock | staff | audit | components/rw/SetupGradingCard.tsx |
| `gradeGateFor` **[post-E16]** | sync | `= (j: Job): GradeGate =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getGradeGate` **[post-E16]** | async | `(jobId: string): Promise<GradeGate>` | mock | staff | none (read) | components/rw/GradeGatePanel.tsx |
| `recordWorkGrade` **[post-E16]** | async | `(jobId: string, categoryId: string, score: GradeScore, opts:` | mock | staff | audit | components/rw/GradeGatePanel.tsx |
| `getWorkGrades` **[post-E16]** | async | `(filter:` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `techQuality` **[post-E16]** | sync | `= (tech: string, month: string): TechQuality =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Client rating — Attitude / Communication staff-set (concierge+), completed jobs DERIVED; logged old→new. Internal only: no portal read function touches this.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `clientRatingSync` **[post-E16]** | sync | `= (clientId: string): ClientRating =>` | mock | staff | none (read) | components/clients/RatingBadge.tsx |
| `getClientRating` **[post-E16]** | async | `(clientId: string): Promise<ClientRating>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `setClientRating` **[post-E16]** | async | `(clientId: string, input:` | mock | staff | audit | — (internal / other client.ts functions only) |

## Call ledger lives in ./calls.ts (Vonage mock: ring → live → ended / missed, dispositions, click-to-call). client.ts only owns the array + this bridge.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `callsBridge` **[post-E16]** **[post-refresh]** **[v2]** | sync | `` | mock | staff | audit, email → Sent, comms thread | — (internal / other client.ts functions only) |
| `clientByIdSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id: string): Client \| undefined => fx.clients.find((c) => c.id === id);` | mock | staff | none (read) | components/clients/CallLedger.tsx, components/inbox/InboxJobCard.tsx, pages/RequestNewPage.tsx |
| `estimateByIdSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id: string): Estimate \| undefined => store.estimates.find((e) => e.id === id);` | mock | staff | none (read) | components/requests/RequestLines.tsx |
| `jobNumberSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (id: string): string \| undefined => store.jobs.find((j) => j.id === id)?.number;` | mock | staff | none (read) | components/clients/CallLedger.tsx, components/inbox/InboxJobCard.tsx |

## INVENTORY DEEP SESSION — pricing intelligence · needs-ordering · auto-PO · PO labels · receiving flips · cycle-count lock/queue/variance $

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `partPricingSync` **[post-E16]** **[post-refresh]** | sync | `= (partId: string): PartPricing =>` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |
| `getPartPricing` **[post-E16]** **[post-refresh]** | async | `(partId: string): Promise<PartPricing>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `priceColor` **[post-E16]** **[post-refresh]** | sync | `= (unit: number, avg: number \| null): PriceColor => (avg === null \|\| avg === 0 ? 'black' : unit < avg * 0.9 ? 'green' : unit > avg * 1.1 ? 'red' : 'black');` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |

## PARTS MODULE — one part record · one stock count · one reorder rule · one caliber table · one search

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `PART_CATEGORIES` **[post-E16]** **[post-refresh]** | sync | `= ['Vintage Parts', 'Crystals', 'Crowns', 'Inserts', 'Mov-Parts', 'crystal gaskets', 'Bezels', 'Spring bar', 'Main Springs', 'Unique Resale'];` | mock | staff | none (read) | components/setup/AccessLimitsDrawer.tsx |
| `canonicalCategory` **[post-E16]** **[post-refresh]** | sync | `= (c: string): string => (PART_CATEGORIES.includes(c) ? c : LEGACY_CATEGORY[c] ?? (c.includes('spring') && !c.includes('bar') ? 'Main Springs' : c.includes('crystal') ? 'Crystals' : 'Mov-Parts'));` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `PART_SAFES` **[post-E16]** **[post-refresh]** | sync | `: PartSafe[] = [` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `searchPartsSync` **[post-E16]** **[post-refresh]** | sync | `= (q: string, limit = 25): Part[] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `searchParts` **[post-E16]** **[post-refresh]** | async | `(q: string, limit = 25): Promise<PartRow[]>` | mock | staff | none (read) | pages/rs/PartsPage.tsx |
| `getPartsModule` **[post-E16]** **[post-refresh]** | async | `(): Promise<` | mock | staff | none (read) | pages/rs/PartsPage.tsx, pages/rs/PurchasingPage.tsx |
| `getCalibers` **[post-E16]** **[post-refresh]** | async | `(): Promise<Caliber[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `saveCaliber` **[post-E16]** **[post-refresh]** | async | `(input: Omit<Caliber, 'id'> &` | mock | staff | none (read) | pages/rs/PartsPage.tsx |
| `savePart` **[post-E16]** **[post-refresh]** | async | `(input: PartInput): Promise<PartRow>` | mock | staff | audit | pages/rs/PartsPage.tsx |
| `getReorderRule` **[post-E16]** **[post-refresh]** | sync | `= (partId: string): ReorderRule => inv.reorder.get(partId) ??` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |
| `setReorderRule` **[post-E16]** **[post-refresh]** | async | `(partId: string, min: number, orderUpTo: number): Promise<ReorderRule>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `queueNeedsOrdering` **[post-E16]** **[post-refresh]** | async | `(partId: string, reason: 'out_of_stock' \| 'pick_short', qty: number, ctx:` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getNeedsOrdering` **[post-E16]** **[post-refresh]** | async | `(): Promise<NeedsOrderingRow[]>` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |
| `generatePurchaseOrder` **[post-E16]** **[post-refresh]** | async | `(vendorId: string, locationId = 'loc-a1'): Promise<PurchaseOrderWithRefs>` | mock | staff | audit | components/rs/PurchasingDeep.tsx |
| `poRedLines` **[post-E16]** **[post-refresh]** | sync | `= (p: PurchaseOrder) => p.lines.filter((l) => priceColor(l.unitCost, l.avgAtOrder ?? partPricingSync(l.partId).avgCost) === 'red');` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |
| `acknowledgeRedLines` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<PurchaseOrderWithRefs>` | mock | staff | audit | components/rs/PurchasingDeep.tsx |
| `generatePoLabel` **[post-E16]** **[post-refresh]** | async | `(id: string, service = 'UPS 2nd Day Air'): Promise<PurchaseOrderWithRefs>` | mock | staff | audit | components/rs/PurchasingDeep.tsx |
| `uploadPoLabel` **[post-E16]** **[post-refresh]** | async | `(id: string, dataUrl: string): Promise<PurchaseOrderWithRefs>` | mock | staff | audit | components/rs/PurchasingDeep.tsx |
| `importPurchaseCsv` **[post-E16]** **[post-refresh]** | async | `(text: string): Promise<` | mock | staff | audit | components/rs/PurchasingDeep.tsx |
| `vendorOpenPos` **[post-E16]** **[post-refresh]** | sync | `= (vendorId: string) => rs.pos.filter((p) => p.vendorId === vendorId && (p.status === 'sent' \|\| p.status === 'partially_received')).length;` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |
| `vendorHistory` **[post-E16]** **[post-refresh]** | sync | `= (vendorId: string) => inv.history.filter((h) => h.vendorId === vendorId).sort((a, b) => b.at.localeCompare(a.at));` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx |

## Cycle count: location barcodes (LOC-A1), lock, count-next queue, variance $ (manager only)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `locationBarcode` **[post-E16]** **[post-refresh]** | sync | `= (loc: StockLocation) => `LOC-$` | mock | staff | none (read) | pages/rs/CycleCountPage.tsx |
| `CYCLE_STALE_DAYS` **[post-E16]** **[post-refresh]** | sync | `= 30;` | mock | staff | none (read) | pages/rs/CycleCountPage.tsx |
| `getCountQueue` **[post-E16]** **[post-refresh]** | async | `(): Promise<CountQueueRow[]>` | mock | staff | none (read) | pages/rs/CycleCountPage.tsx |
| `resolveLocationScan` **[post-E16]** **[post-refresh]** | sync | `= (code: string): StockLocation \| undefined => rs.locations.find((l) => locationBarcode(l) === code.trim().toUpperCase() \|\| l.id === code.trim().toLowerCase());` | mock | staff | none (read) | pages/rs/CycleCountPage.tsx |
| `resolvePartScan` **[post-E16]** **[post-refresh]** | sync | `= (code: string): Part \| undefined =>` | mock | staff | none (read) | components/rs/PurchasingDeep.tsx, pages/rs/CycleCountPage.tsx |
| `postCycleCountV2` **[post-E16]** **[post-refresh]** | async | `(id: string, counted: Record<string, number>, skipped: string[] = []): Promise<CycleCount>` | mock | staff | audit | pages/rs/CycleCountPage.tsx |
| `getVarianceReport` **[post-E16]** **[post-refresh]** | async | `(f:` | mock | staff | none (read) | pages/rs/CycleCountPage.tsx |

## Watch Records link on the sales order (print QR + invoice email). One tokened portal deep link per SO, reused so the printed QR and the email agree.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `soRecordsLink` **[post-E16]** **[post-refresh]** | sync | `= (o: SalesOrder): string =>` | mock | client-portal | none (read) | components/sales/SoPrint.tsx |
| `soRecordsLinkFor` **[post-E16]** **[post-refresh]** | sync | `= (id: string): string => soRecordsLink(getSO(id));` | mock | client-portal | audit, comms thread | — (internal / other client.ts functions only) |

## Create estimate from a request (Q6 auto-quote rule): request → quoted, estimate carries requestId, thread shows the estimate chip

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getRequestPrefill` **[post-E16]** **[post-refresh]** | async | `(requestId: string): Promise<RequestPrefill>` | mock | staff | none (read) | pages/estimates/EstimateCreatePage.tsx |

## Legacy archive records: read-only display; manager "Convert to editable" duplicates into a native record, original untouched

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `convertLegacy` **[post-E16]** **[post-refresh]** | async | `(kind: 'estimate' \| 'sales_order', id: string): Promise<` | mock | staff | audit | components/LegacyBits.tsx |

## Shipping bill audit: carrier bill lines (suggest → verify) matched by tracking # against every label we ever generated

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `MOCK_BILL_CSV` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | pages/shipping/BillAuditPage.tsx |
| `MOCK_BILL_FILENAME` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | pages/shipping/BillAuditPage.tsx |
| `getLabelLedger` **[post-E16]** **[post-refresh]** | sync | `(): LedgerLabel[]` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `parseBillCsv` **[post-E16]** **[post-refresh]** | sync | `= (text: string, carrier?: string): BillLine[] =>` | mock | staff | none (read) | pages/shipping/BillAuditPage.tsx |
| `getBillAudits` **[post-E16]** **[post-refresh]** | async | `(): Promise<BillAudit[]>` | mock | staff | none (read) | pages/shipping/BillAuditPage.tsx |
| `getBillAudit` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<BillAudit>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `createBillAudit` **[post-E16]** **[post-refresh]** | async | `(lines: BillLine[], fileName: string, vendor = 'Parcel Pro'): Promise<BillAudit>` | mock | staff | audit | pages/shipping/BillAuditPage.tsx |
| `decideBillLine` **[post-E16]** **[post-refresh]** | async | `(auditId: string, lineId: string, action: BillDecision['action'], reason: string): Promise<BillAudit>` | mock | staff | none (read) | pages/shipping/BillAuditPage.tsx |
| `draftDisputeReport` **[post-E16]** **[post-refresh]** | async | `(auditId: string): Promise<DisputeDraft>` | mock | staff | none (read) | pages/shipping/BillAuditPage.tsx |
| `sendDisputeReport` **[post-E16]** **[post-refresh]** | async | `(auditId: string, subject: string, body: string): Promise<BillAudit>` | mock | staff | audit, email → Sent | pages/shipping/BillAuditPage.tsx |
| `markBillRecovered` **[post-E16]** **[post-refresh]** | async | `(auditId: string, amount: number): Promise<BillAudit>` | mock | staff | audit | pages/shipping/BillAuditPage.tsx |

## E17 CONVERGENCE — routing layer. Covered functions go to the real Prototype API in hybrid mode and fall back to the mock above per call.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `API_BASE_URL` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/layout/AppShell.tsx |
| `API_MODE` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/layout/AppShell.tsx |
| `API_SOURCE` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `setApiMode` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/layout/AppShell.tsx |
| `getApiHealth` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/layout/AppShell.tsx |
| `subscribeApiHealth` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/layout/AppShell.tsx |
| `API_TOAST_EVENT` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/layout/AppShell.tsx |
| `isReal` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `signInWithPassword` | sync | `= route('signInWithPassword', signInWithPasswordMock, async (userId: string, password: string, photo: VerificationPhoto) =>` | real | none | none (read) | auth/AuthContext.tsx |
| `getEstimates` | sync | `= route('getEstimates', getEstimatesMock, real.getEstimates);` | real | staff | none (read) | pages/rs/RsPages.tsx |
| `getEstimate` | sync | `= route('getEstimate', getEstimateMock, async (id: string) => (await real.getEstimate(id)) ?? getEstimateMock(id));` | real | staff | none (read) | components/companion/CompanionPanel.tsx, pages/estimates/EstimateDetailPage.tsx |
| `getJobs` | sync | `= route('getJobs', getJobsMock, real.getJobs);` | real | staff | none (read) | components/today/NewTaskForm.tsx, pages/rs/RsPages.tsx |
| `getJob` | sync | `= route('getJob', getJobMock, async (id: string) => (await real.getJob(id)) ?? getJobMock(id));` | real | staff | none (read) | components/companion/CompanionPanel.tsx, components/companion/CompanionTabs.tsx, components/inbox/InboxJobCard.tsx, components/jobs/JobDetailContent.tsx, components/layout/MessageComposer.tsx, components/layout/MessageDirectory.tsx, pages/jobs/JobDetailPage.tsx, pages/rw/RwEvidencePage.tsx, pages/rw/RwInspectPage.tsx, pages/rw/RwJobPage.tsx, pages/rw/testing/RwTestingTestPage.tsx |
| `getSalesOrders` | sync | `= route('getSalesOrders', getSalesOrdersMock, real.getSalesOrders);` | real | staff | none (read) | components/layout/CornerLookup.tsx, pages/rs/RsPages.tsx |
| `getSalesOrder` | sync | `= route('getSalesOrder', getSalesOrderMock, async (id: string) => (await real.getSalesOrder(id)) ?? getSalesOrderMock(id));` | real | staff | none (read) | pages/sales/PickupStationPage.tsx, pages/sales/SalesOrderDetailPage.tsx, pages/sales/ShipStationPage.tsx |
| `getToday` | sync | `= route('getToday', getTodayMock, real.getToday);` | real | staff | none (read) | components/dashboard/HitListPanel.tsx, components/today/StaffHitListModal.tsx, pages/TodayPage.tsx |
| `resolveIdentifier` | sync | `= route('resolveIdentifier', resolveIdentifierMock, real.resolveIdentifier);` | real | staff | none (read) | components/clients/IdentifierSearch.tsx |
| `getRequests` | sync | `= route('getRequests', getRequestsMock, real.getRequests);` | real | staff | none (read) | — (internal / other client.ts functions only) |
| `getPackages` | sync | `= route('getPackages', getPackagesMock, real.getPackages);` | real | staff | none (read) | pages/intake/ArrivalPage.tsx, pages/intake/ReceivePackageListPage.tsx, pages/intake/ReceiveWatchListPage.tsx, pages/intake/WorkOrderPage.tsx |
| `getDashboardStats` | sync | `= route('getDashboardStats', getDashboardStatsMock, real.getDashboardStats);` | real | staff | none (read) | pages/Dashboard.tsx, pages/rs/RsPages.tsx |
| `getRecentActivity` | sync | `= route('getRecentActivity', getRecentActivityMock, real.getRecentActivity);` | real | staff | none (read) | components/dashboard/RecentActivity.tsx |

## SUPERVISOR DEPARTMENT DASHBOARD (WM room today; the same shape re-parameterises for the band room)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `techRevenueGoal` **[post-E16]** **[post-refresh]** | sync | `= (short: string) => techRevenueGoals[short] ?? 10_000;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getDeptGoal` **[post-E16]** **[post-refresh]** | sync | `= (d: 'wm' \| 'band') => ROOM_TECHS[d].reduce((t, s) => t + techRevenueGoal(s), 0);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getTeamGoals` **[post-E16]** **[post-refresh]** | async | `(d: 'wm' \| 'band'): Promise<` | mock | staff | none (read) | components/rw/pad/PadDashboard.tsx |
| `setTechGoal` **[post-E16]** **[post-refresh]** | async | `(short: string, goal: number): Promise<number>` | mock | staff | audit | components/rw/pad/PadDashboard.tsx |
| `setDeptGoal` **[post-E16]** **[post-refresh]** | async | `(): Promise<number>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getDeptDashboard` **[post-E16]** **[post-refresh]** | async | `(d: 'wm' \| 'band' = 'wm'): Promise<DeptDashboard>` | mock | staff | none (read) | components/rw/pad/PadDashboard.tsx |
| `jobDaysInStage` **[post-E16]** **[post-refresh]** | sync | `= (j: Job) => daysInStage(j);` | mock | staff | none (read) | components/rw/pad/PadDashboard.tsx |

## PARTS: per-job allowance ($300–$1000, job-level), Quick Add (no approval while under allowance), returns (no approval, audited)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `jobPartsAllowance` **[post-E16]** **[post-refresh]** | sync | `= (jobId: string): number => rwParts.allowance[jobId] ?? (300 + (Math.abs([...jobId].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % 8) * 100);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `setJobPartsAllowance` **[post-E16]** **[post-refresh]** | async | `(jobId: string, amount: number): Promise<number>` | mock | staff | audit | components/rw/pad/PadQuickAdd.tsx |
| `getJobParts` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<JobPartsView>` | mock | staff | none (read) | components/rw/pad/PadQuickAdd.tsx |
| `quickAddPart` **[post-E16]** **[post-refresh]** | async | `(jobId: string, partCode: string, qty = 1): Promise<QuickAddResult>` | mock | staff | audit | components/rw/pad/PadQuickAdd.tsx |
| `returnJobPart` **[post-E16]** **[post-refresh]** | async | `(jobPartId: string, note?: string): Promise<JobPartsView>` | mock | staff | audit | components/rw/pad/PadQuickAdd.tsx |

## COMPONENT CODE CHIPS (W · B · P · PM) + TRICKLE-DOWN VERIFICATION CHAIN — Expected (estimate) → Received (Scan 1, package contents) → Verified (Scan 2, inspector)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `inferComponentCodes` **[post-E16]** **[post-refresh]** | sync | `= (lines: EstimateLine[]): DeptCode[] => uniq(lines.filter((l) => l.type !== 'shipping' && (l.description.trim() \|\| l.unitPrice)).map((l) => l.dept));` | mock | staff | none (read) | pages/estimates/EstimateDetailPage.tsx |
| `estimateComponentCodes` **[post-E16]** **[post-refresh]** | sync | `= (e: Estimate):` | mock | staff | none (read) | pages/estimates/EstimateDetailPage.tsx, pages/intake/ReceivePackagePage.tsx |
| `setEstimateComponents` **[post-E16]** **[post-refresh]** | async | `(id: string, codes: DeptCode[]): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `getVerificationChains` **[post-E16]** **[post-refresh]** | async | `(estimateId: string): Promise<VerificationChain[]>` | mock | staff | none (read) | components/estimates/ComponentChain.tsx |
| `getJobVerificationChains` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<VerificationChain[]>` | mock | staff | none (read) | components/estimates/ComponentChain.tsx |
| `getItemVerificationChain` **[post-E16]** **[post-refresh]** | async | `(estimateId: string, itemId: string): Promise<VerificationChain \| null>` | mock | staff | none (read) | components/estimates/ComponentChain.tsx |
| `syncEstimateComponents` **[post-E16]** **[post-refresh]** | sync | `= (e: Estimate) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `setEstimateItemComponents` **[post-E16]** **[post-refresh]** | async | `(estimateId: string, itemId: string, codes: DeptCode[] \| null): Promise<EstimateWithRefs>` | mock | staff | audit | pages/estimates/EstimateDetailPage.tsx |
| `getVerificationChain` **[post-E16]** **[post-refresh]** | async | `(estimateId: string): Promise<VerificationChain \| null>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getJobVerificationChain` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<VerificationChain \| null>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## WATCHMAKER-ROOM PHOTO KIOSK — shared common-area station (microscope + IPEVO). Attribution = the scanned job's assigned watchmaker; the kiosk has no login.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `KIOSK_STEPS` **[post-E16]** **[post-refresh]** | sync | `: KioskStep[] = [` | mock | staff | none (read) | components/rw/KioskRequirementBanner.tsx, pages/kiosk/WmKioskPage.tsx |
| `kioskRequiredSetting` **[post-E16]** **[post-refresh]** | sync | `= () => localStorage.getItem(KIOSK_KEY) !== 'off';` | mock | station | localStorage | components/setup/KioskSettingCard.tsx, pages/kiosk/WmKioskPage.tsx |
| `setKioskRequired` **[post-E16]** **[post-refresh]** | async | `(on: boolean): Promise<boolean>` | mock | staff | audit, localStorage | components/setup/KioskSettingCard.tsx |
| `getKioskStatus` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<KioskStatus>` | mock | staff | none (read) | components/rw/KioskRequirementBanner.tsx, pages/kiosk/WmKioskPage.tsx |
| `startKioskSession` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<KioskSession>` | mock | staff | audit | pages/kiosk/WmKioskPage.tsx |
| `recordKioskShot` **[post-E16]** **[post-refresh]** | async | `(sessionId: string, shot: Omit<KioskShot, 'at'>): Promise<KioskSession>` | mock | staff | audit | pages/kiosk/WmKioskPage.tsx |
| `addKioskPhoto` **[post-E16]** **[post-refresh]** | async | `(jobId: string, dataUrl: string, device: string, note: string): Promise<PackagePhoto>` | mock | staff | audit | pages/kiosk/WmKioskPage.tsx |

## PER-STAFF CLIENT REVIEWS — every staff member rates independently (A / C); N = jobs that person handled for the client. Aggregate badge = rounded mean of the latest review per staff. Internal only.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getClientReviews` **[post-E16]** **[post-refresh]** | async | `(clientId: string): Promise<ClientReviews>` | mock | staff | none (read) | components/clients/RatingBadge.tsx |
| `submitClientReview` **[post-E16]** **[post-refresh]** | async | `(clientId: string, input:` | mock | staff | audit | components/clients/RatingBadge.tsx |

## QUICKBOOKS ONLINE — MOCKED setup screen (no OAuth, no network). Toggles + field mapping + client sync table; every action logged.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getQboSetup` **[post-E16]** **[post-refresh]** | async | `(): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |
| `qboConnect` **[post-E16]** **[post-refresh]** | async | `(company: string): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |
| `qboDisconnect` **[post-E16]** **[post-refresh]** | async | `(): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |
| `setQboToggle` **[post-E16]** **[post-refresh]** | async | `(key: keyof QboSetup['toggles'], value: boolean): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |
| `qboSyncClient` **[post-E16]** **[post-refresh]** | async | `(clientId: string): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |
| `qboSyncAllClients` **[post-E16]** **[post-refresh]** | async | `(): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |
| `qboResolveConflict` **[post-E16]** **[post-refresh]** | async | `(clientId: string, how: 'link' \| 'skip'): Promise<QboSetup>` | mock | staff | none (read) | pages/rs/QboSetupPage.tsx |

## NO-ESTIMATE RECEIVING BRANCH — three-tier B2B label match chain: (1) tracking # on a label we issued → estimate · (2) trade account code → client · (3) name / email → candidates. SUB# is issued either way.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `matchB2bLabel` **[post-E16]** **[post-refresh]** | async | `(code: string, packageId?: string): Promise<B2bMatch>` | mock | staff | none (read) | components/intake/NoEstimatePanel.tsx |
| `attachB2bMatch` **[post-E16]** **[post-refresh]** | async | `(packageId: string, m:` | mock | staff | audit | components/intake/NoEstimatePanel.tsx |

## RW client / job history lookup — no dollar amounts (MoneyContext hides them anyway; stripped here too)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `searchRwHistory` **[post-E16]** **[post-refresh]** | async | `(query: string): Promise<RwHistoryHit[]>` | mock | staff | none (read) | pages/rw/RwHistoryPage.tsx |
| `uniqComponents` **[post-E16]** **[post-refresh]** | sync | `= (codes: DeptCode[]): string[] => uniq(codes.flatMap((d) => fx.DEPT_COMPONENTS[d]));` | mock | staff | none (read) | components/estimates/ComponentChain.tsx, components/intake/IntakeHistoryBits.tsx |

## Sent emails for a job (read-only aggregation for the Supervisor Pad detail) — Sent rows whose ref is the job, its estimate, its SO or one of its parts requests; parts-approval status comes from the PR

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getJobEmails` **[post-E16]** **[post-refresh]** | async | `(jobId: string): Promise<JobEmailRow[]>` | mock | staff | email → Sent | components/rw/pad/PadJobs.tsx |

## Shared job filter vocabulary — one list for the RS "All Jobs" view and the RW Reports section (modeled on the legacy RolliWorks Reports screen)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `JOB_CATEGORIES` **[post-E16]** **[post-refresh]** | sync | `:` | mock | staff | none (read) | pages/jobs/AllJobsPage.tsx, pages/rw/RwReportsPage.tsx |
| `REPORT_STATUSES` **[post-E16]** **[post-refresh]** | sync | `:` | mock | staff | none (read) | pages/rw/RwReportsPage.tsx |
| `QUICK_REPORTS` **[post-E16]** **[post-refresh]** | sync | `:` | mock | staff | none (read) | pages/rw/RwReportsPage.tsx |
| `getJobReport` **[post-E16]** **[post-refresh]** | async | `(f: JobReportFilter` | mock | staff | none (read) | pages/jobs/AllJobsPage.tsx, pages/rw/RwReportsPage.tsx |

## Receive Watch (Stage 4) helpers — est# → awaiting-inspection package, and a simple prefix decoder for the serial field (real authentication reference tables are still outstanding from MH)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `findInspectionPackage` **[post-E16]** **[post-refresh]** | async | `(numberOrId: string): Promise<` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx, pages/intake/ReceiveWatchPage.tsx |
| `decodeSerial` **[post-E16]** **[post-refresh]** | sync | `= (serial: string, reference?: string): SerialDecode =>` | mock | staff | none (read) | pages/intake/ReceiveWatchPage.tsx |

## NEW INSPECTION FORM (legacy RolliWorks structure) — learned preset-note library, per-component authenticity, bracelet repair lines, running total, tokened client report

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `AUTHENTICITY` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/inspection/InspectionReportView.tsx, pages/inspection/InspectionFormPage.tsx |
| `BRACELET_LINES` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `CONDITIONS` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | components/inspection/InspectionReportView.tsx, pages/inspection/InspectionFormPage.tsx |
| `INSPECTION_COMPONENTS` **[post-E16]** **[post-refresh]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `type BraceletRepairLine` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `type InspComponent` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `type InspComponentEntry` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `type InspectionForm` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `type Condition` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `type Authenticity` **[post-E16]** **[post-refresh]** **[v2]** | const | `fixture re-export` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `inspectionNoteLibrary` **[post-E16]** **[post-refresh]** | sync | `= (c: InspComponent) => insp.notes[c];` | mock | staff | none (read) | components/inspection/InspectionReportView.tsx, pages/inspection/InspectionFormPage.tsx |
| `inspectionQuickTags` **[post-E16]** **[post-refresh]** | sync | `= () => insp.quickTags;` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `dialVariantTags` **[post-E16]** **[post-refresh]** | sync | `= () => insp.dialVariants;` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `learnInspectionNote` **[post-E16]** **[post-refresh]** | async | `(c: InspComponent, text: string): Promise<number>` | mock | staff | audit | pages/inspection/InspectionFormPage.tsx |
| `learnDialVariant` **[post-E16]** **[post-refresh]** | async | `(tag: string): Promise<string[]>` | mock | staff | audit | pages/inspection/InspectionFormPage.tsx |
| `learnQuickTag` **[post-E16]** **[post-refresh]** | async | `(tag: string): Promise<string[]>` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `inspectionTotal` **[post-E16]** **[post-refresh]** | sync | `= (f: InspectionForm): number =>` | mock | staff | none (read) | components/inspection/InspectionReportView.tsx, pages/inspection/InspectionFormPage.tsx |
| `listInspectionForms` **[post-E16]** **[post-refresh]** | async | `(): Promise<InspectionForm[]>` | mock | staff | none (read) | pages/intake/IntakeStepPages.tsx |
| `getInspectionForm` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<InspectionForm \| null>` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `getInspectionFormByToken` **[post-E16]** **[post-refresh]** | async | `(token: string): Promise<(InspectionForm &` | mock | staff | none (read) | pages/rc/RcInspectionFormPage.tsx |
| `newInspectionForm` **[post-E16]** **[post-refresh]** | async | `(seed?:` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `saveInspectionForm` **[post-E16]** **[post-refresh]** | async | `(form: InspectionForm, commit: boolean): Promise<InspectionForm>` | mock | staff | audit | pages/inspection/InspectionFormPage.tsx |
| `addInspectionPhoto` **[post-E16]** **[post-refresh]** | async | `(id: string, p:` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `applySheetSuggestion` **[post-E16]** **[post-refresh]** | sync | `= (f: InspectionForm, s: SheetSuggestion, accepted: Set<string>): InspectionForm =>` | mock | staff | none (read) | pages/inspection/InspectionFormPage.tsx |
| `shortNameOf` **[post-E16]** **[post-refresh]** | sync | `= (userId: string) => fx.users.find((u) => u.id === userId)?.shortName ?? userId;` | mock | staff | none (read) | components/rw/pad/PadJobs.tsx |

## Appointments bridge (data module lives in ./appointments.ts; these expose the store bits it needs)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `actorInfo` **[post-E16]** **[post-refresh]** | sync | `= () => actor();` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Hitlist bridge (per-person hit lists, inbox, supervisor rollup live in ./hitlist.ts)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `hitlistBridge` **[post-E16]** **[post-refresh]** | sync | `` | mock | staff | audit | — (internal / other client.ts functions only) |

## Appraisal bridge (./appraisals.ts)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `appraisalBridge` **[post-E16]** **[post-refresh]** | sync | `` | mock | staff | audit | — (internal / other client.ts functions only) |

## Bench-test capture bridge (before/after timing + pressure slips, tolerance sheet — ./benchTests.ts)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `benchBridge` **[post-E16]** **[post-refresh]** | sync | `` | mock | staff | audit | — (internal / other client.ts functions only) |
| `auditAppointments` **[post-E16]** **[post-refresh]** | sync | `= (detail: string) => appendAudit(` | mock | staff | audit | — (internal / other client.ts functions only) |
| `lookupApptRef` **[post-E16]** **[post-refresh]** | sync | `= (type: 'drop_off' \| 'pick_up', raw: string): ApptRefLookup \| null =>` | mock | staff | none (read) | pages/SchedulePage.tsx |
| `clientBrief` **[post-E16]** **[post-refresh]** | sync | `= (clientId: string) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Scan 1 · Arrival as a bulk session: scan, scan, scan → Commit (same pattern as the Assign/Move click map). Nothing is logged until Commit.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `previewArrival` **[post-E16]** **[post-refresh]** | sync | `= (raw: string, carrier?: Carrier): ArrivalRow =>` | mock | staff | none (read) | components/intake/TwoScanBits.tsx |
| `commitArrivals` **[post-E16]** **[post-refresh]** | async | `(rows: ArrivalRow[], signature: boolean): Promise<ArrivalCommitResult[]>` | mock | staff | audit | components/intake/TwoScanBits.tsx, pages/intake/ArrivalPage.tsx |

## MH-only: zero balance / mark paid WITHOUT QBO sync (barter or internal work — no money changed hands, must not inflate revenue)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `ZERO_REASON_LABEL` **[post-E16]** **[post-refresh]** | sync | `: Record<ZeroBalanceReason, string>` | mock | staff | none (read) | components/sales/FulfillMenu.tsx, pages/rs/HitlistPage.tsx, pages/sales/SalesOrderDetailPage.tsx |
| `zeroBalanceNoSync` **[post-E16]** **[post-refresh]** | async | `(id: string, reason: ZeroBalanceReason, notes: string): Promise<SalesOrderWithRefs>` | mock | owner | audit | components/sales/FulfillMenu.tsx |
| `zeroBalanceLog` **[post-E16]** **[post-refresh]** | sync | `= (): ZeroBalanceRow[] => store.salesOrders.filter((o) => o.zeroBalance).map((o) => (` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Sales order Fulfill menu actions (ported from the legacy SO screen)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `sendSoReminder` **[post-E16]** **[post-refresh]** | async | `(id: string, kind: 'pickup' \| 'payment', channel: 'email' \| 'sms'): Promise<SalesOrderWithRefs>` | mock | staff | audit, email → Sent | components/sales/FulfillMenu.tsx |

## QBO stub · VB4-09 (mock, but modelled on Intuit semantics)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getInvoiceLink` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<InvoiceLink>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `updateInvoice` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, patch: UpdateInvoicePatch, syncToken: number): Promise<InvoiceLink>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `simulatePaymentWebhook` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, amount?: number): Promise<` | mock | webhook | audit | — (internal / other client.ts functions only) |
| `qboReadBalance` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string): Promise<InvoiceLink>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `getShipCart` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<SalesOrderWithRefs[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `qboSyncInvoice` **[post-E16]** **[post-refresh]** | async | `(id: string, direction: 'pull' \| 'push'): Promise<SalesOrderWithRefs>` | mock | webhook | audit | components/sales/FulfillMenu.tsx |
| `deleteSalesOrder` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<void>` | mock | staff | audit | components/sales/FulfillMenu.tsx |

## SHOP WORK ORDERS (SWO) — outsourced work (plating / refinish) sent to outside vendors. Linear 5-stage flow + independent Paid flag.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `baseStage` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (k: SwoStage): Exclude<SwoStage, `redo_$` | mock | staff | none (read) | components/concierge/ActionMap.tsx, components/concierge/SlidePanel.tsx, pages/rs/SwoHubPage.tsx |
| `isRedoStage` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (k: SwoStage) => k.startsWith('redo_');` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `SWO_STAGES` **[post-E16]** **[post-refresh]** | sync | `:` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `SHIP_LANE` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: SwoStage[] = ['queue', 'sent', 'at_vendor', 'inbound', 'received', 'inspection', 'fulfilled'];` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `NOSHIP_LANE` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: SwoStage[] = ['queue', 'at_vendor', 'inspection', 'fulfilled'];` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `laneStagesFor` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: Vendor): SwoStage[] => (v.ships === false ? NOSHIP_LANE : SHIP_LANE);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `swoStageLabel` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (k: SwoStage) => `$` | mock | staff | none (read) | components/concierge/ActionMap.tsx, components/concierge/SlidePanel.tsx, components/concierge/SwoBits.tsx, components/concierge/SwoCard.tsx, components/jobs/OutsourceInfo.tsx |
| `nextSwoStage` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: Vendor, stage: SwoStage): SwoStage \| undefined =>` | mock | staff | none (read) | components/concierge/ActionMap.tsx, components/concierge/SwoCard.tsx |
| `prevSwoStage` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: Vendor, stage: SwoStage): SwoStage \| undefined =>` | mock | staff | none (read) | components/concierge/ActionMap.tsx, components/concierge/SwoCard.tsx |
| `shipDaysFor` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: Vendor) => (v.ships === false ? 0 : isInternationalVendor(v) ? 5 : 2);` | mock | staff | none (read) | pages/rs/SwoPage.tsx |
| `defaultExpectedAt` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: Vendor, from = new Date()) => new Date(from.getTime() + ((v.leadTimeDays ?? 10) + 2 * shipDaysFor(v)) * 86_400_000).toISOString().slice(0, 10);` | mock | staff | none (read) | pages/rs/SwoPage.tsx |
| `isInternationalVendor` **[post-E16]** **[post-refresh]** | sync | `= (v: Vendor) => !!v.country && v.country !== 'US';` | mock | staff | none (read) | components/concierge/LaneBoard.tsx, pages/rs/SwoPage.tsx |
| `getShopWorkOrders` **[post-E16]** **[post-refresh]** | async | `(): Promise<SwoWithRefs[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getShopWorkOrder` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<SwoWithRefs>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getOutsourceVendors` **[post-E16]** **[post-refresh]** | async | `(): Promise<Vendor[]>` | mock | staff | none (read) | pages/rs/SwoPage.tsx |
| `saveShopWorkOrder` **[post-E16]** **[post-refresh]** | async | `(i: SwoInput): Promise<SwoWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `createSwoOutboundLabel` **[post-E16]** **[post-refresh]** | async | `(id: string, customs?: Partial<SwoCustoms>): Promise<SwoWithRefs>` | mock | staff | audit, email → Sent | components/concierge/ActionMap.tsx, components/concierge/SwoCard.tsx |
| `queueSwoReturnLabel` **[post-E16]** **[post-refresh]** | async | `(id: string, predictedCompletion?: string): Promise<SwoWithRefs>` | mock | staff | audit, email → Sent | components/concierge/ActionMap.tsx, components/concierge/SwoCard.tsx |
| `advanceSwo` **[post-E16]** **[post-refresh]** | async | `(id: string, to: SwoStage): Promise<SwoWithRefs>` | mock | staff | audit | components/concierge/ActionMap.tsx, components/concierge/SwoCard.tsx |
| `sendBackSwo` **[post-E16]** **[post-refresh]** **[v2]** | async | `(id: string, reason: string): Promise<SwoWithRefs>` | mock | staff | audit | components/concierge/ActionMap.tsx, components/concierge/SwoCard.tsx |
| `swoIsLate` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo) => !!w.predictedCompletion && w.predictedCompletion < new Date().toISOString().slice(0, 10) && ['sent', 'at_vendor', 'inbound'].includes(baseStage(w.stage));` | mock | staff | none (read) | components/concierge/SlidePanel.tsx |
| `swoPaidTotal` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo) => w.invoices.filter((i) => i.paid).reduce((t, i) => t + i.amount, 0);` | mock | staff | none (read) | components/concierge/SlidePanel.tsx |
| `swoUnpaidTotal` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo) => w.invoices.filter((i) => !i.paid).reduce((t, i) => t + i.amount, 0);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `swoDaysAtStage` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo) => Math.max(0, Math.floor((Date.now() - new Date(w.stageAt ?? w.receivedAt ?? w.inboundAt ?? w.atVendorAt ?? w.sentAt ?? w.createdAt).getTime()) / 86_400_000));` | mock | staff | none (read) | components/concierge/SwoCard.tsx, pages/rs/SwoHubPage.tsx |
| `getConciergeBoard` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<ConciergeLane[]>` | mock | staff | none (read) | pages/rs/ConciergePage.tsx, pages/rw/RwConciergePage.tsx |
| `jobOnVendorLane` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (jobId: string) =>` | mock | staff | none (read) | components/rw/pad/PadJobs.tsx |
| `conciergeVendors` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): Vendor[] => rs.vendors.filter((v) => v.kind === 'outsource' && v.active);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `conciergeBridge` **[post-E16]** **[post-refresh]** **[v2]** | sync | `` | mock | staff | audit | — (internal / other client.ts functions only) |
| `setSwoPaid` **[post-E16]** **[post-refresh]** | async | `(): Promise<never>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `pushSwoToQbo` **[post-E16]** **[post-refresh]** | async | `(id: string): Promise<SwoWithRefs>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `getSwoJobCandidates` **[post-E16]** **[post-refresh]** | async | `(q: string): Promise<` | mock | staff | none (read) | components/concierge/SwoBits.tsx, pages/rs/SwoPage.tsx |

## SWO HUBS (MH 2026-09-30) — a Shop Work Order is a CONTAINER (the box / envelope / hand-off batch) that goes to a vendor; the LINES inside are job components + what was physically sent.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `VENDOR_PRESETS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: Record<string, string[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `partKey` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');` | mock | staff | none (read) | components/concierge/SwoBits.tsx |
| `vendorPresets` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: Vendor): string[] => v.commonlySent ?? VENDOR_PRESETS[v.id] ?? [];` | mock | staff | none (read) | components/concierge/SwoBits.tsx, pages/rs/SwoPage.tsx |
| `hubOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo): SwoHub \| undefined => hubs.find((h) => h.id === w.hubId);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `hubStage` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (h: SwoHub): SwoStage =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `hubSet` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo \| SwoHub, patch:` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `sentSummary` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (parts: SentPart[] \| undefined) => (parts?.length ? parts.map((p) => p.label).join(' · ') : '');` | mock | staff | none (read) | pages/rs/SwoHubPage.tsx |
| `hubViewSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (h: SwoHub): SwoHubView =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `findHubByCode` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (code: string): SwoHub \| undefined =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `isSwoCode` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (code: string) => /^SWO\s*-?\d` | mock | staff | none (read) | components/concierge/ActionMap.tsx |
| `swoLineBack` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo) => lineBack(w);` | mock | staff | none (read) | components/concierge/SwoBits.tsx |
| `swoReceivable` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (w: Swo): boolean =>` | mock | staff | none (read) | components/concierge/SwoCard.tsx, pages/rs/SwoHubPage.tsx |
| `hubOpenLineIds` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (code: string):` | mock | staff | none (read) | components/concierge/ActionMap.tsx |
| `getSwoHub` **[post-E16]** **[post-refresh]** **[v2]** | async | `(idOrNumber: string): Promise<SwoHubView \| null>` | mock | staff | none (read) | pages/rs/SwoHubPage.tsx, pages/rs/SwoPage.tsx |
| `getSwoHubs` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<SwoHubView[]>` | mock | staff | none (read) | pages/rs/SwoPage.tsx |
| `hubForLineSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (lineId: string): SwoHubView \| null =>` | mock | staff | none (read) | components/concierge/SlidePanel.tsx |
| `createSwoHub` **[post-E16]** **[post-refresh]** **[v2]** | async | `(input:` | mock | staff | audit | pages/rs/SwoPage.tsx |
| `addSwoLine` **[post-E16]** **[post-refresh]** **[v2]** | async | `(hubId: string, input: SwoLineInput): Promise<SwoHubView>` | mock | staff | audit | components/concierge/SwoBits.tsx, pages/rs/SwoPage.tsx |
| `removeSwoLine` **[post-E16]** **[post-refresh]** **[v2]** | async | `(lineId: string): Promise<SwoHubView>` | mock | staff | audit | pages/rs/SwoHubPage.tsx |
| `printSwoLabel` **[post-E16]** **[post-refresh]** **[v2]** | async | `(hubId: string): Promise<SwoHubView>` | mock | staff | audit | pages/rs/SwoHubPage.tsx |
| `addSwoNote` **[post-E16]** **[post-refresh]** **[v2]** | async | `(hubId: string, text: string): Promise<SwoHubView>` | mock | staff | audit | pages/rs/SwoHubPage.tsx |
| `createHubShipment` **[post-E16]** **[post-refresh]** **[v2]** | async | `(hubId: string, direction: 'outbound' \| 'return', lineIds: string[], customs?: Partial<SwoCustoms>, redoN?: number): Promise<SwoHubView>` | mock | staff | audit, email → Sent | components/concierge/ActionMap.tsx, pages/rs/SwoHubPage.tsx |
| `simulateShipmentDelivered` **[post-E16]** **[post-refresh]** **[v2]** | async | `(hubId: string, shipmentId: string): Promise<SwoHubView>` | mock | webhook | audit | pages/rs/SwoHubPage.tsx |
| `receiveSwoLine` **[post-E16]** **[post-refresh]** **[v2]** | async | `(lineId: string, returned: Record<string, boolean>): Promise<SwoHubView>` | mock | staff | audit | components/concierge/SwoBits.tsx |
| `markPartReturned` **[post-E16]** **[post-refresh]** **[v2]** | async | `(lineId: string, key: string): Promise<SwoHubView>` | mock | staff | audit | — (internal / other client.ts functions only) |
| `updateSwoHub` **[post-E16]** **[post-refresh]** **[v2]** | async | `(hubId: string, patch:` | mock | staff | audit | pages/rs/SwoHubPage.tsx |
| `moveSwoLines` **[post-E16]** **[post-refresh]** **[v2]** | async | `(lineIds: string[], dir: 'forward' \| 'back', reason?: string): Promise<MoveResult>` | mock | staff | none (read) | components/concierge/SlidePanel.tsx, pages/rs/SwoHubPage.tsx |
| `moveLineToHub` **[post-E16]** **[post-refresh]** **[v2]** | async | `(lineId: string, hubCode: string): Promise<SwoHubView>` | mock | staff | audit | pages/rs/SwoHubPage.tsx |
| `openHubsForVendor` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (vendorId: string): SwoHubView[] =>` | mock | staff | none (read) | pages/rs/SwoHubPage.tsx, pages/rs/SwoPage.tsx |
| `jobAwaySync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (jobId: string): AwayPart[] =>` | mock | staff | audit | components/jobs/OutsourceInfo.tsx |

## Feature switches (Setup, manager)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `FEATURE_META` **[post-E16]** **[post-refresh]** | sync | `: Record<FeatureKey,` | mock | staff | none (read) | pages/SetupRsPanels.tsx |
| `featureOn` **[post-E16]** **[post-refresh]** | sync | `= (k: FeatureKey) => features[k];` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getFeatureFlags` **[post-E16]** **[post-refresh]** | async | `(): Promise<Record<FeatureKey, boolean>>` | mock | staff | none (read) | pages/SetupRsPanels.tsx, rc/RcSendWatch.tsx |
| `setFeatureFlag` **[post-E16]** **[post-refresh]** | async | `(k: FeatureKey, on: boolean): Promise<Record<FeatureKey, boolean>>` | mock | staff | audit | pages/SetupRsPanels.tsx |

## Client-created inbound labels (portal) — audit trail: who / job / values used / whether the suggested declared value was changed

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `getClientLabelLog` **[post-E16]** **[post-refresh]** | async | `(): Promise<ClientLabelLogRow[]>` | mock | staff | none (read) | pages/shipping/InboundShippingPage.tsx |
| `portalStartLabel` **[post-E16]** **[post-refresh]** | async | `(clientId: string, estimateId: string, address: Address, serviceLevel: ShipServiceLevel): Promise<PortalLabelPrep>` | mock | client-portal | none (read) | rc/RcSendWatch.tsx |
| `portalCancelLabel` **[post-E16]** **[post-refresh]** | async | `(clientId: string, shipmentId: string): Promise<void>` | mock | client-portal | none (read) | rc/RcSendWatch.tsx |
| `portalCreateLabel` **[post-E16]** **[post-refresh]** | async | `(clientId: string, shipmentId: string, input:` | mock | client-portal | audit | components/shipping/ShippingBits.tsx |

## Suggested insured value by reference # — historical average of past shipments of the same ref (smart default, always editable; no history → fall back to existing default)

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `suggestInsuredByRef` **[post-E16]** **[post-refresh]** | sync | `= (watchId?: string): RefValueSuggestion \| null =>` | mock | staff | none (read) | rc/RcSendWatch.tsx |

## Access control panel (D-391) — OWNER ONLY. Per-user × per-screen toggle; role default comes from the nav tier table (config/navigation.ts), an override is a visible diff from it. Every change logged (who / whom / screen / from → to / when). Evaluated on the user's next route load (TierGate + sidebar), never mid-page.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `accessOverrideSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (userId: string, screenKey: string): boolean \| undefined => accessOverrides()[userId]?.[screenKey];` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `accessOverridesFor` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (userId: string): Record<string, boolean> => (` | mock | staff | none (read) | pages/rs/AccessControlPage.tsx |
| `getAccessUsers` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<User[]>` | mock | owner | none (read) | pages/rs/AccessControlPage.tsx |
| `setAccessOverride` **[post-E16]** **[post-refresh]** **[v2]** | async | `(userId: string, screenKey: string, screenLabel: string, value: AccessValue): Promise<Record<string, boolean>>` | mock | owner | audit, localStorage | pages/rs/AccessControlPage.tsx |
| `getAccessLog` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<AccessChange[]>` | mock | owner | none (read) | pages/rs/AccessControlPage.tsx |

## G6 Access control additions (MH 2026-09-30): enable / disable with reason, Limits drawer (lockedStations · partsCategories · pricing), org tree (reportsTo), containers owned, new user from template

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `PRICING_LIMITS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/setup/AccessLimitsDrawer.tsx |
| `DEFAULT_LIMITS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: UserLimits` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `limitsOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (u: User): UserLimits => u.limits ?? DEFAULT_LIMITS;` | mock | staff | audit | components/setup/AccessLimitsDrawer.tsx, components/setup/NewUserFromTemplate.tsx, pages/rs/AccessControlPage.tsx, pages/rw/RwShell.tsx |
| `isDisabledSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (u: User) => !!u.disabled;` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `managerOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (userId: string): User \| undefined =>` | mock | staff | none (read) | components/setup/NewUserFromTemplate.tsx, pages/rs/AccessControlPage.tsx |
| `managerShortOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (shortName: string): string \| undefined =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `directReports` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (userId: string): User[] => fx.users.filter((u) => u.reportsTo === userId && !u.disabled);` | mock | staff | none (read) | components/setup/AccessLimitsDrawer.tsx, pages/ChooseViewPage.tsx |
| `chainOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (userId: string): User[] =>` | mock | staff | none (read) | components/setup/AccessLimitsDrawer.tsx |
| `subtreeOf` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (rootId: string): User[] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `inSubtree` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (rootId: string, userId: string) => rootId === userId \|\| chainOf(userId).some((m) => m.id === rootId);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getOrgTree` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): OrgNode[] =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `CONTAINERS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: Container[] = [` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `containersOwnedBy` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (shortName: string) => CONTAINERS.filter((c) => c.owner === shortName);` | mock | staff | audit, localStorage | components/setup/AccessLimitsDrawer.tsx |
| `setUserEnabled` **[post-E16]** **[post-refresh]** **[v2]** | async | `(userId: string, enabled: boolean, reason: string): Promise<User>` | mock | owner | audit | components/setup/AccessLimitsDrawer.tsx |
| `setUserLimits` **[post-E16]** **[post-refresh]** **[v2]** | async | `(userId: string, patch:` | mock | owner | audit | components/setup/AccessLimitsDrawer.tsx |
| `createUserFromTemplate` **[post-E16]** **[post-refresh]** **[v2]** | async | `(input: NewUserFromTemplate): Promise<User>` | mock | owner | audit | components/setup/NewUserFromTemplate.tsx |
| `RW_STATION_OPTIONS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/setup/AccessLimitsDrawer.tsx |

## JOB DETAIL v2 (2026-09-30, MH brief) — "where is it and where is it in the process": one process line per component, custody from the custody record (never from status), add-ons since the estimate

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `jobFlowSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job): JobFlow =>` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/jobs/ProcessFlow.tsx |
| `getJobFlow` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string): Promise<JobFlow>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getJobVendorLegs` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string): Promise<SwoWithRefs[]>` | mock | staff | none (read) | components/jobs/OutsourceInfo.tsx |
| `ADDON_CHANNELS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/jobs/AddOnsPanel.tsx |
| `getJobAddons` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string): Promise<JobAddonsView>` | mock | staff | none (read) | components/jobs/AddOnsPanel.tsx |
| `addJobAddon` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string, input: AddonInput): Promise<JobAddon>` | mock | staff | audit, email → Sent | components/jobs/AddOnsPanel.tsx |
| `confirmJobAddon` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string, addonId: string, via: 'portal' \| 'email' \| 'counter'): Promise<JobAddon>` | mock | staff | audit | components/jobs/AddOnsPanel.tsx |

## W·B·P DOT ROWS (MH 2026-09-30): one glance per job — W = head / movement, B = bracelet, P = case / polish. Derived from the same per-component flow as the Job page.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `WBP_LEGS` **[post-E16]** **[post-refresh]** **[v2]** | sync | `:` | mock | staff | none (read) | components/shared/WbpDots.tsx |
| `wbpRowSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job): WbpRow =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `wbpForJobSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (jobId: string): WbpRow \| null =>` | mock | staff | none (read) | components/inbox/InboxJobCard.tsx, components/layout/CallPop.tsx, components/layout/MessageText.tsx, components/shared/WbpDots.tsx |
| `wbpForClientSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (clientId: string, firstJobId?: string): WbpRow[] => store.jobs.filter((j) => j.clientId === clientId && jobInPossessionSync(j)).sort((a, b) => Number(b.id === firstJobId) - Number(a.id === firstJobId) \|\| a.number.loca` | mock | staff | none (read) | components/shared/WbpDots.tsx |
| `getWbpForClient` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, firstJobId?: string): Promise<WbpRow[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## Staff presence for the message directory — DERIVED, never toggled: clocked out → away · on a call or signed in at a Front Desk → with client · else at bench

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `staffPresenceSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (u: User): PresenceView =>` | mock | staff | none (read) | components/layout/MessageDirectory.tsx |

## AUTO-PO THRESHOLD (MH 2026-09-30) — runs on every stock movement / count close / needs-ordering entry / hitlist read. Inventory is the shared pool (RW + RS) → global parts.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `AUTO_PO_THRESHOLD` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= 400; export const AUTO_PO_WAIT_DAYS = 14;` | mock | staff | hitlist pin | — (internal / other client.ts functions only) |
| `autoPoTitle` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (p: PurchaseOrder) => `$` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `openAutoDraft` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (vendorId: string) => rs.pos.find((p) => p.vendorId === vendorId && p.status === 'draft' && p.auto);` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `autoPoSweepSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): AutoPoVendorState[] =>` | mock | staff | audit, hitlist pin | — (internal / other client.ts functions only) |
| `getAutoPoState` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<AutoPoVendorState[]>` | mock | staff | none (read) | — (internal / other client.ts functions only) |

## MH DAILY · APPROVALS TO SEND — every parts approval priced and ready but not yet sent to the client. MH's item stands (refreshes live, clears at zero); VC gets a normal item.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `approvalsToSendSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): ApprovalToSend[] => store.partsRequests.filter((r) => r.status === 'pending_review').map((r) => (` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getApprovalsToSend` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<ApprovalToSend[]>` | mock | staff | none (read) | pages/rs/ApprovalsToSendPage.tsx |
| `approvalsToSendSweepSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= () =>` | mock | staff | hitlist pin | — (internal / other client.ts functions only) |

## Inventory reports bridge (api/inventoryReports.ts): consumption adjustment + spending optimization read stock / history / POs here and write approved rules back

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `registerDaySweep` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (fn: () => void) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `runDaySweeps` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= () => daySweeps.forEach((f) =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `invBridge` **[post-E16]** **[post-refresh]** **[v2]** | sync | `` | mock | staff | audit, hitlist pin | — (internal / other client.ts functions only) |

## JV BIN — a container in the custody model (2026-09-30, MH ruling). The bin HOLDS custody: tickets inside show custody JV and their location follows the bin.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `BIN_TEAM` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= ['Dre', 'Sam', 'Nico', 'MAM'];` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `isBinCode` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (s: string) => s.trim().toUpperCase() === BIN_CODE \|\| s.trim().toUpperCase() === BIN_KEY.toUpperCase();` | mock | staff | none (read) | components/rw/FloorPanels.tsx, components/rw/pad/PadBin.tsx |
| `isBinSafeCode` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (s: string) => s.trim().toUpperCase() === BIN_SAFE_CODE;` | mock | staff | audit | components/rw/pad/PadBin.tsx |
| `getBin` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<BinView>` | mock | owner | none (read) | components/rw/FloorPanels.tsx, components/rw/pad/PadBin.tsx, pages/rw/RwPadPage.tsx |
| `binCountLine` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (v: BinView) => `$` | mock | staff | none (read) | components/rw/FloorPanels.tsx, components/rw/pad/PadBin.tsx |
| `assignToBin` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobIds: string[]): Promise<` | mock | staff | audit | — (internal / other client.ts functions only) |
| `binToSafe` **[post-E16]** **[post-refresh]** **[v2]** | async | `(opts:` | mock | staff | audit, hitlist pin | components/rw/pad/PadBin.tsx |
| `binOutOfSafe` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<` | mock | staff | none (read) | components/rw/pad/PadBin.tsx |
| `binEnter` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string): Promise<BinRow>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `binHandTo` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string, tech: string): Promise<BinRow>` | mock | staff | none (read) | components/rw/pad/PadBin.tsx |
| `binTakeBack` **[post-E16]** **[post-refresh]** **[v2]** | async | `(jobId: string): Promise<BinRow>` | mock | staff | none (read) | components/rw/pad/PadBin.tsx |
| `resolveBinLabel` **[post-E16]** **[post-refresh]** **[v2]** | async | `(label: string): Promise<BulkRow>` | mock | staff | none (read) | components/rw/FloorPanels.tsx |
| `binCommit` **[post-E16]** **[post-refresh]** **[v2]** | async | `(rows: BulkRow[], target: BinTarget, binScanned: boolean): Promise<` | mock | staff | none (read) | components/rw/FloorPanels.tsx |

## CLIENT PORTAL — W·B·P dots + reply loop (MH 2026-09-30). Same WbpDots positions, client mapping only: empty = not part of this service · green = moving · red = not moving (ANY internal blocker — no vendor names, no hold reasons) · blue = done.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `portalDotsSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job): PortalDotRow =>` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |
| `portalFlowSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job): PortalFlowLine[] => jobFlowSync(j).lines.map((l) =>` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |
| `portalGetDots` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, jobId: string): Promise<PortalDotRow>` | mock | client-portal | none (read) | — (internal / other client.ts functions only) |
| `portalGetPartsRequest` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, id: string): Promise<PortalPartsView>` | mock | client-portal | none (read) | pages/rc/RcPartsPage.tsx |
| `portalDecideParts` **[post-E16]** **[post-refresh]** **[v2]** | async | `(clientId: string, id: string, decision: 'approve' \| 'decline'): Promise<PortalPartsView>` | mock | client-portal | audit | pages/rc/RcPartsPage.tsx |
| `askContext` **[post-E16]** **[post-refresh]** **[v2]** | async | `(conversationId: string, messageId: string): Promise<JobSummaryContext>` | mock | staff | none (read) | components/comms/AskDraftCard.tsx |
| `updateAskDraft` **[post-E16]** **[post-refresh]** **[v2]** | async | `(conversationId: string, messageId: string, patch:` | mock | staff | none (read) | components/comms/AskDraftCard.tsx |
| `sendAskReply` **[post-E16]** **[post-refresh]** **[v2]** | async | `(conversationId: string, messageId: string, text: string): Promise<ConvMessage>` | mock | staff | audit | components/comms/AskDraftCard.tsx |

## LONG-TERM STORAGE (MH 2026-10-02). Unpaid finished jobs past the Setup threshold surface on MH's Hitlist card; the ONLY way in or out is a scan (destination-first → LTS safe, custody root VC). No status click.

| export | kind | signature | source | auth expected | side effects | callers |
|---|---|---|---|---|---|---|
| `LTS_KEY` **[post-E16]** **[post-refresh]** **[v2]** | sync | `: RwStationKey = 'lts_safe';` | mock | staff | none (read) | components/rw/FloorPanels.tsx |
| `ltsBoardSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (): LtsBoard =>` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `getLtsBoard` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<LtsBoard>` | mock | staff | none (read) | components/today/LtsCard.tsx |
| `getStoredJobs` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<JobWithRefs[]>` | mock | staff | none (read) | pages/JobsPage.tsx |
| `getLtsSettings` **[post-E16]** **[post-refresh]** **[v2]** | async | `(): Promise<LtsSettings>` | mock | staff | none (read) | components/setup/LongTermStorageCard.tsx |
| `setLtsThresholdDays` **[post-E16]** **[post-refresh]** **[v2]** | async | `(days: number): Promise<LtsSettings>` | mock | staff | audit | components/setup/LongTermStorageCard.tsx |
| `storageChipSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job):` | mock | staff | audit, email → Sent, job status | components/jobs/StorageChip.tsx, components/jobs/StorageList.tsx |
| `leaveStorageSync` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (j: Job, via: 'scan' \| 'pickup', detail: string) =>` | mock | staff | audit, job status | — (internal / other client.ts functions only) |
| `isLtsCode` **[post-E16]** **[post-refresh]** **[v2]** | sync | `= (s: string) => /^(LTS\|SAFE-LTS\|LTS-SAFE)$/i.test(s.trim());` | mock | staff | none (read) | — (internal / other client.ts functions only) |
| `resolveLtsLabel` **[post-E16]** **[post-refresh]** **[v2]** | async | `(label: string): Promise<BulkRow[]>` | mock | staff | none (read) | components/rw/FloorPanels.tsx |
| `ltsCommit` **[post-E16]** **[post-refresh]** **[v2]** | async | `(rows: BulkRow[]): Promise<LtsCommitResult<BulkResult>>` | mock | staff | none (read) | components/rw/FloorPanels.tsx |

_Total exports: 951 · baseline at E16: 296 · **[post-E16] new: 655** · baseline at 2026-09-29 refresh: 461 · **[post-refresh] new: 500** · baseline before v2: 723 · **[v2] new: 255**._

v2 exports (2026-09-30 → 2026-10-02): `continueAsSelf`, `signInWithTouchId`, `inMyDivision`, `saleDateOf`, `totalsFor as computeEstimateTotals`, `holdBlocks`, `PHOTO_TYPES`, `addJobPhotoSync`, `addJobPhoto`, `PICKUP_FRAMES`, `PICKUP_FRAME_WINDOW_MS`, `PICKUP_EVIDENCE_TIMEOUT_MS`, `REVERSE_QR_TTL_MS`, `PICKUP_RETENTION`, `MOCK_OCR_MAY_PASS`, `PICKUP_VERIFY_LABEL`, `onPickupEvent`, `getApprovingManagers`, `getPickupContext`, `pickupStart`, `pickupConfirmItem`, `pickupAbort`, `pickupApproveBypass`, `pickupResendCode`, `pickupVerifyCode`, `pickupVerifyProxy`, `pickupIssueReverseQr`, `portalGetPickupConfirm`, `portalConfirmPickup`, `portalDeclinePickup`, `pickupCheckSerial`, `pickupOverrideSerial`, `pickupDevQrPayload`, `pickupSummaryLine`, `pickupAppendFrame`, `pickupEvidenceSweep`, `jobReleaseLineSync`, `getPickupSession`, `getOpenEvidenceCaptures`, `RC_OTP_TTL_MS`, `clientIdByEmailSync`, `rcRequestCode`, `rcVerifyCode`, `rcVerifyMagicLink`, `rcSignInWithTouchId`, `rcMarkTouchIdEnrolled`, `rcStepUpWithTouchId`, `rcStepUpStatus`, `rcDevPeekCode`, `LINK_EXPIRY`, `LINK_EXPIRED_COPY`, `clientLinkPath`, `getClientLinks`, `sendClientLink`, `revokeClientLink`, `resolveClientLink`, `portalGetEstimateByLink`, `portalGetPartsByLink`, `rcRequestStepUp`, `STEP_UP_ACTION`, `CONV_TAGS`, `tagOfUser`, `getInboxThreads`, `getInboxThreadCounts`, `getInboxSent`, `tagConversation`, `pinConversation`, `moveConversation`, `archiveConversation`, `unarchiveConversation`, `tagsForRequestSync`, `logShare`, `inboxUnreadCountSync`, `openRequestsNoEstimateCountSync`, `requestByIdSync`, `requestLegsSync`, `requestInstantRangeSync`, `ensureRequestThread`, `conversationForRequestSync`, `jobPickupSync`, `jobReturnInfoSync`, `jobsReturnedFromSync`, `jobByIdSync`, `jobInPossessionSync`, `clientPanelSync`, `jobForEstimateSync`, `watchByIdSync`, `TEMPLATE_CATEGORIES`, `MAX_TEMPLATE_PINS`, `TEMPLATES_CHANGED_EVENT`, `templateUsageSync`, `getTemplateLibrary`, `pinnedKeysSync`, `getPinnedTemplates`, `pinTemplate`, `reorderPins`, `createTemplate`, `updateTemplate`, `archiveTemplate`, `reorderTemplates`, `saveDraftAsTemplate`, `replyChannelSync`, `logPartsRequestOnThread`, `submitWebRequest`, `builderLineDescription`, `submitBuilderRequest`, `getRateCard`, `saveRateCardRow`, `liveRateSync`, `markRequestNotified`, `stationLockedForMe`, `sendReadyApproval`, `isOwnerPin`, `callsBridge`, `clientByIdSync`, `estimateByIdSync`, `jobNumberSync`, `type BraceletRepairLine`, `type InspComponent`, `type InspComponentEntry`, `type InspectionForm`, `type Condition`, `type Authenticity`, `getInvoiceLink`, `updateInvoice`, `simulatePaymentWebhook`, `qboReadBalance`, `getShipCart`, `baseStage`, `isRedoStage`, `SHIP_LANE`, `NOSHIP_LANE`, `laneStagesFor`, `swoStageLabel`, `nextSwoStage`, `prevSwoStage`, `shipDaysFor`, `defaultExpectedAt`, `sendBackSwo`, `swoIsLate`, `swoPaidTotal`, `swoUnpaidTotal`, `swoDaysAtStage`, `getConciergeBoard`, `jobOnVendorLane`, `conciergeVendors`, `conciergeBridge`, `VENDOR_PRESETS`, `partKey`, `vendorPresets`, `hubOf`, `hubStage`, `hubSet`, `sentSummary`, `hubViewSync`, `findHubByCode`, `isSwoCode`, `swoLineBack`, `swoReceivable`, `hubOpenLineIds`, `getSwoHub`, `getSwoHubs`, `hubForLineSync`, `createSwoHub`, `addSwoLine`, `removeSwoLine`, `printSwoLabel`, `addSwoNote`, `createHubShipment`, `simulateShipmentDelivered`, `receiveSwoLine`, `markPartReturned`, `updateSwoHub`, `moveSwoLines`, `moveLineToHub`, `openHubsForVendor`, `jobAwaySync`, `accessOverrideSync`, `accessOverridesFor`, `getAccessUsers`, `setAccessOverride`, `getAccessLog`, `PRICING_LIMITS`, `DEFAULT_LIMITS`, `limitsOf`, `isDisabledSync`, `managerOf`, `managerShortOf`, `directReports`, `chainOf`, `subtreeOf`, `inSubtree`, `getOrgTree`, `CONTAINERS`, `containersOwnedBy`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate`, `RW_STATION_OPTIONS`, `jobFlowSync`, `getJobFlow`, `getJobVendorLegs`, `ADDON_CHANNELS`, `getJobAddons`, `addJobAddon`, `confirmJobAddon`, `WBP_LEGS`, `wbpRowSync`, `wbpForJobSync`, `wbpForClientSync`, `getWbpForClient`, `staffPresenceSync`, `AUTO_PO_THRESHOLD`, `autoPoTitle`, `openAutoDraft`, `autoPoSweepSync`, `getAutoPoState`, `approvalsToSendSync`, `getApprovalsToSend`, `approvalsToSendSweepSync`, `registerDaySweep`, `runDaySweeps`, `invBridge`, `BIN_TEAM`, `isBinCode`, `isBinSafeCode`, `getBin`, `binCountLine`, `assignToBin`, `binToSafe`, `binOutOfSafe`, `binEnter`, `binHandTo`, `binTakeBack`, `resolveBinLabel`, `binCommit`, `portalDotsSync`, `portalFlowSync`, `portalGetDots`, `portalGetPartsRequest`, `portalDecideParts`, `askContext`, `updateAskDraft`, `sendAskReply`, `LTS_KEY`, `ltsBoardSync`, `getLtsBoard`, `getStoredJobs`, `getLtsSettings`, `setLtsThresholdDays`, `storageChipSync`, `leaveStorageSync`, `isLtsCode`, `resolveLtsLabel`, `ltsCommit`

Post-refresh exports: `clientRefSubject`, `setClientRef`, `setJobClientRef`, `jobClientRef`, `isReceptionMode`, `receptionSource`, `OWNER_USER_ID`, `isOwnerSync`, `getViewAs`, `continueAsSelf`, `startViewAs`, `stopViewAs`, `signInWithTouchId`, `inMyDivision`, `saleDateOf`, `getIntakePhotoQueue`, `getAwaitingApprovalQueue`, `SHELF_BINS`, `getShelf`, `shelvePackage`, `openScan`, `shelfPackagesSync`, `getPackageCustody`, `setItemScan`, `labelModel`, `parseRefSerial`, `setItemReceived`, `isInspectionPhoto`, `addPackageInspectionPhoto`, `getIntakeHistory`, `getLabelsForPackage`, `updateIntakeRecord`, `totalsFor as computeEstimateTotals`, `holdBlocks`, `PHOTO_TYPES`, `addJobPhotoSync`, `addJobPhoto`, `lineOpenFor`, `closeOutEstimateLine`, `soScanGate`, `confirmSoClientByScan`, `overrideSoScanGate`, `PICKUP_FRAMES`, `PICKUP_FRAME_WINDOW_MS`, `PICKUP_EVIDENCE_TIMEOUT_MS`, `REVERSE_QR_TTL_MS`, `PICKUP_RETENTION`, `MOCK_OCR_MAY_PASS`, `PICKUP_VERIFY_LABEL`, `onPickupEvent`, `getApprovingManagers`, `getPickupContext`, `pickupStart`, `pickupConfirmItem`, `pickupAbort`, `pickupApproveBypass`, `pickupResendCode`, `pickupVerifyCode`, `pickupVerifyProxy`, `pickupIssueReverseQr`, `portalGetPickupConfirm`, `portalConfirmPickup`, `portalDeclinePickup`, `pickupCheckSerial`, `pickupOverrideSerial`, `pickupDevQrPayload`, `pickupSummaryLine`, `pickupAppendFrame`, `pickupEvidenceSweep`, `jobReleaseLineSync`, `getPickupSession`, `getOpenEvidenceCaptures`, `RC_OTP_TTL_MS`, `clientIdByEmailSync`, `rcLookup`, `rcRequestCode`, `rcVerifyCode`, `rcVerifyMagicLink`, `rcSignInWithTouchId`, `rcMarkTouchIdEnrolled`, `rcStepUpWithTouchId`, `rcStepUpStatus`, `rcDevPeekCode`, `rcGetAccount`, `rcListAccounts`, `rcResetAccount`, `LINK_EXPIRY`, `LINK_EXPIRED_COPY`, `clientLinkPath`, `getClientLinks`, `sendClientLink`, `revokeClientLink`, `resolveClientLink`, `portalGetEstimateByLink`, `portalGetPartsByLink`, `rcRequestStepUp`, `STEP_UP_ACTION`, `RC_DOC_META`, `rcDocAccess`, `getRcDocAccess`, `setRcDocAccess`, `rcDocTypeForPath`, `isPhotoUnlocked`, `setPhotoUnlocked`, `getVendorSummaries`, `getVendorDetail`, `isBandOnlyJob`, `bandLabelPayload`, `queueJobLabels`, `resolveScan`, `sameNameClients`, `duplicateNamesIn`, `setTemplateActive`, `clearMessage`, `CONV_TAGS`, `tagOfUser`, `getInboxThreads`, `getInboxThreadCounts`, `getInboxSent`, `tagConversation`, `pinConversation`, `moveConversation`, `archiveConversation`, `unarchiveConversation`, `tagsForRequestSync`, `logShare`, `inboxUnreadCountSync`, `openRequestsNoEstimateCountSync`, `requestByIdSync`, `requestLegsSync`, `requestInstantRangeSync`, `ensureRequestThread`, `conversationForRequestSync`, `jobPickupSync`, `jobReturnInfoSync`, `jobsReturnedFromSync`, `jobByIdSync`, `jobInPossessionSync`, `clientPanelSync`, `jobForEstimateSync`, `watchByIdSync`, `TEMPLATE_CATEGORIES`, `MAX_TEMPLATE_PINS`, `TEMPLATES_CHANGED_EVENT`, `templateUsageSync`, `getTemplateLibrary`, `pinnedKeysSync`, `getPinnedTemplates`, `pinTemplate`, `reorderPins`, `createTemplate`, `updateTemplate`, `archiveTemplate`, `reorderTemplates`, `saveDraftAsTemplate`, `replyChannelSync`, `logPartsRequestOnThread`, `RG_DEFAULT_SETTINGS`, `rgEffectivePunches`, `rgAllPunches`, `rgGetSettings`, `rgSaveSettings`, `rgIsOffline`, `rgDistanceM`, `rgQueueCount`, `rgSyncQueue`, `rgKioskStation`, `rgSetKioskStation`, `rgKioskPunch`, `getMyWeek`, `rgGetFlags`, `rgCorrectPunch`, `rgAddPunch`, `rgPayrollCsv`, `submitWebRequest`, `builderLineDescription`, `submitBuilderRequest`, `getRateCard`, `saveRateCardRow`, `liveRateSync`, `markRequestNotified`, `isSafeStation`, `isSplitFlow`, `GATE`, `polishGateScan`, `bulkPartFor`, `resolveBulkLabel`, `stationLockedForMe`, `bulkCommit`, `jobSummaryContext`, `getCustodyByPerson`, `getHitlist`, `getGateScans`, `POLISHERS`, `ROOM_TECHS`, `ROOM_LABEL`, `sendReadyApproval`, `sendLabelRequest`, `isOwnerPin`, `auditScopeFor`, `callsBridge`, `clientByIdSync`, `estimateByIdSync`, `jobNumberSync`, `partPricingSync`, `getPartPricing`, `priceColor`, `PART_CATEGORIES`, `canonicalCategory`, `PART_SAFES`, `searchPartsSync`, `searchParts`, `getPartsModule`, `getCalibers`, `saveCaliber`, `savePart`, `getReorderRule`, `setReorderRule`, `queueNeedsOrdering`, `getNeedsOrdering`, `generatePurchaseOrder`, `poRedLines`, `acknowledgeRedLines`, `generatePoLabel`, `uploadPoLabel`, `importPurchaseCsv`, `vendorOpenPos`, `vendorHistory`, `locationBarcode`, `CYCLE_STALE_DAYS`, `getCountQueue`, `resolveLocationScan`, `resolvePartScan`, `postCycleCountV2`, `getVarianceReport`, `soRecordsLink`, `soRecordsLinkFor`, `getRequestPrefill`, `convertLegacy`, `MOCK_BILL_CSV`, `MOCK_BILL_FILENAME`, `getLabelLedger`, `parseBillCsv`, `getBillAudits`, `getBillAudit`, `createBillAudit`, `decideBillLine`, `draftDisputeReport`, `sendDisputeReport`, `markBillRecovered`, `API_BASE_URL`, `API_MODE`, `API_SOURCE`, `setApiMode`, `getApiHealth`, `subscribeApiHealth`, `API_TOAST_EVENT`, `isReal`, `techRevenueGoal`, `getDeptGoal`, `getTeamGoals`, `setTechGoal`, `setDeptGoal`, `getDeptDashboard`, `jobDaysInStage`, `jobPartsAllowance`, `setJobPartsAllowance`, `getJobParts`, `quickAddPart`, `returnJobPart`, `inferComponentCodes`, `estimateComponentCodes`, `setEstimateComponents`, `getVerificationChains`, `getJobVerificationChains`, `getItemVerificationChain`, `syncEstimateComponents`, `setEstimateItemComponents`, `getVerificationChain`, `getJobVerificationChain`, `KIOSK_STEPS`, `kioskRequiredSetting`, `setKioskRequired`, `getKioskStatus`, `startKioskSession`, `recordKioskShot`, `addKioskPhoto`, `getClientReviews`, `submitClientReview`, `getQboSetup`, `qboConnect`, `qboDisconnect`, `setQboToggle`, `qboSyncClient`, `qboSyncAllClients`, `qboResolveConflict`, `matchB2bLabel`, `attachB2bMatch`, `searchRwHistory`, `uniqComponents`, `getJobEmails`, `JOB_CATEGORIES`, `REPORT_STATUSES`, `QUICK_REPORTS`, `getJobReport`, `findInspectionPackage`, `decodeSerial`, `AUTHENTICITY`, `BRACELET_LINES`, `CONDITIONS`, `INSPECTION_COMPONENTS`, `type BraceletRepairLine`, `type InspComponent`, `type InspComponentEntry`, `type InspectionForm`, `type Condition`, `type Authenticity`, `inspectionNoteLibrary`, `inspectionQuickTags`, `dialVariantTags`, `learnInspectionNote`, `learnDialVariant`, `learnQuickTag`, `inspectionTotal`, `listInspectionForms`, `getInspectionForm`, `getInspectionFormByToken`, `newInspectionForm`, `saveInspectionForm`, `addInspectionPhoto`, `applySheetSuggestion`, `shortNameOf`, `actorInfo`, `hitlistBridge`, `appraisalBridge`, `benchBridge`, `auditAppointments`, `lookupApptRef`, `clientBrief`, `previewArrival`, `commitArrivals`, `ZERO_REASON_LABEL`, `zeroBalanceNoSync`, `zeroBalanceLog`, `sendSoReminder`, `getInvoiceLink`, `updateInvoice`, `simulatePaymentWebhook`, `qboReadBalance`, `getShipCart`, `qboSyncInvoice`, `deleteSalesOrder`, `baseStage`, `isRedoStage`, `SWO_STAGES`, `SHIP_LANE`, `NOSHIP_LANE`, `laneStagesFor`, `swoStageLabel`, `nextSwoStage`, `prevSwoStage`, `shipDaysFor`, `defaultExpectedAt`, `isInternationalVendor`, `getShopWorkOrders`, `getShopWorkOrder`, `getOutsourceVendors`, `saveShopWorkOrder`, `createSwoOutboundLabel`, `queueSwoReturnLabel`, `advanceSwo`, `sendBackSwo`, `swoIsLate`, `swoPaidTotal`, `swoUnpaidTotal`, `swoDaysAtStage`, `getConciergeBoard`, `jobOnVendorLane`, `conciergeVendors`, `conciergeBridge`, `setSwoPaid`, `pushSwoToQbo`, `getSwoJobCandidates`, `VENDOR_PRESETS`, `partKey`, `vendorPresets`, `hubOf`, `hubStage`, `hubSet`, `sentSummary`, `hubViewSync`, `findHubByCode`, `isSwoCode`, `swoLineBack`, `swoReceivable`, `hubOpenLineIds`, `getSwoHub`, `getSwoHubs`, `hubForLineSync`, `createSwoHub`, `addSwoLine`, `removeSwoLine`, `printSwoLabel`, `addSwoNote`, `createHubShipment`, `simulateShipmentDelivered`, `receiveSwoLine`, `markPartReturned`, `updateSwoHub`, `moveSwoLines`, `moveLineToHub`, `openHubsForVendor`, `jobAwaySync`, `FEATURE_META`, `featureOn`, `getFeatureFlags`, `setFeatureFlag`, `getClientLabelLog`, `portalStartLabel`, `portalCancelLabel`, `portalCreateLabel`, `suggestInsuredByRef`, `accessOverrideSync`, `accessOverridesFor`, `getAccessUsers`, `setAccessOverride`, `getAccessLog`, `PRICING_LIMITS`, `DEFAULT_LIMITS`, `limitsOf`, `isDisabledSync`, `managerOf`, `managerShortOf`, `directReports`, `chainOf`, `subtreeOf`, `inSubtree`, `getOrgTree`, `CONTAINERS`, `containersOwnedBy`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate`, `RW_STATION_OPTIONS`, `jobFlowSync`, `getJobFlow`, `getJobVendorLegs`, `ADDON_CHANNELS`, `getJobAddons`, `addJobAddon`, `confirmJobAddon`, `WBP_LEGS`, `wbpRowSync`, `wbpForJobSync`, `wbpForClientSync`, `getWbpForClient`, `staffPresenceSync`, `AUTO_PO_THRESHOLD`, `autoPoTitle`, `openAutoDraft`, `autoPoSweepSync`, `getAutoPoState`, `approvalsToSendSync`, `getApprovalsToSend`, `approvalsToSendSweepSync`, `registerDaySweep`, `runDaySweeps`, `invBridge`, `BIN_TEAM`, `isBinCode`, `isBinSafeCode`, `getBin`, `binCountLine`, `assignToBin`, `binToSafe`, `binOutOfSafe`, `binEnter`, `binHandTo`, `binTakeBack`, `resolveBinLabel`, `binCommit`, `portalDotsSync`, `portalFlowSync`, `portalGetDots`, `portalGetPartsRequest`, `portalDecideParts`, `askContext`, `updateAskDraft`, `sendAskReply`, `LTS_KEY`, `ltsBoardSync`, `getLtsBoard`, `getStoredJobs`, `getLtsSettings`, `setLtsThresholdDays`, `storageChipSync`, `leaveStorageSync`, `isLtsCode`, `resolveLtsLabel`, `ltsCommit`

Post-E16 exports (diff list for coverage): `clientRefSubject`, `setClientRef`, `setJobClientRef`, `jobClientRef`, `isReceptionMode`, `receptionSource`, `OWNER_USER_ID`, `isOwnerSync`, `getViewAs`, `continueAsSelf`, `startViewAs`, `stopViewAs`, `signInWithTouchId`, `inMyDivision`, `saleDateOf`, `getIntakePhotoQueue`, `getAwaitingApprovalQueue`, `SHELF_BINS`, `getShelf`, `shelvePackage`, `openScan`, `shelfPackagesSync`, `getPackageCustody`, `setItemScan`, `labelModel`, `parseRefSerial`, `setItemReceived`, `isInspectionPhoto`, `addPackageInspectionPhoto`, `getIntakeHistory`, `getLabelsForPackage`, `updateIntakeRecord`, `totalsFor as computeEstimateTotals`, `holdBlocks`, `isTradeJob`, `isInternalTrade`, `TRADE_SEND_BACK`, `PHOTO_TYPES`, `addJobPhotoSync`, `addJobPhoto`, `lineOpenFor`, `closeOutEstimateLine`, `soScanGate`, `confirmSoClientByScan`, `overrideSoScanGate`, `payLinkPath`, `payLinkUrl`, `sendInvoice`, `getPayPage`, `payViaLink`, `PICKUP_FRAMES`, `PICKUP_FRAME_WINDOW_MS`, `PICKUP_EVIDENCE_TIMEOUT_MS`, `REVERSE_QR_TTL_MS`, `PICKUP_RETENTION`, `MOCK_OCR_MAY_PASS`, `PICKUP_VERIFY_LABEL`, `onPickupEvent`, `getApprovingManagers`, `getPickupContext`, `pickupStart`, `pickupConfirmItem`, `pickupAbort`, `pickupApproveBypass`, `pickupResendCode`, `pickupVerifyCode`, `pickupVerifyProxy`, `pickupIssueReverseQr`, `portalGetPickupConfirm`, `portalConfirmPickup`, `portalDeclinePickup`, `pickupCheckSerial`, `pickupOverrideSerial`, `pickupDevQrPayload`, `pickupSummaryLine`, `pickupAppendFrame`, `pickupEvidenceSweep`, `jobReleaseLineSync`, `getPickupSession`, `getOpenEvidenceCaptures`, `portalDeepLink`, `RC_OTP_TTL_MS`, `clientIdByEmailSync`, `rcLookup`, `rcRequestCode`, `rcVerifyCode`, `rcVerifyMagicLink`, `rcSignInWithTouchId`, `rcMarkTouchIdEnrolled`, `rcStepUpWithTouchId`, `rcStepUpStatus`, `rcDevPeekCode`, `rcGetAccount`, `rcListAccounts`, `rcResetAccount`, `LINK_EXPIRY`, `LINK_EXPIRED_COPY`, `clientLinkPath`, `getClientLinks`, `sendClientLink`, `revokeClientLink`, `resolveClientLink`, `portalGetEstimateByLink`, `portalGetPartsByLink`, `rcRequestStepUp`, `STEP_UP_ACTION`, `RC_DOC_META`, `rcDocAccess`, `getRcDocAccess`, `setRcDocAccess`, `rcDocTypeForPath`, `isPhotoUnlocked`, `setPhotoUnlocked`, `portalRevokeLink`, `startViewAsClient`, `exitViewAsClient`, `portalPhotoSections`, `portalGetPhotoSections`, `portalGetRequestCards`, `SHOP_ADDRESS`, `portalRequestLabel`, `portalDropOff`, `portalRequestRequote`, `getVendorSummaries`, `getVendorDetail`, `isBandOnlyJob`, `bandLabelPayload`, `queueJobLabels`, `resolveScan`, `sameNameClients`, `duplicateNamesIn`, `setTemplateActive`, `clearMessage`, `CONV_TAGS`, `tagOfUser`, `getInboxThreads`, `getInboxThreadCounts`, `getInboxSent`, `tagConversation`, `pinConversation`, `moveConversation`, `archiveConversation`, `unarchiveConversation`, `tagsForRequestSync`, `logShare`, `inboxUnreadCountSync`, `openRequestsNoEstimateCountSync`, `requestByIdSync`, `requestLegsSync`, `requestInstantRangeSync`, `ensureRequestThread`, `conversationForRequestSync`, `jobPickupSync`, `jobReturnInfoSync`, `jobsReturnedFromSync`, `jobByIdSync`, `jobInPossessionSync`, `clientPanelSync`, `jobForEstimateSync`, `watchByIdSync`, `personalTemplateFor`, `getPersonalTemplates`, `getAllPersonalTemplates`, `getTemplateVariants`, `savePersonalTemplate`, `deletePersonalTemplate`, `unrenderTemplate`, `TEMPLATE_CATEGORIES`, `MAX_TEMPLATE_PINS`, `TEMPLATES_CHANGED_EVENT`, `templateUsageSync`, `getTemplateLibrary`, `pinnedKeysSync`, `getPinnedTemplates`, `pinTemplate`, `reorderPins`, `createTemplate`, `updateTemplate`, `archiveTemplate`, `reorderTemplates`, `saveDraftAsTemplate`, `renderTemplateForEstimate`, `mergeValuesForConversation`, `replyChannelSync`, `logPartsRequestOnThread`, `INSPECTION_SURVEY`, `getInspectionDecisions`, `portalAskAboutReport`, `timingPassed`, `testingStationScan`, `RG_DEFAULT_SETTINGS`, `rgEffectivePunches`, `rgAllPunches`, `rgGetSettings`, `rgSaveSettings`, `rgIsOffline`, `rgDistanceM`, `rgQueueCount`, `rgSyncQueue`, `rgKioskStation`, `rgSetKioskStation`, `rgKioskPunch`, `getMyWeek`, `rgGetFlags`, `rgCorrectPunch`, `rgAddPunch`, `rgPayrollCsv`, `submitWebRequest`, `builderLineDescription`, `submitBuilderRequest`, `getRateCard`, `saveRateCardRow`, `liveRateSync`, `markRequestNotified`, `isSafeStation`, `RW_STATIONS`, `getShopFloor`, `movePart`, `SCAN_UNDO_MS`, `undoScanComplete`, `markReunited`, `finishGate`, `finishJob`, `getPartHistory`, `isSplitFlow`, `GATE`, `polishGateScan`, `bulkPartFor`, `resolveBulkLabel`, `stationLockedForMe`, `bulkCommit`, `jobSummaryContext`, `getCustodyByPerson`, `getHitlist`, `getGateScans`, `POLISHERS`, `parseTechCode`, `getScanSession`, `scanTech`, `scanLabelAssign`, `undoOutbox`, `getQueuedOutbox`, `getWorkQueue`, `simulateClientReply`, `clearClientReplied`, `getWmRoom`, `sendPartByScan`, `requestPartSimple`, `getStationMemory`, `stationScan`, `ROOM_TECHS`, `ROOM_LABEL`, `getPadBoard`, `padAdvance`, `padSendBack`, `SEND_BACK_REASONS`, `partSuggestions`, `recordPartPick`, `submitPadPartsRequest`, `getApprovalsQueue`, `approvalAction`, `getPickingQueue`, `pickAction`, `getJobPhotoViews`, `PHOTO_SLOTS`, `capturePadPhoto`, `getRoomPartsHistory`, `getRoomSummary`, `PART_LABELS`, `caliberOf`, `getPadPartsContext`, `padSearchParts`, `padRecordSelection`, `submitPadRequest`, `getPadRequests`, `getReviewQueue`, `reviewItem`, `sendForClientApproval`, `sendReadyApproval`, `simulateClientPartsDecision`, `padAllocate`, `partsOnHand`, `getM3keEvents`, `getRoomTechs`, `padSetTech`, `getPadCondition`, `openClientRequests`, `qcRequestGaps`, `addClientRequest`, `removeClientRequest`, `clientRequestAlert`, `ackClientRequests`, `checkClientRequest`, `uncheckClientRequest`, `getStaffInboxRows`, `getColleagueInbox`, `SHIP_STAGE_LABEL`, `getInboundBoard`, `getShipment`, `getShipmentsForClient`, `getShipmentForEstimate`, `prepareLabel`, `createInboundLabel`, `sendLabelRequest`, `resendLabelEmail`, `followUpLabel`, `voidAndReissue`, `simulateTrackingEvent`, `clientStatusLine`, `isManagerTier`, `staffForMention`, `getJobThreads`, `postJobMessage`, `getMessageInbox`, `unreadMessageCount`, `markJobThreadRead`, `STUCK_WORKING_DAYS`, `getBenchSettings`, `isOwnerPin`, `verifySupervisorPin`, `saveBenchSettings`, `setKioskOffline`, `benchPinIn`, `cacheBenchBoard`, `readCachedBenchBoard`, `getBenchBoard`, `getTradeAccounts`, `tradeScanIn`, `getTradeReviewQueue`, `TRADE_PATH`, `tradePathIndex`, `AUDIT_LOCATIONS`, `valueTierOf`, `auditScopeFor`, `getAuditLocations`, `getAuditStaleDays`, `setAuditStaleDays`, `getAuditLive`, `startAudit`, `cancelAudit`, `auditScan`, `auditResolve`, `finishAudit`, `getAuditSessions`, `getGradeCategories`, `addGradeCategory`, `toggleGradeCategory`, `gradeGateFor`, `getGradeGate`, `recordWorkGrade`, `getWorkGrades`, `techQuality`, `clientRatingSync`, `getClientRating`, `setClientRating`, `callsBridge`, `clientByIdSync`, `estimateByIdSync`, `jobNumberSync`, `partPricingSync`, `getPartPricing`, `priceColor`, `PART_CATEGORIES`, `canonicalCategory`, `PART_SAFES`, `searchPartsSync`, `searchParts`, `getPartsModule`, `getCalibers`, `saveCaliber`, `savePart`, `getReorderRule`, `setReorderRule`, `queueNeedsOrdering`, `getNeedsOrdering`, `generatePurchaseOrder`, `poRedLines`, `acknowledgeRedLines`, `generatePoLabel`, `uploadPoLabel`, `importPurchaseCsv`, `vendorOpenPos`, `vendorHistory`, `locationBarcode`, `CYCLE_STALE_DAYS`, `getCountQueue`, `resolveLocationScan`, `resolvePartScan`, `postCycleCountV2`, `getVarianceReport`, `soRecordsLink`, `soRecordsLinkFor`, `getRequestPrefill`, `convertLegacy`, `MOCK_BILL_CSV`, `MOCK_BILL_FILENAME`, `getLabelLedger`, `parseBillCsv`, `getBillAudits`, `getBillAudit`, `createBillAudit`, `decideBillLine`, `draftDisputeReport`, `sendDisputeReport`, `markBillRecovered`, `API_BASE_URL`, `API_MODE`, `API_SOURCE`, `setApiMode`, `getApiHealth`, `subscribeApiHealth`, `API_TOAST_EVENT`, `isReal`, `techRevenueGoal`, `getDeptGoal`, `getTeamGoals`, `setTechGoal`, `setDeptGoal`, `getDeptDashboard`, `jobDaysInStage`, `jobPartsAllowance`, `setJobPartsAllowance`, `getJobParts`, `quickAddPart`, `returnJobPart`, `inferComponentCodes`, `estimateComponentCodes`, `setEstimateComponents`, `getVerificationChains`, `getJobVerificationChains`, `getItemVerificationChain`, `syncEstimateComponents`, `setEstimateItemComponents`, `getVerificationChain`, `getJobVerificationChain`, `KIOSK_STEPS`, `kioskRequiredSetting`, `setKioskRequired`, `getKioskStatus`, `startKioskSession`, `recordKioskShot`, `addKioskPhoto`, `getClientReviews`, `submitClientReview`, `getQboSetup`, `qboConnect`, `qboDisconnect`, `setQboToggle`, `qboSyncClient`, `qboSyncAllClients`, `qboResolveConflict`, `matchB2bLabel`, `attachB2bMatch`, `searchRwHistory`, `uniqComponents`, `getJobEmails`, `JOB_CATEGORIES`, `REPORT_STATUSES`, `QUICK_REPORTS`, `getJobReport`, `findInspectionPackage`, `decodeSerial`, `AUTHENTICITY`, `BRACELET_LINES`, `CONDITIONS`, `INSPECTION_COMPONENTS`, `type BraceletRepairLine`, `type InspComponent`, `type InspComponentEntry`, `type InspectionForm`, `type Condition`, `type Authenticity`, `inspectionNoteLibrary`, `inspectionQuickTags`, `dialVariantTags`, `learnInspectionNote`, `learnDialVariant`, `learnQuickTag`, `inspectionTotal`, `listInspectionForms`, `getInspectionForm`, `getInspectionFormByToken`, `newInspectionForm`, `saveInspectionForm`, `addInspectionPhoto`, `applySheetSuggestion`, `shortNameOf`, `actorInfo`, `hitlistBridge`, `appraisalBridge`, `benchBridge`, `auditAppointments`, `lookupApptRef`, `clientBrief`, `previewArrival`, `commitArrivals`, `ZERO_REASON_LABEL`, `zeroBalanceNoSync`, `zeroBalanceLog`, `sendSoReminder`, `getInvoiceLink`, `updateInvoice`, `simulatePaymentWebhook`, `qboReadBalance`, `getShipCart`, `qboSyncInvoice`, `deleteSalesOrder`, `baseStage`, `isRedoStage`, `SWO_STAGES`, `SHIP_LANE`, `NOSHIP_LANE`, `laneStagesFor`, `swoStageLabel`, `nextSwoStage`, `prevSwoStage`, `shipDaysFor`, `defaultExpectedAt`, `isInternationalVendor`, `getShopWorkOrders`, `getShopWorkOrder`, `getOutsourceVendors`, `saveShopWorkOrder`, `createSwoOutboundLabel`, `queueSwoReturnLabel`, `advanceSwo`, `sendBackSwo`, `swoIsLate`, `swoPaidTotal`, `swoUnpaidTotal`, `swoDaysAtStage`, `getConciergeBoard`, `jobOnVendorLane`, `conciergeVendors`, `conciergeBridge`, `setSwoPaid`, `pushSwoToQbo`, `getSwoJobCandidates`, `VENDOR_PRESETS`, `partKey`, `vendorPresets`, `hubOf`, `hubStage`, `hubSet`, `sentSummary`, `hubViewSync`, `findHubByCode`, `isSwoCode`, `swoLineBack`, `swoReceivable`, `hubOpenLineIds`, `getSwoHub`, `getSwoHubs`, `hubForLineSync`, `createSwoHub`, `addSwoLine`, `removeSwoLine`, `printSwoLabel`, `addSwoNote`, `createHubShipment`, `simulateShipmentDelivered`, `receiveSwoLine`, `markPartReturned`, `updateSwoHub`, `moveSwoLines`, `moveLineToHub`, `openHubsForVendor`, `jobAwaySync`, `FEATURE_META`, `featureOn`, `getFeatureFlags`, `setFeatureFlag`, `getClientLabelLog`, `portalStartLabel`, `portalCancelLabel`, `portalCreateLabel`, `suggestInsuredByRef`, `accessOverrideSync`, `accessOverridesFor`, `getAccessUsers`, `setAccessOverride`, `getAccessLog`, `PRICING_LIMITS`, `DEFAULT_LIMITS`, `limitsOf`, `isDisabledSync`, `managerOf`, `managerShortOf`, `directReports`, `chainOf`, `subtreeOf`, `inSubtree`, `getOrgTree`, `CONTAINERS`, `containersOwnedBy`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate`, `RW_STATION_OPTIONS`, `jobFlowSync`, `getJobFlow`, `getJobVendorLegs`, `ADDON_CHANNELS`, `getJobAddons`, `addJobAddon`, `confirmJobAddon`, `WBP_LEGS`, `wbpRowSync`, `wbpForJobSync`, `wbpForClientSync`, `getWbpForClient`, `staffPresenceSync`, `AUTO_PO_THRESHOLD`, `autoPoTitle`, `openAutoDraft`, `autoPoSweepSync`, `getAutoPoState`, `approvalsToSendSync`, `getApprovalsToSend`, `approvalsToSendSweepSync`, `registerDaySweep`, `runDaySweeps`, `invBridge`, `BIN_TEAM`, `isBinCode`, `isBinSafeCode`, `getBin`, `binCountLine`, `assignToBin`, `binToSafe`, `binOutOfSafe`, `binEnter`, `binHandTo`, `binTakeBack`, `resolveBinLabel`, `binCommit`, `portalDotsSync`, `portalFlowSync`, `portalGetDots`, `portalGetPartsRequest`, `portalDecideParts`, `askContext`, `updateAskDraft`, `sendAskReply`, `LTS_KEY`, `ltsBoardSync`, `getLtsBoard`, `getStoredJobs`, `getLtsSettings`, `setLtsThresholdDays`, `storageChipSync`, `leaveStorageSync`, `isLtsCode`, `resolveLtsLabel`, `ltsCommit`