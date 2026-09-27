# E17 — CONVERGENCE REPORT (mock → real Prototype API)

Date: 2026-09-27 · API: `https://rolligroup-prototype-api.fly.dev` (one constant: `src/api/config.ts` → `API_BASE_URL`) · `API_MODE` default `hybrid`; `mock` = pre-E17 behaviour (banner chip toggles it, persisted in `localStorage.rollisuite.api.mode`).

Architecture: `src/api/realClient.ts` (HTTP impls, same signatures) · `src/api/routing.ts` (`route(name, mock, real)`: real when covered + hybrid, per-call fallback to mock on any failure, toast once / 8 s, console.warn) · `src/api/client.ts` tail: the routed exports · `src/api/config.ts`: `API_SOURCE` (the visible split) · `AppShell`: banner reads config + last-call health; `RouteErrorBoundary` contains render crashes (never white-screen; offers "Switch to MOCK").

## 0. Contract deviations (before anything else)
| Brief said | Observed |
|---|---|
| `GET /contract` lists every endpoint **with `maps_to`** naming the client function | `/contract` is a **stub**: `{"stub": true, "endpoints": ["GET /health", "GET|POST /estimates*", …]}` — patterns only, **no `maps_to`**. The endpoint → client-function mapping below is **inferred by hand** and should be confirmed by the API team. |
| `POST /auth/switch-user` returns `session_token`; wire the **password** path | `switch-user` requires `device_id` (device-bound) and a **4-digit `pin`** (`invalid_pin` when a password is sent). `POST /auth/sign-in` (password) returns **401 for every seeded staff password** (`michael/michael123`, `vienna/vienna123`…). |
| `GET /hit-list` | Returns `deprecated: true` — "D-186: prefer GET /today" — which needs `user_id` (staff_code). Wired to `/today`. |
| `GET|POST /intake/*` | No list endpoint discovered (`/intake/`, `/intake/list`, `/intake/queue`, `/intake/packages`, `/intake/estimates`, `/intake/pending` → 404). |

Sign-in as wired: `POST /auth/sign-in {username, password, device_id}` → on 401 the prototype verifies the password locally (seeded users) and binds the device with `POST /auth/switch-user {username, pin, device_id, camera_fallback}` to obtain the bearer token. Webcam snapshot stays client-side. Token → `localStorage.rollisuite.api.token`, sent as `Authorization: Bearer`. Device id → `localStorage.rollisuite.api.deviceId` (`web-<uuid>`, minted once).

## A. Final real / mock split per client function (`API_SOURCE`)
| Client function | Endpoint (inferred) | Source | Note |
|---|---|---|---|
| `signInWithPassword` | `POST /auth/sign-in` → `POST /auth/switch-user` | **real** | see §0; mock audit row still written locally |
| `getDashboardStats` | derived from `/estimates` + `/jobs` + `/sales-orders` | **real** (derived) | no KPI endpoint in contract; `departments` P&L = `[]` |
| `getRecentActivity` | derived from `created_at` of the 3 lists | **real** (derived) | no activity endpoint; typed into the nearest `ActivityType` |
| `getToday` (hit list) | `GET /today?user_id=` | **real** | returns `items: []` for michael; `pinned`/`waitingOn` always empty |
| `resolveIdentifier` (search) | `GET /search?q=` | **real** | groups clients/estimates/jobs/watches; no packages / SOs / requests / shipments groups on the wire |
| `getEstimate` | `GET /estimates/:id` | **real** | 404 → mock lookup (mock ids are not UUIDs) |
| `getSalesOrders` | `GET /sales-orders` | **real** | renders; payments ledger empty |
| `getSalesOrder` | `GET /sales-orders/:id` | **real** | 404 → mock lookup |
| `getRequests` | `GET /client-requests` | **real** | API returns `{requests: [], stub: true}` → empty list = live |
| `getPackages` | `GET /intake/packages` | **real** → falls back | **404 every call** → toast + mock (see §C) |
| `getEstimates` (list) | `GET /estimates` | **mock (parked)** | realClient implemented; list view throws `Invalid time value` — no `valid_until` on the wire (§B) |
| `getJobs` (board) | `GET /jobs` | **mock (parked)** | realClient implemented; status vocabulary mismatch crashes lane grouping (§B) |
| `getJob` | `GET /jobs/:id` | **mock (parked)** | realClient implemented; detail view needs number/watch/timeline (§B) |
| everything else (RW floor, supervisor pad, kiosk, RG, comms, inventory, purchasing, shipping, portal…) | — | mock | per `/contract.mocked_until_api_catchup` and no endpoint |

