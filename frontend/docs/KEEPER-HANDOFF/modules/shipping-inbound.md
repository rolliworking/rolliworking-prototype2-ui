# Module — Inbound Shipping + Parcel Pro adapter + Track a package · post-E16

## Screens & layout intent
- **`/shipping/inbound`** (`pages/shipping/InboundShippingPage.tsx`, RS sidebar "Inbound"): mirrors the intake stage pattern — four tabs **1 Label Requests → 2 Labels Sent → 3 In Transit → 4 Delivered (awaiting arrival scan)** with counts, a **morning KPI strip** (labels to send today · outstanding labels · in transit · arriving today · delivered-unscanned), rows sorted oldest-first. Row actions by stage: create label (sheet: validated/cleaned recipient, declared value, carrier UPS/FedEx → tracking#, label PDF link, cost) · resend label email · follow-up · void + reissue · simulate carrier scan (demo) · open tracking.
- **Aging chips**: Labels Sent shows outstanding days, **red > 30 days** (`red30` KPI); Delivered-unscanned shows hours since delivery, **red flag > 4 h** (highest-risk window); In Transit shows last carrier event, ETA and an **ARRIVING TODAY** callout when the last event is "Out for delivery".
- **Tracking panel** (`components/shipping/ShippingBits.tsx` → `TrackingPanel`): slide-over with direction, status/ETA, carrier + service, insured value, newest-first carrier events, our stamps, **Copy status for client** (one plain-English line, `clientStatusLine`) and — when the client has several shipments — an **"Also for <client> · n more"** list to switch between them. Opens from shipping rows, global search (SHIPMENTS group), **Client 360** (`TrackButton`), **Inbox thread header** (`TrackButton`).

## Rules (code is truth)
- `InboundShipment {id, direction: inbound|outbound, estimateId, clientId, stage, carrier, service, declaredValue, destinationState, requestedAt, labelSentAt?, trackingNumber?, labelUrl?, cost?, events[], eta?, deliveredAt?, arrivedAt?, reissued?, stamps[], emailIds[]}`; `ShipStage = label_requested | label_sent | in_transit | delivered_unscanned | arrived`.
- **Tracking numbers are born attached to the estimate**: `createInboundLabel(id, recipient, declaredValue, carrier)` → adapter `createLabel` → stage `label_sent`, label email queued (Outbox), cost recorded (lands on the SO at label time — shipping P&L per job, `⚠ DRIFT`: SO line not yet written). `prepareLabel(id)` runs `validateAddress` first; the cleaned address must be confirmed before creation.
- `voidAndReissue` → adapter `voidLabel` then a fresh `createLabel` (`reissued: true`, stamped). `resendLabelEmail` / `followUpLabel` queue emails and stamp. `simulateTrackingEvent` (demo) advances Picked up → In transit → Out for delivery → Delivered (`delivered_unscanned`).
- **Arrival auto-match**: `logArrival` (intake) with a tracking number finds the open inbound shipment with that number → stage `arrived`, `arrivedAt`, and the new package is pre-linked to the estimate + client ("arrival scan matched · SUB# · linked E#"). The auto-seed pattern from intake reused.
- **Track button fallback (MH ruling VB3-16)**: anchored estimate's live shipment first; else the client's shipments newest-first; several → one button with `+N`, panel lists the rest.
- Board excludes `arrived`; `getShipmentsForClient` includes all (history); `getShipmentForEstimate` excludes `arrived`.

## Carrier adapter — `src/api/carriers/parcelpro.ts` (the seam; `06-SEAMS.md` §1b)
The ONLY module that "talks to" the carrier. Mocked with production-real shapes; a real key later = this one file implemented.
```ts
export interface CreateLabelInput  { estimateNumber: string; recipient: ShipAddress; declaredValue: number; carrier: ShipCarrierName }
export interface CreateLabelResult { trackingNumber: string; labelUrl: string; cost: number; insuredValue: number }
export interface TrackingResult    { status: string; events: TrackingEvent[]; eta?: string }
export interface AddressValidation { valid: boolean; cleaned: ShipAddress; riskFlag?: string }
export async function createLabel(input: CreateLabelInput): Promise<CreateLabelResult>
export async function voidLabel(trackingNumber: string): Promise<{ voided: boolean; trackingNumber: string }>
export async function getTracking(trackingNumber: string, events: TrackingEvent[] = []): Promise<TrackingResult>
export async function validateAddress(address: ShipAddress): Promise<AddressValidation>
```
Mock behaviour: UPS `1Z…` / FedEx 12-digit numbers; cost = 18 + max(25, 0.95 % of declared) (+25 over $25k); `labels.parcelpro.mock` PDF URL; address cleaning normalises St/Ave/Rd and fills ZIP from a 10-state table; `riskFlag` when the state is unknown.

## Client functions used
`getInboundBoard`, `getShipment`, `getShipmentsForClient`, `getShipmentForEstimate`, `prepareLabel`, `createInboundLabel`, `resendLabelEmail`, `followUpLabel`, `voidAndReissue`, `simulateTrackingEvent`, `clientStatusLine`, `SHIP_STAGE_LABEL`, `universalSearch` (shipment hits), `logArrival` (auto-match).

## Drift flags
- `⚠ DRIFT` Outbound shipments exist only as seeds (sh-08/09) — the RS ship station (`sales.md`) does not yet write `InboundShipment` rows; one shipment ledger for both directions is the intent.
- `⚠ DRIFT` Label cost is stored on the shipment but not yet pushed to the SO.
- `⚠ DRIFT` "Simulate carrier scan" replaces carrier webhooks/polling (`getTracking` is only called with local events).
- Amber: outbound return-label flow and the portal tracking page reuse `clientStatusLine` — not built (Q85).
