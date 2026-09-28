import { actorInfo, auditAppointments, clientBrief, lookupApptRef } from './client';

// ---- Appointments (Schedule) — ONE set of booking rules feeds the public booking link (upload.rolliworks.com/book) AND the internal calendar ----
export type ApptType = 'drop_off' | 'pick_up';
export type ApptStatus = 'booked' | 'arrived' | 'completed' | 'no_show' | 'cancelled';
export type ApptSource = 'staff' | 'booking_page';
export interface Appointment { id: string; type: ApptType; date: string; time: string; clientId?: string; clientName: string; email?: string; phone?: string; refNumber?: string; watch?: string; notes?: string; status: ApptStatus; source: ApptSource; createdAt: string; createdBy: string; updatedAt: string; cancelReason?: string }
export interface DayHours { open: boolean; start: string; end: string }
export interface BookingRules { days: Record<number, DayHours>; slotMinutes: 30; capacityPerSlot: number; slotOverrides: Record<string, number>; minLeadHours: number; maxDaysAhead: number; enabledTypes: Record<ApptType, boolean>; requireEstimateForDropOff: boolean; requireSoForPickUp: boolean; closedDates: { date: string; reason: string }[]; confirmationMessage: string }
export interface SlotView { time: string; capacity: number; booked: number; full: boolean; past: boolean; appts: Appointment[] }
export interface ApptInput { id?: string; type: ApptType; date: string; time: string; refNumber?: string; clientId?: string; clientName?: string; email?: string; phone?: string; notes?: string }

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const nextWeekday = (wd: number, from = 1) => { for (let i = from; i < 14; i += 1) { const d = new Date(); d.setDate(d.getDate() + i); if (d.getDay() === wd) return ymd(d); } return dayOffset(from); };
const hhmm = (h: number, m = 0) => `${pad(h)}:${pad(m)}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fmtSlot = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };

const rules: BookingRules = {
  days: { 0: { open: false, start: '10:00', end: '15:00' }, 1: { open: true, start: '09:00', end: '18:00' }, 2: { open: true, start: '09:00', end: '18:00' }, 3: { open: true, start: '09:00', end: '18:00' }, 4: { open: true, start: '09:00', end: '18:00' }, 5: { open: true, start: '09:00', end: '18:00' }, 6: { open: true, start: '10:00', end: '15:00' } },
  slotMinutes: 30, capacityPerSlot: 2, slotOverrides: {}, minLeadHours: 2, maxDaysAhead: 45,
  enabledTypes: { drop_off: true, pick_up: true }, requireEstimateForDropOff: true, requireSoForPickUp: true,
  closedDates: [{ date: nextWeekday(1, 7), reason: 'Shop closed — inventory day' }],
  confirmationMessage: 'You’re booked. Please bring your estimate email and a photo ID. Reply to this email if you need to reschedule.',
};

const mk = (id: string, type: ApptType, date: string, time: string, ref: string | undefined, fallback: { clientName: string; email?: string; phone?: string; watch?: string }, extra: Partial<Appointment> = {}): Appointment => {
  const hit = ref ? lookupApptRef(type, ref) : null;
  return { id, type, date, time, refNumber: hit?.ref ?? ref, clientId: hit?.clientId, clientName: hit?.clientName ?? fallback.clientName, email: hit?.email ?? fallback.email, phone: hit?.phone ?? fallback.phone, watch: hit?.watch ?? fallback.watch, status: 'booked', source: 'booking_page', createdAt: dayOffset(-3) + 'T14:10:00', createdBy: 'booking page', updatedAt: dayOffset(-3) + 'T14:10:00', ...extra };
};
const today = ymd(new Date()); const tomorrow = dayOffset(1); const nextOpen = (() => { for (let i = 1; i < 8; i += 1) { const d = new Date(); d.setDate(d.getDate() + i); if (rules.days[d.getDay()].open) return ymd(d); } return tomorrow; })();
const appts: Appointment[] = [
  mk('ap-01', 'drop_off', today, '10:00', 'E02060', { clientName: 'Robert Calloway' }),
  mk('ap-02', 'pick_up', today, '11:30', 'SO-26-0103', { clientName: 'Hannah Petrakis' }, { source: 'staff', createdBy: 'Vienna' }),
  mk('ap-03', 'drop_off', today, '14:00', 'E02040', { clientName: 'Robert Calloway' }, { notes: 'Bringing the original box' }),
  mk('ap-04', 'pick_up', today, '16:30', 'SO-26-0102', { clientName: 'Camille Beaumont' }),
  // next open day: 10:00 and 14:30 at capacity (2 of 2) to show the limit blocking a third booking
  mk('ap-05', 'drop_off', nextOpen, '10:00', 'E02007', { clientName: 'Eleanor Vance' }),
  mk('ap-06', 'drop_off', nextOpen, '10:00', undefined, { clientName: 'Marcus Feld', email: 'marcus.feld@example.com', phone: '(917) 555-0142', watch: 'Rolex Explorer' }, { notes: 'No estimate yet — walk-in quote requested' }),
  mk('ap-07', 'pick_up', nextOpen, '14:30', 'SO-26-0104', { clientName: 'Oliver Pemberton' }),
  mk('ap-08', 'pick_up', nextOpen, '14:30', undefined, { clientName: 'Grace Nakamura', email: 'grace.nakamura@example.com', watch: 'Rolex Datejust' }, { source: 'staff', createdBy: 'MH' }),
  mk('ap-09', 'drop_off', dayOffset(-1), '09:30', 'E02026', { clientName: 'Isabella Romano' }, { status: 'completed' }),
  mk('ap-10', 'pick_up', dayOffset(-2), '15:00', undefined, { clientName: 'Theo Marsh', watch: 'Tudor Black Bay' }, { status: 'no_show' }),
];

const resolve = <T,>(v: T) => Promise.resolve(v);
export async function getBookingRules(): Promise<BookingRules> { return resolve(JSON.parse(JSON.stringify(rules)) as BookingRules); }
export async function saveBookingRules(patch: Partial<BookingRules>): Promise<BookingRules> {
  Object.entries(patch.days ?? {}).forEach(([, d]) => { if (d.open && toMin(d.end) <= toMin(d.start)) throw new Error('Closing time must be after opening time'); });
  if (patch.capacityPerSlot !== undefined && (!Number.isInteger(patch.capacityPerSlot) || patch.capacityPerSlot < 1)) throw new Error('Capacity per slot must be at least 1');
  Object.assign(rules, patch, { slotMinutes: 30 });
  auditAppointments(`Booking rules updated · ${Object.keys(patch).join(', ')}`);
  return getBookingRules();
}
export async function setClosedDate(date: string, reason: string | null): Promise<BookingRules> { rules.closedDates = rules.closedDates.filter((c) => c.date !== date); if (reason !== null) rules.closedDates.push({ date, reason: reason.trim() || 'Closed' }); auditAppointments(`${reason === null ? 'Reopened' : 'Closed'} ${date}${reason ? ` · ${reason}` : ''}`); return getBookingRules(); }
export async function setSlotCapacity(date: string, time: string, capacity: number | null): Promise<BookingRules> { const k = `${date} ${time}`; if (capacity === null) delete rules.slotOverrides[k]; else rules.slotOverrides[k] = Math.max(0, Math.floor(capacity)); return getBookingRules(); }

export const dayState = (date: string): { open: boolean; reason?: string; hours?: DayHours } => { const closed = rules.closedDates.find((c) => c.date === date); if (closed) return { open: false, reason: closed.reason }; const h = rules.days[new Date(`${date}T12:00:00`).getDay()]; return h.open ? { open: true, hours: h } : { open: false, reason: 'Closed this weekday' }; };
const live = (a: Appointment) => a.status !== 'cancelled';
export const slotsFor = (date: string): SlotView[] => {
  const st = dayState(date); if (!st.open || !st.hours) return [];
  const out: SlotView[] = []; const lead = Date.now() + rules.minLeadHours * 3_600_000;
  for (let m = toMin(st.hours.start); m + rules.slotMinutes <= toMin(st.hours.end); m += rules.slotMinutes) {
    const time = hhmm(Math.floor(m / 60), m % 60); const cap = rules.slotOverrides[`${date} ${time}`] ?? rules.capacityPerSlot; const list = appts.filter((a) => live(a) && a.date === date && a.time === time);
    out.push({ time, capacity: cap, booked: list.length, full: list.length >= cap, past: new Date(`${date}T${time}:00`).getTime() < lead, appts: list });
  }
  return out;
};
export async function getDay(date: string) { return resolve({ date, ...dayState(date), slots: slotsFor(date), appts: appts.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time)) }); }
export async function getMonth(year: number, month: number) {
  const first = new Date(year, month, 1); const days: { date: string; open: boolean; reason?: string; booked: number; full: number; total: number }[] = [];
  for (let d = new Date(first); d.getMonth() === month; d.setDate(d.getDate() + 1)) { const date = ymd(d); const st = dayState(date); const s = slotsFor(date); days.push({ date, open: st.open, reason: st.reason, booked: appts.filter((a) => live(a) && a.date === date).length, full: s.filter((x) => x.full).length, total: s.length }); }
  return resolve(days);
}
export async function getAppointmentsToday(): Promise<Appointment[]> { return resolve(appts.filter((a) => a.date === today && live(a)).sort((a, b) => a.time.localeCompare(b.time))); }
export async function searchAppointments(q: string): Promise<Appointment[]> { const s = q.trim().toLowerCase(); return resolve(appts.filter((a) => !s || [a.clientName, a.refNumber ?? '', a.email ?? '', a.phone ?? ''].join(' ').toLowerCase().includes(s)).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))); }

// Same validation the booking page runs — rules are the single source of truth
export function validateBooking(i: ApptInput, source: ApptSource): void {
  if (!rules.enabledTypes[i.type]) throw new Error(`${i.type === 'drop_off' ? 'Drop-off' : 'Pick-up'} appointments are turned off in the booking rules`);
  const st = dayState(i.date); if (!st.open) throw new Error(`${i.date} is closed${st.reason ? ` — ${st.reason}` : ''}`);
  const slot = slotsFor(i.date).find((s) => s.time === i.time); if (!slot) throw new Error(`${fmtSlot(i.time)} is outside the bookable hours for that day`);
  const others = slot.appts.filter((a) => a.id !== i.id).length; if (others >= slot.capacity) throw new Error(`${fmtSlot(i.time)} is full (${slot.capacity} per slot) — pick another time`);
  if (source === 'booking_page') { if (slot.past) throw new Error(`Needs at least ${rules.minLeadHours} h notice`); const max = new Date(); max.setDate(max.getDate() + rules.maxDaysAhead); if (i.date > ymd(max)) throw new Error(`Bookings open up to ${rules.maxDaysAhead} days ahead`); }
}
export async function saveAppointment(i: ApptInput, source: ApptSource = 'staff'): Promise<Appointment> {
  validateBooking(i, source);
  const ref = i.refNumber?.trim() || undefined; const hit = ref ? lookupApptRef(i.type, ref) : null;
  if (ref && !hit) throw new Error(i.type === 'drop_off' ? `No estimate ${ref} — check the number on the quote email` : `No sales order / job ${ref}`);
  if (!ref && source === 'booking_page' && (i.type === 'drop_off' ? rules.requireEstimateForDropOff : rules.requireSoForPickUp)) throw new Error(i.type === 'drop_off' ? 'Estimate # is required to book a drop-off' : 'Invoice (SO) # is required to book a pick-up');
  const brief = !hit && i.clientId ? clientBrief(i.clientId) : null; const name = hit?.clientName ?? brief?.clientName ?? i.clientName?.trim(); if (!name) throw new Error('Client name is required when there is no estimate / SO #');
  const a = actorInfo(); const now = new Date().toISOString();
  const row: Appointment = { id: i.id ?? `ap-${Date.now().toString(36)}`, type: i.type, date: i.date, time: i.time, refNumber: hit?.ref ?? ref, clientId: hit?.clientId ?? i.clientId, clientName: name, email: hit?.email ?? brief?.email ?? (i.email?.trim() || undefined), phone: hit?.phone ?? brief?.phone ?? (i.phone?.trim() || undefined), watch: hit?.watch, notes: i.notes?.trim() || undefined, status: 'booked', source, createdAt: now, createdBy: source === 'staff' ? a.by : 'booking page', updatedAt: now };
  const idx = appts.findIndex((x) => x.id === row.id);
  if (idx >= 0) { const prev = appts[idx]; appts[idx] = { ...prev, ...row, status: prev.status, createdAt: prev.createdAt, createdBy: prev.createdBy, source: prev.source }; auditAppointments(`Appointment updated · ${row.clientName} · ${row.date} ${fmtSlot(row.time)}`); return resolve(appts[idx]); }
  appts.push(row); auditAppointments(`${row.type === 'drop_off' ? 'Drop-off' : 'Pick-up'} booked · ${row.clientName}${row.refNumber ? ` · ${row.refNumber}` : ''} · ${row.date} ${fmtSlot(row.time)} · via ${source === 'staff' ? a.by : 'booking page'}`);
  return resolve(row);
}
export async function setAppointmentStatus(id: string, status: ApptStatus, reason?: string): Promise<Appointment> { const a = appts.find((x) => x.id === id); if (!a) throw new Error('Appointment not found'); a.status = status; a.updatedAt = new Date().toISOString(); if (status === 'cancelled') a.cancelReason = reason?.trim() || undefined; auditAppointments(`Appointment ${status.replace('_', ' ')} · ${a.clientName} · ${a.date} ${fmtSlot(a.time)}${reason ? ` · ${reason}` : ''}`); return resolve({ ...a }); }
export const APPT_TYPE_LABEL: Record<ApptType, string> = { drop_off: 'Drop Off', pick_up: 'Pick Up' };
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
