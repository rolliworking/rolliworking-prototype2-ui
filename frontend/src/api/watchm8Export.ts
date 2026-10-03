import { wm8Bridge as b } from './client';
import * as il from './inspectionLabels';
import type { PhotoDataClass } from './types';

// ---- WatchM8 corpus feed — seam controls (MH 2026-10-03). MOCK: nothing leaves the browser.
// The export switch is the kill switch: per environment (prod · staging · dev), default OFF everywhere.
// prod = owner only and cannot turn ON without an agreement ref. staging / dev = manager tier.
// Class policy: SPECIMEN only. operational and identity are never exportable (locked OFF, greyed in the UI). This is a corpus feed, not a backup.
// Export log = append-only: seq · type · object · hash · licence version · agreement ref · exported at · acked. Empty until a switch is ON and an export runs.

export type Wm8Env = 'prod' | 'staging' | 'dev';
export const WM8_ENVS: { key: Wm8Env; label: string; blurb: string }[] = [
  { key: 'prod', label: 'Production', blurb: 'Live shop data → WatchM8. Owner only · agreement ref required before ON.' },
  { key: 'staging', label: 'Staging', blurb: 'Rehearsal feed against the WatchM8 staging endpoint. Manager tier.' },
  { key: 'dev', label: 'Development', blurb: 'This prototype. Manager tier.' },
];
export interface Wm8EnvSwitch { enabled: boolean; agreementRef: string; licenceVersion: string; changedBy?: string; changedAt?: string }
export interface Wm8Settings { envs: Record<Wm8Env, Wm8EnvSwitch>; classes: Record<PhotoDataClass, boolean> }
export type Wm8ExportType = 'label' | 'photo';
export interface Wm8ExportRow { seq: number; type: Wm8ExportType; object: string; hash: string; licenceVersion: string; agreementRef: string; exportedAt: string; acked: boolean; ackedAt?: string; env: Wm8Env; by: string }
export interface Wm8Seam { current: Wm8Env; settings: Wm8Settings; log: Wm8ExportRow[]; candidates: { labels: number; photos: number }; canToggle: Record<Wm8Env, boolean>; isOwner: boolean; isManager: boolean }

const KEY_SETTINGS = 'rollisuite.wm8.settings'; const KEY_LOG = 'rollisuite.wm8.log'; const KEY_ENV = 'rollisuite.wm8.env';
export const WM8_LICENCE_VERSION = 'WM8-CORPUS-1.0';
export const WM8_CLASS_POLICY: Record<PhotoDataClass, { exportable: boolean; why: string }> = {
  specimen: { exportable: true, why: 'Controlled-rig shots, exemplars and stage-0 web / widget submissions — the corpus WatchM8 exists for.' },
  operational: { exportable: false, why: 'Shop record, not corpus. Locked OFF — a backup is not an export.' },
  identity: { exportable: false, why: 'Government ID. Locked OFF — never leaves RolliSuite, manager-only inside it.' },
};
const defaults = (): Wm8Settings => ({ envs: { prod: { enabled: false, agreementRef: '', licenceVersion: WM8_LICENCE_VERSION }, staging: { enabled: false, agreementRef: '', licenceVersion: WM8_LICENCE_VERSION }, dev: { enabled: false, agreementRef: '', licenceVersion: WM8_LICENCE_VERSION } }, classes: { specimen: true, operational: false, identity: false } });
const settings = (): Wm8Settings => { const s = b.readJson<Partial<Wm8Settings>>(KEY_SETTINGS, {}); const d = defaults(); return { envs: { ...d.envs, ...(s.envs ?? {}) }, classes: { ...d.classes, ...(s.classes ?? {}), operational: false, identity: false } }; };
const save = (s: Wm8Settings) => b.writeJson(KEY_SETTINGS, s);
const log = (): Wm8ExportRow[] => b.readJson<Wm8ExportRow[]>(KEY_LOG, []);
const saveLog = (rows: Wm8ExportRow[]) => b.writeJson(KEY_LOG, rows);
// The environment this app instance runs as. Prototype = dev; the selector on the page is a NOT-KEEPER control to rehearse the prod guard.
export const currentWm8Env = (): Wm8Env => { const v = localStorage.getItem(KEY_ENV); return v === 'prod' || v === 'staging' ? v : 'dev'; };
export const envLabel = (e: Wm8Env) => WM8_ENVS.find((x) => x.key === e)?.label ?? e;
export const wm8SwitchOnSync = (): boolean => settings().envs[currentWm8Env()].enabled;

// FNV-1a 32-bit over the serialised object — deterministic, cheap, good enough for a mock ledger
const fnv1a = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const candidates = () => { const labels = il.watchm8Export(); const photos = il.specimenShots(); return { labels, photos }; };

const canToggle = (env: Wm8Env) => (env === 'prod' ? b.isOwner() : b.isManager());
const seam = (): Wm8Seam => { const c = candidates(); return { current: currentWm8Env(), settings: settings(), log: log().sort((a, z) => z.seq - a.seq), candidates: { labels: c.labels.length, photos: c.photos.length }, canToggle: { prod: canToggle('prod'), staging: canToggle('staging'), dev: canToggle('dev') }, isOwner: b.isOwner(), isManager: b.isManager() }; };
export async function getWm8Seam(): Promise<Wm8Seam> { return seam(); }

