import { custodyBridge as b, registerCustodyCheck } from './client';
import type { MinusOneItem } from './client';
import type { ComponentKey, Job, JobComponent, RwStationKey } from './types';

// ---- Custody audit mode + backfill + "−1 client asset" reveal (MH 2026-10-03) ----------------------------------------------------------------
// Legacy (Lovable) custody is NOT trusted. Real custody = this ledger only: every event is a physical scan at a node (source audit / backfill / scan).
// An open-job item with no real event is NOT ON HAND — it renders "−1 client asset" wherever a location is needed and the totals count it as −1.
// Legacy position (seeded part station) is shown only as a grey "last seen (legacy)" hint until the item's first real scan.
// PROTOTYPE: a seeded baseline audit covers the shop so the rest of the app stays coherent; Keeper starts EMPTY and the first physical audit builds it.

export type CustodySource = 'audit' | 'backfill' | 'scan';
export interface CustodyEvent { id: string; itemKey: string; jobId?: string; jobNumber?: string; part?: ComponentKey; toNode: string; nodeLabel: string; binLabel?: string; source: CustodySource; by: string; station: string; at: string; why?: string; auditId?: string }
export interface ItemStub { id: string; label: string; reference?: string; serial?: string; node: string; nodeLabel: string; at: string; by: string; auditId: string; reviewed?: boolean }
export type AuditScopeKind = 'shop' | 'station' | 'safe';
export interface AuditNodeState { status: 'open' | 'closed'; scanned: string[]; closedAt?: string; by?: string }
export interface CustodyAudit { id: string; by: string; station: string; startedAt: string; status: 'open' | 'paused' | 'closed'; pausedAt?: string; closedAt?: string; closedBy?: string; scope: { kind: AuditScopeKind; key?: string; label: string }; nodeKeys: string[]; nodes: Record<string, AuditNodeState>; currentNode?: string; currentBin?: string; stubIds: string[]; result?: { unaccounted: string[]; foundNoJob: string[] } }
export interface CustodyCurrent { onHand: boolean; event?: CustodyEvent; legacy?: { label: string; at?: string } }
export interface UnaccountedRow { itemKey: string; jobId: string; jobNumber: string; part: ComponentKey; partLabel: string; client: string; watch: string; legacy?: string; value: number | null; soId?: string; soNumber?: string; auditId?: string; link: string }
export interface CustodyProgress { nodesTotal: number; nodesClosed: number; itemsScanned: number; expected: number; found: number; unaccounted: number; byNode: { key: string; label: string; status: AuditNodeState['status'] | 'untouched'; expected: number; scanned: number }[] }
export interface CoverageReport { total: number; covered: number; pct: number; byNode: { key: string; label: string; total: number; covered: number }[]; trend: { day: string; events: number; cumulative: number }[]; since?: string }
export type AuditScanResult = { kind: 'node'; node: string; label: string } | { kind: 'bin'; bin: string; node: string } | { kind: 'item'; event: CustodyEvent; moved: boolean; duplicate: boolean } | { kind: 'unknown'; code: string };

export const CUSTODY_EVENT = 'custody:changed';
const emit = () => window.dispatchEvent(new CustomEvent(CUSTODY_EVENT));
const itemKey = (jobId: string, part: ComponentKey) => `${jobId}:${part}`;
const now = () => new Date().toISOString();
const daysAgo = (d: number, h = 10) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
const SCOPE_STATIONS: Record<string, { label: string; keys: RwStationKey[] }> = {
  wm_room: { label: 'Watchmaker room', keys: ['wm_bench_1', 'wm_bench_2', 'wm_bench_3', 'testing'] },
  band_room: { label: 'Band / polish room', keys: ['band_assign', 'refinish', 'polish_room', 'band_qc', 'jv_bench'] },
  front_desk: { label: 'Front desk', keys: ['finished', 'pre_approval', 'fd_safe'] },
};
const isBinLabel = (s: string) => /^BIN[- ]?\d{1,2}$|^bin\s*\d{1,2}$|^BIN-JV$/i.test(s.trim());
const normBin = (s: string) => { const t = s.trim().toUpperCase(); if (t === 'BIN-JV') return t; const n = t.replace(/\D/g, ''); return `BIN-${n.padStart(2, '0')}`; };

