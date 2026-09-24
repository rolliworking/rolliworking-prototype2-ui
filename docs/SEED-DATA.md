# SEED-DATA — what the fixtures cover

All under `frontend/src/api/fixtures/`. Dates are relative to "now" via `time.ts` (`daysAgo`, `daysFromNow`, `dayThisMonth`) so seeds stay fresh. In-memory; a full page reload resets everything except station/audit/session (localStorage).

## Users (`users.ts`) — 4
| id | shortName | tier | roles | password / PIN |
|---|---|---|---|---|
| u-michael | MH | manager | manager, inspector | michael123 / 1234 |
| u-walter | Walter | manager | manager, inspector | walter123 / 1234 |
| u-vienna | Vienna | concierge | concierge | vienna123 / 1234 |
| u-mm | MM | manager | manager, watchmaker | mm123 / 1234 |
Stations: `st-front-1` "Front Desk 1" (pre-registered on first load) + others in `stations.ts`.

## Clients (`clients.ts`) — 25, `c-01…c-25`, retail + trade, unique emails/phones (search by name/email/phone/company).

## Watches (`watches.ts`) — 19 (`w-01…w-19`), Rolex + Tudor. Statuses cover every `WatchStatus`; `w-16, w-17, w-18, w-19` are `expected` (estimate exists, not yet received → excluded from "in house"). `w-10` (OP 124300 / D7W3F9K2) is the **returning-watch** seed that triggers the same-watch fork at Receive Watch.

## Catalog (`catalog.ts`) — 22 services across W/B/P/PM incl. shipping-type lines.

## Estimates (`estimates.ts`) — 19
| status | ids | notes |
|---|---|---|
| converted | e-01 (historical, read-only), e-03, e-04, e-06, e-07, e-09 | each has a job (j-01…j-06) |
| sent | e-02 (rev 2), e-08, e-12, e-15 | convert-to-intake eligible |
| approved | e-05, e-11, e-13, e-14, e-16 | **Create job** eligible; e-05 has 4 lines $1,365 |
| declined | e-10 | reason seeded |
| expired | e-19 | validUntil in the past |
| draft | e-17, e-18 | e-18 has no watch |

## Intake packages (`intake.ts`) — 10, `pk-01…pk-10`, SUB-26-0301…0310
| status | ids | notes |
|---|---|---|
| arrived | pk-01, pk-02, pk-03 | carrier + walk-in |
| processed | pk-04, pk-05 | ready for work order |
| awaiting_inspection | pk-06 (e-13 → w-10 returning watch), pk-07, pk-08 | |
| received | pk-09 (e-12, workflow B+P) | labels lb-01/lb-02 queued |
| discrepancy_hold | pk-10 (e-08, missing bracelet) | appears on `/today` for concierge + inspector Walter |
Outbox: ob-01, ob-02. Labels: lb-01 (pdf417), lb-02 (ref/serial), unprinted.

## Jobs (`jobs.ts`) — 20, every status × workflow, numbers E02011…E02028 + history E01903/E01887
| id | number | status | kind | workflow | owner | assignees | notable |
|---|---|---|---|---|---|---|---|
| j-01 | E02011 | in_service | service | W | manager | MM | from e-01, high, note, 2 shop-time rows |
| j-02 | E02012 | ready_to_ship | service | P | concierge | Walter | from e-03, overdue due |
| j-03 | E02013 | in_service | service | W+P | manager | Walter, MM | multi-assignee |
| j-04 | E02014 | in_service | service | W | — | MM | **active parts hold** |
| j-05 | E02015 | testing | service | B+P | inspector | MH | from e-07 |
| j-06 | E02016 | in_service | service | W+PM | — | MM | **active outsource hold** |
| j-07 | E02017 | ready_to_ship | small_job | B | concierge (auto) | MH | no estimate |
| j-08 | E02018 | closed | service | P | — | Walter | finished, revenue |
| j-09 | E02019 | closed | service | W+B+P | — | MM | finished |
| j-10 | E02020 | approved | small_job | B | concierge (auto) | — | unassigned |
| j-11 | E02021 | awaiting_customer_approval | warranty | W | concierge (auto) | Walter | |
| j-12 | E02022 | intake | service | W+B | inspector | — | urgent |
| j-13 | E02023 | in_review | small_job | B+P | concierge (auto) | Walter | shows stage-skip (only "Mark approved") |
| j-14 | E02024 | intake | service | P | — | — | simpleStatus **estimate** (excluded from Shop Time) |
| j-15 | E02025 | approved | service | W | — | — | low |
| j-16 | E02026 | testing | warranty | W+P | concierge (auto) | MM | **QC-fail history** in timeline |
| j-17 | E02027 | in_service | service | PM | — | Walter | precious metals |
| j-18 | E02028 | in_review | service | W | — | MH | urgent |
| j-19 | E01903 | closed | service | W | — | MM | released parts hold in history (w-09 returning) |
| j-20 | E01887 | closed | service | B+P | — | Walter | old history for w-01 |
Counters: next job E02031, next estimate E01059, next SUB-26-0315, next SO SO-26-0108.

