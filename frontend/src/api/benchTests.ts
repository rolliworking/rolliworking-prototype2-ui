import { benchBridge as b } from './client';

// ---- Bench-test capture — one photo of the slips in, structured readings out; the photo stays attached as backing evidence (extract + keep source) ----
export type BenchKind = 'before_after' | 'tolerance';
export const POSITIONS = ['DU', 'DD', 'PU', 'PD', 'PL', 'PR'] as const;
export type Position = (typeof POSITIONS)[number];
export interface TimingRow { pos: Position; rate: number; amplitude: number; beatError: number }
export interface BeforeAfterExtract {
  before: { handwritten: true; rows: TimingRow[]; note?: string };
  pressure: { instrument: 'Proofmaster'; program: string; readings: { label: string; value: string }[]; result: 'PASS' | 'FAIL'; testedAt: string };
  chronoscope: { instrument: 'Witschi Chronoscope'; rows: TimingRow[]; average: { rate: number; amplitude: number; beatError: number }; delta: number; testedAt: string };
}
export const GRADE_COMPONENTS = ['Train Wheels', 'Escape Wheel', 'Pallet Fork', 'Barrel Up/Low', 'Setting Wh Post', 'Driving Wh for Ratchet Wh'] as const;
export type Grade = 'A' | 'B' | 'B-';
export interface ToleranceExtract { caliberHeader: string; rows: { metric: string; spec: string; measured: string; ok: boolean }[]; grades: Record<(typeof GRADE_COMPONENTS)[number], Grade> }
export interface CaliberSpec { id: string; label: string; family: string[]; rate: [number, number]; ampMin: number; beatErrMax: number; deltaMax: number }
// Reference chart — the sheet's printed header is matched against these
export const CALIBER_SPECS: CaliberSpec[] = [
  { id: 'rlx-31xx', label: 'Rolex Cal. 31xx', family: ['3130', '3135', '3186', '3187', '31xx'], rate: [-2, 4], ampMin: 250, beatErrMax: 0.6, deltaMax: 6 },
  { id: 'rlx-3235', label: 'Rolex Cal. 3235', family: ['3235', '3230', '3285', '32xx'], rate: [-2, 2], ampMin: 260, beatErrMax: 0.5, deltaMax: 5 },
  { id: 'rlx-2235', label: 'Rolex Cal. 2235', family: ['2235', '2236', '22xx'], rate: [-2, 4], ampMin: 240, beatErrMax: 0.7, deltaMax: 7 },
];
export interface CaliberMatch { specId: string; confidence: number; via: 'header' | 'serial decode' | 'manual'; overriddenFrom?: string; overriddenBy?: string }
export interface BenchCapture { id: string; jobId: string; kind: BenchKind; photoUrl: string; at: string; by: string; station: string; extract: BeforeAfterExtract | ToleranceExtract; caliber?: CaliberMatch; extractConfidence: number }

