# SPEC — TIME CLOCK (replaces RGTime) — **BUILT** 2026-10-03 (MH brief · implements KEEPER **D-426** time clock replaces RGTime + the pad — filed in `DECISIONS.md` as D-498 · D-499)

**Status: BUILT** — `pages/time/TimeClockPage.tsx` (`/time`), `pages/time/TimeClockPad.tsx` (`/time/pad`), `components/time/{TimeBits,TimeManagerPanels}.tsx`, `client.ts` Time Clock block (`rgPadPunch`, `rgKioskPunch`, `rgSyncQueue`, `rgGetFlags`, `rgCorrectPunch`, `rgAddPunch`, `rgSaveSettings`, `migrateRg`), `api/webauthn.ts` (Touch ID), `App.tsx` `/rg*` redirects. Sidebar **Time clock** (`nav-time`), Setup card `setup-time-card`.

**One paragraph.** One time clock for the whole shop: a desktop page for who's in, the week grid, flags with append-only corrections, payroll CSV and settings (geofence + clock points), and one pad screen that serves both the wall iPad (lock → staff cards → Touch ID or PIN → big IN / OUT) and an NFC tag tap (`?station=` from the tag; a remembered device gets a one-button confirm). RGTime is retired: every `/rg*` URL redirects here with its query string so printed tags keep working; punches recorded before the first Time Clock load are flagged `source: 'rgtime'` and shown with an `rgtime` chip. Offline punches queue on the device with the true time; the geofence flags, never rejects.

## Model (`types.ts`)
- `Punch { id, userId, kind: in | out, at, stationId?, division, source?: PunchSource, via?: PunchSource, method?: PunchMethod, flags?: PunchFlag[], geo?: { lat, lng, distanceM } | null, recordedAt?, queued?, correctedBy?, correctionOf?, reason? }`.
- `PunchSource = nfc | kiosk | manager | seed | rgtime | pad`; `PunchMethod = tap | pin | touch_id | manager`; flags `offsite`, `synced_late`, `missed_out`, `corrected`, `simulated`.
- `RgSettings { shopLat, shopLng, radiusM (150), simulateOffsite, simulateOffline }` (placeholder Manhattan coordinates — MH to set the real shop).
- `Station.clockPoint` (Setup → Organisation → Stations) = the pad may lock to it; legacy `NfcTag` ids (`door-main`, `tag-fd-rw`, `tag-rs-counter`) still resolve.

## Rules
1. **RGTime retired (D-498)**: `/rg` and `/rg/kiosk` → `/time/pad`; `/rg/clock?station=X&sim=1` → `/time/pad?station=X&sim=1` (`data-mode=tap`); `/rg/manager` → `/time`; `/rg/week` → `/time?tab=week`. Old `?tag=` param accepted. Unknown station → `rg-clock-unknown`.
2. **Migration**: `TIME_MIGRATED_AT` is stamped on first load (`localStorage rollisuite.time.migratedAt`); every earlier punch becomes `source: 'rgtime'` with its origin in `via`; the board shows an `rgtime` chip on the last punch. New pad punches: `source 'pad'`, `method pin | touch_id`; tag taps `source 'nfc'`, `method tap`.
3. **Pad (D-499)**: first visit on a wall iPad → `rg-kiosk-lock` (station select from clock points + any manager PIN) → `rg-kiosk-staff` cards → `rg-pad-auth` (Touch ID button only when a platform authenticator is enrolled for that user on this device; otherwise PIN pad) → `rg-kiosk-done` (`data-kind=in|out`), reset after 6 s. `rg-touch-enrol` offers enrolment when a platform authenticator exists. Footer: back to `/time`, change station, dev toggles simulate offsite / offline.
4. **NFC tap**: unknown device → cards + PIN once (binds the device, `rollisuite.rg.session`); remembered device → `rg-clock-page` with one `rg-clock-confirm` (in/out toggles automatically); `rg-sign-in-back` forgets the device.
5. **Offline**: punches are queued with the true `at`, `recordedAt` later; `rgSyncQueue` replays in order and flags `synced_late` (D-404 pattern). Banner "reconnecting…" while queued.
6. **Geofence**: distance from `shopLat/lng` > `radiusM` → flag `offsite`; never a rejection. Managers resolve flags on `/time?tab=flags`.
7. **Desktop `/time`**: tabs Who's in (`time-today-board` rows with presence + hours; the same facts feed the directory presence dots) · Week (`rg-week-grid`, division select, cell → day detail → `rg-correct-<punch>` / `rg-add-punch` with reason, append-only) · Flags (`rg-flags`, resolve missed clock-outs) · Export (payroll CSV) · Settings (`rg-set-lat|lng|radius`, clock points list). **Concierge tier sees only Who's in + Week = own week** (`time-my-week`); corrections, flags, export, settings are manager tier.
8. **Touch ID (`api/webauthn.ts`)**: WebAuthn platform authenticator, RP id = host, secure context only, user-gesture only, credential id per device in `localStorage rollisuite.rw.webauthn`. PROTOTYPE: local random challenge, **no signature verification** — Keeper issues the challenge server-side and verifies.

## Screens / test ids
`time-clock-page`, `rg-mgr-tab-today|week|flags|export|settings`, `rg-week-division`, `time-row-<userId>` (`data-on`, `data-presence`), `time-presence-<id>`, `time-hours-<id>`, `rg-myweek-total`, `rg-week-cell-<id>-<date>`, `rg-day-detail`, `rg-correction-form`, `rg-flag-row-*`, `rg-resolve-<punch>`, `rg-export-download`, `rg-settings`, `rg-station-<id>` (`data-kind=tag|station`), `time-open-pad`; pad `rg-kiosk[data-mode]`, `rg-kiosk-lock`, `rg-kiosk-station-select`, `rg-kiosk-lock-pin`, `rg-kiosk-card-<userId>`, `rg-touch-id`, `rg-kiosk-pin-key-<n>`, `rg-kiosk-done`, `rg-clock-confirm`, `rg-sim-offsite`, `rg-sim-offline`.

## Seeds
5 staff × 2 weeks of punches incl. offsite, synced-late, a missed clock-out, one correction, open punches today; clock points st-01 · st-04 · st-rs; legacy tags door-main · tag-fd-rw · tag-rs-counter.

## Open for MH
- Real shop latitude / longitude and radius.
- Payroll export format (CSV columns are the prototype's).
- Whether a wall pad needs a per-shift re-lock (today: locked once per device).
- Legacy RGTime code (`/rg` pages, `RG_*` helpers) can be pruned once the redirects are confirmed on the real tags (P2).