Flip any row by editing `API_SOURCE` in `src/api/config.ts` (one line each).

## B. Shape mismatches (function · UI expects · API returns) — NOT adapted, only trivial snake→camel mapping
### `getEstimates` / `getEstimate` — `GET /estimates`, `/estimates/:id`
| UI expects (`Estimate`) | API returns | Effect |
|---|---|---|
| `number` | `estimate_number` (`"303613"`, no `E` prefix) | mapped; number-format helpers assume `E0xxxx` |
| `validUntil` (ISO) | **absent** | list view `fmtDate(validUntil)` → **crash** ("Invalid time value") → list parked at mock |
| `revision`, `revisions[]`, `engagement[]`, `sendIntent`, `approvedVia`, `requiresApproval` | absent | defaulted rev 1 / empty |
| `department`, `lines[].dept`, `lines[].taxable`, `lines[].catalogId` | absent (`line_type`, `service_subcategory_id`, `part_id` instead) | dept defaulted `W`; service-code / division split impossible |
| `clientNotes / messageNotes / internalNotes` | `note_to_customer` only | mapped to clientNotes |
| `billingAddress`, `shippingAddress`, `shippingMirrorsBilling` | absent | empty addresses |
| `createdBy`, `updatedAt`, `sentAt`, `approvedAt`, `declinedAt`, `jobId`… | `created_at`, `converted_at`, `job_id` only | "Created … by " renders blank actor |
| `status` enum (`draft/sent/approved/declined/converted/expired`) | `converted` seen; full vocabulary unknown | — |
| `watch` (ref) | flat `watch_brand/model/serial/reference` (all `null` on live rows) | mapped to a stub watch when brand present |
| `client` (ref: `street/city/state/type/since`) | `customer {id, first_name, last_name, email, phone}`; `/search` returns `full_name` instead | address / type / since blank |
| list `items[]` | rows carry `tracking_number`, no totals or lines | list totals show $0 unless detail fetched |

### `getJobs` / `getJob` — `GET /jobs`, `/jobs/:id`
| UI expects (`Job`) | API returns | Effect |
|---|---|---|
| `status` ∈ `intake · in_review · awaiting_customer_approval · approved · in_service · testing · awaiting_manager_review · ready_to_ship · closed` | `intake` (44) · **`awaiting_inspection`** (3) · **`complete`** (3) | board lane grouping `g[status].push` → **crash** → parked |
| `number` (`J0xxxx`) | absent (`estimate_number` null for 48/50) | falls back to id prefix |
| `watchId` + `watch` ref | absent | detail `.replace` on undefined serial → **crash** |
| `lines[]`, `total`, `timeline[]`, `holds[]`, `notes[]`, `photos[]`, `components[]`, `inspection` | absent | empty |
| `workflow: DeptCode[]` | `workflow_codes: ["B"]` ✓ | mapped 1:1 (this is the component-chip combo — good) |
| `kind` | `job_kind: service / small_job / warranty` ✓ | passes through |
| `division` | `entity_id: "rolliworks"` | mapped |
| `owner: Role`, `assignees: string[]` | `owner_user_id: "vienna"`, `assignee_user_ids` | user codes ≠ `u-` ids |
| `dueAt`, `priority`, `simpleStatus` | `target_date` (null), none, none | defaults |
| extra wire fields the UI has no home for | `billing_semantics`, `workflow_type_suggested/committed`, `predicted_route`, `release_branch`, `discrepancy_hold` | ignored (worth surfacing later — `discrepancy_hold` maps to our hold flow) |

