# 04 — DATA MODEL vs KEEPER (every entity; nothing silently inheritable)

Read with `source/DATA-MODEL.md` (full field lists per entity, §1–§22). This file states, per entity, **prototype shape → KEEPER shape → migration note**, applying the known dispositions:

- **D-A Ownership**: a *current-owner field* on the record → an **append-only ownership chain** table (`entity_owner {entity_id, owner_type, owner_id, from_at, to_at, by}`); the current owner is the open row.
- **D-B Telemetry**: `Stamp {at, by, station}` on records and 60-row audit log → a **full telemetry ledger** (every read of sensitive data, every write, device, session, IP, before/after), retained; audit rows are a view over it.
- **D-C Identity**: text `entity_id` references (`j-03`, `c-01`) → an **`entities` table** (`entity_id uuid, kind, number, created_at`) that every module row references; numbers (`E02013`, `RQ-26-0046`) are attributes, never keys.
- **D-D Persistence**: in-memory store + `localStorage` session/replay hacks → **server persistence** (Postgres), server sessions, no client-side replay.
- **D-E Portal grants**: portal access implied by "the client's email" → a **reserved portal-grant model** (`portal_grant {client_id, principal, scope[], expires_at, revoked_at}`) — links, report tokens and sessions are grants.
- **D-026 Staff identity**: users fixture → RGTime owns staff identity; RS/RW read it.

Legend for the "shortcut" column: **M** in-memory mutable copy · **LS** localStorage · **F** fixture-only (no create function) · **T** text id · **O** current-owner field · **S** stamp-only telemetry · **P** projection (derived, not stored).

