import { appraisalValueSync } from './appraisals';
import { onPartMoved, registerDaySweep, registerWatchValue, safesBridge as b, OWNER_USER_ID } from './client';
import { custodyCurrentSync, registerCustodyValue, registerSafeFor } from './custody';
import type { ComponentKey, Job, JobComponent, RwStationKey, Watch } from './types';

// ---- Safes vs insurance (MH 2026-10-02, D-425) — container hierarchy + value on hand per safe, computed HERE (D-420), never summed in a page ----
// Containers are data (D-396): every tray / station / shelf-bin node has a parent container set in Setup → Containers; a safe's value = its own
// items + every container nested inside it. Only items SCANNED into a node with a parent count — a part on a bench (custody = watchmaker) is in no safe.
// Item value chain: final appraisal → declared at intake (job stamp, else the inbound shipment) → ref typical value (avg insured value of outbound
// shipments of the same reference, else the reference table stand-in) → unknown (flagged). Component split: bracelet share = declared bracelet value →
// bracelet configuration table → 0 (counted with the head); head share = watch value − bracelet share. Unopened packages sit on the intake shelf inside the FD safe.

export type ContainerKind = 'safe' | 'shelf' | 'bin';
export interface SafeContainer { key: string; label: string; kind: ContainerKind; insuranceLimit?: number; policyRef?: string; parent?: string; scanNode?: string; createdBy?: string; updatedAt?: string }
export type SafeContainerInput = Omit<SafeContainer, 'key' | 'createdBy' | 'updatedAt'> & { key?: string };
export type NodeGroup = 'tray' | 'station' | 'shelf_bin';
export interface LocationNode { key: string; label: string; group: NodeGroup; parent?: string }
export type ValueSource = 'appraisal' | 'declared' | 'typical' | 'bracelet_config' | 'with_head' | 'unknown';
export interface SafeItem { id: string; jobId?: string; jobNumber: string; client: string; watch: string; reference: string; part: ComponentKey | 'package'; partLabel: string; node: string; nodeLabel: string; container: string; value: number; source: ValueSource; unvalued: boolean; since?: string; link: string }
export type SafeStatus = 'under' | 'near' | 'over' | 'no_limit';
export interface SafeRow { container: SafeContainer; items: SafeItem[]; count: number; value: number; limit?: number; pct?: number; status: SafeStatus; overage: number; headroom: number; unvalued: number; children: SafeContainer[] }
export interface SafesBoard { safes: SafeRow[]; others: SafeRow[]; totals: { safes: number; count: number; value: number; insured: number; headroom: number; over: number; unvalued: number }; anyOver: boolean; loose: number; notOnHand: { count: number; value: number; items: SafeItem[] } }

export const NEAR_PCT = 85;
export const SAFES_ALERT_EVENT = 'safes:alert';
const OPS_SHORT = 'Vienna';

