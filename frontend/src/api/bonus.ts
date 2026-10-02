import { bonusBridge as b, OWNER_USER_ID } from './client';
import type { User } from './types';

// ---- Bonus targets (MH 2026-10-02) — MOCK SQL-view seam -------------------------------------------------------------
// Actuals are READ from named views (v_bonus_*), never summed from jobs / invoices client-side. Revenue views are dated by
// INVOICE date, count views by COMPLETED date. In Keeper each view is one SQL object; the seeded monthly totals below stand in.
// Pace = (actual ÷ elapsed working days) × period working days. Working days = Setup value (default Mon–Fri; Oct 2026 = 22).
// "As of" (time-travel) is NOT-KEEPER — prototype control so pacing / EOM close can be walked without waiting for the calendar.

export type BonusBasis = 'band_room_total' | 'matthew_total' | 'joseph_total' | 'dept_w_sales' | 'dept_p_sales' | 'jobs_completed' | 'components_completed' | 'custom_view';
export type BasisKind = 'revenue' | 'count';
export interface BasisMeta { label: string; kind: BasisKind; view: string; dated: 'invoice' | 'completed'; perTech: boolean; note: string }
export const BASIS_META: Record<BonusBasis, BasisMeta> = {
  band_room_total: { label: 'Band Room total', kind: 'revenue', view: 'v_bonus_band_room_total', dated: 'invoice', perTech: false, note: 'Every B · P · PM line on invoices sent — the whole room' },
  matthew_total: { label: 'Matthew total', kind: 'revenue', view: 'v_bonus_matthew_total', dated: 'invoice', perTech: false, note: 'Band-room lines on invoices sent where the component credit is Matthew (MAM)' },
  joseph_total: { label: 'Joseph total (= Band Room − Matthew)', kind: 'revenue', view: 'v_bonus_joseph_total', dated: 'invoice', perTech: false, note: 'Derived in the view: Band Room total minus Matthew total — the department less Matthew, not a per-tech sum' },
  dept_w_sales: { label: 'Dept W completed sales', kind: 'revenue', view: 'v_bonus_dept_w_sales', dated: 'invoice', perTech: false, note: 'W lines on invoices sent, whole department' },
  dept_p_sales: { label: 'Dept P completed sales', kind: 'revenue', view: 'v_bonus_dept_p_sales', dated: 'invoice', perTech: false, note: 'P lines on invoices sent, whole department' },
  jobs_completed: { label: 'Jobs completed (count, by technician)', kind: 'count', view: 'v_bonus_jobs_completed', dated: 'completed', perTech: true, note: 'Jobs where this technician holds the completion credit, dated by the completion scan' },
  components_completed: { label: 'Components completed (count, by technician)', kind: 'count', view: 'v_bonus_components_completed', dated: 'completed', perTech: true, note: 'Head / case / bracelet completions credited to this technician, dated by the completion scan' },
  custom_view: { label: 'Custom view', kind: 'revenue', view: '(named on the plan)', dated: 'invoice', perTech: false, note: 'Any view that returns date · amount · ref — name it on the plan' },
};
export const BASES = Object.keys(BASIS_META) as BonusBasis[];

