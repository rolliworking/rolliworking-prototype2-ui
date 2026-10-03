# SPEC — SETUP → ORGANISATION & STAFF — **BUILT** 2026-10-03 (MH brief · implements KEEPER **D-427** orgs / entities + stations registry · **D-429** departments as data · **D-426** Setup → Staff invites / activation / disable — filed in `DECISIONS.md` as D-495 · D-496 · D-497 · D-500)

**Status: BUILT** — `src/api/org.ts` (entities · departments · stations · staff + invites), `pages/setup/OrganisationPage.tsx` + `components/setup/org/*` (`/setup/org?tab=entities|departments|stations|tree|staff`), `components/auth/StaffInviteActivate.tsx` (first sign-in activation), Setup card `setup-org-card`.

> Numbering note (MH, 2026-10-03): KEEPER D-numbers are **by subject, not by build order**. This repo's `DECISIONS.md` already used D-426…D-433 (Portal dots, Call pop), so the 2026-10-03 batch is filed there as **D-495…D-518** and every entry carries a `↳ D-5xx → KEEPER D-4yy` line. Map for this batch: time clock + Setup → Staff → **D-426** · orgs / entities + stations registry → **D-427** · photo data classes → **D-428** · departments as data → **D-429** · export switch / log → **D-430** · pickup station gap rows → **D-414** · custody audit → **D-432** · Calls simulator → **D-405** (NOT-KEEPER). Intercom multi-ring has **no KEEPER ruling** (governed by `15-UI-CONVENTIONS.md` + the Daily.co seam). Not used by this batch: **D-431** (reference catalog — skipped, no MH confirmation) · **D-433** (tiered migration — Cursor-only, no Emergent surface).

**One paragraph.** The organisation is data, not literals. Two **entities** (Rolliworks service center · RolliShop boutique) carry name, short name, legal name, email signature and an active flag; renaming one renames every badge and signature in the app. **Departments** are W · B · P · PM (the dot legs — colour + completion credit, leg immutable) plus *routing-only* departments (CM provisional, EN Engraving) that put a job into an extra queue by catalog `routeDept` or SKU keyword while the job keeps its W·B·P dots. **Stations** are the device registry (desktop · pad · kiosk; camera role, reception mode, paired kiosk, clock point). **Staff** is one list of every person with status active · invited · expired · disabled, an org tree (reports-to), and an invite life-cycle whose activation is the person's first sign-in.

## Model (`api/org.ts`, `types.ts`)

- `Entity { id: Division, name, shortName (≤ 4, upper), legalName, kind: service_center | boutique, signature, active, updatedAt?, updatedBy? }` — `entityNameSync(id)` is the only way a screen gets the name (D-495).
- `Department { code (1–3 letters), name, entity: Division | 'both', queue, dotLeg?: W|B|P|PM, keepsDots, skuKeywords[], active, sortOrder, provisional? }`. `routeDepartmentsSync(lines)` = the routing-only departments a job's lines land in (catalog `routeDept` first, then keyword). Dot-leg rows are never "routes" — they ARE the dots (D-497).
- `Station { id, name, division, deviceType: desktop | pad | kiosk, cameraRole?, receptionMode?, pairedKioskId?, clockPoint?, notes? }` — read by sign-in, Pickup (paired kiosk), cameras, Time Clock, intercom presets (D-496). `kioskStationsSync()`, `pairedKioskSync(stationId)`.
- `User` additions: `email, phone, channel: email | sms, departmentCode?, reportsTo?, invite?: { code (6 digits), issuedAt, expiresAt (+72 h), channel, attempts, lockedAt?, usedAt?, generation }, disabled?: { at, by, reason }`.
- `StaffRow { user, status: active | invited | expired | disabled, manager?, department?, entity }` — `staffStatusSync(u)`.

## Rules

