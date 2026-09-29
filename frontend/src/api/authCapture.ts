import { addJobPhotoSync, benchBridge as b } from './client';

// ---- Guided authentication capture — fixed 11-step sequence with per-step camera assignment and per-step authenticity flag (training data for the auth app) ----
export type AuthCam = 'ipevo' | 'microscope';
export type AuthFlag = 'authentic' | 'fake' | 'unsure';
export interface AuthStep { key: string; label: string; cam: AuthCam; hint: string }
export const AUTH_STEPS: AuthStep[] = [
  { key: 'overall', label: 'Overall watch', cam: 'ipevo', hint: 'Dial up, full watch in frame' },
  { key: 'overall_2', label: 'Overall watch — second angle', cam: 'ipevo', hint: '~45° from the first shot' },
  { key: 'dial', label: 'Dial', cam: 'microscope', hint: 'Printing, lume plots, applied markers' },
  { key: 'hands', label: 'Hands', cam: 'microscope', hint: 'Finish, lume, hand stack' },
  { key: 'bezel', label: 'Insert / bezel', cam: 'microscope', hint: 'Insert printing, pearl, bezel teeth' },
  { key: 'case_ref', label: 'Case ref engraving', cam: 'ipevo', hint: 'Between the lugs at 12' },
  { key: 'case_serial', label: 'Case serial', cam: 'ipevo', hint: 'Between the lugs at 6' },
  { key: 'rehaut', label: 'Rehaut engraving', cam: 'microscope', hint: 'Laser-etched ROLEXROLEX + serial at 6 — needs magnification' },
  { key: 'end_pieces', label: 'End pieces of bracelet', cam: 'ipevo', hint: 'End-link codes, fit to the case' },
  { key: 'clasp_stamps', label: 'Clasp stamps and engraving', cam: 'ipevo', hint: 'Clasp code, crown stamp' },
  { key: 'clasp_cover', label: 'Clasp cover', cam: 'ipevo', hint: 'Outer clasp cover, coronet' },
];
export interface AuthShot { step: string; dataUrl: string; device: string; cam: AuthCam; flag: AuthFlag; note?: string; at: string; by: string }
export interface AuthSession { id: string; jobId: string; startedAt: string; completedAt?: string; by: string; shots: AuthShot[] }

const seedShot = (step: string, cam: AuthCam, flag: AuthFlag = 'authentic', note?: string, i = 0): AuthShot => ({ step, cam, flag, note, dataUrl: `https://picsum.photos/seed/auth-${step}/480/360`, device: cam === 'ipevo' ? 'IPEVO V4K' : 'HY-3307 microscope', at: new Date(Date.now() - 86400e3 + i * 60e3).toISOString(), by: 'Walter' });
// Seeded: j-r1 walked through all 11 steps — rehaut flagged Unsure, everything else default-authentic
const sessions: AuthSession[] = [{ id: 'auth-02', jobId: 'j-08', startedAt: new Date(Date.now() - 20 * 864e5).toISOString(), completedAt: new Date(Date.now() - 20 * 864e5 + 11 * 60e3).toISOString(), by: 'MM', shots: AUTH_STEPS.map((s, i) => seedShot(s.key, s.cam, 'authentic', undefined, i)) }, { id: 'auth-01', jobId: 'j-r1', startedAt: new Date(Date.now() - 86400e3).toISOString(), completedAt: new Date(Date.now() - 86400e3 + 11 * 60e3).toISOString(), by: 'Walter', shots: AUTH_STEPS.map((s, i) => seedShot(s.key, s.cam, s.key === 'rehaut' ? 'unsure' : 'authentic', s.key === 'rehaut' ? 'Etching depth looks shallow at 6 — compare against reference' : undefined, i)) }];

export async function getAuthSessions(jobId: string): Promise<AuthSession[]> { return sessions.filter((s) => s.jobId === jobId).map((s) => ({ ...s, shots: [...s.shots] })); }
export async function startAuthSession(jobId: string): Promise<AuthSession> { const a = b.actor(); const s: AuthSession = { id: b.newId('auth'), jobId, startedAt: new Date().toISOString(), by: a.by, shots: [] }; sessions.unshift(s); return { ...s }; }
// Every shot attaches to the job as it is taken — with the component it belongs to and its flag
export async function recordAuthShot(sessionId: string, shot: Omit<AuthShot, 'at' | 'by'>): Promise<AuthSession> {
  const s = sessions.find((x) => x.id === sessionId); if (!s) throw new Error('Session not found'); const a = b.actor();
  const full: AuthShot = { ...shot, at: new Date().toISOString(), by: a.by }; const i = s.shots.findIndex((x) => x.step === shot.step); if (i >= 0) s.shots[i] = full; else s.shots.push(full);
  const j = b.job(s.jobId); if (j) addJobPhotoSync(j, { id: b.newId('aph'), dataUrl: shot.dataUrl, slot: `auth-${shot.step}`, fileName: `Auth · ${AUTH_STEPS.find((x) => x.key === shot.step)?.label}`, photoType: 'inspection', at: full.at, by: a.by, station: a.station, replaceSlot: true, stamp: false });
  if (shot.flag !== 'authentic') b.jobStamp(s.jobId, `Authentication flag · ${AUTH_STEPS.find((x) => x.key === shot.step)?.label} → ${shot.flag.toUpperCase()}${shot.note ? ` — ${shot.note}` : ''}`);
  if (s.shots.length === AUTH_STEPS.length && !s.completedAt) { s.completedAt = full.at; b.jobStamp(s.jobId, `Authentication capture complete · 11 steps · ${s.shots.filter((x) => x.flag !== 'authentic').length} flagged`); }
  return { ...s, shots: [...s.shots] };
}
export const flagSummary = (s: AuthSession) => s.shots.filter((x) => x.flag !== 'authentic').map((x) => `${AUTH_STEPS.find((a) => a.key === x.step)?.label}: ${x.flag}`);
