// New Inspection form — modeled on the legacy RolliWorks inspection form + the "Inspection Scantron — Rolliworks v1.1" paper sheet.
// Numbered preset notes are a LEARNED library (suggest-and-learn); the numbers double as the scantron option numbers.
export type Condition = 'excellent' | 'very_good' | 'good' | 'fair' | 'poor' | 'none' | 'waiver';
export type Authenticity = 'genuine' | 'not_genuine' | 'genuine_not_correct' | 'undetermined';
export const CONDITIONS: { key: Condition; n: number; label: string }[] = [
  { key: 'excellent', n: 1, label: 'Excellent' }, { key: 'very_good', n: 2, label: 'Very Good' }, { key: 'good', n: 3, label: 'Good' }, { key: 'fair', n: 4, label: 'Fair' }, { key: 'poor', n: 5, label: 'Poor' }, { key: 'none', n: 6, label: 'NONE' }, { key: 'waiver', n: 7, label: 'Waiver' },
];
export const AUTHENTICITY: { key: Authenticity; label: string; blurb: string }[] = [
  { key: 'genuine', label: 'Genuine', blurb: 'Authentic and correct for this reference' }, { key: 'not_genuine', label: 'Not genuine', blurb: 'Aftermarket / counterfeit part' },
  { key: 'genuine_not_correct', label: 'Genuine but not correct', blurb: 'Real part, wrong for this reference / model (e.g. a genuine dial from another model)' }, { key: 'undetermined', label: 'Undetermined', blurb: 'Needs the reference PDFs / further inspection' },
];
export const INSPECTION_COMPONENTS = ['Dial', 'Hands', 'Bezel', 'Crown', 'Case', 'Crystal', 'Bracelet'] as const;
export type InspComponent = (typeof INSPECTION_COMPONENTS)[number];
export const NOTE_LIBRARY: Record<InspComponent, string[]> = {
  Dial: ['Some Paint Defects', 'Lume Shedding', 'Aftermarket (not made by Rolex)', 'Spotting / moisture damage', 'Refinished dial', 'Lume mismatch with hands', 'Service replacement dial'],
  Hands: ['Lume Shedding', 'Corrosion on hands', 'Aftermarket hands', 'Relumed', 'Bent second hand', 'Hands not correct for reference'],
  Bezel: ['Insert faded', 'Insert cracked', 'Bezel not clicking', 'Pearl missing', 'Aftermarket insert', 'Bezel loose'],
  Crown: ['Not threading properly', 'Catching on one thread. Might try new case tube $55', 'Crown worn — recommend replacement', 'Crown tube damaged', 'Aftermarket crown'],
  Case: ['Scuffs', 'Material Missing from Tips of Lugs', 'I recommend NO POLISH', 'Deep scratches', 'Dent on case side', 'Lug holes worn', 'Case back scratched', 'Previous heavy polish'],
  Crystal: ['Scratched', 'Chipped at edge', 'Cracked', 'Cyclops loose', 'Polish Up $0 Yes/No?', 'Aftermarket crystal'],
  Bracelet: ['Stretch', 'Clasp not holding', 'End pieces worn', 'Pins loose', 'Missing links', 'Aftermarket bracelet', 'Heavy polish on center links'],
};
export const OVERALL_QUICK_TAGS = ['Low Amplitude / Pallet Fork', 'Water resistance FAIL', 'Mainspring set', 'Date not jumping', 'Rotor noise', 'Magnetised'];
export const DIAL_VARIANTS = ['BUCKLEY', 'SIGMA', 'Mk1', 'Mk2', 'Mk3', 'Tropical', 'Spider', 'Ghost', 'Pumpkin lume', 'Underline'];
export interface BraceletRepairLine { key: string; n: number; label: string; mode: 'qty_price' | 'hours_rate' | 'scale'; qty?: number; price?: number; hours?: number; rate?: number; yesNo?: boolean; rec?: 'rec' | 'not_rec'; scale?: number; include?: boolean; note?: string }
export const BRACELET_LINES: BraceletRepairLine[] = [
  { key: 'links', n: 1, label: 'Might need extra links (Shorter Links)', mode: 'qty_price', qty: 0, price: 0 },
  { key: 'steel_side', n: 2, label: 'Steel Side pieces — inner corners', mode: 'hours_rate', hours: 0, rate: 98, note: 'polishing will be required if welding is done' },
  { key: 'steel_center', n: 3, label: 'Steel Center pieces', mode: 'hours_rate', hours: 0, rate: 98 },
  { key: 'gold_center', n: 4, label: 'Gold Center pieces', mode: 'qty_price', qty: 0, price: 0 },
  { key: 'foil_thin', n: 5, label: 'Center pieces foil thin (invert pieces)', mode: 'qty_price', qty: 0, price: 0 },
  { key: 'band_polish', n: 6, label: 'Band Polish Question (0–10)', mode: 'scale', scale: 0, include: false },
];
export interface InspComponentEntry { component: InspComponent; condition?: Condition; authenticity?: Authenticity; notes: number[]; otherNote?: string; waiver: boolean; price: number; yesNo: boolean; extraNotes: string[]; retailPolish?: boolean; caseRestorationPrice?: number; weldingPrice?: number; polishUpPrice?: number; polishUpYesNo?: boolean; dialVariants?: string[] }
export interface InspectionForm {
  id: string; token: string; jobId?: string; customer: { name: string; email?: string; phone?: string }; brand: string; model: string; reference: string; estimateNumber: string; targetWeeks: number; targetFrom?: string; targetTo?: string; targetSource?: 'receive';
  deptTags: string[]; inspectionType: string; jobType: string; components: InspComponentEntry[]; bracelet: BraceletRepairLine[]; overall: { notes: string; quickTags: string[]; price: number; yesNo: boolean; waiver: boolean };
  photos: { id: string; source: 'ipevo' | 'microscope'; dataUrl: string; at: string }[]; status: 'draft' | 'saved'; total: number; createdAt: string; savedAt?: string; savedBy?: string; station?: string; sheetScan?: { at: string; by: string; confidence: number | null };
}
export const blankEntry = (c: InspComponent): InspComponentEntry => ({ component: c, notes: [], waiver: false, price: 0, yesNo: false, extraNotes: [] });
export const blankForm = (id: string, token: string): InspectionForm => ({ id, token, customer: { name: '' }, brand: '', model: '', reference: '', estimateNumber: '', targetWeeks: 6, deptTags: [], inspectionType: 'Complete Watch', jobType: 'Service', components: INSPECTION_COMPONENTS.map(blankEntry), bracelet: BRACELET_LINES.map((l) => ({ ...l })), overall: { notes: '', quickTags: [], price: 0, yesNo: false, waiver: false }, photos: [], status: 'draft', total: 0, createdAt: new Date().toISOString() });

