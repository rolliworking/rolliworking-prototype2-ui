import type { DeptCode, LineType } from './types';
import { actorInfo, auditAppointments as audit } from './client';

// ---- Job templates — built for volume (legacy has 100+). Applying one sets the job's W/B/P/PM chips (VB10-04); legacy imports carry inferred flags until a human confirms.
export interface JobTemplateLine { id: string; description: string; dept: DeptCode; type: LineType; qty: number; unitPrice: number }
export interface JobTemplate { id: string; name: string; category: string; depts: DeptCode[]; inferredDepts: DeptCode[]; lines: JobTemplateLine[]; source: 'legacy' | 'new'; reviewed: boolean; reviewedBy?: string; reviewedAt?: string; archived: boolean; createdAt: string; updatedAt: string; updatedBy: string; usedCount: number }
export interface JobTemplateInput { id?: string; name: string; category: string; depts: DeptCode[]; lines: Omit<JobTemplateLine, 'id'>[] }
export interface JobTemplateFilter { q?: string; category?: string; dept?: DeptCode; unreviewedOnly?: boolean; includeArchived?: boolean }

export const JOB_TEMPLATE_CATEGORIES = ['Complete service', 'Movement', 'Case & refinish', 'Bracelet', 'Battery / quartz', 'Water resistance', 'Vintage', 'Trade / B2B'];
export const inferDepts = (lines: { dept: DeptCode }[]): DeptCode[] => (['W', 'B', 'P', 'PM'] as DeptCode[]).filter((d) => lines.some((l) => l.dept === d));

