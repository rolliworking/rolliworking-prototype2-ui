# 13 — INTEGRATION GAPS (read this first — one line per seam: what the real build needs that the prototype does not know)

| # | seam (→ `11-INTEGRATIONS.md`) | gap |
|---|---|---|
| 1 | Client seam / staging API | a server-side session model (`/auth/sign-in` returns a token per device; the app keeps it in localStorage) — needs refresh/expiry, single-session invalidation, and the ~350 mock-only functions given real endpoints (`05-API-CONTRACT.md` "auth expected" column). |
| 2 | QuickBooks Online | Intuit OAuth2 client id/secret + realm id (server-side), invoice/customer create-update with `SyncToken`, a webhook receiver for payments, and MH's decision on who owns the zero-balance exclusion list. |
| 3 | Parcel Pro / shipping | `PARCELPRO_API_KEY` as a server secret, shop ship-from account, tracking webhook receiver (replaces "Simulate tracking event"), label PDF storage, MH decision: one adapter for inbound + outbound + vendor PO (intent: yes). |
| 4 | Sent / email | a sending provider (Resend/SES) with a verified shop domain, bounce/delivery webhooks onto the comms thread, and per-staffer "from" policy (shop vs personal signature). |
| 5 | Intercom / paging | Daily.co (or equivalent) API key, one room per station pair + a broadcast room, device audio permissions on pads, MH decision on who may page all. |
| 6 | AI (Claude) | production Anthropic key on the server (today: Emergent key), retention policy for uploaded sheet images, human-verify step kept mandatory. |
| 7 | M3KE | nothing external — needs a durable append-only store for `m3ke.events` and the aliases table (today in memory). |
| 8 | Camera / photos | object storage (watch+job+slot keys, thumbnails), a station→camera role map (IPEVO vs microscope) per registered station, HTTPS for `getUserMedia` on every device. |
| 9 | Label printing | a printer agent per station (Zebra ZD421 ZPL / Brother QL raster) or a print server; label template in ZPL; copy presets kept. |
| 10 | Scanner input | nothing external — but every kiosk/pad needs a wedge scanner paired; decide whether camera decoding is wanted as fallback. |
| 11 | Sign-in / stations / kiosks | station tokens for `/kiosk`, `/rg/kiosk`, `/wm-kiosk` (D-384 device records exist in the seed, not enforced), Touch ID / WebAuthn (MH decision), per-device idle policy incl. reception 5-min, single-session enforcement, secure photo storage for sign-in snapshots. |
| 12 | View-as (D-385) | server-side impersonation token that carries `actor` + `on_behalf_of` on every write; audit `view_as_started/ended` persisted centrally; owner allow-list from the user record, not `OWNER_USER_ID`. |
| 13 | Notifications / push | a Web Push (or APNs via MDM) channel for pad inbox + hitlist mentions; today nothing polls. |
| 14 | Telephony (Vonage) | Vonage VIP account + webhook receiver → `onInboundCall`; number→client matching rules; recording/voicemail storage decision. Google Home/Nest and Microsoft Graph: not started — MH to decide whether they are in scope at all. |
| 15 | Device type (D-384) | the registered station record must supply `deviceType`; remove the touch/width heuristic and `?device=` override at cut-over. |
