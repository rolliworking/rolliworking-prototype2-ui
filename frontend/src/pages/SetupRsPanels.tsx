import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { CatalogService, DeptCode, LineType, MessageTemplate } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field, Flash, useLoad } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge } from '@/components/ui/Pills';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';
import { BookingRulesCard } from '@/pages/SchedulePage';
import { LongTermStorageCard } from '@/components/setup/LongTermStorageCard';


export function SetupRsPanels() {
  const { data, error, msg, run } = useLoad(async () => ({ users: await api.getUsers(), catalog: await api.getCatalogAdmin(), templates: await api.getTemplates(), variants: await api.getAllPersonalTemplates(), locations: await api.getLocations() }));
  const [cf, setCf] = useState<{ id?: string; name: string; dept: DeptCode; rate: number; type: LineType } | null>(null);
  if (!data) return null;
  return <>
    <Flash error={error} msg={msg} />
    <Card title="Users & roles" subtitle="Moved — the unified Staff list (create · invite · roles · department · disable) lives in Setup → Organisation" testId="setup-users-card"><Link to="/setup/org?tab=staff" data-testid="setup-users-open-org" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Organisation → Staff <ArrowRight size={12} /></Link></Card>
    <Card title="Service catalog" subtitle="Add / edit / retire · department attribution drives the P&L" action={<Button size="sm" data-testid="catalog-new" onClick={() => setCf({ name: '', dept: 'W', rate: 0, type: 'service' })}>Add service</Button>} bodyClassName="p-0" testId="setup-catalog-card">
      <Table><thead><tr><Th>Service</Th><Th>Dept</Th><Th>Type</Th><Th className="text-right">Rate</Th><Th /></tr></thead><tbody>
        {data.catalog.map((c: CatalogService & { retired: boolean }) => <tr key={c.id} data-testid={`catalog-row-${c.id}`} className={c.retired ? 'opacity-50' : ''}><Td className="text-xs">{c.name}{c.retired && <span className="ml-1 text-[10px] text-ink-400">retired</span>}</Td><Td><DeptBadge code={c.dept} /></Td><Td className="text-xs capitalize">{c.type}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(c.rate)}</Td><Td className="text-right"><Button size="sm" variant="ghost" data-testid={`catalog-edit-${c.id}`} onClick={() => setCf({ id: c.id, name: c.name, dept: c.dept, rate: c.rate, type: c.type })}>Edit</Button><Button size="sm" variant="ghost" data-testid={`catalog-retire-${c.id}`} onClick={() => run(() => api.retireCatalogService(c.id, !c.retired), c.retired ? 'Restored' : 'Retired')}>{c.retired ? 'Restore' : 'Retire'}</Button></Td></tr>)}
      </tbody></Table>
    </Card>
    <Card title="Message templates" subtitle={<span className="inline-flex items-center gap-1.5">One store for every template — Inbox composer, Estimate → Send and the system sends · categories · attachments · per-person pinned row (max {api.MAX_TEMPLATE_PINS}) · archive instead of delete <Provisional note="Some legacy Sent writers still take bodies from code — wiring pending" /></span>} testId="setup-templates-card" action={<Link to="/setup/templates" data-testid="setup-open-templates" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open Setup → Templates <ArrowRight size={12} /></Link>}>
      <div className="flex flex-wrap gap-1.5 text-[11px]" data-testid="setup-templates-summary">{api.TEMPLATE_CATEGORIES.map((c) => { const n = data.templates.filter((t: MessageTemplate) => t.active !== false && (t.category ?? 'general') === c.key).length; return <span key={c.key} data-testid={`setup-templates-cat-${c.key}`} className="rounded-sm border border-line bg-canvas px-2 py-0.5 text-ink-700">{c.label} <b className="font-mono">{n}</b></span>; })}<span className="rounded-sm px-2 py-0.5 text-ink-400">{data.templates.filter((t: MessageTemplate) => t.active === false).length} archived · {data.variants.length} personal variant{data.variants.length === 1 ? '' : 's'} · {api.pinnedKeysSync().length} pinned by you</span></div>
    </Card>
    <BookingRulesCard />
    <FeatureSwitchesCard />
    <LongTermStorageCard />
    <RcAccessCard />
    <div className="grid grid-cols-2 gap-4">
      <Card title="Locations" subtitle="Stock locations · division-stamped" bodyClassName="p-0" testId="setup-locations-card"><ul className="divide-y divide-line/70">{data.locations.map((l) => <li key={l.id} className="flex justify-between px-4 py-2 text-xs"><span>{l.name}</span><span className="capitalize text-ink-500">{l.kind} · {l.division}</span></li>)}</ul><p className="px-4 py-2 text-[11px] text-ink-400">Add / edit locations <Provisional note="stub — not built" /></p></Card>
      <Card title="Printers" subtitle="Label & receipt printers" testId="setup-printers-card"><ul className="space-y-1 text-xs"><li className="flex justify-between"><span>Front Desk label printer (PDF417)</span><span className="text-amber-800">mock</span></li><li className="flex justify-between"><span>Receipt printer</span><span className="text-amber-800">mock</span></li></ul><p className="mt-2 text-[11px] text-ink-400">Print jobs set a flag in the Label Queue <Provisional note="stub — no driver" /></p></Card>
    </div>
    {cf && <Modal testId="catalog-modal" title={cf.id ? 'Edit service' : 'New service'} onClose={() => setCf(null)}>
      <div className="grid grid-cols-3 gap-2 text-xs text-ink-500"><label className="col-span-3">Name<input data-testid="catalog-name" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} className={`${field} mt-1 block w-full`} /></label><label>Dept<select data-testid="catalog-dept" value={cf.dept} onChange={(e) => setCf({ ...cf, dept: e.target.value as DeptCode })} className={`${field} mt-1 block w-full`}>{(['W', 'B', 'P', 'PM'] as DeptCode[]).map((d) => <option key={d}>{d}</option>)}</select></label><label>Type<select data-testid="catalog-type" value={cf.type} onChange={(e) => setCf({ ...cf, type: e.target.value as LineType })} className={`${field} mt-1 block w-full`}><option value="service">service</option><option value="part">part</option><option value="shipping">shipping</option></select></label><label>Rate<input data-testid="catalog-rate" type="number" min={0} value={cf.rate} onChange={(e) => setCf({ ...cf, rate: Number(e.target.value) })} className={`${field} mt-1 block w-full text-right`} /></label></div>
      <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setCf(null)}>Cancel</Button><Button variant="primary" data-testid="catalog-save" onClick={() => run(async () => { await api.saveCatalogService(cf); setCf(null); }, 'Catalog saved')}>Save</Button></div>
    </Modal>}
  </>;
}

