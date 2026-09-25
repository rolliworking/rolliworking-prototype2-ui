# SEED-DATA — what the fixtures cover (and deliberately don't)

All under `frontend/src/api/fixtures/`. Dates are relative to "now" (`time.ts`: `daysAgo`, `daysFromNow`, `hoursAgo`, `dayThisMonth`) so seeds never age. In-memory; a full reload resets everything except station list / device registration / staff session / audit log / RolliConnect session + event log + magic links. **These fixtures are KEEPER's acceptance test data** — port them as SQL seeds with the same ids and numbers.

## Counts at a glance
| table | rows | ids | next number |
|---|---|---|---|
| users | 4 | u-michael, u-walter, u-vienna, u-mm | — |
| stations | 6 | st-01…st-05, st-rs | — |
| clients | 25 | c-01…c-25 | — |
| watches | 21 | w-01…w-21 | — |
| catalog | 22 | | — |
| estimates | 24 | e-01…e-24 | E01059 |
| packages | 11 | pk-01…pk-11 | SUB-26-0315 |
| outbox | 8 | ob-01…ob-08 | — |
| labels | 2 | lb-01, lb-02 | lb-04 |
| jobs | 25 | j-01…j-25 | E02031 |
| shop time | 5 | st-01…st-05 | — |
| tasks | 15 | t-01…t-13, t-rs-01, t-rs-02 | — |
| pinned | 6 | pin-01…pin-04, pin-rs-01, pin-rs-02 | — |
| sales orders | 8 | so-01…so-08 | SO-26-0108 |
| parts | 25 | | — |
| parts requests | 4 | pr-01…pr-04 | PR-0045 |
| parts knowledge | 3 | | — |
| requests | 9 | rq-01…rq-09 | (no counter) |
| messages | 3 | msg-01…msg-03 | — |
| activity | 10 | static | — |

## Users (`users.ts`)
| id | shortName | tier | roles | division | password / PIN |
|---|---|---|---|---|---|
| u-michael | MH | manager | manager, inspector | **both** | michael123 / 1234 |
| u-walter | Walter | manager | manager, inspector | **rollishop** | walter123 / 1234 |
| u-vienna | Vienna | concierge | concierge | rolliworks | vienna123 / 1234 |
| u-mm | MM | manager | manager, watchmaker | rolliworks | mm123 / 1234 |
Stations: st-01 Front Desk 1 (pre-registered on first load), st-02 Front Desk 2, st-03 Inspection Bench, st-04 Watchmaker Room, st-05 Shipping — all rolliworks; **st-rs RS Counter — rollishop**. Register the device at RS Counter (Setup → Reset registration) to test the division wall.

## Clients (`clients.ts`) — 25, retail + trade, unique emails/phones. Rich seeds: Naomi Castellanos c-10 (Client 360), Harrison Whitfield c-01, Eleanor Vance c-02, Grace Nakamura c-14 (RolliConnect).

## Watches (`watches.ts`) — 21, Rolex + Tudor
| status | ids |
|---|---|
| expected | w-16, w-17, w-18, w-19 (estimate exists, not received → excluded from "in house") |
| intake | w-05, w-13 |
| awaiting_approval | w-02, w-08, w-14 |
| in_service | w-01, w-04, w-09, w-11, w-20 |
| awaiting_parts | w-06 |
| qc | w-07 |
| awaiting_pickup | w-03, w-12 |
| released | w-10, w-15, w-21 |
`w-10` (OP 41 124300 / D7W3F9K2) is the **returning-watch** seed for the same-watch fork at Receive Watch (pk-06). **Drift**: some watch statuses lag their job (w-14 awaiting_approval vs j-21 ready_to_ship; w-11 in_service vs j-10 approved) — watch.status is a projection and the seed was hand-set; KEEPER derives it.

## Catalog (`catalog.ts`) — 22 services across W/B/P/PM incl. shipping-type lines.