1. **Manager tier edits; everything is audited** (`settings` rows: "Entity rolliworks saved · …", "Department created · EN Engraving · queue Engraving · routing only, keeps W·B·P dots", "Station saved …", "Staff invited · …"). Entities cannot be added or deleted in the prototype (two fixed ids).
2. **Dot legs are immutable** — saving W/B/P/PM with another `dotLeg` throws; `keepsDots` is forced true for leg departments. Routing-only departments may be deactivated; the queue column disappears with them.
3. **Jobs → Queue shows routing-only columns** (`tab-col-dept-<code>`, amber): a job appears there AND in its leg column. Seed: E02025 (j-15) carries SKU `svc-23` "Caseback engraving" → Engraving queue, keeps its W dot.
4. **Stations**: kiosks are stations (`deviceType kiosk`); a counter's `pairedKioskId` is what the Pickup Station pushes the value-tier OTP / ID-photo request to (`specs/SPEC-PICKUP-V2.md` row 4, D-505); `clockPoint` stations are the only ones the Time Clock pad can lock to (`specs/SPEC-TIME-CLOCK.md`); intercom presets (Setup → Stations → Intercom presets) pick from this registry (D-501). Seeds: st-01 ↔ `st-kiosk-fd`, st-02 ↔ `st-kiosk-fd2`; clock points st-01 · st-04 · st-rs.
5. **Staff invites (D-500)**: create → status `invited`, 6-digit code shown on the row (`staff-invite-code-<id>`) and a Sent row "Your RolliSuite invite — <Short>" (MOCK delivery, email or SMS by `channel`); `INVITE_TTL_H 72` → `expired`; Resend rotates the code (generation + 1). Activation (`activateStaffInvite(userId, code, password ≥ 6, pin 4 digits)`) from the sign-in card: wrong code → "That code is not right (n tries left)", `MAX_INVITE_ATTEMPTS 5` → locked until resend. Before activation password / PIN sign-in is refused ("This account has not been activated yet…").
6. **Disable / enable = MH only** (`staff-account-<id>` → reason). Disabled users leave the sign-in cards and assignee pickers and get "Account disabled — <reason>" on any sign-in. Access-control limits (G6) still apply on top.
7. **Org tree** (`org-tree`): reports-to chains render per entity (`org-entity-block-<id>`, nodes `org-node-<userId>` with depth). Seed: Vienna, Walter → MH; MM, JV, Chyna → Vienna; Leo → MM; Dre / Sam / Nico / MAM → JV.
8. **Persistence**: entities and departments in `localStorage rollisuite.org.*.v1` (bump the suffix when a seed field changes shape); stations and users in the shared mock store. Keeper: `entity`, `department`, `station`, `staff_invite` tables; delivery via the email / SMS adapters; activation = server-side single-use code.

## Screens
- `/setup/org` tabs: **Entities** (`entity-card-<id>`, fields + Save disabled until dirty) · **Departments** (`dept-row-<code>` with `data-active`, `dept-routed-EN` lists routed jobs, `dept-form` — leg departments show "cannot change leg") · **Stations** (`station-row-<id>`, `station-form` with entity / device / camera / kiosk pairing / reception / clock point) · **Org tree** · **Staff** (filters all | active | invited | expired | disabled, search, `staff-form`, invite code + Resend, MH-only account toggle).
- Sign-in: `staff-card-<firstname>` of an invited person opens `invite-activate` (`invite-code`, `invite-password`, `invite-pin`, `invite-submit`, `invite-error`).

## Seeds
Entities Rolliworks (RW, Rolliworks LLC) · RolliShop (RS, RolliShop Inc.). Departments W B P PM CM(provisional) EN. Stations Front Desk 1–5, Inspection Bench, Watchmaker Room, Shipping, RS Counter, WM 1–8 pads, JV pad, kiosks FD / FD2 / WM. Staff per `memory/test_credentials.md` (invite flow: create a new person in Staff → activate from the sign-in card).

## Open for MH
- CM department label and the final list of routing-only departments.
- Real delivery (email / SMS) of invite codes and the activation expiry policy beyond 72 h.
- Whether entity add / archive is ever needed (fixed two in the prototype).
