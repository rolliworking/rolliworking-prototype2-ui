import { addJobPhotoSync, appraisalBridge as b } from './client';
import { getAuthSessions, AUTH_STEPS } from './authCapture';
import type { Division } from './types';

// ---- Appraisal Creation — client-facing appraisal document built from job data already in the mock (draft → finalize & sign → PDF) ----
export type AppraisalPurpose = 'Insurance' | 'Fair Market' | 'Estate' | 'Resale';
export const PURPOSES: AppraisalPurpose[] = ['Insurance', 'Fair Market', 'Estate', 'Resale'];
export interface AppraisalFields { clientName: string; maker: string; model: string; reference: string; serial: string; movement: string; caliber: string; jewels: string; beatRate: string; caseSize: string; caseMaterial: string; crownCrystal: string; dial: string; bracelet: string; condition: string; styleNo: string }
export interface Comparable { value: number; date: string; ref: string }
export interface Appraisal {
  id: string; number: string; jobId: string; jobNumber: string; createdAt: string; by: string; date: string; purpose: AppraisalPurpose;
  fields: AppraisalFields; authenticity: string; beforePhotoUrl?: string; afterPhotoUrl?: string;
  value: number | null; valueSource: 'placeholder' | 'confirmed' | 'none'; comparables: Comparable[]; entity: Division;
  status: 'draft' | 'final'; signedAt?: string; signedBy?: string; signedByShortName?: string; signatureId?: string; signatureUrl?: string;
}
export const COMPANY = { name: 'Rolliworks', line: '8500 Wilshire Blvd, Suite 720 · Beverly Hills, CA 90211 · (310) 555-0142 · www.rolliworks.com' };
export const DISCLAIMER = 'This estimate has been carried out in accordance with the current prices and does not include any state or federal tax. In the case of damage to any of the items described above, the appraiser will not be responsible for any cost or replacement of such items. The foregoing appraisal is made and accepted upon the express understanding that NO liability or responsibility is incurred by the Appraiser giving same.';
// Stored digital signatures — entity-scoped (user ruling 2026-09-28): Rolliworks appraisals sign as MH, RolliShop as Walter; list is extensible per entity. Applied only on "Finalize & sign", never on draft creation.
export interface Signer { id: string; shortName: string; name: string; image: string }
export const SIGNERS: Record<Division, Signer[]> = {
  rolliworks: [{ id: 'sig-mh', shortName: 'MH', name: 'Michael H', image: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70"><text x="6" y="48" font-family="Brush Script MT, Segoe Script, cursive" font-size="40" fill="#1b2a5e">Michael H</text></svg>')}` }],
  rollishop: [{ id: 'sig-walter', shortName: 'Walter', name: 'Walter', image: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70"><text x="6" y="48" font-family="Brush Script MT, Segoe Script, cursive" font-size="40" fill="#3a1b1b">Walter</text></svg>')}` }],
};
export const ENTITY_NAME: Record<Division, string> = { rolliworks: 'Rolliworks', rollishop: 'RolliShop' };
// Authorization = the acting user IS that signer (no signing on someone else's behalf); the default is the entity's first signer
export const signersFor = (entity: Division, actingShortName?: string) => SIGNERS[entity].map((sg) => ({ ...sg, authorized: !!actingShortName && sg.shortName.toLowerCase() === actingShortName.toLowerCase() }));
const CASE: Record<string, { size: string; material: string; crown: string; jewels: string; beat: string }> = { default: { size: '41 mm', material: 'Oystersteel (904L stainless steel)', crown: 'Twinlock screw-down crown; scratch-resistant sapphire crystal', jewels: '31 jewels', beat: '28,800 vph (4 Hz)' } };

const seq: Record<string, number> = {};
const nextNumber = () => { const y = new Date().getFullYear(); seq[y] = (seq[y] ?? 31) + 1; return `APR-${y}-${String(seq[y]).padStart(4, '0')}`; };
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pull = async (jobId: string) => {
  const j = b.job(jobId); if (!j) throw new Error('Job not found'); const w = b.watch(j.watchId); const c = b.client(j.clientId); const dec = w ? b.decode(w.serial, w.reference) : undefined; const cs = CASE.default; const insp = b.inspectionFor(jobId);
  const cond = insp ? insp.components.filter((x) => x.condition).map((x) => `${x.component}: ${x.condition}`).join('; ') : (j.notes.filter((n) => !/appraisal|photo|bench|flag|reassign|caliber/i.test(n.text)).map((n) => n.text).find(Boolean) ?? '');
  const sessions = await getAuthSessions(jobId); const flagged = sessions.flatMap((s) => s.shots.filter((x) => x.flag !== 'authentic').map((x) => `${AUTH_STEPS.find((a) => a.key === x.step)?.label} (${x.flag})`)); const steps = sessions[0]?.shots.length ?? 0;
  const authenticity = steps ? (flagged.length ? `Authenticity: ${steps} components examined under guided capture — ${flagged.length} flagged for review: ${flagged.join(', ')}.` : `Authenticity: all ${steps} components examined under guided capture (IPEVO + microscope) verified consistent with factory specification — no flags.`) : 'Authenticity: not yet examined under guided capture.';
  const photos = await b.photos(jobId); const before = photos.find((p) => p.kind === 'intake') ?? photos.find((p) => !p.slot.startsWith('after')); const after = photos.find((p) => p.slot === 'after-work' || p.slot === 'After work');
  const fields: AppraisalFields = { clientName: c ? `${c.firstName} ${c.lastName}` : '', maker: w?.brand ?? '', model: w?.model ?? '', reference: w?.reference ?? '', serial: w?.serial ?? '', movement: 'Automatic, self-winding mechanical', caliber: dec?.caliber ?? 'Rolex Cal. 3230', jewels: cs.jewels, beatRate: cs.beat, caseSize: cs.size, caseMaterial: cs.material, crownCrystal: cs.crown, dial: w ? `${w.dial} dial with applied luminescent hour markers` : '', bracelet: w ? `${w.bracelet} bracelet with folding Oysterlock safety clasp` : '', condition: cond || 'Excellent — serviced; case and bracelet refinished', styleNo: w?.reference ?? '' };
  const comps = b.insuredComps(w?.reference ?? ''); const avg = comps.length ? Math.round(comps.reduce((t, x) => t + x.value, 0) / comps.length) : null; // D-085: avg insured value of outbound shipments, never service invoices
  return { j, fields, authenticity, before: before?.url, after: after?.url, comps, avg };
};

const appraisals: Appraisal[] = [];
export async function listAppraisals(jobId?: string): Promise<Appraisal[]> { return appraisals.filter((a) => !jobId || a.jobId === jobId).map((a) => ({ ...a })); }
export async function getAppraisal(id: string): Promise<Appraisal> { const a = appraisals.find((x) => x.id === id); if (!a) throw new Error('Appraisal not found'); return { ...a }; }
export async function createAppraisal(jobId: string): Promise<Appraisal> {
  const p = await pull(jobId); const ac = b.actor();
  const a: Appraisal = { id: b.newId('apr'), number: nextNumber(), jobId, jobNumber: p.j.number, createdAt: new Date().toISOString(), by: ac.by, date: new Date().toISOString().slice(0, 10), purpose: 'Insurance', entity: b.jobDivision(jobId), fields: p.fields, authenticity: p.authenticity, beforePhotoUrl: p.before, afterPhotoUrl: p.after, value: p.avg, valueSource: p.avg ? 'placeholder' : 'none', comparables: p.comps, status: 'draft' };
  appraisals.unshift(a); b.jobStamp(jobId, `Appraisal draft ${a.number} created${p.avg ? ` · placeholder value ${money(p.avg)} (avg insured value of ${p.comps.length} shipments of ref ${p.fields.reference})` : ' · no comparable invoice data'}`); return { ...a };
}
export async function updateAppraisal(id: string, patch: Partial<Pick<Appraisal, 'date' | 'purpose' | 'fields' | 'authenticity' | 'value'>>): Promise<Appraisal> {
  const a = appraisals.find((x) => x.id === id); if (!a) throw new Error('Appraisal not found'); if (a.status === 'final') throw new Error('Finalized appraisals are locked');
  if (patch.value !== undefined) { a.value = patch.value; a.valueSource = patch.value === null ? 'none' : 'confirmed'; } if (patch.fields) a.fields = { ...a.fields, ...patch.fields }; if (patch.date) a.date = patch.date; if (patch.purpose) a.purpose = patch.purpose; if (patch.authenticity !== undefined) a.authenticity = patch.authenticity;
  return { ...a };
}
// After-work photo — its own slot on the job so it is always identifiable as "after", never mixed into the intake set
export async function attachAfterPhoto(id: string, dataUrl: string): Promise<Appraisal> {
  const a = appraisals.find((x) => x.id === id); if (!a) throw new Error('Appraisal not found'); const j = b.job(a.jobId); const ac = b.actor();
  if (j) addJobPhotoSync(j, { id: b.newId('after'), dataUrl, slot: 'after-work', fileName: 'After work', photoType: 'post_work', by: ac.by, station: ac.station, stamp: false });
  a.afterPhotoUrl = dataUrl; b.jobStamp(a.jobId, `After-work photo attached · ${a.number}`); return { ...a };
}
export async function finalizeAppraisal(id: string, signerId?: string): Promise<Appraisal> {
  const a = appraisals.find((x) => x.id === id); if (!a) throw new Error('Appraisal not found'); if (a.valueSource !== 'confirmed') throw new Error('Confirm the appraised value before finalizing');
  const ac = b.actor(); const list = signersFor(a.entity, ac.user?.shortName); const sg = list.find((x) => x.id === (signerId ?? list[0]?.id)); if (!sg) throw new Error('No signer configured for this entity');
  if (!sg.authorized) throw new Error(`Not authorized to sign for ${ENTITY_NAME[a.entity]} — only ${sg.name} can apply this signature`);
  a.status = 'final'; a.signedAt = new Date().toISOString(); a.signedBy = sg.name; a.signedByShortName = sg.shortName; a.signatureId = sg.id; a.signatureUrl = sg.image;
  b.jobStamp(a.jobId, `Appraisal ${a.number} finalized & signed by ${sg.name} (${ENTITY_NAME[a.entity]} · stored signature ${sg.id}) · ${money(a.value ?? 0)} · ${a.purpose}`); return { ...a };
}
export const fmtValue = money;
// Seed: completed job j-08 (Naomi Castellanos · Rolex OP 41 · ref 124300) — full draft, value unconfirmed, signature empty
void (async () => { const a = await createAppraisal('j-08'); const j = b.job('j-08'); const before = 'https://picsum.photos/seed/before-op41/640/480'; const after = 'https://picsum.photos/seed/after-op41/640/480'; if (j) { j.photos.push({ id: 'before-j08', source: 'camera', dataUrl: before, slot: 'Arrival', fileName: 'Arrival · dial up', at: new Date(Date.now() - 38 * 864e5).toISOString(), by: 'Vienna', station: 'Front Desk 1' }); j.photos.unshift({ id: 'after-j08', source: 'camera', dataUrl: after, slot: 'after-work', fileName: 'After work', at: new Date(Date.now() - 3600e3).toISOString(), by: 'Walter', station: 'WM Bench 1' }); const x = appraisals.find((y) => y.id === a.id); if (x) { x.beforePhotoUrl = x.beforePhotoUrl ?? before; x.afterPhotoUrl = after; } } })();
