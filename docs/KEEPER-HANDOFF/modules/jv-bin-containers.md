# Module — JV BIN · container custody **[v2 2026-09-30]** (supersedes D-408 container reconcile)

Ruling block "JV BIN — container custody" (D-420…D-424). Tested iteration_67 (46/46). Code: `components/rw/pad/PadBin.tsx` (band pad **Bin** tab), `components/rw/FloorPanels.tsx` (`BulkPanel` bin strip), Assign / Move + Shop Floor `JV BIN` row, `pages/rw/CustodyPage.tsx` (JV bin sub-header + chip); data in `client.ts` "JV BIN" (L6954). Tool: `/app/memory/tools/smoke_bin.py`.

## 1. Model
A **container holds custody**: tickets inside the bin show custody **JV** and their location follows the bin. `JobComponent.containerKey` (inside the bin now) · `binOrigin` (last bin this part rode in — out with the team). `PartMove.via` gains `'container'`; new stations `vc_safe` (Vienna's safe — the bin's night home) and `jv_bench` (`RwStationKey`). `recordMove` takes a ticket **out** of the bin on any non-container move. `BinView {rows: BinRow[] (state BinRowState), events: BinEvent[] (BinEventKind), holder: BinHolder}`, `BIN_TEAM` = Dre · Sam · Nico · MAM, `isBinCode('BIN-JV')`, `isBinSafeCode('SAFE-VC')`.

## 2. Lifecycle (API)
| moment | call | rule |
|---|---|---|
| Front desk queues work for JV | `assignToBin(label)` | desk queue — no physical move; row state "Assigned, not entered" |
| Bin arrives at JV's bench | `binEnter(label)` | **only while the bin is at `vc_safe`** (morning) or bench; ticket → inside, custody JV |
| Hand to a tech | `binHandTo(label, tech)` | Dre · Sam · Nico · MAM; case → `polish_room`, bracelet → band bench / `refinish`; ticket leaves the bin, `binOrigin` kept |
| Take back | `binTakeBack(label)` | returns to the bin |
| Night | `binToSafe({present?})` | SAFE-VC → BIN-JV → **one count confirm**; mismatch → per-ticket sheet, unscanned = **MISSING** → pins JV + manager; lit from 17:00 (night banner on the Jobs tab) |
| Morning | `binOutOfSafe()` | everything inside → `jv_bench`, custody JV workshop |
| Scan helpers | `resolveBinLabel`, `binCommit(target: BinTarget)` | Assign / Move + Shop Floor `JV BIN` row (Assign to JV bin · Vienna's safe · JV's bench); `BulkPanel` bin strip — **BIN-JV must be in the session** for safe / bench, refused at Assign |
`getBin()` (owner / supervisor read), `binCountLine`.

## 3. Surfaces
Band pad **Bin** tab: SAFE-VC → BIN-JV → confirm sheet; lists **In my bin · Out with team · Due back to safe (lit ≥ 17:00) · Assigned not entered** · bin log. Custody page: "JV" group gets a **JV bin** sub-header + chip. `ContainerReconcile` (D-408) retired.

## 4. Seeds
E02070–E02078 (c-38…c-46, w-57…w-65): 6 in the bin at JV's bench, 3 out (Dre / Sam / Nico), bin log rows.

## 5. KEEPER shape (→ `04`)
`container {container_id, code 'BIN-JV', owner_id, home_station 'vc_safe'}`, `container_event` append-only (`BinEvent`), `part_move.via = 'container'`, component ↔ container membership = latest move (ownership chain D-A). Night count = a `count_session` with per-ticket present / missing rows. Audit today: `jobStamp` + `appendAudit` type `job` (⚠ DRIFT → family 55). **Long-term storage (`specs/SPEC-LONG-TERM-STORAGE.md`) reuses this container pattern for the LTS safe.**
