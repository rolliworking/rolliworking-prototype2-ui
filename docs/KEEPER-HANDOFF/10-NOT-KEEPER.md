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
| **"Simulate client reply"** (work queue), **"Simulate carrier scan"** (inbound shipping), **"simulate client parts decision"** (pad Review) | `/rw/queue`, `/shipping/inbound`, `/rw/pad` | comms-hub derivation; Parcel Pro tracking webhooks (`06` §1b); portal approve/decline of the parts request (Q77) |
| **"Simulate API unreachable"** toggle in Bench settings — flips a global flag that makes every mocked call reject | `/rw/bench` settings | real network failure handling (service worker / retry); the banner + last-data behaviour IS the spec, the toggle is not |
| **Seeded routing at load** — fixture job messages create hit-list pins when the module loads | `/today` pins for MM and Vienna | pins are created only by the write path |
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

## Post-E16 prototype scaffolding (do not inherit)
| item | where | replaces with |
|---|---|---|
| Photos as **browser object URLs** (`URL.createObjectURL`) on job photos and message photos — vanish on reload | pad camera, message composer | blob storage keyed to watch + job + slot (`06` §7/§10) |
| **picsum.photos** seed images for job/inspection/message photos | fixtures `rw.ts`, `bench.ts` | real captured photos |
| `localStorage` **bench settings**, **last-board cache**, **offline flag** (`rollisuite.bench.*`, `rollisuite.kiosk.offline`) | `/rw/bench` | server-side station record + service worker (ruling 2026-09-26) |
| **Goal history seeds** (`goalHistorySeeds`, `currentMonthBase`) and fixture **tech goals** | Bench Pad Goals | computed from the components ledger + `tech_goal` table |
| `caliberOf` reference-prefix table | pad parts composer | real reference catalog (Q79) |
| Mock Parcel Pro: random tracking numbers, formula cost, 10-state ZIP table, `labels.parcelpro.mock` URLs | `carriers/parcelpro.ts` | real adapter, same signatures |
| Bench number = tech index modulo 3; single global stuck threshold | bulk assign, bench pad | station identity from the device; per-type threshold if ruled (Q82) |
| `TECH-<short>` codes typed into a keyboard-wedge field | `/rw/bulk` | printed tech badges with the same payload — the format IS inheritable |
| **MOCK PAYMENT PAGE** `/pay/:token` — fake hosted Intuit page, fake card block, partial payments recorded straight into the SO ledger | `pages/PayPage.tsx`, `payViaLink` | QuickBooks Payments hosted invoice link; webhook posts the payment to the SO |
| Legacy `job.notes` still exported (`addJobNote`) though no screen writes it | `client.ts` | remove; messages are the notes |

## What IS inheritable (behaviour, not code)
State machines and guards (`source/STATE-MACHINES.md`), field lists and validations (module specs), the API contract shape (`05`), audit taxonomy (`08`), templates and portal-first rule (`07`), rulings (`02`), and the regression checklist (`09`).

## Added 2026-09-29 (role landings · corrections · View-as · reception · integrations census sessions)
| prototype scaffolding | where | replacement |
|---|---|---|
| **Device-type heuristic** (touch + width ≤ 1366) and **`?device=ipad\|desktop` session override** | `src/config/device.ts`, `ChooseViewPage`, `SignInPage` | device type from the registered station record (D-384); a desktop browser narrowed to tablet width must NOT become a pad; the Choose-a-view screen keys off the same station field |
| `?reception=1\|0` query override (`sessionStorage receptionOverride`) | `client.ts isReceptionMode` | station record flag only |
| View-as in `sessionStorage` (`viewAsUserId`), owner check against the constant `OWNER_USER_ID` | `client.ts`, `ViewAs.tsx` | server-side impersonation on the session; owner flag on the user record |
| "Simulate" buttons: Simulate call (known/unknown/missed), Simulate tracking event, Simulate client parts decision, Simulate client reply (work queue), Simulate offline (bench) | `CallPop.tsx`, `InboundShippingPage`, pad Review, `RwWorkQueuePage`, bench settings | webhooks / real clients |
| Demo toggles: `API_MODE` banner flip, `KIOSK_OFFLINE`, RG `simulateOffsite/simulateOffline` | `config.ts`, `client.ts` | none |
| Mock object-URL / data-URL photos and `picsum.photos` seed images (inbox, kiosk, pad) | `hitlist.ts`, fixtures | object storage |
| `setTimeout` call state (intercom ringing → connected; `latency()` in Parcel Pro; `resolve()` LATENCY_MS) | `intercom.ts`, `parcelpro.ts`, `client.ts` | real transport |
| `localStorage` session state (`currentUserId`, stations registry, audit log cap 60, `rollisuite.api.token`, RG punches, RC accounts) | `client.ts KEYS`, `realClient.ts`, RG/RC blocks | server sessions + DB |
| Seeded call logs, bypass events, asset values (`seedAssetValues`), zero-balance rows | `client.ts` | none |
| Browser print dialog (`window.print()`) for SO print/PDF, appraisal, inspection form, RC estimate; **label "printing" = mock printer list + `setLabelPrinted`** | `LabelBits.tsx`, print views | printer agent / PDF service |
| Mock TOTP `000000`, mocked RC verification link in the Outbox, mock pay page `/pay/:token` | RC block, `PayPage` | real TOTP + email + payment host |
| Cloudflare / Vite dev-server 429s during testing | environment | n/a |
