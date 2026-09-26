# Module — Purchasing · Inventory

## Purchasing `/purchasing` (manager)
- **Vendors** (name, contact, lead days, active/retired). **Purchase orders**: number, vendor, location, lines (part, qty, unit cost), status, expected date; **Receive** dialog per line (qty received; partial allowed) writing one `receipt` stock movement per line at the PO's location.
- State: `draft → sent → partially_received → received`; cancel (reason) from any non-received — `source/STATE-MACHINES.md` §13.
- Validation: ≥1 line to send; qty ≥1; received qty ≤ outstanding.

## Inventory `/inventory` (manager)
- **Stock rows**: part × location `onHand`, reorder point, low-stock flag; **Adjust** (±qty, reason required; cannot go below 0); **Movements** ledger (`receipt | adjustment | count | consume`, qty, by, at, ref); **Cycle counts**: one open per location, counted qty per part, **Post** writes `count` movements for variances.
- Invariant: `onHand ≥ 0`; `Part.stock = Σ StockLevel.onHand`.
- Cross-division inventory rules are **unruled** (amber, Q in `03`): today one shared stock pool.

## Parts catalog (`Part`)
partNumber, name, brand, price cents, stock, compatibleRefs[], aliases[], vendorId?, reorderPoint. Learned by parts approvals (workshop.md).

## Audit
`purchasing` (PO create/send/receive/cancel, vendor edits), `inventory` (adjust, count open/post).

## Behaviours discovered during build
- Parts hold on a job is placed from parts approval, not from inventory; consuming a part against a job (`consume` movement) exists as a movement kind but no screen writes it (`⚠ DRIFT` / gap: KEEPER should consume on parts approval or on job completion — MH to rule).
