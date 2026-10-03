import { orgBridge as b } from './client';
import type { AccessTier, DeptCode, Division, EstimateLine, InviteChannel, Role, Station, User } from './types';

// ---- Setup → Organisation (D-495…D-497): entities, departments, stations as DATA; the app reads names from here, never from string literals ----
const K = { entities: 'rollisuite.org.entities.v1', departments: 'rollisuite.org.departments.v1' }; // bump the suffix when a seed field changes shape
const read = <T>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } };
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export interface Entity { id: Division; name: string; shortName: string; legalName: string; kind: 'service_center' | 'boutique'; signature: string; active: boolean; updatedAt?: string; updatedBy?: string }
export type EntityInput = Pick<Entity, 'name' | 'shortName' | 'legalName' | 'signature' | 'active'>;
const ENTITY_SEED: Entity[] = [
  { id: 'rolliworks', name: 'Rolliworks', shortName: 'RW', legalName: 'Rolliworks LLC', kind: 'service_center', signature: 'The Rolliworks team', active: true },
  { id: 'rollishop', name: 'RolliShop', shortName: 'RS', legalName: 'RolliShop Inc.', kind: 'boutique', signature: 'The RolliShop team', active: true },
];
let entities: Entity[] = (() => { const saved = read<Entity[] | null>(K.entities, null); return saved ? ENTITY_SEED.map((s) => ({ ...s, ...saved.find((x) => x.id === s.id) })) : ENTITY_SEED.map((e) => ({ ...e })); })();
export const getEntitiesSync = (): Entity[] => entities.map((e) => ({ ...e }));
export const entitySync = (id: Division): Entity => entities.find((e) => e.id === id) ?? ENTITY_SEED.find((e) => e.id === id)!;
export const entityNameSync = (id: Division): string => entitySync(id).name;
export async function getEntities(): Promise<Entity[]> { return getEntitiesSync(); }
export async function saveEntity(id: Division, input: EntityInput): Promise<Entity> {
  if (!b.isManager()) throw new Error('Editing the organisation needs a manager');
  if (!input.name.trim()) throw new Error('Entity name is required'); if (!input.shortName.trim() || input.shortName.trim().length > 4) throw new Error('Short name: 1–4 characters');
  const e = entities.find((x) => x.id === id)!; const before = e.name; const a = b.actor();
  Object.assign(e, { name: input.name.trim(), shortName: input.shortName.trim().toUpperCase(), legalName: input.legalName.trim(), signature: input.signature.trim() || `The ${input.name.trim()} team`, active: input.active, updatedAt: new Date().toISOString(), updatedBy: a.by });
  write(K.entities, entities); b.audit(`Entity ${id} saved · ${before === e.name ? e.name : `${before} → ${e.name}`} · ${e.shortName} · ${e.active ? 'active' : 'inactive'}`);
  return { ...e };
}

