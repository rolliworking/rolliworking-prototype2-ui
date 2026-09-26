# 01 — ROUTE MAP (all six route-spaces)

Legend — **who**: `any` = both tiers (manager + concierge); `mgr` = manager tier only; `client` = portal session; `public` = no session. **division**: `session` = data walled to the station's division; `all` = not walled (⚠ DRIFT where a wall is expected); `tag`/`brand` = division comes from the NFC tag / brand pick. Routes come from `frontend/src/App.tsx`; nav from `config/navigation.ts` (RS) and `RW_NAV` (RW).

## A. RolliSuite staff app `/` (station-bound; sign-in required; sidebar nav)
| route | purpose | who | division | entry points | primary flow |
|---|---|---|---|---|---|
| `/station-setup` | register this device as a station (name + division), rename, reset | mgr (password) | — | first load (auto-registers `st-01` — mock), Setup | pick station → manager card → password → registered |
| `/sign-in` | staff sign-in: card → password + camera photo (first of day) or PIN (later) | any | staff list = station division | unauthenticated visit; "Switch user" | pick card → password (+photo, camera optional) → dashboard |
| `/` | Dashboard: stats cards, activity feed, mini today | any | session | sidebar | read-only glance → click through |
| `/today` (`/hit-list` redirects) | derived hit list (owner actions, bench, holds, discrepancies, tasks, replies) + pinned layer + send task + waiting-on | any | session | sidebar (pinned), Alt+T quick-add | filter chips → act on row → pin/dismiss → send task |
| `/requests` | service requests queue; kiosk match actions | any | session (`division ?? rolliworks`) | sidebar | Open/All → Confirm link / Not the same → Client 360 |
| `/inbox` | Comms hub: client conversations, views, composer | any | session | sidebar, job/estimate reply indicators, Client 360 | pick view → open thread → reply with template → Outbox |
| `/intake` | Arrival (log package / walk-in) | any | all ⚠ | sidebar, Drop-off quick action | source → tracking → SUB# |
| `/intake/receive`, `/intake/receive/:id` | packages arrived → receive (contents, photos, estimate link) | any | all ⚠ | Intake tabs, job "package" link | list → open → contents pills → photos → receive (✉) |
| `/intake/work-order` | assign bin → awaiting inspection | any | all ⚠ | Intake tabs | processed list → bin → record |
| `/intake/inspection`, `/intake/inspection/:id` | receive watch: ref/serial, workflow depts, same-watch fork, discrepancies | any | all ⚠ | Intake tabs, `/today` discrepancy rows | enter ref/serial → depts → received (labels queued) or discrepancy hold |
| `/intake/outbox` | pending client emails (nothing sends) | any | all ⚠ | Intake tabs, every "email queued" flash | inspect / mark sent (mock) |
| `/intake/labels` | label queue (bag tags, ref/serial) | any | all ⚠ | Intake tabs, receive watch | print (mock) |
| `/estimates`, `/estimates/new`, `/estimates/:id` | estimate list / create / detail (lines, revisions, send, approve, decline, convert, print) | any | all ⚠ | sidebar, Estimate quick action, Client 360, job link | draft lines → send (✉) → approve/decline → convert to job/intake/SO |
| `/jobs` | jobs board (lanes incl. **Awaiting components**, On hold), list view, filters | mgr | all ⚠ | sidebar | filter → card → detail |
| `/jobs/new` | create job directly (client, watch, kind, workflow) | mgr | session (stamped) | Jobs tab | pick client → watch → kind → create at intake |
| `/jobs/shop-time` | log minutes against on-hand jobs | mgr | all ⚠ | Jobs tab, job shop-time card | job → minutes → note |
| `/jobs/:id` | job detail: actions, watch, lines (money), **components**, inspection, notes, report-to-client, timing, evidence, photos, parts, shop time, timeline, owner, assignees, holds, details, invoice | mgr | — | everywhere a job number is a link | legal action buttons → modals for reasons/holds |
| `/bench` | My bench: my jobs + next action, my holds, pull-next, my parts requests, inline component done | any | session (pull-next) | sidebar | act from row → pull next |
| `/supervisor` | assign techs, parts approval queue, holds parked under me, QC queue, completions/month | mgr | all ⚠ | sidebar | toggle tech chips → approve/reject parts → QC |
| `/floor` | nine-lane floor map (Intake → … → Out) | any (concierge chips → Client 360) | all ⚠ | sidebar | read → click chip |
| `/parts/knowledge` | learned part↔reference confirmations & aliases | mgr | all | sidebar | read |
| `/clients`, `/clients/:id` | universal search; Client 360 (watches, requests, estimates, jobs, invoices, notes, emails, custody, evidence, documents) | any | all ⚠ | sidebar, global search box, every client link | search → resolve → dense record → `?hit=` deep link highlights a row |
| `/sales`, `/sales/new`, `/sales/:id` | sales orders list / detail: lines, payments, channel, pickup code, shipping address, cancel | any | all ⚠ | sidebar, job "Create invoice", estimate convert | open SO (✉) → payment → fulfil → pickup/ship station |
| `/sales/pickup` | Pickup Station: code or proxy+ID photo, photos, partial lines, bypass | any | all ⚠ | Pickup quick action | enter code → verify → photos → confirm (✉, custody closed) |
| `/sales/ship` | Ship Station: address, carrier, declared value, photos, label, bypass | any | all ⚠ | Ship quick action | address → carrier → photos → label → confirm (✉) |
| `/purchasing` | vendors, purchase orders, receiving | mgr | all | sidebar | PO draft → send → receive lines |
| `/inventory` | stock levels by location, movements, low stock, cycle counts | mgr | all (cross-division rules amber) | sidebar | adjust / count / post |
| `/labels` | label templates + printers + queue | any | all | sidebar | pick → print (mock) |
| `/reports` | funnel, throughput, aging, P&L, **tech completions**; CSV | mgr | all | sidebar | tab → table → export |
| `/accounting` | invoice/payment registers, QBO queue (stub) | mgr | all | sidebar | export CSV (stub) |
| `/setup`, `/setup/audit-log` | users, catalog, templates, locations, printers, stations; audit log with type filters | mgr | all | sidebar | edit rows → audited |
| `/integrations`, `/help` | integration health tiles (all stub); help pages | mgr / any | — | sidebar | read |
| `/actions/*` | quick-action redirects/placeholders (`ship`, `pickup` redirect; others placeholder) | any | — | top bar | — |
| `/inspection-photos` | placeholder (not built) | mgr | — | sidebar | — |
| `/shipping/inbound` **[post-E16]** | inbound shipping board: Label Requests → Labels Sent → In Transit → Delivered-unscanned; KPI strip; create/resend/void+reissue labels via the Parcel Pro adapter; tracking panel | mgr / concierge | session | sidebar "Inbound" | tab → row → action sheet (`modules/shipping-inbound.md`) |

