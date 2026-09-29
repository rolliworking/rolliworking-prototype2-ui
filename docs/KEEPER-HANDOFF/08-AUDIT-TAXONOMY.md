# 08 — AUDIT TAXONOMY

Generated from `AuditEventType` in `types.ts` and every `appendAudit({ type: … })` site in `client.ts`. The prototype keeps the last 60 events in `localStorage` (`rollisuite.prototype.auditLog`); KEEPER writes every event to an append-only ledger (see `04-DATA-MODEL-VS-KEEPER.md` → telemetry).

## Event shape (`AuditEvent`)

```ts
  id: string;
  type: AuditEventType;
  timestamp: string;
  stationName: string;
  userShortName?: string;
  userDisplayName?: string;
  method?: SignInMethod;
  cameraStatus?: CameraStatus;
  photoDataUrl?: string;
  onBehalfOf?: string;
  detail: string;
```

`method` is set on sign-in events (`password_photo` | `pin_switch`); `cameraStatus`/`photoDataUrl` on password sign-ins; `stationName` is the registered station (or "Phone (RGTime PWA)", "Kiosk", "RolliConnect"). `detail` is a human sentence prefixed with the entity number (e.g. `E02013 · Component complete · Watch head · by MM`).

## Types → emitters

| type | emitted by (function / stamp helper in client.ts) | UI filter chip |
|---|---|---|
| `sign_in` | `benchPinIn`, `signInWithPasswordMock`, `switchUserWithPin` | Sign-ins (with sign_in_failed, sign_out) |
| `sign_in_failed` | `benchPinIn`, `signInWithPasswordMock`, `switchUserWithPin` | All only |
| `sign_out` | `signOut` | All only |
| `station_registered` | `readStation`, `registerStation` | Station (all station_*) |
| `station_renamed` | `renameStation` | All only |
| `station_reset` | `resetDeviceRegistration` | All only |
| `intake` | `commitArrivals`, `shipStamp`, `stamp` | Intake |
| `estimate` | `closeRequest`, `convertLegacy`, `estStamp`, `overrideSoScanGate`, `setKioskRequired`, `writeClientRef` | Estimates |
| `job` | `advanceSwo`, `bulkCommit`, `conciergeBridge`, `createSwoOutboundLabel`, `finishAudit`, `gateScanJob`, `jobStamp`, `logBypass`, `padSendBack`, `padSetTech`, `saveShopWorkOrder`, `scanTech`, `sendBackSwo`, `startAudit`, `undoOutbox` | Jobs (with task, pin, parts) |
| `task` | `taskStamp` | All only |
| `pin` | `dismissPinned`, `hitlistBridge`, `pinToHitList` | All only |
| `sales` | `convertLegacy`, `soStamp` | Sales |
| `parts` | `approvalAction`, `partsStamp` | All only |
| `portal` | `portalStamp`, `replyToClient` | RolliConnect |
| `purchasing` | `rsStamp` | All only |
| `inventory` | `pickAction` | All only |
| `setup` | `addGradeCategory`, `setAuditStaleDays`, `toggleGradeCategory` | All only |
| `evidence` | (stamp helper — see below) | All only |
| `labels` | (stamp helper — see below) | All only |
| `accounting` | `baStamp`, `deleteSalesOrder`, `qboLog`, `zeroBalanceNoSync` | All only |
| `companion` | `cpStamp` | All only |
| `comms` | `clearMessage`, `cxStamp`, `deletePersonalTemplate`, `exitViewAsClient`, `learnDialVariant`, `learnInspectionNote`, `receiveInboundCall`, `saveInspectionForm`, `savePersonalTemplate`, `setClientRating`, `startViewAsClient`, `submitClientReview` | All only |
| `rollitime` | `rtStamp`, `setTechGoal` | All only |
| `rgtime` | `rgAudit` | RGTime |
| `kiosk` | `kioskAudit`, `resolveKioskMatch`, `saveBenchSettings` | Kiosk |
| `appointments` | `auditAppointments` | All only |
| `settings` | `rcResetAccount`, `setAccessOverride`, `setFeatureFlag`, `setRcDocAccess` | All only |
| `shipping` | `portalCreateLabel` | All only |
| `view_as_started` | `startViewAs` | All only |
| `session_continued_as_self` | `continueAsSelf` | All only |
| `view_as_ended` | `startViewAs`, `stopViewAs` | All only |

