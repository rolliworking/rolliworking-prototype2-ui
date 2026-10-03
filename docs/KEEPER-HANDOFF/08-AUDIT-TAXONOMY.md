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
| `sign_in` | `benchPinIn`, `signInWithPasswordMock`, `signInWithTouchId`, `switchUserWithPin` | Sign-ins (with sign_in_failed, sign_out) |
| `sign_in_failed` | `assertEnabled`, `benchPinIn`, `signInWithPasswordMock`, `switchUserWithPin` | All only |
| `sign_out` | `signOut` | All only |
| `station_registered` | `readStation`, `registerStation` | Station (all station_*) |
| `station_renamed` | `renameStation` | All only |
| `station_reset` | `resetDeviceRegistration` | All only |
| `intake` | `commitArrivals`, `shipStamp`, `stamp` | Intake |
| `estimate` | `closeRequest`, `convertLegacy`, `estStamp`, `overrideSoScanGate`, `setKioskRequired`, `writeClientRef` | Estimates |
| `job` | `addJobAddon`, `addSwoLine`, `advanceSwo`, `binEvent`, `bulkCommit`, `conciergeBridge`, `confirmJobAddon`, `createHubShipment`, `createSwoHub`, `createSwoOutboundLabel`, `custodyBridge`, `enterStorageSync`, `finishAudit`, `gateScanJob`, `jobStamp`, `leaveStorageSync`, `logBypass`, `padSendBack`, `padSetTech`, `printSwoLabel`, `receiveSwoLine`, `saveShopWorkOrder`, `scanTech`, `sendBackSwo`, `startAudit`, `undoOutbox`, `updateSwoHub` | Jobs (with task, pin, parts) |
| `task` | `taskStamp` | All only |
| `pin` | `dismissPinned`, `hitlistBridge`, `pinToHitList` | All only |
| `sales` | `addAuthorizedPickup`, `convertLegacy`, `pickupEvidenceSweep`, `pickupIdPhotoPurgeSweep`, `pickupVerifyCode`, `removeAuthorizedPickup`, `soStamp` | Sales |
| `parts` | `approvalAction`, `partsStamp` | All only |
| `portal` | `portalStamp`, `replyToClient` | RolliConnect |
| `purchasing` | `rsStamp` | All only |
| `inventory` | `invBridge`, `pickAction` | All only |
| `setup` | `addGradeCategory`, `orgBridge`, `saveRateCardRow`, `setAuditStaleDays`, `toggleGradeCategory` | All only |
| `evidence` | (stamp helper — see below) | All only |
| `labels` | (stamp helper — see below) | All only |
| `accounting` | `baStamp`, `deleteSalesOrder`, `qboLog`, `zeroBalanceNoSync` | All only |
| `companion` | `cpStamp` | All only |
| `comms` | `callsBridge`, `clearMessage`, `cxStamp`, `deletePersonalTemplate`, `exitViewAsClient`, `learnDialVariant`, `learnInspectionNote`, `portalAskArrived`, `saveInspectionForm`, `savePersonalTemplate`, `setClientRating`, `startViewAsClient`, `submitClientReview` | All only |
| `rollitime` | `rtStamp`, `setTechGoal` | All only |
| `rgtime` | `rgAudit` | RGTime (type kept — the Time Clock replaced the RGTime PWA 2026-10-03, D-498) |
| `kiosk` | `kioskAudit`, `markRequestNotified`, `resolveKioskMatch`, `saveBenchSettings`, `submitBuilderRequest`, `submitWebRequest` | Kiosk |
| `appointments` | `auditAppointments` | All only |
| `settings` | `accessLog`, `bonusBridge`, `rcResetAccount`, `safesBridge`, `setAccessOverride`, `setFeatureFlag`, `setLtsThresholdDays`, `setRcDocAccess`, `wm8Bridge` | All only |
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

## v2 event families (2026-09-30 → 2026-10-02; numbering continues: 51+)

