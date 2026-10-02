# Module — INSPECTION LABELS · guided shots · opinion labels · WatchM8 training feed **[v2 2026-09-30]**

Ruling block "INSPECTION LABELS — scantron ↔ guided photos ↔ opinion labels" (D-415). Tested iteration_66. Code: `src/api/inspectionLabels.ts` (own store, lazy `ensureSeed`), `components/inspection/{OpinionRow, OpinionBits (OpinionDotsRow, TagChipsNotes, VariantPicker), GuidedShots, OpinionCard (+ SpecimenBanner)}.tsx`, `pages/setup/InspectionSetupPage.tsx` (`/setup/inspection`), `pages/rw/RwInspectPage.tsx` (`/rw/inspect/:jobId?`, `?rig=kiosk|bench`), RW job page `rw-act-inspect`, Reports `report-label-quality`, Pickup Station step 3 gate (`pickupGate`), client report (`/rc/report/:token`) shows **shareable** opinions only.

## 1. Vocabulary
- **Component** `LabelComponent = dial | hands | bezel | bracelet | case | crown | crystal | movement`.
- **Opinion** `genuine_original | genuine_service | aftermarket | counterfeit | undetermined | na` (`NOT_GENUINE` set) with **confidence** `sure | likely | unsure`, optional **variant** (from the ref's variant set, e.g. dial MK4), **tags** (`#lume #font`, per-component vocabulary), notes. Saved as an `OpinionLabel` **revision** (append-only; `revisionsFor`, `latestFor / latestLabels`, `primaryLabels`), `shareable` default false (`setShareable`).
- **Blind second opinion**: `requestSecondOpinion(jobId, component, to)` → the second inspector sees nothing of the first (`blindFor`) → `submitSecondOpinion`; `secondOpinionFor / secondLabelFor`; disagreement surfaces on the card and in `labelQuality`.
- **Guided shots**: `shotLists` per component (`ShotDef {key, name, cam: 'ipevo' | 'microscope', lightingPreset}`, editable in Setup → `setShotList`); `recordShot(RecordShotInput)` stores `InspectionShot {originalUrl, displayUrl, controlled, retakes, adHoc?, tags}`; `controlled = true` only on a fixed rig (`isControlledStation` — kiosk / inspection station / photo station); `listProgress`, `shotsFor / shotFor`, `sheetComplete`.
- **Variant sets**: `variantSetFor(ref, component)` (10 refs seeded, dial + bezel), `Variant`, `Exemplar`; unknown marks → `proposeVariant` → `VariantCandidate` → Setup promote / reject / `replaceExemplar`; `inheritedFor`, `marksUsedFor`.
- **Tags vocabulary**: `tagsFor / topTags / matchTags / knownTag`; unknown → `addTag` flagged `new` until a manager `confirmTag` / `mergeTag` (Setup → Inspection tags).
- **Specimen gate**: `specimenStatus(jobId)` — a watch that is a reference specimen is held at pickup until MH rules: `waiveSpecimen`, `setOfferToAcquire` (→ MH inbox), `pickupGate` consulted by the Pickup Station.

## 2. Surfaces
Scantron row (`OpinionRow`, `opinion-<comp>-*`) on the inspection form; `OpinionCard` on the job page (`job-opinions`) with `SpecimenBanner`; `GuidedShots` (`guided-*`, `shots-<comp>-*`, `shot-viewer`); pad rig `/rw/inspect/:jobId` (kiosk vs bench rig decides `controlled`); Setup → Inspection: variant sets + candidates, shot lists, tags, **Data out** = `watchm8Export()`.

## 3. WatchM8 feed (→ `11 §WatchM8`, `13`)
Every saved label writes an `m3keEvents` row `kind: 'inspection_opinion'` (append-only learning log) and is part of `watchm8Export() → WatchM8Record[]` (label + photo ids + controlled-photo count + specimen / second-opinion flags). Only `controlled = true` shots are training material; bench ad-hoc shots carry labels but are flagged out. Direction RS → WatchM8 only; MOCK — no transport; the export table is the contract. `labelQuality` = Reports row (coverage, disagreements, unsure share).

## 4. Seeds
j-08 all G-orig dial MK4 (MH, sure) · j-r1 dial CF (MH, likely, #lume #font) + blind second MM = AM (disagrees) · j-30 bezel G-service MK3; shot lists complete on all three; one ad-hoc dial photo on j-r1.

## 5. KEEPER shape (→ `04`)
`opinion_label` (revisioned), `second_opinion_request`, `inspection_shot` (+ blob refs, `controlled`), `variant_set / variant / exemplar / variant_candidate`, `finding_tag` (vocabulary with status), `specimen_hold`. Audit: label save / second opinion / specimen decisions currently write NO `appendAudit` row (store-local) — ⚠ DRIFT → family 58.
