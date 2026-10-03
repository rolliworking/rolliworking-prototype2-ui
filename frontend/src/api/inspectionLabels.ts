import { addJobPhotoSync, benchBridge as b } from './client';
import * as hl from './hitlist';
import type { PhotoDataClass } from './types';

// ---- INSPECTION LABELS (MH 2026-09-30) — scantron opinion rows ↔ guided per-component photos ↔ findings tags. Opinions are revisable; nothing here is a verdict.
// Every label carries {jobId, component, opinion, confidence, variant, tags[], notes, ref, serialEra, model, by, at, station, revision}. Data out = m3ke `inspection_opinion` + a read-only WatchM8 export record (11-INTEGRATIONS: WatchM8 seam).
export type LabelComponent = 'dial' | 'hands' | 'bezel' | 'bracelet' | 'case' | 'crown' | 'crystal' | 'movement';
export const COMPONENTS: { key: LabelComponent; label: string; short: string; opened?: boolean }[] = [
  { key: 'dial', label: 'Dial', short: 'DL' }, { key: 'hands', label: 'Hands', short: 'HD' }, { key: 'bezel', label: 'Bezel insert', short: 'BZ' }, { key: 'bracelet', label: 'Bracelet', short: 'BR' },
  { key: 'case', label: 'Case', short: 'CS' }, { key: 'crown', label: 'Crown', short: 'CN' }, { key: 'crystal', label: 'Crystal', short: 'CY' }, { key: 'movement', label: 'Movement', short: 'MV', opened: true },
];
export const componentLabel = (c: LabelComponent) => COMPONENTS.find((x) => x.key === c)?.label ?? c;
export type Opinion = 'genuine_original' | 'genuine_service' | 'aftermarket' | 'counterfeit' | 'undetermined' | 'na';
export const OPINIONS: { key: Opinion; label: string; short: string }[] = [
  { key: 'genuine_original', label: 'Genuine – original', short: 'G-orig' }, { key: 'genuine_service', label: 'Genuine – service replacement', short: 'G-service' },
  { key: 'aftermarket', label: 'Aftermarket', short: 'AM' }, { key: 'counterfeit', label: 'Counterfeit', short: 'CF' }, { key: 'undetermined', label: 'Undetermined', short: 'U' }, { key: 'na', label: 'N/A', short: 'N/A' },
];
export const opinionLabel = (o: Opinion) => OPINIONS.find((x) => x.key === o)?.label ?? o;
export type Confidence = 'sure' | 'likely' | 'unsure';
export const NOT_GENUINE: Opinion[] = ['aftermarket', 'counterfeit'];

export interface OpinionLabel { id: string; jobId: string; component: LabelComponent; opinion: Opinion; confidence: Confidence; variant?: string; variantCandidateId?: string; tags: string[]; notes?: string; ref: string; serialEra: string; model: string; by: string; at: string; station: string; revision: number; shareable: boolean; secondOpinion?: boolean; specimen?: boolean }
export interface OpinionInput { opinion: Opinion; confidence: Confidence; variant?: string; tags?: string[]; notes?: string }

// ---- Guided shot lists (v1) — editable in Setup → Inspection shots. Crown / crystal ride on the case shots (crown + guards · crystal/cyclops) so they carry an opinion row only.
export type ShotCam = 'ipevo' | 'microscope';
export interface ShotDef { key: string; label: string; cam: ShotCam }
const shot = (label: string, cam: ShotCam = 'microscope'): ShotDef => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label, cam });
export const shotLists: Record<LabelComponent, ShotDef[]> = {
  dial: ['TL quadrant', 'TR quadrant', 'BR quadrant', 'BL quadrant', 'Coronet / logo at 12', 'Text at 6', 'Bottom printing (SWISS MADE / T<25)', 'Lume plots macro'].map((l) => shot(l)).concat([shot('Full dial straight-on', 'ipevo')]),
  hands: ['Hour + minute macro', 'Seconds hand', 'Hand lume', 'Pinion'].map((l) => shot(l)),
  bezel: [shot('Insert straight-on', 'ipevo'), shot('Pearl / triangle'), shot('Numerals macro'), shot('Coin edge profile', 'ipevo')],
  bracelet: [shot('Clasp code stamp'), shot('Clasp inside', 'ipevo'), shot('End links + lugs', 'ipevo'), shot('3-link macro'), shot('Full bracelet', 'ipevo')],
  case: [shot('Caseback', 'ipevo'), shot('Serial / ref between lugs'), shot('Crown + guards', 'ipevo'), shot('Lug profile', 'ipevo'), shot('Rehaut engraving'), shot('Crystal / cyclops', 'ipevo')],
  movement: [shot('Caliber marking'), shot('Rotor', 'ipevo'), shot('Balance'), shot('Movement serial')],
  crown: [], crystal: [],
};
export const setShotList = (c: LabelComponent, labels: string[]) => { shotLists[c] = labels.filter((l) => l.trim()).map((l) => { const prev = shotLists[c].find((s) => s.label === l); return prev ?? shot(l); }); };

