# DESIGN-PRINCIPLES — locked patterns (E1–E4)

These are decided. Extend them; do not re-litigate without a DECISIONS.md entry.

| # | pattern | rule | where it lives |
|---|---|---|---|
| 1 | **One data module** | Screens never fetch, never touch storage. Everything goes through `src/api/client.ts` typed functions; fixtures under `src/api/fixtures/`. Repointing to the real API touches one file. | `client.ts`, `fixtures/` |
| 2 | **Pipeline on one page** | A module's whole flow is visible left → right on a single screen with counts per lane (Intake 4 stage tabs; Jobs board lanes incl. On hold; Estimates status chips). No wizard that hides the map. | `IntakeLayout`, `JobBoard`, `EstimatesListPage` |
| 3 | **Only legal actions render** | Next steps come from the state machine (`legalJobActions`, estimate status checks). Buttons, never a free status dropdown. Held jobs render zero transitions. Reasons are required by the action definition, enforced in the client module, not the UI. | `JOB_ACTIONS`, `transitionJob`, `EstimateDetailPage` actions |
| 4 | **Label at point of work / one-tap capture** | Scan-first inputs auto-focus and accept Enter; labels queue at Receive Watch (where the data is known), photos captured by webcam or upload in place (`PhotoCapture` reused for packages and jobs). Print = mock flag, still stamped. | `ArrivalPage`, `receiveWatch → queueLabel`, `PhotoCapture` |
| 5 | **Audit-stamp everything** | Every mutation appends an `AuditEvent {type, who, station, when, detail}` and, for jobs, an append-only timeline row. Stamps carry `{at, by, station}` (`Stamp`). Failed sign-ins are logged too. | `appendAudit`, `stamp/estStamp/jobStamp/taskStamp` |
| 6 | **Role-based routing** | Accountability attaches to a **role**, resolved to current holders at read time (`roleHolders`). Job `owner: Role` ≠ `assignees: string[]` (working techs). Tasks may target a role. `/today` is derived from these, never hand-curated. | `User.roles`, `Job.owner`, `Task.assignedTo`, `getToday` |
| 7 | **Lookup tables, not enums-with-switches** | Behaviour per kind/status/dept is a data table the UI reads: `JOB_KIND_CONFIG` (owner role, skip stages), `JOB_ACTIONS`, `WATCH_STATUS_FOR`, `EMAIL_FOR`, `DEPT_COMPONENTS`, `DEPT_LABEL`. Adding a kind or stage = add a row. | `client.ts`, `fixtures/intake.ts` |
| 8 | **Pack wins, brief second, UNKNOWN → simplest + amber** | Legacy prompt pack overrides the session brief on fields/statuses/rules. Anything the pack marks UNKNOWN is built the simplest way and tagged `<Provisional/>` in the UI and "provisional" in docs. | `Provisional` component, PROMPT-PACK-*.md |
| 9 | **Outbox, never send; no real money** | Client emails are queued as `OutboxEmail` with full body; nothing leaves the app. Money is display arithmetic (tax shown "not applied"). | `store.outbox`, `totalsFor` |
| 10 | **Routing authority = Receive Watch** | The workflow set (W/B/P/PM) recorded at intake stage 4 governs the job; jobs inherit it from the received package before falling back to line depts. | `receiveWatch`, `jobFromEstimate` |
| 11 | **Naming: "PM" = precious metals** | `PM` is a `DeptCode` only. Accountability is always `owner`; techs are `assignees`. Never "PM" for project manager in schema, UI, or docs. | `types.ts`, `OwnerBadge` |
| 12 | **Dense, keyboard-first staff UI** | Tight spacing, mono for ids, Enter submits, ⌘/Ctrl+Enter confirms modals, rows focusable, auto-focus the scan/search field, `data-testid` on every interactive/critical element. | all pages |
| 13 | **Derived first, pinned on top** | If a list can be computed from state (hit list rows, lane counts, KPIs, waiting-on), compute it. Explicit items are stored only as tasks and pinned hit-list items; pins sit in their own section above derived rows and can never hide them (MH ruling). | `getToday`, `pinToHitList`, `getDashboardStats` |
| 14 | **Evidence before advance** | Leaving review requires inspection photos for every kind; the multiple-choice report only where the kind's config says so. Gates live in the client module (`reviewGaps`) and the UI just reflects them. | `JOB_KIND_CONFIG`, `reviewGaps`, `ReviewGate` |

| 15 | **Lenses, not modules** | Bench, Supervisor and Floor Map read the same job store through role-shaped views; they add no statuses. Learning loops (parts) write to lookup tables (`compatibleRefs`, `aliases`) and a visible knowledge log, never to hidden state. | `getBenchView`, `getSupervisorBoard`, `getShopFloorMap`, `approvePartsRequest` |

## Anti-patterns (don't)
- Free status `<select>`; editing `status` directly from a screen.
- New storage paths, `fetch`, or component-local fixtures.
- Adding a "PM" / project-manager field.
- Subtasks, task kanban, comments, priority schemes on tasks (out of scope by decision).
- Hiding or filtering out derived `/today` rows because something was pinned.
- Silent dead buttons — a stub must throw a visible message and be audited.
