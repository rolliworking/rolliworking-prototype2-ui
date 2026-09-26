# Module — Workshop (RW-mini inside RS): Bench · Supervisor · Nine-lane floor · Parts requests · Parts knowledge

These views are embedded in RS for managers and are re-homed verbatim inside `/rw` (see `rolliworking.md`). Same data, two shells.

## Bench `/bench`
- **My jobs**: jobs where I am an assignee; per row: number, client, watch, kind, workflow, status (or "Awaiting components"), priority, due (red when overdue), **next legal action** button (→ job page), blocked reason, component chips + inline "<Component> done" buttons (only while in service, not held).
- **My holds**: my jobs with an active hold. **Pull next** (moss card): oldest approved, on-hand, unassigned, priority first; only roles watchmaker/inspector may pull; supervisor-assigned jobs are never pulled by others. **My parts requests** with status pills → chat modal.

## Supervisor board `/supervisor` (manager tier)
- **Unassigned bench work** (approved / in service / testing with nobody), one card per tech with **"N component completions this month"**, tech toggle chips assign/unassign (`supervisorAssign`, manager only, audited). **Parts approval queue** (pending PRs → modal approve/reject). **Holds parked under me**. **QC queue** (jobs in testing).

## Floor map `/floor` (nine lanes, left → right)
Intake · Review · Awaiting approval · Bench · Case cleaning (in-service jobs whose workflow is P/PM only — provisional derivation) · Holds (parked) · Testing/QC · Ready · Out (closed < 14 days). Chips: last 4 of number, workflow badges, first assignee; priority border. Concierge chips route to Client 360 (fixed E9b). Compare with the `/rw` two-lane map — MH to rule (Q57).

## Parts request + scripted assistant
State machine `source/STATE-MACHINES.md` §5. Chat is **scripted** (`partsAssistantReply`: keyword match against parts by number/alias/compatible reference; proposes candidates; "attach" picks one). Fields: partId, qty ≥1, note, `searchTerms` (every message). Approval (manager): learns `compatibleRefs += watch.reference` and `aliases += search terms ≥4 chars`, writes **Parts knowledge** entries (`association_confirmed`, `alias_added`, `rejected`), optionally places a parts hold. `/parts/knowledge` lists the learned rows.

## Tier/division
Bench = both tiers; Supervisor, Parts knowledge = manager. Pull-next uses the session division; `⚠ DRIFT`: supervisor board and floor are not division-walled.

## Behaviours discovered during build
- "Blocked" on a bench row = review gaps or hold text, computed per row.
- Parts assistant is the seed of the Companion panel (E10) and of the M3KE seam (`06-SEAMS.md`).