const iso = (d: number, h = 14) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 12, 0, 0); return x.toISOString(); };
const row = (pos: Position, rate: number, amplitude: number, beatError: number): TimingRow => ({ pos, rate, amplitude, beatError });
const avg = (rows: TimingRow[]) => ({ rate: +(rows.reduce((t, r) => t + r.rate, 0) / rows.length).toFixed(1), amplitude: Math.round(rows.reduce((t, r) => t + r.amplitude, 0) / rows.length), beatError: +(rows.reduce((t, r) => t + r.beatError, 0) / rows.length).toFixed(1) });
const delta = (rows: TimingRow[]) => +(Math.max(...rows.map((r) => r.rate)) - Math.min(...rows.map((r) => r.rate))).toFixed(1);
const beforeAfter = (seed: number): BeforeAfterExtract => {
  const j = (n: number) => +(n + ((seed * 7919) % 5) * 0.2 - 0.4).toFixed(1);
  const before = [row('DU', j(-8.4), 212, 1.8), row('DD', j(-6.9), 208, 1.9), row('PU', j(-14.2), 181, 2.4), row('PD', j(-11.7), 186, 2.1), row('PL', j(-15.8), 178, 2.6), row('PR', j(-9.3), 190, 2.2)];
  const after = [row('DU', j(1.8), 281, 0.2), row('DD', j(2.1), 279, 0.2), row('PU', j(-0.4), 262, 0.3), row('PD', j(0.9), 266, 0.3), row('PL', j(-1.1), 258, 0.4), row('PR', j(1.4), 264, 0.3)];
  return { before: { handwritten: true, rows: before, note: 'incoming · hand-filled at intake bench' }, pressure: { instrument: 'Proofmaster', program: 'P3 · 5 ATM vacuum + pressure', readings: [{ label: 'Vacuum −0.5 bar · deformation', value: '2 µm' }, { label: 'Pressure 5 bar · deformation', value: '9 µm' }, { label: 'Leak rate', value: '0.3 µm/min' }, { label: 'Condensation', value: 'none' }], result: 'PASS', testedAt: iso(0, 11) }, chronoscope: { instrument: 'Witschi Chronoscope', rows: after, average: avg(after), delta: delta(after), testedAt: iso(0, 13) } };
};
const tolerance = (spec: CaliberSpec, seed: number): ToleranceExtract => {
  const rate = +(1.2 + ((seed * 31) % 7) * 0.2).toFixed(1); const amp = 268 + ((seed * 13) % 9); const be = +(0.2 + ((seed * 3) % 3) * 0.1).toFixed(1); const dl = +(2.4 + ((seed * 17) % 5) * 0.4).toFixed(1);
  return { caliberHeader: spec.label, rows: [{ metric: 'Rate (avg, 6 pos)', spec: `${spec.rate[0]} / +${spec.rate[1]} s/d`, measured: `${rate > 0 ? '+' : ''}${rate} s/d`, ok: rate >= spec.rate[0] && rate <= spec.rate[1] }, { metric: 'Amplitude (DU)', spec: `≥ ${spec.ampMin}°`, measured: `${amp}°`, ok: amp >= spec.ampMin }, { metric: 'Beat error', spec: `≤ ${spec.beatErrMax} ms`, measured: `${be} ms`, ok: be <= spec.beatErrMax }, { metric: 'Delta (max − min rate)', spec: `≤ ${spec.deltaMax} s/d`, measured: `${dl} s/d`, ok: dl <= spec.deltaMax }], grades: { 'Train Wheels': 'A', 'Escape Wheel': 'B', 'Pallet Fork': 'A', 'Barrel Up/Low': 'B-', 'Setting Wh Post': 'A', 'Driving Wh for Ratchet Wh': 'B' } };
};
// Same measured numbers, re-judged against a different reference caliber
const recheck = (rows: ToleranceExtract['rows'], spec: CaliberSpec): ToleranceExtract['rows'] => rows.map((r) => { const v = parseFloat(r.measured.replace(/[^\d.+-]/g, '')); if (r.metric.startsWith('Rate')) return { ...r, spec: `${spec.rate[0]} / +${spec.rate[1]} s/d`, ok: v >= spec.rate[0] && v <= spec.rate[1] }; if (r.metric.startsWith('Amplitude')) return { ...r, spec: `≥ ${spec.ampMin}°`, ok: v >= spec.ampMin }; if (r.metric.startsWith('Beat')) return { ...r, spec: `≤ ${spec.beatErrMax} ms`, ok: v <= spec.beatErrMax }; if (r.metric.startsWith('Delta')) return { ...r, spec: `≤ ${spec.deltaMax} s/d`, ok: v <= spec.deltaMax }; return r; });
// Header text → reference chart; falls back to the serial decode's caliber family
const matchCaliber = (header: string | undefined, jobId: string): CaliberMatch | undefined => {
  const h = (header ?? '').toLowerCase().replace(/\s+/g, '');
  const byHeader = CALIBER_SPECS.find((s) => h && s.family.some((f) => h.includes(`cal.${f}`.toLowerCase()) || h.includes(f.toLowerCase())));
  if (byHeader) return { specId: byHeader.id, confidence: 0.94, via: 'header' };
  const j = b.job(jobId); const w = b.watch(j?.watchId); const cal = w ? b.decode(w.serial, w.reference).caliber?.toLowerCase() ?? '' : '';
  const byDecode = CALIBER_SPECS.find((s) => s.family.some((f) => cal.includes(f.toLowerCase().replace('xx', ''))));
  return byDecode ? { specId: byDecode.id, confidence: 0.71, via: 'serial decode' } : undefined;
};