export interface BonusTier { pct: number; payout: number }
export interface BonusPlan { id: string; userId: string; basis: BonusBasis; customView?: { name: string; kind: BasisKind }; periodMonths: 1 | 2 | 3; anchorMonth: string; target: number; flatPayout: number; tiers: BonusTier[]; showToStaff: boolean; showPayout: boolean; active: boolean; createdBy: string; createdAt: string; updatedAt: string; note?: string }
export type BonusPlanInput = Omit<BonusPlan, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string };
export interface BonusSettings { workingDays: number[] }
export interface BonusPeriod { key: string; label: string; start: string; end: string; months: number }
export interface BonusViewRow { date: string; amount: number; ref: string; tech?: string }
export type PaceStatus = 'reached' | 'on_pace' | 'behind';
export interface WeekRow { label: string; start: string; end: string; actual: number; wd: number; cumActual: number; cumWd: number; paceLine: number; future: boolean }
export interface BonusResult { id: string; plan: BonusPlan; user: User; kind: BasisKind; period: BonusPeriod; actual: number; target: number; pct: number; status: 'reached' | 'missed'; payout: number; tier?: BonusTier; closedAt: string; closedBy: 'system' | string; earlyReason?: string; paidAt?: string; paidBy?: string }
export interface BonusProgress { plan: BonusPlan; user: User; meta: BasisMeta; kind: BasisKind; period: BonusPeriod; asOf: string; actual: number; target: number; pct: number; periodWd: number; elapsedWd: number; remainingWd: number; pace: number; pacePct: number; status: PaceStatus; projectedPayout: number; payoutIfReached: number; projectedTier?: BonusTier; weekly: WeekRow[]; rows: BonusViewRow[]; lastResult?: BonusResult }

export const OPS_MANAGER_USER_ID = 'u-vienna';
export const BONUS_ANALYTICS_USER_IDS = [OWNER_USER_ID, OPS_MANAGER_USER_ID];
export const canSeeBonusAnalytics = (u: Pick<User, 'id'> | null | undefined) => !!u && BONUS_ANALYTICS_USER_IDS.includes(u.id);
export const DEFAULT_AS_OF = '2026-10-02';
export const AS_OF_PICKS = ['2026-10-02', '2026-10-20', '2026-10-25', '2026-11-01'];
export const AS_OF_EVENT = 'bonus:asof';
export const WEEKDAYS = [{ n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' }, { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' }];

// ---- dates (date-only strings, local) ----
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d ?? 1); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
const monthEnd = (ym: string) => { const [y, m] = ym.split('-').map(Number); return ymd(new Date(y, m, 0)); };
const monthsBetween = (fromYm: string, toYm: string) => { const [fy, fm] = fromYm.split('-').map(Number); const [ty, tm] = toYm.split('-').map(Number); return (ty - fy) * 12 + (tm - fm); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym: string) => MON[Number(ym.slice(5, 7)) - 1];
export const monthLabel = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;
export const shortDay = (s: string) => `${monthName(s.slice(0, 7))} ${Number(s.slice(8, 10))}`;
const periodLabel = (startYm: string, endYm: string) => startYm === endYm ? monthLabel(startYm) : startYm.slice(0, 4) === endYm.slice(0, 4) ? `${monthName(startYm)}–${monthName(endYm)} ${startYm.slice(0, 4)}` : `${monthLabel(startYm)} – ${monthLabel(endYm)}`;
const minDate = (a: string, b: string) => (a < b ? a : b);

// ---- settings · as-of ----
let settings: BonusSettings = { workingDays: [1, 2, 3, 4, 5] };
const isWorkingDay = (s: string) => settings.workingDays.includes(parse(s).getDay());
export const workingDaysBetween = (from: string, to: string) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkingDay(d)) n++; return n; };
export const workingDaysInMonth = (ym: string) => workingDaysBetween(`${ym}-01`, monthEnd(ym));
export const workingDaysLabel = () => { const w = settings.workingDays; return w.length === 5 && !w.includes(6) ? 'Mon–Fri' : w.length === 6 ? 'Mon–Sat' : w.map((n) => WEEKDAYS.find((x) => x.n === n)?.label ?? '').join(' · '); };
export async function getBonusSettings(): Promise<BonusSettings> { return { workingDays: [...settings.workingDays] }; }
export async function setWorkingDays(days: number[]): Promise<BonusSettings> {
  ownerOnly('Working days'); const clean = Array.from(new Set(days.filter((n) => n >= 1 && n <= 6))).sort(); if (!clean.length) throw new Error('Pick at least one working day');
  const before = workingDaysLabel(); settings = { workingDays: clean }; b.audit('settings', `Bonus working days ${before} → ${workingDaysLabel()}`); return getBonusSettings();
}
const AS_OF_KEY = 'rollisuite.bonus.asOf';
let asOf = (typeof localStorage !== 'undefined' && localStorage.getItem(AS_OF_KEY)) || DEFAULT_AS_OF;
export const getAsOf = () => asOf;
export const setAsOf = (d: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('As of must be YYYY-MM-DD'); asOf = d; localStorage.setItem(AS_OF_KEY, d); window.dispatchEvent(new Event(AS_OF_EVENT)); };
const ownerOnly = (what: string) => { if (!b.isOwner()) throw new Error(`${what} is owner-only (MH)`); };
const userOf = (id: string) => { const u = b.users().find((x) => x.id === id); if (!u) throw new Error(`No staff member ${id}`); return u; };