const events: CustodyEvent[] = [];
const stubs: ItemStub[] = [];
const audits: CustodyAudit[] = [];
let seq = 0; const nid = (p: string) => `${p}-${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;
let suppressHook = false;

// ---- nodes ----
const nodeLabel = (k: string): string => { if (k.startsWith('bin:')) return `Shelf ${k.slice(4)}`; const s = b.stations().find((x) => x.key === k); return s ? s.label : k; };
const safeNodes = (safeKey: string): string[] => b.stations().filter((s) => { const parentSafe = safeFor(s.key); return parentSafe === safeKey; }).map((s) => s.key);
let safeForFn: ((node: string) => string | undefined) | null = null;
export const registerSafeFor = (fn: (node: string) => string | undefined) => { safeForFn = fn; };
const safeFor = (node: string) => (safeForFn ? safeForFn(node) : undefined);
export const auditScopeOptionsSync = () => [{ kind: 'shop' as const, key: 'shop', label: 'Whole shop' }, ...Object.entries(SCOPE_STATIONS).map(([key, v]) => ({ kind: 'station' as const, key, label: v.label })), { kind: 'safe' as const, key: 'c-main', label: 'Main safe' }, { kind: 'safe' as const, key: 'c-fd', label: 'FD safe' }, { kind: 'safe' as const, key: 'c-lts', label: 'LTS safe' }];
const nodesForScope = (kind: AuditScopeKind, key?: string): string[] => (kind === 'shop' ? b.stations().map((s) => s.key) : kind === 'station' ? SCOPE_STATIONS[key ?? '']?.keys ?? [] : safeNodes(key ?? ''));

// ---- current custody ----
const lastEvent = (key: string) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].itemKey === key) return events[i]; return undefined; };
export const custodyCurrentSync = (j: Job, c: JobComponent): CustodyCurrent => {
  seedCustody(); const ev = lastEvent(itemKey(j.id, c.key)); if (ev) return { onHand: true, event: ev };
  const seeded = c.history?.find((h) => h.via === 'system'); const station = b.placement(j, c).station;
  return { onHand: false, legacy: { label: nodeLabel(station), at: seeded?.at } };
};
export const custodyCurrentByIdSync = (jobId: string, part: ComponentKey): CustodyCurrent | null => { const j = b.allJobs().find((x) => x.id === jobId); const c = j ? b.parts(j).find((x) => x.key === part) : undefined; return j && c ? custodyCurrentSync(j, c) : null; };
const openItems = () => b.openJobs().flatMap((j) => b.parts(j).map((c) => ({ j, c, key: itemKey(j.id, c.key) })));
const minusOneFor = (jobId: string): MinusOneItem[] => { seedCustody(); const j = b.allJobs().find((x) => x.id === jobId); if (!j || j.status === 'closed') return []; return b.parts(j).filter((c) => !lastEvent(itemKey(j.id, c.key))).map((c) => ({ jobId: j.id, jobNumber: j.number, part: c.key, partLabel: b.partLabel(c.key), legacy: nodeLabel(b.placement(j, c).station) })); };
export const minusOneSync = minusOneFor;
let watchValueFn: ((j: Job) => { value: number | null }) | null = null;
export const registerCustodyValue = (fn: (j: Job) => { value: number | null }) => { watchValueFn = fn; };
export const getUnaccountedSync = (): UnaccountedRow[] => (seedCustody(), openItems()).filter(({ key }) => !lastEvent(key)).map(({ j, c, key }) => {
  const w = b.watches().find((x) => x.id === j.watchId); const cl = b.clients().find((x) => x.id === j.clientId); const so = b.salesOrders().find((o) => o.jobId === j.id && o.status !== 'cancelled'); const aud = audits.find((a) => a.result?.unaccounted.includes(key));
  return { itemKey: key, jobId: j.id, jobNumber: j.number, part: c.key, partLabel: b.partLabel(c.key), client: cl ? `${cl.firstName} ${cl.lastName}` : '—', watch: w ? `${w.brand} ${w.model}` : '—', legacy: nodeLabel(b.placement(j, c).station), value: watchValueFn ? watchValueFn(j).value : null, soId: so?.id, soNumber: so?.number, auditId: aud?.id, link: `/jobs/${j.id}` };
});
export async function getUnaccounted(): Promise<UnaccountedRow[]> { return getUnaccountedSync(); }
export const getFoundNoJobSync = (): ItemStub[] => (seedCustody(), stubs).filter((s) => !s.reviewed);
export async function reviewStub(id: string): Promise<void> { const s = stubs.find((x) => x.id === id); if (!s) throw new Error('Stub not found'); s.reviewed = true; b.jobAudit(`Custody audit · found-no-job stub reviewed · ${s.label}`); emit(); }

// ---- writing events ----
const write = (e: Omit<CustodyEvent, 'id' | 'by' | 'station' | 'at'>): CustodyEvent => { const a = b.actor(); const ev: CustodyEvent = { id: nid('ce'), by: a.by, station: a.station, at: now(), ...e }; events.push(ev); return ev; };
const placePart = (j: Job, c: JobComponent, node: string, via: 'custody_audit' | 'custody_backfill', note: string): boolean => {
  if (node.startsWith('bin:')) return false; const to = node as RwStationKey; if (b.placement(j, c).station === to) return false;
  suppressHook = true; try { b.move(j, c, to, via, note); } finally { suppressHook = false; } return true;
};
const resolveItem = async (code: string): Promise<{ j: Job; c: JobComponent } | null> => {
  const bandOnly = /\|B$|^BAND-/i.test(code.trim()); const head = code.trim().replace(/^BAND-/i, '').split('|')[0].toUpperCase();
  const strict = (w: { serial: string; reference: string }) => { const s = w.serial.toUpperCase(); return s.length >= 5 && !/UNKNOWN|TBD|N\/A/.test(s) && (head === s || head === `${w.reference}/${w.serial}`.toUpperCase() || head === `${w.reference} / ${w.serial}`.toUpperCase()); };
  const j = b.allJobs().find((x) => x.number === head) ?? b.openJobs().find((x) => { const w = b.watches().find((y) => y.id === x.watchId); return !!w && strict(w); }); if (!j) return null; const comps = b.parts(j);
  const c = bandOnly ? comps.find((x) => x.key === 'band') : comps.find((x) => x.key === 'head') ?? comps.find((x) => x.key === 'case') ?? comps[0];
  return c ? { j, c } : null;
};
// Every ordinary move scan (station / pad / bulk / gate) is a real custody event too — the audit only has to catch what the shop never scanned
b.onPartMoved((j, c, to) => { if (suppressHook || !to) return; write({ itemKey: itemKey(j.id, c.key), jobId: j.id, jobNumber: j.number, part: c.key, toNode: to, nodeLabel: nodeLabel(to), source: 'scan' }); syncPins(); emit(); });

// ---- audit sessions ----
export const getAuditsSync = (): CustodyAudit[] => (seedCustody(), [...audits]).sort((a, c) => c.startedAt.localeCompare(a.startedAt));
export async function getCustodyAudits(): Promise<CustodyAudit[]> { return getAuditsSync(); }
export const getAuditSync = (id: string) => (seedCustody(), audits).find((a) => a.id === id);
export async function startCustodyAudit(kind: AuditScopeKind, key?: string): Promise<CustodyAudit> {
  seedCustody(); const a = b.actor(); const opt = auditScopeOptionsSync().find((o) => o.kind === kind && (kind === 'shop' || o.key === key)); if (!opt) throw new Error('Pick a scope');
  const nodeKeys = nodesForScope(kind, key); if (!nodeKeys.length) throw new Error('Nothing to audit in that scope');
  const s: CustodyAudit = { id: nid('caud'), by: a.by, station: a.station, startedAt: now(), status: 'open', scope: { kind, key: kind === 'shop' ? undefined : key, label: opt.label }, nodeKeys, nodes: {}, stubIds: [] };
  audits.push(s); b.jobAudit(`Custody audit started · ${opt.label} · ${nodeKeys.length} nodes · ${a.by}`); emit(); return { ...s };
}
const auditOf = (id: string) => { const s = audits.find((a) => a.id === id); if (!s) throw new Error('Audit not found'); if (s.status === 'closed') throw new Error('This audit is closed'); return s; };
export async function pauseCustodyAudit(id: string): Promise<CustodyAudit> { const s = auditOf(id); s.status = 'paused'; s.pausedAt = now(); emit(); return { ...s }; }
export async function resumeCustodyAudit(id: string): Promise<CustodyAudit> { const s = auditOf(id); s.status = 'open'; s.pausedAt = undefined; emit(); return { ...s }; }
const nodeState = (s: CustodyAudit, node: string) => (s.nodes[node] ??= { status: 'open', scanned: [] });
export async function auditPickNode(id: string, codeOrKey: string): Promise<CustodyAudit> {
  const s = auditOf(id); if (s.status === 'paused') throw new Error('Resume the audit first'); const raw = codeOrKey.trim();
  const st = b.stations().find((x) => x.key === raw || x.label.toLowerCase() === raw.toLowerCase()); const node = st ? st.key : isBinLabel(raw) ? `bin:${normBin(raw)}` : null;
  if (!node) throw new Error(`“${raw}” is not a node label (station, safe tray or shelf bin)`);
  if (!s.nodeKeys.includes(node) && !node.startsWith('bin:')) throw new Error(`${nodeLabel(node)} is outside this audit's scope (${s.scope.label})`);
  s.currentNode = node; s.currentBin = undefined; nodeState(s, node); emit(); return { ...s };
}
// One scan: node label → picks the node · bin label → bin at the node (next items ride in it) · item label → custody event source=audit · unknown → stub offer
export async function custodyAuditScan(id: string, code: string): Promise<AuditScanResult> {
  const s = auditOf(id); if (s.status === 'paused') throw new Error('Resume the audit first'); const raw = code.trim();
  const st = b.stations().find((x) => x.key === raw || x.label.toLowerCase() === raw.toLowerCase());
  if (st) { await auditPickNode(id, st.key); return { kind: 'node', node: st.key, label: st.label }; }
  if (!s.currentNode) { if (isBinLabel(raw)) { await auditPickNode(id, raw); return { kind: 'node', node: s.currentNode!, label: nodeLabel(s.currentNode!) }; } throw new Error('Scan or tap the node you are standing at first'); }
  if (isBinLabel(raw)) { const bin = normBin(raw); s.currentBin = bin; write({ itemKey: `bin:${bin}`, toNode: s.currentNode, nodeLabel: nodeLabel(s.currentNode), source: 'audit', auditId: s.id, why: 'bin recorded at node' }); emit(); return { kind: 'bin', bin, node: s.currentNode }; }
  const hit = await resolveItem(raw); if (!hit) return { kind: 'unknown', code: raw };
  const key = itemKey(hit.j.id, hit.c.key); const ns = nodeState(s, s.currentNode); const duplicate = ns.scanned.includes(key); if (!duplicate) ns.scanned.push(key);
  const event = write({ itemKey: key, jobId: hit.j.id, jobNumber: hit.j.number, part: hit.c.key, toNode: s.currentNode, nodeLabel: nodeLabel(s.currentNode), binLabel: s.currentBin, source: 'audit', auditId: s.id });
  const moved = placePart(hit.j, hit.c, s.currentNode, 'custody_audit', `custody audit ${s.scope.label}${s.currentBin ? ` · in ${s.currentBin}` : ''}`);
  if (!moved) b.jobStamp(hit.j, `${b.partLabel(hit.c.key)} audited at ${nodeLabel(s.currentNode)} (custody_audit)${s.currentBin ? ` · in ${s.currentBin}` : ''}`);
  syncPins(); emit(); return { kind: 'item', event, moved, duplicate };
}
export async function custodyAuditStub(id: string, label: string, extra: { reference?: string; serial?: string }): Promise<ItemStub> {
  const s = auditOf(id); if (!s.currentNode) throw new Error('Pick a node first');
  const stub: ItemStub = { id: nid('stub'), label: label.trim(), reference: extra.reference?.trim() || undefined, serial: extra.serial?.trim() || undefined, node: s.currentNode, nodeLabel: nodeLabel(s.currentNode), at: now(), by: b.actor().by, auditId: s.id };
  stubs.push(stub); s.stubIds.push(stub.id); write({ itemKey: `stub:${stub.id}`, toNode: s.currentNode, nodeLabel: stub.nodeLabel, source: 'audit', auditId: s.id, why: `not in system · stub from label ${stub.label}` });
  b.jobAudit(`Custody audit · unknown label ${stub.label} → item stub at ${stub.nodeLabel} (review list)`); emit(); return stub;
}
export async function closeAuditNode(id: string, node?: string): Promise<CustodyAudit> { const s = auditOf(id); const n = node ?? s.currentNode; if (!n) throw new Error('No node selected'); const ns = nodeState(s, n); ns.status = 'closed'; ns.closedAt = now(); ns.by = b.actor().by; if (s.currentNode === n) { s.currentNode = undefined; s.currentBin = undefined; } emit(); return { ...s }; }
export const auditProgressSync = (id: string): CustodyProgress => {
  const s = audits.find((a) => a.id === id)!; const scanned = new Set(Object.values(s.nodes).flatMap((n) => n.scanned));
  const expectedItems = openItems().filter(({ j, c }) => s.nodeKeys.includes(b.placement(j, c).station) || !!lastEvent(itemKey(j.id, c.key)) && s.nodeKeys.includes(lastEvent(itemKey(j.id, c.key))!.toNode));
  const found = expectedItems.filter(({ key }) => scanned.has(key)).length;
  const byNode = s.nodeKeys.map((k) => ({ key: k, label: nodeLabel(k), status: s.nodes[k]?.status ?? ('untouched' as const), expected: expectedItems.filter(({ j, c, key }) => (lastEvent(key)?.toNode ?? b.placement(j, c).station) === k).length, scanned: s.nodes[k]?.scanned.length ?? 0 }));
  return { nodesTotal: s.nodeKeys.length, nodesClosed: Object.values(s.nodes).filter((n) => n.status === 'closed').length, itemsScanned: scanned.size, expected: expectedItems.length, found, unaccounted: s.status === 'closed' ? s.result?.unaccounted.length ?? 0 : expectedItems.length - found, byNode };
};
// Close: every open-job item believed in scope that was never scanned (and has no real custody anywhere) → UNACCOUNTED; stubs → found, no job
export async function closeCustodyAudit(id: string): Promise<CustodyAudit> {
  const s = auditOf(id); const a = b.actor(); const scanned = new Set(Object.values(s.nodes).flatMap((n) => n.scanned));
  const unaccounted = openItems().filter(({ j, c, key }) => s.nodeKeys.includes(b.placement(j, c).station) && !scanned.has(key) && !lastEvent(key)).map(({ key }) => key);
  s.status = 'closed'; s.closedAt = now(); s.closedBy = a.by; s.currentNode = undefined; s.result = { unaccounted, foundNoJob: [...s.stubIds] };
  b.jobAudit(`Custody audit closed · ${s.scope.label} · ${scanned.size} items scanned · ${unaccounted.length} UNACCOUNTED · ${s.stubIds.length} found-no-job`); syncPins(); emit(); return { ...s };
}

