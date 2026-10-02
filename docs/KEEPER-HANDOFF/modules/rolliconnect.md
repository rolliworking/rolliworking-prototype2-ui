# Module — RolliConnect `/rc` (client portal)

> **Superseded in part (2026-10-02):** magic-link / password + TOTP sign-in is retired — see **`../14-CLIENT-PORTAL-INVENTORY.md`** (passwordless OTP / magic link, Touch ID, LINK tier, step-up). Portal dots + Ask reply loop → `job-detail-v2-wbp.md` §4; `/rc/request/new` → `request-builder.md`; `/rc/pickup/:token` → `../specs/SPEC-PICKUP-STATION.md`.

## Screens & layout intent
Warm, customer-grade skin (cream paper, serif headings) — deliberately different from staff screens. Own shell, own session, no staff route reachable.
- **Login** `/rc`: email → "magic link" (prototype shows the link on screen; nothing is emailed). **Auth** `/rc/auth/:token` redeems.
- **Home**: my watches as cards with **plain-language status** (see projection), estimates awaiting me, requests card (open requests; close my own early requests with a reason), messages preview.
- **Estimate page**: lines (money shown to the client), approve / decline with reason. **Invoice page**: balance, pay-later text, pickup code or shipping-address form, **schedule pickup window** (creates a concierge task in rolliworks). **Watch page**: status, service history, evidence/timing summary. **Messages**: thread with staff. **Report page** `/rc/report/:token`: inspection report (component grades good/fair/worn/replace, photos, notes) with approve/decline; superseded → forwards to the newer version.

## Fields
| screen | field | validation |
|---|---|---|
| login | email | must match a client email |
| estimate decline | reason | required |
| report decline | reason | required |
| shipping address | name, street, city, state | required |
| pickup window | date + slot | from offered slots |
| message | text | non-empty |
| request close | reason `duplicate \| no_longer_needed \| mistake` (+ duplicate id) | own request, status `new` only |

## Status projection (`portalStatusFor`, job-first)
`source/STATE-MACHINES.md` §10: expecting · awaiting_approval · inspecting · queued · on_bench · awaiting_part · with_specialist · final_checks · finishing · preparing_ship · ready_pickup · on_its_way · back_with_you · on_file. Each key has customer wording.

## Rules
- Every portal write runs `asClient(clientId)` so audit/thread rows carry the client as actor and station "RolliConnect". `requireOwner`: the row's clientId must equal the session client.
- Portal events are **replayed** from `localStorage` on load (prototype persistence hack — `10-NOT-KEEPER.md`).
- Magic links: `⚠ DRIFT` not single-use and no expiry although the text says 15 minutes. KEEPER: single-use, 15-minute TTL, revocable.
- Portal-first (E15): everything the client reads lives here; emails are short notifications with `{{portal.link}}` (`07-COMMS-AND-TEMPLATES.md`).

## Behaviours discovered during build
- Approving an estimate on the portal also advances a linked job waiting on the customer; approving an inspection report approves its estimate.
- Client-side request close was added after staff close; portal can only close `new` requests.
- Decline on the report page had an error path fixed in iteration 23 (reason now lands on the job timeline).

## Post-E16 additions (2026-09-26) — View as client · Your requests · client photo sections
- **View as client** (VB3-14): `startViewAsClient(clientId, returnTo)` writes a portal session with `viewAs {by, at, returnTo}`; the shell shows the amber "VIEWING AS CLIENT — name" banner + "Exit to staff view" (`exitViewAsClient` → returns to the staff page). Same portal read functions as the client → staff-only data cannot leak by construction. Both start and exit are audited (`comms`). `⚠ DRIFT`: the prototype does not block client *actions* while viewing (approve / pay / message) — Keeper must make view-as strictly read-only (Q90).
- **Your requests** (`portalGetRequestCards`): one card per request across the lifecycle — in progress → decision → received → stale estimate → history; watch identity + reference on every card; stale (expired) estimate keeps its figure viewable with a "Ready to send it in?" CTA into Messages.
- **Photo sections** (VB3-15, `portalPhotoSections`): Arrival (package + intake) / Condition (inspection, client-visible slots) / Completed (finish photos + service evidence minus hidden serial / parts grading); grid + lightbox; staff-only slots excluded at the data layer (`STAFF_ONLY_PHOTO`).
- Seed client **Robert Calloway (c-30)** = the multi-request walk (R1 history · R2 expired/never received · R3 in service · R4 new web request); Client 360 flags never-received expired estimates with a red aging chip.
