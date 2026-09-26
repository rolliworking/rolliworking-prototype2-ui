# Module — RW Supervisor Pad `/rw/pad` (iPad, watchmaker-room supervisor) · post-E16

## Screens & layout intent
Tablet-native shell (large title, bottom tab bar, bottom sheets, 44px+ targets, no desktop chrome). Manager tier only (`RwManagerOnly`). Header: room summary chips (in room · waiting on parts · awaiting approval · picks), live clock, PIN switch, and a **global scan field** — scanning a watch label jumps to its card (Jobs tab) or loads the parts composer (Parts tab) and **always pops the client-request modal** if the job has open requests.

### Tabs
1. **Jobs** (`PadJobs.tsx`): one card per room job in stage order `approved (Queued) → in_service (On the bench) → testing (Final assembly / QC) → ready_to_ship (Finished)`. Card: job#, watch, ref + caliber, stage chip, **tech chip** (tap → reassign sheet), client-request badge, pending-parts chip, 4-step stepper, part dots + locations, QC checklist (when in testing with client requests), **Advance / Send back / Camera**. Tapping the title opens the **detail sheet**: photo grid + zoom lightbox, camera capture, **condition on arrival** (report → inspection form → intake note), and the job's **Messages** board (post-E16, `job-messages.md`).
2. **Parts** (`PadParts.tsx`): segment **New request** / **History**. New request = the three-tier composer (below). History = every request in the room with search (part / part# / PR#), status + job filters, detail sheet with the request's audit trail ("Who touched it"); the composer also shows **Past requests on this job** to prevent duplicates.
3. **Review** (`PadReview.tsx`, manager gate): lines awaiting **price + part#** before anything reaches the client; **to allocate** (client-approved, on-hand shown); bench requests (`pending`, from WM/chat).
4. **Picking** tab link → `/rw/picking` (`rw-picking.md`).

## Rules
- **Stage control**: `padAdvance` — `approved → in_service` (parts placed on the lane benches), `in_service → testing` only if the finish gate passes (all parts waiting/reunited), completing components; `testing → ready_to_ship` via `finishJob` (client-request QC gate applies). `padSendBack(jobId, reason, note?)` — reasons `rework | waiting_on_part | failed_qc | other(+note required)`; every backward move is logged with the reason; `failed_qc` appends a rework row to each completed component; parts are re-placed on the lane benches / pre-queues.
- **Reassign** (`padSetTech`): supervisor override, logged as such; scan assignment (bulk) stays the primary path.
- **Three-tier parts query** (`getPadPartsContext(label)` → job, reference, caliber, caliber-scoped parts): (1) scan → caliber parts offered automatically; (2) typed search (`padSearchParts(ref, caliber, q)`) scoped to reference then caliber, token-AND over name/part#/aliases; (3) no match → **generic** free-text line (`generic: true`, no part#). **Learned** suggestions (`M3keEvent`s for the same reference) rank first and carry a "learned" tag; `padRecordSelection` logs every caliber-level pick (kind `selected`).
- **Manager gate**: `submitPadRequest` → status `pending_review`. `reviewItem(requestId, index, {price?, partNumber?})` fills price / corrects part# — resolving a generic line to a real part# records an `M3keEvent` (kind `resolved`, with description, reference, caliber, part#, price, resolved_by). `sendForClientApproval` requires every line priced and numbered, queues the approval email (Outbox) → `awaiting_client`. `simulateClientPartsDecision` (demo) → `approved | declined`. `padAllocate` (approve → allocate) refuses OUT OF STOCK lines ("use Order part") and otherwise creates pick tasks.
- **Camera** (`CameraCapture`): `<input type=file accept=image/* capture=environment>` → slot sheet (`PHOTO_SLOTS`: workbench / movement / dial / caseback / bracelet / … each `clientVisible` true/false) → `capturePadPhoto` attaches to the job with who/when/slot; "Attach & shoot another" loops. Client-visible slots flow to the portal; internal slots never do.
- **Money**: prices are shown on the pad (MH confirmed) — the `/rw` hide-money rule is relaxed here for the manager-tier supervisor only.

## Client functions used
`getPadBoard`, `getRoomSummary`, `padAdvance`, `padSendBack`, `SEND_BACK_REASONS`, `padSetTech`, `getRoomTechs`, `getPadCondition`, `getJobPhotoViews`, `capturePadPhoto`, `PHOTO_SLOTS`, `getPadPartsContext`, `padSearchParts`, `padRecordSelection`, `submitPadRequest`, `getPadRequests`, `getRoomPartsHistory`, `getReviewQueue`, `reviewItem`, `sendForClientApproval`, `simulateClientPartsDecision`, `padAllocate`, `partsOnHand`, `getM3keEvents`, `caliberOf`, `clientRequestAlert`, `ackClientRequests`, `checkClientRequest`, `getJobThreads`, `postJobMessage`.

## Drift flags
- `⚠ DRIFT` Photos are browser object URLs (`URL.createObjectURL`) — lost on reload; KEEPER stores blobs keyed to watch + job (`06` §7).
- `⚠ DRIFT` Caliber is derived from a small reference→caliber table (`caliberOf`); KEEPER needs the real reference catalog.
- `⚠ DRIFT` M3KE "learning" is an in-memory append-only array read back for ranking; the production store is in `06` §6.
- `⚠ DRIFT` The supervisor sees prices; whether concierge-tier pad users would is amber (Q81).