// Feature switches — manager-level on/off without a code change
export const FeatureSwitchesCard = () => {
  const [flags, setFlags] = useState<Record<api.FeatureKey, boolean> | null>(null); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void api.getFeatureFlags().then(setFlags); }, []);
  if (!flags) return null;
  return <Card title="Feature switches" subtitle="Turn client-facing behaviour on/off — off falls back to the staff flow, no gap" testId="feature-switches-card">
    <ul className="divide-y divide-line/70 text-xs">{(Object.keys(flags) as api.FeatureKey[]).map((k) => <li key={k} data-testid={`feature-${k}`} data-on={flags[k]} className="flex items-start justify-between gap-3 py-2"><div><div className="font-medium text-ink">{api.FEATURE_META[k].label}</div><div className="text-ink-500">{api.FEATURE_META[k].blurb}</div></div><button data-testid={`feature-toggle-${k}`} role="switch" aria-checked={flags[k]} onClick={() => void api.setFeatureFlag(k, !flags[k]).then((f) => { setFlags(f); setMsg(`${api.FEATURE_META[k].label}: ${f[k] ? 'ON' : 'OFF'}`); setTimeout(() => setMsg(null), 2000); })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${flags[k] ? 'bg-moss-600' : 'bg-ink-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${flags[k] ? 'left-[22px]' : 'left-0.5'}`} /></button></li>)}</ul>
    {msg && <div data-testid="feature-flash" className="mt-2 rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-700">{msg}</div>}
  </Card>;
};

// RolliConnect access — per-document gating by type + client accounts (password + TOTP replaced magic links)
export const RcAccessCard = () => {
  const [access, setAccess] = useState<Record<api.RcDocType, api.RcDocAccess> | null>(null); const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof api.rcListAccounts>>>([]); const [msg, setMsg] = useState<string | null>(null);
  const load = () => Promise.all([api.getRcDocAccess().then(setAccess), api.rcListAccounts().then(setAccounts)]);
  useEffect(() => { void load(); }, []);
  if (!access) return null;
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2500); };
  return <Card title="RolliConnect access" subtitle="Three tiers (MH 2026-10-01): PUBLIC · LINK (signed, scoped, expiring token — one object, one purpose) · SIGNED-IN (email one-time code / magic link, Touch ID once enrolled; no passwords). Money actions re-verify with a fresh code." testId="rc-access-card">
    <ul className="divide-y divide-line/70 text-xs" data-testid="rc-doc-access">{(Object.keys(api.RC_DOC_META) as api.RcDocType[]).map((k) => { const m = api.RC_DOC_META[k]; const v = access[k]; return <li key={k} data-testid={`rc-doc-${k}`} data-access={v} className="flex items-start justify-between gap-3 py-2"><div><div className="font-medium text-ink">{m.label}</div><div className="text-ink-500">{m.blurb}</div></div><span className="inline-flex shrink-0 overflow-hidden rounded-sm border border-line">{(['login', 'public'] as api.RcDocAccess[]).map((opt) => <button key={opt} type="button" data-testid={`rc-doc-${k}-${opt}`} aria-pressed={v === opt} disabled={opt === 'public' && !m.lockable} title={opt === 'public' && !m.lockable ? 'Identity-bound — cannot be public' : undefined} onClick={() => void api.setRcDocAccess(k, opt).then((n) => { setAccess(n); say(`${m.label.split(' ·')[0]} → ${opt === 'public' ? 'public link' : 'login required'}`); }).catch((e) => say(e instanceof Error ? e.message : 'Failed'))} className={`px-2.5 py-1 font-medium transition-colors ${v === opt ? 'bg-ink text-white' : 'bg-surface text-ink-600 hover:bg-canvas'} disabled:opacity-40`}>{opt === 'public' ? 'Public link' : 'Login required'}</button>)}</span></li>; })}</ul>
    <div className="mt-3 border-t border-line pt-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Link expiry defaults</div>
      <ul className="grid grid-cols-2 gap-x-4 text-xs" data-testid="rc-link-expiry">{(Object.keys(api.LINK_EXPIRY) as api.ClientLinkType[]).map((k) => <li key={k} className="flex justify-between gap-2 py-0.5"><span className="text-ink">{k}</span><span className="text-ink-500">{api.LINK_EXPIRY[k]}</span></li>)}</ul>
    </div>
    <div className="mt-3 border-t border-line pt-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Client accounts · {accounts.length}</div>
      <ul className="divide-y divide-line/70 text-xs" data-testid="rc-accounts">{accounts.map((a) => <li key={a.clientId} data-testid={`rc-account-${a.clientId}`} className="flex flex-wrap items-center gap-2 py-1.5"><span className="font-medium text-ink">{a.clientName}</span><span className="text-ink-500">{a.email}</span><span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${a.touchIdEnrolledAt ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-500'}`}>{a.touchIdEnrolledAt ? 'Touch ID on' : 'code by email'}</span><span className="text-ink-400">{a.signIns} sign-in{a.signIns === 1 ? '' : 's'}</span><span className="text-ink-400">created {fmtDate(a.createdAt)}{a.lastLoginAt ? ` · last sign-in ${fmtDate(a.lastLoginAt)}` : ''}</span><button type="button" data-testid={`rc-account-reset-${a.clientId}`} onClick={() => { if (window.confirm(`Reset ${a.clientName}'s RolliConnect account? They will need to sign up again.`)) void api.rcResetAccount(a.clientId).then(() => { say('Account reset'); void load(); }).catch((e) => say(e instanceof Error ? e.message : 'Failed')); }} className="ml-auto text-rose-700 hover:underline">Reset account</button></li>)}{!accounts.length && <li className="py-2 text-ink-400">No client accounts yet.</li>}</ul>
    </div>
    <p className="mt-2 text-[10px] text-ink-400">Photos: every staff photo is private by default — unlock per photo on the job (Photos panel / RW photo grid) to publish it behind the client’s login.</p>
    {msg && <div data-testid="rc-access-flash" className="mt-2 rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-700">{msg}</div>}
  </Card>;
};
