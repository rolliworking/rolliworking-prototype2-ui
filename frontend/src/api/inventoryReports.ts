import { invBridge as b, registerDaySweep } from './client';
import type { Part, PurchaseOrder, Vendor } from './client';

// ---- CONSUMPTION ADJUSTMENT + SPENDING OPTIMIZATION (MH 2026-09-30) — Inventory → Reports, manager tier, dollars visible.
// Usage comes from pick scans + parts requests (never invoices); lead time from PO issued → received per vendor × part; pipeline demand = M3KE kits (column modelled, live when kits exist).
export interface ReportSettings { reviewDays: number; cadenceDays: number; overstockMonths: number; deadDays: number; goLiveAt: string; packSizes: Record<string, number> }
const DAY = 864e5; const d = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();
export const settings: ReportSettings = { reviewDays: 30, cadenceDays: 60, overstockMonths: 6, deadDays: 180, goLiveAt: d(61), packSizes: { 'v-cousins': 2 } };
export const updateSettings = (patch: Partial<ReportSettings>) => { Object.assign(settings, patch); b.stamp(`Inventory report settings · ${Object.entries(patch).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}`); };

export interface UsageEvent { partId: string; at: string; qty: number; source: 'pick' | 'request' }
export interface PoEvent { id: string; poNumber: string; partId: string; vendorId: string; issuedAt: string; receivedAt?: string; qty: number; unitPrice: number; sentBy: string; onHandAtOrder: number; onOrderAtOrder: number; orderUpToAtOrder: number }
const usage: UsageEvent[] = []; const poEvents: PoEvent[] = []; const stockouts: { partId: string; at: string; jobNumber?: string }[] = [];

