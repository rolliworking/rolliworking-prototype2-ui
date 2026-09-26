# 10 — NOT KEEPER (explicit do-not-inherit list)

Everything below exists in the prototype **only** to make behaviour visible. Each row: what it is · where · what replaces it in KEEPER.

## Architecture & persistence
| prototype thing | where | replaces with |
|---|---|---|
| Single in-memory mock module (`src/api/client.ts`, ~3,300 lines, `store` copies of fixtures) | all data | real backend exposing the same contract (`05-API-CONTRACT.md`); one client SDK |
| Fixtures (`src/api/fixtures/*`) and their **seed semantics** (relative dates `daysAgo`, punches generated from the wall clock, seeded completions, "today" rows) | everywhere | migrations + real data; a separate test dataset built from `source/SEED-DATA.md` for regression |
| `localStorage` keys: `currentUserId`, `deviceInitialized`, `stationId`, `stations`, `auditLog` (60 cap), `rc.session`, `rc.events` (portal replay), `rc.magicLinks`, `rg.session` | auth, portal, RGTime | server sessions per route-space; DB tables; no client replay |
| `replayRcEvents()` — replays portal writes on load so a refresh "remembers" | RC | none — server persistence |
| `LATENCY_MS` fake latency in `resolve()` | every call | none |
| Auto-registration of the device as `st-01 Front Desk 1` on first load | station setup | explicit registration by a manager |
| Text ids (`j-03`, `c-01`), numbers as pseudo-keys | all | `entities` table (D-C) |
| Base64 photos inside records and audit rows | photos, sign-in | object storage (`06-SEAMS.md` §7) |
| Hard deletes (`deleteJob`, `deleteEstimate`) | jobs, estimates | soft delete + audit |

## Simulated flows (buttons that pretend an outside system acted)
| simulation | where | replaces with |
|---|---|---|
| **"Simulate NFC tap"** picker and `&sim=1` punches | `/rg` | physical tags + hardened endpoint (`06` §5) |
| **"Simulate inbound"** message with token matching | `/inbox` | real inbound email/SMS webhooks (`06` §3) |
| Magic link **shown on screen** at `/rc` (and report tokens in flashes) | RC login, report issue | emailed/SMSed single-use grants (D-E) |
| Scripted **parts assistant** (`partsAssistantReply`) and scripted **Companion** answers | parts chat, companion | real model over M3KE store with citations (`06` §6) |
| "Print" that flips a status (labels, drop-off receipt) | labels, intake | ZPL print queue (`06` §4) |
| Fabricated tracking numbers, labels, `QBO-STUB-…` ids, `pushed_stub / error_stub` states | ship station, accounting | carrier + QBO integrations (`06` §1–2) |
| Outbox rows that never send; "mark sent" | `/intake/outbox` | notification service with delivery status |
| `ADMIN-MARKED` synthetic pickup/ship sessions | sales admin mark | keep the action, but as a real audited override with reason |
| Manual Witschi entry standing in for the timing machine | `/rt` | import (Q49) — manual entry remains as fallback |
| `no_camera` shortcut on bench sign-ins (RT/RW) | `/rt`, `/rw` | real policy per station (camera required or not) |

## Prototype-only conveniences
| convenience | where | replaces with |
|---|---|---|
| **Visible mock credentials** (password = firstname123, PIN 1234, "fill prototype password" button, sign-in hint text) | `/sign-in`, `/rw`, `/rt`, `/rg`, docs | real credential store; no hints |
| "PROTOTYPE — FAKE DATA" banner; `Provisional` amber tags in the UI | RS chrome, many screens | remove; provisional items live in `03-OPEN-QUESTIONS.md` until ruled |
| Link guard in `/rw` (rewrite `/jobs/:id`, block RS paths) | RW shell | authentication boundary; RW screens own their links |
| `.rw-dark` CSS override skin | RW | a proper theme token set (design system), or RW-specific components |
| Shared station session between RS and RW/RT | auth | separate sessions per route-space |
| `both` division literal defaulting to the station's division | MH's account | ruled join or enum (Q4) |
| Division wall on reads only | lists | wall on every read **and write** (Q3) |
| Route tiers enforced in the UI (`TierGate`), six module-level checks | RS | server-side authorization for every endpoint (Q10) |
| Audit log capped at 60 rows in the browser | Setup → Audit log | ledger (D-B) |
| Fixture-only lifecycles: request create/quote, `expired` estimates, `consume` movements never written, discrepancy release missing | requests, estimates, inventory, intake | real functions (Q5, Q6, Q7, Q33) |
| Hard-coded email bodies beside templates | `EMAIL_FOR`, RolliTime, sales | single template renderer (Q32) |
| Legacy `Message` store beside `ConvMessage` | RC messages | one message store (Q39) |
| Kiosk-created clients with empty address | kiosk | address capture at first estimate/intake, or a "prospect" client state |
| `RG_DIVISION_LABEL`, `KIOSK_BRANDS` label constants; brand wordmarks as styled text | kiosk, RG | brand assets + a divisions table with display names |

## What IS inheritable (behaviour, not code)
State machines and guards (`source/STATE-MACHINES.md`), field lists and validations (module specs), the API contract shape (`05`), audit taxonomy (`08`), templates and portal-first rule (`07`), rulings (`02`), and the regression checklist (`09`).
