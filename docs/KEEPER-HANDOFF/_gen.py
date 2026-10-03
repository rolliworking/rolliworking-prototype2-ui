"""Generates the code-derived files of the KEEPER handoff package from the prototype source. Re-run after any code change."""
import json, os, re, glob, subprocess
ROOT = '/app/frontend/src'; OUT = '/app/docs/KEEPER-HANDOFF'
client = open(f'{ROOT}/api/client.ts').read()
types = open(f'{ROOT}/api/types.ts').read()

# ---------- 05-API-CONTRACT ----------
sections = []  # (title, [exports])
cur = 'Core'
entries = []
for line in client.split('\n'):
    m = re.match(r'^// ---- (.+?) -+\s*$', line) or re.match(r'^// ---- (.+)$', line)
    if m: cur = m.group(1).strip(' -'); continue
    m = re.match(r'^export (?:async )?(?:function|const) ([A-Za-z0-9_]+)\s*(.*)$', line)
    if m:
        name = m.group(1); rest = m.group(2)
        sig = rest.split('{')[0].strip().rstrip('=').strip()
        kind = 'async' if line.startswith('export async') or 'Promise<' in sig else 'sync'
        entries.append((cur, name, kind, sig[:220]))
    m = re.match(r'^export \{ ([^}]+) \} from', line)
    if m:
        for n in m.group(1).split(','):
            entries.append((cur, n.strip(), 'const', 'fixture re-export'))
BASE = set(open(f'{OUT}/_baseline_e16.txt').read().split()) if os.path.exists(f'{OUT}/_baseline_e16.txt') else set()
REFRESH = set(open(f'{OUT}/_baseline_refresh.txt').read().split()) if os.path.exists(f'{OUT}/_baseline_refresh.txt') else set()
REFRESH2 = set(open(f'{OUT}/_baseline_refresh2.txt').read().split()) if os.path.exists(f'{OUT}/_baseline_refresh2.txt') else set()
REAL_NAMES = set(re.findall(r"^\s+([A-Za-z0-9_]+): 'real'", open(f'{ROOT}/api/config.ts').read(), re.M))
src_files = {}
for f in glob.glob(f'{ROOT}/**/*.tsx', recursive=True):
    src_files[f.replace(ROOT + '/', '')] = open(f).read()
def callers(name):
    out = [f for f, s in src_files.items() if re.search(r'\bapi\.' + re.escape(name) + r'\b', s)]
    return ', '.join(sorted(out)) or '— (internal / other client.ts functions only)'
# Best reading of what the real endpoint must require (auth expected). Order matters: first match wins.
AUTH_RULES = [
    (r'^(payViaLink|getPayPage|getPayLink|portalGetPickupConfirm|portalConfirmPickup|portalDeclinePickup|resolveClientLink|portalGetEstimateByLink|portalGetPartsByLink|portalRedeemMagicLink|rcVerifyMagicLink)', 'token'),
    (r'^(submitWebRequest)$', 'public'),
    (r'^(rc|portal|issueRc|verifyRc|getRc|rcSign|rcTotp|rcVerify|getPortal|portalDeepLink|portalRevoke|soRecordsLink|issueClientLink|clientLink|revokeClientLink|resolveClientLink)', 'client-portal'),
    (r'^(kiosk|rgKiosk|rgClock|rgPunch|rgTag|benchPinIn|getBenchBoard|getBenchSettings|saveBenchSettings|wmKiosk|getWmKiosk|submitWmKiosk|captureWmKiosk|pickupAppendFrame)', 'station'),
    (r'^(simulateTrackingEvent|simulateClient|onInboundCall|receiveInboundCall|qboSyncInvoice|simulate)', 'webhook'),
    (r'^(getStations?|registerStation|renameStation|resetDevice|getCurrentUser|hasSignedInToday|getUsersSignedInToday|signInWithPassword|signInWithTouchId|switchUserWithPin|isReceptionMode|receptionSource|getViewAs)$', 'none'),
    (r'^(zeroBalanceNoSync|startViewAs|stopViewAs|getAccessUsers|setAccessOverride|getAccessLog|setUserEnabled|setUserLimits|createUserFromTemplate|getBin$)', 'owner'),
]
def auth_expected(name):
    for rx, v in AUTH_RULES:
        if re.search(rx, name): return v
    return 'staff'
def side_effects(name):
    body = ''
    dm = re.search(r'^export (?:async )?(?:function|const) ' + re.escape(name) + r'\b', client, re.M)
    idx = dm.start() if dm else -1
    if idx >= 0:
        # body = up to the next top-level export (or 6000 chars), so long functions are read to the end
        nxt = re.search(r'\nexport ', client[idx + 10:])
        body = client[idx: idx + 10 + nxt.start()] if nxt and nxt.start() < 6000 else client[idx: idx + 6000]
    fx = []
    if 'appendAudit' in body or 'Stamp(' in body or 'stamp(' in body or 'b.audit(' in body or 'accessLog(' in body or 'kioskAudit(' in body or 'rgAudit(' in body: fx.append('audit')
    if 'store.outbox' in body or 'queueJobEmail' in body or 'queueOutbox' in body or 'soEmail' in body: fx.append('email → Sent')
    if 'sendSms' in body: fx.append('sms (MOCK)')
    if 'upsertSystemPin' in body or 'flagToHitlist' in body or 'pinToHitList' in body: fx.append('hitlist pin')
    if 'threadEvent' in body or 'pushConv' in body: fx.append('comms thread')
    if 'pushTransition' in body or 'transitionJob' in body: fx.append('job status')
    if 'store.labels' in body or 'queueLabel' in body: fx.append('label queue')
    if 'localStorage' in body or 'writeJson' in body: fx.append('localStorage')
    return ', '.join(fx) or 'none (read)'