## Stamp helpers (one type each, called from many functions)

| helper | type | prefix |
|---|---|---|
| `stamp` | intake | `<ref> · detail` |
| `jobStamp` | job | `<job#> · detail` |
| `partsStamp` | parts | `<PR#> · detail` |
| `portalStamp` | portal | client action in /rc |
| `rtStamp` | rollitime | `<job#> timing PASS/REJECT …` |
| `rgAudit` | rgtime / sign_in / sign_in_failed / sign_out | RGTime phone events |
| `kioskAudit` | kiosk | `<RQ#> · name · brand …` |

KEEPER rule: every write endpoint emits exactly one audit row with `{ type, actor, station/device, entity_ref, detail, at }`; reads emit none. Sign-in photo capture is stored as a blob reference, not inline base64.

## Post-E16 event families (numbering continues: 26+)

The prototype did **not** add enum values for these — they ride on existing types with a structured `detail` prefix (`⚠ DRIFT`: KEEPER should give each family its own `type` so they can be filtered/retained separately). Emitters are the client.ts functions named.

| # | family | prototype type | emitted by | detail shape / payload KEEPER needs |
|---|---|---|---|---|
| 26 | part move / scan custody transfer | `job` (via `jobStamp` in `recordMove`) | `movePart`, `stationScan`, `sendPartByScan`, `scanLabelAssign`, `padAdvance`, `padSendBack`, `finishJob` | `{job, component, from_station, to_station, part_status, via: drag\|scan\|bulk_assign\|wm\|pad\|station\|system, custody_tech?, note?}` — also appended to `JobComponent.history[]` |
| 27 | bulk-assign session | `job` | `scanTech`, `scanLabelAssign`, `undoOutbox` | active tech code, label, band-only flag, courtesy email id (undo window) |
| 28 | stage move with reason (supervisor) | `job` + `pushTransition` | `padAdvance`, `padSendBack` | `{job, from_status, to_status, reason: rework\|waiting_on_part\|failed_qc\|other, note}` — backward moves always carry a reason |
| 29 | tech reassignment (supervisor override) | `job` | `padSetTech` | `{job, from_tech, to_tech, override: true}` |
| 30 | client request lifecycle | `job` | `addClientRequest`, `removeClientRequest`, `ackClientRequests`, `checkClientRequest`, `uncheckClientRequest` | add/remove text; **acknowledged** `{request_ids, via: pad_scan\|wm_scan\|station_scan\|…, by, at}` (also stored on `ClientRequest.acks[]`); **QC check-off** `{request_id, result: done\|na, reason?}` |
| 31 | parts request review / gate | `parts` (`partsStamp`) | `submitPadRequest`, `reviewItem`, `sendForClientApproval`, `simulateClientPartsDecision`, `padAllocate`, `approvalAction` | per-line price/part# edits, generic→resolved, sent-for-approval (email id), client decision, allocation |
| 32 | M3KE resolution / selection | `parts` + `M3keEvent` append-only row | `reviewItem` (kind `resolved`), `padRecordSelection` (kind `selected`) | `{description, reference, caliber, part_id, part_number, price?, resolved_by, ts, request_id}` — this IS the training ledger |
| 33 | pick confirmed / short / found-elsewhere | `parts` / `inventory` | `pickAction` | `{pick_task, part, job, qty, location, result: picked\|short\|found, new_location?}` — `found` rewrites `Part.location` (self-correcting location data) |
| 34 | photo captured on pad | `evidence`/`job` | `capturePadPhoto` | `{job, slot, client_visible, by, at, blob_ref}` |
| 35 | inbound shipping label lifecycle | `intake` (shipping stamps on `InboundShipment.stamps[]`) | `createInboundLabel`, `resendLabelEmail`, `followUpLabel`, `voidAndReissue`, `simulateTrackingEvent`, arrival auto-match in intake | label requested / created+emailed / resent / follow-up sent / voided+reissued / carrier event mirrored / arrival scan matched |
| 36 | message posted / reply / routed | `job` (`jobStamp`) | `postJobMessage` | `{job, message_id, parent_id?, by, mentions[], notify[], has_photo}`; **message read** is stored on `JobMessage.readBy[]` only (`⚠ DRIFT`: not audited — KEEPER should log reads per person for accountability) |
| 37 | hit-list pin from mention | `pin` (row created without appendAudit in `routeMessage`) | `postJobMessage` → `routeMessage` | `⚠ DRIFT`: the auto-pin has no audit row (manual `pinToHitList` does) |
| 38 | bench kiosk | `kiosk`, `sign_in`, `sign_in_failed` | `saveBenchSettings`, `benchPinIn` | settings saved `{bench_name, idle_minutes, offline_sim}`; PIN in/out with station = bench name; idle re-lock is **not** audited (`⚠ DRIFT`) |
| 39 | colleague inbox opened | `comms` | `getColleagueInbox` (read — no row in prototype) | `⚠ DRIFT`: reading another person's inbox should be a telemetry read event in KEEPER |