## Estimates (`estimates.ts`) — 24
| status | ids | notes |
|---|---|---|
| converted | e-01 (historical), e-03, e-04, e-06, e-07, e-09, e-20 (hist.), e-21 (hist.), e-22, e-23 (rev 2, snapshot seeded) | each has a job |
| sent | e-02 (rev 2, Eleanor, j-11), e-08 (pk-10 discrepancy), e-15 | convert-to-intake eligible; portal approve/decline target = e-02 |
| approved | e-05 ($1,365, 4 lines), e-11 (pk-04), e-13 (pk-06), e-14, e-16 | **Create job** eligible |
| declined | e-10 | reason seeded |
| expired | e-19 | validUntil past |
| draft | e-12 (Grace, was sent), e-17, e-18 (no watch), e-24 (Naomi Tudor) | |

## Intake packages (`intake.ts`) — 11
| status | ids | notes |
|---|---|---|
| arrived | pk-01 (FedEx, unknown client), pk-02 (UPS, c-16), pk-03 (walk-in, c-17) | stage 1 done |
| processed | pk-04 (e-11), pk-05 | stage 2 done |
| awaiting_inspection | pk-06 (e-13 → w-10 **returning watch**), pk-07, pk-08 | scan estimate # to open stage 4 |
| received | pk-09 (e-12, workflow B+P; labels lb-01/lb-02), pk-11 (SUB-26-0291, Naomi, → j-24) | |
| discrepancy_hold | pk-10 (e-08, missing bracelet; flagged by Walter) | appears on `/today` for concierge + Walter (rolliworks session) |
Outbox ob-01…ob-08 (six to naomi.castellanos@example.com). Labels lb-01 (pdf417), lb-02 (ref/serial), unprinted.

## Jobs (`jobs.ts`) — 25, every status × workflow × kind; **all `division: rolliworks`**
| id | number | status | kind | workflow | owner | assignees | notable |
|---|---|---|---|---|---|---|---|
| j-01 | E02011 | in_service | service | W | manager | MM | from e-01, high, note, 2 shop-time rows, Harrison (portal "On the bench") |
| j-02 | E02012 | ready_to_ship | service | P | concierge | Walter | from e-03, overdue; **no SO → awaiting invoice** |
| j-03 | E02013 | in_service | service | W+P | manager | Walter, MM | multi-assignee |
| j-04 | E02014 | in_service | service | W | — | MM | **active parts hold** (pr-01 approved) |
| j-05 | E02015 | testing | service | B+P | inspector | MH | from e-07 |
| j-06 | E02016 | in_service | service | W+PM | — | MM | **active outsource hold** |
| j-07 | E02017 | ready_to_ship | small_job | B | concierge (auto) | MH | no estimate; so-02 open unpaid → **awaiting payment** |
| j-08 | E02018 | closed | service | P | — | Walter | Naomi; so-05 shipped |
| j-09 | E02019 | closed | service | W+B+P | — | MM | so-06 picked up |
| j-10 | E02020 | approved | small_job | B | concierge (auto) | — | **pull-next #1**, unassigned |
| j-11 | E02021 | awaiting_customer_approval | warranty | W | concierge (auto) | Walter | Eleanor; portal approve of e-02 advances it |
| j-12 | E02022 | intake | service | W+B | inspector | — | urgent |
| j-13 | E02023 | in_review | small_job | B+P | concierge (auto) | Walter | shows stage-skip (only "Mark approved"); **no photos → gated** |
| j-14 | E02024 | intake | service | P | — | — | simpleStatus **estimate** (excluded from Shop Time / active) |
| j-15 | E02025 | approved | service | W | — | — | low; pull-next #2 |
| j-16 | E02026 | testing | warranty | W+P | concierge (auto) | MM | **QC-fail history** in timeline; pr-03 pending |
| j-17 | E02027 | in_service | service | PM | — | Walter | precious metals → **Case cleaning lane** |
| j-18 | E02028 | in_review | service | W | — | MH | urgent; **no photos, no report → gated** |
| j-21 | E02029 | ready_to_ship | service | W+P | concierge | MM | Grace; so-03 fulfilled pickup → **ready for pickup** |
| j-22 | E02030 | ready_to_ship | service | W | concierge | Walter | so-04 fulfilled ship → **ready to ship** |
| j-19 | E01903 | closed | service | W | — | MM | released parts hold (w-09 returning) |
| j-20 | E01887 | closed | service | B+P | — | Walter | old history w-01 |
| j-23 | E01412 | closed | service | W | — | MM | Naomi 2023, from e-20 |
| j-25 | E01788 | closed | service | W+B+P | — | Walter, MM | Naomi 2024, from e-21; so-08 picked up |
| j-24 | E02007 | in_service | service | W | manager | MM | Naomi, from e-23 rev 2, pk-11, released parts hold, high |
Seed builder: jobs at `awaiting_customer_approval` or later get 1 inspection photo; service-kind ones also a saved report. Timelines are synthesized per status with Walter as reviewer and the first assignee as tech.