// Every photo: unprocessed original + display version, tagged {jobId, component, shotName, station, cameraId, lightingPreset, by, at}; controlled = fixed kiosk / inspection-station rig (the training set); bench-pad ad-hoc = false
export interface InspectionShot { id: string; jobId: string; component: LabelComponent; shotKey: string; shotName: string; station: string; cameraId: string; lightingPreset: string; by: string; at: string; originalUrl: string; displayUrl: string; controlled: boolean; retakes: number; adHoc?: boolean; tags: string[]; dataClass: PhotoDataClass }
const shots: InspectionShot[] = [];
const CONTROLLED_STATION = /kiosk|inspection|photo station|camera/i;
export const isControlledStation = (station: string) => CONTROLLED_STATION.test(station);

// ---- Findings tags — per-component vocabulary; unknown tags are added flagged `new` until a manager confirms / merges in Setup → Inspection tags
export interface TagDef { component: LabelComponent; tag: string; uses: number; status: 'confirmed' | 'new'; addedBy?: string; at?: string }
const SEED_TAGS: Partial<Record<LabelComponent, string[]>> = {
  dial: ['lume', 'plots', 'font', 'printing', 'coronet', 'texture', 'spacing', 'relume'], hands: ['hand-lume', 'shape', 'finish'], bezel: ['numeral-font', 'pearl', 'color', 'coin-edge'],
  bracelet: ['clasp-code', 'end-links', 'finishing', 'stretch'], case: ['rehaut', 'serial-engraving', 'lug-profile', 'caseback-engraving', 'crown-guards'],
};
const tags: TagDef[] = Object.entries(SEED_TAGS).flatMap(([c, list]) => list!.map((t, i) => ({ component: c as LabelComponent, tag: t, uses: Math.max(1, 9 - i), status: 'confirmed' as const })));
export const normTag = (t: string) => t.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
export const tagsFor = (c: LabelComponent) => tags.filter((t) => t.component === c).sort((a, b) => b.uses - a.uses || a.tag.localeCompare(b.tag));
export const topTags = (c: LabelComponent, n = 8) => tagsFor(c).slice(0, n);
export const matchTags = (c: LabelComponent, q: string) => { const s = normTag(q); return tagsFor(c).filter((t) => !s || t.tag.includes(s) || s.split('-').every((p) => t.tag.includes(p))).slice(0, 6); };
export const knownTag = (c: LabelComponent, t: string) => tags.some((x) => x.component === c && x.tag === normTag(t));
export const addTag = (c: LabelComponent, t: string) => { const tag = normTag(t); if (!tag || knownTag(c, tag)) return; tags.push({ component: c, tag, uses: 0, status: 'new', addedBy: b.actor().by, at: new Date().toISOString() }); };
export const confirmTag = (c: LabelComponent, t: string) => { const x = tags.find((y) => y.component === c && y.tag === t); if (x) x.status = 'confirmed'; };
export const mergeTag = (c: LabelComponent, from: string, into: string) => {
  const i = tags.findIndex((y) => y.component === c && y.tag === from); const target = tags.find((y) => y.component === c && y.tag === into); if (i < 0 || !target) return;
  target.uses += tags[i].uses; tags.splice(i, 1); labels.forEach((l) => { if (l.component === c && l.tags.includes(from)) l.tags = Array.from(new Set(l.tags.map((x) => (x === from ? into : x)))); });
};
export const allTags = () => tags.map((t) => ({ ...t }));
const bumpTags = (c: LabelComponent, list: string[]) => list.forEach((t) => { const x = tags.find((y) => y.component === c && y.tag === t); if (x) x.uses += 1; else addTag(c, t); });

