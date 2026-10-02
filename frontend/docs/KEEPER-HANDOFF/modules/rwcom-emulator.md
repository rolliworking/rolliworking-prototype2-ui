# Module — rw.com EMULATOR (`/rwcom` · public mount `/www`) — identify · check · request **[v2 2026-10-02]** — NOT KEEPER as a screen; KEEPER as behaviour of the public site

Rulings D-452…D-458 (`02` → "rw.com emulator"). Tested iteration_74. Code: `pages/RwcomPage.tsx` (mounted at `/rwcom`, sidebar **rw.com**, manager tier; and at **`/www`** outside `RequireAuth` as the public mount), `components/rwcom/{IdentifyTab, CheckTab, RequestTab, RwcomDev, rwState}.tsx`, engine seam `src/api/watchm8.ts` (MOCK, deterministic from photo bytes), landing `client.ts submitWebRequest` (L4524).

## 1. Why it exists
The real rolliworks.com pages (identify / check / request) are **out of this repo**; the emulator makes their behaviour concrete so MH could rule on it and so the RS landing (`/requests`) could be tested end-to-end. In KEEPER the public site posts to the same contract (`submitWebRequest`) and uses the real WatchM8 engine behind the same seam.

## 2. Frame and state
Toolbar: **Phone 390×844 (default) · Desktop** frame; entity switch **Rolliworks / RolliShop** (the HOST decides, never the visitor — division of the landed request = host entity, D-457); dev-only **Instrumentation** toggle (`RwcomDev`: shown · captured · retaken · abandoned per tab + engine calls method / ms / result / device, console mirror `[wm8] {json}` — D-458, NOT KEEPER). **URL = state**: `?tab=identify|check|request&frame=desktop&ref=16233&claim=WM8-XXXX&entity=rollishop`; unknown claim → dismissible `claim-note`. Shared visitor state `rwState.ts` (`HandoffSession`, `Claim`, `maskSerial`).

## 3. Tabs
- **Identify** (`identifyModel` → top-3 candidates → bracelet → result; question-tree fallback `QUESTION_TREE / questionNode`; serial era `eraFromSerial`; share card; **claim codes** `saveClaim / findClaim` so an anonymous result can be claimed later — D-417/D-453).
- **Check** (ref + serial → required dial + bezel shots, optional clasp / end links → `rankVariants` → `VariantReport` with similarity %, **tie** flag (< 5 pts), per-variant serial-era line; **Bracelet** authority line always present (`braceletCheck` — "not checked" without the optional shots); framing sentence "Consistency check against reference data — not an authentication." — D-456).
- **Request** (brand boxes Rolex · Tudor · Cellini; 9 legs `LEGS` incl. Authentication + Passport inspection; typical range `typicalFor / typicalLine` blank until ref + ≥ 1 leg, never $0; photos auto-attached from the session / claim (stage 0 · web · uncontrolled); masked serial; condition checklist; contact; drop-off / ship → `submitWebRequest(WebRequestInput) → WebRequestResult` → **RQ-26-####** unowned on `/requests`, `source = 'web'`, dots empty, General-thread entry, ack email to Sent with the RolliConnect first link, `kiosk` audit row — D-457).

## 4. Engine seam (`watchm8.ts`) — MOCK
`SHOTS / ShotSpec`, `REFS / RefRow / refByCode`, `MODELS`, `identifyModel(photoBytes…) → IdentifyResult {candidates, band: high | medium | low}`, `rankVariants → RankedVariant[]`, `braceletCheck → BraceletResult`, `consistency`, `startHandoff / saveClaim / findClaim`, `instrument / onInstrument / instrumentLog / clearInstrumentLog`. Distinct from the **labels export** (`inspectionLabels.ts watchm8Export`) which feeds WatchM8; this seam **reads** from it. Real: HTTP client to the WatchM8 service, same return shapes.

## 5. Open for MH
Web requests number as **RQ-** (per the 2026-09-27 RQ-vs-SUB ruling); the brief once said "SUB-" — confirm (Q103). In hybrid / LIVE mode `/requests` reads live leads, so the landing check needs mock mode.
