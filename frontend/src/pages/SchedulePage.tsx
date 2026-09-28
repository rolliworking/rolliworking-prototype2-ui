import { CalendarDays, ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as ap from '@/api/appointments';
import * as api from '@/api/client';
import type { Appointment, ApptInput, ApptStatus, ApptType, BookingRules } from '@/api/appointments';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

const TONE: Record<ApptType, string> = { drop_off: 'bg-sky-50 text-sky-800 ring-sky-200', pick_up: 'bg-amber-50 text-amber-900 ring-amber-200' };
const STATUS_TONE: Record<ApptStatus, string> = { booked: 'text-ink-500', arrived: 'text-sky-700', completed: 'text-moss-700', no_show: 'text-rose-700', cancelled: 'text-ink-300 line-through' };
export const TypePill = ({ t }: { t: ApptType }) => <span data-testid="appt-type" className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${TONE[t]}`}>{ap.APPT_TYPE_LABEL[t]}</span>;
// Hitlist line per MH ruling: drop-off → time + est#; pick-up → time + SO# + client name
export const apptLine = (a: Appointment) => (a.type === 'drop_off' ? `${a.refNumber ?? a.clientName}` : `${a.refNumber ? `${a.refNumber} · ` : ''}${a.clientName}`);

export default function SchedulePage() {
  const now = new Date(); const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(ap.ymd(now)); const [month, setMonth] = useState<Awaited<ReturnType<typeof ap.getMonth>>>([]); const [day, setDay] = useState<Awaited<ReturnType<typeof ap.getDay>> | null>(null);
  const [rules, setRules] = useState<BookingRules | null>(null); const [form, setForm] = useState<Partial<ApptInput> | null>(null); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setMonth(await ap.getMonth(ym.y, ym.m)); setDay(await ap.getDay(sel)); setRules(await ap.getBookingRules()); }, [ym, sel]);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, m: string) => { try { setError(null); await fn(); await load(); setMsg(m); setTimeout(() => setMsg(null), 2500); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const first = new Date(ym.y, ym.m, 1); const lead = first.getDay(); const label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const closedHere = rules?.closedDates.find((c) => c.date === sel);
  return <div data-testid="schedule-page" className="space-y-4">
    <Head title="Schedule" sub={<>Drop-off &amp; pick-up appointments · same rules as the public booking link · <Link to="/setup#booking-rules" data-testid="schedule-rules-link" className="underline">Booking rules</Link></>} action={<Button variant="primary" data-testid="appt-new" onClick={() => setForm({ type: 'drop_off', date: sel })}><Plus size={13} /> New appointment</Button>} />
    <Flash error={error} msg={msg} />
    <div className="grid grid-cols-[420px_1fr] gap-4">
      <Card testId="schedule-month" bodyClassName="p-3">
        <div className="mb-2 flex items-center justify-between"><button data-testid="month-prev" onClick={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} className="grid h-7 w-7 place-items-center rounded-sm border border-line hover:bg-canvas"><ChevronLeft size={14} /></button><div data-testid="month-label" className="text-sm font-semibold">{label}</div><button data-testid="month-next" onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} className="grid h-7 w-7 place-items-center rounded-sm border border-line hover:bg-canvas"><ChevronRight size={14} /></button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-ink-400">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">{Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}{month.map((d) => { const on = d.date === sel; const isToday = d.date === ap.ymd(now); return <button key={d.date} data-testid={`day-${d.date}`} data-open={d.open} data-full={d.total > 0 && d.full === d.total} onClick={() => setSel(d.date)} className={`flex h-14 flex-col items-start rounded-sm border p-1 text-left text-xs ${on ? 'border-ink bg-ink text-white' : d.open ? 'border-line bg-surface hover:bg-canvas' : 'border-dashed border-line bg-canvas/60 text-ink-300'}`}><span className={`font-semibold ${isToday && !on ? 'text-brand' : ''}`}>{Number(d.date.slice(-2))}</span>{d.open ? <span className={`mt-auto text-[10px] ${on ? 'text-white/80' : 'text-ink-500'}`}>{d.booked ? `${d.booked} booked` : ''}{d.full ? ` · ${d.full} full` : ''}</span> : <span className="mt-auto inline-flex items-center gap-0.5 text-[10px]"><Lock size={9} /> closed</span>}</button>; })}</div>
        <p className="mt-2 text-[11px] text-ink-400">Weekday pattern + hours + capacity come from Setup → Booking rules. One-off closed days (holidays) sit on top — set below.</p>
      </Card>
      <div className="space-y-3">
        {day && <Card title={new Date(`${sel}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} subtitle={day.open ? `${day.hours?.start}–${day.hours?.end} · ${day.slots.length} slots × 30 min · capacity ${rules?.capacityPerSlot}/slot` : `Closed — ${day.reason}`} testId="schedule-day" action={<div className="flex items-center gap-2">{closedHere ? <Button size="sm" data-testid="day-reopen" onClick={() => run(() => ap.setClosedDate(sel, null), 'Day reopened')}>Reopen day</Button> : <Button size="sm" data-testid="day-close" onClick={() => { const r = window.prompt('Reason (e.g. holiday)', 'Holiday'); if (r !== null) void run(() => ap.setClosedDate(sel, r), 'Closed for the day'); }}>Close this day</Button>}</div>}>
          {!day.open ? <p data-testid="day-closed" className="text-xs text-ink-500">No slots — this day is closed{closedHere ? ` (${closedHere.reason})` : ' by the weekly pattern'}.</p>
            : <ul data-testid="day-slots" className="grid grid-cols-2 gap-1.5">{day.slots.map((s) => <li key={s.time} data-testid={`slot-${s.time}`} data-full={s.full} className={`rounded-sm border px-2 py-1.5 text-xs ${s.full ? 'border-rose-200 bg-rose-50/60' : 'border-line bg-surface'}`}>
              <div className="flex items-center gap-2"><span className="w-16 font-mono font-semibold">{ap.fmtSlot(s.time)}</span><span className={`text-[10px] ${s.full ? 'font-semibold text-rose-700' : 'text-ink-400'}`}>{s.booked}/{s.capacity}{s.full ? ' · FULL' : ''}</span>{!s.full && <button data-testid={`slot-book-${s.time}`} onClick={() => setForm({ type: 'drop_off', date: sel, time: s.time })} className="ml-auto text-[11px] text-ink-500 underline hover:text-ink">book</button>}</div>
              {s.appts.map((a) => <div key={a.id} data-testid={`appt-${a.id}`} className="mt-1 flex items-center gap-1.5"><TypePill t={a.type} /><button onClick={() => setForm({ id: a.id, type: a.type, date: a.date, time: a.time, refNumber: a.refNumber, clientName: a.clientName, email: a.email, phone: a.phone, notes: a.notes })} className="truncate text-left hover:underline">{apptLine(a)}</button><span className={`ml-auto text-[10px] capitalize ${STATUS_TONE[a.status]}`}>{a.status.replace('_', ' ')}</span></div>)}
            </li>)}</ul>}
        </Card>}
        {day && day.appts.length > 0 && <Card title={`Day list · ${day.appts.filter((a) => a.status !== 'cancelled').length}`} bodyClassName="p-0" testId="schedule-day-list"><ul className="divide-y divide-line/70 text-xs">{day.appts.map((a) => <li key={a.id} data-testid={`day-row-${a.id}`} className="flex flex-wrap items-center gap-2 px-3 py-1.5"><span className="w-16 font-mono font-semibold">{ap.fmtSlot(a.time)}</span><TypePill t={a.type} />{a.refNumber && <span className="font-mono">{a.refNumber}</span>}<span className="font-medium">{a.clientName}</span>{a.watch && <span className="text-ink-500">{a.watch}</span>}<span className={`text-[10px] capitalize ${STATUS_TONE[a.status]}`}>{a.status.replace('_', ' ')}</span><span className="ml-auto flex gap-1">{a.status === 'booked' && <><Button size="sm" variant="ghost" data-testid={`appt-arrived-${a.id}`} onClick={() => run(() => ap.setAppointmentStatus(a.id, 'arrived'), 'Marked arrived')}>Arrived</Button><Button size="sm" variant="ghost" data-testid={`appt-noshow-${a.id}`} onClick={() => run(() => ap.setAppointmentStatus(a.id, 'no_show'), 'Marked no-show')}>No-show</Button><Button size="sm" variant="ghost" data-testid={`appt-cancel-${a.id}`} onClick={() => { const r = window.prompt('Cancel reason'); if (r !== null) void run(() => ap.setAppointmentStatus(a.id, 'cancelled', r), 'Cancelled'); }}>Cancel</Button></>}{a.status === 'arrived' && <Button size="sm" variant="ghost" data-testid={`appt-complete-${a.id}`} onClick={() => run(() => ap.setAppointmentStatus(a.id, 'completed'), 'Completed')}>Complete</Button>}</span></li>)}</ul></Card>}
      </div>
    </div>
    {form && <ApptForm init={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); void run(async () => undefined, m); }} />}
  </div>;
}