// ---- MOCK views — deterministic daily rows that sum to the seeded monthly totals (cents for revenue, units for counts) ----
const MONTHLY: Record<string, Record<string, number>> = {
  v_bonus_band_room_total: { '2026-07': 2_480_000, '2026-08': 2_625_000, '2026-09': 2_860_000, '2026-10': 2_900_000, '2026-11': 2_750_000, '2026-12': 2_600_000 },
  v_bonus_matthew_total: { '2026-07': 760_000, '2026-08': 800_000, '2026-09': 840_000, '2026-10': 950_000, '2026-11': 880_000, '2026-12': 820_000 },
  v_bonus_dept_w_sales: { '2026-07': 4_150_000, '2026-08': 4_400_000, '2026-09': 4_620_000, '2026-10': 4_730_000, '2026-11': 4_500_000, '2026-12': 4_300_000 },
  v_bonus_dept_p_sales: { '2026-07': 1_180_000, '2026-08': 1_250_000, '2026-09': 1_320_000, '2026-10': 1_380_000, '2026-11': 1_300_000, '2026-12': 1_200_000 },
};
const flat = (n: number) => Object.fromEntries(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].map((m) => [m, n]));
const MONTHLY_TECH: Record<string, Record<string, Record<string, number>>> = {
  v_bonus_jobs_completed: { Leo: { ...flat(13), '2026-10': 11 }, Sam: flat(11), Nico: flat(10), MAM: flat(7), Dre: flat(8), MM: flat(9) },
  v_bonus_components_completed: { Dre: { '2026-07': 39, '2026-08': 41, '2026-09': 42, '2026-10': 31, '2026-11': 38, '2026-12': 36 }, Leo: flat(20), Sam: flat(24), Nico: flat(22), MAM: flat(15), MM: flat(14) },
};
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Shop data lands Mon–Fri regardless of the pacing setting (the setting changes the denominator, not history)
const dataDays = (ym: string) => { const out: string[] = []; for (let d = `${ym}-01`; d <= monthEnd(ym); d = addDays(d, 1)) { const w = parse(d).getDay(); if (w >= 1 && w <= 5) out.push(d); } return out; };
const spreadMoney = (total: number, n: number, seed: number) => { const r = rng(seed); const w = Array.from({ length: n }, () => 0.55 + r()); const sum = w.reduce((a, x) => a + x, 0); let acc = 0; return w.map((x, i) => { const a = i === n - 1 ? total - acc : Math.round((total * x) / sum); acc += a; return a; }); };
const spreadCount = (total: number, n: number, seed: number) => { const r = rng(seed); const base = Math.floor(total / n); const rem = total - base * n; const idx = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } const extra = new Set(idx.slice(0, rem)); return Array.from({ length: n }, (_, i) => base + (extra.has(i) ? 1 : 0)); };
const cache = new Map<string, BonusViewRow[]>();
const monthRows = (view: string, ym: string, tech?: string, customName?: string): BonusViewRow[] => {
  const key = `${view}|${tech ?? ''}|${customName ?? ''}|${ym}`; const hit = cache.get(key); if (hit) return hit;
  const days = dataDays(ym); const seed = hash(key); let rows: BonusViewRow[] = [];
  if (view in MONTHLY) rows = spreadMoney(MONTHLY[view][ym] ?? 0, days.length, seed).map((amount, i) => ({ date: days[i], amount, ref: `INV-26-${pad2(Number(ym.slice(5, 7)))}${pad2(i + 1)}` }));
  else if (view in MONTHLY_TECH) rows = spreadCount(MONTHLY_TECH[view][tech ?? '']?.[ym] ?? 0, days.length, seed).map((amount, i) => ({ date: days[i], amount, ref: `E0${2100 + ((seed >>> 8) % 700) + i}`, tech })).filter((r) => r.amount > 0);
  else if (customName) rows = spreadMoney(600_000 + (hash(`${customName}|${ym}`) % 800_000), days.length, seed).map((amount, i) => ({ date: days[i], amount, ref: `${customName}#${pad2(i + 1)}` }));
  cache.set(key, rows); return rows;
};
const monthsSpan = (from: string, to: string) => { const out: string[] = []; for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) out.push(m); return out; };
// The seam: every actual the module reports comes through here. Keeper swaps the body for `SELECT date, amount, ref FROM <view> WHERE date BETWEEN ? AND ?`.
export const viewRows = (plan: BonusPlan, from: string, to: string): BonusViewRow[] => {
  const meta = BASIS_META[plan.basis]; const tech = meta.perTech ? userOf(plan.userId).shortName : undefined; const inRange = (r: BonusViewRow) => r.date >= from && r.date <= to;
  if (plan.basis === 'joseph_total') return monthsSpan(from, to).flatMap((m) => { const mat = new Map(monthRows('v_bonus_matthew_total', m).map((r) => [r.date, r.amount])); return monthRows('v_bonus_band_room_total', m).map((r) => ({ date: r.date, amount: r.amount - (mat.get(r.date) ?? 0), ref: `${r.ref} − MAM` })); }).filter(inRange);
  return monthsSpan(from, to).flatMap((m) => monthRows(plan.basis === 'custom_view' ? plan.customView?.name ?? 'custom' : meta.view, m, tech, plan.customView?.name)).filter(inRange);
};
const sum = (rows: BonusViewRow[]) => rows.reduce((t, r) => t + r.amount, 0);
export const planKind = (p: BonusPlan): BasisKind => (p.basis === 'custom_view' ? p.customView?.kind ?? 'revenue' : BASIS_META[p.basis].kind);