## Shop time (`jobs.ts`) — j-01 ×2 (MM 95 + 140 min), j-03 (Walter 60), j-05 (MH 45), j-16 (MM 30).

## Sales orders (`salesOrders.ts`) — 8, one per tail stage
| id | number | client | job | status | channel | paid | notable |
|---|---|---|---|---|---|---|---|
| so-01 | SO-26-0101 | c-21 | — | draft | — | no | parts order, 2 lines |
| so-02 | SO-26-0102 | c-12 | j-07 | open | pickup | no ($480 due) | awaiting payment |
| so-03 | SO-26-0103 | c-14 | j-21 | fulfilled | pickup | **partial** $1,000 of $1,470 | code `4Q7M-82`, QBO queued; Grace portal "pay balance" + "choose pickup window" |
| so-04 | SO-26-0104 | c-15 | j-22 | fulfilled | ship | yes (2 payments) | address set, info requested |
| so-05 | SO-26-0105 | c-10 | j-08 | shipped | ship | yes | UPS tracking, shipment + mock label |
| so-06 | SO-26-0106 | c-15 | j-09 | picked_up | pickup | yes | pickup session, code consumed |
| so-07 | SO-26-0107 | c-23 | — | cancelled | — | no | |
| so-08 | SO-25-0042 | c-10 | j-25 | picked_up | pickup | yes ($250 card + $260 cash, 2024) | Naomi history |

## Parts (`parts.ts`)
25 parts (crystal, crown, movement, gasket, bracelet, bezel, dial, PM). Requests: pr-01 approved (j-04, 3285 barrel, aliases learned), pr-02 pending (j-01 mainspring 3135), pr-03 pending (j-16 Syloxi hairspring), pr-04 rejected (j-03 wrong insert colour). Knowledge log 3 rows. Chat smoke: "crystal ring for a 16613" → 29-5220-0 top; "gasket 126610" → 29-210-64; bare "crown" scores below threshold without a ref.
Lenses: Bench (MM) = j-01, j-03, j-16 + holds j-04, j-06; pull-next j-10 then j-15. Supervisor unassigned = j-10, j-15; QC queue = j-05, j-16. Floor Case-cleaning = j-17.