lines = ['# 05 — API CONTRACT (target surface for the real backend)', '',
         'Every exported function of `src/api/client.ts`, generated from the code (`_gen.py`). Screens only ever call these. In KEEPER each `async` entry becomes an HTTP endpoint (or RPC); each `sync` helper becomes either a server-computed field or a shared pure function.',
         '', 'Columns: **kind** (async = crosses the wire; sync = pure/derived; const = lookup table) · **signature** as written · **source** = `real` when `API_SOURCE[name] === \'real\'` in `src/api/config.ts` (served by `realClient.ts`, mock fallback on failure) else `mock` · **auth expected** = best reading of what the real endpoint must require: `staff` (device session + role check) · `station` (station token — kiosks/pads) · `client-portal` (RolliConnect session or deep-link token) · `token` (tokened public pages: `/pay/:token`, `/rc/pickup/:token`, LINK-tier estimate / parts pages) · `public` (the public form POST — rate-limit, no session) · `owner` (MH only — `isOwnerSync`) · `webhook` (provider → server, signed) · `none` · **side effects** detected in the body · **callers**.', '', 'Tags: **[post-E16]** = not in the E16 baseline; **[post-refresh]** = added after the 2026-09-29 refresh (`_baseline_refresh.txt`); **[v2]** = added 2026-09-30 → 2026-10-02 (`_baseline_refresh2.txt`).',
         '', 'Read with `04-DATA-MODEL-VS-KEEPER.md` for the shapes and `08-AUDIT-TAXONOMY.md` for what "audit" means per call.', '']
last = None
for cur, name, kind, sig in entries:
    if cur != last:
        lines += ['', f'## {cur}', '', '| export | kind | signature | source | auth expected | side effects | callers |', '|---|---|---|---|---|---|---|']
        last = cur
    esc = sig.replace('|', '\\|')
    tag = '' if name in BASE else ' **[post-E16]**'
    if name not in REFRESH: tag += ' **[post-refresh]**'
    if REFRESH2 and name not in REFRESH2: tag += ' **[v2]**'
    src = 'real' if name in REAL_NAMES else 'mock'
    lines.append(f'| `{name}`{tag} | {kind} | `{esc}` | {src} | {auth_expected(name)} | {side_effects(name)} | {callers(name)} |')
new = [n for _, n, _, _ in entries if n not in BASE]
newr = [n for _, n, _, _ in entries if n not in REFRESH]
newv2 = [n for _, n, _, _ in entries if REFRESH2 and n not in REFRESH2]
lines += ['', f'_Total exports: {len(entries)} · baseline at E16: {len(BASE)} · **[post-E16] new: {len(new)}** · baseline at 2026-09-29 refresh: {len(REFRESH)} · **[post-refresh] new: {len(newr)}** · baseline before v2: {len(REFRESH2)} · **[v2] new: {len(newv2)}**._', '', 'v2 exports (2026-09-30 → 2026-10-02): ' + ', '.join(f'`{n}`' for n in newv2), '', 'Post-refresh exports: ' + ', '.join(f'`{n}`' for n in newr), '', 'Post-E16 exports (diff list for coverage): ' + ', '.join(f'`{n}`' for n in new)]
open(f'{OUT}/05-API-CONTRACT.md', 'w').write('\n'.join(lines))

# ---------- 08-AUDIT-TAXONOMY ----------
m = re.search(r'export type AuditEventType =\s*([^;]+);', types)
atypes = re.findall(r"'([a-z_]+)'", m.group(1))
ev = re.search(r'export interface AuditEvent \{([^}]+)\}', types).group(1)
emitters = {}
for t in atypes:
    hits = set()
    for mm in re.finditer(r"type: '" + t + r"'", client):
        # find enclosing function name
        pre = client[:mm.start()]
        fn = re.findall(r'^(?:export )?(?:async )?(?:function|const) ([A-Za-z0-9_]+)', pre, re.M)
        hits.add(fn[-1] if fn else '?')
    emitters[t] = sorted(hits)
