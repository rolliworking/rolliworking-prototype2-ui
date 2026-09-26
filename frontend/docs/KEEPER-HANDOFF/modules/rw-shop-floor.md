# Module — RW Shop Floor (two-lane map, part dots, drag, finish gate) · post-E16

## Screens & layout intent
- **`/rw/floor`** (`pages/rw/RwFloorPage.tsx`): two horizontal lanes — **Head lane** (Pre-approval → Pre-queue → WM Bench 1/2/3 → Into safe → Safe (await band)) and **Band lane** (Pre-queue → Refinishing → Polish → Into safe → Safe (await head)) — converging on the **shared** stations **Final assembly → Finished**. Every station is a column with a count; every *part* of every open job in the room is a **dot**.
- Filters: by tech (custody) and by job kind. Tapping a dot opens the **part history** (every move: at, by, from → to, status, via, note).
- **Work queue** (`/rw/queue`, `RwWorkQueuePage.tsx`): one row per open job, oldest first, overdue flag, "client replied" flag (simulated), per-part done/station chips.

## Vocabulary
- **Part** = `JobComponent` (head / band / case) extended with a physical position: `station: RwStationKey`, `partStatus: not_started | in_progress | waiting | reunited | fulfilled`, `custodyTech`, `history: PartMove[]`. Parts are **coloured by part, never by status** (head blue `#2563eb`, case violet `#9333ea`, band green `#16a34a`); status is shown by fill (hollow = not started / in progress).
- **Lane of a part**: `band → band lane`, `head` and `case → head lane`. Shared stations accept any part.

## Rules (code is truth)
- **Placement is derived when unset** (`derivePlacement`): job before approval → `pre_approval/not_started`; `approved` → lane pre-queue; `in_service` → `wm_bench_1` or `refinish` (in progress); component completed → `safe_await_*` (waiting); `testing` → `final_assembly/reunited`; `ready_to_ship|closed` → `finished/fulfilled`. Once a part has been moved, its stored `station` wins.
- **Drag** (`movePart(jobId, key, to, via='drag')`): rejected if the target lane ≠ part lane (shared allowed). Status is set from the target station (`statusForStation`): finished → fulfilled; final_assembly → reunited; any safe → waiting; pre-* → not_started; else in_progress. Each move appends a `PartMove` and a job audit stamp.
- **Auto-reunification**: when the last part of an `in_service` job (no hold) lands on Final assembly, every part is marked completed (`completedBy = custodyTech ?? actor`) and the job transitions `to_testing`.
- **Finish gate** (`finishGate/finishBlockers`): a job may only be Finished when every part is `waiting | reunited | fulfilled`; blockers name the part and the station it is still out at. `finishJob` also enforces the **client-request QC gate** (see `client-requests.md`) when the job is in `testing`, then moves parts to `finished` and transitions `qc_pass → ready_to_ship`.
- Room scope = jobs of the session division that are not `closed` (`roomJobs`).

## Client functions used
`getShopFloor(filter?)`, `movePart`, `markReunited`, `getPartHistory`, `finishGate`, `finishJob`, `getWorkQueue`, `simulateClientReply` (demo), `RW_STATIONS`, `PART_LABELS`.

## State
Module-level `rw18` object (picks, recent part choices, "replied" set, scan session, station memory) — in-memory only. Part position lives on the job component.

## Drift flags
- `⚠ DRIFT` Only WM Bench 1 is chosen for a freshly started head (bulk assign spreads by tech index modulo 3). Real bench assignment should come from the bench pad's station identity (see `rw-bench-pad.md`).
- `⚠ DRIFT` "Client replied" on the work queue is a simulation button (`simulateClientReply`), not a comms-hub derivation.
- `⚠ DRIFT` Part history is embedded on the job component; KEEPER should make `part_moves` its own append-only table (see `04`).