// ---- Variant sets — per ref × component; exemplars are OUR photos only (job id, chosen by, date, version; replaceable, history kept)
export interface Exemplar { id: string; url: string; jobId: string; shot: string; chosenBy: string; at: string; version: number; dataClass: 'specimen' }
export interface Variant { key: string; tells: string; exemplars: Exemplar[]; history: Exemplar[] }
export interface VariantSet { id: string; ref: string; component: LabelComponent; variants: Variant[] }
export interface VariantCandidate { id: string; ref: string; component: LabelComponent; jobId: string; photoUrl?: string; by: string; at: string; note?: string; status: 'pending' | 'promoted' | 'rejected'; promotedAs?: string }
const pic = (seed: string) => `https://picsum.photos/seed/${seed}/320/240`;
const TOP_REFS = ['126334', '126610LN', '126710BLRO', '228238', 'M79030N-0001', '5513', '279174', '124300', '126711CHNR', '278274'];
const mkVariant = (ref: string, c: LabelComponent, key: string, tells: string, n: number): Variant => ({ key, tells, exemplars: Array.from({ length: n }, (_, i) => ({ id: `ex-${ref}-${c}-${key}-${i}`, url: pic(`${ref}-${c}-${key}-${i}`), jobId: ['j-08', 'j-r1', 'j-30', 'j-04'][i % 4], shot: c === 'dial' ? 'coronet_logo_at_12' : 'numerals_macro', chosenBy: 'MH', at: new Date(Date.now() - (30 + i * 7) * 864e5).toISOString(), version: 1, dataClass: 'specimen' })), history: [] });
const DIAL_TELLS = ['Flat coronet, tight SWISS MADE spacing', 'Taller coronet, T<25 flanking, thicker plots', 'Laser-cut plots, wider text at 6', 'Service dial — Super-LumiNova, crisp printing'];
const INSERT_TELLS = ['Fat font numerals, pearl flush', 'Thin font, raised pearl', 'Ceramic — platinum-filled numerals'];
const variantSets: VariantSet[] = TOP_REFS.flatMap((ref) => [
  { id: `vs-${ref}-dial`, ref, component: 'dial' as LabelComponent, variants: DIAL_TELLS.slice(0, ref === '124300' || ref === '126610LN' ? 4 : 3).map((t, i) => mkVariant(ref, 'dial', `MK${i + 1}`, t, i === 0 ? 3 : i === 1 ? 2 : 1)) },
  { id: `vs-${ref}-bezel`, ref, component: 'bezel' as LabelComponent, variants: INSERT_TELLS.map((t, i) => mkVariant(ref, 'bezel', `MK${i + 1}`, t, i === 0 ? 2 : 1)) },
]);
const candidates: VariantCandidate[] = [];
export const variantSetFor = (ref: string, c: LabelComponent) => variantSets.find((v) => v.ref.toUpperCase() === ref.toUpperCase() && v.component === c) ?? null;
export const allVariantSets = () => variantSets.map((v) => ({ ...v, variants: v.variants.map((x) => ({ ...x })) }));
export const marksUsedFor = (ref: string, c: LabelComponent) => Array.from(new Set(labels.filter((l) => l.ref === ref && l.component === c && l.variant && !/^unsure$/i.test(l.variant)).map((l) => l.variant!)));
export const proposeVariant = (ref: string, c: LabelComponent, jobId: string, note?: string) => { const a = b.actor(); const latest = shotsFor(jobId, c)[0]; const cand: VariantCandidate = { id: b.newId('vc'), ref, component: c, jobId, photoUrl: latest?.displayUrl, by: a.by, at: new Date().toISOString(), note, status: 'pending' }; candidates.unshift(cand); return cand; };
export const pendingCandidates = () => candidates.filter((c) => c.status === 'pending');
export const allCandidates = () => [...candidates];
export const promoteCandidate = (id: string, key: string, tells: string) => {
  const c = candidates.find((x) => x.id === id); if (!c) return; const a = b.actor();
  let set = variantSetFor(c.ref, c.component); if (!set) { set = { id: `vs-${c.ref}-${c.component}`, ref: c.ref, component: c.component, variants: [] }; variantSets.push(set); }
  set.variants.push({ key, tells, exemplars: c.photoUrl ? [{ id: b.newId('ex'), url: c.photoUrl, jobId: c.jobId, shot: 'candidate', chosenBy: a.by, at: new Date().toISOString(), version: 1, dataClass: 'specimen' }] : [], history: [] });
  c.status = 'promoted'; c.promotedAs = key; labels.filter((l) => l.variantCandidateId === id).forEach((l) => { l.variant = key; });
};
export const rejectCandidate = (id: string) => { const c = candidates.find((x) => x.id === id); if (c) c.status = 'rejected'; };
export const replaceExemplar = (setId: string, key: string, exemplarId: string, url: string, jobId: string) => {
  const v = variantSets.find((s) => s.id === setId)?.variants.find((x) => x.key === key); if (!v) return; const i = v.exemplars.findIndex((e) => e.id === exemplarId); if (i < 0) return;
  const old = v.exemplars[i]; v.history.unshift(old); v.exemplars[i] = { id: b.newId('ex'), url, jobId, shot: old.shot, chosenBy: b.actor().by, at: new Date().toISOString(), version: old.version + 1, dataClass: 'specimen' };
};

