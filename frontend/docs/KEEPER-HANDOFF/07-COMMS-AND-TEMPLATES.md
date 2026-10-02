# 07 — COMMS AND TEMPLATES

## The portal-first principle (MH ruling, E15, locked)
**Emails notify; the portal renders.** No client content (estimates, reports, photos, invoices, timing results) is ever laid out inside an email. Every client message is a short notification with a **magic link** (`{{portal.link}}`) to the RolliConnect page where the content lives and where the client acts (approve, decline, schedule, pay-later). Same rule for SMS. Consequences: templates are short; the portal page is the document of record; decisions taken on the portal thread back into the Comms hub and flip statuses.

## Templates (Setup → Templates; `fixtures/rs.ts`; `TemplateKey`)
Merge fields available: `{{portal.link}} {{client.first_name}} {{watch.brand}} {{watch.model}} {{estimate.number}} {{job.number}} {{sub.number}} {{so.number}} {{pickup.code}} {{tracking}} {{balance_due}} {{shop.name}}`. A template's `mergeFields` = the fields present in its subject/body; the composer previews missing values.

| key | name | trigger (who/what queues it) | channel | subject | merge fields |
|---|---|---|---|---|---|
| intake_confirmation | Intake confirmation | `receivePackage` when client known | email | We've received your {{watch.brand}} {{watch.model}} | client.first_name, shop.name, sub.number, portal.link |
| estimate_sent | Estimate ready | `sendEstimate` (also "Updated estimate" on resend) | email | Your estimate {{estimate.number}} is ready to review | client, estimate.number, watch, portal.link |
| inspection_ready | Inspection report ready | `issueInspectionReport` | email | Your inspection report is ready — {{watch.model}} | client, watch, portal.link (`/rc/report/:token`) |
| job_in_progress | Job in progress | composer (manual) | email | Work has started on your {{watch.model}} | client, watch, job.number, portal.link |
| back_in_progress | Back to in progress (after QC) | `qc_fail` (reason in body) | email | A short delay on your {{watch.model}} | client, watch, portal.link |
| evidence_available | Service evidence available | composer / evidence complete | email | Your service evidence is ready to view — {{watch.model}} | client, watch, portal.link |
| invoice_ready | Invoice ready | `openSalesOrder`, `fulfillSalesOrder` | email | Your invoice {{so.number}} is ready | client, so.number, balance_due, pickup.code, portal.link |
| ready_for_pickup | Ready for pickup | `qc_pass`, pickup channel set / code regenerated | email (+SMS candidate) | Your watch is ready for pickup | client, pickup.code, portal.link |
| shipped | Shipped | `confirmShipment` | email (+SMS candidate) | Your watch has shipped | client, tracking, portal.link |
Other hard-coded bodies still exist in `client.ts` (`EMAIL_FOR` for job transitions, RolliTime "Testing complete", payment received/partial, where-to-ship, thank-you for pickup) — `⚠ DRIFT` (Q32): KEEPER renders **every** notification from a template row.

## Reply-token routing (design)
- Every outbound message gets a token `RS-<conversation.tokenSeq>` shown on the message; the real channel puts it in the reply-to address (`reply+RS-123@…`) and the SMS body.
- Inbound with a matching token → that conversation (`matchedToken`), marks needs-reply, wakes snoozed, reopens closed. Inbound with no match → the client's **General** conversation (client identified by sender address/number), flagged for triage. Unknown sender → a triage queue (not built; KEEPER needs it).
- Token TTL and format are open (Q40).

## Auto-threading events (system/approval source rows, `event` payload)
| event | source | text pattern | side effects |
|---|---|---|---|
| estimate_approved / estimate_declined | approval | "Approved estimate E… in RolliConnect" / "Declined …: reason" | estimate + job status flip; needs-reply |
| inspection report decision | approval (`estimate_*` kinds) | "Approved/Declined inspection report vN (job)" | job/estimate flip |
| parts_approved / parts_rejected | parts | "Parts request PR-… approved/rejected · part" | parts hold |
| pickup_window | pickup | "Client chose pickup window …" | concierge task |
| photo_submitted | photo | reserved (no portal upload yet) | — |
| kiosk check-in | kiosk | "Kiosk check-in (Brand) · services · RQ-… · possible existing client / new client" | request created |
| report issued / timing pass / notifications | system | "… notification queued with portal link …" | Sent row |
Auto-thread rows are `in` for client actions (count as needs-reply — Q42) and `out` for system notifications.