const captures: BenchCapture[] = [
  { id: 'bt-01', jobId: 'j-r1', kind: 'before_after', photoUrl: '/bench/before_after.jpg', at: iso(1, 13), by: 'Walter', station: 'WM Bench 1', extract: beforeAfter(1), extractConfidence: 0.91 },
  { id: 'bt-02', jobId: 'j-r3', kind: 'tolerance', photoUrl: '/bench/tolerance.jpg', at: iso(0, 10), by: 'MM', station: 'WM Bench 2', extract: tolerance(CALIBER_SPECS[0], 2), caliber: { specId: 'rlx-31xx', confidence: 0.94, via: 'header' }, extractConfidence: 0.88 },
];

export const specOf = (id?: string) => CALIBER_SPECS.find((s) => s.id === id);
export async function getBenchCaptures(jobId: string): Promise<BenchCapture[]> { return captures.filter((c) => c.jobId === jobId).sort((a, b2) => b2.at.localeCompare(a.at)).map((c) => ({ ...c })); }
// Mocked extraction — the photo goes in, structured readings come out; ~1s of "reading" so the panel shows the hand-off
export async function captureBenchTest(jobId: string, kind: BenchKind, photoUrl: string): Promise<BenchCapture> {
  const j = b.job(jobId); if (!j) throw new Error('Job not found'); const a = b.actor();
  await new Promise((r) => window.setTimeout(r, 1100));
  const seed = captures.length + 3; const w = b.watch(j.watchId);
  const spec = matchCaliber(undefined, jobId) ? specOf(matchCaliber(undefined, jobId)!.specId)! : CALIBER_SPECS[0];
  const extract = kind === 'before_after' ? beforeAfter(seed) : tolerance(w?.brand === 'Rolex' ? spec : CALIBER_SPECS[1], seed);
  const c: BenchCapture = { id: b.newId('bt'), jobId, kind, photoUrl, at: new Date().toISOString(), by: a.by, station: a.station, extract, extractConfidence: kind === 'before_after' ? 0.9 : 0.87, caliber: kind === 'tolerance' ? matchCaliber((extract as ToleranceExtract).caliberHeader, jobId) : undefined };
  captures.unshift(c); b.jobStamp(jobId, kind === 'before_after' ? `Bench test captured · before timing (hand-filled) + Proofmaster ${(extract as BeforeAfterExtract).pressure.result} + Chronoscope Δ${(extract as BeforeAfterExtract).chronoscope.delta}` : `Tolerance sheet captured · ${(extract as ToleranceExtract).caliberHeader} · ${(extract as ToleranceExtract).rows.every((r) => r.ok) ? 'all in spec' : 'out of spec'}`);
  return { ...c };
}
// Caliber override — same flag/correct pattern as the serial decode: keep what the sheet said, record who corrected it
export async function overrideBenchCaliber(id: string, specId: string): Promise<BenchCapture> {
  const c = captures.find((x) => x.id === id); if (!c) throw new Error('Capture not found'); const spec = specOf(specId); if (!spec) throw new Error('Unknown caliber'); const a = b.actor();
  const from = c.caliber?.specId; c.caliber = { specId, confidence: 1, via: 'manual', overriddenFrom: from && from !== specId ? from : c.caliber?.overriddenFrom, overriddenBy: a.by };
  if (c.kind === 'tolerance') { const t = c.extract as ToleranceExtract; c.extract = { ...t, rows: recheck(t.rows, spec) }; }
  b.jobStamp(c.jobId, `Bench caliber corrected → ${spec.label}${from ? ` (sheet matched ${specOf(from)?.label})` : ''}`);
  return { ...c };
}
export async function deleteBenchCapture(id: string): Promise<void> { const i = captures.findIndex((x) => x.id === id); if (i >= 0) { const c = captures[i]; captures.splice(i, 1); b.jobStamp(c.jobId, 'Bench capture removed'); } }
