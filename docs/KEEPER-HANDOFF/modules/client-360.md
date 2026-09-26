# Module — Client 360 · Universal search · Service requests

## Screens & layout intent
- **Universal search** (top bar + `/clients`): one box resolves any identifier — name, phone, email, estimate #, job #, SUB#, tracking, sales order #, watch reference/serial, request # — into grouped hits (kind, label, detail, matched text, path). Every hit lands on the client's page with `?hit=<key>` which scrolls to and highlights the row.
- **Client 360** `/clients/:id`: dense single page: header (name, type retail/trade, since, contact, address, summary counters: open requests, active jobs, open estimates, unpaid balance, last contact), **Watches** (each with its history rows: requests, estimates, jobs, invoices, evidence, timing), **Requests** (source icon: call/email/web/walk-in/kiosk; close with reason; duplicate-of picker), Estimates, Jobs, Invoices/payments, Notes & tasks, Emails (Outbox rows for the client), **Custody trail** (derived events), Documents (labels, evidence photos, reports), Companion brief hook.

## Fields — Client
firstName, lastName (req), email (req, unique-ish; kiosk matches on it), phone (req; normalised digits for matching), company?, street/city/state (kiosk-created clients have empty address), type `retail|trade`, since.

## Service request (`ServiceRequest`)
| field | notes |
|---|---|
| number `RQ-26-nnnn` | sequential |
| source | `call \| email \| web \| walk_in \| kiosk` |
| status | `new → quoted → closed` (staff) · `new → closed_by_client` (portal) — `source/STATE-MACHINES.md` §6 |
| summary, watchId?, estimateId? | quoted = estimate linked |
| closeReason | `duplicate \| no_longer_needed \| mistake`; duplicate needs a sibling request id |
| division? | kiosk rows carry the brand's division; legacy rows default rolliworks in the queue |
| kiosk? | `{firstName, lastName, email, phone, services[], notes?, matchState none/possible/confirmed/split, matchedClientId?, matchedOn[]}` |
Never deleted. Staff create/quote functions do **not** exist (seed + kiosk only) — **gap**: KEEPER needs `createRequest`, `quoteRequest(requestId, estimateId)`.

## Custody trail (projection)
`package_arrived → watch_received | discrepancy → (hold_placed → hold_released)* → shipped | picked_up`, each row linking its source record. Not a table in KEEPER either — derive.

## Tier/division
Both tiers. `⚠ DRIFT`: clients and their records are not division-walled in RS.

## Behaviours discovered during build
- `closeRequest` audits with type `estimate` (`⚠ DRIFT` — should be its own type or `job`).
- Requests queue moved to its own page `/requests` in E13; Client 360 keeps the per-client section.
- Kiosk-created clients are real client rows (type retail) — the "possible existing client" flag prevents duplicates; staff Confirm/Split resolves it (`kiosk-requests.md`).