## Tasks (`tasks.ts`) — 15
| id | division | assignee | from | link | due | status |
|---|---|---|---|---|---|---|
| t-01 | rolliworks | role concierge | MM | j-04 / c-06 | today | open |
| t-02 | rolliworks | MM | Walter | j-04 | **overdue** | open |
| t-03 | rolliworks | role watchmaker | MH | j-03 / w-04 | tomorrow | open |
| t-04 | rolliworks | Vienna | Walter | j-02 / c-03 | today | open |
| t-05 | rolliworks | MM | MH | j-16 | today | open |
| t-06 | rolliworks | role inspector | Vienna | c-08 | today | open |
| t-07 | rolliworks | role concierge | Walter | j-03 / c-04 | +2d | open |
| t-08 | rolliworks | MM | MM (self) | — | +3d | open |
| t-09 | rolliworks | role manager | Vienna | — | today | open |
| t-11 | rolliworks | role concierge | MM | j-24 / w-20 / c-10 | today | open |
| t-12 | rolliworks | Vienna | Vienna | c-10 / w-21 | tomorrow | open |
| t-13 | rolliworks | Vienna | Walter | j-08 / c-10 | past | done |
| t-10 | rolliworks | Vienna | MH | j-11 / c-02 | past | done |
| t-rs-01 | **rollishop** | Walter | Walter | — | today | open |
| t-rs-02 | **rollishop** | role manager | Walter | — | tomorrow | open |

## Pinned (`tasks.ts`) — 6
| id | division | for | by | link | state |
|---|---|---|---|---|---|
| pin-01 | rolliworks | Vienna | MH | — | active (`#vienna order paper…`) |
| pin-02 | rolliworks | MM | Walter | j-04 | active |
| pin-03 | rolliworks | role manager | Vienna | t-09 | active |
| pin-04 | rolliworks | MM | MM | — | dismissed (history) |
| pin-rs-01 | **rollishop** | Walter | Walter | — | active |
| pin-rs-02 | **rollishop** | role manager | Walter | — | active |

## `/today` per user (derived; session at a **rolliworks** station)
| user | owner actions | bench | holds | discrepancies | tasks | pinned | waiting-on |
|---|---|---|---|---|---|---|---|
| MM | — | j-01, j-03, j-16, j-24 | j-04, j-06 (placed by MM) | — | t-02 (overdue), t-03, t-05, t-08, t-09 | pin-02, pin-03 | t-01, t-11 |
| MH | j-12 | j-05 | — | — | t-06, t-09 | pin-03 | t-03, t-05 |
| Vienna | j-02, j-07, j-11, j-21, j-22 | — | — | pk-10 (concierge) | t-01, t-04, t-07, t-11, t-12 | pin-01 | t-06, t-09 |
| Walter (rollishop user at a rolliworks station) | j-12 | j-03, j-17 | — | pk-10 (flagged by Walter) | t-06, t-09 | pin-03 | t-02, t-04, t-07 |
Session at **RS Counter (rollishop)**: MM/Vienna are not division staff (pickers hide them); MH or Walter see only t-rs-01/02 + pin-rs-01/02 and **no job rows** (all jobs are rolliworks), no discrepancies.
(t-09 is a manager-role task: MM, MH, Walter see it; Vienna created it → waiting-on.)

## Client 360 seed — Naomi Castellanos (c-10)
| watch | ref / serial | status | history (newest first) |
|---|---|---|---|
| w-20 Datejust 31 | 278274 / 2R8M5K7Q | in_service | j-24 E02007 (MM, released parts hold) ← e-23 E01040 rev 2 ← pk-11 SUB-26-0291 FedEx `794644790132` received |
| w-10 OP 41 | 124300 / D7W3F9K2 | released | e-13 E01053 approved (pk-06 SUB-26-0305 UPS `1Z999AA10123456701` awaiting inspection) · rq-02 closed · so-05 SO-26-0105 shipped · j-08 E02018 closed ← e-22 · e-10 declined · j-23 E01412 (2023) ← e-20 E00812 hist. |
| w-21 Tudor BB58 | M79030B-0001 / W4T9L36N | released | rq-01 quoted → e-24 E01057 draft · so-08 SO-25-0042 picked up (2024) · j-25 E01788 ← e-21 E00931 hist. |
Requests: rq-01 (call, quoted), rq-02 (email, closed), rq-03 (web, new, no watch); others rq-04 (c-02 quoted → e-02), rq-05 (c-21 new), rq-06/rq-07 (Harrison, both new, rq-07 closable as duplicate of rq-06), rq-08 (Grace, quoted → e-12), rq-09 (Grace, staff-closed duplicate of rq-08).
Search smoke: `Naomi` · `naomi.castellanos` · `555-0110` · `E01040` · `E02007` · `SUB-26-0291` · `794644790132` · `1Z999AA10123456701` · `278274` · `W4T9L36N` · `SO-25-0042` · `4Q7M-82` · `RQ-26-0041`.