// ---- backfill (the one-tap fix): scan the item at the node you are at — no scan, no custody ----
export async function backfillCustody(jobId: string, part: ComponentKey, node: string, scannedLabel: string, why: string): Promise<CustodyEvent> {
  if (!why.trim()) throw new Error('Say why custody is being backfilled'); const hit = await resolveItem(scannedLabel); if (!hit || hit.j.id !== jobId) throw new Error(`That label is not ${b.allJobs().find((x) => x.id === jobId)?.number ?? 'this job'} — scan the item itself`);
  const c = b.parts(hit.j).find((x) => x.key === part); if (!c) throw new Error('Part not on this job'); if (!b.stations().some((x) => x.key === node) && !node.startsWith('bin:')) throw new Error('Pick the node you are standing at');
  const ev = write({ itemKey: itemKey(hit.j.id, part), jobId: hit.j.id, jobNumber: hit.j.number, part, toNode: node, nodeLabel: nodeLabel(node), source: 'backfill', why: why.trim() });
  const moved = placePart(hit.j, c, node, 'custody_backfill', `custody backfilled · ${why.trim()}`); if (!moved) b.jobStamp(hit.j, `${b.partLabel(part)} custody backfilled at ${nodeLabel(node)} · ${why.trim()}`);
  b.jobAudit(`Custody BACKFILL · ${hit.j.number} ${b.partLabel(part)} → ${nodeLabel(node)} · ${why.trim()}`); syncPins(); emit(); return ev;
}

