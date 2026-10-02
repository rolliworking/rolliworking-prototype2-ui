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
| 16 | SMS (Vonage Messages, `telephony.sendSms`) **[v2]** | Vonage Messages API key + sender id (10DLC / toll-free registration in the US), opt-out handling, delivery receipts written to the SO timeline; MH decision: which notices may go by SMS (today only the pickup code resend). |
| 17 | Client portal passwordless (Supabase Auth) **[v2]** | Supabase project + `signInWithOtp` (code + magic link), server-side step-up grants bound to `{session, action, nonce}`, signed scoped LINK tokens with the per-type expiry table (`14 §4`), WebAuthn credential storage per client; retire the `localStorage` challenge store. |
| 18 | WatchM8 engine (`watchm8.ts`) **[v2]** | the WatchM8 service endpoint + key, reference tables owned by the service, a persisted `claim` table for anonymous results (D-453), rate limiting on the public form POST (`submitWebRequest`), the public site itself (rolliworks.com) — the emulator is NOT KEEPER. |
| 19 | QR / barcode decode **[v2]** | decide whether camera decoding (jsQR at the pickup counter, `BarcodeDetector` on pads) ships at all or every station pairs a wedge; if camera decoding stays, pin the library and the camera role per station (`station_camera`). |
| 20 | Claude read-serials (`/api/ai/read-serials`) **[v2]** | production Anthropic key, image retention for intake / hand-back crops, `MOCK_OCR_MAY_PASS = false` in production (a mock read never releases a watch), confidence threshold (0.6 today) as a setting. |
| 21 | Pickup evidence camera / NVR **[v2]** | object storage with lifecycle rules for frames (90 d) and proxy ID photos (30 d, manager-only read), optional Reolink NVR clip reference per release (⚠ GAP in `specs/SPEC-PICKUP-STATION.md`), station → `cameraRole` map on the station record. |
| 22 | Offline scan queue (`offline.ts`) **[v2]** | server endpoint that accepts replayed scans with `scanned_at` (out of order, idempotent by scan id) and a conflict rule when custody moved in between; service worker for the cached board. |