| entity (prototype) | shortcut | KEEPER shape | migration note |
|---|---|---|---|
| User (id, roles[], names, dutyLabel, accessTier, division \| both, password, pin) | M F T, plaintext secrets | `staff` owned by RGTime (D-026); `staff_role`, `staff_division`; credentials in an auth provider (hashed), PIN as a device-bound secondary factor | drop plaintext; `both` → two division rows or enum (Q4) |
| Station (id, name, division) + device registration (LS) | LS T | `device {device_id, station_id, registered_by, at}`; `station {division}` | registration is a server record, not a browser flag |
| Session (currentUserId LS; rc session LS; rg session LS) | LS | server sessions per route-space (RS, RW, RC, RT, RG), each an access boundary | no shared browser session across route-spaces |
| AuditEvent (60 cap, inline photo) | LS S | telemetry ledger (D-B) + `audit_view`; photo as blob ref | keep type taxonomy (`08`) |
| Client (id, names, email, phone, address, type, since) | M T | `client` referencing `entities`; contact rows normalised (email/phone with `normalized` columns for matching) | kiosk match relies on normalised email/phone indexes |
| Watch (id, clientId, brand, model, reference, serial, status) | M T P(status) | `watch`; **status derived** from open job/hold (§8) not stored | receive-watch overwrite rule → Q18 |
| Estimate (+lines, revisions[], status, sentAt, approvedVia…) | M T O(none) S | `estimate`, `estimate_line`, `estimate_revision` (snapshots), `estimate_transition` ledger | number sequence Q1; expiry Q7 |
| Job (status, simpleStatus, owner Role, assignees[], holds[], timeline[], notes[], photos[], inspection, **components[]**, division) | M T **O** (owner + assignees as current fields) S | `job`; `job_transition` (append-only, already the shape); `job_hold`; `job_note`; `job_photo` (blob refs); `job_inspection`; **`job_component` {key, depts, completed_by, completed_at, station, amended_from/by/at}** + `job_component_rework`; **owner and assignees → ownership chain (D-A)** | `deleteJob` hard delete → soft delete; division wall on writes (Q3) |
| JobTransition / JobHold / JobNote (Stamp) | S | rows with actor + device + session id from the ledger | already append-only |
| ShopTimeEntry | M T | `shop_time` | never moves status (keep) |
| Task, PinnedItem | M T | `task`, `pinned_item`; assignee (user\|role) → `assignee` polymorphic columns; division | pins never deleted (keep) |
| Package (SUB#, stages, contents[], photos[], discrepancies[], workflow[]) | M T S (station only at arrival) | `package`, `package_transition`, `package_photo`; station on every stage (Q14) | discrepancy exit function (Q5) |
| OutboxEmail | M | `notification {channel email\|sms, to, template_key, merge_values, status queued\|sent\|failed, provider_id}` | `06-SEAMS.md` |
| Label | M | `print_job {kind, payload, printer_id, status}` → ZPL | `06-SEAMS.md` |
| SalesOrder (+lines, payments[], shipment, pickupSession, pickupCode, qbo*) | M T S | `sales_order`, `so_line`, `payment`, `shipment`, `pickup_session`, `pickup_code` (hashed, single-use), `qbo_sync` | fake tracking/QBO ids → real seams |
| Part, StockLevel, StockMovement, CycleCount, PurchaseOrder, Vendor, StockLocation | M T | inventory schema as named; `Part.stock` derived (Q30); movements append-only | cross-division rules Q29 |
| PartsRequest (chat[], searchTerms[], status) + PartsKnowledgeEntry | M T | `parts_request`, `parts_request_message`, `parts_knowledge` (learned aliases/associations) | scripted assistant → seam |
| ServiceRequest (+kiosk details, matchState, division?) | M T (create F except kiosk) | `service_request`, `service_request_kiosk`, `client_match {state, matched_on[]}` | staff create/quote (Q6) |
| Conversation, ConvMessage (tokens, events) ; legacy Message | M T | one `conversation`/`message` store (retire legacy, Q39); `reply_token` table with TTL | inbound parsing seam |
| MagicLink, portal session, rcEvents replay | LS | **portal_grant** (D-E) with single-use + TTL; no replay | prototype replay hack is not a feature |
| InspectionReportDoc (token, version, supersede chain, grades) | M T | `inspection_report` + token as a portal grant (D-E, TTL Q43) | supersede chain keep |
| EvidenceItem (slot, photo, labelScan, depth, grades) | M T | `service_evidence` keyed to watch **and** job; blob refs; retention Q31 | append-only keep |
| TimingTest (+CaliberTolerance) | M F(tolerances) | `timing_test` (append-only watch history); `caliber_tolerance` editable table | Witschi import seam |
| NfcTag, Punch | M T | `nfc_tag {id, location, division, secret/rotation}`, `time_punch` (append-only; corrections as new rows Q52) | hardening Q51 |
| Companion: ModelReference, PriceEvidence, PriceVerification, ClientBrief, BriefCorrection, KnowledgeCard, RoutedQuestion, PhotoLabel | M F | M3KE store (`06-SEAMS.md`): evidence rows with citations, verifications, corrections, knowledge cards | scripted answers are not data |
| MessageTemplate, MERGE_FIELDS | M | `message_template` (versioned) driving every notification (Q32) | |
| Report, DashboardStats, TodayView, BenchView, SupervisorBoard, FloorMap, RwFloorMap, Client360, SearchResults, CustodyEvent, PortalStatus, ClockState, WeekView, CompletionsReport | **P** | server-computed read models / SQL views | never stored; keep formulas (`05`, module specs) |

## Entities table and numbering (D-C)
`entities {entity_id uuid pk, kind enum(client, watch, estimate, job, package, sales_order, request, conversation, …), number text unique per kind, division, created_at}`. Every module table has `entity_id fk`. Search (`universalSearch`) becomes an index over `entities.number` + contact fields.

## Post-E16 entities (2026-09-26 sessions) — dispositions

| entity (prototype) | shortcut | KEEPER shape | migration note |
|---|---|---|---|
| **JobComponent extensions** `station: RwStationKey, partStatus, custodyTech, history: PartMove[] {at, by, from?, to?, status, via, note?}` (embedded on `Job.components[]`) | M T O S | `job_component {component_id, job_id, kind head\|band\|case, completed_at/by/station, amended…}` + **`part_move`** append-only `{move_id, component_id, from_station, to_station, status, via, by, device, at, note}`; current station/custody = latest move (D-A: custody is an ownership chain) | derive placement rules (`derivePlacement`) become a view for components with no moves; `RwStationKey` becomes a `station` row with `lane` (head/band/shared) and `order` |
| **JobMessage** `{id, jobId, parentId?, text, mentions[], notify[], photo?, readBy[], at, by, station}` (store array + fixture) | M T | `job_message {message_id, job_id, thread_id (root), author, text, photo_blob?, at, device}` · `job_message_mention {message_id, staff_id}` · `job_message_notify {message_id, staff_id}` · **`job_message_read {message_id, staff_id, read_at}`** | reply normalisation to root stays; read state is per person; never client-facing → no portal grant ever covers this table |
| **PinnedItem.messageId** | M | `hit_list_pin.source {kind: message, message_id}` | pin creation from a mention is a write and must audit |
| **ClientRequest** `{id, text, at, by, station, acks: {at, by, via}[], check?: {at, by, result done\|na, reason?}}` on `Job.clientRequests[]` | M S | `client_request {request_id, job_id, text, created…}` · **`client_request_ack`** `{request_id, staff_id, via, at, device}` · **`client_request_check`** `{request_id, result, reason?, by, at}` | QC gate = "no open request without a check" enforced server-side on the `qc_pass` transition |
| **M3keEvent** `{id, kind resolved\|selected, description, reference, caliber?, partId, partNumber, price?, resolvedBy, ts, requestId?}` (in-memory append-only) | M T | **`m3ke_event`** append-only, exported to the training store (`06` §6); index on `(reference, description_tokens)` for learned-first ranking | this table is the labelling ledger; never edited or deleted |
| **PartsRequest extensions** `items[] {partId?, description, qty, price?, partNumber?, generic}`, `reference`, `caliber`, `history[]`, `sentForApprovalAt`, `clientDecidedAt`, `allocatedAt`, `emailId`; statuses `pending_review`, `awaiting_client`, `declined` | M T | `parts_request_line {line_id, request_id, part_id?, description, qty, price?, part_number?, generic}` · `parts_request_event` (history) | manager gate = every line priced + numbered before `awaiting_client` (server guard) |
| **PickTask** `{id, prId, partId, jobId, qty, status open\|picked\|short\|found, location, createdAt, doneAt?, note?}` (`rw18.picks`) | M T | **`pick_task`** `{pick_id, request_line_id, part_id, job_id, qty, location_id, status, done_by, done_at}`; `picked` posts a `stock_movement {kind issue, job_id}` | today `picked` decrements `Part.stock` directly — must become a movement against `stock_level` (Q83) |
| **Part.location** (free text, rewritten by "found elsewhere") | M | `part_default_location {part_id, location_id}` updated by the found-elsewhere event; `stock_location` rows already exist | self-correcting location data (VB3-08) is a feature — keep the write, make it a movement |
| **InboundShipment** `{id, direction, estimateId, clientId, stage, carrier, service, declaredValue, destinationState, requestedAt, labelSentAt?, trackingNumber?, labelUrl?, cost?, events[], eta?, deliveredAt?, arrivedAt?, reissued?, stamps[], emailIds[]}` (`shp.rows`) | M T F(outbound) | **`shipment`** `{shipment_id, direction, estimate_id, client_id, package_id?, stage, carrier, service, declared_value, insured_value, cost, tracking_number, label_blob, requested/sent/delivered/arrived_at, reissued_from?}` · `shipment_event` (carrier feed) · `shipment_stamp` (our actions) · `shipment_email {shipment_id, email_id}` | one ledger for inbound **and** outbound; the RS ship station must write here (`⚠ DRIFT` today it does not); cost flows to the SO shipping line |
| **Bench settings** `{benchName, idleMinutes, simulateOffline}` (`localStorage rollisuite.bench.settings`), last-board cache (`rollisuite.bench.lastBoard.<user>`), offline flag | LS | **Ruling (MH 2026-09-26): device identity registers server-side** — `station {station_id, name 'Bench 3', division, kind bench_pad\|supervisor_pad\|scanner\|desk, idle_minutes}` + `device {device_id, station_id, adopted_by, at}`; cache/offline flag are client concerns (service worker) | a wiped/replaced iPad re-adopts its bench identity by manager PIN; `simulateOffline` is NOT KEEPER |
| **Tech goals** `techGoals`, `goalHistorySeeds`, `currentMonthBase` (fixtures) | F | `tech_goal {staff_id, month, goal}`; month actuals computed from `job_component.completed_at/by`; by-week / by-type are views | seeds exist only to make hit/missed tiles walkable |
| **BenchBoard, BenchGoals, PadCard, RoomSummary, ShopFloor, WorkQueueRow, PickTaskView, PadPartsContext, ThreadView additions, MessageInboxRow, ShipmentWithRefs, InboundCounts, LabelPrep** | **P** | server-computed read models | never stored |

## What must not be inherited from this model
Text ids as keys · plaintext credentials · **embedded arrays for moves / acks / reads / stamps (all append-only tables in KEEPER)** · `localStorage` bench identity · `both` literal without a join decision · current-owner fields · inline base64 photos · 60-row audit cap · `localStorage` anything · fixture-only lifecycles (requests create/quote, expired estimates) · fake external ids (`QBO-STUB-…`, tracking, labels).

## Entities added 2026-09-27 → 2026-09-29 (post-refresh)
Disposition: **K** keep as-is · **C** keep with changes · **P** prototype-only.

| entity (prototype) | disp. | KEEPER shape / note |
|---|---|---|
| **Station** `{id, name, division, receptionMode?, deviceType?: 'desktop' \| 'pad' \| 'kiosk'}` (`fixtures/stations.ts`; localStorage registry `rollisuite.prototype.stations`) | C | `station {id, name, entity_id, device_type, reception_mode, registered_at, registered_by}` + **station token** (D-384) issued at registration; WM 1–8 are stations, never users |
| Station token | — | not built; KEEPER: `station_token {station_id, token_hash, issued_at, revoked_at}` presented by kiosks/pads |
| Reception flag (`Station.receptionMode` + `sessionStorage receptionOverride`) | C | on the station record only; the query override is P |
| Session (`localStorage currentUserId`; `realClient` token `rollisuite.api.token` + `deviceId`) | C | `session {id, user_id, station_id, device_id, started_at, ended_at, method, invalidated_by?}`; single active session per user |
| **View-as audit** (`AuditEvent.onBehalfOf`, types `view_as_started/ended`, `sessionStorage viewAsUserId`) | C | every write row carries `actor_id` + `on_behalf_of_id`; impersonation stored server-side on the session, never on the device |
| `InboundShipment` / `ShipmentWithRefs` `{id, estimateId, direction, stage: ShipStage, carrier, trackingNumber, labelUrl, cost, insuredValue, events: TrackingEvent[], eta, deliveredAt, emailIds[], stamps[]}` | C | `shipment` + append-only `tracking_event {shipment_id, at, status, location, source: webhook \| manual}` + `label {shipment_id, url, cost, voided_at}` |
| Label request (`createInboundLabel` inputs; SWO labels `SwoLabel`) | C | `label_request {shipment_id, requested_by, recipient, declared_value, service_level, quoted_cost}` |
| QBO sync fields: `SalesOrder.qboInvoiceId`, `qboStatus: 'not_queued' \| 'queued' \| 'excluded'`; `QboSetup.links Map<clientId, qboCustomerId>`; zero-balance log rows | C | add `sync_token`, `last_synced_at`, `last_error` on invoice/customer/item; `zero_balance_exclusion {so_id, reason, notes, by, at}` |
| Bypass log `BypassEvent {id, kind, by, station, at, jobNumber?, orderId?, reason, context}` | K | append-only `bypass_event`; feeds owner accountability |
| Intercom calls/pages (`IntercomCall`, `StorePage`, in memory) | C | `intercom_call {from_station, to_station, started_at, ended_at, state}`, `page {by, text, division, at}`; provider room ids |
| Photo sets (WM kiosk `KioskPhotoSet` guided 4-step + ad-hoc with @-mentions; pad photos; auth capture `AuthSession/AuthShot`) | C | `photo {id, watch_id, job_id?, slot, blob_ref, client_visible, by, station, at}`; `photo_set {job_id, kind: 'wm_kiosk', completed_at}`; `auth_session/auth_shot` with camera role |
| Camera map | — | not built; KEEPER: `station_camera {station_id, role: 'ipevo' \| 'microscope' \| 'signin', device_label}` |
| Hitlist tasks / inbox / claims (`Task`, `PinnedItem`, `InboxItem {to, from, text?, photo?, jobId?, replyToId?, readBy[]}`, `TEAM_MAP`) | C | `task`, `pin`, `inbox_message` + `inbox_read {message_id, user_id, at}`; team = `supervises {supervisor_id, role}` table, not a constant |
| Appraisals (`appraisals.ts`: `Appraisal {number, jobId, signerId, insuredValue placeholder, status}`, signer selector with stored signatures) | C | `appraisal` + `signer {user_id, entity_id, signature_blob_ref}` entity-scoped |
| Estimate items (`items.ts EstimateItem {id, label, components?, componentsOverride}` + per-item trickle-down chains) | K | `estimate_item` with `component_set` + override stamp |
| Client reference (`Estimate.clientRef` / `Job.clientRef`, subject prefix `[REF:…]`) | K | `client_reference` on estimate, copied to jobs |
| Scan-gate override (`overrideScanGate` audit) | K | `gate_override {so_id, by, reason, at}` |
| Call ledger `CallEvent`, `CallNote`, `ClientRating {attitude, communication, history[]}` | K | `call_event`, `call_note`, `client_rating_change` |
| Device override (`sessionStorage deviceOverride`) | P | delete at cut-over (D-384) |
