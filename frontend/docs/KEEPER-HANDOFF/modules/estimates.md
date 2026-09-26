# Module — Estimates

## Screens & layout intent
`/estimates` list (status chips, search, client/watch columns), `/estimates/new` and `/estimates/:id` detail: header (number, status pill, revision, valid-until), **line editor** (department code, description, qty, unit price, type service|part|shipping), totals, client message, quote-context strip (other estimates for this client/watch), revision history, actions bar (Send, Mark sent, Approve, Decline…, Reopen, Duplicate, Convert → job / intake / sales order, Print preview, Delete). Print preview is a paper-style page.

## Fields
| field | type | required | validation |
|---|---|---|---|
| clientId | id | yes | |
| watchId | id | for conversion to job | must belong to client |
| lines[] | {dept W/B/P/PM, description, qty ≥1, unitPrice cents ≥0, type service/part/shipping, partNumber?} | ≥1 to send | blank lines dropped on save |
| message | text | no | default "Thank you for your business." |
| validUntil | date | no | duplicate sets +30 days |
| declineReason | text | on decline | required non-empty |

## Calculated
`total = Σ qty × unitPrice`; `primaryDepartment` = dept of the largest labor line; `addressFor(client)`; `historical` flag on revisions (read-only snapshots).

## State machine
`draft → sent → approved → converted`; `sent → declined → draft`; `expired` seed-only — `source/STATE-MACHINES.md` §3. Emails: `sendEstimate` (estimate / updated estimate, portal-first short body with link). Portal approve/decline (RC) call the same functions with `via: 'portal'` and auto-thread into Comms.

## Rules
- `markEstimateSent` records no `sentAt` and sends nothing ("went out some other way").
- `convertEstimate(id,'sales_order')` throws — use `convertEstimateToSalesOrder` (does not change estimate status).
- Delete blocked when converted or when a package links to it.
- Money shown to both tiers in RS; hidden in `/rw` (estimates are not reachable from `/rw` at all).

## Behaviours discovered during build
- `approved` status is **provisional** (pack was silent); portal approvals also transition a linked job waiting on the customer.
- Revisions: `reviseEstimate` snapshots into `revisions[]`; `updateEstimate` is autosave for drafts.
- `⚠ DRIFT`: no expiry job exists; `validUntil` is informational.