function ApptForm({ init, onClose, onSaved }: { init: Partial<ApptInput>; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState<ApptInput>({ type: 'drop_off', date: ap.ymd(new Date()), time: '', refNumber: '', clientName: '', email: '', phone: '', notes: '', ...init });
  const [slots, setSlots] = useState<ReturnType<typeof ap.slotsFor>>([]); const [err, setErr] = useState<string | null>(null); const [hint, setHint] = useState<string | null>(null);
  useEffect(() => { setSlots(ap.slotsFor(f.date)); }, [f.date]);
  useEffect(() => { const r = f.refNumber?.trim(); if (!r) return setHint(null); const hit = api.lookupApptRef(f.type, r); setHint(hit ? `${hit.clientName}${hit.watch ? ` · ${hit.watch}` : ''} · ${hit.email}` : `No ${f.type === 'drop_off' ? 'estimate' : 'sales order'} ${r}`); }, [f.refNumber, f.type]);
  const save = async () => { try { setErr(null); const a = await ap.saveAppointment(f, 'staff'); onSaved(`${ap.APPT_TYPE_LABEL[a.type]} ${f.id ? 'updated' : 'booked'} · ${a.clientName} · ${ap.fmtSlot(a.time)}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <Modal testId="appt-modal" title={f.id ? 'Edit appointment' : 'New appointment'} width="w-[560px]" onClose={onClose}>
    <div className="space-y-3 text-xs text-ink-500">
      <div className="flex gap-1">{(['drop_off', 'pick_up'] as ApptType[]).map((t) => <button key={t} data-testid={`appt-type-${t}`} onClick={() => setF({ ...f, type: t })} className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${f.type === t ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas'}`}>{ap.APPT_TYPE_LABEL[t]}</button>)}</div>
      <label className="block">{f.type === 'drop_off' ? 'Estimate / quote number' : 'Invoice (SO) or job number'}<input data-testid="appt-ref" value={f.refNumber ?? ''} onChange={(e) => setF({ ...f, refNumber: e.target.value })} placeholder={f.type === 'drop_off' ? 'e.g. E02060' : 'e.g. SO-26-0103'} className={`${field} mt-1 block w-full font-mono`} />{hint && <span data-testid="appt-ref-hint" className={`mt-1 block ${hint.startsWith('No ') ? 'text-rose-700' : 'text-moss-700'}`}>{hint}</span>}</label>
      {!hint?.includes('·') && <div className="grid grid-cols-3 gap-2"><label>Client name<input data-testid="appt-client" value={f.clientName ?? ''} onChange={(e) => setF({ ...f, clientName: e.target.value })} className={`${field} mt-1 block w-full`} /></label><label>Email<input data-testid="appt-email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${field} mt-1 block w-full`} /></label><label>Phone<input data-testid="appt-phone" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`${field} mt-1 block w-full`} /></label></div>}
      <div className="grid grid-cols-[150px_1fr] gap-2"><label>Date<input type="date" data-testid="appt-date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, time: '' })} className={`${field} mt-1 block w-full`} /></label>
        <div>Time slot<div data-testid="appt-slots" className="mt-1 flex flex-wrap gap-1">{slots.map((s) => { const mine = s.appts.some((a) => a.id === f.id); const full = s.full && !mine; return <button key={s.time} data-testid={`appt-slot-${s.time}`} disabled={full} onClick={() => setF({ ...f, time: s.time })} className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${f.time === s.time ? 'border-ink bg-ink text-white' : full ? 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-400 line-through' : 'border-line bg-surface hover:bg-canvas'}`} title={full ? 'Full' : `${s.booked}/${s.capacity}`}>{ap.fmtSlot(s.time)}</button>; })}{!slots.length && <span className="text-ink-400">Closed — pick another day</span>}</div></div></div>
      <label className="block">Notes<textarea data-testid="appt-notes" rows={2} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
      {err && <div data-testid="appt-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="appt-save" disabled={!f.time} onClick={() => void save()}>{f.id ? 'Save changes' : 'Book'}</Button></div>
    </div>
  </Modal>;
}

// /today block — every manager's daily hit list carries today's appointments
export const AppointmentsTodayCard = () => {
  const [rows, setRows] = useState<Appointment[]>([]);
  useEffect(() => { void ap.getAppointmentsToday().then(setRows); }, []);
  return <Card title="Appointments today" subtitle={`${rows.length} booked · drop-offs show est#, pick-ups show SO# + client`} testId="today-appointments-card" bodyClassName="p-0" className="border-l-[3px] border-sky-400" action={<Link to="/appointments" data-testid="today-appointments-link" className="inline-flex items-center gap-1 text-xs text-ink-500 underline"><CalendarDays size={12} /> Schedule</Link>}>
    <ul className="divide-y divide-line/70 text-xs">{rows.map((a) => <li key={a.id} data-testid={`today-appt-${a.id}`} className="flex items-center gap-2 px-4 py-1.5"><span className="w-16 font-mono font-semibold text-ink">{ap.fmtSlot(a.time)}</span><TypePill t={a.type} /><span className="font-medium text-ink">{apptLine(a)}</span><span className={`ml-auto text-[10px] capitalize ${STATUS_TONE[a.status]}`}>{a.status.replace('_', ' ')}</span></li>)}{!rows.length && <li className="px-4 py-3 text-ink-400">No appointments today.</li>}</ul>
  </Card>;
};

// Setup → Booking rules: ONE source of truth for the public booking link and the internal Schedule
export const BookingRulesCard = () => {
  const [r, setR] = useState<BookingRules | null>(null); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void ap.getBookingRules().then(setR); }, []);
  if (!r) return null;
  const save = async (patch: Partial<BookingRules>, m: string) => { try { setErr(null); setR(await ap.saveBookingRules(patch)); setMsg(m); setTimeout(() => setMsg(null), 2000); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const setDay = (wd: number, patch: Partial<BookingRules['days'][number]>) => setR({ ...r, days: { ...r.days, [wd]: { ...r.days[wd], ...patch } } });
  return <Card title="Booking rules" subtitle="Drives upload.rolliworks.com/book AND the internal Schedule — one config, changes apply to both immediately" testId="booking-rules-card">
    <div id="booking-rules" className="grid grid-cols-[1fr_260px] gap-4 text-xs">
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Days & hours</div>
        <table className="w-full"><tbody>{ap.WEEKDAYS.map((name, wd) => { const d = r.days[wd]; return <tr key={wd} data-testid={`rule-day-${wd}`} className="border-t border-line/70"><td className="py-1"><label className="inline-flex items-center gap-2"><input type="checkbox" data-testid={`rule-day-open-${wd}`} checked={d.open} onChange={(e) => setDay(wd, { open: e.target.checked })} /> <span className={d.open ? 'font-medium' : 'text-ink-400'}>{name}</span></label></td><td className="py-1 text-right">{d.open ? <span className="inline-flex items-center gap-1"><input type="time" step={1800} data-testid={`rule-day-start-${wd}`} value={d.start} onChange={(e) => setDay(wd, { start: e.target.value })} className={`${field} w-28`} />–<input type="time" step={1800} data-testid={`rule-day-end-${wd}`} value={d.end} onChange={(e) => setDay(wd, { end: e.target.value })} className={`${field} w-28`} /></span> : <span className="text-ink-300">closed</span>}</td></tr>; })}</tbody></table>
        <Button size="sm" variant="primary" className="mt-2" data-testid="rule-days-save" onClick={() => save({ days: r.days }, 'Days & hours saved')}>Save days & hours</Button>
      </div>
      <div className="space-y-2">
        <label className="block">Slot length<div className={`${field} mt-1 bg-canvas text-ink-500`}>30 minutes (fixed)</div></label>
        <label className="block">Capacity per slot<input type="number" min={1} data-testid="rule-capacity" value={r.capacityPerSlot} onChange={(e) => setR({ ...r, capacityPerSlot: Number(e.target.value) })} className={`${field} mt-1 block w-full`} /><span className="text-[11px] text-ink-400">clients that can book the same 30-min slot</span></label>
        <div className="grid grid-cols-2 gap-2"><label>Min notice (h)<input type="number" min={0} data-testid="rule-lead" value={r.minLeadHours} onChange={(e) => setR({ ...r, minLeadHours: Number(e.target.value) })} className={`${field} mt-1 block w-full`} /></label><label>Max days ahead<input type="number" min={1} data-testid="rule-max-days" value={r.maxDaysAhead} onChange={(e) => setR({ ...r, maxDaysAhead: Number(e.target.value) })} className={`${field} mt-1 block w-full`} /></label></div>
        <div className="space-y-1">{(['drop_off', 'pick_up'] as ApptType[]).map((t) => <label key={t} className="flex items-center gap-2"><input type="checkbox" data-testid={`rule-type-${t}`} checked={r.enabledTypes[t]} onChange={(e) => setR({ ...r, enabledTypes: { ...r.enabledTypes, [t]: e.target.checked } })} /> {ap.APPT_TYPE_LABEL[t]} bookable</label>)}
          <label className="flex items-center gap-2"><input type="checkbox" data-testid="rule-require-est" checked={r.requireEstimateForDropOff} onChange={(e) => setR({ ...r, requireEstimateForDropOff: e.target.checked })} /> Estimate # required for drop-off</label>
          <label className="flex items-center gap-2"><input type="checkbox" data-testid="rule-require-so" checked={r.requireSoForPickUp} onChange={(e) => setR({ ...r, requireSoForPickUp: e.target.checked })} /> Invoice # required for pick-up</label></div>
        <label className="block">Confirmation message<textarea rows={3} data-testid="rule-confirmation" value={r.confirmationMessage} onChange={(e) => setR({ ...r, confirmationMessage: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
        <Button size="sm" variant="primary" data-testid="rule-slots-save" onClick={() => save({ capacityPerSlot: r.capacityPerSlot, minLeadHours: r.minLeadHours, maxDaysAhead: r.maxDaysAhead, enabledTypes: r.enabledTypes, requireEstimateForDropOff: r.requireEstimateForDropOff, requireSoForPickUp: r.requireSoForPickUp, confirmationMessage: r.confirmationMessage }, 'Slot rules saved')}>Save slot rules</Button>
        <div className="text-[11px] text-ink-400">Closed days (one-off): {r.closedDates.length ? r.closedDates.map((c) => `${c.date} · ${c.reason}`).join(' — ') : 'none'} · set from the Schedule calendar</div>
      </div>
    </div>
    {(msg || err) && <div data-testid="rule-flash" className={`mt-2 rounded-md px-3 py-1.5 text-xs ${err ? 'bg-rose-50 text-rose-700' : 'bg-moss-50 text-moss-700'}`}>{err ?? msg}</div>}
  </Card>;
};
