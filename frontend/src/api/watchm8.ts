// watchm8 — the ONE seam between the public rolliworks.com flows (identify · check · bracelet · request) and the recognition engine.
// PROTOTYPE: every call here is a MOCK answered from the seeded refs / variant tables below (deterministic from the photo bytes), badged "mock" in the UI.
// KEEPER: swap the three engine functions for the real watchm8 API; keep the shapes.
import { sendSms } from './telephony';

export type Brand = 'Rolex' | 'Tudor' | 'Cellini';
export type ShotKey = 'dial' | 'bezel' | 'clasp' | 'endlinks' | 'caseback';
export interface ShotSpec { key: ShotKey; title: string; hint: string; overlay: 'circle' | 'ring' | 'rect' | 'wide' }
export const SHOTS: Record<ShotKey, ShotSpec> = {
  dial: { key: 'dial', title: 'Dial, straight on', hint: 'Fill the circle with the dial · no glare · crown on the right', overlay: 'circle' },
  bezel: { key: 'bezel', title: 'Bezel insert', hint: 'Tilt slightly so the numerals catch the light', overlay: 'ring' },
  clasp: { key: 'clasp', title: 'Clasp code', hint: 'Open the clasp · the stamped letters/numbers inside', overlay: 'rect' },
  endlinks: { key: 'endlinks', title: 'End links', hint: 'Where the bracelet meets the case, from the side', overlay: 'wide' },
  caseback: { key: 'caseback', title: 'Case back', hint: 'Flat, centred · any engraving legible', overlay: 'circle' },
};

export interface VariantEx { key: string; label: string; years: [number, number]; img: string; notes: string }
export interface BraceletOpt { code: string; name: string; img: string; years?: string }
export interface RefRow { ref: string; brand: Brand; model: string; years: [number, number]; blurb: string; typical: { low: number; high: number; days: number }; bracelets: BraceletOpt[]; dials: VariantEx[]; inserts: VariantEx[]; thumb: string; serialKind: 'letter' | 'numeric' | 'random' }

// Placeholder exemplar images — labelled so nobody mistakes them for photos
export const ph = (label: string, tone = '#2b2621') => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${tone}"/><circle cx="160" cy="112" r="70" fill="none" stroke="#c9b58a" stroke-width="6"/><circle cx="160" cy="112" r="52" fill="#15120f"/><text x="160" y="222" font-family="Helvetica,Arial" font-size="13" fill="#f3ead8" text-anchor="middle">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

