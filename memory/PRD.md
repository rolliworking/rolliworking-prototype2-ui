# RolliSuite — Prototype UI (Session E1)

## Original problem statement (current direction, June 2026)
Build the shell of an internal ERP web app for a luxury watch service center. PROTOTYPE for internal
evaluation — fake data only. Architecture rule: ALL data access goes through ONE module `src/api/client`
exporting typed functions; screens never fetch directly. Client returns mock data from fixtures in one
folder; later only that module is repointed at the real API.

User choice (this session): standalone prototype app at `/app/frontend` (Vite + React 18 + TS + Tailwind),
zero backend. Legacy monorepo (`/app/apps/rollisuite-api`, `/app/apps/rollisuite-web`, Fastify/Prisma) is
left untouched for reference and is NOT served.

## Users / access tiers
| badge | display | tier |
|---|---|---|
| michael | MH — Inspector · Manager | manager |
| walter | Walter — Inspector · Manager | manager |
| vienna | Vienna — Concierge · Admin assistant | concierge |
| mm | MM — Watchmaker Room Supervisor · Manager | manager |
Duty label is display-only; visibility governed solely by tier. Concierge sidebar: Dashboard, Daily Hit List,
Intake, Estimates, Labels, Help. Direct URL to manager-only route → Restricted page.

## Architecture
```
/app/frontend
├── index.html, vite.config.ts (0.0.0.0:3000, allowedHosts), tailwind.config.js, tsconfig.json
└── src
    ├── api/client.ts          # THE ONLY data-access module (async, 120ms simulated latency)
    ├── api/types.ts           # shared types
    ├── api/fixtures/          # users, clients(25), watches(15), estimates(12), jobs(10), hitList(10), activity(10), time helpers
    ├── auth/AuthContext.tsx   # user session (localStorage key rollisuite.prototype.currentUserId)
    ├── config/navigation.ts   # NAV_ITEMS (tiers, pinned), QUICK_ACTIONS
    ├── components/layout/     # AppShell (+PrototypeBanner), Sidebar, TopBar, GlobalSearch
    ├── components/ui/         # Card, Table, Button/PageHeader/FilterChip, Pills (StatusPill, OwnerChip)
    ├── components/dashboard/  # KpiCards (KpiRow, DeptPnlStrip), HitListPanel, RecentActivity
    ├── components/hitlist/HitListRow.tsx
    ├── hooks/useAsync.ts, hooks/useHitList.ts
    └── pages/ BadgeSignIn, Dashboard, HitListPage, EstimatesPage, JobsPage, ClientDetailPage, Placeholders
```
Package manager: yarn 1.22 (frontend/package.json sets `packageManager: yarn@1.22.22` to bypass the root
monorepo's yarn@4 corepack check). Supervisor runs `yarn start` in /app/frontend.

## Implemented (2026-06, session E1) — tested via testing agent, iteration_2.json, 13/13 pass
- Badge sign-in (autofocus, Enter, error state, badge hint chips), Switch user in persistent header
- Amber "PROTOTYPE — fake data" banner on every screen
- Sidebar (15 items, Hit List pinned/green), tier-filtered; placeholders for unbuilt sections; 404 page
- Top bar: global client search (name/email/phone/company, keyboard nav, dropdown → /clients/:id) + 5 action buttons → /actions/:key placeholders
- Dashboard: 6 KPI cards (clickable to filtered lists), dept P&L strip, Daily Hit List panel with working checkboxes + owner chips, Recent activity (10)
- Daily Hit List page (owner filters, show-completed), Estimates & Jobs tables with status filter chips (?status=), Client detail page

## Backlog
- P1: Intake flow screens, Estimate detail/approval mock, Job detail, Labels mock printing
- P1: Repoint `src/api/client.ts` at the real RolliSuite API (Fastify) when ready
- P2: Inspection photos gallery mock, Reports charts, Sales/Purchasing/Inventory tables from fixtures
- P2: Persist hit-list done state to localStorage; owner "assign to me" action