// ---- invoice flag + hitlist items (VC = Operations Manager) ----
const PIN_INVOICE = (soId: string) => `custody-minus1-invoice:${soId}`;
export const invoiceMinusOneSync = (jobId: string | undefined): MinusOneItem[] => (jobId ? minusOneFor(jobId) : []);
const syncPins = () => {
  for (const o of b.salesOrders()) { if (!o.invoiceSends?.some((x) => x.custodyAtInvoice === 'minus_one')) continue; if (!invoiceMinusOneSync(o.jobId).length) b.resolveSystemPin(PIN_INVOICE(o.id), 'custody backfilled'); }
  const rows = getUnaccountedSync(); const cov = coverageSync();
  if (rows.length) b.upsertSystemPin('custody-coverage', { title: `Custody coverage ${cov.pct}% · ${rows.length} client asset${rows.length === 1 ? '' : 's'} not on hand (−${rows.length})`, subtitle: 'Items on open jobs without a real custody scan — audit or backfill each one at the node it is at', assignedTo: { type: 'user', shortName: 'MH' }, priority: 'high', standing: true, link: '/setup/custody' });
  else b.resolveSystemPin('custody-coverage', 'coverage 100%');
};

// ---- reports ----
export const coverageSync = (): CoverageReport => {
  seedCustody(); const items = openItems(); const covered = items.filter(({ key }) => lastEvent(key)); const since = audits.map((a) => a.startedAt).sort()[0];
  const nodes = new Map<string, { total: number; covered: number }>();
  items.forEach(({ j, c, key }) => { const ev = lastEvent(key); const node = ev?.toNode ?? b.placement(j, c).station; const r = nodes.get(node) ?? { total: 0, covered: 0 }; r.total++; if (ev) r.covered++; nodes.set(node, r); });
  const days = new Map<string, number>(); events.filter((e) => e.source !== 'scan' || !!e.auditId).forEach((e) => { const d = e.at.slice(0, 10); days.set(d, (days.get(d) ?? 0) + 1); });
  let cum = 0; const trend = [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([day, n]) => { cum += n; return { day, events: n, cumulative: cum }; });
  return { total: items.length, covered: covered.length, pct: items.length ? Math.round((covered.length / items.length) * 1000) / 10 : 100, byNode: [...nodes.entries()].map(([key, r]) => ({ key, label: nodeLabel(key), ...r })).sort((x, y) => y.total - x.total), trend, since };
};
export async function getCoverage(): Promise<CoverageReport> { return coverageSync(); }
export const getCustodyEventsSync = (filter?: { jobId?: string; sources?: CustodySource[] }): CustodyEvent[] => (seedCustody(), events).filter((e) => (!filter?.jobId || e.jobId === filter.jobId) && (!filter?.sources || filter.sources.includes(e.source))).slice().reverse();
export const auditLogCsv = (): string => ['seq,at,source,who,station,node,bin,item,job,part,why,audit', ...events.filter((e) => e.source !== 'scan').map((e, i) => [i + 1, e.at, e.source, e.by, e.station, e.nodeLabel, e.binLabel ?? '', e.itemKey, e.jobNumber ?? '', e.part ?? '', (e.why ?? '').replace(/,/g, ';'), e.auditId ?? ''].join(','))].join('\n');