export async function setWm8Switch(env: Wm8Env, on: boolean, agreementRef?: string): Promise<Wm8Seam> {
  if (!canToggle(env)) throw new Error(env === 'prod' ? 'Production export switch is owner-only (MH)' : 'Manager tier only');
  const s = settings(); const row = s.envs[env]; const ref = (agreementRef ?? row.agreementRef).trim();
  if (on && env === 'prod' && !ref) throw new Error('Production cannot be switched ON without a signed agreement ref');
  const a = b.actor(); s.envs[env] = { ...row, enabled: on, agreementRef: ref, changedBy: a.by, changedAt: new Date().toISOString() }; save(s);
  b.settingsAudit(`WatchM8 export switch · ${envLabel(env)} → ${on ? 'ON' : 'OFF'}${ref ? ` · agreement ${ref}` : ''}`);
  return seam();
}
export async function setWm8AgreementRef(env: Wm8Env, agreementRef: string): Promise<Wm8Seam> {
  if (!canToggle(env)) throw new Error(env === 'prod' ? 'Production agreement ref is owner-only (MH)' : 'Manager tier only');
  const s = settings(); const a = b.actor(); s.envs[env] = { ...s.envs[env], agreementRef: agreementRef.trim(), changedBy: a.by, changedAt: new Date().toISOString() }; save(s);
  b.settingsAudit(`WatchM8 agreement ref · ${envLabel(env)} → ${agreementRef.trim() || '(cleared)'}`);
  return seam();
}
// Only specimen may flip; operational / identity are policy, not settings
export async function setWm8Class(cls: PhotoDataClass, on: boolean): Promise<Wm8Seam> {
  if (!b.isManager()) throw new Error('Manager tier only');
  if (!WM8_CLASS_POLICY[cls].exportable) throw new Error(`${cls} is never exportable — ${WM8_CLASS_POLICY[cls].why}`);
  const s = settings(); s.classes[cls] = on; save(s); b.settingsAudit(`WatchM8 class · ${cls} → ${on ? 'included' : 'excluded'}`);
  return seam();
}
// NOT-KEEPER: rehearse the prod guard from the prototype
export async function setWm8CurrentEnv(env: Wm8Env): Promise<Wm8Seam> { if (!import.meta.env.DEV && env === 'prod' && !b.isOwner()) throw new Error('Owner only'); localStorage.setItem(KEY_ENV, env); return seam(); }

// Run the feed for the CURRENT environment (MOCK). Honours the switch and the class policy; de-duplicates by object + revision so re-runs only add what changed.
export async function runWm8Export(): Promise<{ seam: Wm8Seam; added: number }> {
  const env = currentWm8Env(); const s = settings(); const sw = s.envs[env];
  if (!b.isManager()) throw new Error('Manager tier only');
  if (!sw.enabled) throw new Error(`Export switch is OFF for ${envLabel(env)} — nothing leaves`);
  if (!s.classes.specimen) throw new Error('Specimen class is excluded — there is nothing exportable');
  const a = b.actor(); const rows = log(); const seen = new Set(rows.filter((r) => r.env === env).map((r) => `${r.type}:${r.object}`)); let seq = rows.reduce((m, r) => Math.max(m, r.seq), 0); const now = new Date().toISOString(); const ref = sw.agreementRef || '—';
  const { labels, photos } = candidates(); let added = 0;
  const push = (type: Wm8ExportType, object: string, payload: unknown) => { const k = `${type}:${object}`; if (seen.has(k)) return; seen.add(k); rows.push({ seq: ++seq, type, object, hash: fnv1a(JSON.stringify(payload)), licenceVersion: sw.licenceVersion, agreementRef: ref, exportedAt: now, acked: false, env, by: a.by }); added++; };
  labels.forEach((l) => push('label', `${l.id} · ${l.jobNumber} · ${il.componentLabel(l.component)} · r${l.revision}`, l));
  photos.forEach((p) => push('photo', `${p.id} · ${il.componentLabel(p.component)} · ${p.shotName}`, { id: p.id, jobId: p.jobId, component: p.component, shotKey: p.shotKey, at: p.at, cls: p.dataClass }));
  saveLog(rows); b.settingsAudit(`WatchM8 export run · ${envLabel(env)} · ${added} object${added === 1 ? '' : 's'} · licence ${sw.licenceVersion} · agreement ${ref}`);
  return { seam: seam(), added };
}
// MOCK ack from the WatchM8 side
export async function ackWm8Export(): Promise<Wm8Seam> { if (!b.isManager()) throw new Error('Manager tier only'); const rows = log(); const now = new Date().toISOString(); let n = 0; rows.forEach((r) => { if (!r.acked) { r.acked = true; r.ackedAt = now; n++; } }); saveLog(rows); if (n) b.settingsAudit(`WatchM8 ack received · ${n} object${n === 1 ? '' : 's'} (mock)`); return seam(); }
export async function clearWm8Log(): Promise<Wm8Seam> { if (!import.meta.env.DEV) throw new Error('Not available'); saveLog([]); return seam(); }
