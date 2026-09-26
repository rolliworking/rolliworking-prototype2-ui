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
src_files = {}
for f in glob.glob(f'{ROOT}/**/*.tsx', recursive=True):
    src_files[f.replace(ROOT + '/', '')] = open(f).read()
def callers(name):
    out = [f for f, s in src_files.items() if re.search(r'\bapi\.' + re.escape(name) + r'\b', s)]
    return ', '.join(sorted(out)) or '— (internal / other client.ts functions only)'
def side_effects(name):
    body = ''
    idx = client.find(f' {name}(')
    if idx < 0: idx = client.find(f' {name} =')
    if idx >= 0:
        body = client[idx: idx + 2500]
    fx = []
    if 'appendAudit' in body or 'Stamp(' in body or 'stamp(' in body: fx.append('audit')
    if 'store.outbox' in body or 'queueJobEmail' in body: fx.append('email → Outbox')
    if 'threadEvent' in body or 'pushConv' in body: fx.append('comms thread')
    if 'pushTransition' in body or 'transitionJob' in body: fx.append('job status')
    if 'store.labels' in body or 'queueLabel' in body: fx.append('label queue')
    if 'localStorage' in body or 'writeJson' in body: fx.append('localStorage')
    return ', '.join(fx) or 'none (read)'
lines = ['# 05 — API CONTRACT (target surface for the real backend)', '',
         'Every exported function of `src/api/client.ts`, generated from the code (`_gen.py`). Screens only ever call these. In KEEPER each `async` entry becomes an HTTP endpoint (or RPC); each `sync` helper becomes either a server-computed field or a shared pure function.',
         '', 'Columns: **kind** (async = crosses the wire; sync = pure/derived; const = lookup table) · **signature** as written · **side effects** detected in the body (audit rows, Outbox email, comms thread, job status change, label queue, localStorage) · **callers** (screens / components that call `api.<name>`).',
         '', 'Read with `04-DATA-MODEL-VS-KEEPER.md` for the shapes and `08-AUDIT-TAXONOMY.md` for what "audit" means per call.', '']
last = None
for cur, name, kind, sig in entries:
    if cur != last:
        lines += ['', f'## {cur}', '', '| export | kind | signature | side effects | callers |', '|---|---|---|---|---|']
        last = cur
    esc = sig.replace('|', '\\|')
    lines.append(f'| `{name}` | {kind} | `{esc}` | {side_effects(name)} | {callers(name)} |')
lines += ['', f'_Total exports: {len(entries)}._']
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
        fn = re.findall(r'(?:export )?(?:async )?(?:function|const) ([A-Za-z0-9_]+)', pre)
        hits.add(fn[-1] if fn else '?')
    emitters[t] = sorted(hits)
lines = ['# 08 — AUDIT TAXONOMY', '', 'Generated from `AuditEventType` in `types.ts` and every `appendAudit({ type: … })` site in `client.ts`. The prototype keeps the last 60 events in `localStorage` (`rollisuite.prototype.auditLog`); KEEPER writes every event to an append-only ledger (see `04-DATA-MODEL-VS-KEEPER.md` → telemetry).', '',
         '## Event shape (`AuditEvent`)', '', '```ts' + ev + '```', '',
         '`method` is set on sign-in events (`password_photo` | `pin_switch`); `cameraStatus`/`photoDataUrl` on password sign-ins; `stationName` is the registered station (or "Phone (RGTime PWA)", "Kiosk", "RolliConnect"). `detail` is a human sentence prefixed with the entity number (e.g. `E02013 · Component complete · Watch head · by MM`).', '',
         '## Types → emitters', '', '| type | emitted by (function / stamp helper in client.ts) | UI filter chip |', '|---|---|---|']
chips = {'sign_in': 'Sign-ins (with sign_in_failed, sign_out)', 'station_registered': 'Station (all station_*)', 'intake': 'Intake', 'estimate': 'Estimates', 'job': 'Jobs (with task, pin, parts)', 'sales': 'Sales', 'portal': 'RolliConnect', 'kiosk': 'Kiosk', 'rgtime': 'RGTime'}
for t in atypes:
    lines.append(f"| `{t}` | {', '.join('`'+e+'`' for e in emitters[t]) or '(stamp helper — see below)'} | {chips.get(t, 'All only')} |")
lines += ['', '## Stamp helpers (one type each, called from many functions)', '',
          '| helper | type | prefix |', '|---|---|---|',
          '| `stamp` | intake | `<ref> · detail` |', '| `jobStamp` | job | `<job#> · detail` |', '| `partsStamp` | parts | `<PR#> · detail` |', '| `portalStamp` | portal | client action in /rc |', '| `rtStamp` | rollitime | `<job#> timing PASS/REJECT …` |', '| `rgAudit` | rgtime / sign_in / sign_in_failed / sign_out | RGTime phone events |', '| `kioskAudit` | kiosk | `<RQ#> · name · brand …` |',
          '', 'KEEPER rule: every write endpoint emits exactly one audit row with `{ type, actor, station/device, entity_ref, detail, at }`; reads emit none. Sign-in photo capture is stored as a blob reference, not inline base64.']
open(f'{OUT}/08-AUDIT-TAXONOMY.md', 'w').write('\n'.join(lines))

# ---------- 09-TEST-INVENTORY ----------
lines = ['# 09 — TEST INVENTORY (regression checklist KEEPER must also pass)', '',
         'One section per testing-agent iteration (`/app/test_reports/iteration_N.json`). Each verified acceptance line is restated as a checkbox. KEEPER passes when every box can be ticked against the production build (same behaviours, different implementation).', '']
for n in range(1, 40):
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
    for a in acc:
        lines.append(f'- [ ] {str(a).strip()}')
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
tags = {'E1': 'auth-stations, dashboard-today', 'E2': 'intake', 'E3': 'estimates', 'E4': 'jobs', 'E5': 'sales', 'E6': 'workshop', 'E7': 'client-360', 'E8': 'rolliconnect', 'E9': 'purchasing-inventory, labels-reports-accounting, setup-integrations-help, jobs (evidence)', 'E10': 'companion-panel', 'E11': 'rolliworking', 'E12': 'rollitime', 'E13': 'rgtime, kiosk-requests', 'E14': 'comms-hub', 'E15': 'comms-hub, rolliconnect, jobs', 'Division': 'auth-stations, dashboard-today, jobs, workshop', 'Hit-list': 'dashboard-today', 'component': 'jobs, workshop, rolliworking, labels-reports-accounting', 'Documentation': 'all'}
for block in re.split(r'\n(?=## )', dec):
    head = block.split('\n')[0]
    tag = next((v for k, v in tags.items() if k.lower() in head.lower()), 'cross-cutting')
    lines += [block.strip(), '', f'**Modules touched:** {tag}', '']
open(f'{OUT}/02-DECISIONS-CONSOLIDATED.md', 'w').write('\n'.join(lines))
print('generated', len(entries), 'api entries;', len(atypes), 'audit types')