None of these added an enum value — they ride on `sales` / `job` / `comms` / `kiosk` / `settings` or on store-local timelines (`soStamp`, `jobStamp`, thread lines, `BinEvent`, `swo_event`). `⚠ DRIFT` → each family gets its own `type` in KEEPER. Emitters are the owning functions.

| # | family | prototype type | emitted by | payload KEEPER needs |
|---|---|---|---|---|
| 51 | inbox tag / pin / lane / archive / share | — (thread internal line via `pushConv` / `logShare`; no `appendAudit`) | `tagConversation`, `pinConversation`, `moveConversation`, `archiveConversation`, `unarchiveConversation`, `logShare` | `{conversation, action, tag?, lane?, by, at}`; share → `{message_id, recipients[], note?}` (D-443…D-446, D-460) |
| 52 | inbox quick action on a job | `job` (`jobStamp`) + thread internal line | `addJobNote(origin)`, `logPartsRequestOnThread`, `draftJobSummary` (no row — draft only) | note `{job, origin: "from inbox · <subject>"}`; parts `{job, pr, thread}`; summary drafts are NOT audited (never sent) (D-463…D-465) |
| 53 | reply channel chosen | `comms` (`pushConv`) | `replyInThread` | `{conversation, channel: portal\|email, message_id, token?}` (D-466) |
| 54 | SWO hub / line lifecycle (vendor lanes) | `job` (`jobStamp` + `appendAudit`) + `Swo.timeline[]` / `SwoHub.timeline[]` | `saveShopWorkOrder`, `advanceSwo`, `sendBackSwo`, `createSwoHub`, `addSwoLine`, `removeSwoLine`, `moveSwoLines`, `moveLineToHub`, `createHubShipment`, `receiveSwoLine`, `markPartReturned`, `createSwoOutboundLabel`, `queueSwoReturnLabel`, `setSwoPaid`, `pushSwoToQbo`, `concierge.addVendorInvoice/markInvoicePaid/startRedo` | `{hub, line?, job, vendor, from_stage, to_stage, reason?, label?, invoice?, redo_cycle?, by, device, at}`; custody to `vendor:<id>` is a `part_move` |
| 55 | container (JV bin) events | `job` (`jobStamp`) + `BinEvent` ledger | `assignToBin`, `binEnter`, `binHandTo`, `binTakeBack`, `binToSafe`, `binOutOfSafe`, `binCommit` | `{container, ticket, kind: assign\|enter\|hand_to\|take_back\|to_safe\|out_of_safe\|missing, tech?, count_expected?, count_present?, by, at}` (D-420…D-424) |
| 56 | request submitted (web / portal / staff builder) | `kiosk` (same as the kiosk walk-in) | `submitWebRequest`, `submitBuilderRequest`, `markRequestNotified` | `{request, source: web\|portal\|staff, mode, outcome quoted\|queued\|draft, lines[], auto_quote, estimate?, notified_to?}` → own type `request_submitted` (D-457, D-471) |
| 57 | add-on since estimate (manual / phone → confirmed) | `job` (`jobStamp`) | `addJobAddon`, `confirmJobAddon`, `calls.setDisposition(approval_given)` | `{job, addon, source manual\|phone, channel, amount?, status pending\|confirmed, by, at}` (D-405, D-434) |
| 58 | inspection opinion label / second opinion / specimen | — (store-local in `inspectionLabels.ts`; `m3keEvents` row kind `inspection_opinion`) | `saveOpinion`, `setShareable`, `requestSecondOpinion`, `submitSecondOpinion`, `recordShot`, `promoteCandidate`, `rejectCandidate`, `confirmTag`, `mergeTag`, `waiveSpecimen`, `setOfferToAcquire` | `{job, component, opinion, confidence, variant?, tags[], revision, shareable, by, station, controlled?}`; second opinion `{request, to, blind: true}`; specimen `{job, decision}` (D-415) |
| 59 | owner Views (another person's inbox opened) | — (read, no row) | `InboxPage ?section=views&as=` | `⚠ DRIFT`: telemetry read event `{viewer: MH, inbox_of, at}` (D-459) — same gap as family 39 |
| 60 | pickup gate steps + exceptions | `sales` (`soStamp` on every step; `jobStamp` on stops) + `BypassEvent payment_release` | `pickupStart`, `pickupConfirmItem`, `pickupAbort`, `pickupApproveBypass`, `pickupResendCode`, `pickupVerifyCode` (incl. FAILED), `pickupVerifyProxy`, `pickupIssueReverseQr`, `portalConfirmPickup`, `portalDeclinePickup`, `pickupCheckSerial`, `pickupOverrideSerial`, `confirmPickup`, `pickupAppendFrame`, `pickupEvidenceSweep`, `adminMarkComplete` | `{so, step 1–5, fact, approver?, reason?, code_generation?, verify_method?, serial_result?, failed_pair?, source claude\|mock, frames_n, evidence_status}`; failed verifies MUST be counted (lockout — Q104) (`specs/SPEC-PICKUP-STATION.md`) |
| 61 | call lifecycle + disposition | `comms` (`b.audit`) + thread event | `calls.callAnswered`, `callMissed`, `startOutboundCall`, `setDisposition`, `logCall`, `addCallNote`, `linkCallToJob`, `resolveMissedCall` | `{call_id, direction, number, client?, answered_by?, station, outcome, duration, disposition?, recording_ref?, job?}` (D-430…D-436) |
| 62 | portal passwordless / LINK tier / step-up | `settings` (`appendAudit`) + `portalStamp` | `rcRequestCode`, `rcVerifyCode`, `rcVerifyMagicLink`, `rcSignInWithTouchId`, `rcRequestStepUp`, `requireStepUp`, `sendClientLink`, `revokeClientLink`, `resolveClientLink` (open counted), `setRcDocAccess`, `setPhotoUnlocked` | `{client, challenge_id, method code\|magic_link\|touch_id, attempts, result}`; link `{type, object, token_hash, sent_to, opened_at, revoked_by?}`; step-up `{action, grant_id, consumed_at}` (CLIENT PORTAL — THREE TIERS) |
| 63 | access control (owner) | `settings` (`appendAudit`) + `AccessChange` log | `setAccessOverride`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate` | `{by: MH, whom, screen?, from, to, reason?, limits?, template_from?}` (D-391, D-398…D-401) |
| 64 | system pins (auto-PO · approvals to send · pickup evidence / item / declined) | `pin` (row via `upsertSystemPin`, no `appendAudit`) | `autoPoSweepSync`, `approvalsToSendSweepSync`, `pickupEvidenceSweep`, `pickupAbort`, `portalDeclinePickup` | `{key, priority, standing, assigned_to, link, dismiss_reason?}` — upsert by key; dismiss of a standing pin needs a reason (D-417, D-418) |
| 65 | rate card edit | `setup` | `saveRateCardRow` | `{row, key, version_before, version_after, by}` (D-472) |

## 2026-10-03 event families (Setup → Organisation · Time Clock · Intercom · Pickup v2 · Custody audit · Data classes; numbering continues: 66+)

Still no new enum values — these ride on `settings` / `sales` / `job` / `sign_in*` / `rgtime` or on store-local ledgers (`custody.ts events`, `watchm8Export.ts log`, `soStamp`). `⚠ DRIFT` → own `type` per family in KEEPER. The KEEPER ruling each family implements is named (MH numbering by subject, 2026-10-03).

| # | family | prototype type | emitted by | payload KEEPER needs |
|---|---|---|---|---|
| 66 | organisation edits (entity · department · station) | `settings` (`appendAudit`) | `org.saveEntity`, `saveDepartment`, `toggleDepartment`, `saveStation`, `saveIntercomPreset` / `deleteIntercomPreset` (presets: no row ⚠) | `{kind entity\|department\|station\|preset, id, before, after, by, at}`; dot-leg changes are refused, not logged (KEEPER D-427 · D-429) |
| 67 | staff invite lifecycle | `settings` + Sent row (MOCK delivery) + `sign_in_failed` | `org.createStaff`, `resendInvite`, `activateStaffInvite`, `setStaffDisabled`, `assertEnabled` | `{user, code_generation, channel, issued_by, expires_at, attempts, locked_at?, activated_at?}`; disable `{user, by: MH, reason}`; refused sign-ins while invited / disabled (KEEPER D-426) |
| 68 | time clock punch · correction · flag · settings | `rgtime` (`rgAudit`) + `sign_in` on the pad lock | `rgPadPunch`, `rgKioskPunch`, `rgSyncQueue` (synced_late), `rgCorrectPunch`, `rgAddPunch`, `rgResolveFlag`, `rgSaveSettings` | `{user, kind in\|out, at, recorded_at, station\|tag, source nfc\|pad\|kiosk\|manager\|rgtime, method tap\|pin\|touch_id\|manager, flags[], geo?, correction_of?, reason?}` — corrections are new rows (KEEPER D-426) |
| 69 | intercom group call · page | — (in memory `history` / `pageLog`) | `intercom.ring` (several targets / preset), `hangUp`, `pageAll` | `{call, from_station, targets[], joined[], skipped[], started_at, ended_at}`; page `{by, zone, text, at}` (no KEEPER ruling; Daily.co seam) |
| 70 | pickup v2 facts (any-reference open · QBO read · lockout · second factor · authorized person · Reolink · ID purge) | `sales` (`soStamp`, `appendAudit` on LOCKED / PURGED) + `settings` for authorized-list edits | `pickupResolveReference` (via stamp on open), `pickupCheckInvoice`, `pickupVerifyCode` (attempt n/3, LOCKED), `pickupKioskPushOtp` / `pickupKioskConfirmOtp` / `pickupKioskIdPhoto`, `pickupVerifyProxy` (authorized vs approved), `addAuthorizedPickup` / `removeAuthorizedPickup` / `portalAddAuthorizedPickup`, `confirmPickup` (reolink), `pickupIdPhotoPurgeSweep` | `{so, opened_via, invoice_sent_at, qbo_balance, qbo_status, code_attempts, lock_until?, value_tier{item, invoice, total, high}, second_factor{method, kiosk}, authorized_id?, reolink{nvr, channel, from, to, clip_ref}, id_photo_purged_at}` — closes the family-60 note "failed verifies MUST be counted" (KEEPER D-414) |
| 71 | custody events · audit sessions · backfill · −1 at invoice | `job` (`appendAudit` on start / close / stub / backfill) + **`custody_events` ledger** (`custody.ts`) + `sales` stamp `custodyAtInvoice` | `startCustodyAudit`, `pauseCustodyAudit`, `resumeCustodyAudit`, `auditPickNode`, `custodyAuditScan`, `custodyAuditStub`, `closeAuditNode`, `closeCustodyAudit`, `backfillCustody`, `onPartMoved` (scan rows), `sendInvoice` (minus_one flag) | `custody_events {item_key, job, part, to_node, bin?, source scan\|audit\|backfill, by, station, at, why?, audit_id?}` (append-only — THE record); audit `{id, scope, status, nodes[], result{unaccounted[], found_no_job[]}}`; invoice `{so, custody_at_invoice, minus_one_parts[]}` (KEEPER D-432) |
| 72 | photo data class · WatchM8 switch · export log | `settings` (`appendAudit` on every flip / ref change) + **`export_log` ledger** (`watchm8Export.ts`) | `addJobPhoto` (class at write), `wm8.setEnvSwitch`, `setAgreementRef`, `setClassToggle`, `runExport`, `ackExport`, `clearLog` (dev) | photo `{photo, data_class operational\|specimen\|identity, slot, by}`; switch `{env, enabled, agreement_ref, by, at}`; log `{seq, env, type label\|photo, object, hash, licence_version, agreement_ref, exported_at, by, acked_at?}` (KEEPER D-428 · D-430) |