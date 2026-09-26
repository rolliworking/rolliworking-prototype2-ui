# 08 — AUDIT TAXONOMY

Generated from `AuditEventType` in `types.ts` and every `appendAudit({ type: … })` site in `client.ts`. The prototype keeps the last 60 events in `localStorage` (`rollisuite.prototype.auditLog`); KEEPER writes every event to an append-only ledger (see `04-DATA-MODEL-VS-KEEPER.md` → telemetry).

## Event shape (`AuditEvent`)

```ts
  id: string;
  type: AuditEventType;
  timestamp: string;
  stationName: string;
  userShortName?: string;
  userDisplayName?: string;
  method?: SignInMethod;
  cameraStatus?: CameraStatus;
  photoDataUrl?: string;
  detail: string;
```

`method` is set on sign-in events (`password_photo` | `pin_switch`); `cameraStatus`/`photoDataUrl` on password sign-ins; `stationName` is the registered station (or "Phone (RGTime PWA)", "Kiosk", "RolliConnect"). `detail` is a human sentence prefixed with the entity number (e.g. `E02013 · Component complete · Watch head · by MM`).

## Types → emitters

| type | emitted by (function / stamp helper in client.ts) | UI filter chip |
|---|---|---|
| `sign_in` | `stationName` | Sign-ins (with sign_in_failed, sign_out) |
| `sign_in_failed` | `stationName` | All only |
| `sign_out` | `user` | All only |
| `station_registered` | `st` | Station (all station_*) |
| `station_renamed` | `actor` | All only |
| `station_reset` | `actor` | All only |
| `intake` | `a` | Intake |
| `estimate` | `a` | Estimates |
| `job` | `a` | Jobs (with task, pin, parts) |
| `task` | `a` | All only |
| `pin` | `a`, `p` | All only |
| `sales` | `a` | Sales |
| `parts` | `a` | All only |
| `portal` | `c`, `m` | RolliConnect |
| `purchasing` | `rsStamp` | All only |
| `inventory` | (stamp helper — see below) | All only |
| `setup` | (stamp helper — see below) | All only |
| `evidence` | (stamp helper — see below) | All only |
| `labels` | (stamp helper — see below) | All only |
| `accounting` | (stamp helper — see below) | All only |
| `companion` | `a` | All only |
| `comms` | `a` | All only |
| `rollitime` | `a` | All only |
| `rgtime` | `rgAudit` | RGTime |
| `kiosk` | `c`, `kioskAudit` | Kiosk |

## Stamp helpers (one type each, called from many functions)

| helper | type | prefix |
|---|---|---|
| `stamp` | intake | `<ref> · detail` |
| `jobStamp` | job | `<job#> · detail` |
| `partsStamp` | parts | `<PR#> · detail` |
| `portalStamp` | portal | client action in /rc |
| `rtStamp` | rollitime | `<job#> timing PASS/REJECT …` |
| `rgAudit` | rgtime / sign_in / sign_in_failed / sign_out | RGTime phone events |
| `kioskAudit` | kiosk | `<RQ#> · name · brand …` |

KEEPER rule: every write endpoint emits exactly one audit row with `{ type, actor, station/device, entity_ref, detail, at }`; reads emit none. Sign-in photo capture is stored as a blob reference, not inline base64.