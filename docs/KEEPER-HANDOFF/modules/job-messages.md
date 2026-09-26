# Module — Job Messages (threaded, internal, @mention routing by tier) · post-E16

## Screens & layout intent
- The job's former **Notes** card is now **Messages** on every surface: RS job page (`/jobs/:id`), RW job page (`/rw/jobs/:id`), Supervisor Pad detail sheet, WM room (Message button + Messages block), Bench Pad (Message button on every card + Messages section). One component: `components/jobs/JobMessages.tsx` (`MessagesPanel`, `MessageComposer`, `MentionText`).
- **Thread** = a root message + replies (indented, oldest first); roots newest first. Every entry shows author · date/time · station · optional photo · a "→ @X @Y" chip naming who it was routed to. **Reply** opens an inline composer whose placeholder lists who will be re-notified.
- **Composer**: textarea (Enter sends, Shift+Enter newline), **@ picker** (opens when typing `@` or via the Mention button; filters by short/first name; each row tagged **hit list** or **bench** to show where the mention will land), **Photo** (`<input type=file accept=image/* capture=environment>` — rear camera on iPads, file upload on desktop), "Internal only · never client-facing".
- **Deep link**: `/jobs/:id#msg-<id>` scrolls to and highlights the message (hit-list pins use it; RW shell rewrites `/jobs/:id#…` → `/rw/jobs/:id#…`).

## Rules (code is truth)
- `postJobMessage(jobId, text, {parentId?, photoUrl?})`: mentions = every `@word` resolving to a user (short name or first name, case-insensitive), author excluded. A reply to a reply is normalised to the thread root. **Notify set** = mentions ∪ (for replies) every thread participant (root author, all reply authors, everyone previously mentioned) − the author.
- **Routing by tier** (`isManagerTier(u) = accessTier === 'manager' || roles includes 'concierge'`):
  - manager/concierge → a **hit-list pin** (`store.pinned`) for that person: title `@<author> on <job#>: "<preview…>"`, `jobId`, `messageId`; it renders on `/today` with a message icon and links to the thread; **Done** dismisses it (= handled).
  - bench tier (watchmaker, inspector without concierge role) → the message appears in their **Messages** section (Bench Pad / WM room) with an unread badge.
- **Read state per person**: `readBy[]` on each message; `getMessageInbox(userId)` groups my notified messages by thread (newest first, unread first) and `unread = any notified message not read by me`; `markJobThreadRead(rootId)` marks the whole thread read for the current user.
- A message with **no mention sits on the job** (notify = ∅) — the "ambient note".
- **Legacy `job.notes`** render as unrouted root messages (read-only history); new writes go to `jobMessages`.
- Every post stamps the job audit ("Message/Reply by X → @A @B · preview").
- Never client-facing: not surfaced in `/rc`, not in any template.

## Seed (walkable)
E02031 (Rosa's split job): Rosa "Crown is worse than the estimate shows @MM come look" (+photo) → MM reply "Adding crown to the parts request, @Vienna please prep a revised estimate" — MM's pin (from Rosa), Vienna's pin (from MM), Rosa's Messages row (re-notified). Ambient note on E02007.

## Client functions used
`getJobThreads`, `postJobMessage`, `getMessageInbox`, `unreadMessageCount`, `markJobThreadRead`, `isManagerTier`, `staffForMention`.

## Drift flags
- `⚠ DRIFT` Seeded threads are routed at module load (`routeMessage` over fixtures) — the pins exist from the first render; KEEPER routes at write time only.
- `⚠ DRIFT` Auto-created pins have no audit row; reads (`readBy`) are not audited (see `08` §36–37).
- `⚠ DRIFT` **Job Story (VB3-13) is not built**; the message ledger is designed as the Comms-lane source for it.
- `⚠ DRIFT` Photos are object URLs (lost on reload).
- Amber: whether an @role mention (`@manager`) should fan out to every holder (the hit-list quick-add supports roles; messages resolve users only) — Q84.
