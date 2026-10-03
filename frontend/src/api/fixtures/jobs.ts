import type { DeptCode, Department, Division, EstimateLine, HoldType, ComponentKey, Job, JobKind, JobPriority, JobStatus, JobTransition, Role, ShopTimeEntry } from '../types';
import { estimates } from './estimates';
import { seedPhoto } from './intake';
import { daysAgo, daysFromNow } from './time';

// Linear order of the pack's full status list — the shop-floor map reads left to right
export const JOB_FLOW: JobStatus[] = ['intake', 'in_review', 'awaiting_customer_approval', 'approved', 'in_service', 'testing', 'awaiting_manager_review', 'ready_to_ship', 'closed'];
// Trade jobs skip the estimate/approval stages and add the division-manager review; every other kind skips manager review
export const TRADE_SKIP: JobStatus[] = ['in_review', 'awaiting_customer_approval', 'approved'];
export const flowFor = (kind: JobKind): JobStatus[] => JOB_FLOW.filter((s) => (kind === 'trade' ? !TRADE_SKIP.includes(s) : s !== 'awaiting_manager_review'));

export const DEPT_OF_CODE: Record<DeptCode, Department> = { W: 'watchmaking', B: 'band', P: 'polish', PM: 'watchmaking' };

let seq = 0;
const line = (description: string, unitPrice: number, dept: DeptCode, qty = 1): EstimateLine => ({ id: `jl-${String(++seq).padStart(3, '0')}`, description, qty, unitPrice, dept, taxable: true, type: 'service' });

const STAFF = ['Leo', 'Walter', 'MH'];
const STATION = ['Bench 1', 'Bench 2', 'Front Desk 1'];

const ACTION_LABEL: Partial<Record<JobStatus, string>> = { in_review: 'start_review', awaiting_customer_approval: 'request_approval', approved: 'approve', in_service: 'start_service', testing: 'to_testing', awaiting_manager_review: 'to_manager_review', ready_to_ship: 'qc_pass', closed: 'close' };

// Walk the machine from intake up to `status`, spacing transitions across the job's age
const flow = (status: JobStatus, createdDaysAgo: number, by: string, kind: JobKind = 'service'): JobTransition[] => {
  const path = flowFor(kind);
  const idx = path.indexOf(status);
  const step = Math.max(1, Math.floor(createdDaysAgo / (idx + 1)));
  const out: JobTransition[] = [{ id: `jt-${++seq}`, from: null, to: 'intake', action: 'create', at: daysAgo(createdDaysAgo, 9), by: 'Vienna', station: 'Front Desk 1' }];
  for (let i = 1; i <= idx; i += 1) {
    const to = path[i];
    out.push({ id: `jt-${++seq}`, from: path[i - 1], to, action: kind === 'trade' && to === 'in_service' ? 'trade_scan_in' : ACTION_LABEL[to] ?? 'update_status', at: daysAgo(createdDaysAgo - i * step, 10 + i), by: i < 3 ? 'Walter' : by, station: i < 3 ? STATION[2] : STATION[STAFF.indexOf(by) % 2], emailQueued: to === 'awaiting_customer_approval' || to === 'ready_to_ship' });
  }
  return out;
};

interface Seed {
  id: string;
  number: string;
  clientId: string;
  watchId: string;
  estimateId?: string;
  packageId?: string;
  workflow: DeptCode[];
  status: JobStatus;
  priority?: JobPriority;
  simple?: Job['simpleStatus'];
  kind?: JobKind;
  owner?: Role;
  assignees?: string[];
  createdDaysAgo: number;
  dueInDays?: number;
  lines?: EstimateLine[];
  hold?: { type: HoldType; reason: string; daysAgo: number; released?: boolean; component?: ComponentKey };
  qcFail?: string;
  notes?: string[];
  conditionNotes?: string;
  division?: Division;
  returnOf?: { jobId: string; reason: string };
}