export const REFS: RefRow[] = [
  { ref: '16233', brand: 'Rolex', model: 'Datejust 36', years: [1988, 2005], blurb: 'Two-tone Datejust with the sapphire crystal and quickset date — the everyday Rolex of the 1990s.', typical: { low: 950, high: 1450, days: 21 }, serialKind: 'letter', thumb: ph('16233 · Datejust 36 two-tone'),
    bracelets: [{ code: '62523H', name: 'Jubilee · two-tone', img: ph('Jubilee 62523H', '#3a2f22'), years: '1988–2005' }, { code: '78363', name: 'Oyster · two-tone', img: ph('Oyster 78363', '#3a2f22'), years: '1988–2005' }],
    dials: [{ key: 'champagne-stick', label: 'Champagne · stick indices', years: [1988, 2005], img: ph('Dial · champagne stick'), notes: 'Most common; tritium lume until ~1998, Luminova after.' }, { key: 'white-roman', label: 'White · Roman numerals', years: [1990, 2005], img: ph('Dial · white Roman'), notes: 'Printed Romans; check the 6 for the T SWISS T / SWISS MADE line.' }, { key: 'slate-diamond', label: 'Slate · diamond indices', years: [1992, 2005], img: ph('Dial · slate diamond'), notes: 'Factory diamonds sit in white-gold settings.' }],
    inserts: [{ key: 'fluted-yg', label: 'Fluted yellow-gold bezel', years: [1988, 2005], img: ph('Bezel · fluted YG'), notes: 'Fixed bezel — no insert to swap.' }] },
  { ref: '1675', brand: 'Rolex', model: 'GMT-Master', years: [1959, 1980], blurb: 'The Pan Am pilot’s watch: acrylic crystal, aluminium Pepsi insert, cal. 1565/1575.', typical: { low: 1200, high: 1900, days: 28 }, serialKind: 'numeric', thumb: ph('1675 · GMT-Master'),
    bracelets: [{ code: '7836', name: 'Jubilee · folded links', img: ph('Jubilee 7836', '#2a2a30'), years: '1966–1978' }, { code: '78360', name: 'Oyster · solid links', img: ph('Oyster 78360', '#2a2a30'), years: '1976–1980' }, { code: '6251H', name: 'Jubilee · early', img: ph('Jubilee 6251H', '#2a2a30'), years: '1959–1966' }],
    dials: [{ key: 'mk1-long-e', label: 'MK1 · Long E', years: [1967, 1970], img: ph('Dial · MK1 Long E'), notes: 'Elongated middle bar on the E of ROLEX.' }, { key: 'mk2-radial', label: 'MK2 · Radial', years: [1970, 1973], img: ph('Dial · MK2 Radial'), notes: 'Lume plots sit inside the minute track.' }, { key: 'mk5', label: 'MK5 · Maxi-ish', years: [1976, 1980], img: ph('Dial · MK5'), notes: 'Larger lume plots, late production.' }],
    inserts: [{ key: 'pepsi-fat-font', label: 'Pepsi · fat font', years: [1959, 1970], img: ph('Insert · Pepsi fat font'), notes: 'Wide, flat numerals; often faded to pink/blue.' }, { key: 'pepsi-thin-font', label: 'Pepsi · thin font', years: [1970, 1980], img: ph('Insert · Pepsi thin font'), notes: 'Narrower numerals, later aluminium.' }, { key: 'all-black', label: 'All black', years: [1970, 1980], img: ph('Insert · all black'), notes: 'Factory and service replacement both exist.' }] },
  { ref: '16610', brand: 'Rolex', model: 'Submariner Date', years: [1988, 2010], blurb: 'The five-digit Submariner Date: aluminium insert, lug holes until ~2003, cal. 3135.', typical: { low: 950, high: 1500, days: 21 }, serialKind: 'letter', thumb: ph('16610 · Submariner Date'),
    bracelets: [{ code: '93150', name: 'Oyster · hollow end links', img: ph('Oyster 93150', '#1f2a2f'), years: '1988–2000' }, { code: '93250', name: 'Oyster · solid end links (SEL)', img: ph('Oyster 93250', '#1f2a2f'), years: '2000–2010' }],
    dials: [{ key: 'tritium', label: 'Tritium · SWISS – T<25', years: [1988, 1998], img: ph('Dial · tritium'), notes: 'Lume ages cream; text at 6 reads SWISS – T<25.' }, { key: 'luminova-swiss', label: 'Luminova · SWISS only', years: [1998, 1999], img: ph('Dial · SWISS only'), notes: 'Short transitional run.' }, { key: 'superluminova', label: 'Super-LumiNova · SWISS MADE', years: [1999, 2010], img: ph('Dial · SWISS MADE'), notes: 'White lume, stays white.' }],
    inserts: [{ key: 'alu-black-silver', label: 'Aluminium · silver numerals', years: [1988, 2010], img: ph('Insert · aluminium'), notes: 'Pearl at 12 goes from tritium to Luminova ~1998.' }] },
  { ref: '126610LN', brand: 'Rolex', model: 'Submariner Date', years: [2020, 2026], blurb: '41 mm case, Cerachrom insert, cal. 3235 with 70-hour reserve, Glidelock clasp.', typical: { low: 1100, high: 1600, days: 18 }, serialKind: 'random', thumb: ph('126610LN · Submariner 41'),
    bracelets: [{ code: '97200', name: 'Oyster · Glidelock', img: ph('Oyster 97200', '#1f2a2f'), years: '2020–' }],
    dials: [{ key: 'black-maxi-3235', label: 'Black · Maxi · 3235', years: [2020, 2026], img: ph('Dial · black maxi'), notes: 'Chromalight blue lume; coronet at 6 above SWISS MADE.' }],
    inserts: [{ key: 'cerachrom-black', label: 'Cerachrom · black', years: [2020, 2026], img: ph('Insert · Cerachrom'), notes: 'Platinum-filled numerals; does not fade.' }] },
  { ref: '116500LN', brand: 'Rolex', model: 'Cosmograph Daytona', years: [2016, 2023], blurb: 'Steel Daytona with the black Cerachrom bezel, cal. 4130.', typical: { low: 1400, high: 2100, days: 28 }, serialKind: 'random', thumb: ph('116500LN · Daytona'),
    bracelets: [{ code: '78590', name: 'Oyster · Oysterlock', img: ph('Oyster 78590', '#2a2a2a'), years: '2016–2023' }],
    dials: [{ key: 'white-panda', label: 'White · black subdials', years: [2016, 2023], img: ph('Dial · white panda'), notes: 'The “panda”; subdial rings are black.' }, { key: 'black', label: 'Black · silver subdials', years: [2016, 2023], img: ph('Dial · black'), notes: 'Silver-ringed subdials.' }],
    inserts: [{ key: 'cerachrom-tachy', label: 'Cerachrom tachymeter', years: [2016, 2023], img: ph('Bezel · Cerachrom tachy'), notes: 'Fixed; engraved scale filled with platinum.' }] },
  { ref: '79830RB', brand: 'Tudor', model: 'Black Bay GMT', years: [2018, 2026], blurb: 'Tudor’s Pepsi GMT with the in-house MT5652, snowflake hands, 41 mm.', typical: { low: 650, high: 950, days: 14 }, serialKind: 'random', thumb: ph('79830RB · Black Bay GMT'),
    bracelets: [{ code: '79830-steel', name: 'Riveted steel', img: ph('Riveted steel', '#2a2a30'), years: '2018–' }, { code: '79830-fabric', name: 'Fabric strap', img: ph('Fabric strap', '#2a2a30'), years: '2018–' }, { code: '79830-leather', name: 'Leather strap', img: ph('Leather strap', '#2a2a30'), years: '2018–' }],
    dials: [{ key: 'black-snowflake', label: 'Black · snowflake', years: [2018, 2026], img: ph('Dial · snowflake'), notes: 'Matte black; red GMT hand.' }, { key: 'opaline', label: 'Opaline · 2022 update', years: [2022, 2026], img: ph('Dial · opaline'), notes: 'Silver dial variant.' }],
    inserts: [{ key: 'alu-pepsi-matte', label: 'Aluminium · matte Pepsi', years: [2018, 2026], img: ph('Insert · matte Pepsi'), notes: 'Matte burgundy/blue; 24-hour scale.' }] },
];
export const refByCode = (ref: string) => REFS.find((r) => r.ref.toUpperCase() === ref.trim().toUpperCase());
export const MODELS = REFS.map((r) => `${r.brand} ${r.model} · ${r.ref}`);

