# 12 — ROLES AND ACCESS (as implemented, 2026-09-29)

Code is truth. Every name below is a real identifier in `/app/frontend/src`. Where the seed or behaviour disagrees with MH's corrections it is flagged **⚠ DRIFT** and left.

## 1. The two axes: `accessTier` × `roles`
`User` (`src/api/types.ts`): `{ id, roles: Role[], firstName, shortName, displayName, dutyLabel, accessTier: 'manager' | 'concierge', division: 'rolliworks' | 'rollishop' | 'both', password, pin }`.
- `Role` values used in the seed: `manager`, `inspector`, `concierge`, `watchmaker`, `polisher`, `band_tech`.
- `accessTier` is the permission tier every API check uses (`'manager'` gates everything money/assignment/setup; `'concierge'` is the bench/front-desk tier — **the name is historical: watchmakers and band techs are `concierge` tier too**).

## 2. `roleKind()` — the ONE landing/guard function (`src/config/roles.ts`)
```ts
export type RoleKind = 'watchmaker' | 'supervisor' | 'concierge' | 'manager';
const ROOM_ROLES = ['watchmaker', 'polisher', 'band_tech'];
roleKind(u) = manager tier ? (has room role ? 'supervisor' : 'manager') : (has room role ? 'watchmaker' : 'concierge')
ROLE_HOME = { watchmaker: '/rw/bench', supervisor: '/rw/pad', concierge: '/', manager: '/' }
desktopAllowed(k) = k !== 'watchmaker'   // RequireAuth
rwAllowed(k)      = k !== 'concierge'    // RwRoleGuard
padAllowed(k)     = k === 'supervisor' || k === 'manager'   // RwRoleGuard pad
homeFor(u) = ROLE_HOME[roleKind(u)]; hitlist.homeRouteFor(u) honours the per-user home-screen preference for concierge/manager only
```
Guards live in `src/App.tsx`: `RequireAuth`, `TierGate` (`canAccess(navItem, user)` from `src/config/navigation.ts` = `tiers.includes(accessTier) && (!ownerOnly || id === OWNER_USER_ID)`), `RwRoleGuard`, `RwManagerOnly`, `RoleRedirect` (toast + `<Navigate>`).

## 3. Manager-only and MH-only checks (where they live)
| check | function / place | what it gates |
|---|---|---|
| `a.user?.accessTier !== 'manager'` (≈40 sites in `client.ts`) | `assignTech`/`padSetTech` ("Assignment is a supervisor action"), parts approval, `gateScan` (safe in/out), `overrideScanGate`, `deleteJob`, `renameStation`, `setUser`/`deactivateUser`, `setJobPartsAllowance`, `setDeptGoal`, `getVarianceReport` ("Variance dollars are manager-only"), `managerOnly()` helper (QBO setup, RC doc access, appraisal signers) | writes |
| `canSeeMoney()` = `actor().user?.accessTier === 'manager'` | Companion panel (`companionCanSeeMoney`) | money in companion answers |
| `MoneyContext` (`src/components/MoneyContext.tsx`) — `RwShell` sets `roleKind(user) !== 'watchmaker'` | every `useFmtMoney()` in `/rw` (pad dashboard goals, quick-add allowance, review totals, parts prices) → `'—'` | money in the bench app |
| `OWNER_USER_ID = 'u-michael'`, `isOwnerSync()` = real user is MH **and not in View-as** | `getHitlist` (MH Accountability), `zeroBalanceNoSync`, `startViewAs`, nav `ownerOnly` | owner actions |
| `verifySupervisorPin(pin)` = any manager-tier PIN | bench lock overrides | pad unlock |
| `RwManagerOnly` | `/rw/qc`, `/rw/supervisor`, `/rw/bulk` | routes |