const build = (s: Seed): Job => {
  const est = s.estimateId ? estimates.find((e) => e.id === s.estimateId) : undefined;
  const lines = s.lines ?? est?.lines.map((l) => ({ ...l })) ?? [];
  const assignees = s.assignees ?? [];
  const by = assignees[0] ?? 'Walter';
  const kind = s.kind ?? 'service';
  const timeline = flow(s.status, s.createdDaysAgo, by, kind);
  if (s.qcFail) {
    const i = timeline.findIndex((t) => t.to === 'testing');
    if (i > 0) timeline.splice(i + 1, 0, { id: `jt-${++seq}`, from: 'testing', to: 'in_service', action: 'qc_fail', reason: s.qcFail, at: daysAgo(Math.max(1, s.createdDaysAgo - 4), 15), by, station: 'Bench 1', emailQueued: true }, { id: `jt-${++seq}`, from: 'in_service', to: 'testing', action: 'to_testing', at: daysAgo(Math.max(0, s.createdDaysAgo - 6), 11), by, station: 'Bench 1' });
  }
  const simple = s.simple ?? (s.status === 'closed' ? 'finished' : 'on_hand');
  return {
    id: s.id,
    number: s.number,
    clientId: s.clientId,
    watchId: s.watchId,
    estimateId: s.estimateId,
    packageId: s.packageId,
    department: DEPT_OF_CODE[s.workflow[0]],
    workflow: s.workflow,
    kind,
    status: s.status,
    simpleStatus: simple,
    priority: s.priority ?? 'normal',
    division: s.division ?? 'rolliworks',
    lines,
    total: lines.reduce((t, l) => t + l.qty * l.unitPrice, 0),
    owner: s.owner ?? (kind === 'service' ? undefined : 'concierge'),
    assignees,
    intakeDate: simple === 'estimate' ? undefined : daysAgo(s.createdDaysAgo, 9),
    conditionNotes: s.conditionNotes,
    dueAt: s.dueInDays !== undefined ? daysFromNow(s.dueInDays) : undefined,
    finishedAt: s.status === 'closed' ? timeline[timeline.length - 1].at : undefined,
    createdAt: daysAgo(s.createdDaysAgo, 9),
    createdBy: 'Vienna',
    timeline,
    holds: s.hold ? [{ id: `jh-${++seq}`, type: s.hold.type, reason: s.hold.reason, priorStatus: s.status, placedAt: daysAgo(s.hold.daysAgo, 14), placedBy: by, station: 'Bench 1', component: s.hold.component, ...(s.hold.released ? { releasedAt: daysAgo(Math.max(0, s.hold.daysAgo - 3), 9), releasedBy: by, releaseNote: 'Parts arrived' } : {}) }] : [],
    notes: (s.notes ?? []).map((text, i) => ({ id: `jn-${++seq}`, text, at: daysAgo(Math.max(0, s.createdDaysAgo - i - 1), 16), by, station: 'Bench 1' })),
    photos: JOB_FLOW.indexOf(s.status) >= 2 ? [{ ...seedPhoto(`Inspection ${s.number} front`), id: `jp-${++seq}`, at: daysAgo(Math.max(0, s.createdDaysAgo - 1), 11), by: 'Walter', station: 'Front Desk 1' }] : [],
    returnOfJobId: s.returnOf?.jobId,
    returnReason: s.returnOf?.reason,
    inspection: kind === 'service' && JOB_FLOW.indexOf(s.status) >= 2 ? { answers: { case: 'light scratches', crystal: 'clear', bracelet: 'tight', movement: 'running', water: 'not tested' }, at: daysAgo(Math.max(0, s.createdDaysAgo - 1), 11), by: 'Walter', station: 'Front Desk 1' } : undefined,
  };
};

