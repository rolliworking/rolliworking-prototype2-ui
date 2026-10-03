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
| Sent rows that never send; "mark sent" | `/intake/sent` | notification service with delivery status |
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
| Mock TOTP `000000`, mocked RC verification link in the Sent, mock pay page `/pay/:token` | RC block, `PayPage` | real TOTP + email + payment host |
| Cloudflare / Vite dev-server 429s during testing | environment | n/a |

## Added 2026-10-01 (Pickup Station — five gated steps)
| prototype scaffolding | where | replacement |
|---|---|---|
| **Inline mock phone** (`PhoneFrame`) rendering `/rc/pickup/:token` next to the station QR — exists only because the prototype keeps state per tab | `components/sales/pickup/PickupBits.tsx`, `StepVerify.tsx` | nothing: the client's own phone opens the tokened page; the station learns of the confirm via a realtime subscription / poll on the pickup session |
| `onPickupEvent` in-memory listener set (reverse-QR confirm, frames) | `client.ts` Pickup Station v2 section | server push (WebSocket / SSE) on the SO |
| **Simulate scan (dev)** button, **Placeholder shot** shutters, placeholder evidence frames, `?fast=1` 6-second strip — all gated on `import.meta.env.DEV` | `PickupBits.tsx`, `StepVerify.tsx`, `EvidenceStrip.tsx` | none (absent in production builds) |
| `MOCK_OCR_MAY_PASS = true` — a MOCK serial read (placeholder photo / model down) may pass the gate in the prototype | `client.ts` | **false**: a mock result can never release a watch; only a manager override can |
| `sendSms` Vonage MOCK receipt + Outbox row | `api/telephony.ts` | Vonage Messages API behind the same seam |
| `pickupEvidenceSweep()` runs when a station reads the queue / session (90 s rule) | `client.ts` | scheduled job server-side; Hitlist pin via the same key `pickup-evidence:<so>` |
| Frames / ID photo stored as data URLs on the SO with `retention` dates (not enforced) | `types.ts PickupSession.retention` | object storage with lifecycle rules (frames 90 d, proxy ID 30 d, summary rows permanent) |

## Added 2026-10-01 (Client portal — passwordless + LINK tier)
| prototype scaffolding | where | replacement |
|---|---|---|
| OTP / magic-link challenges stored in localStorage with the **plain code** (`rollisuite.rc.challenges`); "Prototype: fill the code" dev button | `client.ts` RolliConnect accounts, `rc/RcAuthBits.tsx DevFillCode` | Supabase Auth `signInWithOtp` (hashed secrets server-side, real email); no dev button in production builds |
| Link tokens are random ids (`lnk-…`), not signed; expiry enforced only for revoke / decided state | `client.ts ClientLink` | signed, scoped tokens with per-type `expiresAt`, verified server-side |
| Touch ID: local challenge, credential id per device, no signature verification | `api/webauthn.ts` | server-issued challenge + assertion verification (py-webauthn), action-bound step-up grant |
| Step-up grants in localStorage (`rollisuite.rc.stepups`) | `client.ts requireStepUp` | server-side grant bound to `{session, action, nonce}`, consumed atomically |

