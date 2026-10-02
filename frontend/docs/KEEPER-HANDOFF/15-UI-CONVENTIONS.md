# 15 — UI CONVENTIONS (one line per rule · D-number or spec file that owns it · 2026-10-02)

Code is truth; every rule below is implemented and the cited ruling is where it was locked. "Convention (no ruling)" = the prototype's own habit, inherit unless MH says otherwise. Component names are real files under `src/components`.

## Colour, status, tokens
| rule | owner |
|---|---|
| **Accent, not yellow**: every selection / active / focus highlight uses `--accent #5CE1FF` (Tailwind `accent`); `--warn #F5B400` is for warnings only | D-402 |
| **Amber = provisional or bypass**: amber banners / chips mark unruled defaults, bypass use, placeholder cards; never a success state | `00-INDEX` vocabulary · `03-OPEN-QUESTIONS` |
| **Red = blocker / stop**, **rose = reply owed by us**, **green = moving / on track**, **blue = finished**, **empty ring = not part of this job** — the same five meanings everywhere | D-413 · D-444 · D-411 |
| Red rail on HIGH-priority pins; HIGH pins sort first | D-417 · D-418 |
| Late vendor leg = red; due within 2 days = amber; vendor legs draw dashed | D-411 |
| Theme stays black / grey; RW shell dark (`.rw-dark`), RS light; never invert per screen | D-402 · `modules/rolliworking.md` |

## W · B · P dots (staff) and portal dots
| rule | owner |
|---|---|
| Dot row order is always **W · B · P** (head / movement · bracelet · case / polish); multi-item → worst state wins | D-413 |
| The row sits **directly under the client name** (job header, Client 360, directory, Hitlist, Concierge TRACK cards, appointments, intake lists, call pop, search hits, Inbox rows + header) | D-413 · D-437 |
| On a job header the row shows **every open job of the client, this job outlined and first** | D-413 |
| **PM** is an amber department tag, never a dot; dept letter chips survive only on rows without a job | D-416 |
| Jobs list / All jobs carry a sortable **W · B · P** column (red → blue → green → none, within lane) | D-416 |
| Inbox job card shows dots **only while the watch is in our possession** | "INBOX JOB-CARD SLIDE-OUT — SECTIONS + EXPAND · DOTS ONLY WHILE IN POSSESSION" (02) |
| **Portal dots** use client words only: empty = not part of this service · green = moving · red = not moving (never a vendor name or hold reason) · blue = done; the rating never reaches the portal | D-425 · client-rating ruling 2026-09-27 |
| A red portal dot **does something**: opens the approval that blocks it (estimate / `/rc/parts/:id`) or a pre-drafted Ask into the RS Inbox | D-426 · D-427 |
| Portal process line = five client-safe stops **Received · In queue · In progress · Quality check · Ready** + projected date | D-429 |
| A component-scoped hold reds only that leg — everywhere (job flow, staff dots, portal dots) | D-428 |

## Numbers, names, words
| rule | owner |
|---|---|
| Estimate / job numbers **display as raw digits** on the Hitlist (`E02015` → `02015`); inputs accept both forms | D-382 (applied D-397) |
| **Sent, not Outbox** — the folder is Sent, the record is a Sent record; internal identifiers (`OutboxEmail`, `getOutbox`) unchanged | D-419 · D-467 |
| Client-facing text uses **plain-language status names**, never internal codes or station keys (`PLAIN_LOCATION`) | D-465 · AI summary ruling 2026-09-27 |
| **RQ-YY-####** = portal / web request · **SUB-YY-####** = physical receiving · never mixed | numbering ruling 2026-09-27 · D-457 |
| Email subject prefix for B2B references is exactly `[REF: <ref>] <subject>` | locked 2026-09-28 |
| Front-desk initials **VC** (Vienna) / **CM** (Chyna) on tiles and avatars; short names unchanged | G2 (02) · D-414 |
| Header on the personal list reads **"Hitlist · <Name> · <Role>"** (owner → "Owner", else duty label) | D-397 |
| Link-expired copy is always **"This link has expired — sign in to see your watch."** (`LINK_EXPIRED_COPY`) | CLIENT PORTAL — THREE TIERS (02) |
| Framing sentence on every rw.com CHECK report: "Consistency check against reference data — not an authentication." | D-456 |

## Inbox
| rule | owner |
|---|---|
| One **flat** list; tabs **Portal · Team · Calls** (+ **Views**, owner only); no folder tree | D-459 |
| **No count badges inside the Inbox** — a 6 px tag dot per tag, bold + rose = unread / reply owed, paperclip + n for attachments | D-459 |
| **Tags are pointers, not assignment**; several tags may sit on one thread; WHO filter = "their action items" | D-443 |
| **Archive, never delete** — the Delete key on a focused row archives | D-460 |
| Row colour = who spoke last (rose left border when the client did); sort pinned → reply owed → newest | D-444 |
| Right-click / long-press on a row or header = tag · pin · move · archive menu | D-445 · `ThreadContextMenu.tsx` |
| **Back to message** chip on any page reached from a thread; one level deep, Escape or plain `/inbox` clears | D-462 |
| Quick actions never send by themselves: Add note is internal, Parts request leaves one internal line, Generate summary lands in the reply box | D-463 · D-464 · D-465 |
| Reply channel follows the thread (`→ portal` / `→ email` chip on the composer; `via portal` / `via email` on the row); no SMS from the Inbox | D-466 |
| Requests are intake records, not Inbox rows; "Notify…" creates an Internal thread that links the request | D-461 |

