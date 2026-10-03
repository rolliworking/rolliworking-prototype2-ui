# Client portal — BUILT vs PLACEHOLDER (against the 2026-10-01 tier ruling)
Filed 2026-10-01 · prepared by Emergent for MH · companion to "Client portal — what's public, what's link-only, what's behind sign-in" (MH ruling, D-418 for Cursor)

Updated 2026-10-01 after the P0 + LINK-tier build (see DECISIONS "CLIENT PORTAL — THREE TIERS"); **v2 addendum 2026-10-02** (rw.com emulator, Request Builder) marked **[v2]**.

Legend · **BUILT** works end-to-end in the prototype on mock data · **PARTIAL** exists but misses part of the ruling · **PLACEHOLDER** stub, copy or nothing · **CONFLICT** built, but differently from the ruling (needs an MH call)

## 1 · The three tiers — how the prototype implements them today
| Tier (ruling) | Prototype today | Status |
|---|---|---|
| **PUBLIC** — no auth, nothing client-specific | `/rc` login, `/rc/signup`, `/rc/report/:token` (default public, manager-lockable), `/rc/pickup/:token`, `/pay/:token`. Draft banner on every RC page. | BUILT for the surfaces that exist; the rolliworks.com pages (`/identify`, `/check`, bracelet check, articles) are **not in this app** |
| **LINK** — signed, scoped, expiring token in the URL, one object one purpose | Tokens exist for: pay (`/pay/:token`, life of invoice), inspection report (`/rc/report/:token`, no expiry), inspection form (`/rc/inspection/:token`, login by default), pickup confirm (`/rc/pickup/:token`, single-use, **10 min** today), signup one-time link (`/rc/signup?token`). Tokens are random ids — not signed; no per-type expiry table; no revocation; the Sent page logs emails but not every link send. | PARTIAL — see §3 |
| **SIGNED-IN** — email one-time code / magic link (Supabase Auth, **no passwords**), Touch ID / Face ID once enrolled | **Rebuilt 2026-10-01**: `/rc` email → 6-digit code or emailed magic link (`/rc/auth/:token`, single-use, 10 min, 5 attempts, resend cooldown); first verified code creates the account and attaches it to the client on file; Touch ID enrol/remove on Account (`rc:<clientId>` credential); password + TOTP retired (D-357 superseded). | BUILT (MOCK challenges in localStorage; Supabase Auth = Keeper) |