## Internal notes and templates in the composer
Internal notes (`direction: internal`, source `note`) never leave the shop. The composer only sends via a template; body edits are allowed after rendering; photos attach from the job.

## Post-E16 client emails (all Sent-only, portal-first unchanged)
| trigger | function | subject / body gist | undo / follow-up |
|---|---|---|---|
| Bulk assign scan starts work | `scanLabelAssign` → `queueJobEmail` "Work has started" | "<Tech> has started work on your watch today… track it in RolliConnect" | **Undo** withdraws the Sent row within 30 min (`undoOutbox`) |
| Parts request sent for approval (after manager gate) | `sendForClientApproval` | priced lines + portal link (decision simulated in prototype, Q77) | — |
| Inbound label created | `createInboundLabel` | label PDF link + tracking#, packing guidance | `resendLabelEmail` (same content), `followUpLabel` (nudge after aging), `voidAndReissue` (new label, new email) |
| Shipment status for client | `clientStatusLine(shipment)` | one plain-English line ("…is on its way to us with UPS, last scanned in Louisville…") — copy button today; intended for the portal tracking page and the shipping-update template (Q85) | — |

Never emailed / never portal: job **messages** (internal), client-request acknowledgments, M3KE events, bench goals.

## v2 additions (2026-09-30 → 2026-10-02)
- **Sent, not Outbox** (D-419 / D-467): the Sent record (`/intake/sent`, `getOutbox`) is what left RS; "Outbox" survives only as internal identifiers (`OutboxEmail`, `queueOutbox`).
- **Reply channel follows the thread** (D-466, `replyChannelSync(conversationId)`): the client's last inbound message came from the portal → `replyInThread` posts a staff message into RolliConnect Messages (`store.messages`, `ConvMessage.channel = 'portal'`, no email); otherwise email + reply token (`channel = 'email'`). **No SMS from the Inbox.** Composer chip `→ portal` / `→ email`; row chip `via portal` / `via email`.
- **Tags are pointers, not assignment** (D-443); **Share with staff** (D-446) quotes a client message into one-shot staff messages and logs "Shared with … by …" on the thread; the client never sees any of it.
- **Portal Ask** (D-427): a red portal dot without an approval to open sends a pre-drafted Ask into the RS Inbox anchored to the job (`ConvMessage.component`, role concierge); staff reply via `AskDraftCard` (edit · Regenerate with Claude · `sendAskReply` → portal **and** email).
- **Generate summary** (D-465) drafts client-facing status text into the reply box — plain-language status names only, never auto-sent.
- **New Sent-record emails**: pickup code **resend** (email) + **SMS** (`telephony.sendSms` MOCK, masked number, "Earlier codes no longer work", QR payload `RSPU:<SO>:<code>`); pickup **thank-you** on Done; **request acknowledgement** with the RolliConnect first link (web form `submitWebRequest`, builder `submitBuilderRequest`); **auto-quote** email when a trade request resolves in the rate card (D-471); **vendor emails** on SWO outbound / return label (`swo_outbound`, `swo_return_label`); **LINK-tier sends** — estimate / parts emails carry `/rc/estimates/:id?t=` / `/rc/parts/:id?t=` and every send is logged on the `ClientLink`; step-up code emails (`rcRequestStepUp`); portal OTP / magic-link emails (`rcRequestCode`).
- **Templates still missing a row** (⚠ DRIFT, Q32 widened): pickup code resend / SMS body, request acknowledgement, auto-quote, Ask reply, OTP / magic link, step-up code, long-term-storage notice (PLANNED) — all hard-coded strings in `client.ts` today.
