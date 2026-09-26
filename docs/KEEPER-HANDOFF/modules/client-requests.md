# Module — Client Requests (job-attached client instructions · badge · scan modal · QC gate) · post-E16

## Screens & layout intent
- **RS job page** `/jobs/:id`: "Client requests" card (amber left rule) — add / remove free-text requests ("what the client asked for"); in `testing` the same card becomes the **Final QC checklist**.
- **Bench cards** (Supervisor Pad, WM room, Bench Pad, RW job page): amber **CLIENT REQUESTS (n)** badge + the request lines listed on the card.
- **Scan modal** (`ClientRequestModal`): full-screen pop-up "Client asked for…" listing open requests; persists until **Understood**; fires on **every label scan at any station** — pad global scan (`pad_scan`), WM send-by-scan (`wm_scan`), station scanner (`station_scan`), bulk assign (`bulk_assign`) — **even when the scan itself was rejected** (held job).
- **QC checklist** (`QcRequestChecklist`): each request → **Done** or **N/A + reason**; the QC pass button is disabled and names the first unchecked item.

## Rules (code is truth)
- `ClientRequest {id, text, at, by, station, acks: {at, by, via}[], check?: {at, by, result: done|na, reason?}}` on `Job.clientRequests[]`.
- **Open** = no `check` (`openClientRequests`). `clientRequestAlert(jobId)` returns the modal payload when any are open. **Understood** → `ackClientRequests(jobId, via)` appends an ack per open request with who/when/via and stamps the job ("Client requests seen · n · by (via)"). Acks never close a request — it re-surfaces on the next scan.
- **QC gate**: `qcRequestGaps(job)` = open requests; `finishJob` / pad QC pass throw "QC blocked — client request not checked off: '…'" while any remain. `checkClientRequest(jobId, reqId, 'done'|'na', reason?)` (reason required for N/A), `uncheckClientRequest` reopens.
- `addClientRequest` / `removeClientRequest` (manager or concierge; stamped).
- "Did we do what the client asked" is therefore a **recorded yes**: request text → every acknowledgment → the check-off, all stamped.

## Client functions used
`openClientRequests`, `qcRequestGaps`, `addClientRequest`, `removeClientRequest`, `clientRequestAlert`, `ackClientRequests`, `checkClientRequest`, `uncheckClientRequest`.

## Drift flags
- `⚠ DRIFT` Requests are free text typed by staff; the earlier "portal notes" idea is DEAD (VB3-10) — clients never write these directly.
- `⚠ DRIFT` Acks and check-offs are embedded arrays on the job; KEEPER: `client_requests`, `client_request_acks`, `client_request_checks` tables (see `04`).
- `⚠ DRIFT` Modal persistence is per render — if the tab reloads mid-modal the ack is not recorded (no partial state); acceptable in KEEPER only if the modal is re-shown on next scan (it is).