// ---- plans (seed) ----
const T = '2026-08-28T09:00:00.000Z';
const plans: BonusPlan[] = [
  { id: 'bp-mam', userId: 'u-mam', basis: 'matthew_total', periodMonths: 1, anchorMonth: '2026-09', target: 900_000, flatPayout: 500, tiers: [], showToStaff: true, showPayout: true, active: true, createdBy: 'MH', createdAt: T, updatedAt: T, note: 'Part-time band tech — monthly on his own invoiced total' },
  { id: 'bp-jv', userId: 'u-jv', basis: 'joseph_total', periodMonths: 3, anchorMonth: '2026-08', target: 3_900_000, flatPayout: 1500, tiers: [{ pct: 100, payout: 1500 }, { pct: 110, payout: 2250 }, { pct: 125, payout: 3000 }], showToStaff: true, showPayout: true, active: true, createdBy: 'MH', createdAt: T, updatedAt: T, note: 'Quarter Aug–Oct · department less Matthew · tiered' },
  { id: 'bp-dre', userId: 'u-dre', basis: 'components_completed', periodMonths: 1, anchorMonth: '2026-08', target: 40, flatPayout: 300, tiers: [], showToStaff: true, showPayout: true, active: true, createdBy: 'MH', createdAt: T, updatedAt: T, note: 'Polisher — completions credited at the gate-out scan' },
  { id: 'bp-mm', userId: 'u-mm', basis: 'dept_w_sales', periodMonths: 2, anchorMonth: '2026-09', target: 9_000_000, flatPayout: 1200, tiers: [], showToStaff: true, showPayout: false, active: true, createdBy: 'MH', createdAt: T, updatedAt: T, note: 'Two-month Sep–Oct on the whole W department · payout hidden from the card' },
  { id: 'bp-leo', userId: 'u-leo', basis: 'jobs_completed', periodMonths: 1, anchorMonth: '2026-09', target: 12, flatPayout: 150, tiers: [], showToStaff: false, showPayout: true, active: true, createdBy: 'MH', createdAt: T, updatedAt: T, note: 'Not shown to staff yet — MH wants a month of history first' },
];
const early = new Map<string, { at: string; by: string; reason: string }>();
const paid = new Map<string, { at: string; by: string }>([['bp-dre|2026-08', { at: '2026-09-03T14:20:00.000Z', by: 'MH' }]]);
const rk = (planId: string, periodKey: string) => `${planId}|${periodKey}`;

