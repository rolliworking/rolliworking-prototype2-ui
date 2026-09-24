# RolliSuite — Prototype UI

Internal ERP shell for a luxury watch service center. **Prototype — fake data only.**

The app lives in [`frontend/`](./frontend) (Vite + React 18 + TypeScript + Tailwind).

```bash
cd frontend
yarn install
yarn dev        # http://localhost:3000
```

## Architecture rule
All data access goes through **one module**: `frontend/src/api/client.ts`. Screens only call its typed
functions (`getClients()`, `getHitList()`, `getDashboardStats()`, `getCurrentUser()`, `signInWithPassword()`, …).
Today those functions resolve from local fixtures in `frontend/src/api/fixtures/`; pointing the app at a real
API means editing only `client.ts`.

## Sign-in (prototype)
Pick your staff card → password → one webcam verification photo is captured on submit (graceful "no camera"
fallback). Users already signed in today switch with a 4-digit PIN from the header. The device is bound to a
station (mocked as **Front Desk 1**) that stamps every audit event. Mock credentials are shown on screen:
password `firstname123`, PIN `1234`. Audit log: Setup → Audit log.