// ---- Seed: 30 parts × 12 months of pick + PO history (deterministic) — steady / rising / falling / seasonal / dead / overstocked / overpriced / over-ordered patterns
let rngState = 20260930; const rnd = () => { rngState = (rngState * 1103515245 + 12345) % 2147483648; return rngState / 2147483648; };
type Pattern = 'steady' | 'rising' | 'falling' | 'seasonal' | 'dead' | 'overstock' | 'drift' | 'overorder' | 'leadshift' | 'stockout';
const SEED_PARTS: [string, Pattern, number][] = [
  ['pt-01', 'rising', 1.2], ['pt-02', 'steady', 0.8], ['pt-03', 'stockout', 2.5], ['pt-04', 'falling', 0.6], ['pt-05', 'leadshift', 1.5], ['pt-06', 'steady', 3], ['pt-07', 'dead', 0], ['pt-08', 'overorder', 1.1],
  ['pt-09', 'seasonal', 0.9], ['pt-10', 'drift', 1.4], ['pt-11', 'overstock', 0.4], ['pt-12', 'steady', 0.5], ['pt-13', 'rising', 0.7], ['pt-14', 'falling', 1], ['pt-15', 'dead', 0], ['pt-16', 'stockout', 1.8],
  ['pt-17', 'steady', 0.6], ['pt-18', 'overstock', 0.3], ['pt-19', 'drift', 0.9], ['pt-20', 'seasonal', 1.2], ['pt-21', 'steady', 0.4], ['pt-22', 'rising', 0.9], ['pt-23', 'steady', 0.5], ['pt-24', 'falling', 0.8],
  ['pt-25', 'leadshift', 0.7], ['pt-26', 'steady', 1], ['pt-c2', 'rising', 1.6], ['pt-c5', 'drift', 0.8], ['pt-c6', 'steady', 1.3], ['pt-c8', 'steady', 2],
];
const VENDOR_LEAD: Record<string, [number, number]> = { 'v-rsc': [14, 21], 'v-tudor': [9, 12], 'v-gold': [6, 8], 'v-cousins': [5, 7], 'v-ap': [10, 15] };
const vendorFor = (part: Part, i: number) => part.vendorIds?.[0] ?? b.pricing(part.id).last?.vendorId ?? ['v-rsc', 'v-tudor', 'v-gold'][i % 3];
let seeded = false;
export const ensureSeed = () => {
  if (seeded) return; seeded = true;
  SEED_PARTS.forEach(([partId, pattern, perWeek], idx) => {
    const part = b.parts().find((p) => p.id === partId); if (!part) return; const vendorId = vendorFor(part, idx); const [med, p90] = VENDOR_LEAD[vendorId] ?? [10, 14];
    // usage events across 52 weeks
    for (let w = 52; w >= 0; w--) {
      let rate = perWeek; const recent = w <= 13;
      if (pattern === 'rising') rate = recent ? perWeek * 1.4 : perWeek; if (pattern === 'falling') rate = recent ? perWeek * 0.55 : perWeek; if (pattern === 'seasonal') rate = perWeek * (1 + 0.6 * Math.sin((w / 52) * Math.PI * 2));
      if (pattern === 'dead') rate = w > 30 ? 0.3 : 0; if (pattern === 'overstock') rate = perWeek; if (pattern === 'stockout') rate = recent ? perWeek * 1.5 : perWeek;
      const n = pattern === 'overstock' ? (partId === 'pt-11' || w % 2 === 0 ? 1 : 0) : Math.max(0, Math.round(rate + (rnd() - 0.5) * rate)); for (let k = 0; k < n; k++) usage.push({ partId, at: d(w * 7 + rnd() * 6), qty: 1, source: rnd() < 0.7 ? 'pick' : 'request' });
    }
    // POs: roughly every 6–10 weeks; lead time per vendor (leadshift → recent POs slower); drift → recent price +18%; overorder → one PO over the cap
    const base = part.cost ?? part.price; const rule = b.rule(partId); let k = 0;
    for (let w = 50; w > 1; w -= 6 + Math.floor(rnd() * 4), k++) {
      const recent = w <= 16; const lead = (recent && pattern === 'leadshift' ? med * 1.6 : med) + (rnd() < 0.2 ? p90 - med : 0) + Math.round((rnd() - 0.5) * 2);
      const price = pattern === 'drift' && recent ? Math.round(base * 1.18 * 100) / 100 : Math.round(base * (0.95 + rnd() * 0.1) * 100) / 100;
      const upTo = rule.orderUpTo || 6; const onHandAt = Math.min(Math.round(rnd() * 2), Math.max(0, upTo - 1)); const cap = Math.max(1, upTo - onHandAt); const qty = pattern === 'overorder' && w < 10 ? cap + 5 : Math.max(1, Math.min(cap, Math.round(perWeek * 8)));
      poEvents.push({ id: `poe-${partId}-${k}`, poNumber: `PO-${w > 26 ? '25' : '26'}-${String(400 + idx * 9 + k).padStart(4, '0')}`, partId, vendorId, issuedAt: d(w * 7), receivedAt: d(w * 7 - lead), qty, unitPrice: price, sentBy: ['MH', 'MM', 'JV'][k % 3], onHandAtOrder: onHandAt, onOrderAtOrder: 0, orderUpToAtOrder: upTo });
    }
    if (pattern === 'overstock') b.seedStock(partId, partId === 'pt-11' ? 26 : 18); if (pattern === 'dead') b.seedStock(partId, partId === 'pt-07' ? 3 : 4);
    if (pattern === 'stockout') { stockouts.push({ partId, at: d(12 + idx), jobNumber: `E020${10 + idx}` }); if (partId === 'pt-03') stockouts.push({ partId, at: d(41), jobNumber: 'E02004' }); }
  });
  // duplicate open orders: pt-08 on two open POs to different vendors (seed POs go through the bridge so Purchasing sees them)
  const pos = b.pos(); const mk = (id: string, number: string, vendorId: string, qty: number, cost: number): PurchaseOrder => ({ id, number, vendorId, status: 'sent', division: 'rolliworks', locationId: 'loc-a1', lines: [{ id: `${id}-l1`, partId: 'pt-08', partNumber: '116610-INS', description: 'Bezel insert, black ceramic (116610LN)', qty, unitCost: cost, receivedQty: 0 }], total: qty * cost, memo: 'seed · duplicate order check', createdAt: d(4), createdBy: 'MM', station: 'Watchmaker Room', sentAt: d(3) });
  if (!pos.some((p) => p.id === 'po-dup1')) { pos.push(mk('po-dup1', 'PO-26-0091', 'v-rsc', 4, 58), mk('po-dup2', 'PO-26-0092', 'v-tudor', 4, 61)); }
};