// ---- periods ----
export const periodAt = (plan: BonusPlan, index: number): BonusPeriod => { const startYm = addMonths(plan.anchorMonth, index * plan.periodMonths); const endYm = addMonths(startYm, plan.periodMonths - 1); return { key: plan.periodMonths === 1 ? startYm : `${startYm}..${endYm}`, label: periodLabel(startYm, endYm), start: `${startYm}-01`, end: monthEnd(endYm), months: plan.periodMonths }; };
const periodIndexAt = (plan: BonusPlan, date: string) => { const n = monthsBetween(plan.anchorMonth, date.slice(0, 7)); return n < 0 ? -1 : Math.floor(n / plan.periodMonths); };
const payoutFor = (plan: BonusPlan, amount: number): { payout: number; tier?: BonusTier } => {
  if (plan.tiers.length) { const hit = [...plan.tiers].sort((a, b) => b.pct - a.pct).find((t) => amount >= (plan.target * t.pct) / 100); return hit ? { payout: hit.payout, tier: hit } : { payout: 0 }; }
  return { payout: amount >= plan.target ? plan.flatPayout : 0 };
};
export const topPayout = (plan: BonusPlan) => (plan.tiers.length ? Math.max(...plan.tiers.map((t) => t.payout)) : plan.flatPayout);
export const periodMonthsLabel = (n: number) => (n === 1 ? 'Monthly' : n === 2 ? 'Two-month' : 'Quarterly');

const closedAtFor = (plan: BonusPlan, p: BonusPeriod) => early.get(rk(plan.id, p.key)) ?? null;
const isClosed = (plan: BonusPlan, p: BonusPeriod, at: string) => { const e = closedAtFor(plan, p); return p.end < at || (!!e && e.at <= at); };
const resultFor = (plan: BonusPlan, p: BonusPeriod): BonusResult => {
  const e = closedAtFor(plan, p); const through = e ? minDate(e.at, p.end) : p.end; const actual = sum(viewRows(plan, p.start, through)); const { payout, tier } = payoutFor(plan, actual); const pd = paid.get(rk(plan.id, p.key));
  return { id: rk(plan.id, p.key), plan, user: userOf(plan.userId), kind: planKind(plan), period: p, actual, target: plan.target, pct: plan.target ? Math.round((actual / plan.target) * 1000) / 10 : 0, status: actual >= plan.target ? 'reached' : 'missed', payout, tier, closedAt: e ? e.at : addDays(p.end, 1), closedBy: e ? e.by : 'system', earlyReason: e?.reason, paidAt: pd?.at, paidBy: pd?.by };
};
const closedResults = (plan: BonusPlan, at = asOf): BonusResult[] => { const out: BonusResult[] = []; for (let i = 0; ; i++) { const p = periodAt(plan, i); if (p.start > at) break; if (isClosed(plan, p, at)) out.push(resultFor(plan, p)); } return out; };