// ---- Labels (all revisions kept) + blind second opinions
const labels: OpinionLabel[] = [];
export interface SecondOpinionRequest { id: string; jobId: string; component: LabelComponent; requestedBy: string; at: string; submittedBy?: string; submittedAt?: string; labelId?: string; agree?: boolean }
const secondOpinions: SecondOpinionRequest[] = [];
const inherit = (jobId: string) => { const j = b.job(jobId); const w = b.watch(j?.watchId); const d = w ? b.decode(w.serial, w.reference) : null; return { ref: w?.reference ?? '', model: w ? `${w.brand} ${w.model}` : '', serialEra: d?.era ?? (w ? `${w.serial.slice(0, 1)}-prefix` : '') }; };
export const inheritedFor = (jobId: string) => inherit(jobId);
export const primaryLabels = (jobId: string) => labels.filter((l) => l.jobId === jobId && !l.secondOpinion);
export const latestFor = (jobId: string, c: LabelComponent) => primaryLabels(jobId).filter((l) => l.component === c).sort((a, b2) => b2.revision - a.revision)[0] ?? null;
export const latestLabels = (jobId: string) => COMPONENTS.map((c) => latestFor(jobId, c.key)).filter((x): x is OpinionLabel => !!x);
export const revisionsFor = (jobId: string, c: LabelComponent) => primaryLabels(jobId).filter((l) => l.component === c).sort((a, b2) => b2.revision - a.revision);
export const secondOpinionFor = (jobId: string, c: LabelComponent) => secondOpinions.find((r) => r.jobId === jobId && r.component === c) ?? null;
export const secondLabelFor = (jobId: string, c: LabelComponent) => { const r = secondOpinionFor(jobId, c); return r?.labelId ? labels.find((l) => l.id === r.labelId) ?? null : null; };
// Sheet is complete when every component carries an opinion (N/A counts)
export const sheetComplete = (jobId: string) => COMPONENTS.every((c) => !!latestFor(jobId, c.key));
const emit = (l: OpinionLabel) => { b.m3ke({ id: b.newId('m3'), kind: 'inspection_opinion', description: `${componentLabel(l.component)} · ${opinionLabel(l.opinion)} (${l.confidence})${l.variant ? ` · ${l.variant}` : ''}${l.tags.length ? ` · ${l.tags.map((t) => `#${t}`).join(' ')}` : ''}`, reference: l.ref, partId: l.id, partNumber: `OPINION r${l.revision}`, resolvedBy: l.by, ts: l.at }); };
const mkLabel = (jobId: string, c: LabelComponent, input: OpinionInput, extra: Partial<OpinionLabel> = {}): OpinionLabel => {
  const a = b.actor(); const list = (input.tags ?? []).map(normTag).filter(Boolean); bumpTags(c, list);
  return { id: b.newId('lbl'), jobId, component: c, opinion: input.opinion, confidence: input.confidence, variant: input.variant?.trim() || undefined, tags: Array.from(new Set(list)), notes: input.notes?.trim() || undefined, ...inherit(jobId), by: extra.by ?? a.by, at: extra.at ?? new Date().toISOString(), station: extra.station ?? a.station, revision: extra.revision ?? 1, shareable: false, ...extra };
};
// Completing a row writes a label; a later save on the same component appends revision n+1 (history kept, latest shows)
export const saveOpinion = (jobId: string, c: LabelComponent, input: OpinionInput & { variantCandidateId?: string }): OpinionLabel => {
  const prev = latestFor(jobId, c); const l = mkLabel(jobId, c, input, { revision: (prev?.revision ?? 0) + 1, variantCandidateId: input.variantCandidateId, shareable: prev?.shareable ?? false });
  if (NOT_GENUINE.includes(l.opinion)) l.specimen = true;
  labels.push(l); emit(l); shots.filter((s) => s.jobId === jobId && s.component === c).forEach((s) => { s.tags = l.tags; });
  b.jobStamp(jobId, `Inspection opinion · ${componentLabel(c)} → ${opinionLabel(l.opinion)} (${l.confidence})${l.variant ? ` · ${l.variant}` : ''}${l.revision > 1 ? ` · revision ${l.revision}` : ''}${NOT_GENUINE.includes(l.opinion) ? ' · SPECIMEN CAPTURE required before release' : ''}`);
  const so = secondOpinionFor(jobId, c); if (so?.labelId) { const sl = labels.find((x) => x.id === so.labelId); if (sl) so.agree = sl.opinion === l.opinion; }
  return l;
};
export const setShareable = (labelId: string, on: boolean) => { const l = labels.find((x) => x.id === labelId); if (!l) return; l.shareable = on; primaryLabels(l.jobId).filter((x) => x.component === l.component).forEach((x) => { x.shareable = on; }); };
export const requestSecondOpinion = (jobId: string, c: LabelComponent) => { if (secondOpinionFor(jobId, c)) return; const a = b.actor(); secondOpinions.push({ id: b.newId('so'), jobId, component: c, requestedBy: a.by, at: new Date().toISOString() }); b.jobStamp(jobId, `Blind second opinion requested · ${componentLabel(c)}`); };
// Blind: the second inspector sees photos + shot list but NOT the first opinion until they submit
export const blindFor = (jobId: string, c: LabelComponent, viewer: string) => { const r = secondOpinionFor(jobId, c); const first = latestFor(jobId, c); return !!r && !r.submittedAt && !!first && first.by !== viewer && r.requestedBy !== viewer; };
export const submitSecondOpinion = (jobId: string, c: LabelComponent, input: OpinionInput) => {
  const r = secondOpinionFor(jobId, c); if (!r || r.submittedAt) throw new Error('No open second-opinion request'); const l = mkLabel(jobId, c, input, { secondOpinion: true }); labels.push(l); emit(l);
  const first = latestFor(jobId, c); r.submittedBy = l.by; r.submittedAt = l.at; r.labelId = l.id; r.agree = first ? first.opinion === l.opinion : undefined;
  b.jobStamp(jobId, `Second opinion · ${componentLabel(c)} → ${opinionLabel(l.opinion)} (${l.confidence}) · ${r.agree ? 'AGREES' : 'DISAGREES'} with ${first?.by ?? 'first'}`); return l;
};
// Reports metric — label quality
export const labelQuality = () => { const done = secondOpinions.filter((r) => r.submittedAt); const agree = done.filter((r) => r.agree).length; return { requested: secondOpinions.length, submitted: done.length, agree, disagree: done.length - agree, rate: done.length ? Math.round((agree / done.length) * 100) : null, rows: secondOpinions.map((r) => ({ ...r })) }; };

