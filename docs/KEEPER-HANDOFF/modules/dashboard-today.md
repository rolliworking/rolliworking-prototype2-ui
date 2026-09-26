# Module — Dashboard · Today (hit list) · Tasks · Pins

## Screens & layout intent
- **Dashboard** `/`: stat cards (open estimates, awaiting approval, in progress = approved+in_service+testing, awaiting pickup, revenue this month), activity feed, mini today. Numbers must reconcile with Reports (they do today; see labels-reports-accounting).
- **Today** `/today`: header with role list and division; filter chips per source (Owner actions, Bench, Holds, Discrepancies, Tasks, Replies) with counts; **Pinned** card (manual layer, amber left border) with pin form; **Derived** card (moss accent) with rows; **Send a task** form; **Waiting on** list (tasks I sent, still open). Managers + concierge get a **Staff hit lists** full-screen viewer (same-division team, prev/next).
- Dense, keyboard-friendly; rows have "→" to the entity and a pin-on-hover.

## Derived rows (`getToday`, division-scoped) — the 80%
| source | who sees it | derived from |
|---|---|---|
| owner | holders of the job's `owner` role | job needs an owner action (legal action exists) |
| assignee (Bench) | job assignees | job on their bench with next legal action |
| hold | owner role holders + whoever placed it | active hold |
| discrepancy | concierge role + flagging inspector (rolliworks) | package in `discrepancy_hold` |
| task | assignee (user or role) | open Task |
| thread (Replies) | assignee of the conversation / all | conversation needing reply |
`overdue` = `dueAt < now`. Rows are recomputed on every load; nothing is stored.

## Explicit layer — the 20%
| entity | fields | rules |
|---|---|---|
| Task | title (req), assignedTo (`{type:user, shortName}` or `{type:role, role}`), createdBy, division, jobId?, watchId?, clientId?, dueAt?, done, completedAt/By | same-division assignees only; `setTaskDone` toggles; linked tasks show on the job timeline; audit `task` |
| PinnedItem | title (req), forShortName, byShortName, division, jobId?, clientId?, estimateId?, taskId?, dismissedAt? | never deleted; dismiss = done; audit `pin` |

## Quick-add grammar (ruling 2026-09-24)
`#name`, `#role`, `@name`, `@role` accepted anywhere the text is parsed; the "For" select syncs live. Global `+` button and **Alt+T** open the overlay; context on `/jobs/:id`, `/clients/:id`, `/estimates/:id` auto-links. Autocomplete = same-division staff + roles that have a holder in the division. Toast: "Pinned to Vienna's list".

## Tier/division
Both tiers. Division wall on rows, tasks, pins and pickers (`getDivisionStaff/Roles`). Staff hit-list viewer: managers + concierge.

## Behaviours discovered during build
- Hit list started as `/hit-list`; renamed `/today` (redirect kept).
- "Replies" source added by E14 (Comms hub) — conversation rows appear on `/today`.
- `⚠ DRIFT`: task/pin writes are not division-checked server-side (no server); the pickers prevent it in the UI only.
