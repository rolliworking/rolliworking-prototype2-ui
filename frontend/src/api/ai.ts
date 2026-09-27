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
