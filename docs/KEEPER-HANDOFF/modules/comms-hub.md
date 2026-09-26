# Module — Comms hub `/inbox` (staff conversations)

## Screens & layout intent
Three-pane inbox: **views** rail with counts (Needs reply · Mine · Open · Snoozed · Closed), **thread list** (client, subject/anchor label, last line, unread badge, age, assignee), **thread-space** for the selected client: folder of that client's conversations (General + one per anchor: job, estimate, sales order, request), message stream (in/out/internal; source icon: portal, email, kiosk, approval, photo, parts, pickup, staff, note, system; reply token shown on outbound, matched token on inbound), composer with **template picker** (merge-field preview, missing-field warnings, attach job photos) → Outbox, **internal note**, assign (user or role), snooze (until), close/reopen, "Simulate inbound" (prototype-only), link to Client 360. Reply indicators appear on job cards and estimate rows; `/today` gets "Replies" rows.

## Entities
| entity | fields |
|---|---|
| Conversation | id, clientId, subject, anchor? `{kind job\|estimate\|sales_order\|request, id}`, status `open\|snoozed\|closed`, assignedTo? (user/role), division, createdAt, lastAt, lastInboundAt?, lastOutboundAt?, snoozedUntil?, closedAt/By?, tokenSeq |
| ConvMessage | id, conversationId, clientId, direction `in\|out\|internal`, source, by, station?, text, at, token? (outbound `RS-<seq>`), matchedToken?, readByStaff, photos?, emailId?, templateKey?, event? `{kind estimate_approved\|estimate_declined\|parts_approved\|parts_rejected\|pickup_window\|photo_submitted, refId, label}` |

## Rules
- `needsReply` = last inbound newer than last outbound and not closed. `Mine` = assigned to me or one of my roles. Snoozed threads wake at `snoozedUntil` or on any inbound (inbound also reopens closed).
- Reply-token routing (mock): outbound gets `RS-<n>`; a simulated inbound quoting the token lands in that conversation; unmatched inbound → the client's General thread. KEEPER: real inbound email/SMS parsing (`06-SEAMS.md`).
- Auto-threaded events (system/approval sources): portal estimate decisions, inspection-report decisions, parts approve/reject, pickup window, portal messages, kiosk check-in, RolliTime pass email, report issue — see `07-COMMS-AND-TEMPLATES.md`.
- Composer sends via templates only (`TemplateKey`); body rendered with merge values; queued to Outbox and threaded as `out`.
- Division: conversations carry a division; inbox is walled to the session division.

## Tier
Both tiers may reply/assign/snooze/close (Q41 asks whether concierge should close).

## Behaviours discovered during build
- The legacy `Message` store (portal messages) still exists beside `ConvMessage` (`⚠ DRIFT`, Q39) — portal reads `Message`; staff reads both through the thread-space.
- Kiosk (E13) threads its check-in into General with the brand's division.