## Post-refresh event families (2026-09-27 → 2026-09-29; numbering continues: 40+)

`view_as_started` / `view_as_ended` ARE new enum values; the rest still ride on existing types (`⚠ DRIFT` → own `type` in KEEPER). New field on every row: `onBehalfOf?: string` (set while the owner is in View-as; `userShortName` is then the REAL actor).

| # | family | prototype type | emitted by | payload KEEPER needs |
|---|---|---|---|---|
| 40 | sign-in (method + photo) | `sign_in` / `sign_in_failed` / `sign_out` | `signInWithPassword`, `switchUserWithPin`, `benchPinIn`, `signOut`, `rgAudit` | `{user, station, device_id, method: password_photo\|pin_switch\|bench_pin\|rg_pin, camera_status, photo_blob_ref}` |
| 41 | session invalidated | — (not built) | — | `{user, old_session, new_session, reason: signed_in_elsewhere\|idle\|admin}` — single-session rule (Q95) |
| 42 | **View-as started / ended** | `view_as_started`, `view_as_ended` | `startViewAs`, `stopViewAs`, `signOut` (implicit end) | `{actor: MH, on_behalf_of, station, at, reason?: switch\|exit\|sign_out}`; every row written in between carries `onBehalfOf` (D-361) |
| 43 | reception-mode toggled | — (station flag seeded; `?reception=` override not audited) | — | `{station, on\|off, by, at}` when a manager flips the station flag (Q93) |
| 44 | label created / voided / tracking event | `intake` stamps on `InboundShipment.stamps[]`, `sales` for outbound | `createInboundLabel`, `voidAndReissue`, `simulateTrackingEvent`, `confirmShipment`, SWO label fns | `{shipment, carrier, tracking, label_url, cost, insured_value, event_status, source: webhook\|manual}` |
| 45 | invoice finalized / synced / conflict / bypass | `sales` (`soStamp`), `accounting` | `sendInvoice`, `recordPayment`, `qboSyncInvoice`, `qboResolveConflict`, `zeroBalanceNoSync`, `confirmShipment` (bypass), `overrideScanGate` | `{so, qbo_invoice_id, sync_token, direction, conflict_resolution, bypass_reason, minutes_since_payment}` |
| 46 | page started / ended (intercom) | — (in memory only) | `intercom.ring/hangUp/pageAll` | `{from_station, to_station, started_at, ended_at, text?}` |
| 47 | photo set completed (WM kiosk) | `evidence` / `job` (`jobStamp`) | WM kiosk submit fns (`WmKioskPage`) | `{job, set_kind: wm_kiosk, slots[], by, station, mentions[]}` |
| 48 | hitlist claim / reassign | `pin` / `task` | `hl.reassign`, `pinToHitList`, `setTaskDone` | `{item, from_assignee, to_assignee, by, at}` |
| 49 | scan-gate override | `estimate` | `overrideScanGate` | `{so, by, reason, at}` |
| 50 | client reference set | `estimate` | `setClientRef` | `{estimate\|job, before, after, by}` |