const weekly = (plan: BonusPlan, p: BonusPeriod, rows: BonusViewRow[], at: string): WeekRow[] => {
  const out: WeekRow[] = []; let cumActual = 0; let cumWd = 0; const periodWd = workingDaysBetween(p.start, p.end);
  for (let s = p.start; s <= p.end;) { const dow = parse(s).getDay(); const toSun = dow === 0 ? 0 : 7 - dow; const e = minDate(addDays(s, toSun), p.end); const actual = sum(rows.filter((r) => r.date >= s && r.date <= e && r.date <= at)); const wd = workingDaysBetween(s, e); cumActual += actual; cumWd += wd; out.push({ label: s.slice(0, 7) === e.slice(0, 7) ? `${shortDay(s)}–${Number(e.slice(8, 10))}` : `${shortDay(s)} – ${shortDay(e)}`, start: s, end: e, actual, wd, cumActual, cumWd, paceLine: periodWd ? Math.round((plan.target * cumWd) / periodWd) : 0, future: s > at }); s = addDays(e, 1); }
  return out;
};
const progressFor = (plan: BonusPlan, at = asOf): BonusProgress | null => {
  const idx = periodIndexAt(plan, at); if (idx < 0) return null; const period = periodAt(plan, idx); if (isClosed(plan, period, at)) return null;
  const rows = viewRows(plan, period.start, minDate(at, period.end)); const actual = sum(rows); const periodWd = workingDaysBetween(period.start, period.end); const elapsedWd = workingDaysBetween(period.start, at); const pace = Math.round((actual / Math.max(1, elapsedWd)) * periodWd);
  const status: PaceStatus = actual >= plan.target ? 'reached' : pace >= plan.target ? 'on_pace' : 'behind'; const proj = payoutFor(plan, Math.max(actual, pace)); const prev = closedResults(plan, at).at(-1);
  return { plan, user: userOf(plan.userId), meta: BASIS_META[plan.basis], kind: planKind(plan), period, asOf: at, actual, target: plan.target, pct: plan.target ? Math.round((actual / plan.target) * 1000) / 10 : 0, periodWd, elapsedWd, remainingWd: Math.max(0, periodWd - elapsedWd), pace, pacePct: plan.target ? Math.round((pace / plan.target) * 1000) / 10 : 0, status, projectedPayout: proj.payout, projectedTier: proj.tier, payoutIfReached: topPayout(plan), weekly: weekly(plan, period, rows, at), rows: rows.slice().sort((a, b) => b.date.localeCompare(a.date)), lastResult: prev };
};

// ---- reads ----
export async function getBonusPlans(): Promise<(BonusPlan & { user: User })[]> { return plans.map((p) => ({ ...p, user: userOf(p.userId) })); }
export async function getBonusProgress(): Promise<BonusProgress[]> { return plans.filter((p) => p.active).map((p) => progressFor(p)).filter((x): x is BonusProgress => !!x); }
export async function getBonusResults(): Promise<BonusResult[]> { return plans.flatMap((p) => closedResults(p)).sort((a, b) => b.period.end.localeCompare(a.period.end) || a.user.shortName.localeCompare(b.user.shortName)); }
export async function getUnpaidBonusResults(): Promise<BonusResult[]> { return (await getBonusResults()).filter((r) => r.payout > 0 && !r.paidAt); }
// Staff card: their own plan(s) only, and only when the plan says Show to staff
export async function getMyBonus(userId: string): Promise<BonusProgress[]> { return plans.filter((p) => p.active && p.showToStaff && p.userId === userId).map((p) => progressFor(p)).filter((x): x is BonusProgress => !!x); }
export const monthWorkingDays = (ym: string) => workingDaysInMonth(ym);