lines = ['# 08 — AUDIT TAXONOMY', '', 'Generated from `AuditEventType` in `types.ts` and every `appendAudit({ type: … })` site in `client.ts`. The prototype keeps the last 60 events in `localStorage` (`rollisuite.prototype.auditLog`); KEEPER writes every event to an append-only ledger (see `04-DATA-MODEL-VS-KEEPER.md` → telemetry).', '',
         '## Event shape (`AuditEvent`)', '', '```ts' + ev + '```', '',
         '`method` is set on sign-in events (`password_photo` | `pin_switch`); `cameraStatus`/`photoDataUrl` on password sign-ins; `stationName` is the registered station (or "Phone (RGTime PWA)", "Kiosk", "RolliConnect"). `detail` is a human sentence prefixed with the entity number (e.g. `E02013 · Component complete · Watch head · by MM`).', '',
         '## Types → emitters', '', '| type | emitted by (function / stamp helper in client.ts) | UI filter chip |', '|---|---|---|']
chips = {'sign_in': 'Sign-ins (with sign_in_failed, sign_out)', 'station_registered': 'Station (all station_*)', 'intake': 'Intake', 'estimate': 'Estimates', 'job': 'Jobs (with task, pin, parts)', 'sales': 'Sales', 'portal': 'RolliConnect', 'kiosk': 'Kiosk', 'rgtime': 'RGTime (type kept — the Time Clock replaced the RGTime PWA 2026-10-03, D-498)'}
for t in atypes:
    lines.append(f"| `{t}` | {', '.join('`'+e+'`' for e in emitters[t]) or '(stamp helper — see below)'} | {chips.get(t, 'All only')} |")
