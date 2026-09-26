# 06 — SEAMS (integration points and what the real implementation needs)

A **seam** is a place where the prototype fakes an outside system behind a `client.ts` function. KEEPER keeps the function's contract (`05-API-CONTRACT.md`) and replaces the inside. For each: prototype behaviour → real requirements → contract to keep → open decisions.

## 1. shippingProvider (labels · insurance · tracking · return labels)
- **Prototype**: `confirmShipment` fabricates a tracking string and a "label" record; `detectCarrier` pattern-matches tracking numbers (UPS/FedEx/USPS/DHL); declared value is a plain number; no rates, no return labels.
- **Real**: carrier API (EasyPost/Shippo-class or direct UPS/FedEx): address validation, rate shopping, **label purchase** (PDF/ZPL), **insurance** for `declaredValue` (luxury watches: verify carrier limits, third-party insurer fallback), **tracking webhooks** → SO status `shipped → delivered` (new terminal state to add), **return labels** for client-to-shop intake (pre-paid, insured, emailed via portal-first notification and shown on `/rc`).
- **Keep**: `confirmShipment({carrier, declaredValue, photos, bypassReason})` guards (address, photos ≥1, paid or bypass), custody close, "shipped" notification.
- **Decide**: insurer, who pays return shipping, delivered state semantics.

## 2. QuickBooks Online (accounting)
- **Prototype**: hard-stop stub — `fulfillSalesOrder` assigns `QBO-STUB-…`, `qboStatus: queued`; queue table with fake sync states; CSV exports.
- **Real**: OAuth2 app; on fulfil → create QBO Invoice (customer upsert by email/phone, items mapped from catalog codes, tax), on payment → Payment applied; on cancel → void; idempotency keys; error queue with retry and a manager "re-sync" action; nightly reconciliation report.
- **Keep**: registers, queue view, sync states (`queued | pushed | error`), audit `accounting`.

## 3. Outbox → real email + SMS channel
- **Prototype**: every client email is a pending `OutboxEmail` row; nothing sends; templates partly hard-coded (`⚠ DRIFT`, Q32); reply tokens are simulated.
- **Real**: transactional email provider (Resend/SendGrid-class) with **templates rendered server-side** from `message_template` + merge values (`07-COMMS-AND-TEMPLATES.md`); **SMS** channel (Twilio-class) for short notifications (pickup code, ready, shipped) with per-client channel preference; **inbound**: reply-to address per conversation (`reply+RS-<token>@…`) and SMS webhook → `message` rows routed by token, unmatched → General thread + needs-reply; delivery status back onto the notification row; unsubscribe/compliance.
- **Keep**: portal-first bodies, one notification row per event, thread `out` message with `emailId`.

## 4. Print queue → ZPL / Zebra
- **Prototype**: `Label` rows with payload strings; "Print" flips status.
- **Real**: printer registry (Setup → Printers) with network address; render **ZPL** templates per label kind (bag tag with **PDF417** `E#|SUB#|ref|serial|W,B`, ref/serial label, shipping label passthrough); print agent (local service or Zebra cloud/Browser Print); status callbacks; reprint with audit.
- **Keep**: payload format (scanners in `/rt` and `/rw/evidence` parse it), queue semantics.

## 5. NFC clock-in (RGTime)
- **Prototype**: "Simulate NFC tap" picker navigates to `/rg/clock?tag=<id>&sim=1`; tags are two fixture rows.
- **Real**: **write physical tags** (NDEF URL record `https://<host>/rg/clock?tag=<id>`; NTAG 213 for plain, **NTAG 424 DNA** for hardened); tag registry in Setup (location, division, secret); **hardening** (Q51): 424-style rotating SUN/CMAC parameter verified server-side and single-use, and/or geolocation check (`navigator.geolocation` within N m of the tag); server-side punch endpoint that rejects replays; PWA service worker for offline queue (Q53); corrections as append-only rows (Q52). RGTime owns staff identity (D-026) → RS/RW consume a staff directory API.
- **Keep**: one-tap confirm, toggle-on-last-punch, division from tag, manager week grid.

## 6. Companion panel → real model + M3KE store
- **Prototype**: scripted keyword answers over fixtures; citations point to fixture rows; verify/correct/route/label write local rows.
- **Real**: **M3KE store** = the evidence base (price evidence from estimate/job lines, verifications, client facts, corrections, knowledge cards, photo labels) with provenance; a model (LLM) that **must cite** store rows or answer "unknown → route to manager"; prompt/guardrails: no invented prices, money hidden per tier, division scoping (Q37); feedback loop from corrections; evaluation set from the prototype's scripted cases (`09-TEST-INVENTORY.md` iterations 20–21).
- **Keep**: the four tabs' contracts (`priceMemory`, `clientBrief`, `askShop`, `photoLabels` functions), citation shape, audit `companion`.

## 7. Photo storage → real bucket keyed to watch identity
- **Prototype**: every photo (intake, job, evidence, sign-in verification, proxy ID, handover) is a base64 data URL inside the record.
- **Real**: object storage bucket; key scheme `watch/<watch_entity_id>/<kind>/<job_entity_id?>/<ts>-<uuid>.jpg` so evidence and history follow the **watch** across jobs; signed URLs with short TTL for portal/report pages; EXIF strip; retention (Q31); thumbnails; sign-in photos and ID photos in a **restricted** prefix with stricter retention.
- **Keep**: photo captions, slot semantics, "photos required" guards.

## 8. Other small seams
- **Timing machine import** (Witschi export → `TimingInput`, Q49). **Camera** for sign-in photo (real device permission flow already modelled). **Universal search** → indexed search service. **Magic links / report tokens** → portal grants (D-E) with real email delivery.