// ---- Shots
export const shotsFor = (jobId: string, c?: LabelComponent) => shots.filter((s) => s.jobId === jobId && (!c || s.component === c)).sort((a, b2) => b2.at.localeCompare(a.at));
export const shotFor = (jobId: string, c: LabelComponent, key: string) => shots.find((s) => s.jobId === jobId && s.component === c && s.shotKey === key) ?? null;
export const listProgress = (jobId: string, c: LabelComponent) => { const list = shotLists[c]; const have = list.filter((d) => shotFor(jobId, c, d.key)).length; return { have, total: list.length, complete: list.length > 0 && have === list.length }; };
export interface RecordShotInput { jobId: string; component: LabelComponent; shotKey: string; dataUrl: string; cameraId: string; lightingPreset?: string; controlled?: boolean; adHoc?: boolean }
export const recordShot = (i: RecordShotInput): InspectionShot => {
  const a = b.actor(); const def = shotLists[i.component].find((d) => d.key === i.shotKey); const prev = i.adHoc ? null : shotFor(i.jobId, i.component, i.shotKey); const controlled = i.controlled ?? isControlledStation(a.station); const at = new Date().toISOString();
  // Data class by purpose: a guided shot on the controlled rig is corpus (specimen); a bench ad-hoc shot stays operational — it carries labels but never leaves
  const dataClass: PhotoDataClass = controlled ? 'specimen' : 'operational';
  const s: InspectionShot = { id: prev?.id ?? b.newId('ish'), jobId: i.jobId, component: i.component, shotKey: i.shotKey, shotName: def?.label ?? (i.adHoc ? 'Ad-hoc' : i.shotKey), station: a.station, cameraId: i.cameraId, lightingPreset: i.lightingPreset ?? (controlled ? 'station-fixed' : 'ambient'), by: a.by, at, originalUrl: i.dataUrl, displayUrl: i.dataUrl, controlled, retakes: prev ? prev.retakes + 1 : 0, adHoc: i.adHoc, tags: latestFor(i.jobId, i.component)?.tags ?? [], dataClass };
  if (prev) shots[shots.indexOf(prev)] = s; else shots.push(s);
  const j = b.job(i.jobId); if (j) addJobPhotoSync(j, { id: s.id, dataUrl: i.dataUrl, slot: `insp-${i.component}-${i.shotKey}`, fileName: `${componentLabel(i.component)} · ${s.shotName}${controlled ? '' : ' · ad-hoc'}`, photoType: 'inspection', dataClass, at, by: a.by, station: a.station, replaceSlot: !i.adHoc, stamp: false });
  const p = listProgress(i.jobId, i.component); if (p.complete && !prev) b.jobStamp(i.jobId, `Guided shots complete · ${componentLabel(i.component)} · ${p.total} shots · ${controlled ? 'controlled rig' : 'bench ad-hoc'}`);
  return s;
};

