import type { BandMaterial, BandType, BraceletConfig, DeptCode, JobType, RateCardRow, RateMatch, RequestLine } from './types';

// PORTAL REQUEST BUILDER rules (MH 2026-10-02). Pure helpers + the rate card store — no store access, so client.ts can import it.
// Quote key = `<ref | BAND>-<legs> · <material> · <type> · <construction>` — the ONE key the rate card, the request line and the estimate line share.
export const JOB_TYPES: { key: JobType; label: string; dept?: DeptCode; kinds: ('watch' | 'band')[]; hint: string }[] = [
  { key: 'movement', label: 'Movement', dept: 'W', kinds: ['watch'], hint: 'service · timing · water resistance' },
  { key: 'case', label: 'Case', dept: 'P', kinds: ['watch'], hint: 'refinish · dents · crystal' },
  { key: 'band', label: 'Band', dept: 'B', kinds: ['watch', 'band'], hint: 'links · pins · clasp · stretch' },
  { key: 'bezel', label: 'Bezel', dept: 'P', kinds: ['watch'], hint: 'recut · insert · refinish' },
  { key: 'polish', label: 'Polish', dept: 'P', kinds: ['band'], hint: 'band refinish only' },
  { key: 'other', label: 'Other', kinds: ['watch', 'band'], hint: 'describe it below — we quote by estimate' },
];
export const MATERIALS: { key: BandMaterial; label: string }[] = [{ key: 'SS', label: 'Steel' }, { key: 'TT', label: 'Two-tone' }, { key: 'YG', label: 'Yellow gold' }, { key: 'WG', label: 'White gold' }, { key: 'RG', label: 'Rose gold' }, { key: 'PT', label: 'Platinum' }];
export const BAND_TYPES: BandType[] = ['Oyster', 'Jubilee', 'President', 'Pearlmaster', 'Leather', 'Rubber'];
// Type → construction cascade (Jubilee: Folded / Oval / D-link / Solid — MH)
export const CONSTRUCTIONS: Record<BandType, string[]> = { Oyster: ['Hollow', 'Folded', 'Solid'], Jubilee: ['Folded', 'Oval', 'D-link', 'Solid'], President: ['Hollow', 'Solid'], Pearlmaster: ['Solid'], Leather: [], Rubber: [] };
export const PRE_APPROVALS = ['Add links as needed', 'Replace pins / tubes as needed', 'Replace clasp spring', 'Replace crystal if scratched'];
export const WAIVERS = ['Dial & hands — do not touch', 'No case refinish', 'Return all replaced parts'];
const LEG_ORDER: DeptCode[] = ['W', 'B', 'P', 'PM'];
export const sortLegs = (legs: DeptCode[]) => Array.from(new Set(legs)).sort((a, b) => LEG_ORDER.indexOf(a) - LEG_ORDER.indexOf(b));
export const legsForJobTypes = (jobTypes: JobType[]) => sortLegs(jobTypes.flatMap((j) => { const d = JOB_TYPES.find((x) => x.key === j)?.dept; return d ? [d] : []; }));
export const hasBand = (l: Pick<RequestLine, 'kind' | 'legs'>) => l.kind === 'band' || l.legs.includes('B');
export const braceletKey = (b?: BraceletConfig) => [b?.material, b?.type, b?.construction].filter(Boolean).join(' · ');
export const quoteKeyFor = (l: Pick<RequestLine, 'kind' | 'legs' | 'ref' | 'bracelet'>) => { const head = `${l.ref?.trim().toUpperCase() || (l.kind === 'band' ? 'BAND' : '—')}-${l.legs.join('') || '?'}`; const b = hasBand(l) ? braceletKey(l.bracelet) : ''; return b ? `${head} · ${b}` : head; };
export const rowKey = (r: RateCardRow) => quoteKeyFor({ kind: r.ref === 'BAND' ? 'band' : 'watch', legs: sortLegs(r.legs), ref: r.ref, bracelet: { material: r.material, type: r.type, construction: r.construction } });
export const parseQuoteKey = (key: string): Partial<RateCardRow> => { const [head, ...rest] = key.split('·').map((s) => s.trim()); const m = /^([^-\s]+)-([WBPM]+)$/.exec(head ?? ''); const legs = m ? ((m[2].match(/PM|W|B|P/g) ?? []) as DeptCode[]) : []; const [material, type, construction] = rest; return { ref: m?.[1], legs: sortLegs(legs), material: material as BandMaterial | undefined, type: type as BandType | undefined, construction }; };
export const rateAmount = (m?: RateMatch) => m?.price ?? m?.priceLow ?? 0;
export const rateLabel = (m?: RateMatch | RateCardRow) => (!m ? '—' : m.price !== undefined ? `$${m.price.toLocaleString()}` : m.priceLow !== undefined ? `$${m.priceLow.toLocaleString()}–$${(m.priceHigh ?? m.priceLow).toLocaleString()}` : '—');
// Group label 1/5 … 5/5 — duplicates share a groupId; numbering follows list order
export const groupLabels = (lines: RequestLine[]): Record<string, string> => { const out: Record<string, string> = {}; const groups = new Map<string, string[]>(); lines.forEach((l) => { if (l.groupId) (groups.get(l.groupId) ?? groups.set(l.groupId, []).get(l.groupId)!).push(l.id); }); groups.forEach((ids) => { if (ids.length > 1) ids.forEach((id, i) => { out[id] = `${i + 1}/${ids.length}`; }); }); return out; };

