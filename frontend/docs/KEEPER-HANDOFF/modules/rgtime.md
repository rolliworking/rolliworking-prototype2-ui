# Module — RGTime `/rg` (NFC-tap time-clock, phone PWA)

## Ruling (locked)
Staff clock in/out from their own phones. RGTime is an installable web app (manifest `/rg-manifest.webmanifest`, start URL `/rg`, standalone, portrait; icon `/rg-icon.svg`); the login is **remembered per staff member per device**. Physical NFC tags at fixed locations encode `/rg/clock?tag=<tag-id>`; tapping opens the clock page which already knows the person (remembered login) and the place (tag) → **one confirm button** → punch `{person, tag, location, division (from tag), timestamp}`. Clock-out is the same tap. In KEEPER **RGTime owns staff identity (D-026)**; RS reads it — the prototype reads the shared users fixture.

## Screens
- **Sign-in** (all staff cards — a phone is not station-bound) → password → "Remember me"; "Forget phone" clears.
- **Home** `/rg`: status card (On/Off the clock, since + location, hours today), today's punches (IN/OUT, location, time, "simulated" marker), **Simulate NFC tap** picker (prototype only: choose a tag → navigates to the real tag URL with `&sim=1`), Manager view link (manager tier).
- **Clock** `/rg/clock?tag=<id>`: tag location + division + current state → big **Clock in/out — <name>** button → "Clocked in/out" confirmation, auto-return after 4 s. Unknown tag → error page. Wrong division → error ("<name> is Rolliworks staff — this tag belongs to RolliShop").
- **Manager view** `/rg/manager`: card + **password**, manager tier only (even on a remembered phone). Week grid Mon–Sun: rows = division staff, cells = hours (paired in→out; open punch amber and accruing live if today), week total, on-the-clock dot; prev/next week (next disabled at current week); division toggle for `both` staff; tap a cell → day detail with punches.

## Data
`NfcTag {id, label, division, url}` (seed: `tag-fd-rw` Front Desk — Rolliworks, `tag-rs-counter` RS Counter). `Punch {id, userId, kind in|out, at, tagId, location, division, simulated}` — **append-only**, kind toggles on the person's last punch. Projections `ClockState`, `WeekView`. Session key `rollisuite.rg.session`. Audit `rgtime` (+ `sign_in/sign_in_failed/sign_out` with station "Phone (RGTime PWA)").

## Rules
- A division-scoped staff member cannot punch on the other division's tag; `both` staff can use any tag.
- No punch edits or corrections exist (Q52). No offline queue (Q53). No service worker — the PWA is manifest-only.

## Hardening (recorded for KEEPER, not built — amber Q51)
Plain NFC tags are cloneable and the URL is bookmarkable (a saved link could clock in from home). Options: (a) NTAG 424 DNA-style rotating tap codes (SUN/CMAC in the URL, server-verified, single-use); (b) geolocation sanity check on punch (device within N m of the tag's known position); (c) both.
