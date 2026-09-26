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

## What must not be inherited from this model
Text ids as keys · plaintext credentials · `both` literal without a join decision · current-owner fields · inline base64 photos · 60-row audit cap · `localStorage` anything · fixture-only lifecycles (requests create/quote, expired estimates) · fake external ids (`QBO-STUB-…`, tracking, labels).
