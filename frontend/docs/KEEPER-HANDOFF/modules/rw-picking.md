# Module — RW Picking (approve → pick → allocate) · post-E16

## Screens & layout intent
- **`/rw/picking`** (`RwPickingPage.tsx`, full-screen tablet skin): one card per **pick task**: part name + part#, job#, qty to pick, **location** ("Cabinet B · Drawer 12 · Bin 4"), on-hand vs to-pick, three actions — **Picked** (tap or scan the bin label), **Short — order**, **Found elsewhere** (type the real location). Header counts: picks remaining, shorts today (also on the Supervisor Pad summary strip).

## Rules
- A pick task is created per catalog line when a manager **allocates** a client-approved request (`padAllocate`) or approves via the legacy approvals queue (`approvalAction 'approve'`); location comes from `Part.location`.
- `pickAction(taskId, 'picked')`: refuses if `Part.stock < qty` ("Only N on hand at <loc> — need M. Flag it short or found elsewhere."); otherwise **decrements stock**, marks the task picked, stamps the job ("Part picked · … · allocated") and the request ("picked ×N · on hand now S").
- `pickAction(taskId, 'short')`: task `short`, request → `on_order`, audit `inventory` row "Pick … short · ordered".
- `pickAction(taskId, 'found', location)`: requires a location; **rewrites `Part.location`** and the task location, task back to `open` with note "found elsewhere", audit `inventory` row "… relocated → <loc>". Location data self-corrects through use (MH ruling VB3-08).
- On-hand shown **before** approving on the review/allocate cards (`partsOnHand`); 0 on hand = OUT OF STOCK alert and Approve becomes "Order part".

## Client functions used
`getPickingQueue`, `pickAction`, `partsOnHand`, `getRoomSummary`, `padAllocate`, `approvalAction`.

## Drift flags
- `⚠ DRIFT` Pick tasks live in the module-level `rw18.picks` array (fixture `pickTasks` + created at allocation) — no persistence; KEEPER: `pick_tasks` table with FK to parts request line, part, job, location.
- `⚠ DRIFT` Stock is a single `Part.stock` number here while the inventory module tracks `StockLevel` per location — the two are **not reconciled** (Q83).
- `⚠ DRIFT` Bin-label scan is accepted as any Enter in the scan field — no bin label format is defined.
