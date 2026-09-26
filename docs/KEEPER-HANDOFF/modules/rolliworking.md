# Module — RolliWorking `/rw` (standalone workshop app)

## Purpose and boundary (ruling, locked)
RW is the bench's own application and an **access boundary**: in KEEPER bench tiers authenticate into RW only and cannot reach RS at all; RS keeps embedded workshop views ("RW-mini") for managers. The prototype shares one origin and one station session and enforces the boundary by intercepting links (`/jobs/:id` → `/rw/jobs/:id`; any other RS path → inline "not reachable from RolliWorking" notice). **KEEPER replaces link interception with authentication.**

## Screens & layout intent
Dark, dense, tablet-friendly shell ("RolliWorking", amber accent). Header nav: Bench · Jobs · Parts · QC (manager) · Supervisor (manager) · Floor · Evidence · My today; user + duty label; sign out. A dark skin (`.rw-dark`) restyles the re-homed RS components without code changes.
- **Sign-in** inside the shell: cards of the station division's staff; password on the first sign-in of the day, PIN after; no camera (audited `no_camera`).
- **Bench** `/rw` = RS `/bench` (see workshop.md) incl. inline component-done buttons.
- **Jobs lookup** `/rw/jobs`: scope banner ("<Division> jobs only · no dollar amounts anywhere in RolliWorking"), search (number, client, ref, serial, model, tech), rows with kind/workflow/status/hold/priority/due/assignees.
- **Bench job page** `/rw/jobs/:id`: legal actions + Parts request; Watch; **Work lines without Rate/Ext/Total** ("Amounts hidden in RolliWorking"); Components; Inspection; Notes; Service evidence; Timing tests; Photos; Parts requests; Shop time; Timeline + linked tasks; Assignees; Holds. **Omitted on purpose:** invoice/SO, estimate link, Client 360 link, delete, pin-to-hit-list, owner change (Q62).
- **Parts** `/rw/parts`: my requests (status), start a request from one of my bench jobs → chat assistant modal, shop-wide pending list.
- **QC lane** `/rw/qc` (manager): jobs in testing with `evidence n/required`; **Pass** disabled until required slots are filed (same gate as `qc_pass`); **Fail…** requires a reason (→ `qc_fail`, client notified).
- **Evidence capture** `/rw/evidence`: scan/enter the watch label → job → four QC slots; or pick from the testing queue with slot counts.
- **Floor (two-lane, legacy style)** `/rw/floor` — amber, MH to rule vs the nine-lane RS map (Q57): **Head lane** (workflow has W, or none): Intake → Review → Movement bench. **Band lane** (workflow has B/P/PM): Intake → Review → Band bench → Polish (in-service polish-only). Both converge on **Final assembly** (= testing). **Into safe** off-ramp: Awaiting components · On hold · Awaiting approval · Ready — in safe. Chips carry part-colored dots (W indigo · B amber · P teal · PM rose) and the first assignee. Division-scoped.
- **My today** `/rw/today` = RS `/today`.

## Rules
- **Hide-money** (amber default pending MH): `MoneyContext=false` in the shell; `LinesTable` drops price columns. No `$` is rendered anywhere under `/rw` (verified by test).
- Tier: QC + Supervisor need manager tier (restricted notice otherwise); everything else all staff. Concierge presence in RW is unruled (Q59).
- Division: lookup, floor, evidence queue, pull-next are session-division scoped; supervisor board is not (`⚠ DRIFT`).

## Data
No new persisted entities; `getRwFloorMap()` projection (`source/DATA-MODEL.md` §21).

## Behaviours discovered during build
- Re-homing exposed that RS components hard-code RS paths → the link guard. In KEEPER, components receive a route base or RW has its own screens.
- The RS Bench (RW-mini) shows the same inline "done" buttons because it is the same component (Q66).