## Panels, sheets, layout
| rule | owner |
|---|---|
| **Right slide-out** = shared `RightSheet` / `SlidePanel`: one third of the screen on desktop, full-width sheet on a pad, Esc / X closes, `?panel=1` keeps it open across rows | D-438 · D-396 |
| Hitlist top row **Appointments \| Pinned** side by side (stacks < 1024 px); inbox behind a header chip → drawer | D-397 |
| Collapsed cards (`CollapsedCard`) for the original estimate, inspection report and "More" on the job page; counts on the first two | D-411 |
| Staff screens are dense, left-aligned, keyboard-first; client screens (`/rc`) are warm, **phone-first at 390 px**, single column with a `sm:` desktop breakpoint, no tablet layout | `source/DESIGN-PRINCIPLES.md` · CLIENT PORTAL — THREE TIERS (02) |
| Print views (SO, appraisal, inspection form, RW reports) are real US Letter via `@media print` + `@page { size: letter }` | RW Reports ruling 2026-09-27 |

## Pads, scanners, touch
| rule | owner |
|---|---|
| Every `/rw/*` screen carries the **role tab bar**; `/choose-view` and kiosks have none | D-393 |
| **44 pt minimum** on every control inside the RW shell; numeric fields use `inputMode`; safe-area insets honoured | D-403 |
| **Send back LEFT / Advance RIGHT** on every stage card (pad job cards, Dashboard trade review) | queued-brief batch 2026-09-27 (`modules/rw-supervisor-pad.md`) |
| A **wedge scanner works with any focus** — fast keystrokes + Enter are captured unless an input owns focus | D-409 |
| Assign / Move is **destination-first**: arm a node, scan labels → chips with a verdict (legal / refused / pending), COMMIT moves all legal chips in one event | D-412 |
| Maps never show counts on the Assign / Move screen; only the single looked-up job's parts are marked | Assign/Move refinements 2026-09-27 |
| Manager safes render the safe image, no label; locks mean "that manager's safe" (owner shown) | Shop Floor station map 2026-09-27 |
| Offline: cached board is read-only, scans queue and replay — never applied locally; banners `rw-offline-banner` / `rw-replay-banner` | D-404 |
| Pad inputs for people are **tiles with initials**, not dropdowns; dictation and rear camera prominent | D-414 |
| Pickup / station gates: approval by a **different** manager with their PIN + a reason; the staffer running the step can never approve their own exception | `specs/SPEC-PICKUP-STATION.md` |

## Messaging, presence, notices
| rule | owner |
|---|---|
| Message bubble FAB bottom-right on RS and RW; tabs SEND · INBOX · SENT; 3-second banner on a new row for the viewer | D-414 |
| Presence dots are **derived, never toggled** (away / with client / at bench) | D-414 |
| Links in messages: RS links → in-app chips; external → new tab on desktop, text + Copy on pads; never unfurled | D-414 (item 6) |
| A message is a nudge; the job note is the record (`@mention` notes untouched) | D-389 |
| Duplicate client names → non-blocking 8-second warning toast, never a modal | band-only labels / duplicate-name ruling 2026-09-28 |
| View-as banner is fixed on every screen, kiosks included: "Viewing as X — actions are recorded as MH (as X)" | D-385 |
| Reception stations show the RECEPTION badge and hide in-house badges for every role | reception ruling 2026-09-29 (`12 §5`) |

## Money and identity
| rule | owner |
|---|---|
| **No $ for non-manager tiers under `/rw`** — `useFmtMoney()` renders `—`; the Companion hides money too | `12-ROLES-AND-ACCESS.md §3` |
| Rating badge **a / b / c** with hover legend; staff-only, never imported by `/rc` | D-451 · client-rating ruling 2026-09-27 |
| Signed-in portal only shows the client's own objects; a LINK page shows one object and offers "Create your account / Sign in" with the email pre-filled | CLIENT PORTAL — THREE TIERS (02) |

## Conventions (no ruling — inherit unless told otherwise)
| rule | owner |
|---|---|
| Every interactive element and every user-facing value carries a kebab-case `data-testid`; test ids never change when labels do | convention · `09-TEST-INVENTORY.md` |
| Icons are `lucide-react`, never emoji; shadcn-style primitives under `components/ui` | convention |
| Toasts via `toast.warn` (`components/ui/Toast.tsx`); `ApiToast` for "API unreachable — showing mock data" | convention · `11 §1` |
| Dev-only affordances (Simulate scan, placeholder shots, instrumentation panel, `?fast=1`) are gated on `import.meta.env.DEV` and listed in `10-NOT-KEEPER.md` | convention |