## 2 · Placement — every client-facing surface in the ruling
| Surface | Ruling tier | Prototype | Where | Gap to the ruling |
|---|---|---|---|---|
| rolliworks.com pages, ref pages, articles, care guides | PUBLIC | — | website | out of scope for RolliSuite; nothing to build here |
| `/identify`, `/check`, bracelet check (results saved only with identity or claim code, D-417) | PUBLIC | **EMULATED [v2]** | `/www?tab=identify\|check` = public mount of `RwcomPage` (`modules/rwcom-emulator.md`); claim codes `watchm8.ts saveClaim / findClaim` (in memory) | the real public pages live on rolliworks.com; the emulator is NOT KEEPER; `claim` must persist (D-453) |
| Request service form → lead / client, acknowledgment email carries the first link | PUBLIC | **BUILT (emulated) [v2]** | `/www?tab=request` → `submitWebRequest` → **RQ-26-####** unowned on `/requests`, `source = 'web'`, ack email with the RolliConnect first link (D-457) | numbering: RQ (web / portal) vs SUB (physical receiving) — MH to confirm the brief's one "SUB-" mention (Q103); the real form posts to the same contract |
| **Request Builder** `/rc/request/new` — regular client (one watch line, range → Draft estimate) / trade (multi-line shipment, Duplicate +n, Auto-quoted or Estimate queued) **[v2]** | SIGNED-IN only (D-469) | BUILT | `RcRequestNewPage.tsx` → `RequestBuilder` (`modules/request-builder.md`); nav `rc-nav-request`, home `rc-home-request-service`; no session → redirect `/www?tab=request` | trade waivers are chips (no `client_waivers` entity); `ref_bracelets` prefill + per-line L# barcodes not built |
| Estimate approval `/rc/estimates/:id` | LINK (+ portal); money action → OTP even on link | BUILT (2026-10-01) | `RcEstimatePage.tsx` + `?t=<token>` (`portalGetEstimateByLink`); every estimate send issues the link; Approve → `StepUpModal` (emailed code / Touch ID) → `requireStepUp` at commit; "Send us your watch" + Ask only via sign-in; `LinkFooter` pre-fills the email | tokens are random ids, not signed (Keeper) |
| Parts approval `/rc/parts/:id` | LINK (+ portal); same | BUILT (2026-10-01) | `RcPartsPage.tsx` + `?t=<token>`; parts-approval email carries the link; Approve → step-up | same as estimates |
| Invoice + payment `/pay/:token` | LINK (+ portal); QBO link; expires with the invoice; never shows other invoices | BUILT | `PayPage.tsx` (MOCK Intuit host), `/rc/invoices/:id` in portal; pay link = life of the invoice; one SO only | token is a random id, not signed; MOCK payment host |
| Shipment tracking `/track/:token` | LINK (+ portal); one shipment; label from the estimate link per D-374 | PLACEHOLDER | no route; carrier deep-links only (`concierge.ts trackingUrl`); label creation from the estimate exists (`RcSendWatch`, 2-use / $40k / domestic rules in RS) | **P1 already on the roadmap** — build the page + token + "delivery + 30 days" expiry |
| Pickup confirm `/rc/pickup/:token` (reverse QR) | LINK, **2 minutes**, one SO, satisfies the pickup second factor | BUILT | `RcPickupConfirmPage.tsx` + Pickup Station step 3 — single-use, bound to SO + station, **2 min TTL**, Yes / "That's not me" | kiosk-confirm variant not built |
| Inspection report (client version) | LINK (+ portal); shareable rows only, opinions off by default; watermarked with client name | PARTIAL | `/rc/report/:token` public by default, approve / decline / ask, opinions excluded unless shared; also listed on `/rc/home` watch cards | no watermark, no 90-day expiry, no re-send from the portal |
| Passport share page (view-once / listing / permanent, I-058) | LINK, owner-created | PLACEHOLDER | — | passport object, share tokens, masked serial, open log: none |
| Portal home `/rc/home` — all watches, dots, process flow, history | SIGNED-IN | BUILT | `RcHomePage.tsx`: Needs-you list, watch cards with W·B·P dots, request cards, process flow, history; first-run note shown once per account | — |
| Watch page — unlocked photos, timeline, passport | SIGNED-IN | PARTIAL | `RcWatchPage.tsx`: documents, service history, photo sections with per-photo unlock | passport section does not exist |
| Messages / Ask (portal threads → RS Inbox); red-dot tap → approval or pre-drafted Ask (D-426 / D-427) | SIGNED-IN | BUILT | `RcMessagesPage.tsx`, `RcDots.tsx` dot → `/rc/estimates/:id` · `/rc/parts/:id` · Ask (`askContext`, `AskDraft`), lands in the RS Inbox anchored to the job (role concierge); staff reply via `AskDraftCard` → portal + email; **staff replies follow the thread channel** (portal → RolliConnect Messages, D-466) | — |
| Add-on confirmation (phone approvals pending, D-405) | LINK (+ portal) | PLACEHOLDER | RS side only (`AddOnsPanel.tsx` phone approvals) | no client-facing confirm link |
| Authorized pickup persons | SIGNED-IN + re-verify | **BUILT** (2026-10-03, D-506 → KEEPER D-414) | `/rc/account` — add (`portalAddAuthorizedPickup`, step-up `STEP_UP_ACTION.pickupPerson`) / remove; the Pickup Station trusts the list (no manager approval, ID photo still required) — `specs/SPEC-PICKUP-V2.md` row 5 | — |
| Contact details, notification prefs | SIGNED-IN + re-verify | PLACEHOLDER | `RcAccountPage.tsx` shows sign-in method, Touch ID, and a labelled PLACEHOLDER card for these two | sections + re-verify (step-up seam exists: `requireStepUp`) |
| Passport transfer (claim code redeem, new owner) | SIGNED-IN | PLACEHOLDER | — | none |
| Claim results from an anonymous tool session (claim code) | SIGNED-IN or identity on results page (D-417) | PLACEHOLDER | — | none |
| Appointment booking / reschedule | LINK (from confirmation email) + SIGNED-IN | PARTIAL | `/rc/invoices/:id` lets the signed-in client **pick a pickup window** (date + slot) and submit shipping info | no emailed link variant, no reschedule, no general appointment object |