// ---- containers (seed: Main $250k · FD $50k · LTS $100k · Intake shelf no limit) ----
const containers: SafeContainer[] = [
  { key: 'c-main', label: 'Main safe', kind: 'safe', insuranceLimit: 250_000, policyRef: 'Jewelers Block JB-2026-0411', scanNode: 'main_safe', createdBy: 'seed' },
  { key: 'c-fd', label: 'FD safe', kind: 'safe', insuranceLimit: 50_000, policyRef: 'JB-2026-0411 · rider A (front desk)', scanNode: 'fd_safe', createdBy: 'seed' },
  { key: 'c-lts', label: 'LTS safe', kind: 'safe', insuranceLimit: 100_000, policyRef: 'JB-2026-0411 · rider B (storage)', scanNode: 'lts_safe', createdBy: 'seed' },
  { key: 'c-shelf', label: 'Intake shelf', kind: 'shelf', parent: 'c-fd', createdBy: 'seed' },
];
// node key → parent container. Trays = every safe-class station node; benches / floor stations have no parent and never count.
const TRAYS_MAIN: RwStationKey[] = ['pre_queue', 'mgr_safe_polish_in', 'mgr_safe_polish_out', 'into_safe_head', 'safe_await_band', 'band_pre_queue', 'band_mgr_safe_in', 'band_mgr_safe_out', 'into_safe_band', 'safe_await_head', 'vc_safe', 'main_safe'];
const parents = new Map<string, string>([...TRAYS_MAIN.map((k): [string, string] => [k, 'c-main']), ['fd_safe', 'c-fd'], ['finished', 'c-fd'], ['pre_approval', 'c-fd'], ['lts_safe', 'c-lts']]);
const binNode = (bin: string) => `bin:${bin}`;
const isTray = (k: RwStationKey) => k.includes('safe') || k.endsWith('pre_queue');
export const getLocationNodesSync = (): LocationNode[] => [
  ...b.stations().map((s): LocationNode => ({ key: s.key, label: s.label, group: isTray(s.key) ? 'tray' : 'station', parent: parents.get(s.key) })),
  ...b.shelfBins().map((bin): LocationNode => ({ key: binNode(bin), label: `Shelf ${bin}`, group: 'shelf_bin', parent: parents.get(binNode(bin)) ?? 'c-shelf' })),
];
b.shelfBins().forEach((bin) => parents.set(binNode(bin), 'c-shelf'));
const containerOf = (key: string) => containers.find((c) => c.key === key);
const ancestors = (key: string | undefined): string[] => { const out: string[] = []; let k = key; while (k) { if (out.includes(k)) break; out.push(k); k = containerOf(k)?.parent; } return out; };

// ---- value chain ----
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const fmtSafeMoney = money0;
// Bracelet configuration values — stand-in for the ref_bracelets table (dollars). A bracelet value declared at intake (Job.braceletValue) wins over this table.
const BRACELET_CONFIG: { test: RegExp; value: number }[] = [
  { test: /president/i, value: 14_000 }, { test: /jubilee.*(gold|yg|two.?tone|tt)/i, value: 6_500 }, { test: /oyster.*(gold|yg|two.?tone|tt)/i, value: 7_000 },
  { test: /jubilee/i, value: 1_800 }, { test: /oyster(flex)?/i, value: 1_500 }, { test: /titanium/i, value: 900 }, { test: /leather|strap/i, value: 300 },
];
// Reference typical values — stand-in for the reference table until outbound insured history exists for the ref; live comps win when present
const REF_TYPICAL: Record<string, number> = { '126710BLRO': 14_500, '226570': 9_800, '126710GRNR': 13_800, '126234': 8_300, '126334': 10_100, '126600': 12_500 };
const braceletConfigValue = (w?: Watch) => { if (!w) return null; const hit = BRACELET_CONFIG.find((x) => x.test.test(`${w.bracelet} ${w.reference}`)); return hit ? hit.value : null; };
const braceletShare = (j: Job, w?: Watch): { value: number; source: ValueSource } | null => { if (j.braceletValue !== undefined) return { value: j.braceletValue, source: 'declared' }; const cfg = braceletConfigValue(w); return cfg !== null ? { value: cfg, source: 'bracelet_config' } : null; };
const watchOf = (j: Job) => b.watches().find((w) => w.id === j.watchId);
const declaredFor = (j: Job) => { if (j.declaredValue !== undefined && j.declaredValue > 0) return j.declaredValue; const sh = b.shipments().find((r) => r.estimateId === j.estimateId && r.direction === 'inbound' && (r.trackingNumber || r.stage === 'arrived') && r.declaredValue > 0); return sh ? sh.declaredValue : null; };
const typicalFor = (w?: Watch) => { if (!w) return null; const comps = b.insuredComps(w.reference); if (comps.length) return Math.round(comps.reduce((t, x) => t + x.value, 0) / comps.length); return REF_TYPICAL[w.reference] ?? null; };
export const watchValueSync = (j: Job): { value: number | null; source: ValueSource } => {
  const ap = appraisalValueSync(j.id); if (ap !== null) return { value: ap, source: 'appraisal' };
  const d = declaredFor(j); if (d !== null) return { value: d, source: 'declared' };
  const t = typicalFor(watchOf(j)); if (t !== null) return { value: t, source: 'typical' };
  return { value: null, source: 'unknown' };
};