// Pickup Station fixtures: ready_to_ship jobs with an explicit INTAKE photo (photoType 'intake') so step 1 / step 4 have something to compare against
const intakeShot = (number: string, serial: string, d: number) => ({ ...seedPhoto(`Intake ${number} · serial ${serial}`), id: `jp-intake-${number}`, photoType: 'intake' as const, slot: 'Intake — serial engraving', clientVisible: false, at: daysAgo(d, 9), by: 'Vienna', station: 'Front Desk 1' });
const pickupJobs = (): Job[] => {
  const rows: [string, string, string, string, DeptCode[], string, number, JobStatus, EstimateLine[]][] = [
    ['j-pu1', 'E02090', 'c-03', 'w-pu1', ['W', 'P'], 'E4K7P2M9', 18, 'ready_to_ship', [line('Movement service — cal. 3285', 1250, 'W'), line('Case & bracelet refinish', 340, 'P')]],
    ['j-pu2', 'E02091', 'c-05', 'w-pu2', ['W'], 'Q8M3N5R2', 21, 'ready_to_ship', [line('Movement service — cal. 3230', 1150, 'W'), line('Gaskets + pressure test 300m', 180, 'W')]],
    ['j-pu3', 'E02092', 'c-06', 'w-pu3', ['B'], 'L2V8B4T6', 15, 'ready_to_ship', [line('Titanium bracelet — replace clasp spring & re-pin', 260, 'B')]],
    ['j-pu4', 'E02093', 'c-07', 'w-pu4', ['W', 'B'], 'D7H2K9W4', 24, 'ready_to_ship', [line('Movement service — cal. 3285', 1250, 'W'), line('Jubilee bracelet tighten', 220, 'B')]],
    ['j-pu5', 'E02094', 'c-08', 'w-pu5', ['P'], 'F3R9Q6N1', 19, 'ready_to_ship', [line('Case & bracelet refinish — brushed/polished', 380, 'P')]],
    ['j-pu6', 'E02095', 'c-17', 'w-pu6', ['W', 'B', 'P'], 'A9T4M2K8', 17, 'ready_to_ship', [line('Complete movement service — cal. 3235', 1450, 'W'), line('Jubilee re-pin', 180, 'B'), line('Case & bracelet refinish', 340, 'P')]],
    ['j-pu7', 'E02096', 'c-19', 'w-pu7', ['W'], 'B6N1R8V3', 30, 'closed', [line('Movement service — cal. MT5652', 1100, 'W')]],
    ['j-pu8', 'E02097', 'c-20', 'w-pu8', ['P'], 'H2P7L4Q9', 26, 'closed', [line('Case & bracelet refinish', 340, 'P')]],
    // Long-term storage (MH 2026-10-02): finished + invoiced > 90 days, unpaid. j-lt3 is ALREADY in the LTS safe (storage set below)
    ['j-lt1', 'E02098', 'c-22', 'w-lt1', ['W', 'B'], 'K8M2R7T1', 140, 'ready_to_ship', [line('Movement service — cal. 3235', 1450, 'W'), line('Jubilee bracelet re-pin + clasp', 260, 'B')]],
    ['j-lt2', 'E02099', 'c-23', 'w-lt2', ['W'], 'P3Q9V2L6', 118, 'ready_to_ship', [line('Movement service — cal. MT5602', 1100, 'W')]],
    ['j-lt3', 'E02100', 'c-24', 'w-lt3', ['W', 'P'], 'R6T1K9M4', 205, 'ready_to_ship', [line('Complete movement service — cal. 3235', 1450, 'W'), line('Case & bracelet refinish', 340, 'P')]],
  ];
  return rows.map(([id, number, clientId, watchId, workflow, serial, d, status, lines]) => { const j = build({ id, number, clientId, watchId, workflow, status, owner: 'concierge', assignees: ['Leo'], createdDaysAgo: d, dueInDays: status === 'closed' ? undefined : 0, lines }); j.photos.unshift(intakeShot(number, serial, d));
    if (id === 'j-lt3') { const since = daysAgo(38, 16); j.status = 'in_storage'; j.storage = { since, by: 'Vienna', station: 'Front Desk 1', statusBefore: 'ready_to_ship' }; j.timeline.push({ id: `${id}-lts`, at: since, by: 'Vienna', station: 'Front Desk 1', action: 'to_storage', from: 'ready_to_ship', to: 'in_storage', reason: 'Moved to long-term storage · unpaid $1,790 · by scan at Front Desk 1' }); }
    return j; });
};

