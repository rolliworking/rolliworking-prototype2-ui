# rolliworking-prototype2-ui (D-183)

Standing mirror for the rebuild prototype UI. This repo starts with a typed Contract v1 client that talks to the Phase A `prototype-api` (local default `http://127.0.0.1:8787`).

- No real email, money, or carrier calls.
- No credentials in the front end — passwords and PINs stay server-side on `prototype-api`.
- OperationIds match `documentation/api/CONTRACT-v1.yaml` / `rebuild-hq/prototype-api/API-DOORS.md`.

```ts
import { listEstimates, getHitList } from "./src/api/client.ts";

const estimates = await listEstimates({ limit: 10 });
const hitList = await getHitList({ date: "2026-09-24" });
```

Set `VITE_PROTOTYPE_API_BASE` (or pass `{ baseUrl }` into helpers) when the API is not on localhost.