// ---- writes (owner-only) ----
export async function saveBonusPlan(input: BonusPlanInput): Promise<BonusPlan> {
  ownerOnly('Bonus plans'); const u = userOf(input.userId); if (!/^\d{4}-\d{2}$/.test(input.anchorMonth)) throw new Error('Effective month must be YYYY-MM'); if (!(input.target > 0)) throw new Error('Target must be above zero');
  if (input.basis === 'custom_view' && !input.customView?.name.trim()) throw new Error('Name the custom view'); if (input.tiers.some((t) => !(t.pct > 0) || t.payout < 0)) throw new Error('Tiers need a % above zero'); if (!input.tiers.length && input.flatPayout < 0) throw new Error('Payout cannot be negative');
  const now = new Date().toISOString(); const tiers = [...input.tiers].sort((a, b) => a.pct - b.pct); const a = b.actor();
  if (input.id) { const i = plans.findIndex((p) => p.id === input.id); if (i < 0) throw new Error('Plan not found'); plans[i] = { ...plans[i], ...input, id: input.id, tiers, updatedAt: now }; b.audit('settings', `Bonus plan updated · ${u.shortName} · ${BASIS_META[input.basis].label} · ${periodMonthsLabel(input.periodMonths)} from ${monthLabel(input.anchorMonth)}`); return plans[i]; }
  const p: BonusPlan = { ...input, id: b.newId('bp'), tiers, createdBy: a.by, createdAt: now, updatedAt: now }; plans.push(p); b.audit('settings', `Bonus plan created · ${u.shortName} · ${BASIS_META[input.basis].label} · ${periodMonthsLabel(input.periodMonths)} from ${monthLabel(input.anchorMonth)}`); return p;
}
export async function setBonusPlanFlag(id: string, flag: 'showToStaff' | 'showPayout' | 'active', value: boolean): Promise<BonusPlan> {
  ownerOnly('Bonus plans'); const p = plans.find((x) => x.id === id); if (!p) throw new Error('Plan not found'); p[flag] = value; p.updatedAt = new Date().toISOString();
  b.audit('settings', `Bonus plan ${userOf(p.userId).shortName} · ${flag === 'showToStaff' ? 'show to staff' : flag === 'showPayout' ? 'show payout' : 'active'} → ${value ? 'on' : 'off'}`); return p;
}
// Close the CURRENT period early (owner, reason required) — actual freezes at the as-of date; the row joins Closed periods immediately
export async function closeBonusPeriodEarly(planId: string, reason: string): Promise<BonusResult> {
  ownerOnly('Closing a period'); const p = plans.find((x) => x.id === planId); if (!p) throw new Error('Plan not found'); if (!reason.trim()) throw new Error('A reason is required to close early');
  const pr = progressFor(p); if (!pr) throw new Error('No open period to close'); early.set(rk(p.id, pr.period.key), { at: asOf, by: b.actor().by, reason: reason.trim() });
  const r = resultFor(p, pr.period); b.audit('accounting', `Bonus period closed early · ${r.user.shortName} · ${pr.period.label} · ${r.status} · payout $${r.payout} · ${reason.trim()}`); return r;
}
// Mark paid locks the row — no un-pay in the prototype (Keeper: payroll export owns the reversal)
export async function markBonusPaid(planId: string, periodKey: string): Promise<BonusResult> {
  ownerOnly('Mark paid'); const p = plans.find((x) => x.id === planId); if (!p) throw new Error('Plan not found'); const r = (await getBonusResults()).find((x) => x.plan.id === planId && x.period.key === periodKey); if (!r) throw new Error('Period is not closed'); if (r.paidAt) throw new Error('Already marked paid');
  if (r.payout <= 0) throw new Error('Nothing to pay on this row'); paid.set(rk(planId, periodKey), { at: new Date().toISOString(), by: b.actor().by }); b.audit('accounting', `Bonus paid · ${r.user.shortName} · ${r.period.label} · $${r.payout}`); return resultFor(p, r.period);
}
export const resultsCsv = (rows: BonusResult[]) => {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`; const amt = (r: BonusResult, n: number) => (r.kind === 'revenue' ? (n / 100).toFixed(2) : String(n));
  return [['staff', 'basis', 'period', 'period_start', 'period_end', 'actual', 'target', 'pct', 'result', 'tier_pct', 'payout_usd', 'closed_at', 'closed_by', 'early_reason', 'paid_at', 'paid_by'].join(','), ...rows.map((r) => [r.user.shortName, BASIS_META[r.plan.basis].label, r.period.label, r.period.start, r.period.end, amt(r, r.actual), amt(r, r.target), r.pct, r.status, r.tier?.pct ?? '', r.payout, r.closedAt, r.closedBy, r.earlyReason ?? '', r.paidAt ?? '', r.paidBy ?? ''].map(esc).join(','))].join('\n');
};
