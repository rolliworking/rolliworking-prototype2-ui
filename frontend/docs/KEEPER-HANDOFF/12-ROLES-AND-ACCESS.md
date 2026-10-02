# 12 — ROLES AND ACCESS (as implemented, 2026-09-29; v2 addenda 2026-10-02 marked **[v2]**)

Code is truth. Every name below is a real identifier in `/app/frontend/src`. Where the seed or behaviour disagrees with MH's corrections it is flagged **⚠ DRIFT** and left.

## 1. The two axes: `accessTier` × `roles`
`User` (`src/api/types.ts`): `{ id, roles: Role[], firstName, shortName, displayName, dutyLabel, accessTier: 'manager' | 'supervisor' | 'concierge', division: 'rolliworks' | 'rollishop' | 'both', password, pin }`.
- `Role` values used in the seed: `manager`, `inspector`, `concierge`, `watchmaker`, `polisher`, `band_tech`.
- `accessTier` is the permission tier every API check uses (`'manager'` gates everything money/assignment/setup; `'concierge'` is the bench/front-desk tier — **the name is historical: watchmakers and band techs are `concierge` tier too**).

## 2. `roleKind()` — the ONE landing/guard function (`src/config/roles.ts`)
```ts
export type RoleKind = 'watchmaker' | 'band_tech' | 'supervisor' | 'concierge' | 'manager';   // band_tech = band techs AND polishers (Dre, Sam, Nico, MAM)
roleKind(u) = roles has 'supervisor' || (manager tier && room role) ? 'supervisor' : manager tier ? 'manager' : has 'watchmaker' ? 'watchmaker' : has polisher/band_tech ? 'band_tech' : 'concierge'
ROLE_HOME = { watchmaker: '/rw/bench', band_tech: '/rw/band', supervisor: '/rw/pad', concierge: '/', manager: '/' }
desktopAllowed(k) = k !== 'watchmaker' && k !== 'band_tech'   // RequireAuth
rwAllowed(k)      = k !== 'concierge'                          // RwRoleGuard
padAllowed(k)     = k === 'supervisor' || k === 'manager'      // RwRoleGuard pad (Band Pad additionally admits band_tech — it is their home)
canSupervise(u)   = manager tier || roles has 'supervisor'     // assign / reassign / stage moves (MM is concierge tier but supervises)
teamFamily(u)     = 'W' | 'B·P' | null; FAMILY_TONE          // the two colour families in every mixed view, always paired with the chip text
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
| **[v2]** `canClientComms(user)` = MH · Vienna · Chyna (owner + front desk) | Inbox **Portal** tab content (`InboxPage`) — everyone else sees the restricted note and receives client messages quoted in **Team** (D-446) | client threads |
| **[v2]** Inbox **Views** tab (`?section=views&as=<slug>`) — `isOwnerSync()` only | MH opens any staff member's inbox exactly as they see it (D-459); not audited (⚠ DRIFT, family 59) | reads |
| **[v2]** `approveAsManager({managerId, pin, reason})` — **second-person rule** | every Pickup Station exception (payment bypass, proxy release, serial override, camera bypass): active manager tier, **≠ the staffer running the step**, PIN (or password) match, reason required; `getApprovingManagers()` excludes the runner (`specs/SPEC-PICKUP-STATION.md`) | exceptions |
| **[v2]** owner-only API: `setAccessOverride`, `getAccessUsers`, `getAccessLog`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate`, `getBin` (owner / supervisor read) | `/setup/access` (D-391, D-398…D-401) | writes |
| **[v2]** `isDisabledSync(user)` / `assertEnabled` | disabled users refused on password, PIN and Touch ID (`sign_in_failed` audit), dropped from `getDivisionStaff` (cards, pickers, View-as tiles), kept in Access control under Active / Disabled / All (D-400) | sign-in |
| **[v2]** `limitsOf(user) → UserLimits { lockedStations[], partsCategories[], pricing: 'full' \| 'cost_only' \| 'none' }` | recorded + logged; **enforcement is partial** — `pricing` is read by the pad money context only, `lockedStations` / `partsCategories` are not yet consulted by the Assign maps or Parts (⚠ DRIFT, Q99) | limits |
| **[v2]** `managerOf / directReports / chainOf / subtreeOf / inSubtree / getOrgTree` (`User.reportsTo`) | tree walks replace hand-coded lists: `hitlist.getTeam` = direct reports (+ MM's read-only band / polish oversight), `canViewHitlist` = self · chain above · manager tier · MH; `supervisorOf` (D-398) | scope |
| **[v2]** `canSeeMoney` / `useFmtMoney` | `MoneyContext` = `accessTier === 'manager'` (supervisor tier MM sees no $) — unchanged rule, now also applied to pad Dashboard / Quick Add / Review / Parts prices | money |

## 4. Concierge restrictions (as built vs ruled)
- Pad blocked: `rwAllowed('concierge') === false` → any `/rw/*` bounces to `/` with a toast. ✔
- Assign: `/rw/assign`, `/rw/queue`, `/rw/station` wrapped in `RwRoleGuard pad` (supervisor / manager only); API `assignTech`/attribution amend use `canSuperviseUser` ✔ (item 7 done 2026-09-29).
- Cycle counts without dollars: nav item `cycle-count` (`/inventory/count`, tiers ALL) — concierge counts; the variance report and its dollars stay manager-only (`getVarianceReport`) ✔.

## 5. Reception mode (station flag, D-2026-09-29)
- Where: `Station.receptionMode?: boolean` (`types.ts`); seeded `true` on `st-01 Front Desk 1` and `st-02 Front Desk 2` (`fixtures/stations.ts`); localStorage station registry backfills the flag from the seed (`readStations` in `client.ts`).
- Override: `?reception=1|0` on any URL → `sessionStorage['rollisuite.prototype.receptionOverride']` (this browser session). `isReceptionMode()` / `receptionSource()` exported from `client.ts`.
- Hides: in `resolveIdentifierMock` the client hit's `inHouse` (IN-HOUSE badge + estimate numbers) is dropped, so `SearchHitList` renders a plain row and in-house clients no longer sort first. TopBar shows `header-reception-badge` (`data-source` = station | query).
- **5-minute idle sign-out — built** (`useReceptionIdleSignOut` in `AppShell.tsx`, `RECEPTION_IDLE_MS = 300000`): when `isReceptionMode()` is true, 5 min without pointer/key/touch/scroll → `signOut()` → `/sign-in?idle=1`. Applies to every role at that station, managers included. Bench Pad keeps its own re-lock.
- Applies to every role on that station (it is a station flag) — managers pass `?reception=0` to see badges.

## 6. Sessions (division wall: `inMyDivision.*` in `client.ts` — estimates/SOs/packages inherit the linked job's division, default rolliworks; `both` users see all; other-entity detail throws "Not in your division")
- Real sign-in = `localStorage['rollisuite.prototype.currentUserId']` (device-bound, one user per device at a time; PIN fast-switch replaces it). `signOut` clears it and the View-as key.
- **Single-session enforcement (one device per person): not built** ⚠ DRIFT — the same account can be signed in on two devices; nothing invalidates the other.
- RGTime (`/rg`) keeps its own remembered phone session; RolliConnect keeps `rcSession`; kiosks have no session.

## 7. View-as (D-385, amended 2026-09-29) — owner only
- **No credential of the viewed user is ever involved.** View-as is impersonation by MH's own signed-in session: picking a tile on `/choose-view` (or the top-bar picker) switches the view immediately — no password, no PIN, no Touch ID, no station token; the viewed user's real session is never touched. Kiosk tiles open the kiosk screen under MH's session, no station token entry.
- **Mandatory entry screen**: after ANY MH sign-in (password / Touch ID / PIN), on every device, `/choose-view` loads before anything else — keyed on the account being owner, not on `?device=` or the touch heuristic. Layout: "Continue as MH" on top, then "View as…" tiles grouped Watchmakers · Supervisors · Band/Polish · Front desk · Kiosks (name, initials, role, landing route). Exit from any View-as returns here. Logged: `view_as_started` (target) or `session_continued_as_self`.
- "Inspector" is a TASK role (`#inspector` tasks / job owner role), not a person's role: it resolves to manager tier or above (`holdsRole`). MH's role is Owner / Super Admin.
- Storage: `sessionStorage['rollisuite.prototype.viewAsUserId']` (this tab only). Never touches `currentUserId`, never creates/ends the viewed user's session.
- Identity split (`client.ts`): `realUserSync()` = device sign-in · `viewAsSync()` = viewed user **only when real user is `OWNER_USER_ID`** · `currentUserSync()` = `viewAsSync() ?? realUserSync()` → every guard, scope, landing, hidden field and permission check evaluates the VIEWED user (MH viewing MM is bounced from desktop routes exactly like MM).
- Attribution (D-361): `actor()` → `{ by: 'MH (as MM)', onBehalfOf: 'MM', user: viewed }` — every `createdBy/completedBy/by` string carries both names and never equals `'MM'`, so completions, components, hitlist rows and goals are never credited to the viewed user. `appendAudit` stamps `userShortName = 'MH'`, `userDisplayName = 'MH — … (as MM)'`, `onBehalfOf = 'MM'` on every event while active (Audit log shows an `as MM` chip, `audit-obo-<id>`).
- API: `getViewAs(): Promise<{ real: User; viewing: User | null } | null>`, `startViewAs(userId): Promise<User>` (throws for non-owner), `stopViewAs(): Promise<void>`. Audit types `view_as_started` / `view_as_ended` (who, whom, station, when; switching person emits ended+started).
- UI: `src/components/layout/ViewAs.tsx` — `ViewAsPicker` (TopBar + RW shell header, owner only), `ViewAsBanner` (fixed, every screen incl. kiosks: "Viewing as MM — actions are recorded as MH (as MM)", exit → `/choose-view` on every device), `useViewAs()`. `src/pages/ChooseViewPage.tsx` = `/choose-view` (pad tiles: `roleKind ∈ {watchmaker, supervisor}` + Front-desk check-in kiosk `/kiosk` + Photo kiosk `/wm-kiosk` + My own view). `SignInPage.onDone` → owner && `isPadDevice(station)` → `/choose-view`.
- Blocked while viewing: anything the viewed role cannot do (same checks) **plus** owner-only actions (`isOwnerSync()` is false in View-as). Managers (Walter, Vienna, JV) never see the picker.
- Device type (`src/config/device.ts`): `station.deviceType` (D-384) → `?device=ipad|desktop` session override → touch + width ≤ 1366 heuristic. **Prototype only** — see `10-NOT-KEEPER.md`.

## 8. Seed identities (`src/api/fixtures/users.ts`, `stations.ts`)
| short | name / duty | roles | tier | division | `roleKind` | lands on |
|---|---|---|---|---|---|---|
| MH | Michael — **Owner / Super Admin** (all entities, all routes, all money, View-as D-385, MH-only controls: Accounting/QBO connect, client 2FA reset, integrations setup, Access control) | manager (owner = `OWNER_USER_ID`) | manager | both | manager | **`/choose-view` on every sign-in** → own home `/` |
| Walter | Manager (RolliShop) | manager | manager | rollishop | manager | `/` |
| Vienna (VC) | **Operations Manager** | manager | manager | rolliworks | manager | `/` |
| JV | **Workshop Supervisor (band/polish)** — Joseph; supervises Dre/Sam/Nico/MAM | manager, polisher, band_tech | manager | rolliworks | supervisor | `/rw/pad` |
| MM | **Watchmaker Room Supervisor** · oversight of band/polish (read-only) — no bench, never assigned jobs | supervisor | **supervisor** (no $; concierge-tier screens + supervisor actions — D-392) | rolliworks | supervisor | `/rw/pad` |
| Leo | Watchmaker | watchmaker | concierge | rolliworks | watchmaker | `/rw/bench` |
| Chyna (CM) | Concierge | concierge | concierge | rolliworks | concierge | `/` |
| Dre | Polisher | polisher | concierge | rolliworks | band_tech | `/rw/band` |
| Sam | Band tech | band_tech | concierge | rolliworks | band_tech | `/rw/band` |
| Nico | Polisher · Band tech | polisher, band_tech | concierge | rolliworks | band_tech | `/rw/band` |
| MAM | Matthew Monteverde — Band tech (part-time), reports to JV | band_tech | concierge | rolliworks | band_tech | `/rw/band` |
Team rollups (`hitlist.ts TEAM_MAP`): `MM → watchmaker + band_tech + polisher` (band/polish rows **read-only** for MM: `readOnlyRoles`, `teamRowReadOnly(viewer, tech)`), `JV → band_tech + polisher`. Other supervisors/managers never roll up as techs (`isTech`). MM's team view is merged and colour-differentiated (legend `team-legend`, `W` / `B·P` chip on every tech tag). MM's tab bar: Hitlist · Assign/Move · Work Queue · Jobs · Pad · Band Pad (`SUPERVISOR_NAV`). Hitlist visibility `canViewHitlist(viewer, target)`: self, supervisor of target, manager tier, MH (also via View-as); others are redirected to their own list.
Stations: `st-01 Front Desk 1` (reception ✔, default pre-registered), `st-02 Front Desk 2` (reception ✔), `st-03 Inspection Bench`, `st-04 Watchmaker Room`, `st-05 Shipping`, `st-rs RS Counter` (rollishop), **`st-wm1…st-wm8` "WM 1–8" = bench iPads (`deviceType: 'pad'`) — devices, NOT people**, `st-jv-pad`, `st-kiosk-fd` Front-desk check-in kiosk, `st-kiosk-wm` WM room photo kiosk (`deviceType: 'kiosk'`).

## 9. v2 additions — where the new screens sit (2026-09-30 → 2026-10-02)
| screen | tier / guard | notes |
|---|---|---|
| `/calls` | manager (TierGate MGR) | screen-pop card itself: desktop shell, **manager tier + concierge role** (`CallPopHost` mount rule) |
| `/concierge`, `/swo`, `/swo/:id` | manager | pad twin `/rw/concierge`, `/rw/swo/:id` = `RwRoleGuard pad` (supervisor / manager) |
| `/rwcom` | manager | NOT KEEPER screen; `/www` public mount outside `RequireAuth` |
| `/setup/access` | owner (`ownerOnly` + API checks) | G6: enable / disable, Limits drawer, org tree, new user from template |
| `/setup/inspection`, `/setup/rate-card` | manager (inherits `/setup`) | rate-card edits audit `setup` |
| `/requests/new` | ALL (inherits `/requests`) | staff builder on behalf of a client; `source = 'staff'` |
| `/parts/approvals` | manager (inherits `/parts`) | MH daily item; one-tap Send is manager-only in the API |
| `/inventory/reports` | manager | consumption / spending reports |
| `/rw/inspect(/:jobId)` | any RW role | `?rig=kiosk` marks shots `controlled` — should be the station record (⚠) |
| `/rw/device`, `/rw/messages` | any RW role | device check; staff messages |
| `/rc/request/new` | portal session (signed-in only, D-469) | no session → `/www?tab=request` |
| `/rc/parts/:id` | portal session **or** LINK token; approve = step-up | D-426 |
| `/rc/pickup/:token` | token, 2 min, single-use | public by design |
| Hitlist **Views** / team | `canViewHitlist` (tree-based since G6) | — |
| Inbox tag / pin / archive / share | any Inbox user (ALL tier); Portal tab = `canClientComms` | tags are pointers, not permissions (D-443) |

### ⚠ DRIFT remaining (2026-09-29 fix batch cleared: `band_tech` kind, dead WM branch in `auditScopeFor`, `RwPadPage` comment, `safe-jv`, reception idle sign-out, item 7 guards, MM = WM-room supervisor)
- Concierge tier name (`accessTier: 'concierge'`) still covers watchmakers, band techs and MM — rename to `bench` in KEEPER; MM's "no $" rides on that tier.
- Division wall applies to the MOCK path only; rows served by the live staging API carry no division and are shown to everyone (Q102).
- Two colour families are applied on the team hitlist only; queue, pad and shop-floor map still lack the W / B·P chip (Q101).
- JV lands on `/rw/pad` like MM (Q92 recommends `/rw/band`).
- Single-session: not built (§6).
- **[v2]** Inbox Views (owner reading another inbox) and tag / pin / lane / archive changes write no audit row.
- **[v2]** `UserLimits.lockedStations` / `partsCategories` are recorded but not enforced on the Assign maps or Parts (Q99 open).
- **[v2]** `/rw/inspect?rig=kiosk` trusts a query flag for `controlled` shots; `pickupAppendFrame` is callable by any staff session (auth expected: station).
- **[v2]** Legacy per-person Inbox plumbing (`assignConversation`, `getStaffInboxRows`, `getColleagueInbox`, `threadsNeedingReplyForUser`) still exported — delete.
- **[v2]** Authorized pickup persons do not exist on the client record (proxy pickup is ad-hoc + manager) — ⚠ GAP in `specs/SPEC-PICKUP-STATION.md`.
