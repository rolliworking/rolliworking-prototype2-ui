// CONCIERGE v2 (MH 2026-09-29): derived health / component-wait chips, vendor invoices + duplicate guard, redo cycles, prepay exposure, escalation ladder, vendor parts requests.
// Everything derived is COMPUTED, not stored. Alerts (inbox items) are idempotent by id so the board can re-sync freely.
import { baseStage, conciergeBridge as b, managerShortOf, defaultExpectedAt, isInternationalVendor, isRedoStage, nextSwoStage, shipDaysFor, swoPaidTotal, swoStageLabel, type PayMethod, type Swo, type SwoWithRefs, type VendorInvoice } from './client';
// QBO bill stub: DocNumber = vendor invoice #, PrivateNote = SWO # + our ref; ids stored back on the invoice line
let qboSeq = 4100; const qboBill = () => `QBO-BILL-STUB-${(qboSeq += 1)}`; const qboBillPayment = () => `QBO-BILLPAY-STUB-${(qboSeq += 1)}`;
// Carrier deep links + a derived (mock) live status for the active leg
export const trackingUrl = (carrier: string, tracking: string) => carrier.startsWith('FedEx') ? `https://www.fedex.com/fedextrack/?trknbr=${tracking}` : carrier.startsWith('UPS') ? `https://www.ups.com/track?tracknum=${tracking}` : `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
export const trackingStatus = (w: Swo, direction: 'outbound' | 'return'): { text: string; live: boolean } => { const bs = baseStage(w.stage); const eta = w.predictedCompletion ? fmtMD(w.predictedCompletion) : '—'; if (direction === 'outbound') { if (bs === 'queue') return { text: 'label not created', live: false }; if (bs === 'sent') return { text: `In transit to vendor · carrier ETA ${fmtMD(new Date(new Date(w.sentAt ?? w.createdAt).getTime() + shipDaysFor(vendorOf(w)) * DAY).toISOString())}`, live: true }; return { text: `Delivered to vendor${w.atVendorAt ? ` ${fmtMD(w.atVendorAt)}` : ''}`, live: false }; } if (bs === 'inbound') return { text: `In transit to shop · carrier ETA ${eta}`, live: true }; if (['received', 'inspection', 'fulfilled'].includes(bs)) return { text: `Delivered to shop${w.receivedAt ? ` ${fmtMD(w.receivedAt)}` : ''}`, live: false }; return { text: 'pre-queued · not yet shipped', live: false }; };
export const qboState = (w: Swo): { text: string; tone: 'ok' | 'muted' | 'warn' } => { const inv = w.invoices; if (!inv.length) return { text: 'no vendor invoice yet', tone: 'muted' }; const paid = inv.filter((i) => i.paid); const failed = inv.find((i) => !i.qboBillId); if (failed) return { text: `not synced — retry (inv ${failed.number})`, tone: 'warn' }; if (paid.length) return { text: `Bill ${paid[0].qboBillId} · paid ${fmtMD(paid[0].paid!.at)}${inv.length > 1 ? ` · +${inv.length - 1} more` : ''}`, tone: 'ok' }; return { text: `Bill ${inv[0].qboBillId} · unpaid`, tone: 'muted' }; };
import { flagToHitlist, markMessageDone, inboxRowsFor } from './hitlist';
import type { PartsRequest } from './types';

const DAY = 86_400_000; const today = () => new Date().toISOString().slice(0, 10);
const days = (a: string, bb: string) => Math.round((new Date(a).getTime() - new Date(bb).getTime()) / DAY);
const fmtMD = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const COMP: Record<string, string> = { head: 'Head', band: 'Band', case: 'Case', dial: 'Dial', movement: 'Movement' };
const resolve = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 30));
const vendorOf = (w: Swo) => b.vendors().find((v) => v.id === w.vendorId)!;
const back = (w: Swo) => ['received', 'inspection', 'fulfilled'].includes(w.stage) || w.stage === 'redo_received';

// ---- Health (per card, derived) ----
export type SwoHealth = 'fulfilled' | 'returning' | 'breach' | 'delayed' | 'at_risk' | 'on_track' | 'queued' | 'inspection';
export interface SwoHealthView { health: SwoHealth; label: string; tone: 'ok' | 'amber' | 'red' | 'dark' | 'muted'; daysLate: number; eta?: string; reason?: string; parentTarget?: string; parentVariance?: number }
export const swoHealth = (w: Swo): SwoHealthView => {
  const v = vendorOf(w); const exp = w.predictedCompletion ?? today(); const daysLate = Math.max(0, days(today(), exp)); const parentTarget = b.jobTarget(w.jobId); const parentVariance = parentTarget ? days(today(), parentTarget) : undefined;
  const parts = partsWait(w);
  if (w.stage === 'fulfilled') return { health: 'fulfilled', label: 'Fulfilled', tone: 'muted', daysLate: 0 };
  if (w.stage === 'queue') return { health: 'queued', label: 'In queue', tone: 'muted', daysLate: 0, parentTarget, parentVariance };
  if (back(w)) return { health: 'inspection', label: w.stage === 'redo_received' ? 'Back from redo' : 'Back at shop', tone: 'ok', daysLate: 0, parentTarget, parentVariance };
  if (parentTarget && parentTarget < today()) return { health: 'breach', label: `BREACH · promised ${fmtMD(parentTarget)} · ${parentVariance} days late`, tone: 'dark', daysLate, parentTarget, parentVariance, reason: parts?.reason };
  if (exp < today()) return { health: 'delayed', label: `Delayed · ${daysLate}d past ${fmtMD(exp)}`, tone: 'red', daysLate, parentTarget, parentVariance, reason: parts?.reason };
  if (baseStage(w.stage) === 'inbound') return { health: 'returning', label: `Returning · ETA ${fmtMD(exp)}${w.returnLabel ? ` · ${w.returnLabel.carrier} ${w.returnLabel.tracking}` : ''}`, tone: 'ok', daysLate: 0, eta: exp, parentTarget, parentVariance };
  const soon = days(exp, today()) <= 2;
  // shipped too late: can no longer make the parent date even if the vendor is on time
  const tooLate = !!parentTarget && !!w.sentAt && new Date(w.sentAt).getTime() > new Date(parentTarget).getTime() - ((v.leadTimeDays ?? 10) + shipDaysFor(v)) * DAY;
  if (soon || tooLate || parts) return { health: 'at_risk', label: parts ? `At risk · ${parts.label}` : tooLate ? `At risk · shipped too late for parent ${fmtMD(parentTarget!)}` : `At risk · due ${fmtMD(exp)}`, tone: 'amber', daysLate: 0, parentTarget, parentVariance, reason: parts?.reason ?? (tooLate ? 'shipped too late' : 'due within 2 days') };
  return { health: 'on_track', label: `On track · due ${fmtMD(exp)}`, tone: 'ok', daysLate: 0, parentTarget, parentVariance };
};

// ---- Component-wait chip on the PARENT job (assembly-style blocker) ----
export interface ComponentWait { swoId: string; swoNumber: string; label: string; tone: SwoHealthView['tone']; health: SwoHealth; vendor: string; pointPerson?: string }
export const componentWaitsSync = (jobId: string): ComponentWait[] => { b.seed(); return b.swos().filter((w) => !w.synth && w.jobId === jobId && w.stage !== 'fulfilled').map((w) => { const v = vendorOf(w); const h = swoHealth(w); const comp = w.components.map((c) => COMP[c] ?? c).join(' + '); return { swoId: w.id, swoNumber: w.number, label: `${comp} @ ${v.name.replace(' (CM)', '')} · ${w.stage === 'queue' ? 'queued' : h.health === 'on_track' || h.health === 'returning' ? `due ${fmtMD(w.predictedCompletion ?? today())} · ${h.health === 'returning' ? 'returning' : 'on track'}` : h.health === 'at_risk' ? `due ${fmtMD(w.predictedCompletion ?? today())} · at risk${h.reason ? ` (${h.reason})` : ''}` : h.health === 'delayed' ? `delayed ${h.daysLate}d` : h.health === 'breach' ? `BREACH · client date passed` : 'back at shop'}${w.redoCycles.length ? ` · redo ×${w.redoCycles.length}` : ''}`, tone: h.tone, health: h.health, vendor: v.name, pointPerson: w.pointPerson }; }); };
export const jobAtRisk = (jobId: string) => componentWaitsSync(jobId).some((c) => ['at_risk', 'delayed', 'breach'].includes(c.health));

// ---- Escalation ladder: 7 d → point person · 14 d → VC · 30 d → MH ----
export const escalationLevel = (w: Swo): { level: 0 | 1 | 2 | 3; to?: string; label?: string } => { const h = swoHealth(w); if (!['delayed', 'breach'].includes(h.health) || w.vendorReplies.some((r) => r.newExpectedAt && r.newExpectedAt >= today())) return { level: 0 }; const d = h.daysLate; const pp = w.pointPerson ?? 'Vienna'; const l2 = managerShortOf(pp) ?? 'Vienna'; if (d >= 30) return { level: 3, to: 'MH', label: `Escalated to MH · ${d}d past expected` }; if (d >= 14) return { level: 2, to: l2 === 'MH' ? 'MH' : l2, label: `Escalated to ${l2 === 'Vienna' ? 'VC' : l2} · ${d}d past expected` }; if (d >= 7) return { level: 1, to: pp, label: `With point person · ${d}d past expected` }; return { level: 0 }; };

// ---- Alerts (inbox items) — idempotent per (swo, kind); cleared when Received / Fulfilled or a vendor reply resets the math ----
const alertId = (w: Swo, kind: string) => `ib-swo-${w.id}-${kind}`;
export const syncConciergeAlerts = () => {
  b.seed(); const rows = inboxRowsFor();
  for (const w of b.swos()) {
    const v = vendorOf(w); const j = b.job(w.jobId); const h = swoHealth(w); const comp = w.components.map((c) => COMP[c] ?? c).join(' + '); const pp = w.pointPerson ?? 'Vienna'; const assignee = j?.assignees[0];
    const want: { kind: string; to: string; text: string }[] = [];
    if (h.health === 'at_risk' || h.health === 'delayed' || h.health === 'breach') { const msg = `${comp} @ ${v.name} is ${h.health === 'at_risk' ? 'at risk' : h.health === 'delayed' ? 'delayed' : 'past the CLIENT date (BREACH)'} — parent job ${j?.number.replace(/^E/, '') ?? ''} due ${b.jobTarget(w.jobId) ? fmtMD(b.jobTarget(w.jobId)!) : '—'}${h.reason ? ` · ${h.reason}` : ''}`; want.push({ kind: `risk-${pp}`, to: pp, text: msg }); if (assignee && assignee !== pp) want.push({ kind: `risk-${assignee}`, to: assignee, text: msg }); }
    if (h.health === 'breach') want.push({ kind: 'breach-Vienna', to: 'Vienna', text: `BREACH · ${w.number} · ${comp} @ ${v.name} — client promised ${fmtMD(h.parentTarget!)} (${h.parentVariance}d late). Send status request / reschedule client from the card.` });
    const esc = escalationLevel(w); if (esc.level && esc.to) want.push({ kind: `esc-${esc.level}`, to: esc.to, text: `${esc.label} · ${w.number} · ${comp} @ ${v.name} · closes only on a logged vendor reply or the Received scan` });
    for (const a of want) { const id = alertId(w, a.kind); if (!rows.some((r) => r.id === id)) { flagToHitlist({ id, to: { type: 'user', shortName: a.to }, text: a.text, jobId: w.jobId, from: 'Concierge', kind: 'message' }); } }
    const active = new Set(want.map((a) => alertId(w, a.kind))); rows.filter((r) => r.id.startsWith(`ib-swo-${w.id}-`) && !active.has(r.id) && !r.doneAt).forEach((r) => { void markMessageDone(r.id, 'Concierge'); });
  }
};

// ---- Vendor invoices + Paid (no bare toggle) ----
export interface InvoiceInput { number: string; vendorRef?: string; amount: number; date: string; attachment?: string; charge?: 'work' | 'redo'; force?: boolean }
export interface DuplicateHit { hard: boolean; message: string; swoId: string }
export const duplicateCheck = (vendorId: string, inp: InvoiceInput, excludeSwoId?: string): DuplicateHit | null => {
  for (const w of b.swos().filter((x) => x.vendorId === vendorId)) for (const i of w.invoices) {
    if (i.number.trim().toLowerCase() === inp.number.trim().toLowerCase()) return { hard: true, swoId: w.id, message: `Already on ${w.number}${i.paid ? `, paid ${fmtMD(i.paid.at)} by ${i.paid.by}, ${i.paid.method} ref ${i.paid.ourRef}` : ' (unpaid)'}` };
    if (w.id !== excludeSwoId && Math.abs(i.amount - inp.amount) < 0.005 && Math.abs(days(i.date, inp.date)) <= 7) return { hard: false, swoId: w.id, message: `Looks like a duplicate — same vendor, ${inp.amount.toFixed(2)} within 7 days of ${w.number} inv ${i.number}. Continue?` };
  }
  return null;
};
export async function addVendorInvoice(swoId: string, inp: InvoiceInput): Promise<SwoWithRefs> {
  const w = b.swos().find((x) => x.id === swoId)!; if (!inp.number.trim()) throw new Error('Vendor invoice number is required'); if (!(inp.amount > 0)) throw new Error('Amount must be above zero');
  const dup = duplicateCheck(w.vendorId, inp); if (dup && (dup.hard || !inp.force)) { const e = new Error(dup.message) as Error & { dup: DuplicateHit }; e.dup = dup; throw e; }
  const a = b.actor(); const inv: VendorInvoice = { id: b.newId('vi'), number: inp.number.trim(), vendorRef: inp.vendorRef?.trim() || undefined, amount: inp.amount, date: inp.date, attachment: inp.attachment, charge: inp.charge ?? (isRedoStage(w.stage) || w.redoCycles.length ? 'redo' : 'work'), enteredBy: a.by, enteredAt: new Date().toISOString() };
  inv.qboBillId = qboBill(); w.qboBillId ??= inv.qboBillId; w.qboStatus = 'queued'; const v = vendorOf(w); b.qboLog(`Vendor bill created on invoice save · DocNumber ${inv.number} · PrivateNote "${w.number}" · ${v.name} · ${inv.amount.toFixed(2)} → ${inv.qboBillId} (stub, unpaid)`);
  w.invoices.push(inv); w.vendorInvoiceTotal = w.invoices.reduce((t, i) => t + i.amount, 0); w.vendorInvoiceNumber = w.invoices[0].number; b.stamp(w, `Vendor invoice ${inv.number} · ${inv.amount.toFixed(2)}${inv.vendorRef ? ` · their ref ${inv.vendorRef}` : ''}${inv.charge === 'redo' ? ' · redo charge (second line, same SWO)' : ''} · QBO ${inv.qboBillId} (unpaid)`); return resolve(b.refs(w));
}
export interface PayInput { method: PayMethod; ourRef: string; overrideReason?: string }
export async function markInvoicePaid(swoId: string, invoiceId: string, p: PayInput): Promise<SwoWithRefs> {
  const w = b.swos().find((x) => x.id === swoId)!; const inv = w.invoices.find((i) => i.id === invoiceId); if (!inv) throw new Error('Invoice not found'); if (!p.ourRef.trim()) throw new Error('Our payment reference is required'); if (inv.paid) throw new Error(`Already paid ${fmtMD(inv.paid.at)} · ${inv.paid.method} ref ${inv.paid.ourRef}`);
  const prior = w.invoices.find((i) => i.paid && i.id !== invoiceId);
  if (prior && (w.redoCycles.length || isRedoStage(w.stage))) { if (!p.overrideReason?.trim()) throw new Error(`Already paid ${fmtMD(prior.paid!.at)}, ${prior.paid!.method} ref ${prior.paid!.ourRef} — this is a redo, no new payment due. Manager override with a reason creates a second invoice line, never re-marks the first.`); b.managerOnly(); }
  const a = b.actor(); inv.paid = { at: new Date().toISOString(), method: p.method, ourRef: p.ourRef.trim(), by: a.by, overrideReason: p.overrideReason?.trim() || undefined }; w.paid = true; w.paidAt = inv.paid.at; w.paidBy = a.by;
  const v = vendorOf(w); inv.qboBillId ??= qboBill(); inv.qboBillPaymentId = qboBillPayment(); w.qboBillId ??= inv.qboBillId; w.qboStatus = 'queued'; const q = { billId: inv.qboBillId, billPaymentId: inv.qboBillPaymentId };
  b.qboLog(`BillPayment · Bill ${q.billId} (DocNumber ${inv.number}) · PrivateNote "${w.number} · our ref ${inv.paid.ourRef}" · ${v.name} · ${inv.amount.toFixed(2)} → ${q.billPaymentId} (stub)`);
  b.stamp(w, `Marked PAID · inv ${inv.number} · ${inv.amount.toFixed(2)} · ${p.method} ref ${inv.paid.ourRef}${!back(w) ? ' (before receipt — prepay exposure)' : ''}${p.overrideReason ? ` · MANAGER OVERRIDE: ${p.overrideReason}` : ''} · QBO ${q.billId}`); b.audit(`${w.number} paid · inv ${inv.number} · ${p.method} ${inv.paid.ourRef}${p.overrideReason ? ` · override: ${p.overrideReason}` : ''}`); return resolve(b.refs(w));
}
export const paidChip = (w: Swo): { kind: 'paid' | 'unpaid' | 'none'; text: string } => { const paid = w.invoices.find((i) => i.paid); if (paid) return { kind: 'paid', text: `Paid ${fmtMD(paid.paid!.at)} · inv ${paid.number}` }; const inv = w.invoices[0]; if (inv) return { kind: 'unpaid', text: `Unpaid · inv ${inv.number}` }; return { kind: 'none', text: '' }; };

// ---- Redo ----
export async function startRedo(swoId: string, reason: string, photo?: string): Promise<SwoWithRefs> {
  const w = b.swos().find((x) => x.id === swoId)!; if (w.stage !== 'inspection') throw new Error('Redo starts from Inspection (failed check)'); if (!reason.trim()) throw new Error('What failed? A reason is required — it goes to the vendor in the outbound email');
  const v = vendorOf(w); const a = b.actor(); const n = w.redoCycles.length + 1; w.redoCycles.push({ n, reason: reason.trim(), photo, startedAt: new Date().toISOString(), by: a.by });
  w.stage = v.ships === false ? 'redo_at_vendor' : 'redo_sent'; w.stageAt = new Date().toISOString(); w.predictedCompletion = defaultExpectedAt(v);
  if (v.ships === false) b.custody(w, `vendor:${w.vendorId}`, `Redo hand-off to ${v.name} · ${w.number}`); else { w.outbound = { direction: 'outbound', carrier: isInternationalVendor(v) ? 'DHL Express' : 'FedEx', service: isInternationalVendor(v) ? 'Express Worldwide' : 'Priority Overnight', tracking: `${isInternationalVendor(v) ? 'JD' : '7'}${Math.floor(Math.random() * 9e9).toString().padStart(10, '0')}`, international: isInternationalVendor(v), customs: w.outbound?.customs, cost: w.outbound?.cost ?? 62.4, createdAt: new Date().toISOString(), createdBy: a.by, emailedAt: new Date().toISOString() }; b.custody(w, `vendor:${w.vendorId}`, `Redo ×${n} out to ${v.name} · ${w.number}`); }
  b.stamp(w, `Redo ×${n} — inspection failed: ${reason.trim()} · ${v.ships === false ? 'handed back to' : `outbound label + email to`} ${v.name}${w.paid ? ' · already PAID — no new payment due' : ''} · new expected ${w.predictedCompletion}`); b.audit(`${w.number} redo ×${n} · ${reason.trim()}`); b.jobStamp(w.jobId, `Outsourced ${w.components.join('+')} returned to ${v.name} for redo ×${n} — ${reason.trim()}`); return resolve(b.refs(w));
}

// ---- Point person / expected date edits (logged) ----
export async function setPointPerson(swoId: string, shortName: string): Promise<SwoWithRefs> { const w = b.swos().find((x) => x.id === swoId)!; const from = w.pointPerson; w.pointPerson = shortName; b.stamp(w, `Point person ${from ?? '—'} → ${shortName}`); b.audit(`${w.number} point person ${from ?? '—'} → ${shortName}`); return resolve(b.refs(w)); }
export async function setExpectedAt(swoId: string, date: string, reason?: string): Promise<SwoWithRefs> { const w = b.swos().find((x) => x.id === swoId)!; if (!date) throw new Error('Pick a date'); const from = w.predictedCompletion; w.predictedCompletion = date; b.stamp(w, `Expected ${from ?? '—'} → ${date}${reason ? ` · ${reason}` : ''}`); b.audit(`${w.number} expected ${from ?? '—'} → ${date}${reason ? ` · ${reason}` : ''}`); return resolve(b.refs(w)); }

// ---- Chase: status request email (repeat every 7 d until a vendor reply), vendor reply, reschedule client ----
export const statusRequestDue = (w: Swo) => { const last = w.statusRequests[0]?.at; const h = swoHealth(w); return ['delayed', 'breach'].includes(h.health) && !w.vendorReplies.some((r) => r.newExpectedAt && r.newExpectedAt >= today()) && (!last || days(today(), last.slice(0, 10)) >= 7); };
export async function sendVendorStatusRequest(swoId: string): Promise<SwoWithRefs> { const w = b.swos().find((x) => x.id === swoId)!; const v = vendorOf(w); const j = b.job(w.jobId); const h = swoHealth(w); const a = b.actor(); const level = escalationLevel(w).level; w.statusRequests.unshift({ at: new Date().toISOString(), by: a.by, level: String(level) }); b.stamp(w, `Status request emailed to ${v.name} (${v.email}) — job ref ${j?.number.replace(/^E/, '')} · waiting on ${w.components.join('+')} · promised ${w.predictedCompletion ?? '—'} · ${h.daysLate} days overdue${level ? ` · escalation L${level}` : ''}`); b.audit(`${w.number} status request → ${v.name} · ${h.daysLate}d overdue`); return resolve(b.refs(w)); }
export async function logVendorReply(swoId: string, text: string, newExpectedAt?: string): Promise<SwoWithRefs> { const w = b.swos().find((x) => x.id === swoId)!; if (!text.trim()) throw new Error('Write what the vendor said'); const a = b.actor(); w.vendorReplies.unshift({ at: new Date().toISOString(), by: a.by, text: text.trim(), newExpectedAt }); if (newExpectedAt) { const from = w.predictedCompletion; w.predictedCompletion = newExpectedAt; b.stamp(w, `Vendor reply · "${text.trim()}" · new promised date ${from ?? '—'} → ${newExpectedAt} (resets at-risk / delayed math)`); } else b.stamp(w, `Vendor reply · "${text.trim()}"`); b.audit(`${w.number} vendor reply logged${newExpectedAt ? ` · new date ${newExpectedAt}` : ''}`); syncConciergeAlerts(); return resolve(b.refs(w)); }
export async function rescheduleParentClient(swoId: string, newDate: string, via: 'call' | 'email'): Promise<SwoWithRefs> { const w = b.swos().find((x) => x.id === swoId)!; const v = vendorOf(w); const j = b.job(w.jobId); if (!j) throw new Error('Parent job missing'); if (!newDate) throw new Error('Pick the new client date'); const from = b.jobTarget(j.id); j.targetDate = newDate; b.jobStamp(j.id, `Promise date ${from ?? '—'} → ${newDate} · reason: vendor delay – ${v.name} · client told by ${via}`); b.stamp(w, `Client rescheduled ${from ?? '—'} → ${newDate} (${via}) · reason vendor delay – ${v.name}`); b.audit(`${j.number} promise-date change ${from ?? '—'} → ${newDate} · vendor delay – ${v.name}`); syncConciergeAlerts(); return resolve(b.refs(w)); }

// ---- Outstanding (prepay exposure): paid but not Received, sorted by days since payment ----
export interface OutstandingRow { swo: SwoWithRefs; paidAt: string; daysSincePaid: number; amount: number; parentTarget?: string; variance?: number; health: SwoHealthView }
export async function getVendorOutstanding(vendorId: string): Promise<OutstandingRow[]> { b.seed(); return resolve(b.swos().filter((w) => w.vendorId === vendorId && w.paid && !back(w) && w.stage !== 'fulfilled').map((w) => { const paidAt = w.invoices.find((i) => i.paid)?.paid?.at ?? w.paidAt ?? w.createdAt; const t = b.jobTarget(w.jobId); return { swo: b.refs(w), paidAt, daysSincePaid: days(today(), paidAt.slice(0, 10)), amount: swoPaidTotal(w), parentTarget: t, variance: t ? days(today(), t) : undefined, health: swoHealth(w) }; }).sort((x, y) => y.daysSincePaid - x.daysSincePaid)); }

// ---- Vendor parts requests — same chain as the bench; only the fulfilment destination differs ----
export const partsWait = (w: Swo): { label: string; reason: string } | null => { const open = b.partsRequests().filter((r) => r.swoId === w.id && ['pending', 'pending_review', 'awaiting_client', 'approved', 'on_order'].includes(r.status)); if (!open.length) return null; const n = open.reduce((t, r) => t + (r.items?.length ?? 1), 0); const st = open.some((r) => r.status === 'on_order') ? 'on order' : open.some((r) => r.status === 'approved') ? 'approved · to pick' : 'awaiting client'; return { label: `${n} part${n === 1 ? '' : 's'} · ${st}`, reason: `parts wait — ${st}` }; };
export async function requestVendorParts(swoId: string, description: string, qty: number, reason: string): Promise<PartsRequest> {
  const w = b.swos().find((x) => x.id === swoId)!; const v = vendorOf(w); if (!description.trim()) throw new Error('Describe the part'); if (qty < 1) throw new Error('Quantity must be at least 1'); const a = b.actor(); const j = b.job(w.jobId)!;
  const r: PartsRequest = { id: b.newId('pr'), number: b.nextPrNumber(), jobId: w.jobId, status: 'pending', qty, note: reason.trim() || undefined, items: [{ description: description.trim(), qty }], searchTerms: [description.trim()], chat: [], requestedBy: a.by, requestedAt: new Date().toISOString(), station: a.station, source: `vendor:${v.name}`, swoId: w.id };
  b.partsRequests().unshift(r); b.partsStamp(r, `requested by ${a.by} for vendor ${v.name} · ${w.number} · ${description.trim()} ×${qty}${reason ? ` · ${reason.trim()}` : ''} · fulfilment → ${v.ships === false ? 'hand to' : 'ship to'} ${v.name}`); b.jobStamp(j.id, `Parts request ${r.number} for ${v.name} (${w.number}) · ${description.trim()} ×${qty}`); b.stamp(w, `Parts request ${r.number} · ${description.trim()} ×${qty} → estimate addendum → client approval → pick ticket "for: ${v.name} · ${w.number}"`);
  return resolve(r);
}
export const swoPartsRequests = (swoId: string) => b.partsRequests().filter((r) => r.swoId === swoId);
export const conciergeStaff = () => b.users().filter((u) => u.accessTier === 'manager' || u.accessTier === 'supervisor' || u.roles.includes('concierge'));
export { swoStageLabel, nextSwoStage };