export const jobs: Job[] = [
  // Born from converted estimates — on the bench
  build({ id: 'j-01', number: 'E02011', estimateId: 'e-01', clientId: 'c-01', watchId: 'w-01', workflow: ['W'], status: 'in_service', priority: 'high', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 9, dueInDays: 12, notes: ['Movement uncased. Mainspring shows fatigue — replacing under service.'] }),
  build({ id: 'j-02', number: 'E02012', estimateId: 'e-03', clientId: 'c-03', watchId: 'w-03', workflow: ['P'], status: 'ready_to_ship', owner: 'concierge', assignees: ['Walter'], createdDaysAgo: 17, dueInDays: -3, notes: ['Ready for pickup — client texted, coming Saturday.'] }),
  build({ id: 'j-03', number: 'E02013', estimateId: 'e-04', clientId: 'c-04', watchId: 'w-04', workflow: ['W', 'P'], status: 'in_service', owner: 'manager', assignees: ['Walter', 'Leo'], createdDaysAgo: 6, dueInDays: 18 }),
  build({ id: 'j-04', number: 'E02014', estimateId: 'e-06', clientId: 'c-06', watchId: 'w-06', workflow: ['W'], status: 'in_service', priority: 'high', assignees: ['Leo'], createdDaysAgo: 28, dueInDays: 9, hold: { type: 'parts', reason: 'Waiting on cal. 3285 mainspring barrel from RSC — ETA 10 days', daysAgo: 6 } }),
  build({ id: 'j-05', number: 'E02015', estimateId: 'e-07', clientId: 'c-07', watchId: 'w-07', workflow: ['B', 'P'], status: 'testing', owner: 'inspector', assignees: ['MH'], createdDaysAgo: 13, dueInDays: 1 }),
  build({ id: 'j-06', number: 'E02016', estimateId: 'e-09', clientId: 'c-09', watchId: 'w-09', workflow: ['W', 'PM'], status: 'in_service', assignees: ['Leo', 'Leo'], createdDaysAgo: 18, dueInDays: 6, hold: { type: 'outsource', reason: 'Bezel out to plating vendor (Goldsmith & Co.) — due back Thursday', daysAgo: 4 } }),
  // Walk-ins / no estimate link
  build({ id: 'j-07', number: 'E02017', clientId: 'c-12', watchId: 'w-12', workflow: ['B'], status: 'ready_to_ship', kind: 'small_job', assignees: ['MH'], createdDaysAgo: 16, dueInDays: -2 }),
  build({ id: 'j-08', number: 'E02018', estimateId: 'e-22', clientId: 'c-10', watchId: 'w-10', workflow: ['P'], status: 'closed', assignees: ['Walter'], createdDaysAgo: 38, dueInDays: -100, lines: [line('Case & bracelet refinish — brushed/polished', 340, 'P')] }),
  build({ id: 'j-09', number: 'E02019', clientId: 'c-15', watchId: 'w-15', workflow: ['W', 'B', 'P'], status: 'closed', assignees: ['Leo'], createdDaysAgo: 33, lines: [line('Complete movement service — cal. 3235', 1450, 'W'), line('Bracelet re-pin & tighten', 260, 'B'), line('Case & bracelet refinish', 540, 'P')] }),
  build({ id: 'j-10', number: 'E02020', clientId: 'c-11', watchId: 'w-11', workflow: ['B'], status: 'approved', kind: 'small_job', createdDaysAgo: 5, dueInDays: 4, lines: [line('Bracelet clasp replacement', 320, 'B'), line('Bracelet re-pin', 160, 'B')] }),
  build({ id: 'j-11', number: 'E02021', estimateId: 'e-02', clientId: 'c-02', watchId: 'w-02', workflow: ['W'], status: 'awaiting_customer_approval', kind: 'warranty', assignees: ['Walter'], createdDaysAgo: 4, lines: [line('Chronograph service — cal. 4130', 1650, 'W')], notes: ['Estimate revised after review — pusher seals worn.'] }),
  build({ id: 'j-12', number: 'E02022', clientId: 'c-05', watchId: 'w-05', workflow: ['W', 'B'], status: 'intake', priority: 'urgent', owner: 'inspector', createdDaysAgo: 1, dueInDays: 10, lines: [line('Movement service — cal. 3230', 1250, 'W'), line('Bracelet screw replacement', 90, 'B')], conditionNotes: 'Crystal scratch at 4 o\u2019clock, bracelet stretch noted at intake.' }),
  build({ id: 'j-13', number: 'E02023', clientId: 'c-13', watchId: 'w-13', workflow: ['B', 'P'], status: 'in_review', kind: 'small_job', assignees: ['Walter'], createdDaysAgo: 2, dueInDays: 14, lines: [line('Titanium bracelet refinish', 420, 'P'), line('Clasp spring replacement', 110, 'B')] }),
  build({ id: 'j-14', number: 'E02024', clientId: 'c-08', watchId: 'w-08', workflow: ['P'], status: 'intake', priority: 'low', simple: 'estimate', createdDaysAgo: 3, lines: [line('Case refinish — polished bevels', 385, 'P')], conditionNotes: 'Package on discrepancy hold — bracelet missing.' }),
  build({ id: 'j-15', number: 'E02025', clientId: 'c-16', watchId: 'w-17', workflow: ['W'], status: 'approved', priority: 'low', createdDaysAgo: 3, dueInDays: 21, lines: [line('Movement service — MT5602', 950, 'W'), { ...line('Caseback engraving — up to 2 lines', 180, 'W'), catalogId: 'svc-23' }] }),
  build({ id: 'j-16', number: 'E02026', clientId: 'c-18', watchId: 'w-16', workflow: ['W', 'P'], status: 'testing', priority: 'high', kind: 'warranty', assignees: ['Leo'], createdDaysAgo: 12, dueInDays: 2, lines: [line('Movement service — cal. 2236', 1150, 'W'), line('Case refinish', 320, 'P')], qcFail: 'Amplitude low in dial-down position (198°) — re-check hairspring', notes: ['Second timing run in progress.'] }),
  build({ id: 'j-17', number: 'E02027', clientId: 'c-19', watchId: 'w-18', workflow: ['PM'], status: 'in_service', assignees: ['Walter'], createdDaysAgo: 7, dueInDays: 8, lines: [line('Platinum bezel refinish — precious metals', 780, 'PM')] }),
  build({ id: 'j-18', number: 'E02028', clientId: 'c-20', watchId: 'w-19', workflow: ['W'], status: 'in_review', priority: 'urgent', assignees: ['MH'], createdDaysAgo: 1, dueInDays: 6, lines: [line('Movement service — cal. 3235', 1450, 'W')], notes: ['Client travelling on the 28th — needs it back before.'] }),
  // Tail stages (E5): fulfilled sales orders waiting for pickup / ship
  build({ id: 'j-21', number: 'E02029', clientId: 'c-14', watchId: 'w-14', workflow: ['W', 'P'], status: 'ready_to_ship', owner: 'concierge', assignees: ['Leo'], createdDaysAgo: 20, dueInDays: 0, lines: [line('Movement service — cal. 2235', 1150, 'W'), line('Case refinish', 320, 'P')] }),
  build({ id: 'j-22', number: 'E02030', clientId: 'c-15', watchId: 'w-15', workflow: ['W'], status: 'ready_to_ship', owner: 'concierge', assignees: ['Walter'], createdDaysAgo: 22, dueInDays: 1, lines: [line('Movement service — cal. 3235', 1450, 'W')] }),
  // History on returning watches
  build({ id: 'j-19', number: 'E01903', clientId: 'c-09', watchId: 'w-09', workflow: ['W'], status: 'closed', assignees: ['Leo'], createdDaysAgo: 60, lines: [line('Movement service — cal. 3135', 1250, 'W')], hold: { type: 'parts', reason: 'Crown tube back-ordered', daysAgo: 45, released: true } }),
  build({ id: 'j-20', number: 'E01887', clientId: 'c-01', watchId: 'w-01', workflow: ['B', 'P'], status: 'closed', assignees: ['Walter'], createdDaysAgo: 75, lines: [line('Bracelet re-pin', 160, 'B'), line('Case & bracelet refinish', 540, 'P')] }),
  // Client 360 seed — Naomi Castellanos: multi-year history across three watches
  build({ id: 'j-23', number: 'E01412', estimateId: 'e-20', clientId: 'c-10', watchId: 'w-10', workflow: ['W'], status: 'closed', assignees: ['Leo'], createdDaysAgo: 907, notes: ['Mainspring replaced under service. Amplitude 285° after 24h.'] }),
  build({ id: 'j-25', number: 'E01788', estimateId: 'e-21', clientId: 'c-10', watchId: 'w-21', workflow: ['W', 'B', 'P'], status: 'closed', assignees: ['Walter', 'Leo'], createdDaysAgo: 402, notes: ['Bezel insert swapped; clasp spring replaced.', 'Client picked up in person — very happy with the blue.'] }),
  // E18 — workshop room seeds: split jobs across lanes, reunification safes, finish-blocked by bracelet
  build({ id: 'j-30', number: 'E02031', clientId: 'c-10', watchId: 'w-20', workflow: ['W', 'B', 'P'], status: 'in_service', priority: 'high', owner: 'manager', assignees: ['Leo', 'Walter'], createdDaysAgo: 4, dueInDays: 10, notes: ['Split three ways — head on Bench 2, case in refinishing, bracelet queued.'], lines: [{ id: 'l-j30-1', dept: 'W', description: 'Complete service — cal. 3285', qty: 1, unitPrice: 145000, type: 'service', taxable: true }, { id: 'l-j30-2', dept: 'P', description: 'Case refinish', qty: 1, unitPrice: 38000, type: 'service', taxable: true }, { id: 'l-j30-3', dept: 'B', description: 'Bracelet refinish + tighten', qty: 1, unitPrice: 26000, type: 'service', taxable: true }] }),
  build({ id: 'j-31', number: 'E02032', clientId: 'c-10', watchId: 'w-21', workflow: ['W', 'B'], status: 'in_service', owner: 'manager', assignees: ['Leo', 'Walter'], createdDaysAgo: 5, dueInDays: 3, notes: ['Head done, waiting in safe — bracelet still in polish (finish blocked).'], lines: [{ id: 'l-j31-1', dept: 'W', description: 'Movement service — cal. 3235', qty: 1, unitPrice: 120000, type: 'service', taxable: true }, { id: 'l-j31-2', dept: 'B', description: 'Bracelet polish', qty: 1, unitPrice: 22000, type: 'service', taxable: true }] }),
  build({ id: 'j-32', number: 'E02033', clientId: 'c-18', watchId: 'w-16', workflow: ['W', 'B', 'P'], status: 'in_service', owner: 'manager', assignees: ['Leo', 'Walter'], createdDaysAgo: 8, dueInDays: 2, notes: ['All three parts waiting at the safes — ready to reunite.'], lines: [{ id: 'l-j32-1', dept: 'W', description: 'Complete service', qty: 1, unitPrice: 98000, type: 'service', taxable: true }, { id: 'l-j32-2', dept: 'P', description: 'Case refinish', qty: 1, unitPrice: 30000, type: 'service', taxable: true }, { id: 'l-j32-3', dept: 'B', description: 'Bracelet refinish', qty: 1, unitPrice: 24000, type: 'service', taxable: true }] }),
  build({ id: 'j-33', number: 'E02034', clientId: 'c-20', watchId: 'w-19', workflow: ['B'], status: 'approved', kind: 'small_job', owner: 'concierge', createdDaysAgo: 1, dueInDays: 6, notes: ['Band-only — bracelet queued in the band lane.'], lines: [{ id: 'l-j33-1', dept: 'B', description: 'Bracelet tighten + polish', qty: 1, unitPrice: 18000, type: 'service', taxable: true }] }),
  // Robert Calloway — R1 closed history (a year ago) · R3 mid-service now
  build({ id: 'j-r1', number: 'E01871', estimateId: 'e-r1', clientId: 'c-30', watchId: 'w-40', workflow: ['W', 'P'], status: 'closed', owner: 'manager', assignees: ['Leo', 'Walter'], createdDaysAgo: 375, dueInDays: -350, notes: ['Mainspring, gaskets, crown tube replaced under service.'] }),
  build({ id: 'j-r3', number: 'E02041', estimateId: 'e-r3', clientId: 'c-30', watchId: 'w-42', workflow: ['W', 'B'], status: 'in_service', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 58, dueInDays: 9, notes: ['Crystal on order — movement service under way meanwhile.'], conditionNotes: 'Light scratch across crystal at 10 o’clock; bracelet stretch 2 mm; caseback unmarked.' }),
  // Trade lane (RolliShop internal) — scan-in only, no inspection report, no estimate; manager review before invoice
  build({ id: 'j-t1', number: 'E02050', clientId: 'c-31', watchId: 'w-50', workflow: ['B'], status: 'in_service', kind: 'trade', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 3, dueInDays: 4, notes: ['RolliShop stock — rivet bracelet restoration, full refinish + re-pin.'], lines: [{ id: 'l-jt1-1', dept: 'B', description: 'Bracelet restoration — rivet Oyster', qty: 1, unitPrice: 185000, type: 'service', taxable: false }, { id: 'l-jt1-2', dept: 'B', description: 'Clasp re-pin + tighten', qty: 1, unitPrice: 45000, type: 'service', taxable: false }] }),
  build({ id: 'j-t2', number: 'E02051', clientId: 'c-31', watchId: 'w-51', workflow: ['B', 'P'], status: 'awaiting_manager_review', kind: 'trade', owner: 'manager', assignees: ['Walter'], createdDaysAgo: 6, dueInDays: 1, notes: ['RolliShop stock — case + bracelet refinish before it goes on display.'], lines: [{ id: 'l-jt2-1', dept: 'P', description: 'Case refinish — brushed / polished', qty: 1, unitPrice: 130000, type: 'service', taxable: false }, { id: 'l-jt2-2', dept: 'B', description: 'Bracelet refinish', qty: 1, unitPrice: 95000, type: 'service', taxable: false }] }),
  build({ id: 'j-24', number: 'E02007', estimateId: 'e-23', packageId: 'pk-11', clientId: 'c-10', watchId: 'w-20', workflow: ['W'], status: 'in_service', priority: 'high', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 19, dueInDays: 5, hold: { type: 'parts', reason: 'Sapphire crystal (OEM) on order from RSC', daysAgo: 12, released: true }, notes: ['Hairline chip found in crystal at inspection — client approved rev 2 adding the crystal.', 'Crystal arrived; fitted and pressure-tested 100m OK.'], conditionNotes: 'Aubergine dial pristine. Light desk wear on clasp.' }),
  // Same-name incident pair: band-only job (no ref/serial → PDF417 encodes the job number) vs a watch job with the usual ref·serial label
  build({ id: 'j-ws1', number: 'E02060', clientId: 'c-32', watchId: 'w-52', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'concierge', assignees: ['MH'], createdDaysAgo: 3, dueInDays: 4, notes: ['Band only — no watch head received. Label encodes the job number.'], lines: [line('Bracelet re-pin — stretched links', 220, 'B'), line('Clasp adjust + tighten', 60, 'B')] }),
  build({ id: 'j-ok1', number: 'E02062', clientId: 'c-35', watchId: 'w-54', workflow: ['W'], status: 'in_service', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 2, dueInDays: 18, notes: ['Explorer II — service, client reports date not jumping.'], lines: [line('Complete movement service — cal. 3285', 1350, 'W')] }),
  build({ id: 'j-ws2', number: 'E02061', clientId: 'c-33', watchId: 'w-53', workflow: ['W'], status: 'in_service', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 4, dueInDays: 21, notes: ['Complete service — GMT hand not jumping cleanly.'], lines: [line('Complete movement service — cal. 3285', 1350, 'W')] }),
  // Job detail v2 demo seeds (2026-09-30): multi-item job with three labelled items (1/3 head · 2/3 bracelet · 3/3 case) and a head outsourced to James, delayed
  build({ id: 'j-mi1', number: 'E02063', clientId: 'c-36', watchId: 'w-55', workflow: ['W', 'B', 'P'], status: 'in_service', priority: 'high', owner: 'manager', assignees: ['Leo', 'MAM'], createdDaysAgo: 11, dueInDays: 6, notes: ['Three items received — head, bracelet and a spare Jubilee for refinish. Labels 1/3 · 2/3 · 3/3.'], lines: [line('Complete movement service — cal. 3235', 1450, 'W'), line('Bracelet refinish + stretch repair', 380, 'B'), line('Case & bezel refinish — polished / brushed', 420, 'P')] }),
  build({ id: 'j-os1', number: 'E02064', clientId: 'c-37', watchId: 'w-56', workflow: ['W'], status: 'in_service', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 24, dueInDays: 5, notes: ['Dial + hands out to James for tritium-tone relume — vendor is past the promised date.'], lines: [line('Complete movement service — cal. 1570', 1650, 'W'), line('Dial + hands relume (outsourced)', 900, 'W')] }),
  // JV bin seeds (2026-09-30): nine band / polish tickets assigned to JV's bin — six inside, three handed out to the team
  build({ id: 'j-b1', number: 'E02070', clientId: 'c-38', watchId: 'w-57', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV'], createdDaysAgo: 6, dueInDays: 4, lines: [line('Oyster bracelet stretch repair + re-pin', 380, 'B')] }),
  build({ id: 'j-b2', number: 'E02071', clientId: 'c-39', watchId: 'w-58', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV'], createdDaysAgo: 5, dueInDays: 5, lines: [line('Jubilee bracelet refinish — brushed / polished', 420, 'B')] }),
  build({ id: 'j-b3', number: 'E02072', clientId: 'c-40', watchId: 'w-59', workflow: ['P'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV'], createdDaysAgo: 4, dueInDays: 6, lines: [line('Case & bezel refinish — polished', 395, 'P')] }),
  build({ id: 'j-b4', number: 'E02073', clientId: 'c-41', watchId: 'w-60', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV'], createdDaysAgo: 7, dueInDays: 3, lines: [line('Rivet bracelet — clasp spring + end links', 290, 'B')] }),
  build({ id: 'j-b5', number: 'E02074', clientId: 'c-42', watchId: 'w-61', workflow: ['P'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV'], createdDaysAgo: 3, dueInDays: 7, lines: [line('Case refinish — brushed lugs, polished sides', 385, 'P')] }),
  build({ id: 'j-b6', number: 'E02075', clientId: 'c-43', watchId: 'w-62', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV'], createdDaysAgo: 8, dueInDays: 2, lines: [line('Jubilee bracelet — stretch repair', 340, 'B')] }),
  build({ id: 'j-b7', number: 'E02076', clientId: 'c-44', watchId: 'w-63', workflow: ['P'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV', 'Dre'], createdDaysAgo: 5, dueInDays: 5, lines: [line('Two-tone case refinish — gold bezel polished', 480, 'P')] }),
  build({ id: 'j-b8', number: 'E02077', clientId: 'c-45', watchId: 'w-64', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV', 'Sam'], createdDaysAgo: 2, dueInDays: 8, lines: [line('Oyster bracelet re-pin + clasp adjust', 260, 'B')] }),
  build({ id: 'j-b9', number: 'E02078', clientId: 'c-46', watchId: 'w-65', workflow: ['B'], status: 'in_service', kind: 'small_job', owner: 'manager', assignees: ['JV', 'Nico'], createdDaysAgo: 9, dueInDays: 1, priority: 'high', lines: [line('Oyster bracelet refinish + stretch repair', 460, 'B')] }),
  // Portal dots seed (2026-09-30): Eleanor Vance's Submariner — W in progress (green) · B parts hold scoped to the bracelet (red) · P refinish finished (blue)
  // Inbox job-card seeds (2026-10-01): Rebecca Halloran's GMT — ONE active job, W green · B red (scoped parts hold) · P blue
  build({ id: 'j-ib1', number: 'E02080', clientId: 'c-24', watchId: 'w-67', workflow: ['W', 'B', 'P'], status: 'in_service', owner: 'manager', assignees: ['Leo', 'Sam', 'Dre'], createdDaysAgo: 6, dueInDays: 9, hold: { type: 'parts', reason: 'Jubilee clasp — 2 links + spring bar set on order from RSC (ETA Oct 6)', daysAgo: 2, component: 'band' }, notes: ['Bracelet links stretched past spec — parts priced and approved by the client on the portal.'], lines: [line('Complete movement service — cal. 3285', 1550, 'W'), line('Jubilee bracelet — 2 links + clasp spring', 420, 'B'), line('Case & bezel refinish — brushed / polished', 395, 'P')] }),
  // Calloway's Submariner came BACK after pickup (E01871, collected a year ago) — warranty return linked to the original job
  build({ id: 'j-wr1', number: 'E02081', clientId: 'c-30', watchId: 'w-40', workflow: ['W'], status: 'in_review', kind: 'warranty', priority: 'high', owner: 'manager', assignees: ['Leo'], createdDaysAgo: 2, dueInDays: 5, returnOf: { jobId: 'j-r1', reason: 'Crown no longer screws down since pickup — returned under the 2-year service warranty' }, notes: ['Returned 2 days ago at the front desk — crown tube thread checked at intake, likely tube replacement under warranty.'], lines: [line('Warranty — crown + tube replacement', 0, 'W')] }),
  // Pickup Station v2 — ready at the counter (one per gate demo) + two already handed over. Each carries an intake photo whose label shows the engraved serial (placeholder → MOCK OCR path).
  ...pickupJobs(),
  build({ id: 'j-pd1', number: 'E02079', clientId: 'c-02', watchId: 'w-66', workflow: ['W', 'B', 'P'], status: 'in_service', owner: 'manager', assignees: ['Leo', 'Sam', 'Dre'], createdDaysAgo: 8, dueInDays: 6, hold: { type: 'parts', reason: 'Waiting on Oyster clasp spring + 2 links (ref 97200) from RSC — ETA Oct 8', daysAgo: 4, component: 'band' }, notes: ['Clasp spring fatigued — parts approval priced, going to the client; RSC backorder expected.'], lines: [line('Complete movement service — cal. 3235', 1450, 'W'), line('Oyster bracelet stretch repair + clasp spring', 380, 'B'), line('Case & bezel refinish — brushed / polished', 395, 'P')] }),
];

export const shopTime: ShopTimeEntry[] = [
  { id: 'st-01', jobId: 'j-01', minutes: 95, note: 'Disassembly & cleaning', at: daysAgo(3, 11), by: 'Leo', station: 'Bench 1' },
  { id: 'st-02', jobId: 'j-01', minutes: 140, note: 'Reassembly, lubrication', at: daysAgo(1, 15), by: 'Leo', station: 'Bench 1' },
  { id: 'st-03', jobId: 'j-03', minutes: 60, note: 'Case refinish prep', at: daysAgo(2, 10), by: 'Walter', station: 'Bench 2' },
  { id: 'st-04', jobId: 'j-05', minutes: 45, note: 'Pressure test + timing run 1', at: daysAgo(1, 9), by: 'MH', station: 'Bench 2' },
  { id: 'st-05', jobId: 'j-16', minutes: 30, note: 'Hairspring re-check after QC fail', at: daysAgo(0, 9), by: 'Leo', station: 'Bench 1' },
];
