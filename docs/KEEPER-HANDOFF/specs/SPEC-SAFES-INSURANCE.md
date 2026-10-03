# SPEC — SAFES vs INSURANCE — **BUILT** 2026-10-02 (MH brief + rulings · owning ruling **D-425**)

**Status: BUILT** — `src/api/safes.ts` (containers · location-node parents · value on hand · alerts), `/setup/containers` (owner), `/analytics` Safes card + drawer (MH + Operations Manager), standing hitlist pins for MH + VC while a safe is over, `SafesOverCard` on MH's hitlist, non-blocking station toast on the scan that leaves a safe over. Tested iteration_83.

> Numbering note: MH's register cites **D-425** as the owning ruling for this feature. This repo's `DECISIONS.md` already used D-425 for *Portal dots* (2026-09-30), so the detailed entries below are filed as **D-488 … D-494** under a "SAFES vs INSURANCE (owning ruling D-425)" heading — same ruling, two numbers.

**One paragraph.** Every physical holding place is a **container** (safe · shelf · bin) with an optional **parent**; safes carry an **insurance limit** and a **policy ref**. Every scan node (safe tray, floor station, intake shelf bin) names the container it lives in. **Value on hand** for a safe = the value of every item scanned into that safe or any container nested inside it. A piece on a bench (custody = a watchmaker) or out with a vendor is in **no safe** and counts toward **no limit**. Item value runs a fixed chain — appraisal → declared at intake → reference typical value → **unvalued (flagged)** — and is **split by component**: the bracelet's own value when known, the head = watch − bracelet. The card compares each safe to its limit (under · near ≥ 85 % · OVER); an over-limit safe pins MH and VC until it is back under, and the station that tips it sees a warning without being blocked.

## Model (`api/safes.ts`)

- `SafeContainer { key, label, kind: 'safe' | 'shelf' | 'bin', insuranceLimit? (safes only), policyRef?, parent?, scanNode?, createdBy, updatedAt }` — `scanNode` is the map node "Move…" arms for that safe.
- `LocationNode { key, label, group: 'tray' | 'station' | 'shelf_bin', parent? }` — one per `RW_STATIONS` key plus one per shelf bin (`bin:BIN-01` …). `parent` is set in Setup → Containers; **no parent = not insured** (benches, floor stations).
- `SafeItem { id, jobId?, jobNumber, client, watch, reference, part: head | case | band | 'package', node, container, value, source: ValueSource, unvalued, since, link }`.
- `SafeRow { container, items (by value desc), count, value, limit?, pct?, status: under | near | over | no_limit, overage, headroom, unvalued, children }`.
- `SafesBoard { safes, others (containers not nested in any safe), totals { safes, count, value, insured, headroom, over, unvalued }, anyOver }`.
- `ValueSource = appraisal | declared | typical | bracelet_config | with_head | unknown`.

## Rules