// Serial → era. Rolex letter prefixes 1987–2010; 1675-era numeric serials; random (scrambled) after 2010. Range language only.
const LETTER_ERA: Record<string, string> = { R: '1987–1988', L: '1988–1990', E: '1990–1991', X: '1991', N: '1991–1992', C: '1992–1993', S: '1993–1994', W: '1994–1995', T: '1996', U: '1997', A: '1998–1999', P: '2000', K: '2001', Y: '2002', F: '2003–2004', D: '2005', Z: '2006', M: '2007–2008', V: '2008–2009', G: '2010–2011' };
const NUMERIC_ERA: [number, string][] = [[0.5, '1959–1961'], [1.0, '1962–1964'], [1.5, '1965–1967'], [2.5, '1968–1970'], [3.5, '1971–1973'], [4.5, '1974–1976'], [5.5, '1977–1978'], [6.5, '1979–1980']];
export const eraFromSerial = (prefix: string, r?: RefRow): { years: string; how: string } | null => {
  const p = prefix.trim().toUpperCase(); if (!p) return null;
  if (/^[A-Z]/.test(p) && LETTER_ERA[p[0]]) return { years: LETTER_ERA[p[0]], how: `letter prefix ${p[0]}` };
  if (/^\d/.test(p)) { const m = Number(p.replace(/\D/g, '').padEnd(7, '0').slice(0, 7)) / 1_000_000; const hit = NUMERIC_ERA.find(([max]) => m <= max); if (hit) return { years: hit[1], how: `numeric serial ≈ ${m.toFixed(1)}M` }; }
  if (r?.serialKind === 'random') return { years: `${r.years[0]}–${r.years[1] === 2026 ? 'present' : r.years[1]}`, how: 'random serial (post-2010) — era from the reference' };
  return { years: 'unknown', how: 'no match in the serial tables' };
};
const yearsOverlap = (era: string, v: [number, number]) => { const m = era.match(/(\d{4})/g); if (!m) return true; const lo = Number(m[0]); const hi = Number(m[1] ?? m[0]); return hi >= v[0] && lo <= v[1]; };