## 4. Concierge restrictions (as built vs ruled)
- Pad blocked: `rwAllowed('concierge') === false` → any `/rw/*` bounces to `/` with a toast. ✔
- Assign manager-only: API-level `assignTech` throws for non-manager ✔; **route** `/assign` is `MGR` on desktop ✔, but `/rw/assign` has no manager guard — ⚠ DRIFT (spec item 7, pending).
- Cycle counts without dollars: `/inventory/count` is `MGR` tier — concierge cannot count at all; ruled: concierge counts, no $. ⚠ DRIFT (item 7 pending). Variance $ is already manager-only inside `getVarianceReport`.

## 5. Reception mode (station flag, D-2026-09-29)
- Where: `Station.receptionMode?: boolean` (`types.ts`); seeded `true` on `st-01 Front Desk 1` and `st-02 Front Desk 2` (`fixtures/stations.ts`); localStorage station registry backfills the flag from the seed (`readStations` in `client.ts`).
- Override: `?reception=1|0` on any URL → `sessionStorage['rollisuite.prototype.receptionOverride']` (this browser session). `isReceptionMode()` / `receptionSource()` exported from `client.ts`.
- Hides: in `resolveIdentifierMock` the client hit's `inHouse` (IN-HOUSE badge + estimate numbers) is dropped, so `SearchHitList` renders a plain row and in-house clients no longer sort first. TopBar shows `header-reception-badge` (`data-source` = station | query).
- **5-minute idle sign-out: not built** ⚠ DRIFT (only the Bench Pad has an idle re-lock, `BenchSettings.idleMinutes`, default 10).
- Applies to every role on that station (it is a station flag) — managers pass `?reception=0` to see badges.

## 6. Sessions
- Real sign-in = `localStorage['rollisuite.prototype.currentUserId']` (device-bound, one user per device at a time; PIN fast-switch replaces it). `signOut` clears it and the View-as key.
- **Single-session enforcement (one device per person): not built** ⚠ DRIFT — the same account can be signed in on two devices; nothing invalidates the other.
- RGTime (`/rg`) keeps its own remembered phone session; RolliConnect keeps `rcSession`; kiosks have no session.

## 7. View-as (D-385) — owner only
- Storage: `sessionStorage['rollisuite.prototype.viewAsUserId']` (this tab only). Never touches `currentUserId`, never creates/ends the viewed user's session.
- Identity split (`client.ts`): `realUserSync()` = device sign-in · `viewAsSync()` = viewed user **only when real user is `OWNER_USER_ID`** · `currentUserSync()` = `viewAsSync() ?? realUserSync()` → every guard, scope, landing, hidden field and permission check evaluates the VIEWED user (MH viewing MM is bounced from desktop routes exactly like MM).
- Attribution (D-361): `actor()` → `{ by: 'MH (as MM)', onBehalfOf: 'MM', user: viewed }` — every `createdBy/completedBy/by` string carries both names and never equals `'MM'`, so completions, components, hitlist rows and goals are never credited to the viewed user. `appendAudit` stamps `userShortName = 'MH'`, `userDisplayName = 'MH — … (as MM)'`, `onBehalfOf = 'MM'` on every event while active (Audit log shows an `as MM` chip, `audit-obo-<id>`).
- API: `getViewAs(): Promise<{ real: User; viewing: User | null } | null>`, `startViewAs(userId): Promise<User>` (throws for non-owner), `stopViewAs(): Promise<void>`. Audit types `view_as_started` / `view_as_ended` (who, whom, station, when; switching person emits ended+started).
- UI: `src/components/layout/ViewAs.tsx` — `ViewAsPicker` (TopBar + RW shell header, owner only), `ViewAsBanner` (fixed, every screen incl. kiosks: "Viewing as MM — actions are recorded as MH (as MM)", exit → `/` on desktop, `/choose-view` on a pad), `useViewAs()`. `src/pages/ChooseViewPage.tsx` = `/choose-view` (pad tiles: `roleKind ∈ {watchmaker, supervisor}` + Front-desk check-in kiosk `/kiosk` + Photo kiosk `/wm-kiosk` + My own view). `SignInPage.onDone` → owner && `isPadDevice(station)` → `/choose-view`.
- Blocked while viewing: anything the viewed role cannot do (same checks) **plus** owner-only actions (`isOwnerSync()` is false in View-as). Managers (Walter, Vienna, JV) never see the picker.
- Device type (`src/config/device.ts`): `station.deviceType` (D-384) → `?device=ipad|desktop` session override → touch + width ≤ 1366 heuristic. **Prototype only** — see `10-NOT-KEEPER.md`.