1. **Containers are data** (D-488). Hierarchy edited in Setup → Containers: add / edit a container (name, kind, limit, policy ref, parent), re-parent any node. A container cannot be nested inside itself. Writes are owner-only (MH) and audited (`settings`).
2. **Only scanned-in items count** (D-489). `placement(job, part).station` must be a node **with a parent**. `wm_bench_*`, `jv_bench`, `refinish`, `polish_room`, `uncase`, `movement_service`, `final_assembly`, `testing` … have no parent by default → a part there is in no safe. Vendor custody (`vendor:*`) is off premises → no safe.
3. **Item value chain** (D-490), first hit wins: **final appraisal** (`appraisalValueSync`) → **declared at intake** (`Job.declaredValue`, else the arrived / tracked inbound shipment's `declaredValue`) → **reference typical value** (avg insured value of outbound shipments of the same reference — D-085 comps — else the `REF_TYPICAL` reference-table stand-in) → **unvalued** (flagged amber, counts $0, listed per safe and in the totals).
4. **Component split** (D-491). Bracelet share = `Job.braceletValue` (declared at intake) → bracelet configuration table (`BRACELET_CONFIG`: President · Jubilee · Oyster · Titanium · strap, two-tone / gold variants) → **0 = counted with the head**. Head share = watch value − bracelet share (when the bracelet is its own component with a known value). The head share is carried by the **head** component when it is in a safe, else by the **case** (uncased watch — case at a polish gate, movement on a bench; the case is the insured object in the safe). The **band never carries the head share**; a **band-only job** holds just the bracelet (declared → configuration → unvalued). Nothing is counted twice: the non-carrying case shows "— · counted with the head".
5. **Unopened packages count in the FD safe** (D-492). The intake shelf is a `shelf` container **inside** the FD safe; every `bin:BIN-xx` node parents to it. A package's value = its label request's declared value (by tracking #, else by estimate), else unvalued.
6. **Status**: `limit` undefined → `no_limit`; value > limit → `over`; value ≥ 85 % of limit → `near` (`NEAR_PCT`); else `under`. Bar scale runs to 125 % so an overage stays visible; the limit tick sits at 100 %.
7. **Alerts** (D-493). On every board compute (`getSafesBoardSync`, also inside the day sweeps so `/today` sees them before reading the pinned layer): each `over` safe upserts two **standing, high-priority system pins** — `safe-over:<container>:mh` (MH) and `safe-over:<container>:vc` (Vienna) — title "FD safe over insurance limit by $103,050", subtitle count · on hand vs insured · policy ref · "move pieces to another safe (Assign / Move)", link `/analytics`; both resolve automatically ("back under the insurance limit") when the safe is under again. `onPartMoved` → if the destination's safe is over after the scan, `SAFES_ALERT_EVENT` fires → `toast.warn` wherever the staffer is (RS shell, RW shell, pads). Never blocking.
8. **Move… arms the destination only** (D-494). Drawer row → "Move…" → pick another safe → `/assign?dest=<scanNode>&item=<job#>`. `dest` arms the node on the Assign / Move map; `item` is a **hint banner** ("scan the ticket for E02028") and never pre-loads the scan list — custody changes only on the scan + Commit. The Main safe's general tray is the new `main_safe` node (STORAGE row, plain ticket scan — not the BIN-JV container flow of `vc_safe`).

## Seeds

| container | kind | limit | policy ref | parent | scan node | nodes inside |
|---|---|---|---|---|---|---|
| Main safe `c-main` | safe | **$250,000** | Jewelers Block JB-2026-0411 | — | `main_safe` | pre_queue · band_pre_queue · mgr_safe_polish_in/out · band_mgr_safe_in/out · into_safe_head · safe_await_band · into_safe_band · safe_await_head · vc_safe · main_safe |
| FD safe `c-fd` | safe | **$50,000** | JB-2026-0411 · rider A (front desk) | — | `fd_safe` | fd_safe · finished · pre_approval · (Intake shelf) |
| LTS safe `c-lts` | safe | **$100,000** | JB-2026-0411 · rider B (storage) | — | `lts_safe` | lts_safe |
| Intake shelf `c-shelf` | shelf | — | — | **FD safe** | — | bin:BIN-01 … bin:BIN-12 |

Values: `seedAssetValues` (client.ts) stamps `Job.declaredValue` for ~23 open jobs (and creates the arrived inbound shipment when the job has an estimate without one) and `Job.braceletValue` for E02021 ($3,200 — the Daytona bracelet shipped separately), E02033 ($2,400), E02063 ($2,100), E02017 ($650). `REF_TYPICAL` covers 126710BLRO · 226570 · 126710GRNR · 126234 · 126334 · 126600; 126610LN comes from live comps ($14,800). **Deliberately unvalued (3)**: E02024 Submariner 114060 case (drop-off, no appraisal, no comps), E02020 Tudor Black Bay GMT band-only (steel bracelet — no declared / configuration value), SUB-26-0311 unknown-client package on BIN-01.

Opening state (Oct 2 2026): Main $154,100 / $250k (62 %, under) · **FD $153,050 / $50k (OVER by $103,050 — 23 items, 13 of them finished pieces at the desk)** · LTS $12,500 / $100k. MH's and Vienna's hitlists carry the FD pin; MH also sees `SafesOverCard`. Moving finished pieces FD → Main safe (Assign / Move, `main_safe`) walks it back under; the pins clear on their own.

## Access

- `/setup/containers` — owner only (`isOwnerSync`, API `ownerOnly`); others see `containers-restricted`.
- `/analytics` (Safes card + Bonuses) — MH + Operations Manager (`canSeeSafes`: `u-michael`, `u-vienna`); others `analytics-restricted`.
- Pins: MH + Vienna (`OPS_SHORT`). Toast: whoever performs the scan.

## Keeper mapping

- Tables: `container (key, label, kind, insurance_limit, policy_ref, parent_key, scan_node)`, `location_node (key, label, group, parent_container_key)`, `ref_bracelet_value (pattern/config → value)`, `ref_typical_value (reference → value)`; `job.declared_value`, `job.bracelet_value` captured by the intake form / inbound label.
- View `v_safe_items`: every open-job component whose current station's node has a parent container, plus arrived unopened packages on shelf bins, with the computed `value`, `source`, `carrier` per rules 3–5. `v_safe_rows` sums `v_safe_items` by the container ancestor chain. Statuses and pins derive from the view — never summed in a page (D-420).
- Alerts: a trigger on custody moves (or the move service) evaluates the destination safe and upserts / resolves the two standing hitlist items; the station message is the same event.

## OPEN for MH

- **Uncased watch split**: today the whole head share rides with the case when the movement is on a bench (conservative). Should the head share split between case and movement (e.g. by a reference table of case value)?
- **MH Hitlist "Client asset value on hand" tile** still follows its earlier rule (Σ shipping-insurance declared values, drop-offs $0). Align it with this value chain, or keep the two tiles distinct (insured-in-transit vs on-premises)?
- **Finished pieces live in the FD safe** (seed). If finished watches wait in the Main safe until the pickup appointment, re-parent `finished` → Main safe in Setup → Containers — the card follows.
- `NEAR_PCT` 85 % — make it a Setup value per safe?

## Test ids

`safes-card`, `safes-card-over-flag`, `safes-card-setup`, `safes-rows`, `safe-row-<key>` (`data-status`), `safe-row-count|value|limit|pct|bar|status|unvalued-<key>`, `safes-totals`, `safes-totals-count|value|insured|headroom|over`, `safes-others`, `safe-other-<key>`; drawer `safe-drawer` (`data-kind`), `safe-drawer-status|bar|unvalued|items` (`data-count`), `safe-item-<jobId>:<part>` / `safe-item-pkg:<pkgId>` (`data-unvalued`), `safe-item-move-open-<id>`, `safe-item-move-targets-<id>`, `safe-item-move-<id>-<containerKey>`; Assign / Move `assign-move-hint`; hitlist `safes-over-card`, `safes-over-total`, `safes-over-row-<key>`, `safes-over-open`; toast `toast-warn` / `toast-text`; Setup `containers-page`, `containers-add`, `container-form` (`data-editing`), `container-label|kind|limit|policy|parent|save|cancel|error`, `containers-msg`, `containers-table`, `container-row-<key>` (`data-kind`), `container-limit-<key>`, `container-nodes-<key>`, `container-edit-<key>`, `nodes-tray|station|shelf_bin`, `node-<key>` (`data-parent`), `node-parent-<key>`, `containers-restricted`, `analytics-restricted`.