Global RS chrome (post-E16): universal search also returns a **SHIPMENTS** group → tracking panel; Client 360 header and Inbox thread header carry the **Track** button; `/today` pins may come from job-message mentions (message icon → `/jobs/:id#msg-<id>`); every job page's Notes card is now **Messages**. Global RS chrome: top search box (universal search), quick actions (Drop-off, Request, Estimate, Ship, Pickup), station badge with division, `+` quick-add (Alt+T), Companion panel button (Alt+M), user menu (Switch user → PIN). Route tiers are enforced by `TierGate` (shows a Restricted page) — **UI only** (`⚠ DRIFT`: no server tier check exists).

## B. RolliWorking `/rw` (bench app; sign-in inside the shell; dark, dense) — post-E16: FOUR surfaces on one scan ledger (desktop · Supervisor Pad · Bench Pads · station scanners), see `modules/rolliworking.md`
| route | purpose | who | division | flow |
|---|---|---|---|---|
| `/rw` | My Bench (same component as `/bench`) | any (bench roles centred) | session | act from rows; "<Component> done" inline |
| `/rw/jobs`, `/rw/jobs/:id` | jobs lookup (scope banner) and bench job page — **no money** | any | session | search → open → actions/components/evidence |
| `/rw/parts` | my parts requests, start one from my jobs, chat assistant, shop-wide list | any | session | select job → Open → chat → attach → submit |
| `/rw/qc` | QC lane: testing jobs, evidence n/required, Pass (gated) / Fail (reason) | mgr | session | pass/fail from the row |
| `/rw/supervisor` | same as `/supervisor` | mgr | all ⚠ | — |
| `/rw/floor` | two-lane legacy floor (head / band → Final assembly; Into safe: awaiting components, holds, approval, ready) | any | session | read → chip → job |
| `/rw/evidence` | evidence capture station: scan label → four QC slots | any | session (queue) | scan → slot → photo → save |
| `/rw/today` | same as `/today` | any | session | — |
| `/rw/queue` **[post-E16]** | work queue: one row per open job, oldest first, overdue + client-replied flags, per-part chips | any | session | row → `/rw/jobs/:id` (`modules/rw-shop-floor.md`) |
| `/rw/bulk` **[post-E16]** | Bulk Assign: scan `TECH-<short>` then labels → custody + assign + start; courtesy email with 30-min Undo | mgr | session | scan tech → scan labels → undo (`modules/rw-bulk-assign.md`) |
| `/rw/wm` **[post-E16]** | Watchmaker Room bench mode for the signed-in tech: cards, request part, → safe, send-by-scan, **Messages** block | any | session | PIN switch → act on own cards |
| `/rw/station` **[post-E16]** | station scanner: pick station → scan labels; parts move like registered mail | any | session | station → scan |
| `/rw/pad` **[post-E16]** | **Supervisor Pad** (iPad): Jobs / Parts / Review tabs, stage fwd/back with reasons, reassign, three-tier parts composer, M3KE, camera, parts history, job messages | mgr | session | scan → card / composer (`modules/rw-supervisor-pad.md`) |
| `/rw/picking` **[post-E16]** | picking queue: location, on-hand vs to-pick, picked / short / found-elsewhere | any | session | tap or bin scan (`modules/rw-picking.md`) |
| `/rw/bench` **[post-E16]** | **Bench Pad** (kiosked iPad per bench): PIN lock → per-tech board (in progress · attention · splits · outsourced · messages · completed · goals); idle re-lock; offline banner; long-press settings | any (own board) | station | card + PIN → board (`modules/rw-bench-pad.md`) — **renders without a signed-in shell user** |
Boundary: any link to an RS path is rewritten (`/jobs/:id` → `/rw/jobs/:id`) or blocked with an inline notice. In KEEPER the boundary is authentication, not link handling.