let seq = 0; const lid = () => `jtl-${(seq += 1)}`;
const L = (description: string, dept: DeptCode, unitPrice: number, type: LineType = 'service', qty = 1): JobTemplateLine => ({ id: lid(), description, dept, type, qty, unitPrice });
const dAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const T = (id: string, name: string, category: string, lines: JobTemplateLine[], o: { reviewed?: boolean; depts?: DeptCode[]; source?: 'legacy' | 'new'; used?: number; archived?: boolean } = {}): JobTemplate => {
  const inferred = inferDepts(lines); const reviewed = o.reviewed ?? false;
  return { id, name, category, depts: o.depts ?? inferred, inferredDepts: inferred, lines, source: o.source ?? 'legacy', reviewed, reviewedBy: reviewed ? 'MH' : undefined, reviewedAt: reviewed ? dAgo(4) : undefined, archived: o.archived ?? false, createdAt: dAgo(400), updatedAt: dAgo(reviewed ? 4 : 30), updatedBy: reviewed ? 'MH' : 'legacy import', usedCount: o.used ?? 0 };
};
const templates: JobTemplate[] = [
  T('jt-01', 'Complete service — cal. 3135', 'Complete service', [L('Complete movement service — cal. 3135', 'W', 1250), L('Gasket set', 'W', 45, 'part'), L('Pressure test', 'W', 0), L('Case & bracelet refinish', 'P', 320)], { reviewed: true, used: 212 }),
  T('jt-02', 'Complete service — cal. 3235', 'Complete service', [L('Complete movement service — cal. 3235', 'W', 1350), L('Gasket set', 'W', 45, 'part'), L('Case & bracelet refinish', 'P', 320)], { reviewed: true, used: 148 }),
  T('jt-03', 'Complete service — cal. 4130 (Daytona)', 'Complete service', [L('Complete movement service — cal. 4130', 'W', 1650), L('Chronograph adjustment', 'W', 0), L('Case & bracelet refinish', 'P', 360)], { reviewed: true, used: 61 }),
  T('jt-04', 'Movement service only — no refinish', 'Movement', [L('Complete movement service', 'W', 1150), L('Gasket set', 'W', 45, 'part')], { reviewed: true, used: 97 }),
  T('jt-05', 'Bracelet tighten & re-pin (Oyster)', 'Bracelet', [L('Bracelet tighten & re-pin (Oyster)', 'B', 380), L('Screw / pin set', 'B', 40, 'part')], { reviewed: true, used: 133 }),
  T('jt-06', 'Bracelet tighten (Jubilee) + polish', 'Bracelet', [L('Bracelet tighten — Jubilee', 'B', 460), L('Bracelet polish', 'P', 140)], { used: 44 }),
  T('jt-07', 'Case refinish — brushed & polished', 'Case & refinish', [L('Case refinish (brushed / polished)', 'P', 260)], { reviewed: true, used: 189 }),
  T('jt-08', 'Bezel PVD / plating — outsource', 'Case & refinish', [L('Bezel re-plating (Goldsmith & Co.)', 'PM', 420), L('Bezel removal & refit', 'W', 120)], { used: 12 }),
  T('jt-09', 'Crystal replacement — sapphire w/ cyclops', 'Movement', [L('Crystal replacement', 'W', 180), L('Crystal, sapphire with cyclops', 'W', 290, 'part'), L('Pressure test', 'W', 0)], { reviewed: true, used: 76 }),
  T('jt-10', 'Battery + gasket + WR test (quartz)', 'Battery / quartz', [L('Battery replacement', 'W', 60), L('Battery', 'W', 12, 'part'), L('Gasket & water-resistance test', 'W', 45)], { reviewed: true, used: 310 }),
  T('jt-11', 'Water resistance test only', 'Water resistance', [L('Pressure test + report', 'W', 65)], { reviewed: true, used: 88 }),
  T('jt-12', 'Vintage overhaul — cal. 1570', 'Vintage', [L('Vintage movement overhaul — cal. 1570', 'W', 1450), L('Mainspring', 'W', 85, 'part'), L('Light case clean (no refinish)', 'P', 0)], { used: 23 }),
  T('jt-13', 'Vintage — dial preservation + service', 'Vintage', [L('Movement overhaul (vintage)', 'W', 1400), L('Dial stabilisation', 'W', 250)], { used: 9 }),
  T('jt-14', 'Trade account — quick QC + polish', 'Trade / B2B', [L('QC inspection', 'W', 90), L('Case & bracelet refinish', 'P', 280)], { used: 57 }),
  T('jt-15', 'Trade account — bracelet only', 'Trade / B2B', [L('Bracelet tighten & re-pin', 'B', 320)], { used: 41 }),
  T('jt-16', 'Full restoration — movement + case + bracelet', 'Complete service', [L('Complete movement service', 'W', 1350), L('Case refinish', 'P', 260), L('Bracelet tighten & re-pin', 'B', 380), L('Bezel re-plating', 'PM', 420)], { used: 18 }),
  T('jt-17', 'Clasp replacement (Oysterlock)', 'Bracelet', [L('Clasp replacement', 'B', 120), L('Oysterlock clasp', 'B', 340, 'part')], { reviewed: true, used: 66 }),
  T('jt-18', 'Crown & tube replacement', 'Movement', [L('Crown & tube replacement', 'W', 160), L('Crown, Triplock 7mm', 'W', 95, 'part'), L('Crown tube', 'W', 55, 'part'), L('Pressure test', 'W', 0)], { used: 52 }),
  T('jt-19', 'Legacy — “Std Serv + Pol” (retired wording)', 'Complete service', [L('Std Serv', 'W', 1100), L('Pol', 'P', 250)], { used: 5, archived: true }),
  T('jt-20', 'Two-tone polish (18k + steel)', 'Case & refinish', [L('Two-tone case refinish', 'P', 340), L('Two-tone bracelet refinish', 'P', 220)], { reviewed: true, used: 71, source: 'new' }),
];