## Added 2026-10-02 (v2 pass — rw.com emulator · Inbox v2 · Request Builder · Concierge · dots · calls)
| prototype scaffolding | where | replacement |
|---|---|---|
| **`/rwcom` as an RS screen** + the `/www` public mount, device frame (Phone 390×844 / Desktop), entity switch, **Instrumentation panel** + `[wm8]` console mirror (D-458) | `pages/RwcomPage.tsx`, `components/rwcom/RwcomDev.tsx` | the real rolliworks.com; only `submitWebRequest` (the POST contract) and the behaviours in `modules/rwcom-emulator.md` are KEEPER |
| `watchm8.ts` engine mock (deterministic from photo bytes), `REFS` / `MODELS` / `QUESTION_TREE` tables, in-memory `Claim` store | `src/api/watchm8.ts`, `components/rwcom/rwState.ts` | the WatchM8 service + a persisted `claim` table |
| TopBar **Simulate call** dev menu, timed scenarios (`simulateIncoming`, `simulateVoicemailUnknown`), seeded recordings as links | `api/telephony.ts`, `components/layout/SimulateCallMenu` | Vonage webhook receiver; recordings referenced in Vonage |
| `sendSms` MOCK receipt (`vonage-mock <id>`) written as a Sent row | `api/telephony.ts`, `pickupResendCode` | Vonage Messages API + delivery receipt |
| `seedSwoVolume` — 10 synthetic SWOs per stage per lane (`Swo.synth`, parent `j-01`), excluded from chips and the one-lane guard | `client.ts` SWO block | none (board density came from real rows) |
| `simulateShipmentDelivered` on SWO hub shipments | `client.ts` SWO HUBS | carrier tracking webhook |
| `CameraLookup` (`BarcodeDetector`, pad Concierge ASSIGN) | `components/concierge/CameraLookup.tsx` | optional — wedge scanner is the contract |
| Inbox context in `sessionStorage`, `INBOX_REFRESH_EVENT` / `INBOX_DRAFT_EVENT` / `BUBBLE_COMPOSE_EVENT` window events, `MESSAGE_EVENT` + 2 s poll for the bubble banner | `api/inboxContext.ts`, `InboxPage.tsx`, `MessageBubble.tsx` | UI state may stay client-side; live updates via server push |
| Legacy assignment plumbing kept exported but unreachable: `assignConversation`, `getStaffInboxRows`, `getColleagueInbox`, `threadsNeedingReplyForUser`; `/messages/all` redirect; `/today` thread rows from `assignedTo` | `client.ts` | delete (D-442, D-459) |
| Access overrides / change log / disabled users in `localStorage` (`rollisuite.access.overrides`, `rollisuite.access.log`); new-user password `firstname123` / PIN 1234 | `client.ts` Access control + G6 | server tables + the auth provider |
| `?fast=1`, **Simulate scan (dev)**, placeholder shutters, `pickupDevQrPayload`, inline mock phone, `MOCK_OCR_MAY_PASS`, `SalesOrder.pickupDemo` seed switch | Pickup Station (see the 2026-10-01 table) | none |
| Rate card + request lines in memory (`api/requestBuilder.ts`), `liveRateSync` recomputed on every read | `requestBuilder.ts`, `client.ts` builder block | `rate_card_row` table with versions; stored rate snapshot per quote |
| Deterministic `AskDraft` fallback (`source: 'local'`) and `localSummaryFields` when Claude is down | `client.ts askContext`, `ai.ts` | keep the fallback as behaviour; the model choice is not KEEPER |
| Hitlist system pins recomputed by sweeps on every read (`autoPoSweepSync`, `approvalsToSendSweepSync`, `pickupEvidenceSweep`) | `client.ts` tail | scheduled server jobs writing the same pin keys |
| `?rig=kiosk\|bench` query deciding `controlled` shots | `pages/rw/RwInspectPage.tsx`, `inspectionLabels.isControlledStation` | the station record (`station_camera`, device type) |
| `Station.cameraRole` chosen in a sheet per browser (`CameraSettings`) | `components/sales/pickup/PickupBits.tsx` | station record + registered camera map |

## Added 2026-10-02 (Bonus targets)

| prototype piece | where | Keeper replacement |
|---|---|---|
| **"As of" time-travel control** (`AsOfControl`, `getAsOf/setAsOf`, localStorage `rollisuite.bonus.asOf`, quick picks Oct 2 · 20 · 25 · Nov 1) | `/analytics/bonuses`, `components/bonus/BonusBits.tsx` | none — the as-of date is always today; drop the control and the event |
| Seeded monthly totals spread across Mon–Fri dates (`MONTHLY`, `MONTHLY_TECH`, `spreadMoney/spreadCount`) | `api/bonus.ts` | the real `v_bonus_*` SQL views (`SELECT date, amount, ref …`) behind `viewRows()` |
| Plans / early-close / paid maps in memory | `api/bonus.ts` | `bonus_plan`, `bonus_period_close`, `bonus_payment` tables; results stay derived |
| `OPS_MANAGER_USER_ID = 'u-vienna'` constant for the analytics allow-list | `api/bonus.ts`, `config/navigation.ts NavItem.only` | a role / permission (`bonus.analytics`) in Access control |

## Added 2026-10-02 (Safes vs insurance)

| prototype piece | where | Keeper replacement |
|---|---|---|
| `BRACELET_CONFIG` regex table (President · Jubilee · Oyster · Titanium · strap → $) and `REF_TYPICAL` reference → $ map | `api/safes.ts` | `ref_bracelet_value` / `ref_typical_value` tables (or the reference service); live comps (D-085) already win when present |
| `seedAssetValues` stamping `Job.declaredValue` / `Job.braceletValue` (+ synthetic arrived inbound shipments `1Z<job#>SEED`) | `api/client.ts` | the intake form / inbound label capture those two fields |
| In-memory `containers` + `parents` maps; `registerDaySweep(getSafesBoardSync)` to materialise pins before `/today` reads | `api/safes.ts` | `container`, `location_node` tables; a move trigger / service evaluates the destination safe and upserts the standing hitlist items |
| `OPS_SHORT = 'Vienna'`, `canSeeSafes` user-id allow-list | `api/safes.ts` | a permission (`safes.analytics`) in Access control |