lines += ['', '## Stamp helpers (one type each, called from many functions)', '',
          '| helper | type | prefix |', '|---|---|---|',
          '| `stamp` | intake | `<ref> · detail` |', '| `jobStamp` | job | `<job#> · detail` |', '| `partsStamp` | parts | `<PR#> · detail` |', '| `portalStamp` | portal | client action in /rc |', '| `rtStamp` | rollitime | `<job#> timing PASS/REJECT …` |', '| `rgAudit` | rgtime / sign_in / sign_in_failed / sign_out | RGTime phone events |', '| `kioskAudit` | kiosk | `<RQ#> · name · brand …` |',
          '', 'KEEPER rule: every write endpoint emits exactly one audit row with `{ type, actor, station/device, entity_ref, detail, at }`; reads emit none. Sign-in photo capture is stored as a blob reference, not inline base64.',
          '', '## Post-E16 event families (numbering continues: 26+)', '',
          'The prototype did **not** add enum values for these — they ride on existing types with a structured `detail` prefix (`⚠ DRIFT`: KEEPER should give each family its own `type` so they can be filtered/retained separately). Emitters are the client.ts functions named.', '',
          '| # | family | prototype type | emitted by | detail shape / payload KEEPER needs |', '|---|---|---|---|---|',
          '| 26 | part move / scan custody transfer | `job` (via `jobStamp` in `recordMove`) | `movePart`, `stationScan`, `sendPartByScan`, `scanLabelAssign`, `padAdvance`, `padSendBack`, `finishJob` | `{job, component, from_station, to_station, part_status, via: drag\\|scan\\|bulk_assign\\|wm\\|pad\\|station\\|system, custody_tech?, note?}` — also appended to `JobComponent.history[]` |',
          '| 27 | bulk-assign session | `job` | `scanTech`, `scanLabelAssign`, `undoOutbox` | active tech code, label, band-only flag, courtesy email id (undo window) |',
          '| 28 | stage move with reason (supervisor) | `job` + `pushTransition` | `padAdvance`, `padSendBack` | `{job, from_status, to_status, reason: rework\\|waiting_on_part\\|failed_qc\\|other, note}` — backward moves always carry a reason |',
          '| 29 | tech reassignment (supervisor override) | `job` | `padSetTech` | `{job, from_tech, to_tech, override: true}` |',
          '| 30 | client request lifecycle | `job` | `addClientRequest`, `removeClientRequest`, `ackClientRequests`, `checkClientRequest`, `uncheckClientRequest` | add/remove text; **acknowledged** `{request_ids, via: pad_scan\\|wm_scan\\|station_scan\\|…, by, at}` (also stored on `ClientRequest.acks[]`); **QC check-off** `{request_id, result: done\\|na, reason?}` |',
          '| 31 | parts request review / gate | `parts` (`partsStamp`) | `submitPadRequest`, `reviewItem`, `sendForClientApproval`, `simulateClientPartsDecision`, `padAllocate`, `approvalAction` | per-line price/part# edits, generic→resolved, sent-for-approval (email id), client decision, allocation |',
          '| 32 | M3KE resolution / selection | `parts` + `M3keEvent` append-only row | `reviewItem` (kind `resolved`), `padRecordSelection` (kind `selected`) | `{description, reference, caliber, part_id, part_number, price?, resolved_by, ts, request_id}` — this IS the training ledger |',
          '| 33 | pick confirmed / short / found-elsewhere | `parts` / `inventory` | `pickAction` | `{pick_task, part, job, qty, location, result: picked\\|short\\|found, new_location?}` — `found` rewrites `Part.location` (self-correcting location data) |',
          '| 34 | photo captured on pad | `evidence`/`job` | `capturePadPhoto` | `{job, slot, client_visible, by, at, blob_ref}` |',
          '| 35 | inbound shipping label lifecycle | `intake` (shipping stamps on `InboundShipment.stamps[]`) | `createInboundLabel`, `resendLabelEmail`, `followUpLabel`, `voidAndReissue`, `simulateTrackingEvent`, arrival auto-match in intake | label requested / created+emailed / resent / follow-up sent / voided+reissued / carrier event mirrored / arrival scan matched |',
          '| 36 | message posted / reply / routed | `job` (`jobStamp`) | `postJobMessage` | `{job, message_id, parent_id?, by, mentions[], notify[], has_photo}`; **message read** is stored on `JobMessage.readBy[]` only (`⚠ DRIFT`: not audited — KEEPER should log reads per person for accountability) |',
          '| 37 | hit-list pin from mention | `pin` (row created without appendAudit in `routeMessage`) | `postJobMessage` → `routeMessage` | `⚠ DRIFT`: the auto-pin has no audit row (manual `pinToHitList` does) |',
          '| 38 | bench kiosk | `kiosk`, `sign_in`, `sign_in_failed` | `saveBenchSettings`, `benchPinIn` | settings saved `{bench_name, idle_minutes, offline_sim}`; PIN in/out with station = bench name; idle re-lock is **not** audited (`⚠ DRIFT`) |',
          '| 39 | colleague inbox opened | `comms` | `getColleagueInbox` (read — no row in prototype) | `⚠ DRIFT`: reading another person\'s inbox should be a telemetry read event in KEEPER |',
          '', '## Post-refresh event families (2026-09-27 → 2026-09-29; numbering continues: 40+)', '',
          '`view_as_started` / `view_as_ended` ARE new enum values; the rest still ride on existing types (`⚠ DRIFT` → own `type` in KEEPER). New field on every row: `onBehalfOf?: string` (set while the owner is in View-as; `userShortName` is then the REAL actor).', '',
          '| # | family | prototype type | emitted by | payload KEEPER needs |', '|---|---|---|---|---|',
          '| 40 | sign-in (method + photo) | `sign_in` / `sign_in_failed` / `sign_out` | `signInWithPassword`, `switchUserWithPin`, `benchPinIn`, `signOut`, `rgAudit` | `{user, station, device_id, method: password_photo\\|pin_switch\\|bench_pin\\|rg_pin, camera_status, photo_blob_ref}` |',
          '| 41 | session invalidated | — (not built) | — | `{user, old_session, new_session, reason: signed_in_elsewhere\\|idle\\|admin}` — single-session rule (Q95) |',
          '| 42 | **View-as started / ended** | `view_as_started`, `view_as_ended` | `startViewAs`, `stopViewAs`, `signOut` (implicit end) | `{actor: MH, on_behalf_of, station, at, reason?: switch\\|exit\\|sign_out}`; every row written in between carries `onBehalfOf` (D-361) |',
          '| 43 | reception-mode toggled | — (station flag seeded; `?reception=` override not audited) | — | `{station, on\\|off, by, at}` when a manager flips the station flag (Q93) |',
          '| 44 | label created / voided / tracking event | `intake` stamps on `InboundShipment.stamps[]`, `sales` for outbound | `createInboundLabel`, `voidAndReissue`, `simulateTrackingEvent`, `confirmShipment`, SWO label fns | `{shipment, carrier, tracking, label_url, cost, insured_value, event_status, source: webhook\\|manual}` |',
          '| 45 | invoice finalized / synced / conflict / bypass | `sales` (`soStamp`), `accounting` | `sendInvoice`, `recordPayment`, `qboSyncInvoice`, `qboResolveConflict`, `zeroBalanceNoSync`, `confirmShipment` (bypass), `overrideScanGate` | `{so, qbo_invoice_id, sync_token, direction, conflict_resolution, bypass_reason, minutes_since_payment}` |',
          '| 46 | page started / ended (intercom) | — (in memory only) | `intercom.ring/hangUp/pageAll` | `{from_station, to_station, started_at, ended_at, text?}` |',
          '| 47 | photo set completed (WM kiosk) | `evidence` / `job` (`jobStamp`) | WM kiosk submit fns (`WmKioskPage`) | `{job, set_kind: wm_kiosk, slots[], by, station, mentions[]}` |',
          '| 48 | hitlist claim / reassign | `pin` / `task` | `hl.reassign`, `pinToHitList`, `setTaskDone` | `{item, from_assignee, to_assignee, by, at}` |',
          '| 49 | scan-gate override | `estimate` | `overrideScanGate` | `{so, by, reason, at}` |',
          '| 50 | client reference set | `estimate` | `setClientRef` | `{estimate\\|job, before, after, by}` |',
          '', '## v2 event families (2026-09-30 → 2026-10-02; numbering continues: 51+)', '',
          'None of these added an enum value — they ride on `sales` / `job` / `comms` / `kiosk` / `settings` or on store-local timelines (`soStamp`, `jobStamp`, thread lines, `BinEvent`, `swo_event`). `⚠ DRIFT` → each family gets its own `type` in KEEPER. Emitters are the owning functions.', '',
          '| # | family | prototype type | emitted by | payload KEEPER needs |', '|---|---|---|---|---|',
          '| 51 | inbox tag / pin / lane / archive / share | — (thread internal line via `pushConv` / `logShare`; no `appendAudit`) | `tagConversation`, `pinConversation`, `moveConversation`, `archiveConversation`, `unarchiveConversation`, `logShare` | `{conversation, action, tag?, lane?, by, at}`; share → `{message_id, recipients[], note?}` (D-443…D-446, D-460) |',
          '| 52 | inbox quick action on a job | `job` (`jobStamp`) + thread internal line | `addJobNote(origin)`, `logPartsRequestOnThread`, `draftJobSummary` (no row — draft only) | note `{job, origin: "from inbox · <subject>"}`; parts `{job, pr, thread}`; summary drafts are NOT audited (never sent) (D-463…D-465) |',
          '| 53 | reply channel chosen | `comms` (`pushConv`) | `replyInThread` | `{conversation, channel: portal\\|email, message_id, token?}` (D-466) |',
          '| 54 | SWO hub / line lifecycle (vendor lanes) | `job` (`jobStamp` + `appendAudit`) + `Swo.timeline[]` / `SwoHub.timeline[]` | `saveShopWorkOrder`, `advanceSwo`, `sendBackSwo`, `createSwoHub`, `addSwoLine`, `removeSwoLine`, `moveSwoLines`, `moveLineToHub`, `createHubShipment`, `receiveSwoLine`, `markPartReturned`, `createSwoOutboundLabel`, `queueSwoReturnLabel`, `setSwoPaid`, `pushSwoToQbo`, `concierge.addVendorInvoice/markInvoicePaid/startRedo` | `{hub, line?, job, vendor, from_stage, to_stage, reason?, label?, invoice?, redo_cycle?, by, device, at}`; custody to `vendor:<id>` is a `part_move` |',
          '| 55 | container (JV bin) events | `job` (`jobStamp`) + `BinEvent` ledger | `assignToBin`, `binEnter`, `binHandTo`, `binTakeBack`, `binToSafe`, `binOutOfSafe`, `binCommit` | `{container, ticket, kind: assign\\|enter\\|hand_to\\|take_back\\|to_safe\\|out_of_safe\\|missing, tech?, count_expected?, count_present?, by, at}` (D-420…D-424) |',
          '| 56 | request submitted (web / portal / staff builder) | `kiosk` (same as the kiosk walk-in) | `submitWebRequest`, `submitBuilderRequest`, `markRequestNotified` | `{request, source: web\\|portal\\|staff, mode, outcome quoted\\|queued\\|draft, lines[], auto_quote, estimate?, notified_to?}` → own type `request_submitted` (D-457, D-471) |',
          '| 57 | add-on since estimate (manual / phone → confirmed) | `job` (`jobStamp`) | `addJobAddon`, `confirmJobAddon`, `calls.setDisposition(approval_given)` | `{job, addon, source manual\\|phone, channel, amount?, status pending\\|confirmed, by, at}` (D-405, D-434) |',
          '| 58 | inspection opinion label / second opinion / specimen | — (store-local in `inspectionLabels.ts`; `m3keEvents` row kind `inspection_opinion`) | `saveOpinion`, `setShareable`, `requestSecondOpinion`, `submitSecondOpinion`, `recordShot`, `promoteCandidate`, `rejectCandidate`, `confirmTag`, `mergeTag`, `waiveSpecimen`, `setOfferToAcquire` | `{job, component, opinion, confidence, variant?, tags[], revision, shareable, by, station, controlled?}`; second opinion `{request, to, blind: true}`; specimen `{job, decision}` (D-415) |',
          '| 59 | owner Views (another person\'s inbox opened) | — (read, no row) | `InboxPage ?section=views&as=` | `⚠ DRIFT`: telemetry read event `{viewer: MH, inbox_of, at}` (D-459) — same gap as family 39 |',
          '| 60 | pickup gate steps + exceptions | `sales` (`soStamp` on every step; `jobStamp` on stops) + `BypassEvent payment_release` | `pickupStart`, `pickupConfirmItem`, `pickupAbort`, `pickupApproveBypass`, `pickupResendCode`, `pickupVerifyCode` (incl. FAILED), `pickupVerifyProxy`, `pickupIssueReverseQr`, `portalConfirmPickup`, `portalDeclinePickup`, `pickupCheckSerial`, `pickupOverrideSerial`, `confirmPickup`, `pickupAppendFrame`, `pickupEvidenceSweep`, `adminMarkComplete` | `{so, step 1–5, fact, approver?, reason?, code_generation?, verify_method?, serial_result?, failed_pair?, source claude\\|mock, frames_n, evidence_status}`; failed verifies MUST be counted (lockout — Q104) (`specs/SPEC-PICKUP-STATION.md`) |',
          '| 61 | call lifecycle + disposition | `comms` (`b.audit`) + thread event | `calls.callAnswered`, `callMissed`, `startOutboundCall`, `setDisposition`, `logCall`, `addCallNote`, `linkCallToJob`, `resolveMissedCall` | `{call_id, direction, number, client?, answered_by?, station, outcome, duration, disposition?, recording_ref?, job?}` (D-430…D-436) |',
          '| 62 | portal passwordless / LINK tier / step-up | `settings` (`appendAudit`) + `portalStamp` | `rcRequestCode`, `rcVerifyCode`, `rcVerifyMagicLink`, `rcSignInWithTouchId`, `rcRequestStepUp`, `requireStepUp`, `sendClientLink`, `revokeClientLink`, `resolveClientLink` (open counted), `setRcDocAccess`, `setPhotoUnlocked` | `{client, challenge_id, method code\\|magic_link\\|touch_id, attempts, result}`; link `{type, object, token_hash, sent_to, opened_at, revoked_by?}`; step-up `{action, grant_id, consumed_at}` (CLIENT PORTAL — THREE TIERS) |',
          '| 63 | access control (owner) | `settings` (`appendAudit`) + `AccessChange` log | `setAccessOverride`, `setUserEnabled`, `setUserLimits`, `createUserFromTemplate` | `{by: MH, whom, screen?, from, to, reason?, limits?, template_from?}` (D-391, D-398…D-401) |',
          '| 64 | system pins (auto-PO · approvals to send · pickup evidence / item / declined) | `pin` (row via `upsertSystemPin`, no `appendAudit`) | `autoPoSweepSync`, `approvalsToSendSweepSync`, `pickupEvidenceSweep`, `pickupAbort`, `portalDeclinePickup` | `{key, priority, standing, assigned_to, link, dismiss_reason?}` — upsert by key; dismiss of a standing pin needs a reason (D-417, D-418) |',
          '| 65 | rate card edit | `setup` | `saveRateCardRow` | `{row, key, version_before, version_after, by}` (D-472) |',
          '', '## 2026-10-03 event families (Setup → Organisation · Time Clock · Intercom · Pickup v2 · Custody audit · Data classes; numbering continues: 66+)', '',
          'Still no new enum values — these ride on `settings` / `sales` / `job` / `sign_in*` / `rgtime` or on store-local ledgers (`custody.ts events`, `watchm8Export.ts log`, `soStamp`). `⚠ DRIFT` → own `type` per family in KEEPER. The KEEPER ruling each family implements is named (MH numbering by subject, 2026-10-03).', '',
          '| # | family | prototype type | emitted by | payload KEEPER needs |', '|---|---|---|---|---|',
          '| 66 | organisation edits (entity · department · station) | `settings` (`appendAudit`) | `org.saveEntity`, `saveDepartment`, `toggleDepartment`, `saveStation`, `saveIntercomPreset` / `deleteIntercomPreset` (presets: no row ⚠) | `{kind entity\\|department\\|station\\|preset, id, before, after, by, at}`; dot-leg changes are refused, not logged (KEEPER D-427 · D-429) |',
          '| 67 | staff invite lifecycle | `settings` + Sent row (MOCK delivery) + `sign_in_failed` | `org.createStaff`, `resendInvite`, `activateStaffInvite`, `setStaffDisabled`, `assertEnabled` | `{user, code_generation, channel, issued_by, expires_at, attempts, locked_at?, activated_at?}`; disable `{user, by: MH, reason}`; refused sign-ins while invited / disabled (KEEPER D-426) |',
          '| 68 | time clock punch · correction · flag · settings | `rgtime` (`rgAudit`) + `sign_in` on the pad lock | `rgPadPunch`, `rgKioskPunch`, `rgSyncQueue` (synced_late), `rgCorrectPunch`, `rgAddPunch`, `rgResolveFlag`, `rgSaveSettings` | `{user, kind in\\|out, at, recorded_at, station\\|tag, source nfc\\|pad\\|kiosk\\|manager\\|rgtime, method tap\\|pin\\|touch_id\\|manager, flags[], geo?, correction_of?, reason?}` — corrections are new rows (KEEPER D-426) |',
          '| 69 | intercom group call · page | — (in memory `history` / `pageLog`) | `intercom.ring` (several targets / preset), `hangUp`, `pageAll` | `{call, from_station, targets[], joined[], skipped[], started_at, ended_at}`; page `{by, zone, text, at}` (no KEEPER ruling; Daily.co seam) |',
          '| 70 | pickup v2 facts (any-reference open · QBO read · lockout · second factor · authorized person · Reolink · ID purge) | `sales` (`soStamp`, `appendAudit` on LOCKED / PURGED) + `settings` for authorized-list edits | `pickupResolveReference` (via stamp on open), `pickupCheckInvoice`, `pickupVerifyCode` (attempt n/3, LOCKED), `pickupKioskPushOtp` / `pickupKioskConfirmOtp` / `pickupKioskIdPhoto`, `pickupVerifyProxy` (authorized vs approved), `addAuthorizedPickup` / `removeAuthorizedPickup` / `portalAddAuthorizedPickup`, `confirmPickup` (reolink), `pickupIdPhotoPurgeSweep` | `{so, opened_via, invoice_sent_at, qbo_balance, qbo_status, code_attempts, lock_until?, value_tier{item, invoice, total, high}, second_factor{method, kiosk}, authorized_id?, reolink{nvr, channel, from, to, clip_ref}, id_photo_purged_at}` — closes the family-60 note "failed verifies MUST be counted" (KEEPER D-414) |',
          '| 71 | custody events · audit sessions · backfill · −1 at invoice | `job` (`appendAudit` on start / close / stub / backfill) + **`custody_events` ledger** (`custody.ts`) + `sales` stamp `custodyAtInvoice` | `startCustodyAudit`, `pauseCustodyAudit`, `resumeCustodyAudit`, `auditPickNode`, `custodyAuditScan`, `custodyAuditStub`, `closeAuditNode`, `closeCustodyAudit`, `backfillCustody`, `onPartMoved` (scan rows), `sendInvoice` (minus_one flag) | `custody_events {item_key, job, part, to_node, bin?, source scan\\|audit\\|backfill, by, station, at, why?, audit_id?}` (append-only — THE record); audit `{id, scope, status, nodes[], result{unaccounted[], found_no_job[]}}`; invoice `{so, custody_at_invoice, minus_one_parts[]}` (KEEPER D-432) |',
          '| 72 | photo data class · WatchM8 switch · export log | `settings` (`appendAudit` on every flip / ref change) + **`export_log` ledger** (`watchm8Export.ts`) | `addJobPhoto` (class at write), `wm8.setEnvSwitch`, `setAgreementRef`, `setClassToggle`, `runExport`, `ackExport`, `clearLog` (dev) | photo `{photo, data_class operational\\|specimen\\|identity, slot, by}`; switch `{env, enabled, agreement_ref, by, at}`; log `{seq, env, type label\\|photo, object, hash, licence_version, agreement_ref, exported_at, by, acked_at?}` (KEEPER D-428 · D-430) |']