// Departments: W · B · P · PM are the dot legs (component colour + credit); CM and EN route a job to an extra queue but KEEP the W·B·P dots (D-497).
export interface Department { code: string; name: string; entity: Division | 'both'; queue: string; dotLeg?: DeptCode; keepsDots: boolean; skuKeywords: string[]; active: boolean; sortOrder: number; provisional?: string }
export type DepartmentInput = Omit<Department, 'sortOrder'> & { sortOrder?: number };
const DEPT_SEED: Department[] = [
  { code: 'W', name: 'Watchmaking', entity: 'rolliworks', queue: 'Watchmaker room', dotLeg: 'W', keepsDots: true, skuKeywords: [], active: true, sortOrder: 1 },
  { code: 'B', name: 'Band', entity: 'rolliworks', queue: 'Band room', dotLeg: 'B', keepsDots: true, skuKeywords: [], active: true, sortOrder: 2 },
  { code: 'P', name: 'Polish', entity: 'rolliworks', queue: 'Polish room', dotLeg: 'P', keepsDots: true, skuKeywords: [], active: true, sortOrder: 3 },
  { code: 'PM', name: 'Precious Metals', entity: 'rolliworks', queue: 'Watchmaker room · precious metals', dotLeg: 'PM', keepsDots: true, skuKeywords: [], active: true, sortOrder: 4 },
  { code: 'CM', name: 'Case & Misc', entity: 'rolliworks', queue: 'Case room', keepsDots: true, skuKeywords: ['case work', 'crystal only'], active: true, sortOrder: 5, provisional: 'Label "CM" unconfirmed — MH to name it' },
  { code: 'EN', name: 'Engraving', entity: 'rolliworks', queue: 'Engraving', keepsDots: true, skuKeywords: ['engrav'], active: true, sortOrder: 6 },
];
let departments: Department[] = (() => { const saved = read<Department[] | null>(K.departments, null); return saved ? [...saved, ...DEPT_SEED.filter((s) => !saved.some((x) => x.code === s.code))] : DEPT_SEED.map((d) => ({ ...d, skuKeywords: [...d.skuKeywords] })); })();
export const getDepartmentsSync = (): Department[] => [...departments].sort((a, c) => a.sortOrder - c.sortOrder).map((d) => ({ ...d, skuKeywords: [...d.skuKeywords] }));
export async function getDepartments(): Promise<Department[]> { return getDepartmentsSync(); }
export const departmentSync = (code: string) => departments.find((d) => d.code === code);
export async function saveDepartment(input: DepartmentInput): Promise<Department> {
  if (!b.isManager()) throw new Error('Editing departments needs a manager');
  const code = input.code.trim().toUpperCase(); if (!/^[A-Z]{1,3}$/.test(code)) throw new Error('Code: 1–3 letters'); if (!input.name.trim()) throw new Error('Department name is required'); if (!input.queue.trim()) throw new Error('Queue label is required');
  const existing = departments.find((d) => d.code === code);
  if (existing?.dotLeg && input.dotLeg !== existing.dotLeg) throw new Error(`${code} is a dot leg — its leg cannot change (components, credit and reports read it)`);
  const d: Department = existing ?? { code, name: '', entity: 'rolliworks', queue: '', keepsDots: true, skuKeywords: [], active: true, sortOrder: departments.length + 1 };
  Object.assign(d, { name: input.name.trim(), entity: input.entity, queue: input.queue.trim(), dotLeg: existing?.dotLeg ?? input.dotLeg, keepsDots: existing?.dotLeg ? true : input.keepsDots, skuKeywords: input.skuKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean), active: input.active, provisional: input.provisional });
  if (!existing) departments.push(d);
  write(K.departments, departments); b.audit(`Department ${existing ? 'updated' : 'created'} · ${d.code} ${d.name} · queue ${d.queue}${d.dotLeg ? ` · leg ${d.dotLeg}` : ' · routing only, keeps W·B·P dots'}`);
  return { ...d };
}
// Which routing-only departments a set of lines lands in (catalog routeDept first, then SKU keyword on the description). Dot-leg departments are never "routes" — they ARE the dots.
export const routeDepartmentsSync = (lines: EstimateLine[]): Department[] => {
  const routing = departments.filter((d) => d.active && !d.dotLeg);
  return routing.filter((d) => lines.some((l) => (l.catalogId && b.catalogRouteDept(l.catalogId) === d.code) || d.skuKeywords.some((k) => l.description.toLowerCase().includes(k))));
};

// Stations as data — one table (device registry) read by sign-in, Pickup (paired kiosk), cameras and the Time Clock
export type StationInput = Pick<Station, 'name' | 'division' | 'deviceType' | 'cameraRole' | 'receptionMode' | 'pairedKioskId' | 'clockPoint' | 'notes'> & { id?: string };
export const getStationsSync = (): Station[] => b.stations();
export async function getOrgStations(): Promise<Station[]> { return b.stations(); }
export const kioskStationsSync = (): Station[] => b.stations().filter((s) => s.deviceType === 'kiosk' && !s.cameraRole);
export const pairedKioskSync = (stationId?: string | null): Station | undefined => { const st = b.stations().find((s) => s.id === stationId); return st?.pairedKioskId ? b.stations().find((s) => s.id === st.pairedKioskId) : undefined; };
export async function saveStation(input: StationInput): Promise<Station> {
  if (!b.isManager()) throw new Error('Editing stations needs a manager');
  const name = input.name.trim(); if (!name) throw new Error('Station name is required');
  const list = b.stations(); const existing = input.id ? list.find((s) => s.id === input.id) : undefined;
  if (list.some((s) => s.id !== existing?.id && s.name.toLowerCase() === name.toLowerCase())) throw new Error('A station with that name already exists');
  if (input.pairedKioskId) { const k = list.find((s) => s.id === input.pairedKioskId); if (!k || k.deviceType !== 'kiosk') throw new Error('Paired kiosk must be a kiosk station'); if (k.id === existing?.id) throw new Error('A kiosk cannot pair to itself'); }
  const st: Station = { ...(existing ?? { id: `st-${Date.now().toString(36)}` }), name, division: input.division, deviceType: input.deviceType || undefined, cameraRole: input.cameraRole || undefined, receptionMode: input.receptionMode || undefined, pairedKioskId: input.pairedKioskId || undefined, clockPoint: input.clockPoint || undefined, notes: input.notes?.trim() || undefined };
  b.writeStations(existing ? list.map((s) => (s.id === st.id ? st : s)) : [...list, st]);
  b.audit(`Station ${existing ? 'updated' : 'created'} · ${st.name} · ${entityNameSync(st.division)}${st.deviceType ? ` · ${st.deviceType}` : ''}${st.pairedKioskId ? ` · kiosk ${list.find((s) => s.id === st.pairedKioskId)?.name}` : ''}${st.cameraRole ? ` · camera ${st.cameraRole}` : ''}${st.clockPoint ? ' · clock point' : ''}`);
  return st;
}