// Table-driven question tree (seeded with MH's path: crown-forward → quickset → size → metal → day display → 16233)
export interface QOption { label: string; next?: string; refs?: string[]; note?: string }
export interface QNode { id: string; q: string; help?: string; options: QOption[] }
export const QUESTION_TREE: QNode[] = [
  { id: 'brand', q: 'What does the dial say?', options: [{ label: 'Rolex', next: 'crown' }, { label: 'Tudor', next: 'tudor' }, { label: 'Something else / unsure', refs: [], note: 'Photograph the dial and we’ll take it from there.' }] },
  { id: 'crown', q: 'Pull the crown out one click and turn it forward (toward you). What moves?', help: 'Hold the watch dial-up with the crown on the right.', options: [{ label: 'The date jumps a day each turn (quickset)', next: 'size' }, { label: 'The date AND a day name move', next: 'daydate' }, { label: 'Only the hands move / no date', next: 'bezel' }] },
  { id: 'size', q: 'How big is the case (without the crown)?', options: [{ label: 'Man’s · ~36 mm', next: 'metal' }, { label: 'Mid-size · ~31 mm', refs: ['68273', '68274'] }, { label: 'Ladies · ~26 mm', refs: ['69173', '69174'] }] },
  { id: 'metal', q: 'Which metal?', options: [{ label: 'Steel with a fluted or smooth bezel', next: 'dive' }, { label: 'Two-tone (steel + yellow gold)', next: 'day' }, { label: 'Solid gold', refs: ['16238', '16018'] }] },
  { id: 'day', q: 'Is there a day name at 12 o’clock?', options: [{ label: 'No — date at 3 only', refs: ['16233'] }, { label: 'Yes', refs: [], note: 'A two-tone Day-Date was never made — check the dial again or photograph it.' }] },
  { id: 'daydate', q: 'Day name at 12 and date at 3 — which metal?', options: [{ label: 'Yellow gold', refs: ['18238', '18038'] }, { label: 'White gold / platinum', refs: ['18239', '18206'] }] },
  { id: 'dive', q: 'Does the bezel rotate?', options: [{ label: 'Yes — 60-minute dive scale', next: 'ceramic' }, { label: 'Yes — 24-hour scale, two colours', refs: ['1675', '16710'] }, { label: 'No — fixed bezel, plain dial', refs: ['16234', '16220'] }, { label: 'No — fixed bezel with a tachymeter scale and three subdials', refs: ['116500LN'] }] },
  { id: 'ceramic', q: 'Is the bezel insert glossy ceramic or matte aluminium?', options: [{ label: 'Glossy ceramic, engraved numerals', refs: ['126610LN'] }, { label: 'Matte aluminium', refs: ['16610'] }] },
  { id: 'tudor', q: 'Tudor — does it have a two-colour 24-hour bezel and “snowflake” hands?', options: [{ label: 'Yes', refs: ['79830RB'] }, { label: 'No', refs: [], note: 'Photograph the dial — Tudor refs are on the case back.' }] },
];
export const questionNode = (id: string) => QUESTION_TREE.find((n) => n.id === id)!;