// ---- Live data merge: seeded events + real pick tasks / parts requests / POs
const partName = (id: string) => b.parts().find((p) => p.id === id);
const allUsage = (): UsageEvent[] => [...usage, ...b.picks().filter((p) => p.status === 'picked' && p.doneAt).map((p) => ({ partId: p.partId, at: p.doneAt!, qty: p.qty, source: 'pick' as const })), ...b.requests().filter((r) => r.partId && ['approved', 'ordered', 'received', 'allocated', 'picked'].includes(r.status)).map((r) => ({ partId: r.partId!, at: r.requestedAt, qty: r.qty, source: 'request' as const }))];
const allPoEvents = (): PoEvent[] => [...poEvents, ...b.pos().filter((p) => p.sentAt).flatMap((p) => p.lines.map((l) => ({ id: `${p.id}-${l.id}`, poNumber: p.number, partId: l.partId, vendorId: p.vendorId, issuedAt: p.sentAt!, receivedAt: p.receivedAt, qty: l.qty, unitPrice: l.unitCost, sentBy: p.createdBy, onHandAtOrder: 0, onOrderAtOrder: 0, orderUpToAtOrder: 0 })))];
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, c) => a - c); return s[Math.floor(s.length / 2)]; };
const pct = (xs: number[], q: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, c) => a - c); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const since = (iso: string, days: number) => Date.now() - new Date(iso).getTime() <= days * DAY;

export interface UsageStats { perWeek90: number; perWeek12m: number; variability: number; stockouts90: number }
export const usageStats = (partId: string): UsageStats => {
  const ev = allUsage().filter((e) => e.partId === partId); const q90 = sum(ev.filter((e) => since(e.at, 90)).map((e) => e.qty)); const q12 = sum(ev.filter((e) => since(e.at, 365)).map((e) => e.qty));
  const weeks: number[] = Array.from({ length: 13 }, (_, i) => sum(ev.filter((e) => { const age = (Date.now() - new Date(e.at).getTime()) / DAY; return age >= i * 7 && age < (i + 1) * 7; }).map((e) => e.qty)));
  const mean = sum(weeks) / 13; const sd = Math.sqrt(sum(weeks.map((w) => (w - mean) ** 2)) / 13);
  return { perWeek90: Math.round((q90 / 13) * 100) / 100, perWeek12m: Math.round((q12 / 52) * 100) / 100, variability: mean ? Math.round((sd / mean) * 100) / 100 : 0, stockouts90: stockouts.filter((s) => s.partId === partId && since(s.at, 90)).length + b.needs().filter((n) => n.partId === partId && (n.reason === 'out_of_stock' || n.reason === 'pick_short') && since(n.at, 90)).length };
};
export interface LeadStats { vendorId: string; vendorName: string; median: number; p90: number; prevMedian: number; samples: number }
export const leadStats = (partId: string): LeadStats | null => {
  const ev = allPoEvents().filter((e) => e.partId === partId && e.receivedAt); if (!ev.length) return null; const byVendor = new Map<string, PoEvent[]>(); ev.forEach((e) => byVendor.set(e.vendorId, [...(byVendor.get(e.vendorId) ?? []), e]));
  const [vendorId, rows] = [...byVendor.entries()].sort((a, c) => c[1].length - a[1].length)[0]; const days = (e: PoEvent) => Math.max(1, Math.round((new Date(e.receivedAt!).getTime() - new Date(e.issuedAt).getTime()) / DAY));
  const recent = rows.filter((e) => since(e.issuedAt, 120)).map(days); const older = rows.filter((e) => !since(e.issuedAt, 120)).map(days);
  return { vendorId, vendorName: b.vendors().find((v) => v.id === vendorId)?.name ?? vendorId, median: median(recent.length ? recent : rows.map(days)), p90: pct(rows.map(days), 0.9), prevMedian: median(older.length ? older : rows.map(days)), samples: rows.length };
};
// Pipeline demand — M3KE standard parts kit per ref × legs over the review period. Column modelled; returns 0 until ref kits exist (goes live with M3KE).
export const pipelineDemandPerWeek = (_partId: string): { perWeek: number; live: boolean } => ({ perWeek: 0, live: false });