// Staff — the unified list (every person, every status) + invite life-cycle (MOCK delivery: code on screen + Sent)
export type StaffStatus = 'active' | 'invited' | 'expired' | 'disabled';
export interface StaffRow { user: User; status: StaffStatus; manager?: User; department?: Department; entity: string }
export const staffStatusSync = (u: User): StaffStatus => (u.disabled ? 'disabled' : u.invite && !u.invite.usedAt ? (new Date(u.invite.expiresAt).getTime() < Date.now() ? 'expired' : 'invited') : 'active');
export const getStaffSync = (): StaffRow[] => b.users().map((u) => ({ user: u, status: staffStatusSync(u), manager: u.reportsTo ? b.users().find((m) => m.id === u.reportsTo) : undefined, department: u.departmentCode ? departmentSync(u.departmentCode) : undefined, entity: u.division === 'both' ? `${entitySync('rolliworks').shortName} + ${entitySync('rollishop').shortName}` : entityNameSync(u.division) }));
export async function getStaff(): Promise<StaffRow[]> { return getStaffSync(); }
export interface StaffInput { id?: string; firstName: string; shortName: string; dutyLabel: string; accessTier: AccessTier; roles: Role[]; division: Division | 'both'; departmentCode?: string; reportsTo?: string; email: string; phone?: string; channel: InviteChannel }
export const INVITE_TTL_H = 72;
const sixDigits = () => String(Math.floor(100000 + Math.random() * 900000));
const inviteBody = (u: User, code: string, exp: string) => `Hello ${u.shortName},\n\nYou have been added to RolliSuite as ${u.dutyLabel}.\n\nYour one-time invite code: ${code}\n\nAt any station, tap your card → "I have an invite code" → enter the code, then choose your password and PIN. The code expires ${new Date(exp).toLocaleString()}.\n\n— ${entitySync(u.division === 'both' ? 'rolliworks' : u.division).signature}`;
const sendInvite = (u: User, channel: InviteChannel) => {
  const a = b.actor(); const gen = (u.invite?.generation ?? 0) + 1; const code = sixDigits(); const issuedAt = new Date().toISOString(); const expiresAt = new Date(Date.now() + INVITE_TTL_H * 3_600_000).toISOString();
  u.invite = { code, issuedAt, expiresAt, channel, issuedBy: a.by, generation: gen, attempts: 0 };
  const to = channel === 'sms' ? (u.phone ?? '') : (u.email ?? '');
  b.queueOutbox({ id: b.newId('ob-inv'), to, toName: u.shortName, relatedRef: `STAFF-${u.shortName}`, status: 'pending', subject: channel === 'sms' ? `RolliSuite invite code ${code} (SMS · MOCK)` : `Your RolliSuite invite — ${u.shortName}`, body: inviteBody(u, code, expiresAt), createdAt: issuedAt, createdBy: a.by, station: a.station });
  b.audit(`Staff invite ${gen > 1 ? 'resent' : 'sent'} · ${u.shortName} · ${channel} · gen ${gen} · expires ${new Date(expiresAt).toLocaleDateString()} (code on screen — MOCK delivery)`);
};
export async function createStaff(input: StaffInput): Promise<User> {
  if (!b.isManager()) throw new Error('Managing staff needs a manager');
  const first = input.firstName.trim().toLowerCase(); const short = input.shortName.trim();
  if (!first || !short) throw new Error('First name and short name are required'); if (!input.roles.length) throw new Error('Pick at least one role');
  if (input.channel === 'email' && !/\S+@\S+\.\S+/.test(input.email)) throw new Error('A valid email is required for an email invite'); if (input.channel === 'sms' && !(input.phone ?? '').replace(/\D/g, '').length) throw new Error('A phone number is required for an SMS invite');
  const users = b.users(); if (users.some((u) => u.shortName.toLowerCase() === short.toLowerCase() || u.firstName === first)) throw new Error('Name or short name already in use');
  if (input.reportsTo && !users.some((u) => u.id === input.reportsTo)) throw new Error('Reports-to must be an existing person');
  const u: User = { id: `u-${first}`, firstName: first, shortName: short, displayName: `${short} — ${input.dutyLabel.trim() || input.roles.join(' · ')}`, dutyLabel: input.dutyLabel.trim() || input.roles.join(' · '), accessTier: input.accessTier, roles: [...input.roles], division: input.division, password: `pending-${b.newId('pw')}`, pin: '', reportsTo: input.reportsTo || undefined, email: input.email.trim() || undefined, phone: input.phone?.trim() || undefined, departmentCode: input.departmentCode || undefined };
  b.addUser(u); sendInvite(u, input.channel);
  b.audit(`Staff created · ${u.shortName} · ${u.accessTier} · ${u.roles.join('/')} · ${u.division}${u.departmentCode ? ` · dept ${u.departmentCode}` : ''}${u.reportsTo ? ` · reports to ${users.find((m) => m.id === u.reportsTo)?.shortName}` : ''}`);
  return { ...u };
}
export async function updateStaff(input: StaffInput & { id: string }): Promise<User> {
  if (!b.isManager()) throw new Error('Managing staff needs a manager');
  const u = b.users().find((x) => x.id === input.id); if (!u) throw new Error('Person not found'); if (!input.roles.length) throw new Error('Pick at least one role');
  if (input.reportsTo === u.id) throw new Error('Nobody reports to themselves');
  Object.assign(u, { shortName: input.shortName.trim() || u.shortName, dutyLabel: input.dutyLabel.trim() || u.dutyLabel, displayName: `${input.shortName.trim() || u.shortName} — ${input.dutyLabel.trim() || u.dutyLabel}`, accessTier: input.accessTier, roles: [...input.roles], division: input.division, departmentCode: input.departmentCode || undefined, reportsTo: input.reportsTo || undefined, email: input.email.trim() || undefined, phone: input.phone?.trim() || undefined });
  b.audit(`Staff updated · ${u.shortName} · ${u.accessTier} · ${u.roles.join('/')} · ${u.division}${u.departmentCode ? ` · dept ${u.departmentCode}` : ''}`);
  return { ...u };
}
export async function resendStaffInvite(userId: string, channel?: InviteChannel): Promise<User> {
  if (!b.isManager()) throw new Error('Managing staff needs a manager');
  const u = b.users().find((x) => x.id === userId); if (!u) throw new Error('Person not found'); if (!u.invite || u.invite.usedAt) throw new Error(`${u.shortName} is already active — no invite to resend`);
  sendInvite(u, channel ?? u.invite.channel); return { ...u };
}
export const MAX_INVITE_ATTEMPTS = 5;
// Activation = the staffer's first sign-in: code → password + PIN of their choosing; the code is single-use and the row is stamped
export async function activateStaffInvite(userId: string, code: string, password: string, pin: string): Promise<User> {
  const u = b.users().find((x) => x.id === userId); if (!u) throw new Error('Person not found'); const inv = u.invite;
  if (!inv || inv.usedAt) throw new Error('No open invite for this account — sign in with your password');
  if (new Date(inv.expiresAt).getTime() < Date.now()) throw new Error('This invite code expired — ask a manager to resend it');
  if (inv.attempts >= MAX_INVITE_ATTEMPTS) throw new Error('Too many wrong codes — ask a manager to resend the invite');
  if (code.replace(/\D/g, '') !== inv.code) { inv.attempts += 1; b.audit(`Staff activation failed · ${u.shortName} · wrong code (${inv.attempts}/${MAX_INVITE_ATTEMPTS})`); throw new Error(`That code is not right (${MAX_INVITE_ATTEMPTS - inv.attempts} tries left)`); }
  if (password.length < 6) throw new Error('Password: at least 6 characters'); if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
  u.password = password; u.pin = pin; inv.usedAt = new Date().toISOString();
  b.audit(`Staff activated · ${u.shortName} · invite gen ${inv.generation} used · password + PIN set`);
  return { ...u };
}
