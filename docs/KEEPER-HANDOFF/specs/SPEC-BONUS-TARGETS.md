# SPEC — BONUS TARGETS — **BUILT** 2026-10-02 (MH brief + rulings in the same message)

**Status: BUILT** — `src/api/bonus.ts` (view seam + plans + periods + results), `/setup/bonus-plans` (owner), `/analytics/bonuses` (MH + Operations Manager), staff progress card on `/hitlist/<name>`, MH "Bonus results · to pay" card. Tested iteration_82.

**One paragraph.** A bonus plan names one person, the **report it reads** (the basis), a period length (monthly · two-month · quarterly, anchored at an effective month), a target and a payout (flat $ by default, optional tiers % → $). Actuals are **never summed client-side from jobs or invoices** — every number is read through `viewRows()` from a named view (`v_bonus_*`); revenue views are dated by **invoice date**, count views by **completed date**. Pace = (actual ÷ elapsed working days) × period working days, with working days a **Setup value** (default Mon–Fri; October 2026 = 22). A period **closes automatically** the day after it ends; MH may close the current period **early with a reason** (actual freezes at the as-of date). Closed rows carry reached / missed, the payout (tier hit), closed-by, and a **Mark paid** lock (owner); they export to CSV and sit on **MH's Hitlist** until every payout row is paid. Each plan has **Show to staff** (default **on** — "so they stop asking") and **Show payout $** toggles; the staff card shows **their own plan only** with a weekly-breakdown drawer on tap. The **"As of" date control** on the analytics page is **NOT-KEEPER** prototype time-travel (quick picks Oct 2 · Oct 20 · Oct 25 · Nov 1) so pacing and the EOM close can be walked today.

## Bases (the reports) — `BASIS_META`

| basis | view | kind | dated by | note |
|---|---|---|---|---|
| `band_room_total` | `v_bonus_band_room_total` | revenue | invoice | every B · P · PM line on invoices sent — whole room |
| `matthew_total` | `v_bonus_matthew_total` | revenue | invoice | band-room lines whose component credit is Matthew (MAM) |
| `joseph_total` | `v_bonus_joseph_total` | revenue | invoice | **derived in the view: Band Room − Matthew** — the department less Matthew, never a per-tech sum |
| `dept_w_sales` | `v_bonus_dept_w_sales` | revenue | invoice | W lines on invoices sent |
| `dept_p_sales` | `v_bonus_dept_p_sales` | revenue | invoice | P lines on invoices sent |
| `jobs_completed` | `v_bonus_jobs_completed` | count · per technician | completed | completion credit, dated by the completion scan |
| `components_completed` | `v_bonus_components_completed` | count · per technician | completed | head / case / bracelet completions credited to the tech |
| `custom_view` | named on the plan | revenue or count | invoice | any view returning `date · amount · ref` |

Keeper swaps the body of `viewRows(plan, from, to)` for `SELECT date, amount, ref FROM <view> WHERE date BETWEEN ? AND ?` (+ `AND tech = ?` for per-tech views). The prototype body spreads seeded monthly totals across Mon–Fri dates deterministically (`MONTHLY`, `MONTHLY_TECH`).

## Model (`api/bonus.ts`)

- `BonusPlan { id, userId, basis, customView?: {name, kind}, periodMonths: 1|2|3, anchorMonth 'YYYY-MM', target (cents | units), flatPayout $, tiers: {pct, payout}[], showToStaff, showPayout, active, createdBy, createdAt, updatedAt, note? }`
- `BonusSettings { workingDays: number[] }` — 1 = Mon … 6 = Sat; Sunday never. `workingDaysBetween`, `workingDaysInMonth`, `workingDaysLabel`.
- `BonusPeriod { key, label, start, end, months }` — `periodAt(plan, i)`; the key is `YYYY-MM` or `YYYY-MM..YYYY-MM`.
- `BonusProgress` (open period): actual · target · pct · periodWd · elapsedWd · remainingWd · pace · pacePct · status `reached | on_pace | behind` · projectedPayout (+ projectedTier) · payoutIfReached · `weekly: WeekRow[]` (Mon–Sun slices inside the period: actual, wd, cumulative, pace line = target × cumWd ÷ periodWd, future) · `rows` (view rows newest first) · `lastResult`.
- `BonusResult` (closed period): actual · target · pct · status `reached | missed` · payout · tier · closedAt · closedBy `'system' | <who>` · earlyReason · paidAt · paidBy. Derived on every read (time-travel safe); the only stored state is `early` (planId|periodKey → at, by, reason) and `paid` (→ at, by).
- Payout rule: tiers present → highest tier whose `target × pct / 100 ≤ amount`, else flat payout at ≥ 100 %. Projected payout uses `max(actual, pace)`.

