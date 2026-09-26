# 03 — OPEN QUESTIONS · MH VERDICT SHEET

How to use: answer each line in the **Verdict** column (yes / no / other + one sentence). Numbers match `source/SESSION-LOG.md` (the running list, Q1–Q66). Columns: **Question** (plain language) · **Where it shows** (UI) · **Prototype does today** (the provisional choice) · **If yes / if no / other** (what changes in KEEPER). Items already ruled since being listed are marked **RULED** and kept for completeness.

| # | Question | Where it shows | Prototype does today | If yes / if no / other | Verdict |
|---|---|---|---|---|---|
| 1 | One shared number sequence for jobs and estimates, or two with different prefixes? | job/estimate numbers `E0xxxx` everywhere | two counters, same `E` prefix | yes → one sequence table; no → prefix change (e.g. `J`/`E`) | |
| 2 | Should packages, estimates, sales orders, parts requests, requests, messages carry a division? | any list at a rollishop station | only Job/Task/Pin/Station/User/Conversation/kiosk Request carry it; others visible everywhere | yes → add `division` to all, wall every list; no → keep wall on jobs only | |
| 3 | Must writes be division-checked (a rollishop session editing a rolliworks job by URL)? | job page via URL | reads walled, writes not | yes → server check on every write (recommended); no → document as trusted staff | |
| 4 | Is `both` a real user-division value or a join table? | staff cards, RGTime tags | `division: 'both'` literal | yes → keep enum; no → `user_division` rows | |
| 5 | How does a package leave `discrepancy_hold`? | `/today` discrepancy rows, Intake inspection | no exit function | define exits: re-inspect → received; return to client; write-off | |
| 6 | Who creates and quotes a service request (staff)? | Client 360 requests, `/requests` | only seed + kiosk create; `quoted` seed-only | yes → `createRequest` (Request quick action) + auto-quote when an estimate links | |
| 7 | Expire estimates automatically on `validUntil`? | estimate status | never expires | yes → nightly job; no → drop `expired` | |
| 8 | Should staff-recorded estimate approval advance a linked job like portal approval does? | estimate Approve button | only portal does | yes → symmetric | |
| 9 | (see SESSION-LOG §E1–E8 list) — pack items not otherwise numbered | — | — | — | |
| 10 | Which actions need server-side role checks beyond the six manager checks? | all action buttons | UI route tiers only | list: transitions, holds, owner change, delete, assign, parts approve, admin mark, amend attribution | |
| 11 | Retire `Job.department` / `Estimate.department` derived columns? | dashboard P&L | stored | yes → compute | |
| 12–13 | (legacy derived columns / pack notes — see SESSION-LOG) | — | — | — | |
| 14 | Record a station on every package stage stamp? | custody trail | only arrival; others hard-code Front Desk 1 | yes → `processed_station`, `inspected_station` | |
| 15 | Give `closeRequest` its own audit type? | audit log | logs as `estimate` (⚠ DRIFT) | yes → `request` type | |
| 16 | System actor for portal-created tasks/threads? | `/today` task rows from RC | `createdBy: 'RolliConnect'` string | yes → system principal row | |
| 17 | (pack) | — | — | — | |
| 18 | Should receive-watch overwrite the expected reference/serial even on a discrepancy? | Intake inspection | overwrites (serial unless NS) | no → keep expected immutable, store received separately | |
| 19 | Allow invoicing a closed job (late invoicing)? | job actions | allowed | yes → keep; no → ready_to_ship only | |
| 20 | (pack) | — | — | — | |
| 21 | Should pull-next also start service? | Bench Pull next | self-assign only | yes → pull = assign + start | |
| 22 | (pack) | — | — | — | |
| 23 | Parts alias scope: per reference, caliber, or global? | parts assistant, knowledge | global aliases + per-part compatible refs | choose scope table | |
| 24 | Billing semantics per job kind (charge / warranty no-charge / counter sale)? | job kind config | not defined | define column values | |
| 25–27 | (pack) | — | — | — | |
| 28 | Read-only job view for concierge (instead of Restricted)? | floor chips, `/today` job links | chips route concierge to Client 360 | yes → read-only `/jobs/:id`; no → keep routing | |
| 29 | Cross-division stock visibility / transfers? | Inventory | one shared pool | define transfer movement + wall | |
| 30 | Drop `Part.stock` for Σ `StockLevel.onHand`? | catalog | both kept in sync | yes → derive | |
| 31 | Evidence retention; who may redo/delete a slot? | Service evidence card | append-only, multiple per slot | define retention + redo rule | |
| 32 | Should Setup templates drive every Outbox writer? | Setup → Templates | some writers hard-code bodies (⚠ DRIFT) | yes → single renderer (recommended) | |
| 33 | Auto-consume parts on approval / hold release? | Inventory movements | `consume` kind exists, never written | yes → write on hold release | |
| 34 | Hide money for bench and concierge tiers? | `/rw`, companion price memory | hidden in `/rw` and companion for non-managers; concierge in RS sees money | yes → hide for concierge too; no → keep | |
| 35 | Do price verifications expire automatically? | Companion price memory | stale flag only | yes → TTL; no → flag only | |
| 36 | Who may correct a client brief? | Companion brief | any staff | restrict to manager? | |
| 37 | Routed questions honour division for who can answer? | Ask the shop | any manager | yes → same-division managers | |
| 38 | Photo-label vocabulary editable in Setup? | Photo labels | fixed pills | yes → lookup table | |
| 39 | Retire the legacy `Message` store for `ConvMessage`? | RC messages / inbox | both exist (⚠ DRIFT) | yes → one store (recommended) | |
| 40 | Reply-token format/expiry; unmatched inbound → General thread? | Inbox | `RS-<n>`, no expiry; unmatched → General | confirm | |
| 41 | Can concierge close threads? | Inbox | yes | — | |
| 42 | Do auto-thread events count as "needs reply"? | Inbox Needs reply | approvals/pickup do | confirm | |
| 43 | Report-link token TTL / revocation? | `/rc/report/:token` | none | define TTL (e.g. 30 d) + revoke on supersede | |
| 44 | Staff may record a verbal report decision (`decidedVia: staff`)? | Report card on job | portal only | yes → staff action with note | |
| 45 | Final component list and grade words for inspection reports? | report page | case/crystal/bracelet/movement/… · good/fair/worn/replace | confirm vocabulary | |
| 46 | Persist portal report decisions in the RC replay log? | prototype only | not persisted | n/a in KEEPER (server persistence) | |
| 47 | Timing PASS as an explicit sub-status/lane? | QC queue | timeline flag, status stays testing | yes → `timing_passed` flag column/lane | |
| 48 | Per-caliber Crit1/Crit2 exact definitions, per-position bounds? | `/rt` targets | seeded approximations | provide official sheets | |
| 49 | Witschi file import format? | `/rt` | manual entry | provide sample export | |
| 50 | Should clients see timing numbers on the portal? | `/rc/watches/:id` | summary only | yes/no | |
| 51 | NFC hardening: NTAG 424 rotating codes, geolocation, or both? | RGTime clock URL | plain URL, cloneable | choose (see rgtime.md) | |
| 52 | Manager punch corrections / missed clock-out? | RGTime week grid | none; open punch stays amber | yes → correction rows (append, audited) | |
| 53 | Offline punch queue on the PWA? | RGTime | none | yes → service worker + sync | |
| 54 | Kiosk signature / ID / photo capture? | `/kiosk` | none | yes → add steps | |
| 55 | Kiosk check-in also creates a walk-in drop-off package? | `/kiosk`, Intake | request only | yes → create SUB# when watch is present | |
| 56 | Concierge access to the RGTime week grid? | `/rg/manager` | manager only | — | |
| 57 | Floor model for KEEPER: two-lane (legacy RW) or nine-lane (RS)? | `/rw/floor` vs `/floor` | both rendered | pick one; retire the other | |
| 58 | Confirm hide-money default for bench tiers | `/rw` | hidden | — | |
| 59 | May concierge tier enter RW at all? | `/rw` sign-in | allowed (QC/Supervisor hidden) | no → bench roles only | |
| 60 | Does RW need its own station/device registry? | `/rw` | shares RS station | yes → RW devices table | |
| 61 | RW as an installable tablet PWA? | `/rw` | no manifest | yes → manifest like RGTime | |
| 62 | RW job page: allow Owner changes and pin-to-hit-list? | `/rw/jobs/:id` | omitted | yes → add cards | |
| 63 | QC-fail after completion — credit stands + rework log? | Components card | credit stands, rework ×n | **RULED 2026-09-26: credit stands** | ✔ |
| 64 | Separate P and PM components (today both = Case)? | Components | one Case component | yes → four components | |
| 65 | Limit attribution amendments to the same month? | Components → Amend | any time; report follows current `completedBy` | yes → lock after month close | |
| 66 | Hide inline "done" buttons on the RS Bench (RW-mini)? | `/bench` | same component as `/rw` → buttons shown | yes → prop to hide in RS | |
| 72 | Audit a staff member opening a colleague's inbox? | `/inbox?staff=` | no audit row | yes → `comms` audit type | |
| 73 | Replying from a colleague's inbox — reassign the thread to the sender? | `/inbox?staff=` | assignment untouched | yes → auto-assign | |
| 74 | Show client requests on the client's `/rc` job card? | `/rc` | staff/workshop only | yes → render list on portal card | |
| 75 | "Understood" once per person per job, or every scan? | scan pop-up | every scan while open | once → skip if actor already acked | |
| 76 | Restrict N/A check-off at QC to supervisor tier? | QC checklist | any signed-in user | yes → tier gate | |
| 77 | Parts approval email — portal approve/decline action? | Review → Send | link to `/rc`; decision simulated on pad | yes → portal parts approval page | |
| 78 | M3KE similarity: token overlap (prototype) vs model in KEEPER? | Parts search | token-based | — | |
| 79 | Caliber as a watch attribute instead of reference-prefix table? | `CALIBER_BY_REF` | prefix table | yes → `Watch.caliber` | |
| 80 | Manager review gate for WM-room bench requests too? | Review → Bench | direct approve path kept | yes → all requests via review | |

## Amber items not numbered above (from DECISIONS "provisional")
| item | where | prototype does | verdict |
|---|---|---|---|
| Per-kind stage skip for small_job (skips awaiting approval) | job actions | collapses to "Mark approved" | |
| Case-cleaning lane derivation (P/PM-only in-service) | `/floor` | provisional rule | |
| Which transitions email the client | job actions "Provisional" tag | approval request, QC pass, QC fail | |
| Evidence slot sets per kind | Service evidence | service 4 · small_job 1 · warranty 2 | |
| Department P&L labor-only rule | Reports | service lines → dept, goods excluded | |
| Companion money for non-managers | Companion | hidden | |
| Job page omission list in RW | `/rw/jobs/:id` | see rolliworking.md | |
| RolliTime QC-queue handoff (status stays testing) | `/rt` PASS | flag only | |