## RolliConnect canonical clients
| client | email | state | portal shows |
|---|---|---|---|
| Eleanor Vance c-02 | eleanor.vance@example.com | awaiting approval | Needs you: approve/decline E01042 rev 2 ($2,850); Daytona "Waiting for your approval" → approve → j-11 approved → "Queued for the bench" |
| Harrison Whitfield c-01 | harrison.whitfield@example.com | on the bench | Submariner "On the bench" (j-01, ETA), unread staff reply msg-02, rq-06/rq-07 (one closable), 3 documents |
| Grace Nakamura c-14 | grace.nakamura@example.com | ready for pickup | Tudor "Ready for pickup"; pay $470 on SO-26-0103; choose pickup window; rq-08 message-us only; msg-03 unread by staff |
Messages: msg-01 (Harrison → staff, read), msg-02 (Vienna → Harrison, unread by client), msg-03 (Grace → staff, unread by staff).

## What the seeds deliberately DON'T cover (keep KEEPER's tests honest)
- **No rollishop jobs, packages, estimates, SOs, parts requests** — the division wall is exercised only through tasks/pins and pickers.
- No job with an active hold at `approved` or `testing` (only in_service); no released outsource hold.
- No `expired` estimate produced by code (no expiry sweep exists); no `partial_fulfilled` SO at rest; no SO with `channel: ship` still unpaid; no admin-marked SO.
- No `back_to_review` transition in any timeline; no job created via `createJob(onHand=false)` then converted, except j-14 sitting at `estimate`.
- No package at `discrepancy_hold` that was later resolved (no resolve function).
- No ServiceRequest created or quoted by code; no `rehab` / `internal` job kinds; no `both`-division user other than MH.
- No proxy-pickup grant recorded ahead of time (only ad hoc at the counter); no client with two open estimates on one watch.
- No parts search-miss records; aliases exist only from approvals.
- Photos are SVG placeholders (`seedPhoto`), not images; audit log starts empty except the auto-registration row.
- Numbers, names, dates, emails, tracking numbers and money are fabricated; no real customer data.

## Testing honesty notes
- Store is in-memory: chain dependent steps in one page session; `page.goto` resets — EXCEPT RolliConnect writes, which replay from `rollisuite.rc.events` (Setup → Reset RolliConnect data, or clear localStorage).
- Audit log persists across reloads and is capped at 60 rows — long runs evict early rows.
- Device auto-registers as Front Desk 1 (rolliworks) on first load; the division wall needs an explicit re-registration at RS Counter.
- Pickup Station lets a wrong code reach the photo step before `confirmPickup` rejects it (known UX gap). Floor Map chips dead-end concierge users at a Restricted `/jobs/:id` (P2).

## E9 seeds (`fixtures/rs.ts`)
- Vendors v-rsc, v-tudor, v-gold (outsource), v-ap (rollishop), v-old (retired). Locations loc-a1, loc-a2, loc-safe, loc-b1 (rolliworks), loc-rs (rollishop).
- POs: po-01 received · po-02 **sent** (receive it to test stock increments: 24-7030-0 ×2, 29-5220-0 ×2 into A1) · po-03 partially received (1 of 3) · po-04 draft (PM safe) · po-05 sent, rollishop. Next PO-26-0026.
- Stock: 13 levels; low/zero rows: pt-02 (1/2), pt-03 (0/2), pt-05 (2/2), pt-07 (1/1), pt-09 (0/1) → 5 LOW flags. Movements 5 (receipt, issue, adjustment, receipt, count). Cycle count cc-01 posted (A1, 1 variance). Next CC-26-0004.
- Templates: 6 keys. Evidence: j-08 (all 4, 100M/330ft, grade B), j-05 (hidden_serial + timing_sheet → gate blocks QC pass until pressure_test + parts_grading), j-16 (hidden_serial + pressure_test 50M/164ft; warranty set satisfied), j-25 (all 4, 2024 history for Naomi). Next ev-13.
- Deliberately not covered: no rollishop stock movement; no `issue` movement created by code (only seed); no PO for a retired vendor; templates not yet consumed by Outbox writers; no evidence on a small_job.