open(f'{OUT}/08-AUDIT-TAXONOMY.md', 'w').write('\n'.join(lines))

# ---------- 09-TEST-INVENTORY ----------
lines = ['# 09 — TEST INVENTORY (regression checklist KEEPER must also pass)', '',
         'One section per testing-agent iteration (`/app/test_reports/iteration_N.json`). Each verified acceptance line is restated as a checkbox. KEEPER passes when every box can be ticked against the production build (same behaviours, different implementation).', '']
for n in range(1, 200):
    f = f'/app/test_reports/iteration_{n}.json'
    if not os.path.exists(f): continue
    d = json.load(open(f))
    summ = (d.get('summary') or '').strip().replace('\n', ' ')
    lines += [f'## Iteration {n}', '', f'_{summ[:700]}{"…" if len(summ) > 700 else ""}_', '']
    acc = d.get('verified_acceptance') or []
    if not acc:
        for key in ('frontend', 'backend'):
            blk = d.get(key)
            if isinstance(blk, dict):
                for tc in blk.get('test_cases', []) or []:
                    if isinstance(tc, dict): acc.append(f"{tc.get('name') or tc.get('description') or ''} — {tc.get('status', '')}")
    if not acc:
        ev = d.get('test_evidence') or {}
        if isinstance(ev, dict):
            for k, v in ev.items(): acc.append(f"{k}: {json.dumps(v)[:260] if not isinstance(v, str) else v[:260]}")
    for a in acc:
        lines.append(f'- [ ] {str(a).strip()}')
    acts = d.get('action_items') or []
    if acts:
        lines += ['', '_Action items raised (fixed in the following commit unless noted in SESSION-LOG):_'] + [f'- {str(a)[:300]}' for a in acts]
    issues = d.get('frontend_issues', {}) or {}
    fixed = []
    for k in ('ui_bugs', 'integration_issues', 'design_issues'):
        for it in issues.get(k, []) or []:
            if isinstance(it, dict):
                for x in it.get('issues', []) or []: fixed.append(f"{it.get('screen', '')}: {x}")
            else: fixed.append(str(it))
    if fixed:
        lines += ['', '_Issues reported in this iteration (all fixed by the following commit unless noted in SESSION-LOG):_']
        lines += [f'- {x[:300]}' for x in fixed]
    lines.append('')
