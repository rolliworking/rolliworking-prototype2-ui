# Module — RW Bench Pad `/rw/bench` (one kiosked iPad per watchmaker bench) · post-E16

## Screens & layout intent
- **Lock screen** (`BenchLock.tsx`): staff cards of the station's division (bench tier first), a 4-digit **keypad** that auto-submits on the 4th digit, error hint on a wrong PIN. The header (bench name · "locked" · live clock · gear) stays visible even here.
- **Board** (`RwBenchPage.tsx`, sections in order): **In progress** · **Needs attention** · **Bands & splits** · **Outsourced components** · **Messages** · **Completed this month** · **Goals**. Each job card: job#, watch, ref, kind, priority, **Message** button, part-location chips (part · station · custody tech), client-request list; attention cards add the stuck / late flags.
- **Goals**: pace-line bar for the current month (actual/goal, marker at "where on-track would be today", ± vs pace, day D/M, by-type counts) + **6 month tiles** (oldest → newest) each "Mon · actual/goal" with a green check (hit) or red X (missed · −shortfall) of equal weight; tap → by-week bars + by-component-type rows + plain "Goal hit/missed" line; tap again collapses.
- **Settings sheet** (`BenchSettings.tsx`): only via **long-press (600 ms)** on the gear → supervisor PIN → bench name, idle timeout (1/5/10/20/30 or free 1–120), "Simulate API unreachable" (prototype only) → **Save to this device**.
- Skin: `bench-kiosk` — no pure white, muted contrast, text selection disabled, designed for a screen lit 10 h/day.

## Rules (code is truth)
- **Device = station, PIN = person.** No password step: `benchPinIn(userId, pin)` checks the PIN against the user, sets the session user, audits `sign_in` (method `pin_switch`, station = bench name). It **never touches the network path** so an unreachable API cannot lock a tech out.
- **Board scope** (`getBenchBoard(userId)`): room jobs (division, not closed, not `ready_to_ship`) where the tech is an assignee **or** holds custody of any part.
  - In progress = `in_service | approved` and no active hold.
  - **Stuck** = `in_service`, no hold, and **no scan movement ≥ `STUCK_WORKING_DAYS` (4) working days** (Mon–Fri) since the latest of any part move / transition / creation. **Late** = `dueAt` in the past. Needs attention = stuck ∪ late (card appears in both sections).
  - Bands & splits = jobs with >1 part (not `approved`): state `reunited` (all at Final assembly/Finished) · `waiting_band` (head in Safe (await band)) · `waiting_head` (band in Safe (await head)) · `split` (parts apart, working); shows "band completed by X · date" from the band component (or its last waiting/reunited move).
  - Outsourced = my jobs with an active `outsource` hold: vendor parsed from the reason's `(…)`, days out from `placedAt`.
  - Completed this month = components with `completedBy = me` this month (live list) — the **count** adds `currentMonthBase` (work booked before the prototype snapshot).
  - **Goals**: unit = components completed. Goal per tech from `techGoals` (Rosa 18, MM 20, MH 16, Walter 24 — placeholder). History = `goalHistorySeeds` (6 months relative to today; Rosa: 19✓ 11✗ 20✓ 18✓ 17✗ 21✓ vs 18). `paceTarget = round(goal × day/daysInMonth)`. Own numbers only; nothing compares techs.
- **Kiosk contract**: `useIdle(minutes)` — any pointer/touch/key resets a timer; expiry re-locks (sheets closed) with the last tech pre-selected; PIN returns to the same board. Manual lock button in the header. **Offline**: any failed load sets the "reconnecting… showing last data" banner and retries every 4 s; the last successful board is cached per device (`rollisuite.bench.lastBoard.<userId>`) so a cold start while offline still shows data ("saved HH:MM"). **No external navigation**: the page has no outbound anchors; the RW shell blocks RS routes. **Settings** persist in `localStorage` (`rollisuite.bench.settings`); saving audits `kiosk`; supervisor PIN = any manager-tier user's PIN.
- **Messages** section = threads the tech was mentioned in / re-notified on (see `job-messages.md`); unread badge in the header; opening a thread marks it read for this person.

## Client functions used
`getBenchBoard`, `benchPinIn`, `getBenchSettings`, `saveBenchSettings`, `verifySupervisorPin`, `setKioskOffline`, `cacheBenchBoard`, `readCachedBenchBoard`, `STUCK_WORKING_DAYS`, `getJobThreads`, `postJobMessage`, `markJobThreadRead`, `staffForMention`.

## Drift flags
- `⚠ DRIFT` Per-device settings, last-board cache and the offline flag live in `localStorage`. **Ruling (MH 2026-09-26):** in KEEPER the bench/device identity is a **server-side station record** (a kiosked iPad IS a station) so a wiped or replaced iPad re-adopts its bench identity; idle timeout is a station attribute.
- `⚠ DRIFT` "Simulate API unreachable" flips a global flag that makes *every* mocked call reject — prototype scaffolding only (`10-NOT-KEEPER.md`).
- `⚠ DRIFT` Goal history and this-month base are seeded numbers, not derived from completions; KEEPER computes months from the components ledger and stores the monthly goal per tech (`tech_goals`).
- `⚠ DRIFT` Stuck threshold is one global default; per-job-type thresholds are amber (Q82).
- `⚠ DRIFT` Idle re-lock is not audited; PIN in/out is.