// ---- items in containers ----
const PART_LABEL: Record<ComponentKey, string> = { head: 'Watch head', case: 'Case', band: 'Bracelet' };
// Items with NO real custody event (custody.ts) are NOT ON HAND: they leave the safe they were believed in and count as −1 client assets on the board
let notOnHandItems: SafeItem[] = [];
const itemsSync = (): SafeItem[] => {
  b.seedAssets(); const out: SafeItem[] = []; notOnHandItems = [];
  for (const j of b.openJobs()) {
    const w = watchOf(j); const c = b.clients().find((x) => x.id === j.clientId); const client = c ? `${c.firstName} ${c.lastName}` : '—'; const watch = w ? `${w.brand} ${w.model}` : '—';
    const all = b.parts(j); const located = all.map((p: JobComponent) => ({ p, station: b.placement(j, p).station, onHand: custodyCurrentSync(j, p).onHand }));
    const placed = located.filter((x) => parents.has(x.station) || !x.onHand);
    if (!placed.length) continue;
    const wv = watchValueSync(j); const bs = braceletShare(j, w); const has = (k: ComponentKey) => all.some((p) => p.key === k); const bandOnly = has('band') && !has('head') && !has('case');
    // Head share = watch − bracelet share when the bracelet is its own component with a known value. Carried by the head when it is in a safe, else by the
    // case (uncased watch: case at a gate, movement on a bench — the case is the insured object in the safe). Never by the band; a band-only job holds just the bracelet.
    const headShare = wv.value === null ? null : has('band') && bs ? Math.max(0, wv.value - bs.value) : wv.value;
    const carrier: ComponentKey | undefined = bandOnly ? undefined : placed.some((x) => x.p.key === 'head') ? 'head' : placed.some((x) => x.p.key === 'case') ? 'case' : undefined;
    for (const { p, station, onHand } of placed) {
      let value = 0; let source: ValueSource = 'with_head'; let unvalued = false;
      if (p.key === 'band') { if (bs) { value = bs.value; source = bs.source; } else if (bandOnly) { unvalued = true; source = 'unknown'; } }
      else if (p.key === carrier) { if (headShare === null) { unvalued = true; source = 'unknown'; } else { value = headShare; source = wv.source; } }
      const last = p.history?.[p.history.length - 1];
      const item: SafeItem = { id: `${j.id}:${p.key}`, jobId: j.id, jobNumber: j.number, client, watch, reference: w?.reference ?? '', part: p.key, partLabel: PART_LABEL[p.key], node: station, nodeLabel: b.stationLabel(station), container: parents.get(station) ?? '', value, source, unvalued, since: last?.at, link: `/jobs/${j.id}` };
      if (!onHand) notOnHandItems.push(item); else out.push(item);
    }
  }
  // Unopened packages on the intake shelf — value = the matched label request's declared value (by tracking #, else by the estimate), else unknown
  for (const pkg of b.packages().filter((p) => p.status === 'arrived' && p.shelfBin)) {
    const node = binNode(pkg.shelfBin!); const parent = parents.get(node); if (!parent) continue;
    const rows = b.shipments(); const sh = (pkg.trackingNumber ? rows.find((r) => r.trackingNumber === pkg.trackingNumber && r.declaredValue > 0) : undefined) ?? (pkg.estimateId ? rows.find((r) => r.estimateId === pkg.estimateId && r.direction === 'inbound' && r.declaredValue > 0) : undefined); const c = pkg.clientId ? b.clients().find((x) => x.id === pkg.clientId) : undefined;
    out.push({ id: `pkg:${pkg.id}`, jobNumber: pkg.subNumber, client: c ? `${c.firstName} ${c.lastName}` : 'Unknown client', watch: 'Unopened package', reference: '', part: 'package', partLabel: 'Package', node, nodeLabel: `Shelf ${pkg.shelfBin}`, container: parent, value: sh?.declaredValue ?? 0, source: sh ? 'declared' : 'unknown', unvalued: !sh, since: pkg.scans?.find((s) => s.shelfBin)?.at, link: `/intake/receive/${pkg.id}` });
  }
  return out;
};