const resolve = <T,>(v: T) => Promise.resolve(v);
export async function getJobTemplates(f: JobTemplateFilter = {}): Promise<JobTemplate[]> {
  const q = f.q?.trim().toLowerCase();
  return resolve(templates.filter((t) => (f.includeArchived || !t.archived) && (!f.category || t.category === f.category) && (!f.dept || t.depts.includes(f.dept)) && (!f.unreviewedOnly || !t.reviewed) && (!q || [t.name, t.category, ...t.lines.map((l) => l.description)].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)).map((t) => ({ ...t, lines: t.lines.map((l) => ({ ...l })) })));
}
export const jobTemplateCounts = () => ({ total: templates.filter((t) => !t.archived).length, unreviewed: templates.filter((t) => !t.archived && !t.reviewed).length, archived: templates.filter((t) => t.archived).length });
export async function saveJobTemplate(i: JobTemplateInput): Promise<JobTemplate> {
  if (!i.name.trim()) throw new Error('Template name is required'); if (!i.lines.length) throw new Error('Add at least one line'); if (!i.depts.length) throw new Error('Pick at least one department flag (W / B / P / PM)');
  const dup = templates.find((t) => t.id !== i.id && !t.archived && t.name.trim().toLowerCase() === i.name.trim().toLowerCase()); if (dup) throw new Error(`A template named "${dup.name}" already exists`);
  const a = actorInfo(); const now = new Date().toISOString(); const lines = i.lines.map((l) => ({ ...l, id: lid() }));
  const ex = i.id ? templates.find((t) => t.id === i.id) : undefined;
  if (ex) { Object.assign(ex, { name: i.name.trim(), category: i.category, depts: i.depts, lines, updatedAt: now, updatedBy: a.by, reviewed: true, reviewedBy: a.by, reviewedAt: now }); audit(`Job template updated · ${ex.name}`); return resolve({ ...ex }); }
  const t: JobTemplate = { id: `jt-${Date.now().toString(36)}`, name: i.name.trim(), category: i.category, depts: i.depts, inferredDepts: inferDepts(lines), lines, source: 'new', reviewed: true, reviewedBy: a.by, reviewedAt: now, archived: false, createdAt: now, updatedAt: now, updatedBy: a.by, usedCount: 0 };
  templates.push(t); audit(`Job template created · ${t.name}`); return resolve({ ...t });
}
export async function duplicateJobTemplate(id: string): Promise<JobTemplate> { const s = templates.find((t) => t.id === id); if (!s) throw new Error('Template not found'); const a = actorInfo(); const now = new Date().toISOString(); const t: JobTemplate = { ...s, id: `jt-${Date.now().toString(36)}`, name: `${s.name} (copy)`, lines: s.lines.map((l) => ({ ...l, id: lid() })), source: 'new', reviewed: true, reviewedBy: a.by, reviewedAt: now, archived: false, createdAt: now, updatedAt: now, updatedBy: a.by, usedCount: 0 }; templates.push(t); audit(`Job template duplicated · ${s.name} → ${t.name}`); return resolve({ ...t }); }
export async function archiveJobTemplate(id: string, archived: boolean): Promise<JobTemplate> { const t = templates.find((x) => x.id === id); if (!t) throw new Error('Template not found'); t.archived = archived; t.updatedAt = new Date().toISOString(); t.updatedBy = actorInfo().by; audit(`Job template ${archived ? 'archived' : 'restored'} · ${t.name}`); return resolve({ ...t }); }
// One-time migration review (MH / Walter): confirm or correct the inferred W/B/P/PM combo
export async function reviewJobTemplate(id: string, depts: DeptCode[]): Promise<JobTemplate> { const t = templates.find((x) => x.id === id); if (!t) throw new Error('Template not found'); if (!depts.length) throw new Error('Pick at least one department flag'); const a = actorInfo(); t.depts = depts; t.reviewed = true; t.reviewedBy = a.by; t.reviewedAt = new Date().toISOString(); t.updatedAt = t.reviewedAt; t.updatedBy = a.by; audit(`Job template reviewed · ${t.name} · ${depts.join('/')}${depts.join() !== t.inferredDepts.join() ? ' (corrected)' : ' (confirmed)'}`); return resolve({ ...t }); }
