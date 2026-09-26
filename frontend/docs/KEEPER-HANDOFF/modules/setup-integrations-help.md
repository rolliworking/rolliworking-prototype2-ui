# Module — Setup · Integrations · Help · Audit log

## Setup `/setup` (manager) — panels
| panel | fields / actions | rules |
|---|---|---|
| Users | shortName, displayName, roles[], accessTier, division, password, PIN; add / edit / deactivate | not self, not the last manager; audited `setup` |
| Catalog services | code (dept), description, default price, live/retired | used by the estimate line editor |
| Message templates | key, subject, body with merge fields (`MERGE_FIELDS`), channel | edits are stored but **not yet used by all Outbox writers** (`⚠ DRIFT`, P2 backlog) |
| Locations | stock locations (name, division?) | inventory |
| Printers | name, kind, location | labels |
| Stations | list with division badge; rename; register/reset device | see auth-stations |
| Audit log `/setup/audit-log` | last 60 events; filter chips: All · Sign-ins · Station · Intake · Estimates · Jobs · Sales · RolliConnect · Kiosk · RGTime; shows photo thumbnails for password sign-ins | `08-AUDIT-TAXONOMY.md` |

## Integrations `/integrations` (manager)
Health tiles, all `not_connected` or `stub`: QuickBooks Online, Shipping carriers, RolliTime (runs inside the prototype, manual entry), Email. Each tile = a seam in `06-SEAMS.md`.

## Help `/help`
Guides, keyboard shortcuts (Alt+T quick-add, Alt+M companion), support text. Static content.

## Behaviours discovered during build
- Audit filters for Kiosk and RGTime were added in E13 after testing flagged their absence.
- The audit log is capped at 60 rows in `localStorage` — display convenience only; KEEPER keeps everything.