export interface AdjustmentRow { id: string; partId: string; part: Part; vendorName: string; vendorId?: string; usagePerWeek: number; usage12m: number; pipelinePerWeek: number; demandPerWeek: number; leadMedian: number; leadP90: number; currentMin: number; currentUpTo: number; suggestedMin: number; suggestedUpTo: number; deltaMin: number; deltaUpTo: number; reason: string; stockouts90: number; dollarImpact: number; unitCost: number; status: 'open' | 'approved' | 'skipped'; appliedMin?: number; appliedUpTo?: number }
export interface ReportRun { id: string; at: string; by: string; rows: AdjustmentRow[]; approvedCount: number; skippedCount: number }
const runs: ReportRun[] = [];
const roundPack = (qty: number, vendorId?: string) => { const pack = vendorId ? settings.packSizes[vendorId] : undefined; return pack && pack > 1 ? Math.ceil(qty / pack) * pack : qty; };
const computeRows = (): AdjustmentRow[] => b.parts().filter((p) => allUsage().some((e) => e.partId === p.id) || allPoEvents().some((e) => e.partId === p.id)).map((part) => {
  const u = usageStats(part.id); const lead = leadStats(part.id); const pipe = pipelineDemandPerWeek(part.id); const demand = Math.max(u.perWeek90, pipe.perWeek); const perDay = demand / 7; const leadP90 = lead?.p90 ?? 14; const leadMed = lead?.median ?? 10;
  const rule = b.rule(part.id); const vendorId = lead?.vendorId ?? part.vendorIds?.[0]; const vendorName = lead?.vendorName ?? b.vendors().find((v) => v.id === vendorId)?.name ?? '—';
  const duringLead = perDay * leadP90; const safety = demand > 0 ? Math.max(1, Math.ceil(duringLead * 0.5 * (1 + u.variability))) : 0; const suggestedMin = demand > 0 ? Math.ceil(duringLead) + safety : 0; const suggestedUpTo = demand > 0 ? roundPack(suggestedMin + Math.ceil(perDay * settings.reviewDays), vendorId) : 0;
  const reasons: string[] = []; const chg = u.perWeek12m ? Math.round(((u.perWeek90 - u.perWeek12m) / u.perWeek12m) * 100) : 0; if (Math.abs(chg) >= 15) reasons.push(`usage ${chg > 0 ? 'up' : 'down'} ${Math.abs(chg)}%`); if (lead && Math.abs(lead.median - lead.prevMedian) >= 3) reasons.push(`lead ${lead.prevMedian}d → ${lead.median}d`); if (u.stockouts90) reasons.push(`${u.stockouts90} stockout${u.stockouts90 > 1 ? 's' : ''} 90d`); if (demand === 0) reasons.push('no usage 90d'); if (!reasons.length) reasons.push(u.variability > 0.8 ? 'erratic usage' : 'usage steady');
  const unitCost = b.pricing(part.id).avgCost ?? part.cost ?? part.price;
  return { id: `adj-${part.id}`, partId: part.id, part, vendorName, vendorId, usagePerWeek: u.perWeek90, usage12m: u.perWeek12m, pipelinePerWeek: pipe.perWeek, demandPerWeek: demand, leadMedian: leadMed, leadP90, currentMin: rule.min, currentUpTo: rule.orderUpTo, suggestedMin, suggestedUpTo, deltaMin: suggestedMin - rule.min, deltaUpTo: suggestedUpTo - rule.orderUpTo, reason: reasons.join(' · '), stockouts90: u.stockouts90, dollarImpact: Math.round((suggestedUpTo - rule.orderUpTo) * unitCost * 100) / 100, unitCost, status: 'open' as const };
}).filter((r) => (r.currentMin > 0 || r.currentUpTo > 0 || r.stockouts90 > 0) && (r.deltaMin !== 0 || r.deltaUpTo !== 0)).sort((a, c) => Math.abs(c.dollarImpact) - Math.abs(a.dollarImpact));
export const runReport = (): ReportRun => { ensureSeed(); const a = b.actor(); const run: ReportRun = { id: `run-${Date.now().toString(36)}`, at: new Date().toISOString(), by: a.by, rows: computeRows(), approvedCount: 0, skippedCount: 0 }; runs.unshift(run); b.stamp(`Consumption adjustment report run ${run.id} · ${run.rows.length} suggested change(s) · by ${a.by}`); b.resolvePin('consumption-report', `run ${run.id}`); return run; };
export const latestRun = () => runs[0] ?? null; export const runHistory = () => [...runs];
export const approveRow = (runId: string, rowId: string, override?: { min: number; orderUpTo: number }) => {
  const run = runs.find((r) => r.id === runId); const row = run?.rows.find((r) => r.id === rowId); if (!run || !row || row.status !== 'open') return; const a = b.actor();
  const min = override?.min ?? row.suggestedMin; const upTo = override?.orderUpTo ?? row.suggestedUpTo; b.setRule(row.partId, min, upTo); row.status = 'approved'; row.appliedMin = min; row.appliedUpTo = upTo; run.approvedCount += 1;
  b.audit(`Reorder rule ${row.part.partNumber}: min ${row.currentMin} → ${min} · order-up-to ${row.currentUpTo} → ${upTo} · by ${a.by} · run ${run.id}${override ? ' · edited' : ''}`); b.stamp(`${row.part.partNumber} rule → min ${min} / up to ${upTo} (${run.id})`);
};
export const approveAll = (runId: string) => { const run = runs.find((r) => r.id === runId); run?.rows.filter((r) => r.status === 'open').forEach((r) => approveRow(runId, r.id)); b.sweepAutoPo(); };
export const skipRow = (runId: string, rowId: string) => { const run = runs.find((r) => r.id === runId); const row = run?.rows.find((r) => r.id === rowId); if (run && row && row.status === 'open') { row.status = 'skipped'; run.skippedCount += 1; } };