// ---- Specimen capture (item 7) — any Aftermarket / Counterfeit → full controlled shot list on every component before release; manager may waive with reason
export interface SpecimenStatus { required: boolean; done: boolean; waived?: { by: string; reason: string; at: string }; missing: { component: LabelComponent; label: string; have: number; total: number }[]; offerToAcquire: boolean; flagged: LabelComponent[] }
const waivers: Record<string, { by: string; reason: string; at: string }> = {}; const acquire = new Set<string>();
export const specimenStatus = (jobId: string): SpecimenStatus => {
  const latest = latestLabels(jobId); const flagged = latest.filter((l) => NOT_GENUINE.includes(l.opinion)).map((l) => l.component); const required = flagged.length > 0;
  const comps = COMPONENTS.filter((c) => shotLists[c.key].length && latestFor(jobId, c.key)?.opinion !== 'na');
  const missing = comps.map((c) => { const list = shotLists[c.key]; const have = list.filter((d) => { const s = shotFor(jobId, c.key, d.key); return s && s.controlled; }).length; return { component: c.key, label: c.label, have, total: list.length }; }).filter((m) => m.have < m.total);
  return { required, done: required && missing.length === 0, waived: waivers[jobId], missing, offerToAcquire: acquire.has(jobId), flagged };
};
export const waiveSpecimen = (jobId: string, reason: string) => { const a = b.actor(); waivers[jobId] = { by: a.by, reason, at: new Date().toISOString() }; b.jobStamp(jobId, `Specimen capture WAIVED by ${a.by} — ${reason}`); };
export const setOfferToAcquire = (jobId: string, on: boolean) => { if (on === acquire.has(jobId)) return; if (on) acquire.add(jobId); else acquire.delete(jobId); const j = b.job(jobId); b.jobStamp(jobId, on ? 'Offer to acquire — flagged for MH' : 'Offer to acquire — withdrawn'); if (on) void hl.sendMessage({ to: { type: 'user', shortName: 'MH' }, text: `Offer to acquire? ${j?.number ?? jobId} — not-genuine component(s) marked at inspection. Decide before release.`, jobId }); };
export const pickupGate = (jobId: string) => { const s = specimenStatus(jobId); return s.required && !s.done && !s.waived ? s : null; };