// ---- Rate card (Setup → Rate card; owner / manager edit; seeds so the acceptance keys resolve) ----
const seed = (id: string, ref: string, legs: DeptCode[], days: number, price: number | [number, number], b: Partial<BraceletConfig> = {}): RateCardRow => ({ id, ref, legs, days, ...(Array.isArray(price) ? { priceLow: price[0], priceHigh: price[1] } : { price }), material: b.material, type: b.type, construction: b.construction, version: 1, editedBy: 'MH', editedAt: '2026-09-15T14:00:00.000Z', active: true });
const rows: RateCardRow[] = [
  seed('rc-01', '16233', ['W'], 21, 1100), seed('rc-02', '16233', ['W', 'B', 'P'], 28, 1650, { material: 'TT', type: 'Jubilee', construction: 'Folded' }), seed('rc-03', '16233', ['P'], 10, 340), seed('rc-04', '16233', ['B'], 10, 380, { material: 'TT', type: 'Jubilee', construction: 'Folded' }), seed('rc-05', '16233', ['W', 'P'], 24, 1380),
  seed('rc-06', '16610', ['W'], 21, 1050), seed('rc-07', '16610', ['W', 'P'], 24, 1350), seed('rc-08', '16610', ['B'], 7, 260, { material: 'SS', type: 'Oyster', construction: 'Solid' }), seed('rc-09', '126610LN', ['W'], 21, 1250), seed('rc-10', '116520', ['W'], 28, 1450), seed('rc-11', '1675', ['W'], 35, [1500, 1900]), seed('rc-12', '124300', ['W'], 18, 950), seed('rc-13', 'M79030B-0001', ['W'], 18, 780),
  seed('rc-14', 'BAND', ['B'], 7, 240, { material: 'SS', type: 'Oyster', construction: 'Hollow' }), seed('rc-15', 'BAND', ['B'], 7, 280, { material: 'SS', type: 'Oyster', construction: 'Solid' }), seed('rc-16', 'BAND', ['B'], 10, 360, { material: 'TT', type: 'Jubilee', construction: 'Folded' }), seed('rc-17', 'BAND', ['B', 'P'], 10, 420, { material: 'SS', type: 'Oyster', construction: 'Solid' }), seed('rc-18', 'BAND', ['B'], 14, 520, { material: 'YG', type: 'President', construction: 'Solid' }),
];
export const getRateCardSync = () => rows.map((r) => ({ ...r }));
export async function getRateCard(): Promise<RateCardRow[]> { return getRateCardSync(); }
export interface RateRowInput { id?: string; ref: string; legs: DeptCode[]; material?: BandMaterial; type?: BandType; construction?: string; price?: number; priceLow?: number; priceHigh?: number; days: number; active?: boolean }
export async function saveRateRow(input: RateRowInput, by: string): Promise<RateCardRow> {
  const ref = input.ref.trim().toUpperCase(); if (!ref) throw new Error('Reference (or BAND) is required'); if (!input.legs.length) throw new Error('Pick at least one leg'); if (input.price === undefined && input.priceLow === undefined) throw new Error('Price or a range is required'); if (!input.days) throw new Error('Typical days is required');
  const at = new Date().toISOString(); const legs = sortLegs(input.legs);
  const existing = input.id ? rows.find((r) => r.id === input.id) : undefined;
  if (existing) { Object.assign(existing, { ref, legs, material: input.material, type: input.type, construction: input.construction || undefined, price: input.price, priceLow: input.priceLow, priceHigh: input.priceHigh, days: input.days, active: input.active ?? existing.active, version: existing.version + 1, editedBy: by, editedAt: at }); return { ...existing }; }
  const dup = rows.find((r) => r.active && rowKey(r) === rowKey({ ...input, ref, legs, version: 0, editedBy: by, editedAt: at, active: true, id: '' } as RateCardRow)); if (dup) throw new Error(`A rate already exists for ${rowKey(dup)} — edit that row`);
  const r: RateCardRow = { id: `rc-${Date.now().toString(36)}`, ref, legs, material: input.material, type: input.type, construction: input.construction || undefined, price: input.price, priceLow: input.priceLow, priceHigh: input.priceHigh, days: input.days, version: 1, editedBy: by, editedAt: at, active: input.active ?? true };
  rows.push(r); return { ...r };
}
// Resolve a line: exact ref first, BAND rows for band lines; a row's blank bracelet fields are wildcards; the most specific row wins
export const matchRate = (l: Pick<RequestLine, 'kind' | 'legs' | 'ref' | 'bracelet'>): RateMatch | undefined => {
  const legs = sortLegs(l.legs).join(''); if (!legs) return undefined;
  const fits = (r: RateCardRow) => r.active && sortLegs(r.legs).join('') === legs && (!r.material || r.material === l.bracelet?.material) && (!r.type || r.type === l.bracelet?.type) && (!r.construction || r.construction === l.bracelet?.construction);
  const spec = (r: RateCardRow) => Number(!!r.material) + Number(!!r.type) + Number(!!r.construction);
  const ref = l.ref?.trim().toUpperCase(); const pool = rows.filter(fits).sort((a, b) => spec(b) - spec(a));
  const row = (ref ? pool.find((r) => r.ref === ref) : undefined) ?? (l.kind === 'band' ? pool.find((r) => r.ref === 'BAND') : undefined);
  return row ? { rowId: row.id, price: row.price, priceLow: row.priceLow, priceHigh: row.priceHigh, days: row.days, key: rowKey(row) } : undefined;
};
// Fill the derived fields on a line (legs · quote key · rate) — the one place the rules are applied
export const normaliseLine = (l: RequestLine): RequestLine => { const legs = legsForJobTypes(l.jobTypes); const base = { ...l, legs, bracelet: hasBand({ kind: l.kind, legs }) ? l.bracelet : undefined }; const quoteKey = quoteKeyFor(base); return { ...base, quoteKey, rate: matchRate(base) }; };
export const newLine = (kind: 'watch' | 'band', partial: Partial<RequestLine> = {}): RequestLine => normaliseLine({ id: `rl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, kind, jobTypes: kind === 'band' ? ['band'] : [], legs: [], quoteKey: '', ...partial });