### `getSalesOrders` / `getSalesOrder` — `GET /sales-orders`
| UI expects | API returns | Effect |
|---|---|---|
| `number` (`SO-25-0031`) | `so_number` (`SO-2374`) | mapped |
| `status` ∈ `draft/open/partial_fulfilled/fulfilled/shipped/picked_up/cancelled` | `picked_up`, `shipped` seen ✓ | ok |
| `payments[]`, `balanceDue`, `payLinkToken`, `invoiceSends[]`, `qboStatus`, `pickupCode`, `shipment`, `pickupSession` | `is_paid`, `total_amount`, `tracking_number`, `picked_up_at`, `ship_date`, `fulfillment_channel` | payments ledger empty; balance derived from `is_paid`; QBO "not queued" |
| `lines[].rate/pickedUpQty/shippedQty` | list rows have **no lines**; detail: `quantity/unit_price` | "0 / 0" picked/shipped |
| `job` ref, `watch` ref | `job_id` (null) | no job / watch context |

### `getToday` — `GET /today?user_id=`
UI expects `{ pinned: PinnedItem[], rows: TodayRow[] (source ∈ owner/assignee/hold/discrepancy/task/thread, jobId, dueAt, overdue, urgent), waitingOn: Task[] }`. API returns `{ items: [], owner_user_id, role, derived: true }` — item shape unknown (empty for every seeded user); mapped to `source: 'task'` placeholder.

### `resolveIdentifier` — `GET /search?q=`
UI expects `SearchResults { groups: { kind ∈ client/estimate/job/package/sales_order/watch/request/shipment, hits: SearchHit{ hitKey, matched, clientId, clientName, path } } }`. API returns `{ clients[], estimates[], jobs[], watches[], q }` — no packages / SOs / requests / shipments / pickup codes / SUB#; customer on estimates is `{ full_name }` (list) vs `{ first_name, last_name }` (detail). Search by name (`calloway`) returned nothing — the staging data has no seeded clients matching ours.

### `getRequests` — `GET /client-requests`
API: `{ requests: [], stub: true }`. UI expects `ServiceRequest { number, clientId, source, status, summary, station, kiosk… }` — untestable until the stub carries data.

### `signInWithPassword` — auth
UI expects a `User` (shortName, displayName, roles, accessTier, division, pin). API returns `{ session_token (JWT, 1 h exp), user { id: "michael", display_name, username }, audit_event { device_id, snapshot_ref, camera_fallback, authenticated_at } }` — roles/tier/division come from the local user table; `snapshot_ref` is where the webcam photo would go.

## C. Contract endpoints that errored / were unreachable
| Endpoint | Result |
|---|---|
| `GET /hit-list?date=…` | 200 but `deprecated: true` (D-186) — use `/today` |
| `GET /today` (no `user_id`) | 400 `user_id_required` |
| `POST /auth/sign-in` (seeded passwords) | 401 `unauthorized` for michael / vienna / mh / MH; `staff_code` body → 400 `badge_rejected` (D-181) |
| `POST /auth/switch-user` with `password` | 400 `invalid_pin` (needs 4-digit `pin`) |
| `GET /intake/packages` (and every `/intake/*` list guess) | 404 `not_found` — `getPackages` falls back to mock on every call (toast fires once) |
| `GET /client-requests` | 200 but `{stub: true, requests: []}` |
| Not exercised this session (no UI read path yet) | `/pickup/*`, `/ship/*`, `/shipping/shipments`, `/qbo/*`, `/custody/*`, `/jobs/:id/messages*`, `/m3ke/events/*`, `/parcelpro/*` |

## D. Verification walk (hybrid, MH)
- Sign-in → `POST /auth/sign-in` 401 → `POST /auth/switch-user` 200 → token stored → dashboard: KPI cards (50 watches in house, $3,130 MTD), recent activity (SO-2374…) and Today hit list all from live calls (`GET /estimates`, `/jobs`, `/sales-orders`, `/today?user_id=michael` in the network tab). Banner: "PROTOTYPE — FAKE DATA · LIVE API".
- `/estimates/902ffdaf-…` (live) renders: 303613 · converted · PRACTICE INTAKE · 1 line $40 — with the gaps in §B visible (blank creator, no watch, "valid until" default).
- `/sales` + `/sales/21f0f9…` live: 17 shipped · 33 picked up · SO-2374 detail renders.
- `/intake` → `GET /intake/packages` 404 → toast "API unreachable — showing mock data" → mock intake board (walkable).
- `/estimates` list and `/jobs` board/detail: parked at mock (crashes documented above; the error boundary contained them when they were live).
- Mode toggle: banner chip → MOCK reloads with the pre-E17 behaviour; toggling back restores hybrid.