// ---- Data out — WatchM8 export (read-only from RS). Class filter lives here: only SPECIMEN photos are listed; operational / identity never appear in a record.
export interface WatchM8Record { id: string; labelId: string; jobId: string; jobNumber: string; ref: string; serialEra: string; model: string; component: LabelComponent; opinion: Opinion; confidence: Confidence; variant?: string; tags: string[]; photoIds: string[]; controlledPhotos: number; excludedPhotos: number; by: string; at: string; revision: number; secondOpinion: boolean; specimen: boolean }
export const watchm8Export = (jobId?: string): WatchM8Record[] => labels.filter((l) => !jobId || l.jobId === jobId).map((l) => { const all = shotsFor(l.jobId, l.component); const ph = all.filter((p) => p.dataClass === 'specimen'); return { id: `wm8-${l.id}`, labelId: l.id, jobId: l.jobId, jobNumber: b.job(l.jobId)?.number ?? l.jobId, ref: l.ref, serialEra: l.serialEra, model: l.model, component: l.component, opinion: l.opinion, confidence: l.confidence, variant: l.variant, tags: l.tags, photoIds: ph.map((p) => p.id), controlledPhotos: ph.filter((p) => p.controlled).length, excludedPhotos: all.length - ph.length, by: l.by, at: l.at, revision: l.revision, secondOpinion: !!l.secondOpinion, specimen: !!l.specimen }; }).sort((a, b2) => b2.at.localeCompare(a.at));
export const specimenShots = (): InspectionShot[] => shots.filter((s) => s.dataClass === 'specimen');