## E10 seeds (`fixtures/companion.ts`)
- Model references: Daytona 116520 (2000–16) / 116500LN (2016–), Sub 16610 (1988–2010) / 126610LN (2010–), Datejust 16234, GMT 116710LN, OP41 124300, BB58 M79030B-0001. "crown for a daytona" → clarifying question; "2010 daytona" → 116520.
- Price evidence for pt-01…pt-13 (e.g. 25-295-C1 used 11× avg $285). Verified: pt-04 (fresh), pt-02 (stale → "re-verify pricing").
- Knowledge cards kc-01…kc-06 (magnetization, WR policy, turnaround, polishing, bracelet stretch, warranty). Routed question rq-ask-01 (Cellini quartz) with open manager task t-ask-01 — answer it from the panel to create kc-07.
- Naomi j-08 E02018 `dueInDays: -100` → ~90 days late → service-debt line.
- Photo labels pl-01 (ev-01), pl-02 (ev-09). Not covered: labels on inspection photos, corrections (none seeded), rollishop routed questions.

## E14 seeds (`fixtures/comms.ts`) — all rolliworks
| id | client | anchor | state | notable |
|---|---|---|---|---|
| cv-01 | Harrison c-01 | job j-01 | **needs reply** (5h), assigned Vienna | cm-05 inbound email `↩ matched RT-CV01-2`, unread; internal note cm-04; template `job_in_progress` outbound |
| cv-02 | Harrison | — | closed | kiosk submission cm-06 |
| cv-03 | Grace c-14 | estimate e-12 | **snoozed** until +2d, role concierge | email reply matched RT-CV03-1 |
| cv-04 | Eleanor c-02 | estimate e-02 | open, no reply needed, Walter | photo submission event + **approval event** (rev 1) mid-thread; last message outbound |
| cv-05 | Naomi c-10 | request rq-03 | needs reply (3d), unassigned | portal inbound, unread |
Not covered: rollishop threads; kiosk/email ingestion (fixtures only); a thread anchored to a request that gets quoted.

## E15 seeds
- Eleanor c-02 · j-11 (awaiting customer approval) · rep-01 `IR-ELEANOR-V1` superseded → rep-02 `IR-ELEANOR-V2` issued (8 grades, notes reference the bezel photo and e-02 rev 2); Outbox `ob-rep-02` short notification with `/rc/report/IR-ELEANOR-V2`. Loop: open `/rc/report/IR-ELEANOR-V1` → forwards to V2 → Approve → j-11 approved, e-02 approved, comms cv-04 gains an approval event.
- To exercise issuing: /jobs/j-13 or j-18 (in_review) → add a photo → Issue inspection report → Outbox + `/rc/report/<token>`.

## E12 seeds
- Tolerances: 3135 (Crit1 <25, Crit2 −1/+10, beat 0.8, amp 200–280, 44 h), 3235/3285 (<12, −2/+2, 0.6, 220–300, 70 h), 4130, MT5402, generic.
- Tests: tt-01 j-16 / w-16 **reject** (matches the seeded QC-fail history; Δ 25, beat 1.1, reserve 41), tt-02 j-08 / w-10 **pass** (Naomi history). Queue at a rolliworks station: j-05 and j-16.
