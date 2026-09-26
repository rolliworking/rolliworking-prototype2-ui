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
| report issued / timing pass / notifications | system | "… notification queued with portal link …" | Outbox row |
Auto-thread rows are `in` for client actions (count as needs-reply — Q42) and `out` for system notifications.

## Internal notes and templates in the composer
Internal notes (`direction: internal`, source `note`) never leave the shop. The composer only sends via a template; body edits are allowed after rendering; photos attach from the job.
