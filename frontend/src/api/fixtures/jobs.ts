import type { DeptCode, Department, EstimateLine, HoldType, Job, JobKind, JobPriority, JobStatus, JobTransition, Role, ShopTimeEntry } from '../types';
import { estimates } from './estimates';
import { seedPhoto } from './intake';
import { daysAgo, daysFromNow } from './time';

// Linear order of the pack's full status list — the shop-floor map reads left to right
export const JOB_FLOW: JobStatus[] = ['intake', 'in_review', 'awaiting_customer_approval', 'approved', 'in_service', 'testing', 'ready_to_ship', 'closed'];

export const DEPT_OF_CODE: Record<DeptCode, Department> = { W: 'watchmaking', B: 'band', P: 'polish', PM: 'watchmaking' };

let seq = 0;
const line = (description: string, unitPrice: number, dept: DeptCode, qty = 1): EstimateLine => ({ id: `jl-${String(++seq).padStart(3, '0')}`, description, qty, unitPrice, dept, taxable: true, type: 'service' });

const STAFF = ['MM', 'Walter', 'MH'];
const STATION = ['Bench 1', 'Bench 2', 'Front Desk 1'];

const ACTION_LABEL: Partial<Record<JobStatus, string>> = { in_review: 'start_review', awaiting_customer_approval: 'request_approval', approved: 'approve', in_service: 'start_service', testing: 'to_testing', ready_to_ship: 'qc_pass', closed: 'close' };

// Walk the machine from intake up to `status`, spacing transitions across the job's age
const flow = (status: JobStatus, createdDaysAgo: number, by: string): JobTransition[] => {
  const idx = JOB_FLOW.indexOf(status);
  const step = Math.max(1, Math.floor(createdDaysAgo / (idx + 1)));
  const out: JobTransition[] = [{ id: `jt-${++seq}`, from: null, to: 'intake', action: 'create', at: daysAgo(createdDaysAgo, 9), by: 'Vienna', station: 'Front Desk 1' }];
  for (let i = 1; i <= idx; i += 1) {
    const to = JOB_FLOW[i];
    out.push({ id: `jt-${++seq}`, from: JOB_FLOW[i - 1], to, action: ACTION_LABEL[to] ?? 'update_status', at: daysAgo(createdDaysAgo - i * step, 10 + i), by: i < 3 ? 'Walter' : by, station: i < 3 ? STATION[2] : STATION[STAFF.indexOf(by) % 2], emailQueued: to === 'awaiting_customer_approval' || to === 'ready_to_ship' });
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
  hold?: { type: HoldType; reason: string; daysAgo: number; released?: boolean };
  qcFail?: string;
  notes?: string[];
  conditionNotes?: string;
}

const build = (s: Seed): Job => {
  const est = s.estimateId ? estimates.find((e) => e.id === s.estimateId) : undefined;
  const lines = s.lines ?? est?.lines.map((l) => ({ ...l })) ?? [];
  const assignees = s.assignees ?? [];
  const by = assignees[0] ?? 'Walter';
  const kind = s.kind ?? 'service';
  const timeline = flow(s.status, s.createdDaysAgo, by);
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
    holds: s.hold ? [{ id: `jh-${++seq}`, type: s.hold.type, reason: s.hold.reason, priorStatus: s.status, placedAt: daysAgo(s.hold.daysAgo, 14), placedBy: by, station: 'Bench 1', ...(s.hold.released ? { releasedAt: daysAgo(Math.max(0, s.hold.daysAgo - 3), 9), releasedBy: by, releaseNote: 'Parts arrived' } : {}) }] : [],
    notes: (s.notes ?? []).map((text, i) => ({ id: `jn-${++seq}`, text, at: daysAgo(Math.max(0, s.createdDaysAgo - i - 1), 16), by, station: 'Bench 1' })),
    photos: JOB_FLOW.indexOf(s.status) >= 2 ? [{ ...seedPhoto(`Inspection ${s.number} front`), id: `jp-${++seq}`, at: daysAgo(Math.max(0, s.createdDaysAgo - 1), 11), by: 'Walter', station: 'Front Desk 1' }] : [],
    inspection: kind === 'service' && JOB_FLOW.indexOf(s.status) >= 2 ? { answers: { case: 'light scratches', crystal: 'clear', bracelet: 'tight', movement: 'running', water: 'not tested' }, at: daysAgo(Math.max(0, s.createdDaysAgo - 1), 11), by: 'Walter', station: 'Front Desk 1' } : undefined,
  };
};