const rowFor = (c: SafeContainer, items: SafeItem[]): SafeRow => {
  const mine = items.filter((it) => ancestors(it.container).includes(c.key)).sort((a, b2) => b2.value - a.value); const value = mine.reduce((t, it) => t + it.value, 0); const limit = c.kind === 'safe' ? c.insuranceLimit : undefined;
  const pct = limit ? Math.round((value / limit) * 1000) / 10 : undefined; const status: SafeStatus = limit === undefined ? 'no_limit' : value > limit ? 'over' : pct! >= NEAR_PCT ? 'near' : 'under';
  return { container: c, items: mine, count: mine.length, value, limit, pct, status, overage: limit !== undefined ? Math.max(0, value - limit) : 0, headroom: limit !== undefined ? Math.max(0, limit - value) : 0, unvalued: mine.filter((it) => it.unvalued).length, children: containers.filter((x) => x.parent === c.key) };
};
export const getSafesBoardSync = (): SafesBoard => {
  const items = itemsSync(); const rows = containers.map((c) => rowFor(c, items)); const safes = rows.filter((r) => r.container.kind === 'safe'); const others = rows.filter((r) => r.container.kind !== 'safe' && !ancestors(r.container.parent).some((k) => containerOf(k)?.kind === 'safe'));
  const insured = safes.reduce((t, r) => t + (r.limit ?? 0), 0); const value = safes.reduce((t, r) => t + r.value, 0);
  const board: SafesBoard = { safes, others, totals: { safes: safes.length, count: safes.reduce((t, r) => t + r.count, 0), value, insured, headroom: safes.reduce((t, r) => t + r.headroom, 0), over: safes.reduce((t, r) => t + r.overage, 0), unvalued: safes.reduce((t, r) => t + r.unvalued, 0) }, anyOver: safes.some((r) => r.status === 'over'), loose: 0, notOnHand: { count: notOnHandItems.length, value: notOnHandItems.reduce((t, it) => t + it.value, 0), items: [...notOnHandItems].sort((x, y) => y.value - x.value) } };
  syncPins(board); return board;
};
export async function getSafesBoard(): Promise<SafesBoard> { return getSafesBoardSync(); }

// ---- over-limit: hitlist items for MH + VC while over, cleared when back under; the station sees a non-blocking warning on the scan that tips it ----
const pinKey = (c: SafeContainer, who: 'mh' | 'vc') => `safe-over:${c.key}:${who}`;
const syncPins = (board: SafesBoard) => {
  for (const r of board.safes) {
    const over = r.status === 'over'; const title = `${r.container.label} over insurance limit by ${money0(r.overage)}`; const subtitle = `${r.count} item${r.count === 1 ? '' : 's'} · ${money0(r.value)} on hand vs ${money0(r.limit ?? 0)} insured · ${r.container.policyRef ?? 'no policy ref'} — move pieces to another safe (Assign / Move)`;
    if (over) { b.upsertSystemPin(pinKey(r.container, 'mh'), { title, subtitle, assignedTo: { type: 'user', shortName: 'MH' }, priority: 'high', standing: true, link: '/analytics' }); b.upsertSystemPin(pinKey(r.container, 'vc'), { title, subtitle, assignedTo: { type: 'user', shortName: OPS_SHORT }, priority: 'high', standing: true, link: '/analytics' }); }
    else { b.resolveSystemPin(pinKey(r.container, 'mh'), 'back under the insurance limit'); b.resolveSystemPin(pinKey(r.container, 'vc'), 'back under the insurance limit'); }
  }
};
onPartMoved((_j, _c, to) => {
  if (!to || !parents.has(to)) return; const board = getSafesBoardSync(); const safeKey = ancestors(parents.get(to)).find((k) => containerOf(k)?.kind === 'safe'); const row = board.safes.find((r) => r.container.key === safeKey);
  if (row?.status === 'over') window.dispatchEvent(new CustomEvent(SAFES_ALERT_EVENT, { detail: `${row.container.label} over insurance limit by ${money0(row.overage)} — ${row.count} items · ${money0(row.value)} on hand · move a piece to another safe` }));
});