// ---- MOCK engine (deterministic from the photo bytes so a retake can change the answer) ----
const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < Math.min(s.length, 4000); i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h >>> 0); };
const hintRef = (s: string) => REFS.find((r) => decodeURIComponent(s.slice(0, 2000)).includes(r.ref));
export type Band = 'high' | 'medium' | 'low';
export const band = (c: number): Band => (c >= 0.6 ? 'high' : c >= 0.3 ? 'medium' : 'low');
export interface IdentifyResult { candidates: { ref: string; model: string; brand: Brand; thumb: string; confidence: number; band: Band }[]; mock: true; ms: number }
export async function identifyModel(dialDataUrl: string): Promise<IdentifyResult> {
  const t = performance.now(); await new Promise((r) => setTimeout(r, 600));
  const h = hashOf(dialDataUrl); const pref = hintRef(dialDataUrl); const order = [...REFS].sort((a, b) => hashOf(a.ref + h) - hashOf(b.ref + h));
  const top = pref ? [pref, ...order.filter((r) => r.ref !== pref.ref)] : order; const confs = pref ? [0.71, 0.17, 0.08] : [0.44, 0.31, 0.14];
  return { candidates: top.slice(0, 3).map((r, i) => ({ ref: r.ref, model: r.model, brand: r.brand, thumb: r.thumb, confidence: confs[i], band: band(confs[i]) })), mock: true, ms: Math.round(performance.now() - t) };
}
export interface RankedVariant { variant: VariantEx; similarity: number; tie: boolean }
export interface VariantReport { ref: RefRow; era: ReturnType<typeof eraFromSerial>; dial: RankedVariant[]; insert: RankedVariant[]; clasp?: { code: string; name: string; years?: string; vsCase: string }; endLinks?: { ok: boolean; note: string }; mock: true; ms: number }
const rank = (list: VariantEx[], seed: number): RankedVariant[] => { const scored = list.map((v, i) => ({ variant: v, similarity: Math.max(0.12, Math.min(0.96, 0.9 - ((seed + i * 7919) % 100) / 160)), tie: false })).sort((a, b) => b.similarity - a.similarity); for (let i = 1; i < scored.length; i++) if (scored[i - 1].similarity - scored[i].similarity < 0.05) { scored[i].tie = true; scored[i - 1].tie = true; } return scored; };
export async function rankVariants(ref: string, shots: Partial<Record<ShotKey, string>>, serialPrefix?: string): Promise<VariantReport> {
  const t = performance.now(); await new Promise((r) => setTimeout(r, 700)); const r = refByCode(ref); if (!r) throw new Error(`Unknown reference ${ref}`);
  const seed = hashOf((shots.dial ?? '') + (shots.bezel ?? '') + ref);
  const era = eraFromSerial(serialPrefix ?? '', r);
  const clasp = shots.clasp ? (() => { const b = r.bracelets[seed % r.bracelets.length]; const claspYear = b.years ?? `${r.years[0]}–${r.years[1]}`; return { code: b.code, name: b.name, years: claspYear, vsCase: era && era.years !== 'unknown' ? (yearsOverlap(era.years, [Number(claspYear.slice(0, 4)), Number(claspYear.slice(5, 9)) || 2026]) ? 'clasp era is consistent with the case era' : 'clasp is from a different era than the case — common after a service bracelet swap') : 'add a serial prefix to compare clasp vs case era' }; })() : undefined;
  const endLinks = shots.endlinks ? { ok: seed % 3 !== 0, note: seed % 3 !== 0 ? `End links match ${r.bracelets[0].code} for this reference` : 'End-link code does not match any bracelet listed for this reference — possibly a later replacement' } : undefined;
  return { ref: r, era, dial: rank(r.dials, seed), insert: rank(r.inserts, seed >> 3), clasp, endLinks, mock: true, ms: Math.round(performance.now() - t) };
}
export interface BraceletResult { code: string; name: string; confidence: number; band: Band; mock: true }
export async function braceletCheck(ref: string, claspDataUrl: string): Promise<BraceletResult> {
  await new Promise((r) => setTimeout(r, 450)); const r = refByCode(ref); if (!r) throw new Error(`Unknown reference ${ref}`);
  const b = r.bracelets[hashOf(claspDataUrl) % r.bracelets.length]; const c = 0.58 + (hashOf(claspDataUrl + b.code) % 30) / 100; return { code: b.code, name: b.name, confidence: c, band: band(c), mock: true };
}
export const consistency = (v: VariantEx, era: ReturnType<typeof eraFromSerial>) => (!era || era.years === 'unknown' ? 'serial era unknown — add the prefix to compare' : yearsOverlap(era.years, v.years) ? `consistent with your serial era (${era.years})` : `NOT consistent with your serial era (${era.years}) — variant dates ${v.years[0]}–${v.years[1]}`);