export const jobs: Job[] = [
  // Born from converted estimates — on the bench
  build({ id: 'j-01', number: 'E02011', estimateId: 'e-01', clientId: 'c-01', watchId: 'w-01', workflow: ['W'], status: 'in_service', priority: 'high', owner: 'manager', assignees: ['MM'], createdDaysAgo: 9, dueInDays: 12, notes: ['Movement uncased. Mainspring shows fatigue — replacing under service.'] }),
  build({ id: 'j-02', number: 'E02012', estimateId: 'e-03', clientId: 'c-03', watchId: 'w-03', workflow: ['P'], status: 'ready_to_ship', owner: 'concierge', assignees: ['Walter'], createdDaysAgo: 17, dueInDays: -3, notes: ['Ready for pickup — client texted, coming Saturday.'] }),
  build({ id: 'j-03', number: 'E02013', estimateId: 'e-04', clientId: 'c-04', watchId: 'w-04', workflow: ['W', 'P'], status: 'in_service', owner: 'manager', assignees: ['Walter', 'MM'], createdDaysAgo: 6, dueInDays: 18 }),
  build({ id: 'j-04', number: 'E02014', estimateId: 'e-06', clientId: 'c-06', watchId: 'w-06', workflow: ['W'], status: 'in_service', priority: 'high', assignees: ['MM'], createdDaysAgo: 28, dueInDays: 9, hold: { type: 'parts', reason: 'Waiting on cal. 3285 mainspring barrel from RSC — ETA 10 days', daysAgo: 6 } }),
  build({ id: 'j-05', number: 'E02015', estimateId: 'e-07', clientId: 'c-07', watchId: 'w-07', workflow: ['B', 'P'], status: 'testing', owner: 'inspector', assignees: ['MH'], createdDaysAgo: 13, dueInDays: 1 }),
  build({ id: 'j-06', number: 'E02016', estimateId: 'e-09', clientId: 'c-09', watchId: 'w-09', workflow: ['W', 'PM'], status: 'in_service', assignees: ['MM'], createdDaysAgo: 18, dueInDays: 6, hold: { type: 'outsource', reason: 'Bezel out to plating vendor (Goldsmith & Co.) — due back Thursday', daysAgo: 4 } }),
  // Walk-ins / no estimate link
  build({ id: 'j-07', number: 'E02017', clientId: 'c-12', watchId: 'w-12', workflow: ['B'], status: 'ready_to_ship', kind: 'small_job', assignees: ['MH'], createdDaysAgo: 16, dueInDays: -2 }),
  build({ id: 'j-08', number: 'E02018', clientId: 'c-10', watchId: 'w-10', workflow: ['P'], status: 'closed', assignees: ['Walter'], createdDaysAgo: 38, lines: [line('Case & bracelet refinish — brushed/polished', 340, 'P')] }),
  build({ id: 'j-09', number: 'E02019', clientId: 'c-15', watchId: 'w-15', workflow: ['W', 'B', 'P'], status: 'closed', assignees: ['MM'], createdDaysAgo: 33, lines: [line('Complete movement service — cal. 3235', 1450, 'W'), line('Bracelet re-pin & tighten', 260, 'B'), line('Case & bracelet refinish', 540, 'P')] }),
  build({ id: 'j-10', number: 'E02020', clientId: 'c-11', watchId: 'w-11', workflow: ['B'], status: 'approved', kind: 'small_job', createdDaysAgo: 5, dueInDays: 4, lines: [line('Bracelet clasp replacement', 320, 'B'), line('Bracelet re-pin', 160, 'B')] }),
  build({ id: 'j-11', number: 'E02021', clientId: 'c-02', watchId: 'w-02', workflow: ['W'], status: 'awaiting_customer_approval', kind: 'warranty', assignees: ['Walter'], createdDaysAgo: 4, lines: [line('Chronograph service — cal. 4130', 1650, 'W')], notes: ['Estimate revised after review — pusher seals worn.'] }),
  build({ id: 'j-12', number: 'E02022', clientId: 'c-05', watchId: 'w-05', workflow: ['W', 'B'], status: 'intake', priority: 'urgent', owner: 'inspector', createdDaysAgo: 1, dueInDays: 10, lines: [line('Movement service — cal. 3230', 1250, 'W'), line('Bracelet screw replacement', 90, 'B')], conditionNotes: 'Crystal scratch at 4 o\u2019clock, bracelet stretch noted at intake.' }),
  build({ id: 'j-13', number: 'E02023', clientId: 'c-13', watchId: 'w-13', workflow: ['B', 'P'], status: 'in_review', kind: 'small_job', assignees: ['Walter'], createdDaysAgo: 2, dueInDays: 14, lines: [line('Titanium bracelet refinish', 420, 'P'), line('Clasp spring replacement', 110, 'B')] }),
  build({ id: 'j-14', number: 'E02024', clientId: 'c-08', watchId: 'w-08', workflow: ['P'], status: 'intake', priority: 'low', simple: 'estimate', createdDaysAgo: 3, lines: [line('Case refinish — polished bevels', 385, 'P')], conditionNotes: 'Package on discrepancy hold — bracelet missing.' }),
  build({ id: 'j-15', number: 'E02025', clientId: 'c-16', watchId: 'w-17', workflow: ['W'], status: 'approved', priority: 'low', createdDaysAgo: 3, dueInDays: 21, lines: [line('Movement service — MT5602', 950, 'W')] }),
  build({ id: 'j-16', number: 'E02026', clientId: 'c-18', watchId: 'w-16', workflow: ['W', 'P'], status: 'testing', priority: 'high', kind: 'warranty', assignees: ['MM'], createdDaysAgo: 12, dueInDays: 2, lines: [line('Movement service — cal. 2236', 1150, 'W'), line('Case refinish', 320, 'P')], qcFail: 'Amplitude low in dial-down position (198°) — re-check hairspring', notes: ['Second timing run in progress.'] }),
  build({ id: 'j-17', number: 'E02027', clientId: 'c-19', watchId: 'w-18', workflow: ['PM'], status: 'in_service', assignees: ['Walter'], createdDaysAgo: 7, dueInDays: 8, lines: [line('Platinum bezel refinish — precious metals', 780, 'PM')] }),
  build({ id: 'j-18', number: 'E02028', clientId: 'c-20', watchId: 'w-19', workflow: ['W'], status: 'in_review', priority: 'urgent', assignees: ['MH'], createdDaysAgo: 1, dueInDays: 6, lines: [line('Movement service — cal. 3235', 1450, 'W')], notes: ['Client travelling on the 28th — needs it back before.'] }),
  // Tail stages (E5): fulfilled sales orders waiting for pickup / ship
  build({ id: 'j-21', number: 'E02029', clientId: 'c-14', watchId: 'w-14', workflow: ['W', 'P'], status: 'ready_to_ship', owner: 'concierge', assignees: ['MM'], createdDaysAgo: 20, dueInDays: 0, lines: [line('Movement service — cal. 2235', 1150, 'W'), line('Case refinish', 320, 'P')] }),
  build({ id: 'j-22', number: 'E02030', clientId: 'c-15', watchId: 'w-15', workflow: ['W'], status: 'ready_to_ship', owner: 'concierge', assignees: ['Walter'], createdDaysAgo: 22, dueInDays: 1, lines: [line('Movement service — cal. 3235', 1450, 'W')] }),
  // History on returning watches
  build({ id: 'j-19', number: 'E01903', clientId: 'c-09', watchId: 'w-09', workflow: ['W'], status: 'closed', assignees: ['MM'], createdDaysAgo: 60, lines: [line('Movement service — cal. 3135', 1250, 'W')], hold: { type: 'parts', reason: 'Crown tube back-ordered', daysAgo: 45, released: true } }),
  build({ id: 'j-20', number: 'E01887', clientId: 'c-01', watchId: 'w-01', workflow: ['B', 'P'], status: 'closed', assignees: ['Walter'], createdDaysAgo: 75, lines: [line('Bracelet re-pin', 160, 'B'), line('Case & bracelet refinish', 540, 'P')] }),
];

export const shopTime: ShopTimeEntry[] = [
  { id: 'st-01', jobId: 'j-01', minutes: 95, note: 'Disassembly & cleaning', at: daysAgo(3, 11), by: 'MM', station: 'Bench 1' },
  { id: 'st-02', jobId: 'j-01', minutes: 140, note: 'Reassembly, lubrication', at: daysAgo(1, 15), by: 'MM', station: 'Bench 1' },
  { id: 'st-03', jobId: 'j-03', minutes: 60, note: 'Case refinish prep', at: daysAgo(2, 10), by: 'Walter', station: 'Bench 2' },
  { id: 'st-04', jobId: 'j-05', minutes: 45, note: 'Pressure test + timing run 1', at: daysAgo(1, 9), by: 'MH', station: 'Bench 2' },
  { id: 'st-05', jobId: 'j-16', minutes: 30, note: 'Hairspring re-check after QC fail', at: daysAgo(0, 9), by: 'MM', station: 'Bench 1' },
];
