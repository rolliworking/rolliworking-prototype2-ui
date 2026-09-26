# Module — Companion panel (docked scripted assistant; front door for M3KE)

## Screens & layout intent
Docked right-hand panel in RS (Bot button, **Alt+M**), context-aware: knows the current route's job/client/estimate. Four tabs:
1. **Price memory** — ask "what did we charge for X on ref Y"; answers from `model_references` + `price_evidence` (past estimate/job lines) with **citations**, a stale flag (older than N months) and a **Verify** action that records a `price_verification` (who/when). Money hidden for non-managers (amber).
2. **Client brief** — one-paragraph brief with cited lines (`BriefLine {key, text, citations[]}`): watches, service debt (overdue service intervals), open money, last contact; staff can post a **correction** (`BriefCorrection`) that is kept and shown.
3. **Ask the shop** — a question card; "Route to manager" creates a manager task; the answer posts back as a **knowledge card** (`KnowledgeCard`) reusable later.
4. **Photo labels** — label pills on job photos with provenance (who/when/source) and a log.

## Rules
- Everything is **scripted** (keyword/regex + fixtures); there is no model. The panel is the UI contract for a real assistant (`06-SEAMS.md` → companion / M3KE store).
- Every answer must carry citations to records that exist; "I don't know" is a valid answer (`AskAnswer.kind = 'unknown'` → route).
- Audit type `companion` on verify / correction / route / label.

## Data (fixtures/companion.ts)
`ModelReference`, `PriceCandidate`, `PriceEvidence`, `PriceVerification`, `ClientBrief`, `BriefCorrection`, `KnowledgeCard`, `RoutedQuestion`, `PhotoLabel` (+ `LABEL_PILLS`). Shapes in `source/DATA-MODEL.md` §16.

## Behaviours discovered during build
- The clarify path (ambiguous reference → ask which model) was fixed after iteration 21.
- Money hiding here established the hide-money amber that `/rw` now applies globally.