## 3 · Cross-cutting rules
| Rule | Prototype | Status |
|---|---|---|
| A link does one thing; "see all my watches" from a link = create / sign in | Estimate / parts link pages hide portal nav, show `LinkFooter` (Create your account / Sign in, email pre-filled); report + pickup + pay stay single-purpose | BUILT |
| Everything link-only is also inside the signed-in portal | Invoices and reports are listed on `/rc/home`; pickup confirm is not (ephemeral, fine) | BUILT for what exists |
| Same email = same person: link carries client id, "Create your account" pre-fills the email, OTP proves it, account auto-attaches | `ClientLink.email` → `/rc?email=…&mode=create`; first verified code creates + attaches the account | BUILT |
| Sensitive actions re-verify even when signed in (money, contact details, pickup persons, passport transfer) | approve estimate / approve parts / pay balance → `requireStepUp` (fresh ≤5 min grant, action-bound, consumed); contact details / pickup persons / passport transfer not built | BUILT for money · PLACEHOLDER for the rest |
| Tokens scoped + signed, per-type expiry, Sent logs every send, revoked link copy "this link has expired — sign in to see your watch" | `ClientLink` (estimate / parts): sends logged + Sent row per send, opens counted, manager revoke (`ClientLinksCard` on the estimate detail), `LINK_EXPIRED_COPY` everywhere; `LINK_EXPIRY` table in Setup ▸ RolliConnect access; pickup = 2 min | PARTIAL — ids not signed; report 90-day expiry not enforced |

## 4 · Expiry defaults — ruling vs prototype
| Link type | Ruling | Prototype |
|---|---|---|
| Estimate / parts approval | until decided, re-sent on nudge | n/a (login only) |
| Pay | life of the invoice | life of the invoice ✓ |
| Track | delivery + 30 days | not built |
| Pickup confirm | **2 minutes** | 2 minutes ✓ (`REVERSE_QR_TTL_MS`) |
| Inspection report | 90 days, re-sendable | no expiry |
| Passport listing share | owner-set, default 30 days | not built |
| View-once | single scan | not built |

## 5 · Portal home for a first-time sign-in
Lands on `/rc/home` with watches, Needs-you, requests and history — ✓. First-run note "Links we email you still work; here you can see everything in one place." shows once per account — ✓ (2026-10-01).

## 6 · Suggested build order (for MH to re-order)
- ~~P0 — align what exists~~ DONE 2026-10-01 (pickup 2 min · link footer · expired copy · first-run note).
- ~~P1 — the sign-in decision~~ DONE 2026-10-01: passwordless OTP / magic link + Touch ID; password + TOTP retired (DECISIONS).
- ~~P1 — LINK tier for money~~ DONE 2026-10-01 for estimate + parts (tokened pages, step-up on Approve, Sent log, revoke, expiry table). `/track/:token` stays P1 (fold into drop-off / ship flows).
- **P2 — account**: ~~authorized pickup persons~~ (BUILT 2026-10-03) · contact details · notification prefs, each behind re-verify.
- **P2 — new objects**: add-on confirm link (D-405) · appointment booking / reschedule · inspection report watermark + 90-day expiry.
- **P3 — passport**: share page (view-once / listing / permanent), masked serial, open log, transfer via claim code; anonymous tool results claim (D-417).
