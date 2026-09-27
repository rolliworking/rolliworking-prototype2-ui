// AI seam (Claude vision via the backend /api/ai/*) — the ONE file to swap. Every output is a SUGGESTION pending human verify (M3KE pattern).
import type { EvidenceSlot, ShipmentWithRefs, TimingPosition } from './types';

const BASE = import.meta.env.REACT_APP_BACKEND_URL as string;
export type SheetKind = Extract<EvidenceSlot, 'timing_sheet' | 'pressure_test'>;
export interface TimingExtraction { positions: Partial<Record<TimingPosition, { rate: number | null; beat: number | null; amp: number | null }>>; delta: number | null; reserve: number | null; caliber: string | null; confidence: number | null; notes?: string }
export interface PressureExtraction { depth: string | null; result: 'pass' | 'fail' | null; deflection: string | null; duration: string | null; tester: string | null; confidence: number | null; notes?: string }
export type SheetExtraction = { kind: 'timing_sheet'; fields: TimingExtraction; verifiedBy?: string; verifiedAt?: string } | { kind: 'pressure_test'; fields: PressureExtraction; verifiedBy?: string; verifiedAt?: string };

const post = async <T,>(path: string, body: unknown): Promise<T> => {
  const r = await fetch(`${BASE}/api/ai/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.text()) || `AI request failed (${r.status})`);
  return r.json() as Promise<T>;
};

// 1. Photo of a timing sheet / pressure-test result → structured numbers (suggest → verify, never auto-commit)
export async function extractEvidenceSheet(photoDataUrl: string, kind: SheetKind): Promise<SheetExtraction> {
  const mime = photoDataUrl.slice(5, photoDataUrl.indexOf(';')) || 'image/jpeg';
  const out = await post<{ fields: TimingExtraction | PressureExtraction }>('extract-sheet', { imageBase64: photoDataUrl, mime, kind });
  return { kind, fields: out.fields } as SheetExtraction;
}

// 2. Plain-English one-liner for the client from the job/shipment state — always a draft the staffer edits before copy/send
export async function draftClientStatusLine(s: ShipmentWithRefs, fallback: string): Promise<string> {
  try {
    const ctx = { watch: s.watch ? `${s.watch.brand} ${s.watch.model}` : undefined, stage: s.stage, carrier: s.carrier, service: s.service, lastEvent: s.lastEvent ? { status: s.lastEvent.status, location: s.lastEvent.location, at: s.lastEvent.at } : null, eta: s.eta, direction: s.direction, clientFirstName: s.client?.firstName };
    return (await post<{ text: string }>('status-line', { context: ctx })).text || fallback;
  } catch { return fallback; }
}

// 3. Carrier / Parcel Pro bill → line items. CSV/text parses locally (deterministic, no model); PDF/image goes to Claude. Both render for a human eye before matching.
import type { BillLine } from './types';
import { parseBillCsv } from './client';
export interface BillExtraction { lines: BillLine[]; source: 'csv' | 'claude'; carrier?: string; invoiceNumber?: string; confidence?: number | null; fileName: string }
const readAs = (file: File, mode: 'text' | 'dataUrl') => new Promise<string>((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error('Could not read file')); r.onload = () => res(String(r.result)); if (mode === 'text') r.readAsText(file); else r.readAsDataURL(file); });
export async function extractShippingBill(file: File): Promise<BillExtraction> {
  const isCsv = /\.(csv|txt)$/i.test(file.name) || file.type.includes('csv') || file.type.startsWith('text/');
  if (isCsv) { const text = await readAs(file, 'text'); return { lines: parseBillCsv(text), source: 'csv', fileName: file.name }; }
  const dataUrl = await readAs(file, 'dataUrl'); const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  const out = await post<{ lines: Partial<BillLine>[]; carrier?: string; invoiceNumber?: string; confidence?: number | null }>('extract-bill', { fileBase64: dataUrl, mime, fileName: file.name });
  const lines: BillLine[] = (out.lines ?? []).map((l, i) => ({ id: `bl-${i + 1}`, trackingNumber: String(l.trackingNumber ?? '').trim(), shipDate: String(l.shipDate ?? ''), service: String(l.service ?? ''), billed: Number(l.billed ?? 0), surcharges: (l.surcharges ?? []).map((s) => ({ kind: String(s.kind), amount: Number(s.amount) })).filter((s) => s.amount), declaredValue: l.declaredValue == null ? null : Number(l.declaredValue), carrier: out.carrier ?? undefined })).filter((l) => l.trackingNumber);
  return { lines, source: 'claude', carrier: out.carrier, invoiceNumber: out.invoiceNumber, confidence: out.confidence, fileName: file.name };
}

// 4. Filled "Inspection Scantron — Rolliworks v1.1" (photo/scan/PDF) → suggested form values. Green highlighter = selection, red ink = handwriting. Suggest → verify, never auto-commit.
export interface SheetSuggestionWire { components: Record<string, Record<string, unknown>>; bracelet: Record<string, Record<string, unknown>>; additionalNotes?: string | null; confidence?: number | null; raw?: string }
export async function extractInspectionSheet(file: File): Promise<SheetSuggestionWire> {
  const dataUrl = await readAs(file, 'dataUrl'); const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  return post<SheetSuggestionWire>('extract-inspection-sheet', { fileBase64: dataUrl, mime, fileName: file.name });
}

// 5. Client-update summary — TEMPLATE FILL, not prose. Claude returns discrete fields; the template below is assembled in code so the voice never drifts. Always a draft; never sent.
import type { JobSummaryContext } from './client';
export interface SummaryFields { job_status: string; per_component_status_line: string | null; target_date: string; variant: 'queue' | 'progress' | 'finished_qc' | 'approval' | 'parts' | 'hold' | 'ready' | string }
export const fillSummaryTemplate = (ctx: JobSummaryContext, f: SummaryFields): string => {
  const line2 = f.per_component_status_line?.trim(); const close = f.variant === 'ready' ? 'Let us know a good time for pickup or we can arrange return shipping.' : f.variant === 'approval' ? 'Once you approve the estimate we will get started right away.' : "We'll reach out if we need more time. Thanks for your patience!";
  return [`Hi ${ctx.clientFirstName}, wanted to give you a quick update — your job is currently ${f.job_status.trim().replace(/\.$/, '')}.`, line2 ? line2 : null, f.variant === 'ready' ? null : `Target completion date: ${f.target_date}.`, close].filter(Boolean).join('\n');
};
// Deterministic fallback when the model is unavailable — same template, rule-based fields
export const localSummaryFields = (ctx: JobSummaryContext): SummaryFields => {
  const target = ctx.dueAt ? new Date(ctx.dueAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'to be confirmed';
  const allDone = ctx.components.every((c) => c.partStatus === 'fulfilled' || c.plainLocation === 'finished'); const anyStarted = ctx.components.some((c) => c.partStatus === 'in_progress' || c.partStatus === 'waiting' || c.partStatus === 'reunited');
  const variant = ctx.status === 'ready_to_ship' ? 'ready' : ctx.openItems.some((o) => o.startsWith('on hold')) ? 'hold' : ctx.status === 'awaiting_customer_approval' ? 'approval' : ctx.openItems.some((o) => o.includes('on order')) ? 'parts' : ctx.status === 'testing' || ctx.components.some((c) => c.plainLocation.startsWith('in final')) ? 'finished_qc' : !anyStarted ? 'queue' : 'progress';
  const status = { ready: 'finished and ready', hold: 'on hold', approval: 'awaiting your approval', parts: 'waiting on a part we have ordered', finished_qc: 'in final assembly and quality control', queue: 'in queue, awaiting work to begin', progress: ctx.components.some((c) => c.plainLocation.includes('polish')) && ctx.components.length === 1 ? 'being polished and refinished' : 'in progress' }[variant];
  const done = ctx.components.filter((c) => c.plainLocation === 'finished').map((c) => c.part.toLowerCase()); const wip = ctx.components.filter((c) => c.plainLocation !== 'finished');
  const line = ctx.components.length > 1 && !allDone && done.length ? `The ${done.join(' and ')} ${done.length > 1 ? 'are' : 'is'} finished; the ${wip.map((c) => c.part.toLowerCase()).join(' and ')} ${wip.length > 1 ? 'are' : 'is'} still in progress.` : ctx.components.length > 1 && wip.some((c) => c.plainLocation.includes('polish')) ? `The ${wip.filter((c) => c.plainLocation.includes('polish')).map((c) => c.part.toLowerCase()).join(' and ')} is being polished and refinished; the rest is with the watchmaker.` : null;
  return { job_status: status, per_component_status_line: line, target_date: target, variant };
};
export async function draftJobSummary(ctx: JobSummaryContext): Promise<{ text: string; fields: SummaryFields; source: 'claude' | 'local' }> {
  try { const { fields } = await post<{ fields: SummaryFields }>('job-summary', { context: ctx }); if (!fields?.job_status) throw new Error('empty'); const f: SummaryFields = { ...fields, target_date: fields.target_date || 'to be confirmed' }; return { text: fillSummaryTemplate(ctx, f), fields: f, source: 'claude' }; }
  catch { const f = localSummaryFields(ctx); return { text: fillSummaryTemplate(ctx, f), fields: f, source: 'local' }; }
}