// ---- setup reads / writes (owner) ----
const ownerOnly = (what: string) => { if (!b.isOwner()) throw new Error(`${what} is owner-only (MH)`); };
export async function getContainers(): Promise<SafeContainer[]> { return containers.map((c) => ({ ...c })); }
export async function getLocationNodes(): Promise<LocationNode[]> { return getLocationNodesSync(); }
export async function saveContainer(input: SafeContainerInput): Promise<SafeContainer> {
  ownerOnly('Containers'); const label = input.label.trim(); if (!label) throw new Error('Name the container'); if (input.kind === 'safe' && !(input.insuranceLimit !== undefined && input.insuranceLimit >= 0)) throw new Error('Safes need an insurance limit (0 allowed)');
  if (input.parent && input.key && ancestors(input.parent).includes(input.key)) throw new Error('That would nest the container inside itself'); const now = new Date().toISOString();
  if (input.key) { const c = containerOf(input.key); if (!c) throw new Error('Container not found'); const before = `${c.kind} · limit ${c.insuranceLimit !== undefined ? money0(c.insuranceLimit) : '—'} · ${c.policyRef ?? '—'} · parent ${c.parent ?? '—'}`; Object.assign(c, { label, kind: input.kind, insuranceLimit: input.kind === 'safe' ? input.insuranceLimit : undefined, policyRef: input.policyRef?.trim() || undefined, parent: input.parent || undefined, scanNode: input.scanNode || c.scanNode, updatedAt: now }); b.audit(`Container ${label} updated · was ${before} → ${c.kind} · limit ${c.insuranceLimit !== undefined ? money0(c.insuranceLimit) : '—'} · ${c.policyRef ?? '—'} · parent ${c.parent ?? '—'}`); getSafesBoardSync(); return { ...c }; }
  const c: SafeContainer = { key: b.newId('c'), label, kind: input.kind, insuranceLimit: input.kind === 'safe' ? input.insuranceLimit : undefined, policyRef: input.policyRef?.trim() || undefined, parent: input.parent || undefined, scanNode: input.scanNode || undefined, createdBy: b.actor().by, updatedAt: now };
  containers.push(c); b.audit(`Container ${label} created · ${c.kind}${c.insuranceLimit !== undefined ? ` · limit ${money0(c.insuranceLimit)}` : ''}${c.policyRef ? ` · ${c.policyRef}` : ''}`); return { ...c };
}
export async function setNodeParent(nodeKey: string, parent: string | null): Promise<LocationNode> {
  ownerOnly('Containers'); const node = getLocationNodesSync().find((n) => n.key === nodeKey); if (!node) throw new Error('Unknown location'); if (parent && !containerOf(parent)) throw new Error('Unknown container');
  const before = node.parent ? containerOf(node.parent)?.label ?? node.parent : 'none'; if (parent) parents.set(nodeKey, parent); else parents.delete(nodeKey);
  b.audit(`Location ${node.label} re-parented · ${before} → ${parent ? containerOf(parent)!.label : 'none (bench / floor — not insured)'}`); getSafesBoardSync(); return { ...node, parent: parent ?? undefined };
}
export const canSeeSafes = (u: { id: string } | null | undefined) => !!u && (u.id === OWNER_USER_ID || u.id === 'u-vienna');
export const safeForNodeSync = (node: RwStationKey | string): SafeContainer | undefined => { const k = ancestors(parents.get(node)).find((x) => containerOf(x)?.kind === 'safe'); return k ? containerOf(k) : undefined; };
// Hitlist pins must exist before /today reads the pinned layer — recompute the board inside the day sweeps (getToday → runDaySweeps)
registerDaySweep(() => { getSafesBoardSync(); });
registerWatchValue(watchValueSync); // Pickup Station ≥ $10k value tier reads the same chain
registerCustodyValue(watchValueSync); // −1 client asset rows carry the same value
registerSafeFor((node) => safeForNodeSync(node)?.key); // custody audit scope "a safe" = that safe's trays
