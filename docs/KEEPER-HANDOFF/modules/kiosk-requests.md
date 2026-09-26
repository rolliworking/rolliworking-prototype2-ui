# Module — Kiosk `/kiosk` (public walk-in check-in) · Requests queue `/requests`

## Kiosk — screens (full-screen, warm skin, no staff chrome, no session)
1. **Idle**: "Welcome — Touch to check in for service". 2. **Brand pick**: Rolliworks (service center) / RolliShop (boutique) wordmarks → sets the request's **division**. 3. **Services** (multi-select, all optional): Movement Service · Case Work · Band Repair · Band Polish · Recut Bezel; button reads **"Skip — Continue"** when none, "Continue (n)" otherwise. 4. **Form**: first name*, last name*, email*, phone*, notes (optional); Back / Check in. 5. **Thank-you**: name, brand, reference number; **auto-reset after 5 s**. Footer: brand + "Start over".
Idle handling: **dim overlay after 30 s** without input (touch to wake); a flow abandoned mid-way resets to idle after 2 min.

## Validation (server-side rule in KEEPER)
first/last non-empty · email matches `x@y.z` · phone has ≥10 digits (US; leading 1 stripped). Errors show inline under the form; the form uses `noValidate` so the rule text is the app's, not the browser's.

## Submission (`submitKioskCheckIn`) — side effects
- Normalise email (lower-case) and phone (digits). **Match** existing clients by email **or** phone: match → link the request to that client with `matchState: possible` and `matchedOn: ['email' | 'phone' …]`; no match → **create a client** (type retail, empty address, kiosk-sourced).
- Create `ServiceRequest {source: kiosk, status: new, division: brand, station: 'Kiosk', createdBy: 'Kiosk', summary: 'Kiosk check-in (<Brand>) · <services or "no service selected"> · "<notes>"', kiosk: {…}}`, number `RQ-26-nnnn`.
- Thread a `kiosk`-source inbound message into the client's **General** conversation (division = brand). Audit `kiosk`.

## Requests queue `/requests` (staff, both tiers, division-walled)
Header: open count · division · pending match count. Chips Open / All. Row: number, source icon (call/email/web/walk-in/kiosk), client link (+ kiosk contact line), summary, status pill, created (by/station), "Client 360 →" deep link. Kiosk rows with `matchState: possible` show an amber box: *"Possible existing client — kiosk gave "<name>", matched <client> on email + phone"* with **Confirm link** (→ `confirmed`) and **Not the same — new client** (→ `split`: creates the new client and re-homes the request and its kiosk thread). Both audited (`kiosk`). Legacy requests without a division count as rolliworks.

## Behaviours discovered during build
- Improves on the legacy kiosk, which silently created duplicate clients.
- Kiosk does not capture signature/ID/photos or create a drop-off package (Q54, Q55).