// ---- seeds (prototype): baseline shop audit by MH (closed, 3 days ago) covering every open-job item EXCEPT three → UNACCOUNTED; one found-no-job stub;
//      Vienna's Watchmaker-room audit in progress: 2 nodes closed, 1 in progress, 1 untouched. E02017's bracelet (SO-26-0102 at invoice) is one of the three. ----
const UNACCOUNTED_SEED: [string, ComponentKey][] = [['j-07', 'band'], ['j-17', 'case'], ['j-31', 'band']];
let seeded = false;
function seedCustody() {
  if (seeded) return; seeded = true;
  const base: CustodyAudit = { id: 'caud-00', by: 'MH', station: 'Front Desk 1', startedAt: daysAgo(3, 8), status: 'closed', closedAt: daysAgo(3, 17), closedBy: 'MH', scope: { kind: 'shop', label: 'Whole shop' }, nodeKeys: b.stations().map((s) => s.key), nodes: {}, stubIds: [] };
  const skip = new Set(UNACCOUNTED_SEED.map(([j, p]) => `${j}:${p}`));
  for (const { j, c, key } of openItems()) {
    const node = b.placement(j, c).station; const ns = (base.nodes[node] ??= { status: 'closed', scanned: [], closedAt: base.closedAt, by: 'MH' });
    if (skip.has(key)) continue; ns.scanned.push(key);
    events.push({ id: `ce-base-${key}`, itemKey: key, jobId: j.id, jobNumber: j.number, part: c.key, toNode: node, nodeLabel: nodeLabel(node), binLabel: c.containerKey === 'jv_bin' ? 'BIN-JV' : undefined, source: 'audit', by: 'MH', station: 'Front Desk 1', at: daysAgo(3, 9 + (events.length % 7)), auditId: base.id });
  }
  base.nodeKeys.forEach((k) => { base.nodes[k] ??= { status: 'closed', scanned: [], closedAt: base.closedAt, by: 'MH' }; });
  const stub: ItemStub = { id: 'stub-01', label: 'RW-UNK-0042', reference: '16610', serial: undefined, node: 'safe_await_band', nodeLabel: nodeLabel('safe_await_band'), at: daysAgo(3, 14), by: 'MH', auditId: base.id };
  stubs.push(stub); base.stubIds.push(stub.id); events.push({ id: 'ce-stub-01', itemKey: `stub:${stub.id}`, toNode: stub.node, nodeLabel: stub.nodeLabel, source: 'audit', by: 'MH', station: 'Front Desk 1', at: stub.at, why: 'not in system · stub from label RW-UNK-0042', auditId: base.id });
  base.result = { unaccounted: [...skip].filter((k) => openItems().some((x) => x.key === k)), foundNoJob: [stub.id] };
  audits.push(base);
  const wm = SCOPE_STATIONS.wm_room; const live: CustodyAudit = { id: 'caud-01', by: 'Vienna', station: 'Watchmaker Room', startedAt: daysAgo(0, 8), status: 'open', scope: { kind: 'station', key: 'wm_room', label: wm.label }, nodeKeys: wm.keys, nodes: {}, stubIds: [] };
  const at = (h: number) => daysAgo(0, h);
  for (const k of ['wm_bench_1', 'wm_bench_2'] as RwStationKey[]) { const ns: AuditNodeState = { status: 'closed', scanned: [], closedAt: at(9), by: 'Vienna' }; openItems().filter(({ j, c }) => b.placement(j, c).station === k).forEach(({ j, c, key }) => { ns.scanned.push(key); events.push({ id: `ce-wm-${key}`, itemKey: key, jobId: j.id, jobNumber: j.number, part: c.key, toNode: k, nodeLabel: nodeLabel(k), source: 'audit', by: 'Vienna', station: 'Watchmaker Room', at: at(8), auditId: live.id }); }); live.nodes[k] = ns; }
  { const k: RwStationKey = 'wm_bench_3'; const items = openItems().filter(({ j, c }) => b.placement(j, c).station === k); const first = items[0]; const ns: AuditNodeState = { status: 'open', scanned: [] }; if (first) { ns.scanned.push(first.key); events.push({ id: `ce-wm3-${first.key}`, itemKey: first.key, jobId: first.j.id, jobNumber: first.j.number, part: first.c.key, toNode: k, nodeLabel: nodeLabel(k), source: 'audit', by: 'Vienna', station: 'Watchmaker Room', at: at(9), auditId: live.id }); } live.nodes[k] = ns; live.currentNode = k; }
  audits.push(live);
  syncPins();
}
// Seed on first read of anything custody-related (fixtures are loaded by then); day sweeps keep the hitlist items current
registerCustodyCheck((jobId) => { seedCustody(); return minusOneFor(jobId); });
b.registerDaySweep(() => { seedCustody(); syncPins(); });
export const ensureCustodySeeded = () => seedCustody();
