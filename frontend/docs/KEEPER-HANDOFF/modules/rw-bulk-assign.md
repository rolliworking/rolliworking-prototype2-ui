# Module — RW Bulk Assign + Station Scanner + WM Room (scan-driven custody) · post-E16

## Screens & layout intent
- **`/rw/bulk`** (manager only, `RwBulkAssignPage.tsx`): one big scan field. Scan a **tech code** `TECH-<short>` (e.g. `TECH-ROSA`) to open a session, then scan watch labels one after another. A live list shows each row (time, job#, watch, part) with an **Undo** on the courtesy email while it is still in the Outbox window.
- **`/rw/station`** (`RwStationScanPage.tsx`): pick the physical station (any `RwStationKey`), then scan labels — "parts move like registered mail". The last station is remembered for the device (`getStationMemory`).
- **`/rw/wm`** (Watchmaker Room, `RwWmPage.tsx`): full-screen bench mode for the signed-in tech: assigned job cards (job#, watch, kind, status pill, hold pill, part-location chips, client requests, **Message** button), "Request part" inline form, "→ safe" per part, and a right-hand **Send a part by scan** panel (mode Into safe / Refinishing). Header shows the tech, a live clock, PIN switch, and the **Messages** unread badge (post-E16, see `job-messages.md`).

## Rules
- **Tech code** `^TECH-(.+)$` resolved case-insensitively against `users.shortName`. Scanning a label without an active tech → error "Scan a TECH code first".
- **Label forms**: plain job/estimate label → the tech's natural part (watchmaker → head; others → first non-head part); `BAND-<label>` or `…|B` = **band-only** → if the job has no `B` department the workflow gains `B` and a bracelet component is created on the fly (stamped).
- **Bulk assign effects** (`scanLabelAssign`): hold → rejected; tech appended to `assignees`; `approved` job auto-transitions `start_service → in_service`; part moves to the tech's bench (`wm_bench_N` by watchmaker index, band → `refinish`) with `custodyTech`, via `bulk_assign`; a **"Work has started"** courtesy email is queued to the Outbox; the row keeps `outboxId` so **Undo** (`undoOutbox`) can withdraw it within `OUTBOX_UNDO_WINDOW_MIN = 30` minutes.
- **Station scan** (`stationScan(station, label)`): picks the part matching the station's lane (band lane → band; head lane → head, else case; shared → first) and moves it `via 'station'`. Same lane/finish-gate rules as drag.
- **WM room**: `getWmRoom(userId)` = room jobs where the tech is an assignee (not `ready_to_ship`). `sendPartByScan(label, 'safe'|'refinish')` moves the head (or, for refinishing, the case/bracelet) — refinishing a head-only job is rejected with a message. `requestPartSimple` creates a `pending` parts request (`source 'wm'`), matching catalog by exact name/part#.
- Every label scan pops the **client-request modal** when the job has open requests (`clientRequestAlert`, via `wm_scan`) — even when the scan itself was rejected.

## Client functions used
`parseTechCode`, `getScanSession`, `scanTech`, `scanLabelAssign`, `undoOutbox`, `getQueuedOutbox`, `stationScan`, `getStationMemory`, `getWmRoom`, `sendPartByScan`, `requestPartSimple`, `movePart`, `clientRequestAlert`, `ackClientRequests`, `getMessageInbox`, `markJobThreadRead`.

## Drift flags
- `⚠ DRIFT` Undo withdraws the Outbox row silently; KEEPER must respect the 30-minute window server-side and audit the withdrawal.
- `⚠ DRIFT` Station memory and the scan session are per browser tab, not per registered device.
- `⚠ DRIFT` Bench number for a tech is `index % 3` — in KEEPER the bench pad's station identity should set custody station.
