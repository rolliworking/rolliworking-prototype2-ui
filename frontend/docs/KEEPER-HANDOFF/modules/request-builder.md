# Module — REQUEST BUILDER + RATE CARD + rw.com submission **[v2 2026-10-02]**

Rulings D-468…D-472 (+ D-418 portal signed-in only, D-457 web landing). Tested iteration_78 / 79. Code: `components/requests/RequestBuilder.tsx` (+ `RequestLines`, `OutcomePill`), `pages/RequestNewPage.tsx` (`/requests/new`), `pages/rc/RcRequestNewPage.tsx` (`/rc/request/new`), `pages/setup/RateCardPage.tsx` (`/setup/rate-card`), `src/api/requestBuilder.ts` (pure helpers + rate card store), `client.ts` sections "rolliworks.com structured service submission" (L4524) and "PORTAL REQUEST BUILDER" (L4547).

## 1. One builder, three audiences (`BuilderMode = 'client' | 'trade' | 'staff'`)
| mode | who / where | lines | outcome |
|---|---|---|---|
| client | signed-in regular client at `/rc/request/new` (nav `rc-nav-request`, home `rc-home-request-service`) | one watch line, typical **range** only | **Draft estimate** (`outcome: 'draft'`) |
| trade | signed-in client with `Client.type === 'trade'` | multi-line shipment: watch + band lines, **Duplicate +n** (copies share `groupId`, labels 1/(n+1)…, copies start without a polish #, remove → renumber), pre-approvals / waivers chips (free text), tracking # / PO / pieces | **Auto-quoted** when `Client.autoQuote` AND every line resolves in the rate card (estimate created + marked sent, quote email, RQ `quoted`); otherwise **Estimate queued** (auto-quote off → every line "Estimate queued"; a line without a rate → "· needs rates") |
| staff | `/requests/new` "New request on behalf of client" (button `requests-new`; `?client=<id>` preselects, client state follows the URL), `source = 'staff'` | same as trade when the client is trade; every line shows quote key + rate or **Add rate for this key →** (`/setup/rate-card?key=…` prefilled) | per the client's type |
There is **no public mode**: `/rc/request/new` without a portal session redirects to `/www?tab=request` (`PUBLIC_REQUEST_PATH`, D-469) — the rw.com emulator's Request tab, which already yields an unowned `RQ` with `source = 'web'` (D-457, `submitWebRequest`).

## 2. Quote key (D-470)
`quoteKeyFor(line)` = `<ref or BAND>-<legs> · <material> · <type> · <construction>`; `legsForJobTypes`: movement → W · case / bezel / polish (band lines) → P · band → B · other → no leg (quoted by estimate). Bracelet config cascades `MATERIALS` → `BAND_TYPES` → `CONSTRUCTIONS` (`BraceletConfig`). The same key is shared by the request line (`RequestLine.quoteKey`), the rate-card row (`rowKey`) and the estimate line. ⚠ NOT BUILT from the brief: bracelet pre-fill from a `ref_bracelets` table; per-line **L# barcodes** (lines are numbered n/N only).

## 3. Rate card (D-472) — `/setup/rate-card` (Setup card `setup-open-rate-card`, manager tier)
`RateCardRow {id, ref | 'BAND', legs, material?, type?, construction?, price? | priceLow?/priceHigh?, days, version, editedBy, editedAt, active}`; `getRateCard`, `saveRateCardRow(RateRowInput)` (duplicate keys refused, edits bump `version`), `matchRate(line)` = exact ref row first, BAND rows for band lines, blank bracelet fields are wildcards, most specific wins; `liveRateSync` re-resolves a stored line against today's card (the Requests sheet shows the live match). Seeds rc-01…rc-18.

## 4. Submission (`submitBuilderRequest(BuilderSubmitInput) → BuilderSubmitResult`)
Creates the `ServiceRequest` (`lines[]`, `builder {mode, autoQuote, outcome, shipment?, unresolved[]}`, `legs` = union, `photos`), the General-thread entry (`ensureRequestThread`), and — for `quoted` — the estimate (lines from rate snapshots, `requestId`, marked sent) + quote email to Sent; `queued` leaves a draft estimate flagged for pricing. Audit `kiosk` row (same family as web / kiosk submissions). `/requests` rows carry `request-outcome-<rq>`; the sheet shows `RequestLines` + `OutcomePill`.

## 5. Seeds
Vidal (c-25) + RolliShop internal (c-31) trade, auto-quote ON; **Hartwell & Co. (c-11)** trade, auto-quote OFF; regular clients draft only.

## 6. KEEPER notes
- Trade waivers are chips today — `client_waivers` entity (kinds `ship_direct`, `terms_standing`, `pre_approve_links`, approval methods, inheritance to jobs, ship-step behaviour) is **PLANNED**, not built (`04`).
- Rate card = a versioned table; KEEPER keeps `version` on every quote snapshot so a re-priced row never rewrites a sent quote.
- Audit: builder submission rides on type `kiosk` (⚠ DRIFT → own type `request_submitted`, family 56 in `08`); rate-card edits write `setup`.