// Seeded, fully-filled example (roughly what the reference screenshots show) so the report preview has real content
export const seededForm: InspectionForm = {
  ...blankForm('insp-01', 'INSP-E02040-V1-CALLOWAY'), jobId: 'j-r3', customer: { name: 'Robert Calloway', email: 'robert.calloway@example.com', phone: '(212) 555-0130' }, brand: 'Rolex', model: 'Datejust 36', reference: '1601', estimateNumber: 'E02040', targetWeeks: 8, targetFrom: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), targetTo: new Date(Date.now() + 53 * 864e5).toISOString().slice(0, 10), targetSource: 'receive', deptTags: ['W', 'P'], inspectionType: 'Complete Watch', jobType: 'Service',
  components: [
    { component: 'Dial', condition: 'good', authenticity: 'genuine', notes: [0, 1], waiver: true, price: 0, yesNo: false, extraNotes: ['Lume plots slightly uneven — original'], dialVariants: ['SIGMA'] },
    { component: 'Hands', condition: 'fair', authenticity: 'genuine_not_correct', notes: [0], otherNote: 'Hands from a later reference — genuine but not correct', waiver: false, price: 180, yesNo: true, extraNotes: [] },
    { component: 'Bezel', condition: 'very_good', authenticity: 'genuine', notes: [], waiver: false, price: 0, yesNo: false, extraNotes: [] },
    { component: 'Crown', condition: 'fair', authenticity: 'genuine', notes: [0, 1], waiver: false, price: 55, yesNo: true, extraNotes: [] },
    { component: 'Case', condition: 'fair', authenticity: 'genuine', notes: [0, 1, 2], waiver: false, price: 0, yesNo: false, extraNotes: [], retailPolish: false, caseRestorationPrice: 0, weldingPrice: 0 },
    { component: 'Crystal', condition: 'good', authenticity: 'genuine', notes: [0], waiver: false, price: 0, yesNo: false, extraNotes: [], polishUpPrice: 0, polishUpYesNo: true },
    { component: 'Bracelet', condition: 'fair', authenticity: 'genuine', notes: [0, 2], waiver: false, price: 0, yesNo: false, extraNotes: [] },
  ],
  bracelet: BRACELET_LINES.map((l) => (l.key === 'links' ? { ...l, qty: 2, price: 165, yesNo: true } : l.key === 'steel_side' ? { ...l, hours: 1.5, rec: 'rec' } : l.key === 'band_polish' ? { ...l, scale: 6, include: true } : { ...l })),
  overall: { notes: 'Movement running with low amplitude in vertical positions; full service recommended. Case has desk-diving marks — client asked for no polish.', quickTags: ['Low Amplitude / Pallet Fork'], price: 1250, yesNo: true, waiver: true },
  photos: [], status: 'saved', total: 0, createdAt: '2026-09-20T15:10:00.000Z', savedAt: '2026-09-20T15:42:00.000Z', savedBy: 'MH', station: 'Inspection Bench',
};