// Standing MH item every cadenceDays (first due goLive + 60d; next from the last run)
export const nextDue = () => new Date(new Date(runs[0]?.at ?? settings.goLiveAt).getTime() + settings.cadenceDays * DAY);
export const cadenceSweepSync = () => { ensureSeed(); if (Date.now() >= nextDue().getTime()) b.pin('consumption-report', { title: 'Run consumption adjustment report', subtitle: `Every ${settings.cadenceDays} days · recalibrates min triggers and order-up-to · due ${nextDue().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, assignedTo: { type: 'user', shortName: 'MH' }, priority: 'high', standing: true, link: '/inventory/reports' }); else b.resolvePin('consumption-report', 'not due'); };

// ---- SPENDING OPTIMIZATION
export interface OverstockRow { part: Part; onHand: number; perMonth: number; monthsCover: number; dollars: number; suggestedUpTo: number; currentUpTo: number }
export interface DeadRow { part: Part; onHand: number; dollars: number; lastUsed?: string; lastBought?: string }
export interface OverOrderRow { poNumber: string; part: Part; vendorName: string; sentBy: string; qty: number; cap: number; excess: number; dollars: number; at: string }
export interface DriftRow { part: Part; vendorName: string; lastPrice: number; avg12m: number; driftPct: number; overpaid90: number; cheaperVendor?: { name: string; price: number } }
export interface DuplicateRow { part: Part; pos: { number: string; vendorName: string; qty: number }[] }
export interface Optimization { overstock: OverstockRow[]; dead: DeadRow[]; overOrdered: OverOrderRow[]; drift: DriftRow[]; duplicates: DuplicateRow[]; totals: { overstock: number; dead: number; overOrdered: number; drift: number } }
const vName = (id: string) => b.vendors().find((v) => v.id === id)?.name ?? id;
export const optimization = (): Optimization => {
  ensureSeed(); const parts = b.parts(); const ev = allPoEvents(); const use = allUsage(); const rows = computeRows();
  const overstock: OverstockRow[] = parts.map((p): OverstockRow | null => { const u = usageStats(p.id); const perMonth = (u.perWeek12m * 52) / 12; const onHand = b.onHand(p.id); if (!perMonth || onHand <= perMonth * settings.overstockMonths) return null; const cost = b.pricing(p.id).avgCost ?? p.cost ?? p.price; const adj = rows.find((r) => r.partId === p.id); return { part: p, onHand, perMonth: Math.round(perMonth * 10) / 10, monthsCover: Math.round((onHand / perMonth) * 10) / 10, dollars: Math.round(onHand * cost), suggestedUpTo: adj?.suggestedUpTo ?? b.rule(p.id).orderUpTo, currentUpTo: b.rule(p.id).orderUpTo }; }).filter((x): x is OverstockRow => !!x).sort((a, c) => c.dollars - a.dollars);
  const dead: DeadRow[] = parts.map((p): DeadRow | null => { const onHand = b.onHand(p.id); if (onHand <= 0) return null; const lastUsed = use.filter((e) => e.partId === p.id).sort((a, c) => c.at.localeCompare(a.at))[0]?.at; if (lastUsed && since(lastUsed, settings.deadDays)) return null; const bought = [...ev.filter((e) => e.partId === p.id), ...b.history().filter((h) => h.partId === p.id).map((h) => ({ issuedAt: h.at }))].sort((a, c) => c.issuedAt.localeCompare(a.issuedAt))[0]?.issuedAt; const cost = b.pricing(p.id).avgCost ?? p.cost ?? p.price; return { part: p, onHand, dollars: Math.round(onHand * cost), lastUsed, lastBought: bought }; }).filter((x): x is DeadRow => !!x).sort((a, c) => c.dollars - a.dollars);
  const overOrdered: OverOrderRow[] = ev.filter((e) => e.orderUpToAtOrder > 0 && e.qty > e.orderUpToAtOrder - e.onHandAtOrder - e.onOrderAtOrder).map((e) => { const cap = e.orderUpToAtOrder - e.onHandAtOrder - e.onOrderAtOrder; const excess = e.qty - cap; return { poNumber: e.poNumber, part: partName(e.partId)!, vendorName: vName(e.vendorId), sentBy: e.sentBy, qty: e.qty, cap, excess, dollars: Math.round(excess * e.unitPrice), at: e.issuedAt }; }).filter((r) => r.part && r.excess > 0).sort((a, c) => c.dollars - a.dollars);
  const drift: DriftRow[] = parts.map((p): DriftRow | null => { const mine = ev.filter((e) => e.partId === p.id).sort((a, c) => c.issuedAt.localeCompare(a.issuedAt)); if (!mine.length) return null; const last = mine[0]; const yr = mine.filter((e) => since(e.issuedAt, 365)); const avg = sum(yr.map((e) => e.unitPrice * e.qty)) / Math.max(1, sum(yr.map((e) => e.qty))); const byV = new Map<string, number>(); mine.forEach((e) => { if (!byV.has(e.vendorId)) byV.set(e.vendorId, e.unitPrice); }); const cheaper = [...byV.entries()].filter(([v, price]) => v !== last.vendorId && price <= last.unitPrice * 0.9).sort((a, c) => a[1] - c[1])[0]; const driftPct = avg ? Math.round(((last.unitPrice - avg) / avg) * 100) : 0; if (driftPct <= 10 && !cheaper) return null; const overpaid90 = Math.round(sum(mine.filter((e) => since(e.issuedAt, 90)).map((e) => Math.max(0, e.unitPrice - avg) * e.qty))); return { part: p, vendorName: vName(last.vendorId), lastPrice: last.unitPrice, avg12m: Math.round(avg * 100) / 100, driftPct, overpaid90, cheaperVendor: cheaper ? { name: vName(cheaper[0]), price: cheaper[1] } : undefined }; }).filter((x): x is DriftRow => !!x).sort((a, c) => c.overpaid90 - a.overpaid90);
  const open = b.pos().filter((p) => p.status === 'draft' || p.status === 'sent' || p.status === 'partially_received'); const byPart = new Map<string, { number: string; vendorName: string; qty: number; vendorId: string }[]>(); open.forEach((p) => p.lines.forEach((l) => byPart.set(l.partId, [...(byPart.get(l.partId) ?? []), { number: p.number, vendorName: vName(p.vendorId), qty: l.qty, vendorId: p.vendorId }])));
  const duplicates: DuplicateRow[] = [...byPart.entries()].filter(([, ps]) => new Set(ps.map((x) => x.vendorId)).size > 1).map(([partId, ps]) => ({ part: partName(partId)!, pos: ps })).filter((r) => r.part);
  return { overstock, dead, overOrdered, drift, duplicates, totals: { overstock: sum(overstock.map((r) => r.dollars)), dead: sum(dead.map((r) => r.dollars)), overOrdered: sum(overOrdered.map((r) => r.dollars)), drift: sum(drift.map((r) => r.overpaid90)) } };
};
// Monthly snapshot for trends — 6 seeded months + the live month
export interface Snapshot { month: string; overstock: number; dead: number; overOrdered: number; drift: number }
const snapshots: Snapshot[] = Array.from({ length: 6 }, (_, i) => { const dt = new Date(); dt.setMonth(dt.getMonth() - (6 - i)); return { month: dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), overstock: 2400 + i * 310, dead: 1150 + i * 90, overOrdered: 180 + i * 60, drift: 90 + i * 45 }; });
export const snapshotTrend = (): Snapshot[] => { const o = optimization(); return [...snapshots, { month: `${new Date().toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} · live`, ...o.totals }]; };
export const optimizationCsv = (): string => { const o = optimization(); const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`; const lines = [['section', 'part', 'name', 'detail', 'dollars'].join(',')]; o.overstock.forEach((r) => lines.push(['over-stocked', r.part.partNumber, r.part.name, `${r.onHand} on hand · ${r.monthsCover} months · up-to ${r.currentUpTo}→${r.suggestedUpTo}`, r.dollars].map(esc).join(','))); o.dead.forEach((r) => lines.push(['dead', r.part.partNumber, r.part.name, `${r.onHand} on hand · last used ${r.lastUsed?.slice(0, 10) ?? 'never'}`, r.dollars].map(esc).join(','))); o.overOrdered.forEach((r) => lines.push(['over-ordered', r.part.partNumber, r.part.name, `${r.poNumber} · ${r.sentBy} · +${r.excess}`, r.dollars].map(esc).join(','))); o.drift.forEach((r) => lines.push(['price-drift', r.part.partNumber, r.part.name, `${r.vendorName} ${r.lastPrice} vs avg ${r.avg12m} (${r.driftPct}%)${r.cheaperVendor ? ` · switch ${r.cheaperVendor.name} @ ${r.cheaperVendor.price}` : ''}`, r.overpaid90].map(esc).join(','))); o.duplicates.forEach((r) => lines.push(['duplicate', r.part.partNumber, r.part.name, r.pos.map((p) => `${p.number} ${p.vendorName} ×${p.qty}`).join(' | '), ''].map(esc).join(','))); return lines.join('\n'); };
export type { Vendor };
registerDaySweep(cadenceSweepSync);
