# Module — Intake (arrival → receive package → work order → receive watch) · Outbox · Label queue

## Screens & layout intent
Tabbed layout under `/intake`: **Arrival** (form + today's arrivals), **Receive** (list → detail with content pills, photo capture, estimate/client link), **Work order** (bin assignment), **Inspection** (receive watch: reference/serial, workflow departments, same-watch decision, discrepancy preview), **Outbox**, **Labels**. Walk-in **Drop-off** is the Arrival form with source `walk_in` ("Hand delivery"). Dense forms; the receive-watch screen shows the estimate's expected components beside the entered ones.

## Fields
| screen | field | type | required | validation |
|---|---|---|---|---|
| Arrival | source | `carrier \| walk_in` | yes | |
| | trackingNumber | text | carrier only | unique across packages; carrier auto-detected from the number (UPS/FedEx/USPS/DHL patterns) |
| | signatureNoted | bool | no | |
| | clientId | id | no | |
| Receive | contents | ≥1 pill from `CONTENT_PILLS` (watch, box, papers, bracelet links, …) | yes | |
| | photos | ≥0 | no | |
| | estimateId / clientId | id | no | client resolves `estimate.clientId ?? input.clientId ?? existing` |
| Work order | bin | one of `BINS` | yes | |
| Receive watch | reference | text | yes | |
| | serial | text | yes | `NS` allowed = not stated |
| | workflow | ≥1 of W / B / P / PM | yes | |
| | sameWatchDecision | `returning \| conflict` | when serial matches an existing watch with history | |
| | extraWatch | bool | no | flags a discrepancy |

## Calculated
- `SUB#` package number; `carrier` from tracking; **discrepancies** (pure `computeDiscrepancies`): missing expected component (from `DEPT_COMPONENTS` of estimate line depts), serial differs (unless NS), reference differs, extra watch, same-watch conflict.
- Labels queued on clean receive: PDF417 payload `E#|SUB#|ref|serial|W,B` + ref/serial label.

## State machine
`arrived → processed → awaiting_inspection → received | discrepancy_hold` — `source/STATE-MACHINES.md` §4 (guards, side effects, watch status writes). Emails: receive package → confirmation (if client known).

## Rules
- Receive watch **overwrites** `watch.reference/serial` with the received values (serial only if ≠ NS).
- Discrepancy packages surface on `/today` (concierge role + flagging inspector) and stay held. **Gap:** no release-from-discrepancy function exists — KEEPER needs `resolveDiscrepancy(id, decision, note)`.
- Outbox: every client email is a pending row `{to, subject, body, relatedRef, status pending}`; nothing sends (seam → `06-SEAMS.md`). Label queue: rows with kind/payload; "print" is a mock (seam → ZPL).

## Tier/division
Both tiers. `⚠ DRIFT`: intake lists are not division-walled (all packages visible at any station).

## Behaviours discovered during build
- Drop-off receipt "print" only sets `receiptPrinted` (mock).
- Same-watch fork added after E2: returning watch keeps history; conflict = discrepancy.
- Kiosk check-in (E13) does **not** create a package; it creates a service request. Open question 55 asks whether it should.