// Typical service language — RANGE only, never a quote
export type Leg = 'full' | 'polish' | 'band' | 'battery' | 'crystal' | 'estimate_only' | 'authentication' | 'passport' | 'other';
export const LEGS: { key: Leg; label: string; dept?: 'W' | 'B' | 'P' }[] = [{ key: 'full', label: 'Full service', dept: 'W' }, { key: 'polish', label: 'Polish', dept: 'P' }, { key: 'band', label: 'Band / bracelet', dept: 'B' }, { key: 'battery', label: 'Battery / quartz', dept: 'W' }, { key: 'crystal', label: 'Crystal', dept: 'W' }, { key: 'estimate_only', label: 'Estimate only' }, { key: 'authentication', label: 'Authentication', dept: 'W' }, { key: 'passport', label: 'Passport inspection', dept: 'W' }, { key: 'other', label: 'Other' }];
const LEG_ADD: Record<Leg, [number, number, number]> = { full: [0, 0, 0], polish: [180, 420, 3], band: [120, 380, 2], battery: [60, 120, 1], crystal: [250, 600, 5], estimate_only: [0, 0, 2], authentication: [150, 350, 2], passport: [250, 450, 3], other: [0, 0, 0] };
export const typicalFor = (ref: string, legs: Leg[]): { low: number; high: number; days: number } | null => {
  const r = refByCode(ref); if (!r) return null; const hasFull = legs.includes('full');
  let low = hasFull ? r.typical.low : 0, high = hasFull ? r.typical.high : 0, days = hasFull ? r.typical.days : 0;
  legs.filter((l) => l !== 'full').forEach((l) => { const [a, b, d] = LEG_ADD[l]; low += a; high += b; days = Math.max(days, d); });
  if (!legs.length) { return r.typical; } if (low === 0 && high === 0) return { low: 0, high: 0, days };
  return { low: Math.round(low / 10) * 10, high: Math.round(high / 10) * 10, days };
};
export const typicalLine = (t: { low: number; high: number; days: number } | null) => (!t ? null : t.high === 0 ? `Typical: no charge to look · about ${t.days} day${t.days === 1 ? '' : 's'}` : `Typical: $${t.low.toLocaleString()}–$${t.high.toLocaleString()} · about ${t.days} days`);

// ---- Desktop → phone hand-off (MOCK): "Text me the link" goes through the Vonage mock; the paired phone renders inline in the emulator ----
export interface HandoffSession { id: string; via: 'sms' | 'qr'; phone?: string; createdAt: string; url: string; smsId?: string }
export const startHandoff = (via: 'sms' | 'qr', phone?: string): HandoffSession => {
  const id = `wm8-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; const url = `https://rolliworks.com/p/${id}`;
  let smsId: string | undefined; if (via === 'sms') { const r = sendSms(phone ?? '', `rolliworks.com: tap to continue on your phone — ${url} (link works for 15 minutes)`); if (r.status === 'failed') throw new Error('Enter a mobile number with area code'); smsId = r.id; }
  return { id, via, phone, createdAt: new Date().toISOString(), url, smsId };
};

// ---- Claim codes: anonymous results you can pick up later (WM8-xxxx) ----
export interface Claim { code: string; createdAt: string; results: Record<string, unknown>; photos: { key: string; dataUrl: string }[]; contact?: { phone?: string; email?: string } }
const CLAIMS_KEY = 'rollisuite.rwcom.claims';
const claims = (): Claim[] => { try { return JSON.parse(localStorage.getItem(CLAIMS_KEY) ?? '[]'); } catch { return []; } };
export const saveClaim = (results: Record<string, unknown>, photos: { key: string; dataUrl: string }[], contact?: Claim['contact'], existing?: string): Claim => {
  const all = claims(); let c = existing ? all.find((x) => x.code === existing) : undefined;
  if (!c) { c = { code: `WM8-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, createdAt: new Date().toISOString(), results: {}, photos: [] }; all.push(c); }
  c.results = { ...c.results, ...results }; c.photos = [...c.photos.filter((p) => !photos.some((n) => n.key === p.key)), ...photos]; if (contact) c.contact = contact;
  localStorage.setItem(CLAIMS_KEY, JSON.stringify(all.slice(-50))); return c;
};
export const findClaim = (code: string) => claims().find((c) => c.code.toUpperCase() === code.trim().toUpperCase());

// ---- Instrumentation stub: per shot — shown / captured / retaken / abandoned + seconds + device frame → dev panel ----
export type InstrumentKind = 'shown' | 'captured' | 'retaken' | 'abandoned' | 'handoff' | 'engine' | 'submit';
export interface InstrumentEvent { at: string; tab: string; shot?: string; kind: InstrumentKind; seconds?: number; ms?: number; device: 'phone' | 'desktop'; detail?: string }
const log: InstrumentEvent[] = []; const listeners = new Set<() => void>();
// Mirrored to the console (`[wm8] {...json}`) so the whole session can be copied out of DevTools
export const instrument = (e: Omit<InstrumentEvent, 'at'>) => { const ev = { ...e, at: new Date().toISOString() }; log.unshift(ev); if (log.length > 300) log.pop(); console.info('[wm8]', JSON.stringify(ev)); listeners.forEach((fn) => fn()); };
export const clearInstrumentLog = () => { log.length = 0; listeners.forEach((fn) => fn()); };
export const instrumentLog = () => [...log];
export const onInstrument = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
