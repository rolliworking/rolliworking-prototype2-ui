# Module — Sales (sales orders · payments · pickup station · ship station · custody close)

> **Superseded in part (2026-10-02):** the pickup station section is replaced by **`../specs/SPEC-PICKUP-STATION.md`** (five gated steps, BUILT, with the gap check against MH's gate list). Fulfill ▾ menu, zero-balance (MH-only), scan gate + manager override and the ship station stay as described in `02` and below.

## Screens & layout intent
`/sales` list (status, channel, balance), `/sales/:id` detail: lines editor (draft/open), totals + shipping amount, payments list + record payment, fulfilment channel toggle (pickup ↔ ship), pickup code card (regenerate), shipping address card (request from client / set), shipment card (tracking, label), QBO badge (stub), cancel. **Pickup Station** `/sales/pickup`: queue of pickup-channel orders, code entry (or proxy name + ID photo), handover photos, partial line quantities, unpaid bypass with reason. **Ship Station** `/sales/ship`: queue, address check, carrier, declared value (insurance), photos, label (mock), unpaid bypass. Both stations are one-order-at-a-time task screens.

## Fields
| field | type | required | validation |
|---|---|---|---|
| lines[] | as estimate lines (non-shipping) | ≥1 to open | |
| shippingAmount | cents | no | from estimate shipping lines |
| payment | amount cents, method, note? | amount | `0 < amount ≤ balanceDue` |
| channel | `pickup \| ship` | | ship needs address; pickup issues a code |
| pickupCode | generated | | consumed on confirm; regenerable (✉ each time) |
| shippingAddress | name, street, city, state, zip? | for ship | name/street/city/state required |
| pickup confirm | code **or** (proxyName + proxyIdPhoto); photos ≥1; lineQty?; bypassReason? | | paid OR bypassReason |
| shipment | carrier, declaredValue, photos ≥1, label, bypassReason? | | address set; paid OR bypassReason |
| cancel | reason | yes | not after shipped/picked_up |

## Calculated
`total`, `balanceDue`, `isPaid`, `partial`, queues (pickup/ship), `tailStage` on the job, `qboInvoiceId = QBO-STUB-…` on fulfil.

## State machine
`draft → open → (partial_fulfilled ⇄) fulfilled → shipped | picked_up`; cancel from non-terminal — `source/STATE-MACHINES.md` §2 with every action's guards and emails (ready to pay, paid/partial, invoice + code, where to ship, shipped, thank-you/partial). `closeCustody` closes the job (`ready_to_ship → closed`) and releases the watch.

## Rules
- `invoiceJob` allowed when job is `ready_to_ship` or `closed`; one non-cancelled SO per job/estimate.
- Admin mark complete (manager, note required) creates synthetic `ADMIN-MARKED` sessions — audited loudly.
- Money visible to both RS tiers; never in `/rw`.

## Behaviours discovered during build
- Pickup code pre-check (E9b): code validated before the photo step so the concierge sees a wrong code early.
- Portal (RC) can schedule a pickup window and submit a shipping address; both create staff-side threads/tasks.
- `⚠ DRIFT`: shipping labels/tracking are fabricated strings; insurance is only a declared value field (seam → shippingProvider).

## Post-E16 additions (2026-09-26) — Send invoice + payment link
- **Send invoice** action (open / partial_fulfilled / fulfilled): queues an Outbox email with a **Pay invoice** button (`OutboxEmail.payLink`) and records the send (`invoiceSends[] {at, by, total, balanceDue, emailId}`); re-send reuses the same link.
- **Pay link** `/pay/<payLinkToken>` — minted once per SO (`pl-…`), public, renders the LIVE lines / total / paid / balance (`getPayPage`), accepts partial payments (`payViaLink` → `recordPayment` as the client, method card). Portal Pay button (`/rc/invoices/:id`) opens the same page. Page is a **MOCK Intuit placeholder** (banner, fake card block, "no card is charged").
- **Edit after send** (VB4): `updateSalesOrder` now allowed through `fulfilled`; stamps "Edited after send · total A → B · balance … · payment link updated · QBO re-push queued (stub)". The SO page's Payment-link card shows each send's "told" figures vs "now".
- `⚠ DRIFT` QBO re-push after an edit is a stamp only; production must void/replace the QBO invoice and keep the hosted link valid. `⚠ DRIFT` The hosted page is same-origin SPA navigation (store is per tab) — production is an Intuit-hosted URL.
