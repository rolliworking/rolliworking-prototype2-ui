# Module — RolliTime `/rt` (timing bench)

## Screens & layout intent
Minimal bench shell (dark header "RolliTime · timing bench · <station>"); sign-in = staff card + password of the station division, no camera. **Queue** `/rt`: scan/enter a watch label (job #, `ref/serial`, or PDF417 payload) → open; list of jobs in `testing` (session division, oldest first) with caliber tolerance label. **Test page** `/rt/test/:jobId`: watch header + tolerance set; six positions **DU DD CD CL CU CR** × (rate s/d, beat error ms, amplitude °) with the target beside each field and live out-of-tolerance highlighting; computed **AVG** row and **Δ** (max−min rate); lift angle; power reserve (h); auto-evaluation panel (Crit1 Δ < max · Crit2 avg within min/max · beat ≤ max every position · amplitude within range every position · reserve ≥ hours) with a **suggested verdict**; PASS / REJECT (reason required) — the tech decides; overrides flagged in audit. History card: previous tests on this job and watch, newest first.

## Fields
| field | type | required | validation |
|---|---|---|---|
| readings[6] | rate (number), beat (≥0), amp (≥0) per position | all 6 | finite numbers |
| liftAngle | number | yes | > 0 (default from tolerance set) |
| powerReserve | hours | yes | > 0 |
| verdict | pass \| reject | yes | reject needs reason |

## Tolerance sets (`CaliberTolerance`, matched by reference prefix; generic fallback)
3135 · 3235/3285 · 4130 · MT5402 · generic — fields: crit1MaxDelta, crit2Min/Max, beatMax, ampMin/Max, reserveHours, liftAngle. Values are provisional (Q48).

## Side effects
- **PASS**: test saved (append-only, keyed to job AND watch), job stamped "Timing test PASS … — to QC queue" (**status stays `testing`**; the QC queue already is `testing`), short "Testing complete" email → Outbox with `/rc/watches/:id` link. Audit `rollitime`.
- **REJECT**: `transitionJob(qc_fail, reason)` → back to `in_service` (client delay email) + audit with flags; completed components keep credit and gain a rework entry.

## Rules
Only jobs in `testing` can be timed; label lookup ignores closed jobs. All staff of the station division may sign in.

## Behaviours discovered during build
- RolliTime is a **new automation** (legacy never had it); Witschi field mapping and import are unruled (Q49). Integrations tile marks it "stub — manual entry".