## C. RolliConnect `/rc` (client portal; magic-link session; warm skin)
| route | purpose | who | flow |
|---|---|---|---|
| `/rc` | request magic link by email (link shown on screen — mock) | public | email → link → `/rc/auth/:token` |
| `/rc/auth/:token` | redeem link → client session | public | auto-redirect home |
| `/rc/home` | my watches with plain-language status, requests card, messages, estimates awaiting me | client | click through |
| `/rc/estimates/:id` | approve / decline (reason) an estimate | client | decision → job/estimate status flips, comms threaded |
| `/rc/invoices/:id` | invoice, balance, pickup code / shipping address, schedule pickup window | client | address or window → staff task/notification |
| `/rc/watches/:id` | watch page: status, history, timing/evidence summary | client | read |
| `/rc/report/:token` | inspection report (grades, photos, notes) with approve/decline; superseded → forward | public link, owner-checked | decide once |
| `/rc/messages` | threads with staff | client | send → Comms hub |
| `/rc/*` | not found | — | — |

## D. RolliTime `/rt` (timing bench; standard card + password, no camera)
`/rt` testing queue + label scan → `/rt/test/:jobId` six-position Witschi-style test → PASS (email, QC flag) / REJECT (reason → qc_fail). mgr/any: any staff of the station division.

## E. RGTime `/rg` (phone PWA; remembered per-device login)
`/rg` status + today's punches + Simulate NFC tap picker → `/rg/clock?tag=<id>` one-button clock in/out (division from tag) → `/rg/manager` card + password, manager tier: week grid. All staff on the card list (a phone is not station-bound).

## F. Kiosk `/kiosk` (public, full-screen, no session)
idle → brand pick (Rolliworks / RolliShop) → services (multi, optional) → form (first/last/email/phone required, notes) → thank-you (5 s). Creates a `kiosk` service request landing in RS `/requests`; matches existing clients by email or phone.
