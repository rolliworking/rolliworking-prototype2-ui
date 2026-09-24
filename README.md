# rolliworking-prototype2-ui (D-183)

Standing mirror for the rebuild prototype UI. Typed Contract v1 client + E1 shell/dashboard.

- API: Phase A `prototype-api` at `http://127.0.0.1:8787` (override with `VITE_PROTOTYPE_API_BASE`)
- No real email, money, or carrier calls
- No credentials in the front end

```bash
# terminal 1 — API
cd ../rebuild-hq/prototype-api && npm start

# terminal 2 — UI
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Home, **Estimates**, **Hit list**, **Sales**, and **Intake** (packages / receive watch / leads). Inventory / PO / QBO live stay UNKNOWN or stub.