// ---- Seed (lazy — needs the job store): j-08 all Genuine – original, dial MK4 by MH (sure) · j-r1 Dial = Counterfeit by MH (likely, #lume #font) + blind second opinion MM = Aftermarket (disagreement) · j-30 Bezel = Genuine – service replacement. Guided lists complete on all three; one bench ad-hoc dial photo (j-r1) controlled=false.
let seeded = false;
const seedShotList = (jobId: string, c: LabelComponent, by: string, station: string, daysAgo: number) => shotLists[c].forEach((d, i) => { shots.push({ id: `ish-${jobId}-${c}-${d.key}`, jobId, component: c, shotKey: d.key, shotName: d.label, station, cameraId: d.cam === 'ipevo' ? 'IPEVO V4K' : 'HY-3307 microscope', lightingPreset: 'station-fixed', by, at: new Date(Date.now() - daysAgo * 864e5 + i * 45e3).toISOString(), originalUrl: pic(`insp-${jobId}-${c}-${d.key}`), displayUrl: pic(`insp-${jobId}-${c}-${d.key}`), controlled: true, retakes: 0, tags: [], dataClass: 'specimen' }); });
const seedLabel = (jobId: string, c: LabelComponent, input: OpinionInput, by: string, station: string, daysAgo: number, extra: Partial<OpinionLabel> = {}) => { const l = mkLabel(jobId, c, input, { by, station, at: new Date(Date.now() - daysAgo * 864e5).toISOString(), ...extra }); labels.push(l); return l; };
export const ensureSeed = () => {
  if (seeded || !b.job('j-08')) return; seeded = true;
  const stationA = 'Inspection Station 1', stationK = 'Watchmaker Room Kiosk';
  for (const [jobId, by, days] of [['j-08', 'MH', 12], ['j-r1', 'MH', 3], ['j-30', 'MM', 1]] as const) COMPONENTS.filter((c) => shotLists[c.key].length).forEach((c) => seedShotList(jobId, c.key, by, jobId === 'j-30' ? stationK : stationA, days));
  // one bench-pad ad-hoc dial photo on j-r1 — controlled=false, not training data
  shots.push({ id: 'ish-j-r1-dial-adhoc', jobId: 'j-r1', component: 'dial', shotKey: 'adhoc_1', shotName: 'Ad-hoc · lume under UV', station: 'Bench 1 iPad', cameraId: 'iPad rear', lightingPreset: 'ambient', by: 'Leo', at: new Date(Date.now() - 2.5 * 864e5).toISOString(), originalUrl: pic('insp-j-r1-dial-adhoc'), displayUrl: pic('insp-j-r1-dial-adhoc'), controlled: false, retakes: 0, adHoc: true, tags: [], dataClass: 'operational' });
  COMPONENTS.forEach((c) => seedLabel('j-08', c.key, { opinion: c.key === 'movement' ? 'na' : 'genuine_original', confidence: 'sure', variant: c.key === 'dial' ? 'MK4' : undefined, tags: c.key === 'dial' ? ['coronet', 'printing'] : [] }, 'MH', stationA, 12));
  COMPONENTS.forEach((c) => seedLabel('j-r1', c.key, c.key === 'dial' ? { opinion: 'counterfeit', confidence: 'likely', variant: 'Unsure', tags: ['lume', 'font'], notes: 'Lume plots sit proud and the 6 o’clock text is heavier than the MK2 exemplar. Would not stake the shop on it — second pair of eyes please.' } : { opinion: c.key === 'movement' ? 'undetermined' : 'genuine_original', confidence: c.key === 'movement' ? 'unsure' : 'sure', tags: [] }, 'MH', stationA, 3, c.key === 'dial' ? { specimen: true } : {}));
  secondOpinions.push({ id: 'so-01', jobId: 'j-r1', component: 'dial', requestedBy: 'MH', at: new Date(Date.now() - 2.9 * 864e5).toISOString() });
  const mm = seedLabel('j-r1', 'dial', { opinion: 'aftermarket', confidence: 'likely', variant: 'Unsure', tags: ['lume', 'relume'], notes: 'Reads as a relumed aftermarket dial rather than a full counterfeit — plots are replaced, base printing is period-correct.' }, 'MM', stationA, 2.6, { secondOpinion: true });
  Object.assign(secondOpinions[0], { submittedBy: 'MM', submittedAt: mm.at, labelId: mm.id, agree: false });
  COMPONENTS.forEach((c) => seedLabel('j-30', c.key, { opinion: c.key === 'bezel' ? 'genuine_service' : c.key === 'movement' ? 'na' : 'genuine_original', confidence: c.key === 'bezel' ? 'sure' : 'likely', variant: c.key === 'bezel' ? 'MK3' : c.key === 'dial' ? 'MK1' : undefined, tags: c.key === 'bezel' ? ['numeral-font', 'pearl'] : [] }, 'MM', stationK, 1));
  labels.forEach((l) => shotsFor(l.jobId, l.component).forEach((s) => { s.tags = l.tags; }));
  // The j-30 bezel shot list also rides the job's photo pipeline (specimen class) so the staff grid shows the class split
  const j30 = b.job('j-30'); if (j30) shotsFor('j-30', 'bezel').forEach((s) => { if (!j30.photos.some((p) => p.id === s.id)) addJobPhotoSync(j30, { id: s.id, dataUrl: s.displayUrl, slot: `insp-bezel-${s.shotKey}`, fileName: `Bezel insert · ${s.shotName}`, photoType: 'inspection', dataClass: 'specimen', at: s.at, by: s.by, station: s.station, stamp: false }); });
};

// Eager: the module is only ever loaded by screens that need the seed, and the job store exists by then
ensureSeed();