open(f'{OUT}/09-TEST-INVENTORY.md', 'w').write('\n'.join(lines))

# ---------- 02-DECISIONS-CONSOLIDATED ----------
dec = open('/app/docs/DECISIONS.md').read()
lines = ['# 02 — DECISIONS CONSOLIDATED (every MH ruling, as recorded)', '',
         'Source: `/app/docs/DECISIONS.md`, reproduced **as recorded** (rows were written at ruling time; the original chat text is not in the repo). Order is chronological by session; each block is tagged with the modules it touches. Status column: **locked** = build it exactly; **provisional (amber)** = MH has not ruled — see `03-OPEN-QUESTIONS.md`.', '']
tags = {'E1': 'auth-stations, dashboard-today', 'E2': 'intake', 'E3': 'estimates', 'E4': 'jobs', 'E5': 'sales', 'E6': 'workshop', 'E7': 'client-360', 'E8': 'rolliconnect', 'E9': 'purchasing-inventory, labels-reports-accounting, setup-integrations-help, jobs (evidence)', 'E10': 'companion-panel', 'E11': 'rolliworking', 'E12': 'rollitime', 'E13': 'rgtime, kiosk-requests', 'E14': 'comms-hub', 'E15': 'comms-hub, rolliconnect, jobs', 'Division': 'auth-stations, dashboard-today, jobs, workshop', 'Hit-list': 'dashboard-today', 'component': 'jobs, workshop, rolliworking, labels-reports-accounting', 'Documentation': 'all', 'E18': 'rw-shop-floor, rw-bulk-assign, rw-supervisor-pad, rw-picking', 'Supervisor Pad': 'rw-supervisor-pad, rw-picking', 'Client request': 'client-requests, jobs, rw-supervisor-pad', 'Inbound': 'shipping-inbound, client-360, comms-hub', 'Track': 'shipping-inbound, comms-hub, client-360', 'Bench Pad': 'rw-bench-pad, job-messages, dashboard-today', 'Inbox Staff': 'comms-hub', 'VB3': 'rw-shop-floor, rw-bulk-assign, rw-supervisor-pad, rw-bench-pad, rw-picking, client-requests, comms-hub, client-360, shipping-inbound, job-messages', 'Per-component': 'jobs, workshop, rolliworking, labels-reports-accounting', 'CONCIERGE': 'concierge-swo', 'SWO': 'concierge-swo', 'JOB DETAIL': 'job-detail-v2-wbp', 'W·B·P': 'job-detail-v2-wbp', 'JOBS LIST': 'job-detail-v2-wbp', 'CLIENT PORTAL': 'rolliconnect, job-detail-v2-wbp, 14-CLIENT-PORTAL-INVENTORY', 'INBOX —': 'inbox-v2, comms-hub', 'INBOX v2': 'inbox-v2, comms-hub', 'INBOX JOB-CARD': 'inbox-v2, comms-hub', 'PICKUP': 'specs/SPEC-PICKUP-STATION, sales', 'VONAGE': 'calls-telephony', 'REQUEST BUILDER': 'request-builder', 'rw.com': 'rwcom-emulator, request-builder', 'INSPECTION LABELS': 'inspection-labels', 'JV BIN': 'jv-bin-containers', 'MESSAGING': 'inbox-v2, dashboard-today', 'AUTO-PO': 'purchasing-inventory, dashboard-today', 'OUTBOX': '15-UI-CONVENTIONS, comms-hub', 'G5': 'dashboard-today, 15-UI-CONVENTIONS', 'G6': '12-ROLES-AND-ACCESS, setup-integrations-help', 'G7': '15-UI-CONVENTIONS', 'G8': 'rolliworking, 15-UI-CONVENTIONS', 'ASSIGN / MOVE': 'concierge-swo, rw-shop-floor', 'ROLE TAB BAR': 'rolliworking, 15-UI-CONVENTIONS', 'Q5': 'labels-reports-accounting', 'Rebuild-spec items': 'dashboard-today, 12-ROLES-AND-ACCESS', 'Owner / Super Admin': '12-ROLES-AND-ACCESS', 'Fix batch': '12-ROLES-AND-ACCESS, 01-ROUTE-MAP', 'Corrections batch': '12-ROLES-AND-ACCESS', 'SETUP → ORGANISATION': 'specs/SPEC-SETUP-ORG, specs/SPEC-TIME-CLOCK, 12-ROLES-AND-ACCESS, 15-UI-CONVENTIONS', 'PICKUP STATION v2': 'specs/SPEC-PICKUP-V2, specs/SPEC-PICKUP-STATION, sales', 'CUSTODY AUDIT': 'specs/SPEC-CUSTODY-AUDIT, rw-shop-floor, sales, 12-ROLES-AND-ACCESS', 'PHOTO DATA CLASSES': 'inspection-labels, 11-INTEGRATIONS, 12-ROLES-AND-ACCESS, 15-UI-CONVENTIONS', 'SAFES vs INSURANCE': 'specs/SPEC-SAFES-INSURANCE', 'Bonus targets': 'specs/SPEC-BONUS-TARGETS', 'Message templates': '07-COMMS-AND-TEMPLATES, inbox-v2'}
for block in re.split(r'\n(?=## )', dec):
    head = block.split('\n')[0]
    tag = next((v for k, v in sorted(tags.items(), key=lambda kv: -len(kv[0])) if re.search(r'(?<![A-Za-z0-9])' + re.escape(k.lower()) + r'(?![0-9])', head.lower())), 'cross-cutting')
    lines += [block.strip(), '', f'**Modules touched:** {tag}', '']
open(f'{OUT}/02-DECISIONS-CONSOLIDATED.md', 'w').write('\n'.join(lines))
print('generated', len(entries), 'api entries;', len(atypes), 'audit types')

# Publish: mirror /app/docs → /app/frontend/docs (the GitHub-synced copy)
subprocess.run(['bash', os.path.join(OUT, '..', 'sync-to-frontend.sh')], check=False)
