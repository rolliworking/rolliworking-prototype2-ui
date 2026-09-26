# Module — Auth · Stations · Sessions · Divisions

## Screens & layout intent
- **Station setup** (`/station-setup`): list of stations with division badge; register this device (manager card + password); rename; reset device. Dense admin table.
- **Sign-in** (`/sign-in`): staff cards of the station's division (photo-less card: short name, duty label, "signed in today" dot). First sign-in of the day = password + camera photo (camera optional: `captured | denied | no_camera`); later = 4-digit PIN "fast switch". Show/hide password toggle and a **prototype-only** "fill password" button (visible mock credentials — do not inherit).
- **Top bar**: station badge (name + division), user menu (Switch user → PIN), sign out.

## Fields
| field | type | required | validation |
|---|---|---|---|
| Station.name | text | yes | non-empty, unique per device list |
| Station.division | `rolliworks \| rollishop` | yes | fixed list |
| User.password | text | yes | exact match (prototype plaintext — replace with hashed credential store) |
| User.pin | 4 digits | yes | exact match; only accepted if the user already signed in with password **today** at any station |
| Verification photo | image | no | camera permission result recorded even when absent |

## Rules
- Session division = station division (`getSessionDivision()`, default `rolliworks` if unregistered — mock).
- Staff visible on the card list = users whose `division` equals the station's or is `both`.
- Tiers: `manager` (full write), `concierge` (client-facing, read-heavy). Route access by tier is enforced in the UI only (`TierGate`); module-level checks exist only for: registerStation, deleteJob, supervisorAssign, approve/reject parts, adminMarkComplete, amendComponentAttribution, rgVerifyManager. **KEEPER must enforce tier and division on every endpoint.**
- Audit: `sign_in` (method `password_photo` with camera status + photo, or `pin_switch`), `sign_in_failed`, `sign_out`, `station_registered/renamed/reset`.

## State machine
`source/STATE-MACHINES.md` §11 (Device, Staff session) and §12 (tier summary).

## Behaviours discovered during build
- Device auto-registers as `st-01 Front Desk 1` on first load so the prototype is usable — a mock; KEEPER requires explicit registration.
- Division was added after E1 (ruling 2026-09-24): the wall is the division, not the tier; MH is `both`.
- RGTime (`/rg`) and RolliConnect (`/rc`) keep their **own** sessions in separate `localStorage` keys; RolliWorking (`/rw`) and RolliTime (`/rt`) share the station session (prototype shortcut — in KEEPER each route-space authenticates separately; `/rw` is an access boundary).
- `⚠ DRIFT`: the sign-in photo is stored inline as a base64 data URL inside the audit row (capped log of 60). KEEPER: blob storage + reference.