## Reads / writes

| export | who | notes |
|---|---|---|
| `getBonusPlans` · `getBonusSettings` · `getBonusProgress` · `getBonusResults` · `getUnpaidBonusResults` | MH + ops manager pages | all relative to `getAsOf()` |
| `getMyBonus(userId)` | staff card | active + `showToStaff` + own plans only |
| `saveBonusPlan` · `setBonusPlanFlag` · `setWorkingDays` | owner | audit `settings` |
| `closeBonusPeriodEarly(planId, reason)` · `markBonusPaid(planId, periodKey)` | owner | audit `accounting`; Mark paid locks (no un-pay) |
| `resultsCsv(rows)` | analytics page | staff · basis · period · actual · target · % · result · tier · payout · closed · paid |
| `getAsOf` · `setAsOf` · `AS_OF_PICKS` · `AS_OF_EVENT` | NOT-KEEPER | localStorage `rollisuite.bonus.asOf`, default 2026-10-02 |

## Screens

| route | who | what |
|---|---|---|
| `/setup/bonus-plans` (Setup card `setup-bonus-card`) | owner (`isOwnerSync`) | working-day toggles (Mon…Sat), plans table (staff · basis · period · effective · target · payout · Show to staff · Show payout $ · Active · Edit), add / edit form with tiers |
| `/analytics/bonuses` (sidebar **Bonuses**, `NavItem.only = [MH, Vienna]`) | MH + Operations Manager | As-of control · summary strip (open · reached · on pace · behind · projected payout) · one card per open plan (actual / target / % bar with pace marker / working days / pace → period / **projected bonus** / visibility chip / last result) · **totals row** (projected, if-all-reached, closed-unpaid) · **Closed periods** table (auto / early · Mark paid (owner) · CSV) · card tap → weekly drawer (owner footer: Close this period early…) |
| `/hitlist/<name>` | the person (+ anyone who may view the list) | `bonus-progress-card` — own plan(s) only when Show to staff; period · basis · status · actual / target · bar · working days left · pace · payout line obeys Show payout · last result; tap → `bonus-drawer` |
| `/hitlist/michael` (MH own) | MH | `bonus-results-hitlist-card` — closed rows with payout > 0 not yet paid → Mark paid; disappears when all paid |

## Seeds (as of Oct 2, 2026)

| plan | basis | period | target | payout | Oct 2 | Sep / earlier |
|---|---|---|---|---|---|---|
| `bp-mam` Matthew (MAM) | Matthew total | monthly from Sep | $9,000 | $500 flat | **on pace** (~$985, pace ≈ $10.8k) | Sep **missed** $8,400 |
| `bp-jv` Joseph (JV) | Joseph total | quarterly Aug–Oct | $39,000 | tiers 100 % $1,500 · 110 % $2,250 · 125 % $3,000 | **reached** (~$40k) | — |
| `bp-dre` Dre | components completed | monthly from Aug | 40 | $300 flat | **behind** (3, pace 33) | Aug reached **paid**; Sep reached $300 **unpaid** → MH card |
| `bp-mm` MM | Dept W completed sales | two-month Sep–Oct | $90,000 | $1,200 flat · payout hidden on card | **on pace** (~$50k, pace ≈ $92k) | — |
| `bp-leo` Leo | jobs completed | monthly from Sep | 12 | $150 flat · **hidden from staff** | behind | Sep reached $150 unpaid |

Nov 1 → Oct closes for everyone: MAM reached $500, Dre missed, Leo missed, JV Aug–Oct reached tier 125 % $3,000, MM Sep–Oct reached $1,200.

## Open for MH

- Working days: Mon–Fri is the default; if Rolliworks counts Saturdays, flip Sat on in Setup → Bonus plans (the booking rules seed has Saturday open 10–3).
- Holidays / shop-closed dates are not excluded from the working-day count yet (one list in Setup would do it).
- Payroll export format beyond CSV; whether Mark paid should post to QBO.