Inspection seeds: every job at `awaiting_customer_approval` or later has 1 inspection photo; service-kind ones also have a saved `inspection` report. In-review jobs j-13 (small_job) and j-18 (service) have no photos → review gate blocks them until photos are attached (j-18 also needs the report).

## Pinned (`tasks.ts`) — 4
| id | for | by | link | state |
|---|---|---|---|---|
| pin-01 | Vienna | MH | — | active ("#vienna order paper…") |
| pin-02 | MM | Walter | j-04 | active |
| pin-03 | role manager (MH, Walter, MM) | Vienna | t-09 | active |
| pin-04 | MM | MM | — | dismissed (history) |

## Sales orders (`salesOrders.ts`) — 7, one per tail stage
| id | number | client | job | status | channel | paid | notable |
|---|---|---|---|---|---|---|---|
| so-01 | SO-26-0101 | c-21 | — | draft | — | no | parts order, 2 lines |
| so-02 | SO-26-0102 | c-12 | j-07 (ready_to_ship) | open | pickup | no ($480 due) | **awaiting payment** |
| so-03 | SO-26-0103 | c-14 | j-21 (ready_to_ship) | fulfilled | pickup | yes | **ready for pickup**, code `4Q7M-82`, QBO queued |
| so-04 | SO-26-0104 | c-15 | j-22 (ready_to_ship) | fulfilled | ship | yes (2 partial payments) | **ready to ship**, address set, info requested |
| so-05 | SO-26-0105 | c-10 | j-08 (closed) | shipped | ship | yes | UPS tracking, shipment record + mock label |
| so-06 | SO-26-0106 | c-15 | j-09 (closed) | picked_up | pickup | yes | pickup session, code consumed |
| so-07 | SO-26-0107 | c-23 | — | cancelled | — | no | |
j-02 (ready_to_ship, no SO) = **awaiting invoice**. Next SO number SO-26-0108. Jobs j-21 (E02029) and j-22 (E02030) added as tail-stage seeds; next job E02031.

## Parts (`parts.ts`)
Catalog: 25 parts (crystal, crown, movement, gasket, bracelet, bezel, dial, PM). Requests: pr-01 approved (j-04, 3285 barrel, aliases learned), pr-02 pending (j-01 mainspring 3135), pr-03 pending (j-16 Syloxi hairspring), pr-04 rejected (j-03 wrong insert colour). Knowledge log: 3 entries. Next PR-0045. Try in chat: "crystal ring for a 16613" → 29-5220-0 top hit; "gasket 126610" → 29-210-64.
Bench (MM): j-01, j-03, j-16 + holds j-04, j-06; pull-next = j-10 (E02020, approved, unassigned) then j-15. Supervisor unassigned: j-10, j-15. QC queue: j-05, j-16. Floor case-cleaning lane: j-17 (PM only).

## Shop time (`jobs.ts`) — 5 rows: j-01 ×2 (MM), j-03 (Walter), j-05 (MH), j-16 (MM).

## Tasks (`tasks.ts`) — 10
| id | assignee | from | link | due | status |
|---|---|---|---|---|---|
| t-01 | role concierge | MM | j-04 | today | open |
| t-02 | MM | Walter | j-04 | **overdue** | open |
| t-03 | role watchmaker | MH | j-03 | tomorrow | open |
| t-04 | Vienna | Walter | j-02 | today | open |
| t-05 | MM | MH | j-16 | today | open |
| t-06 | role inspector | Vienna | (c-08) | today | open |
| t-07 | role concierge | Walter | j-03 | +2d | open |
| t-08 | MM | MM (self) | — | +3d | open |
| t-09 | role manager | Vienna | — | today | open |
| t-10 | Vienna | MH | j-11 | past | **done** |

## What `/today` shows per user (derived from the above; `OWNER_ACTION` = intake / awaiting_customer_approval / ready_to_ship, `TECH_ACTION` = approved / in_service / testing, held jobs become hold rows)
| user | owner actions | bench | holds | discrepancies | tasks | waiting-on |
|---|---|---|---|---|---|---|
| MM | — | j-01, j-03, j-16 | j-04, j-06 (placed by MM) | — | t-02 (overdue), t-03, t-05, t-08, t-09 | t-01 |
| Walter | j-12 | j-03, j-17 | — | pk-10 (flagged by Walter) | t-06, t-09 | t-02, t-04, t-07 |
| Vienna | j-02, j-07, j-11 | — | — | pk-10 (concierge) | t-01, t-04, t-07 | t-06, t-09 |
| MH | j-12 | j-05 | — | — | t-06, t-09 | t-03, t-05 |

## Activity (`activity.ts`) — 10 static dashboard rows (not derived).

## Testing honesty notes
- Numbers, names and dates are fabricated; no real customer data.
- Because the store is in-memory, chain dependent UI steps in one page session; `page.goto` resets it.
- Audit log persists across reloads (localStorage) and is capped at 60 — long test runs will evict early rows.