## 8. Seed identities (`src/api/fixtures/users.ts`, `stations.ts`)
| short | name / duty | roles | tier | division | `roleKind` | lands on |
|---|---|---|---|---|---|---|
| MH | Michael — Inspector · Manager (**owner**) | manager, inspector | manager | both | manager | `/` (pad: `/choose-view`) |
| Walter | Inspector · Manager | manager, inspector | manager | rollishop | manager | `/` |
| Vienna (VC) | **Operations Manager** | manager | manager | rolliworks | manager | `/` |
| JV | **Workshop Supervisor (band/polish)** — Joseph; supervises Dre/Sam/Nico/MAM | manager, polisher, band_tech | manager | rolliworks | supervisor | `/rw/pad` |
| MM | Watchmaker | watchmaker | concierge | rolliworks | watchmaker | `/rw/bench` |
| Leo | Watchmaker | watchmaker | concierge | rolliworks | watchmaker | `/rw/bench` |
| Chyna (CM) | Concierge | concierge | concierge | rolliworks | concierge | `/` |
| Dre | Polisher | polisher | concierge | rolliworks | watchmaker | `/rw/bench` |
| Sam | Band tech | band_tech | concierge | rolliworks | watchmaker | `/rw/bench` |
| Nico | Polisher · Band tech | polisher, band_tech | concierge | rolliworks | watchmaker | `/rw/bench` |
| MAM | Matthew Monteverde — Band tech (part-time), reports to JV | band_tech | concierge | rolliworks | watchmaker | `/rw/bench` |
Team rollups (`hitlist.ts TEAM_MAP`): only `JV → band_tech + polisher`. **The watchmaker room has no supervisor** (slot empty; `/hitlist/mm/team` → "doesn't supervise a team").
Stations: `st-01 Front Desk 1` (reception ✔, default pre-registered), `st-02 Front Desk 2` (reception ✔), `st-03 Inspection Bench`, `st-04 Watchmaker Room`, `st-05 Shipping`, `st-rs RS Counter` (rollishop), **`st-wm1…st-wm8` "WM 1–8" = bench iPads (`deviceType: 'pad'`) — devices, NOT people**, `st-jv-pad`, `st-kiosk-fd` Front-desk check-in kiosk, `st-kiosk-wm` WM room photo kiosk (`deviceType: 'kiosk'`).

### ⚠ DRIFT against MH's corrections
- `roleKind` still labels band techs/polishers `'watchmaker'` (used for landing + money hiding). Behaviour matches (bench pad, no $) but the name is wrong for docs; KEEPER should call it `bench`.
- `auditScopeFor()` still tests `/Watchmaker Room Supervisor/` for a WM-room scope that no seed user has — dead branch until a WM supervisor exists.
- `RwPadPage` comment still says "one user (the watchmaker-room supervisor)"; today the pad's only supervisor is JV (band/polish). `/rw/pad` renders the WM room; JV's band room is `/rw/band`. Which pad JV should land on is an open question (03-OPEN-QUESTIONS).
- Historic strings "Joseph's safe" were renamed "JV's safe"; safe id remains `safe-joseph`.
- Concierge tier name (`accessTier: 'concierge'`) covers watchmakers/band techs — rename to `bench` in KEEPER.
- Reception 5-minute idle sign-out and single-session: not built (see §5, §6).
